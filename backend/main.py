import json
import os
from collections import defaultdict
from contextlib import asynccontextmanager
from time import time
from typing import Optional

import jwt
import bcrypt
from fastapi import FastAPI, HTTPException, Depends, Query, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import HTMLResponse
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials

from database import get_pool, init_db, close_db
from helpers import build_emotion
from models import (EmotionIn, EmotionOut, EmotionFeed, UserRegister, UserOut, UserProfile,
                    NotificationOut, CommentIn, CommentOut, BioUpdate, EmotionTypeUpdate,
                    OkResponse, LoginOut, EmotionCreatedOut, UserListItem)

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

_cors_origins_env = os.getenv("CORS_ORIGINS", "")
_cors_origins: list[str] = (
    [o.strip() for o in _cors_origins_env.split(",") if o.strip()]
    if _cors_origins_env
    else ["*"]
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=_cors_origins,
    allow_methods=["*"],
    allow_headers=["*"],
)


def hash_password(password: str) -> str:
    return bcrypt.hashpw(password.encode(), bcrypt.gensalt()).decode()


def verify_password(password: str, hashed: str) -> bool:
    return bcrypt.checkpw(password.encode(), hashed.encode())


ACCESS_TOKEN_TTL = int(os.getenv("ACCESS_TOKEN_TTL", "900"))    # 15 min
REFRESH_TOKEN_TTL = int(os.getenv("REFRESH_TOKEN_TTL", "2592000"))  # 30 days


def create_token(user_id: int, username: str) -> str:
    """Short-lived access token (15 min by default)."""
    from time import time as _time
    exp = int(_time()) + ACCESS_TOKEN_TTL
    return jwt.encode(
        {"user_id": user_id, "username": username, "type": "access", "exp": exp},
        JWT_SECRET, algorithm=JWT_ALGORITHM,
    )


def create_refresh_token(user_id: int, username: str) -> str:
    """Long-lived refresh token (30 days by default)."""
    from time import time as _time
    exp = int(_time()) + REFRESH_TOKEN_TTL
    return jwt.encode(
        {"user_id": user_id, "username": username, "type": "refresh", "exp": exp},
        JWT_SECRET, algorithm=JWT_ALGORITHM,
    )


async def get_current_user(
    credentials: HTTPAuthorizationCredentials | None = Depends(security),
) -> dict | None:
    if credentials is None:
        return None
    try:
        payload = jwt.decode(credentials.credentials, JWT_SECRET, algorithms=[JWT_ALGORITHM])
        if payload.get("type") == "refresh":
            raise HTTPException(status_code=401, detail="Use refresh endpoint to get access token")
        return {"user_id": payload["user_id"], "username": payload["username"]}
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Token expired")
    except jwt.PyJWTError:
        raise HTTPException(status_code=401, detail="Invalid token")



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


@app.post("/login", response_model=LoginOut)
async def login(data: UserRegister):
    pool = await get_pool()
    async with pool.acquire() as conn:
        row = await conn.fetchrow("SELECT id, username, password_hash FROM users WHERE username = $1", data.username)
    if row is None or not verify_password(data.password, row["password_hash"]):
        raise HTTPException(status_code=401, detail="Invalid username or password")
    token = create_token(row["id"], row["username"])
    refresh = create_refresh_token(row["id"], row["username"])
    return {"token": token, "refresh_token": refresh, "user": {"id": row["id"], "username": row["username"]}}


@app.post("/refresh", response_model=LoginOut)
async def refresh_token(body: dict):
    """Exchange a refresh token for a new access token."""
    rt = body.get("refresh_token", "")
    if not rt:
        raise HTTPException(status_code=400, detail="refresh_token required")
    try:
        payload = jwt.decode(rt, JWT_SECRET, algorithms=[JWT_ALGORITHM])
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Refresh token expired, please log in again")
    except jwt.PyJWTError:
        raise HTTPException(status_code=401, detail="Invalid refresh token")
    if payload.get("type") != "refresh":
        raise HTTPException(status_code=401, detail="Not a refresh token")
    new_access = create_token(payload["user_id"], payload["username"])
    new_refresh = create_refresh_token(payload["user_id"], payload["username"])
    return {"token": new_access, "refresh_token": new_refresh,
            "user": {"id": payload["user_id"], "username": payload["username"]}}


