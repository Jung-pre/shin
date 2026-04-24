"use client";

import { memo, Suspense, useEffect, useRef, useState, type ReactNode } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { Bounds, Environment, useGLTF } from "@react-three/drei";
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
 * - `MouseFollowGroup` 으로 마우스 위치에 따라 소폭 회전 — 클릭 없이 hover 만으로 반응.
 *   회전 한계는 config.azimuthLimit / polarLimit 로 제한되고, 커서가 움직이지 않으면 관성 없이 정지.
 *   휠 스크롤/클릭은 전혀 가로채지 않아 페이지 스크롤·퀵바 상호작용은 그대로 유지된다.
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
 * 마우스 추적 회전 그룹.
 *   - 과거엔 <PresentationControls> 로 "클릭 드래그" 해야 회전했는데, azimuth/polar 범위가
 *     좁아서 VISUMAX 800/500 은 거의 안 움직이는 것처럼 보임. 기획 요구는 "마우스만 따라
 *     부드럽게 회전" 이라 아예 pointer-follow 로 교체.
 *   - 마우스 좌표를 뷰포트 기준 정규화(-1..1) 후 config 의 azimuth/polar 한계를 최대 각도로
 *     환산해 target 회전값을 잡고, useFrame 에서 지수 감쇠 lerp 로 따라감 → 부드럽고 관성감.
 *   - mousemove 는 window 레벨 listener 1 개. frameloop="never" 인 동안엔 useFrame 이 돌지
 *     않으므로 뷰포트 밖에서는 회전도 자동 정지(성능 안전).
 */
interface MouseFollowGroupProps {
  children: ReactNode;
  maxYawRad: number;
  maxPitchRad: number;
  lerpSpeed?: number;
}

const MouseFollowGroup = ({
  children,
  maxYawRad,
  maxPitchRad,
  lerpSpeed = 6,
}: MouseFollowGroupProps) => {
  const groupRef = useRef<THREE.Group>(null);
  const targetRef = useRef({ x: 0, y: 0 });

  useEffect(() => {
    if (typeof window === "undefined") return;
    const handle = (event: MouseEvent) => {
      const w = window.innerWidth || 1;
      const h = window.innerHeight || 1;
      const nx = (event.clientX / w) * 2 - 1;
      const ny = (event.clientY / h) * 2 - 1;
      targetRef.current.x = -ny * maxPitchRad;
      targetRef.current.y = nx * maxYawRad;
    };
    window.addEventListener("mousemove", handle, { passive: true });
    return () => window.removeEventListener("mousemove", handle);
  }, [maxYawRad, maxPitchRad]);

  useFrame((_, delta) => {
    const group = groupRef.current;
    if (!group) return;
    const lerp = 1 - Math.exp(-delta * lerpSpeed);
    group.rotation.x += (targetRef.current.x - group.rotation.x) * lerp;
    group.rotation.y += (targetRef.current.y - group.rotation.y) * lerp;
  });

  return <group ref={groupRef}>{children}</group>;
};

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
    // maxDuration=0: 카메라 fit 애니메이션 지속시간을 0 으로 설정 → 즉시 적용.
    //   drei v10 에서 기존 `damping` prop 이 제거되고 `maxDuration` / `interpolateFunc`
    //   조합으로 대체됐다. damping=0 이 원래 수행하던 "날아오는 느낌 제거" 는
    //   maxDuration=0 으로 동일 효과.
    <Bounds fit clip margin={1.05} maxDuration={0}>
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
  // 성능: Canvas 3개(800/500/Catalys)가 frameloop="always" 로 상시 60fps 렌더되면
  //   스크롤 중 GPU/CPU 부하가 누적된다. IntersectionObserver 로 뷰포트에 실제로
  //   보일 때만 frameloop="always" 로 켜고, 밖이면 "never" 로 내려 렌더를 정지.
  //   MouseFollowGroup 의 useFrame 도 뷰포트 안에서만 돌아 자동으로 정지된다.
  const wrapperRef = useRef<HTMLDivElement>(null);
  const [frameloop, setFrameloop] = useState<"always" | "never">("never");
  useEffect(() => {
    const el = wrapperRef.current;
    if (!el || typeof window === "undefined") return;
    if (!("IntersectionObserver" in window)) {
      setFrameloop("always");
      return;
    }
    const io = new IntersectionObserver(
      ([entry]) => {
        setFrameloop(entry?.isIntersecting ? "always" : "never");
      },
      // 진입 직전부터 켜서 첫 프레임을 놓치지 않도록 여유 마진.
      { root: null, rootMargin: "200px 0px", threshold: 0 },
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);

  return (
    <div
      ref={wrapperRef}
      style={{ position: "relative", width: "100%", height: "100%" }}
    >
    <Canvas
      camera={{ position: [0, 0, 4], fov: 35 }}
      dpr={[1, 2]}
      // frameloop 은 뷰포트 진입 여부에 따라 toggling. 밖이면 렌더 완전 정지 → GPU idle.
      frameloop={frameloop}
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
         *   2) MouseFollowGroup: 마우스 위치를 따라 축 회전 (클릭 없이 hover 로 반응).
         *   3) 내부 group: 기본 자세(rotationX/Y) + scale — 모델 자체의 회전/크기 보정.
         *   4) BoundedModel: memo 된 Bounds + GLTF → url 동일하면 재피팅 안 됨. */}
        <group position={[config.positionX, config.positionY, config.positionZ]}>
          <MouseFollowGroup maxYawRad={config.azimuthLimit} maxPitchRad={config.polarLimit}>
            <group rotation={[config.rotationX, config.rotationY, 0]} scale={config.scale}>
              <BoundedModel
                url={modelUrl}
                metalness={config.metalness}
                roughness={config.roughness}
                onReady={onLoaded}
              />
            </group>
          </MouseFollowGroup>
        </group>
      </Suspense>
    </Canvas>
    </div>
  );
};

export default VisumaxModelScene;
