"use client";

/**
 * 속이 빈 원기둥 — SVG GridBackground 와 동일한 비주얼(그라데이션·격자선·글로우·십자)을
 * 진짜 3D 원통 내벽 ShaderMaterial 로 렌더. 카메라는 축 중앙(원점)에서 안벽을 바라본다.
 *
 * 핵심 차이: SVG는 "평면을 getWarpedY로 휘어 원통처럼 보이게" 했다면,
 * 여기서는 실제 CylinderGeometry(BackSide) 위에 직선 격자를 그려
 * 3D 원근이 자연스럽게 곡률을 만든다.
 */

import { Canvas, useFrame, useThree } from "@react-three/fiber";
import {
  Suspense,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  type MutableRefObject,
} from "react";
import * as THREE from "three";
import { CELL_SIZE_REM } from "./grid-background-math";

const CYLINDER_RADIUS_REM = 80;

/** 스크롤 1px 당 원통 회전량 (rad). 값이 클수록 빠르게 돈다 */
const RAD_PER_SCROLL_PX = 0.0004;
/** 현재값 → 타겟 보간 계수 (0~1). 낮을수록 관성이 큼 */
const LERP_FACTOR = 0.08;

/** 스크롤 속도에 비례해 원기둥이 위아래로 밀리는 최대 px */
const Y_SHIFT_MAX_PX = 60;
/** Y 이동 보간 계수 */
const Y_SHIFT_LERP = 0.06;

function readRemPx(): number {
  if (typeof window === "undefined") return 16;
  return parseFloat(getComputedStyle(document.documentElement).fontSize);
}

/* ─── vertex ─────────────────────────────────────────────────────────── */
const vertShader = /* glsl */ `
varying vec2 vUv;
void main() {
  vUv = uv;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
`;

/* ─── fragment ───────────────────────────────────────────────────────── */
const fragShader = /* glsl */ `
precision highp float;

uniform vec2  u_resolution;
uniform float u_circumference;
uniform float u_height;
uniform float u_cell_px;
uniform float u_time;
uniform float u_reduced_motion;

varying vec2 vUv;

const float LINE_STROKE_A = 0.34;
const float LINE_LAYER_A  = 0.72;
const float LINE_BLEND_A  = LINE_STROKE_A * LINE_LAYER_A;
const float GLOW_LAYER_A  = 0.9;

float clamp01(float v) { return clamp(v, 0.0, 1.0); }

float seededNoise(float seed) {
  return fract(sin(seed * 12.9898) * 43758.5453);
}

float pulse_keyframe_opacity(float ph01) {
  float u = clamp01(ph01);
  if (u <= 0.38) return mix(0.0, 0.06, u / 0.38);
  if (u <= 0.50) return mix(0.06, 0.38, (u - 0.38) / 0.12);
  if (u <= 0.62) return mix(0.38, 0.07, (u - 0.50) / 0.12);
  return mix(0.07, 0.0, (u - 0.62) / 0.38);
}

float sd_segment(vec2 p, vec2 a, vec2 b) {
  vec2 pa = p - a;
  vec2 ba = b - a;
  float h = clamp(dot(pa, ba) / max(dot(ba, ba), 1e-9), 0.0, 1.0);
  return length(pa - ba * h);
}

vec3 grad_bg(vec2 sUv) {
  vec3 c0 = vec3(147.0, 110.0, 196.0) / 255.0;
  vec3 c1 = vec3(186.0, 123.0, 153.0) / 255.0;
  vec2 dir = normalize(vec2(cos(radians(105.0)), sin(radians(105.0))));
  float t = dot(sUv - 0.5, dir) + 0.5;
  return mix(c0, c1, clamp01(t));
}

void main() {
  float sx = vUv.x * u_circumference;
  float sy = (1.0 - vUv.y) * u_height;

  float nCols = max(1.0, ceil(u_circumference / max(u_cell_px, 1.0)));
  float nRows = max(1.0, ceil(u_height / max(u_cell_px, 1.0)));
  float stepX = u_circumference / nCols;
  float stepY = u_height / nRows;

  float dv = mod(sx, stepX);  dv = min(dv, stepX - dv);
  float dh = mod(sy, stepY);  dh = min(dh, stepY - dh);
  float d_grid = min(dv, dh);

  float fw = max(fwidth(sx), fwidth(sy));
  float lnH = 0.5 * max(fw, 0.35);
  float lnAA = 0.65 * max(fw, 0.35);
  float line_cov = 1.0 - smoothstep(lnH, lnH + lnAA, d_grid);

  float colIdx = floor(sx / stepX);
  float rowIdx = floor(sy / stepY);

  float glow_mix = 0.0;
  if (mod(rowIdx + colIdx, 2.0) < 0.5) {
    float k_cell = rowIdx * nCols + colIdx;
    float delay_sec = seededNoise(k_cell + 1.0) * 7.0;
    float dur_sec   = 3.6 + seededNoise(k_cell + 17.0) * 4.8;
    float alpha_fill = 0.34 + seededNoise(k_cell + 41.0) * 0.42;
    if (u_reduced_motion > 0.5) {
      glow_mix = alpha_fill * 0.04 * GLOW_LAYER_A;
    } else {
      float elapsed = u_time - delay_sec;
      float ph = elapsed > 0.0 ? mod(elapsed, dur_sec) / max(dur_sec, 1e-6) : 0.0;
      glow_mix = alpha_fill * pulse_keyframe_opacity(ph) * GLOW_LAYER_A;
    }
  }

  vec2 sUv = gl_FragCoord.xy / u_resolution;
  sUv.y = 1.0 - sUv.y;
  vec3 rgb = grad_bg(sUv);

  rgb = mix(rgb, vec3(1.0), clamp01(glow_mix * 0.94));
  rgb = mix(rgb, vec3(1.0), LINE_BLEND_A * line_cov);

  float crossStepX = stepX * 2.0;
  float crossStepY = stepY * 2.0;
  float nearCX = floor(sx / crossStepX + 0.5) * crossStepX;
  float nearCY = floor(sy / crossStepY + 0.5) * crossStepY;
  vec2 p = vec2(sx, sy);
  float arm = 5.0;
  float dCH = sd_segment(p, vec2(nearCX - arm, nearCY), vec2(nearCX + arm, nearCY));
  float dCV = sd_segment(p, vec2(nearCX, nearCY - arm), vec2(nearCX, nearCY + arm));
  float d_tick = min(dCH, dCV);
  float tick_cov = 1.0 - smoothstep(lnH, lnH + lnAA, d_tick);
  rgb = mix(rgb, vec3(1.0), tick_cov);

  gl_FragColor = vec4(rgb, 1.0);
}
`;

