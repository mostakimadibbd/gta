import { Suspense, useEffect, useRef, useState, type ComponentRef, type RefObject } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { OrbitControls } from "@react-three/drei";
import * as THREE from "three";
import Player from "./components/Player";
import Vehicle from "./components/Vehicle";
import World from "./components/World";
import { Multiplayer, type NetworkState, type RemotePlayer } from "./components/Multiplayer";
import { fallbackPhysics, loadPhysicsEngine, type PhysicsEngine, type VehicleState } from "./physics/GamePhysics";

function CameraTarget({ target }: { target: RefObject<THREE.Vector3> }) {
  const controls = useRef<ComponentRef<typeof OrbitControls> | null>(null);
  useFrame((_, delta) => {
    if (!controls.current || !target.current) return;
    controls.current.target.lerp(target.current.clone().add(new THREE.Vector3(0, 1.1, 0)), 1 - Math.exp(-5 * delta));
    controls.current.update();
  });
  return <OrbitControls ref={controls} makeDefault enablePan={false} minDistance={4} maxDistance={18} maxPolarAngle={Math.PI / 2.05} />;
}

function RemotePlayers({ players }: { players: RemotePlayer[] }) {
  return (
    <>
      {players.map((player) =>
        player.state ? (
          <group key={player.playerId}>
            {player.state.car ? (
              <group position={player.state.car.position} rotation={player.state.car.rotation}>
                <mesh position={[0, 0.65, 0]} castShadow>
                  <boxGeometry args={[1.9, 0.62, 3.3]} />
                  <meshStandardMaterial color="#6e72cc" flatShading />
                </mesh>
                <mesh position={[0, 1.1, -0.1]}>
                  <boxGeometry args={[1.4, 0.48, 1.5]} />
                  <meshStandardMaterial color="#9ed3df" />
                </mesh>
              </group>
            ) : (
              <group position={player.state.position} rotation={player.state.rotation}>
                <mesh position={[0, 1, 0]} castShadow>
                  <capsuleGeometry args={[0.32, 0.72, 4, 6]} />
                  <meshStandardMaterial color="#6e72cc" flatShading />
                </mesh>
                <mesh position={[0, 1.62, 0]}>
                  <icosahedronGeometry args={[0.25, 1]} />
                  <meshStandardMaterial color="#d5a77b" flatShading />
                </mesh>
              </group>
            )}
          </group>
        ) : null,
      )}
    </>
  );
}

export default function App() {
  const playerPositionRef = useRef(new THREE.Vector3(0, 0, 6));
  const playerRotationRef = useRef(new THREE.Vector3());
  const vehiclePositionRef = useRef(new THREE.Vector3(2, 0, 4));
  const vehicleStateRef = useRef<VehicleState>({ x: 2, z: 4, heading: 0, speed: 0 });
  const physicsRef = useRef<PhysicsEngine>(fallbackPhysics);
  const [driving, setDriving] = useState(false);
  const [players, setPlayers] = useState<RemotePlayer[]>([]);
  const [networkStatus, setNetworkStatus] = useState("Offline");
  const [physicsSource, setPhysicsSource] = useState<"typescript" | "wasm">("typescript");
  const multiplayerRef = useRef<Multiplayer | null>(null);

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
    const url = import.meta.env.VITE_MULTIPLAYER_SERVER_URL;
    if (!url) {
      setNetworkStatus("Offline — set VITE_MULTIPLAYER_SERVER_URL to connect");
      return;
    }
    const multiplayer = new Multiplayer(setPlayers, setNetworkStatus);
    multiplayerRef.current = multiplayer;
    multiplayer.connect(url, import.meta.env.VITE_MULTIPLAYER_ROOM || "downtown");
    return () => {
      multiplayer.disconnect();
      multiplayerRef.current = null;
    };
  }, []);

  useEffect(() => {
    const interval = window.setInterval(() => {
      const position = playerPositionRef.current;
      const vehicle = vehicleStateRef.current;
      const state: NetworkState = {
        position: [position.x, position.y, position.z],
        rotation: [playerRotationRef.current.x, playerRotationRef.current.y, playerRotationRef.current.z],
        car: driving ? {
          position: [vehicle.x, 0.65, vehicle.z],
          rotation: [0, vehicle.heading, 0],
        } : null,
      };
      multiplayerRef.current?.sendState(state);
    }, 50);
    return () => window.clearInterval(interval);
  }, [driving]);

  const exitVehicle = (position: THREE.Vector3) => {
    playerPositionRef.current.copy(position);
  };

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
          <Vehicle
            playerPositionRef={playerPositionRef}
            vehiclePositionRef={vehiclePositionRef}
            vehicleStateRef={vehicleStateRef}
            driving={driving}
            onDrivingChange={setDriving}
            onExit={exitVehicle}
            physicsRef={physicsRef}
          />
          <Player positionRef={playerPositionRef} rotationRef={playerRotationRef} driving={driving} />
          <RemotePlayers players={players} />
          <CameraTarget target={playerPositionRef} />
        </Suspense>
      </Canvas>
      <section className="hud" aria-label="Game status and controls">
        <div className="hud-brand">CITY<span>DRIVE</span></div>
        <div className="hud-status">
          <span className={`status-dot ${networkStatus === "Connected" ? "online" : ""}`} />
          {networkStatus}
        </div>
        <div className="hud-meta">Physics: {physicsSource.toUpperCase()} · Players: {players.length + 1}</div>
        <div className="controls">
          <b>WASD</b> Move / drive <i /> <b>SHIFT</b> Sprint <i /> <b>SPACE</b> Jump <i /> <b>E</b> Enter / exit
        </div>
      </section>
    </main>
  );
}
