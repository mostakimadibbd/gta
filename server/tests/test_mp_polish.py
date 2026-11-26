"""Phase 38 — multiplayer polish: display names, text chat, room codes.

Everything here is additive over the Phase 26 protocol: old clients
(no name, no room code) keep working, and the pre-existing suites
pass unmodified except the one player_joined assertion whose own
subject grew the name field (see test_ws_flow).
"""
import main as server
from conftest import join, make_state


def join_named(ws, room="room1", player="alice", name=None, room_field=None):
    """Join with the Phase 38 fields; returns the joined payload."""
    payload = {"type": "join", "playerId": player}
    if room is not None:
        payload["roomId"] = room
    if room_field is not None:
        payload["room"] = room_field
    if name is not None:
        payload["name"] = name
    ws.send_json(payload)
    msg = ws.receive_json()
    assert msg["type"] == "joined", msg
    return msg


# ------------------------------------------------------------------
# Display names
# ------------------------------------------------------------------

def test_sanitize_name_unit():
    s = server.sanitize_name
    assert s("Rayan") == "Rayan"
    assert s("  Harbour Fox  ") == "Harbour Fox"          # trimmed
    assert s("A\tB\nC\x00D\x7f") == "ABCD"                # control chars stripped
    assert s("x" * 40) == "x" * server.MAX_NAME_LENGTH    # capped
    assert s("") == "Player"                              # empty -> fallback
    assert s("   ") == "Player"                           # whitespace-only -> fallback
    assert s("\x01\x02") == "Player"                      # all control chars -> fallback
    assert s(None) == "Player"                            # missing -> fallback
    assert s(42) == "Player"                              # non-string -> fallback
    assert s(["Rayan"]) == "Player"


def test_join_carries_sanitized_name(client):
    with client.websocket_connect("/ws") as a:
        msg = join_named(a, name="  Cap\x07tain  ")
        assert msg["name"] == "Captain"  # sanitised server-side, echoed to the joiner


def test_snapshot_and_join_note_carry_names(client):
    with client.websocket_connect("/ws") as a, client.websocket_connect("/ws") as b:
        join_named(a, player="alice", name="Alice A.")
        second = join_named(b, player="bob", name="Bobby")
        assert second["players"][0]["playerId"] == "alice"
        assert second["players"][0]["name"] == "Alice A."
        note = a.receive_json()
        assert note == {"type": "player_joined", "playerId": "bob", "name": "Bobby"}


def test_old_client_without_name_gets_player(client):
    with client.websocket_connect("/ws") as a, client.websocket_connect("/ws") as b:
        first = join(a, player="alice")  # Phase 26 helper: no name field at all
        assert first["name"] == "Player"
        second = join(b, player="bob")
        assert second["players"][0]["name"] == "Player"


# ------------------------------------------------------------------
# Text chat
# ------------------------------------------------------------------

def test_chat_relayed_to_peers_with_name_not_sender(client):
    with client.websocket_connect("/ws") as a, client.websocket_connect("/ws") as b:
        join_named(a, player="alice", name="Alice")
        join_named(b, player="bob", name="Bob")
        a.receive_json()  # player_joined bob
        a.send_json({"type": "chat", "text": "Evening, harbour."})
        assert b.receive_json() == {
            "type": "chat", "playerId": "alice", "name": "Alice", "text": "Evening, harbour.",
        }
        # the sender is never echoed: the next thing alice can receive
        # is bob's reply
        b.send_json({"type": "chat", "text": "Evening."})
        assert a.receive_json() == {
            "type": "chat", "playerId": "bob", "name": "Bob", "text": "Evening.",
        }


def test_chat_before_join_rejected(client):
    with client.websocket_connect("/ws") as a:
        a.send_json({"type": "chat", "text": "anyone there?"})
        err = a.receive_json()
        assert err["type"] == "error"
        assert "Join a room before sending chat" in err["message"]


