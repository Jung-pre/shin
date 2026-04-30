"use client";

import dynamic from "next/dynamic";
import {
  forwardRef,
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type MutableRefObject,
} from "react";
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

/** 아크릴 액자 전용 레이어 팝업 — 전체 회전 슬라이드 튜너를 쓸 때는 숨김 */
function useAcrylicLayerVisible() {
  return false;
}

const ROTATION_SLIDES: readonly (CylinderSlide & {
  lineEn: string;
  lineKo: string;
  lineDesc: string;
})[] = [
  {
    imageSrc: "/main/img_main_slide01.webp",
    label: "Smile & Lasik",
    lineEn: "Smile & Lasik",
    lineKo: "신세계 시력교정",
    lineDesc: "안경 없는 자유, 스마일로 완성하세요",
  },
  {
    imageSrc: "/main/img_main_slide02.webp",
    label: "Prebyopia & Cataract",
    lineEn: "Prebyopia & Cataract",
    lineKo: "신세계 노안·백내장",
    lineDesc: "제2의 청춘, 선명함을 되찾아 드립니다",
  },
  {
    imageSrc: "/main/img_main_slide03.webp",
    label: "Eye Diseases",
    lineEn: "Eye Diseases",
    lineKo: "신세계 안질환",
    lineDesc: "더 건강한 눈, 더 선명한 세상을 위해, 최선의 치료를 약속합니다.",
  },
  {
    imageSrc: "/main/img_main_slide04.webp",
    label: "Chief Physician",
    lineEn: "Chief Physician",
    lineKo: "김재봉 대표원장",
    lineDesc: "외안부 · 시력교정 · 백내장 안과전문의",
  },
  {
    imageSrc: "/main/img_main_slide05.webp",
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

/** 슬라이드 i 에서 각도 고정으로 머무는 스크롤량(vh) */
const HOLD_VH = 85;
/** i→i+1 전환 구간(vh). 이 스크롤 구간에서 회전을 부드럽게 보간 */
const TRIGGER_VH = 28;

/** 총 높이 = (N-1)×(홀드+트리거) + 마지막 홀드 */
const SECTION_VH =
  (ROTATION_SLIDES_COUNT - 1) * (HOLD_VH + TRIGGER_VH) + HOLD_VH;

/** 각 슬라이드 홀드 중앙 progress 값 */
function buildHoldCenters(): number[] {
  const n = ROTATION_SLIDES_COUNT;
  const total = SECTION_VH;
  const pts: number[] = [];
  let pos = 0;
  for (let i = 0; i < n; i++) {
    pts.push((pos + HOLD_VH / 2) / total);
    if (i < n - 1) pos += HOLD_VH + TRIGGER_VH;
  }
  return pts;
}

const HOLD_CENTERS = buildHoldCenters();

/**
 * 홀드 구간: 스냅 없이 현재 위치 유지 (스크롤이 그냥 끌고 감).
 * 트리거 구간: 스크롤 방향에 따라 다음/이전 슬라이드로 완성.
 */
function snapToNearestHold(
  progress: number,
  direction: 1 | -1,
): number {
  const total = SECTION_VH;
  const u = clamp(progress, 0, 1) * total;
  let pos = 0;

  for (let i = 0; i < ROTATION_SLIDES_COUNT - 1; i++) {
    const holdEnd = pos + HOLD_VH;

    if (u < holdEnd) {
      return progress;
    }
    if (u < holdEnd + TRIGGER_VH) {
      return direction === 1
        ? HOLD_CENTERS[i + 1]
        : HOLD_CENTERS[i];
    }
    pos += HOLD_VH + TRIGGER_VH;
  }

  return progress;
}

/**
 * 스크롤 progress → 현재 활성 슬라이드 인덱스.
 * 홀드 구간: 해당 슬라이드.
 * 트리거 구간: 절반 넘으면 다음 슬라이드.
 */
function getActiveIndex(progress: number): number {
  const total = SECTION_VH;
  const u = clamp(progress, 0, 1) * total;
  let pos = 0;

  for (let i = 0; i < ROTATION_SLIDES_COUNT - 1; i++) {
    const holdEnd = pos + HOLD_VH;

    if (u < holdEnd) return i;
    if (u < holdEnd + TRIGGER_VH) {
      const mid = holdEnd + TRIGGER_VH / 2;
      return u < mid ? i : i + 1;
    }
    pos += HOLD_VH + TRIGGER_VH;
  }

  return ROTATION_SLIDES_COUNT - 1;
}

const TEXT_TRANSITION = {
  duration: 0.46,
  ease: [0.22, 1, 0.36, 1] as const,
};

export const RotatingSlideSection = forwardRef<HTMLElement, object>(function RotatingSlideSection(
  _props,
  forwardedRef,
) {
  const sectionRef = useRef<HTMLElement | null>(null);
  const setSectionRef = useCallback(
    (node: HTMLElement | null) => {
      sectionRef.current = node;
      if (typeof forwardedRef === "function") {
        forwardedRef(node);
      } else if (forwardedRef) {
        (forwardedRef as MutableRefObject<HTMLElement | null>).current = node;
      }
    },
    [forwardedRef],
  );
  const pinRef = useRef<HTMLDivElement>(null);

  const progressRef = useRef(0);
  const [activeIndex, setActiveIndex] = useState(0);
  const prevIndexRef = useRef(0);
  const rotTweenRef = useRef<gsap.core.Tween | null>(null);

  const [isActive, setIsActive] = useState(false);

  const reduceMotion = useReducedMotion();

  const scrollDirRef = useRef<1 | -1>(1);

  // 튜닝 파라미터 (원통 크기/카메라/페이드 등). localStorage 로 영속.
  const { tuning, update, reset } = useRotatingSlideTuning();
  const tunerVisible = useTunerVisible();
  const acrylicLayerVisible = useAcrylicLayerVisible();

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
      ...(reduceMotion
        ? {}
        : {
            snap: {
              snapTo: (val: number) =>
                snapToNearestHold(val, scrollDirRef.current),
              duration: 0.4,
              ease: "power3.out",
              inertia: false,
              delay: 0,
            },
          }),
      onUpdate: (self) => {
        scrollDirRef.current = self.direction as 1 | -1;

        const idx = getActiveIndex(self.progress);

        if (idx !== prevIndexRef.current) {
          prevIndexRef.current = idx;
          setActiveIndex(idx);

          const target = idx / (ROTATION_SLIDES_COUNT - 1);
          rotTweenRef.current?.kill();
          rotTweenRef.current = gsap.to(progressRef, {
            current: target,
            duration: 0.9,
            ease: "power2.out",
            overwrite: true,
          });
        }
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
      rotTweenRef.current?.kill();
    };
  }, [reduceMotion]);

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
      ref={setSectionRef}
      className={styles.section}
      style={{
        height: `${SECTION_VH}vh`,
        // canvasWrap mask 곡률(%) — 흰 비네 오버레이와 무관(그 레이어는 사용하지 않음)
        ["--slide-vignette" as string]: `${tuning.vignetteWidth}%`,
        ["--slide-vignette-y" as string]: `${tuning.vignetteHeight}%`,
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
            waterFrameStrength={tuning.waterFrameStrength}
            waterFrameThickness={tuning.waterFrameThickness}
            waterDistort={tuning.waterDistort}
            waterChromaticAberration={tuning.waterChromaticAberration}
            waterFrameShine={tuning.waterFrameShine}
            waterInnerDistort={tuning.waterInnerDistort}
            waterTintR={tuning.waterTintR}
            waterTintG={tuning.waterTintG}
            waterTintB={tuning.waterTintB}
            waterTintMix={tuning.waterTintMix}
            imageBrightness={tuning.imageBrightness}
            imageContrast={tuning.imageContrast}
            imageSaturation={tuning.imageSaturation}
            screenCornerRadius={tuning.screenCornerRadius}
            realtimeTuning={tunerVisible || acrylicLayerVisible}
          />
        </div>

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
      {!tunerVisible && acrylicLayerVisible ? (
        <RotatingSlideTuningPanel
          tuning={tuning}
          onChange={update}
          onReset={reset}
          activeIndex={activeIndex}
          variant="acrylic"
        />
      ) : null}
    </section>
  );
});
