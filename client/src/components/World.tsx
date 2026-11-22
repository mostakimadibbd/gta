import { buildings, trees } from "../world";

function Streetlight({ position }: { position: [number, number, number] }) {
  return (
    <group position={position}>
      <mesh position={[0, 2.8, 0]} castShadow>
        <cylinderGeometry args={[0.09, 0.14, 5.6, 5]} />
        <meshStandardMaterial color="#39434b" />
      </mesh>
      <mesh position={[0.48, 5.55, 0]}>
        <boxGeometry args={[1.15, 0.12, 0.2]} />
        <meshStandardMaterial color="#39434b" />
      </mesh>
      <mesh position={[0.95, 5.42, 0]}>
        <boxGeometry args={[0.42, 0.18, 0.32]} />
        <meshStandardMaterial color="#ffe8a3" emissive="#ffc857" emissiveIntensity={0.55} />
      </mesh>
    </group>
  );
}

function Tree({ x, z, scale }: { x: number; z: number; scale: number }) {
  return (
    <group position={[x, 0, z]} scale={scale}>
      <mesh position={[0, 0.9, 0]} castShadow>
        <cylinderGeometry args={[0.16, 0.24, 1.8, 5]} />
        <meshStandardMaterial color="#76553b" flatShading />
      </mesh>
      <mesh position={[0, 2.1, 0]} castShadow>
        <coneGeometry args={[1.05, 2.1, 6]} />
        <meshStandardMaterial color="#456c4b" flatShading />
      </mesh>
      <mesh position={[0, 2.9, 0]} castShadow>
        <coneGeometry args={[0.72, 1.75, 6]} />
        <meshStandardMaterial color="#628b58" flatShading />
      </mesh>
    </group>
  );
}

const lamps: [number, number, number][] = [];
for (const offset of [-54, -27, 27, 54]) {
  lamps.push([offset, 0, -5], [offset, 0, 5], [-5, 0, offset], [5, 0, offset]);
}

export default function World() {
  return (
    <group>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.08, 0]} receiveShadow>
        <planeGeometry args={[140, 140]} />
        <meshStandardMaterial color="#68795c" />
      </mesh>
      <mesh position={[0, 0, 0]} receiveShadow>
        <boxGeometry args={[140, 0.12, 10]} />
        <meshStandardMaterial color="#30383e" />
      </mesh>
      <mesh position={[0, 0.01, 0]} receiveShadow>
        <boxGeometry args={[10, 0.12, 140]} />
        <meshStandardMaterial color="#30383e" />
      </mesh>
      <mesh position={[0, 0.01, 30]} receiveShadow>
        <boxGeometry args={[140, 0.12, 8]} />
        <meshStandardMaterial color="#30383e" />
      </mesh>
      <mesh position={[30, 0.01, 0]} receiveShadow>
        <boxGeometry args={[8, 0.12, 140]} />
        <meshStandardMaterial color="#30383e" />
      </mesh>
      {[-5, 5].map((x) => (
        <mesh key={`h-${x}`} position={[x, 0.075, 0]}>
          <boxGeometry args={[0.14, 0.015, 140]} />
          <meshStandardMaterial color="#e5c76b" />
        </mesh>
      ))}
      {[-5, 5].map((z) => (
        <mesh key={`v-${z}`} position={[0, 0.075, z]}>
          <boxGeometry args={[140, 0.015, 0.14]} />
          <meshStandardMaterial color="#e5c76b" />
        </mesh>
      ))}
      {buildings.map((building) => (
        <group key={`${building.x}-${building.z}`} position={[building.x, 0, building.z]}>
          <mesh position={[0, building.height / 2, 0]} castShadow receiveShadow>
            <boxGeometry args={[building.width, building.height, building.depth]} />
            <meshStandardMaterial color={building.color} flatShading />
          </mesh>
          <mesh position={[0, building.height + 0.12, 0]} castShadow>
            <coneGeometry args={[Math.max(building.width, building.depth) * 0.68, 0.45, 4]} />
            <meshStandardMaterial color="#484c48" flatShading />
          </mesh>
          <mesh position={[0, 1.4, building.depth / 2 + 0.012]}>
            <boxGeometry args={[1.2, 1.7, 0.04]} />
            <meshStandardMaterial color="#28333b" />
          </mesh>
        </group>
      ))}
      {trees.map((tree) => (
        <Tree key={`${tree.x}-${tree.z}`} {...tree} />
      ))}
      {lamps.map((position, index) => (
        <Streetlight key={index} position={position} />
      ))}
    </group>
  );
}
