"use client";

import { useLayoutEffect, useRef, useState, type CSSProperties } from "react";
import Image from "next/image";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import type { MedicalTeamSectionMessages } from "@/shared/i18n/messages";
import styles from "./medical-team-section.module.css";

export interface MedicalTeamSectionProps {
  messages: MedicalTeamSectionMessages;
}

gsap.registerPlugin(ScrollTrigger);

/**
 * dev 튜닝용 "로고 레이어 조정" 패널 노출 스위치.
 *   - false: logoOffsetX/Y state 는 유지(이미지 포지션 계산에 그대로 사용), UI 만 스킵.
 *   - true: 우측 하단 토글 + 슬라이더 팝업 노출.
 */
const SHOW_LOGO_LAYER_PANEL = false;

export function MedicalTeamSection({ messages }: MedicalTeamSectionProps) {
  const sectionRef = useRef<HTMLElement>(null);
  const curtainRef = useRef<HTMLDivElement>(null);
  const copyRef = useRef<HTMLDivElement>(null);
  const imageFrameRef = useRef<HTMLDivElement>(null);
  const [isLayerOpen, setIsLayerOpen] = useState(false);
  const [logoOffsetX, setLogoOffsetX] = useState(-14);
  const [logoOffsetY, setLogoOffsetY] = useState(16);

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
        { autoAlpha: 0, y: "10vh" },
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
      <div
        ref={curtainRef}
        className={styles.curtain}
        aria-hidden
        style={
          {
            "--logo-offset-x": `${logoOffsetX}px`,
            "--logo-offset-y": `${logoOffsetY}px`,
          } as CSSProperties
        }
      />
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
          <Image
            src="/main/img_main_team_all.webp"
            alt=""
            width={3840}
            height={1010}
            sizes="(max-width: 48rem) 100vw, 120rem"
            className={styles.teamAllImage}
            loading="lazy"
          />
        </div>
      </div>

      {SHOW_LOGO_LAYER_PANEL ? (
        <div className={styles.layerTool}>
          <button type="button" className={styles.layerToggle} onClick={() => setIsLayerOpen((prev) => !prev)}>
            로고 레이어 조정
          </button>
          {isLayerOpen ? (
            <div className={styles.layerPopup}>
              <label className={styles.layerField}>
                <span className={styles.layerFieldTitle}>로고 오프셋 X: {logoOffsetX}</span>
                <input
                  type="range"
                  min={-180}
                  max={180}
                  value={logoOffsetX}
                  onChange={(event) => setLogoOffsetX(Number(event.target.value))}
                />
              </label>
              <label className={styles.layerField}>
                <span className={styles.layerFieldTitle}>로고 오프셋 Y: {logoOffsetY}</span>
                <input
                  type="range"
                  min={-180}
                  max={180}
                  value={logoOffsetY}
                  onChange={(event) => setLogoOffsetY(Number(event.target.value))}
                />
              </label>
            </div>
          ) : null}
        </div>
      ) : null}
    </section>
  );
}
