"use client";

/**
 * 풀스크린 셰이더 격자 — SVG GridBackground 와 동일 규칙(평면·무회전).
 * 크기/stop 개수는 ResizeObserver 가 아니라 R3F state.size 로만 맞춘다 (좌표 깨짐 방지).
 */

import { Canvas, useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";
import {
  Suspense,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type MutableRefObject,
} from "react";
import styles from "./grid-background.module.css";
import {
  CELL_SIZE_REM,
  countStopsForGrid,
  CURVE_SMOOTH,
  EPSILON,
  GRID_WARP_IDLE,
  GRID_WARP_SCROLL_DOWN,
  GRID_WARP_SCROLL_UP,
  MODE_SWITCH_DELTA_THRESHOLD,
  SCROLL_IDLE_MS,
  WARP_DIR_BLEND,
  WARP_RETAIN,
} from "./grid-background-math";
import {
  gridBackgroundFragmentShader,
  gridBackgroundVertexShader,
} from "./grid-background-webgl-shaders";

type GridShaderContentProps = {
  visibleRef: MutableRefObject<boolean>;
  cellSizePx: number;
  currentRatioRef: MutableRefObject<number>;
  reducedMotionRef: MutableRefObject<boolean>;
};

function GridShaderContent({
  visibleRef,
  cellSizePx,
  currentRatioRef,
  reducedMotionRef,
}: GridShaderContentProps) {
  const materialRef = useRef<THREE.ShaderMaterial>(null);
  const camera = useThree((s) => s.camera);
  const size = useThree((s) => s.size);

  const w = Math.max(1, size.width);
  const h = Math.max(1, size.height);

  const uniforms = useMemo(
    () => ({
      u_resolution: { value: new THREE.Vector2(1, 1) },
      u_width: { value: 1 },
      u_height: { value: 1 },
      u_current_ratio: { value: 0 },
      u_time: { value: 0 },
      u_nv_stops: { value: 2 },
      u_nh_stops: { value: 2 },
      u_reduced_motion: { value: 0 },
    }),
    [],
  );

  useLayoutEffect(() => {
    const ocam = camera as THREE.OrthographicCamera;
    ocam.left = 0;
    ocam.right = w;
    ocam.bottom = 0;
    ocam.top = h;
    ocam.position.set(w / 2, h / 2, 400);
    ocam.near = -500;
    ocam.far = 900;
    ocam.zoom = 1;
    ocam.updateProjectionMatrix();
  }, [camera, w, h]);

  useFrame((state) => {
    const mat = materialRef.current;
    if (!mat || !visibleRef.current) return;

    const sw = Math.max(1, state.size.width);
    const sh = Math.max(1, state.size.height);

    mat.uniforms.u_resolution.value.set(sw, sh);
    mat.uniforms.u_width.value = sw;
    mat.uniforms.u_height.value = sh;
    mat.uniforms.u_nv_stops.value = countStopsForGrid(sw, cellSizePx);
    mat.uniforms.u_nh_stops.value = countStopsForGrid(sh, cellSizePx);

    mat.uniforms.u_time.value = state.clock.elapsedTime;
    mat.uniforms.u_current_ratio.value = currentRatioRef.current;
    mat.uniforms.u_reduced_motion.value = reducedMotionRef.current ? 1 : 0;
  });

  const geo = useMemo(() => new THREE.PlaneGeometry(w, h, 1, 1), [w, h]);

  return (
    <mesh geometry={geo} position={[w / 2, h / 2, 0]} scale={[1, -1, 1]}>
      <shaderMaterial
        ref={materialRef}
        vertexShader={gridBackgroundVertexShader}
        fragmentShader={gridBackgroundFragmentShader}
        uniforms={uniforms}
        depthWrite={false}
        depthTest={false}
        toneMapped={false}
      />
    </mesh>
  );
}

function useScrollWarpRatio(visibleRef: MutableRefObject<boolean>) {
  const gridWarpRef = useRef({
    intent: GRID_WARP_SCROLL_DOWN,
    dir: GRID_WARP_SCROLL_DOWN as number,
  });
  const targetRef = useRef(0);
  const currentRef = useRef(0);
  const hasScrolledRef = useRef(false);
  const rafRef = useRef<number | null>(null);

  useEffect(() => {
    let isRunning = false;
    let lastScrollTime = 0;
    let previousScrollY = window.scrollY;

    const tick = () => {
      const now = performance.now();
      const isScrolling = now - lastScrollTime < SCROLL_IDLE_MS;

      const w = gridWarpRef.current;
      let nextWarp = w.dir + (w.intent - w.dir) * WARP_DIR_BLEND;
      if (nextWarp > 1) nextWarp = 1;
      else if (nextWarp < -1) nextWarp = -1;
      w.dir = nextWarp;

      const activeDir = w.intent;
      if (isScrolling && visibleRef.current) {
        targetRef.current = activeDir;
      } else if (!visibleRef.current) {
        targetRef.current = GRID_WARP_IDLE;
      } else if (hasScrolledRef.current) {
        targetRef.current = activeDir * WARP_RETAIN;
      } else {
        targetRef.current = GRID_WARP_IDLE;
      }

      currentRef.current += (targetRef.current - currentRef.current) * CURVE_SMOOTH;

      if (
        !isScrolling &&
        Math.abs(targetRef.current) < EPSILON &&
        Math.abs(currentRef.current) < EPSILON
      ) {
        currentRef.current = 0;
      }

      const deltaToTarget = Math.abs(targetRef.current - currentRef.current);
      const stillMoving = deltaToTarget > EPSILON || isScrolling;

      if (stillMoving) {
        rafRef.current = requestAnimationFrame(tick);
      } else {
        isRunning = false;
      }
    };

    const startLoop = () => {
      if (!visibleRef.current) return;
      if (!isRunning) {
        isRunning = true;
        rafRef.current = requestAnimationFrame(tick);
      }
    };

    const handleScroll = () => {
      const currentScrollY = window.scrollY;
      if (!visibleRef.current) {
        previousScrollY = currentScrollY;
        return;
      }

      const delta = currentScrollY - previousScrollY;
      previousScrollY = currentScrollY;

      if (currentScrollY < 0) return;
      if (Math.abs(delta) < 0.2) return;

      if (delta > MODE_SWITCH_DELTA_THRESHOLD) {
        gridWarpRef.current.intent = GRID_WARP_SCROLL_DOWN;
      } else if (delta < -MODE_SWITCH_DELTA_THRESHOLD) {
        gridWarpRef.current.intent = GRID_WARP_SCROLL_UP;
      }

      lastScrollTime = performance.now();
      hasScrolledRef.current = true;
      startLoop();
    };

    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => {
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
      window.removeEventListener("scroll", handleScroll);
    };
  }, [visibleRef]);

  return currentRef;
}

export type GridBackgroundWebglProps = {
  visible?: boolean;
};

export function GridBackgroundWebgl({ visible = true }: GridBackgroundWebglProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const visibleRef = useRef(visible);
  const reducedMotionRef = useRef(false);

  const [size, setSize] = useState({ width: 0, height: 0 });

  const cellSizePx = useMemo(() => {
    if (typeof window === "undefined") return 140;
    return parseFloat(getComputedStyle(document.documentElement).fontSize) * CELL_SIZE_REM;
  }, []);

  const currentRatioRef = useScrollWarpRatio(visibleRef);

  useEffect(() => {
    visibleRef.current = visible;
    if (!visible) {
      currentRatioRef.current = 0;
    }
  }, [visible, currentRatioRef]);

  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const apply = () => {
      reducedMotionRef.current = mq.matches;
    };
    apply();
    mq.addEventListener("change", apply);
    return () => mq.removeEventListener("change", apply);
  }, []);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const ro = new ResizeObserver((entries) => {
      const entry = entries[0];
      setSize({ width: entry.contentRect.width, height: entry.contentRect.height });
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const dpr = typeof window !== "undefined" ? Math.min(2, window.devicePixelRatio) : 1;

  return (
    <div
      ref={containerRef}
      className={styles.background}
      data-hidden={!visible || undefined}
      aria-hidden
    >
      {size.width > 2 && size.height > 2 ? (
        <Canvas
          className={styles.gridSvg}
          orthographic
          frameloop={visible ? "always" : "never"}
          dpr={dpr}
          gl={{
            antialias: true,
            alpha: false,
            powerPreference: "high-performance",
          }}
          style={{ position: "absolute", inset: 0, width: "100%", height: "100%" }}
        >
          <color attach="background" args={["#936ec4"]} />
          <Suspense fallback={null}>
            <GridShaderContent
              visibleRef={visibleRef}
              cellSizePx={cellSizePx}
              currentRatioRef={currentRatioRef}
              reducedMotionRef={reducedMotionRef}
            />
          </Suspense>
        </Canvas>
      ) : null}
    </div>
  );
}
