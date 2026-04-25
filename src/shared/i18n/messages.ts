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

export interface MachineSectionMachine {
  nameEn: string;
  nameKo: string;
  imageSrc: string;
  description: string;
  bgImageSrc?: string;
  headlineEyebrowLabel?: string;
  headlineTitle?: string;
  headlineDescription?: string;
  headlineCtaLabel?: string;
}

export interface MachineSectionMessages {
  eyebrowIcon: string;
  eyebrowLabel: string;
  title: string;
  description: string;
  ctaLabel: string;
  machines: MachineSectionMachine[];
}

export interface ReviewSectionReviewCard {
  imageSrc: string;
  label: string;
  href?: string;
  tab?: "vision" | "cataract";
}

export interface ReviewSectionMessages {
  eyebrowEn: string;
  title: string;
  description: string;
  ctaLabel: string;
  tabs: string[];
  featuredImageSrc: string;
  featuredAlt: string;
  featuredHref?: string;
  cards: ReviewSectionReviewCard[];
}

export interface SystemSectionItem {
  eyebrowEn: string;
  title: string;
  description: string;
  imageSrc: string;
  ctaLabel?: string;
  ctaHref?: string;
}

export interface SystemSectionMessages {
  items: SystemSectionItem[];
}

export interface BlogSectionPost {
  indexLabel: string;
  title: string;
  date: string;
  thumbnailSrc: string;
  href?: string;
}

export interface BlogSectionMessages {
  eyebrowEn: string;
  titlePrefix: string;
  titleAccent: string;
  description: string;
  ctaLabel: string;
  ctaHref?: string;
  heroImageSrc: string;
  heroTitle: string;
  heroDate: string;
  heroSourceLabel: string;
  heroHref?: string;
  posts: BlogSectionPost[];
}

export interface NewsSectionTab {
  label: string;
}

export interface NewsSectionCard {
  category: string;
  title: string;
  date: string;
  imageSrc: string;
  href?: string;
}

export interface NewsSectionMessages {
  eyebrowEn: string;
  titlePrefix: string;
  titleAccent: string;
  titleSuffix: string;
  tabAriaLabel: string;
  tabs: NewsSectionTab[];
  cards: NewsSectionCard[];
}

export interface YoutubeSectionThumbnail {
  imageSrc: string;
  alt: string;
  href?: string;
}

export interface YoutubeSectionMessages {
  titleAccent: string;
  titleSuffix: string;
  ctaLabel: string;
  ctaHref?: string;
  heroImageSrc: string;
  heroImageAlt: string;
  heroHref?: string;
  thumbnails: YoutubeSectionThumbnail[];
}

