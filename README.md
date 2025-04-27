# Grovia

<p align="center">
  <a href="https://flask.palletsprojects.com/"><img src="https://img.shields.io/badge/Built%20with-Flask-blue.svg" alt="Flask Badge"></a>
  <a href="https://groq.com/"><img src="https://img.shields.io/badge/API-Groq-green.svg" alt="Groq Badge"></a>
  <a href="https://opensource.org/licenses/MIT"><img src="https://img.shields.io/badge/License-MIT-yellow.svg" alt="License Badge"></a>
  <img src="https://img.shields.io/badge/Status-Active-brightgreen.svg" alt="Active Badge">
  <img src="https://img.shields.io/badge/Made%20with-%E2%9D%A4-red.svg" alt="Made with Love Badge">
</p>

---

**Grovia** is an AI-powered chatbot built with **Groq** and **Flask**, designed to provide an interactive, seamless user experience.  
It supports text, voice, image processing (via OCR or vision models), document summarization, and Pokémon image generation.  
Grovia is accessible, user-friendly, and packed with features like chat history, export options (text/PDF), and a responsive dark/light theme.

This repository, hosted at [github.com/quark365/Grovia](https://github.com/quark365/Grovia), contains the complete source code for the Grovia application.

---

## ✨ Features

- **Text Interaction**: Chat with Groq's AI using text inputs, with support for Markdown rendering.
- **Voice Input**: Record or upload audio for transcription and response generation.
- **Image Processing**: Extract text via OCR or get detailed image descriptions using Groq's vision model.
- **Document Processing**: Upload and summarize documents (PDF, DOCX, TXT, MD, CSV).
- **Pokémon Image Generation**: Generate Pokémon images by name, ID, or randomly using the PokeAPI.
- **Chat Management**: Save, load, pin, and search chat sessions stored locally.
- **Export Options**: Export chats as text or PDF files.
- **Reasoning Modes**: Toggle between normal reasoning and agentic (web search) modes for enhanced responses.
- **Responsive Design**: Supports dark/light themes with accessibility features.
- **Multilingual Support**: Choose response languages (English, Spanish, French, German, Chinese).

---

## 🗂️ File Structure

```
Grovia/
├── static/
│   ├── css/
│   │   └── styles.css        # CSS styles for the frontend
│   ├── js/
│   │   └── script.js         # JavaScript for frontend interactivity
│   └── favicon.ico           # Favicon for the web app
├── templates/
│   ├── index.html            # Main chat interface
│   └── about.html            # About page with team details
├── app.py                    # Flask backend application
├── requirements.txt          # Python dependencies
└── README.md                 # Project documentation
```

---

## ⚙️ Prerequisites

- Python 3.8+
- Git
- A Groq API key (free to obtain)
- (Optional) Virtual environment for dependency management

---

## 🚀 How to Clone and Run

1. **Clone the Repository:**
   ```bash
   git clone https://github.com/quark365/Grovia.git
   cd Grovia
   ```

2. **Create a Virtual Environment (Optional but Recommended):**
   ```bash
   python -m venv venv
   source venv/bin/activate   # On Windows: venv\Scripts\activate
   ```

3. **Install Dependencies:**
   ```bash
   pip install -r requirements.txt
   ```

4. **Set Up Environment Variables (Optional):**
   
   Create a `.env` file or set the `GROQ_API_KEY` environment variable:
   ```bash
   export GROQ_API_KEY=your_groq_api_key   # On Windows: set GROQ_API_KEY=your_groq_api_key
   ```
   
   Alternatively, enter the API key directly inside the web app.

5. **Run the Application:**
   ```bash
   python app.py
   ```

6. Open [http://127.0.0.1:5000](http://127.0.0.1:5000) and start interacting!

---

## 💬 Usage

- **Chat Interface**: Type messages, use Markdown, attach images/documents/audio.
- **Voice Recording**: Record audio using the mic icon.
- **Image Processing**: Upload images and choose OCR or vision description.
- **Document Upload**: Upload supported formats for summarization.
- **Pokémon Generation**: Enter Pokémon name/ID or generate randomly.
- **Chat History**: Save, load, pin favorites, or search conversations.
- **Export Chats**: Download conversations as text or PDF files.
- **Settings**: Customize timestamps, language, and theme.

---

## 📦 Dependencies

Key packages (see `requirements.txt` for full list):

- `flask`: Web framework
- `groq`: Groq API integration
- `easyocr`: Image text extraction
- `PyPDF2`, `python-docx`: Document processing
- `soundfile`: Audio input handling
- `numpy`: Image processing
- `requests`: API calls (e.g., PokeAPI)

---

## 🤝 Contributing

We welcome contributions! 🎉

1. Fork the repo.
2. Create a branch:
   ```bash
   git checkout -b feature/your-feature
   ```
3. Commit your changes:
   ```bash
   git commit -m "Add your feature"
   ```
4. Push and open a Pull Request.

Please maintain coding standards and add tests where necessary!

---

## 👨‍💻 Team

Built with ❤️ by the **Moon Knight Team**:

- **Sreeram R** ([SreeramRajeev](https://github.com/SreeramRajeev))
- **Adithya Krishna S** ([quark365](https://github.com/quark365))
- **Nikhil Chandran** ([nikhilchandran2004](https://github.com/nikhilchandran2004))

---

## 📜 License

This project is licensed under the MIT License. See the [LICENSE](LICENSE) file.

---

## 📬 Contact

Have questions, ideas, or feedback?  
- Open an issue [here](https://github.com/quark365/Grovia/issues) or
- Contact the team via their GitHub profiles.

---

Built with ❤️ for the **Groq** community.

---
