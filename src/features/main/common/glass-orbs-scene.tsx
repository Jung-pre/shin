"use client";

import {
  Suspense,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type MutableRefObject,
  type ReactNode,
  type RefObject,
} from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { Environment, Lightformer, MeshTransmissionMaterial } from "@react-three/drei";
import { SphereGeometry, type Group as ThreeGroup, type Texture } from "three";
import {
  ADDITION,
  Brush,
  DIFFERENCE,
  Evaluator,
  INTERSECTION,
  SUBTRACTION,
  type CSGOperation,
} from "three-bvh-csg";
import { useImageTransmissionTexture } from "@/features/main/common/use-dom-transmission-texture";
import styles from "./glass-orbs-scene.module.css";

/**
 * gl 은 factory 가 아닌 **options 객체** 로 전달해 R3F 가 renderer 생성 / dispose /
 * context-loss 복구 라이프사이클을 전부 관리하게 한다.
 */
const GL_OPTIONS = {
  alpha: true,
  antialias: true,
  depth: true,
  stencil: false,
  powerPreference: "high-performance" as const,
  failIfMajorPerformanceCaveat: false,
  preserveDrawingBuffer: false,
};

const CANVAS_CAMERA = { position: [0, 0, 6.4] as [number, number, number], fov: 32 };
const CANVAS_DPR: [number, number] = [1, 1.5];

type Vector3Tuple = [number, number, number];

/* ---------- 파라미터 정의 ---------- */

const ORB_RADIUS = 1.72;
const ORB_POSITION: Vector3Tuple = [0, 0, 0];

const ENVIRONMENT_PRESETS = [
  "studio",
  "city",
  "dawn",
  "forest",
  "apartment",
  "night",
  "park",
  "sunset",
  "warehouse",
  "lobby",
] as const;
type EnvironmentPreset = (typeof ENVIRONMENT_PRESETS)[number];

/**
 * Rim env 프리셋
 * - flat    : 순수 단색 배경만 (Lightformer 0 개) → 가장자리에 색만 깔림, 아무 모양도 안 보임
 * - soft    : 큰 사각 라이트포머 2~3장으로 넓게 퍼지는 소프트 하이라이트
 * - studio  : 위/좌우에서 들어오는 패널 조명 (사진 스튜디오 느낌)
 * - dome    : 상단 돔에서 감싸 내려오는 분위기, 바닥은 어둡게
 * - bands   : 수평 띠 하이라이트 (실린더 느낌)
 */
const RIM_PRESETS = ["flat", "soft", "studio", "dome", "bands"] as const;
type RimPreset = (typeof RIM_PRESETS)[number];

/**
 * 두 렌즈 불리언 연산 (Figma boolean 과 동일)
 * - separate  : 구 2개를 각각 그리는 기본 모드 (겹쳐도 각자 렌즈)
 * - union     : 합집합 — 두 구가 하나로 합쳐지되 경계는 날카롭게 남음 (Figma Union)
 * - subtract  : orb1 - orb2 — 첫 번째 구에서 두 번째 구 모양이 파여 나감 (Figma Subtract)
 * - intersect : 교집합 — 두 구가 겹치는 영역만 남음 (Figma Intersect)
 * - exclude   : 대칭 차집합(XOR) — 겹치는 영역이 뻥 뚫리고 양쪽 초승달만 남음 (Figma Exclude)
 *
 * CSG 연산은 `three-bvh-csg` 로 수행. 메쉬 하나로 합쳐지므로 MTM 굴절도 그 결과면에서 일어남.
 */
const ORB_MERGE_MODES = ["separate", "union", "subtract", "intersect", "exclude"] as const;
type OrbMergeMode = (typeof ORB_MERGE_MODES)[number];

/**
 * 렌즈·환경·조명을 한 객체로 관리.
 * 옵션 팝업 UI 는 이 객체의 각 필드를 섹션별로 그려 준다.
 */
export interface SceneConfig {
  /* 렌즈 지오메트리 */
  /** 평면 렌즈(얇은 볼록 유리) ↔ 크리스탈 볼 프리셋 토글. ON 이면 XY/Z 1.0 구 형태 */
  ballMode: boolean;
  /** 가로·세로 스케일 — ballMode OFF 일 때만 UI 노출 */
  orbScaleXY: number;
  /** Z 축 두께 — 0.33 ≈ 얇은 렌즈, 1.0 = 완전한 구, 1.5 = 앞뒤로 길어진 렌즈 */
  orbScaleZ: number;
  maxDiameterRem: number;

  /* 첫 번째 렌즈 — 추가 오프셋(월드 단위).
   * 기본은 pair-centering 결과 위치(orb2 와 대칭) 에 머무르고,
   * 여기 값이 0 이 아니면 그 위에 덧씌워 orb1 만 따로 이동시킨다. */
  orb1OffsetX: number;
  orb1OffsetY: number;
  orb1OffsetZ: number;

