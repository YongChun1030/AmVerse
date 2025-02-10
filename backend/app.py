from flask import Flask, request, jsonify
import logging
from langchain.prompts import PromptTemplate
from langchain.chains import RetrievalQA
from langchain_huggingface import HuggingFaceEmbeddings
from langchain_elasticsearch import ElasticsearchStore
from langchain_openai import ChatOpenAI
from dotenv import load_dotenv
import os
from langchain.schema import Document
from flask_cors import CORS
import pdfplumber
import re
from collections import defaultdict
from langchain.text_splitter import NLTKTextSplitter, RecursiveCharacterTextSplitter
import nltk
import tiktoken
import tempfile
from concurrent.futures import ThreadPoolExecutor
from sentence_transformers import util
from pdf2image import convert_from_path
from supabase import create_client
import fitz
from elasticsearch.exceptions import NotFoundError
from elasticsearch import Elasticsearch

nltk.download('punkt')

load_dotenv()

app = Flask(__name__)
CORS(app, resources={r"/*": {"origins": ["http://localhost:3000", "http://127.0.0.1:3000"]}})
logging.basicConfig(level=logging.INFO)

# Load environment variables
os.environ["LANGCHAIN_TRACING_V2"] = "true"
os.environ["LANGCHAIN_API_KEY"] = os.getenv("LANGCHAIN_API_KEY")
os.environ["ES_API_KEY"] = os.getenv("ES_API_KEY")
os.environ["ES_CLOUD_ID"] = os.getenv("ES_CLOUD_ID")
os.environ["OPENAI_API_KEY"] = os.getenv("OPENAI_API_KEY")
SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_KEY = os.getenv("SUPABASE_KEY")

tokenizer = tiktoken.get_encoding("cl100k_base")

embeddings = HuggingFaceEmbeddings(
    model_name='sentence-transformers/all-mpnet-base-v2',
    model_kwargs={'device': 'cpu'}
)

custom_prompt_template = """
Use the following pieces of retrieved context to answer the question.
If you don't know the answer, just say that you don't know.
After providing your response, mention the specific resources you referred to.

Context:
{context}

Question:
{question}

Response:
Include your answer here.
Mention the source of information (e.g., 'This information was referenced from [file name]). If there is no source, then no need mention.
"""

financial_assessment_prompt = """
Analyze the following financial data and provide an assessment with key insights and recommendations.

Data: {customer_data}

"""

goal_setting_prompt = """
Based on the following financial data, help set specific, measurable, achievable, relevant, and time-bound (SMART) financial goals for the customer.
Data: {customer_data}
"""

tax_planning_prompt = """
Based on the following financial data, provide a tax planning strategy that includes recommendations for deductions, tax-efficient investments, and strategies to minimize taxable income.
Data: {customer_data}
"""

budgeting_prompt = """
Based on the following financial data, create a personalized budget plan, including recommendations for reducing expenses, increasing savings, and managing cash flow effectively.
Data: {customer_data}
"""

retirement_planning_prompt = """
Based on the following financial data, create a retirement plan that includes strategies for maximizing savings, projected income needs, and recommendations on Social Security and pension benefits.
Data: {customer_data}
"""

def set_user_prompt(user_prompt_template):
    prompt = PromptTemplate(template=user_prompt_template, input_variables=['context', 'question'])
    return prompt

def set_custom_prompt():
    prompt = PromptTemplate(template=custom_prompt_template, input_variables=['context', 'question'])
    return prompt

def set_goal_setting_prompt():
    prompt = PromptTemplate(template=goal_setting_prompt, input_variables=['customer_data'])
    return prompt

def set_financial_assessment_prompt():
    prompt = PromptTemplate(template=financial_assessment_prompt, input_variables=['customer_data'])
    return prompt

def set_tax_planning_prompt():
    prompt = PromptTemplate(template=tax_planning_prompt, input_variables=['customer_data'])
    return prompt

def set_budgeting_prompt():
    prompt = PromptTemplate(template=budgeting_prompt, input_variables=['customer_data'])
    return prompt

def set_retirement_planning_prompt():
    prompt = PromptTemplate(template=retirement_planning_prompt, input_variables=['customer_data'])
    return prompt


