from __future__ import annotations

import asyncio
import json
import logging
import math
import os
import uuid
from typing import Any

from fastapi import FastAPI, WebSocket, WebSocketDisconnect

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")
logger = logging.getLogger("harborfall-server")

app = FastAPI(title="Harborfall Multiplayer API", version="2.0.0")
ROOMS: dict[str, dict[str, WebSocket]] = {}
PLAYER_STATES: dict[str, dict[str, dict[str, Any]]] = {}
CLIENTS: dict[WebSocket, tuple[str, str]] = {}
LAST_STATE: dict[tuple[str, str], tuple[float, list[float]]] = {}
MAX_SPEED_UNITS_PER_SEC = 40.0  # generous arcade cap (car max ~24 u/s + margin)
WORLD_LIMIT = 150.0


def state_plausible(room_id: str, player_id: str, state: dict[str, Any]) -> bool:
    """Reject NaN/out-of-world positions and teleports faster than MAX_SPEED.

    Keeps an honest-but-fast sanity gate: legitimate arcade movement always
    passes; a client jumping hundreds of units between 50 ms updates is
    dropped (state not stored/relayed) rather than trusted.
    """
    import time

    position = state.get("car", {}).get("position") if state.get("car") else state.get("position")
    if not _valid_vector(position):
        return False
    x, _y, z = position
    if abs(x) > WORLD_LIMIT or abs(z) > WORLD_LIMIT:
        return False
    key = (room_id, player_id)
    now = time.monotonic()
    last = LAST_STATE.get(key)
    LAST_STATE[key] = (now, list(position))
    if last is None:
        return True
    last_time, last_pos = last
    dt = max(now - last_time, 0.001)
    dist = math.hypot(x - last_pos[0], z - last_pos[2])
    # Small grace distance for spawn/respawn jumps.
    return dist <= MAX_SPEED_UNITS_PER_SEC * dt + 6.0
MAX_MESSAGE_SIZE = 64 * 1024
MAX_PLAYERS_PER_ROOM = 32


@app.get("/")
async def index() -> dict[str, str]:
    return {"service": "harborfall-multiplayer", "status": "ok", "websocket": "/ws"}


@app.get("/health")
async def health() -> dict[str, Any]:
    return {
        "status": "ok",
        "game": "harborfall",
        "rooms": len(ROOMS),
        "players": sum(len(members) for members in ROOMS.values()),
        "roomDetail": {room_id: len(members) for room_id, members in ROOMS.items()},
    }


async def send_json(connection: WebSocket, payload: dict[str, Any]) -> None:
    await connection.send_json(payload)


async def broadcast(
    room_id: str,
    payload: dict[str, Any],
    exclude: WebSocket | None = None,
) -> None:
    members = ROOMS.get(room_id, {})
    recipients = [client for client in members.values() if client is not exclude]
    if not recipients:
        return
    results = await asyncio.gather(
        *(send_json(client, payload) for client in recipients),
        return_exceptions=True,
    )
    for recipient, result in zip(recipients, results):
        if isinstance(result, Exception):
            logger.warning("Could not send update to a room member: %s", result)
            await remove_client(recipient)


async def remove_client(connection: WebSocket) -> None:
    membership = CLIENTS.pop(connection, None)
    if membership is None:
        return
    room_id, player_id = membership
    room = ROOMS.get(room_id)
    if room is None:
        return
    room.pop(player_id, None)
    states = PLAYER_STATES.get(room_id)
    if states is not None:
        states.pop(player_id, None)
    if room:
        await broadcast(room_id, {"type": "player_left", "playerId": player_id})
    else:
        ROOMS.pop(room_id, None)
        PLAYER_STATES.pop(room_id, None)


async def join_room(connection: WebSocket, room_id: str, player_id: str) -> None:
    old_membership = CLIENTS.get(connection)
    if old_membership is not None:
        await remove_client(connection)

    room = ROOMS.setdefault(room_id, {})
    if player_id in room and room[player_id] is not connection:
        await send_json(connection, {"type": "error", "message": "That player ID is already in this room."})
        return
    if len(room) >= MAX_PLAYERS_PER_ROOM and player_id not in room:
        await send_json(connection, {"type": "error", "message": "This room is full."})
        return

    states = PLAYER_STATES.setdefault(room_id, {})
    snapshot = [
        {"playerId": existing_id, "state": states.get(existing_id)}
        for existing_id in room
        if existing_id != player_id
    ]
    room[player_id] = connection
    CLIENTS[connection] = (room_id, player_id)
    await send_json(
        connection,
        {"type": "joined", "roomId": room_id, "playerId": player_id, "players": snapshot},
    )
    await broadcast(room_id, {"type": "player_joined", "playerId": player_id}, exclude=connection)
    logger.info("Player %s joined room %s", player_id, room_id)


