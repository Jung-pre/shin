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

  float roundedRectMask(vec2 uv, float radius, float aspect) {
    if (radius <= 0.0001) return 1.0;
    vec2 p = uv * 2.0 - 1.0;
    p.x *= aspect;
    vec2 b = vec2(aspect, 1.0) - radius;
    vec2 q = abs(p) - b;
    float d = length(max(q, 0.0)) + min(max(q.x, q.y), 0.0) - radius;
    return 1.0 - smoothstep(0.0, 0.012, d);
  }

  void main() {
    vec2 uv = vUv;
    uv.y -= clamp(uVelocity * 0.04, -0.06, 0.06);

    vec4 sampled = texture2D(uMap, clamp(uv, vec2(0.001), vec2(0.999)));
    vec4 placeholder = vec4(0.78, 0.75, 0.82, 1.0);
    vec4 col = mix(placeholder, sampled, uHasMap);
    float luma = dot(col.rgb, vec3(0.2126, 0.7152, 0.0722));
    col.rgb = mix(vec3(luma), col.rgb, uImageSaturation);
    col.rgb = (col.rgb - 0.5) * uImageContrast + 0.5;
    col.rgb *= uImageBrightness;
    col.rgb = clamp(col.rgb, 0.0, 1.0);

    vec2 centered = vUv * 2.0 - 1.0;
    float edgeDistance = min(min(vUv.x, 1.0 - vUv.x), min(vUv.y, 1.0 - vUv.y));
    float edge = 1.0 - smoothstep(0.0, max(0.001, uFrameThickness), edgeDistance);
    float rim = smoothstep(0.010, 0.0, edgeDistance);
    float surface = smoothstep(1.15, 0.0, length(centered));
    float topGloss = smoothstep(0.62, 1.0, vUv.y) * smoothstep(1.0, 0.18, vUv.x);
    float softDiagonal = smoothstep(0.085, 0.0, abs((vUv.x + vUv.y) - 1.16));
    float microSheen = (sin((vUv.x * 7.0 + vUv.y * 5.0) * 3.14159) * 0.5 + 0.5)
      * uWaterDistort * surface;

    col.rgb = mix(col.rgb, uWaterTint, clamp(uWaterTintMix * (0.08 + edge * 0.18), 0.0, 0.45));
    col.rgb *= 1.0 - edge * 0.08 * uFrameStrength;
    col.rgb += vec3(rim * 0.22 + topGloss * 0.10 + softDiagonal * 0.06 + microSheen * 0.08)
      * uFrameShine * uFrameStrength;

    float dim = mix(uSideDim, 1.0, uFade);
    col.rgb *= dim;
    col.a *= uFade * roundedRectMask(vUv, uCornerRadius, uAspect);
    gl_FragColor = col;
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
    height,
    imageBrightness,
    imageContrast,
    imageSaturation,
    invalidate,
    screenCornerRadius,
    uniforms,
    waterChromaticAberration,
    waterDistort,
    waterFrameShine,
    waterFrameStrength,
    waterFrameThickness,
    waterInnerDistort,
    waterTintB,
    waterTintG,
    waterTintMix,
    waterTintR,
    width,
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
