"use client";

import { Suspense, useRef } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { Float } from "@react-three/drei";
import type { Group } from "three";
import styles from "./eye-scene.module.css";

const EyeModel = () => {
  const groupRef = useRef<Group>(null);

  useFrame((_, delta) => {
    if (!groupRef.current) {
      return;
    }

    groupRef.current.rotation.y += delta * 0.35;
    groupRef.current.rotation.x = Math.sin(performance.now() * 0.0004) * 0.12;
  });

  return (
    <Float speed={1.2} rotationIntensity={0.25} floatIntensity={0.45}>
      <group ref={groupRef}>
        <mesh>
          <sphereGeometry args={[1.1, 48, 48]} />
          <meshStandardMaterial color="#bccbff" roughness={0.15} metalness={0.08} />
        </mesh>
        <mesh scale={0.45} position={[0.35, 0.08, 0.88]}>
          <sphereGeometry args={[1, 32, 32]} />
          <meshStandardMaterial color="#2d3d75" roughness={0.25} metalness={0.5} />
        </mesh>
      </group>
    </Float>
  );
};

export const EyeScene = () => {
  return (
    <div className={styles.scene} aria-hidden>
      <Canvas
        dpr={[1, 1.5]}
        frameloop="demand"
        gl={{ antialias: false, alpha: true, powerPreference: "high-performance" }}
        camera={{ fov: 36, position: [0, 0, 6.8] }}
      >
        <ambientLight intensity={0.8} />
        <directionalLight position={[2, 3, 4]} intensity={1.2} />
        <pointLight position={[-3, -2, 2]} intensity={0.45} />
        <Suspense fallback={null}>
          <EyeModel />
        </Suspense>
      </Canvas>
    </div>
  );
};
