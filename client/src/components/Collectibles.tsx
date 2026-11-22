import { useRef, useState, type MutableRefObject } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";

const tokenPositions: [number, number, number][] = [
  [0, 1.3, -24],
  [0, 1.3, 20],
  [22, 1.3, 0],
  [-22, 1.3, 0],
  [30, 1.3, 46],
  [46, 1.3, 30],
];

interface CollectiblesProps {
  targetRef: MutableRefObject<THREE.Vector3>;
  paused: boolean;
  onCollect: () => void;
}

export default function Collectibles({ targetRef, paused, onCollect }: CollectiblesProps) {
  const items = useRef<Array<THREE.Group | null>>([]);
  const collected = useRef(new Set<number>());
  const [, setRenderVersion] = useState(0);

  useFrame((_, delta) => {
    if (paused) return;
    for (const [index, item] of items.current.entries()) {
      if (!item || collected.current.has(index)) continue;
      item.rotation.y += delta * 1.8;
      item.position.y = tokenPositions[index][1] + Math.sin(performance.now() * 0.002 + index) * 0.16;
      const dx = item.position.x - targetRef.current.x;
      const dz = item.position.z - targetRef.current.z;
      if (dx * dx + dz * dz < 2.4 ** 2) {
        collected.current.add(index);
        setRenderVersion((version) => version + 1);
        onCollect();
      }
    }
  });

  return (
    <>
      {tokenPositions.map((position, index) => (
        <group
          key={index}
          ref={(item) => {
            items.current[index] = item;
          }}
          position={position}
          visible={!collected.current.has(index)}
        >
          <mesh castShadow>
            <icosahedronGeometry args={[0.52, 1]} />
            <meshStandardMaterial color="#ffd166" emissive="#d88718" emissiveIntensity={1.1} flatShading />
          </mesh>
          <mesh rotation={[Math.PI / 2, 0, 0]}>
            <torusGeometry args={[0.72, 0.07, 6, 12]} />
            <meshStandardMaterial color="#fff0a6" emissive="#e8aa38" emissiveIntensity={0.65} />
          </mesh>
        </group>
      ))}
    </>
  );
}
