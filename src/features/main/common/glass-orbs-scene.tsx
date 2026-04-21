"use client";

import { useEffect, useMemo, useRef, type ReactNode } from "react";
import type { RefObject } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { Environment, Lightformer, MeshTransmissionMaterial } from "@react-three/drei";
import * as THREE from "three";
import type { Texture } from "three";
import { Brush, Evaluator, SUBTRACTION } from "three-bvh-csg";
import { Mesh, SphereGeometry, type BufferGeometry } from "three";
import { useDomTransmissionTexture } from "@/features/main/common/use-dom-transmission-texture";
import styles from "./glass-orbs-scene.module.css";

type Vector3Tuple = [number, number, number];

export type PointerNDC = { x: number; y: number };

const ORB_RADIUS = 1.72;
const ORB_SCALE: Vector3Tuple = [1, 1, 0.62];
const LEFT_ORB_POSITION: Vector3Tuple = [-1.3, 0, 0];
const RIGHT_ORB_POSITION: Vector3Tuple = [1.15, 0, 0.02];
const CUTTER_OFFSET_X = LEFT_ORB_POSITION[0] - RIGHT_ORB_POSITION[0];
const CUTTER_RADIUS = ORB_RADIUS * 1.02;

const GLASS_CONFIG = {
  backside: true,
  backsideThickness: 0.15,
  samples: 10,
  resolution: 1024,
  transmission: 1,
  clearcoat: 1,
  clearcoatRoughness: 0,
  thickness: 0.35,
  chromaticAberration: 0.15,
  anisotropy: 0.25,
  roughness: 0,
  distortion: 0.5,
  distortionScale: 0.1,
  temporalDistortion: 0,
  ior: 1.25,
  color: "#ffffff",
  attenuationColor: "#ffffff",
  attenuationDistance: 12,
} as const;

/** 월드 XY 평면(z=0)과 레이 교차 — 렌즈 그룹 이동 목표 */
const TRACK_PLANE = new THREE.Plane(new THREE.Vector3(0, 0, 1), 0);

const createCrescentGeometry = (): BufferGeometry => {
  const base = new Brush(new SphereGeometry(ORB_RADIUS, 128, 128));
  base.updateMatrixWorld();

  const cutter = new Brush(new SphereGeometry(CUTTER_RADIUS, 96, 96));
  cutter.position.set(CUTTER_OFFSET_X, 0, 0);
  cutter.updateMatrixWorld();

  const evaluator = new Evaluator();
  const result = evaluator.evaluate(base, cutter, SUBTRACTION) as Mesh;
  const geometry = result.geometry;
  geometry.computeVertexNormals();
  return geometry;
};

interface OrbProps {
  position: Vector3Tuple;
  geometry?: BufferGeometry;
  buffer: Texture;
}

const GlassOrb = ({ position, geometry, buffer }: OrbProps) => {
  return (
    <mesh position={position} scale={ORB_SCALE} geometry={geometry}>
      {!geometry && <sphereGeometry args={[ORB_RADIUS, 128, 128]} />}
      <MeshTransmissionMaterial {...GLASS_CONFIG} buffer={buffer} transparent />
    </mesh>
  );
};

const StudioEnvironment = () => {
  return (
    <Environment preset="studio" resolution={512} environmentIntensity={0.95}>
      <group rotation={[-Math.PI / 3, 0, 0]}>
        <Lightformer
          intensity={4}
          rotation-x={Math.PI / 2}
          position={[0, 5, -9]}
          scale={[10, 10, 1]}
        />
        {[2, 0, 2, 0, 2, 0, 2, 0].map((x, index) => (
          <Lightformer
            key={index}
            form="circle"
            intensity={4}
            rotation={[Math.PI / 2, 0, 0]}
            position={[x, 4, index * 4]}
            scale={[4, 1, 1]}
          />
        ))}
        <Lightformer
          intensity={2}
          rotation-y={Math.PI / 2}
          position={[-5, 1, -1]}
          scale={[50, 2, 1]}
        />
        <Lightformer
          intensity={2}
          rotation-y={-Math.PI / 2}
          position={[10, 1, 0]}
          scale={[50, 2, 1]}
        />
      </group>
    </Environment>
  );
};

interface LensRigProps {
  pointerRef: RefObject<PointerNDC>;
  children: ReactNode;
}

