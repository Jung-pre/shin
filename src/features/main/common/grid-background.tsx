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

const clamp = (value: number, min: number, max: number) => {
  return Math.min(max, Math.max(min, value));
};

const createStops = (length: number, step: number) => {
  if (length <= 1) {
    return [0, 1];
  }

  const stops = [0];
  let cursor = step;

  while (cursor < length) {
    stops.push(cursor);
    cursor += step;
  }

  stops.push(length);
  return stops;
};

const toPath = (points: Point[]) => {
  return points.map((point, index) => `${index === 0 ? "M" : "L"} ${point.x} ${point.y}`).join(" ");
};

/** 화면 곡률이 목표를 따라가는 속도 (낮을수록 더 부드럽고 묵직함) */
const CURVE_SMOOTH = 0.06;
/** 이 ms 동안은 "스크롤 중"으로 보고 목표를 급히 0으로 돌리지 않음 */
const SCROLL_IDLE_MS = 300;
const EPSILON = 0.00035;
/** 미세 역방향 입력으로 모드가 뒤집히며 생기는 촐랑임 방지 */
const MODE_SWITCH_DELTA_THRESHOLD = 1.2;
/** |curveRatio|에 곱해 실제 픽셀 변위 — 휘어짐 부호는 스크롤 방향 모드로만 고정 */
const CURVE_DEPTH_PX = 110;
/** 요청 반영: 현재 강도의 절반 */
const WARP_INTENSITY_MULTIPLIER = 1.5;
/** 앵커 기준 벤드 가중 (가로 중앙에서 강함) */
const WARP_KX = 0.06;
const WARP_KY = 0.34;
const GRID_WARP_ENABLED = false;

export type GridBackgroundProps = {
  /** 스크롤/휠이 움직이는 동안 핑크 100% 목표 */
  scrollHot?: boolean;
};

const PINK_LERP = 0.045;
const PINK_OUT_LERP = 0.032;

