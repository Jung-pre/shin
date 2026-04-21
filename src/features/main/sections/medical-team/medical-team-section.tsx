"use client";

/* eslint-disable @next/next/no-img-element */
import { useLayoutEffect, useRef } from "react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import type { MedicalTeamSectionMessages } from "@/shared/i18n/messages";
import styles from "./medical-team-section.module.css";

export interface MedicalTeamSectionProps {
  messages: MedicalTeamSectionMessages;
}

gsap.registerPlugin(ScrollTrigger);

export function MedicalTeamSection({ messages }: MedicalTeamSectionProps) {
  const sectionRef = useRef<HTMLElement>(null);
  const curtainRef = useRef<HTMLDivElement>(null);
  const copyRef = useRef<HTMLDivElement>(null);
  const imageFrameRef = useRef<HTMLDivElement>(null);

  useLayoutEffect(() => {
    const section = sectionRef.current;
    const curtain = curtainRef.current;
    const copy = copyRef.current;
    const imageFrame = imageFrameRef.current;
    if (!section || !curtain || !copy || !imageFrame) {
      return;
    }

    const ctx = gsap.context(() => {
      gsap.fromTo(
        curtain,
        { yPercent: 55 },
        {
          yPercent: 0,
          ease: "none",
          scrollTrigger: {
            trigger: section,
            start: "top top",
            end: "top+=20% top",
            scrub: 1,
          },
        },
      );

      gsap.fromTo(
        [copy, imageFrame],
        { autoAlpha: 0, y: 28 },
        {
          autoAlpha: 1,
          y: 0,
          duration: 0.9,
          ease: "power3.out",
          stagger: 0.12,
          scrollTrigger: {
            trigger: section,
            start: "top+=20% top",
          },
        },
      );
    }, section);

    return () => ctx.revert();
  }, []);

  return (
    <section ref={sectionRef} className={styles.section} aria-label="Medical team">
      <div className={styles.bgTeam} aria-hidden>
        <img
          src="/main/bg_team.png"
          alt=""
          className={styles.bgTeamImage}
          loading="lazy"
          decoding="async"
        />
      </div>
      <div ref={curtainRef} className={styles.curtain} aria-hidden />
      <div className={styles.inner}>
        <div ref={copyRef} className={styles.copy}>
          <p className={styles.eyebrow}>{messages.eyebrow}</p>
          <h2 className={styles.title}>
            <span>{messages.titleLine1}</span>
            <span>{messages.titleLine2}</span>
          </h2>
          <button type="button" className={styles.cta}>
            <span className={styles.ctaDot} aria-hidden />
            <span className={styles.ctaLabel}>{messages.ctaLabel}</span>
          </button>
        </div>

        <div ref={imageFrameRef} className={styles.imageFrame} aria-hidden>
          <img
            src="/main/img_main_team_all.png"
            alt=""
            className={styles.teamAllImage}
            loading="lazy"
            decoding="async"
          />
        </div>
      </div>
    </section>
  );
}
