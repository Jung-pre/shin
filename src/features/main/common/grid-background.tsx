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


const CURVE_SMOOTH = 0.06;
const SCROLL_IDLE_MS = 300;
const EPSILON = 0.00035;
const MODE_SWITCH_DELTA_THRESHOLD = 1.2;
/**
 * 휨 최대 “깊이”(px) — arc(x) 가 1 인 화면 중앙에서의 Y 방향 변위.
 *   값을 키울수록 전체가 더 강하게 활처럼 휨. (순수 각도 °는 아님, 변위로 체감 조절)
 *   더 휨이 필요하면 이 숫자만 올리면 됨(세로선 pad = 이 값 + 2 자동).
 */
const CURVE_DEPTH_PX = 124;
/** 가로 라인 1개당 최대 세그먼트 수 */
const MAX_SEGMENT_COUNT = 32;
/**
 * 스크롤이 멈춘 뒤 목표 워프 비율 (target ∈ [-1,1]).
 * 1.0 = 완전 직선으로 복귀 없음(마지막 방향·강도 유지), 0 = 기존처럼 0으로 복귀.
 * 0.72 = 최대 휨의 72% 를 "자세"로 남겨, 제자리(직선)로 완전히 돌아가지 않게 함.
 */
const WARP_RETAIN = 0.72;
/**
 * 위/아래 스크롤 방향이 바뀔 때 굽힘 부호를 즉시 뒤집지 않고 이 값으로 보간.
 * (작을수록 더 천천히, 클수록 더 빨리 새 방향에 수렴)
 */
const WARP_DIR_BLEND = 0.11;

/**
 * SVG 좌표계는 y+ 가 아래 방향이다.
 *
 * 이미지 기준 정의:
 * - 일반: 상단은 아래로, 하단은 위로 약하게 말리는 기본 배럴 곡률
 * - 스크롤 다운: 상단 라인은 일자에 가깝고, 하단으로 갈수록 위로 휨
 * - 스크롤 업: 하단 라인은 일자에 가깝고, 상단으로 갈수록 아래로 휨
 */
const GRID_WARP_IDLE = 0;
const GRID_WARP_SCROLL_DOWN = -1;
const GRID_WARP_SCROLL_UP = 1;
const GRID_BASE_CURVE_STRENGTH = 0.42;
const GRID_SCROLL_CURVE_STRENGTH = 0.86;

const clamp01 = (value: number) => Math.min(1, Math.max(0, value));

const getHorizontalCurveWeight = (y: number, height: number, ratio: number) => {
  const yNorm = clamp01(y / Math.max(1, height));
  const absRatio = Math.abs(ratio);
  const easedRatio = Math.pow(absRatio, 0.72);
  const idleWeight = (0.5 - yNorm) * 2 * GRID_BASE_CURVE_STRENGTH;
  const scrollWeight =
    ratio < 0
      ? -yNorm * GRID_SCROLL_CURVE_STRENGTH
      : (1 - yNorm) * GRID_SCROLL_CURVE_STRENGTH;

  // ratio≈0 이면 easedRatio≈0 → idle만 (스크롤 쪽 scrollWeight 는 블렌드에 반영되지 않음)
  return idleWeight + (scrollWeight - idleWeight) * easedRatio;
};

const getWarpedY = (x: number, y: number, width: number, height: number, ratio: number) => {
  const xNorm = (x / Math.max(1, width)) * 2 - 1;
  const arc = Math.max(0, 1 - xNorm * xNorm);
  return y + arc * CURVE_DEPTH_PX * getHorizontalCurveWeight(y, height, ratio);
};

export type GridBackgroundProps = {
  visible?: boolean;
};

/** 스크롤 워프 축 — 단일 ref 로만 갱신해 HMR/리스너 클로저와 식별자 불일치를 피함 */
interface GridScrollWarp {
  intent: number;
  dir: number;
}

