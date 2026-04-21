"use client";

import dynamic from "next/dynamic";
import { useEffect, useRef, useState } from "react";
import gsap from "gsap";
import { useGSAP } from "@gsap/react";
import { GridBackground } from "@/features/main/common/grid-background";
import { Gnb } from "@/components/gnb";
import { MainHero } from "@/features/main/sections/hero/main-hero";
import type { Locale } from "@/shared/config/i18n";
import type {
  AcademicPublicationsSectionMessages,
  HeroQuickBarMessages,
  MedicalTeamSectionMessages,
  TypographySectionMessages,
} from "@/shared/i18n/messages";
import { TypographyScrollSection } from "@/features/main/sections/typography/typography-scroll-section";
import { RotatingSlideSection } from "@/features/main/sections/rotating-slide/rotating-slide-section";
import { AcademicPublicationsSection } from "@/features/main/sections/academic-publications/academic-publications-section";
import { MedicalTeamSection } from "@/features/main/sections/medical-team/medical-team-section";
import styles from "./main-page.module.css";

/** 잠시 끔 — 다시 켤 때 `true`로 바꾸고 아래 글래스 레이어 렌더 복구 */
const GLASS_ORBS_ENABLED = false;

const GlassOrbsScene = dynamic(
  () => import("@/features/main/common/glass-orbs-scene").then((mod) => mod.GlassOrbsScene),
  { ssr: false },
);

gsap.registerPlugin(useGSAP);

export interface MainPageProps {
  locale: Locale;
  heroQuickBar: HeroQuickBarMessages;
  typographySection: TypographySectionMessages;
  medicalTeamSection: MedicalTeamSectionMessages;
  academicPublicationsSection: AcademicPublicationsSectionMessages;
}

const SCROLL_HOT_IDLE_MS = 520;

export const MainPage = ({
  locale,
  heroQuickBar,
  typographySection,
  medicalTeamSection,
  academicPublicationsSection,
}: MainPageProps) => {
  const mainRef = useRef<HTMLElement>(null);
  const backdropRef = useRef<HTMLDivElement>(null);
  const glassLayerRef = useRef<HTMLDivElement>(null);
  const introPlayedRef = useRef(false);
  const [gridScrollHot, setGridScrollHot] = useState(false);
  const scrollHotTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const markHot = () => {
      setGridScrollHot(true);
      if (scrollHotTimerRef.current) {
        clearTimeout(scrollHotTimerRef.current);
      }
      scrollHotTimerRef.current = setTimeout(() => {
        setGridScrollHot(false);
        scrollHotTimerRef.current = null;
      }, SCROLL_HOT_IDLE_MS);
    };

    window.addEventListener("scroll", markHot, { passive: true });
    window.addEventListener("wheel", markHot, { passive: true });
    return () => {
      window.removeEventListener("scroll", markHot);
      window.removeEventListener("wheel", markHot);
      if (scrollHotTimerRef.current) {
        clearTimeout(scrollHotTimerRef.current);
      }
    };
  }, []);

  useGSAP(
    () => {
      if (!GLASS_ORBS_ENABLED || introPlayedRef.current || !glassLayerRef.current) {
        return;
      }
      introPlayedRef.current = true;
      gsap.fromTo(glassLayerRef.current, { y: 36 }, { y: 0, duration: 1, ease: "power3.out" });
    },
    { scope: mainRef },
  );

  return (
    <main ref={mainRef} className={styles.root}>
      <div className={styles.gridFixed} aria-hidden>
        <GridBackground scrollHot={gridScrollHot} />
      </div>
      <div ref={backdropRef} className={styles.backdrop} />
      {GLASS_ORBS_ENABLED ? (
        <div ref={glassLayerRef} className={styles.glassLayer}>
          <GlassOrbsScene transmissionSourceRef={backdropRef} />
        </div>
      ) : null}
      <div className={styles.foreground}>
        <Gnb locale={locale} />
        <MainHero heroQuickBar={heroQuickBar} locale={locale} />
        <TypographyScrollSection messages={typographySection} />
        <RotatingSlideSection />
        <MedicalTeamSection messages={medicalTeamSection} />
        <AcademicPublicationsSection messages={academicPublicationsSection} />
      </div>
    </main>
  );
};
