import {
  ORB_MERGE_MODES,
  RIM_PRESETS,
  ENVIRONMENT_PRESETS,
  TRANSMISSION_FITS,
  type GlassConfigFieldSection,
} from "./glass-scene-config.types";

/**
 * "렌즈 형태(구/납작)"·납짝도 슬라이더는 `GlassSceneConfigPanel` 상단에 별도.
 * ballMode / orbScale* 는 여기에 없음.
 */
export const GLASS_CONFIG_SECTIONS: readonly GlassConfigFieldSection[] = [
  {
    title: "전송 img — 배경 정합(글자 크기·위치)",
    id: "transmission",
    fields: [
      {
        type: "select",
        key: "transmissionFit",
        label: "맞춤 (cover=뷰포트 꽉참, contain=이미지 전체)",
        options: TRANSMISSION_FITS,
      },
      { type: "slider", key: "transmissionZoom", label: "배율(확대·축소)", min: 0.5, max: 2.2, step: 0.01 },
      { type: "slider", key: "transmissionSrcFocusX", label: "소스 X(0~1)", min: 0, max: 1, step: 0.005 },
      { type: "slider", key: "transmissionSrcFocusY", label: "소스 Y·히어로", min: 0, max: 1, step: 0.005 },
      {
        type: "slider",
        key: "transmissionSrcFocusYFrame",
        label: "소스 Y·img_frame(하단)",
        min: 0,
        max: 1,
        step: 0.005,
      },
      {
        type: "slider",
        key: "transmissionOffsetXPx",
        label: "X 픽셀 보정",
        min: -200,
        max: 200,
        step: 1,
        integer: true,
      },
      {
        type: "slider",
        key: "transmissionOffsetYPx",
        label: "Y 픽셀 보정",
        min: -200,
        max: 200,
        step: 1,
        integer: true,
      },
    ],
  },
  {
    title: "인터랙션 · 스크롤/마우스",
    id: "interaction",
    fields: [
      { type: "toggle", key: "journeyEnabled", label: "스크롤 Y 회전(히어로~슬라이드 끝)" },
      {
        type: "slider",
        key: "journeyMaxYDeg",
        label: "J(°) ⅓왼J · ⅓0 · ⅓360×(J/60)",
        min: 0,
        max: 60,
        step: 0.1,
      },
      { type: "slider", key: "mouseTiltMaxDeg", label: "마우스 틸트 최대(°)", min: 0, max: 15, step: 0.1 },
      { type: "slider", key: "mouseTiltLerp", label: "틸트 추종 속도(lerp)", min: 2, max: 20, step: 0.5 },
      {
        type: "slider",
        key: "mouseTiltScrollFadeVh",
        label: "스크롤 틸트 감쇠(×vh, 홀드 이후)",
        min: 0.1,
        max: 3,
        step: 0.05,
      },
    ],
  },
  {
    title: "렌즈·재질(고급)",
    id: "lens",
    fields: [
      { type: "slider", key: "maxDiameterRem", label: "Max 지름(rem)", min: 5, max: 60, step: 0.1 },
      { type: "slider", key: "thickness", label: "Thickness", min: 0, max: 3, step: 0.01 },
      { type: "slider", key: "ior", label: "IOR", min: 1, max: 2.5, step: 0.01 },
      { type: "slider", key: "chromaticAberration", label: "Chromatic Ab.", min: 0, max: 1, step: 0.01 },
      { type: "slider", key: "anisotropy", label: "Anisotropy", min: 0, max: 1, step: 0.01 },
      { type: "slider", key: "distortion", label: "Distortion", min: 0, max: 2, step: 0.01 },
      { type: "slider", key: "distortionScale", label: "Distortion Scale", min: 0, max: 1, step: 0.01 },
      { type: "toggle", key: "backside", label: "Backside (FBO 2x)" },
      { type: "slider", key: "backsideThickness", label: "Backside Thick.", min: 0, max: 2, step: 0.01 },
      { type: "slider", key: "attenuationDistance", label: "Attenuation Dist.", min: 0.1, max: 30, step: 0.1 },
      { type: "slider", key: "samples", label: "Samples", min: 1, max: 32, step: 1, integer: true },
      { type: "slider", key: "resolution", label: "Resolution", min: 256, max: 2048, step: 256, integer: true },
    ],
  },
  {
    title: "첫 번째 렌즈(Orb 1) · 위치 추가 오프셋",
    id: "orb1",
    fields: [
      { type: "slider", key: "orb1OffsetX", label: "X 오프셋", min: -4, max: 4, step: 0.05 },
      { type: "slider", key: "orb1OffsetY", label: "Y 오프셋", min: -4, max: 4, step: 0.05 },
      { type: "slider", key: "orb1OffsetZ", label: "Z 오프셋 (음수 = 뒤로)", min: -4, max: 4, step: 0.05 },
    ],
  },
  {
    title: "두 번째 렌즈(Orb 2)",
    id: "orb2",
    fields: [
      { type: "toggle", key: "orb2Enabled", label: "Orb 2 ON" },
      { type: "slider", key: "orb2OffsetX", label: "X 오프셋", min: -4, max: 4, step: 0.05 },
      { type: "slider", key: "orb2OffsetY", label: "Y 오프셋", min: -4, max: 4, step: 0.05 },
      { type: "slider", key: "orb2OffsetZ", label: "Z 오프셋 (음수 = 뒤로)", min: -4, max: 4, step: 0.05 },
      { type: "slider", key: "orb2Scale", label: "스케일 배율", min: 0.3, max: 1.6, step: 0.01 },
    ],
  },
  {
    title: "Boolean Merge (렌즈 합치기)",
    id: "csg",
    fields: [
      { type: "select", key: "orbMerge", label: "Merge Mode", options: ORB_MERGE_MODES },
    ],
  },
  {
    title: "Rim Glow (가장자리 글로우 — 경량)",
    id: "rim",
    fields: [
      { type: "toggle", key: "rimEnabled", label: "Rim ON" },
      { type: "select", key: "rimPreset", label: "Rim 레이아웃", options: RIM_PRESETS },
      { type: "color", key: "rimColor", label: "Rim 색상" },
      { type: "slider", key: "rimIntensity", label: "Rim 강도", min: 0, max: 10, step: 0.1 },
    ],
  },
  {
    title: "HDR 환경 (무거운 배경 · 반짝임 강화)",
    id: "hdr",
    fields: [
      { type: "toggle", key: "envEnabled", label: "HDR ENV ON (GPU 부하 큼)" },
      { type: "select", key: "envPreset", label: "HDR Preset", options: ENVIRONMENT_PRESETS },
      { type: "slider", key: "envIntensity", label: "ENV 강도", min: 0, max: 5, step: 0.05 },
      { type: "toggle", key: "envBackground", label: "배경으로 렌더" },
      { type: "slider", key: "envBackgroundBlurriness", label: "배경 흐림", min: 0, max: 1, step: 0.01 },
      { type: "slider", key: "envBackgroundIntensity", label: "배경 밝기", min: 0, max: 3, step: 0.05 },
      { type: "toggle", key: "envShowLightformers", label: "Lightformers ON" },
    ],
  },
  {
    title: "조명(Lights)",
    id: "lights",
    fields: [
      { type: "slider", key: "ambientIntensity", label: "Ambient", min: 0, max: 5, step: 0.05 },
      { type: "slider", key: "dirIntensity", label: "Dir 강도", min: 0, max: 10, step: 0.1 },
      { type: "slider", key: "dirPosX", label: "Dir X", min: -10, max: 10, step: 0.5 },
      { type: "slider", key: "dirPosY", label: "Dir Y", min: -10, max: 10, step: 0.5 },
      { type: "slider", key: "dirPosZ", label: "Dir Z", min: -10, max: 10, step: 0.5 },
    ],
  },
];

/** img_hero (MeshTransmission) DOM과의 위치·스케일 정합 — 패널에 이 섹션만 쓸 때 */
export const GLASS_HERO_IMAGE_ALIGNMENT_SECTION: GlassConfigFieldSection =
  GLASS_CONFIG_SECTIONS.find((s) => s.id === "transmission")!;

export const GLASS_LENS_FORM_ADVANCED: GlassConfigFieldSection = {
  title: "렌즈 스케일 · 수동 (고급)",
  id: "lensScales",
  fields: [
    { type: "toggle", key: "lensScalesManual", label: "XY·Z 수동(납짝도 슬라이더와 분리)" },
    { type: "slider", key: "orbScaleXY", label: "XY 스케일(수동일 때)", min: 0.3, max: 2, step: 0.01 },
    { type: "slider", key: "orbScaleZ", label: "Z 스케일(수동일 때)", min: 0.2, max: 2, step: 0.01 },
  ],
};
