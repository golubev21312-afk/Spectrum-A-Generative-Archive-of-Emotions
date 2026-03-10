"""
Integration tests for the Spectrum API.
Run with:  cd backend && pytest tests/ -v
Requires a running PostgreSQL instance (the same dev DB is fine).
"""
import uuid
import pytest
import httpx

pytestmark = pytest.mark.anyio

# ── Auth ─────────────────────────────────────────────────────────────────────

async def test_register_success(client: httpx.AsyncClient):
    username = f"tst_{uuid.uuid4().hex[:8]}"
    r = await client.post("/register", json={"username": username, "password": "Pass123!"})
    assert r.status_code == 200
    body = r.json()
    assert body["username"] == username
    assert "id" in body


async def test_register_duplicate(client: httpx.AsyncClient, registered_user):
    r = await client.post(
        "/register",
        json={"username": registered_user["username"], "password": "whatever"},
    )
    assert r.status_code == 409


async def test_login_success(client: httpx.AsyncClient, registered_user):
    r = await client.post(
        "/login",
        json={"username": registered_user["username"], "password": registered_user["password"]},
    )
    assert r.status_code == 200
    assert "token" in r.json()


async def test_login_wrong_password(client: httpx.AsyncClient, registered_user):
    r = await client.post(
        "/login",
        json={"username": registered_user["username"], "password": "wrong"},
    )
    assert r.status_code == 401


# ── Emotions CRUD ─────────────────────────────────────────────────────────────

PARAMS = {
    "hue": 200, "transparency": 0.3, "rotationSpeed": 1.5,
    "noiseAmplitude": 0.6, "particleDensity": 150,
}


async def test_create_emotion_requires_auth(client: httpx.AsyncClient):
    r = await client.post("/emotions", json={"parameters": PARAMS, "emotion_type": "Calm"})
    assert r.status_code == 401


async def test_create_emotion(client: httpx.AsyncClient, auth_headers):
    r = await client.post(
        "/emotions",
        json={"parameters": PARAMS, "emotion_type": "Calm"},
        headers=auth_headers,
    )
    assert r.status_code == 201
    assert "id" in r.json()


async def test_get_emotion(client: httpx.AsyncClient, sample_emotion):
    r = await client.get(f"/emotions/{sample_emotion}")
    assert r.status_code == 200
    body = r.json()
    assert body["id"] == sample_emotion
    assert "parameters" in body
    assert body["views"] >= 1  # view counter incremented


async def test_get_emotion_increments_views(client: httpx.AsyncClient, sample_emotion):
    r1 = await client.get(f"/emotions/{sample_emotion}")
    r2 = await client.get(f"/emotions/{sample_emotion}")
    assert r2.json()["views"] > r1.json()["views"]


async def test_get_nonexistent_emotion(client: httpx.AsyncClient):
    r = await client.get("/emotions/999999999")
    assert r.status_code == 404


async def test_get_feed(client: httpx.AsyncClient, sample_emotion):
    r = await client.get("/emotions")
    assert r.status_code == 200
    body = r.json()
    assert "items" in body
    assert "total" in body
    assert isinstance(body["items"], list)


async def test_feed_sort_popular(client: httpx.AsyncClient, sample_emotion):
    r = await client.get("/emotions?sort=popular")
    assert r.status_code == 200


async def test_feed_sort_trending(client: httpx.AsyncClient, sample_emotion):
    r = await client.get("/emotions?sort=trending")
    assert r.status_code == 200


async def test_feed_search(client: httpx.AsyncClient, sample_emotion):
    r = await client.get("/emotions?q=Calm")
    assert r.status_code == 200


async def test_feed_today(client: httpx.AsyncClient, sample_emotion):
    r = await client.get("/emotions?sort=trending&period=today&limit=5")
    assert r.status_code == 200


async def test_delete_emotion(client: httpx.AsyncClient, auth_headers, registered_user):
    # Create a fresh emotion to delete
    r = await client.post(
        "/emotions",
        json={"parameters": PARAMS, "emotion_type": "Joy"},
        headers=auth_headers,
    )
    eid = r.json()["id"]
    d = await client.delete(f"/emotions/{eid}", headers=auth_headers)
    assert d.status_code == 200
    # Should be gone
    r2 = await client.get(f"/emotions/{eid}")
    assert r2.status_code == 404


