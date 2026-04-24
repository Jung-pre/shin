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

/**
 * 3D 글래스 마운트 전략 (하이브리드):
 *
 * Desktop (>= MIN_WIDTH_PX):
 *   - 페이지 초기 마운트 이후 언마운트하지 않고 상시 유지.
 *   - `frameloop="demand"` + MouseTilt/Transmission 훅의 "보이지 않으면 invalidate/redraw 스킵"
 *     가드로 idle 구간 GPU/CPU ≈ 0. 재마운트 스파이크(WebGL init + HDR fetch + CSG build) 제거
 *     → 상/하단 크로스페이드 타이밍 밀림 문제 해결.
 *   - 상단/하단 zone 은 더 이상 mount toggle 이 아니라 "variant (img_hero | img_frame) 토글" 용.
 *
 * Mobile (< MIN_WIDTH_PX):
 *   - 히어로 구간만 마운트, 벗어나면 언마운트 (기존 전략 유지).
 *   - 하단 글래스는 비활성 (MIN_WIDTH_PX 가드).
 *   - 저사양 GPU/메모리 예산 보호.
 *
 * 상단(히어로) zone — 모바일 마운트 토글 + 공통 variant 토글:
 *   - REMOUNT_SCROLL_VH (0.18) 위로 올라오면 (모바일) 마운트 / variant=top
 *   - UNMOUNT_SCROLL_VH (0.55) 아래로 내려가면 (모바일) 언마운트
 *
 * 하단(피날레) zone — youtubeBottomRef sentinel 기준, desktop variant 토글 용:
 *   - BOTTOM_ZONE_ENTER_VH (3.0) — sentinel.top < vh * 3.0 이면 variant=bottom
 *                                  (img_frame.webp 프리로드 시간 확보)
 *   - BOTTOM_ZONE_EXIT_VH  (3.3) — sentinel.top > vh * 3.3 이면 상단 우선권 회수
 */
