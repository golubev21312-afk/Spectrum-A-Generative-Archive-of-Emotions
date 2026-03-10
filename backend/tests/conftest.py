"""
Shared fixtures for Spectrum API tests.

Each test gets its own event loop (pytest-asyncio default) and its own
fresh asyncpg connection, so there are no cross-test event-loop conflicts.
"""
import uuid
import sys
import os
import pytest
import httpx
from httpx import ASGITransport

sys.path.insert(0, os.path.dirname(os.path.dirname(__file__)))
import database
from main import app


# ── Pool reset ────────────────────────────────────────────────────────────────

@pytest.fixture(autouse=True)
async def reset_db_pool():
    """Close and reset the global asyncpg pool before each test so it is
    re-created inside the current test's event loop."""
    if database.pool is not None:
        try:
            await database.pool.close()
        except Exception:
            pass
        database.pool = None
    yield
    if database.pool is not None:
        try:
            await database.pool.close()
        except Exception:
            pass
        database.pool = None


# ── HTTP client ───────────────────────────────────────────────────────────────

@pytest.fixture
async def client():
    async with httpx.AsyncClient(
        transport=ASGITransport(app=app), base_url="http://test"
    ) as c:
        yield c


# ── Auth helpers ──────────────────────────────────────────────────────────────

def unique_user():
    return f"tst_{uuid.uuid4().hex[:10]}"


@pytest.fixture
async def registered_user(client: httpx.AsyncClient):
    username = unique_user()
    password = "Test1234!"
    r = await client.post("/register", json={"username": username, "password": password})
    assert r.status_code == 200
    r2 = await client.post("/login", json={"username": username, "password": password})
    assert r2.status_code == 200
    token = r2.json()["token"]
    yield {"username": username, "password": password, "token": token}


@pytest.fixture
async def auth_headers(registered_user):
    return {"Authorization": f"Bearer {registered_user['token']}"}


@pytest.fixture
async def sample_emotion(client: httpx.AsyncClient, auth_headers):
    params = {
        "hue": 160, "transparency": 0.2, "rotationSpeed": 1.0,
        "noiseAmplitude": 0.5, "particleDensity": 200,
    }
    r = await client.post(
        "/emotions",
        json={"parameters": params, "emotion_type": "Calm"},
        headers=auth_headers,
    )
    assert r.status_code == 201
    return r.json()["id"]
