/**
 * A wallet / transaction node with real physical presence:
 * emissive core, semi-transparent engineered shell, and an optional activity
 * ring. Used for every node the camera gets close to.
 */
import { useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";

import { PAL } from "../materials/palette";
import type { Vec3 } from "../utils/storyConfig";

export interface NodeProps {
  position: Vec3;
  radius?: number;
  color?: THREE.Color;
  /** 0 → dormant, 1 → fully active. Driven per-frame by the scenes. */
  activity?: number;
  rings?: boolean;
  spin?: number;
}

export function BlockchainNode({
  position,
  radius = 1,
  color = PAL.accent,
  activity = 1,
  rings = true,
  spin = 0.25,
}: NodeProps) {
  const core = useRef<THREE.Mesh>(null);
  const shell = useRef<THREE.Mesh>(null);
  const ring = useRef<THREE.Mesh>(null);

  useFrame((state, delta) => {
    const t = state.clock.elapsedTime;
    const pulse = 0.85 + 0.15 * Math.sin(t * 2 + position[2]);
    if (core.current) {
      core.current.scale.setScalar(radius * 0.34 * pulse);
      (core.current.material as THREE.MeshBasicMaterial).opacity = activity;
    }
    if (shell.current) {
      shell.current.rotation.y += delta * spin;
      shell.current.rotation.x += delta * spin * 0.4;
      (shell.current.material as THREE.MeshStandardMaterial).opacity =
        0.16 + 0.22 * activity;
    }
    if (ring.current) {
      ring.current.rotation.z += delta * 0.6 * activity;
      (ring.current.material as THREE.MeshBasicMaterial).opacity = 0.35 * activity;
    }
  });

  return (
    <group position={position}>
      <mesh ref={core}>
        <icosahedronGeometry args={[1, 2]} />
        <meshBasicMaterial color={color} transparent toneMapped={false} />
      </mesh>

      <mesh ref={shell} scale={radius}>
        <icosahedronGeometry args={[1, 1]} />
        <meshStandardMaterial
          color={color}
          metalness={0.85}
          roughness={0.35}
          transparent
          opacity={0.25}
          side={THREE.DoubleSide}
          depthWrite={false}
        />
      </mesh>

      <mesh scale={radius * 1.02}>
        <icosahedronGeometry args={[1, 1]} />
        <meshBasicMaterial color={color} wireframe transparent opacity={0.22} />
      </mesh>

      {rings ? (
        <mesh ref={ring} scale={radius}>
          <torusGeometry args={[1.5, 0.012, 8, 64]} />
          <meshBasicMaterial color={color} transparent toneMapped={false} />
        </mesh>
      ) : null}
    </group>
  );
}