def retrieval_qa_chain(llm, prompt, retriever):
    return RetrievalQA.from_chain_type(
        llm=llm,
        chain_type='stuff',
        retriever=retriever,
        return_source_documents=True,
        chain_type_kwargs={'prompt': prompt}
    )

def load_llm():
    llm = ChatOpenAI(model_name="gpt-4o", temperature=0)
    return llm

def qa_bot(index_name="public_index"):
    pdf_db = ElasticsearchStore(
        embedding=embeddings,
        index_name=index_name,
        es_cloud_id=os.environ["ES_CLOUD_ID"],
        es_api_key=os.environ["ES_API_KEY"]
    )
    pdf_retriever = pdf_db.as_retriever(search_kwargs={'k': 5})

    llm = load_llm()
    qa_prompt = set_custom_prompt()
    return retrieval_qa_chain(llm, qa_prompt, pdf_retriever)

@app.route('/get_financial_assessment', methods=['POST'])
def get_financial_assessment():
    data = request.json
    customer_name = data.get("customer_name")
    query = data.get("query", "financial assessment").lower()
    context = data.get("context", "")  # Retrieve previous conversation context

    if not customer_name:
        return jsonify({"response": "Customer name is required."}), 400

    validation_response = detect_unauthorized_query(query, customer_name)
    if validation_response.lower() != "allowed":
        # If it's a warning or unclear, return the GPT response as is
        return jsonify({"response": validation_response})

    sanitized_name = re.sub(r'[^\w\-]', '_', customer_name).lower()
    index_name = f"{sanitized_name}_bank_info_index"

    try:
        # Rebuild query using GPT
        chain = qa_bot(index_name)
        rebuilt_query = rebuild_query_with_llm(context, query)

        # Retrieve relevant documents
        res = chain.retriever.get_relevant_documents(f"{rebuilt_query} for {customer_name}")
        if not res:
            return jsonify({"response": "No relevant customer data found. Please contact the system administrator."}), 404

        # Process retrieved content
        top_chunk = res[0].page_content
        financial_assessment_prompt_template = PromptTemplate(
            template=financial_assessment_prompt,
            input_variables=['customer_data']
        )
        prompt = financial_assessment_prompt_template.format(customer_data=top_chunk)
        result = chain(prompt)
        answer = result.get("result", "No assessment generated.")

        return jsonify({"response": answer})

    except NotFoundError:
        # Handle case where the index does not exist
        return jsonify({"response": "No relevant customer data found in the system. Please contact the system administrator."}), 404

    except Exception as e:
        # Log unexpected errors for debugging
        logging.error(f"Unexpected error: {e}")
        return jsonify({"response": "An error occurred while processing your request. Please try again later."}), 500

@app.route('/get_goal_setting', methods=['POST'])
def get_goal_setting():
    data = request.json
    customer_name = data.get("customer_name")
    query = data.get("query", "goal setting").lower()
    context = data.get("context", "")  # Retrieve previous conversation context

    if not customer_name:
        return jsonify({"response": "Customer name is required."}), 400

    validation_response = detect_unauthorized_query(query, customer_name)
    if validation_response.lower() != "allowed":
        # If it's a warning or unclear, return the GPT response as is
        return jsonify({"response": validation_response})

    sanitized_name = re.sub(r'[^\w\-]', '_', customer_name).lower()
    index_name = f"{sanitized_name}_bank_info_index"

    # Rebuild query using GPT
    chain = qa_bot(index_name)
    rebuilt_query = rebuild_query_with_llm(context, query)

    # Retrieve relevant documents
    res = chain.retriever.get_relevant_documents(f"{rebuilt_query} for {customer_name}")
    if not res:
        return jsonify({"response": "No relevant financial goals data found."})

    # Process retrieved content
    top_chunk = res[0].page_content
    goal_setting_prompt_template = PromptTemplate(
        template=goal_setting_prompt,
        input_variables=['customer_data']
    )
    prompt = goal_setting_prompt_template.format(customer_data=top_chunk)
    result = chain(prompt)
    answer = result.get("result", "No goal setting generated.")

    return jsonify({"response": answer})


