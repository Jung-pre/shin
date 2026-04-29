"use client";

/**
 * 평면 GridBackground 와 동일한 스크롤 워프(getWarpedY).
 * 가로는 cylScreenX(호 스케일 arcScale 가능).
 * 무한 원통 느낌: 그리드 한 주기(width)와 맞춘 translate 모듈로 끊김 없이 흐름.
 */

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
import {
  CELL_SIZE_REM,
  createStops,
  CURVE_DEPTH_PX,
  CURVE_SMOOTH,
  cylRotationSafeHalfSpanRad,
  cylScreenX,
  EPSILON,
  CYLINDER_THETA_MAX_DEFAULT,
  getWarpedY,
  GRID_WARP_IDLE,
  GRID_WARP_SCROLL_DOWN,
  GRID_WARP_SCROLL_UP,
  MAX_SEGMENT_COUNT,
  MODE_SWITCH_DELTA_THRESHOLD,
  SCROLL_IDLE_MS,
  seededNoise,
  WARP_DIR_BLEND,
  WARP_RETAIN,
} from "./grid-background-math";

export type GridCylinderBackgroundProps = {
  visible?: boolean;
  thetaMaxRad?: number;
  /** 호를 넓게(>1) — 같은 화면폭에서 더 큰 원통 일부처럼 보임 */
  cylinderArcScale?: number;
  /** 가로로 무한히 흐르는 속도(px/s). createStops 로 끝점이 width 에 맞춰져 어깨가 맞물림 */
  cylinderScrollPxPerSec?: number;
};

interface GridScrollWarp {
  intent: number;
  dir: number;
}

interface LinesHandle {
  rebuild: () => void;
}

interface HLinesProps {
  yStops: number[];
  width: number;
  height: number;
  cellSizePx: number;
  currentRef: MutableRefObject<number>;
  thetaMaxRad: number;
  arcScale: number;
  rotationRadRef: MutableRefObject<number>;
}

const CylinderHorizontalLinesLayer = forwardRef<LinesHandle, HLinesProps>(
  function CylinderHorizontalLinesLayer(
    { yStops, width, height, cellSizePx, currentRef, thetaMaxRad, arcScale, rotationRadRef },
    ref,
  ) {
    const pathRefs = useRef<Array<SVGPathElement | null>>([]);

    const rebuild = useCallback(() => {
      const ratio = currentRef.current;
      const rot = rotationRadRef.current;
      const segCount = Math.min(
        MAX_SEGMENT_COUNT * 2,
        Math.max(48, Math.ceil(width / cellSizePx) * 10),
      );

      for (let i = 0; i < yStops.length; i++) {
        const path = pathRefs.current[i];
        if (!path) continue;
        const y = yStops[i];
        const parts: string[] = [];
        for (let s = 0; s <= segCount; s++) {
          const xf = (width * s) / segCount;
          const xs = cylScreenX(xf, width, thetaMaxRad, rot, arcScale);
          parts.push(
            `${s === 0 ? "M" : "L"} ${xs.toFixed(2)} ${getWarpedY(xf, y, width, height, ratio).toFixed(2)}`,
          );
        }
        path.setAttribute("d", parts.join(" "));
      }
    }, [yStops, width, height, cellSizePx, currentRef, thetaMaxRad, arcScale, rotationRadRef]);

    useImperativeHandle(ref, () => ({ rebuild }), [rebuild]);

    useEffect(() => {
      rebuild();
    }, [rebuild]);

    return (
      <>
        {yStops.map((_, i) => (
          <path
            key={`chline-${i}`}
            ref={(el) => {
              pathRefs.current[i] = el;
            }}
            className={styles.line}
          />
        ))}
      </>
    );
  },
);

interface GlowCellItem {
  id: number;
  x0: number;
  y0: number;
  x1: number;
  y1: number;
  style: CSSProperties;
}

interface GlowCellsProps {
  cells: GlowCellItem[];
  width: number;
  height: number;
  currentRef: MutableRefObject<number>;
  thetaMaxRad: number;
  arcScale: number;
  rotationRadRef: MutableRefObject<number>;
}

