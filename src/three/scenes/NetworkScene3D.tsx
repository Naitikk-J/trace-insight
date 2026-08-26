/**
 * CHAPTER 04/05 — THE NETWORK, THEN THE CLUSTER.
 *
 * The camera pulls back and the linear trace turns out to be one thread in a
 * far larger topology. As the story advances the same nodes reorganise from a
 * scattered field into a single geometric entity structure: the moment
 * attribution happens.
 */
import { useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";

import { PAL } from "../materials/palette";
import { DataFragment } from "../objects/DataFragments";
import { lerp, ramp, rng } from "../utils/animationUtils";
import { story } from "../utils/storyState";
import { DEPTH } from "../utils/storyConfig";

export function NetworkScene3D({ lite }: { lite: boolean }) {
  const count = lite ? 260 : 620;
  const mesh = useRef<THREE.InstancedMesh>(null);
  const lines = useRef<THREE.LineSegments>(null);
  const shell = useRef<THREE.Mesh>(null);
  const dummy = useMemo(() => new THREE.Object3D(), []);

  const data = useMemo(() => {
    const rand = rng(31337);
    // Entity anchors the addresses resolve into.
    const anchors = Array.from({ length: 6 }, (_, i) => {
      const a = (i / 6) * Math.PI * 2;
      return new THREE.Vector3(
        Math.cos(a) * 15,
        Math.sin(a) * 9,
        DEPTH.cluster + Math.sin(a * 2) * 8,
      );
    });

    const scatter: THREE.Vector3[] = [];
    const cluster: THREE.Vector3[] = [];
    const scale: number[] = [];
    const color = new Float32Array(count * 3);

    for (let i = 0; i < count; i++) {
      const a = rand() * Math.PI * 2;
      const r = 14 + rand() * 46;
      scatter.push(
        new THREE.Vector3(
          Math.cos(a) * r,
          (rand() - 0.5) * 44,
          DEPTH.network + (rand() - 0.5) * 66,
        ),
      );
      const anchor = anchors[i % anchors.length]!;
      cluster.push(
        new THREE.Vector3(
          anchor.x + (rand() - 0.5) * 7,
          anchor.y + (rand() - 0.5) * 6,
          anchor.z + (rand() - 0.5) * 7,
        ),
      );
      scale.push(0.35 + rand() * 0.7);
      const roll = rand();
      const c =
        roll > 0.97
          ? PAL.critical
          : roll > 0.9
            ? PAL.verified
            : roll > 0.7
              ? PAL.violet
              : roll > 0.4
                ? PAL.accent
                : PAL.grey;
      color[i * 3] = c.r;
      color[i * 3 + 1] = c.g;
      color[i * 3 + 2] = c.b;
    }

    const pairs: [number, number][] = [];
    for (let i = 0; i < count; i += 2) {
      let best = -1;
      let bestD = Infinity;
      for (let k = 0; k < 12; k++) {
        const j = Math.floor(rand() * count);
        if (j === i) continue;
        const d = cluster[i]!.distanceToSquared(cluster[j]!);
        if (d < bestD) {
          bestD = d;
          best = j;
        }
      }
      if (best >= 0) pairs.push([i, best]);
    }
    return { scatter, cluster, scale, color, pairs };
  }, [count]);

  const lineGeom = useMemo(() => {
    const g = new THREE.BufferGeometry();
    g.setAttribute(
      "position",
      new THREE.BufferAttribute(new Float32Array(data.pairs.length * 6), 3),
    );
    return g;
  }, [data]);

  const live = useMemo(
    () => data.scatter.map((v) => v.clone()),
    [data],
  );

  useFrame((state, delta) => {
    const p = story.progress;
    const t = state.clock.elapsedTime;
    const alive = ramp(p, 0.46, 0.53) * (1 - ramp(p, 0.7, 0.76));
    const toCluster = ramp(p, 0.58, 0.68);

    const m = mesh.current;
    if (m) {
      m.visible = alive > 0.02;
      if (m.visible) {
        const k = 1 - Math.exp(-delta * 2.6);
        for (let i = 0; i < count; i++) {
          const from = data.scatter[i]!;
          const to = data.cluster[i]!;
          const target = live[i]!;
          target.x = lerp(target.x, lerp(from.x, to.x, toCluster), k);
          target.y = lerp(target.y, lerp(from.y, to.y, toCluster), k);
          target.z = lerp(target.z, lerp(from.z, to.z, toCluster), k);
          dummy.position.set(
            target.x + Math.sin(t * 0.3 + i) * 0.4 * (1 - toCluster),
            target.y + Math.cos(t * 0.26 + i) * 0.4 * (1 - toCluster),
            target.z,
          );
          dummy.rotation.set(t * 0.1 + i, t * 0.08, 0);
          dummy.scale.setScalar(data.scale[i]! * (0.6 + 0.6 * alive));
          dummy.updateMatrix();
          m.setMatrixAt(i, dummy.matrix);
        }
        m.instanceMatrix.needsUpdate = true;
        (m.material as THREE.MeshBasicMaterial).opacity = alive;
      }
    }

    if (lines.current) {
      lines.current.visible = alive > 0.05;
      if (lines.current.visible) {
        const arr = lineGeom.attributes["position"]!.array as Float32Array;
        data.pairs.forEach(([i, j], e) => {
          const a = live[i]!;
          const b = live[j]!;
          const o = e * 6;
          arr[o] = a.x;
          arr[o + 1] = a.y;
          arr[o + 2] = a.z;
          // Long edges are culled: inside the cloud they read as streaks.
          const far = a.distanceToSquared(b) > 900;
          arr[o + 3] = far ? a.x : b.x;
          arr[o + 4] = far ? a.y : b.y;
          arr[o + 5] = far ? a.z : b.z;
        });
        lineGeom.attributes["position"]!.needsUpdate = true;
        (lines.current.material as THREE.LineBasicMaterial).opacity =
          (0.06 + 0.16 * toCluster) * alive;
      }
    }

    if (shell.current) {
      // Entity envelope: appears only once the cluster is resolved.
      shell.current.visible = toCluster > 0.15;
      shell.current.rotation.y += delta * 0.08;
      shell.current.rotation.x += delta * 0.03;
      (shell.current.material as THREE.MeshBasicMaterial).opacity =
        0.1 * toCluster * alive;
    }
  });

  return (
    <group>
      <instancedMesh ref={mesh} args={[undefined, undefined, count]}>
        <icosahedronGeometry args={[0.55, 0]} />
        <meshBasicMaterial transparent opacity={1} toneMapped={false} />
        <instancedBufferAttribute attach="instanceColor" args={[data.color, 3]} />
      </instancedMesh>

      <lineSegments ref={lines} geometry={lineGeom}>
        <lineBasicMaterial
          color={PAL.accent}
          transparent
          opacity={0.1}
          depthWrite={false}
          blending={THREE.AdditiveBlending}
        />
      </lineSegments>

      <mesh ref={shell} position={[0, 0, DEPTH.cluster]}>
        <icosahedronGeometry args={[26, 1]} />
        <meshBasicMaterial
          color={PAL.violet}
          wireframe
          transparent
          opacity={0.1}
          depthWrite={false}
        />
      </mesh>

      <DataFragment
        position={[0, 20, DEPTH.cluster]}
        label="ENTITY CLUSTER · 38 ADDRESSES"
        size={1.1}
        color={PAL.violet}
        near={46}
        far={110}
      />
    </group>
  );
}
