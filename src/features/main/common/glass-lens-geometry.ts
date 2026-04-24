import type { SceneConfig } from "./glass-scene-config.types";

/**
 * 납짝도 0(두꺼운 슬리브에 가깝게) ~ 1(얇은 렌즈)
 * t=0.5 → 구 예: xy≈0.5, z≈0.3 (이전 수동 기본과 맞춤)
 */
export function lensFlatnessToScales(t: number): { xy: number; z: number } {
  const c = Math.min(1, Math.max(0, t));
  const xy = 0.8 - 0.6 * c;
  const z = Math.max(0.2, 0.9 - 1.2 * c);
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

/** "납작 렌즈" 버튼 — 구 제외 기본(중간 납짝) */
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