async def test_delete_emotion_forbidden(client: httpx.AsyncClient, sample_emotion):
    # Register a second user and try to delete first user's emotion
    u2 = f"tst_{uuid.uuid4().hex[:8]}"
    await client.post("/register", json={"username": u2, "password": "P4ss!"})
    login = await client.post("/login", json={"username": u2, "password": "P4ss!"})
    token2 = login.json()["token"]
    r = await client.delete(
        f"/emotions/{sample_emotion}",
        headers={"Authorization": f"Bearer {token2}"},
    )
    assert r.status_code == 403


async def test_update_emotion_type(client: httpx.AsyncClient, auth_headers, sample_emotion):
    r = await client.patch(
        f"/emotions/{sample_emotion}/type",
        json={"emotion_type": "Joy"},
        headers=auth_headers,
    )
    assert r.status_code == 200
    # Verify
    r2 = await client.get(f"/emotions/{sample_emotion}")
    assert r2.json()["emotion_type"] == "Joy"


# ── Likes ─────────────────────────────────────────────────────────────────────

async def test_like_and_unlike(client: httpx.AsyncClient, auth_headers, sample_emotion):
    r = await client.post(f"/emotions/{sample_emotion}/like", headers=auth_headers)
    assert r.status_code in (200, 201)

    r2 = await client.get(f"/emotions/{sample_emotion}")
    assert r2.json()["likes_count"] >= 1
    assert r2.json()["liked_by_me"] is False  # anon fetch; no token → False

    # Unlike
    r3 = await client.delete(f"/emotions/{sample_emotion}/like", headers=auth_headers)
    assert r3.status_code == 200


async def test_like_requires_auth(client: httpx.AsyncClient, sample_emotion):
    r = await client.post(f"/emotions/{sample_emotion}/like")
    assert r.status_code == 401


# ── Follow ────────────────────────────────────────────────────────────────────

async def test_follow_unfollow(client: httpx.AsyncClient, registered_user):
    # Create a target user
    target = f"tst_{uuid.uuid4().hex[:8]}"
    await client.post("/register", json={"username": target, "password": "P4ss!"})

    headers = {"Authorization": f"Bearer {registered_user['token']}"}
    r = await client.post(f"/users/{target}/follow", headers=headers)
    assert r.status_code in (200, 201)

    # Profile should show is_following=True
    prof = await client.get(f"/users/{target}", headers=headers)
    assert prof.json()["is_following"] is True

    r2 = await client.delete(f"/users/{target}/follow", headers=headers)
    assert r2.status_code == 200


# ── Profile & Bio ─────────────────────────────────────────────────────────────

async def test_get_profile(client: httpx.AsyncClient, registered_user, sample_emotion):
    r = await client.get(f"/users/{registered_user['username']}")
    assert r.status_code == 200
    body = r.json()
    assert body["username"] == registered_user["username"]
    assert "emotions" in body
    assert "emotion_count" in body


async def test_update_bio(client: httpx.AsyncClient, registered_user, auth_headers):
    r = await client.patch(
        f"/users/{registered_user['username']}/bio",
        json={"bio": "Hello, world!"},
        headers=auth_headers,
    )
    assert r.status_code == 200
    prof = await client.get(f"/users/{registered_user['username']}")
    assert prof.json()["bio"] == "Hello, world!"


# ── Comments ──────────────────────────────────────────────────────────────────

async def test_add_and_list_comments(client: httpx.AsyncClient, auth_headers, sample_emotion):
    r = await client.post(
        f"/emotions/{sample_emotion}/comments",
        json={"text": "Great emotion!"},
        headers=auth_headers,
    )
    assert r.status_code == 201

    r2 = await client.get(f"/emotions/{sample_emotion}/comments")
    assert r2.status_code == 200
    comments = r2.json()
    assert any(c["text"] == "Great emotion!" for c in comments)


async def test_comment_requires_auth(client: httpx.AsyncClient, sample_emotion):
    r = await client.post(
        f"/emotions/{sample_emotion}/comments",
        json={"text": "nope"},
    )
    assert r.status_code == 401


# ── Random Emotion ────────────────────────────────────────────────────────────

async def test_get_random_emotion(client: httpx.AsyncClient, sample_emotion):
    r = await client.get("/emotions/random")
    assert r.status_code == 200
    assert "parameters" in r.json()