/* ─── R3F components ─────────────────────────────────────────────────── */

/** 스크롤 누적량을 관성 보간으로 Y축 회전 + Y 이동으로 변환 */
function useScrollMotion(visibleRef: MutableRefObject<boolean>) {
  const rotTargetRef = useRef(0);
  const rotCurrentRef = useRef(0);

  const yShiftTargetRef = useRef(0);
  const yShiftCurrentRef = useRef(0);

  const rafRef = useRef<number | null>(null);

  useEffect(() => {
    let isRunning = false;
    let previousScrollY = window.scrollY;

    const tick = () => {
      rotCurrentRef.current +=
        (rotTargetRef.current - rotCurrentRef.current) * LERP_FACTOR;
      yShiftCurrentRef.current +=
        (yShiftTargetRef.current - yShiftCurrentRef.current) * Y_SHIFT_LERP;

      // 스크롤 멈추면 Y shift 타겟을 0으로 되돌린다
      yShiftTargetRef.current *= 0.92;

      const rotDone =
        Math.abs(rotTargetRef.current - rotCurrentRef.current) < 1e-5;
      const yDone =
        Math.abs(yShiftTargetRef.current - yShiftCurrentRef.current) < 0.05;

      if (!rotDone || !yDone) {
        rafRef.current = requestAnimationFrame(tick);
      } else {
        rotCurrentRef.current = rotTargetRef.current;
        yShiftCurrentRef.current = yShiftTargetRef.current;
        isRunning = false;
      }
    };

    const startLoop = () => {
      if (!isRunning) {
        isRunning = true;
        rafRef.current = requestAnimationFrame(tick);
      }
    };

    const handleScroll = () => {
      const y = window.scrollY;
      if (!visibleRef.current) {
        previousScrollY = y;
        return;
      }

      const delta = y - previousScrollY;
      previousScrollY = y;

      if (Math.abs(delta) < 0.2) return;

      rotTargetRef.current += delta * RAD_PER_SCROLL_PX;

      const normalizedDelta = Math.sign(delta) * Math.min(Math.abs(delta) / 8, 1);
      yShiftTargetRef.current = normalizedDelta * Y_SHIFT_MAX_PX;

      startLoop();
    };

    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => {
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
      window.removeEventListener("scroll", handleScroll);
    };
  }, [visibleRef]);

  return { rotationRef: rotCurrentRef, yShiftRef: yShiftCurrentRef };
}

