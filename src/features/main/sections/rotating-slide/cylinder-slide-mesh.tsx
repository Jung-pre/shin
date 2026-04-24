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

const VERT = /* glsl */ `
  uniform float uBendAmount;
  uniform float uRadius;
  varying vec2 vUv;

  void main() {
    vUv = uv;

    float theta = position.x / uRadius;
    float curvedX = sin(theta) * uRadius;
    float curvedZ = (cos(theta) - 1.0) * uRadius;

    vec3 bentPos = vec3(curvedX, position.y, curvedZ);
    vec3 pos = mix(position, bentPos, uBendAmount);
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

    vec4 sampled = texture2D(uMap, clamp(uv, vec2(0.001), vec2(0.999)));
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
  groupRef: React.RefObject<Group | null>;
  baseAngle: number;
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
        fade = 1 - t * t * (3 - 2 * t);
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
