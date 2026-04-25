"use client";

import {
  Suspense,
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type MutableRefObject,
  type ReactNode,
  type RefObject,
} from "react";
import gsap from "gsap";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { Environment, Lightformer, MeshTransmissionMaterial } from "@react-three/drei";
import { SphereGeometry, type Group as ThreeGroup, type Mesh as ThreeMesh, type Texture } from "three";
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
import {
  type SceneConfig,
  type EnvironmentPreset,
  type RimPreset,
  type OrbMergeMode,
  DEFAULT_CONFIG,
  ORB_MERGE_MODES,
  ENVIRONMENT_PRESETS,
  RIM_PRESETS,
} from "./glass-scene-config.types";
import { resolveLensScales } from "./glass-lens-geometry";
import { GlassSceneConfigPanel } from "./glass-scene-config-panel";
import styles from "./glass-orbs-scene.module.css";

export type { SceneConfig } from "./glass-scene-config.types";
export { DEFAULT_CONFIG } from "./glass-scene-config.types";

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

/** 커스텀 HDR 파일 경로 매핑 — preset 값이 여기 있으면 drei preset 대신 파일을 직접 로드 */
const CUSTOM_HDR_FILES: Partial<Record<EnvironmentPreset, string>> = {
  citrus_orchard: "/main/citrus_orchard_road_puresky_1k.hdr",
  suburban_garden: "/main/suburban_garden_1k.hdr",
  winter_evening: "/main/winter_evening_1k.hdr",
  blaubeuren_church_square: "/main/blaubeuren_church_square_1k.hdr",
  passendorf_snow: "/main/passendorf_snow_1k.hdr",
};

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
  const { xy: sxy, z: sz } = resolveLensScales(config);
  const baseScale: Vector3Tuple = config.ballMode ? [1, 1, 1] : [sxy, sxy, sz];
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
    const { xy: effXY, z: effZ } = resolveLensScales(config);

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
    config.lensFlatness,
    config.lensScalesManual,
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
 * 배경(HDRI preset 또는 커스텀 파일) + 커스텀 Lightformers.
 * `envBackground` 가 true 면 HDR 이 장면 배경으로 렌더된다.
 * CUSTOM_HDR_FILES 에 등록된 preset 은 drei CDN preset 대신 로컬 HDR 파일을 직접 로드한다.
 */
