"use client";

import { useLayoutEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import type { TypographySectionMessages } from "@/shared/i18n/messages";
import styles from "./typography-scroll-section.module.css";

const SLIDE_TRANSITION = {
  duration: 0.52,
  ease: [0.33, 1, 0.68, 1] as const,
};

gsap.registerPlugin(ScrollTrigger);

/** 섹션 전체 스크롤 길이(3문구 + 마지막 100vh는 3번 유지) */
const SECTION_HEIGHT_VH = 400;
const SLIDE_COUNT = 3;

export interface TypographyScrollSectionProps {
  messages: TypographySectionMessages;
}

/**
 * 섹션 총 400vh 기준: 0~100vh → 1번, 100~200vh → 2번, 200vh~끝(200~400vh) → 3번 유지
 * (progress: 0~0.25 / 0.25~0.5 / 0.5~1)
 */
function indexFromProgress(progress: number): number {
  if (progress < 0.25) return 0;
  if (progress < 0.5) return 1;
  return 2;
}

export function TypographyScrollSection({ messages }: TypographyScrollSectionProps) {
  const sectionRef = useRef<HTMLElement>(null);
  const pinRef = useRef<HTMLDivElement>(null);
  const slides = useMemo(() => messages.slides.slice(0, SLIDE_COUNT), [messages]);
  const [activeIndex, setActiveIndex] = useState(0);
  const reduceMotion = useReducedMotion();

  const slideContentKey = useMemo(
    () => slides.map((s) => `${s.lineEn}\0${s.lineKo}`).join("\t"),
    [slides],
  );

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
        const idx = Math.min(indexFromProgress(self.progress), slides.length - 1);
        setActiveIndex((prev) => (prev === idx ? prev : idx));
      },
    });

    return () => {
      st.kill();
    };
  }, [slideContentKey, slides]);

  const slide = slides[Math.min(activeIndex, slides.length - 1)];

  return (
    <section
      ref={sectionRef}
      className={styles.section}
      style={{ height: `${SECTION_HEIGHT_VH}vh` }}
      aria-label="Clinic message"
    >
      <div ref={pinRef} className={styles.pinShell}>
        <div className={styles.stack}>
          <AnimatePresence initial={false} mode="wait">
            <motion.div
              key={slide.lineEn}
              className={styles.slide}
              initial={reduceMotion ? { opacity: 0 } : { opacity: 0, y: 14 }}
              animate={reduceMotion ? { opacity: 1 } : { opacity: 1, y: 0 }}
              exit={reduceMotion ? { opacity: 0 } : { opacity: 0, y: -12 }}
              transition={reduceMotion ? { duration: 0.22, ease: "easeOut" } : SLIDE_TRANSITION}
            >
              <p className={styles.lineEn} lang="en">
                {slide.lineEn}
              </p>
              <p className={styles.lineKo}>{slide.lineKo}</p>
            </motion.div>
          </AnimatePresence>
        </div>
      </div>
    </section>
  );
}
