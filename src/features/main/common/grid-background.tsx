"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { CSSProperties } from "react";
import styles from "./grid-background.module.css";

const CELL_SIZE_REM = 8.75;

const seededNoise = (seed: number) => {
  const value = Math.sin(seed * 12.9898) * 43758.5453;
  return value - Math.floor(value);
};

interface CellToken {
  id: number;
  delay: string;
  duration: string;
  alpha: string;
}

interface Point {
  x: number;
  y: number;
}

const clamp = (value: number, min: number, max: number) =>
  Math.min(max, Math.max(min, value));

const createStops = (length: number, step: number) => {
  if (length <= 1) return [0, 1];
  const stops = [0];
  let cursor = step;
  while (cursor < length) {
    stops.push(cursor);
    cursor += step;
  }
  stops.push(length);
  return stops;
};

const toPath = (points: Point[]) =>
  points.map((p, i) => `${i === 0 ? "M" : "L"} ${p.x} ${p.y}`).join(" ");

const CURVE_SMOOTH = 0.06;
const SCROLL_IDLE_MS = 300;
const EPSILON = 0.00035;
const MODE_SWITCH_DELTA_THRESHOLD = 1.2;
const CURVE_DEPTH_PX = 40;
/** 가로 라인 1개당 최대 세그먼트 수 */
const MAX_SEGMENT_COUNT = 32;

export type GridBackgroundProps = {
  scrollHot?: boolean;
  visible?: boolean;
};

const PINK_LERP = 0.045;
const PINK_OUT_LERP = 0.032;

// ── 가로 라인만 curveRatio 에 의존하는 분리된 컴포넌트 ─────────────────────────
// GridBackground 전체가 아닌 이 컴포넌트만 스크롤마다 re-render 된다.
// glowCells·verticalPaths·cells 는 curveRatio 와 무관해 재계산되지 않는다.
interface HLinesProps {
  curveRatio: number;
  scrollWarpMode: "down" | "up";
  yStops: number[];
  width: number;
  cellSizePx: number;
}

function HorizontalLinesLayer({ curveRatio, scrollWarpMode, yStops, width, cellSizePx }: HLinesProps) {
  const paths = useMemo(() => {
    if (Math.abs(curveRatio) < EPSILON) {
      return yStops.map((y) => `M 0 ${y} L ${width} ${y}`);
    }
    const segCount = Math.min(MAX_SEGMENT_COUNT, Math.max(16, Math.ceil(width / cellSizePx) * 4));
    const dir = scrollWarpMode === "down" ? -1 : 1;
    const eased = Math.pow(Math.abs(curveRatio), 0.85);

    return yStops.map((y) => {
      const parts: string[] = [];
      for (let s = 0; s <= segCount; s++) {
        const x = (width * s) / segCount;
        const xNorm = (x / Math.max(1, width)) * 2 - 1;
        const arc = Math.max(0, 1 - xNorm * xNorm);
        const dy = arc * eased * CURVE_DEPTH_PX * dir;
        parts.push(`${s === 0 ? "M" : "L"} ${x} ${y + dy}`);
      }
      return parts.join(" ");
    });
  }, [curveRatio, scrollWarpMode, yStops, width, cellSizePx]);

  return (
    <>
      {paths.map((d, i) => (
        <path key={`hline-${i}`} d={d} className={styles.line} />
      ))}
    </>
  );
}

