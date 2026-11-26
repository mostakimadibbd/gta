"""Malformed-input handling: the server answers with an error and
neither the connection nor the room is harmed."""
from conftest import join, make_state

import main as server


def test_bad_json_error_and_connection_survives(client):
    with client.websocket_connect("/ws") as a:
        a.send_text("this is not json{")
        err = a.receive_json()
        assert err["type"] == "error"
        assert "valid JSON" in err["message"]
        # same connection still works afterwards
        join(a, player="alice")


def test_non_object_json_rejected(client):
    with client.websocket_connect("/ws") as a:
        a.send_text("[1, 2, 3]")
        err = a.receive_json()
        assert err["type"] == "error"
        assert "JSON object" in err["message"]


def test_unknown_message_type(client):
    with client.websocket_connect("/ws") as a:
        a.send_json({"type": "teleport_me", "x": 1})
        err = a.receive_json()
        assert err["type"] == "error"
        assert "Unknown message type" in err["message"]


def test_invalid_room_id_rejected(client):
    with client.websocket_connect("/ws") as a:
        a.send_json({"type": "join", "roomId": "r" * 49, "playerId": "alice"})
        err = a.receive_json()
        assert err["type"] == "error"
        assert "invalid" in err["message"]


def test_state_before_join_rejected(client):
    with client.websocket_connect("/ws") as a:
        a.send_json({"type": "state", "state": make_state()})
        err = a.receive_json()
        assert err["type"] == "error"
        assert "Join a room before sending state" in err["message"]


def test_state_invalid_shapes(client):
    bad_states = [
        None,                                                        # missing
        {"rotation": [0, 0, 0], "car": None},                        # missing position
        {"position": [0, 0, 0], "car": None},                        # missing rotation
        {"position": [0, 0], "rotation": [0, 0, 0], "car": None},    # short vector
        {"position": ["0", 0, 0], "rotation": [0, 0, 0], "car": None},  # strings
        {"position": [True, 0, 0], "rotation": [0, 0, 0], "car": None},  # bool is not a number
        {"position": [0, 0, 0], "rotation": [0, 0, 0],
         "car": {"position": [0, 0], "rotation": [0, 0, 0]}},        # bad car vector
        {"position": [0, 0, 0], "rotation": [0, 0, 0], "car": "yes"},   # car not an object
    ]
    with client.websocket_connect("/ws") as a:
        join(a, player="alice")
        for bad in bad_states:
            a.send_json({"type": "state", "state": bad})
            err = a.receive_json()
            assert err["type"] == "error", bad
            assert "invalid shape" in err["message"], bad
        # and a well-formed state still goes through afterwards
        a.send_json({"type": "state", "state": make_state(1.0, 1.0)})


def test_nan_position_rejected(client):
    # Python's json accepts NaN literals; the vector check must not
    with client.websocket_connect("/ws") as a:
        join(a, player="alice")
        a.send_text('{"type": "state", "state": {"position": [NaN, 0, 0], "rotation": [0, 0, 0], "car": null}}')
        err = a.receive_json()
        assert err["type"] == "error"
        assert "invalid shape" in err["message"]


def test_event_before_join_rejected(client):
    with client.websocket_connect("/ws") as a:
        a.send_json({"type": "event", "event": "chat", "data": {"msg": "hi"}})
        err = a.receive_json()
        assert err["type"] == "error"
        assert "Join a room before sending events" in err["message"]


def test_unknown_event_rejected(client):
    with client.websocket_connect("/ws") as a:
        join(a, player="alice")
        a.send_json({"type": "event", "event": "spawn_money", "data": {}})
        err = a.receive_json()
        assert err["type"] == "error"
        assert "Unknown or malformed event" in err["message"]
        a.send_json({"type": "event", "event": "chat", "data": "not-a-dict"})
        err = a.receive_json()
        assert err["type"] == "error"


def test_event_relay_clamps_data(client):
    with client.websocket_connect("/ws") as a, client.websocket_connect("/ws") as b:
        join(a, player="alice")
        join(b, player="bob")
        a.receive_json()  # player_joined bob
        a.send_json({"type": "event", "event": "chat",
                     "data": {"msg": "x" * 200, "score": 5_000_000_000}})
        relayed = b.receive_json()
        assert relayed["type"] == "event"
        assert relayed["playerId"] == "alice"
        assert relayed["event"] == "chat"
        assert relayed["data"]["msg"] == "x" * 80        # strings truncated
        assert relayed["data"]["score"] == 1_000_000     # numbers clamped


def test_oversize_message_rejected_connection_survives(client):
    with client.websocket_connect("/ws") as a, client.websocket_connect("/ws") as b:
        join(a, player="alice")
        join(b, player="bob")
        a.receive_json()  # player_joined bob
        a.send_text("x" * (server.MAX_MESSAGE_SIZE + 1))
        err = a.receive_json()
        assert err["type"] == "error"
        assert "size limit" in err["message"]
        # the room is unharmed: alice can still relay state
        state = make_state(2.0, 2.0)
        a.send_json({"type": "state", "state": state})
        assert b.receive_json() == {"type": "state", "playerId": "alice", "state": state}
