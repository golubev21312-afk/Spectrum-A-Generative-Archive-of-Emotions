from datetime import datetime
from typing import Optional
from pydantic import BaseModel, Field, field_validator

PARAM_RANGES: dict[str, tuple[float, float]] = {
    "hue":            (0.0,   360.0),
    "transparency":   (0.0,   1.0),
    "rotationSpeed":  (0.0,   5.0),
    "noiseAmplitude": (0.0,   2.0),
    "particleDensity":(0.0,   500.0),
}

ALLOWED_EMOTION_TYPES = {
    "Rage","Passion","Anxiety","Energy","Joy","Hope","Calm",
    "Melancholy","Sadness","Mystery","Tenderness","Emptiness",
    "Chaos","Harmony","Contemplation","Serenity",
    "Ярость","Страсть","Тревога","Энергия","Радость","Надежда","Спокойствие",
    "Меланхолия","Грусть","Мистика","Нежность","Пустота",
    "Хаос","Гармония","Созерцание","Безмятежность",
}


class EmotionIn(BaseModel):
    parameters: dict
    emotion_type: Optional[str] = None
    thumbnail: Optional[str] = None  # base64 JPEG data URL, max ~15KB

    @field_validator("parameters")
    @classmethod
    def validate_parameters(cls, v: dict) -> dict:
        for key, (lo, hi) in PARAM_RANGES.items():
            if key not in v:
                continue
            val = v[key]
            if not isinstance(val, (int, float)):
                raise ValueError(f"{key} must be a number")
            if not (lo <= float(val) <= hi):
                raise ValueError(f"{key} must be between {lo} and {hi}")
        return v

    @field_validator("emotion_type")
    @classmethod
    def validate_emotion_type(cls, v: Optional[str]) -> Optional[str]:
        if v is not None and v not in ALLOWED_EMOTION_TYPES:
            raise ValueError("unknown emotion_type")
        return v


class EmotionOut(BaseModel):
    id: int
    parameters: dict
    created_at: datetime
    username: Optional[str] = None
    emotion_type: Optional[str] = None
    likes_count: int = 0
    liked_by_me: bool = False
    thumbnail: Optional[str] = None
    views: int = 0


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
    followers_count: int = 0
    following_count: int = 0
    is_following: bool = False


class NotificationOut(BaseModel):
    id: int
    type: str
    from_username: Optional[str] = None
    emotion_id: Optional[int] = None
    read: bool
    created_at: datetime


class CommentIn(BaseModel):
    text: str = Field(..., min_length=1, max_length=280)


class CommentOut(BaseModel):
    id: int
    username: str
    text: str
    created_at: datetime
