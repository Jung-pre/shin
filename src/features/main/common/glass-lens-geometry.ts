import type { SceneConfig } from "./glass-scene-config.types";

/**
 * 납작도 0(두꺼운 렌즈) ~ 1(얇은 렌즈)
 *
 * XY는 히어로에서 이미 맞춰 둔 렌즈 지름/간격 체감을 유지하고,
 * 납작도는 Z 두께만 연속적으로 바꾼다. 이전 방식처럼 XY까지 같이 줄이면
 * 외부 보정 scale 때문에 렌즈 간격이 튀고, 후반 구간은 Z가 clamp되어 조절감이 약했다.
 */
export function lensFlatnessToScales(t: number): { xy: number; z: number } {
  const c = Math.min(1, Math.max(0, t));
  const xy = 1.52;
  const z = 0.08 + 0.82 * Math.pow(1 - c, 1.8);
  return { xy, z };
}

export function resolveLensScales(
  c: Pick<SceneConfig, "ballMode" | "lensScalesManual" | "lensFlatness" | "orbScaleXY" | "orbScaleZ">,
): { xy: number; z: number } {
  if (c.ballMode) {
    return { xy: 1, z: 1 };
  }
  if (c.lensScalesManual) {
    return { xy: c.orbScaleXY, z: c.orbScaleZ };
  }
  return lensFlatnessToScales(c.lensFlatness);
}

/** "납작 렌즈" 버튼 — 구 제외 기본(중간 납작) */
export function getDefaultFlatLensPatch(): Pick<
  SceneConfig,
  "ballMode" | "lensFlatness" | "lensScalesManual" | "orbScaleXY" | "orbScaleZ"
> {
  const t = 0.5;
  const s = lensFlatnessToScales(t);
  return {
    ballMode: false,
    lensFlatness: t,
    lensScalesManual: false,
    orbScaleXY: s.xy,
    orbScaleZ: s.z,
  };
}
