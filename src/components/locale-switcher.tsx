"use client";

import clsx from "clsx";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { locales, type Locale } from "@/shared/config/i18n";
import styles from "./locale-switcher.module.css";

interface LocaleSwitcherProps {
  currentLocale: Locale;
}

const languageLabels: Record<Locale, string> = {
  ko: "KR",
  en: "EN",
};

const getSwitchPath = (pathname: string, nextLocale: Locale) => {
  const segments = pathname.split("/");

  if (segments.length > 1 && locales.includes(segments[1] as Locale)) {
    segments[1] = nextLocale;
    return segments.join("/") || `/${nextLocale}`;
  }

  return `/${nextLocale}${pathname === "/" ? "" : pathname}`;
};

export const LocaleSwitcher = ({ currentLocale }: LocaleSwitcherProps) => {
  const pathname = usePathname();

  return (
    <div className={styles.switcher} aria-label="Language switcher">
      {locales.map((locale) => (
        <Link
          key={locale}
          href={getSwitchPath(pathname, locale)}
          className={clsx(styles.button, {
            [styles.active]: locale === currentLocale,
          })}
          prefetch={false}
        >
          {languageLabels[locale]}
        </Link>
      ))}
    </div>
  );
};
