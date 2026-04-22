# 광주신세계안과 — 프론트엔드

Next.js(App Router) 기반의 메인 랜딩·클리닉 소개 사이트입니다. 히어로·스크롤 인터랙션·3D(선택)·다국어(ko/en)를 포함합니다.

## 기술 스택

| 구분 | 사용 |
|------|------|
| 런타임 | [Next.js](https://nextjs.org/) 16 (App Router) |
| UI | React 19, TypeScript 5 |
| 스타일 | CSS Modules, 전역 `globals.css` |
| 애니메이션 | [GSAP](https://greensock.com/gsap/) + ScrollTrigger, [Framer Motion](https://www.framer.com/motion/) |
| 3D(일부) | [React Three Fiber](https://r3f.docs.pmnd.rs/), [Drei](https://github.com/pmndrs/drei), Three.js |
| 스크롤 | Lenis(프로젝트에 포함, 레이아웃에서 사용 여부는 코드 기준) |
| 폰트 | Pretendard, Google Fonts Marcellus |

## 사전 요구

- **Node.js**: 20 LTS 권장 (Next 16 / React 19와 호환되는 최신 LTS)
- 패키지 매니저: `npm` 또는 `yarn` (저장소에 `package-lock.json` / `yarn.lock` 혼재 가능 — 팀에서 하나로 통일 권장)

## 설치·실행

```bash
npm install
npm run dev
```

브라우저에서 [http://localhost:3000](http://localhost:3000) — 로케일 프리픽스 경로 예: `/ko`, `/en`.

```bash
npm run build   # 프로덕션 빌드
npm run start   # 빌드 결과 실행
npm run lint    # ESLint
```

## 경로·다국어

- 라우트: `src/app/[locale]/(site)/` — `ko` · `en` ([`src/shared/config/i18n.ts`](src/shared/config/i18n.ts))
- 문구: [`src/shared/i18n/messages.ts`](src/shared/i18n/messages.ts)의 `dictionaries` + [`getDictionary`](src/shared/lib/get-dictionary.ts)

## 프로젝트 구조(요약)

```
src/
  app/                    # 레이아웃, [locale] 라우트, metadata
  components/             # GNB, 푸터 등 공통 UI
  features/main/          # 메인 랜딩
    common/               # 그리드 배경, 글래스(캔버스/SVG) 등
    sections/             # 히어로, 타이포, 슬라이드, 의료진, 머신, 리뷰, 시스템, 블로그, 뉴스, 유튜브, 학술 등
  shared/                 # i18n, 설정, 유틸
public/
  main/                   # 메인 섹션 이미지·3D 자산 등
  common/                 # 푸터·공용 이미지
```

하단 섹션 일부는 [`main-page.tsx`](src/features/main/main-page.tsx)에서 `next/dynamic`으로 청크 분리되어 초기 JS 부담을 줄입니다.

## 정적 자산

- `public/main/`, `public/common/` — 대용량 PNG/WebP/GLB 등. `next/image`는 [`next.config.ts`](next.config.ts)의 `images` 설정(AVIF/WebP, `deviceSizes` 등)을 따릅니다.

## 환경 변수

현재 저장소 기준으로 필수 `.env` 템플릿은 없습니다. 배포·API 연동 시 여기에 정리해 두는 것을 권장합니다.

## 기타

- **AGENTS.md / CLAUDE.md**: 워크스페이스·에이전트용 가이드가 있으면 함께 참고하세요.
- **분석**: `scripts/analyze-chunk.mjs` — 청크 분석용 스크립트(필요 시 `node scripts/analyze-chunk.mjs` 등).

## 라이선스

`private` — 내부/클라이언트용 저장소로 가정합니다.
