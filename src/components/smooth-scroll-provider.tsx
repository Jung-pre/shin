"use client";

import { useEffect } from "react";
import Lenis from "lenis";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";

gsap.registerPlugin(ScrollTrigger);

/**
 * 전역 Smooth Scroll — Lenis 기반.
 *
 * 설계 의도:
 *  - 기존 `window.scrollY` 리더 / `window.addEventListener("scroll")` 구독자와 호환되어야 한다
 *    (글래스 크로스페이드, `ScrollTrigger`, `main-page` 의 hot-scroll 타이머 등). Lenis 는
 *    기본 동작이 "wheel 이벤트를 가로채서 자체 RAF 로 animatedScroll 을 진행시키고
 *    `window.scrollTo(0, animatedScroll)` 로 네이티브 스크롤을 움직이는" 방식이므로,
 *    브라우저는 정상적으로 `scroll` 이벤트를 발행하고 `window.scrollY` 도 실제로 변한다 →
 *    기존 로직 수정 없이 스므스 스크롤만 얹을 수 있다.
 *
 *  - `ScrollTrigger.update` 를 Lenis 의 `scroll` 이벤트에서 즉시 호출해 줌으로써
 *    GSAP 애니메이션이 Lenis 의 보간된 스크롤 위치와 프레임 단위로 동기화된다.
 *
 *  - `gsap.ticker.add` 에 Lenis 의 `raf` 를 꽂아 브라우저의 별도 RAF 루프와 GSAP 의
 *    내부 ticker 가 갈라지지 않게 한다 (한 RAF 안에서 Lenis → GSAP 순서로 업데이트).
 *    `gsap.ticker.lagSmoothing(0)` 는 장시간 탭 비활성화 후 복귀 시 GSAP 의 누적 지연
 *    보정이 Lenis 의 보간과 충돌해 튀는 현상을 제거한다.
 *
 *  - `prefers-reduced-motion: reduce` 환경에서는 Lenis 를 아예 초기화하지 않아
 *    접근성 요구를 충족하고, 저사양 기기에서도 네이티브 스크롤로 폴백된다.
 */
export function SmoothScrollProvider() {
  useEffect(() => {
    if (typeof window === "undefined") return;
    const prefersReduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (prefersReduced) return;

    const lenis = new Lenis({
      // 보간 세기 — 값이 커질수록 관성이 오래 남고 "미끄러지는" 느낌이 강해짐.
      lerp: 0.1,
      // 마우스 휠 이벤트를 Lenis 가 가로채서 부드럽게 보간 처리.
      smoothWheel: true,
      // 터치 스크롤은 네이티브 그대로 — 모바일에서 Lenis 관성이 사파리 overscroll/bounce 와
      // 충돌해 "탕" 하는 느낌을 유발하기 쉬움. 기본(native) 유지.
      syncTouch: false,
    });

    const handleLenisScroll = () => ScrollTrigger.update();
    lenis.on("scroll", handleLenisScroll);

    const tick = (time: number) => {
      // gsap.ticker 는 초 단위, Lenis.raf 는 ms 단위.
      lenis.raf(time * 1000);
    };
    gsap.ticker.add(tick);
    gsap.ticker.lagSmoothing(0);

    return () => {
      gsap.ticker.remove(tick);
      lenis.off("scroll", handleLenisScroll);
      lenis.destroy();
    };
  }, []);

  return null;
}
