from datetime import datetime
from typing import Literal

from pydantic import BaseModel, Field


class Participant(BaseModel):
    id: str
    condition_order: Literal["AI_FIRST", "NO_AI_FIRST"]
    set_order: Literal["A_THEN_B", "B_THEN_A"]
    created_at: datetime
    completed_at: datetime | None = None


class ResponseLog(BaseModel):
    participant_id: str
    question_id: str
    condition: Literal["AI", "NO_AI"]
    answer_latex: str = ""
    time_spent_ms: int = Field(ge=0)
    tab_switches: int = Field(ge=0)
    paste_count: int = Field(ge=0)
    created_at: datetime


class ChatLog(BaseModel):
    participant_id: str
    question_id: str
    role: Literal["user", "assistant"]
    message: str
    created_at: datetime