def test_chat_malformed_rejected_room_survives(client):
    with client.websocket_connect("/ws") as a, client.websocket_connect("/ws") as b:
        join_named(a, player="alice", name="Alice")
        join_named(b, player="bob", name="Bob")
        a.receive_json()  # player_joined bob
        for bad in ({"type": "chat"}, {"type": "chat", "text": 42},
                    {"type": "chat", "text": "   "}, {"type": "chat", "text": "\x00\x01"}):
            a.send_json(bad)
            err = a.receive_json()
            assert err["type"] == "error", bad
        # control characters are stripped from relayed text, not relayed raw
        a.send_json({"type": "chat", "text": "hel\x07lo"})
        assert b.receive_json()["text"] == "hello"


def test_chat_length_cap(client):
    with client.websocket_connect("/ws") as a, client.websocket_connect("/ws") as b:
        join_named(a, player="alice", name="Alice")
        join_named(b, player="bob", name="Bob")
        a.receive_json()  # player_joined bob
        a.send_json({"type": "chat", "text": "x" * server.CHAT_MAX_LENGTH})
        assert b.receive_json()["text"] == "x" * server.CHAT_MAX_LENGTH  # at the cap: fine
        a.send_json({"type": "chat", "text": "wait"})  # (rate-limit window — see below)
        err = a.receive_json()
        assert err["type"] == "error"  # too fast OR too long; either way rejected
        # oversize is rejected on its own merits once the clock allows
        import time
        time.sleep(0)  # no real wait: use a fresh sender instead
        with client.websocket_connect("/ws") as c:
            join_named(c, player="carol", name="Carol")
            a.receive_json()  # player_joined carol
            b.receive_json()  # player_joined carol
            c.send_json({"type": "chat", "text": "y" * (server.CHAT_MAX_LENGTH + 1)})
            err = c.receive_json()
            assert err["type"] == "error"
            assert "too long" in err["message"]


def test_chat_rate_limit_survives_rejoin(client, monkeypatch):
    # Phase 39 regression: Phase 38 cleared the limiter anchor on
    # join, and a client may re-send join freely on the same
    # socket — so "rejoin, chat, rejoin, chat" bypassed the 1.5 s
    # limit entirely. The anchor now follows the player id.
    with client.websocket_connect("/ws") as a, client.websocket_connect("/ws") as b:
        join_named(a, player="alice", name="Alice")
        join_named(b, player="bob", name="Bob")
        a.receive_json()  # player_joined bob
        a.send_json({"type": "chat", "text": "one"})
        assert b.receive_json()["text"] == "one"
        # alice re-joins the SAME room on the same socket
        join_named(a, player="alice", name="Alice")
        assert b.receive_json()["type"] == "player_left"
        assert b.receive_json()["type"] == "player_joined"
        a.send_json({"type": "chat", "text": "two"})
        err = a.receive_json()
        assert err["type"] == "error"
        assert "too fast" in err["message"]
        # bob never saw "two": once the interval is lifted, his
        # next message is alice's third chat
        monkeypatch.setattr(server, "CHAT_MIN_INTERVAL", 0.0)
        a.send_json({"type": "chat", "text": "three"})
        assert b.receive_json()["text"] == "three"


def test_chat_rate_limit_follows_player_across_rooms(client, monkeypatch):
    # Phase 39: the limiter is keyed by player id, not (room,
    # player) — hopping rooms is not a reset either.
    with client.websocket_connect("/ws") as a, client.websocket_connect("/ws") as c:
        join_named(a, room="alpha", player="alice", name="Alice")
        join_named(c, room="beta", player="carol", name="Carol")
        a.send_json({"type": "chat", "text": "alpha hello"})  # accepted (no peers needed)
        join_named(a, room="beta", player="alice", name="Alice")
        assert c.receive_json()["type"] == "player_joined"
        a.send_json({"type": "chat", "text": "beta hello"})
        err = a.receive_json()
        assert err["type"] == "error"
        assert "too fast" in err["message"]
        monkeypatch.setattr(server, "CHAT_MIN_INTERVAL", 0.0)
        a.send_json({"type": "chat", "text": "beta hello"})
        assert c.receive_json()["text"] == "beta hello"


