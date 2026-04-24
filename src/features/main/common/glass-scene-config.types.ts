/* 공유: GlassOrbsScene / 옵션 패널 / 렌즈 스케일 resolve */

export const ORB_MERGE_MODES = ["separate", "union", "subtract", "intersect", "exclude"] as const;
export type OrbMergeMode = (typeof ORB_MERGE_MODES)[number];

export const RIM_PRESETS = ["flat", "soft", "studio", "dome", "bands"] as const;
export type RimPreset = (typeof RIM_PRESETS)[number];

export const ENVIRONMENT_PRESETS = [
  "citrus_orchard",
  "studio",
  "city",
  "dawn",
  "passendorf_snow",
  "forest",
  "apartment",
  "night",
  "park",
  "sunset",
  "warehouse",
  "lobby",
] as const;
export type EnvironmentPreset = (typeof ENVIRONMENT_PRESETS)[number];

export const TRANSMISSION_FITS = ["cover", "contain"] as const;
export type TransmissionFit = (typeof TRANSMISSION_FITS)[number];

/**
 * 렌즈·환경·조명·인터랙션 (글래스 씬 단일 소스 of truth)
 */
export interface SceneConfig {
  /* 렌즈 지오메트리 */
  ballMode: boolean;
  /** 수동: XY/Z 를 직접 쓰려면 true (고급). false면 lensFlatness 로 산출 */
  lensScalesManual: boolean;
  /** 0~1, 납작도 (납작 렌즈일 때). lensScalesManual false 일 때 사용 */
  lensFlatness: number;
  /** 수동/동기용 캐시 (동기: flatness → orbScale) */
  orbScaleXY: number;
  /** 수동/동기용 캐시 */
  orbScaleZ: number;
  maxDiameterRem: number;

  orb1OffsetX: number;
  orb1OffsetY: number;
  orb1OffsetZ: number;

  orb2Enabled: boolean;
  orb2OffsetX: number;
  orb2OffsetY: number;
  orb2OffsetZ: number;
  orb2Scale: number;

  orbMerge: OrbMergeMode;

  thickness: number;
  ior: number;
  chromaticAberration: number;
  anisotropy: number;
  distortion: number;
  distortionScale: number;
  backside: boolean;
  backsideThickness: number;
  attenuationDistance: number;
  samples: number;
  resolution: number;

  envEnabled: boolean;
  envPreset: EnvironmentPreset;
  envIntensity: number;
  envBackground: boolean;
  envBackgroundBlurriness: number;
  envBackgroundIntensity: number;
  envShowLightformers: boolean;

  rimEnabled: boolean;
  rimPreset: RimPreset;
  rimColor: string;
  rimIntensity: number;

  ambientIntensity: number;
  dirIntensity: number;
  dirPosX: number;
  dirPosY: number;
  dirPosZ: number;

  journeyEnabled: boolean;
  journeyMaxYDeg: number;
  mouseTiltMaxDeg: number;
  mouseTiltLerp: number;
  mouseTiltScrollFadeVh: number;

  /** img_hero / img_frame — MeshTransmission buffer와 DOM 겹침(스케일·정합) */
  transmissionFit: TransmissionFit;
  /** cover 기준 drawScale 에 곱해 DOM과 글자 크기 맞춤 */
  transmissionZoom: number;
  /** 소스 이미지 내부 X/Y 포커스(0~1), 히어로 h1·타이틀과 정합 */
  transmissionSrcFocusX: number;
  transmissionSrcFocusY: number;
  /** img_frame 등 하단 소스용 Y 포커스 */
  transmissionSrcFocusYFrame: number;
  /** 타겟 bbox 중심 기준 px 보정 */
  transmissionOffsetXPx: number;
  transmissionOffsetYPx: number;
}

export const DEFAULT_CONFIG: SceneConfig = {
  ballMode: false,
  lensScalesManual: true,
  lensFlatness: 0.5,
  orbScaleXY: 1.52,
  orbScaleZ: 0.3,
  maxDiameterRem: 31.1,

  orb1OffsetX: 0,
  orb1OffsetY: 0,
  orb1OffsetZ: 0,

  orb2Enabled: true,
  orb2OffsetX: 2.15,
  orb2OffsetY: 0,
  orb2OffsetZ: -0.75,
  orb2Scale: 1.04,

  orbMerge: "separate",

  thickness: 0.65,
  ior: 1,
  chromaticAberration: 0,
  anisotropy: 0,
  distortion: 0,
  distortionScale: 0,
  backside: false,
  backsideThickness: 0,
  attenuationDistance: 0.1,
  samples: 1,
  resolution: 256,

  envEnabled: true,
  envPreset: "night",
  envIntensity: 4,
  envBackground: false,
  envBackgroundBlurriness: 0,
  envBackgroundIntensity: 0,
  envShowLightformers: true,

  rimEnabled: false,
  rimPreset: "flat",
  rimColor: "#F8E8FF",
  rimIntensity: 1.3,

  ambientIntensity: 0.6,
  dirIntensity: 1.8,
  dirPosX: 2,
  dirPosY: 3,
  dirPosZ: 4,

  journeyEnabled: true,
  journeyMaxYDeg: 60,
  mouseTiltMaxDeg: 6.9,
  mouseTiltLerp: 8,
  mouseTiltScrollFadeVh: 1,

  transmissionFit: "cover",
  transmissionZoom: 1.32,
  transmissionSrcFocusX: 0.505,
  transmissionSrcFocusY: 0.25,
  transmissionSrcFocusYFrame: 0.505,
  transmissionOffsetXPx: 38,
  transmissionOffsetYPx: 0,
};

/* ---------- 옵션 패널 필드 스키마 ---------- */

type KeysOfType<T, V> = { [K in keyof T]: T[K] extends V ? K : never }[keyof T];
export type GlassConfigNumKey = KeysOfType<SceneConfig, number>;
export type GlassConfigBoolKey = KeysOfType<SceneConfig, boolean>;
export type GlassConfigStrKey = KeysOfType<SceneConfig, string>;

export type GlassConfigFieldSpec =
  | {
      type: "slider";
      key: GlassConfigNumKey;
      label: string;
      min: number;
      max: number;
      step: number;
      integer?: boolean;
    }
  | {
      type: "toggle";
      key: GlassConfigBoolKey;
      label: string;
    }
  | {
      type: "select";
      key: GlassConfigStrKey;
      label: string;
      options: readonly string[];
    }
  | {
      type: "color";
      key: GlassConfigStrKey;
      label: string;
    };

export interface GlassConfigFieldSection {
  title: string;
  id?: string;
  fields: readonly GlassConfigFieldSpec[];
}
