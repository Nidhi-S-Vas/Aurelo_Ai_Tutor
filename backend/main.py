from dotenv import load_dotenv
load_dotenv()

from fastapi import FastAPI, UploadFile, File, HTTPException, Depends
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import os
import tempfile
import uuid
import logging
from datetime import datetime, timedelta
import fitz  # PyMuPDF
import json
from typing import List, Optional

from database import documents_collection, users_collection, exam_results_collection
from bson import ObjectId
from gemini_client import call_llm_once, get_embeddings
from rag import add_chunks_to_chroma, query_similar_chunks
from auth import (
    get_current_user,
    create_user,
    authenticate_user,
    create_access_token,
    get_password_hash,
)
from exam_results import (
    calculate_score,
    generate_tips,
    save_exam_result,
    get_user_exam_history,
)

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("backend")

app = FastAPI(title="ProjectTutor API (RAG-first)")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# ---------------------------
# PDF extract & chunk helpers
# ---------------------------
def extract_text_pages_from_pdf(path: str) -> List[str]:
    doc = fitz.open(path)
    return [(doc[p].get_text("text") or "") for p in range(len(doc))]


def chunk_text_from_pages(pages: List[str], chunk_size=1000, overlap=200):
    text = "\n\n".join(pages)
    L = len(text)
    chunks, start, cid = [], 0, 0

    while start < L:
        end = start + chunk_size
        part = text[start:end]

        if end < L:
            back = max(part.rfind("\n"), part.rfind(" "), part.rfind("."))
            if back > int(chunk_size * 0.3):
                end = start + back + 1
                part = text[start:end]

        part = part.strip()
        if part:
            chunks.append(
                {
                    "id": str(cid),
                    "text": part,
                    "start": start,
                    "end": min(end, L),
                }
            )
            cid += 1

        start = max(0, end - overlap)
        if end >= L:
            break

    return chunks


# ---------------------------
# Prompt templates (ESCAPED)
# ---------------------------

# SUMMARY: detailed but simple, length based on pages_count
SUMMARY_PROMPT = """
You MUST return ONLY valid JSON. No extra commentary.

{{
  "summary": ""
}}

Rules:
- Use ONLY the text in "Context" (do NOT add external facts).
- Write in very simple English for students.
- Be detailed and cover all important ideas. Do NOT make it too short.
- If pages_count <= 3: write 1–2 paragraphs (4–6 sentences each).
- If 4 <= pages_count <= 10: write 3–4 paragraphs.
- If pages_count > 10: write 4–6 paragraphs that cover all major headings/topics.

Context:
{context}

PagesCount: {pages_count}
"""

# NOTES: heading-wise sections, each with explanation + bullet points
NOTES_PROMPT = """
You MUST return ONLY valid JSON. No extra commentary.

The JSON MUST have exactly this shape:

{{
  "sections": [
    {{
      "heading": "",
      "explanation": "",
      "points": []
    }}
  ],
  "keywords": []
}}

Rules:
- Use ONLY the text in "Context" (do NOT add external facts).
- Identify the main headings or topics from the document (like "Steps to Implement ANN", "Recurrent Neural Networks", etc.).
- For each important heading, create ONE section.
- "heading": a short title.
- "explanation": 3–6 sentence paragraph explaining that heading in very simple language.
- "points": 4–8 bullet points for that heading (definitions, steps, formulas, key ideas).
- Try to cover all important parts of the document. Do NOT make the notes too small.
- Write everything so that a beginner can understand.

Context:
{context}

PagesCount: {pages_count}
"""

MCQ_PROMPT = """
Return ONLY a JSON array of MCQs. NO extra text.

[
  {{
    "id": "",
    "question": "",
    "options": ["", "", "", ""],
    "answer": "",
    "explanation": ""
  }}
]

Rules:
- Generate EXACTLY {num} MCQs.
- Difficulty: {difficulty}.
- Use ONLY the given Context (do not add outside facts).
- Each question must have 4 options, one correct.
- Keep questions short and clear.

Context:
{context}
"""

FILLUPS_PROMPT = """
Return ONLY a JSON array of fill-ups. NO extra text.

[
  {{
    "id": "",
    "text": "",
    "answer": ""
  }}
]

Rules:
- Generate EXACTLY {num} fill-ups.
- Difficulty: {difficulty}.
- Each text must contain exactly ONE blank shown as "____".
- Answer should be a short word or phrase.
- Use ONLY the given Context.

Context:
{context}
"""

CHAT_PROMPT = """
Use ONLY this context to answer. If the answer is not present, reply exactly:
"I could not find the answer in the document."

Context:
{context}

Question:
{question}
"""

GREETING_PROMPT = """
The user has sent a greeting. Respond naturally and warmly. Keep it brief (1-2 sentences).
Examples of greetings: hi, hello, good morning, good afternoon, good evening, hey, greetings, etc.

User message: {question}
"""

INTERNET_SEARCH_PROMPT = """
Answer the following question using your knowledge and general information available.
Provide a clear, informative, and helpful response.

Question: {question}
"""