@app.post("/emotions", status_code=201, response_model=EmotionCreatedOut)
async def create_emotion(request: Request, emotion: EmotionIn, user: dict | None = Depends(get_current_user)):
    _check_rate_limit(request)
    if user is None:
        raise HTTPException(status_code=401, detail="Authentication required")
    pool = await get_pool()
    # Validate thumbnail size (max 20KB base64)
    if emotion.thumbnail and len(emotion.thumbnail) > 20_000:
        raise HTTPException(status_code=400, detail="Thumbnail too large")
    async with pool.acquire() as conn:
        row = await conn.fetchrow(
            """INSERT INTO emotions (parameters, user_id, username, emotion_type, thumbnail)
               VALUES ($1::jsonb, $2, $3, $4, $5) RETURNING id""",
            json.dumps(emotion.parameters),
            user["user_id"],
            user["username"],
            emotion.emotion_type,
            emotion.thumbnail,
        )
    return {"id": row["id"]}


@app.get("/emotions/random", response_model=EmotionOut)
async def get_random_emotion(user: dict | None = Depends(get_current_user)):
    pool = await get_pool()
    liked_ids: set[int] = set()
    async with pool.acquire() as conn:
        row = await conn.fetchrow(
            """SELECT e.id, e.parameters, e.created_at, e.username, e.emotion_type, e.thumbnail, e.views,
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
    return build_emotion(row, liked_ids)


FRONTEND_URL = os.getenv("FRONTEND_URL", "http://localhost:5173")


@app.get("/share/{emotion_id}", response_class=HTMLResponse)
async def share_emotion(emotion_id: int):
    """Returns an HTML page with Open Graph meta tags for social sharing."""
    pool = await get_pool()
    async with pool.acquire() as conn:
        row = await conn.fetchrow(
            """SELECT e.id, e.emotion_type, e.username, e.thumbnail
               FROM emotions e WHERE e.id = $1""",
            emotion_id
        )
    if row is None:
        raise HTTPException(status_code=404, detail="Emotion not found")

    title = row["emotion_type"] or "Emotion"
    author = row["username"] or "Anonymous"
    desc = f"A generative emotion by {author} on Spectrum"
    url = f"{FRONTEND_URL}/#/emotion/{emotion_id}"
    img = row["thumbnail"] or ""

    og_image = f'<meta property="og:image" content="{img}" />' if img else ""
    return HTMLResponse(f"""<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8" />
  <title>{title} — Spectrum</title>
  <meta property="og:title" content="{title} — Spectrum" />
  <meta property="og:description" content="{desc}" />
  <meta property="og:url" content="{url}" />
  <meta property="og:type" content="website" />
  {og_image}
  <meta name="twitter:card" content="summary_large_image" />
  <meta name="twitter:title" content="{title} — Spectrum" />
  <meta name="twitter:description" content="{desc}" />
  <meta http-equiv="refresh" content="0; url={url}" />
</head>
<body>
  <p>Redirecting to <a href="{url}">{title}</a>…</p>
</body>
</html>""")


@app.get("/emotions", response_model=EmotionFeed)
async def get_emotions(
    page: int = Query(1, ge=1),
    limit: int = Query(20, ge=1, le=100),
    emotion_type: Optional[str] = Query(None),
    sort: str = Query("new", pattern="^(new|popular|trending)$"),
    author: Optional[str] = Query(None),
    q: Optional[str] = Query(None),
    following: bool = Query(False),
    period: Optional[str] = Query(None),
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
    if q:
        conditions.append(
            f"to_tsvector('simple', COALESCE(e.emotion_type,'') || ' ' || COALESCE(e.username,'')) "
            f"@@ plainto_tsquery('simple', ${i})"
        )
        args.append(q)
        i += 1
    if following and user:
        conditions.append(f"e.user_id IN (SELECT following_id FROM follows WHERE follower_id = ${i})")
        args.append(user["user_id"])
        i += 1
    if period == "today":
        conditions.append("e.created_at > NOW() - INTERVAL '24 hours'")

    where = ("WHERE " + " AND ".join(conditions)) if conditions else ""
    if sort == "popular":
        order = "COUNT(l.user_id) DESC, e.created_at DESC"
    elif sort == "trending":
        order = "(COUNT(l.user_id)::float / POWER(EXTRACT(EPOCH FROM (NOW() - e.created_at))/3600.0 + 2, 1.5)) DESC"
    else:
        order = "e.created_at DESC"

    async with pool.acquire() as conn:
        total_row = await conn.fetchrow(
            f"SELECT COUNT(*) FROM emotions e {where}", *args
        )
        total = total_row["count"]

        rows = await conn.fetch(
            f"""SELECT e.id, e.parameters, e.created_at, e.username, e.emotion_type, e.thumbnail, e.views,
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
        items=[build_emotion(r, liked_ids) for r in rows],
        total=total,
        page=page,
        limit=limit,
    )