def test_chat_rate_limit(client, monkeypatch):
    with client.websocket_connect("/ws") as a, client.websocket_connect("/ws") as b:
        join_named(a, player="alice", name="Alice")
        join_named(b, player="bob", name="Bob")
        a.receive_json()  # player_joined bob
        a.send_json({"type": "chat", "text": "one"})
        assert b.receive_json()["text"] == "one"
        a.send_json({"type": "chat", "text": "two"})
        err = a.receive_json()
        assert err["type"] == "error"
        assert "too fast" in err["message"]
        # bob received nothing for the rejected message: his next
        # message is alice's third, once the interval is lifted
        monkeypatch.setattr(server, "CHAT_MIN_INTERVAL", 0.0)
        a.send_json({"type": "chat", "text": "three"})
        assert b.receive_json()["text"] == "three"


# ------------------------------------------------------------------
# Room codes
# ------------------------------------------------------------------

def test_join_without_room_lands_in_default(client):
    with client.websocket_connect("/ws") as a:
        a.send_json({"type": "join", "playerId": "alice"})
        msg = a.receive_json()
        assert msg["type"] == "joined"
        assert msg["roomId"] == server.DEFAULT_ROOM == "sable"


def test_roomless_clients_meet_in_default_room(client):
    with client.websocket_connect("/ws") as a, client.websocket_connect("/ws") as b:
        a.send_json({"type": "join", "playerId": "alice"})
        a.receive_json()
        b.send_json({"type": "join", "playerId": "bob"})
        second = b.receive_json()
        assert [p["playerId"] for p in second["players"]] == ["alice"]
        assert a.receive_json()["type"] == "player_joined"


def test_room_field_is_the_room_code(client):
    with client.websocket_connect("/ws") as a:
        msg = join_named(a, room=None, room_field="harbour-north")
        assert msg["roomId"] == "harbour-north"


def test_rooms_are_isolated(client):
    with client.websocket_connect("/ws") as a, client.websocket_connect("/ws") as b, \
            client.websocket_connect("/ws") as c:
        join_named(a, room="alpha", player="alice", name="Alice")
        join_named(b, room="beta", player="bob", name="Bob")
        # bob's snapshot is empty: alice is in another room
        # (re-join check via health: one player per room)
        health = client.get("/health").json()
        assert health["roomDetail"] == {"alpha": 1, "beta": 1}
        # state and chat from alpha never reach beta: carol joins
        # alpha and receives both; bob's next message is carol-free
        join_named(c, room="alpha", player="carol", name="Carol")
        note = a.receive_json()
        assert note["playerId"] == "carol"
        a.send_json({"type": "state", "state": make_state(1.0, 1.0)})
        assert c.receive_json()["type"] == "state"
        a.send_json({"type": "chat", "text": "alpha only"})
        assert c.receive_json()["text"] == "alpha only"
        # bob sends state in beta; if anything had leaked to him it
        # would arrive before his own room's traffic — he gets only
        # silence-equivalent: his own join produced nothing further,
        # so a state from a NEW beta member is his first message.
        with client.websocket_connect("/ws") as d:
            join_named(d, room="beta", player="dana", name="Dana")
            first_for_bob = b.receive_json()
            assert first_for_bob == {"type": "player_joined", "playerId": "dana", "name": "Dana"}


def test_room_code_sanitized_and_validated(client):
    with client.websocket_connect("/ws") as a:
        a.send_json({"type": "join", "room": "r" * 49, "playerId": "alice"})
        err = a.receive_json()
        assert err["type"] == "error"
        assert "invalid" in err["message"]
        # control characters in a code are stripped, not fatal
        msg = join_named(a, room=None, room_field="  my\x07room  ")
        assert msg["roomId"] == "myroom"