export function GridBackground({ scrollHot = false, visible = true }: GridBackgroundProps) {
  const backgroundRef = useRef<HTMLDivElement>(null);
  const pinkOverlayRef = useRef<HTMLDivElement>(null);
  const overlayRafRef = useRef(0);
  const scrollHotRef = useRef(false);
  const pinkSmoothedRef = useRef(0);
  const pinkStartRef = useRef<(() => void) | null>(null);

  const visibleRef = useRef(visible);
  const scrollWarpModeRef = useRef<"down" | "up">("down");
  const rafRef = useRef<number | null>(null);
  const targetRef = useRef(0);
  const currentRef = useRef(0);

  // 가로 라인 워프: state 로 관리 → HorizontalLinesLayer 만 re-render
  const [curveRatio, setCurveRatio] = useState(0);
  const [scrollWarpMode, setScrollWarpMode] = useState<"down" | "up">("down");

  const [size, setSize] = useState({ width: 0, height: 0 });

  const cellSizePx = useMemo(() => {
    if (typeof window === "undefined") return 140;
    return parseFloat(getComputedStyle(document.documentElement).fontSize) * CELL_SIZE_REM;
  }, []);

  useEffect(() => {
    const el = backgroundRef.current;
    if (!el) return;
    const ro = new ResizeObserver((entries) => {
      const entry = entries[0];
      setSize({ width: entry.contentRect.width, height: entry.contentRect.height });
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  useEffect(() => {
    scrollHotRef.current = scrollHot;
    if (scrollHot) pinkStartRef.current?.();
  }, [scrollHot]);

  useEffect(() => {
    visibleRef.current = visible;
    if (!visible) {
      // 히어로를 벗어나는 순간 워프를 즉시 직선으로 복귀
      currentRef.current = 0;
      targetRef.current = 0;
      setCurveRatio(0);
    }
  }, [visible]);

  useEffect(() => {
    scrollWarpModeRef.current = scrollWarpMode;
  }, [scrollWarpMode]);

  // ── 스크롤 워프 RAF ────────────────────────────────────────────────────────
  useEffect(() => {
    let isRunning = false;
    let lastScrollTime = 0;
    let previousScrollY = window.scrollY;

    const tick = () => {
      const now = performance.now();
      const isScrolling = now - lastScrollTime < SCROLL_IDLE_MS;

      const activeDir = scrollWarpModeRef.current === "down" ? -1 : 1;
      // 워프 임시 비활성화
      targetRef.current = 0;

      currentRef.current += (targetRef.current - currentRef.current) * CURVE_SMOOTH;

      if (!isScrolling && Math.abs(targetRef.current) < EPSILON && Math.abs(currentRef.current) < EPSILON) {
        currentRef.current = 0;
      }

      setCurveRatio(currentRef.current);

      const deltaToTarget = Math.abs(targetRef.current - currentRef.current);
      const stillMoving = deltaToTarget > EPSILON || Math.abs(targetRef.current) > EPSILON || isScrolling;

      if (stillMoving) {
        rafRef.current = requestAnimationFrame(tick);
      } else {
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
      const currentScrollY = window.scrollY;
      const delta = currentScrollY - previousScrollY;
      previousScrollY = currentScrollY;

      if (currentScrollY < 0) return;
      if (Math.abs(delta) < 0.2) return;

      if (delta > MODE_SWITCH_DELTA_THRESHOLD) {
        scrollWarpModeRef.current = "down";
        setScrollWarpMode("down");
      } else if (delta < -MODE_SWITCH_DELTA_THRESHOLD) {
        scrollWarpModeRef.current = "up";
        setScrollWarpMode("up");
      }

      lastScrollTime = performance.now();
      startLoop();
    };

    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => {
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
      window.removeEventListener("scroll", handleScroll);
    };
  }, []);

  // ── 핑크 오버레이 RAF ──────────────────────────────────────────────────────
  useEffect(() => {
    const PINK_STABLE_EPS = 0.001;
    let running = false;

    const tick = () => {
      const pinkTarget = scrollHotRef.current ? 1 : 0;
      const pinkK = pinkTarget > pinkSmoothedRef.current ? PINK_LERP : PINK_OUT_LERP;
      pinkSmoothedRef.current += (pinkTarget - pinkSmoothedRef.current) * pinkK;

      const pinkEl = pinkOverlayRef.current;
      if (pinkEl) pinkEl.style.opacity = String(clamp(pinkSmoothedRef.current, 0, 1));

      const delta = Math.abs(pinkTarget - pinkSmoothedRef.current);
      if (delta < PINK_STABLE_EPS && pinkTarget === 0) {
        if (pinkEl) pinkEl.style.opacity = "0";
        pinkSmoothedRef.current = 0;
        running = false;
        return;
      }
      overlayRafRef.current = requestAnimationFrame(tick);
    };

    const start = () => {
      if (running) return;
      running = true;
      overlayRafRef.current = requestAnimationFrame(tick);
    };
    pinkStartRef.current = start;
    start();

    return () => {
      cancelAnimationFrame(overlayRafRef.current);
      pinkStartRef.current = null;
      running = false;
    };
  }, []);

  const width = Math.max(1, size.width);
  const height = Math.max(1, size.height);

  const xStops = useMemo(() => createStops(width, cellSizePx), [width, cellSizePx]);
  const yStops = useMemo(() => createStops(height, cellSizePx), [height, cellSizePx]);

  // 세로 라인 — 직선 유지 (curveRatio 무관)
  const verticalPaths = useMemo(() => {
    return xStops.map((x) => toPath([{ x, y: 0 }, { x, y: height }]));
  }, [xStops, height]);

  // glow 셀 — 워프 없이 직사각형, 체커보드로 절반만 (curveRatio 무관)
  const cells = useMemo(() => {
    const tokens: CellToken[] = [];
    const cellPolygons: string[] = [];
    let index = 0;

    for (let row = 0; row < yStops.length - 1; row++) {
      for (let col = 0; col < xStops.length - 1; col++) {
        if ((row + col) % 2 !== 0) { index++; continue; }
        const x0 = xStops[col], x1 = xStops[col + 1];
        const y0 = yStops[row], y1 = yStops[row + 1];
        cellPolygons.push(`${x0},${y0} ${x1},${y0} ${x1},${y1} ${x0},${y1}`);
        tokens.push({
          id: index,
          delay: `${(seededNoise(index + 1) * 7).toFixed(2)}s`,
          duration: `${(3.6 + seededNoise(index + 17) * 4.8).toFixed(2)}s`,
          alpha: (0.34 + seededNoise(index + 41) * 0.42).toFixed(2),
        });
        index++;
      }
    }
    return cellPolygons.map((points, i) => ({ points, token: tokens[i] }));
  }, [xStops, yStops]);

  const glowCells = useMemo(() =>
    cells.map((cell) => ({
      points: cell.points,
      style: {
        "--delay": cell.token.delay,
        "--duration": cell.token.duration,
        "--alpha": cell.token.alpha,
      } as CSSProperties,
      id: cell.token.id,
    })), [cells]);

  const fallbackCells = useMemo<CellToken[]>(() =>
    Array.from({ length: 1 }, (_, i) => ({
      id: i,
      delay: `${(seededNoise(i + 1) * 7).toFixed(2)}s`,
      duration: `${(3.6 + seededNoise(i + 17) * 4.8).toFixed(2)}s`,
      alpha: (0.34 + seededNoise(i + 41) * 0.42).toFixed(2),
    })), []);

  return (
    <div
      ref={backgroundRef}
      className={styles.background}
      data-scrolling={scrollHot || undefined}
      data-hidden={!visible || undefined}
      aria-hidden
    >
      <div className={styles.baseWash} />
      <div ref={pinkOverlayRef} className={styles.scrollPink} />
      <svg className={styles.gridSvg} viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="none">
        <g className={styles.glowLayer}>
          {(glowCells.length > 0
            ? glowCells
            : fallbackCells.map((t) => ({
                id: t.id,
                points: "0,0 1,0 1,1 0,1",
                style: { "--delay": t.delay, "--duration": t.duration, "--alpha": t.alpha } as CSSProperties,
              }))
          ).map((cell) => (
            <polygon key={`cell-${cell.id}`} points={cell.points} className={styles.glowCell} style={cell.style} />
          ))}
        </g>
        <g className={styles.lineLayer}>
          {/* 가로 라인: 워프 계산을 분리된 컴포넌트에서만 처리 */}
          <HorizontalLinesLayer
            curveRatio={curveRatio}
            scrollWarpMode={scrollWarpMode}
            yStops={yStops}
            width={width}
            cellSizePx={cellSizePx}
          />
          {/* 세로 라인: 항상 직선 */}
          {verticalPaths.map((d, i) => (
            <path key={`vline-${i}`} d={d} className={styles.line} />
          ))}
        </g>
      </svg>
    </div>
  );
}