const CylinderGlowCellsLayer = forwardRef<LinesHandle, GlowCellsProps>(
  function CylinderGlowCellsLayer(
    { cells, width, height, currentRef, thetaMaxRad, arcScale, rotationRadRef },
    ref,
  ) {
    const pathRefs = useRef<Array<SVGPathElement | null>>([]);

    const rebuild = useCallback(() => {
      const ratio = currentRef.current;
      const rot = rotationRadRef.current;

      for (let i = 0; i < cells.length; i++) {
        const path = pathRefs.current[i];
        if (!path) continue;
        const { x0, y0, x1, y1 } = cells[i];
        const x0s = cylScreenX(x0, width, thetaMaxRad, rot, arcScale);
        const x1s = cylScreenX(x1, width, thetaMaxRad, rot, arcScale);
        const d =
          `M ${x0s.toFixed(2)} ${getWarpedY(x0, y0, width, height, ratio).toFixed(2)} ` +
          `L ${x1s.toFixed(2)} ${getWarpedY(x1, y0, width, height, ratio).toFixed(2)} ` +
          `L ${x1s.toFixed(2)} ${getWarpedY(x1, y1, width, height, ratio).toFixed(2)} ` +
          `L ${x0s.toFixed(2)} ${getWarpedY(x0, y1, width, height, ratio).toFixed(2)} Z`;
        path.setAttribute("d", d);
      }
    }, [cells, width, height, currentRef, thetaMaxRad, arcScale, rotationRadRef]);

    useImperativeHandle(ref, () => ({ rebuild }), [rebuild]);

    useEffect(() => {
      rebuild();
    }, [rebuild]);

    return (
      <>
        {cells.map((cell, i) => (
          <path
            key={`ccell-${cell.id}`}
            ref={(el) => {
              pathRefs.current[i] = el;
            }}
            className={styles.glowCell}
            style={cell.style}
          />
        ))}
      </>
    );
  },
);

interface VLinesProps {
  xStops: number[];
  height: number;
  width: number;
  cellSizePx: number;
  currentRef: MutableRefObject<number>;
  thetaMaxRad: number;
  arcScale: number;
  rotationRadRef: MutableRefObject<number>;
}

const CylinderVerticalLinesLayer = forwardRef<LinesHandle, VLinesProps>(
  function CylinderVerticalLinesLayer(
    { xStops, height, width, cellSizePx, currentRef, thetaMaxRad, arcScale, rotationRadRef },
    ref,
  ) {
    const pathRefs = useRef<Array<SVGPathElement | null>>([]);

    const rebuild = useCallback(() => {
      const ratio = currentRef.current;
      const rot = rotationRadRef.current;
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
        const xf = xStops[j];
        const xProj = cylScreenX(xf, width, thetaMaxRad, rot, arcScale);
        const parts: string[] = [];
        for (let s = 0; s <= ySegCount; s++) {
          const t = s / ySegCount;
          const y = y0 + t * (y1 - y0);
          const yw = getWarpedY(xf, y, width, height, ratio);
          parts.push(`${s === 0 ? "M" : "L"} ${xProj.toFixed(2)} ${yw.toFixed(2)}`);
        }
        path.setAttribute("d", parts.join(" "));
      }
    }, [xStops, height, width, cellSizePx, currentRef, thetaMaxRad, arcScale, rotationRadRef]);

    useImperativeHandle(ref, () => ({ rebuild }), [rebuild]);

    useEffect(() => {
      rebuild();
    }, [rebuild]);

    return (
      <>
        {xStops.map((_, j) => (
          <path
            key={`cvline-${j}`}
            ref={(el) => {
              pathRefs.current[j] = el;
            }}
            className={styles.line}
          />
        ))}
      </>
    );
  },
);

interface CornerTickLayerProps {
  xStops: number[];
  yStops: number[];
  width: number;
  height: number;
  currentRef: MutableRefObject<number>;
  thetaMaxRad: number;
  arcScale: number;
  rotationRadRef: MutableRefObject<number>;
}

