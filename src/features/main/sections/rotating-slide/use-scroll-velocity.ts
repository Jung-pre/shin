"use client";

import { useEffect, useRef } from "react";

/**
 * 스크롤 속도를 EMA(지수이동평균)로 부드럽게 수집해 ref 로 반환한다.
 *
 * 반환 ref 의 `.current` 단위:
 *   - 정규화된 velocity. `|v|` 가 작으면 0 근방, 빠르게 스크롤 시 1~2 수준.
 *   - Lenis 인스턴스를 별도로 노출하지 않고, `window.scrollY` 의 프레임 간 델타를
 *     `window.innerHeight` 로 나눈 vh/sec 을 사용 → 뷰포트 크기에 독립.
 *
 * 왜 ref 로?
 *   - 매 프레임 setState 하면 전체 React 트리 리렌더가 일어나 애니메이션 자체가 불안정해짐.
 *   - R3F useFrame 이나 shader uniform 에 바로 꽂기 위해 mutable ref 가 적합.
 *
 * 누가 쓰나?
 *   - Rotating slide 의 셰이더 `uVelocity` — 카드 UV 를 스크롤 속도만큼 당겨
 *     "관성이 남아있는" 느낌을 만든다.
 */
export function useScrollVelocity(isActive = true) {
  const velocityRef = useRef(0);
  const isActiveRef = useRef(isActive);

  useEffect(() => {
    if (typeof window === "undefined") return;
    let raf = 0;
    let lastY = window.scrollY;
    let lastT = performance.now();

    const loop = () => {
      if (!isActiveRef.current) {
        velocityRef.current = 0;
        raf = 0;
        return;
      }

      const now = performance.now();
      const dt = Math.max(1, now - lastT); // ms, 0 방지
      const y = window.scrollY;
      const vh = window.innerHeight || 1;
      // vh/sec 단위로 정규화
      const instant = ((y - lastY) / vh) * (1000 / dt);
      lastY = y;
      lastT = now;

      // EMA — 빠른 반응(관성) 이 필요한 영역이라 0.18 정도.
      //   - 너무 낮으면 (<0.08) 반응이 느려서 관성 효과가 약함.
      //   - 너무 높으면 (>0.3) 노이즈에 민감해 떨림.
      const prev = velocityRef.current;
      velocityRef.current = prev + (instant - prev) * 0.18;

      if (Math.abs(velocityRef.current) < 0.001 && Math.abs(instant) < 0.001) {
        velocityRef.current = 0;
        raf = 0;
        return;
      }
      raf = requestAnimationFrame(loop);
    };

    const startLoop = () => {
      if (!isActiveRef.current || raf) return;
      lastT = performance.now() - 16;
      raf = requestAnimationFrame(loop);
    };

    window.addEventListener("scroll", startLoop, { passive: true });

    return () => {
      window.removeEventListener("scroll", startLoop);
      if (raf) cancelAnimationFrame(raf);
    };
  }, []);

  useEffect(() => {
    isActiveRef.current = isActive;
    if (!isActive) {
      velocityRef.current = 0;
    }
  }, [isActive]);

  return velocityRef;
}