# ---------------------------
# Pydantic Models for Authentication
# ---------------------------
class UserRegister(BaseModel):
    username: str
    email: str
    password: str
    
    class Config:
        json_schema_extra = {
            "example": {
                "username": "testuser",
                "email": "test@example.com",
                "password": "testpass123"
            }
        }


class UserLogin(BaseModel):
    username: str
    password: str


class Token(BaseModel):
    access_token: str
    token_type: str
    user: dict


# ---------------------------
# JSON extraction helper
# ---------------------------
def extract_json_from_text(raw: str):
    import re

    if not raw:
        return None

    # try object
    m = re.search(r"(\{[\s\S]*\})", raw)
    if m:
        try:
            return json.loads(m.group(1))
        except Exception:
            pass

    # try array
    m = re.search(r"(\[[\s\S]*\])", raw)
    if m:
        try:
            return json.loads(m.group(1))
        except Exception:
            pass

    # last fallback
    try:
        return json.loads(raw)
    except Exception:
        return None


# ---------------------------
# Adaptive Difficulty Helper
# ---------------------------
def adjust_difficulty(current_difficulty: str, score_percent: float) -> dict:
    """
    Adjust difficulty based on score:
    - Score < 50%: Move down one level (if possible)
    - Score >= 50%: Can move up one level (if possible)
    
    Returns: {
        "new_difficulty": str,
        "changed": bool,
        "unlocked_higher_level": bool,  # True if we moved up (for tracking highest achieved)
        "message": str
    }
    """
    difficulty_levels = ["easy", "medium", "hard"]
    
    try:
        current_index = difficulty_levels.index(current_difficulty.lower())
    except ValueError:
        # Invalid difficulty, default to easy
        current_index = 0
        current_difficulty = "easy"
    
    new_index = current_index
    changed = False
    unlocked_higher_level = False
    message = ""
    
    if score_percent < 50:
        # Move down one level
        if current_index > 0:
            new_index = current_index - 1
            changed = True
            message = f"Your score ({score_percent:.1f}%) is below 50%. Difficulty reduced to {difficulty_levels[new_index]}."
        else:
            message = f"Your score ({score_percent:.1f}%) is below 50%, but you're already at the easiest level. Keep practicing!"
    else:
        # Score >= 50%, can move up
        if current_index < len(difficulty_levels) - 1:
            new_index = current_index + 1
            changed = True
            unlocked_higher_level = True  # Student unlocked a higher level
            message = f"Great job! Your score ({score_percent:.1f}%) is 50% or above. Difficulty increased to {difficulty_levels[new_index]}."
        else:
            message = f"Excellent! Your score ({score_percent:.1f}%) is 50% or above. You're already at the hardest level!"
    
    return {
        "new_difficulty": difficulty_levels[new_index],
        "changed": changed,
        "unlocked_higher_level": unlocked_higher_level,
        "message": message
    }


def get_current_difficulty(doc: dict, exam_type: str) -> str:
    """Get the current difficulty level for a user-document-exam_type combination."""
    difficulty_key = f"{exam_type}_current_difficulty"
    return doc.get(difficulty_key, "easy")  # Default to easy if not set


def set_current_difficulty(doc_id: str, exam_type: str, difficulty: str):
    """Set the current difficulty level for a user-document-exam_type combination."""
    difficulty_key = f"{exam_type}_current_difficulty"
    documents_collection.update_one(
        {"doc_id": doc_id},
        {"$set": {difficulty_key: difficulty}}
    )


def get_highest_achieved_level(doc: dict, exam_type: str) -> str:
    """Get the highest achieved difficulty level for a user-document-exam_type combination."""
    highest_key = f"{exam_type}_highest_achieved_level"
    return doc.get(highest_key, "easy")  # Default to easy if not set


def set_highest_achieved_level(doc_id: str, exam_type: str, difficulty: str):
    """Set the highest achieved difficulty level (only increases, never decreases)."""
    difficulty_levels = ["easy", "medium", "hard"]
    
    # Get current highest
    doc = documents_collection.find_one({"doc_id": doc_id})
    if doc:
        current_highest = get_highest_achieved_level(doc, exam_type)
        try:
            current_index = difficulty_levels.index(current_highest.lower())
            new_index = difficulty_levels.index(difficulty.lower())
            
            # Only update if new level is higher
            if new_index > current_index:
                highest_key = f"{exam_type}_highest_achieved_level"
                documents_collection.update_one(
                    {"doc_id": doc_id},
                    {"$set": {highest_key: difficulty}}
                )
        except ValueError:
            # Invalid difficulty, just set it
            highest_key = f"{exam_type}_highest_achieved_level"
            documents_collection.update_one(
                {"doc_id": doc_id},
                {"$set": {highest_key: difficulty}}
            )
    else:
        # Document doesn't exist yet, just set it (shouldn't happen in normal flow)
        highest_key = f"{exam_type}_highest_achieved_level"
        documents_collection.update_one(
            {"doc_id": doc_id},
            {"$set": {highest_key: difficulty}},
            upsert=False
        )


