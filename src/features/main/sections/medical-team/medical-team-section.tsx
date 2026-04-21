"use client";

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
      // 섹션 상단이 뷰포트 40% 지점에 진입할 때부터 뷰포트 최상단(0%)에 닿을 때까지 마스크 벗기기
      gsap.fromTo(
        curtain,
        { clipPath: "inset(30% 0 0 0 round 50% 50% 0 0 / 4.8rem 4.8rem 0 0)" },
        {
          clipPath: "inset(0% 0 0 0 round 50% 50% 0 0 / 4.8rem 4.8rem 0 0)",
          ease: "none",
          scrollTrigger: {
            trigger: section,
            start: "top 70%",
            end: "top top",
            scrub: 1,
          },
        },
      );

      // 마스크가 완전히 열린 시점(섹션 상단 = 뷰포트 상단)에 콘텐츠 등장 모션
      gsap.fromTo(
        copy,
        { autoAlpha: 0, y: 28 },
        {
          autoAlpha: 1,
          y: 0,
          duration: 0.9,
          ease: "power3.out",
          scrollTrigger: {
            trigger: section,
            start: "top top",
          },
        },
      );

      gsap.fromTo(
        imageFrame,
        { autoAlpha: 0, y: "20vh" },
        {
          autoAlpha: 1,
          y: 0,
          duration: 1.1,
          ease: "power3.out",
          delay: 0.12,
          scrollTrigger: {
            trigger: section,
            start: "top top",
          },
        },
      );
    }, section);

    return () => ctx.revert();
  }, []);

  return (
    <section ref={sectionRef} className={styles.section} aria-label="Medical team">
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
