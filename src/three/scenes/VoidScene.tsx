/**
 * CHAPTER 00 — THE VOID.
 *
 * Not a black screen: an enormous, quiet space. Extremely faint points at
 * extreme distance, occasional transaction pulses, and barely-visible geometric
 * topology so the very first frame already reads as depth rather than背景.
 */
import { useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";

import { PAL } from "../materials/palette";
import { rng, ramp } from "../utils/animationUtils";
import { story } from "../utils/storyState";

export function VoidScene({ lite }: { lite: boolean }) {
  const count = lite ? 900 : 2600;
  const far = useRef<THREE.Points>(null);
  const structures = useRef<THREE.Group>(null);

  const geom = useMemo(() => {
    const rand = rng(4711);
    const pos = new Float32Array(count * 3);
    const col = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
      const i3 = i * 3;
      // A deep shell of distant activity that surrounds the whole journey.
      pos[i3] = (rand() - 0.5) * 460;
      pos[i3 + 1] = (rand() - 0.5) * 260;
      pos[i3 + 2] = 60 - rand() * 900;
      const roll = rand();
      const c =
        roll > 0.985 ? PAL.signal : roll > 0.96 ? PAL.accent : PAL.dim;
      const b = 0.35 + rand() * 0.65;
      col[i3] = c.r * b;
      col[i3 + 1] = c.g * b;
      col[i3 + 2] = c.b * b;
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.BufferAttribute(pos, 3));
    g.setAttribute("color", new THREE.BufferAttribute(col, 3));
    return g;
  }, [count]);

  useFrame((state, delta) => {
    const t = state.clock.elapsedTime;
    if (far.current) {
      far.current.rotation.y += delta * 0.004;
      const m = far.current.material as THREE.PointsMaterial;
      // Faint pulse of far-away settlement activity.
      m.opacity = 0.5 + 0.08 * Math.sin(t * 0.4);
    }
    if (structures.current) {
      structures.current.rotation.y += delta * 0.01;
      const p = story.progress;
      structures.current.visible = p < 0.42;
      structures.current.children.forEach((c, i) => {
        c.rotation.x += delta * 0.02 * (1 + i * 0.2);
        const m = (c as THREE.Mesh).material as THREE.MeshBasicMaterial;
        m.opacity = 0.05 + 0.05 * Math.sin(t * 0.3 + i) - ramp(p, 0.3, 0.45) * 0.08;
      });
    }
  });

  return (
    <group>
      <points ref={far} geometry={geom}>
        <pointsMaterial
          vertexColors
          size={lite ? 0.7 : 0.55}
          sizeAttenuation
          transparent
          opacity={0.55}
          depthWrite={false}
          blending={THREE.AdditiveBlending}
        />
      </points>

      {/* Barely visible large-scale topology in extreme distance. */}
      <group ref={structures}>
        {[
          [-120, 40, -420, 90],
          [140, -50, -520, 130],
          [30, 70, -700, 170],
          [-90, -60, -260, 70],
        ].map(([x, y, z, s], i) => (
          <mesh key={i} position={[x!, y!, z!]}>
            <icosahedronGeometry args={[s!, 1]} />
            <meshBasicMaterial
              color={i % 2 ? PAL.accent : PAL.dim}
              wireframe
              transparent
              opacity={0.06}
              depthWrite={false}
            />
          </mesh>
        ))}
      </group>
    </group>
  );
}