# ---------------------------
# ROOT ENDPOINT
# ---------------------------
@app.get("/")
async def root():
    """API root endpoint with helpful information."""
    return {
        "message": "Aurelo AI Tutor API",
        "version": "1.0.0",
        "docs": "/docs",
        "redoc": "/redoc",
        "status": "running",
        "endpoints": {
            "public": [
                "POST /register - Register a new user",
                "POST /login - Login and get access token"
            ],
            "protected": [
                "GET /me - Get current user info",
                "GET /documents - List user's documents",
                "POST /upload - Upload PDF document",
                "POST /summary - Generate document summary",
                "POST /notes - Generate document notes",
                "POST /mcq - Generate multiple choice questions",
                "POST /fillups - Generate fill-in-the-blank questions",
                "POST /chat - Chat with document"
            ]
        }
    }


# ---------------------------
# AUTHENTICATION ENDPOINTS
# ---------------------------
@app.post("/register", response_model=dict)
async def register(user_data: UserRegister):
    """Register a new user."""
    try:
        user = create_user(
            username=user_data.username,
            email=user_data.email,
            password=user_data.password
        )
        return {
            "status": "ok",
            "message": "User registered successfully",
            "user": user
        }
    except HTTPException as e:
        raise e
    except Exception as e:
        logger.error(f"Registration error: {e}")
        raise HTTPException(status_code=500, detail="Registration failed")


@app.post("/login", response_model=Token)
async def login(credentials: UserLogin):
    """Login and get access token."""
    user = authenticate_user(credentials.username, credentials.password)
    if not user:
        raise HTTPException(
            status_code=401,
            detail="Incorrect username or password"
        )
    
    access_token = create_access_token(data={"sub": user["username"]})
    return {
        "access_token": access_token,
        "token_type": "bearer",
        "user": user
    }


@app.get("/me")
async def get_me(current_user: dict = Depends(get_current_user)):
    """Get current user information."""
    return current_user


@app.get("/documents")
async def list_documents(current_user: dict = Depends(get_current_user)):
    """List all documents owned by the current user."""
    user_id = current_user["_id"]
    docs = list(documents_collection.find(
        {"user_id": user_id},
        {"_id": 0, "doc_id": 1, "filename": 1, "pages_count": 1, "created_at": 1}
    ).sort("created_at", -1))
    
    # Convert datetime to ISO format
    for doc in docs:
        if "created_at" in doc and isinstance(doc["created_at"], datetime):
            doc["created_at"] = doc["created_at"].isoformat()
    
    return {"documents": docs}


# ---------------------------
# UPLOAD (RAG only) - Now requires authentication
# ---------------------------
@app.post("/upload")
async def upload(
    file: UploadFile = File(...),
    current_user: dict = Depends(get_current_user)
):
    if not file.filename.lower().endswith(".pdf"):
        raise HTTPException(400, "Only PDF files allowed.")

    tmp = tempfile.NamedTemporaryFile(delete=False, suffix=".pdf")
    save_path = tmp.name
    tmp.write(await file.read())
    tmp.close()

    try:
        pages = extract_text_pages_from_pdf(save_path)
        if not pages or all(not p.strip() for p in pages):
            raise HTTPException(400, "PDF contains no readable text.")

        pages_count = len(pages)
        chunks = chunk_text_from_pages(pages, 1000, 200)
        if not chunks:
            raise HTTPException(400, "No substantial text after chunking.")

        texts = [c["text"] for c in chunks]
        ids = [c["id"] for c in chunks]

        embeddings = None
        try:
            embeddings = get_embeddings(texts)
            if not embeddings or len(embeddings) != len(texts):
                logger.warning("Embeddings length mismatch; disabling embeddings.")
                embeddings = None
        except Exception as ex:
            logger.warning(f"Embedding generation failed: {ex}")
            embeddings = None

        metadatas = [
            {"doc_filename": file.filename, "start": c["start"], "end": c["end"]}
            for c in chunks
        ]

        doc_id = str(uuid.uuid4())
        chroma_indexed = False

        if embeddings:
            add_chunks_to_chroma(doc_id, ids, texts, embeddings, metadatas)
            chroma_indexed = True

        user_id = current_user["_id"]
        
        documents_collection.insert_one(
            {
                "doc_id": doc_id,
                "user_id": user_id,  # Associate document with user
                "filename": file.filename,
                "pages_count": pages_count,
                "chroma_indexed": chroma_indexed,
                "chunks_text": chunks,
                "llm_output": {},
                "created_at": datetime.utcnow(),
            }
        )
        
        # Update user's document list
        users_collection.update_one(
            {"_id": ObjectId(current_user["_id"])},
            {"$addToSet": {"documents": doc_id}}
        )

        logger.info(
            f"Uploaded {file.filename} → doc_id={doc_id} "
            f"(chunks={len(chunks)}, chroma_indexed={chroma_indexed})"
        )

        return {"status": "ok", "doc_id": doc_id, "chroma_indexed": chroma_indexed}

    finally:
        try:
            os.unlink(save_path)
        except Exception:
            pass