const SceneEnvironment = ({ config }: SceneEnvironmentProps) => {
  const customFile = CUSTOM_HDR_FILES[config.envPreset];
  const envProps = customFile
    ? { files: customFile }
    : { preset: config.envPreset as Exclude<EnvironmentPreset, keyof typeof CUSTOM_HDR_FILES> };
  const envRotation: [number, number, number] = [
    (config.envRotationXDeg * Math.PI) / 180,
    (config.envRotationYDeg * Math.PI) / 180,
    (config.envRotationZDeg * Math.PI) / 180,
  ];

  return (
    <Environment
      key={config.envPreset}
      {...envProps}
      resolution={256}
      environmentIntensity={config.envIntensity}
      background={config.envBackground}
      backgroundBlurriness={config.envBackgroundBlurriness}
      backgroundIntensity={config.envBackgroundIntensity}
      environmentRotation={envRotation}
      backgroundRotation={envRotation}
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
  /**
   * 문서 Y(절대) — 이 위치 "이전"까지는 상단 틸트 페이드를 적용하지 않는다(히어로~회전슬라이드).
   * 지정되지 않으면 기존처럼 `scrollY / (h*scrollFadeVh)` 만 사용.
   */
  mouseTiltHoldDocYRef?: RefObject<number | null>;
}

const MouseTiltGroup = ({
  children,
  maxTiltRad = 0.12,
  lerpSpeed = 8,
  scrollFadeVh = 1,
  mouseTiltHoldDocYRef,
}: MouseTiltGroupProps) => {
  const groupRef = useRef<ThreeGroup>(null);
  const target = useRef({ x: 0, y: 0 });
  const lastMouse = useRef({ x: -1, y: -1, seen: false });
  const wasVisibleRef = useRef(false);
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
      const holdY = mouseTiltHoldDocYRef?.current;
      // 상단: 히어로~RotatingSlideSection 끝까지 틸트 유지(옵션), 그다음 scrollFadeVh 만큼 감쇠.
      let topFade: number;
      if (holdY != null && Number.isFinite(holdY) && holdY > 0) {
        topFade =
          scrollY < holdY
            ? 1
            : Math.max(0, 1 - (scrollY - holdY) / (h * scrollFadeVh));
      } else {
        topFade = Math.max(0, 1 - scrollY / (h * scrollFadeVh));
      }
      // 하단 피날레: 남은 스크롤 기준 — 상단/하단 둘 중 큰 값 → 두 구간 모두 tilt 느낌 유지.
      const docH =
        typeof document !== "undefined"
          ? Math.max(
              document.documentElement.scrollHeight,
              document.body.scrollHeight,
            )
          : 0;
      const remaining = Math.max(0, docH - (scrollY + h));
      const bottomFade = Math.max(0, 1 - remaining / (h * scrollFadeVh));
      const fade = Math.max(topFade, bottomFade);
      // y-mouse 는 반전 — 커서가 위로 가면 렌즈 윗면이 카메라를 향하도록
      target.current.x = -ny * maxTiltRad * fade;
      target.current.y = nx * maxTiltRad * fade;

      // Invalidate 가드 — "SVG→Glass" 전환 시 콜드 스타트 방지용으로 실제 가시
      // 구간(fade>0) 보다 0.5vh 더 넓은 프리월 존 에서도 invalidate 허용.
      //   · 실제 tilt 강도(target.x/y) 는 fade 로 제어되므로 프리월 존에선 0 가까이 유지 →
      //     시각적 변화 없음. 대신 demand frameloop 이 돌아서 MTM / transmission 버퍼가
      //     최신 상태로 유지됨 → opacity 0→1 전환 첫 프레임이 이미 따뜻.
      //   · 버퍼 범위를 벗어나면 기존처럼 wasVisibleRef 로 "한 프레임만 lerp→0" 수행 후 정지.
      const PREWARM_VH = 0.5;
      const topPrewarmFromHero = scrollY < h * (scrollFadeVh + PREWARM_VH);
      const topPrewarmThroughHold =
        holdY != null && Number.isFinite(holdY) && holdY > 0
          ? scrollY < holdY + h * PREWARM_VH
          : false;
      const topPrewarm = topPrewarmFromHero || topPrewarmThroughHold;
      const bottomPrewarm = remaining < h * (scrollFadeVh + PREWARM_VH);
      const nearVisible = topPrewarm || bottomPrewarm;
      if (nearVisible || wasVisibleRef.current) {
        invalidate();
      }
      // wasVisibleRef 는 "조금 전엔 invalidate 범위였지만 이제 벗어남" 상태를 추적해
      // 1 프레임만 추가 invalidate 해서 lerp 잔여를 소진하는 용도.
      wasVisibleRef.current = nearVisible;
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
  }, [invalidate, maxTiltRad, lerpSpeed, scrollFadeVh, mouseTiltHoldDocYRef]);

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

const smooth01 = (t: number) => {
  const c = Math.min(1, Math.max(0, t));
  return c * c * (3 - 2 * c);
};

/**
 * 스크롤 p(0→1) 를 **3등분** (각 ⅓) — J = `journeyMaxYDeg` 라드(`maxYRad`):
 *   ⅓: 0 → **왼 −J** (기본 60°)
 *   ⅓: **−J → 0** (다시 0)
 *   ⅓: **0 → +2π·(J/60°)** (360° 가 J=60° 일 때; 슬라이더로 1·3 구간 강도 스케일)
 * 구간마다 smoothstep.
 */
