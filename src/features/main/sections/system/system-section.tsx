"use client";

/* eslint-disable @next/next/no-img-element */
import { useLayoutEffect, useRef, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { useGSAP } from "@gsap/react";
import type { SystemSectionMessages } from "@/shared/i18n/messages";
import styles from "./system-section.module.css";

gsap.registerPlugin(ScrollTrigger, useGSAP);

export interface SystemSectionProps {
  messages: SystemSectionMessages;
}

export function SystemSection({ messages }: SystemSectionProps) {
  const sectionRef = useRef<HTMLElement>(null);
  const pinRef = useRef<HTMLDivElement>(null);
  const copyColumnRef = useRef<HTMLDivElement>(null);
  const imageRevealRef = useRef<HTMLDivElement>(null);
  const navRevealRef = useRef<HTMLDivElement>(null);
  const [progress, setProgress] = useState(0);
  const reduceMotion = useReducedMotion();
  const items = messages.items;
  const itemCount = items.length;
  if (itemCount === 0) return null;

  const activeIndex = Math.min(itemCount - 1, Math.max(0, Math.floor(progress * itemCount)));
  const item = items[activeIndex];
  const navProgress = progress * (itemCount - 1);

  const getNavIntensity = (index: number) => {
    const distance = Math.abs(navProgress - index);
    return Math.max(0, 1 - distance);
  };

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

  useGSAP(
    () => {
      const section = sectionRef.current;
      const revealTargets = [copyColumnRef.current, imageRevealRef.current, navRevealRef.current].filter(Boolean);
      if (!section || revealTargets.length === 0) return;

      if (reduceMotion) {
        gsap.set(revealTargets, { autoAlpha: 1, clearProps: "all" });
        return;
      }

      gsap.set(revealTargets, {
        autoAlpha: 0,
        y: 32,
      });

      gsap.to(revealTargets, {
        autoAlpha: 1,
        y: 0,
        duration: 0.9,
        stagger: 0.12,
        ease: "power3.out",
        clearProps: "opacity,visibility,transform",
        scrollTrigger: {
          trigger: section,
          start: "top 74%",
          once: true,
        },
      });
    },
    { scope: sectionRef, dependencies: [reduceMotion] },
  );

  return (
    <section ref={sectionRef} className={styles.section} aria-labelledby="system-section-heading">
      <div ref={pinRef} className={styles.pinShell}>
        <div className={styles.inner}>
          <div className={styles.contentRow}>
            <div ref={copyColumnRef} className={styles.copyColumn}>
              <AnimatePresence mode="wait" initial={false}>
                <motion.div
                  key={`${item.title}-${activeIndex}`}
                  className={styles.copyBox}
                  initial={reduceMotion ? { opacity: 0 } : { opacity: 0, y: 12 }}
                  animate={reduceMotion ? { opacity: 1 } : { opacity: 1, y: 0 }}
                  exit={reduceMotion ? { opacity: 0 } : { opacity: 0, y: -8 }}
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

            <div ref={imageRevealRef}>
              <AnimatePresence mode="wait" initial={false}>
                <motion.div
                  key={`${item.imageSrc}-${activeIndex}`}
                  className={styles.imageWrap}
                  initial={reduceMotion ? { opacity: 0 } : { opacity: 0, x: 16 }}
                  animate={reduceMotion ? { opacity: 1 } : { opacity: 1, x: 0 }}
                  exit={reduceMotion ? { opacity: 0 } : { opacity: 0, x: -10 }}
                  transition={reduceMotion ? { duration: 0.2 } : { duration: 0.42, ease: [0.22, 1, 0.36, 1] }}
                >
                  <img src={item.imageSrc} alt={item.title} className={styles.image} loading="lazy" decoding="async" />
                </motion.div>
              </AnimatePresence>
            </div>

            <div ref={navRevealRef} className={styles.bottomNavBar} aria-hidden>
              {Array.from({ length: itemCount }).map((_, index) => (
                (() => {
                  const intensity = getNavIntensity(index);
                  return (
                <span
                  key={`system-nav-${index}`}
                  className={styles.bottomNavItem}
                  style={{
                    opacity: 0.3 + intensity * 0.7,
                    transform: `scaleY(${0.86 + intensity * 0.14})`,
                  }}
                />
                  );
                })()
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