# ---------------------------
# SUMMARY (POST → JSON body) - Now requires authentication
# ---------------------------
@app.post("/summary")
def generate_summary(
    payload: dict,
    current_user: dict = Depends(get_current_user)
):
    doc_id = payload.get("doc_id")
    if not doc_id:
        raise HTTPException(400, "doc_id missing")

    user_id = current_user["_id"]
    doc = documents_collection.find_one({"doc_id": doc_id, "user_id": user_id})
    if not doc:
        raise HTTPException(404, "Document not found")

    # Check if summary already exists in database
    llm_out = doc.get("llm_output", {})
    existing_summary = llm_out.get("summary", "").strip()
    if existing_summary:
        # Summary already exists, return it without regenerating
        return {"summary": existing_summary}

    # Generate new summary if it doesn't exist
    pages_count = doc.get("pages_count", 0)
    # use more chunks for bigger docs
    top_k = 8 if pages_count <= 8 else 12

    q_emb = get_embeddings([f"summary of {doc['filename']}"])[0]
    hits = query_similar_chunks(q_emb, doc_id, n_results=top_k)
    if not hits:
        raise HTTPException(400, "No relevant chunks found for summary.")

    chunks = [h["document"] for h in hits]
    context = "\n---\n".join(chunks)
    prompt = SUMMARY_PROMPT.format(context=context, pages_count=pages_count)

    raw = call_llm_once(prompt)
    parsed = extract_json_from_text(raw)

    if not parsed or "summary" not in parsed:
        # fallback simple behaviour
        fallback_text = " ".join(chunks[:3])
        parsed = {"summary": fallback_text}

    llm_out["summary"] = parsed.get("summary", "")

    documents_collection.update_one(
        {"doc_id": doc_id},
        {"$set": {"llm_output": llm_out}},
    )
    return {"summary": llm_out["summary"]}


# ---------------------------
# NOTES (heading-wise, POST → JSON body) - Now requires authentication
# ---------------------------
@app.post("/notes")
def generate_notes(
    payload: dict,
    current_user: dict = Depends(get_current_user)
):
    doc_id = payload.get("doc_id")
    if not doc_id:
        raise HTTPException(400, "doc_id missing")

    user_id = current_user["_id"]
    doc = documents_collection.find_one({"doc_id": doc_id, "user_id": user_id})
    if not doc:
        raise HTTPException(404, "Document not found")

    # Check if notes already exist in database
    llm_out = doc.get("llm_output", {})
    existing_notes = llm_out.get("notes", {})
    if existing_notes and isinstance(existing_notes, dict) and existing_notes.get("sections") and len(existing_notes.get("sections", [])) > 0:
        # Notes already exist, return them without regenerating
        return existing_notes

    # Generate new notes if they don't exist
    pages_count = doc.get("pages_count", 0)
    top_k = 10 if pages_count <= 10 else 14

    q_emb = get_embeddings([f"detailed notes for {doc['filename']}"])[0]
    hits = query_similar_chunks(q_emb, doc_id, n_results=top_k)
    if not hits:
        raise HTTPException(400, "No relevant chunks found for notes.")

    chunks = [h["document"] for h in hits]
    context = "\n---\n".join(chunks)
    prompt = NOTES_PROMPT.format(context=context, pages_count=pages_count)

    raw = call_llm_once(prompt)
    parsed = extract_json_from_text(raw)

    if (
        not parsed
        or not isinstance(parsed, dict)
        or "sections" not in parsed
        or not isinstance(parsed["sections"], list)
    ):
        # fallback: one generic section
        fallback_section = {
            "heading": "Main Ideas",
            "explanation": " ".join(chunks[:2]),
            "points": chunks[:5],
        }
        parsed = {
            "sections": [fallback_section],
            "keywords": [],
        }

    llm_out["notes"] = parsed
    # keep keywords also at root if you want later usage
    llm_out["keywords"] = parsed.get("keywords", [])

    documents_collection.update_one(
        {"doc_id": doc_id},
        {"$set": {"llm_output": llm_out}},
    )
    return parsed