function ScrollJourneyYRotation({
  children,
  progressRef,
  maxYRad,
}: {
  children: ReactNode;
  progressRef: MutableRefObject<number>;
  maxYRad: number;
}) {
  const groupRef = useRef<ThreeGroup>(null);
  const invalidate = useThree((s) => s.invalidate);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const onScroll = () => {
      invalidate();
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    onScroll();
    return () => window.removeEventListener("scroll", onScroll);
  }, [invalidate]);

  useEffect(() => {
    invalidate();
  }, [maxYRad, invalidate]);

  useFrame(() => {
    const g = groupRef.current;
    if (!g) return;
    const p = Math.min(1, Math.max(0, progressRef.current));
    const J = maxYRad;
    /** 60° 기준: 마지막 ⅓ 의 한 바퀴 = 2π×(J/60°) = 6J (라디안 J=π/3 이면 2π) */
    const D60 = Math.PI / 3;
    const fullSpin = 2 * Math.PI * (J / D60);
    const u0 = 3 * p;
    const u1 = 3 * p - 1;
    const u2 = 3 * p - 2;
    let y: number;
    if (p < 1 / 3) {
      y = -J * smooth01(u0);
    } else if (p < 2 / 3) {
      y = -J * (1 - smooth01(u1));
    } else {
      y = fullSpin * smooth01(u2);
    }
    if (Math.abs(g.rotation.y - y) > 0.00002) {
      g.rotation.y = y;
      invalidate();
    }
  });

  return <group ref={groupRef}>{children}</group>;
}

interface LensContentProps {
  buffer: Texture;
  bufferVersion: number;
  config: SceneConfig;
  journeyProgressRef?: MutableRefObject<number>;
  mouseTiltHoldDocYRef?: RefObject<number | null>;
  introMotionRef?: RefObject<IntroMotion>;
}

