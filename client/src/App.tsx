import {
  Suspense,
  useCallback,
  useEffect,
  useRef,
  useState,
  type ComponentRef,
  type FormEvent,
  type RefObject,
} from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { OrbitControls } from "@react-three/drei";
import * as THREE from "three";
import Collectibles from "./components/Collectibles";
import { Multiplayer, type NetworkState, type RemotePlayer } from "./components/Multiplayer";
import Player from "./components/Player";
import Vehicle from "./components/Vehicle";
import World from "./components/World";
import { isInteractiveTarget } from "./keyboard";
import { fallbackPhysics, loadPhysicsEngine, type PhysicsEngine, type VehicleState } from "./physics/GamePhysics";

const initialRoom = import.meta.env.VITE_MULTIPLAYER_ROOM || "downtown";

function CameraTarget({ target }: { target: RefObject<THREE.Vector3> }) {
  const controls = useRef<ComponentRef<typeof OrbitControls> | null>(null);
  useFrame((_, delta) => {
    if (!controls.current || !target.current) return;
    controls.current.target.lerp(
      target.current.clone().add(new THREE.Vector3(0, 1.1, 0)),
      1 - Math.exp(-5 * delta),
    );
    controls.current.update();
  });
  return (
    <OrbitControls
      ref={controls}
      makeDefault
      enablePan={false}
      minDistance={4}
      maxDistance={18}
      maxPolarAngle={Math.PI / 2.05}
    />
  );
}

function RemoteAvatar({ player }: { player: RemotePlayer }) {
  const root = useRef<THREE.Group>(null);
  const state = player.state;
  useFrame((_, delta) => {
    if (!root.current || !state) return;
    const position = state.car?.position ?? state.position;
    root.current.position.lerp(new THREE.Vector3(...position), 1 - Math.exp(-12 * delta));
    const heading = state.car?.rotation[1] ?? state.rotation[1];
    root.current.rotation.y = THREE.MathUtils.damp(root.current.rotation.y, heading, 12, delta);
  });
  if (!state) return null;

  return (
    <group ref={root} position={state.car?.position ?? state.position}>
      {state.car ? (
        <group>
          <mesh position={[0, 0.62, 0]} castShadow>
            <boxGeometry args={[2, 0.62, 3.5]} />
            <meshStandardMaterial color="#6e72cc" flatShading />
          </mesh>
          <mesh position={[0, 1.12, -0.12]} castShadow>
            <boxGeometry args={[1.48, 0.55, 1.72]} />
            <meshStandardMaterial color="#9ed3df" />
          </mesh>
        </group>
      ) : (
        <group position={[0, 0.86, 0]}>
          <mesh castShadow>
            <capsuleGeometry args={[0.34, 0.72, 4, 6]} />
            <meshStandardMaterial color="#6e72cc" flatShading />
          </mesh>
          <mesh position={[0, 0.64, 0]} castShadow>
            <icosahedronGeometry args={[0.27, 1]} />
            <meshStandardMaterial color="#d5a77b" flatShading />
          </mesh>
        </group>
      )}
    </group>
  );
}

function RemotePlayers({ players }: { players: RemotePlayer[] }) {
  return (
    <>
      {players.map((player) => (
        <RemoteAvatar key={player.playerId} player={player} />
      ))}
    </>
  );
}

