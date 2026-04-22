import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getDictionary } from "@/shared/lib/get-dictionary";
import { isLocale, locales, type Locale } from "@/shared/config/i18n";
import { Gnb } from "@/components/gnb";
import { FooterSection } from "@/components/footer/footer-section";

interface LocaleLayoutProps {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}

export async function generateStaticParams() {
  return locales.map((locale) => ({ locale }));
}

export async function generateMetadata({ params }: LocaleLayoutProps): Promise<Metadata> {
  const { locale } = await params;

  if (!isLocale(locale)) {
    return {};
  }

  const dictionary = getDictionary(locale);
  const path = locale === "ko" ? "/ko" : "/en";

  return {
    title: dictionary.seo.title,
    description: dictionary.seo.description,
    alternates: {
      canonical: path,
      languages: {
        ko: "/ko",
        en: "/en",
      },
    },
    openGraph: {
      title: dictionary.seo.title,
      description: dictionary.seo.description,
      locale: locale === "ko" ? "ko_KR" : "en_US",
      type: "website",
      url: path,
    },
  };
}

export default async function LocaleLayout({ children, params }: LocaleLayoutProps) {
  const { locale } = await params;

  if (!isLocale(locale)) {
    notFound();
  }

  // Gnb / Footer 는 모든 하위 라우트에서 공유되어야 하는 전역 UI 이므로
  // 여기(레이아웃) 에서 고정 렌더한다. 라우트 전환 시에도 언마운트 되지 않아
  // 스크롤 리스너/애니메이션 상태가 유지된다.
  const dictionary = getDictionary(locale);

  return (
    <div lang={locale} data-locale={locale} className="locale-root">
      <Gnb locale={locale} />
      {children}
      <FooterSection messages={dictionary.footerSection} />
    </div>
  );
}

export type { Locale };
