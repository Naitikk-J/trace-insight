/**
 * The blockchain intelligence network.
 *
 * One persistent WebGL scene backs the whole landing page. Rather than a new
 * visual per section, the same node cloud is continuously transformed as the
 * page progresses: noise → signal → traced path → clustered network →
 * intelligence layers → convergence.
 */
import { useMemo, useRef } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";

import { scrollState } from "./scrollState";

const ACCENT = new THREE.Color("#6E8CFF");
const SIGNAL = new THREE.Color("#4DA3FF");
const VIOLET = new THREE.Color("#8B7CFF");
const CRITICAL = new THREE.Color("#FF5C70");
const VERIFIED = new THREE.Color("#4CE0A3");
const DIM = new THREE.Color("#2A3350");

/** Deterministic pseudo-random so the composition is stable across reloads. */
function rng(seed: number) {
  let s = seed;
  return () => {
    s = (s * 1664525 + 1013904223) % 4294967296;
    return s / 4294967296;
  };
}

const PATH_COUNT = 7;

interface Layout {
  count: number;
  scatter: Float32Array;
  path: Float32Array;
  cluster: Float32Array;
  converge: Float32Array;
  colors: Float32Array;
  sizes: Float32Array;
  pairs: number[][];
}

function buildLayout(count: number): Layout {
  const rand = rng(20260826);
  const scatter = new Float32Array(count * 3);
  const path = new Float32Array(count * 3);
  const cluster = new Float32Array(count * 3);
  const converge = new Float32Array(count * 3);
  const colors = new Float32Array(count * 3);
  const sizes = new Float32Array(count);

  // Cluster anchors — entity / VASP groupings the network resolves into.
  const anchors = Array.from({ length: 9 }, () => [
    (rand() - 0.5) * 44,
    (rand() - 0.5) * 22,
    (rand() - 0.5) * 34,
  ]);

  for (let i = 0; i < count; i++) {
    const i3 = i * 3;
    const isPath = i < PATH_COUNT;

    // Chaos: a deep, wide field of unrelated activity.
    scatter[i3] = (rand() - 0.5) * 86;
    scatter[i3 + 1] = (rand() - 0.5) * 46;
    scatter[i3 + 2] = -rand() * 70 + 8;

    // Trace: the illuminated multi-hop path, everything else pushed outward.
    if (isPath) {
      const t = i / (PATH_COUNT - 1);
      path[i3] = -16 + t * 32;
      path[i3 + 1] = Math.sin(t * Math.PI * 1.4) * 3.4 - 0.6;
      path[i3 + 2] = -2 + Math.cos(t * Math.PI) * 2.5;
    } else {
      const a = rand() * Math.PI * 2;
      const r = 26 + rand() * 34;
      path[i3] = Math.cos(a) * r;
      path[i3 + 1] = Math.sin(a) * r * 0.5;
      path[i3 + 2] = -12 - rand() * 40;
    }

    // Network: convergence into entity clusters.
    const anchor = anchors[i % anchors.length]!;
    cluster[i3] = anchor[0]! + (rand() - 0.5) * 9;
    cluster[i3 + 1] = anchor[1]! + (rand() - 0.5) * 7;
    cluster[i3 + 2] = anchor[2]! + (rand() - 0.5) * 9;

    // Converge: concentric hexagonal ledger topology.
    const ring = i % 4;
    const ringRadius = 5 + ring * 4.4;
    const angle = (i / count) * Math.PI * 12 + ring * 0.4;
    const hexSnap = Math.round((angle / (Math.PI / 3)) * 1) * (Math.PI / 3);
    const blend = 0.72;
    const finalAngle = hexSnap * blend + angle * (1 - blend);
    converge[i3] = Math.cos(finalAngle) * ringRadius;
    converge[i3 + 1] = Math.sin(finalAngle) * ringRadius * 0.92;
    converge[i3 + 2] = (rand() - 0.5) * 3;

    // Colour: mostly dim intelligence-grey with sparse signal accents.
    const roll = rand();
    let c = DIM;
    if (isPath) c = SIGNAL;
    else if (roll > 0.965) c = CRITICAL;
    else if (roll > 0.93) c = VERIFIED;
    else if (roll > 0.82) c = VIOLET;
    else if (roll > 0.55) c = ACCENT;
    colors[i3] = c.r;
    colors[i3 + 1] = c.g;
    colors[i3 + 2] = c.b;
    sizes[i] = isPath ? 1 : 0.28 + rand() * 0.5;
  }

  // Edge candidates: nearest-neighbour sampling keeps the graph readable.
  const pairs: number[][] = [];
  for (let i = 0; i < PATH_COUNT - 1; i++) pairs.push([i, i + 1]);
  // Sparse sampling: relationships should read as a lattice, not a haze.
  for (let i = PATH_COUNT; i < count; i += 3) {
    let best = -1;
    let bestD = Infinity;
    for (let k = 0; k < 14; k++) {
      const j = PATH_COUNT + Math.floor(rand() * (count - PATH_COUNT));
      if (j === i) continue;
      const dx = cluster[i * 3]! - cluster[j * 3]!;
      const dy = cluster[i * 3 + 1]! - cluster[j * 3 + 1]!;
      const dz = cluster[i * 3 + 2]! - cluster[j * 3 + 2]!;
      const d = dx * dx + dy * dy + dz * dz;
      if (d < bestD) {
        bestD = d;
        best = j;
      }
    }
    if (best >= 0) pairs.push([i, best]);
  }

  return { count, scatter, path, cluster, converge, colors, sizes, pairs };
}

