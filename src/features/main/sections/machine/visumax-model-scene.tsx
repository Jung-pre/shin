"use client";

import { memo, Suspense, useEffect } from "react";
import { Canvas } from "@react-three/fiber";
import { Bounds, Environment, PresentationControls, useGLTF } from "@react-three/drei";

/**
 * GLTF 모델을 2D 이미지 위에 겹쳐 올리는 범용 3D 오버레이 씬.
 *
 * - 이미지를 교체하는 게 아니라 "위에 얹는" 용도이므로 캔버스 배경은 투명(alpha)으로.
 * - `<Bounds fit>` 이 모델 bbox 를 자동 계산해 프레임에 맞춰 주므로 모델 크기·원점에 상관없이 들어맞음.
 * - `<PresentationControls>` 로 드래그 시 소폭 회전만 허용 — 풀 오빗 대신 "앞쪽만 살짝" 틸트.
 *   놓으면 snap 으로 기본 자세로 스프링 복귀. 휠 스크롤은 가로채지 않아 페이지 스크롤은 그대로.
 * - 사용하는 모델은 모듈 평가 시점에 preload 해 슬라이드 전환 시 멈칫이 없도록.
 * - 설정값(크기/위치/회전/컨트롤러 범위) 은 부모(config) 가 주입. 기본값은
 *   `DEFAULT_MODEL_SCENE_CONFIG` 참고.
 */

const VISUMAX_800_URL = "/main/visumax800.glb";
const VISUMAX_500_URL = "/main/visumax500.glb";

useGLTF.preload(VISUMAX_800_URL);
useGLTF.preload(VISUMAX_500_URL);

const SPRING_CONFIG = { mass: 1, tension: 170, friction: 26 };

/** drei <Environment preset> 허용값 — 너무 많아서 실용적인 것만 추려서 노출. */
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
 * - overlayScale: 3D Canvas 를 감싼 DOM(.modelOverlay) 자체의 크기 배수.
 *     CSS width/height 를 100% → X% 로 키워서 Canvas 네이티브 해상도까지 같이 커진다.
 *     Bounds 는 커진 Canvas 에 맞춰 다시 피팅 → 모델 시각 크기도 실제로 커지고 잘리지 않음.
 *     (model-level `scale` 은 프레임 안에서만 키워서 프레임 경계로 잘리는 반면,
 *      overlayScale 은 프레임 자체를 키움.)
 * - scale: Bounds 자동 피팅 후 모델에만 곱해질 크기 배수 (1 = 기본). 미세 조정용.
 * - positionX/Y/Z: 월드 좌표 오프셋 (rem 이 아니라 3D 단위).
 * - rotationX/Y: 라디안. 컨트롤러 드래그 전 기본 자세.
 * - azimuthLimit/polarLimit: PresentationControls 가 허용할 드래그 회전 범위(좌우 대칭).
 * - ambientIntensity/directionalIntensity: DOM 등가 3점 라이트 세기.
 * - envPreset/envIntensity: 반사/쨍함 주범. "studio" 는 화이트가 강해서 기본을 "apartment" 로.
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
  // 이전 기본값이 너무 쨍(휘도 포화) → 톤 다운. 필요시 패널에서 다시 올릴 것.
  //   envPreset 은 "studio" 로 통일 (요구사항). 대신 envIntensity 로 세기를 꺾어 포화 억제.
  ambientIntensity: 0.35,
  directionalIntensity: 0.7,
  envIntensity: 0.45,
  envPreset: "studio",
};

const DEG = Math.PI / 180;

/**
 * VISUMAX 800 전용 초기값 — 디자인 리뷰에서 확정된 위치/자세.
 *   overlayScale 1.14 로 프레임을 살짝 키워 모델이 이미지 위에서 충분히 크게 보이도록.
 *   rotation 은 앞쪽을 살짝 기울여 정면/측면 중간 뷰 (tilt 4.5° / yaw -14.4°).
 */
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

interface GltfModelProps {
  url: string;
  /** GLB 파싱/마운트 직후 1회 호출 — 부모가 "이제 모델이 화면에 붙었다" 는 신호로 사용. */
  onReady?: () => void;
}

const GltfModel = ({ url, onReady }: GltfModelProps) => {
  const { scene } = useGLTF(url);
  // useGLTF 는 Suspense 로 해소되므로 여기까지 도달했다면 파싱은 끝난 상태.
  //   primitive 가 씬에 실제로 추가된 뒤 다음 틱에 콜백을 쏴 DOM 페이드와 타이밍을 맞춘다.
  useEffect(() => {
    if (!onReady) return;
    const id = window.requestAnimationFrame(() => onReady());
    return () => window.cancelAnimationFrame(id);
  }, [onReady]);
  return <primitive object={scene} />;
};

