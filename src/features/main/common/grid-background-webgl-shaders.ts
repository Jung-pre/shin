/** 풀스크린 격자 — grid-background.module.css / GridBackground SVG 와 동일 합성 규칙 */

export const gridBackgroundVertexShader = /* glsl */ `
varying vec2 vUv;

void main() {
  vUv = uv;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
`;

export const gridBackgroundFragmentShader = /* glsl */ `
precision highp float;

uniform vec2 u_resolution;
uniform float u_width;
uniform float u_height;
uniform float u_current_ratio;
uniform float u_time;
uniform float u_nv_stops;
uniform float u_nh_stops;
uniform float u_reduced_motion;

varying vec2 vUv;

const float CURVE_DEPTH_PX = 192.0;
const float GRID_BASE_CURVE_STRENGTH = 0.5;
const float GRID_SCROLL_CURVE_STRENGTH = 0.94;

/* grid-background.module.css — .line stroke alpha × .lineLayer opacity */
const float LINE_STROKE_A = 0.34;
const float LINE_LAYER_A = 0.72;
const float LINE_BLEND_A = LINE_STROKE_A * LINE_LAYER_A;

/* .glowLayer opacity */
const float GLOW_LAYER_A = 0.9;

/* stroke-width: 1 — 중심 ±0.5, 얇게 보이도록 좁은 스무스스텝 */
const float LINE_HALF_PX = 0.5;
const float LINE_AA_PX = 0.30;

float clamp01(float v) {
  return clamp(v, 0.0, 1.0);
}

float seededNoise(float seed) {
  return fract(sin(seed * 12.9898) * 43758.5453);
}

float get_horizontal_curve_weight(float y_px, float height_px, float ratio) {
  float yNorm = clamp01(y_px / max(height_px, 1.0));
  float absRatio = abs(ratio);
  float easedRatio = pow(absRatio, 0.72);
  float idleWeight = (0.5 - yNorm) * 2.0 * GRID_BASE_CURVE_STRENGTH;
  float scrollWeight = ratio < 0.0
    ? (-yNorm * GRID_SCROLL_CURVE_STRENGTH)
    : ((1.0 - yNorm) * GRID_SCROLL_CURVE_STRENGTH);
  return idleWeight + (scrollWeight - idleWeight) * easedRatio;
}

float get_warped_y(float x_px, float y_px, float width_px, float height_px, float ratio) {
  float xNorm = (x_px / max(width_px, 1.0)) * 2.0 - 1.0;
  float arc = max(0.0, 1.0 - xNorm * xNorm);
  return y_px + arc * CURVE_DEPTH_PX * get_horizontal_curve_weight(y_px, height_px, ratio);
}

/* CSS linear-gradient(105deg, #936ec4 0%, #ba7b99 100%) 근사 */
vec3 grad_bg(vec2 uvDom) {
  vec3 c0 = vec3(147.0, 110.0, 196.0) / 255.0;
  vec3 c1 = vec3(186.0, 123.0, 153.0) / 255.0;
  vec2 dir = normalize(vec2(cos(radians(105.0)), sin(radians(105.0))));
  float t = dot(uvDom - 0.5, dir) + 0.5;
  return mix(c0, c1, clamp01(t));
}

/* @keyframes pulse — 구간 선형 보간 (타이밍 cubic-bezier 는 근사 생략) */
float pulse_keyframe_opacity(float ph01) {
  float u = clamp01(ph01);
  if (u <= 0.38) return mix(0.0, 0.06, u / 0.38);
  if (u <= 0.50) return mix(0.06, 0.38, (u - 0.38) / 0.12);
  if (u <= 0.62) return mix(0.38, 0.07, (u - 0.50) / 0.12);
  return mix(0.07, 0.0, (u - 0.62) / 0.38);
}

float sd_segment(vec2 p, vec2 a, vec2 b) {
  vec2 pa = p - a;
  vec2 ba = b - a;
  float h = clamp(dot(pa, ba) / max(dot(ba, ba), 1e-9), 0.0, 1.0);
  return length(pa - ba * h);
}

void main() {
  float sx = vUv.x * u_resolution.x;
  float sy = (1.0 - vUv.y) * u_resolution.y;

  vec3 bg = grad_bg(vUv);

  float num_h = max(u_nh_stops, 2.0);
  float num_v = max(u_nv_stops, 2.0);

  float cell_w = u_width / max(num_v - 1.0, 1.0);
  float cell_h = u_height / max(num_h - 1.0, 1.0);
  float nc = max(num_v - 1.0, 1.0);
  float nr = max(num_h - 1.0, 1.0);

  float d_grid = 1e9;

  for (int i = 0; i < 256; i++) {
    float fi = float(i);
    float active_h = 1.0 - step(num_h, fi);
    float y_stop = fi * u_height / max(num_h - 1.0, 1.0);
    float wy = get_warped_y(sx, y_stop, u_width, u_height, u_current_ratio);
    float dh_line = abs(sy - wy);
    d_grid = min(d_grid, mix(1e9, dh_line, active_h));
  }

  for (int j = 0; j < 256; j++) {
    float fj = float(j);
    float active_v = 1.0 - step(num_v, fj);
    float xf_stop = fj * u_width / max(num_v - 1.0, 1.0);
    float dv_line = abs(sx - xf_stop);
    d_grid = min(d_grid, mix(1e9, dv_line, active_v));
  }

  float line_cov = 1.0 - smoothstep(LINE_HALF_PX, LINE_HALF_PX + LINE_AA_PX, d_grid);

  float rowIdx = clamp(floor(sy / cell_h), 0.0, nr - 1.0);
  float colIdx = clamp(floor(sx / cell_w), 0.0, nc - 1.0);

  float glow_mix = 0.0;
  if (mod(rowIdx + colIdx, 2.0) < 0.5) {
    float k_cell = rowIdx * nc + colIdx;
    float delay_sec = seededNoise(k_cell + 1.0) * 7.0;
    float dur_sec = 3.6 + seededNoise(k_cell + 17.0) * 4.8;
    float alpha_fill = 0.34 + seededNoise(k_cell + 41.0) * 0.42;

    if (u_reduced_motion > 0.5) {
      glow_mix = alpha_fill * 0.04 * GLOW_LAYER_A;
    } else {
      float elapsed = u_time - delay_sec;
      float ph = 0.0;
      if (elapsed > 0.0) {
        ph = mod(elapsed, dur_sec) / max(dur_sec, 1e-6);
      }
      float anim_opacity = pulse_keyframe_opacity(ph);
      glow_mix = alpha_fill * anim_opacity * GLOW_LAYER_A;
    }
  }

  vec3 rgb = bg;
  rgb = mix(rgb, vec3(1.0), clamp01(glow_mix * 0.94));

  rgb = mix(rgb, vec3(1.0), LINE_BLEND_A * line_cov);

  float d_tick = 1e9;
  float nx_tick = floor((num_v - 1.0) / 2.0) + 1.0;
  float ny_tick = floor((num_h - 1.0) / 2.0) + 1.0;
  float total_ticks = nx_tick * ny_tick;

  for (int k = 0; k < 1024; k++) {
    float fk = float(k);
    float active_tick = 1.0 - step(total_ticks, fk);
    float ti_slot = floor(fk / max(ny_tick, 1e-6));
    float tj_slot = mod(fk, ny_tick);
    float jj = ti_slot * 2.0;
    float ii = tj_slot * 2.0;

    float xf = jj * u_width / max(num_v - 1.0, 1.0);
    float y_nom = ii * u_height / max(num_h - 1.0, 1.0);
    float wy = get_warped_y(xf, y_nom, u_width, u_height, u_current_ratio);

    vec2 p = vec2(sx, sy);
    float dh = sd_segment(p, vec2(xf - 5.0, wy), vec2(xf + 5.0, wy));
    float dv = sd_segment(p, vec2(xf, wy - 5.0), vec2(xf, wy + 5.0));
    float d_cross = min(dh, dv);
    d_tick = min(d_tick, mix(1e9, d_cross, active_tick));
  }

  /* 코너 십자는 .lineLayer 밖 — stroke #fff 만 (레이어 0.72 미적용) */
  float tick_cov = 1.0 - smoothstep(LINE_HALF_PX, LINE_HALF_PX + LINE_AA_PX, d_tick);
  rgb = mix(rgb, vec3(1.0), tick_cov);

  gl_FragColor = vec4(rgb, 1.0);
}
`;
