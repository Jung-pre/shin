"use client";

import { memo, Suspense, useEffect } from "react";
import { Canvas } from "@react-three/fiber";
import { Bounds, Environment, PresentationControls, useGLTF } from "@react-three/drei";
import * as THREE from "three";
import {
  DEFAULT_MODEL_SCENE_CONFIG,
  type ModelSceneConfig,
} from "./visumax-model-config";

// 타입/상수/프리셋은 경량 config 모듈에서 재내보내기.
//   machine-section 같은 "위쪽" 코드가 아래 경로를 기존대로 import 하면
//   이 씬 모듈 전체가 딸려 들어와 GLB 26MB 가 즉시 fetch 된다. 그래서 static
//   참조는 전부 경량 config 로 옮겼고, 여기서는 기존 호환을 위해 re-export.
export {
  ENV_PRESET_OPTIONS,
  DEFAULT_MODEL_SCENE_CONFIG,
  VISUMAX_800_DEFAULT_CONFIG,
  type EnvPresetKey,
  type ModelSceneConfig,
} from "./visumax-model-config";

/**
 * GLTF 모델을 2D 이미지 위에 겹쳐 올리는 범용 3D 오버레이 씬.
 *
 * - 이미지를 교체하는 게 아니라 "위에 얹는" 용도이므로 캔버스 배경은 투명(alpha)으로.
 * - `<Bounds fit>` 이 모델 bbox 를 자동 계산해 프레임에 맞춰 주므로 모델 크기·원점에 상관없이 들어맞음.
 * - `<PresentationControls>` 로 드래그 시 소폭 회전만 허용 — 풀 오빗 대신 "앞쪽만 살짝" 틸트.
 *   놓으면 snap 으로 기본 자세로 스프링 복귀. 휠 스크롤은 가로채지 않아 페이지 스크롤은 그대로.
 * - 사용하는 모델은 이 모듈(= 씬) 이 실제로 로드될 때만 preload. 이 파일은
 *   `next/dynamic` 으로만 import 되므로 Machine 섹션이 화면에 붙기 전까지 26MB
 *   GLB 다운로드가 시작되지 않는다.
 * - 설정값(크기/위치/회전/컨트롤러 범위) 은 부모(config) 가 주입. 기본값은
 *   `DEFAULT_MODEL_SCENE_CONFIG` 참고.
 */

const VISUMAX_800_URL = "/main/visumax800.glb";
const VISUMAX_500_URL = "/main/visumax500.glb";

useGLTF.preload(VISUMAX_800_URL);
useGLTF.preload(VISUMAX_500_URL);

/**
 * PresentationControls 스프링 감쇠 — drei 10.7 에서 `config={{mass,tension,friction}}`
 *   API 가 `damping` (단일 숫자) 로 대체됨. 기존 기본값 `{mass:1, tension:170, friction:26}` 은
 *   critical damping ratio ≈ 0.998 수준이라 사실상 `damping: 1` 과 거의 동일 → 그대로 1 사용.
 */
const SPRING_DAMPING = 1;

interface GltfModelProps {
  url: string;
  metalness?: number;
  roughness?: number;
  /** GLB 파싱/마운트 직후 1회 호출 — 부모가 "이제 모델이 화면에 붙었다" 는 신호로 사용. */
  onReady?: () => void;
}

const GltfModel = ({ url, metalness = -1, roughness = -1, onReady }: GltfModelProps) => {
  const { scene } = useGLTF(url);

  // 재질 오버라이드: -1이면 원본 GLB 값 유지, 그 외 값으로 강제 적용
  useEffect(() => {
    scene.traverse((obj) => {
      if (!(obj instanceof THREE.Mesh)) return;
      const mats = Array.isArray(obj.material) ? obj.material : [obj.material];
      mats.forEach((mat) => {
        if (mat instanceof THREE.MeshStandardMaterial) {
          if (metalness >= 0) mat.metalness = metalness;
          if (roughness >= 0) mat.roughness = roughness;
          mat.needsUpdate = true;
        }
      });
    });
  }, [scene, metalness, roughness]);

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
  metalness,
  roughness,
  onReady,
}: {
  url: string;
  metalness?: number;
  roughness?: number;
  onReady?: () => void;
}) {
  return (
    // damping=0: 카메라 fit 즉시 적용, 기본값(6)은 부드럽게 이동해 "날아오는" 느낌을 줌.
    <Bounds fit clip margin={1.05} damping={0}>
      <GltfModel url={url} metalness={metalness} roughness={roughness} onReady={onReady} />
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
      // 주의: drei PresentationControls 는 useFrame 내부에서 invalidate() 를 호출하지 않는다.
      //   frameloop="demand" 로 두면 드래그 중에도 useFrame 이 돌지 않아 스프링 애니메이션이
      //   작동하지 않음 → 기본값(always) 유지.
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
            damping={SPRING_DAMPING}
          >
            <group rotation={[config.rotationX, config.rotationY, 0]} scale={config.scale}>
              <BoundedModel
                url={modelUrl}
                metalness={config.metalness}
                roughness={config.roughness}
                onReady={onLoaded}
              />
            </group>
          </PresentationControls>
        </group>
      </Suspense>
    </Canvas>
  );
};

export default VisumaxModelScene;