@app.route('/get_tax_planning', methods=['POST'])
def get_tax_planning():
    data = request.json
    customer_name = data.get("customer_name")
    query = data.get("query", "tax planning").lower()
    context = data.get("context", "")  # Retrieve previous conversation context

    if not customer_name:
        return jsonify({"response": "Customer name is required."}), 400

    validation_response = detect_unauthorized_query(query, customer_name)
    if validation_response.lower() != "allowed":
        # If it's a warning or unclear, return the GPT response as is
        return jsonify({"response": validation_response})

    sanitized_name = re.sub(r'[^\w\-]', '_', customer_name).lower()
    index_name = f"{sanitized_name}_bank_info_index"

    # Rebuild query using GPT
    chain = qa_bot(index_name)
    rebuilt_query = rebuild_query_with_llm(context, query)

    # Retrieve relevant documents
    res = chain.retriever.get_relevant_documents(f"{rebuilt_query} for {customer_name}")
    if not res:
        return jsonify({"response": "No relevant tax planning data found."})

    # Process retrieved content
    top_chunk = res[0].page_content
    tax_prompt_template = set_tax_planning_prompt()
    prompt = tax_prompt_template.format(customer_data=top_chunk)
    result = chain(prompt)
    answer = result.get("result", "No tax planning advice generated.")

    return jsonify({"response": answer})


@app.route('/get_budgeting', methods=['POST'])
def get_budgeting():
    data = request.json
    customer_name = data.get("customer_name")
    query = data.get("query", "budgeting").lower()
    context = data.get("context", "")  # Retrieve previous conversation context

    if not customer_name:
        return jsonify({"response": "Customer name is required."}), 400

    validation_response = detect_unauthorized_query(query, customer_name)
    if validation_response.lower() != "allowed":
        # If it's a warning or unclear, return the GPT response as is
        return jsonify({"response": validation_response})

    sanitized_name = re.sub(r'[^\w\-]', '_', customer_name).lower()
    index_name = f"{sanitized_name}_bank_info_index"

    # Rebuild query using GPT
    chain = qa_bot(index_name)
    rebuilt_query = rebuild_query_with_llm(context, query)

    # Retrieve relevant documents
    res = chain.retriever.get_relevant_documents(f"{rebuilt_query} for {customer_name}")
    if not res:
        return jsonify({"response": "No relevant budgeting data found."})

    # Process retrieved content
    top_chunk = res[0].page_content
    budgeting_prompt_template = set_budgeting_prompt()
    prompt = budgeting_prompt_template.format(customer_data=top_chunk)
    result = chain(prompt)
    answer = result.get("result", "No budgeting advice generated.")

    return jsonify({"response": answer})


@app.route('/get_retirement_planning', methods=['POST'])
def get_retirement_planning():
    data = request.json
    customer_name = data.get("customer_name")
    query = data.get("query", "retirement planning").lower()
    context = data.get("context", "")  # Retrieve previous conversation context

    if not customer_name:
        return jsonify({"response": "Customer name is required."}), 400

    validation_response = detect_unauthorized_query(query, customer_name)
    if validation_response.lower() != "allowed":
        # If it's a warning or unclear, return the GPT response as is
        return jsonify({"response": validation_response})

    sanitized_name = re.sub(r'[^\w\-]', '_', customer_name).lower()
    index_name = f"{sanitized_name}_bank_info_index"

    # Rebuild query using GPT
    chain = qa_bot(index_name)
    rebuilt_query = rebuild_query_with_llm(context, query)

    # Retrieve relevant documents
    res = chain.retriever.get_relevant_documents(f"{rebuilt_query} for {customer_name}")
    if not res:
        return jsonify({"response": "No relevant retirement data found."})

    # Process retrieved content
    top_chunk = res[0].page_content
    retirement_prompt_template = set_retirement_planning_prompt()
    prompt = retirement_prompt_template.format(customer_data=top_chunk)
    result = chain(prompt)
    answer = result.get("result", "No retirement planning advice generated.")

    return jsonify({"response": answer})

