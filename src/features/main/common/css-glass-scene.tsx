"use client";

import { useEffect, useRef, type CSSProperties } from "react";
import styles from "./css-glass-scene.module.css";

/**
 * CSS `backdrop-filter` + SVG `feDisplacementMap` 기반 경량 글래스 씬.
 *
 * 3D `GlassOrbsScene` 과 동일한 뷰포트 위치·크기·렌즈 배치(circle + crescent) 를 유지하여
 * `.glassLayer` 안에 드롭인으로 치환된다.
 *
 * ── 구조 ──
 *   1. 숨은 `<svg>` defs — `feTurbulence` + `feDisplacementMap` 필터만 정의.
 *   2. 각 렌즈 wrap `<div>` — `-webkit-mask-image` 로 렌즈 실루엣을 깎아냄.
 *        · lens1(원): radial mask.
 *        · lens2(크레센트): inline SVG data-URI mask (Figma path 를 그대로 사용).
 *   3. wrap 안 레이어 스택 (뒤 → 앞):
 *        · `.backdrop` — backdrop-filter(blur + displacement + saturate) 로 뒷배경을 왜곡.
 *        · `.tint`     — 유리 자체의 옅은 자색/흰색 틴트.
 *        · `.caustic`  — "크리스탈" 느낌을 주는 내부 하이라이트/코스틱 (단색 배경에서도 존재감 유지).
 *        · `.edge`     — gradient stroke + inner shadow (Figma 원본 느낌 재현).
 *
 * ── 왜 caustic 가 필요한가 ──
 *   우리 배경은 flat 한 퍼플 그라데이션이라 단순 blur 만으론 글래스 존재감이 거의 0.
 *   3D MTM 은 HDR 환경 반사로 하이라이트가 자체적으로 생기지만 CSS 버전은 그게 없으므로
 *   pseudo-layer 로 "렌즈 안에 갇힌 빛" 을 그려넣어야 크리스탈처럼 보인다.
 *
 * ── API 호환 ──
 *   3D 씬의 `onFirstFrameReady` 와 동일 prop 만 노출 → main-page 의 크로스페이드 /
 *   `isGlassOrbsReady` / `SvgGlassOverlay` 핸드오프 로직 변경 없이 치환 가능.
 */
export interface CssGlassSceneProps {
  /** 3D 씬의 onFirstFrameReady 와 동일 시그니처. 마운트 후 한 프레임 뒤에 호출. */
  onFirstFrameReady?: () => void;
}

/** SVG 오버레이 DEFAULT_LENS*_CONFIG 와 동일 — 두 글래스 간 위치가 포개지게. */
const LENS1_DIAMETER_REM = 31.1;
const LENS2_WIDTH_REM = 24.42;
const LENS2_HEIGHT_REM = 31.1;
const LENS1_OFFSET_X_REM = 2.6;
const LENS2_OFFSET_X_REM = -3.25;

const lens1Style: CSSProperties = {
  width: `${LENS1_DIAMETER_REM}rem`,
  height: `${LENS1_DIAMETER_REM}rem`,
  transform: `translate(${LENS1_OFFSET_X_REM}rem, 0)`,
};

const lens2Style: CSSProperties = {
  width: `${LENS2_WIDTH_REM}rem`,
  height: `${LENS2_HEIGHT_REM}rem`,
  transform: `translate(${LENS2_OFFSET_X_REM}rem, 0)`,
};

export const CssGlassScene = ({ onFirstFrameReady }: CssGlassSceneProps) => {
  const firedRef = useRef(false);

  useEffect(() => {
    if (firedRef.current) return;
    const rafId = requestAnimationFrame(() => {
      firedRef.current = true;
      onFirstFrameReady?.();
    });
    return () => cancelAnimationFrame(rafId);
  }, [onFirstFrameReady]);

  return (
    <div className={styles.scene} aria-hidden>
      {/* 숨은 SVG defs — displacement 필터. 레이아웃 차지 0. */}
      <svg
        className={styles.defs}
        xmlns="http://www.w3.org/2000/svg"
        width="0"
        height="0"
        aria-hidden
        focusable="false"
      >
        <defs>
          {/*
           * feTurbulence(fractalNoise) → feDisplacementMap:
           *   baseFrequency 가 낮을수록 부드러운 장파장 왜곡, scale 이 클수록 왜곡량 증가.
           *   너무 크면 멀미나는 물결이 되므로 24 px 수준이 balance.
           */}
          <filter id="css-lens-refract" x="-10%" y="-10%" width="120%" height="120%">
            <feTurbulence
              type="fractalNoise"
              baseFrequency="0.008 0.012"
              numOctaves="2"
              seed="9"
              stitchTiles="stitch"
              result="turb"
            />
            <feGaussianBlur in="turb" stdDeviation="1.2" result="turbBlur" />
            <feDisplacementMap
              in="SourceGraphic"
              in2="turbBlur"
              scale="24"
              xChannelSelector="R"
              yChannelSelector="G"
            />
          </filter>
        </defs>
      </svg>

      <div className={styles.lensGroup}>
        {/*
         * Lens 1 — 원형 글래스.
         *   wrap: border-radius: 50% + overflow: hidden 으로 실루엣 잘라냄 (원은 mask 불필요).
         *   backdrop/tint/caustic/edge 4 레이어를 inset:0 으로 포갬.
         */}
        <div className={`${styles.lensWrap} ${styles.lens1Wrap}`} style={lens1Style}>
          <div className={styles.backdrop} />
          <div className={styles.tint} />
          <div className={styles.caustic} />
          <div className={styles.edge} />
        </div>

        {/*
         * Lens 2 — 크레센트 글래스.
         *   wrap: `mask-image` (data-URI SVG) 로 path 실루엣을 그대로 깎음.
         *   나머지 레이어 구조는 lens1 과 동일.
         */}
        <div className={`${styles.lensWrap} ${styles.lens2Wrap}`} style={lens2Style}>
          <div className={styles.backdrop} />
          <div className={styles.tint} />
          <div className={styles.caustic} />
          <div className={styles.edge} />
        </div>
      </div>
    </div>
  );
};
