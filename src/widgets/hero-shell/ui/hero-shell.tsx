"use client";

import { useRef } from "react";
import { GridBackground } from "@/shared/ui/grid-background/ui/grid-background";
import { Gnb } from "@/widgets/gnb/ui/gnb";
import { MainHero } from "@/widgets/main-hero/ui/main-hero";
import type { Locale } from "@/shared/config/i18n";
import styles from "./hero-shell.module.css";
import pageStyles from "@/app/[locale]/page.module.css";

interface HeroShellProps {
  locale: Locale;
}

export const HeroShell = ({ locale }: HeroShellProps) => {
  const transmissionSourceRef = useRef<HTMLDivElement>(null);

  return (
    <main className={pageStyles.main}>
      <div ref={transmissionSourceRef} className={styles.transmissionSource}>
        <GridBackground />
        <div className={styles.titleWrap}>
          <h1 className={styles.title} data-raster-title>
            신세계안과
          </h1>
        </div>
      </div>
      <div className={pageStyles.content}>
        <Gnb locale={locale} />
        <MainHero transmissionSourceRef={transmissionSourceRef} />
      </div>
    </main>
  );
};
