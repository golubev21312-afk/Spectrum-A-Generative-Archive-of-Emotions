import os
import asyncpg
from dotenv import load_dotenv

load_dotenv()

DATABASE_URL = os.getenv("DATABASE_URL", "postgresql://postgres:postgres@localhost:5432/spectrum")

pool: asyncpg.Pool | None = None


async def get_pool() -> asyncpg.Pool:
    global pool
    if pool is None:
        pool = await asyncpg.create_pool(DATABASE_URL)
    return pool


async def init_db() -> None:
    p = await get_pool()
    async with p.acquire() as conn:
        await conn.execute("""
            CREATE TABLE IF NOT EXISTS users (
                id SERIAL PRIMARY KEY,
                username VARCHAR(32) UNIQUE NOT NULL,
                password_hash TEXT NOT NULL,
                created_at TIMESTAMPTZ DEFAULT NOW()
            );
        """)
        await conn.execute("""
            CREATE TABLE IF NOT EXISTS emotions (
                id SERIAL PRIMARY KEY,
                parameters JSONB NOT NULL,
                created_at TIMESTAMPTZ DEFAULT NOW()
            );
        """)
        await conn.execute("""
            ALTER TABLE emotions ADD COLUMN IF NOT EXISTS user_id INTEGER REFERENCES users(id);
        """)
        await conn.execute("""
            ALTER TABLE emotions ADD COLUMN IF NOT EXISTS username VARCHAR(32);
        """)


async def close_db() -> None:
    global pool
    if pool is not None:
        await pool.close()
        pool = None
