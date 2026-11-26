"""HTTP surface: root, health, leaderboards, economy snapshots."""
import time

from conftest import join


def test_root(client):
    r = client.get("/")
    assert r.status_code == 200
    body = r.json()
    assert body["service"] == "harborfall-multiplayer"
    assert body["status"] == "ok"
    assert body["websocket"] == "/ws"


def test_health_empty(client):
    r = client.get("/health")
    assert r.status_code == 200
    body = r.json()
    assert body["status"] == "ok"
    assert body["game"] == "harborfall"
    assert body["rooms"] == 0
    assert body["players"] == 0
    assert body["roomDetail"] == {}


def test_health_counts_connected_players(client):
    with client.websocket_connect("/ws") as a, client.websocket_connect("/ws") as b:
        join(a, player="alice")
        join(b, player="bob")
        a.receive_json()  # player_joined for bob
        body = client.get("/health").json()
        assert body["rooms"] == 1
        assert body["players"] == 2
        assert body["roomDetail"] == {"room1": 2}


def test_leaderboard_roundtrip_keeps_bests(client):
    r = client.post("/v1/leaderboards", json={"player": "Racer", "race_best": 95.5, "job_earned": 1200})
    assert r.status_code == 200
    assert r.json()["ok"] is True

    board = client.get("/v1/leaderboards").json()
    assert board["race"] == [{"name": "Racer", "value": 95.5}]
    assert board["jobs"] == [{"name": "Racer", "value": 1200}]

    # a worse race time must not overwrite the best; a better one must
    client.post("/v1/leaderboards", json={"player": "Racer", "race_best": 120.0})
    assert client.get("/v1/leaderboards").json()["race"][0]["value"] == 95.5
    client.post("/v1/leaderboards", json={"player": "Racer", "race_best": 90.0, "job_earned": 300})
    board = client.get("/v1/leaderboards").json()
    assert board["race"][0]["value"] == 90.0
    assert board["jobs"][0]["value"] == 1200  # earnings keep the max too


def test_leaderboard_service_token(client, monkeypatch):
    # no token configured suite-wide; this test opts in explicitly
    monkeypatch.setenv("HARBORFALL_SERVICE_TOKEN", "s3cret")
    r = client.post("/v1/leaderboards", json={"player": "Racer", "race_best": 50.0})
    assert r.status_code == 401
    r = client.post(
        "/v1/leaderboards",
        json={"player": "Racer", "race_best": 50.0},
        headers={"X-Service-Token": "s3cret"},
    )
    assert r.status_code == 200


def test_economy_snapshot_roundtrip(client):
    r = client.post(
        "/v1/economy/snapshot",
        json={"player": "Tycoon", "room": "room1", "owned": ["stall", "depot"],
              "apartment": True, "day": 12, "daily_income": 340},
    )
    assert r.status_code == 200
    snap = r.json()["snapshot"]
    assert snap["owned"] == ["stall", "depot"]
    assert snap["apartment"] is True
    assert snap["day"] == 12
    assert snap["daily_income"] == 340

    got = client.get("/v1/economy/snapshot", params={"player": "Tycoon"}).json()
    assert got["latest"] == snap
    assert len(got["audit"]) == 1

    unknown = client.get("/v1/economy/snapshot", params={"player": "Nobody"}).json()
    assert unknown["latest"] is None
    assert unknown["audit"] == []


def wait_for_players(client, want, timeout=3.0):
    deadline = time.monotonic() + timeout
    while time.monotonic() < deadline:
        if client.get("/health").json()["players"] == want:
            return True
        time.sleep(0.02)
    return False