def _valid_vector(value: Any) -> bool:
    return (
        isinstance(value, list)
        and len(value) == 3
        and all(
            isinstance(component, (int, float))
            and not isinstance(component, bool)
            and math.isfinite(component)
            for component in value
        )
    )


def valid_state(state: Any) -> bool:
    if not isinstance(state, dict):
        return False
    if not _valid_vector(state.get("position")) or not _valid_vector(state.get("rotation")):
        return False
    car = state.get("car")
    if car is None:
        return True
    return (
        isinstance(car, dict)
        and _valid_vector(car.get("position"))
        and _valid_vector(car.get("rotation"))
    )


async def handle_message(connection: WebSocket, raw_message: str) -> None:
    try:
        payload = json.loads(raw_message)
    except json.JSONDecodeError:
        await send_json(connection, {"type": "error", "message": "Message must be valid JSON."})
        return
    if not isinstance(payload, dict):
        await send_json(connection, {"type": "error", "message": "Message must be a JSON object."})
        return

    message_type = payload.get("type")
    if message_type in ("create_room", "join"):
        room_id = str(payload.get("roomId") or uuid.uuid4().hex[:8]).strip()
        player_id = str(payload.get("playerId") or uuid.uuid4()).strip()
        if not room_id or len(room_id) > 48 or not player_id or len(player_id) > 64:
            await send_json(connection, {"type": "error", "message": "Room or player ID is invalid."})
            return
        await join_room(connection, room_id, player_id)
    elif message_type == "leave":
        await remove_client(connection)
    elif message_type == "state":
        membership = CLIENTS.get(connection)
        if membership is None:
            await send_json(connection, {"type": "error", "message": "Join a room before sending state."})
            return
        state = payload.get("state")
        if not valid_state(state):
            await send_json(connection, {"type": "error", "message": "Player state has an invalid shape."})
            return
        room_id, player_id = membership
        if not state_plausible(room_id, player_id, state):
            await send_json(connection, {"type": "error", "message": "State rejected: implausible movement (speed/teleport check)."})
            return
        PLAYER_STATES.setdefault(room_id, {})[player_id] = state
        await broadcast(
            room_id,
            {"type": "state", "playerId": player_id, "state": state},
            exclude=connection,
        )
    elif message_type == "event":
        membership = CLIENTS.get(connection)
        if membership is None:
            await send_json(connection, {"type": "error", "message": "Join a room before sending events."})
            return
        event = str(payload.get("event") or "")[:32]
        data = payload.get("data")
        if event not in ("crime", "mission", "wanted", "chat") or not isinstance(data, dict):
            await send_json(connection, {"type": "error", "message": "Unknown or malformed event."})
            return
        # Clamp relayed numbers so a client cannot spoof absurd values.
        clean: dict[str, Any] = {}
        for key, value in list(data.items())[:8]:
            if isinstance(value, (int, float)) and not isinstance(value, bool) and math.isfinite(value):
                clean[str(key)[:24]] = max(-1_000_000, min(1_000_000, value))
            elif isinstance(value, str):
                clean[str(key)[:24]] = value[:80]
        room_id, player_id = membership
        await broadcast(
            room_id,
            {"type": "event", "playerId": player_id, "event": event, "data": clean},
            exclude=connection,
        )
    else:
        await send_json(connection, {"type": "error", "message": "Unknown message type."})


# =====================================================================
# Phase 8 services (Python growth): leaderboards + economy snapshots.
# Same discipline as the WS layer — no framework magic, every input
# validated and clamped, state in memory with a JSON file on disk.
# Auth: the WS service is open-but-validated; these endpoints follow
# suit, and additionally honour HARBORFALL_SERVICE_TOKEN when the host
# sets it (header X-Service-Token required, else 401).
# =====================================================================
from fastapi import Header, HTTPException, Request

DATA_DIR = os.getenv("HARBORFALL_DATA_DIR", os.path.join(os.path.dirname(__file__), "data"))
BOARD_FILE = os.path.join(DATA_DIR, "leaderboards.json")
ECON_FILE = os.path.join(DATA_DIR, "economy.json")
BOARDS: dict[str, dict[str, Any]] = {}   # player -> {race_best, job_earned, updated}
ECON: dict[str, dict[str, Any]] = {}     # player -> {latest, audit: [...]}


def _load_json(path: str) -> dict[str, Any]:
    try:
        with open(path, encoding="utf-8") as fh:
            data = json.load(fh)
        return data if isinstance(data, dict) else {}
    except (OSError, json.JSONDecodeError):
        return {}


