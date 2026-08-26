/**
 * CHAPTER 08 — INTELLIGENCE (the filtering).
 *
 * A thousand nodes are shown, then progressively dismissed until a single
 * critical path remains. Nothing is deleted: irrelevant nodes fade and fall
 * away, so the viewer feels judgement being applied rather than data vanishing.
 */
import { useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";

import { PAL } from "../materials/palette";
import { WorldNumber } from "../objects/DataFragments";
import { clamp01, ramp, rng } from "../utils/animationUtils";
import { story } from "../utils/storyState";
import { DEPTH, FILTER_STEPS } from "../utils/storyConfig";

const Z = DEPTH.filtering;

export function IntelligenceScene({ lite }: { lite: boolean }) {
  const count = lite ? 420 : 1000;
  const mesh = useRef<THREE.InstancedMesh>(null);
  const dummy = useMemo(() => new THREE.Object3D(), []);

  const data = useMemo(() => {
    const rand = rng(777001);
    const pos: THREE.Vector3[] = [];
    const rank: number[] = [];
    const color = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
      const a = rand() * Math.PI * 2;
      const r = 4 + Math.sqrt(rand()) * 44;
      pos.push(
        new THREE.Vector3(Math.cos(a) * r, Math.sin(a) * r * 0.6, Z + (rand() - 0.5) * 40),
      );
      // Relevance rank: 0 = critical path, 1 = irrelevant. Survives longest.
      rank.push(rand());
      const c = PAL.grey;
      color[i * 3] = c.r;
      color[i * 3 + 1] = c.g;
      color[i * 3 + 2] = c.b;
    }
    return { pos, rank, color };
  }, [count]);

  const [numbers, setNumbers] = useMemo(() => {
    const state = { opacities: FILTER_STEPS.map(() => 0) };
    return [state, (v: number[]) => (state.opacities = v)] as const;
  }, []);
  void setNumbers;

  useFrame((state) => {
    const p = story.progress;
    const t = state.clock.elapsedTime;
    const alive = ramp(p, 0.82, 0.86) * (1 - ramp(p, 0.92, 0.95));
    // Survival threshold walks from 1 (all shown) down to ~0.02 (one path).
    const cut = 1 - ramp(p, 0.845, 0.915) * 0.985;

    const m = mesh.current;
    if (!m) return;
    m.visible = alive > 0.02;
    if (!m.visible) return;

    const colorAttr = m.instanceColor;
    for (let i = 0; i < count; i++) {
      const keep = clamp01((cut - data.rank[i]!) * 14 + 0.5);
      const base = data.pos[i]!;
      dummy.position.set(
        base.x,
        // Dismissed nodes sink away instead of popping out of existence.
        base.y - (1 - keep) * 26,
        base.z,
      );
      dummy.rotation.set(t * 0.08 + i, t * 0.06, 0);
      dummy.scale.setScalar((0.28 + 0.9 * keep) * alive);
      dummy.updateMatrix();
      m.setMatrixAt(i, dummy.matrix);
      if (colorAttr) {
        const c = keep > 0.85 ? PAL.critical : keep > 0.5 ? PAL.amber : PAL.grey;
        colorAttr.setXYZ(i, c.r * (0.25 + 0.75 * keep), c.g * (0.25 + 0.75 * keep), c.b * (0.25 + 0.75 * keep));
      }
    }
    m.instanceMatrix.needsUpdate = true;
    if (colorAttr) colorAttr.needsUpdate = true;
    (m.material as THREE.MeshBasicMaterial).opacity = alive;

    numbers.opacities = FILTER_STEPS.map((s) =>
      Math.min(ramp(p, s.at - 0.012, s.at), 1 - ramp(p, s.at + 0.012, s.at + 0.026)),
    );
  });

  return (
    <group>
      <instancedMesh ref={mesh} args={[undefined, undefined, count]}>
        <octahedronGeometry args={[0.6, 0]} />
        <meshBasicMaterial transparent opacity={1} toneMapped={false} />
        <instancedBufferAttribute attach="instanceColor" args={[data.color, 3]} />
      </instancedMesh>

      {FILTER_STEPS.map((s, i) => (
        <FilterNumber key={s.caption} index={i} state={numbers} />
      ))}
    </group>
  );
}

function FilterNumber({
  index,
  state,
}: {
  index: number;
  state: { opacities: number[] };
}) {
  const step = FILTER_STEPS[index]!;
  const ref = useRef(0);
  useFrame(() => {
    ref.current = state.opacities[index] ?? 0;
  });
  return (
    <LiveWorldNumber
      value={step.value}
      caption={step.caption}
      opacityRef={ref}
      position={[0, 0, Z + 16]}
    />
  );
}

/** WorldNumber whose opacity is driven per-frame from a ref. */
function LiveWorldNumber({
  value,
  caption,
  opacityRef,
  position,
}: {
  value: string;
  caption: string;
  opacityRef: React.MutableRefObject<number>;
  position: [number, number, number];
}) {
  const group = useRef<THREE.Group>(null);
  const [opacity, setOpacity] = useThrottled(opacityRef);
  void setOpacity;
  useFrame(() => {
    if (group.current) group.current.visible = opacityRef.current > 0.01;
  });
  return (
    <group ref={group}>
      <WorldNumber
        position={position}
        value={value}
        caption={caption}
        opacity={opacity}
        size={16}
      />
    </group>
  );
}

function useThrottled(ref: React.MutableRefObject<number>) {
  const [v, setV] = useState(0);
  useFrame(() => {
    const q = Math.round(ref.current * 10) / 10;
    if (q !== v) setV(q);
  });
  return [v, setV] as const;
}

import { useState } from "react";