const LensRig = ({ pointerRef, children }: LensRigProps) => {
  const groupRef = useRef<THREE.Group>(null);
  const hit = useMemo(() => new THREE.Vector3(), []);

  useFrame((state, delta) => {
    const group = groupRef.current;
    if (!group) {
      return;
    }

    const { raycaster, camera, pointer } = state;
    const ref = pointerRef.current;
    pointer.set(ref.x, ref.y);
    raycaster.setFromCamera(pointer, camera);

    const didHit = raycaster.ray.intersectPlane(TRACK_PLANE, hit);
    if (!didHit) {
      return;
    }

    const maxX = 0.52;
    const maxY = 0.38;
    const gain = 0.24;
    const tx = THREE.MathUtils.clamp(hit.x * gain, -maxX, maxX);
    const ty = THREE.MathUtils.clamp(hit.y * gain, -maxY, maxY);

    const smooth = 1 - Math.exp(-delta * 5.2);
    group.position.x = THREE.MathUtils.lerp(group.position.x, tx, smooth);
    group.position.y = THREE.MathUtils.lerp(group.position.y, ty, smooth);
  });

  return <group ref={groupRef}>{children}</group>;
};

interface GlassOrbsContentProps {
  bufferTexture: Texture | null;
  pointerRef: RefObject<PointerNDC>;
}

function GlassOrbsContent({ bufferTexture, pointerRef }: GlassOrbsContentProps) {
  const crescentGeometry = useMemo(() => createCrescentGeometry(), []);

  if (!bufferTexture) {
    return null;
  }

  return (
    <>
      <StudioEnvironment />
      <LensRig pointerRef={pointerRef}>
        <GlassOrb position={LEFT_ORB_POSITION} buffer={bufferTexture} />
        <GlassOrb position={RIGHT_ORB_POSITION} geometry={crescentGeometry} buffer={bufferTexture} />
      </LensRig>
    </>
  );
}

export interface GlassOrbsSceneProps {
  transmissionSourceRef: RefObject<HTMLElement | null>;
}

export const GlassOrbsScene = ({ transmissionSourceRef }: GlassOrbsSceneProps) => {
  const bufferTexture = useDomTransmissionTexture(transmissionSourceRef);
  const sceneWrapRef = useRef<HTMLDivElement>(null);
  const pointerNdcRef = useRef<PointerNDC>({ x: 0, y: 0 });

  useEffect(() => {
    const updateFromEvent = (clientX: number, clientY: number) => {
      const canvas = sceneWrapRef.current?.querySelector("canvas");
      if (!canvas) {
        return;
      }
      const rect = canvas.getBoundingClientRect();
      if (rect.width <= 0 || rect.height <= 0) {
        return;
      }
      pointerNdcRef.current.x = ((clientX - rect.left) / rect.width) * 2 - 1;
      pointerNdcRef.current.y = -((clientY - rect.top) / rect.height) * 2 + 1;
    };

    const onPointerMove = (event: PointerEvent) => {
      updateFromEvent(event.clientX, event.clientY);
    };

    window.addEventListener("pointermove", onPointerMove, { passive: true });

    return () => {
      window.removeEventListener("pointermove", onPointerMove);
    };
  }, []);

  return (
    <div ref={sceneWrapRef} className={styles.sceneWrap} aria-hidden>
      {/*
        배경: 일반 DOM (MainPage backdropRef → GlassOrbsScene transmissionSourceRef).
        위에 투명 WebGL Canvas — pointer-events: none으로 클릭은 뒤 DOM으로 통과.
        마우스 좌표는 window pointermove로 캔버스 기준 NDC를 계산해 raycaster에 전달.
      */}
      <Canvas
        key="shinsegae-glass-canvas"
        dpr={[1, 1.6]}
        gl={(defaults) =>
          new THREE.WebGLRenderer({
            ...defaults,
            alpha: true,
            antialias: true,
            depth: true,
            stencil: false,
            powerPreference: "high-performance",
            failIfMajorPerformanceCaveat: false,
          })
        }
        camera={{ position: [0, 0, 6.4], fov: 32 }}
      >
        <GlassOrbsContent bufferTexture={bufferTexture} pointerRef={pointerNdcRef} />
      </Canvas>
    </div>
  );
};
