import warnings
import pdfplumber
import re
from collections import defaultdict
from langchain_huggingface import HuggingFaceEmbeddings
from langchain.text_splitter import RecursiveCharacterTextSplitter 
from langchain_elasticsearch import ElasticsearchStore
import os
from dotenv import load_dotenv
from langchain.text_splitter import NLTKTextSplitter
import nltk
from langchain.schema import Document
import tiktoken

nltk.download('punkt_tab')

# Load environment variables from .env file
load_dotenv()

# Suppress the specific warning related to clean_up_tokenization_spaces
warnings.filterwarnings("ignore", message="`clean_up_tokenization_spaces` was not set.")

os.environ["ES_API_KEY"] = os.getenv("ES_API_KEY")
os.environ["ES_CLOUD_ID"] = os.getenv("ES_CLOUD_ID")

DATA_PATH = 'data/'
INDEX_NAME = "fyp_pdf_data"
tokenizer = tiktoken.get_encoding("cl100k_base")

def clean_text(text):
    # Remove non-ASCII characters
    text = text.encode('ascii', 'ignore').decode('ascii')

    # Remove extra whitespace and line breaks
    text = re.sub(r'\s+', ' ', text)
    text = text.strip()

    return text

# Function to detect repeated headers/footers
def detect_repeated_elements(text_list, position="start", threshold=0.5):
    """
    Detects text elements that appear at the beginning (headers) or 
    end (footers) of pages across multiple pages.

    Args:
        text_list: List of page texts.
        position: "start" for headers, "end" for footers.
        threshold: Ratio of pages where text needs to be repeated 
                   to be considered a header/footer (0.5 means 50% of pages).

    Returns:
        A set of detected repeated header/footer text lines.
    """
    # Dictionary to count occurrences of potential headers/footers
    element_count = defaultdict(int)
    
    # Iterate through the text of each page
    for page_text in text_list:
        lines = page_text.split('\n')
        
        if position == "start" and lines:
            # Consider the first line as the header
            first_line = lines[0].strip()
            if first_line:
                element_count[first_line] += 1
        
        elif position == "end" and lines:
            # Consider the last line as the footer
            last_line = lines[-1].strip()
            if last_line:
                element_count[last_line] += 1

    # Determine repeated elements based on the threshold
    total_pages = len(text_list)
    repeated_elements = {line for line, count in element_count.items() if count / total_pages >= threshold}

    return repeated_elements

# Function to remove detected headers/footers from page text
def remove_headers_footers(text, headers, footers):
    lines = text.split('\n')
    
    # Remove header if present
    if lines and lines[0].strip() in headers:
        lines = lines[1:]
    
    # Remove footer if present
    if lines and lines[-1].strip() in footers:
        lines = lines[:-1]
    
    return '\n'.join(lines)

# Function to extract text from PDFs using pdfplumber and handle headers/footers
def extract_pdf_content(pdf_path):
    full_text = ""
    page_texts = []  # Store texts of each page for header/footer detection
    
    with pdfplumber.open(pdf_path) as pdf:
        for page_num, page in enumerate(pdf.pages):
            text = page.extract_text()
            if text:
                # Clean the extracted text
                clean_page_text = clean_text(text)
                page_texts.append(clean_page_text)
    
    # Detect headers and footers based on repeated patterns
    headers = detect_repeated_elements(page_texts, position="start", threshold=0.5)
    footers = detect_repeated_elements(page_texts, position="end", threshold=0.5)
    
    # Process each page and remove headers/footers
    for page_text in page_texts:
        processed_text = remove_headers_footers(page_text, headers, footers)
        full_text += processed_text + "\n"
    
    return full_text

def load_and_process_pdfs(data_path):
    documents = []
    
    # Load each PDF file in the directory
    for filename in os.listdir(data_path):
        if filename.endswith(".pdf"):
            pdf_path = os.path.join(data_path, filename)
            print(f"Processing: {pdf_path}")
            
            # Extract content from PDF
            content = extract_pdf_content(pdf_path)
            
            # Create a Document instance
            documents.append(Document(page_content=content, metadata={"source": filename}))
    
    return documents

def split_by_tokens(text, max_tokens=4000):
    tokens = tokenizer.encode(text)
    token_chunks = [tokens[i:i+max_tokens] for i in range(0, len(tokens), max_tokens)]
    return [tokenizer.decode(chunk) for chunk in token_chunks]

# Create vector database
def create_vector_db():
    # Load and process PDFs
    documents = load_and_process_pdfs(DATA_PATH)
    
    # Initialize text splitter (you can use your preferred one, e.g., NLTKTextSplitter or custom splitter)
    text_splitter = NLTKTextSplitter()

    # Store all chunks in a list
    all_chunks = []

    for doc in documents:
        chunks = text_splitter.split_text(doc.page_content)
        for chunk in chunks:
            # Check if chunk exceeds token limit
            if len(tokenizer.encode(chunk)) > 4000:
                sub_chunks = split_by_tokens(chunk, max_tokens=4000)
                for sub_chunk in sub_chunks:
                    all_chunks.append(Document(page_content=sub_chunk, metadata=doc.metadata))
            else:
                all_chunks.append(Document(page_content=chunk, metadata=doc.metadata))
    
    # Initialize HuggingFace embeddings
    embeddings = HuggingFaceEmbeddings(
        model_name='sentence-transformers/all-mpnet-base-v2',
        model_kwargs={'device': 'cpu'}
    )

    # Index the chunks into Elasticsearch
    db = ElasticsearchStore.from_documents(
        all_chunks,
        embedding=embeddings,
        index_name=INDEX_NAME,
        es_cloud_id=os.environ["ES_CLOUD_ID"],
        es_api_key=os.environ["ES_API_KEY"]
    )

if __name__ == "__main__":
    create_vector_db()