# Add RAG endpoint
@app.route('/rag_query', methods=['POST'])
def rag_query():
    data = request.json
    query = data.get('query', '').lower()
    context = data.get('context', '')  # Retrieve the conversation history
    customer_name = data.get('customer_name', '').lower()

    # Define the financial keywords and their corresponding endpoints
    financial_keywords = {
        'financial assessment': '/get_financial_assessment',
        'goal setting': '/get_goal_setting',
        'tax planning': '/get_tax_planning',
        'budgeting': '/get_budgeting',
        'retirement planning': '/get_retirement_planning'
    }

    # Check if the query contains specific financial keywords
    for keyword, endpoint in financial_keywords.items():
        if keyword in query:
            return forward_request_to_endpoint(endpoint, data)

    # Check if the query is asking for general financial advice
    if 'financial advice' in query:
        return jsonify({
            "response": "Which specific financial advice would you like? "
                        "Options are: Financial Assessment, Goal Setting, Tax Planning, "
                        "Budgeting, or Retirement Planning.",
            "requires_followup": True  # Add this flag to indicate follow-up is expected
        })
    
    index_name = "public_index"

    # Step 1: Rebuild query with LLM
    rebuilt_query = rebuild_query_with_llm(context, query)
    if not isinstance(rebuilt_query, str):
        logging.warning(f"Rebuilt query is not a string: {rebuilt_query}")
        rebuilt_query = str(rebuilt_query)

    # Step 2: Get initial response and top 5 sources
    chain = qa_bot(index_name)
    result = chain(rebuilt_query)
    response_text = result.get("result", "No response generated.")
    source_documents = result.get("source_documents", [])

    if not response_text.strip() or "I don't know" in response_text:
        # If no meaningful answer is provided, return an empty sources list
        logging.info("No meaningful response provided by GPT. No sources will be displayed.")
        return jsonify({
            "original_query": query,
            "rebuilt_query": rebuilt_query,
            "response": response_text,
            "sources": []  # No sources are displayed
        })

    sources_summary = [
        f"- Source: {doc.metadata.get('source')}, Page: {doc.metadata.get('page_number')}, Screenshot URL: {doc.metadata.get('screenshot_url', 'N/A')}, Content: {doc.page_content}"
        for doc in source_documents
    ]
    sources_summary_text = "\n".join(sources_summary)

    reask_query = f"""
    Based on the following answer and the sources provided, identify which source, page number (the page number may not follow the actual one; you must determine the correct one), and screenshot URL were used to construct the answer.

    Answer:
    {response_text}

    Sources:
    {sources_summary_text}

    Important Instructions:
    1. Return your response as a list in the exact format below:
    - Source: [source], Page: [correct_page_number], Screenshot URL: [screenshot_url]
    2. Do not encode, reformat, or modify the URLs in any way. Ensure the `screenshot_url` matches the exact format provided in the `sources_summary_text`, including spaces or special characters.
    3. Verify that the page number and content align with the answer while ensuring the URLs remain unchanged.
    """

    gpt_response = chain(reask_query)
    used_sources_text = gpt_response.get("result", "")

    logging.info(f"The screenshot URLs: {used_sources_text}")

    # Step 4: Match sources explicitly mentioned by GPT
    used_sources = []
    for doc in source_documents:
        source_identifier = f"Source: {doc.metadata.get('source')}, Page: {doc.metadata.get('page_number')}, Screenshot URL: {doc.metadata.get('screenshot_url', 'N/A')}"
        
        # Normalize for comparison
        normalized_used_sources_text = used_sources_text.lower().replace("\n", "").strip()
        normalized_source_identifier = source_identifier.lower().strip()
        
        if normalized_source_identifier in normalized_used_sources_text:
            used_sources.append({
                "content": doc.page_content,
                "metadata": {
                    "source": doc.metadata.get("source"),
                    "page_number": doc.metadata.get("page_number"),
                    "screenshot_url": doc.metadata.get("screenshot_url")
                }
            })

    # Log filtered sources for debugging
    logging.info(f"Filtered sources with screenshot URLs: {used_sources}")

    return jsonify({
        "original_query": query,
        "rebuilt_query": rebuilt_query,
        "response": response_text,
        "sources": used_sources  # Include sources with screenshot URLs
    })

def forward_request_to_endpoint(endpoint, data):
    """Helper function to forward request to another endpoint."""
    with app.test_request_context(endpoint, method='POST', json=data):
        response = app.full_dispatch_request()
        return response