const GLASS_ORBS_UNMOUNT_SCROLL_VH = 0.55;
const GLASS_ORBS_REMOUNT_SCROLL_VH = 0.18;
const GLASS_ORBS_BOTTOM_ZONE_ENTER_VH = 3.0;
const GLASS_ORBS_BOTTOM_ZONE_EXIT_VH = 3.3;
/** 데스크탑 상시 마운트 기준 뷰포트 폭. 이 이하는 모바일 언마운트 전략. */
const GLASS_ORBS_DESKTOP_MIN_WIDTH_PX = 768;

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
  /**
   * 그리드가 "가려지는 경계" 를 표시하는 sentinel ref.
   * DOM 상 MedicalTeam 과 AcademicPublications 사이에 0px div 를 두고,
   * 이 센티넬의 rect.top 이 뷰포트 top 보다 위로 올라가면 (rect.top <= 0)
   * AcademicPublications(#fff) 가 그리드를 완전히 덮은 상태로 간주한다.
   */
  const gridBoundaryRef = useRef<HTMLDivElement>(null);
  /**
   * 유튜브 섹션 하단 sentinel — 페이지 끝 글래스 페이드인의 anchor.
   * 섹션 높이가 바뀌어도 DOM 위치만 따라가게 두면 자동으로 트리거가 맞춰진다.
   */
  const youtubeBottomRef = useRef<HTMLDivElement>(null);
  const [isGridVisible, setIsGridVisible] = useState(true);
  const [isGlassOrbsMounted, setIsGlassOrbsMounted] = useState(GLASS_ORBS_ENABLED);
  /**
   * 현재 마운트된 글래스가 어느 존을 위한 것인지.
   *   - "top" = 히어로 (굴절 이미지 on) / "bottom" = 페이지 피날레 (투명 유리 모드)
   * 한 쌍의 GlassOrbsScene 인스턴스를 두 존에서 공유하되 variant 에 따라 굴절 이미지만 토글한다.
   */
  const [glassOrbsVariant, setGlassOrbsVariant] = useState<"top" | "bottom">(
    "top",
  );
  /**
   * 기본 진입부터 "3D 준비 전엔 SVG 우선" 정책을 사용한다.
   * (webp 텍스처/첫 프레임 준비가 끝나면 onFirstFrameReady 에서 true 로 전환)
   */
  const [isGlassOrbsReady, setIsGlassOrbsReady] = useState(false);
  /**
   * true = 역방향 재진입으로 인한 리마운트 상황.
   * SvgGlassOverlay 에서 "첫 로드" vs "역방향 재진입"을 구분하는 데 쓴다.
   *   - false(첫 로드): GSAP 인트로가 글래스를 책임지므로 SVG 레이어를 건드리지 않음.
   *   - true (리마운트): SVG 를 즉시 보여주고 glassReady 신호 오면 부드럽게 전환.
   */
  const [isGlassRemount, setIsGlassRemount] = useState(false);
  const hasGlassOrbsUnmountedRef = useRef(false);
  const needReadyResetOnRemountRef = useRef(false);

  // 그리드가 "실제로 화면에 보이는 구간" 을 결정한다.
  // 섹션 배경 조사 결과:
  //   Hero/Typography/RotatingSlide/MedicalTeam → 배경 transparent → 그리드 보임
  //   AcademicPublications(#fff) 부터 끝까지 → 그리드 가려짐
  // → MedicalTeam 과 AcademicPublications 사이의 sentinel 이 뷰포트 top 을
  //   지나는 순간을 기준으로 isGridVisible 을 토글.
  useEffect(() => {
    const el = gridBoundaryRef.current;
    if (!el) return;

    let rafId: number | null = null;
    let scheduled = false;

    const evaluate = () => {
      scheduled = false;
      rafId = null;
      const rect = el.getBoundingClientRect();
      // sentinel 이 뷰포트 top 아래에 있으면 그 위쪽(= 투명 섹션들) 이 현재
      // 뷰포트에 노출된 상태 → 그리드가 보임. top <= 0 이면 AcademicPublications
      // 가 뷰포트를 모두 덮고 있는 상태 → 그리드 가려짐.
      const visible = rect.top > 0;
      setIsGridVisible((prev) => (prev === visible ? prev : visible));
    };

    const schedule = () => {
      if (scheduled) return;
      scheduled = true;
      rafId = window.requestAnimationFrame(evaluate);
    };

    evaluate();
    window.addEventListener("scroll", schedule, { passive: true });
    window.addEventListener("resize", schedule);
    return () => {
      window.removeEventListener("scroll", schedule);
      window.removeEventListener("resize", schedule);
      if (rafId !== null) window.cancelAnimationFrame(rafId);
    };
  }, []);

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
    if (!isGlassOrbsMounted) return;
    if (!needReadyResetOnRemountRef.current) return;
    // 역방향 재진입 리마운트: SVG 즉시 대기 모드로 전환.
    setIsGlassOrbsReady(false);
    setIsGlassRemount(true);
    needReadyResetOnRemountRef.current = false;
  }, [isGlassOrbsMounted]);

  /**
   * 성능: scroll 리스너를 하나로 통합한다.
   * - 이전엔 (1) 글래스 mount 계산 (2) grid hot 마킹 두 개의 scroll/wheel
   *   리스너가 Lenis RAF 마다 각자 setState 를 찍어 프레임당 비용이 쌓였다.
   * - 여기선 하나의 passive scroll 리스너에서 두 작업을 rAF 로 묶어 처리.
   */
  useEffect(() => {
    let rafId: number | null = null;
    let scheduled = false;

    // sentinel 의 "문서 기준 절대 Y 좌표" 캐시 — getBoundingClientRect 는 layout 을
    // 강제하므로 매 프레임마다 호출하지 않고, 초기 1회 + resize + ResizeObserver 이벤트
    // 로만 갱신한다. 이후엔 `sentinelAbsY - scrollY` 계산으로 viewport-relative top 을
    // 유추할 수 있어 per-frame layout read 를 완전히 제거할 수 있다.
    let sentinelAbsY = Number.POSITIVE_INFINITY;
    const refreshSentinelAbsY = () => {
      const el = youtubeBottomRef.current;
      if (!el) {
        sentinelAbsY = Number.POSITIVE_INFINITY;
        return;
      }
      const rect = el.getBoundingClientRect();
      sentinelAbsY = rect.top + window.scrollY;
    };

    const runFrame = () => {
      scheduled = false;
      rafId = null;

      if (GLASS_ORBS_ENABLED) {
        const vh = window.innerHeight || 1;
        const y = window.scrollY;
        const unmountAt = vh * GLASS_ORBS_UNMOUNT_SCROLL_VH;
        const remountAt = vh * GLASS_ORBS_REMOUNT_SCROLL_VH;

        const isDesktop =
          window.innerWidth >= GLASS_ORBS_DESKTOP_MIN_WIDTH_PX;
        // per-frame getBoundingClientRect 대신 캐시된 절대 좌표에서 역산.
        const sentinelTop = sentinelAbsY - y;
        const bottomEnterPx = vh * GLASS_ORBS_BOTTOM_ZONE_ENTER_VH;
        const bottomExitPx = vh * GLASS_ORBS_BOTTOM_ZONE_EXIT_VH;

        const inTopZone = y < remountAt;
        const inBottomZone = isDesktop && sentinelTop < bottomEnterPx;
        const farFromTop = y > unmountAt;
        const farFromBottom = !isDesktop || sentinelTop > bottomExitPx;

        setIsGlassOrbsMounted((prev) => {
          // 데스크탑: 첫 마운트 이후엔 상시 유지 (언마운트 스파이크 제거).
          //   variant 토글만 수행 → idle 구간은 frameloop="demand" + 가드로 0 비용.
          if (isDesktop) {
            if (!prev) {
              // 초기 또는 리사이즈로 desktop 진입 — 바로 마운트.
              return true;
            }
            return prev;
          }

          // 모바일: 기존 "히어로 구간 한정" 전략 유지.
          if (prev && farFromTop && farFromBottom) {
            hasGlassOrbsUnmountedRef.current = true;
            return false;
          }
          if (!prev && (inTopZone || inBottomZone)) {
            if (hasGlassOrbsUnmountedRef.current) {
              needReadyResetOnRemountRef.current = true;
            }
            return true;
          }
          return prev;
        });

        // Variant 토글 (데스크탑/모바일 공통) — 상단 우선, 그 외 bottom zone 진입 시 전환.
        if (inTopZone) {
          setGlassOrbsVariant("top");
        } else if (inBottomZone) {
          setGlassOrbsVariant("bottom");
        }
      }
    };

    const schedule = () => {
      if (scheduled) return;
      scheduled = true;
      rafId = window.requestAnimationFrame(runFrame);
    };

    // 초기 sentinel 좌표 측정 — DOM 이 아직 없으면 다음 프레임에 재시도.
    const initialSentinelRead = () => {
      refreshSentinelAbsY();
      if (!Number.isFinite(sentinelAbsY)) {
        requestAnimationFrame(initialSentinelRead);
      }
    };
    initialSentinelRead();

    // 동적 import 된 하단 섹션이 마운트되며 문서 높이가 변할 수 있으므로
    // <main> 전체에 ResizeObserver 를 걸어 그때마다 sentinel 좌표를 재측정.
    let ro: ResizeObserver | null = null;
    if (typeof ResizeObserver !== "undefined" && mainRef.current) {
      ro = new ResizeObserver(() => {
        refreshSentinelAbsY();
      });
      ro.observe(mainRef.current);
    }

    const handleResize = () => {
      refreshSentinelAbsY();
      schedule();
    };

    // 초기 1회 동기 실행 (언마운트 기준 첫 판정)
    if (!GLASS_ORBS_ENABLED) {
      setIsGlassOrbsMounted(false);
    } else {
      runFrame();
    }

    // 스크롤마다 runFrame 을 rAF 로 배칭. wheel 리스너는 제거했다 —
    // 기존에는 "스크롤 핫" 표식을 위해 setState + setTimeout 을 매 스크롤마다 걸었으나
    // 해당 상태를 소비하던 grid 색상 보간을 제거하면서 존재 이유가 사라짐.
    window.addEventListener("scroll", schedule, { passive: true });
    window.addEventListener("resize", handleResize);
    return () => {
      window.removeEventListener("scroll", schedule);
      window.removeEventListener("resize", handleResize);
      ro?.disconnect();
      if (rafId !== null) window.cancelAnimationFrame(rafId);
    };
  }, []);

  return (
    <main ref={mainRef} className={styles.root}>
      <div className={styles.gridFixed} aria-hidden>
        <GridBackground visible={isGridVisible} />
      </div>
      {GLASS_ORBS_ENABLED ? (
        <>
          <div ref={glassLayerRef} className={styles.glassLayer}>
            {/* glassLayerRef 는 크로스페이드 opacity 점유 → 등장 모션은 이 내부 래퍼가 담당 */}
            <div ref={glassIntroRef} className={styles.glassIntroWrap}>
              {isGlassOrbsMounted ? (
                <GlassOrbsScene
                  sourceImageUrl={
                    glassOrbsVariant === "bottom"
                      ? "/main/img_frame.webp"
                      : "/main/img_hero.webp"
                  }
                  targetRef={
                    glassOrbsVariant === "bottom" ? undefined : heroTitleRef
                  }
                  srcFocusY={glassOrbsVariant === "bottom" ? 0.5 : 0.25}
                  onFirstFrameReady={() => {
                    setIsGlassOrbsReady(true);
                    setIsGlassRemount(false);
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
            isRemount={isGlassRemount}
            onGlassReady={() => setIsGlassRemount(false)}
            bottomGlassAnchorRef={youtubeBottomRef}
          />
        </>
      ) : null}
      <div className={styles.foreground}>
        <MainHero heroQuickBar={heroQuickBar} locale={locale} titleRef={heroTitleRef} />
        <TypographyScrollSection messages={typographySection} />
        <RotatingSlideSection />
        <MedicalTeamSection messages={medicalTeamSection} />
        {/* 그리드 가시 구간 경계 — AcademicPublications(#fff) 가 여기부터 시작 */}
        <div ref={gridBoundaryRef} aria-hidden style={{ width: "100%", height: 0 }} />
        <AcademicPublicationsSection messages={academicPublicationsSection} />
        <MachineSection messages={machineSection} />
        <ReviewSection messages={reviewSection} />
        <SystemSection messages={systemSection} />
        <BlogSection messages={blogSection} />
        <NewsSection messages={newsSection} />
        <YoutubeSection messages={youtubeSection} />
        {/* 하단 글래스 페이드인 anchor — 유튜브 섹션 바로 뒤에 0px sentinel */}
        <div ref={youtubeBottomRef} aria-hidden style={{ width: "100%", height: 0 }} />
        <YoutubeTransitionSection />
      </div>
    </main>
  );
};
