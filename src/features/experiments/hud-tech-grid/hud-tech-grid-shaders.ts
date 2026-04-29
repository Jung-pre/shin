export const hudTechVertexShader = /* glsl */ `
varying vec2 vUv;

void main() {
  vUv = uv;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
`;

/**
 * UV → 픽셀 좌표 (좌상단 원점). 미세 격자 + 메이저 교차 플러스 + 해시 기반 셀 글로우.
 */
export const hudTechFragmentShader = /* glsl */ `
precision highp float;

uniform vec2 u_resolution;
uniform float u_time;
uniform float u_cell_px;
uniform float u_major_step;
uniform float u_warp;

varying vec2 vUv;

float hash21(vec2 p) {
  return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453123);
}

vec3 bg_gradient(vec2 uv01) {
  vec3 L = vec3(150.0, 130.0, 200.0) / 255.0;
  vec3 R = vec3(190.0, 150.0, 170.0) / 255.0;
  float t = uv01.x * 0.62 + uv01.y * 0.38;
  return mix(L, R, clamp(t, 0.0, 1.0));
}

float sd_segment(vec2 p, vec2 a, vec2 b) {
  vec2 pa = p - a;
  vec2 ba = b - a;
  float h = clamp(dot(pa, ba) / max(dot(ba, ba), 1e-9), 0.0, 1.0);
  return length(pa - ba * h);
}

void main() {
  vec2 uv01 = vUv;
  vec2 pix = vec2(uv01.x * u_resolution.x, (1.0 - uv01.y) * u_resolution.y);

  float nx = pix.x / max(u_resolution.x, 1.0) * 2.0 - 1.0;
  float arc = max(0.0, 1.0 - nx * nx);
  float yn = pix.y / max(u_resolution.y, 1.0);
  pix.y += arc * u_warp * 160.0 * (0.48 - yn);

  vec3 rgb = bg_gradient(uv01);

  float cell = max(u_cell_px, 4.0);
  vec2 cid = floor(pix / cell);
  vec2 cellUv = fract(pix / cell);

  float dv = min(cellUv.x, 1.0 - cellUv.x) * cell;
  float dh = min(cellUv.y, 1.0 - cellUv.y) * cell;
  float dLine = min(dv, dh);

  float lineW = 1.15;
  float lineAlpha = (1.0 - smoothstep(0.0, lineW + 0.9, dLine)) * 0.26;
  rgb = mix(rgb, vec3(1.0), lineAlpha);

  float K = max(u_major_step, 1.0);
  float majorSpan = cell * K;
  vec2 ij = pix / max(majorSpan, 1.0);
  vec2 nearestIx = floor(ij + vec2(0.5));
  vec2 interPx = nearestIx * majorSpan;
  vec2 o = pix - interPx;
  float arm = 5.0;
  float dPH = sd_segment(o, vec2(-arm, 0.0), vec2(arm, 0.0));
  float dPV = sd_segment(o, vec2(0.0, -arm), vec2(0.0, arm));
  float dPlus = min(dPH, dPV);
  float plusA = (1.0 - smoothstep(0.0, 1.05, dPlus)) * 0.92;
  rgb = mix(rgb, vec3(1.0), plusA);

  float h1 = hash21(cid + 13.7);
  float h2 = hash21(cid + vec2(91.0, 41.0));
  float spawn = step(0.86, h1);
  float glowGain = 0.055 + h2 * 0.09;
  float edgeFade =
    smoothstep(0.0, 0.12, cellUv.x) *
    smoothstep(1.0, 0.88, cellUv.x) *
    smoothstep(0.0, 0.12, cellUv.y) *
    smoothstep(1.0, 0.88, cellUv.y);
  float pulse = 0.92 + 0.08 * sin(u_time * 1.4 + h2 * 12.56);
  float glow = spawn * glowGain * edgeFade * pulse;
  vec3 glowRgb = mix(rgb, rgb * 1.08 + vec3(0.035), clamp(glow * 3.2, 0.0, 0.55));

  rgb = glowRgb;

  gl_FragColor = vec4(rgb, 1.0);
}
`;