const LensContent = ({
  buffer,
  bufferVersion,
  config,
  journeyProgressRef,
  mouseTiltHoldDocYRef,
  introMotionRef,
}: LensContentProps) => {
  const { viewport, size, invalidate } = useThree();
  const rootFontSize = useRootFontSize();

  const lensScale = useMemo(() => {
    if (size.width <= 0 || viewport.width <= 0) return 1;
    const worldPerPx = viewport.width / size.width;
    const targetDiameterPx = config.maxDiameterRem * rootFontSize;
    const targetDiameterWorld = targetDiameterPx * worldPerPx;
    const baseDiameterWorld = 2 * ORB_RADIUS;
    // GlassOrb 내부 XY scale 을 감안해 최종 렌더 지름이 Max 지름을 넘지 않게 보정.
    const { xy: eff } = resolveLensScales(config);
    const effectiveXY = config.ballMode ? 1 : eff;
    return targetDiameterWorld / (baseDiameterWorld * effectiveXY);
  }, [
    viewport.width,
    size.width,
    rootFontSize,
    config.maxDiameterRem,
    config.ballMode,
    config.orbScaleXY,
    config.orbScaleZ,
    config.lensFlatness,
    config.lensScalesManual,
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

  const orb1PivotRef = useRef<ThreeGroup>(null);
  const orb2PivotRef = useRef<ThreeGroup>(null);

  useFrame(() => {
    if (config.orbMerge !== "separate") return;
    const intro = introMotionRef?.current;
    const active = intro?.active ?? false;

    const g1 = orb1PivotRef.current;
    if (g1) {
      g1.position.set(
        active ? intro!.orb1X : config.orb1OffsetX,
        config.orb1OffsetY,
        config.orb1OffsetZ,
      );
    }

    const g2 = orb2PivotRef.current;
    if (g2) {
      g2.position.set(
        active ? intro!.orb2X : config.orb2OffsetX,
        config.orb2OffsetY,
        config.orb2OffsetZ,
      );
      const opacity = active ? intro!.orb2Opacity : 1;
      g2.traverse((child) => {
        if ((child as ThreeMesh).isMesh) {
          const mat = (child as ThreeMesh).material;
          const m = Array.isArray(mat) ? mat[0] : mat;
          if (m && "opacity" in m) {
            (m as { opacity: number; transparent: boolean }).opacity = opacity;
            (m as { opacity: number; transparent: boolean }).transparent = true;
          }
        }
      });
    }

    if (active) invalidate();
  });

  const journeyMaxRad = config.journeyEnabled
    ? (config.journeyMaxYDeg * Math.PI) / 180
    : 0;

  const journeyWrap = (node: ReactNode) => {
    if (!journeyProgressRef || journeyMaxRad <= 0) {
      return node;
    }
    return (
      <ScrollJourneyYRotation
        progressRef={journeyProgressRef}
        maxYRad={journeyMaxRad}
      >
        {node}
      </ScrollJourneyYRotation>
    );
  };

  const mouseTiltRad = (config.mouseTiltMaxDeg * Math.PI) / 180;

  if (config.orbMerge !== "separate") {
    // CSG 불리언 결과(orb1 ↔ orb2)는 이미 (±offset/2) 대칭으로 구성되므로 추가 centering 불필요.
    return journeyWrap(
      <MouseTiltGroup
        mouseTiltHoldDocYRef={mouseTiltHoldDocYRef}
        maxTiltRad={mouseTiltRad}
        lerpSpeed={config.mouseTiltLerp}
        scrollFadeVh={config.mouseTiltScrollFadeVh}
      >
        <group scale={lensScale}>
          <CsgLens buffer={buffer} config={config} />
        </group>
      </MouseTiltGroup>,
    );
  }

  return journeyWrap(
    <MouseTiltGroup
      mouseTiltHoldDocYRef={mouseTiltHoldDocYRef}
      maxTiltRad={mouseTiltRad}
      lerpSpeed={config.mouseTiltLerp}
      scrollFadeVh={config.mouseTiltScrollFadeVh}
    >
      <group scale={lensScale}>
        <group position={pairCenteringOffset}>
          <group ref={orb1PivotRef}>
            <GlassOrb buffer={buffer} config={config} />
          </group>
          {config.orb2Enabled ? (
            <group ref={orb2PivotRef}>
              <GlassOrb buffer={buffer} config={config} scaleMultiplier={config.orb2Scale} />
            </group>
          ) : null}
        </group>
      </group>
    </MouseTiltGroup>,
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
  /** 모든 렌더 에셋(텍스처 + HDR env) 준비가 끝나 2프레임 이상 렌더됐을 때 1회 호출 */
  onFirstFrameReady?: () => void;
  /** env 가 필요한 경우, Suspense 해제 후 한번 호출되는 내부 신호 */
  onEnvReady?: () => void;
  /** env 가 필요 없거나 이미 준비됨. FirstFrameReady 게이트를 열 때 쓴다. */
  envSettled: boolean;
  /** 히어로~RotatingSlideSection 끝까지 0~1, Lens Y 여정 */
  journeyProgressRef?: MutableRefObject<number>;
  mouseTiltHoldDocYRef?: RefObject<number | null>;
  introMotionRef?: RefObject<IntroMotion>;
}

function GlassOrbsContent({
  bufferTexture,
  bufferVersion,
  isBufferReady,
  config,
  onFirstFrameReady,
  onEnvReady,
  envSettled,
  journeyProgressRef,
  mouseTiltHoldDocYRef,
  introMotionRef,
}: GlassOrbsContentProps) {
  if (!bufferTexture || !isBufferReady) return null;

  return (
    <>
      <ContextLossGuard />
      {/* FirstFrameReady 는 envSettled(=env 가 꺼져있거나 이미 로드됨) 일 때만 프레임 카운트 시작.
          모든 레이어(버퍼 이미지 + HDR env + 유리)가 한 화면에 놓인 뒤에 ready 신호를 쏘므로,
          SvgGlassOverlay 크로스페이드가 "부분만 먼저 나오는" 단계 없이 한번에 전환된다. */}
      <FirstFrameReady enabled={envSettled} onReady={onFirstFrameReady} />
      {/* HDR env 가 ON 이면 그쪽이 우선. OFF 일 때는 경량 Rim env 가 유리 엣지에 색을 깔아 준다. */}
      {config.envEnabled ? (
        <Suspense fallback={null}>
          <SceneEnvironment config={config} />
          {/* Suspense 가 해제되면 이 sentinel 이 마운트되면서 envReady 를 쏜다.
              HDR 이 도착해야 반사가 제대로 보이므로 이 시점까지 ready 를 보류. */}
          <EnvReadySentinel onReady={onEnvReady} />
        </Suspense>
      ) : config.rimEnabled ? (
        <Suspense fallback={null}>
          <RimEnvironment config={config} />
          <EnvReadySentinel onReady={onEnvReady} />
        </Suspense>
      ) : null}
      <SceneLights config={config} />
      <LensContent
        buffer={bufferTexture}
        bufferVersion={bufferVersion}
        config={config}
        journeyProgressRef={journeyProgressRef}
        mouseTiltHoldDocYRef={mouseTiltHoldDocYRef}
        introMotionRef={introMotionRef}
      />
    </>
  );
}

interface FirstFrameReadyProps {
  enabled?: boolean;
  onReady?: () => void;
}

/**
 * 모든 의존성이 준비된 뒤 "실제로 몇 프레임 그려졌을 때" onReady 를 1회 호출.
 *
 * 단일 프레임만으로는 HDR PMREM 굽기·버퍼 텍스처 업로드 직후 타이밍이라서
 * 화면이 아직 안정되지 않은 경우가 있다. 2프레임 이상 그린 뒤 신호를 보내면
 * 크로스페이드 시점에 유리·반사·배경이 모두 제자리에 있어 한 덩어리로 나타난다.
 */
const FirstFrameReady = ({ enabled = true, onReady }: FirstFrameReadyProps) => {
  const firedRef = useRef(false);
  const framesRef = useRef(0);
  const invalidate = useThree((state) => state.invalidate);

  // enabled 가 true 로 바뀌는 순간 demand frameloop 에서도 다음 프레임이 돌도록
  // invalidate 를 한 번 걸어 주고, 카운터가 2에 도달할 때까지 계속 다음 프레임을 예약.
  useEffect(() => {
    if (enabled && !firedRef.current) invalidate();
  }, [enabled, invalidate]);

  useFrame(() => {
    if (!enabled || firedRef.current || !onReady) return;
    framesRef.current += 1;
    if (framesRef.current < 2) {
      invalidate();
      return;
    }
    firedRef.current = true;
    onReady();
  });
  return null;
};

interface EnvReadySentinelProps {
  onReady?: () => void;
}

/**
 * Suspense 경계 안에 둘 때, 해당 Suspense 가 해제되어야만 마운트된다.
 * → `<SceneEnvironment>` 이 HDR 로드 완료로 언서스펜드되는 순간 이 useEffect 가
 *   발화하므로 "env 가 실제 scene.environment 로 들어간 시점" 을 잡는 간단한 신호로 쓸 수 있다.
 */
const EnvReadySentinel = ({ onReady }: EnvReadySentinelProps) => {
  useEffect(() => {
    onReady?.();
  }, [onReady]);
  return null;
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
  /** 히어로~회전 슬라이드 끝까지 스크롤 진행(0~1) — Y축 "여정" 회전 */
  journeyProgressRef?: MutableRefObject<number>;
  /** 이 문서 Y 이전까진 마우스 틸트 상단 감쇠 미적용(페이지 측에서 갱신) */
  mouseTiltHoldDocYRef?: RefObject<number | null>;
  /**
   * 히어로 이미지(전송 buffer) — 이 scrollY 를 넘기면 target 정렬을 고정(히어로와만 1:1).
   * 하단 variant(img_frame) 등에서는 전달 생략.
   */
  lockTextureAtScrollYRef?: RefObject<number | null>;
}

const DEFAULT_SOURCE_IMAGE = "/main/img_hero.webp";

/**
 * dev 튜닝용 글래스 Scene Config 패널 노출 스위치.
 *   - false: state/핸들러/리셋 로직은 살려둠, UI(토글 버튼 + 팝업) 만 렌더 스킵.
 *   - true: "옵션 열기" 토글 + Scene Config 팝업 노출.
 */
const SHOW_GLASS_SCENE_CONFIG_PANEL = false;

/* ---------- 히어로 인트로 애니메이션 ---------- */

interface IntroMotion {
  active: boolean;
  /** orb1 pivot X — 최종값은 config.orb1OffsetX */
  orb1X: number;
  /** orb2 pivot X — 최종값은 config.orb2OffsetX */
  orb2X: number;
  /** orb2 투명도 — 0: 숨김, 1: 보임 */
  orb2Opacity: number;
}

/** 중앙 기준 양쪽 시작 거리 (로컬 좌표) */
const HERO_INTRO_START_DISTANCE = 10;
const HERO_INTRO_DELAY_SEC = 1.05;
/** 양쪽 → 중앙 모이기 */
const HERO_INTRO_CONVERGE_SEC = 1.2;
const HERO_INTRO_CONVERGE_EASE = "power3.out" as const;
/** 중앙 대기 */
const HERO_INTRO_PAUSE_SEC = 0;
/** 중앙 → 각자 자리 */
const HERO_INTRO_SEPARATE_SEC = 1.0;
const HERO_INTRO_SEPARATE_EASE = "power2.inOut" as const;
let hasHeroGlassIntroPlayedOnce = false;

export const GlassOrbsScene = ({
  sourceImageUrl = DEFAULT_SOURCE_IMAGE,
  targetRef,
  journeyProgressRef,
  mouseTiltHoldDocYRef,
  lockTextureAtScrollYRef,
  onFirstFrameReady,
}: GlassOrbsSceneProps) => {
  const [config, setConfig] = useState<SceneConfig>(DEFAULT_CONFIG);
  const heroIntroCompletedRef = useRef(hasHeroGlassIntroPlayedOnce);
  const [heroCanvasStable, setHeroCanvasStable] = useState(false);
  const isHeroSource = sourceImageUrl.includes("img_hero");

  const midX = (config.orb1OffsetX + config.orb2OffsetX) / 2;
  const introMotionRef = useRef<IntroMotion>({
    active: false,
    orb1X: config.orb1OffsetX,
    orb2X: config.orb2OffsetX,
    orb2Opacity: 1,
  });

  const invalidateRef = useRef<(() => void) | null>(null);
  const invalidateCallback = useCallback(() => {
    invalidateRef.current?.();
  }, []);

  const { texture: bufferTexture, version: bufferVersion, isSourceReady } = useImageTransmissionTexture(
    sourceImageUrl,
    {
      targetRef,
      invalidate: invalidateCallback,
      fit: config.transmissionFit,
      zoom: config.transmissionZoom,
      srcFocusX: config.transmissionSrcFocusX,
      srcFocusY: sourceImageUrl.includes("img_frame")
        ? config.transmissionSrcFocusYFrame
        : config.transmissionSrcFocusY,
      centerOffsetXPx: config.transmissionOffsetXPx,
      centerOffsetYPx: config.transmissionOffsetYPx,
      lockTextureAtScrollYRef,
    },
  );

  // env 로드 상태 — HDR 또는 Rim env 의 Suspense 가 해제되는 순간 true 로 올라간다.
  // env 가 필요 없는 설정이면 항상 true 로 간주.
  const [envReady, setEnvReady] = useState(false);
  const needsEnv = config.envEnabled || config.rimEnabled;
  const envSettled = !needsEnv || envReady;

  // env 설정이 바뀌면(특히 on→off) 재로드를 의미하므로 envReady 를 리셋해 재수집.
  useEffect(() => {
    setEnvReady(false);
  }, [config.envEnabled, config.envPreset, config.rimEnabled, config.rimPreset]);

  const handleEnvReady = useCallback(() => {
    setEnvReady(true);
  }, []);

  const handleFirstFrameReady = useCallback(() => {
    if (isHeroSource) setHeroCanvasStable(true);
    onFirstFrameReady?.();
  }, [onFirstFrameReady, isHeroSource]);

  const resetConfig = useCallback(() => setConfig(DEFAULT_CONFIG), []);

  /** 비히어로 → 인트로 리셋 */
  useEffect(() => {
    if (isHeroSource) return;
    heroIntroCompletedRef.current = false;
    setHeroCanvasStable(false);
    const m = introMotionRef.current;
    m.active = false;
    m.orb1X = config.orb1OffsetX;
    m.orb2X = config.orb2OffsetX;
    m.orb2Opacity = 1;
    requestAnimationFrame(() => invalidateCallback());
  }, [invalidateCallback, isHeroSource, config.orb1OffsetX, config.orb2OffsetX]);

  /** 히어로: 첫 페인트부터 인트로 시작 자세 고정 (깜빡임 방지) */
  useLayoutEffect(() => {
    if (!isHeroSource) return;
    const m = introMotionRef.current;
    if (hasHeroGlassIntroPlayedOnce || heroIntroCompletedRef.current) {
      heroIntroCompletedRef.current = true;
      m.active = false;
      m.orb1X = config.orb1OffsetX;
      m.orb2X = config.orb2OffsetX;
      m.orb2Opacity = 1;
      requestAnimationFrame(() => invalidateCallback());
      return;
    }
    m.active = true;
    m.orb1X = midX - HERO_INTRO_START_DISTANCE;
    m.orb2X = midX + HERO_INTRO_START_DISTANCE;
    m.orb2Opacity = 0;
    requestAnimationFrame(() => invalidateCallback());
  }, [config.orb1OffsetX, config.orb2OffsetX, invalidateCallback, isHeroSource, midX]);

  /** 모든 준비 완료 → GSAP 인트로 실행 */
  useEffect(() => {
    if (
      !isHeroSource ||
      !isSourceReady ||
      !envSettled ||
      !heroCanvasStable ||
      hasHeroGlassIntroPlayedOnce ||
      heroIntroCompletedRef.current
    ) {
      return;
    }
    const m = introMotionRef.current;
    let tl: gsap.core.Timeline | null = null;
    let cancelled = false;

    const rafId = requestAnimationFrame(() => {
      if (cancelled || hasHeroGlassIntroPlayedOnce || heroIntroCompletedRef.current) return;

      m.active = true;
      m.orb1X = midX - HERO_INTRO_START_DISTANCE;
      m.orb2X = midX + HERO_INTRO_START_DISTANCE;
      m.orb2Opacity = 0;
      invalidateCallback();

      tl = gsap.timeline({ delay: HERO_INTRO_DELAY_SEC, onUpdate: invalidateCallback });
      tl
        .to(m, { orb1X: midX, duration: HERO_INTRO_CONVERGE_SEC, ease: HERO_INTRO_CONVERGE_EASE }, 0)
        .to(m, { orb2X: midX, duration: HERO_INTRO_CONVERGE_SEC, ease: HERO_INTRO_CONVERGE_EASE }, 0)
        .set(m, { orb2Opacity: 1 })
        .addLabel("separate", `+=${HERO_INTRO_PAUSE_SEC}`)
        .to(m, { orb1X: config.orb1OffsetX, duration: HERO_INTRO_SEPARATE_SEC, ease: HERO_INTRO_SEPARATE_EASE }, "separate")
        .to(m, { orb2X: config.orb2OffsetX, duration: HERO_INTRO_SEPARATE_SEC, ease: HERO_INTRO_SEPARATE_EASE }, "separate")
        .eventCallback("onComplete", () => {
          heroIntroCompletedRef.current = true;
          hasHeroGlassIntroPlayedOnce = true;
          m.active = false;
          m.orb1X = config.orb1OffsetX;
          m.orb2X = config.orb2OffsetX;
          m.orb2Opacity = 1;
          invalidateCallback();
        });
    });

    return () => {
      cancelled = true;
      cancelAnimationFrame(rafId);
      tl?.kill();
      if (hasHeroGlassIntroPlayedOnce || heroIntroCompletedRef.current) {
        m.active = false;
        m.orb1X = config.orb1OffsetX;
        m.orb2X = config.orb2OffsetX;
        m.orb2Opacity = 1;
        invalidateCallback();
      }
    };
  }, [envSettled, heroCanvasStable, invalidateCallback, isHeroSource, isSourceReady, midX, config.orb1OffsetX, config.orb2OffsetX]);

  return (
    <>
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
            key={sourceImageUrl}
            bufferTexture={bufferTexture}
            bufferVersion={bufferVersion}
            isBufferReady={isSourceReady}
            config={config}
            onFirstFrameReady={handleFirstFrameReady}
            onEnvReady={handleEnvReady}
            envSettled={envSettled}
            journeyProgressRef={journeyProgressRef}
            mouseTiltHoldDocYRef={mouseTiltHoldDocYRef}
            introMotionRef={introMotionRef}
          />
        </Canvas>
      </div>
      {SHOW_GLASS_SCENE_CONFIG_PANEL ? (
        <GlassSceneConfigPanel config={config} onChange={setConfig} onReset={resetConfig} variant="full" />
      ) : null}
    </>
  );
};
