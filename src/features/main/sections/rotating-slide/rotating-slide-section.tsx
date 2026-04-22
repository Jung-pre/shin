"use client";

import Image from "next/image";
import { useLayoutEffect, useRef, useState } from "react";
import type { CSSProperties } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import styles from "./rotating-slide-section.module.css";

gsap.registerPlugin(ScrollTrigger);

/**
 * dev 튜닝용 회전 슬라이드 파라미터 패널 노출 스위치.
 *   - false: tune state 는 유지(슬라이드 곡률·간격 등 실시간 계산에 그대로 사용),
 *     UI(▼튜닝 토글 + 슬라이더 리스트) 만 렌더 스킵.
 *   - true: 우측 하단 플로팅 패널 노출.
 */
const SHOW_ROTATING_TUNE_PANEL = false;

const ROTATION_SLIDES = [
  {
    imageSrc: "/main/img_main_slide01.png",
    lineEn: "Smile & Lasik",
    lineKo: "신세계 시력교정",
    lineDesc: "안경 없는 자유, 스마일로 완성하세요",
  },
  {
    imageSrc: "/main/img_main_slide02.png",
    lineEn: "Prebyopia & Cataract",
    lineKo: "신세계 노안·백내장",
    lineDesc: "제2의 청춘, 선명함을 되찾아 드립니다",
  },
  {
    imageSrc: "/main/img_main_slide03.png",
    lineEn: "Eye Diseases",
    lineKo: "신세계 안질환",
    lineDesc: "더 건강한 눈, 더 선명한 세상을 위해, 최선의 치료를 약속합니다.",
  },
  {
    imageSrc: "/main/img_main_slide04.png",
    lineEn: "Chief Physician",
    lineKo: "김재봉 대표원장",
    lineDesc: "외안부 · 시력교정 · 백내장 안과전문의",
  },
  {
    imageSrc: "/main/img_main_slide05.png",
    lineEn: "Patient Stories",
    lineKo: "신세계 고객 후기",
    lineDesc: "더 선명한 내일을 찾으신 고객님들의 솔직한 이야기",
  },
] as const;

const ROTATION_SLIDES_COUNT = ROTATION_SLIDES.length;
const CYLINDER_STEP_DEG = 360 / ROTATION_SLIDES_COUNT;

const clamp = (value: number, min: number, max: number) => {
  return Math.min(max, Math.max(min, value));
};

const normalizeDegrees = (value: number) => {
  const wrapped = ((value + 180) % 360 + 360) % 360 - 180;
  return wrapped;
};

const TEXT_TRANSITION = {
  duration: 0.46,
  ease: [0.22, 1, 0.36, 1] as const,
};

const GNB_HEIGHT_PX = 92;
const PERSPECTIVE_PX = 1900;
const PERSPECTIVE_ORIGIN_Y = 0.42; // 42%

const ROTATING_TUNE_DEFAULT = {
  tiltX: 0,
  tiltY: 0,
  trackOffsetRem: 0,
  radiusVw: 40,
  spacingFactor: 0.53,
  sideCurveBoost: 20,
  stairStrength: 3,
};

type Tune = typeof ROTATING_TUNE_DEFAULT;