@app.get("/emotions/{emotion_id}", response_model=EmotionOut)
async def get_emotion(emotion_id: int, user: dict | None = Depends(get_current_user)):
    pool = await get_pool()
    liked_ids: set[int] = set()
    async with pool.acquire() as conn:
        await conn.execute(
            "UPDATE emotions SET views = views + 1 WHERE id = $1", emotion_id
        )
        row = await conn.fetchrow(
            """SELECT e.id, e.parameters, e.created_at, e.username, e.emotion_type, e.thumbnail, e.views,
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
    return build_emotion(row, liked_ids)


@app.post("/emotions/{emotion_id}/like", status_code=201, response_model=OkResponse)
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
        # Create notification for the emotion owner (skip if liking own emotion)
        owner = await conn.fetchrow("SELECT user_id FROM emotions WHERE id=$1", emotion_id)
        if owner and owner["user_id"] != user["user_id"]:
            await conn.execute(
                """INSERT INTO notifications (user_id, type, from_username, emotion_id)
                   VALUES ($1, 'like', $2, $3)""",
                owner["user_id"], user["username"], emotion_id
            )
    return {"ok": True}


@app.delete("/emotions/{emotion_id}/like", status_code=200, response_model=OkResponse)
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
            "SELECT id, username, created_at, bio FROM users WHERE username = $1", username
        )
        if user_row is None:
            raise HTTPException(status_code=404, detail="User not found")

        emotion_rows = await conn.fetch(
            """SELECT e.id, e.parameters, e.created_at, e.username, e.emotion_type, e.thumbnail, e.views,
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

        followers_count_row = await conn.fetchrow(
            "SELECT COUNT(*) FROM follows WHERE following_id=$1", user_row["id"]
        )
        following_count_row = await conn.fetchrow(
            "SELECT COUNT(*) FROM follows WHERE follower_id=$1", user_row["id"]
        )
        is_following = False
        if user:
            follow_row = await conn.fetchrow(
                "SELECT 1 FROM follows WHERE follower_id=$1 AND following_id=$2",
                user["user_id"], user_row["id"]
            )
            is_following = follow_row is not None

    return UserProfile(
        username=user_row["username"],
        created_at=user_row["created_at"],
        emotion_count=len(emotion_rows),
        likes_count=likes_count_row["count"],
        emotions=[build_emotion(r, liked_ids) for r in emotion_rows],
        followers_count=followers_count_row["count"],
        following_count=following_count_row["count"],
        is_following=is_following,
        bio=user_row["bio"],
    )


@app.patch("/emotions/{emotion_id}/type", status_code=200, response_model=OkResponse)
async def update_emotion_type(emotion_id: int, data: EmotionTypeUpdate, user: dict = Depends(get_current_user)):
    if user is None:
        raise HTTPException(status_code=401, detail="Authentication required")
    if data.emotion_type not in __import__("models").ALLOWED_EMOTION_TYPES:
        raise HTTPException(status_code=400, detail="Unknown emotion type")
    pool = await get_pool()
    async with pool.acquire() as conn:
        row = await conn.fetchrow("SELECT user_id FROM emotions WHERE id=$1", emotion_id)
        if row is None:
            raise HTTPException(status_code=404, detail="Emotion not found")
        if row["user_id"] != user["user_id"]:
            raise HTTPException(status_code=403, detail="Not your emotion")
        await conn.execute("UPDATE emotions SET emotion_type=$1 WHERE id=$2", data.emotion_type, emotion_id)
    return {"ok": True}


@app.patch("/users/{username}/bio", status_code=200, response_model=OkResponse)
async def update_bio(username: str, data: BioUpdate, user: dict = Depends(get_current_user)):
    if user is None:
        raise HTTPException(status_code=401, detail="Authentication required")
    if user["username"] != username:
        raise HTTPException(status_code=403, detail="Cannot edit another user's bio")
    pool = await get_pool()
    async with pool.acquire() as conn:
        await conn.execute("UPDATE users SET bio=$1 WHERE username=$2", data.bio or None, username)
    return {"ok": True}


@app.delete("/emotions/{emotion_id}", status_code=200, response_model=OkResponse)
async def delete_emotion(emotion_id: int, user: dict = Depends(get_current_user)):
    if user is None:
        raise HTTPException(status_code=401, detail="Authentication required")
    pool = await get_pool()
    async with pool.acquire() as conn:
        row = await conn.fetchrow("SELECT user_id FROM emotions WHERE id=$1", emotion_id)
        if row is None:
            raise HTTPException(status_code=404, detail="Emotion not found")
        if row["user_id"] != user["user_id"]:
            raise HTTPException(status_code=403, detail="Not your emotion")
        await conn.execute("DELETE FROM emotions WHERE id=$1", emotion_id)
    return {"ok": True}


@app.get("/notifications", response_model=list[NotificationOut])
async def get_notifications(user: dict = Depends(get_current_user)):
    if user is None:
        raise HTTPException(status_code=401, detail="Authentication required")
    pool = await get_pool()
    async with pool.acquire() as conn:
        rows = await conn.fetch(
            """SELECT id, type, from_username, emotion_id, read, created_at
               FROM notifications WHERE user_id=$1
               ORDER BY created_at DESC LIMIT 50""",
            user["user_id"]
        )
    return [NotificationOut(**dict(r)) for r in rows]


@app.post("/notifications/read", status_code=200, response_model=OkResponse)
async def mark_notifications_read(user: dict = Depends(get_current_user)):
    if user is None:
        raise HTTPException(status_code=401, detail="Authentication required")
    pool = await get_pool()
    async with pool.acquire() as conn:
        await conn.execute(
            "UPDATE notifications SET read=TRUE WHERE user_id=$1 AND read=FALSE",
            user["user_id"]
        )
    return {"ok": True}


@app.get("/emotions/{emotion_id}/comments", response_model=list[CommentOut])
async def get_comments(emotion_id: int):
    pool = await get_pool()
    async with pool.acquire() as conn:
        rows = await conn.fetch(
            """SELECT id, username, text, created_at FROM comments
               WHERE emotion_id=$1 ORDER BY created_at ASC""",
            emotion_id
        )
    return [CommentOut(**dict(r)) for r in rows]


@app.post("/emotions/{emotion_id}/comments", response_model=CommentOut, status_code=201)
async def add_comment(emotion_id: int, data: CommentIn, user: dict = Depends(get_current_user)):
    if user is None:
        raise HTTPException(status_code=401, detail="Authentication required")
    pool = await get_pool()
    async with pool.acquire() as conn:
        exists = await conn.fetchrow("SELECT id FROM emotions WHERE id=$1", emotion_id)
        if not exists:
            raise HTTPException(status_code=404, detail="Emotion not found")
        row = await conn.fetchrow(
            """INSERT INTO comments (emotion_id, user_id, username, text)
               VALUES ($1, $2, $3, $4) RETURNING id, username, text, created_at""",
            emotion_id, user["user_id"], user["username"], data.text
        )
        # Notify emotion owner
        owner = await conn.fetchrow("SELECT user_id FROM emotions WHERE id=$1", emotion_id)
        if owner and owner["user_id"] != user["user_id"]:
            await conn.execute(
                """INSERT INTO notifications (user_id, type, from_username, emotion_id)
                   VALUES ($1, 'comment', $2, $3)""",
                owner["user_id"], user["username"], emotion_id
            )
    return CommentOut(**dict(row))


@app.post("/users/{username}/follow", status_code=201, response_model=OkResponse)
async def follow_user(username: str, user: dict = Depends(get_current_user)):
    if user is None:
        raise HTTPException(status_code=401, detail="Authentication required")
    if username == user["username"]:
        raise HTTPException(status_code=400, detail="Cannot follow yourself")
    pool = await get_pool()
    async with pool.acquire() as conn:
        target = await conn.fetchrow("SELECT id FROM users WHERE username=$1", username)
        if not target:
            raise HTTPException(status_code=404, detail="User not found")
        try:
            await conn.execute(
                "INSERT INTO follows (follower_id, following_id) VALUES ($1, $2)",
                user["user_id"], target["id"]
            )
        except Exception:
            pass  # already following
    return {"ok": True}


@app.delete("/users/{username}/follow", status_code=200, response_model=OkResponse)
async def unfollow_user(username: str, user: dict = Depends(get_current_user)):
    if user is None:
        raise HTTPException(status_code=401, detail="Authentication required")
    pool = await get_pool()
    async with pool.acquire() as conn:
        target = await conn.fetchrow("SELECT id FROM users WHERE username=$1", username)
        if target:
            await conn.execute(
                "DELETE FROM follows WHERE follower_id=$1 AND following_id=$2",
                user["user_id"], target["id"]
            )
    return {"ok": True}


@app.get("/users/{username}/followers", response_model=list[UserListItem])
async def get_followers(username: str):
    pool = await get_pool()
    async with pool.acquire() as conn:
        target = await conn.fetchrow("SELECT id FROM users WHERE username=$1", username)
        if not target:
            raise HTTPException(status_code=404, detail="User not found")
        rows = await conn.fetch(
            """SELECT u.username FROM follows f
               JOIN users u ON u.id = f.follower_id
               WHERE f.following_id = $1
               ORDER BY f.created_at DESC""",
            target["id"]
        )
    return [{"username": r["username"]} for r in rows]


@app.get("/users/{username}/following", response_model=list[UserListItem])
async def get_following(username: str):
    pool = await get_pool()
    async with pool.acquire() as conn:
        target = await conn.fetchrow("SELECT id FROM users WHERE username=$1", username)
        if not target:
            raise HTTPException(status_code=404, detail="User not found")
        rows = await conn.fetch(
            """SELECT u.username FROM follows f
               JOIN users u ON u.id = f.following_id
               WHERE f.follower_id = $1
               ORDER BY f.created_at DESC""",
            target["id"]
        )
    return [{"username": r["username"]} for r in rows]


@app.get("/users/{username}/liked", response_model=EmotionFeed)
async def get_liked_emotions(
    username: str,
    page: int = Query(1, ge=1),
    limit: int = Query(20, ge=1, le=100),
    user: dict | None = Depends(get_current_user),
):
    pool = await get_pool()
    offset = (page - 1) * limit
    async with pool.acquire() as conn:
        target = await conn.fetchrow("SELECT id FROM users WHERE username=$1", username)
        if not target:
            raise HTTPException(status_code=404, detail="User not found")
        total_row = await conn.fetchrow(
            "SELECT COUNT(*) FROM likes WHERE user_id=$1", target["id"]
        )
        rows = await conn.fetch(
            f"""SELECT e.id, e.parameters, e.created_at, e.username, e.emotion_type, e.thumbnail, e.views,
                       COUNT(l2.user_id) AS likes_count
                FROM likes l1
                JOIN emotions e ON e.id = l1.emotion_id
                LEFT JOIN likes l2 ON l2.emotion_id = e.id
                WHERE l1.user_id = $1
                GROUP BY e.id
                ORDER BY l1.created_at DESC
                LIMIT $2 OFFSET $3""",
            target["id"], limit, offset
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
        items=[build_emotion(r, liked_ids) for r in rows],
        total=total_row["count"],
        page=page,
        limit=limit,
    )
