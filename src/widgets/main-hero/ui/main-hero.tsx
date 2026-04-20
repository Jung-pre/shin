"use client";

import dynamic from "next/dynamic";
import { useRef, type RefObject } from "react";
import gsap from "gsap";
import { useGSAP } from "@gsap/react";
import styles from "./main-hero.module.css";

const GlassOrbsScene = dynamic(
  () =>
    import("@/shared/ui/glass-orbs/ui/glass-orbs-scene").then((mod) => mod.GlassOrbsScene),
  { ssr: false },
);

gsap.registerPlugin(useGSAP);

interface MainHeroProps {
  transmissionSourceRef: RefObject<HTMLElement | null>;
}

export const MainHero = ({ transmissionSourceRef }: MainHeroProps) => {
  const sectionRef = useRef<HTMLElement>(null);
  const orbStageRef = useRef<HTMLDivElement>(null);
  const introPlayedRef = useRef(false);

  useGSAP(
    () => {
      if (introPlayedRef.current || !orbStageRef.current) {
        return;
      }
      introPlayedRef.current = true;
      gsap.fromTo(orbStageRef.current, { y: 36 }, { y: 0, duration: 1, ease: "power3.out" });
    },
    { scope: sectionRef },
  );

  return (
    <section ref={sectionRef} className={styles.hero}>
      <div ref={orbStageRef} className={styles.orbStage}>
        <GlassOrbsScene transmissionSourceRef={transmissionSourceRef} />
      </div>
    </section>
  );
};