def detect_unauthorized_query(query, user_name):
    prompt = f"""
    You are an AI assistant ensuring user privacy and data security. Analyze the following query to determine if it attempts to access someone else's financial data.

    Query: "{query}"
    User's Name: "{user_name}"
    
    If the query explicitly mentions another person's name or attempts to access someone else's financial data (e.g., financial assessment, financial goal setting, budgeting, tax planning, or retirement planning for another person), craft a polite response reminding the user that accessing other people's information is not allowed, just provide the response.

    If the query is about financial advice or the user's own financial data without mentioning another person's name, respond with "allowed".
    """

    llm = load_llm()  # Load your GPT model
    response = llm.invoke(prompt)

    # Extract and return the response text
    if isinstance(response, str):
        return response.strip()
    elif hasattr(response, "content"):
        return response.content.strip()
    else:
        logging.error(f"Unexpected LLM response format: {response}")
        return "unclear"
    
def rebuild_query_with_llm(history, current_query):
    llm_prompt = f"""
    You are an AI assistant. Based on the following conversation history and new query, first determine if the conversation history is related to the new query. 
    If it is, reconstruct the query to include all necessary context. If not, return the current query.
    Important note: 
    1. Just provide the query do not add other things.
    2. There will be a special case where user will ask about financial advice like financial assessment, financial goal setting, budgeting, tax planning and retirement planning, if user ask this can reconstruct the query by ignoring the history.

    Conversation History:
    {history}

    New Query:
    {current_query}

    Reconstructed Query:
    """
    llm = load_llm()  
    response = llm.invoke(llm_prompt) 

    if hasattr(response, "content"):  
        return response.content.strip()
    elif isinstance(response, str): 
        return response.strip()
    else:
        logging.error(f"Unexpected LLM response format: {response}")
        return current_query 

@app.route('/gpt_query', methods=['POST'])
def gpt_query():
    data = request.json
    query = data.get('query', '')
    llm = load_llm()  # Load GPT model only
    result = llm.invoke(query)
    
    # Adjusting for possible AIMessage format
    response_text = result if isinstance(result, str) else getattr(result, "content", "No response generated.")
    
    print("GPT:", response_text)
    return jsonify({"query": query, "response": response_text})

def clean_text(text):
    text = text.encode('ascii', 'ignore').decode('ascii')
    text = re.sub(r'\s+', ' ', text).strip()
    return text

def detect_repeated_elements(text_list, position="start", threshold=0.5):
    element_count = defaultdict(int)
    for page_text in text_list:
        lines = page_text.split('\n')
        if position == "start" and lines:
            first_line = lines[0].strip()
            if first_line:
                element_count[first_line] += 1
        elif position == "end" and lines:
            last_line = lines[-1].strip()
            if last_line:
                element_count[last_line] += 1
    total_pages = len(text_list)
    return {line for line, count in element_count.items() if count / total_pages >= threshold}

def remove_headers_footers(text, headers, footers):
    lines = text.split('\n')
    if lines and lines[0].strip() in headers:
        lines = lines[1:]
    if lines and lines[-1].strip() in footers:
        lines = lines[:-1]
    return '\n'.join(lines)

def extract_pdf_content(pdf_path):
    full_text = ""
    page_texts = []
    with pdfplumber.open(pdf_path) as pdf:
        for page_number, page in enumerate(pdf.pages, start=1):
            text = page.extract_text()
            if text:
                clean_page_text = clean_text(text)
                page_texts.append((clean_page_text, page_number)) 
    headers = detect_repeated_elements([text for text, _ in page_texts], position="start", threshold=0.5)
    footers = detect_repeated_elements([text for text, _ in page_texts], position="end", threshold=0.5)
    for page_text, _ in page_texts:
        processed_text = remove_headers_footers(page_text, headers, footers)
        full_text += processed_text + "\n"
    return page_texts

def split_by_tokens(text, max_tokens=4000):
    tokens = tokenizer.encode(text)
    token_chunks = [tokens[i:i+max_tokens] for i in range(0, len(tokens), max_tokens)]
    return [tokenizer.decode(chunk) for chunk in token_chunks]

def improved_split_by_tokens(text, max_tokens=4000):
    # Use a semantic-aware text splitter
    splitter = RecursiveCharacterTextSplitter(
        chunk_size=max_tokens,
        chunk_overlap=100,  # Small overlap to ensure continuity
        separators=["\n\n", "\n", ".", " "]
    )
    return splitter.split_text(text)

