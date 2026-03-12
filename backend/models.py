from datetime import datetime
from typing import Optional
from pydantic import BaseModel, Field, field_validator

PARAM_RANGES: dict[str, tuple[float, float]] = {
    "hue":            (0.0,   360.0),
    "transparency":   (0.0,   1.0),
    "rotationSpeed":  (0.0,   5.0),
    "noiseAmplitude": (0.0,   2.0),
    "particleDensity":(0.0,   500.0),
    "particleHue":    (0.0,   360.0),
    "particleSize":   (0.2,   3.0),
    "particleSpeed":  (0.0,   3.0),
    "particleForce":  (-1.0,  1.0),
    "glowIntensity":  (0.0,   2.0),
}

ALLOWED_EMOTION_TYPES = {
    "Rage","Passion","Anxiety","Energy","Joy","Hope","Calm",
    "Melancholy","Sadness","Mystery","Tenderness","Emptiness",
    "Chaos","Harmony","Contemplation","Serenity",
    "Fury","Euphoria","Dread","Bliss","Wonder","Nostalgia","Yearning","Catharsis",
    "Ярость","Страсть","Тревога","Энергия","Радость","Надежда","Спокойствие",
    "Меланхолия","Грусть","Мистика","Нежность","Пустота",
    "Хаос","Гармония","Созерцание","Безмятежность",
    "Бешенство","Эйфория","Ужас","Блаженство","Изумление","Ностальгия","Тоска","Катарсис",
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


ALLOWED_REACTIONS = {"🔥", "💧", "🌀", "🌑", "✨"}


class ReactIn(BaseModel):
    symbol: str

    @field_validator("symbol")
    @classmethod
    def validate_symbol(cls, v: str) -> str:
        if v not in ALLOWED_REACTIONS:
            raise ValueError("unknown reaction symbol")
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
    reactions: dict[str, int] = Field(default_factory=dict)
    my_reaction: Optional[str] = None


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


class BioUpdate(BaseModel):
    bio: str = Field("", max_length=160)


class AvatarUpdate(BaseModel):
    avatar: str = Field(..., max_length=200000)  # base64 JPEG data URL, max ~150 KB


class EmotionTypeUpdate(BaseModel):
    emotion_type: str


class UserProfile(BaseModel):
    username: str
    created_at: datetime
    emotion_count: int
    likes_count: int
    emotions: list[EmotionOut]
    followers_count: int = 0
    following_count: int = 0
    is_following: bool = False
    bio: Optional[str] = None
    avatar: Optional[str] = None


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


class OkResponse(BaseModel):
    ok: bool = True


class LoginOut(BaseModel):
    token: str
    refresh_token: Optional[str] = None
    user: UserOut


class EmotionCreatedOut(BaseModel):
    id: int


class UserListItem(BaseModel):
    username: str


class CollectionIn(BaseModel):
    title: str = Field(..., min_length=1, max_length=80)


class CollectionOut(BaseModel):
    id: int
    username: str
    title: str
    emotion_count: int = 0
    preview_hues: list[float] = Field(default_factory=list)
    created_at: datetime


class CollectionFull(BaseModel):
    id: int
    username: str
    title: str
    emotions: list[EmotionOut]
    created_at: datetime


class MessageIn(BaseModel):
    to_username: str
    emotion_id: int


class MessageOut(BaseModel):
    id: int
    from_username: str
    to_username: str
    emotion_id: Optional[int] = None
    emotion_type: Optional[str] = None
    emotion_hue: Optional[float] = None
    read: bool
    created_at: datetime
