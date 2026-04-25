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
const CURVE_DEPTH_PX = 248;
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
// 공통 변형: 모든 격자 점 (x, y) → (x, y + arc(x) * magnitude)
//   arc(x) = max(0, 1 - xNorm²)   // 중앙 1, 좌우 끝 0 인 종(bell) 모양
//   xNorm  = x / width * 2 - 1    // [-1, 1] 정규화
//   magnitude = eased(|ratio|) * CURVE_DEPTH_PX * axis.dir   (dir ∈ [-1,1] 보간)
//
// 이 변형 하나로 격자 전체 면이 한 장의 활처럼 휜 것처럼 보인다.
//   가로 라인(y=y_i): 점마다 dy 가 달라 활 모양 곡선
//   세로 라인(x=x_j): 점마다 dy 가 같아 기둥 전체가 동일 dy 만큼 상하 이동
//                    → 중앙 열은 가장 많이, 양끝 열은 0 → 기둥들의 배열이 활처럼 분포
//
interface LinesHandle {
  /** 현재 refs 로 즉시 다시 그린다. */
  rebuild: () => void;
}

// ── 가로 라인 ──────────────────────────────────────────────────────────────────
interface HLinesProps {
  yStops: number[];
  width: number;
  cellSizePx: number;
  currentRef: MutableRefObject<number>;
  warpAxisRef: MutableRefObject<GridScrollWarp>;
}