// ── 그리드 라인 워프 — React state 경유 없이 SVG path `d` 를 직접 업데이트 ──────
//
// 공통: (x, y) → (x, getWarpedY) — arc(x) × y별 weight(y) × |ratio| 완화
//
// y 위치·스크롤 ratio 에 따라 weight(y)가 달라짐(일반/다운/업).
//   가로 라인: 각 (x, y)에 getWarpedY
//   세로 라인: (x, y)를 y 방향으로 잘라 폴리라인 (한 x에서도 y에 따라 warped Y가 다름)
//
interface LinesHandle {
  /** 현재 refs 로 즉시 다시 그린다. */
  rebuild: () => void;
}

// ── 가로 라인 ──────────────────────────────────────────────────────────────────
interface HLinesProps {
  yStops: number[];
  width: number;
  height: number;
  cellSizePx: number;
  currentRef: MutableRefObject<number>;
}

const HorizontalLinesLayer = forwardRef<LinesHandle, HLinesProps>(function HorizontalLinesLayer(
  { yStops, width, height, cellSizePx, currentRef },
  ref,
) {
  const pathRefs = useRef<Array<SVGPathElement | null>>([]);

  const rebuild = useCallback(() => {
    const ratio = currentRef.current;
    const segCount = Math.min(
      MAX_SEGMENT_COUNT,
      Math.max(16, Math.ceil(width / cellSizePx) * 4),
    );

    for (let i = 0; i < yStops.length; i++) {
      const path = pathRefs.current[i];
      if (!path) continue;
      const y = yStops[i];
      const parts: string[] = [];
      for (let s = 0; s <= segCount; s++) {
        const x = (width * s) / segCount;
        parts.push(
          `${s === 0 ? "M" : "L"} ${x.toFixed(1)} ${getWarpedY(x, y, width, height, ratio).toFixed(2)}`,
        );
      }
      const d = parts.join(" ");
      path.setAttribute("d", d);
    }
  }, [yStops, width, height, cellSizePx, currentRef]);

  useImperativeHandle(ref, () => ({ rebuild }), [rebuild]);

  useEffect(() => { rebuild(); }, [rebuild]);

  return (
    <>
      {yStops.map((_, i) => (
        <path
          key={`hline-${i}`}
          ref={(el) => { pathRefs.current[i] = el; }}
          className={styles.line}
        />
      ))}
    </>
  );
});

// ── glow 셀 ────────────────────────────────────────────────────────────────────
// 각 셀의 네 코너에 공통 arc 변형을 적용. polygon 대신 path 를 쓰면 `d` 한 속성만
// setAttribute 로 갱신되어 리렌더 없이 매 프레임 업데이트 가능.
interface GlowCellItem {
  id: number;
  x0: number; y0: number; x1: number; y1: number;
  style: CSSProperties;
}

interface GlowCellsProps {
  cells: GlowCellItem[];
  width: number;
  height: number;
  currentRef: MutableRefObject<number>;
}

const GlowCellsLayer = forwardRef<LinesHandle, GlowCellsProps>(function GlowCellsLayer(
  { cells, width, height, currentRef },
  ref,
) {
  const pathRefs = useRef<Array<SVGPathElement | null>>([]);

  const rebuild = useCallback(() => {
    const ratio = currentRef.current;

    for (let i = 0; i < cells.length; i++) {
      const path = pathRefs.current[i];
      if (!path) continue;
      const { x0, y0, x1, y1 } = cells[i];
      const d =
        `M ${x0} ${getWarpedY(x0, y0, width, height, ratio).toFixed(2)} ` +
        `L ${x1} ${getWarpedY(x1, y0, width, height, ratio).toFixed(2)} ` +
        `L ${x1} ${getWarpedY(x1, y1, width, height, ratio).toFixed(2)} ` +
        `L ${x0} ${getWarpedY(x0, y1, width, height, ratio).toFixed(2)} Z`;
      path.setAttribute("d", d);
    }
  }, [cells, width, height, currentRef]);

  useImperativeHandle(ref, () => ({ rebuild }), [rebuild]);

  useEffect(() => { rebuild(); }, [rebuild]);

  return (
    <>
      {cells.map((cell, i) => (
        <path
          key={`cell-${cell.id}`}
          ref={(el) => { pathRefs.current[i] = el; }}
          className={styles.glowCell}
          style={cell.style}
        />
      ))}
    </>
  );
});