export function RotatingSlideSection() {
  const sectionRef = useRef<HTMLElement>(null);
  const pinRef = useRef<HTMLDivElement>(null);
  const [rotationProgress, setRotationProgress] = useState(0);
  const [tune, setTune] = useState<Tune>(ROTATING_TUNE_DEFAULT);
  const [showPanel, setShowPanel] = useState(false);
  const [autoOffsetRem, setAutoOffsetRem] = useState(0);
  const reduceMotion = useReducedMotion();

  const set = (key: keyof Tune, val: number) =>
    setTune((prev) => ({ ...prev, [key]: val }));

  // GNB 높이 + perspective 왜곡을 보정해 카드를 시각적 중앙에 배치
  useLayoutEffect(() => {
    const compute = () => {
      const vh = window.innerHeight;
      const vw = window.innerWidth;
      const radiusPx = Math.min(vw * (tune.radiusVw / 100), 60 * 16);
      const scale = PERSPECTIVE_PX / (PERSPECTIVE_PX - radiusPx);
      const originY = PERSPECTIVE_ORIGIN_Y * vh;
      // GNB 아래 사용 가능한 영역의 시각적 중앙
      const visualCenterY = GNB_HEIGHT_PX + (vh - GNB_HEIGHT_PX) / 2;
      // scene top: 50% 기준 카드 중앙 = sceneCenterY + offsetPx
      // 원근 투영 후 화면 Y: originY + (cssY - originY) * scale = visualCenterY
      const sceneCenterY = vh / 2;
      const offsetPx =
        (visualCenterY - originY) / scale + originY - sceneCenterY;
      setAutoOffsetRem(offsetPx / 16);
    };
    compute();
    window.addEventListener("resize", compute);
    return () => window.removeEventListener("resize", compute);
  }, [tune.radiusVw]);

  useLayoutEffect(() => {
    const section = sectionRef.current;
    const pinEl = pinRef.current;
    if (!section || !pinEl) {
      return;
    }

    const st = ScrollTrigger.create({
      trigger: section,
      start: "top top",
      end: "bottom bottom",
      pin: pinEl,
      pinSpacing: true,
      anticipatePin: 1,
      invalidateOnRefresh: true,
      onUpdate: (self) => {
        setRotationProgress(self.progress);
      },
    });

    // pin 종료 후 pinShell 페이드 아웃
    const fadeOut = gsap.fromTo(
      pinEl,
      { autoAlpha: 1 },
      {
        autoAlpha: 0,
        ease: "none",
        scrollTrigger: {
          trigger: section,
          start: "bottom bottom",
          end: "bottom 30%",
          scrub: 1,
        },
      },
    );

    return () => {
      st.kill();
      fadeOut.kill();
    };
  }, []);

  const activeIndex = clamp(Math.floor(rotationProgress * ROTATION_SLIDES_COUNT), 0, ROTATION_SLIDES_COUNT - 1);
  const activeSlide = ROTATION_SLIDES[clamp(activeIndex, 0, ROTATION_SLIDES_COUNT - 1)];
  const rotationDeg =
    rotationProgress * (ROTATION_SLIDES_COUNT - 1) * CYLINDER_STEP_DEG * tune.spacingFactor;
  const totalOffsetRem = autoOffsetRem + tune.trackOffsetRem;
  const trackStyle = {
    top: "50%",
    transform: `translateX(-50%) translateY(calc(-50% + ${totalOffsetRem}rem)) rotateX(${tune.tiltX}deg) rotateY(${tune.tiltY}deg)`,
  } as CSSProperties;
  const cylinderStyle = {
    "--slide-radius": `min(${tune.radiusVw}vw, 60rem)`,
  } as CSSProperties;

  return (
    <section
      ref={sectionRef}
      className={styles.section}
      style={{ height: `${ROTATION_SLIDES_COUNT * 100}vh` }}
      aria-label="Clinic rotating highlights"
    >
      <div ref={pinRef} className={styles.pinShell}>
        <div className={styles.scene}>
          <div className={styles.cylinderTrack} style={trackStyle}>
            <div className={styles.cylinder} style={cylinderStyle}>
              {ROTATION_SLIDES.map((slide, index) => {
                const baseAngle = index * CYLINDER_STEP_DEG * tune.spacingFactor;
                const angle = normalizeDegrees(baseAngle - rotationDeg);
                const frontHalfVisible = Math.abs(angle) <= 90;
                const visible = frontHalfVisible ? clamp(1 - Math.abs(angle) / 98, 0, 1) : 0;
                const diagonalRatio = clamp(angle / 90, -1, 1);
                const diagonalStrength = Math.pow(Math.abs(diagonalRatio), 1.12);
                const diagonalDirection = Math.sign(diagonalRatio);
                const diagonalShiftX = diagonalDirection * diagonalStrength * 86 * tune.stairStrength;
                const diagonalShiftY = diagonalDirection * diagonalStrength * 112 * tune.stairStrength;
                const sideCurveAmount = Math.pow(Math.abs(diagonalRatio), 1.05);
                const counterYaw = -angle / (1 + sideCurveAmount * tune.sideCurveBoost);
                // 블러는 렌더마다 GPU 필터 재계산이라 스크롤 프레임 부하 큼 — opacity / zIndex 로 원근감만 유지.
                const style = {
                  opacity: frontHalfVisible ? 0.16 + visible * 0.84 : 0,
                  zIndex: frontHalfVisible ? Math.round(10 + visible * 90) : 0,
                  // 원통 위치는 유지하되 카드 면은 카메라 정면으로 역회전시켜 항상 '평면'처럼 보이게
                  transform: `translate(-50%, -50%) rotateY(${angle}deg) translateZ(var(--slide-radius)) rotateY(${counterYaw}deg) translate3d(${diagonalShiftX}px, ${diagonalShiftY}px, 0)`,
                  visibility: frontHalfVisible ? "visible" : "hidden",
                } as CSSProperties;

                return (
                  <article
                    key={slide.imageSrc}
                    className={styles.card}
                    style={style}
                    aria-hidden={!frontHalfVisible || visible < 0.06}
                    suppressHydrationWarning
                  >
                    <Image
                      src={slide.imageSrc}
                      alt={slide.lineEn}
                      fill
                      sizes="(max-width: 900px) 72vw, 32rem"
                      quality={100}
                      className={styles.cardImage}
                      priority={index < 2}
                    />
                  </article>
                );
              })}
            </div>
          </div>
        </div>

        {SHOW_ROTATING_TUNE_PANEL && (
          <div className={styles.controlWrap}>
            <button
              type="button"
              className={styles.controlToggle}
              onClick={() => setShowPanel((v) => !v)}
            >
              {showPanel ? "▲ 닫기" : "▼ 튜닝"}
            </button>
            {showPanel && (
              <div className={styles.controlPanel}>
                {(
                  [
                    { key: "sideCurveBoost", label: "사이드 회전량", min: 0, max: 20, step: 0.05 },
                    { key: "stairStrength",  label: "계단 강도",     min: 0, max: 5,  step: 0.05 },
                    { key: "radiusVw",       label: "반경 (vw)",     min: 5, max: 60, step: 0.5  },
                    { key: "spacingFactor",  label: "간격 배수",     min: 0.1, max: 1, step: 0.01 },
                    { key: "trackOffsetRem", label: "수직 오프셋 (rem)", min: -20, max: 20, step: 0.25 },
                    { key: "tiltX",          label: "틸트 X (deg)",  min: -30, max: 30, step: 0.5 },
                    { key: "tiltY",          label: "틸트 Y (deg)",  min: -30, max: 30, step: 0.5 },
                  ] as const
                ).map(({ key, label, min, max, step }) => (
                  <div key={key} className={styles.controlRow}>
                    <span>{label}: {tune[key]}</span>
                    <input
                      type="range"
                      min={min}
                      max={max}
                      step={step}
                      value={tune[key]}
                      onChange={(e) => set(key, parseFloat(e.target.value))}
                    />
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        <div className={styles.copy}>
          <AnimatePresence initial={false} mode="wait">
            <motion.div
              key={activeSlide.lineEn}
              className={styles.copyStack}
              initial={reduceMotion ? { opacity: 0 } : { opacity: 0, y: 10 }}
              animate={reduceMotion ? { opacity: 1 } : { opacity: 1, y: 0 }}
              exit={reduceMotion ? { opacity: 0 } : { opacity: 0, y: -8 }}
              transition={reduceMotion ? { duration: 0.2 } : TEXT_TRANSITION}
            >
              <p className={styles.lineEn} lang="en">
                {activeSlide.lineEn}
              </p>
              <p className={styles.lineKo}>{activeSlide.lineKo}</p>
              <p className={styles.lineDesc}>{activeSlide.lineDesc}</p>
            </motion.div>
          </AnimatePresence>
        </div>
      </div>
    </section>
  );
}
