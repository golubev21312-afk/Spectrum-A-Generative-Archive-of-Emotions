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
        await conn.execute("""
            ALTER TABLE emotions ADD COLUMN IF NOT EXISTS views INTEGER DEFAULT 0;
        """)
        await conn.execute("""
            CREATE INDEX IF NOT EXISTS idx_emotions_search ON emotions
            USING GIN (to_tsvector('simple',
                COALESCE(emotion_type, '') || ' ' || COALESCE(username, '')
            ));
        """)
        await conn.execute("""
            ALTER TABLE users ADD COLUMN IF NOT EXISTS bio VARCHAR(160);
        """)
        await conn.execute("""
            ALTER TABLE users ADD COLUMN IF NOT EXISTS avatar TEXT;
        """)
        await conn.execute("""
            CREATE TABLE IF NOT EXISTS reactions (
                id SERIAL PRIMARY KEY,
                emotion_id INTEGER REFERENCES emotions(id) ON DELETE CASCADE,
                user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
                symbol VARCHAR(8) NOT NULL,
                created_at TIMESTAMPTZ DEFAULT NOW(),
                UNIQUE (emotion_id, user_id)
            );
        """)
        await conn.execute("""
            CREATE INDEX IF NOT EXISTS idx_reactions_emotion_id ON reactions(emotion_id);
        """)
        await conn.execute("""
            CREATE TABLE IF NOT EXISTS messages (
                id SERIAL PRIMARY KEY,
                from_user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
                from_username VARCHAR(32) NOT NULL,
                to_user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
                to_username VARCHAR(32) NOT NULL,
                emotion_id INTEGER REFERENCES emotions(id) ON DELETE SET NULL,
                read BOOLEAN DEFAULT FALSE,
                created_at TIMESTAMPTZ DEFAULT NOW()
            );
        """)
        await conn.execute("""
            CREATE INDEX IF NOT EXISTS idx_messages_to_user_id ON messages(to_user_id, read);
        """)
        await conn.execute("""
            CREATE TABLE IF NOT EXISTS collections (
                id SERIAL PRIMARY KEY,
                user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
                username VARCHAR(32) NOT NULL,
                title VARCHAR(80) NOT NULL,
                created_at TIMESTAMPTZ DEFAULT NOW()
            );
        """)
        await conn.execute("""
            CREATE INDEX IF NOT EXISTS idx_collections_user_id ON collections(user_id);
        """)
        await conn.execute("""
            CREATE TABLE IF NOT EXISTS collection_emotions (
                collection_id INTEGER REFERENCES collections(id) ON DELETE CASCADE,
                emotion_id INTEGER REFERENCES emotions(id) ON DELETE CASCADE,
                added_at TIMESTAMPTZ DEFAULT NOW(),
                PRIMARY KEY (collection_id, emotion_id)
            );
        """)
        # CHECK constraints (idempotent — silently skip if already exist)
        for stmt in [
            """DO $$ BEGIN
                ALTER TABLE users ADD CONSTRAINT chk_username_len
                    CHECK (LENGTH(username) >= 2 AND LENGTH(username) <= 32);
               EXCEPTION WHEN duplicate_object THEN NULL; END $$;""",
            """DO $$ BEGIN
                ALTER TABLE users ADD CONSTRAINT chk_bio_len
                    CHECK (bio IS NULL OR LENGTH(bio) <= 160);
               EXCEPTION WHEN duplicate_object THEN NULL; END $$;""",
            """DO $$ BEGIN
                ALTER TABLE emotions ADD CONSTRAINT chk_emotion_type_len
                    CHECK (emotion_type IS NULL OR LENGTH(emotion_type) <= 64);
               EXCEPTION WHEN duplicate_object THEN NULL; END $$;""",
            """DO $$ BEGIN
                ALTER TABLE comments ADD CONSTRAINT chk_comment_text_len
                    CHECK (LENGTH(text) >= 1 AND LENGTH(text) <= 280);
               EXCEPTION WHEN duplicate_object THEN NULL; END $$;""",
        ]:
            await conn.execute(stmt)


async def close_db() -> None:
    global pool
    if pool is not None:
        await pool.close()
        pool = None
