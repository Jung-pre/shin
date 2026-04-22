/**
 * VISUMAX 3D 모델 씬 설정 — 타입 + 상수만 분리한 "경량" 모듈.
 *
 * 이 파일은 R3F / drei / three 를 일체 import 하지 않는다.
 * 이유: `machine-section.tsx` 같은 "위쪽" 컴포넌트가 기본값/타입만 필요한데
 *   `visumax-model-scene.tsx` 를 그대로 static import 해버리면 모듈 평가 시점에
 *   `useGLTF.preload(...)` 가 돌아 26MB 짜리 GLB 두 개가 즉시 fetch 된다.
 *   (dynamic import 로 감싼 의미가 사라짐.)
 *
 * 이 파일로 설정만 분리해 두면 machine-section 은 이 경량 모듈에서 타입/기본값을
 * 가져오고, 실제 씬/preload 가 있는 `visumax-model-scene.tsx` 는 next/dynamic 으로만
 * 로드되어 GLB 다운로드가 "Machine 섹션이 실제로 화면에 뜰 때" 시점까지 지연된다.
 */

/** drei <Environment preset> 허용값 — 실용적인 것만 추려서 노출. */
export type EnvPresetKey =
  | "studio"
  | "city"
  | "apartment"
  | "sunset"
  | "dawn"
  | "night"
  | "warehouse"
  | "forest"
  | "park"
  | "lobby";

export const ENV_PRESET_OPTIONS: EnvPresetKey[] = [
  "studio",
  "city",
  "apartment",
  "sunset",
  "dawn",
  "night",
  "warehouse",
  "forest",
  "park",
  "lobby",
];

/**
 * 모델 씬 외부 제어 설정.
 * 필드 의미는 `visumax-model-scene.tsx` 의 설명을 참고.
 */
export interface ModelSceneConfig {
  overlayScale: number;
  scale: number;
  positionX: number;
  positionY: number;
  positionZ: number;
  rotationX: number;
  rotationY: number;
  azimuthLimit: number;
  polarLimit: number;
  ambientIntensity: number;
  directionalIntensity: number;
  envIntensity: number;
  envPreset: EnvPresetKey;
}

export const DEFAULT_MODEL_SCENE_CONFIG: ModelSceneConfig = {
  overlayScale: 1,
  scale: 1,
  positionX: 0,
  positionY: 0,
  positionZ: 0,
  rotationX: 0,
  rotationY: 0,
  azimuthLimit: Math.PI / 7, // ≈ ±25°
  polarLimit: Math.PI / 12, // ≈ ±15°
  ambientIntensity: 0.35,
  directionalIntensity: 0.7,
  envIntensity: 0.45,
  envPreset: "studio",
};

const DEG = Math.PI / 180;

/** VISUMAX 800 전용 초기값 — 디자인 리뷰에서 확정된 위치/자세. */
export const VISUMAX_800_DEFAULT_CONFIG: ModelSceneConfig = {
  ...DEFAULT_MODEL_SCENE_CONFIG,
  overlayScale: 1.2,
  scale: 1,
  positionX: -0.2,
  positionY: 0,
  positionZ: 0,
  rotationX: 4.5 * DEG,
  rotationY: -14.4 * DEG,
};