const CylinderCornerTickLayer = forwardRef<LinesHandle, CornerTickLayerProps>(
  function CylinderCornerTickLayer(
    { xStops, yStops, width, height, currentRef, thetaMaxRad, arcScale, rotationRadRef },
    ref,
  ) {
    const gRefs = useRef<Array<SVGGElement | null>>([]);

    const tickIndices = useMemo(() => {
      const list: { i: number; j: number }[] = [];
      for (let i = 0; i < xStops.length; i += 2) {
        for (let j = 0; j < yStops.length; j += 2) {
          list.push({ i, j });
        }
      }
      return list;
    }, [xStops, yStops]);

    const rebuild = useCallback(() => {
      const ratio = currentRef.current;
      const rot = rotationRadRef.current;
      for (let k = 0; k < tickIndices.length; k++) {
        const g = gRefs.current[k];
        if (!g) continue;
        const { i, j } = tickIndices[k];
        const xf = xStops[i];
        const y00 = yStops[j];
        const wy = getWarpedY(xf, y00, width, height, ratio);
        const xp = cylScreenX(xf, width, thetaMaxRad, rot, arcScale);
        g.setAttribute("transform", `translate(${xp - 5} ${wy - 5})`);
      }
    }, [tickIndices, xStops, yStops, width, height, currentRef, thetaMaxRad, arcScale, rotationRadRef]);

    useImperativeHandle(ref, () => ({ rebuild }), [rebuild]);

    useEffect(() => {
      rebuild();
    }, [rebuild]);

    return (
      <g className={styles.cornerTickLayer} aria-hidden>
        {tickIndices.map((pair, k) => (
          <g
            key={`ctick-${pair.i}-${pair.j}`}
            ref={(el) => {
              gRefs.current[k] = el;
            }}
          >
            <path d="M5 0V10" className={styles.cornerTickMark} fill="none" />
            <path d="M0 5H10" className={styles.cornerTickMark} fill="none" />
          </g>
        ))}
      </g>
    );
  },
);

