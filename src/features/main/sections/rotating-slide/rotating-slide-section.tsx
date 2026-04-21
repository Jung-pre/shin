"use client";

import Image from "next/image";
import { useLayoutEffect, useRef, useState } from "react";
import type { CSSProperties } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import styles from "./rotating-slide-section.module.css";

gsap.registerPlugin(ScrollTrigger);

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

const ROTATING_TUNE = {
  tiltX: 0,
  tiltY: 0,
  trackTopRem: 23,
  radiusVw: 65,
  spacingFactor: 0.45,
  sideCurveBoost: 8.05,
  stairStrength: 3,
} as const;

export function RotatingSlideSection() {
  const sectionRef = useRef<HTMLElement>(null);
  const pinRef = useRef<HTMLDivElement>(null);
  const [rotationProgress, setRotationProgress] = useState(0);
  const reduceMotion = useReducedMotion();

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

    return () => {
      st.kill();
    };
  }, []);

  const activeIndex = clamp(Math.floor(rotationProgress * ROTATION_SLIDES_COUNT), 0, ROTATION_SLIDES_COUNT - 1);
  const activeSlide = ROTATION_SLIDES[clamp(activeIndex, 0, ROTATION_SLIDES_COUNT - 1)];
  const rotationDeg =
    rotationProgress * (ROTATION_SLIDES_COUNT - 1) * CYLINDER_STEP_DEG * ROTATING_TUNE.spacingFactor;
  const trackStyle = {
    top: `${ROTATING_TUNE.trackTopRem}rem`,
    transform: `translateX(-50%) rotateX(${ROTATING_TUNE.tiltX}deg) rotateY(${ROTATING_TUNE.tiltY}deg) translateY(-0.2rem)`,
  } as CSSProperties;
  const cylinderStyle = {
    "--slide-radius": `min(${ROTATING_TUNE.radiusVw}vw, 60rem)`,
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
                const baseAngle = index * CYLINDER_STEP_DEG * ROTATING_TUNE.spacingFactor;
                const angle = normalizeDegrees(baseAngle - rotationDeg);
                const frontHalfVisible = Math.abs(angle) <= 90;
                const visible = frontHalfVisible ? clamp(1 - Math.abs(angle) / 98, 0, 1) : 0;
                const diagonalRatio = clamp(angle / 90, -1, 1);
                const diagonalStrength = Math.pow(Math.abs(diagonalRatio), 1.12);
                const diagonalDirection = Math.sign(diagonalRatio);
                const diagonalShiftX = diagonalDirection * diagonalStrength * 86 * ROTATING_TUNE.stairStrength;
                const diagonalShiftY = diagonalDirection * diagonalStrength * 112 * ROTATING_TUNE.stairStrength;
                const sideCurveAmount = Math.pow(Math.abs(diagonalRatio), 1.05);
                // boost가 1을 넘어도 방향이 뒤집히지 않도록 감쇠식으로 계산
                const counterYaw = -angle / (1 + sideCurveAmount * ROTATING_TUNE.sideCurveBoost);
                const style = {
                  opacity: frontHalfVisible ? 0.16 + visible * 0.84 : 0,
                  filter: `blur(${(1 - visible) * 1.65}px)`,
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

        <div className={styles.copy}>
          <AnimatePresence initial={false} mode="wait">
            <motion.div
              key={activeSlide.lineEn}
              className={styles.copyStack}
              initial={
                reduceMotion
                  ? { opacity: 0 }
                  : { opacity: 0, y: 10, filter: "blur(4px)" }
              }
              animate={
                reduceMotion
                  ? { opacity: 1 }
                  : { opacity: 1, y: 0, filter: "blur(0px)" }
              }
              exit={
                reduceMotion
                  ? { opacity: 0 }
                  : { opacity: 0, y: -8, filter: "blur(3px)" }
              }
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
