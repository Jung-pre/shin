"use client";

import dynamic from "next/dynamic";
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import styles from "./rotating-slide-section.module.css";
import type { CylinderSlide } from "./cylinder-slide-canvas";
import {
  RotatingSlideTuningPanel,
  useRotatingSlideTuning,
} from "./tuning-panel";

gsap.registerPlugin(ScrollTrigger);

/**
 * 원통 회전 3D Canvas.
 *   - R3F / three 번들을 초기에 싣지 않도록 `next/dynamic` 으로 코드 스플릿.
 *   - `ssr: false` — Canvas 는 클라이언트에서만 구동.
 */
const CylinderSlideCanvas = dynamic(
  () =>
    import("./cylinder-slide-canvas").then((m) => m.CylinderSlideCanvas),
  { ssr: false },
);

/**
 * 튜닝 패널 노출 여부 — dev / 쿼리스트링(?tune=1) 에서만 표시.
 *   - 배포 환경에서 기본적으로 꺼져 있어 일반 사용자는 보지 못함.
 *   - 필요 시 기획자에게 URL 공유: `?tune=1`.
 */
/** 튜닝 패널 — 현재 히든. 다시 켜려면 return true 로 변경. */
function useTunerVisible() {
  return false;
}

const ROTATION_SLIDES: readonly (CylinderSlide & {
  lineEn: string;
  lineKo: string;
  lineDesc: string;
})[] = [
  {
    imageSrc: "/main/img_main_slide01.png",
    label: "Smile & Lasik",
    lineEn: "Smile & Lasik",
    lineKo: "신세계 시력교정",
    lineDesc: "안경 없는 자유, 스마일로 완성하세요",
  },
  {
    imageSrc: "/main/img_main_slide02.png",
    label: "Prebyopia & Cataract",
    lineEn: "Prebyopia & Cataract",
    lineKo: "신세계 노안·백내장",
    lineDesc: "제2의 청춘, 선명함을 되찾아 드립니다",
  },
  {
    imageSrc: "/main/img_main_slide03.png",
    label: "Eye Diseases",
    lineEn: "Eye Diseases",
    lineKo: "신세계 안질환",
    lineDesc: "더 건강한 눈, 더 선명한 세상을 위해, 최선의 치료를 약속합니다.",
  },
  {
    imageSrc: "/main/img_main_slide04.png",
    label: "Chief Physician",
    lineEn: "Chief Physician",
    lineKo: "김재봉 대표원장",
    lineDesc: "외안부 · 시력교정 · 백내장 안과전문의",
  },
  {
    imageSrc: "/main/img_main_slide05.png",
    label: "Patient Stories",
    lineEn: "Patient Stories",
    lineKo: "신세계 고객 후기",
    lineDesc: "더 선명한 내일을 찾으신 고객님들의 솔직한 이야기",
  },
] as const;

const ROTATION_SLIDES_COUNT = ROTATION_SLIDES.length;

const clamp = (value: number, min: number, max: number) => {
  return Math.min(max, Math.max(min, value));
};

const TEXT_TRANSITION = {
  duration: 0.46,
  ease: [0.22, 1, 0.36, 1] as const,
};

export function RotatingSlideSection() {
  const sectionRef = useRef<HTMLElement>(null);
  const pinRef = useRef<HTMLDivElement>(null);

  // progress 는 ref + state 투트랙:
  //   - ref: 매 프레임 Canvas 내부 useFrame 이 읽어가는 최신값 (React 리렌더 없이 동기화).
  //   - state: 텍스트 패널(DOM) 의 activeIndex 계산용. 카드 경계 넘어갈 때만 갱신.
  const progressRef = useRef(0);
  const [activeIndex, setActiveIndex] = useState(0);

  // 섹션 가시성 — 밖에 있을 때 Canvas 프레임 정지.
  const [isActive, setIsActive] = useState(false);

  const reduceMotion = useReducedMotion();

  // 튜닝 파라미터 (원통 크기/카메라/페이드 등). localStorage 로 영속.
  const { tuning, update, reset } = useRotatingSlideTuning();
  const tunerVisible = useTunerVisible();

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
        progressRef.current = self.progress;
        const idx = clamp(
          Math.floor(self.progress * ROTATION_SLIDES_COUNT),
          0,
          ROTATION_SLIDES_COUNT - 1,
        );
        setActiveIndex((prev) => (prev === idx ? prev : idx));
      },
    });

    // pin 종료 후 pinShell 페이드 아웃 (기존 동작 유지)
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

  // 섹션 가시성 감지 — 뷰포트에 진입·퇴장 시 isActive 토글.
  //   - rootMargin 을 100vh 양쪽으로 확장해 진입 직전에 Canvas 가 준비되도록 워밍업.
  useEffect(() => {
    const section = sectionRef.current;
    if (!section) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        setIsActive(entry.isIntersecting);
      },
      {
        root: null,
        rootMargin: "100% 0% 100% 0%",
        threshold: 0,
      },
    );
    observer.observe(section);
    return () => observer.disconnect();
  }, []);

  const activeSlide = ROTATION_SLIDES[clamp(activeIndex, 0, ROTATION_SLIDES_COUNT - 1)];

  return (
    <section
      ref={sectionRef}
      className={styles.section}
      style={{
        height: `${ROTATION_SLIDES_COUNT * 100}vh`,
        ["--slide-vignette"         as string]: `${tuning.vignetteWidth}%`,
        ["--slide-vignette-y"       as string]: `${tuning.vignetteHeight}%`,
        ["--slide-vignette-opacity" as string]: String(tuning.vignetteOpacity),
        ["--slide-section-bg"       as string]: `rgb(${Math.round(tuning.vignetteBgR)},${Math.round(tuning.vignetteBgG)},${Math.round(tuning.vignetteBgB)})`,
      }}
      aria-label="Clinic rotating highlights"
    >
      <div ref={pinRef} className={styles.pinShell}>
        <div className={styles.canvasWrap}>
          <CylinderSlideCanvas
            slides={ROTATION_SLIDES}
            progressRef={progressRef}
            isActive={isActive}
            spacingFactor={tuning.spacingFactor}
            radius={tuning.radius}
            cardWidth={tuning.cardWidth}
            cardHeight={tuning.cardHeight}
            bendAmount={tuning.bendAmount}
            cameraZ={tuning.cameraZ}
            fov={tuning.fov}
            fadeCutoffDeg={tuning.fadeCutoffDeg}
            sideDim={tuning.sideDim}
            cylinderTiltDeg={tuning.cylinderTiltDeg}
            cardYStep={tuning.cardYStep}
          />
        </div>

        {/* 좌우 소프트 딤 오버레이 — 배경색(--slide-section-bg)으로 자연스럽게 스며듦 */}
        <div className={styles.vignette} aria-hidden />

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

      {tunerVisible ? (
        <RotatingSlideTuningPanel
          tuning={tuning}
          onChange={update}
          onReset={reset}
          activeIndex={activeIndex}
        />
      ) : null}
    </section>
  );
}
