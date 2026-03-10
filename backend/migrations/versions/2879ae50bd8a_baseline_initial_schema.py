"""baseline_initial_schema

Revision ID: 2879ae50bd8a
Revises: 
Create Date: 2026-03-10 23:13:18.270113

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '2879ae50bd8a'
down_revision: Union[str, Sequence[str], None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.execute("""
        CREATE TABLE IF NOT EXISTS users (
            id SERIAL PRIMARY KEY,
            username VARCHAR(32) UNIQUE NOT NULL,
            password_hash TEXT NOT NULL,
            bio VARCHAR(160),
            created_at TIMESTAMPTZ DEFAULT NOW()
        )
    """)
    op.execute("""
        CREATE TABLE IF NOT EXISTS emotions (
            id SERIAL PRIMARY KEY,
            parameters JSONB NOT NULL,
            user_id INTEGER REFERENCES users(id),
            username VARCHAR(32),
            emotion_type VARCHAR(64),
            thumbnail TEXT,
            views INTEGER DEFAULT 0,
            created_at TIMESTAMPTZ DEFAULT NOW()
        )
    """)
    op.execute("""
        CREATE TABLE IF NOT EXISTS likes (
            user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
            emotion_id INTEGER REFERENCES emotions(id) ON DELETE CASCADE,
            created_at TIMESTAMPTZ DEFAULT NOW(),
            PRIMARY KEY (user_id, emotion_id)
        )
    """)
    op.execute("""
        CREATE TABLE IF NOT EXISTS follows (
            follower_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
            following_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
            created_at TIMESTAMPTZ DEFAULT NOW(),
            PRIMARY KEY (follower_id, following_id)
        )
    """)
    op.execute("""
        CREATE TABLE IF NOT EXISTS notifications (
            id SERIAL PRIMARY KEY,
            user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
            type VARCHAR(32) NOT NULL,
            from_username VARCHAR(32),
            emotion_id INTEGER REFERENCES emotions(id) ON DELETE SET NULL,
            read BOOLEAN DEFAULT FALSE,
            created_at TIMESTAMPTZ DEFAULT NOW()
        )
    """)
    op.execute("""
        CREATE TABLE IF NOT EXISTS comments (
            id SERIAL PRIMARY KEY,
            emotion_id INTEGER REFERENCES emotions(id) ON DELETE CASCADE,
            user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
            username VARCHAR(32) NOT NULL,
            text VARCHAR(280) NOT NULL,
            created_at TIMESTAMPTZ DEFAULT NOW()
        )
    """)
    op.execute("CREATE INDEX IF NOT EXISTS idx_emotions_emotion_type ON emotions(emotion_type)")
    op.execute("CREATE INDEX IF NOT EXISTS idx_emotions_created_at ON emotions(created_at DESC)")
    op.execute("CREATE INDEX IF NOT EXISTS idx_emotions_user_id ON emotions(user_id)")
    op.execute("CREATE INDEX IF NOT EXISTS idx_likes_emotion_id ON likes(emotion_id)")
    op.execute("CREATE INDEX IF NOT EXISTS idx_notifications_user_id ON notifications(user_id, read)")
    op.execute("CREATE INDEX IF NOT EXISTS idx_comments_emotion_id ON comments(emotion_id)")
    op.execute("CREATE INDEX IF NOT EXISTS idx_follows_following_id ON follows(following_id)")
    op.execute("""
        CREATE INDEX IF NOT EXISTS idx_emotions_search ON emotions
        USING GIN (to_tsvector('simple',
            COALESCE(emotion_type, '') || ' ' || COALESCE(username, '')
        ))
    """)
    op.execute("""
        DO $$ BEGIN
            ALTER TABLE users ADD CONSTRAINT chk_username_len
                CHECK (LENGTH(username) >= 2 AND LENGTH(username) <= 32);
        EXCEPTION WHEN duplicate_object THEN NULL; END $$
    """)
    op.execute("""
        DO $$ BEGIN
            ALTER TABLE users ADD CONSTRAINT chk_bio_len
                CHECK (bio IS NULL OR LENGTH(bio) <= 160);
        EXCEPTION WHEN duplicate_object THEN NULL; END $$
    """)
    op.execute("""
        DO $$ BEGIN
            ALTER TABLE emotions ADD CONSTRAINT chk_emotion_type_len
                CHECK (emotion_type IS NULL OR LENGTH(emotion_type) <= 64);
        EXCEPTION WHEN duplicate_object THEN NULL; END $$
    """)
    op.execute("""
        DO $$ BEGIN
            ALTER TABLE comments ADD CONSTRAINT chk_comment_text_len
                CHECK (LENGTH(text) >= 1 AND LENGTH(text) <= 280);
        EXCEPTION WHEN duplicate_object THEN NULL; END $$
    """)


def downgrade() -> None:
    op.execute("DROP TABLE IF EXISTS comments")
    op.execute("DROP TABLE IF EXISTS notifications")
    op.execute("DROP TABLE IF EXISTS follows")
    op.execute("DROP TABLE IF EXISTS likes")
    op.execute("DROP TABLE IF EXISTS emotions")
    op.execute("DROP TABLE IF EXISTS users")