export function GridBackground({ scrollHot = false }: GridBackgroundProps) {
  const backgroundRef = useRef<HTMLDivElement>(null);
  const pinkOverlayRef = useRef<HTMLDivElement>(null);
  const overlayRafRef = useRef(0);
  const scrollHotRef = useRef(false);
  const pinkSmoothedRef = useRef(0);
  /**
   * 핑크 오버레이 RAF 를 외부(effect)에서 기상시키기 위한 트리거.
   *   루프는 target/current 가 모두 0 근처로 수렴하면 스스로 정지해 idle CPU 를 아낀다.
   *   scrollHot prop 이 true 로 바뀌는 edge 에서 이 함수가 호출돼 루프를 다시 깨운다.
   */
  const pinkStartRef = useRef<(() => void) | null>(null);
  /** 아래로 스크롤: 기준 (50%w, 0) / 위로: (50%w, 100%h) — 이 모드로만 휘어짐 부호 고정 */
  const scrollWarpModeRef = useRef<"down" | "up">("down");
  const [scrollWarpMode, setScrollWarpMode] = useState<"down" | "up">("down");
  const rafRef = useRef<number | null>(null);
  const targetRef = useRef(0);
  const currentRef = useRef(0);
  const [size, setSize] = useState({ width: 0, height: 0 });
  const [curveRatio, setCurveRatio] = useState(0);

  const cellSizePx = useMemo(() => {
    if (typeof window === "undefined") {
      return 140;
    }

    const rootFont = parseFloat(getComputedStyle(document.documentElement).fontSize);
    return rootFont * CELL_SIZE_REM;
  }, []);

  useEffect(() => {
    const element = backgroundRef.current;

    if (!element) {
      return;
    }

    const resizeObserver = new ResizeObserver((entries) => {
      const entry = entries[0];
      setSize({
        width: entry.contentRect.width,
        height: entry.contentRect.height,
      });
    });

    resizeObserver.observe(element);
    return () => resizeObserver.disconnect();
  }, []);

  useEffect(() => {
    scrollHotRef.current = scrollHot;
    // scrollHot true edge 에서만 RAF 를 깨움 (가라앉은 뒤 스스로 멈추는 루프에 대응).
    if (scrollHot) {
      pinkStartRef.current?.();
    }
  }, [scrollHot]);

  useEffect(() => {
    scrollWarpModeRef.current = scrollWarpMode;
  }, [scrollWarpMode]);

  useEffect(() => {
    let previousScrollY = window.scrollY;
    let isRunning = false;
    let lastScrollTime = 0;

    const tick = () => {
      const now = performance.now();
      const isScrolling = now - lastScrollTime < SCROLL_IDLE_MS;

      // 스크롤 중엔 항상 고정 강도(±1), 멈추면 0으로 복귀
      const activeDir = scrollWarpModeRef.current === "down" ? -1 : 1;
      targetRef.current = isScrolling ? activeDir : 0;

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

      // 오버스크롤(rubber-band) 구간 — scrollY < 0 일 때는 스크롤 멈춤과 동일하게 무시.
      if (currentScrollY < 0) {
        return;
      }

      if (Math.abs(delta) < 0.2) {
        return;
      }

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
      if (rafRef.current !== null) {
        cancelAnimationFrame(rafRef.current);
      }

      window.removeEventListener("scroll", handleScroll);
    };
  }, []);

  useEffect(() => {
    // 성능: 이전 구현은 페이지 전 생애주기 동안 매 프레임 RAF 가 돌았다.
    //   스크롤이 없어 target/current 모두 0 에 수렴한 뒤에도 idle CPU 를 계속 깎음.
    //   target 이 0 이고 smoothed 도 0 근처이면 루프를 스스로 정지시키고,
    //   scrollHot 이 true 로 바뀌는 edge 에서 `pinkStartRef` 로 재기상.
    const PINK_STABLE_EPS = 0.001;
    let running = false;

    const tick = () => {
      const pinkTarget = scrollHotRef.current ? 1 : 0;
      const pinkK = pinkTarget > pinkSmoothedRef.current ? PINK_LERP : PINK_OUT_LERP;
      pinkSmoothedRef.current += (pinkTarget - pinkSmoothedRef.current) * pinkK;

      const pinkEl = pinkOverlayRef.current;
      if (pinkEl) {
        pinkEl.style.opacity = String(clamp(pinkSmoothedRef.current, 0, 1));
      }

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

  const warpPoint = useCallback(
    (x: number, y: number): Point => {
      const w = width;
      const h = height;
      if (!GRID_WARP_ENABLED) {
        return {
          x: clamp(x, 0, w),
          y: clamp(y, 0, h),
        };
      }
      const mode = scrollWarpMode;
      // 모든 라인이 동일한 모양/강도로 휘도록 y 가중을 제거
      const xNorm = (clamp(x, 0, w) / w) * 2 - 1;
      // 중앙이 가장 크게, 양 끝은 작게 휘는 '활' 형태 프로파일
      const centerArc = clamp(1 - xNorm * xNorm, 0, 1);
      const edgeSoften = 0.18;
      const centerWeight = edgeSoften + (1 - edgeSoften) * centerArc;
      const bend = centerWeight;
      const eased = Math.pow(Math.abs(curveRatio), 1.08);
      const mag = eased * CURVE_DEPTH_PX * WARP_INTENSITY_MULTIPLIER;
      const dir = mode === "down" ? -1 : 1;
      const amt = mag * dir;

      return {
        x: clamp(x + amt * WARP_KX * bend, 0, w),
        y: clamp(y + amt * WARP_KY * bend, 0, h),
      };
    },
    [curveRatio, width, height, scrollWarpMode],
  );

  const horizontalPaths = useMemo(() => {
    const segmentCount = Math.max(16, Math.ceil(width / cellSizePx) * 4);

    return yStops.map((y) => {
      const points = Array.from({ length: segmentCount + 1 }, (_, index) => {
        const x = (width * index) / segmentCount;
        return warpPoint(x, y);
      });

      return toPath(points);
    });
  }, [yStops, width, cellSizePx, warpPoint]);

  const verticalPaths = useMemo(() => {
    const segmentCount = Math.max(16, Math.ceil(height / cellSizePx) * 4);

    return xStops.map((x) => {
      const points = Array.from({ length: segmentCount + 1 }, (_, index) => {
        const y = (height * index) / segmentCount;
        return warpPoint(x, y);
      });

      return toPath(points);
    });
  }, [xStops, height, cellSizePx, warpPoint]);

  const cells = useMemo(() => {
    const tokens: CellToken[] = [];
    const cellPolygons: string[] = [];
    let index = 0;

    for (let rowIndex = 0; rowIndex < yStops.length - 1; rowIndex += 1) {
      for (let colIndex = 0; colIndex < xStops.length - 1; colIndex += 1) {
        const x0 = xStops[colIndex];
        const x1 = xStops[colIndex + 1];
        const y0 = yStops[rowIndex];
        const y1 = yStops[rowIndex + 1];

        const topLeft = warpPoint(x0, y0);
        const topRight = warpPoint(x1, y0);
        const bottomRight = warpPoint(x1, y1);
        const bottomLeft = warpPoint(x0, y1);

        const points = `${topLeft.x},${topLeft.y} ${topRight.x},${topRight.y} ${bottomRight.x},${bottomRight.y} ${bottomLeft.x},${bottomLeft.y}`;

        cellPolygons.push(points);
        tokens.push({
          id: index,
          delay: `${(seededNoise(index + 1) * 7).toFixed(2)}s`,
          duration: `${(3.6 + seededNoise(index + 17) * 4.8).toFixed(2)}s`,
          alpha: (0.18 + seededNoise(index + 41) * 0.3).toFixed(2),
        });
        index += 1;
      }
    }

    return cellPolygons.map((points, cellIndex) => ({
      points,
      token: tokens[cellIndex],
    }));
  }, [xStops, yStops, warpPoint]);

  const linePaths = useMemo(() => {
    return [...horizontalPaths, ...verticalPaths];
  }, [horizontalPaths, verticalPaths]);

  const glowCells = useMemo(() => {
    return cells.map((cell) => ({
      points: cell.points,
      style: {
        "--delay": cell.token.delay,
        "--duration": cell.token.duration,
        "--alpha": cell.token.alpha,
      } as CSSProperties,
      id: cell.token.id,
    }));
  }, [cells]);

  const fallbackCells = useMemo<CellToken[]>(() => {
    return Array.from({ length: 1 }, (_, index) => ({
      id: index,
      delay: `${(seededNoise(index + 1) * 7).toFixed(2)}s`,
      duration: `${(3.6 + seededNoise(index + 17) * 4.8).toFixed(2)}s`,
      alpha: (0.18 + seededNoise(index + 41) * 0.3).toFixed(2),
    }));
  }, []);

  return (
    <div ref={backgroundRef} className={styles.background} data-scrolling={scrollHot || undefined} aria-hidden>
      <div className={styles.baseWash} />
      <div ref={pinkOverlayRef} className={styles.scrollPink} />
      <svg className={styles.gridSvg} viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="none">
        <g className={styles.glowLayer}>
          {(glowCells.length > 0 ? glowCells : fallbackCells.map((token) => ({ id: token.id, points: "0,0 1,0 1,1 0,1", style: { "--delay": token.delay, "--duration": token.duration, "--alpha": token.alpha } as CSSProperties }))).map(
            (cell) => (
              <polygon key={`cell-${cell.id}`} points={cell.points} className={styles.glowCell} style={cell.style} />
            ),
          )}
        </g>
        <g className={styles.lineLayer}>
          {linePaths.map((path, index) => (
            <path key={`line-${index}`} d={path} className={styles.line} />
          ))}
        </g>
      </svg>
    </div>
  );
};