export default function App() {
  const playerPositionRef = useRef(new THREE.Vector3(0, 0, 6));
  const playerRotationRef = useRef(new THREE.Vector3());
  const vehiclePositionRef = useRef(new THREE.Vector3(2, 0, 4));
  const vehicleStateRef = useRef<VehicleState>({ x: 2, z: 4, heading: 0, speed: 0 });
  const physicsRef = useRef<PhysicsEngine>(fallbackPhysics);
  const resumeButtonRef = useRef<HTMLButtonElement>(null);
  const closeHelpButtonRef = useRef<HTMLButtonElement>(null);
  const [driving, setDriving] = useState(false);
  const [paused, setPaused] = useState(false);
  const [showHelp, setShowHelp] = useState(false);
  const [nearVehicle, setNearVehicle] = useState(false);
  const [players, setPlayers] = useState<RemotePlayer[]>([]);
  const [networkStatus, setNetworkStatus] = useState("Offline");
  const [roomName, setRoomName] = useState(initialRoom);
  const [activeRoom, setActiveRoom] = useState("");
  const [tokenCount, setTokenCount] = useState(0);
  const [speedKph, setSpeedKph] = useState(0);
  const [physicsSource, setPhysicsSource] = useState<"typescript" | "wasm">("typescript");
  const multiplayerRef = useRef<Multiplayer | null>(null);
  const serverUrl = import.meta.env.VITE_MULTIPLAYER_SERVER_URL;

  const connectToRoom = useCallback((room: string) => {
    if (!serverUrl) {
      setNetworkStatus("Set VITE_MULTIPLAYER_SERVER_URL to enable multiplayer.");
      return;
    }
    multiplayerRef.current?.disconnect();
    setPlayers([]);
    setActiveRoom(room);
    const multiplayer = new Multiplayer(setPlayers, setNetworkStatus);
    multiplayerRef.current = multiplayer;
    multiplayer.connect(serverUrl, room);
  }, [serverUrl]);

  useEffect(() => {
    if (!serverUrl) {
      setNetworkStatus("Offline — set VITE_MULTIPLAYER_SERVER_URL to join a room.");
      return;
    }
    connectToRoom(initialRoom);
    return () => {
      multiplayerRef.current?.disconnect();
      multiplayerRef.current = null;
    };
  }, [connectToRoom, serverUrl]);

  useEffect(() => {
    let mounted = true;
    void loadPhysicsEngine().then((engine) => {
      if (!mounted) return;
      physicsRef.current = engine;
      setPhysicsSource(engine.source);
    });
    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        if (showHelp) setShowHelp(false);
        else setPaused((value) => !value);
        return;
      }
      if (isInteractiveTarget(event.target)) return;
      if (event.key === "?" || event.key === "F1") {
        event.preventDefault();
        setShowHelp((value) => !value);
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [showHelp]);

  useEffect(() => {
    if (paused) resumeButtonRef.current?.focus();
  }, [paused]);

  useEffect(() => {
    if (showHelp) closeHelpButtonRef.current?.focus();
  }, [showHelp]);

  useEffect(() => {
    let frame = 0;
    const interval = window.setInterval(() => {
      const position = playerPositionRef.current;
      const vehicle = vehicleStateRef.current;
      const state: NetworkState = {
        position: [position.x, position.y, position.z],
        rotation: [playerRotationRef.current.x, playerRotationRef.current.y, playerRotationRef.current.z],
        car: driving ? {
          position: [vehicle.x, 0, vehicle.z],
          rotation: [0, vehicle.heading, 0],
        } : null,
      };
      multiplayerRef.current?.sendState(state);
      frame += 1;
      if (frame % 4 === 0) setSpeedKph(driving ? Math.round(Math.abs(vehicle.speed) * 3.6) : 0);
    }, 50);
    return () => window.clearInterval(interval);
  }, [driving]);

  const exitVehicle = useCallback((position: THREE.Vector3) => {
    playerPositionRef.current.copy(position);
  }, []);

  const handleRoomSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const room = roomName.trim();
    if (room) connectToRoom(room);
  };

  const disconnect = () => {
    multiplayerRef.current?.disconnect();
    multiplayerRef.current = null;
    setPlayers([]);
    setActiveRoom("");
    setNetworkStatus("Disconnected");
  };

  const playerTargetRef = driving ? vehiclePositionRef : playerPositionRef;

  return (
    <main className="game-shell">
      <Canvas
        shadows
        camera={{ position: [0, 7, 12], fov: 58, near: 0.1, far: 240 }}
        gl={{ antialias: true, powerPreference: "high-performance" }}
      >
        <color attach="background" args={["#a9c5d3"]} />
        <fog attach="fog" args={["#a9c5d3", 75, 145]} />
        <ambientLight intensity={0.72} />
        <hemisphereLight args={["#dcecff", "#536344", 1.1]} />
        <directionalLight
          castShadow
          position={[-24, 36, 18]}
          intensity={2.2}
          shadow-mapSize-width={2048}
          shadow-mapSize-height={2048}
          shadow-camera-left={-75}
          shadow-camera-right={75}
          shadow-camera-top={75}
          shadow-camera-bottom={-75}
          shadow-bias={-0.00015}
        />
        <Suspense fallback={null}>
          <World />
          <Collectibles
            targetRef={playerTargetRef}
            paused={paused}
            onCollect={() => setTokenCount((count) => count + 1)}
          />
          <Vehicle
            playerPositionRef={playerPositionRef}
            vehiclePositionRef={vehiclePositionRef}
            vehicleStateRef={vehicleStateRef}
            driving={driving}
            paused={paused}
            onDrivingChange={setDriving}
            onExit={exitVehicle}
            onNearVehicleChange={setNearVehicle}
            physicsRef={physicsRef}
          />
          <Player positionRef={playerPositionRef} rotationRef={playerRotationRef} driving={driving} paused={paused} />
          <RemotePlayers players={players} />
          <CameraTarget target={playerTargetRef} />
        </Suspense>
      </Canvas>

      <section className="hud" aria-label="Game status">
        <div className="hud-brand">CITY<span>DRIVE</span></div>
        <div className="hud-meta" aria-live="polite">
          Tokens {tokenCount}/6 · {driving ? `${speedKph} km/h` : "On foot"} · {players.length + 1} player{players.length === 0 ? "" : "s"}
        </div>
        {nearVehicle && !driving && !paused && <p className="interaction-prompt">Press E to enter the car</p>}
        {driving && !paused && <p className="interaction-prompt">WASD / arrows to drive · Space to drift · E to exit</p>}
        <div className="controls">
          <b>WASD / ↑↓←→</b> Move <i /> <b>SHIFT</b> Sprint <i /> <b>SPACE</b> Jump <i /> <b>E</b> Car <i /> <b>ESC</b> Pause
        </div>
      </section>

      <aside className="game-panel" aria-label="Multiplayer and game controls">
        <header className="panel-header">
          <div>
            <h1>City Drive</h1>
            <p>Low-poly multiplayer city</p>
          </div>
          <span className={`status-dot ${networkStatus.startsWith("Connected") ? "online" : ""}`} aria-hidden="true" />
        </header>

        <div className="stats-row" aria-label="Current game stats">
          <div><span>Tokens</span><strong aria-live="polite">{tokenCount}/6</strong></div>
          <div><span>Speed</span><strong>{speedKph}<small> km/h</small></strong></div>
          <div><span>Physics</span><strong>{physicsSource === "wasm" ? "WASM" : "JS"}</strong></div>
        </div>

        <form className="room-form" onSubmit={handleRoomSubmit}>
          <label htmlFor="room-name">Multiplayer room</label>
          <div className="room-row">
            <input
              id="room-name"
              name="room"
              value={roomName}
              onChange={(event) => setRoomName(event.target.value)}
              maxLength={48}
              autoComplete="off"
              aria-describedby="room-help"
            />
            <button type="submit" disabled={!serverUrl || !roomName.trim()}>Join</button>
          </div>
          <small id="room-help">Joining a new room creates it automatically.</small>
        </form>

        <p className="network-status" role="status" aria-live="polite">{networkStatus}</p>
        <div className="roster">
          <h2>Players <span>{players.length + 1}</span></h2>
          <ul aria-label="Players in this room">
            <li><span>You</span><small>local</small></li>
            {players.map((player) => (
              <li key={player.playerId}>
                <span>Player {player.playerId.slice(0, 8)}</span>
                <small>{player.state?.car ? "driving" : "online"}</small>
              </li>
            ))}
          </ul>
        </div>

        <div className="panel-actions">
          <button type="button" onClick={() => setShowHelp(true)}>Keyboard help</button>
          <button type="button" onClick={() => setPaused((value) => !value)}>{paused ? "Resume" : "Pause"}</button>
          {activeRoom && <button type="button" onClick={disconnect}>Leave room</button>}
        </div>
      </aside>

      {paused && !showHelp && (
        <div className="dialog-backdrop">
          <section className="game-dialog" role="dialog" aria-modal="true" aria-labelledby="paused-title">
            <h2 id="paused-title">Game paused</h2>
            <p>Your movement and vehicle controls are paused.</p>
            <button ref={resumeButtonRef} type="button" onClick={() => setPaused(false)}>Resume game</button>
            <button type="button" onClick={() => setShowHelp(true)}>View keyboard controls</button>
          </section>
        </div>
      )}

      {showHelp && (
        <div className="dialog-backdrop">
          <section className="game-dialog" role="dialog" aria-modal="true" aria-labelledby="help-title">
            <h2 id="help-title">Keyboard controls</h2>
            <dl className="key-list">
              <div><dt>WASD or arrow keys</dt><dd>Move and steer</dd></div>
              <div><dt>Shift</dt><dd>Sprint on foot</dd></div>
              <div><dt>Space</dt><dd>Jump or drift in a car</dd></div>
              <div><dt>E</dt><dd>Enter or exit the nearby car</dd></div>
              <div><dt>Escape</dt><dd>Pause or resume</dd></div>
              <div><dt>?</dt><dd>Open this help</dd></div>
              <div><dt>Mouse wheel / drag</dt><dd>Zoom and orbit the camera</dd></div>
            </dl>
            <button ref={closeHelpButtonRef} type="button" onClick={() => setShowHelp(false)}>Close help</button>
          </section>
        </div>
      )}
    </main>
  );
}
