"use client";

/* eslint-disable @next/next/no-img-element */
import { useLayoutEffect, useRef, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import type { SystemSectionMessages } from "@/shared/i18n/messages";
import styles from "./system-section.module.css";

gsap.registerPlugin(ScrollTrigger);

export interface SystemSectionProps {
  messages: SystemSectionMessages;
}

export function SystemSection({ messages }: SystemSectionProps) {
  const sectionRef = useRef<HTMLElement>(null);
  const pinRef = useRef<HTMLDivElement>(null);
  const [progress, setProgress] = useState(0);
  const reduceMotion = useReducedMotion();
  const items = messages.items;
  const itemCount = items.length;
  if (itemCount === 0) return null;

  const activeIndex = Math.min(itemCount - 1, Math.max(0, Math.floor(progress * itemCount)));
  const item = items[activeIndex];

  useLayoutEffect(() => {
    const section = sectionRef.current;
    const pinEl = pinRef.current;
    if (!section || !pinEl) return;

    const st = ScrollTrigger.create({
      trigger: section,
      start: "top top",
      end: "bottom bottom",
      pin: pinEl,
      pinSpacing: true,
      scrub: 1,
      anticipatePin: 1,
      invalidateOnRefresh: true,
      onUpdate: (self) => setProgress(self.progress),
    });

    return () => st.kill();
  }, []);

  return (
    <section ref={sectionRef} className={styles.section} aria-labelledby="system-section-heading">
      <div ref={pinRef} className={styles.pinShell}>
        <div className={styles.inner}>
          <div className={styles.contentRow}>
            <div className={styles.copyColumn}>
              <AnimatePresence mode="wait" initial={false}>
                <motion.div
                  key={`${item.title}-${activeIndex}`}
                  className={styles.copyBox}
                  initial={reduceMotion ? { opacity: 0 } : { opacity: 0, y: 12, filter: "blur(4px)" }}
                  animate={reduceMotion ? { opacity: 1 } : { opacity: 1, y: 0, filter: "blur(0px)" }}
                  exit={reduceMotion ? { opacity: 0 } : { opacity: 0, y: -8, filter: "blur(3px)" }}
                  transition={reduceMotion ? { duration: 0.2 } : { duration: 0.38, ease: [0.22, 1, 0.36, 1] }}
                >
                  <p className={styles.eyebrow} lang="en">
                    <img
                      src="/main/img_main_system_logo.png"
                      alt=""
                      className={styles.eyebrowLogo}
                      aria-hidden="true"
                      loading="lazy"
                      decoding="async"
                    />
                    <span>{item.eyebrowEn}</span>
                  </p>
                  <h2 id="system-section-heading" className={styles.title}>
                    {item.title}
                  </h2>
                  <p className={styles.description}>{item.description}</p>
                {item.ctaLabel ? (
                  <a href={item.ctaHref ?? "#"} className={styles.cta}>
                    {item.ctaLabel}
                  </a>
                ) : null}
                </motion.div>
              </AnimatePresence>
            </div>

            <AnimatePresence mode="wait" initial={false}>
              <motion.div
                key={`${item.imageSrc}-${activeIndex}`}
                className={styles.imageWrap}
                initial={reduceMotion ? { opacity: 0 } : { opacity: 0, x: 16, filter: "blur(3px)" }}
                animate={reduceMotion ? { opacity: 1 } : { opacity: 1, x: 0, filter: "blur(0px)" }}
                exit={reduceMotion ? { opacity: 0 } : { opacity: 0, x: -10, filter: "blur(2px)" }}
                transition={reduceMotion ? { duration: 0.2 } : { duration: 0.42, ease: [0.22, 1, 0.36, 1] }}
              >
                <img src={item.imageSrc} alt={item.title} className={styles.image} loading="lazy" decoding="async" />
              </motion.div>
            </AnimatePresence>

            <div className={styles.bottomNavBar} aria-hidden>
              {Array.from({ length: 3 }).map((_, index) => (
                <span
                  key={`system-nav-${index}`}
                  className={`${styles.bottomNavItem} ${index === Math.min(activeIndex, 2) ? styles.bottomNavItemActive : ""}`}
                />
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
