"""WebSocket room flow: join, snapshot, relay, leave, cleanup."""
from conftest import join, make_state
from test_http import wait_for_players


def test_join_snapshot_and_player_joined(client):
    with client.websocket_connect("/ws") as a, client.websocket_connect("/ws") as b:
        first = join(a, player="alice")
        assert first["players"] == []  # alone: empty snapshot

        second = join(b, player="bob")
        assert [p["playerId"] for p in second["players"]] == ["alice"]
        assert second["players"][0]["state"] is None  # no state sent yet

        note = a.receive_json()
        # Phase 38: the join notification's own subject grew — it now
        # carries the joiner's display name (bob sent none, so the
        # sanitised fallback "Player" rides along).
        assert note == {"type": "player_joined", "playerId": "bob", "name": "Player"}


def test_state_relayed_to_peers_not_sender(client):
    with client.websocket_connect("/ws") as a, client.websocket_connect("/ws") as b:
        join(a, player="alice")
        join(b, player="bob")
        a.receive_json()  # player_joined bob

        state = make_state(3.0, 4.0)
        a.send_json({"type": "state", "state": state})
        relayed = b.receive_json()
        assert relayed == {"type": "state", "playerId": "alice", "state": state}

        # the sender never receives its own state back: the next thing
        # alice can receive is bob's state, sent now
        b_state = make_state(-5.0, 6.0)
        b.send_json({"type": "state", "state": b_state})
        assert a.receive_json() == {"type": "state", "playerId": "bob", "state": b_state}


def test_join_snapshot_includes_peer_state(client):
    with client.websocket_connect("/ws") as a, client.websocket_connect("/ws") as b:
        join(a, player="alice")
        state = make_state(1.0, 2.0)
        a.send_json({"type": "state", "state": state})
        second = join(b, player="bob")
        assert second["players"][0]["state"] == state


def test_leave_broadcasts_player_left(client):
    with client.websocket_connect("/ws") as a, client.websocket_connect("/ws") as b:
        join(a, player="alice")
        join(b, player="bob")
        a.receive_json()  # player_joined bob
        b.send_json({"type": "leave"})
        assert a.receive_json() == {"type": "player_left", "playerId": "bob"}
        assert client.get("/health").json()["players"] == 1


def test_disconnect_cleans_up_room(client):
    with client.websocket_connect("/ws") as a:
        join(a, player="alice")
        with client.websocket_connect("/ws") as b:
            join(b, player="bob")
            a.receive_json()  # player_joined bob
        # b's socket is now closed: alice is told, then the room empties
        assert a.receive_json() == {"type": "player_left", "playerId": "bob"}
    assert wait_for_players(client, 0)
    assert client.get("/health").json()["rooms"] == 0


def test_duplicate_player_id_rejected(client):
    with client.websocket_connect("/ws") as a, client.websocket_connect("/ws") as c:
        join(a, player="alice")
        c.send_json({"type": "join", "roomId": "room1", "playerId": "alice"})
        err = c.receive_json()
        assert err["type"] == "error"
        assert "already in this room" in err["message"]
        # the rejected connection never became a member
        c.send_json({"type": "state", "state": make_state()})
        err = c.receive_json()
        assert err["type"] == "error"
        assert "Join a room before sending state" in err["message"]


def test_room_full(client, monkeypatch):
    import main as server
    monkeypatch.setattr(server, "MAX_PLAYERS_PER_ROOM", 2)
    with client.websocket_connect("/ws") as a, client.websocket_connect("/ws") as b, \
            client.websocket_connect("/ws") as c:
        join(a, player="alice")
        join(b, player="bob")
        c.send_json({"type": "join", "roomId": "room1", "playerId": "carol"})
        err = c.receive_json()
        assert err["type"] == "error"
        assert "full" in err["message"]


def test_create_room_generates_ids(client):
    with client.websocket_connect("/ws") as a:
        a.send_json({"type": "create_room"})
        msg = a.receive_json()
        assert msg["type"] == "joined"
        assert isinstance(msg["roomId"], str) and msg["roomId"]
        assert isinstance(msg["playerId"], str) and msg["playerId"]
