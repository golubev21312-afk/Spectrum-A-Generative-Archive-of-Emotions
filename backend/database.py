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
        await conn.execute("""
            ALTER TABLE emotions ADD COLUMN IF NOT EXISTS emotion_type VARCHAR(32);
        """)
        await conn.execute("""
            ALTER TABLE emotions ADD COLUMN IF NOT EXISTS thumbnail TEXT;
        """)
        await conn.execute("""
            CREATE TABLE IF NOT EXISTS likes (
                user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
                emotion_id INTEGER REFERENCES emotions(id) ON DELETE CASCADE,
                created_at TIMESTAMPTZ DEFAULT NOW(),
                PRIMARY KEY (user_id, emotion_id)
            );
        """)
        # Indexes for performance
        await conn.execute("""
            CREATE INDEX IF NOT EXISTS idx_emotions_emotion_type ON emotions(emotion_type);
        """)
        await conn.execute("""
            CREATE INDEX IF NOT EXISTS idx_emotions_created_at ON emotions(created_at DESC);
        """)
        await conn.execute("""
            CREATE INDEX IF NOT EXISTS idx_emotions_user_id ON emotions(user_id);
        """)
        await conn.execute("""
            CREATE INDEX IF NOT EXISTS idx_likes_emotion_id ON likes(emotion_id);
        """)
        await conn.execute("""
            CREATE TABLE IF NOT EXISTS notifications (
                id SERIAL PRIMARY KEY,
                user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
                type VARCHAR(32) NOT NULL,
                from_username VARCHAR(32),
                emotion_id INTEGER REFERENCES emotions(id) ON DELETE SET NULL,
                read BOOLEAN DEFAULT FALSE,
                created_at TIMESTAMPTZ DEFAULT NOW()
            );
        """)
        await conn.execute("""
            CREATE INDEX IF NOT EXISTS idx_notifications_user_id ON notifications(user_id, read);
        """)
        await conn.execute("""
            CREATE TABLE IF NOT EXISTS comments (
                id SERIAL PRIMARY KEY,
                emotion_id INTEGER REFERENCES emotions(id) ON DELETE CASCADE,
                user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
                username VARCHAR(32) NOT NULL,
                text VARCHAR(280) NOT NULL,
                created_at TIMESTAMPTZ DEFAULT NOW()
            );
        """)
        await conn.execute("""
            CREATE INDEX IF NOT EXISTS idx_comments_emotion_id ON comments(emotion_id);
        """)
        await conn.execute("""
            CREATE TABLE IF NOT EXISTS follows (
                follower_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
                following_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
                created_at TIMESTAMPTZ DEFAULT NOW(),
                PRIMARY KEY (follower_id, following_id)
            );
        """)
        await conn.execute("""
            CREATE INDEX IF NOT EXISTS idx_follows_following_id ON follows(following_id);
        """)


async def close_db() -> None:
    global pool
    if pool is not None:
        await pool.close()
        pool = None