# ---------------------------
# MCQ GENERATION - Now requires authentication
# ---------------------------
@app.post("/mcq")
def generate_mcq(
    payload: dict,
    current_user: dict = Depends(get_current_user)
):
    doc_id = payload.get("doc_id")
    if not doc_id:
        raise HTTPException(400, "doc_id missing")

    difficulty = payload.get("difficulty", "easy")
    num_raw = payload.get("num", 10)

    try:
        num = int(num_raw)
    except Exception:
        num = 10
    num = max(5, min(20, num))  # clamp 5–20

    user_id = current_user["_id"]
    doc = documents_collection.find_one({"doc_id": doc_id, "user_id": user_id})
    if not doc:
        raise HTTPException(404, "Document not found")
    
    # Validate difficulty: check if user can access this level
    highest_achieved = get_highest_achieved_level(doc, "mcq")
    difficulty_levels = ["easy", "medium", "hard"]
    try:
        requested_index = difficulty_levels.index(difficulty.lower())
        highest_index = difficulty_levels.index(highest_achieved.lower())
        if requested_index > highest_index:
            raise HTTPException(
                403,
                f"You cannot access {difficulty} level yet. Your highest achieved level is {highest_achieved}. "
                f"Score 50% or above on {highest_achieved} level to unlock higher levels."
            )
    except ValueError:
        pass  # Invalid difficulty will be handled later

    q_emb = get_embeddings([f"important topics from {doc['filename']}"])[0]
    hits = query_similar_chunks(q_emb, doc_id, n_results=10)

    if not hits:
        raise HTTPException(400, "No relevant chunks found for MCQ generation.")

    context = "\n---\n".join([h["document"] for h in hits])
    prompt = MCQ_PROMPT.format(context=context, difficulty=difficulty, num=num)

    raw = call_llm_once(prompt)
    parsed = extract_json_from_text(raw)
    if not parsed or not isinstance(parsed, list):
        parsed = []

    # Normalize & enforce IDs and progress fields
    normalized = []
    for idx, q in enumerate(parsed[:num]):
        if not isinstance(q, dict):
            continue
        nq = {
            "id": q.get("id") or f"{difficulty}_{idx+1}",
            "question": q.get("question", ""),
            "options": (q.get("options") or [])[:4],
            "answer": q.get("answer", ""),
            "explanation": q.get("explanation", ""),
            "user_answer": "",
            "result": "",
        }
        normalized.append(nq)

    llm = doc.get("llm_output", {})
    if "mcq" not in llm:
        llm["mcq"] = {}
    llm["mcq"][difficulty] = normalized

    documents_collection.update_one(
        {"doc_id": doc_id},
        {"$set": {"llm_output": llm}},
    )
    
    # Set current difficulty if not already set or if user explicitly selected this level
    current_difficulty = get_current_difficulty(doc, "mcq")
    if current_difficulty != difficulty:
        # User selected a different level, update it
        set_current_difficulty(doc_id, "mcq", difficulty)
    
    return {"difficulty": difficulty, "count": len(normalized)}


# ---------------------------
# MCQ PROGRESS SAVE - Now requires authentication
# ---------------------------
@app.post("/mcq/save-progress")
def save_mcq_progress(
    payload: dict,
    current_user: dict = Depends(get_current_user)
):
    doc_id = payload.get("doc_id")
    difficulty = payload.get("difficulty")
    batch_ids = payload.get("batch_ids", [])
    answers = payload.get("answers", {})

    if not doc_id or not difficulty:
        raise HTTPException(400, "doc_id and difficulty are required.")

    user_id = current_user["_id"]
    doc = documents_collection.find_one({"doc_id": doc_id, "user_id": user_id})
    if not doc:
        raise HTTPException(404, "Document not found")

    llm = doc.get("llm_output", {})
    mcq_data = llm.get("mcq", {})
    questions = mcq_data.get(difficulty, [])

    if not questions:
        raise HTTPException(400, "No MCQs found for this difficulty.")

    batch_set = set(batch_ids or [])
    ans_map = answers or {}

    for q in questions:
        qid = q.get("id")
        if not qid or qid not in batch_set:
            continue

        user = (ans_map.get(qid) or "").strip()
        correct = str(q.get("answer", "")).strip()

        if not user:
            q["user_answer"] = ""
            q["result"] = "not answered"
        else:
            q["user_answer"] = user
            q["result"] = "correct" if user == correct else "wrong"

    mcq_data[difficulty] = questions
    llm["mcq"] = mcq_data
    llm.setdefault("mcq_last_updated", datetime.utcnow().isoformat())

    documents_collection.update_one(
        {"doc_id": doc_id},
        {"$set": {"llm_output": llm}},
    )
    
    # Create results list for this batch
    batch_results = []
    batch_questions = []
    for q in questions:
        qid = q.get("id")
        if qid in batch_set:
            batch_results.append({
                "question_id": qid,
                "question": q.get("question", ""),
                "user_answer": q.get("user_answer", ""),
                "correct_answer": q.get("answer", ""),
                "result": q.get("result", ""),
                "explanation": q.get("explanation", ""),
            })
            batch_questions.append({
                "id": qid,
                "question": q.get("question", ""),
                "options": q.get("options", []),
                "answer": q.get("answer", ""),
                "explanation": q.get("explanation", ""),
            })
    
    # Calculate score
    score_data = calculate_score(batch_results)
    
    # Adjust difficulty based on score
    difficulty_adjustment = adjust_difficulty(difficulty, score_data["score_percent"])
    new_difficulty = difficulty_adjustment["new_difficulty"]
    
    # Update stored current difficulty
    if difficulty_adjustment["changed"]:
        set_current_difficulty(doc_id, "mcq", new_difficulty)
    
    # Update highest achieved level if student unlocked a higher level (score >= 50%)
    if difficulty_adjustment.get("unlocked_higher_level", False):
        set_highest_achieved_level(doc_id, "mcq", new_difficulty)
    elif score_data["score_percent"] >= 50:
        # Even if didn't unlock higher level (e.g., already at hard), ensure current level is recorded as achieved
        # This ensures the level itself is unlocked
        doc = documents_collection.find_one({"doc_id": doc_id})
        if doc:
            current_highest = get_highest_achieved_level(doc, "mcq")
            difficulty_levels = ["easy", "medium", "hard"]
            try:
                current_highest_index = difficulty_levels.index(current_highest.lower())
                completed_level_index = difficulty_levels.index(difficulty.lower())
                # If completed level is >= current highest, update it
                if completed_level_index >= current_highest_index:
                    set_highest_achieved_level(doc_id, "mcq", difficulty)
            except ValueError:
                pass
    
    # Generate tips with exam data for more specific feedback
    tips = generate_tips(
        score_data, 
        difficulty, 
        "MCQ", 
        doc.get("filename", "Document"),
        questions=batch_questions,
        results=batch_results
    )
    
    # Save exam result
    result_id = save_exam_result(
        user_id=user_id,
        doc_id=doc_id,
        doc_filename=doc.get("filename", "Document"),
        exam_type="mcq",
        difficulty=difficulty,
        questions=batch_questions,
        results=batch_results,
        score_data=score_data,
        tips=tips,
    )
    
    return {
        "status": "ok",
        "result_id": result_id,
        "score": score_data,
        "tips": tips,
        "results": batch_results,
        "difficulty_adjustment": difficulty_adjustment,
    }


