import { notFound } from "next/navigation";
import { HeroShell } from "@/widgets/hero-shell/ui/hero-shell";
import { isLocale } from "@/shared/config/i18n";

interface LocalePageProps {
  params: Promise<{ locale: string }>;
}

export default async function LocaleHomePage({ params }: LocalePageProps) {
  const { locale } = await params;

  if (!isLocale(locale)) {
    notFound();
  }

  return <HeroShell locale={locale} />;
}
