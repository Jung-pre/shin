"use client";

import { useRef } from "react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { useGSAP } from "@gsap/react";

gsap.registerPlugin(ScrollTrigger, useGSAP);

interface UseSectionRevealOptions {
  start?: string;
}

export function useSectionReveal<T extends HTMLElement>(options: UseSectionRevealOptions = {}) {
  const { start = "top 78%" } = options;
  const sectionRef = useRef<T>(null);

  useGSAP(
    () => {
      const section = sectionRef.current;
      if (!section) return;

      const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      const scopedTargets = section.querySelectorAll("[data-reveal-item]");
      const targets = scopedTargets.length > 0 ? scopedTargets : [section];

      if (reduceMotion) {
        gsap.set(targets, { autoAlpha: 1, clearProps: "all" });
        return;
      }

      // blur 제거 — 뷰포트 진입 순간마다 filter: blur → 0 페이드가 여러 섹션 동시에 발생해
      //   브라우저가 GPU 레이어를 끊임없이 재합성. opacity + translate + scale 로 동일한 느낌 유지.
      gsap.set(targets, {
        autoAlpha: 0,
        y: 42,
        scale: 0.985,
        transformOrigin: "50% 50%",
      });

      gsap.to(targets, {
        autoAlpha: 1,
        y: 0,
        scale: 1,
        duration: 1.05,
        ease: "power3.out",
        stagger: scopedTargets.length > 0 ? 0.1 : 0,
        clearProps: "opacity,visibility,transform",
        scrollTrigger: {
          trigger: section,
          start,
          once: true,
        },
      });
    },
    { scope: sectionRef },
  );

  return sectionRef;
}