  /* 두 번째 렌즈 — 메인 렌즈 옆에 함께 배치되는 서브 오브
   * 위치는 orb1 기준 상대 오프셋(월드 단위).
   * ON 이면 두 렌즈의 중심이 뷰포트 센터에 대칭되도록 자동 정렬. */
  orb2Enabled: boolean;
  /** orb1 대비 X 오프셋 (양수 = 오른쪽). 월드 단위. */
  orb2OffsetX: number;
  /** orb1 대비 Y 오프셋 (양수 = 위쪽). 월드 단위. */
  orb2OffsetY: number;
  /** orb1 대비 Z 오프셋 (음수 = 뒤로, 양수 = 카메라 쪽). 월드 단위. */
  orb2OffsetZ: number;
  /** orb1 스케일 대비 배율. 0.9 = 10% 작게 */
  orb2Scale: number;

  /** 두 렌즈 불리언 모드 — orb1 ↔ orb2 에만 적용 */
  orbMerge: OrbMergeMode;

  /* 렌즈 재질 (MeshTransmissionMaterial) */
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

  /* 배경 환경 — 기본 OFF. 켜면 drei HDR preset 이 CDN 에서 다운로드 + PMREM 구움 → GPU 부하 큼. */
  envEnabled: boolean;
  envPreset: EnvironmentPreset;
  envIntensity: number;
  envBackground: boolean;
  envBackgroundBlurriness: number;
  envBackgroundIntensity: number;
  envShowLightformers: boolean;

  /* Rim 글로우 — 유리 가장자리 프레넬 반사에 광원 색을 깔아 주는 초경량 env.
   * HDR 로드 없이 PMREM 만 1회 구움 (frames: 1, resolution: 64) → 거의 비용 없음.
   * HDR env 가 꺼져 있을 때만 활성. 검은 가장자리 제거용 핵심 옵션. */
  rimEnabled: boolean;
  /** Lightformer 레이아웃 프리셋 — 중앙에 모양 찍히는 것 방지용 */
  rimPreset: RimPreset;
  rimColor: string;
  rimIntensity: number;

  /* 조명 — 기본 값으로도 유리 렌즈 하이라이트가 자연스럽게 나오도록 세팅 */
  ambientIntensity: number;
  dirIntensity: number;
  dirPosX: number;
  dirPosY: number;
  dirPosZ: number;
}

const DEFAULT_CONFIG: SceneConfig = {
  ballMode: false,
  orbScaleXY: 0.5,
  orbScaleZ: 0.3,
  maxDiameterRem: 31.1,

  // 첫 번째 렌즈 추가 오프셋 — 기본은 pair-centering 결과 위치
  orb1OffsetX: 0,
  orb1OffsetY: 0,
  orb1OffsetZ: 0,

  // 두 번째 렌즈 — 오른쪽에 약간 크게 두고 Z 로 뒤로 밀어서 앞뒤 겹침을 만듦
  // (CSG 로 한 덩어리 합치지 않고, 구 2개가 각자 살아있는 상태)
  orb2Enabled: true,
  orb2OffsetX: 1.0,
  orb2OffsetY: 0,
  orb2OffsetZ: -0.75,
  orb2Scale: 1.09,

  // separate — 두 렌즈가 각자 살아있는 상태로 렌더링 (CSG 머지 없음).
  orbMerge: "separate",

  thickness: 0.82,
  ior: 1.15,
  chromaticAberration: 0,
  anisotropy: 0,
  distortion: 0,
  distortionScale: 0,
  backside: false,
  backsideThickness: 0.22,
  attenuationDistance: 0.1,
  // Context Lost 방지 — 내부 FBO 를 최소로.
  samples: 1,
  resolution: 256,

  // 기본 OFF — 필요 시 옵션 패널에서 ON.
  envEnabled: false,
  envPreset: "studio",
  envIntensity: 0,
  envBackground: false,
  envBackgroundBlurriness: 0,
  envBackgroundIntensity: 0,
  envShowLightformers: true,

  // 검은 엣지 제거용 — 경량 Rim Env (기본 ON, #F8E8FF)
  rimEnabled: true,
  rimPreset: "flat",
  rimColor: "#F8E8FF",
  rimIntensity: 1.3,

  // 유리 하이라이트가 뜨도록 기본값 세팅.
  ambientIntensity: 0.6,
  dirIntensity: 1.8,
  dirPosX: 2,
  dirPosY: 3,
  dirPosZ: 4,
};

/* ---------- 필드 타입 / 섹션 스키마 ---------- */

type KeysOfType<T, V> = { [K in keyof T]: T[K] extends V ? K : never }[keyof T];
type NumKey = KeysOfType<SceneConfig, number>;
type BoolKey = KeysOfType<SceneConfig, boolean>;
type StrKey = KeysOfType<SceneConfig, string>;

type FieldSpec =
  | {
      type: "slider";
      key: NumKey;
      label: string;
      min: number;
      max: number;
      step: number;
      integer?: boolean;
    }
  | {
      type: "toggle";
      key: BoolKey;
      label: string;
    }
  | {
      type: "select";
      key: StrKey;
      label: string;
      options: readonly string[];
    }
  | {
      type: "color";
      key: StrKey;
      label: string;
    };

interface FieldSection {
  title: string;
  fields: readonly FieldSpec[];
}

