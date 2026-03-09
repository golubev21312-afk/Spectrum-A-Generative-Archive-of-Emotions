from datetime import datetime
from typing import Optional
from pydantic import BaseModel, Field


class EmotionIn(BaseModel):
    parameters: dict
    emotion_type: Optional[str] = None


class EmotionOut(BaseModel):
    id: int
    parameters: dict
    created_at: datetime
    username: Optional[str] = None
    emotion_type: Optional[str] = None
    likes_count: int = 0
    liked_by_me: bool = False


class EmotionFeed(BaseModel):
    items: list[EmotionOut]
    total: int
    page: int
    limit: int


class UserRegister(BaseModel):
    username: str = Field(..., min_length=2, max_length=32)
    password: str = Field(..., min_length=4)


class UserOut(BaseModel):
    id: int
    username: str


class UserProfile(BaseModel):
    username: str
    created_at: datetime
    emotion_count: int
    likes_count: int
    emotions: list[EmotionOut]