# ---------------------------
# FILLUPS GENERATION - Now requires authentication
# ---------------------------
@app.post("/fillups")
def generate_fillups(
    payload: dict,
    current_user: dict = Depends(get_current_user)
):
    doc_id = payload.get("doc_id")
    if not doc_id:
        raise HTTPException(400, "doc_id missing")

    difficulty = payload.get("difficulty", "easy")
    num_raw = payload.get("num", 10)

    try:
        num = int(num_raw)
    except Exception:
        num = 10
    num = max(5, min(20, num))  # clamp 5–20

    user_id = current_user["_id"]
    doc = documents_collection.find_one({"doc_id": doc_id, "user_id": user_id})
    if not doc:
        raise HTTPException(404, "Document not found")
    
    # Validate difficulty: check if user can access this level
    highest_achieved = get_highest_achieved_level(doc, "fillups")
    difficulty_levels = ["easy", "medium", "hard"]
    try:
        requested_index = difficulty_levels.index(difficulty.lower())
        highest_index = difficulty_levels.index(highest_achieved.lower())
        if requested_index > highest_index:
            raise HTTPException(
                403,
                f"You cannot access {difficulty} level yet. Your highest achieved level is {highest_achieved}. "
                f"Score 50% or above on {highest_achieved} level to unlock higher levels."
            )
    except ValueError:
        pass  # Invalid difficulty will be handled later

    q_emb = get_embeddings([f"key terms from {doc['filename']}"])[0]
    hits = query_similar_chunks(q_emb, doc_id, n_results=10)

    if not hits:
        raise HTTPException(400, "No relevant chunks found for fillups generation.")

    context = "\n---\n".join([h["document"] for h in hits])
    prompt = FILLUPS_PROMPT.format(context=context, difficulty=difficulty, num=num)

    raw = call_llm_once(prompt)
    parsed = extract_json_from_text(raw)
    if not parsed or not isinstance(parsed, list):
        parsed = []

    normalized = []
    for idx, q in enumerate(parsed[:num]):
        if not isinstance(q, dict):
            continue
        nq = {
            "id": q.get("id") or f"{difficulty}_{idx+1}",
            "text": q.get("text", ""),
            "answer": q.get("answer", ""),
            "user_answer": "",
            "result": "",
        }
        normalized.append(nq)

    llm = doc.get("llm_output", {})
    if "fillups" not in llm:
        llm["fillups"] = {}
    llm["fillups"][difficulty] = normalized

    documents_collection.update_one(
        {"doc_id": doc_id},
        {"$set": {"llm_output": llm}},
    )
    
    # Set current difficulty if not already set or if user explicitly selected this level
    current_difficulty = get_current_difficulty(doc, "fillups")
    if current_difficulty != difficulty:
        # User selected a different level, update it
        set_current_difficulty(doc_id, "fillups", difficulty)
    
    return {"difficulty": difficulty, "count": len(normalized)}


