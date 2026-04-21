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

const SCROLL_SLIDES = 3;

export interface TypographyScrollSectionProps {
  messages: TypographySectionMessages;
}

function indexFromProgress(progress: number): number {
  if (progress < 1 / 3) return 0;
  if (progress < 2 / 3) return 1;
  return 2;
}

export function TypographyScrollSection({ messages }: TypographyScrollSectionProps) {
  const sectionRef = useRef<HTMLElement>(null);
  const pinRef = useRef<HTMLDivElement>(null);
  const slides = useMemo(() => messages.slides.slice(0, SCROLL_SLIDES), [messages]);
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
      style={{ height: `${SCROLL_SLIDES * 100}vh` }}
      aria-label="Clinic message"
    >
      <div ref={pinRef} className={styles.pinShell}>
        <div className={styles.stack}>
          <AnimatePresence initial={false} mode="wait">
            <motion.div
              key={slide.lineEn}
              className={styles.slide}
              initial={
                reduceMotion
                  ? { opacity: 0 }
                  : { opacity: 0, y: 14, filter: "blur(5px)" }
              }
              animate={
                reduceMotion ? { opacity: 1 } : { opacity: 1, y: 0, filter: "blur(0px)" }
              }
              exit={
                reduceMotion
                  ? { opacity: 0 }
                  : { opacity: 0, y: -12, filter: "blur(3px)" }
              }
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
