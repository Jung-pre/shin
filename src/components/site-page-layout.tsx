import type { ReactNode } from "react";
import { Gnb } from "@/components/gnb";
import type { Locale } from "@/shared/config/i18n";
import styles from "./site-page-layout.module.css";

/** 홈을 제외한 일반 페이지 — GNB + 본문만. */
export interface SitePageLayoutProps {
  locale: Locale;
  children: ReactNode;
}

export function SitePageLayout({ locale, children }: SitePageLayoutProps) {
  return (
    <main className={styles.main}>
      <Gnb locale={locale} />
      <div className={styles.body}>{children}</div>
    </main>
  );
}