# ---------------------------
# FILLUPS PROGRESS SAVE - Now requires authentication
# ---------------------------
@app.post("/fillups/save-progress")
def save_fillups_progress(
    payload: dict,
    current_user: dict = Depends(get_current_user)
):
    doc_id = payload.get("doc_id")
    difficulty = payload.get("difficulty")
    batch_ids = payload.get("batch_ids", [])
    answers = payload.get("answers", {})

    if not doc_id or not difficulty:
        raise HTTPException(400, "doc_id and difficulty are required.")

    user_id = current_user["_id"]
    doc = documents_collection.find_one({"doc_id": doc_id, "user_id": user_id})
    if not doc:
        raise HTTPException(404, "Document not found")

    llm = doc.get("llm_output", {})
    fill_data = llm.get("fillups", {})
    questions = fill_data.get(difficulty, [])

    if not questions:
        raise HTTPException(400, "No fillups found for this difficulty.")

    batch_set = set(batch_ids or [])
    ans_map = answers or {}

    for q in questions:
        qid = q.get("id")
        if not qid or qid not in batch_set:
            continue

        user = (ans_map.get(qid) or "").strip().lower()
        correct = str(q.get("answer", "")).strip().lower()

        if not user:
            q["user_answer"] = ""
            q["result"] = "not answered"
        else:
            q["user_answer"] = user
            q["result"] = "correct" if user == correct else "wrong"

    fill_data[difficulty] = questions
    llm["fillups"] = fill_data
    llm.setdefault("fillups_last_updated", datetime.utcnow().isoformat())

    documents_collection.update_one(
        {"doc_id": doc_id},
        {"$set": {"llm_output": llm}},
    )
    
    # Create results list for this batch
    batch_results = []
    batch_questions = []
    for q in questions:
        qid = q.get("id")
        if qid in batch_set:
            batch_results.append({
                "question_id": qid,
                "question": q.get("text", ""),
                "user_answer": q.get("user_answer", ""),
                "correct_answer": q.get("answer", ""),
                "result": q.get("result", ""),
            })
            batch_questions.append({
                "id": qid,
                "text": q.get("text", ""),
                "answer": q.get("answer", ""),
            })
    
    # Calculate score
    score_data = calculate_score(batch_results)
    
    # Adjust difficulty based on score
    difficulty_adjustment = adjust_difficulty(difficulty, score_data["score_percent"])
    new_difficulty = difficulty_adjustment["new_difficulty"]
    
    # Update stored current difficulty
    if difficulty_adjustment["changed"]:
        set_current_difficulty(doc_id, "fillups", new_difficulty)
    
    # Update highest achieved level if student unlocked a higher level (score >= 50%)
    if difficulty_adjustment.get("unlocked_higher_level", False):
        set_highest_achieved_level(doc_id, "fillups", new_difficulty)
    elif score_data["score_percent"] >= 50:
        # Even if didn't unlock higher level (e.g., already at hard), ensure current level is recorded as achieved
        # This ensures the level itself is unlocked
        doc = documents_collection.find_one({"doc_id": doc_id})
        if doc:
            current_highest = get_highest_achieved_level(doc, "fillups")
            difficulty_levels = ["easy", "medium", "hard"]
            try:
                current_highest_index = difficulty_levels.index(current_highest.lower())
                completed_level_index = difficulty_levels.index(difficulty.lower())
                # If completed level is >= current highest, update it
                if completed_level_index >= current_highest_index:
                    set_highest_achieved_level(doc_id, "fillups", difficulty)
            except ValueError:
                pass
    
    # Generate tips with exam data for more specific feedback
    tips = generate_tips(
        score_data, 
        difficulty, 
        "Fill-ups", 
        doc.get("filename", "Document"),
        questions=batch_questions,
        results=batch_results
    )
    
    # Save exam result
    result_id = save_exam_result(
        user_id=user_id,
        doc_id=doc_id,
        doc_filename=doc.get("filename", "Document"),
        exam_type="fillups",
        difficulty=difficulty,
        questions=batch_questions,
        results=batch_results,
        score_data=score_data,
        tips=tips,
    )
    
    return {
        "status": "ok",
        "result_id": result_id,
        "score": score_data,
        "tips": tips,
        "results": batch_results,
        "difficulty_adjustment": difficulty_adjustment,
    }


# ---------------------------
# CHAT (RAG → LLM) - Now requires authentication
# ---------------------------
def is_greeting(text: str) -> bool:
    """Check if the text is a greeting."""
    greetings = [
        "hi", "hello", "hey", "greetings", "good morning", "good afternoon", 
        "good evening", "good night", "morning", "afternoon", "evening",
        "howdy", "hi there", "hello there", "hey there", "sup", "what's up"
    ]
    text_lower = text.lower().strip()
    # Remove punctuation for matching
    text_clean = ''.join(c for c in text_lower if c.isalnum() or c.isspace())
    words = text_clean.split()
    
    # Check if it's just a greeting (few words, and contains greeting keywords)
    if len(words) <= 3:
        for greeting in greetings:
            if greeting in text_lower:
                return True
    return False


@app.post("/chat")
def chat(
    payload: dict,
    current_user: dict = Depends(get_current_user)
):
    doc_id = payload.get("doc_id")
    question = payload.get("question")

    if not doc_id or not question:
        raise HTTPException(400, "doc_id and question are required.")

    user_id = current_user["_id"]
    doc = documents_collection.find_one({"doc_id": doc_id, "user_id": user_id})
    if not doc:
        raise HTTPException(404, "Document not found")

    # Check if it's a greeting
    if is_greeting(question):
        greeting_prompt = GREETING_PROMPT.format(question=question)
        greeting_response = call_llm_once(greeting_prompt)
        return {
            "answer": greeting_response,
            "offer_internet_search": False
        }

    # Try to find answer in document
    q_emb = get_embeddings([question])[0]
    hits = query_similar_chunks(q_emb, doc_id, n_results=4)

    if not hits:
        return {
            "answer": "I could not find the answer in the document.",
            "offer_internet_search": True
        }

    context = "\n---\n".join(h["document"] for h in hits)
    prompt = CHAT_PROMPT.format(context=context, question=question)
    answer = call_llm_once(prompt)

    # Check if the answer indicates no information found
    if "could not find" in answer.lower() or "not present" in answer.lower():
        return {
            "answer": "I could not find the answer in the document.",
            "offer_internet_search": True
        }

    return {
        "answer": answer,
        "offer_internet_search": False
    }