def process_chunks(chunks, metadata, tokenizer, max_tokens=4000):
    processed_chunks = []

    def handle_large_chunk(chunk_info):
        chunk, page_number = chunk_info
        screenshot_url = metadata["screenshot_urls"][page_number - 1] if len(metadata["screenshot_urls"]) >= page_number else None

        if not screenshot_url:
            logging.error(f"Missing screenshot URL for page {page_number}")

        if len(tokenizer.encode(chunk)) > max_tokens:
            sub_chunks = improved_split_by_tokens(chunk, max_tokens=max_tokens)
            return [
                Document(
                    page_content=sub_chunk,
                    metadata={
                        **metadata,
                        "page_number": page_number,
                        "screenshot_url": screenshot_url,  # Add screenshot URL
                        "index": f"{metadata['source']}_page_{page_number}_chunk_{i+1}"
                    }
                ) for i, sub_chunk in enumerate(sub_chunks)
            ]
        else:
            return [
                Document(
                    page_content=chunk,
                    metadata={
                        **metadata,
                        "page_number": page_number,
                        "screenshot_url": screenshot_url,  # Add screenshot URL
                        "index": f"{metadata['source']}_page_{page_number}_chunk_1"
                    }
                )
            ]

    with ThreadPoolExecutor() as executor:
        results = executor.map(handle_large_chunk, chunks)
        for result in results:
            processed_chunks.extend(result)

    return processed_chunks

def generate_screenshots(pdf_path, output_dir, pdf_filename):

    doc = fitz.open(pdf_path)
    screenshot_paths = []

    for page_number in range(len(doc)):
        page = doc[page_number]
        pix = page.get_pixmap()  
        file_name = f"{os.path.splitext(pdf_filename)[0]}_page_{page_number + 1}.png"
        screenshot_path = os.path.join(output_dir, file_name)
        pix.save(screenshot_path)
        screenshot_paths.append((screenshot_path, file_name))
        logging.info(f"Generated screenshot for {pdf_filename}, page {page_number + 1}: {screenshot_path}")

    doc.close()
    return screenshot_paths

def upload_to_supabase(screenshot_paths, folder_prefix, pdf_filename):
    supabase = create_client(SUPABASE_URL, SUPABASE_KEY)
    screenshot_urls = []
    folder_name = os.path.splitext(pdf_filename)[0] 
    parent_folder = f"{folder_prefix}/{folder_name}"  

    for path, file_name in screenshot_paths:  
        try:
            bucket_file_path = f"{parent_folder}/{file_name}"
            response = supabase.storage.from_('screenshots').upload(bucket_file_path, path)

            if response and response.status_code == 200:
                public_url = supabase.storage.from_('screenshots').get_public_url(bucket_file_path)
                public_url = public_url.split('?')[0] 
                screenshot_urls.append(public_url)
                logging.info(f"Uploaded {file_name} successfully. URL: {public_url}")
            else:
                logging.error(f"Failed to upload {file_name}: {response.json().get('message', 'Unknown error')}")

        except Exception as e:
            logging.error(f"Exception occurred while uploading {file_name}: {e}")

    return screenshot_urls

