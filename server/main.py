from __future__ import annotations

import asyncio
import json
import logging
import os
import uuid
from typing import Any

from websockets.asyncio.server import ServerConnection, serve
from websockets.exceptions import ConnectionClosed

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")
logger = logging.getLogger("gta-server")

ROOMS: dict[str, dict[str, ServerConnection]] = {}
CLIENTS: dict[ServerConnection, tuple[str, str]] = {}
MAX_MESSAGE_SIZE = 64 * 1024


async def send_json(connection: ServerConnection, payload: dict[str, Any]) -> None:
    await connection.send(json.dumps(payload, separators=(",", ":")))


async def broadcast(room_id: str, payload: dict[str, Any], exclude: ServerConnection | None = None) -> None:
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


async def remove_client(connection: ServerConnection) -> None:
    membership = CLIENTS.pop(connection, None)
    if membership is None:
        return
    room_id, player_id = membership
    room = ROOMS.get(room_id)
    if room is not None:
        room.pop(player_id, None)
        if room:
            await broadcast(room_id, {"type": "player_left", "playerId": player_id})
        else:
            ROOMS.pop(room_id, None)


async def join_room(connection: ServerConnection, room_id: str, player_id: str) -> None:
    old_membership = CLIENTS.get(connection)
    if old_membership is not None:
        await remove_client(connection)

    room = ROOMS.setdefault(room_id, {})
    if player_id in room and room[player_id] is not connection:
        await send_json(connection, {"type": "error", "message": "That player ID is already in this room."})
        return

    snapshot = [{"playerId": existing_id} for existing_id in room if existing_id != player_id]
    room[player_id] = connection
    CLIENTS[connection] = (room_id, player_id)
    await send_json(connection, {"type": "joined", "roomId": room_id, "playerId": player_id, "players": snapshot})
    await broadcast(room_id, {"type": "player_joined", "playerId": player_id}, exclude=connection)
    logger.info("Player %s joined room %s", player_id, room_id)


def valid_state(state: Any) -> bool:
    if not isinstance(state, dict):
        return False
    for key in ("position", "rotation"):
        value = state.get(key)
        if not isinstance(value, list) or len(value) != 3:
            return False
        if not all(isinstance(component, (int, float)) for component in value):
            return False
    car = state.get("car")
    if car is not None:
        if not isinstance(car, dict):
            return False
        for key in ("position", "rotation"):
            value = car.get(key)
            if not isinstance(value, list) or len(value) != 3:
                return False
            if not all(isinstance(component, (int, float)) for component in value):
                return False
    return True


async def handler(connection: ServerConnection) -> None:
    try:
        async for message in connection:
            try:
                payload = json.loads(message)
            except json.JSONDecodeError:
                await send_json(connection, {"type": "error", "message": "Message must be valid JSON."})
                continue
            if not isinstance(payload, dict):
                await send_json(connection, {"type": "error", "message": "Message must be a JSON object."})
                continue

            message_type = payload.get("type")
            if message_type in ("create_room", "join"):
                room_id = str(payload.get("roomId") or uuid.uuid4().hex[:8]).strip()
                player_id = str(payload.get("playerId") or uuid.uuid4()).strip()
                if not room_id or len(room_id) > 48 or not player_id or len(player_id) > 64:
                    await send_json(connection, {"type": "error", "message": "Room or player ID is invalid."})
                    continue
                await join_room(connection, room_id, player_id)
            elif message_type == "leave":
                await remove_client(connection)
            elif message_type == "state":
                membership = CLIENTS.get(connection)
                if membership is None:
                    await send_json(connection, {"type": "error", "message": "Join a room before sending state."})
                    continue
                if not valid_state(payload.get("state")):
                    await send_json(connection, {"type": "error", "message": "Player state has an invalid shape."})
                    continue
                room_id, player_id = membership
                await broadcast(
                    room_id,
                    {"type": "state", "playerId": player_id, "state": payload["state"]},
                    exclude=connection,
                )
            else:
                await send_json(connection, {"type": "error", "message": "Unknown message type."})
    except ConnectionClosed:
        pass
    finally:
        await remove_client(connection)


async def main() -> None:
    host = os.getenv("HOST", "0.0.0.0")
    port = int(os.getenv("PORT", "8765"))
    async with serve(handler, host, port, max_size=MAX_MESSAGE_SIZE, ping_interval=20, ping_timeout=20):
        logger.info("WebSocket server listening on %s:%d", host, port)
        await asyncio.Future()


if __name__ == "__main__":
    try:
        asyncio.run(main())
    except KeyboardInterrupt:
        logger.info("Server stopped.")