/**
 * Bounds + 모델 묶음을 memo 로 고립시키는 이유:
 *
 *   drei <Bounds> 는 내부 useLayoutEffect 의 deps 에 `children` 을 넣어두기 때문에
 *   부모 컴포넌트가 리렌더 될 때마다 새로 만들어지는 JSX 자식 레퍼런스를 감지해 매번
 *   fit() 을 다시 호출한다. fit() 은 모델 bbox 중심에 카메라를 재배치하므로,
 *   positionX 같이 "이걸로 모델을 옆으로 밀어보자" 는 외부 트랜스폼을 적용해도
 *   Bounds 가 그 위치를 그대로 추적해 카메라를 이동시켜 버려서 결국 화면상에는 안 움직인다.
 *
 *   url(모델 경로) 이 같으면 이 컴포넌트는 리렌더 자체가 일어나지 않으므로 Bounds 도
 *   다시 fit() 하지 않고, 외부 그룹이 거는 translate/rotate 만 그대로 화면에 반영된다.
 */
const BoundedModel = memo(function BoundedModel({
  url,
  onReady,
}: {
  url: string;
  onReady?: () => void;
}) {
  return (
    <Bounds fit clip margin={1.05}>
      <GltfModel url={url} onReady={onReady} />
    </Bounds>
  );
});

export interface VisumaxModelSceneProps {
  /** 로드할 .glb 경로 (예: "/main/visumax800.glb") */
  modelUrl: string;
  /** 크기/위치/컨트롤러 옵션 — 생략 시 DEFAULT_MODEL_SCENE_CONFIG 사용. */
  config?: ModelSceneConfig;
  /** GLB 가 실제로 화면에 붙은 직후 1회 호출. 뒤 이미지 페이드아웃 타이밍용. */
  onLoaded?: () => void;
}

export const VisumaxModelScene = ({
  modelUrl,
  config = DEFAULT_MODEL_SCENE_CONFIG,
  onLoaded,
}: VisumaxModelSceneProps) => {
  const azimuth: [number, number] = [-config.azimuthLimit, config.azimuthLimit];
  const polar: [number, number] = [-config.polarLimit, config.polarLimit];

  return (
    <Canvas
      camera={{ position: [0, 0, 4], fov: 35 }}
      dpr={[1, 2]}
      gl={{ alpha: true, antialias: true, preserveDrawingBuffer: false }}
      style={{ background: "transparent" }}
    >
      {/* 쨍함(휘도 포화) 을 막기 위해 톤은 patch 형 보조광만 두고 메인은 environment 로.
       *   - ambient : 전역 필 라이트, 너무 높으면 대비가 죽음
       *   - directional : 방향성 하이라이트 1 개만. 세컨더리 제거(→ 반사 난립 방지) */}
      <ambientLight intensity={config.ambientIntensity} />
      <directionalLight
        position={[4, 6, 5]}
        intensity={config.directionalIntensity}
        castShadow={false}
      />
      <Suspense fallback={null}>
        {/* environmentIntensity 로 HDRI 반사 세기 자체를 감쇠. "studio" 는 화이트아웃 잘 남. */}
        <Environment preset={config.envPreset} environmentIntensity={config.envIntensity} />
        {/* 트랜스폼 계층:
         *   1) 가장 바깥 group: position (world translate) — Bounds 가 못 보는 바깥이라
         *      카메라 재피팅 영향 없이 모델만 이동한다.
         *   2) PresentationControls: 드래그로 축 회전 (snap 복귀 포함).
         *   3) 내부 group: 기본 자세(rotationX/Y) + scale — 모델 자체의 회전/크기 보정.
         *   4) BoundedModel: memo 된 Bounds + GLTF → url 동일하면 재피팅 안 됨. */}
        <group position={[config.positionX, config.positionY, config.positionZ]}>
          <PresentationControls
            global
            snap
            polar={polar}
            azimuth={azimuth}
            config={SPRING_CONFIG}
          >
            <group rotation={[config.rotationX, config.rotationY, 0]} scale={config.scale}>
              <BoundedModel url={modelUrl} onReady={onLoaded} />
            </group>
          </PresentationControls>
        </group>
      </Suspense>
    </Canvas>
  );
};

export default VisumaxModelScene;