const SECTIONS: readonly FieldSection[] = [
  {
    title: "렌즈(Lens)",
    fields: [
      { type: "toggle", key: "ballMode", label: "Ball Mode (반대로 볼록)" },
      { type: "slider", key: "maxDiameterRem", label: "Max 지름(rem)", min: 5, max: 60, step: 0.1 },
      { type: "slider", key: "orbScaleXY", label: "XY 스케일", min: 0.3, max: 2, step: 0.01 },
      { type: "slider", key: "orbScaleZ", label: "Z 두께", min: 0.2, max: 2, step: 0.01 },
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
    fields: [
      { type: "slider", key: "orb1OffsetX", label: "X 오프셋", min: -4, max: 4, step: 0.05 },
      { type: "slider", key: "orb1OffsetY", label: "Y 오프셋", min: -4, max: 4, step: 0.05 },
      { type: "slider", key: "orb1OffsetZ", label: "Z 오프셋 (음수 = 뒤로)", min: -4, max: 4, step: 0.05 },
    ],
  },
  {
    title: "두 번째 렌즈(Orb 2)",
    fields: [
      { type: "toggle", key: "orb2Enabled", label: "Orb 2 ON" },
      { type: "slider", key: "orb2OffsetX", label: "X 오프셋", min: -4, max: 4, step: 0.05 },
      { type: "slider", key: "orb2OffsetY", label: "Y 오프셋", min: -4, max: 4, step: 0.05 },
      { type: "slider", key: "orb2OffsetZ", label: "Z 오프셋 (음수 = 뒤로)", min: -4, max: 4, step: 0.05 },
      { type: "slider", key: "orb2Scale", label: "스케일 배율", min: 0.3, max: 1.6, step: 0.01 },
    ],
  },
  // 이하 섹션들(Boolean, Rim, Env, Lights)은 기본값으로 확정했으므로 UI 노출 생략.
  // 값을 다시 만져야 할 땐 DEFAULT_CONFIG 에서 직접 조정.
];

/* ---------- 3D 컴포넌트 ---------- */

interface OrbProps {
  buffer: Texture;
  config: SceneConfig;
  /** 월드 좌표 위치 — 기본 ORB_POSITION */
  position?: Vector3Tuple;
  /** orb1 기준 스케일 배율 — 두 번째 렌즈를 더 작게/크게 만들 때 사용 */
  scaleMultiplier?: number;
}

const GlassOrb = ({
  buffer,
  config,
  position = ORB_POSITION,
  scaleMultiplier = 1,
}: OrbProps) => {
  /**
   * ballMode ON → 완전한 구(1,1,1) → 크리스탈 볼처럼 텍스트가 확대·반전되어 보임.
   * ballMode OFF → 슬라이더 XY/Z 로 얇은 볼록 렌즈 형태로 직접 조정.
   */
  const baseScale: Vector3Tuple = config.ballMode
    ? [1, 1, 1]
    : [config.orbScaleXY, config.orbScaleXY, config.orbScaleZ];
  const scale: Vector3Tuple = [
    baseScale[0] * scaleMultiplier,
    baseScale[1] * scaleMultiplier,
    baseScale[2] * scaleMultiplier,
  ];
  return (
    <mesh position={position} scale={scale}>
      <sphereGeometry args={[ORB_RADIUS, 96, 96]} />
      <MeshTransmissionMaterial
        backside={config.backside}
        backsideThickness={config.backsideThickness}
        samples={config.samples}
        resolution={config.resolution}
        transmission={1}
        clearcoat={1}
        clearcoatRoughness={0}
        thickness={config.thickness}
        chromaticAberration={config.chromaticAberration}
        anisotropy={config.anisotropy}
        roughness={0}
        distortion={config.distortion}
        distortionScale={config.distortionScale}
        temporalDistortion={0}
        ior={config.ior}
        attenuationDistance={config.attenuationDistance}
        buffer={buffer}
        transparent
      />
    </mesh>
  );
};

/**
 * Hard CSG boolean 렌즈 — Figma 의 Union / Subtract / Intersect 와 동일.
 *
 * 두 구의 지오메트리를 `three-bvh-csg` 로 불리언 연산해서 단일 메쉬를 생성.
 * 결과 메쉬 한 장에 MTM 을 얹으므로 굴절이 한 면에서 일어나며, 교차 경계에는
 * 날카로운 Figma 스타일 엣지가 남는다 (물방울 블렌딩 아님).
 *
 * 구현 노트
 * - `Evaluator` 를 매번 새로 만들지 않고 메모이즈해서 재사용.
 * - 결과 지오메트리는 useMemo 산출물이 바뀔 때 이전 걸 dispose 로 해제.
 * - orb2 가 꺼져 있으면 단독 구를 그대로 반환 (연산 스킵).
 */
const CSG_SPHERE_SEGMENTS = 64;

const cloneSphereGeom = () =>
  new SphereGeometry(ORB_RADIUS, CSG_SPHERE_SEGMENTS, CSG_SPHERE_SEGMENTS);

const csgOperationOf = (mode: OrbMergeMode): CSGOperation | null => {
  switch (mode) {
    case "union":
      return ADDITION;
    case "subtract":
      return SUBTRACTION;
    case "intersect":
      return INTERSECTION;
    case "exclude":
      return DIFFERENCE;
    default:
      return null;
  }
};

interface CsgLensProps {
  buffer: Texture;
  config: SceneConfig;
}

const CsgLens = ({ buffer, config }: CsgLensProps) => {
  const evaluator = useMemo(() => {
    const ev = new Evaluator();
    ev.useGroups = false; // 단일 material 로 평탄화
    ev.consolidateMaterials = false;
    return ev;
  }, []);

  const geometry = useMemo(() => {
    const effXY = config.ballMode ? 1 : config.orbScaleXY;
    const effZ = config.ballMode ? 1 : config.orbScaleZ;

    const geomA = cloneSphereGeom();
    const brushA = new Brush(geomA);
    const hx = config.orb2OffsetX / 2;
    const hy = config.orb2OffsetY / 2;
    const hz = config.orb2OffsetZ / 2;
    // orb1 pair-centering(-h) 결과 위치에 사용자 추가 오프셋을 덧씌움
    brushA.position.set(
      -hx + config.orb1OffsetX,
      -hy + config.orb1OffsetY,
      -hz + config.orb1OffsetZ,
    );
    brushA.scale.set(effXY, effXY, effZ);
    brushA.updateMatrixWorld(true);

    const csgOp = csgOperationOf(config.orbMerge);
    if (!config.orb2Enabled || csgOp === null) {
      // 단일 렌즈 — brushA 의 지오메트리를 월드 변환 적용한 상태로 복제
      const baked = geomA.clone();
      baked.applyMatrix4(brushA.matrixWorld);
      geomA.dispose();
      return baked;
    }

    const geomB = cloneSphereGeom();
    const brushB = new Brush(geomB);
    brushB.position.set(hx, hy, hz);
    const s2 = config.orb2Scale;
    brushB.scale.set(effXY * s2, effXY * s2, effZ * s2);
    brushB.updateMatrixWorld(true);

    const result = evaluator.evaluate(brushA, brushB, csgOp);
    // evaluate 가 만들어 준 result.geometry 는 새로운 BufferGeometry
    const out = result.geometry.clone();
    geomA.dispose();
    geomB.dispose();
    result.geometry.dispose();
    return out;
  }, [
    evaluator,
    config.orbMerge,
    config.orb1OffsetX,
    config.orb1OffsetY,
    config.orb1OffsetZ,
    config.orb2Enabled,
    config.orb2OffsetX,
    config.orb2OffsetY,
    config.orb2OffsetZ,
    config.orb2Scale,
    config.orbScaleXY,
    config.orbScaleZ,
    config.ballMode,
  ]);

  useEffect(() => {
    return () => {
      geometry.dispose();
    };
  }, [geometry]);

  return (
    <mesh geometry={geometry}>
      <MeshTransmissionMaterial
        backside={config.backside}
        backsideThickness={config.backsideThickness}
        samples={config.samples}
        resolution={config.resolution}
        transmission={1}
        clearcoat={1}
        clearcoatRoughness={0}
        thickness={config.thickness}
        chromaticAberration={config.chromaticAberration}
        anisotropy={config.anisotropy}
        roughness={0}
        distortion={config.distortion}
        distortionScale={config.distortionScale}
        temporalDistortion={0}
        ior={config.ior}
        attenuationDistance={config.attenuationDistance}
        buffer={buffer}
        transparent
      />
    </mesh>
  );
};

interface RimEnvironmentProps {
  config: SceneConfig;
}

/**
 * HDR 없이 단색 배경 + (선택적) Lightformer 로 메모리 내부에 env 를 1회 구워
 * `scene.environment` 에 꽂아 주는 초경량 환경.
 *
 * 목적: env 없이 Fresnel 반사가 "아무것도 없음(0)" → 가장자리가 까맣게 찍히는 문제 해결.
 * 각 프리셋은 장면에 "보이는 모양" 없이 색/밝기만 다르게 깔리도록 설계됨.
 *
 * 비용: `resolution: 64`, `frames: 1` → 최초 1회 PMREM 만 굽고 그 뒤로는 정적.
 */
const RimLightformers = ({ preset }: { preset: RimPreset }) => {
  switch (preset) {
    /** 순수 단색. 유리 전체가 rimColor 로 은은하게 깔림. 중앙에 아무 모양도 없음. */
    case "flat":
      return null;

    /** 소프트 파스텔 — 큰 사각 라이트포머 3장으로 부드러운 그라데이션. 모양 거의 안 보임. */
    case "soft":
      return (
        <>
          <Lightformer intensity={1.2} color="#ffffff" position={[0, 8, 4]} scale={[30, 6, 1]} />
          <Lightformer intensity={0.8} color="#ffffff" position={[-10, -4, 3]} scale={[20, 20, 1]} />
          <Lightformer intensity={0.8} color="#ffffff" position={[10, -4, 3]} scale={[20, 20, 1]} />
        </>
      );

    /** 사진 스튜디오 — 상단 키라이트 + 좌우 림라이트. 가장자리에 뚜렷한 하이라이트. */
    case "studio":
      return (
        <>
          <Lightformer intensity={2.2} color="#ffffff" position={[0, 6, 3]} scale={[12, 2.5, 1]} />
          <Lightformer intensity={1.6} color="#ffffff" position={[-8, 0, 2]} scale={[2, 14, 1]} rotation={[0, Math.PI / 2, 0]} />
          <Lightformer intensity={1.6} color="#ffffff" position={[8, 0, 2]} scale={[2, 14, 1]} rotation={[0, -Math.PI / 2, 0]} />
        </>
      );

    /** 돔 라이트 — 상반구는 밝게, 하반구는 어둡게 깔려 자연스러운 분위기. */
    case "dome":
      return (
        <>
          <Lightformer intensity={2} color="#ffffff" position={[0, 10, 0]} scale={[30, 30, 1]} rotation={[-Math.PI / 2, 0, 0]} />
          <Lightformer intensity={0.4} color="#ffffff" position={[0, -8, 4]} scale={[20, 6, 1]} />
        </>
      );

    /** 수평 띠 — 원통형 소프트박스 느낌. 가로 방향 하이라이트. */
    case "bands":
      return (
        <>
          <Lightformer intensity={1.8} color="#ffffff" position={[0, 3, 5]} scale={[30, 1.5, 1]} />
          <Lightformer intensity={1.8} color="#ffffff" position={[0, -3, 5]} scale={[30, 1.5, 1]} />
        </>
      );

    default:
      return null;
  }
};

const RimEnvironment = ({ config }: RimEnvironmentProps) => {
  return (
    <Environment
      key={config.rimPreset}
      resolution={64}
      frames={1}
      environmentIntensity={config.rimIntensity}
    >
      <color attach="background" args={[config.rimColor]} />
      <RimLightformers preset={config.rimPreset} />
    </Environment>
  );
};

interface SceneEnvironmentProps {
  config: SceneConfig;
}

/**
 * 배경(HDRI preset) + 커스텀 Lightformers.
 * `envBackground` 가 true 면 HDR 이 장면 배경으로 렌더된다.
 */
const SceneEnvironment = ({ config }: SceneEnvironmentProps) => {
  return (
    <Environment
      key={config.envPreset}
      preset={config.envPreset}
      resolution={256}
      environmentIntensity={config.envIntensity}
      background={config.envBackground}
      backgroundBlurriness={config.envBackgroundBlurriness}
      backgroundIntensity={config.envBackgroundIntensity}
    >
      {config.envShowLightformers ? (
        <group rotation={[-Math.PI / 3, 0, 0]}>
          <Lightformer
            intensity={4}
            rotation-x={Math.PI / 2}
            position={[0, 5, -9]}
            scale={[10, 10, 1]}
          />
          {[2, 0, 2, 0, 2, 0, 2, 0].map((x, index) => (
            <Lightformer
              key={index}
              form="circle"
              intensity={4}
              rotation={[Math.PI / 2, 0, 0]}
              position={[x, 4, index * 4]}
              scale={[4, 1, 1]}
            />
          ))}
          <Lightformer
            intensity={2}
            rotation-y={Math.PI / 2}
            position={[-5, 1, -1]}
            scale={[50, 2, 1]}
          />
          <Lightformer
            intensity={2}
            rotation-y={-Math.PI / 2}
            position={[10, 1, 0]}
            scale={[50, 2, 1]}
          />
        </group>
      ) : null}
    </Environment>
  );
};

interface SceneLightsProps {
  config: SceneConfig;
}

const SceneLights = ({ config }: SceneLightsProps) => {
  return (
    <>
      <ambientLight intensity={config.ambientIntensity} />
      <directionalLight
        intensity={config.dirIntensity}
        position={[config.dirPosX, config.dirPosY, config.dirPosZ]}
      />
    </>
  );
};

/** 루트 폰트 사이즈(px) 를 반응형으로 추적 */
const useRootFontSize = (): number => {
  const [fontSize, setFontSize] = useState<number>(() => {
    if (typeof window === "undefined") return 16;
    return parseFloat(getComputedStyle(document.documentElement).fontSize) || 16;
  });

  useEffect(() => {
    if (typeof window === "undefined") return;
    const update = () => {
      setFontSize(parseFloat(getComputedStyle(document.documentElement).fontSize) || 16);
    };
    window.addEventListener("resize", update);
    return () => window.removeEventListener("resize", update);
  }, []);

  return fontSize;
};

/**
 * 마우스 위치에 따라 내부 자식을 미세하게 기울이는 그룹.
 *
 * - 뷰포트 중앙 대비 커서의 상대 좌표(-1 ~ 1) × `maxTiltRad` 만큼 X/Y 축 회전.
 * - 스크롤이 히어로 아래로 내려갈수록 효과가 자연스럽게 페이드 아웃.
 *   (`scrollFadeVh` 배수만큼 스크롤하면 tilt 가 0)
 * - `useFrame` 에서 현재 회전값을 target 으로 지수감쇠 lerp → 스프링 같은 잔류감.
 * - demand frameloop 에 맞춰 안정화 전까지만 `invalidate()` 호출 → 쉬면 GPU 0.
 *
 * pointer-events: none 캔버스라 마우스는 window 레벨에서 직접 수신.
 */
interface MouseTiltGroupProps {
  children: ReactNode;
  /** 최대 기울기 (라디안). 0.12rad ≈ 6.8° */
  maxTiltRad?: number;
  /** lerp 속도 계수 — 클수록 빠르게 따라붙음 */
  lerpSpeed?: number;
  /** 이 배수만큼 뷰포트를 스크롤하면 tilt 0 으로 페이드 */
  scrollFadeVh?: number;
}

const MouseTiltGroup = ({
  children,
  maxTiltRad = 0.12,
  lerpSpeed = 8,
  scrollFadeVh = 1,
}: MouseTiltGroupProps) => {
  const groupRef = useRef<ThreeGroup>(null);
  const target = useRef({ x: 0, y: 0 });
  const lastMouse = useRef({ x: -1, y: -1, seen: false });
  const invalidate = useThree((state) => state.invalidate);

  useEffect(() => {
    if (typeof window === "undefined") return;

    const recomputeTarget = () => {
      if (!lastMouse.current.seen) return;
      const w = window.innerWidth || 1;
      const h = window.innerHeight || 1;
      const nx = (lastMouse.current.x / w) * 2 - 1;
      const ny = (lastMouse.current.y / h) * 2 - 1;
      const scrollY = window.scrollY || 0;
      const fade = Math.max(0, 1 - scrollY / (h * scrollFadeVh));
      // y-mouse 는 반전 — 커서가 위로 가면 렌즈 윗면이 카메라를 향하도록
      target.current.x = -ny * maxTiltRad * fade;
      target.current.y = nx * maxTiltRad * fade;
      invalidate();
    };

    const handleMove = (event: MouseEvent) => {
      lastMouse.current.x = event.clientX;
      lastMouse.current.y = event.clientY;
      lastMouse.current.seen = true;
      recomputeTarget();
    };

    const handleScroll = () => {
      recomputeTarget();
    };

    window.addEventListener("mousemove", handleMove, { passive: true });
    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => {
      window.removeEventListener("mousemove", handleMove);
      window.removeEventListener("scroll", handleScroll);
    };
  }, [invalidate, maxTiltRad, scrollFadeVh]);

  useFrame((_, delta) => {
    const group = groupRef.current;
    if (!group) return;
    // 프레임 독립적 지수감쇠 (delta 가 커지면 lerp 비율도 커짐).
    const lerp = 1 - Math.exp(-delta * lerpSpeed);
    const dx = target.current.x - group.rotation.x;
    const dy = target.current.y - group.rotation.y;
    group.rotation.x += dx * lerp;
    group.rotation.y += dy * lerp;

    // 아직 타겟에 수렴하지 않았으면 다음 프레임도 그려야 함.
    if (Math.abs(dx) > 0.0002 || Math.abs(dy) > 0.0002) {
      invalidate();
    }
  });

  return <group ref={groupRef}>{children}</group>;
};

interface LensContentProps {
  buffer: Texture;
  bufferVersion: number;
  config: SceneConfig;
}

const LensContent = ({ buffer, bufferVersion, config }: LensContentProps) => {
  const { viewport, size, invalidate } = useThree();
  const rootFontSize = useRootFontSize();

  const lensScale = useMemo(() => {
    if (size.width <= 0 || viewport.width <= 0) return 1;
    const worldPerPx = viewport.width / size.width;
    const targetDiameterPx = config.maxDiameterRem * rootFontSize;
    const targetDiameterWorld = targetDiameterPx * worldPerPx;
    const baseDiameterWorld = 2 * ORB_RADIUS;
    // GlassOrb 내부 XY scale 을 감안해 최종 렌더 지름이 Max 지름을 넘지 않게 보정.
    const effectiveXY = config.ballMode ? 1 : config.orbScaleXY;
    return targetDiameterWorld / (baseDiameterWorld * effectiveXY);
  }, [
    viewport.width,
    size.width,
    rootFontSize,
    config.maxDiameterRem,
    config.ballMode,
    config.orbScaleXY,
  ]);

  /**
   * demand 모드에선 buffer 내부 캔버스 픽셀 변경을 R3F 가 감지하지 못한다.
   * 훅에서 올라오는 version 변화 때마다 강제 재렌더.
   */
  useEffect(() => {
    invalidate();
  }, [bufferVersion, invalidate]);

  /**
   * orb2 가 켜지면 두 렌즈가 그룹 중심 대칭이 되도록 내부 그룹을 (-offset/2) 만큼 이동.
   * 이러면 orb1 은 좌측, orb2 는 우측에 자리잡으면서 전체 쌍의 기하 중심이 (0,0,0) 유지.
   * Z 도 동일하게 대칭 — orb2 를 뒤로 빼면 orb1 은 자동으로 앞으로 나와 카메라 중앙에 한 쌍이 놓임.
   */
  const pairCenteringOffset: Vector3Tuple = config.orb2Enabled
    ? [-config.orb2OffsetX / 2, -config.orb2OffsetY / 2, -config.orb2OffsetZ / 2]
    : [0, 0, 0];

  /**
   * orb1 은 pairCenteringOffset 로 이미 대칭 배치된 (0,0,0) 기준으로,
   * 사용자 추가 오프셋(orb1Offset*)을 덧씌워 독립 이동.
   */
  const orb1Position: Vector3Tuple = [
    config.orb1OffsetX,
    config.orb1OffsetY,
    config.orb1OffsetZ,
  ];

  const orb2Position: Vector3Tuple = [
    config.orb2OffsetX,
    config.orb2OffsetY,
    config.orb2OffsetZ,
  ];

  if (config.orbMerge !== "separate") {
    // CSG 불리언 결과(orb1 ↔ orb2)는 이미 (±offset/2) 대칭으로 구성되므로 추가 centering 불필요.
    return (
      <MouseTiltGroup>
        <group scale={lensScale}>
          <CsgLens buffer={buffer} config={config} />
        </group>
      </MouseTiltGroup>
    );
  }

  return (
    <MouseTiltGroup>
      <group scale={lensScale}>
        <group position={pairCenteringOffset}>
          <GlassOrb buffer={buffer} config={config} position={orb1Position} />
          {config.orb2Enabled ? (
            <GlassOrb
              buffer={buffer}
              config={config}
              position={orb2Position}
              scaleMultiplier={config.orb2Scale}
            />
          ) : null}
        </group>
      </group>
    </MouseTiltGroup>
  );
};

/**
 * R3F invalidate 함수를 외부(React state 밖) 에서 호출할 수 있게 ref 로 노출.
 * 스크롤 이벤트 → 텍스처 redraw → 이 ref 로 즉시 invalidate() 해서
 * React 리렌더 체인을 우회하고 한 프레임도 놓치지 않게 한다.
 */
interface InvalidateBridgeProps {
  bridgeRef: MutableRefObject<(() => void) | null>;
}

const InvalidateBridge = ({ bridgeRef }: InvalidateBridgeProps) => {
  const invalidate = useThree((state) => state.invalidate);

  useEffect(() => {
    bridgeRef.current = invalidate;
    return () => {
      if (bridgeRef.current === invalidate) {
        bridgeRef.current = null;
      }
    };
  }, [bridgeRef, invalidate]);

  return null;
};

/**
 * WebGL Context Lost 가드 — lost 이벤트 기본 동작을 막아 브라우저가 즉시 복구하게 함.
 */
const ContextLossGuard = () => {
  const { gl, invalidate } = useThree();

  useEffect(() => {
    const canvasEl = gl.domElement;
    const handleLost = (event: Event) => {
      event.preventDefault();
    };
    const handleRestored = () => {
      invalidate();
    };
    canvasEl.addEventListener("webglcontextlost", handleLost, false);
    canvasEl.addEventListener("webglcontextrestored", handleRestored, false);
    return () => {
      canvasEl.removeEventListener("webglcontextlost", handleLost, false);
      canvasEl.removeEventListener("webglcontextrestored", handleRestored, false);
    };
  }, [gl, invalidate]);

  return null;
};

interface GlassOrbsContentProps {
  bufferTexture: Texture | null;
  bufferVersion: number;
  isBufferReady: boolean;
  config: SceneConfig;
  onFirstFrameReady?: () => void;
}

function GlassOrbsContent({
  bufferTexture,
  bufferVersion,
  isBufferReady,
  config,
  onFirstFrameReady,
}: GlassOrbsContentProps) {
  if (!bufferTexture || !isBufferReady) return null;

  return (
    <>
      <ContextLossGuard />
      <FirstFrameReady onReady={onFirstFrameReady} />
      {/* HDR env 가 ON 이면 그쪽이 우선. OFF 일 때는 경량 Rim env 가 유리 엣지에 색을 깔아 준다. */}
      {config.envEnabled ? (
        <Suspense fallback={null}>
          <SceneEnvironment config={config} />
        </Suspense>
      ) : config.rimEnabled ? (
        <Suspense fallback={null}>
          <RimEnvironment config={config} />
        </Suspense>
      ) : null}
      <SceneLights config={config} />
      <LensContent buffer={bufferTexture} bufferVersion={bufferVersion} config={config} />
    </>
  );
}

interface FirstFrameReadyProps {
  enabled?: boolean;
  onReady?: () => void;
}

const FirstFrameReady = ({ enabled = true, onReady }: FirstFrameReadyProps) => {
  const firedRef = useRef(false);
  useFrame(() => {
    if (!enabled || firedRef.current || !onReady) return;
    firedRef.current = true;
    onReady();
  });
  return null;
};

/* ---------- 옵션 조절 레이어 (DevTool) ---------- */

interface ConfigLayerProps {
  config: SceneConfig;
  onChange: (next: SceneConfig) => void;
  onReset: () => void;
}

const formatSliderValue = (value: number, integer?: boolean) => {
  if (integer) return Math.round(value).toString();
  if (Math.abs(value) >= 10) return value.toFixed(1);
  return value.toFixed(2);
};

const ConfigLayer = ({ config, onChange, onReset }: ConfigLayerProps) => {
  const [isOpen, setIsOpen] = useState(false);

  const updateNumber = (key: NumKey, value: number) => {
    onChange({ ...config, [key]: value });
  };
  const updateBoolean = (key: BoolKey, value: boolean) => {
    onChange({ ...config, [key]: value });
  };
  const updateString = <K extends StrKey>(key: K, value: SceneConfig[K]) => {
    onChange({ ...config, [key]: value });
  };

  const renderField = (field: FieldSpec) => {
    if (field.type === "slider") {
      const value = config[field.key];
      return (
        <label key={field.key} className={styles.layerField}>
          <span className={styles.layerFieldTitle}>
            {field.label}: {formatSliderValue(value, field.integer)}
          </span>
          <input
            type="range"
            min={field.min}
            max={field.max}
            step={field.step}
            value={value}
            onChange={(event) => {
              const next = Number(event.target.value);
              updateNumber(field.key, field.integer ? Math.round(next) : next);
            }}
          />
        </label>
      );
    }

    if (field.type === "toggle") {
      const checked = config[field.key];
      return (
        <label key={field.key} className={`${styles.layerField} ${styles.layerToggleRow}`}>
          <span className={styles.layerFieldTitle}>{field.label}</span>
          <input
            type="checkbox"
            checked={checked}
            onChange={(event) => updateBoolean(field.key, event.target.checked)}
          />
        </label>
      );
    }

    if (field.type === "color") {
      const value = config[field.key];
      return (
        <label key={field.key} className={`${styles.layerField} ${styles.layerToggleRow}`}>
          <span className={styles.layerFieldTitle}>
            {field.label}: {value}
          </span>
          <input
            type="color"
            className={styles.layerColor}
            value={value}
            onChange={(event) => {
              const next = event.target.value as SceneConfig[typeof field.key];
              updateString(field.key, next);
            }}
          />
        </label>
      );
    }

    const value = config[field.key];
    return (
      <label key={field.key} className={styles.layerField}>
        <span className={styles.layerFieldTitle}>{field.label}</span>
        <select
          className={styles.layerSelect}
          value={value}
          onChange={(event) => {
            const next = event.target.value as SceneConfig[typeof field.key];
            updateString(field.key, next);
          }}
        >
          {field.options.map((opt) => (
            <option key={opt} value={opt}>
              {opt}
            </option>
          ))}
        </select>
      </label>
    );
  };

  return (
    <div className={styles.layerTool}>
      <button type="button" className={styles.layerToggle} onClick={() => setIsOpen((v) => !v)}>
        {isOpen ? "옵션 닫기" : "옵션 열기"}
      </button>
      {isOpen ? (
        <div className={styles.layerPopup}>
          <div className={styles.layerPopupHead}>
            <span className={styles.layerPopupTitle}>Scene Config</span>
            <button type="button" className={styles.layerResetBtn} onClick={onReset}>
              reset
            </button>
          </div>
          {SECTIONS.map((section) => (
            <section key={section.title} className={styles.layerSection}>
              <span className={styles.layerSectionTitle}>{section.title}</span>
              {section.fields.map((field) => renderField(field))}
            </section>
          ))}
        </div>
      ) : null}
    </div>
  );
};

/* ---------- 메인 Scene ---------- */

export interface GlassOrbsSceneProps {
  /** 렌즈가 굴절시킬 원본 이미지 URL (default: 히어로 배경) */
  sourceImageUrl?: string;
  /**
   * 이미지 내 텍스트 영역이 정렬될 DOM 기준 요소 (예: 히어로 h1).
   * 지정하면 렌즈 속 글자와 실제 DOM 글자 위치가 1:1 정합됨.
   */
  targetRef?: RefObject<HTMLElement | null>;
  /** 3D 글래스가 첫 렌더 프레임을 그렸을 때 호출 */
  onFirstFrameReady?: () => void;
}

const DEFAULT_SOURCE_IMAGE = "/main/img_hero.webp";

/**
 * dev 튜닝용 글래스 Scene Config 패널 노출 스위치.
 *   - false: state/핸들러/리셋 로직은 살려둠, UI(토글 버튼 + 팝업) 만 렌더 스킵.
 *   - true: "옵션 열기" 토글 + Scene Config 팝업 노출.
 */
const SHOW_GLASS_SCENE_CONFIG_PANEL = false;

export const GlassOrbsScene = ({
  sourceImageUrl = DEFAULT_SOURCE_IMAGE,
  targetRef,
  onFirstFrameReady,
}: GlassOrbsSceneProps) => {
  const [config, setConfig] = useState<SceneConfig>(DEFAULT_CONFIG);

  // R3F invalidate 브리지 — InvalidateBridge 컴포넌트가 ref.current 를
  // Canvas 의 invalidate 함수로 채워준다. 텍스처 훅은 이 ref 를 통해
  // React state 우회하고 바로 다음 프레임 렌더를 예약.
  const invalidateRef = useRef<(() => void) | null>(null);
  const invalidateCallback = useCallback(() => {
    invalidateRef.current?.();
  }, []);

  const { texture: bufferTexture, version: bufferVersion, isSourceReady } = useImageTransmissionTexture(
    sourceImageUrl,
    {
      targetRef,
      invalidate: invalidateCallback,
      // img_hero.webp 가 원본 대비 세로 2배(1920×2000)로 확장되면서 실제 히어로 콘텐츠가
      // 이미지 상단 절반(0~1000) 에 몰려 있음. 따라서 콘텐츠 중심(=전체의 1/4 지점) 을
      // 렌즈 포커스로 잡아야 글래스 안에 "신세계안과" 타이틀이 정렬되어 보인다.
      // 기본(0.5) 을 쓰면 확장된 빈 하단이 렌즈 중앙에 들어와 비어 보인다.
      srcFocusY: 0.25,
    },
  );

  const resetConfig = useCallback(() => setConfig(DEFAULT_CONFIG), []);

  return (
    <div className={styles.sceneWrap} aria-hidden>
      <Canvas
        key="shinsegae-glass-canvas"
        dpr={CANVAS_DPR}
        frameloop="demand"
        gl={GL_OPTIONS}
        camera={CANVAS_CAMERA}
      >
        <InvalidateBridge bridgeRef={invalidateRef} />
        <GlassOrbsContent
          bufferTexture={bufferTexture}
          bufferVersion={bufferVersion}
          isBufferReady={isSourceReady}
          config={config}
          onFirstFrameReady={onFirstFrameReady}
        />
      </Canvas>

      {SHOW_GLASS_SCENE_CONFIG_PANEL ? (
        <ConfigLayer config={config} onChange={setConfig} onReset={resetConfig} />
      ) : null}
    </div>
  );
};
