# AureloAiTutor

AureloAiTutor is an adaptive AI-based learning system that transforms static academic documents such as PDFs into an interactive and personalized learning experience. The platform enables students to generate summaries, structured notes, quizzes, and receive real-time doubt clarification directly from their own study materials.


##  Features

-  Upload academic PDF documents
- AI-generated document summaries
-  Topic-wise structured notes
-  Multiple Choice Questions (MCQs)
-  Fill-in-the-blank exercises
-  Real-time doubt clarification using document context
-  Adaptive difficulty-based assessments
-  Secure user authentication and access control



##  System Architecture Overview

AureloAiTutor follows a modular architecture consisting of:

- Document Processing Layer
- Semantic Embedding and Vector Storage Layer
- Retrieval-Augmented Generation (RAG) Engine
- AI Generation Layer
- User Management and Data Persistence
- React-based Frontend Interface

The system ensures that all AI-generated outputs are strictly grounded in the user-uploaded documents.



##  Technology Stack

### Frontend
- React.js

### Backend
- FastAPI (Python)

### AI & NLP
- Google Gemini 2.5 Flash
- Google text-embedding-004
- Retrieval-Augmented Generation (RAG)

### Databases
- ChromaDB (Vector Database)
- MongoDB (User data, documents, results)

### Document Processing
- PyMuPDF


## How It Works

1. User uploads a PDF document
2. Text is extracted using PyMuPDF
3. Content is split into overlapping chunks
4. Semantic embeddings are generated
5. Embeddings are stored in ChromaDB
6. User queries trigger semantic retrieval
7. Gemini generates responses using retrieved context
8. Outputs are stored and displayed in the frontend


##  Functional Modules

- User Authentication & Authorization
- Document Upload and Management
- Document Processing and Chunking
- Semantic Retrieval and RAG
- Learning Content Generation
- Adaptive Assessment & Progress Tracking
- Real-time Doubt Clarification



##  Installation & Setup

### Prerequisites
- Python 3.9+
- Node.js
- MongoDB
- Google Gemini API Key

### Backend Setup

cd backend
pip install -r requirements.txt
uvicorn main:app --reload

### Frontend Setup

cd frontend
npm install
npm start