@app.route('/ingest_pdfs', methods=['POST'])
def ingest_pdf():
    if 'file' not in request.files:
        return jsonify({'success': False, 'message': 'No file provided'}), 400
    file = request.files['file']
    index_type = request.form.get('indexType', 'User').capitalize() 
    customer_name = request.form.get('customerName', '')
    private_name = request.form.get('privateName', '').lower()
    
    if file.filename == '':
        return jsonify({'success': False, 'message': 'No selected file'}), 400
    if not file.filename.lower().endswith('.pdf'):
        return jsonify({'success': False, 'message': 'Invalid file type. Please upload a PDF.'}), 400

    try:
        if index_type == "Private":
            if not private_name:
                return jsonify({'success': False, 'message': 'Private name is required for Private indexing.'}), 400
            sanitized_name = re.sub(r'[^\w\-]', '_', private_name).lower()
            index_name = f"{sanitized_name}_bank_info_index"
            folder_prefix = f"{sanitized_name}_bank_info_screen"
        elif index_type == "User":
            sanitized_name = re.sub(r'[^\w\-]', '_', customer_name).lower()
            index_name = f"{sanitized_name}_user_index"
            folder_prefix = f"{sanitized_name}_user_folder"
        else:
            index_name = f"{index_type.lower()}_index"
            folder_prefix = f"{index_type.lower()}_folder"
        logging.info(f"Indexing to {index_name} and storing screenshots in {folder_prefix}.")
    except Exception as e:
        logging.error(f"Error constructing index/folder names: {e}")
        return jsonify({'success': False, 'message': 'Error constructing index/folder names.', 'error': str(e)}), 500

    temp_dir = tempfile.gettempdir()
    temp_file_path = os.path.join(temp_dir, file.filename)
    file.save(temp_file_path)

    try:
        page_texts = extract_pdf_content(temp_file_path)
        screenshot_paths = generate_screenshots(temp_file_path, temp_dir, file.filename)
        screenshot_urls = upload_to_supabase(screenshot_paths, folder_prefix, file.filename)
        chunks = []
        for page_text, page_number in page_texts:
            page_chunks = improved_split_by_tokens(page_text, max_tokens=4000)
            for chunk in page_chunks:
                screenshot_url = screenshot_urls[page_number - 1] if len(screenshot_urls) >= page_number else None
                if not screenshot_url:
                    logging.error(f"Missing screenshot URL for page {page_number}")
                chunks.append({
                    "chunk": chunk,
                    "page_number": page_number,
                    "screenshot_url": screenshot_url,
                })

        all_chunks = process_chunks(
            [(chunk["chunk"], chunk["page_number"]) for chunk in chunks],
            metadata={
                "source": file.filename,
                "screenshot_urls": screenshot_urls,
            },
            tokenizer=tokenizer
        )
        db = ElasticsearchStore.from_documents(
            all_chunks,
            embedding=embeddings,
            index_name=index_name,
            es_cloud_id=os.environ["ES_CLOUD_ID"],
            es_api_key=os.environ["ES_API_KEY"]
        )
        logging.info(f"PDF ingestion successful, {len(all_chunks)} documents indexed.")
        return jsonify({"success": True, "message": "PDF ingestion complete.", "documents_indexed": len(all_chunks)})
    except Exception as e:
        logging.error(f"Error processing file: {e}")
        return jsonify({'success': False, 'message': 'Error processing file', 'error': str(e)}), 500
    finally:
        if os.path.exists(temp_file_path):
            os.remove(temp_file_path)

@app.route('/delete_previous_file', methods=['POST'])
def delete_previous_file():
    data = request.json
    customer_name = data.get("customer_name")
    index_type = data.get("index_type", "User").capitalize()

    if index_type != "User":
            logging.info(f"No action needed for index_type: {index_type}")
            return jsonify({'success': True, 'message': 'No action needed for this index type.'})

    # Use customer_name or private_name, sanitize, and lowercase
    sanitized_name = re.sub(r'[^\w\-]', '_', customer_name).lower()
    index_name = f"{sanitized_name}_user_index"
    folder_prefix = f"{sanitized_name}_user_folder"

    try:
        es_client = Elasticsearch(
            cloud_id=os.environ["ES_CLOUD_ID"],
            api_key=os.environ["ES_API_KEY"]
        )
        if es_client.indices.exists(index=index_name):
            es_client.indices.delete(index=index_name)
            logging.info(f"Deleted Elasticsearch index: {index_name}")
        else:
            logging.info(f"Elasticsearch index not found: {index_name}")
    except Exception as e:
        logging.error(f"Error with Elasticsearch: {e}")
        return jsonify({'success': False, 'message': 'Error with Elasticsearch', 'error': str(e)}), 500

    # Attempt to delete files in Supabase
    try:
        supabase = create_client(SUPABASE_URL, SUPABASE_KEY)
        folder_files = supabase.storage.from_('screenshots').list(folder_prefix)
        if folder_files and isinstance(folder_files, list):
            file_paths = [f"{folder_prefix}/{file['name']}" for file in folder_files]
            response = supabase.storage.from_('screenshots').remove(file_paths)
            if 'error' in response and response['error']:
                logging.error(f"Error deleting Supabase files: {response['error']['message']}")
                return jsonify({'success': False, 'message': 'Error deleting files'}), 500
            logging.info(f"Deleted Supabase folder: {folder_prefix}")
    except Exception as e:
        logging.error(f"Error with Supabase: {e}")
        return jsonify({'success': False, 'message': 'Error with Supabase', 'error': str(e)}), 500

    return jsonify({'success': True, 'message': 'Deleted User index and folder.'})

