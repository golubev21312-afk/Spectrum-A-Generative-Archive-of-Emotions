import os
import json
from contextlib import asynccontextmanager

import jwt
import bcrypt
from fastapi import FastAPI, HTTPException, Depends
from fastapi.middleware.cors import CORSMiddleware
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials

from database import get_pool, init_db, close_db
from models import EmotionIn, EmotionOut, UserRegister, UserOut

JWT_SECRET = os.getenv("JWT_SECRET", "spectrum-secret-change-me")
JWT_ALGORITHM = "HS256"

security = HTTPBearer(auto_error=False)


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
async def create_emotion(emotion: EmotionIn, user: dict | None = Depends(get_current_user)) -> dict:
    if user is None:
        raise HTTPException(status_code=401, detail="Authentication required")
    pool = await get_pool()
    async with pool.acquire() as conn:
        row = await conn.fetchrow(
            "INSERT INTO emotions (parameters, user_id, username) VALUES ($1::jsonb, $2, $3) RETURNING id",
            json.dumps(emotion.parameters),
            user["user_id"],
            user["username"],
        )
    return {"id": row["id"]}


@app.get("/emotions/random", response_model=EmotionOut)
async def get_random_emotion():
    pool = await get_pool()
    async with pool.acquire() as conn:
        row = await conn.fetchrow(
            "SELECT id, parameters, created_at, username FROM emotions ORDER BY RANDOM() LIMIT 1"
        )
    if row is None:
        raise HTTPException(status_code=404, detail="No emotions saved yet")
    return EmotionOut(
        id=row["id"],
        parameters=json.loads(row["parameters"]),
        created_at=row["created_at"],
        username=row["username"],
    )
