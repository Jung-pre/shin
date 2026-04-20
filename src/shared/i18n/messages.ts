import type { Locale } from "@/shared/config/i18n";

export interface MainMessages {
  badge: string;
  title: string;
  description: string;
}

export interface Dictionary {
  seo: {
    title: string;
    description: string;
  };
  main: MainMessages;
}

export const dictionaries: Record<Locale, Dictionary> = {
  ko: {
    seo: {
      title: "정밀하고 안전한 눈 건강 솔루션",
      description:
        "광주신세계안과는 첨단 장비와 의료진의 정밀 진료로 환자의 시력을 세심하게 관리합니다.",
    },
    main: {
      badge: "Gwangju Shinsegae Eye Clinic",
      title: "더 선명한 내일을 위한\n프리미엄 안과 케어",
      description:
        "정밀 진단, 맞춤형 수술 계획, 체계적인 사후 관리까지.\n광주신세계안과의 통합 진료 시스템을 경험하세요.",
    },
  },
  en: {
    seo: {
      title: "Advanced Vision Care in Gwangju",
      description:
        "Gwangju Shinsegae Eye Clinic delivers precise diagnosis, personalized treatment, and trusted eye care outcomes.",
    },
    main: {
      badge: "Gwangju Shinsegae Eye Clinic",
      title: "Premium Eye Care for\nSharper Tomorrows",
      description:
        "From high-resolution diagnostics to personalized surgery plans and follow-up care, we build complete vision journeys.",
    },
  },
};
