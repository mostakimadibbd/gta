"""The anti-teleport gate (state_plausible): legal movement passes,
teleports are dropped — and a rejected jump must not move the
anchor, or the next small hop would launder it (Phase 26 fixes,
pinned down here)."""
from contextlib import contextmanager

from conftest import join, make_state


@contextmanager
def pair(client):
    """Two joined sockets (alice, bob) with join noise drained."""
    with client.websocket_connect("/ws") as a, client.websocket_connect("/ws") as b:
        join(a, player="alice")
        join(b, player="bob")
        a.receive_json()  # player_joined bob
        yield a, b


def test_legal_moves_accepted_and_relayed(client):
    with pair(client) as (a, b):
        for x, z in [(0.0, 0.0), (3.0, 0.0), (6.0, 1.0)]:
            state = make_state(x, z)
            a.send_json({"type": "state", "state": state})
            assert b.receive_json() == {"type": "state", "playerId": "alice", "state": state}
        # no error was queued for alice either: her next inbound is bob's state
        b_state = make_state(0.0, 0.0)
        b.send_json({"type": "state", "state": b_state})
        assert a.receive_json() == {"type": "state", "playerId": "bob", "state": b_state}


def test_teleport_rejected_and_not_relayed(client):
    with pair(client) as (a, b):
        a.send_json({"type": "state", "state": make_state(0.0, 0.0)})
        b.receive_json()  # alice's spawn state

        a.send_json({"type": "state", "state": make_state(60.0, 60.0)})
        err = a.receive_json()
        assert err["type"] == "error"
        assert "implausible movement" in err["message"]

        # bob never sees the teleport: his next message is alice's
        # next LEGAL state, relayed from the unmoved anchor
        legal = make_state(2.0, 0.0)
        a.send_json({"type": "state", "state": legal})
        assert b.receive_json() == {"type": "state", "playerId": "alice", "state": legal}


def test_teleport_laundering_fails(client):
    """Regression (Phase 26): the anchor used to advance to the
    REJECTED position, so jump-then-creep passed the gate."""
    with pair(client) as (a, b):
        a.send_json({"type": "state", "state": make_state(0.0, 0.0)})
        b.receive_json()
        a.send_json({"type": "state", "state": make_state(60.0, 60.0)})
        assert a.receive_json()["type"] == "error"
        # 1 unit from the rejected spot, ~85 from the real anchor:
        # still a teleport, still rejected
        a.send_json({"type": "state", "state": make_state(61.0, 60.0)})
        err = a.receive_json()
        assert err["type"] == "error"
        assert "implausible movement" in err["message"]
        # and honest movement from the anchor still works
        legal = make_state(3.0, 0.0)
        a.send_json({"type": "state", "state": legal})
        assert b.receive_json() == {"type": "state", "playerId": "alice", "state": legal}


def test_out_of_world_rejected(client):
    with pair(client) as (a, b):
        a.send_json({"type": "state", "state": make_state(5000.0, 0.0)})
        err = a.receive_json()
        assert err["type"] == "error"
        assert "implausible movement" in err["message"]


def test_legit_far_district_positions_accepted(client):
    """Regression (Phase 26): WORLD_LIMIT was 150 on both axes, which
    rejected honest state from Northgate (z=-248), Coral Shores
    (z=224..304) and both streamed districts. Each player below joins
    fresh, so their first state is a spawn at a real in-world spot."""
    spots = [
        ("northgate", -20.0, -248.0),
        ("coral", 60.0, 264.0),
        ("eastmere", 83.0, -246.0),
        ("westbrook", -160.0, 20.0),
        ("island", -64.0, 168.0),
        # Phase 27: shoreline boating — the Phase 26 symmetric limits
        # clipped a boat rounding Westbrook's west point (x ~ -211)
        # and one hugging Coral's south shore (z ~ 355); the bounds
        # are per-side now (land extent + 48 of open sea).
        ("westbrook-offshore", -225.0, 20.0),
        ("coral-offshore", 60.0, 355.0),
        # Phase 28: the on-foot swim envelope (|x| < 175, Player.tsx)
        # poked 1 unit past the old X_MAX=174 — a swimmer at the
        # client's own legal east limit was rejected. X_MAX is 178
        # now; this spot sits at that swim limit.
        ("east-swim-limit", 174.5, 120.0),
        # Phase 31: Northreach pushed charted land north to z=-368
        # and Z_MIN moved to -416 (land + the same 48u sea margin);
        # a player standing in the district and a boat rounding its
        # north shore (client boat clamp z >= -412) must both pass.
        ("northreach", -20.0, -336.0),
        ("northreach-offshore", -20.0, -400.0),
    ]
    with client.websocket_connect("/ws") as watcher:
        join(watcher, player="watcher")
        for name, x, z in spots:
            with client.websocket_connect("/ws") as p:
                join(p, player=name)
                # drain until THIS player's join note — the previous
                # player's player_left may still be queued ahead of it
                while True:
                    note = watcher.receive_json()
                    if note.get("type") == "player_joined" and note.get("playerId") == name:
                        break
                state = make_state(x, z)
                p.send_json({"type": "state", "state": state})
                relayed = watcher.receive_json()
                assert relayed == {"type": "state", "playerId": name, "state": state}, name


def test_car_position_is_the_checked_one(client):
    """While driving, plausibility reads the CAR's position (the
    client sends it alongside the on-foot one)."""
    with pair(client) as (a, b):
        a.send_json({"type": "state", "state": make_state(0.0, 0.0)})
        b.receive_json()
        # on-foot position stays home but the car "jumps" 80 units
        jumped = make_state(0.0, 0.0, in_car=True)
        jumped["car"]["position"] = [80.0, 0.0, 0.0]
        a.send_json({"type": "state", "state": jumped})
        err = a.receive_json()
        assert err["type"] == "error"
        assert "implausible movement" in err["message"]


def test_rejoin_respawn_gets_fresh_anchor(client):
    """Regression (Phase 26): the anchor survived disconnect, so a
    player rejoining at a respawn point was measured against their
    pre-disconnect spot and rejected."""
    with client.websocket_connect("/ws") as watcher:
        join(watcher, player="watcher")
        with client.websocket_connect("/ws") as a:
            join(a, player="alice")
            watcher.receive_json()  # player_joined alice
            a.send_json({"type": "state", "state": make_state(0.0, 0.0)})
            watcher.receive_json()  # her state
        watcher.receive_json()  # player_left alice
        with client.websocket_connect("/ws") as a2:
            join(a2, player="alice")
            watcher.receive_json()  # player_joined alice again
            respawn = make_state(100.0, 100.0)  # far from the old anchor
            a2.send_json({"type": "state", "state": respawn})
            relayed = watcher.receive_json()
            assert relayed == {"type": "state", "playerId": "alice", "state": respawn}
