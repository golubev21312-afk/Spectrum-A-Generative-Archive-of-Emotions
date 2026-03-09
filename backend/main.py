import os
import json
from collections import defaultdict
from contextlib import asynccontextmanager
from time import time
from typing import Optional

import jwt
import bcrypt
from fastapi import FastAPI, HTTPException, Depends, Query, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials

from database import get_pool, init_db, close_db
from models import EmotionIn, EmotionOut, EmotionFeed, UserRegister, UserOut, UserProfile

JWT_SECRET = os.getenv("JWT_SECRET", "spectrum-secret-change-me")
JWT_ALGORITHM = "HS256"

security = HTTPBearer(auto_error=False)

# Simple in-memory rate limiter: max 20 emotions per IP per 60 seconds
_rate_store: dict[str, list[float]] = defaultdict(list)

def _check_rate_limit(request: Request, limit: int = 20, window: int = 60) -> None:
    ip = request.client.host if request.client else "unknown"
    now = time()
    timestamps = [t for t in _rate_store[ip] if now - t < window]
    if len(timestamps) >= limit:
        raise HTTPException(status_code=429, detail="Too many requests, slow down")
    timestamps.append(now)
    _rate_store[ip] = timestamps


@asynccontextmanager
async def lifespan(app: FastAPI):
    await init_db()
    yield
    await close_db()


app = FastAPI(title="Spectrum API", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)


def hash_password(password: str) -> str:
    return bcrypt.hashpw(password.encode(), bcrypt.gensalt()).decode()


def verify_password(password: str, hashed: str) -> bool:
    return bcrypt.checkpw(password.encode(), hashed.encode())


def create_token(user_id: int, username: str) -> str:
    return jwt.encode({"user_id": user_id, "username": username}, JWT_SECRET, algorithm=JWT_ALGORITHM)


async def get_current_user(
    credentials: HTTPAuthorizationCredentials | None = Depends(security),
) -> dict | None:
    if credentials is None:
        return None
    try:
        payload = jwt.decode(credentials.credentials, JWT_SECRET, algorithms=[JWT_ALGORITHM])
        return {"user_id": payload["user_id"], "username": payload["username"]}
    except jwt.PyJWTError:
        raise HTTPException(status_code=401, detail="Invalid token")


def _build_emotion(row, liked_ids: set[int] = set()) -> EmotionOut:
    return EmotionOut(
        id=row["id"],
        parameters=json.loads(row["parameters"]),
        created_at=row["created_at"],
        username=row["username"],
        emotion_type=row["emotion_type"],
        likes_count=row["likes_count"],
        liked_by_me=row["id"] in liked_ids,
    )


@app.post("/register", response_model=UserOut)
async def register(data: UserRegister):
    pool = await get_pool()
    async with pool.acquire() as conn:
        existing = await conn.fetchrow("SELECT id FROM users WHERE username = $1", data.username)
        if existing:
            raise HTTPException(status_code=409, detail="Username already taken")
        row = await conn.fetchrow(
            "INSERT INTO users (username, password_hash) VALUES ($1, $2) RETURNING id, username",
            data.username,
            hash_password(data.password),
        )
    return UserOut(id=row["id"], username=row["username"])


@app.post("/login")
async def login(data: UserRegister):
    pool = await get_pool()
    async with pool.acquire() as conn:
        row = await conn.fetchrow("SELECT id, username, password_hash FROM users WHERE username = $1", data.username)
    if row is None or not verify_password(data.password, row["password_hash"]):
        raise HTTPException(status_code=401, detail="Invalid username or password")
    token = create_token(row["id"], row["username"])
    return {"token": token, "user": {"id": row["id"], "username": row["username"]}}


@app.post("/emotions", status_code=201)
async def create_emotion(request: Request, emotion: EmotionIn, user: dict | None = Depends(get_current_user)) -> dict:
    _check_rate_limit(request)
    if user is None:
        raise HTTPException(status_code=401, detail="Authentication required")
    pool = await get_pool()
    async with pool.acquire() as conn:
        row = await conn.fetchrow(
            """INSERT INTO emotions (parameters, user_id, username, emotion_type)
               VALUES ($1::jsonb, $2, $3, $4) RETURNING id""",
            json.dumps(emotion.parameters),
            user["user_id"],
            user["username"],
            emotion.emotion_type,
        )
    return {"id": row["id"]}


@app.get("/emotions/random", response_model=EmotionOut)
async def get_random_emotion(user: dict | None = Depends(get_current_user)):
    pool = await get_pool()
    liked_ids: set[int] = set()
    async with pool.acquire() as conn:
        row = await conn.fetchrow(
            """SELECT e.id, e.parameters, e.created_at, e.username, e.emotion_type,
                      COUNT(l.user_id) AS likes_count
               FROM emotions e
               LEFT JOIN likes l ON l.emotion_id = e.id
               GROUP BY e.id
               ORDER BY RANDOM() LIMIT 1"""
        )
        if row and user:
            like = await conn.fetchrow(
                "SELECT 1 FROM likes WHERE user_id=$1 AND emotion_id=$2",
                user["user_id"], row["id"]
            )
            if like:
                liked_ids.add(row["id"])
    if row is None:
        raise HTTPException(status_code=404, detail="No emotions saved yet")
    return _build_emotion(row, liked_ids)


