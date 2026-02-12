from datetime import datetime
from typing import Optional
from pydantic import BaseModel, Field


class EmotionIn(BaseModel):
    parameters: dict


class EmotionOut(BaseModel):
    id: int
    parameters: dict
    created_at: datetime
    username: Optional[str] = None


class UserRegister(BaseModel):
    username: str = Field(..., min_length=2, max_length=32)
    password: str = Field(..., min_length=4)


class UserOut(BaseModel):
    id: int
    username: str
