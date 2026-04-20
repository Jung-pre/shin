import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getDictionary } from "@/shared/lib/get-dictionary";
import { isLocale, locales, type Locale } from "@/shared/config/i18n";

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

  return <>{children}</>;
}

export type { Locale };
