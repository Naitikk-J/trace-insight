/**
 * CHAPTER 03 — FOLLOWING THE MONEY.
 *
 * The camera flies along a bounded multi-hop path. Each hop is a real wallet
 * object with attached metadata; the pulse riding the curve is the value moving.
 */
import { useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";

import { PAL } from "../materials/palette";
import { BlockchainNode } from "../objects/BlockchainNode";
import { DataFragment } from "../objects/DataFragments";
import { TransactionPath, useCurve } from "../objects/TransactionPath";
import { ramp } from "../utils/animationUtils";
import { story } from "../utils/storyState";
import { DEPTH, type Vec3 } from "../utils/storyConfig";

const Z = DEPTH.trace;

const HOPS: { p: Vec3; label: string; value: string }[] = [
  { p: [-14, 4, Z + 12], label: "VICTIM", value: "-412,900 USDT" },
  { p: [-6, -3, Z], label: "HOP 1", value: "412,900" },
  { p: [4, 5, Z - 14], label: "HOP 2", value: "206,450 · split" },
  { p: [12, -2, Z - 26], label: "HOP 3", value: "198,010" },
  { p: [20, 6, Z - 38], label: "HOP 4", value: "191,220" },
  { p: [27, -1, Z - 50], label: "CASH-OUT", value: "189,400" },
];

export function TraceScene() {
  const points = useMemo(() => HOPS.map((h) => h.p), []);
  const curve = useCurve(points);
  const branchCurve = useCurve(
    useMemo<Vec3[]>(
      () => [
        [4, 5, Z - 14],
        [8, 14, Z - 22],
        [16, 18, Z - 34],
      ],
      [],
    ),
  );
  const group = useRef<THREE.Group>(null);
  const revealRef = useRef(0);

  useFrame(() => {
    const p = story.progress;
    revealRef.current = ramp(p, 0.34, 0.52);
    if (group.current) group.current.visible = p > 0.3 && p < 0.62;
  });

  const Reveal = () => {
    const [r, setR] = useMemo(() => [{ v: 0 }, (v: number) => (r.v = v)], []);
    void setR;
    return null;
  };
  void Reveal;

  return (
    <group ref={group}>
      <TraceBody curve={curve} branch={branchCurve} revealRef={revealRef} />
      {HOPS.map((h, i) => (
        <group key={h.label}>
          <BlockchainNode
            position={h.p}
            radius={i === 0 ? 2 : i === HOPS.length - 1 ? 2.2 : 1.3}
            color={i === 0 ? PAL.critical : i === HOPS.length - 1 ? PAL.verified : PAL.signal}
          />
          <DataFragment
            position={[h.p[0], h.p[1] + 3.4, h.p[2]]}
            label={h.label}
            size={0.72}
            color={PAL.signal}
            near={30}
            far={70}
          />
          <DataFragment
            position={[h.p[0], h.p[1] - 3.2, h.p[2]]}
            label={h.value}
            size={0.58}
            color={PAL.grey}
            near={24}
            far={58}
          />
        </group>
      ))}
    </group>
  );
}

function TraceBody({
  curve,
  branch,
  revealRef,
}: {
  curve: THREE.CatmullRomCurve3;
  branch: THREE.CatmullRomCurve3;
  revealRef: React.MutableRefObject<number>;
}) {
  const [reveal, setReveal] = useThrottledReveal(revealRef);
  void setReveal;
  return (
    <group>
      <TransactionPath curve={curve} reveal={reveal} pulses={4} />
      <TransactionPath
        curve={branch}
        reveal={reveal * 0.8}
        color={PAL.amber}
        pulses={1}
        speed={0.1}
      />
    </group>
  );
}

/**
 * Reveal is animated in the render loop but consumed as a prop, so it is
 * sampled at a low rate to avoid a React render per frame.
 */
function useThrottledReveal(ref: React.MutableRefObject<number>) {
  const [v, setV] = useReactState(0);
  useFrame(() => {
    const q = Math.round(ref.current * 24) / 24;
    if (q !== v) setV(q);
  });
  return [v, setV] as const;
}

import { useState as useReactState } from "react";
