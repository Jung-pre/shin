"use client";

import dynamic from "next/dynamic";
import { useEffect, useRef, useState } from "react";
import gsap from "gsap";
import { useGSAP } from "@gsap/react";
import { GridBackground } from "@/features/main/common/grid-background";
import { SvgGlassOverlay } from "@/features/main/common/svg-glass-overlay";
import { MainHero } from "@/features/main/sections/hero/main-hero";
import type { Locale } from "@/shared/config/i18n";
import type {
  AcademicPublicationsSectionMessages,
  BlogSectionMessages,
  HeroQuickBarMessages,
  MachineSectionMessages,
  MedicalTeamSectionMessages,
  NewsSectionMessages,
  ReviewSectionMessages,
  SystemSectionMessages,
  TypographySectionMessages,
  YoutubeSectionMessages,
} from "@/shared/i18n/messages";
import { TypographyScrollSection } from "@/features/main/sections/typography/typography-scroll-section";
import { RotatingSlideSection } from "@/features/main/sections/rotating-slide/rotating-slide-section";
import { AcademicPublicationsSection } from "@/features/main/sections/academic-publications/academic-publications-section";
import { MedicalTeamSection } from "@/features/main/sections/medical-team/medical-team-section";
import { MachineSection } from "@/features/main/sections/machine/machine-section";
import { ReviewSection } from "@/features/main/sections/review/review-section";
import { SystemSection } from "@/features/main/sections/system/system-section";
import styles from "./main-page.module.css";

/**
 * 하단(Below-the-fold) 섹션은 초기 번들 용량을 줄이기 위해 동적 로딩.
 *   - ssr: true (기본값) 유지 → HTML 은 서버에서 렌더 돼 레이아웃 시프트/ SEO 문제 없음.
 *   - 단, 이 섹션들의 클라이언트 JS(GSAP 애니메이션 코드 등)는 별도 chunk 로 분리되어
 *     최초 로드 시 다운로드/파싱에 포함되지 않고, 필요 시점(스크롤 직전)에 스트리밍.
 * 주의: loading placeholder 는 의도적으로 null. 각 섹션 HTML 은 SSR 으로 이미 존재하므로
 *       클라이언트 하이드레이션 지연이 있어도 시각적 공백이 생기지 않는다.
 */
const BlogSection = dynamic(() =>
  import("@/features/main/sections/blog/blog-section").then((m) => m.BlogSection),
);
const NewsSection = dynamic(() =>
  import("@/features/main/sections/news/news-section").then((m) => m.NewsSection),
);
const YoutubeSection = dynamic(() =>
  import("@/features/main/sections/youtube/youtube-section").then((m) => m.YoutubeSection),
);
const YoutubeTransitionSection = dynamic(() =>
  import("@/features/main/sections/youtube/youtube-transition-section").then(
    (m) => m.YoutubeTransitionSection,
  ),
);

/** 잠시 끔 — 다시 켤 때 `true`로 바꾸고 아래 글래스 레이어 렌더 복구 */
const GLASS_ORBS_ENABLED = true;

const GlassOrbsScene = dynamic(
  () => import("@/features/main/common/glass-orbs-scene").then((mod) => mod.GlassOrbsScene),
  { ssr: false },
);

export interface MainPageProps {
  locale: Locale;
  heroQuickBar: HeroQuickBarMessages;
  typographySection: TypographySectionMessages;
  medicalTeamSection: MedicalTeamSectionMessages;
  machineSection: MachineSectionMessages;
  reviewSection: ReviewSectionMessages;
  systemSection: SystemSectionMessages;
  blogSection: BlogSectionMessages;
  newsSection: NewsSectionMessages;
  youtubeSection: YoutubeSectionMessages;
  academicPublicationsSection: AcademicPublicationsSectionMessages;
}

const SCROLL_HOT_IDLE_MS = 520;
/**
 * 3D 글래스는 히어로 구간에서만 필요하므로, 충분히 벗어나면 언마운트해 GPU 점유를 해제한다.
 * 모션의 방향/타이밍은 유지하기 위해 크로스페이드 임계점(triggerVh=0.25)보다 "뒤"에서만 해제.
 * 위로 다시 올라오면(remount) 자동 복귀.
 */
