"use client";

import {
  useCallback,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
  forwardRef,
} from "react";
import type { CSSProperties, MutableRefObject } from "react";
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
  visible?: boolean;
};

// ── 가로 라인 워프 — React state 경유 없이 SVG path `d` 를 직접 업데이트 ────────
// 과거엔 curveRatio/scrollWarpMode 를 state 로 올려 매 프레임 re-render 했는데,
// setState 디핑/커밋 비용이 스크롤 부하를 만들었다.
// 이 컴포넌트는 yStops/width 변경 때만 DOM 트리를 재생성하고,
// 워프 애니메이션은 부모가 `tickerRef.current()` 만 호출하면
// 내부에서 `path.setAttribute("d", ...)` 로 즉시 그린다. → React 관여 0.
interface HLinesHandle {
  /** 현재 refs(currentRef, modeRef) 로 즉시 다시 그린다. */
  rebuild: () => void;
}

interface HLinesProps {
  yStops: number[];
  width: number;
  cellSizePx: number;
  /** 현재 curveRatio (-1..1). 부모 RAF 루프에서 계속 갱신. */
  currentRef: MutableRefObject<number>;
  /** 현재 워프 방향. 부모 스크롤 핸들러가 갱신. */
  modeRef: MutableRefObject<"down" | "up">;
}

const HorizontalLinesLayer = forwardRef<HLinesHandle, HLinesProps>(function HorizontalLinesLayer(
  { yStops, width, cellSizePx, currentRef, modeRef },
  ref,
) {
  const pathRefs = useRef<Array<SVGPathElement | null>>([]);

  // 현재 상태로 각 path 의 `d` 속성을 즉시 갱신한다.
  // 세그먼트 수는 뷰포트 가로에 따라 달라지므로 closure 로 고정.
  const rebuild = useCallback(() => {
    const ratio = currentRef.current;
    const absRatio = Math.abs(ratio);
    const segCount = Math.min(
      MAX_SEGMENT_COUNT,
      Math.max(16, Math.ceil(width / cellSizePx) * 4),
    );
    const dir = modeRef.current === "down" ? -1 : 1;
    const eased = Math.pow(absRatio, 0.85);
    const magnitude = eased * CURVE_DEPTH_PX * dir;
    const invW = 1 / Math.max(1, width);

    for (let i = 0; i < yStops.length; i++) {
      const path = pathRefs.current[i];
      if (!path) continue;
      const y = yStops[i];
      let d: string;
      if (absRatio < EPSILON) {
        // 직선 — 문자열 간단 경로. 브라우저 파서 부담 ↓.
        d = `M 0 ${y} L ${width} ${y}`;
      } else {
        const parts: string[] = [];
        for (let s = 0; s <= segCount; s++) {
          const x = (width * s) / segCount;
          const xNorm = x * invW * 2 - 1;
          const arc = Math.max(0, 1 - xNorm * xNorm);
          const dy = arc * magnitude;
          parts.push(`${s === 0 ? "M" : "L"} ${x.toFixed(1)} ${(y + dy).toFixed(2)}`);
        }
        d = parts.join(" ");
      }
      path.setAttribute("d", d);
    }
  }, [yStops, width, cellSizePx, currentRef, modeRef]);

  useImperativeHandle(ref, () => ({ rebuild }), [rebuild]);

  // yStops/width 변경 시(리사이즈) 즉시 1회 재계산 — 초기 마운트 포함.
  useEffect(() => {
    rebuild();
  }, [rebuild]);

  return (
    <>
      {yStops.map((_, i) => (
        <path
          key={`hline-${i}`}
          ref={(el) => {
            pathRefs.current[i] = el;
          }}
          className={styles.line}
        />
      ))}
    </>
  );
});

export function GridBackground({ visible = true }: GridBackgroundProps) {
  const backgroundRef = useRef<HTMLDivElement>(null);
  const visibleRef = useRef(visible);
  const scrollWarpModeRef = useRef<"down" | "up">("down");
  const rafRef = useRef<number | null>(null);
  const targetRef = useRef(0);
  const currentRef = useRef(0);
  const hLinesHandleRef = useRef<HLinesHandle | null>(null);

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
    visibleRef.current = visible;
    if (!visible) {
      // 히어로를 벗어나는 순간 워프를 즉시 직선으로 복귀
      currentRef.current = 0;
      targetRef.current = 0;
      hLinesHandleRef.current?.rebuild();
    }
  }, [visible]);

  // ── 스크롤 워프 RAF ────────────────────────────────────────────────────────
  useEffect(() => {
    let isRunning = false;
    let lastScrollTime = 0;
    let previousScrollY = window.scrollY;

    const tick = () => {
      const now = performance.now();
      const isScrolling = now - lastScrollTime < SCROLL_IDLE_MS;

      // 스크롤 중 ±1, 멈추면 0 으로 감쇠. 히어로 밖(visible=false)이면 강제로 0.
      const activeDir = scrollWarpModeRef.current === "down" ? -1 : 1;
      targetRef.current = isScrolling && visibleRef.current ? activeDir : 0;

      currentRef.current += (targetRef.current - currentRef.current) * CURVE_SMOOTH;

      if (
        !isScrolling &&
        Math.abs(targetRef.current) < EPSILON &&
        Math.abs(currentRef.current) < EPSILON
      ) {
        currentRef.current = 0;
      }

      // React state 를 쓰지 않고 path.setAttribute 로 직접 갱신.
      hLinesHandleRef.current?.rebuild();

      const deltaToTarget = Math.abs(targetRef.current - currentRef.current);
      const stillMoving =
        deltaToTarget > EPSILON || Math.abs(targetRef.current) > EPSILON || isScrolling;

      if (stillMoving) {
        rafRef.current = requestAnimationFrame(tick);
      } else {
        isRunning = false;
      }
    };

    const startLoop = () => {
      if (!visibleRef.current) return; // 히어로 밖이면 RAF 자체를 돌리지 않음
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

      // 방향 플립만 ref 갱신 (state 없음 → 재렌더 없음).
      if (delta > MODE_SWITCH_DELTA_THRESHOLD) {
        scrollWarpModeRef.current = "down";
      } else if (delta < -MODE_SWITCH_DELTA_THRESHOLD) {
        scrollWarpModeRef.current = "up";
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

  // ── 핑크 오버레이 RAF ── (제거됨)
  // 스크롤 중/정지 전환 시 배경 톤이 바뀌어 글래스 렌즈 투과 이미지와 미세하게 이질감이 발생.
  // baseWash(고정 gradient) 만 남기고 scrollHot 으로 트리거되던 색상 보간을 삭제했다.

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
      data-hidden={!visible || undefined}
      aria-hidden
    >
      <div className={styles.baseWash} />
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
          {/* 가로 라인: path.setAttribute 로 직접 업데이트, state 경유 없음 */}
          <HorizontalLinesLayer
            ref={hLinesHandleRef}
            yStops={yStops}
            width={width}
            cellSizePx={cellSizePx}
            currentRef={currentRef}
            modeRef={scrollWarpModeRef}
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