@app.post("/chat/search-internet")
def chat_search_internet(
    payload: dict,
    current_user: dict = Depends(get_current_user)
):
    """Search the internet using Gemini to answer the question."""
    question = payload.get("question")

    if not question:
        raise HTTPException(400, "question is required.")

    try:
        prompt = INTERNET_SEARCH_PROMPT.format(question=question)
        answer = call_llm_once(prompt)
        return {
            "answer": answer,
            "source": "internet"
        }
    except Exception as e:
        logger.error(f"Internet search error: {e}")
        raise HTTPException(500, f"Failed to search internet: {str(e)}")


# ---------------------------
# GETTERS - Now require authentication
# ---------------------------
@app.get("/docs/{id}/summary")
def get_summary(id: str, current_user: dict = Depends(get_current_user)):
    user_id = current_user["_id"]
    d = documents_collection.find_one(
        {"doc_id": id, "user_id": user_id}, {"_id": 0, "llm_output.summary": 1}
    )
    if not d:
        raise HTTPException(404, "Document not found")
    return {"summary": d.get("llm_output", {}).get("summary", "")}


@app.get("/docs/{id}/notes")
def get_notes(id: str, current_user: dict = Depends(get_current_user)):
    user_id = current_user["_id"]
    d = documents_collection.find_one(
        {"doc_id": id, "user_id": user_id}, {"_id": 0, "llm_output.notes": 1}
    )
    if not d:
        raise HTTPException(404, "Document not found")
    return {"notes": d.get("llm_output", {}).get("notes", {})}


@app.get("/docs/{id}/mcq")
def get_mcq(id: str, current_user: dict = Depends(get_current_user)):
    user_id = current_user["_id"]
    d = documents_collection.find_one(
        {"doc_id": id, "user_id": user_id}, {"_id": 0, "llm_output.mcq": 1}
    )
    if not d:
        raise HTTPException(404, "Document not found")
    return d.get("llm_output", {}).get("mcq", {})


@app.get("/docs/{id}/fillups")
def get_fillups(id: str, current_user: dict = Depends(get_current_user)):
    user_id = current_user["_id"]
    d = documents_collection.find_one(
        {"doc_id": id, "user_id": user_id}, {"_id": 0, "llm_output.fillups": 1}
    )
    if not d:
        raise HTTPException(404, "Document not found")
    return d.get("llm_output", {}).get("fillups", {})


# ---------------------------
# EXAM RESULTS & HISTORY
# ---------------------------
@app.get("/exam-results")
def get_exam_results(
    doc_id: str = None,
    exam_type: str = None,
    current_user: dict = Depends(get_current_user)
):
    """Get exam history for the current user."""
    user_id = current_user["_id"]
    results = get_user_exam_history(user_id, doc_id, exam_type)
    return {"results": results}


@app.get("/exam-results/{result_id}")
def get_exam_result(
    result_id: str,
    current_user: dict = Depends(get_current_user)
):
    """Get a specific exam result by ID."""
    from bson import ObjectId
    
    user_id = current_user["_id"]
    result = exam_results_collection.find_one({
        "_id": ObjectId(result_id),
        "user_id": user_id
    })
    
    if not result:
        raise HTTPException(404, "Exam result not found")
    
    result["_id"] = str(result["_id"])
    if "created_at" in result and isinstance(result["created_at"], datetime):
        result["created_at"] = result["created_at"].isoformat()
    
    return result


# ---------------------------
# GET CURRENT DIFFICULTY LEVEL
# ---------------------------
@app.get("/docs/{doc_id}/current-difficulty")
def get_current_difficulty_level(
    doc_id: str,
    exam_type: str,
    current_user: dict = Depends(get_current_user)
):
    """Get the current difficulty level and highest achieved level for a user-document-exam_type combination."""
    user_id = current_user["_id"]
    doc = documents_collection.find_one({"doc_id": doc_id, "user_id": user_id})
    if not doc:
        raise HTTPException(404, "Document not found")
    
    if exam_type not in ["mcq", "fillups"]:
        raise HTTPException(400, "exam_type must be 'mcq' or 'fillups'")
    
    current_difficulty = get_current_difficulty(doc, exam_type)
    highest_achieved = get_highest_achieved_level(doc, exam_type)
    
    return {
        "doc_id": doc_id,
        "exam_type": exam_type,
        "current_difficulty": current_difficulty,
        "highest_achieved_level": highest_achieved
    }
