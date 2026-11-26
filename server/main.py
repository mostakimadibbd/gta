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

app = FastAPI(title="Harborfall Multiplayer API", version="3.0.0")
ROOMS: dict[str, dict[str, WebSocket]] = {}
PLAYER_STATES: dict[str, dict[str, dict[str, Any]]] = {}
PLAYER_NAMES: dict[str, dict[str, str]] = {}
CLIENTS: dict[WebSocket, tuple[str, str]] = {}
LAST_STATE: dict[tuple[str, str], tuple[float, list[float]]] = {}
# Phase 38: per-player chat rate limit anchor (accepted chats only —
# a rejected-fast chat must not extend its own lockout).
# Phase 39: keyed by PLAYER ID across rooms, and never cleared on
# join/leave. Phase 38 keyed it (room, player) and cleared it on
# join, so the limit reset every time a client re-sent join —
# which it may do freely on the same socket — or hopped rooms:
# the anti-spam limit was decorative against exactly the client
# it existed for. Entries are pruned lazily once expired (see
# the chat handler), so the dict stays bounded without a sweeper.
LAST_CHAT: dict[str, float] = {}
# Phase 38: a join that names no room lands here. Until this phase a
# roomless join minted a random room, so two old clients that both
# omitted the room could never meet; "sable" (the city's own name)
# is the shared default room. create_room still mints a fresh room —
# that is its whole job (see handle_message).
DEFAULT_ROOM = "sable"
MAX_SPEED_UNITS_PER_SEC = 40.0  # generous arcade cap (car max ~24 u/s + margin)
# World extents (client/src/world.ts, recomputed Phase 27, extended
# Phase 31): charted LAND spans x -196 (Westbrook's west shore)
# .. +126 (the Port Sable strip, |x| <= WORLD_BOUND + 8) and
# z -368 (Northreach's north shore, Phase 31) .. +324 (Coral
# Shores' south shore). The Phase 26 symmetric limits
# (|x| <= 210, |z| <= 340) covered the land but clipped the water
# right off two shores: a boat rounding Westbrook's west point rides
# at x ~ -205..-215, and one hugging Coral's south shore at
# z ~ 339+. Boats are water-only and the shoreline is the game's
# only hard edge, so the bounds are per-side: every land extent plus
# a uniform 48 units of open sea. Beyond that is off-chart water —
# state from there is not relayed (the speed check below remains
# the real anti-teleport gate).
# Phase 28 audit: the client's own envelopes were re-measured
# against these bounds — cars clamp to |x| <= 130, z -302..330 and
# the plane to |x| <= 135, z -305..335 (both inside), boats are
# clamped to the chart itself in Vehicle.tsx (Phase 28), but the
# on-foot SWIM limit is |x| < 175 (Player.tsx "sane offshore
# limit"), which poked 1 unit past WORLD_X_MAX=174 on the east:
# a swimmer at the client's own legal limit was rejected here.
# X_MAX is now 178 — the swim limit plus the usual margin.
WORLD_X_MIN, WORLD_X_MAX = -244.0, 178.0
# Phase 31: Z_MIN -348 -> -416 — Northreach pushed charted land to
# z=-368, and the uniform 48u sea margin moves with it (a boat
# rounding Northreach rides at z ~ -390..-410). The client's own
# envelopes were re-measured against the new bound: boats clamp to
# z >= -412 (Vehicle.tsx, the chart inset by 4), the swim limit to
# z > -388, cars/plane stay inside their district-grown boxes.
WORLD_Z_MIN, WORLD_Z_MAX = -416.0, 372.0


def state_plausible(room_id: str, player_id: str, state: dict[str, Any]) -> bool:
    """Reject NaN/out-of-world positions and teleports faster than MAX_SPEED.

    Keeps an honest-but-fast sanity gate: legitimate arcade movement always
    passes; a client jumping hundreds of units between 50 ms updates is
    dropped (state not stored/relayed) rather than trusted.

    The anchor (LAST_STATE) only advances on ACCEPTED states: a
    rejected teleport must not move it, or the next small hop from the
    rejected position would launder the jump (Phase 26 fix — the
    anchor previously updated before the speed check). (Re)joining a
    room resets the anchor, so a legitimate respawn is never measured
    against a stale spot (see join_room / remove_client).
    """
    import time

    position = state.get("car", {}).get("position") if state.get("car") else state.get("position")
    if not _valid_vector(position):
        return False
    x, _y, z = position
    if not (WORLD_X_MIN <= x <= WORLD_X_MAX) or not (WORLD_Z_MIN <= z <= WORLD_Z_MAX):
        return False
    key = (room_id, player_id)
    now = time.monotonic()
    last = LAST_STATE.get(key)
    if last is None:
        LAST_STATE[key] = (now, list(position))
        return True
    last_time, last_pos = last
    dt = max(now - last_time, 0.001)
    dist = math.hypot(x - last_pos[0], z - last_pos[2])
    # Small grace distance for spawn/respawn jumps.
    if dist > MAX_SPEED_UNITS_PER_SEC * dt + 6.0:
        return False
    LAST_STATE[key] = (now, list(position))
    return True
MAX_MESSAGE_SIZE = 64 * 1024
MAX_PLAYERS_PER_ROOM = 32
# Phase 38: display names + text chat limits. Names are presentation
# only — identity is still the playerId; a name can be shared, spoofed
# or changed, and nothing gameplay-side may key off it.
MAX_NAME_LENGTH = 24
CHAT_MAX_LENGTH = 200
CHAT_MIN_INTERVAL = 1.5  # seconds between accepted chats per player


