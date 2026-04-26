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

/** false 이면 로고 오프셋 state 만 유지하고 패널 UI 는 숨김 */
const SHOW_LOGO_LAYER_PANEL = false;

export function MedicalTeamSection({ messages }: MedicalTeamSectionProps) {
  const sectionRef = useRef<HTMLElement>(null);
  const innerRef = useRef<HTMLDivElement>(null);
  const curtainRef = useRef<HTMLDivElement>(null);
  const copyRef = useRef<HTMLDivElement>(null);
  const imageFrameRef = useRef<HTMLDivElement>(null);
  const [isLayerOpen, setIsLayerOpen] = useState(false);
  const [logoOffsetX, setLogoOffsetX] = useState(0);
  const [logoOffsetY, setLogoOffsetY] = useState(0);
  /** 격자 선 1칸(선 간격) — rem */
  const [gridPitchRem, setGridPitchRem] = useState(3.125);
  /** 반복 로고 타일 한 칸(가로=세로) — rem, `repeat` 시 이 간격으로 바둑 */
  const [logoTileRem, setLogoTileRem] = useState(18.75);

  useLayoutEffect(() => {
    const section = sectionRef.current;
    const inner = innerRef.current;
    const curtain = curtainRef.current;
    const copy = copyRef.current;
    const imageFrame = imageFrameRef.current;
    if (!section || !inner || !curtain || !copy || !imageFrame) {
      return;
    }

    const ctx = gsap.context(() => {
      /* 100vh 스테이지에서 30% ≈ 30vh — 섹션 전체 높이 커튼이어도 상단 늘어남·마스크 양이 동일하도록 vh 사용 */
      const clipA = "inset(30vh 0 0 0 round 50% 50% 0 0 / 4.8rem 4.8rem 0 0)";
      const clipB = "inset(0% 0 0 0 round 50% 50% 0 0 / 4.8rem 4.8rem 0 0)";

      // 배경(격자) mask — 섹션 기준 기존과 동일: 70% → top, scrub
      gsap.fromTo(
        curtain,
        { clipPath: clipA },
        {
          clipPath: clipB,
          ease: "none",
          scrollTrigger: {
            trigger: section,
            start: "top 70%",
            end: "top top",
            scrub: 1,
          },
        },
      );

      // inner pin: start ~ end "bottom bottom" 까지. 끝 50vh 는 모션(텍스트·이미지) 완료 후 유지, scrub 대신 progress 매핑.
      const T_TEXT = 0.5;
      const T_IMAGE = 0.5;
      gsap.set(copy, { autoAlpha: 0, y: 28 });
      gsap.set(imageFrame, { autoAlpha: 0, y: "10vh" });

      const contentTl = gsap.timeline({ paused: true });
      contentTl.fromTo(
        copy,
        { autoAlpha: 0, y: 28 },
        { autoAlpha: 1, y: 0, ease: "power3.out", duration: T_TEXT },
        0,
      );
      contentTl.fromTo(
        imageFrame,
        { autoAlpha: 0, y: "10vh" },
        { autoAlpha: 1, y: 0, ease: "power3.out", duration: T_IMAGE },
        T_TEXT,
      );

      const syncContentProgress = (st: ScrollTrigger) => {
        const start = st.start;
        const end = st.end;
        if (start == null || end == null) return;
        const dist = end - start;
        const holdPx = window.innerHeight * 0.5;
        if (dist <= 0) return;
        if (dist <= holdPx) {
          contentTl.progress(st.progress, false);
          return;
        }
        const tlP = Math.min(1, (st.progress * dist) / (dist - holdPx));
        contentTl.progress(tlP, false);
      };

      ScrollTrigger.create({
        trigger: section,
        start: "top 10vh",
        end: "bottom bottom",
        pin: inner,
        pinSpacing: true,
        anticipatePin: 1,
        onUpdate: (st) => {
          syncContentProgress(st);
        },
        onRefresh: (st) => {
          syncContentProgress(st);
        },
        invalidateOnRefresh: true,
      });
    }, section);

    return () => ctx.revert();
  }, []);

  return (
    <section
      ref={sectionRef}
      className={styles.section}
      aria-label="Medical team"
      data-gnb-tint-from
    >
      <div
        ref={curtainRef}
        className={styles.curtain}
        aria-hidden
        style={
          {
            "--logo-offset-x": `${logoOffsetX}px`,
            "--logo-offset-y": `${logoOffsetY}px`,
            "--grid-pitch": `${gridPitchRem}rem`,
            "--logo-tile": `${logoTileRem}rem`,
          } as CSSProperties
        }
      />
      <div ref={innerRef} className={styles.inner}>
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
              <p className={styles.layerHint}>격자 선</p>
              <label className={styles.layerField}>
                <span className={styles.layerFieldTitle}>
                  격자 1칸(선 반복) {gridPitchRem.toFixed(3)} rem
                </span>
                <input
                  type="range"
                  min={1.25}
                  max={6}
                  step={0.0625}
                  value={gridPitchRem}
                  onChange={(event) => setGridPitchRem(Number(event.target.value))}
                />
              </label>
              <p className={styles.layerHint}>로고(타일) 반복</p>
              <label className={styles.layerField}>
                <span className={styles.layerFieldTitle}>
                  로고 타일 한 칸(가·세) {logoTileRem.toFixed(2)} rem
                </span>
                <input
                  type="range"
                  min={6}
                  max={60}
                  step={0.25}
                  value={logoTileRem}
                  onChange={(event) => setLogoTileRem(Number(event.target.value))}
                />
              </label>
              <p className={styles.layerSubHint}>
                배경 `background-size` → 같은 간격으로 `repeat` 됩니다. 격자 대비
                약 {logoTileRem > 0 ? (logoTileRem / gridPitchRem).toFixed(2) : "—"}칸.
              </p>
              <p className={styles.layerHint}>로고 위치</p>
              <label className={styles.layerField}>
                <span className={styles.layerFieldTitle}>로고 오프셋 X: {logoOffsetX}px</span>
                <input
                  type="range"
                  min={-300}
                  max={300}
                  value={logoOffsetX}
                  onChange={(event) => setLogoOffsetX(Number(event.target.value))}
                />
              </label>
              <label className={styles.layerField}>
                <span className={styles.layerFieldTitle}>로고 오프셋 Y: {logoOffsetY}px</span>
                <input
                  type="range"
                  min={-300}
                  max={300}
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
