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
logger = logging.getLogger("gta-server")

app = FastAPI(title="City Drive Multiplayer API", version="1.0.0")
ROOMS: dict[str, dict[str, WebSocket]] = {}
PLAYER_STATES: dict[str, dict[str, dict[str, Any]]] = {}
CLIENTS: dict[WebSocket, tuple[str, str]] = {}
MAX_MESSAGE_SIZE = 64 * 1024
MAX_PLAYERS_PER_ROOM = 32


@app.get("/")
async def index() -> dict[str, str]:
    return {"service": "city-drive-multiplayer", "status": "ok", "websocket": "/ws"}


@app.get("/health")
async def health() -> dict[str, str]:
    return {"status": "ok"}


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
        PLAYER_STATES.setdefault(room_id, {})[player_id] = state
        await broadcast(
            room_id,
            {"type": "state", "playerId": player_id, "state": state},
            exclude=connection,
        )
    else:
        await send_json(connection, {"type": "error", "message": "Unknown message type."})


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