def sanitize_name(value: Any) -> str:
    """A display name safe to relay: strings only, control characters
    stripped, whitespace trimmed, capped, with an honest fallback.
    Anything else (missing, non-string, all-control-chars) becomes
    "Player" — the name an old-protocol client gets too."""
    if not isinstance(value, str):
        return "Player"
    cleaned = "".join(ch for ch in value if ord(ch) >= 32 and ord(ch) != 127).strip()
    return cleaned[:MAX_NAME_LENGTH] or "Player"


def sanitize_room_code(value: Any) -> str:
    """A room code is a room id chosen by players: control characters
    stripped, whitespace trimmed. Deliberately NOT truncated — the
    caller's existing length check rejects an over-long code with the
    same error a Phase 26 client already understands. Empty -> ""
    (the caller substitutes the default/generated room)."""
    if not isinstance(value, str):
        return ""
    return "".join(ch for ch in value if ord(ch) >= 32 and ord(ch) != 127).strip()


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
    names = PLAYER_NAMES.get(room_id)
    if names is not None:
        names.pop(player_id, None)
    LAST_STATE.pop((room_id, player_id), None)  # Phase 26: no stale teleport anchor
    # Phase 39: LAST_CHAT is deliberately NOT popped here — the
    # chat rate limit follows the player id (see its declaration).
    if room:
        await broadcast(room_id, {"type": "player_left", "playerId": player_id})
    else:
        ROOMS.pop(room_id, None)
        PLAYER_STATES.pop(room_id, None)
        PLAYER_NAMES.pop(room_id, None)


async def join_room(connection: WebSocket, room_id: str, player_id: str, name: str = "Player") -> None:
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

    # Phase 26: a (re)join starts a fresh anti-teleport anchor — the
    # first state after joining is a spawn, wherever it is.
    LAST_STATE.pop((room_id, player_id), None)
    # Phase 39: no fresh chat clock on (re)join — that reset was
    # the rate-limit evasion (see LAST_CHAT).
    states = PLAYER_STATES.setdefault(room_id, {})
    names = PLAYER_NAMES.setdefault(room_id, {})
    snapshot = [
        {"playerId": existing_id, "name": names.get(existing_id, "Player"), "state": states.get(existing_id)}
        for existing_id in room
        if existing_id != player_id
    ]
    room[player_id] = connection
    names[player_id] = name
    CLIENTS[connection] = (room_id, player_id)
    await send_json(
        connection,
        {"type": "joined", "roomId": room_id, "playerId": player_id, "name": name, "players": snapshot},
    )
    await broadcast(room_id, {"type": "player_joined", "playerId": player_id, "name": name}, exclude=connection)
    logger.info("Player %s (%s) joined room %s", player_id, name, room_id)


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
        # Phase 38: the room may arrive as the Phase 26 "roomId" or as
        # the new "room" code (the MP panel's room-code field sends
        # both, same value; the code wins if they ever differ). A
        # "join" naming no room lands in the DEFAULT_ROOM; a
        # "create_room" naming no room still mints a fresh one —
        # creating a private room is its explicit purpose, and the
        # Phase 26 test pins that behaviour.
        raw_room = payload.get("room")
        if raw_room is None:
            raw_room = payload.get("roomId")
        room_id = sanitize_room_code(raw_room)
        if not room_id:
            room_id = uuid.uuid4().hex[:8] if message_type == "create_room" else DEFAULT_ROOM
        player_id = str(payload.get("playerId") or uuid.uuid4()).strip()
        if len(room_id) > 48 or not player_id or len(player_id) > 64:
            await send_json(connection, {"type": "error", "message": "Room or player ID is invalid."})
            return
        await join_room(connection, room_id, player_id, sanitize_name(payload.get("name")))
    elif message_type == "leave":
        await remove_client(connection)
    elif message_type == "chat":
        # Phase 38: room text chat — a dedicated message type (the
        # older event-relay "chat" event is untouched and still
        # works). Validated like everything else here: membership
        # first, then shape, then length, then the rate limit. The
        # relay carries the sender's sanitised display name and goes
        # to room peers only — never the sender, never other rooms.
        membership = CLIENTS.get(connection)
        if membership is None:
            await send_json(connection, {"type": "error", "message": "Join a room before sending chat."})
            return
        text = payload.get("text")
        if not isinstance(text, str):
            await send_json(connection, {"type": "error", "message": "Chat message must be text."})
            return
        text = "".join(ch for ch in text if ord(ch) >= 32 and ord(ch) != 127).strip()
        if not text:
            await send_json(connection, {"type": "error", "message": "Chat message is empty."})
            return
        if len(text) > CHAT_MAX_LENGTH:
            await send_json(connection, {"type": "error", "message": f"Chat message is too long ({CHAT_MAX_LENGTH} characters max)."})
            return
        room_id, player_id = membership
        import time

        now = time.monotonic()
        # Phase 39: the limiter is keyed by player id and survives
        # joins, leaves and room hops (see LAST_CHAT) — rejoining
        # cannot reset it. Expired anchors are pruned lazily here,
        # the only place the dict is written, so it cannot grow
        # without bound across a long-lived server.
        if len(LAST_CHAT) > 512:
            for pid in [p for p, t in LAST_CHAT.items() if now - t >= CHAT_MIN_INTERVAL]:
                LAST_CHAT.pop(pid, None)
        last = LAST_CHAT.get(player_id)
        if last is not None and now - last < CHAT_MIN_INTERVAL:
            await send_json(connection, {"type": "error", "message": "You're chatting too fast — give it a moment."})
            return
        LAST_CHAT[player_id] = now
        name = PLAYER_NAMES.get(room_id, {}).get(player_id, "Player")
        await broadcast(
            room_id,
            {"type": "chat", "playerId": player_id, "name": name, "text": text},
            exclude=connection,
        )
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
