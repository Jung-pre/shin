"use client";

import { useEffect, useMemo, useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import { useTexture } from "@react-three/drei";
import {
  DoubleSide,
  LinearFilter,
  SRGBColorSpace,
  type Group,
  type Mesh,
  type ShaderMaterial,
  type Texture,
} from "three";

/**
 * 단일 "카드" — 평면 플레인을 버텍스 셰이더로 원통 호(arc) 를 따라 휘게 그리고,
 * 그 위에 이미지 텍스처를 입힌다.
 *
 * fade 계산은 이 컴포넌트의 useFrame 내부에서 직접 수행한다.
 *   - groupRef   : 부모 CylinderGroup 의 ref → 매 프레임 world rotation.y 를 읽어
 *                  fade 를 계산. 클로저 stale 문제 원천 제거.
 *   - baseAngle  : 이 카드의 배치 기준각(라디안) — 배치 시 group rotation.y 에 해당.
 *   - fadeCutoffRadRef : 0 이 되는 각도(라디안). ref 이므로 tuner 변경 즉시 반영.
 */

const VERT = /* glsl */ `
  uniform float uBendAmount;
  uniform float uRadius;
  varying vec2 vUv;

  void main() {
    vUv = uv;

    // local X 를 원호 위로 매핑.
    float theta = position.x / uRadius;
    float curvedX = sin(theta) * uRadius;
    float curvedZ = (cos(theta) - 1.0) * uRadius;

    vec3 bentPos = vec3(curvedX, position.y, curvedZ);
    vec3 flatPos = position;
    vec3 pos = mix(flatPos, bentPos, uBendAmount);

    gl_Position = projectionMatrix * modelViewMatrix * vec4(pos, 1.0);
  }
`;

const FRAG = /* glsl */ `
  precision highp float;
  uniform sampler2D uMap;
  uniform float uHasMap;
  uniform float uFade;
  uniform float uVelocity;
  uniform float uSideDim;
  varying vec2 vUv;

  void main() {
    vec2 uv = vUv;
    uv.y -= clamp(uVelocity * 0.04, -0.06, 0.06);

    vec4 sampled = texture2D(uMap, uv);
    vec4 placeholder = vec4(0.78, 0.75, 0.82, 1.0);
    vec4 col = mix(placeholder, sampled, uHasMap);

    float dim = mix(uSideDim, 1.0, uFade);
    col.rgb *= dim;
    col.a *= uFade;

    gl_FragColor = col;
  }
`;

export interface CylinderSlideMeshProps {
  src: string;
  width: number;
  height: number;
  radius: number;
  bendAmount?: number;
  sideDim?: number;
  velocityRef: React.RefObject<number>;
  /** 부모 CylinderGroup 의 ref — useFrame 에서 world rotation.y 를 직접 읽어 fade 계산 */
  groupRef: React.RefObject<Group | null>;
  /** 이 카드의 원통상 배치 기준각 (라디안) */
  baseAngle: number;
  /** 페이드가 0 이 되는 각도 (라디안). ref 로 전달해 최신값 보장. */
  fadeCutoffRadRef: React.RefObject<number>;
}

export function CylinderSlideMesh({
  src,
  width,
  height,
  radius,
  bendAmount = 1,
  sideDim = 0.55,
  velocityRef,
  groupRef,
  baseAngle,
  fadeCutoffRadRef,
}: CylinderSlideMeshProps) {
  const texture = useTexture(src) as Texture;
  const invalidate = useThree((s) => s.invalidate);

  useEffect(() => {
    if (!texture) return;
    texture.colorSpace = SRGBColorSpace;
    texture.minFilter = LinearFilter;
    texture.magFilter = LinearFilter;
    texture.anisotropy = 4;
    texture.needsUpdate = true;
    invalidate();
  }, [texture, invalidate]);

  const meshRef = useRef<Mesh>(null);
  const matRef = useRef<ShaderMaterial>(null);

  const uniforms = useMemo(
    () => ({
      uMap: { value: texture ?? null },
      uHasMap: { value: texture ? 1 : 0 },
      uFade: { value: 1 },
      uVelocity: { value: 0 },
      uBendAmount: { value: bendAmount },
      uRadius: { value: radius },
      uSideDim: { value: sideDim },
    }),
    // 초기 1회만. texture·sideDim 변경은 아래 effect 로 처리.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );

  useEffect(() => {
    uniforms.uMap.value = texture ?? null;
    uniforms.uHasMap.value = texture ? 1 : 0;
  }, [texture, uniforms]);

  useEffect(() => {
    uniforms.uSideDim.value = sideDim;
  }, [sideDim, uniforms]);

  useEffect(() => {
    uniforms.uBendAmount.value = bendAmount;
    uniforms.uRadius.value = radius;
  }, [bendAmount, radius, uniforms]);

  useFrame(() => {
    // fade 를 매 프레임 직접 계산 — groupRef·fadeCutoffRadRef 는 모두 ref 이므로
    // tuner 슬라이더 변경이 즉시 (클로저 stale 없이) 반영된다.
    const group = groupRef.current;
    const cutoff = fadeCutoffRadRef.current;
    let fade = 1;
    if (group && cutoff > 0) {
      const world = baseAngle + group.rotation.y;
      const wrapped = Math.atan2(Math.sin(world), Math.cos(world));
      const abs = Math.abs(wrapped);
      if (abs >= cutoff) {
        fade = 0;
      } else {
        const t = abs / cutoff;
        fade = 1 - t * t * (3 - 2 * t); // smoothstep (1→0)
      }
    }
    uniforms.uFade.value = fade;
    uniforms.uVelocity.value = velocityRef.current ?? 0;
  });

  return (
    <mesh ref={meshRef}>
      <planeGeometry args={[width, height, 32, 1]} />
      <shaderMaterial
        ref={matRef}
        vertexShader={VERT}
        fragmentShader={FRAG}
        uniforms={uniforms}
        transparent
        depthWrite={false}
        side={DoubleSide}
      />
    </mesh>
  );
}
