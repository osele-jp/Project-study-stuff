import os
import random
import uuid
from datetime import datetime, timezone
from typing import Literal

from dotenv import load_dotenv
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from google import genai
from pydantic import BaseModel, Field

from database import get_firestore

load_dotenv()

app = FastAPI(title="Math Research Study")
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://127.0.0.1:5173", "https://project-study-stuff-frontend.onrender.com/"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

SYSTEM_INSTRUCTION = (
    "You are a concise math study assistant. Format all math expressions, "
    "fractions, and superscripts using standard LaTeX ($...$ or $$...$$)."
)


class StartResponse(BaseModel):
    participant_id: str
    condition_order: Literal["AI_FIRST", "NO_AI_FIRST"]
    set_order: Literal["A_THEN_B", "B_THEN_A"]


class ChatRequest(BaseModel):
    participant_id: str
    question_id: str
    message: str = Field(min_length=1)
    history: list[dict] = Field(default_factory=list)


class ChatResponse(BaseModel):
    reply: str


class SubmitRequest(BaseModel):
    participant_id: str
    question_id: str
    condition: Literal["AI", "NO_AI"]
    answer_latex: str = ""
    time_spent_ms: int = Field(ge=0)
    tab_switches: int = Field(ge=0)
    paste_count: int = Field(ge=0)


def require_firestore():
    try:
        return get_firestore()
    except Exception as error:
        raise HTTPException(
            status_code=503,
            detail=f"Firebase is not configured correctly: {error}",
        ) from error


@app.post("/api/start", response_model=StartResponse)
def start_study():
    participant_id = str(uuid.uuid4())
    now = datetime.now(timezone.utc)
    config = {
        "participant_id": participant_id,
        "condition_order": random.choice(["AI_FIRST", "NO_AI_FIRST"]),
        "set_order": random.choice(["A_THEN_B", "B_THEN_A"]),
        "created_at": now,
        "completed_at": None,
    }
    firestore_db = require_firestore()
    firestore_db.collection("participants").document(participant_id).set(config)
    return StartResponse(**config)


@app.post("/api/chat", response_model=ChatResponse)
def chat(request: ChatRequest):
    firestore_db = require_firestore()
    participant = firestore_db.collection("participants").document(request.participant_id).get()
    if not participant.exists:
        raise HTTPException(status_code=404, detail="Participant not found")

    api_key = os.getenv("GOOGLE_API_KEY") or os.getenv("GEMINI_API_KEY")
    if not api_key:
        raise HTTPException(status_code=503, detail="Gemini API key is not configured")

    contents = []
    for item in request.history[-20:]:
        role = item.get("role", "")
        text = item.get("message", item.get("content", ""))
        if role in ("user", "assistant") and text:
            contents.append({
                "role": "user" if role == "user" else "model",
                "parts": [{"text": text}],
            })
    contents.append({"role": "user", "parts": [{"text": request.message}]})

    client = genai.Client(api_key=api_key)
    response = client.models.generate_content(
        model="gemini-2.5-flash",
        contents=contents,
        config={"system_instruction": SYSTEM_INSTRUCTION},
    )
    reply = response.text or "I could not generate a response."
    now = datetime.now(timezone.utc)
    chat_ref = firestore_db.collection("chat_logs")

    chat_ref.add({
        "participant_id": request.participant_id,
        "question_id": request.question_id,
        "role": "user",
        "message": request.message,
        "created_at": now,
    })
    chat_ref.add({
        "participant_id": request.participant_id,
        "question_id": request.question_id,
        "role": "assistant",
        "message": reply,
        "created_at": now,
    })

    return ChatResponse(reply=reply)


@app.post("/api/submit")
def submit_response(request: SubmitRequest):
    firestore_db = require_firestore()
    participant = firestore_db.collection("participants").document(request.participant_id).get()
    if not participant.exists:
        raise HTTPException(status_code=404, detail="Participant not found")

    data = request.model_dump()
    data["created_at"] = datetime.now(timezone.utc)
    _, document = firestore_db.collection("response_logs").add(data)
    return {"ok": True, "response_id": document.id}


@app.post("/api/complete")
def complete_study(participant_id: str):
    firestore_db = require_firestore()
    participant_ref = firestore_db.collection("participants").document(participant_id)
    participant = participant_ref.get()
    if not participant.exists:
        raise HTTPException(status_code=404, detail="Participant not found")
    participant_ref.update({"completed_at": datetime.now(timezone.utc)})
    return {"ok": True}
