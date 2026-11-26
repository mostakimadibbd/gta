"""Hermetic test setup for the Harborfall multiplayer server.

No network, no env secrets: the app's JSON persistence directory is
redirected to a throwaway temp dir BEFORE the app module is imported
(main.py reads HARBORFALL_DATA_DIR at import time), and no service
token is configured except in the one test that sets it explicitly
via monkeypatch. All server state is module-level dicts, reset
between tests by the autouse fixture below.
"""
import os
import sys
import tempfile

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))
os.environ["HARBORFALL_DATA_DIR"] = tempfile.mkdtemp(prefix="harborfall-test-data-")
os.environ.pop("HARBORFALL_SERVICE_TOKEN", None)

import pytest
from fastapi.testclient import TestClient

import main as server


@pytest.fixture()
def client():
    with TestClient(server.app) as c:
        yield c


@pytest.fixture(autouse=True)
def clean_state():
    server.ROOMS.clear()
    server.PLAYER_STATES.clear()
    server.PLAYER_NAMES.clear()
    server.CLIENTS.clear()
    server.LAST_STATE.clear()
    server.LAST_CHAT.clear()
    server.BOARDS.clear()
    server.ECON.clear()
    yield


def make_state(x=0.0, z=0.0, in_car=False):
    """A state payload in the exact shape the game client sends
    (client/src/App.tsx): position/rotation vectors, car null on
    foot or a {position, rotation} pair while driving."""
    state = {"position": [x, 0.0, z], "rotation": [0.0, 0.0, 0.0], "car": None}
    if in_car:
        state["car"] = {"position": [x, 0.0, z], "rotation": [0.0, 0.0, 0.0]}
    return state


def join(ws, room="room1", player="alice"):
    ws.send_json({"type": "join", "roomId": room, "playerId": player})
    msg = ws.receive_json()
    assert msg["type"] == "joined", msg
    assert msg["roomId"] == room
    assert msg["playerId"] == player
    return msg