const GLASS_ORBS_UNMOUNT_SCROLL_VH = 0.55;
const GLASS_ORBS_REMOUNT_SCROLL_VH = 0.18;

export const MainPage = ({
  locale,
  heroQuickBar,
  typographySection,
  medicalTeamSection,
  machineSection,
  reviewSection,
  systemSection,
  blogSection,
  newsSection,
  youtubeSection,
  academicPublicationsSection,
}: MainPageProps) => {
  const mainRef = useRef<HTMLElement>(null);
  const glassLayerRef = useRef<HTMLDivElement>(null);
  /** 글래스 등장 모션 전용 래퍼 — opacity 는 스크롤 크로스페이드가 glassLayerRef 에서 점유하므로
   * 분리해서 intro 에서 transform/filter/opacity 를 걸어 충돌을 피한다. */
  const glassIntroRef = useRef<HTMLDivElement>(null);
  /**
   * 스크롤 뒷단 지속 글래스 — 3D Canvas 가 페이드아웃 되는 동시에 페이드인 돼서
   * 히어로 이후 페이지 끝까지 같은 자리를 지키는 경량 SVG 버전.
   */
  const svgGlassLayerRef = useRef<HTMLDivElement>(null);
  /**
   * 히어로 타이틀 ref — 렌즈 내부 굴절 이미지를 이 요소 bbox 에 맞춰 정렬.
   * MainHero 의 h1 에 부착되고, GlassOrbsScene 은 이 ref 를 기준으로 텍스처를 그린다.
   */
  const heroTitleRef = useRef<HTMLHeadingElement>(null);
  const [gridScrollHot, setGridScrollHot] = useState(false);
  const [isGlassOrbsMounted, setIsGlassOrbsMounted] = useState(GLASS_ORBS_ENABLED);
  /**
   * 기본 진입은 기존 동작 유지(즉시 크로스페이드 가능).
   * 단, 아래로 내려갔다가 역방향 복귀로 3D를 재마운트한 경우엔 ready 신호 전까지 SVG를 유지한다.
   */
  const [isGlassOrbsReady, setIsGlassOrbsReady] = useState(true);
  const hasGlassOrbsUnmountedRef = useRef(false);
  const needReadyResetOnRemountRef = useRef(false);
  const scrollHotTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  /**
   * 첫 진입 시 히어로 등장 모션:
   *   1) "신세계안과" 타이틀을 글자 1개씩 stagger 로 페이드 인 + slight slide up
   *   2) 마지막 글자가 자리잡은 뒤 글래스 렌즈가 블러에서 선명하게 등장
   *   3) 퀵바가 아래에서 슬라이드 업
   *
   * 주의: 타이틀 h1 자체는 `heroTitleRef` 로 글래스 텍스처 정렬에 쓰이므로 transform 금지.
   *       내부 .titleChar span(inline-block) 만 애니메이션 → h1 의 bbox 는 고정.
   */
  useGSAP(
    () => {
      const glassIntro = glassIntroRef.current;
      if (!glassIntro) return;

      // 주의: 여기서 `scale` 을 쓰면 Canvas 전체가 중앙으로 수축 → 오브 X 오프셋이
      // 설정값보다 안쪽으로 붙어 보인다(원하는 레이아웃 깨짐). 위치는 건드리지 말고
      // opacity 만으로 등장 — 블러는 GPU 레이어 프로모션 + 재래스터가 비싸 제거.
      gsap.set(glassIntro, { autoAlpha: 0 });
      gsap.set('[data-hero-char]', { autoAlpha: 0, y: 40 });
      gsap.set('[data-hero-intro="quickbar"]', { autoAlpha: 0, y: 28 });

      // 글자 5개(신/세/계/안/과) × stagger 0.11s × duration 0.55s → 마지막 글자 끝: 0.44 + 0.55 = 0.99s
      const charStagger = 0.11;
      const charDuration = 0.55;
      const charCount = 5;
      const lastCharEnd = charStagger * (charCount - 1) + charDuration; // ≈ 0.99s

      const tl = gsap.timeline({ delay: 0.12, defaults: { ease: "power3.out" } });
      tl.to(
        '[data-hero-char]',
        {
          autoAlpha: 1,
          y: 0,
          duration: charDuration,
          stagger: charStagger,
          ease: "power3.out",
        },
        0,
      )
        // 글자 다 나타난 직후 글래스 등장 (위치는 처음부터 최종값 유지, opacity 만 페이드)
        .to(
          glassIntro,
          { autoAlpha: 1, duration: 1.25 },
          lastCharEnd,
        )
        // 퀵바는 글래스와 살짝 겹쳐 0.25s 뒤에 슬라이드 업
        .to(
          '[data-hero-intro="quickbar"]',
          { autoAlpha: 1, y: 0, duration: 0.9 },
          lastCharEnd + 0.25,
        );
    },
    { scope: mainRef },
  );

  useEffect(() => {
    if (!GLASS_ORBS_ENABLED) {
      setIsGlassOrbsMounted(false);
      return;
    }

    const updateGlassOrbsMount = () => {
      const vh = window.innerHeight || 1;
      const y = window.scrollY;
      const unmountAt = vh * GLASS_ORBS_UNMOUNT_SCROLL_VH;
      const remountAt = vh * GLASS_ORBS_REMOUNT_SCROLL_VH;

      setIsGlassOrbsMounted((prev) => {
        if (prev && y > unmountAt) {
          hasGlassOrbsUnmountedRef.current = true;
          return false;
        }
        if (!prev && y < remountAt) {
          if (hasGlassOrbsUnmountedRef.current) {
            needReadyResetOnRemountRef.current = true;
          }
          return true;
        }
        return prev;
      });
    };

    updateGlassOrbsMount();
    window.addEventListener("scroll", updateGlassOrbsMount, { passive: true });
    window.addEventListener("resize", updateGlassOrbsMount);
    return () => {
      window.removeEventListener("scroll", updateGlassOrbsMount);
      window.removeEventListener("resize", updateGlassOrbsMount);
    };
  }, []);

  useEffect(() => {
    if (!isGlassOrbsMounted) return;
    if (!needReadyResetOnRemountRef.current) return;
    // 역방향 재진입에서만 "3D 준비 대기" 모드 활성화.
    setIsGlassOrbsReady(false);
    needReadyResetOnRemountRef.current = false;
  }, [isGlassOrbsMounted]);

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

  return (
    <main ref={mainRef} className={styles.root}>
      <div className={styles.gridFixed} aria-hidden>
        <GridBackground scrollHot={gridScrollHot} />
      </div>
      {GLASS_ORBS_ENABLED ? (
        <>
          <div ref={glassLayerRef} className={styles.glassLayer}>
            {/* glassLayerRef 는 크로스페이드 opacity 점유 → 등장 모션은 이 내부 래퍼가 담당 */}
            <div ref={glassIntroRef} className={styles.glassIntroWrap}>
              {isGlassOrbsMounted ? (
                <GlassOrbsScene
                  targetRef={heroTitleRef}
                  onFirstFrameReady={() => {
                    setIsGlassOrbsReady(true);
                  }}
                />
              ) : null}
            </div>
          </div>
          {/* 히어로 이후 페이지 끝까지 이어지는 경량 글래스 — 스크롤로 크로스페이드 인.
              크로스페이드(3D ↔ SVG) 로직은 SvgGlassOverlay 내부에서 glassLayerRef 로 직접 제어. */}
          <SvgGlassOverlay
            ref={svgGlassLayerRef}
            glassLayerRef={glassLayerRef}
            glassReady={isGlassOrbsReady}
          />
        </>
      ) : null}
      <div className={styles.foreground}>
        <MainHero heroQuickBar={heroQuickBar} locale={locale} titleRef={heroTitleRef} />
        <TypographyScrollSection messages={typographySection} />
        <RotatingSlideSection />
        <MedicalTeamSection messages={medicalTeamSection} />
        <AcademicPublicationsSection messages={academicPublicationsSection} />
        <MachineSection messages={machineSection} />
        <ReviewSection messages={reviewSection} />
        <SystemSection messages={systemSection} />
        <BlogSection messages={blogSection} />
        <NewsSection messages={newsSection} />
        <YoutubeSection messages={youtubeSection} />
        <YoutubeTransitionSection />
      </div>
    </main>
  );
};