const HorizontalLinesLayer = forwardRef<LinesHandle, HLinesProps>(function HorizontalLinesLayer(
  { yStops, width, cellSizePx, currentRef, warpAxisRef },
  ref,
) {
  const pathRefs = useRef<Array<SVGPathElement | null>>([]);

  const rebuild = useCallback(() => {
    const ratio = currentRef.current;
    const absRatio = Math.abs(ratio);
    const segCount = Math.min(
      MAX_SEGMENT_COUNT,
      Math.max(16, Math.ceil(width / cellSizePx) * 4),
    );
    const dir = warpAxisRef.current.dir;
    const eased = Math.pow(absRatio, 0.72);
    const magnitude = eased * CURVE_DEPTH_PX * dir;
    const invW = 1 / Math.max(1, width);

    for (let i = 0; i < yStops.length; i++) {
      const path = pathRefs.current[i];
      if (!path) continue;
      const y = yStops[i];
      let d: string;
      if (absRatio < EPSILON) {
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
  }, [yStops, width, cellSizePx, currentRef, warpAxisRef]);

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
  currentRef: MutableRefObject<number>;
  warpAxisRef: MutableRefObject<GridScrollWarp>;
}

const GlowCellsLayer = forwardRef<LinesHandle, GlowCellsProps>(function GlowCellsLayer(
  { cells, width, currentRef, warpAxisRef },
  ref,
) {
  const pathRefs = useRef<Array<SVGPathElement | null>>([]);

  const rebuild = useCallback(() => {
    const ratio = currentRef.current;
    const absRatio = Math.abs(ratio);
    const dir = warpAxisRef.current.dir;
    const eased = Math.pow(absRatio, 0.72);
    const magnitude = eased * CURVE_DEPTH_PX * dir;
    const invW = 1 / Math.max(1, width);

    for (let i = 0; i < cells.length; i++) {
      const path = pathRefs.current[i];
      if (!path) continue;
      const { x0, y0, x1, y1 } = cells[i];
      let d: string;
      if (absRatio < EPSILON) {
        d = `M ${x0} ${y0} L ${x1} ${y0} L ${x1} ${y1} L ${x0} ${y1} Z`;
      } else {
        const xn0 = x0 * invW * 2 - 1;
        const xn1 = x1 * invW * 2 - 1;
        const dy0 = Math.max(0, 1 - xn0 * xn0) * magnitude;
        const dy1 = Math.max(0, 1 - xn1 * xn1) * magnitude;
        d =
          `M ${x0} ${(y0 + dy0).toFixed(2)} ` +
          `L ${x1} ${(y0 + dy1).toFixed(2)} ` +
          `L ${x1} ${(y1 + dy1).toFixed(2)} ` +
          `L ${x0} ${(y1 + dy0).toFixed(2)} Z`;
      }
      path.setAttribute("d", d);
    }
  }, [cells, width, currentRef, warpAxisRef]);

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
// 세로 라인은 x=x_j 에 고정되므로 같은 기둥 위의 모든 점 dy = arc(x_j)·mag 가 동일.
// 따라서 기둥 자체는 여전히 "직선" 이지만, 기둥 배열의 시작/끝 Y 가
//   중앙 기둥 ↓(또는 ↑) 최대, 양끝 기둥 0
// 형태로 분포해 격자 면 전체가 활처럼 휜 것처럼 보인다.
interface VLinesProps {
  xStops: number[];
  height: number;
  width: number;
  currentRef: MutableRefObject<number>;
  warpAxisRef: MutableRefObject<GridScrollWarp>;
}

const VerticalLinesLayer = forwardRef<LinesHandle, VLinesProps>(function VerticalLinesLayer(
  { xStops, height, width, currentRef, warpAxisRef },
  ref,
) {
  const pathRefs = useRef<Array<SVGPathElement | null>>([]);

  const rebuild = useCallback(() => {
    const ratio = currentRef.current;
    const absRatio = Math.abs(ratio);
    const dir = warpAxisRef.current.dir;
    const eased = Math.pow(absRatio, 0.72);
    const magnitude = eased * CURVE_DEPTH_PX * dir;
    const invW = 1 / Math.max(1, width);
    // 기둥이 통째로 이동해도 상/하단이 잘리지 않도록 여유
    const pad = CURVE_DEPTH_PX + 2;

    for (let j = 0; j < xStops.length; j++) {
      const path = pathRefs.current[j];
      if (!path) continue;
      const x = xStops[j];
      let d: string;
      if (absRatio < EPSILON) {
        d = `M ${x} 0 L ${x} ${height}`;
      } else {
        const xNorm = x * invW * 2 - 1;
        const arc = Math.max(0, 1 - xNorm * xNorm);
        const dy = arc * magnitude;
        d = `M ${x} ${(-pad + dy).toFixed(2)} L ${x} ${(height + pad + dy).toFixed(2)}`;
      }
      path.setAttribute("d", d);
    }
  }, [xStops, height, width, currentRef, warpAxisRef]);

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
  const gridWarpRef = useRef<GridScrollWarp>({ intent: -1, dir: -1 });
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
      targetRef.current = 0;
      gridWarpRef.current.intent = -1;
      gridWarpRef.current.dir = 0;
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
        targetRef.current = 0;
      } else if (hasScrolledRef.current) {
        targetRef.current = activeDir * WARP_RETAIN;
      } else {
        targetRef.current = 0;
      }

      currentRef.current += (targetRef.current - currentRef.current) * CURVE_SMOOTH;

      if (
        !isScrolling &&
        Math.abs(targetRef.current) < EPSILON &&
        Math.abs(currentRef.current) < EPSILON
      ) {
        currentRef.current = 0;
      }

      // 모든 격자 점 (x, y) → (x, y + arc(x)·mag) 변형을 라인·셀에 동시 적용.
      hLinesHandleRef.current?.rebuild();
      vLinesHandleRef.current?.rebuild();
      cellsHandleRef.current?.rebuild();

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
        gridWarpRef.current.intent = -1;
      } else if (delta < -MODE_SWITCH_DELTA_THRESHOLD) {
        gridWarpRef.current.intent = 1;
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
            currentRef={currentRef}
            warpAxisRef={gridWarpRef}
          />
        </g>
        <g className={styles.lineLayer}>
          {/* 가로 라인: arc(x) 기반 상하 휨 */}
          <HorizontalLinesLayer
            ref={hLinesHandleRef}
            yStops={yStops}
            width={width}
            cellSizePx={cellSizePx}
            currentRef={currentRef}
            warpAxisRef={gridWarpRef}
          />
          {/* 세로 라인: 같은 기둥 위의 점들이 공통 dy=arc(x_j)·mag 만큼 이동 → 기둥 자체는 직선이지만
              기둥 배열의 수직 위치가 중앙↓·양끝0 으로 분포해 격자 면 전체가 활처럼 휜 것처럼 보임. */}
          <VerticalLinesLayer
            ref={vLinesHandleRef}
            xStops={xStops}
            height={height}
            width={width}
            currentRef={currentRef}
            warpAxisRef={gridWarpRef}
          />
        </g>
      </svg>
    </div>
  );
}