// ── 세로 라인 ──────────────────────────────────────────────────────────────────
// y에 따라 weight가 달라지므로 (x, y) → getWarpedY 로 세로로 샘플링한 폴리라인.
interface VLinesProps {
  xStops: number[];
  height: number;
  width: number;
  cellSizePx: number;
  currentRef: MutableRefObject<number>;
}

const VerticalLinesLayer = forwardRef<LinesHandle, VLinesProps>(function VerticalLinesLayer(
  { xStops, height, width, cellSizePx, currentRef },
  ref,
) {
  const pathRefs = useRef<Array<SVGPathElement | null>>([]);

  const rebuild = useCallback(() => {
    const ratio = currentRef.current;
    const ySegCount = Math.min(
      MAX_SEGMENT_COUNT,
      Math.max(16, Math.ceil(height / cellSizePx) * 4),
    );
    const padY = CURVE_DEPTH_PX + 2;
    const y0 = -padY;
    const y1 = height + padY;

    for (let j = 0; j < xStops.length; j++) {
      const path = pathRefs.current[j];
      if (!path) continue;
      const x = xStops[j];
      const parts: string[] = [];
      for (let s = 0; s <= ySegCount; s++) {
        const t = s / ySegCount;
        const y = y0 + t * (y1 - y0);
        const yw = getWarpedY(x, y, width, height, ratio);
        parts.push(`${s === 0 ? "M" : "L"} ${x.toFixed(2)} ${yw.toFixed(2)}`);
      }
      path.setAttribute("d", parts.join(" "));
    }
  }, [xStops, height, width, cellSizePx, currentRef]);

  useImperativeHandle(ref, () => ({ rebuild }), [rebuild]);

  useEffect(() => { rebuild(); }, [rebuild]);

  return (
    <>
      {xStops.map((_, j) => (
        <path
          key={`vline-${j}`}
          ref={(el) => { pathRefs.current[j] = el; }}
          className={styles.line}
        />
      ))}
    </>
  );
});


