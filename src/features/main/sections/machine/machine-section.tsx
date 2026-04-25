"use client";

import Image from "next/image";
import { useRef, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import gsap from "gsap";
import { useGSAP } from "@gsap/react";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import type { MachineSectionMessages } from "@/shared/i18n/messages";
import styles from "./machine-section.module.css";

gsap.registerPlugin(ScrollTrigger, useGSAP);

export interface MachineSectionProps {
  messages: MachineSectionMessages;
}

export function MachineSection({ messages }: MachineSectionProps) {
  const sectionRef = useRef<HTMLElement>(null);
  const pinRef = useRef<HTMLDivElement>(null);
  const progressRef = useRef(0);
  const [activeIndex, setActiveIndex] = useState(0);
  const reduceMotion = useReducedMotion();
  const primaryMachine = messages.machines[0];
  const machines = messages.machines.length > 0 ? messages.machines : [primaryMachine];

  useGSAP(
    () => {
      const section = sectionRef.current;
      const pinEl = pinRef.current;
      if (!section || !pinEl) return;
      const segmentCount = 3;
      const progressState = { value: 0 };
      const smoothProgress = gsap.quickTo(progressState, "value", {
        duration: 0.22,
        ease: "power2.out",
        onUpdate: () => {
          progressRef.current = progressState.value;
          const phase = progressState.value * segmentCount;
          const next = Math.min(machines.length - 1, Math.max(0, Math.floor(phase)));
          setActiveIndex((prev) => (prev !== next ? next : prev));
        },
      });

      const pinST = ScrollTrigger.create({
        trigger: section,
        start: "top top",
        end: "bottom bottom",
        pin: pinEl,
        pinSpacing: true,
        scrub: 1,
        anticipatePin: 1,
        invalidateOnRefresh: true,
        onUpdate: (self) => smoothProgress(self.progress),
      });

      gsap.fromTo(
        pinEl,
        { autoAlpha: 0, y: 20 },
        {
          autoAlpha: 1,
          y: 0,
          duration: 0.8,
          ease: "power3.out",
          scrollTrigger: {
            trigger: section,
            start: "top 75%",
            once: true,
          },
        },
      );

      return () => {
        pinST.kill();
      };
    },
    { scope: sectionRef },
  );

  const activeMachine = machines[Math.min(activeIndex, machines.length - 1)];
  const isVisumax800 = activeMachine.nameEn === "VISUMAX 800";
  const isVisumax500 = activeMachine.nameEn === "VISUMAX 500";
  const isCatalysLaser = activeMachine.nameEn === "Catalys laser";

  const eyebrowLabel = activeMachine.headlineEyebrowLabel ?? messages.eyebrowLabel;
  const titleText = activeMachine.headlineTitle ?? messages.title;
  const [titleLine1 = "", titleLine2 = ""] = titleText.split("\n");
  const topDescription = activeMachine.headlineDescription ?? messages.description;
  const ctaLabel = activeMachine.headlineCtaLabel ?? activeMachine.nameEn ?? messages.ctaLabel;
  const sectionBgImage = activeMachine.bgImageSrc ?? "/main/img_main_machine_bg01.webp";

  return (
    <section ref={sectionRef} className={styles.section} aria-label="Advanced technology systems">
      <div ref={pinRef} className={styles.pinShell}>
        <AnimatePresence mode="sync" initial={false}>
          <motion.div
            key={`${activeMachine.nameEn}-bg`}
            className={styles.bgLayer}
            style={{ backgroundImage: `url("${sectionBgImage}")` }}
            initial={reduceMotion ? { opacity: 0 } : { opacity: 0, scale: 1.01 }}
            animate={reduceMotion ? { opacity: 1 } : { opacity: 1, scale: 1 }}
            exit={reduceMotion ? { opacity: 0 } : { opacity: 0, scale: 0.995 }}
            transition={reduceMotion ? { duration: 0.2 } : { duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
            aria-hidden
          />
        </AnimatePresence>
        <div className={styles.inner}>
          <div className={styles.copy}>
            <div className={styles.headlineBlock}>
              <p className={styles.eyebrow}>
                <Image
                  src="/main/img_main_machine_logo.webp"
                  alt=""
                  width={46}
                  height={28}
                  className={styles.eyebrowDot}
                  aria-hidden
                  loading="lazy"
                />
                <span className={styles.eyebrowText}>{eyebrowLabel}</span>
              </p>

              <h2 className={styles.title}>
              <span
                className={`${styles.titleLinePrimary} ${isVisumax500 ? styles.titleLinePrimary500 : ""} ${isCatalysLaser ? styles.titleLinePrimaryCatalys : ""}`}
              >
                {titleLine1}
              </span>
                <span className={styles.titleLineSecondary}>{titleLine2}</span>
              </h2>
              <p className={styles.description}>{topDescription}</p>
              <button type="button" className={styles.cta}>
                <span className={styles.ctaText}>{ctaLabel}</span>
              </button>
            </div>

            <AnimatePresence mode="sync" initial={false}>
              <motion.div
                key={activeMachine.nameEn}
                className={`${styles.machineInfoBlock} ${isVisumax800 ? styles.machineInfoBlock800 : ""} ${isVisumax500 ? styles.machineInfoBlock500 : ""} ${isCatalysLaser ? styles.machineInfoBlockCatalys : ""}`}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.38, ease: [0.22, 1, 0.36, 1] }}
              >
                <p
                  className={`${styles.machineBackdropTitle} ${isVisumax800 ? styles.machineBackdropTitle800 : ""} ${isVisumax500 ? styles.machineBackdropTitle500 : ""}`}
                  aria-hidden
                >
                  {activeMachine.nameEn}
                </p>
                <p className={styles.machineTitle}>
                  <span
                    className={`${styles.machineTitleKo} ${isVisumax500 ? styles.machineTitleKo500 : ""} ${isCatalysLaser ? styles.machineTitleKoCatalys : ""}`}
                  >
                    {activeMachine.nameKo}
                  </span>
                  <span className={styles.machineTitleEn}>{activeMachine.nameEn}</span>
                </p>
                <p className={styles.machineDesc}>
                  {activeMachine.description}
                </p>
              </motion.div>
            </AnimatePresence>
          </div>

          {/* 머신 이미지 — GLB 대신 정적 이미지로 표시 */}
          <AnimatePresence mode="sync" initial={false}>
            <motion.div
              key={activeMachine.imageSrc}
              className={`${styles.imageWrap} ${isVisumax500 ? styles.imageWrap500 : ""} ${isCatalysLaser ? styles.imageWrapCatalys : ""}`}
              aria-hidden
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.42, ease: [0.22, 1, 0.36, 1] }}
            >
              <Image
                src={activeMachine.imageSrc ?? ""}
                alt=""
                fill
                sizes="(max-width: 48rem) 100vw, 60rem"
                className={`${styles.machineImage} ${isVisumax500 ? styles.machineImage500 : ""} ${isCatalysLaser ? styles.machineImageCatalys : ""}`}
                priority={false}
                loading="lazy"
              />
            </motion.div>
          </AnimatePresence>
        </div>
      </div>

    </section>
  );
}