@app.route('/rag_query_custom', methods=['POST'])
def rag_query_custom():
    data = request.json
    query = data.get('query', '').lower()
    context = data.get('context', '')  # Retrieve the conversation history
    customer_name = data.get('customer_name', '').lower()
    user_prompt = data.get('customPrompt', '') 

    validated_prompt = validate_and_redefine_prompt(user_prompt)
    set_user_prompt(validated_prompt)  

    sanitized_name = re.sub(r'[^\w\-]', '_', customer_name).lower()
    index_name = f"{sanitized_name}_user_index"

    # Step 1: Rebuild query with LLM
    rebuilt_query = rebuild_query_with_llm(context, query)
    if not isinstance(rebuilt_query, str):
        logging.warning(f"Rebuilt query is not a string: {rebuilt_query}")
        rebuilt_query = str(rebuilt_query)

    # Step 2: Get initial response and top 5 sources
    chain = qa_bot(index_name)
    result = chain(rebuilt_query)
    response_text = result.get("result", "No response generated.")
    source_documents = result.get("source_documents", [])

    if not response_text.strip() or "I don't know" in response_text:
        # If no meaningful answer is provided, return an empty sources list
        logging.info("No meaningful response provided by GPT. No sources will be displayed.")
        return jsonify({
            "original_query": query,
            "rebuilt_query": rebuilt_query,
            "response": response_text,
            "sources": []  # No sources are displayed
        })

    sources_summary = [
        f"- Source: {doc.metadata.get('source')}, Page: {doc.metadata.get('page_number')}, Screenshot URL: {doc.metadata.get('screenshot_url', 'N/A')}, Content: {doc.page_content}"
        for doc in source_documents
    ]
    sources_summary_text = "\n".join(sources_summary)

    reask_query = f"""
    Based on the following answer and the sources provided, identify the which source, page number (the page number is not following the actual one you must figure out which one is correct), and screenshot url used to construct the answer.

    Answer:
    {response_text}

    Sources:
    {sources_summary_text}

    Format your response as a list:
    - Source: [source], Page: [correct_page_number], Screenshot URL: [screenshot_url]
    
    Ensure the page number is accurate and verify the information aligns with the answer.
    """

    gpt_response = chain(reask_query)
    used_sources_text = gpt_response.get("result", "")

    # Step 4: Match sources explicitly mentioned by GPT
    used_sources = []
    for doc in source_documents:
        source_identifier = f"Source: {doc.metadata.get('source')}, Page: {doc.metadata.get('page_number')}, Screenshot URL: {doc.metadata.get('screenshot_url', 'N/A')}"
        if source_identifier in used_sources_text:
            used_sources.append({
                "content": doc.page_content,
                "metadata": {
                    "source": doc.metadata.get("source"),
                    "page_number": doc.metadata.get("page_number"),
                    "screenshot_url": doc.metadata.get("screenshot_url")  # Include screenshot URL
                }
            })

    # Log filtered sources for debugging
    logging.info(f"Filtered sources with screenshot URLs: {used_sources}")

    return jsonify({
        "original_query": query,
        "rebuilt_query": rebuilt_query,
        "response": response_text,
        "sources": used_sources  # Include sources with screenshot URLs
    })

def validate_and_redefine_prompt(prompt):
    validation_prompt = f"""
    Evaluate the following prompt and determine if it is clear and specific:
    
    Prompt:
    {prompt}
    
    If it is unclear, rewrite the prompt to make it clear and specific. Otherwise, return the original prompt. Only return the improved prompt or the original prompt.
    """
    llm = load_llm()  # Load GPT model
    response = llm.invoke(validation_prompt)

    # Extract the plain content from the response
    if hasattr(response, "content"):  # Check if response has 'content' attribute
        return response.content.strip()
    elif isinstance(response, str):  # If response is already a string
        return response.strip()
    else:
        logging.error(f"Unexpected LLM response format: {response}")
        return prompt  # Fallback to the original prompt

if __name__ == '__main__':
    app.run(debug=False)
