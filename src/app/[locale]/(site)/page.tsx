import { notFound } from "next/navigation";
import { MainPage } from "@/features/main/main-page";
import { isLocale } from "@/shared/config/i18n";
import { getDictionary } from "@/shared/lib/get-dictionary";

interface LocaleHomeRouteProps {
  params: Promise<{ locale: string }>;
}

export default async function LocaleHomeRoute({ params }: LocaleHomeRouteProps) {
  const { locale } = await params;

  if (!isLocale(locale)) {
    notFound();
  }

  const dict = getDictionary(locale);

  return (
    <MainPage
      locale={locale}
      heroQuickBar={dict.heroQuickBar}
      typographySection={dict.typographySection}
      medicalTeamSection={dict.medicalTeamSection}
      academicPublicationsSection={dict.academicPublicationsSection}
    />
  );
}