@app.get("/emotions", response_model=EmotionFeed)
async def get_emotions(
    page: int = Query(1, ge=1),
    limit: int = Query(20, ge=1, le=100),
    emotion_type: Optional[str] = Query(None),
    sort: str = Query("new", pattern="^(new|popular)$"),
    author: Optional[str] = Query(None),
    user: dict | None = Depends(get_current_user),
):
    pool = await get_pool()
    offset = (page - 1) * limit

    conditions = []
    args = []
    i = 1

    if emotion_type:
        conditions.append(f"e.emotion_type = ${i}")
        args.append(emotion_type)
        i += 1
    if author:
        conditions.append(f"e.username ILIKE ${i}")
        args.append(f"%{author}%")
        i += 1

    where = ("WHERE " + " AND ".join(conditions)) if conditions else ""
    order = "COUNT(l.user_id) DESC, e.created_at DESC" if sort == "popular" else "e.created_at DESC"

    async with pool.acquire() as conn:
        total_row = await conn.fetchrow(
            f"SELECT COUNT(*) FROM emotions e {where}", *args
        )
        total = total_row["count"]

        rows = await conn.fetch(
            f"""SELECT e.id, e.parameters, e.created_at, e.username, e.emotion_type,
                       COUNT(l.user_id) AS likes_count
                FROM emotions e
                LEFT JOIN likes l ON l.emotion_id = e.id
                {where}
                GROUP BY e.id
                ORDER BY {order}
                LIMIT ${i} OFFSET ${i+1}""",
            *args, limit, offset
        )

        liked_ids: set[int] = set()
        if user and rows:
            ids = [r["id"] for r in rows]
            liked_rows = await conn.fetch(
                "SELECT emotion_id FROM likes WHERE user_id=$1 AND emotion_id = ANY($2::int[])",
                user["user_id"], ids
            )
            liked_ids = {r["emotion_id"] for r in liked_rows}

    return EmotionFeed(
        items=[_build_emotion(r, liked_ids) for r in rows],
        total=total,
        page=page,
        limit=limit,
    )


@app.get("/emotions/{emotion_id}", response_model=EmotionOut)
async def get_emotion(emotion_id: int, user: dict | None = Depends(get_current_user)):
    pool = await get_pool()
    liked_ids: set[int] = set()
    async with pool.acquire() as conn:
        row = await conn.fetchrow(
            """SELECT e.id, e.parameters, e.created_at, e.username, e.emotion_type,
                      COUNT(l.user_id) AS likes_count
               FROM emotions e
               LEFT JOIN likes l ON l.emotion_id = e.id
               WHERE e.id = $1
               GROUP BY e.id""",
            emotion_id
        )
        if row and user:
            like = await conn.fetchrow(
                "SELECT 1 FROM likes WHERE user_id=$1 AND emotion_id=$2",
                user["user_id"], emotion_id
            )
            if like:
                liked_ids.add(emotion_id)
    if row is None:
        raise HTTPException(status_code=404, detail="Emotion not found")
    return _build_emotion(row, liked_ids)


@app.post("/emotions/{emotion_id}/like", status_code=201)
async def like_emotion(emotion_id: int, user: dict = Depends(get_current_user)):
    if user is None:
        raise HTTPException(status_code=401, detail="Authentication required")
    pool = await get_pool()
    async with pool.acquire() as conn:
        exists = await conn.fetchrow("SELECT id FROM emotions WHERE id=$1", emotion_id)
        if not exists:
            raise HTTPException(status_code=404, detail="Emotion not found")
        try:
            await conn.execute(
                "INSERT INTO likes (user_id, emotion_id) VALUES ($1, $2)",
                user["user_id"], emotion_id
            )
        except Exception:
            pass  # already liked
    return {"ok": True}


@app.delete("/emotions/{emotion_id}/like", status_code=200)
async def unlike_emotion(emotion_id: int, user: dict = Depends(get_current_user)):
    if user is None:
        raise HTTPException(status_code=401, detail="Authentication required")
    pool = await get_pool()
    async with pool.acquire() as conn:
        await conn.execute(
            "DELETE FROM likes WHERE user_id=$1 AND emotion_id=$2",
            user["user_id"], emotion_id
        )
    return {"ok": True}


@app.get("/users/{username}", response_model=UserProfile)
async def get_user_profile(username: str, user: dict | None = Depends(get_current_user)):
    pool = await get_pool()
    async with pool.acquire() as conn:
        user_row = await conn.fetchrow(
            "SELECT id, username, created_at FROM users WHERE username = $1", username
        )
        if user_row is None:
            raise HTTPException(status_code=404, detail="User not found")

        emotion_rows = await conn.fetch(
            """SELECT e.id, e.parameters, e.created_at, e.username, e.emotion_type,
                      COUNT(l.user_id) AS likes_count
               FROM emotions e
               LEFT JOIN likes l ON l.emotion_id = e.id
               WHERE e.user_id = $1
               GROUP BY e.id
               ORDER BY e.created_at DESC
               LIMIT 50""",
            user_row["id"]
        )

        likes_count_row = await conn.fetchrow(
            """SELECT COUNT(*) FROM likes l
               JOIN emotions e ON e.id = l.emotion_id
               WHERE e.user_id = $1""",
            user_row["id"]
        )

        liked_ids: set[int] = set()
        if user and emotion_rows:
            ids = [r["id"] for r in emotion_rows]
            liked_rows = await conn.fetch(
                "SELECT emotion_id FROM likes WHERE user_id=$1 AND emotion_id = ANY($2::int[])",
                user["user_id"], ids
            )
            liked_ids = {r["emotion_id"] for r in liked_rows}

    return UserProfile(
        username=user_row["username"],
        created_at=user_row["created_at"],
        emotion_count=len(emotion_rows),
        likes_count=likes_count_row["count"],
        emotions=[_build_emotion(r, liked_ids) for r in emotion_rows],
    )
