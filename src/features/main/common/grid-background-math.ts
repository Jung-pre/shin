/**
 * 메인 배경 격자 — 평면·원통 공통 수학 (워프 + 스텝 생성).
 */

export const CELL_SIZE_REM = 8.75;

export const seededNoise = (seed: number) => {
  const value = Math.sin(seed * 12.9898) * 43758.5453;
  return value - Math.floor(value);
};

export const createStops = (length: number, targetStepPx: number) => {
  if (length <= 1) return [0, 1];
  const step = Math.max(1, targetStepPx);
  const n = Math.max(1, Math.ceil(length / step));
  return Array.from({ length: n + 1 }, (_, i) => (i * length) / n);
};

/** `createStops(...).length` 와 동일 — 배열 할당 없이 WebGL 매 프레임에서 사용 */
export function countStopsForGrid(length: number, targetStepPx: number): number {
  if (length <= 1) return 2;
  const step = Math.max(1, targetStepPx);
  const n = Math.max(1, Math.ceil(length / step));
  return n + 1;
}

/** 세로 방향 배럴 워프 최대 변위(px) — 원통·평면 배경 공통 */
export const CURVE_DEPTH_PX = 192;
export const MAX_SEGMENT_COUNT = 32;

export const CURVE_SMOOTH = 0.06;
export const SCROLL_IDLE_MS = 300;
export const EPSILON = 0.00035;
export const MODE_SWITCH_DELTA_THRESHOLD = 1.2;
export const WARP_RETAIN = 0.72;
export const WARP_DIR_BLEND = 0.11;

export const GRID_WARP_IDLE = 0;
export const GRID_WARP_SCROLL_DOWN = -1;
export const GRID_WARP_SCROLL_UP = 1;
export const GRID_BASE_CURVE_STRENGTH = 0.5;
export const GRID_SCROLL_CURVE_STRENGTH = 0.94;

const clamp01 = (value: number) => Math.min(1, Math.max(0, value));

export const getHorizontalCurveWeight = (y: number, height: number, ratio: number) => {
  const yNorm = clamp01(y / Math.max(1, height));
  const absRatio = Math.abs(ratio);
  const easedRatio = Math.pow(absRatio, 0.72);
  const idleWeight = (0.5 - yNorm) * 2 * GRID_BASE_CURVE_STRENGTH;
  const scrollWeight =
    ratio < 0
      ? -yNorm * GRID_SCROLL_CURVE_STRENGTH
      : (1 - yNorm) * GRID_SCROLL_CURVE_STRENGTH;

  return idleWeight + (scrollWeight - idleWeight) * easedRatio;
};

/** 평면 논리 좌표(x,y)에서 세로 방향 워프만 적용 — 라인·셀 공통 */
export const getWarpedY = (
  x: number,
  y: number,
  width: number,
  height: number,
  ratio: number,
) => {
  const xNorm = (x / Math.max(1, width)) * 2 - 1;
  const arc = Math.max(0, 1 - xNorm * xNorm);
  return y + arc * CURVE_DEPTH_PX * getHorizontalCurveWeight(y, height, ratio);
};

/**
 * 관람자가 원통 축 위에 있을 때, 전개면 가로 xf를 화면 X로 사영 (직교 투영, yz 평면).
 * 중앙은 평면 그리드에 가깝고 좌우로 원통 면이 당겨진다.
 *
 * `rotationRad`: Y축 회전 위상(패턴이 좌우로 흐름). 3D 메시 없이 θ에 위상만 더해 사영.
 */
/** 화면에 걸리는 원통 호의 반각(rad) — `arcScale`과 함께 쓰면 더 넓은 원통 일부처럼 보임 */
export const CYLINDER_THETA_MAX_DEFAULT = (38 * Math.PI) / 180;

/** θ 범위가 (-π/2, π/2) 안에 들어가야 xf→화면X 가 단조 — 넘으면 세로선 순서 뒤집혀 ‘끊김’ 발생 */
const CYL_ROT_EPS = 0.025;

/** 유효 호 각 = thetaMaxRad × arcScale */
export function cylRotationSafeHalfSpanRad(thetaMaxRad: number, arcScale = 1): number {
  const span = thetaMaxRad * arcScale;
  return Math.max(0, Math.PI / 2 - span - CYL_ROT_EPS);
}

export function cylScreenX(
  xf: number,
  width: number,
  thetaMaxRad = CYLINDER_THETA_MAX_DEFAULT,
  rotationRad = 0,
  arcScale = 1,
): number {
  const w = Math.max(1, width);
  const span = thetaMaxRad * arcScale;
  const half = cylRotationSafeHalfSpanRad(thetaMaxRad, arcScale);
  const rot = Math.max(-half, Math.min(half, rotationRad));
  const theta = (xf / w - 0.5) * 2 * span + rot;
  const denom = Math.sin(span);
  if (Math.abs(denom) < 1e-6) return xf;
  return w * 0.5 + ((w * 0.5) * Math.sin(theta)) / denom;
}
