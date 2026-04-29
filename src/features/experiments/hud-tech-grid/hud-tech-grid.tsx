"use client";

/**
 * HUD 테크 그리드 — R3F + ShaderMaterial 단일 패스 (독립 실험 모듈).
 * 기존 grid-background 소스와 무관.
 */

import { Canvas, useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";
import { Suspense, useLayoutEffect, useMemo, useRef } from "react";
import styles from "./hud-tech-grid.module.css";
import { hudTechFragmentShader, hudTechVertexShader } from "./hud-tech-grid-shaders";

export type HudTechGridProps = {
  /** 셀 한 변(px) — 작을수록 촘촘한 격자 */
  cellPx?: number;
  /** 메이저 교차(플러스) 주기 — 셀 몇 칸마다 */
  majorEvery?: number;
  /** 가로 방향 미세 워프 강도 (0이면 평면) */
  warp?: number;
};

function HudTechPlane({ cellPx, majorEvery, warp }: { cellPx: number; majorEvery: number; warp: number }) {
  const materialRef = useRef<THREE.ShaderMaterial>(null);
  const camera = useThree((s) => s.camera);
  const size = useThree((s) => s.size);

  const w = Math.max(1, size.width);
  const h = Math.max(1, size.height);

  const uniforms = useMemo(
    () => ({
      u_resolution: { value: new THREE.Vector2(1, 1) },
      u_time: { value: 0 },
      u_cell_px: { value: cellPx },
      u_major_step: { value: majorEvery },
      u_warp: { value: warp },
    }),
    [cellPx, majorEvery, warp],
  );

  useLayoutEffect(() => {
    const o = camera as THREE.OrthographicCamera;
    o.left = 0;
    o.right = w;
    o.bottom = 0;
    o.top = h;
    o.position.set(w / 2, h / 2, 400);
    o.near = -800;
    o.far = 800;
    o.zoom = 1;
    o.updateProjectionMatrix();
  }, [camera, w, h]);

  useFrame((state) => {
    const mat = materialRef.current;
    if (!mat) return;
    const sw = Math.max(1, state.size.width);
    const sh = Math.max(1, state.size.height);
    mat.uniforms.u_resolution.value.set(sw, sh);
    mat.uniforms.u_time.value = state.clock.elapsedTime;
  });

  const geo = useMemo(() => new THREE.PlaneGeometry(w, h, 1, 1), [w, h]);

  return (
    <mesh geometry={geo} position={[w / 2, h / 2, 0]} scale={[1, -1, 1]}>
      <shaderMaterial
        ref={materialRef}
        vertexShader={hudTechVertexShader}
        fragmentShader={hudTechFragmentShader}
        uniforms={uniforms}
        depthWrite={false}
        depthTest={false}
        toneMapped={false}
      />
    </mesh>
  );
}

export function HudTechGrid({
  cellPx = 26,
  majorEvery = 3,
  warp = 0.07,
}: HudTechGridProps) {
  const dpr =
    typeof window !== "undefined" ? Math.min(2, window.devicePixelRatio || 1) : 1;

  return (
    <div className={styles.root}>
      <Canvas
        className={styles.canvas}
        orthographic
        frameloop="always"
        dpr={dpr}
        gl={{
          antialias: true,
          alpha: false,
          powerPreference: "high-performance",
        }}
      >
        <color attach="background" args={["#a082c8"]} />
        <Suspense fallback={null}>
          <HudTechPlane cellPx={cellPx} majorEvery={majorEvery} warp={warp} />
        </Suspense>
      </Canvas>
    </div>
  );
}