const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
const clamp01 = (v: number) => (v < 0 ? 0 : v > 1 ? 1 : v);
/** Eased 0→1 ramp between two progress stops. */
const ramp = (p: number, from: number, to: number) => {
  const t = clamp01((p - from) / (to - from));
  return t * t * (3 - 2 * t);
};

function Network({ lite }: { lite: boolean }) {
  const layout = useMemo(() => buildLayout(lite ? 320 : 900), [lite]);
  const group = useRef<THREE.Group>(null);
  const points = useRef<THREE.Points>(null);
  const lines = useRef<THREE.LineSegments>(null);
  const glow = useRef<THREE.Points>(null);
  const blocks = useRef<THREE.Group>(null);
  const { camera } = useThree();

  const live = useMemo(
    () => new Float32Array(layout.scatter),
    [layout],
  );

  const pointGeom = useMemo(() => {
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.BufferAttribute(live, 3));
    g.setAttribute("color", new THREE.BufferAttribute(layout.colors, 3));
    return g;
  }, [layout, live]);

  const lineGeom = useMemo(() => {
    const g = new THREE.BufferGeometry();
    g.setAttribute(
      "position",
      new THREE.BufferAttribute(new Float32Array(layout.pairs.length * 6), 3),
    );
    g.setAttribute(
      "color",
      new THREE.BufferAttribute(new Float32Array(layout.pairs.length * 6), 3),
    );
    return g;
  }, [layout]);

  // The travelling transaction pulse rides the traced path.
  const pulseGeom = useMemo(() => {
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.BufferAttribute(new Float32Array(3), 3));
    return g;
  }, []);

  useFrame((state, delta) => {
    if (!scrollState.visible) return;
    const p = scrollState.progress;
    const t = state.clock.elapsedTime;

    // Phase weights — the same cloud continuously restated.
    const toPath = ramp(p, 0.14, 0.34);
    const toCluster = ramp(p, 0.36, 0.55);
    const toConverge = ramp(p, 0.78, 0.97);

    const pos = pointGeom.attributes["position"]!.array as Float32Array;
    const col = pointGeom.attributes["color"]!.array as Float32Array;

    for (let i = 0; i < layout.count; i++) {
      const i3 = i * 3;
      for (let a = 0; a < 3; a++) {
        let target = layout.scatter[i3 + a]!;
        target = lerp(target, layout.path[i3 + a]!, toPath);
        target = lerp(target, layout.cluster[i3 + a]!, toCluster);
        target = lerp(target, layout.converge[i3 + a]!, toConverge);
        // Ambient drift keeps the network alive without interaction.
        const drift =
          Math.sin(t * 0.35 + i * 0.7 + a * 2.1) * (a === 2 ? 0.5 : 0.32) *
          (1 - toConverge * 0.7);
        pos[i3 + a] = lerp(pos[i3 + a]!, target + drift, 1 - Math.exp(-delta * 2.4));
      }

      // Signal extraction: irrelevant nodes dim as the path is isolated.
      const isPath = i < PATH_COUNT;
      const focus = isPath ? 1 : lerp(1, 0.22, ramp(p, 0.16, 0.3) * (1 - toCluster * 0.55));
      const pulse = isPath ? 0.55 + 0.45 * Math.sin(t * 2.2 - i * 0.6) : 1;
      const k = focus * pulse;
      col[i3] = layout.colors[i3]! * k;
      col[i3 + 1] = layout.colors[i3 + 1]! * k;
      col[i3 + 2] = layout.colors[i3 + 2]! * k;
    }
    pointGeom.attributes["position"]!.needsUpdate = true;
    pointGeom.attributes["color"]!.needsUpdate = true;

    // Rebuild visible edges from the live node positions.
    const lp = lineGeom.attributes["position"]!.array as Float32Array;
    const lc = lineGeom.attributes["color"]!.array as Float32Array;
    const edgeReveal = clamp01(ramp(p, 0.05, 0.3) + toCluster);
    for (let e = 0; e < layout.pairs.length; e++) {
      const [i, j] = layout.pairs[e]! as [number, number];
      const o = e * 6;
      lp[o] = pos[i * 3]!;
      lp[o + 1] = pos[i * 3 + 1]!;
      lp[o + 2] = pos[i * 3 + 2]!;
      lp[o + 3] = pos[j * 3]!;
      lp[o + 4] = pos[j * 3 + 1]!;
      lp[o + 5] = pos[j * 3 + 2]!;
      const traced = i < PATH_COUNT && j < PATH_COUNT;
      // Cull over-long edges: once the camera moves inside the network they
      // read as screen-spanning streaks rather than relationships.
      const ex = pos[j * 3]! - pos[i * 3]!;
      const ey = pos[j * 3 + 1]! - pos[i * 3 + 1]!;
      const ez = pos[j * 3 + 2]! - pos[i * 3 + 2]!;
      const len2 = ex * ex + ey * ey + ez * ez;
      if (!traced && len2 > 48) {
        lp[o + 3] = lp[o]!;
        lp[o + 4] = lp[o + 1]!;
        lp[o + 5] = lp[o + 2]!;
      }
      const b = traced ? 1 : 0.11 * edgeReveal;
      const c = traced ? SIGNAL : ACCENT;
      for (let v = 0; v < 2; v++) {
        lc[o + v * 3] = c.r * b;
        lc[o + v * 3 + 1] = c.g * b;
        lc[o + v * 3 + 2] = c.b * b;
      }
    }
    lineGeom.attributes["position"]!.needsUpdate = true;
    lineGeom.attributes["color"]!.needsUpdate = true;

    // Flow pulse along the traced hops.
    if (glow.current) {
      const active = toPath * (1 - toConverge);
      const seg = (t * 0.28) % 1;
      const f = seg * (PATH_COUNT - 1);
      const i = Math.min(PATH_COUNT - 2, Math.floor(f));
      const fr = f - i;
      const gp = pulseGeom.attributes["position"]!.array as Float32Array;
      for (let a = 0; a < 3; a++) {
        gp[a] = lerp(pos[i * 3 + a]!, pos[(i + 1) * 3 + a]!, fr);
      }
      pulseGeom.attributes["position"]!.needsUpdate = true;
      (glow.current.material as THREE.PointsMaterial).opacity = active;
    }

    // Camera: a single continuous move into and through the network.
    // Keep the camera outside the cloud: inside it, long edges read as
    // screen-spanning streaks over the copy instead of a network.
    const zoom =
      lerp(38, 26, ramp(p, 0, 0.34)) +
      ramp(p, 0.34, 0.62) * 4 +
      ramp(p, 0.62, 1) * 10;
    camera.position.z = lerp(camera.position.z, zoom, 1 - Math.exp(-delta * 2));
    camera.position.x = lerp(
      camera.position.x,
      scrollState.pointerX * 3.2 + Math.sin(t * 0.12) * 0.8,
      1 - Math.exp(-delta * 1.6),
    );
    camera.position.y = lerp(
      camera.position.y,
      -scrollState.pointerY * 2.2 + Math.cos(t * 0.1) * 0.6,
      1 - Math.exp(-delta * 1.6),
    );
    camera.lookAt(0, 0, 0);

    if (group.current) {
      group.current.rotation.y = lerp(
        group.current.rotation.y,
        scrollState.pointerX * 0.18 + p * 0.55,
        1 - Math.exp(-delta * 1.4),
      );
      group.current.rotation.x = lerp(
        group.current.rotation.x,
        -scrollState.pointerY * 0.12 + Math.sin(t * 0.08) * 0.03,
        1 - Math.exp(-delta * 1.4),
      );
    }

    // Recede behind the narrative once the story becomes text-led.
    const recede =
      (1 - 0.45 * ramp(p, 0.42, 0.8)) * (1 - 0.3 * ramp(p, 0.82, 1));
    if (lines.current) {
      (lines.current.material as THREE.LineBasicMaterial).opacity =
        0.34 * recede;
    }
    if (points.current) {
      (points.current.material as THREE.PointsMaterial).opacity =
        0.95 * recede;
    }

    if (blocks.current) {
      blocks.current.rotation.y += delta * 0.06;
      blocks.current.children.forEach((child, i) => {
        child.rotation.x += delta * (0.08 + i * 0.015);
        child.rotation.z += delta * 0.04;
      });
      blocks.current.visible = toConverge < 0.85;
    }
  });

  return (
    <group ref={group}>
      <points ref={points} geometry={pointGeom}>
        <pointsMaterial
          vertexColors
          size={lite ? 0.42 : 0.3}
          sizeAttenuation
          transparent
          opacity={0.95}
          depthWrite={false}
          blending={THREE.AdditiveBlending}
        />
      </points>

      <lineSegments ref={lines} geometry={lineGeom}>
        <lineBasicMaterial
          vertexColors
          transparent
          opacity={0.42}
          depthWrite={false}
          blending={THREE.AdditiveBlending}
        />
      </lineSegments>

      <points ref={glow} geometry={pulseGeom}>
        <pointsMaterial
          color="#EAF2FF"
          size={1.5}
          sizeAttenuation
          transparent
          opacity={0}
          depthWrite={false}
          blending={THREE.AdditiveBlending}
        />
      </points>

      {/* Ledger blocks — restrained crypto symbolism, not floating coins. */}
      <group ref={blocks}>
        {[
          [-14, 6, -12, 2.4],
          [17, -7, -18, 3.2],
          [8, 9, -26, 4],
          [-20, -8, -22, 2.8],
        ].map(([x, y, z, s], i) => (
          <mesh key={i} position={[x!, y!, z!]}>
            <cylinderGeometry args={[s! * 0.5, s! * 0.5, s! * 0.22, 6]} />
            <meshBasicMaterial
              color={i % 2 ? "#6E8CFF" : "#4DA3FF"}
              wireframe
              transparent
              opacity={0.22}
            />
          </mesh>
        ))}
      </group>
    </group>
  );
}

export default function NetworkScene({ lite = false }: { lite?: boolean }) {
  return (
    <Canvas
      dpr={lite ? 1 : [1, 1.75]}
      gl={{ antialias: !lite, powerPreference: "high-performance", alpha: true }}
      camera={{ position: [0, 0, 34], fov: 58, near: 0.1, far: 220 }}
      style={{ pointerEvents: "none" }}
    >
      <fog attach="fog" args={["#06070A", 34, 120]} />
      <Network lite={lite} />
    </Canvas>
  );
}
