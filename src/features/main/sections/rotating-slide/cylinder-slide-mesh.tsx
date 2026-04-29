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

const IMAGE_FRAG = /* glsl */ `
  precision highp float;
  uniform sampler2D uMap;
  uniform float uHasMap;
  uniform float uFade;
  uniform float uVelocity;
  uniform float uSideDim;
  uniform float uImageBrightness;
  uniform float uImageContrast;
  uniform float uImageSaturation;
  uniform float uCornerRadius;
  uniform float uAspect;
  uniform float uFrameStrength;
  uniform float uFrameThickness;
  uniform float uWaterDistort;
  uniform float uFrameShine;
  uniform vec3 uWaterTint;
  uniform float uWaterTintMix;
  varying vec2 vUv;

  float roundedRectSDF(vec2 uv, float radius, float aspect) {
    vec2 p = uv * 2.0 - 1.0;
    p.x *= aspect;
    vec2 b = vec2(aspect, 1.0) - radius;
    vec2 q = abs(p) - b;
    return length(max(q, 0.0)) + min(max(q.x, q.y), 0.0) - radius;
  }

  void main() {
    vec2 uv = vUv;
    uv.y -= clamp(uVelocity * 0.04, -0.06, 0.06);

    float sdf = roundedRectSDF(vUv, uCornerRadius, uAspect);
    float mask = 1.0 - smoothstep(-0.006, 0.003, sdf);
    float edgeDist = -sdf;

    /* ── 프리즘: 가장자리 크로매틱 에버레이션 (수평 분산) — 현재 비활성 ── */
    // float edgeMask = smoothstep(0.10, 0.0, edgeDist);
    // float ca = edgeMask * 0.007;
    // float r = texture2D(uMap, clamp(uv + vec2(ca, 0.0), 0.001, 0.999)).r;
    // float g = texture2D(uMap, clamp(uv, 0.001, 0.999)).g;
    // float b = texture2D(uMap, clamp(uv - vec2(ca, 0.0), 0.001, 0.999)).b;
    // vec3 img = mix(vec3(0.05), vec3(r, g, b), uHasMap);

    vec4 sampled = texture2D(uMap, clamp(uv, vec2(0.001), vec2(0.999)));
    vec3 img = mix(vec3(0.05), sampled.rgb, uHasMap);

    /* ── 색 보정 ── */
    float luma = dot(img, vec3(0.2126, 0.7152, 0.0722));
    img = mix(vec3(luma), img, uImageSaturation);
    img = (img - 0.5) * uImageContrast + 0.5;
    img *= uImageBrightness;
    img = clamp(img, 0.0, 1.0);

    /* ── 유리 표면 리플렉션 — 현재 비활성 ── */
    // float topSheen = smoothstep(0.6, 0.95, vUv.y)
    //   * smoothstep(0.82, 0.10, abs(vUv.x - 0.4) * 2.0) * 0.07;
    // float diagGloss = smoothstep(0.035, 0.0, abs((vUv.x * 0.5 + vUv.y) - 0.76)) * 0.04;
    // img += vec3(topSheen + diagGloss) * uFrameShine * mask;

    /* ── 디밍 + 페이드 ── */
    float dim = mix(uSideDim, 1.0, uFade);
    img *= dim;

    float texAlpha = mix(1.0, sampled.a, uHasMap);
    gl_FragColor = vec4(img, mask * uFade * texAlpha);
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
  }
`;

export interface CylinderSlideMeshProps {
  src: string;
  width: number;
  height: number;
  radius: number;
  bendAmount?: number;
  sideDim?: number;
  waterFrameStrength?: number;
  waterFrameThickness?: number;
  waterDistort?: number;
  waterChromaticAberration?: number;
  waterFrameShine?: number;
  waterInnerDistort?: number;
  waterTintR?: number;
  waterTintG?: number;
  waterTintB?: number;
  waterTintMix?: number;
  imageBrightness?: number;
  imageContrast?: number;
  imageSaturation?: number;
  screenCornerRadius?: number;
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
  waterFrameStrength = 1.7,
  waterFrameThickness = 0.24,
  waterDistort = 0.014,
  waterChromaticAberration = 0.003,
  waterFrameShine = 1.8,
  waterInnerDistort = 0.004,
  waterTintR = 236,
  waterTintG = 244,
  waterTintB = 255,
  waterTintMix = 0.28,
  imageBrightness = 1,
  imageContrast = 1,
  imageSaturation = 1,
  screenCornerRadius = 0.055,
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
      uFrameStrength: { value: waterFrameStrength },
      uFrameThickness: { value: waterFrameThickness },
      uWaterDistort: { value: waterDistort },
      uChromaticAberration: { value: waterChromaticAberration },
      uFrameShine: { value: waterFrameShine },
      uInnerDistort: { value: waterInnerDistort },
      uWaterTint: { value: [waterTintR / 255, waterTintG / 255, waterTintB / 255] },
      uWaterTintMix: { value: waterTintMix },
      uImageBrightness: { value: imageBrightness },
      uImageContrast: { value: imageContrast },
      uImageSaturation: { value: imageSaturation },
      uCornerRadius: { value: screenCornerRadius },
      uAspect: { value: width / height },
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

  useEffect(() => {
    uniforms.uFrameStrength.value = waterFrameStrength;
    uniforms.uFrameThickness.value = waterFrameThickness;
    uniforms.uWaterDistort.value = waterDistort;
    uniforms.uChromaticAberration.value = waterChromaticAberration;
    uniforms.uFrameShine.value = waterFrameShine;
    uniforms.uInnerDistort.value = waterInnerDistort;
    uniforms.uWaterTint.value = [waterTintR / 255, waterTintG / 255, waterTintB / 255];
    uniforms.uWaterTintMix.value = waterTintMix;
    uniforms.uImageBrightness.value = imageBrightness;
    uniforms.uImageContrast.value = imageContrast;
    uniforms.uImageSaturation.value = imageSaturation;
    uniforms.uCornerRadius.value = screenCornerRadius;
    uniforms.uAspect.value = width / height;
    invalidate();
  }, [
    height, imageBrightness, imageContrast, imageSaturation, invalidate,
    screenCornerRadius, uniforms, waterChromaticAberration, waterDistort,
    waterFrameShine, waterFrameStrength, waterFrameThickness, waterInnerDistort,
    waterTintB, waterTintG, waterTintMix, waterTintR, width,
  ]);

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
        fragmentShader={IMAGE_FRAG}
        uniforms={uniforms}
        transparent
        depthWrite={false}
        side={DoubleSide}
      />
    </mesh>
  );
}