export interface FooterSectionMessages {
  ariaLabel: string;
  policyLinks: string[];
  title: string;
  hoursTitle: string;
  hours: Array<{
    label: string;
    value: string;
    mutedLabel?: string;
  }>;
  hoursNote?: string;
  contactTitle: string;
  contactSubTitle?: string;
  contactValue: string;
  brandName: string;
  companyInfoLines: Array<{
    label: string;
    value: string;
  }>;
  addressLine: string;
  parkingTowerLine: string;
  copyright: string;
  mapAlt: string;
  mapImageSrc: string;
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
  machineSection: MachineSectionMessages;
  reviewSection: ReviewSectionMessages;
  systemSection: SystemSectionMessages;
  blogSection: BlogSectionMessages;
  newsSection: NewsSectionMessages;
  youtubeSection: YoutubeSectionMessages;
  footerSection: FooterSectionMessages;
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
    machineSection: {
      eyebrowIcon: "⚙",
      eyebrowLabel: "Advanced Tech & Systems",
      title: "최첨단 시스템 도입\n혁신으로 열리는 신세계",
      description: "더 빠르고 더 정교하게, 당신이 꿈꾸던 선명함을 가장 먼저 선사합니다",
      ctaLabel: "VISUMAX 800",
      machines: [
        {
          nameEn: "VISUMAX 800",
          nameKo: "비쥬맥스 800",
          imageSrc: "/main/img_main_machine01.webp",
          description:
            "업그레이드된 스캐닝 기술을 탑재하여 10초 이내의 초고속 조사(2MHz)를 통해 수술 시간을 단축하고 각막 손상을 최소화합니다",
          headlineCtaLabel: "VISUMAX 800",
        },
        {
          nameEn: "VISUMAX 500",
          nameKo: "비쥬맥스 500",
          imageSrc: "/main/img_main_machine02.webp",
          bgImageSrc: "/main/img_main_machine_bg02.webp",
          description:
            "최첨단 펨토초 레이저 기술과 고정밀 안구 추적 시스템을 결합해 더 빠르고, 더 정교한 시력교정을 구현합니다",
          headlineEyebrowLabel: "Advanced Tech & Systems",
          headlineTitle: "최첨단 시스템 도입\n혁신으로 열리는 신세계",
          headlineDescription:
            "더 빠르고 더 정교하게, 당신이 꿈꾸던 선명함을 가장 먼저 선사합니다",
          headlineCtaLabel: "VISUMAX 500",
        },
        {
          nameEn: "Catalys laser",
          nameKo: "카탈리스 레이저",
          imageSrc: "/main/img_main_machine03.webp",
          bgImageSrc: "/main/img_main_machine_bg03.webp",
          description:
            "3D 안구 단층 촬영(OCT)이 적용된 백내장 수술 전용 레이저로, 칼날 대신 정교한 레이저를 사용하여 수술의 안전성과 정확도를 극대화합니다",
          headlineCtaLabel: "Catalys laser",
        },
      ],
    },
    reviewSection: {
      eyebrowEn: "Shinsegae Eye Clinic Patient Stories",
      title: "신세계안과 리얼후기",
      description: "실제 환자들의 경험을 통해 시력 변화와 일상을 확인해보세요",
      ctaLabel: "리얼후기 전체보기 →",
      tabs: ["시력교정후기", "백내장후기"],
      featuredImageSrc: "/main/img_main_review01.webp",
      featuredAlt: "리얼 후기 대표 이미지",
      featuredHref: "#",
      cards: [
        { imageSrc: "/main/img_main_review02.webp", label: "신세계 스마일프로", href: "#", tab: "vision" },
        { imageSrc: "/main/img_main_review02.webp", label: "신세계 스마일", href: "#", tab: "vision" },
        { imageSrc: "/main/img_main_review02.webp", label: "신세계 라식/라섹", href: "#", tab: "vision" },
        { imageSrc: "/main/img_main_review02.webp", label: "신세계 렌즈삽입술", href: "#", tab: "cataract" },
        { imageSrc: "/main/img_main_review02.webp", label: "신세계 스마일", href: "#", tab: "cataract" },
        { imageSrc: "/main/img_main_review02.webp", label: "신세계 스마일프로", href: "#", tab: "cataract" },
      ],
    },
    systemSection: {
      items: [
        {
          eyebrowEn: "60 Detailed Pre-Surgery Screenings",
          title: "수술 전, 60여 가지 정밀 검사",
          description:
            "눈의 모든 데이터를 60여 가지 항목으로 세분화하여 측정합니다\n엄격한 기준 그대로, 작은 변수까지 미리 파악하여 가장 안정적인 수술 계획을 수립합니다",
          imageSrc: "/main/img_main_system01.webp",
        },
        {
          eyebrowEn: "Advanced Sterile Surgery Suites",
          title: "대학병원급 무균 수술 시스템",
          description:
            "최첨단 장비들이 오차 없이 작동할 수 있도록 최적의 환경을 유지합니다\n대학병원 수준의 시스템을 통해 감염 위험을 방지하며,\n보이지 않는 곳의 위생까지 원칙대로 관리하여 환자가\n오직 '선명해질 결과'에만 집중할 수 있게 합니다",
          imageSrc: "/main/img_main_system02.webp",
        },
        {
          eyebrowEn: "Lifetime Care System",
          title: "수술 후 관리 시스템",
          description:
            "수술 후 정기 검진 리마인드와 시력 추적 데이터를 체계적으로 관리합니다\n한 번 신세계를 만난 분들이 평생 안심하고 눈을 맡길 수 있도록,\n광주 신세계안과가 당신의 든든한 평생 눈 주치의가 되어드립니다",
          imageSrc: "/main/img_main_system03.webp",
          ctaLabel: "신세계가 말하는 안전의 기준, 지금 확인해보세요 →",
          ctaHref: "#",
        },
      ],
    },
    blogSection: {
      eyebrowEn: "SHINSEGAE WEB BLOG",
      titlePrefix: "SHINSEGAE ",
      titleAccent: "WEB BLOG",
      description: "다양한 정보와 눈 관련 정보들까지 신세계 블로그에서 확인하세요",
      ctaLabel: "신세계 블로그 보러가기",
      ctaHref: "#",
      heroImageSrc: "/main/img_main_blog01.webp",
      heroTitle: "봄철 눈이 간지럽다면? 알레르기성 결막염 증상과 관리 방법",
      heroDate: "2026-03-26",
      heroSourceLabel: "신세계안과",
      heroHref: "#",
      posts: [
        {
          indexLabel: "01",
          title: "시력교정수술 전 꼭 알아야 할\n검사 과정과 주의사항 정리",
          date: "2026-03-26",
          thumbnailSrc: "/main/img_main_blog02.webp",
          href: "#",
        },
        {
          indexLabel: "02",
          title: "스마트폰 많이 보면 생기는 안구건조증,\n원인과 해결법은?",
          date: "2026-03-26",
          thumbnailSrc: "/main/img_main_blog03.webp",
          href: "#",
        },
        {
          indexLabel: "03",
          title: "백내장 초기 증상 놓치면 늦는다?\n치료 시기와 수술 정보 안내",
          date: "2026-03-26",
          thumbnailSrc: "/main/img_main_blog04.webp",
          href: "#",
        },
      ],
    },
    newsSection: {
      eyebrowEn: "Latest News",
      titlePrefix: "신세계안과의 ",
      titleAccent: "새로운 소식",
      titleSuffix: "을 만나보세요",
      tabAriaLabel: "뉴스 카테고리",
      tabs: [{ label: "전체" }, { label: "공지사항" }, { label: "이벤트" }, { label: "언론보도" }],
      cards: [
        {
          category: "이벤트",
          title: "수험생을 위한 시력 합격 이벤트",
          date: "2025-10-27",
          imageSrc: "/main/img_main_news01.webp",
          href: "#",
        },
        {
          category: "언론보도",
          title: "광주신세계안과, 시대교정술 이해 한...",
          date: "2026-03-20",
          imageSrc: "/main/img_main_news02.webp",
          href: "#",
        },
        {
          category: "공지사항",
          title: "3.1절 대체공휴일 휴진 안내",
          date: "2026-02-19",
          imageSrc: "/main/img_main_news03.webp",
          href: "#",
        },
        {
          category: "이벤트",
          title: "겨울방학 스마일수술 특별 Event",
          date: "2025-12-01",
          imageSrc: "/main/img_main_news04.webp",
          href: "#",
        },
      ],
    },
    youtubeSection: {
      titleAccent: "신세계안과 TV,",
      titleSuffix: "유튜브에서 신세계를 만나보세요",
      ctaLabel: "신세계안과 TV 바로가기",
      ctaHref: "#",
      heroImageSrc: "/main/img_main_youtube01.webp",
      heroImageAlt: "신세계안과 유튜브 대표 영상",
      heroHref: "#",
      thumbnails: [
        { imageSrc: "/main/img_main_youtube02.webp", alt: "유튜브 영상 썸네일 1", href: "#" },
        { imageSrc: "/main/img_main_youtube03.webp", alt: "유튜브 영상 썸네일 2", href: "#" },
        { imageSrc: "/main/img_main_youtube04.webp", alt: "유튜브 영상 썸네일 3", href: "#" },
        { imageSrc: "/main/img_main_youtube05.webp", alt: "유튜브 영상 썸네일 4", href: "#" },
        { imageSrc: "/main/img_main_youtube06.webp", alt: "유튜브 영상 썸네일 5", href: "#" },
        { imageSrc: "/main/img_main_youtube07.webp", alt: "유튜브 영상 썸네일 6", href: "#" },
      ],
    },
    footerSection: {
      ariaLabel: "사이트 푸터",
      policyLinks: ["병원소개", "이용약관", "개인정보처리방침", "비급여진료비안내", "환자의 권리와 의무"],
      title: "보이는 그 이상의 감동,\n신세계안과가 함께합니다",
      hoursTitle: "진료 시간",
      hours: [
        { label: "월-목", value: "09:00 ~ 18:00" },
        { label: "금요일", mutedLabel: "(야간진료)", value: "09:00 ~ 20:00" },
        { label: "토요일", mutedLabel: "(점심시간 없음)", value: "09:00 ~ 15:00" },
        { label: "점심시간", value: "12:30 ~ 14:00" },
      ],
      hoursNote: "* 일요일 및 공휴일 : 휴진",
      contactTitle: "고객센터",
      contactSubTitle: "(예약/상담)",
      contactValue: "1566-9988",
      brandName: "신세계안과",
      companyInfoLines: [
        { label: "상호", value: "신세계안과의원" },
        { label: "대표자", value: "김재봉" },
        { label: "사업자 등록번호", value: "410-31-55481" },
      ],
      addressLine: "광주광역시 서구 죽봉대로 92 (광천동 38번지) 신세계백화점 대각선 눈모양빌딩",
      parkingTowerLine: "광주광역시 서구 죽봉대로 94번길 7-1 (광천동 35번지)",
      copyright: "Copyright (C) Shinsegae Eye Clinic. All Rights Reserved.",
      mapAlt: "신세계안과 오시는길 지도",
      mapImageSrc: "/main/img_main_footer_map.webp",
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
    machineSection: {
      eyebrowIcon: "⚙",
      eyebrowLabel: "Advanced Tech & Systems",
      title: "State-of-the-Art Systems\nA New World of Innovation",
      description: "Faster, more precise — we bring the clarity you've dreamed of, first.",
      ctaLabel: "VISUMAX 800",
      machines: [
        {
          nameEn: "VISUMAX 800",
          nameKo: "VisuMax 800",
          imageSrc: "/main/img_main_machine01.webp",
          description:
            "Upgraded scanning technology enables ultra-fast irradiation (2MHz) in under 10 seconds, shortening surgery time and minimising corneal damage.",
          headlineCtaLabel: "VISUMAX 800",
        },
        {
          nameEn: "VISUMAX 500",
          nameKo: "VisuMax 500",
          imageSrc: "/main/img_main_machine02.webp",
          bgImageSrc: "/main/img_main_machine_bg02.webp",
          description:
            "Combining advanced femtosecond laser technology with a high-precision eye-tracking system, it enables faster and more precise vision correction.",
          headlineEyebrowLabel: "Advanced Tech & Systems",
          headlineTitle: "State-of-the-Art Systems\nA New World of Innovation",
          headlineDescription:
            "Faster, more precise — we bring the clarity you've dreamed of, first.",
          headlineCtaLabel: "VISUMAX 500",
        },
        {
          nameEn: "Catalys laser",
          nameKo: "Catalys laser",
          imageSrc: "/main/img_main_machine03.webp",
          bgImageSrc: "/main/img_main_machine_bg03.webp",
          description:
            "A cataract-surgery laser system equipped with 3D OCT, using precise laser treatment instead of blades to maximize surgical safety and accuracy.",
          headlineCtaLabel: "Catalys laser",
        },
      ],
    },
    reviewSection: {
      eyebrowEn: "Shinsegae Eye Clinic Patient Stories",
      title: "Real Patient Stories",
      description: "Discover real vision changes and everyday life through patient experiences.",
      ctaLabel: "View all stories >",
      tabs: ["Vision correction >", "Cataract"],
      featuredImageSrc: "/main/img_main_review01.webp",
      featuredAlt: "Featured patient story",
      featuredHref: "#",
      cards: [
        { imageSrc: "/main/img_main_review02.webp", label: "Shinsegae Smile Pro", href: "#", tab: "vision" },
        { imageSrc: "/main/img_main_review02.webp", label: "Shinsegae Smile", href: "#", tab: "vision" },
        { imageSrc: "/main/img_main_review02.webp", label: "Shinsegae LASIK/LASEK", href: "#", tab: "vision" },
        { imageSrc: "/main/img_main_review02.webp", label: "Shinsegae Lens Implant", href: "#", tab: "cataract" },
        { imageSrc: "/main/img_main_review02.webp", label: "Shinsegae Smile", href: "#", tab: "cataract" },
        { imageSrc: "/main/img_main_review02.webp", label: "Shinsegae Smile Pro", href: "#", tab: "cataract" },
      ],
    },
    systemSection: {
      items: [
        {
          eyebrowEn: "60 Detailed Pre-Surgery Screenings",
          title: "60+ Precision Tests Before Surgery",
          description:
            "We measure your eyes across more than 60 segmented indicators.\nBased on these results, we identify even minor variables in advance to establish the safest surgical plan.",
          imageSrc: "/main/img_main_system01.webp",
        },
        {
          eyebrowEn: "Advanced Sterile Surgery Suites",
          title: "Hospital-Grade Sterile Surgery System",
          description:
            "We maintain an optimal environment so advanced equipment can operate without error.\nThrough hospital-grade systems, we prevent infection risks and uphold hygiene standards even in unseen areas,\nallowing patients to focus solely on clear outcomes.",
          imageSrc: "/main/img_main_system02.webp",
        },
        {
          eyebrowEn: "Lifetime Care System",
          title: "Post-Surgery Care System",
          description:
            "We systematically manage post-surgery checkup reminders and vision-tracking data.\nSo that everyone who meets a new world with Shinsegae can entrust their eyes with confidence for life,\nGwangju Shinsegae Eye Clinic stands by as your lifelong eye doctor.",
          imageSrc: "/main/img_main_system03.webp",
          ctaLabel: "See Shinsegae's standard of safety now →",
          ctaHref: "#",
        },
      ],
    },
    blogSection: {
      eyebrowEn: "SHINSEGAE WEB BLOG",
      titlePrefix: "SHINSEGAE WEB ",
      titleAccent: "BLOG",
      description: "Explore eye-care insights and useful updates on the Shinsegae blog.",
      ctaLabel: "Visit Shinsegae blog",
      ctaHref: "#",
      heroImageSrc: "/main/img_main_blog01.webp",
      heroTitle: "Itchy eyes in spring? Allergic conjunctivitis signs and care",
      heroDate: "2026-03-26",
      heroSourceLabel: "Shinsegae Eye Clinic",
      heroHref: "#",
      posts: [
        {
          indexLabel: "01",
          title: "Must-know pre-op checks before vision correction surgery",
          date: "2026-03-26",
          thumbnailSrc: "/main/img_main_blog02.webp",
          href: "#",
        },
        {
          indexLabel: "02",
          title: "Staring at screens too long? Dry-eye causes and fixes",
          date: "2026-03-26",
          thumbnailSrc: "/main/img_main_blog03.webp",
          href: "#",
        },
        {
          indexLabel: "03",
          title: "Early cataract signs you should not miss and treatment timing",
          date: "2026-03-26",
          thumbnailSrc: "/main/img_main_blog04.webp",
          href: "#",
        },
      ],
    },
    newsSection: {
      eyebrowEn: "Latest News",
      titlePrefix: "Discover ",
      titleAccent: "new updates",
      titleSuffix: " from Shinsegae Eye Clinic",
      tabAriaLabel: "News categories",
      tabs: [{ label: "All" }, { label: "Notice" }, { label: "Events" }, { label: "Press" }],
      cards: [
        {
          category: "Event",
          title: "Vision success event for exam students",
          date: "2025-10-27",
          imageSrc: "/main/img_main_news01.webp",
          href: "#",
        },
        {
          category: "Press",
          title: "Shinsegae Eye Clinic, media feature on correction...",
          date: "2026-03-20",
          imageSrc: "/main/img_main_news02.webp",
          href: "#",
        },
        {
          category: "Notice",
          title: "Holiday closure notice for March 1 substitute day",
          date: "2026-02-19",
          imageSrc: "/main/img_main_news03.webp",
          href: "#",
        },
        {
          category: "Event",
          title: "Winter vacation Smile surgery special event",
          date: "2025-12-01",
          imageSrc: "/main/img_main_news04.webp",
          href: "#",
        },
      ],
    },
    youtubeSection: {
      titleAccent: "Shinsegae Eye TV,",
      titleSuffix: "discover a new world on YouTube",
      ctaLabel: "Visit Shinsegae Eye TV",
      ctaHref: "#",
      heroImageSrc: "/main/img_main_youtube01.webp",
      heroImageAlt: "Shinsegae Eye YouTube featured video",
      heroHref: "#",
      thumbnails: [
        { imageSrc: "/main/img_main_youtube02.webp", alt: "YouTube thumbnail 1", href: "#" },
        { imageSrc: "/main/img_main_youtube03.webp", alt: "YouTube thumbnail 2", href: "#" },
        { imageSrc: "/main/img_main_youtube04.webp", alt: "YouTube thumbnail 3", href: "#" },
        { imageSrc: "/main/img_main_youtube05.webp", alt: "YouTube thumbnail 4", href: "#" },
        { imageSrc: "/main/img_main_youtube06.webp", alt: "YouTube thumbnail 5", href: "#" },
        { imageSrc: "/main/img_main_youtube07.webp", alt: "YouTube thumbnail 6", href: "#" },
      ],
    },
    footerSection: {
      ariaLabel: "Site footer",
      policyLinks: ["Company", "Terms", "Privacy", "Non-covered Fees", "Patient Rights"],
      title: "Beyond clear vision,\nShinsegae Eye Clinic is with you",
      hoursTitle: "Clinic hours",
      hours: [
        { label: "Mon-Thu", value: "09:00 ~ 18:00" },
        { label: "Fri", mutedLabel: "(Night clinic)", value: "09:00 ~ 20:00" },
        { label: "Sat", mutedLabel: "(No lunch break)", value: "09:00 ~ 15:00" },
        { label: "Break", value: "12:30 ~ 14:00" },
      ],
      hoursNote: "* Closed on Sundays and public holidays",
      contactTitle: "Customer Center",
      contactSubTitle: "(Booking)",
      contactValue: "1566-9988",
      brandName: "Shinsegae Eye Clinic",
      companyInfoLines: [
        { label: "Business name", value: "Shinsegae Eye Clinic" },
        { label: "Representative", value: "Kim Jaebong" },
        { label: "Business number", value: "410-31-55481" },
      ],
      addressLine:
        "Address 92, Jukbong-daero, Seo-gu, Gwangju (Gwangcheon-dong 38)\nParking 963beon-gil 7-1, Nongseong-dong, Seo-gu, Gwangju",
      parkingTowerLine: "94beon-gil 7-1, Jukbong-daero, Seo-gu, Gwangju (Gwangcheon-dong 35)",
      copyright: "Copyright (C) Shinsegae Eye Clinic. All Rights Reserved.",
      mapAlt: "Map to Shinsegae Eye Clinic",
      mapImageSrc: "/main/img_main_footer_map.webp",
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
