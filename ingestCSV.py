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
import pandas as pd

nltk.download('punkt_tab')

# Load environment variables from .env file
load_dotenv()

# Suppress the specific warning related to clean_up_tokenization_spaces
warnings.filterwarnings("ignore", message="`clean_up_tokenization_spaces` was not set.")

os.environ["ES_API_KEY"] = os.getenv("ES_API_KEY")
os.environ["ES_CLOUD_ID"] = os.getenv("ES_CLOUD_ID")

#CSV_PATH = 'csv_data/Comprehensive_Banking_Database.csv'  # Path to your uploaded CSV
EXCEL_PATH = 'csv_data/bank.xlsx'  # Path to your uploaded Excel file
INDEX_NAME = "fyp_csv_data"
tokenizer = tiktoken.get_encoding("cl100k_base")

# Function to process the CSV file and convert it into documents
def load_and_process_csv(csv_path):
    documents = []

    # Read the CSV file
    df = pd.read_csv(csv_path)

    # Iterate over rows and convert each row to a text document
    for index, row in df.iterrows():
        # Combine all columns of the row into a single string
        content = ' '.join([f"{col}: {row[col]}" for col in df.columns])

        # Create a Document instance for each row
        documents.append(Document(page_content=content, metadata={"source": "csv_row", "row_index": index}))
    
    return documents

# Function to process the Excel file and convert it into documents
def load_and_process_excel(excel_path):
    documents = []

    # Read the Excel file
    df = pd.read_excel(excel_path)

    # Iterate over rows and convert each row to a text document
    for index, row in df.iterrows():
        # Combine all columns of the row into a single string
        content = ' '.join([f"{col}: {row[col]}" for col in df.columns])

        # Create a Document instance for each row
        documents.append(Document(page_content=content, metadata={"source": "excel_row", "row_index": index}))
    
    return documents

def split_by_tokens(text, max_tokens=4000):
    tokens = tokenizer.encode(text)
    token_chunks = [tokens[i:i+max_tokens] for i in range(0, len(tokens), max_tokens)]
    return [tokenizer.decode(chunk) for chunk in token_chunks]

def create_vector_db():

    # Load and process the CSV
    # csv_documents = load_and_process_csv(CSV_PATH)

    # Load and process the Excel file
    excel_documents = load_and_process_excel(EXCEL_PATH)
    
    # Combine PDF, CSV, and Excel documents
    # all_documents = csv_documents + excel_documents
    
    # Initialize text splitter (you can use your preferred one, e.g., NLTKTextSplitter or custom splitter)
    text_splitter = NLTKTextSplitter()

    # Store all chunks in a list
    all_chunks = []

    for doc in excel_documents:
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
        model_kwargs={'device': 'cuda'}
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
