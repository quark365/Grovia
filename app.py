from flask import Flask, Response, json, render_template, request, jsonify
from flask import stream_with_context
from groq import Groq
import io
import numpy as np
import soundfile as sf
import easyocr
from PIL import Image
import os
import base64
import tempfile
import threading
from werkzeug.utils import secure_filename
import PyPDF2
from docx import Document
import re
import logging

app = Flask(__name__)
app.config['MAX_CONTENT_LENGTH'] = 16 * 1024 * 1024  # 16MB max upload
app.config['UPLOAD_FOLDER'] = 'uploads'
os.makedirs(app.config['UPLOAD_FOLDER'], exist_ok=True)

# Set up logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Initialize EasyOCR reader in a separate thread
reader = None
reader_lock = threading.Lock()

def initialize_ocr():
    global reader
    with reader_lock:
        if reader is None:
            try:
                reader = easyocr.Reader(['en'], gpu=False)  # Disable GPU for broader compatibility
                logger.info("EasyOCR initialized successfully")
            except Exception as e:
                logger.error(f"Error initializing EasyOCR: {str(e)}")

# Start initialization in background
threading.Thread(target=initialize_ocr, daemon=True).start()

def get_groq_client(api_key=None):
    """Initialize Groq client with API key from request or environment."""
    if not api_key:
        api_key = os.getenv('GROQ_API_KEY')
    if not api_key:
        raise ValueError("API key is required")
    return Groq(api_key=api_key)

def transcribe_audio(audio_file_path, api_key):
    """Transcribe audio using Groq's Whisper model."""
    client = get_groq_client(api_key)
    try:
        with open(audio_file_path, 'rb') as audio_file:
            completion = client.audio.transcriptions.create(
                model="whisper-large-v3",  # Use standard Whisper model
                file=audio_file,
                response_format="text"
            )
        return completion, None
    except Exception as e:
        logger.error(f"Transcription error: {str(e)}")
        return None, f"Error in transcription: {str(e)}"

def generate_response(input_text, api_key, reasoning=False, agentic=False):
    client = get_groq_client(api_key)
    try:
        model = "llama3-70b-8192"
        if reasoning:
            model = "deepseek-r1-distill-llama-70b" if not agentic else "compound-beta"
        
        # Prepare the API call parameters
        params = {
            "model": model,
            "messages": [
                {"role": "system", "content": "You are a helpful assistant."},
                {"role": "user", "content": input_text}
            ],
            "temperature": 0.6,
            "max_completion_tokens": 1024,
            "top_p": 0.95,
            "stream": reasoning
        }
        
        # Only include reasoning_format for non-agentic reasoning (i.e., deepseek model)
        if reasoning and not agentic:
            params["reasoning_format"] = "raw"
        
        completion = client.chat.completions.create(**params)
        
        if reasoning:
            def stream_response():
                try:
                    for chunk in completion:
                        content = chunk.choices[0].delta.content or ""
                        if content:  # Only yield non-empty content
                            logger.debug(f"Streaming chunk: {content}")
                            yield content
                except Exception as e:
                    logger.error(f"Error in streaming response: {str(e)}")
                    raise
            return stream_response(), None
        else:
            return completion.choices[0].message.content, None
    except Exception as e:
        logger.error(f"Error in response generation: {str(e)}")
        return None, f"Error in response generation: {str(e)}"
     
def summarize_document(content, api_key, max_chars=8000):
    """Summarize document content using Groq's Llama 3 model."""
    if not content or not content.strip():
        return "No content to summarize", None
    
    client = get_groq_client(api_key)
    summarization_prompt = f"""Please provide a comprehensive summary of the following document. 
Focus on the main points, key findings, and important details:

{content[:max_chars]}

If the document appears to be truncated, please mention that the summary is 
based on the available portion only."""
    
    try:
        completion = client.chat.completions.create(
            model="llama3-70b-8192",
            messages=[
                {"role": "system", "content": "You are a helpful assistant specialized in summarizing documents."},
                {"role": "user", "content": summarization_prompt}
            ],
        )
        return completion.choices[0].message.content, None
    except Exception as e:
        logger.error(f"Document summarization error: {str(e)}")
        return None, f"Error in document summarization: {str(e)}"