function CylinderGridMesh({
  remPx,
  reducedMotionRef,
  scrollRotationRef,
  scrollYShiftRef,
}: {
  remPx: number;
  reducedMotionRef: MutableRefObject<boolean>;
  scrollRotationRef: MutableRefObject<number>;
  scrollYShiftRef: MutableRefObject<number>;
}) {
  const materialRef = useRef<THREE.ShaderMaterial>(null);
  const meshRef = useRef<THREE.Mesh>(null);
  const camera = useThree((s) => s.camera) as THREE.PerspectiveCamera;
  const size = useThree((s) => s.size);

  const radiusPx = CYLINDER_RADIUS_REM * remPx;
  const cellPx = Math.max(CELL_SIZE_REM * remPx, 1);
  const heightPx = Math.max(size.height * 3, cellPx * 40);
  const circumference = 2 * Math.PI * radiusPx;

  const uniforms = useMemo(
    () => ({
      u_resolution: { value: new THREE.Vector2(1, 1) },
      u_circumference: { value: 1 },
      u_height: { value: 1 },
      u_cell_px: { value: 1 },
      u_time: { value: 0 },
      u_reduced_motion: { value: 0 },
    }),
    [],
  );

  const geo = useMemo(() => {
    const g = new THREE.CylinderGeometry(
      radiusPx,
      radiusPx,
      heightPx,
      128,
      64,
      true,
    );
    return g;
  }, [radiusPx, heightPx]);

  useEffect(() => () => { geo.dispose(); }, [geo]);

  useLayoutEffect(() => {
    const vFov =
      2 * Math.atan(size.height / (2 * radiusPx)) * (180 / Math.PI);

    camera.fov = Math.max(20, Math.min(90, vFov));
    camera.aspect = size.width / Math.max(size.height, 1);
    camera.near = 1;
    camera.far = Math.sqrt(radiusPx * radiusPx + (heightPx / 2) * (heightPx / 2)) * 1.5;
    camera.position.set(0, 0, 0);
    camera.up.set(0, 1, 0);
    camera.lookAt(radiusPx, 0, 0);
    camera.updateProjectionMatrix();
  }, [camera, radiusPx, heightPx, size.width, size.height]);

  useFrame((state) => {
    const mat = materialRef.current;
    if (!mat) return;

    const dpr = state.viewport.dpr || 1;
    mat.uniforms.u_resolution.value.set(
      state.size.width * dpr,
      state.size.height * dpr,
    );
    mat.uniforms.u_circumference.value = circumference;
    mat.uniforms.u_height.value = heightPx;
    mat.uniforms.u_cell_px.value = cellPx;
    mat.uniforms.u_time.value = state.clock.elapsedTime;
    mat.uniforms.u_reduced_motion.value = reducedMotionRef.current ? 1 : 0;

    if (meshRef.current) {
      meshRef.current.rotation.y = scrollRotationRef.current;
      meshRef.current.position.y = scrollYShiftRef.current;
    }
  });

  return (
    <mesh ref={meshRef} geometry={geo}>
      <shaderMaterial
        ref={materialRef}
        vertexShader={vertShader}
        fragmentShader={fragShader}
        uniforms={uniforms}
        side={THREE.BackSide}
        depthWrite={false}
        depthTest={false}
        toneMapped={false}
      />
    </mesh>
  );
}

/* ─── exported scene ─────────────────────────────────────────────────── */

export type HollowCylinderSceneProps = {
  visible?: boolean;
};

export function HollowCylinderScene({ visible = true }: HollowCylinderSceneProps) {
  const remPx = useMemo(() => readRemPx(), []);
  const reducedMotionRef = useRef(false);
  const visibleRef = useRef(visible);
  const dpr =
    typeof window !== "undefined" ? Math.min(2, window.devicePixelRatio || 1) : 1;

  useEffect(() => {
    visibleRef.current = visible;
  }, [visible]);

  const { rotationRef: scrollRotationRef, yShiftRef: scrollYShiftRef } =
    useScrollMotion(visibleRef);

  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const apply = () => { reducedMotionRef.current = mq.matches; };
    apply();
    mq.addEventListener("change", apply);
    return () => mq.removeEventListener("change", apply);
  }, []);

  return (
    <Canvas
      style={{ width: "100%", height: "100%", display: "block" }}
      frameloop={visible ? "always" : "never"}
      gl={{
        antialias: true,
        alpha: false,
        powerPreference: "high-performance",
      }}
      dpr={dpr}
      onCreated={({ gl }) => {
        gl.toneMapping = THREE.NoToneMapping;
        gl.outputColorSpace = THREE.SRGBColorSpace;
      }}
    >
      <color attach="background" args={["#a075b0"]} />
      <Suspense fallback={null}>
        <CylinderGridMesh
          remPx={remPx}
          reducedMotionRef={reducedMotionRef}
          scrollRotationRef={scrollRotationRef}
          scrollYShiftRef={scrollYShiftRef}
        />
      </Suspense>
    </Canvas>
  );
}
