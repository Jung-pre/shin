import Link from "next/link";
import type { Locale } from "@/shared/config/i18n";
import styles from "./gnb.module.css";

interface GnbProps {
  locale: Locale;
}

interface NavItem {
  label: string;
  href: string;
}

const navItems: Record<Locale, NavItem[]> = {
  ko: [
    { label: "신세계안과", href: "/about" },
    { label: "신세계 시력교정", href: "/vision-correction" },
    { label: "신세계 백내장", href: "/cataract" },
    { label: "신세계 안질환", href: "/eye-disease" },
    { label: "커뮤니티", href: "/community" },
    { label: "고객지원", href: "/support" },
    { label: "고객후기", href: "/reviews" },
  ],
  en: [
    { label: "About", href: "/about" },
    { label: "Vision Care", href: "/vision-correction" },
    { label: "Cataract", href: "/cataract" },
    { label: "Eye Disease", href: "/eye-disease" },
    { label: "Community", href: "/community" },
    { label: "Support", href: "/support" },
    { label: "Reviews", href: "/reviews" },
  ],
};

const accountLabel: Record<Locale, string> = {
  ko: "로그인 | 회원가입",
  en: "Login | Sign up",
};

export const Gnb = ({ locale }: GnbProps) => {
  const items = navItems[locale];

  return (
    <header className={styles.header}>
      <nav className={styles.nav} aria-label="Global navigation">
        <Link href={`/${locale}`} className={styles.logo} prefetch={false}>
          <svg xmlns="http://www.w3.org/2000/svg" width="53" height="33" viewBox="0 0 53 33" fill="none">
            <path d="M52.322 16.1881C52.322 25.1317 45.0723 32.3814 36.1287 32.3814C27.1851 32.3814 19.9354 25.1317 19.9354 16.1881C19.9354 7.2445 27.1851 0 36.1287 0C45.0723 0 52.322 7.24972 52.322 16.1881Z" fill="#DBDBDB"/>
            <path d="M32.3866 16.1881C32.3866 25.1317 25.1369 32.3814 16.1933 32.3814C7.24971 32.3814 0 25.1317 0 16.1881C0 7.2445 7.24971 0 16.1933 0C25.1369 0 32.3866 7.24972 32.3866 16.1881Z" fill="white"/>
          </svg>
          <span>{locale === "ko" ? "신세계안과" : "Shinsegae Eye"}</span>
        </Link>
        <ul className={styles.menu}>
          {items.map((item) => (
            <li key={item.href}>
              <Link href={`/${locale}${item.href}`} className={styles.menuLink} prefetch={false}>
                {item.label}
              </Link>
            </li>
          ))}
        </ul>
        <Link href={`/${locale}/auth`} className={styles.account} prefetch={false}>
          {accountLabel[locale]}
        </Link>
      </nav>
    </header>
  );
};