def extract_text_from_image(image_path):
    """Extract text from an image using EasyOCR."""
    global reader
    with reader_lock:
        if reader is None:
            initialize_ocr()
            if reader is None:
                return "", "OCR initialization failed. Please try again later."
    
    try:
        image = Image.open(image_path)
        if image.mode == 'RGBA':
            image = image.convert('RGB')
        
        results = reader.readtext(np.array(image))
        extracted_text = " ".join(detection[1] for detection in results)
        
        if not extracted_text.strip():
            return "", "No text detected in the image."
        
        return extracted_text.strip(), None
    except Exception as e:
        logger.error(f"Image processing error: {str(e)}")
        return "", f"Error processing image: {str(e)}"

def process_image_with_vision(image_path, api_key):
    """Process image using Groq's vision model."""
    try:
        with open(image_path, "rb") as image_file:
            base64_image = base64.b64encode(image_file.read()).decode('utf-8')
        client = get_groq_client(api_key)
        chat_completion = client.chat.completions.create(
            messages=[
                {
                    "role": "user",
                    "content": [
                        {"type": "text", "text": "Describe the content of this image in detail."},
                        {
                            "type": "image_url",
                            "image_url": {
                                "url": f"data:image/jpeg;base64,{base64_image}",
                            },
                        },
                    ],
                }
            ],
            model="meta-llama/llama-4-scout-17b-16e-instruct",
        )
        return chat_completion.choices[0].message.content, None
    except Exception as e:
        logger.error(f"Vision model error: {str(e)}")
        return None, f"Error processing image with vision model: {str(e)}"

def extract_text_from_pdf(pdf_path):
    """Extract text from a PDF file."""
    try:
        text = ""
        with open(pdf_path, 'rb') as file:
            pdf_reader = PyPDF2.PdfReader(file)
            for page in pdf_reader.pages:
                text += page.extract_text() + "\n"
        return text.strip(), None
    except Exception as e:
        logger.error(f"PDF extraction error: {str(e)}")
        return "", f"Error extracting text from PDF: {str(e)}"

def extract_text_from_docx(docx_path):
    """Extract text from a DOCX file."""
    try:
        doc = Document(docx_path)
        full_text = [para.text for para in doc.paragraphs]
        return '\n'.join(full_text), None
    except Exception as e:
        logger.error(f"DOCX extraction error: {str(e)}")
        return "", f"Error extracting text from DOCX: {str(e)}"

def extract_text_from_txt(txt_path):
    """Extract text from a TXT file."""
    try:
        with open(txt_path, 'r', encoding='utf-8', errors='ignore') as file:
            return file.read(), None
    except Exception as e:
        logger.error(f"TXT extraction error: {str(e)}")
        return "", f"Error extracting text from text file: {str(e)}"

def get_file_extension(filename):
    """Get the file extension from filename."""
    return os.path.splitext(filename)[1].lower()

@app.route('/')
def index():
    return render_template('index.html')

@app.route('/about')
def about():
    return render_template('about.html')

@app.route('/process_audio', methods=['POST'])
def process_audio_route():
    if 'audio' not in request.files or 'api_key' not in request.form:
        return jsonify({'error': 'Missing audio file or API key'}), 400
    
    api_key = request.form['api_key']
    audio_file = request.files['audio']
    
    if audio_file.filename == '':
        return jsonify({'error': 'No selected file'}), 400
    
    with tempfile.NamedTemporaryFile(delete=False, suffix='.wav') as temp_file:
        audio_file.save(temp_file.name)
        temp_path = temp_file.name
    
    try:
        transcription, error = transcribe_audio(temp_path, api_key)
        if error:
            return jsonify({'error': error}), 500
        
        response, error = generate_response(transcription, api_key)
        if error:
            return jsonify({'error': error}), 500
        
        return jsonify({
            'transcription': transcription,
            'response': response
        })
    finally:
        if os.path.exists(temp_path):
            os.unlink(temp_path)