def _save_json(path: str, data: dict[str, Any]) -> None:
    try:
        os.makedirs(DATA_DIR, exist_ok=True)
        with open(path, "w", encoding="utf-8") as fh:
            json.dump(data, fh)
    except OSError as exc:  # persistence is best-effort; memory stays true
        logger.warning("Could not persist %s: %s", path, exc)


BOARDS.update(_load_json(BOARD_FILE))
ECON.update(_load_json(ECON_FILE))


def _check_token(x_service_token: str | None) -> None:
    expected = os.getenv("HARBORFALL_SERVICE_TOKEN")
    if expected and x_service_token != expected:
        raise HTTPException(status_code=401, detail="service token required")


def _clean_name(value: Any) -> str:
    return str(value or "player")[:32].strip() or "player"


def _clean_num(value: Any, lo: float, hi: float) -> float | None:
    if isinstance(value, (int, float)) and not isinstance(value, bool) and math.isfinite(value):
        return max(lo, min(hi, float(value)))
    return None


@app.post("/v1/leaderboards")
async def post_leaderboard(req: Request, x_service_token: str | None = Header(default=None)) -> dict[str, Any]:
    _check_token(x_service_token)
    body = await req.json() if req.headers.get("content-type", "").startswith("application/json") else {}
    if not isinstance(body, dict):
        raise HTTPException(status_code=400, detail="JSON object required")
    player = _clean_name(body.get("player"))
    entry = BOARDS.setdefault(player, {"race_best": None, "job_earned": 0})
    race_best = _clean_num(body.get("race_best"), 5, 3600)
    if race_best is not None and (entry["race_best"] is None or race_best < entry["race_best"]):
        entry["race_best"] = race_best
    job_earned = _clean_num(body.get("job_earned"), 0, 100_000_000)
    if job_earned is not None:
        entry["job_earned"] = max(entry["job_earned"], job_earned)
    import time as _t
    entry["updated"] = int(_t.time())
    _save_json(BOARD_FILE, BOARDS)
    return {"ok": True, "player": player, "entry": entry}


@app.get("/v1/leaderboards")
async def get_leaderboards() -> dict[str, Any]:
    racers = sorted(
        ({"name": n, "value": e["race_best"]} for n, e in BOARDS.items() if e.get("race_best")),
        key=lambda r: r["value"],
    )[:10]
    earners = sorted(
        ({"name": n, "value": e["job_earned"]} for n, e in BOARDS.items() if e.get("job_earned")),
        key=lambda r: -r["value"],
    )[:10]
    return {"race": racers, "jobs": earners}


@app.post("/v1/economy/snapshot")
async def post_economy(req: Request, x_service_token: str | None = Header(default=None)) -> dict[str, Any]:
    _check_token(x_service_token)
    body = await req.json() if req.headers.get("content-type", "").startswith("application/json") else {}
    if not isinstance(body, dict):
        raise HTTPException(status_code=400, detail="JSON object required")
    player = _clean_name(body.get("player"))
    owned = body.get("owned")
    owned = [str(x)[:24] for x in owned[:8]] if isinstance(owned, list) else []
    import time as _t
    snap = {
        "ts": int(_t.time()),
        "room": _clean_name(body.get("room")) if body.get("room") else "offline",
        "owned": owned,
        "apartment": bool(body.get("apartment")),
        "day": int(_clean_num(body.get("day"), 0, 100000) or 0),
        "daily_income": int(_clean_num(body.get("daily_income"), 0, 100000) or 0),
    }
    record = ECON.setdefault(player, {"latest": None, "audit": []})
    record["latest"] = snap
    record["audit"] = (record["audit"] + [snap])[-200:]  # audit trail, capped
    _save_json(ECON_FILE, ECON)
    return {"ok": True, "player": player, "snapshot": snap}


@app.get("/v1/economy/snapshot")
async def get_economy(player: str = "player") -> dict[str, Any]:
    record = ECON.get(_clean_name(player))
    if record is None:
        return {"player": player, "latest": None, "audit": []}
    return {"player": player, "latest": record["latest"], "audit": record["audit"][-20:]}


@app.websocket("/ws")
async def websocket_endpoint(connection: WebSocket) -> None:
    await connection.accept()
    try:
        while True:
            message = await connection.receive_text()
            if len(message.encode("utf-8")) > MAX_MESSAGE_SIZE:
                await send_json(connection, {"type": "error", "message": "Message exceeds the size limit."})
                continue
            await handle_message(connection, message)
    except WebSocketDisconnect:
        pass
    finally:
        await remove_client(connection)


def main() -> None:
    import uvicorn

    uvicorn.run(
        app,
        host=os.getenv("HOST", "0.0.0.0"),
        port=int(os.getenv("PORT", "8765")),
    )


if __name__ == "__main__":
    main()
