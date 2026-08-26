/**
 * CHAPTER 10/11 — CONVERGENCE and TRUTH.
 *
 * Everything the journey passed through collapses into one calm structure: a
 * hexagonal ledger form with the wordmark resolving inside it. This is the only
 * moment the world is symmetrical and at rest.
 */
import { useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { Billboard, Text } from "@react-three/drei";
import * as THREE from "three";

import { PAL } from "../materials/palette";
import { lerp, ramp, rng } from "../utils/animationUtils";
import { story } from "../utils/storyState";
import { DEPTH } from "../utils/storyConfig";

const Z = DEPTH.reveal;

export function RevealScene({ lite }: { lite: boolean }) {
  const count = lite ? 500 : 1400;
  const points = useRef<THREE.Points>(null);
  const rings = useRef<THREE.Group>(null);
  const mark = useRef<THREE.Mesh>(null);
  const word = useRef<THREE.Mesh>(null);
  const tag = useRef<THREE.Mesh>(null);

  const data = useMemo(() => {
    const rand = rng(20261111);
    const from = new Float32Array(count * 3);
    const to = new Float32Array(count * 3);
    const col = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
      const i3 = i * 3;
      from[i3] = (rand() - 0.5) * 220;
      from[i3 + 1] = (rand() - 0.5) * 140;
      from[i3 + 2] = Z + 90 - rand() * 60;
      // Target: concentric hexagonal ledger rings.
      const ring = i % 8;
      const r = 4 + ring * 2.6;
      // Even angular spread per ring, lightly snapped to a hexagonal lattice.
      const a = (Math.floor(i / 8) / Math.ceil(count / 8)) * Math.PI * 2;
      const hex = Math.round(a / (Math.PI / 3)) * (Math.PI / 3);
      const angle = hex * 0.35 + a * 0.65;
      to[i3] = Math.cos(angle) * r;
      to[i3 + 1] = Math.sin(angle) * r * 0.94;
      to[i3 + 2] = Z + (rand() - 0.5) * 2.5;
      const roll = rand();
      const c = roll > 0.9 ? PAL.verified : roll > 0.6 ? PAL.signal : PAL.accent;
      col[i3] = c.r;
      col[i3 + 1] = c.g;
      col[i3 + 2] = c.b;
    }
    return { from, to, col };
  }, [count]);

  const geom = useMemo(() => {
    const g = new THREE.BufferGeometry();
    g.setAttribute(
      "position",
      new THREE.BufferAttribute(new Float32Array(data.from), 3),
    );
    g.setAttribute("color", new THREE.BufferAttribute(data.col, 3));
    return g;
  }, [data]);

  useFrame((state, delta) => {
    const p = story.progress;
    const t = state.clock.elapsedTime;
    const converge = ramp(p, 0.94, 0.985);
    const alive = ramp(p, 0.925, 0.96);

    const pos = geom.attributes["position"]!.array as Float32Array;
    const k = 1 - Math.exp(-delta * 3);
    for (let i = 0; i < count * 3; i++) {
      const target = lerp(data.from[i]!, data.to[i]!, converge);
      pos[i] = lerp(pos[i]!, target, k);
    }
    geom.attributes["position"]!.needsUpdate = true;

    // Legibility: once the wordmark starts resolving, the particle field and
    // wireframe recede so the type is never competing with additive noise.
    const type = ramp(p, 0.95, 0.985);
    if (points.current) {
      points.current.visible = alive > 0.01;
      (points.current.material as THREE.PointsMaterial).opacity =
        alive * (0.4 + 0.6 * converge) * (1 - 0.65 * type);
    }
    if (rings.current) {
      rings.current.rotation.z += delta * 0.05;
      rings.current.children.forEach((c, i) => {
        const m = (c as THREE.Mesh).material as THREE.MeshBasicMaterial;
        m.opacity = converge * (0.28 - i * 0.05) * (1 - 0.5 * type);
        c.rotation.z -= delta * 0.03 * (i + 1);
      });
    }
    if (mark.current) {
      mark.current.rotation.z += delta * 0.08;
      (mark.current.material as THREE.MeshBasicMaterial).opacity =
        converge * 0.32 * (1 - 0.6 * type) * (0.8 + 0.2 * Math.sin(t * 1.4));
    }
    for (const r of [word, tag]) {
      if (!r.current) continue;
      const m = r.current.material as THREE.Material;
      m.transparent = true;
      m.depthWrite = false;
      m.opacity = type * (r === word ? 1 : 0.9);
    }
  });


  return (
    <group>
      <points ref={points} geometry={geom}>
        <pointsMaterial
          vertexColors
          size={lite ? 0.5 : 0.38}
          sizeAttenuation
          transparent
          opacity={0}
          depthWrite={false}
          blending={THREE.AdditiveBlending}
        />
      </points>

      <group ref={rings} position={[0, 0, Z]}>
        {[13, 18, 24].map((r, i) => (
          <mesh key={r}>
            <torusGeometry args={[r, 0.05, 6, 6]} />
            <meshBasicMaterial
              color={i === 0 ? PAL.verified : PAL.accent}
              transparent
              opacity={0}
              toneMapped={false}
            />
          </mesh>
        ))}
      </group>

      <mesh ref={mark} position={[0, 0, Z - 3]}>
        <cylinderGeometry args={[9, 9, 0.4, 6, 1, true]} />
        <meshBasicMaterial
          color={PAL.signal}
          wireframe
          transparent
          opacity={0}
          side={THREE.DoubleSide}
        />
      </mesh>

      <Billboard position={[0, 0, Z + 12]}>
        <Text
          ref={word}
          fontSize={5.4}
          letterSpacing={0.42}
          color="#eaf2ff"
          anchorX="center"
          anchorY="middle"
        >
          TRACIFY
        </Text>
        <Text
          ref={tag}
          position={[0, -4.6, 0]}
          fontSize={0.86}
          letterSpacing={0.3}
          color="#8b7cff"
          anchorX="center"
          anchorY="middle"
        >
          CLARITY IN THE CHAIN
        </Text>
      </Billboard>
    </group>
  );
}