@app.route('/process_text', methods=['POST'])
def process_text_route():
    data = request.get_json()
    text_input = data.get('text')
    api_key = data.get('api_key')
    reasoning = data.get('reasoning', False)
    agentic = data.get('agentic', False)
    
    if not text_input or not api_key:
        return jsonify({'error': 'Missing text or API key'}), 400

    response, error = generate_response(text_input, api_key, reasoning, agentic)
    if error:
        logger.error(f"Error in process_text: {error}")
        return jsonify({'error': error}), 500
    
    if reasoning:
        def stream_response():
            try:
                yield 'data: {"choices": [{"delta": {"content": ""}}]}\n\n'  # Initial empty chunk
                for chunk in response:
                    # Escape special characters and ensure valid JSON
                    content = chunk.replace('\n', '\\n').replace('\r', '\\r').replace('"', '\\"')
                    yield f'data: {json.dumps({"choices": [{"delta": {"content": content}}]})}\n\n'
                yield 'data: [DONE]\n\n'
            except Exception as e:
                logger.error(f"Error streaming response: {str(e)}")
                yield f'data: {json.dumps({"error": str(e)})}\n\n'
                yield 'data: [DONE]\n\n'
        return Response(stream_with_context(stream_response()), mimetype='text/event-stream')
    else:
        return jsonify({'response': response})

@app.route('/process_image', methods=['POST'])
def process_image_route():
    if 'image' not in request.files or 'api_key' not in request.form:
        return jsonify({'error': 'Missing image file or API key'}), 400
    
    api_key = request.form['api_key']
    image_file = request.files['image']
    processing_mode = request.form.get('processing_mode', 'ocr')
    
    if image_file.filename == '':
        return jsonify({'error': 'No selected file'}), 400
    
    with tempfile.NamedTemporaryFile(delete=False, suffix=get_file_extension(image_file.filename)) as temp_file:
        image_file.save(temp_file.name)
        temp_path = temp_file.name
    
    try:
        if processing_mode == 'vision':
            description, error = process_image_with_vision(temp_path, api_key)
            if error:
                return jsonify({'error': error}), 500
            return jsonify({'description': description})
        else:
            extracted_text, error = extract_text_from_image(temp_path)
            if error:
                return jsonify({'error': error}), 500
            return jsonify({'extracted_text': extracted_text})
    finally:
        if os.path.exists(temp_path):
            os.unlink(temp_path)

@app.route('/process_document', methods=['POST'])
def process_document_route():
    if 'document' not in request.files or 'api_key' not in request.form:
        return jsonify({'error': 'Missing document file or API key'}), 400
    
    api_key = request.form['api_key']
    document_file = request.files['document']
    
    if document_file.filename == '':
        return jsonify({'error': 'No selected file'}), 400
    
    filename = secure_filename(document_file.filename)
    extension = get_file_extension(filename)
    
    with tempfile.NamedTemporaryFile(delete=False, suffix=extension) as temp_file:
        document_file.save(temp_file.name)
        temp_path = temp_file.name
    
    try:
        document_text, error = None, None
        if extension == '.pdf':
            document_text, error = extract_text_from_pdf(temp_path)
        elif extension == '.docx':
            document_text, error = extract_text_from_docx(temp_path)
        elif extension in ['.txt', '.md', '.csv']:
            document_text, error = extract_text_from_txt(temp_path)
        else:
            return jsonify({'error': f"Unsupported file format: {extension}"}), 400
        
        if error:
            return jsonify({'error': error}), 500
        
        summary, error = summarize_document(document_text, api_key)
        if error:
            return jsonify({'error': error}), 500
        
        return jsonify({
            'document_text': document_text[:10000],
            'summary': summary
        })
    finally:
        if os.path.exists(temp_path):
            os.unlink(temp_path)

if __name__ == '__main__':
    app.run(debug=True)