export function GridBackground({ visible = true }: GridBackgroundProps) {
  const backgroundRef = useRef<HTMLDivElement>(null);
  const visibleRef = useRef(visible);
  const gridWarpRef = useRef<GridScrollWarp>({
    intent: GRID_WARP_SCROLL_DOWN,
    dir: GRID_WARP_SCROLL_DOWN,
  });
  const rafRef = useRef<number | null>(null);
  const targetRef = useRef(0);
  const currentRef = useRef(0);
  const hLinesHandleRef = useRef<LinesHandle | null>(null);
  const vLinesHandleRef = useRef<LinesHandle | null>(null);
  const cellsHandleRef = useRef<LinesHandle | null>(null);
  /** 한 번이라도 스크롤(휠)이 발생한 뒤엔, 멈출 때 WARP_RETAIN 으로 제자리 복귀를 막는다. */
  const hasScrolledRef = useRef(false);

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
      // 히어로를 벗어나는 순간 워프를 즉시 원위치로 복귀
      hasScrolledRef.current = false;
      currentRef.current = 0;
      targetRef.current = GRID_WARP_IDLE;
      gridWarpRef.current.intent = GRID_WARP_SCROLL_DOWN;
      gridWarpRef.current.dir = GRID_WARP_IDLE;
      hLinesHandleRef.current?.rebuild();
      vLinesHandleRef.current?.rebuild();
      cellsHandleRef.current?.rebuild();
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

      const w = gridWarpRef.current;
      let nextWarp = w.dir + (w.intent - w.dir) * WARP_DIR_BLEND;
      if (nextWarp > 1) nextWarp = 1;
      else if (nextWarp < -1) nextWarp = -1;
      w.dir = nextWarp;

      // 스크롤 중: 목표 ±1. 멈춘 뒤: 0(직선)으로 복귀시키지 않고
      //   마지막 방향에 WARP_RETAIN(예: 72%) 를 남겨 "제자리" 완전 복구를 막는다.
      // 히어로 밖(visible=false)은 위 effect 에서 0 + hasScrolled 리셋.
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

      // 모든 격자 점 (x, y) → getWarpedY 변형을 라인·셀에 동시 적용.
      hLinesHandleRef.current?.rebuild();
      vLinesHandleRef.current?.rebuild();
      cellsHandleRef.current?.rebuild();

      const deltaToTarget = Math.abs(targetRef.current - currentRef.current);
      // target이 WARP_RETAIN으로 0이 아니어도 current가 수렴하면 루프 종료
      const stillMoving = deltaToTarget > EPSILON || isScrolling;

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
      if (!visibleRef.current) {
        previousScrollY = currentScrollY;
        return;
      }

      const delta = currentScrollY - previousScrollY;
      previousScrollY = currentScrollY;

      if (currentScrollY < 0) return;
      if (Math.abs(delta) < 0.2) return;

      // 의도 방향만 즉시 갱신 — 실제 굽힘은 tick 에서 gridWarpRef.current.dir 보간.
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
  }, []);

  // ── 핑크 오버레이 RAF ── (제거됨)
  // 스크롤 중/정지 전환 시 배경 톤이 바뀌어 글래스 렌즈 투과 이미지와 미세하게 이질감이 발생.
  // baseWash(고정 gradient) 만 남기고 scrollHot 으로 트리거되던 색상 보간을 삭제했다.

  const width = Math.max(1, size.width);
  const height = Math.max(1, size.height);

  const xStops = useMemo(() => createStops(width, cellSizePx), [width, cellSizePx]);
  const yStops = useMemo(() => createStops(height, cellSizePx), [height, cellSizePx]);


  // glow 셀 — 체커보드 절반. 각 셀을 x0/y0/x1/y1 코너 좌표 + 토큰(알파/애니) 쌍으로 저장.
  //   라인과 동일한 arc 변형을 매 프레임 네 코너에 적용해 면 전체가 휘는 느낌을 유지한다.
  const glowCells = useMemo(() => {
    const list: Array<{
      id: number;
      x0: number; y0: number; x1: number; y1: number;
      style: CSSProperties;
    }> = [];
    let index = 0;
    for (let row = 0; row < yStops.length - 1; row++) {
      for (let col = 0; col < xStops.length - 1; col++) {
        if ((row + col) % 2 !== 0) { index++; continue; }
        const x0 = xStops[col], x1 = xStops[col + 1];
        const y0 = yStops[row], y1 = yStops[row + 1];
        list.push({
          id: index,
          x0, y0, x1, y1,
          style: {
            "--delay":    `${(seededNoise(index + 1) * 7).toFixed(2)}s`,
            "--duration": `${(3.6 + seededNoise(index + 17) * 4.8).toFixed(2)}s`,
            "--alpha":    (0.34 + seededNoise(index + 41) * 0.42).toFixed(2),
          } as CSSProperties,
        });
        index++;
      }
    }
    return list;
  }, [xStops, yStops]);

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
          <GlowCellsLayer
            ref={cellsHandleRef}
            cells={glowCells}
            width={width}
            height={height}
            currentRef={currentRef}
          />
        </g>
        <g className={styles.lineLayer}>
          {/* 가로: 일반/스크롤에 따라 y별 곡률 + arc(x) */}
          <HorizontalLinesLayer
            ref={hLinesHandleRef}
            yStops={yStops}
            width={width}
            height={height}
            cellSizePx={cellSizePx}
            currentRef={currentRef}
          />
          <VerticalLinesLayer
            ref={vLinesHandleRef}
            xStops={xStops}
            height={height}
            width={width}
            cellSizePx={cellSizePx}
            currentRef={currentRef}
          />
        </g>
      </svg>
    </div>
  );
}
