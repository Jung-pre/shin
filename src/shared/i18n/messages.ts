import type { Locale } from "@/shared/config/i18n";

export interface MainMessages {
  badge: string;
  title: string;
  description: string;
}

export interface HeroQuickBarDepartmentOption {
  value: string;
  label: string;
}

export interface HeroQuickBarMessages {
  /** 실제 상담 전화번호로 교체 (예: tel:+82-62-123-4567) */
  phoneHref: string;
  headlineLead: string;
  headlineRest: string;
  namePlaceholder: string;
  contactPlaceholder: string;
  departmentPlaceholder: string;
  departmentOptions: HeroQuickBarDepartmentOption[];
  consentLabel: string;
  consentViewDetail: string;
  submit: string;
  phoneConsult: string;
  onlineReservation: string;
  events: string;
  directions: string;
}

export interface TypographySlideMessages {
  lineEn: string;
  lineKo: string;
}

export interface TypographySectionMessages {
  slides: TypographySlideMessages[];
}

export interface MedicalTeamSectionMessages {
  eyebrow: string;
  titleLine1: string;
  titleLine2: string;
  ctaLabel: string;
}

export interface AcademicPublicationsSectionMessages {
  eyebrowEn: string;
  title: string;
  description: string;
  ctaLabel: string;
  /** 카드 호버 시 글래스 버튼 라벨 */
  cardViewMore: string;
}

export interface Dictionary {
  seo: {
    title: string;
    description: string;
  };
  main: MainMessages;
  heroQuickBar: HeroQuickBarMessages;
  typographySection: TypographySectionMessages;
  medicalTeamSection: MedicalTeamSectionMessages;
  academicPublicationsSection: AcademicPublicationsSectionMessages;
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
    heroQuickBar: {
      phoneHref: "tel:+82-62-000-0000",
      headlineLead: "신세계를 만나는",
      headlineRest: "가장 빠른 방법",
      namePlaceholder: "이름",
      contactPlaceholder: "연락처",
      departmentPlaceholder: "진료과목",
      departmentOptions: [
        { value: "vision", label: "시력교정" },
        { value: "cataract", label: "백내장" },
        { value: "dry-eye", label: "안구건조증" },
        { value: "other", label: "기타" },
      ],
      consentLabel: "개인정보 수집·이용 동의",
      consentViewDetail: "내용보기",
      submit: "빠른상담",
      phoneConsult: "전화상담",
      onlineReservation: "온라인예약",
      events: "이벤트",
      directions: "오시는길",
    },
    typographySection: {
      slides: [
        {
          lineEn: "The world your eyes are destined to meet",
          lineKo: "당신의 눈이 만날 세상",
        },
        {
          lineEn: "In-depth diagnostics for a vision of perfection",
          lineKo: "깊이 있는 진단, 완성도 높은 시야",
        },
        {
          lineEn: "Patient-first care : Shinsegae Eye Clinic",
          lineKo: "환자 중심의 신세계안과",
        },
      ],
    },
    medicalTeamSection: {
      eyebrow: "의료진 9인의 경험으로 완성되는 선명한 기준",
      titleLine1: "당신이 마주할 신세계,",
      titleLine2: "신세계안과 전문의가 함께합니다",
      ctaLabel: "신세계 의료진 전체보기 →",
    },
    academicPublicationsSection: {
      eyebrowEn: "Academic Activities and Publications",
      title: "학술활동 및 논문",
      description:
        "수술의 정교함과 안전을 뒷받침하는 학술적 성취와 연구의 기록입니다\n지속적인 논문 발표와 학술 활동을 통해 더 앞선 의료 기준을 증명합니다",
      ctaLabel: "학술활동 및 논문 전체보기 →",
      cardViewMore: "View more",
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
    heroQuickBar: {
      phoneHref: "tel:+82-62-000-0000",
      headlineLead: "The fastest way to",
      headlineRest: "meet Shinsegae",
      namePlaceholder: "Name",
      contactPlaceholder: "Phone",
      departmentPlaceholder: "Department",
      departmentOptions: [
        { value: "vision", label: "Vision correction" },
        { value: "cataract", label: "Cataract" },
        { value: "dry-eye", label: "Dry eye" },
        { value: "other", label: "Other" },
      ],
      consentLabel: "I agree to the collection and use of personal information",
      consentViewDetail: "View details",
      submit: "Quick consult",
      phoneConsult: "Call",
      onlineReservation: "Book online",
      events: "Events",
      directions: "Directions",
    },
    typographySection: {
      slides: [
        {
          lineEn: "The world your eyes are destined to meet",
          lineKo: "당신의 눈이 만날 세상",
        },
        {
          lineEn: "In-depth diagnostics for a vision of perfection",
          lineKo: "깊이 있는 진단, 완성도 높은 시야",
        },
        {
          lineEn: "Patient-first care : Shinsegae Eye Clinic",
          lineKo: "환자 중심의 신세계안과",
        },
      ],
    },
    medicalTeamSection: {
      eyebrow: "A clear standard built by 9 specialists",
      titleLine1: "A new world for your vision,",
      titleLine2: "guided by Shinsegae Eye specialists",
      ctaLabel: "View all Shinsegae specialists →",
    },
    academicPublicationsSection: {
      eyebrowEn: "Academic Activities and Publications",
      title: "Academic activities & publications",
      description:
        "A record of scholarly achievement and research that supports surgical precision and safety.\nThrough ongoing publications and academic work, we demonstrate a higher standard of care.",
      ctaLabel: "View all academic activities & publications →",
      cardViewMore: "View more",
    },
  },
};
