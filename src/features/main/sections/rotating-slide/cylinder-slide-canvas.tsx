"use client";

import {
  Suspense,
  useEffect,
  useMemo,
  useRef,
  type MutableRefObject,
  type RefObject,
} from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { Group, PerspectiveCamera } from "three";
import { CylinderSlideMesh } from "./cylinder-slide-mesh";
import { useScrollVelocity } from "./use-scroll-velocity";

export interface CylinderSlide {
  imageSrc: string;
  label: string;
}

export interface CylinderSlideCanvasProps {
  slides: readonly CylinderSlide[];
  progressRef: RefObject<number>;
  spacingFactor?: number;
  radius?: number;
  cardWidth?: number;
  cardHeight?: number;
  bendAmount?: number;
  cameraZ?: number;
  fov?: number;
  fadeCutoffDeg?: number;
  sideDim?: number;
  /** 원통 X 축 기울기(degrees). 양수 = 위가 앞으로, 음수 = 아래가 앞으로. */
  cylinderTiltDeg?: number;
  /** 카드 사이 Y 계단(world unit). 0=수평, 양수=뒤 카드일수록 위, 음수=아래. */
  cardYStep?: number;
  isActive: boolean;
}

export function CylinderSlideCanvas({
  slides,
  progressRef,
  spacingFactor = 0.53,
  radius = 2.8,
  cardWidth = 1.9,
  cardHeight = 1.13,
  bendAmount = 1,
  cameraZ = 5.2,
  fov = 32,
  fadeCutoffDeg = 95,
  sideDim = 0.55,
  cylinderTiltDeg = 0,
  cardYStep = 0,
  isActive,
}: CylinderSlideCanvasProps) {
  const velocityRef = useScrollVelocity();

  return (
    <Canvas
      dpr={[1, 1.5]}
      frameloop="demand"
      gl={{ antialias: true, alpha: true, powerPreference: "high-performance" }}
      camera={{ position: [0, 0, cameraZ], fov, near: 0.1, far: 20 }}
      onCreated={({ gl, scene }) => {
        // 투명 클리어: 알파 구간이 흰색으로 보이지 않게(뒤 그리드/섹션이 보이도록)
        gl.setClearColor(0x000000, 0);
        scene.background = null;
      }}
    >
      <ambientLight intensity={0.9} />
      <CameraSync cameraZ={cameraZ} fov={fov} />
      <Suspense fallback={null}>
        <CylinderGroup
          slides={slides}
          progressRef={progressRef}
          spacingFactor={spacingFactor}
          radius={radius}
          cardWidth={cardWidth}
          cardHeight={cardHeight}
          bendAmount={bendAmount}
          fadeCutoffDeg={fadeCutoffDeg}
          sideDim={sideDim}
          cylinderTiltDeg={cylinderTiltDeg}
          cardYStep={cardYStep}
          isActive={isActive}
          velocityRef={velocityRef}
        />
      </Suspense>
    </Canvas>
  );
}

function CameraSync({ cameraZ, fov }: { cameraZ: number; fov: number }) {
  const { camera, invalidate } = useThree();
  useEffect(() => {
    /* eslint-disable react-hooks/immutability */
    camera.position.z = cameraZ;
    if (camera instanceof PerspectiveCamera) {
      camera.fov = fov;
      camera.updateProjectionMatrix();
    }
    /* eslint-enable react-hooks/immutability */
    invalidate();
  }, [camera, cameraZ, fov, invalidate]);
  return null;
}

function CylinderGroup({
  slides,
  progressRef,
  spacingFactor,
  radius,
  cardWidth,
  cardHeight,
  bendAmount,
  fadeCutoffDeg,
  sideDim,
  cylinderTiltDeg,
  cardYStep,
  isActive,
  velocityRef,
}: {
  slides: readonly CylinderSlide[];
  progressRef: RefObject<number>;
  spacingFactor: number;
  radius: number;
  cardWidth: number;
  cardHeight: number;
  bendAmount: number;
  fadeCutoffDeg: number;
  sideDim: number;
  cylinderTiltDeg: number;
  cardYStep: number;
  isActive: boolean;
  velocityRef: MutableRefObject<number>;
}) {
  const groupRef = useRef<Group>(null);
  const tiltRef = useRef<Group>(null);
  const invalidate = useThree((s) => s.invalidate);

  const stepRad = useMemo(
    () => ((2 * Math.PI) / slides.length) * spacingFactor,
    [slides.length, spacingFactor],
  );

  // fadeCutoffDeg → 라디안 ref. useFrame 내에서 직접 읽어 stale 없이 최신값 보장.
  const fadeCutoffRadRef = useRef((fadeCutoffDeg * Math.PI) / 180);
  useEffect(() => {
    fadeCutoffRadRef.current = (fadeCutoffDeg * Math.PI) / 180;
    invalidate();
  }, [fadeCutoffDeg, invalidate]);

  // 원통 X 기울기 → 라디안 ref
  const tiltRadRef = useRef((cylinderTiltDeg * Math.PI) / 180);
  useEffect(() => {
    tiltRadRef.current = (cylinderTiltDeg * Math.PI) / 180;
    invalidate();
  }, [cylinderTiltDeg, invalidate]);

  useFrame(() => {
    const group = groupRef.current;
    if (!group) return;

    const p = progressRef.current ?? 0;
    const total = (slides.length - 1) * stepRad;
    group.rotation.y = -p * total;

    // tilt 그룹: X 기울기 + Y 보정
    //   cardYStep 이 있을 때, 스크롤 진행도에 따라 활성 카드의 Y 위치가 달라진다.
    //   원통 전체를 위로 올려(-i × cardYStep) 활성 카드가 항상 같은 화면 위치를 유지.
    const tilt = tiltRef.current;
    if (tilt) {
      tilt.rotation.x = tiltRadRef.current;
      // progress 가 i/(N-1) 일 때 활성 카드의 local Y = i * cardYStep
      // → 월드 Y 를 -p*(N-1)*cardYStep 만큼 이동하면 활성 카드 Y=0 유지.
      tilt.position.y = -p * (slides.length - 1) * cardYStep;
    }

    if (isActive) invalidate();
  });

  // 파라미터 변화 시 즉각 한 프레임 강제
  useEffect(() => {
    invalidate();
  }, [
    isActive,
    invalidate,
    spacingFactor,
    radius,
    cardWidth,
    cardHeight,
    bendAmount,
    sideDim,
    cardYStep,
  ]);

  return (
    // tiltRef: 원통 전체를 X 축으로 기울이는 래퍼
    <group ref={tiltRef}>
      {/* groupRef: Y 축 회전으로 슬라이드 전환 */}
      <group ref={groupRef}>
        {slides.map((slide, i) => {
          const baseAngle = i * stepRad;
          // 카드별 Y 오프셋 — cardYStep 이 양수면 인덱스 올라갈수록 위로
          const yOffset = i * cardYStep;
          return (
            <group key={slide.imageSrc} rotation={[0, baseAngle, 0]}>
              <group position={[0, yOffset, radius]}>
                <CylinderSlideMesh
                  src={slide.imageSrc}
                  width={cardWidth}
                  height={cardHeight}
                  radius={radius}
                  bendAmount={bendAmount}
                  sideDim={sideDim}
                  velocityRef={velocityRef}
                  groupRef={groupRef}
                  baseAngle={baseAngle}
                  fadeCutoffRadRef={fadeCutoffRadRef}
                />
              </group>
            </group>
          );
        })}
      </group>
    </group>
  );
}
