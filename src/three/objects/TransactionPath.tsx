/**
 * A traced value path: a precise thin polyline through wallet hops with a
 * luminous pulse riding along it. Reveal can be driven either by a prop or by a
 * ref written in the render loop (no React render per frame).
 */
import { useMemo, useRef, type MutableRefObject } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";

import { PAL } from "../materials/palette";
import type { Vec3 } from "../utils/storyConfig";

export function useCurve(points: Vec3[]) {
  return useMemo(
    () => new THREE.CatmullRomCurve3(points.map((p) => new THREE.Vector3(...p))),
    [points],
  );
}

export function TransactionPath({
  curve,
  reveal = 1,
  revealRef,
  color = PAL.signal,
  speed = 0.16,
  pulses = 3,
}: {
  curve: THREE.CatmullRomCurve3;
  reveal?: number;
  revealRef?: MutableRefObject<number>;
  color?: THREE.Color;
  speed?: number;
  pulses?: number;
}) {
  const line = useRef<THREE.Line>(null);
  const group = useRef<THREE.Group>(null);
  const SEG = 200;

  const geom = useMemo(() => {
    const g = new THREE.BufferGeometry();
    g.setAttribute(
      "position",
      new THREE.BufferAttribute(new Float32Array((SEG + 1) * 3), 3),
    );
    return g;
  }, []);

  const v = useMemo(() => new THREE.Vector3(), []);

  useFrame((state) => {
    const t = state.clock.elapsedTime;
    const r = revealRef ? revealRef.current : reveal;
    const shown = Math.max(0.001, r);
    const arr = geom.attributes["position"]!.array as Float32Array;
    for (let i = 0; i <= SEG; i++) {
      curve.getPoint((i / SEG) * shown, v);
      arr[i * 3] = v.x;
      arr[i * 3 + 1] = v.y;
      arr[i * 3 + 2] = v.z;
    }
    geom.attributes["position"]!.needsUpdate = true;
    if (line.current) {
      (line.current.material as THREE.LineBasicMaterial).opacity = 0.9 * r;
    }
    if (group.current) {
      group.current.visible = r > 0.02;
      group.current.children.forEach((child, i) => {
        const u = ((t * speed + i / pulses) % 1) * shown;
        curve.getPoint(u, v);
        child.position.copy(v);
        const m = (child as THREE.Mesh).material as THREE.MeshBasicMaterial;
        m.opacity = r * (0.45 + 0.55 * Math.sin(u * Math.PI));
      });
    }
  });

  return (
    <group>
      {/* @ts-expect-error three-fiber line intrinsic */}
      <line ref={line} geometry={geom}>
        <lineBasicMaterial
          color={color}
          transparent
          opacity={0.9}
          toneMapped={false}
        />
      </line>
      <group ref={group}>
        {Array.from({ length: pulses }, (_, i) => (
          <mesh key={i}>
            <sphereGeometry args={[0.32, 12, 12]} />
            <meshBasicMaterial
              color={PAL.light}
              transparent
              opacity={0.9}
              toneMapped={false}
            />
          </mesh>
        ))}
      </group>
    </group>
  );
}