export function GridCylinderBackground({
  visible = true,
  thetaMaxRad = CYLINDER_THETA_MAX_DEFAULT,
  cylinderArcScale = 1.26,
  cylinderScrollPxPerSec = 26,
}: GridCylinderBackgroundProps) {
  const backgroundRef = useRef<HTMLDivElement>(null);
  const visibleRef = useRef(visible);
  const rotationRadRef = useRef(0);
  const scrollPhasePxRef = useRef(0);
  const scrollWrapRef = useRef<SVGGElement>(null);
  const widthPxRef = useRef(1);

  const gridWarpRef = useRef<GridScrollWarp>({
    intent: GRID_WARP_SCROLL_DOWN,
    dir: GRID_WARP_SCROLL_DOWN,
  });
  const rafRef = useRef<number | null>(null);
  const driveRafRef = useRef<number | null>(null);
  const targetRef = useRef(0);
  const currentRef = useRef(0);
  const hLinesHandleRef = useRef<LinesHandle | null>(null);
  const vLinesHandleRef = useRef<LinesHandle | null>(null);
  const cellsHandleRef = useRef<LinesHandle | null>(null);
  const cornerTickHandleRef = useRef<LinesHandle | null>(null);
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
      hasScrolledRef.current = false;
      currentRef.current = 0;
      targetRef.current = GRID_WARP_IDLE;
      gridWarpRef.current.intent = GRID_WARP_SCROLL_DOWN;
      gridWarpRef.current.dir = GRID_WARP_IDLE;
      hLinesHandleRef.current?.rebuild();
      vLinesHandleRef.current?.rebuild();
      cellsHandleRef.current?.rebuild();
      cornerTickHandleRef.current?.rebuild();
    }
  }, [visible]);

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

      hLinesHandleRef.current?.rebuild();
      vLinesHandleRef.current?.rebuild();
      cellsHandleRef.current?.rebuild();
      cornerTickHandleRef.current?.rebuild();

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
  }, []);

  const width = Math.max(1, size.width);
  const height = Math.max(1, size.height);

  widthPxRef.current = width;

  const xStops = useMemo(() => createStops(width, cellSizePx), [width, cellSizePx]);
  const yStops = useMemo(() => createStops(height, cellSizePx), [height, cellSizePx]);

  const glowCells = useMemo(() => {
    const list: Array<{
      id: number;
      x0: number;
      y0: number;
      x1: number;
      y1: number;
      style: CSSProperties;
    }> = [];
    let index = 0;
    for (let row = 0; row < yStops.length - 1; row++) {
      for (let col = 0; col < xStops.length - 1; col++) {
        if ((row + col) % 2 !== 0) {
          index++;
          continue;
        }
        const x0 = xStops[col],
          x1 = xStops[col + 1];
        const y0 = yStops[row],
          y1 = yStops[row + 1];
        list.push({
          id: index,
          x0,
          y0,
          x1,
          y1,
          style: {
            "--delay": `${(seededNoise(index + 1) * 7).toFixed(2)}s`,
            "--duration": `${(3.6 + seededNoise(index + 17) * 4.8).toFixed(2)}s`,
            "--alpha": (0.34 + seededNoise(index + 41) * 0.42).toFixed(2),
          } as CSSProperties,
        });
        index++;
      }
    }
    return list;
  }, [xStops, yStops]);

  /** 무한 가로 흐름 + 호 방향 미세 워블 — 단조 범위 안에서만 sin */
  useEffect(() => {
    const mq =
      typeof window !== "undefined"
        ? window.matchMedia("(prefers-reduced-motion: reduce)")
        : null;

    let last = performance.now();

    const loop = (now: number) => {
      const dt = Math.min(0.072, (now - last) / 1000);
      last = now;

      const wpx = widthPxRef.current;
      const scrollOn = Math.abs(cylinderScrollPxPerSec) > 1e-6;

      if (visibleRef.current && !mq?.matches && wpx > 2) {
        if (scrollOn) {
          scrollPhasePxRef.current += cylinderScrollPxPerSec * dt;
          const mod = ((scrollPhasePxRef.current % wpx) + wpx) % wpx;
          scrollWrapRef.current?.setAttribute("transform", `translate(${-mod}, 0)`);
        } else {
          scrollWrapRef.current?.setAttribute("transform", "translate(0, 0)");
        }

        const span = cylRotationSafeHalfSpanRad(thetaMaxRad, cylinderArcScale);
        rotationRadRef.current = Math.sin(now * 0.00022) * span * 0.88;

        hLinesHandleRef.current?.rebuild();
        vLinesHandleRef.current?.rebuild();
        cellsHandleRef.current?.rebuild();
        cornerTickHandleRef.current?.rebuild();
      }

      driveRafRef.current = requestAnimationFrame(loop);
    };

    driveRafRef.current = requestAnimationFrame(loop);
    return () => {
      if (driveRafRef.current !== null) {
        cancelAnimationFrame(driveRafRef.current);
        driveRafRef.current = null;
      }
    };
  }, [cylinderScrollPxPerSec, thetaMaxRad, cylinderArcScale, visible]);

  return (
    <div
      ref={backgroundRef}
      className={styles.background}
      data-hidden={!visible || undefined}
      aria-hidden
    >
      <div className={styles.baseWash} />
      <svg className={styles.gridSvg} viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="none">
        <g ref={scrollWrapRef}>
          <g className={styles.glowLayer}>
            <CylinderGlowCellsLayer
              ref={cellsHandleRef}
              cells={glowCells}
              width={width}
              height={height}
              currentRef={currentRef}
              thetaMaxRad={thetaMaxRad}
              arcScale={cylinderArcScale}
              rotationRadRef={rotationRadRef}
            />
          </g>
          <g className={styles.lineLayer}>
            <CylinderHorizontalLinesLayer
              ref={hLinesHandleRef}
              yStops={yStops}
              width={width}
              height={height}
              cellSizePx={cellSizePx}
              currentRef={currentRef}
              thetaMaxRad={thetaMaxRad}
              arcScale={cylinderArcScale}
              rotationRadRef={rotationRadRef}
            />
            <CylinderVerticalLinesLayer
              ref={vLinesHandleRef}
              xStops={xStops}
              height={height}
              width={width}
              cellSizePx={cellSizePx}
              currentRef={currentRef}
              thetaMaxRad={thetaMaxRad}
              arcScale={cylinderArcScale}
              rotationRadRef={rotationRadRef}
            />
          </g>
          <CylinderCornerTickLayer
            ref={cornerTickHandleRef}
            xStops={xStops}
            yStops={yStops}
            width={width}
            height={height}
            currentRef={currentRef}
            thetaMaxRad={thetaMaxRad}
            arcScale={cylinderArcScale}
            rotationRadRef={rotationRadRef}
          />
        </g>
      </svg>
    </div>
  );
}
