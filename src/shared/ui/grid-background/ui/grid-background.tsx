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

const SCROLL_SENSITIVITY = 0.034;
const EPSILON = 0.0008;
const SPRING_STIFFNESS = 0.26;
const SPRING_DAMPING = 0.74;
const SCROLL_IDLE_MS = 120;

export const GridBackground = () => {
  const backgroundRef = useRef<HTMLDivElement>(null);
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
    let previousScrollY = window.scrollY;
    let isRunning = false;
    let velocity = 0;
    let lastScrollTime = 0;

    const tick = () => {
      const now = performance.now();
      const isScrolling = now - lastScrollTime < SCROLL_IDLE_MS;

      if (!isScrolling) {
        targetRef.current = 0;
      }

      const displacement = targetRef.current - currentRef.current;
      velocity += displacement * SPRING_STIFFNESS;
      velocity *= SPRING_DAMPING;
      currentRef.current += velocity;

      if (Math.abs(currentRef.current) < EPSILON && Math.abs(velocity) < EPSILON && !isScrolling) {
        currentRef.current = 0;
        velocity = 0;
      }

      setCurveRatio(currentRef.current);

      if (Math.abs(currentRef.current) > EPSILON || Math.abs(velocity) > EPSILON || isScrolling) {
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

      if (Math.abs(delta) < 0.2) {
        return;
      }

      lastScrollTime = performance.now();
      targetRef.current = clamp(delta * SCROLL_SENSITIVITY, -1, 1);
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

  const width = Math.max(1, size.width);
  const height = Math.max(1, size.height);
  const curveDepth = curveRatio * 52;

  const xStops = useMemo(() => createStops(width, cellSizePx), [width, cellSizePx]);
  const yStops = useMemo(() => createStops(height, cellSizePx), [height, cellSizePx]);

  const warpPoint = useCallback(
    (x: number, y: number): Point => {
      const horizontalFactor = Math.sin((Math.PI * x) / width);
      const verticalFactor = Math.sin((Math.PI * y) / height);

      return {
        x: clamp(x + curveDepth * 0.18 * verticalFactor, 0, width),
        y: clamp(y + curveDepth * horizontalFactor, 0, height),
      };
    },
    [curveDepth, width, height],
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
          delay: `${(seededNoise(index + 1) * 5.2).toFixed(2)}s`,
          duration: `${(2.4 + seededNoise(index + 17) * 3.2).toFixed(2)}s`,
          alpha: (0.2 + seededNoise(index + 41) * 0.4).toFixed(2),
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
      delay: `${(seededNoise(index + 1) * 5.2).toFixed(2)}s`,
      duration: `${(2.4 + seededNoise(index + 17) * 3.2).toFixed(2)}s`,
      alpha: (0.2 + seededNoise(index + 41) * 0.4).toFixed(2),
    }));
  }, []);

  return (
    <div ref={backgroundRef} className={styles.background} aria-hidden>
      <div className={styles.centerTint} />
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
