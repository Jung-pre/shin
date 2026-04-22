"use client";

import { Suspense, useRef, useState, type FormEvent, type RefObject } from "react";
import clsx from "clsx";
import { Canvas, useFrame } from "@react-three/fiber";
import { Float } from "@react-three/drei";
import type { Group } from "three";
import type { HeroQuickBarMessages } from "@/shared/i18n/messages";
import type { Locale } from "@/shared/config/i18n";
import styles from "./main-hero.module.css";

export interface MainHeroProps {
  heroQuickBar: HeroQuickBarMessages;
  locale: Locale;
  /** 글래스 렌즈가 정합될 타이틀(h1) ref — MainPage 에서 GlassOrbsScene 과 공유 */
  titleRef?: RefObject<HTMLHeadingElement | null>;
}

/* ---------- 퀵 상담 바 ---------- */

const IconPhone = () => (
  <svg
    className={styles.linkIcon}
    xmlns="http://www.w3.org/2000/svg"
    width={26}
    height={26}
    viewBox="0 0 26 26"
    fill="none"
    aria-hidden
  >
    <path
      d="M19.8555 24.375C18.8642 24.375 17.4718 24.0165 15.3867 22.8516C12.8512 21.4297 10.8901 20.117 8.36826 17.6018C5.93685 15.1719 4.75365 13.5987 3.09767 10.5854C1.22689 7.18302 1.5458 5.39959 1.90228 4.63736C2.32681 3.72635 2.95346 3.18146 3.76342 2.64064C4.22347 2.33922 4.71032 2.08084 5.21779 1.86877C5.26857 1.84693 5.3158 1.82611 5.35795 1.80732C5.60932 1.69408 5.99017 1.52295 6.4726 1.70576C6.79455 1.82662 7.08197 2.07392 7.53189 2.51826C8.45459 3.42826 9.71549 5.45494 10.1806 6.45025C10.4929 7.12107 10.6996 7.56388 10.7001 8.06052C10.7001 8.64197 10.4076 9.09037 10.0527 9.57431C9.98615 9.66521 9.92013 9.75205 9.85615 9.83634C9.46971 10.3442 9.3849 10.4909 9.44076 10.7529C9.554 11.2795 10.3985 12.8472 11.7863 14.232C13.1742 15.6168 14.6966 16.4079 15.2253 16.5207C15.4985 16.5791 15.6483 16.4907 16.1723 16.0906C16.2475 16.0332 16.3247 15.9738 16.4054 15.9144C16.9467 15.5117 17.3743 15.2268 17.942 15.2268H17.9451C18.4392 15.2268 18.8622 15.4411 19.563 15.7945C20.477 16.2556 22.5647 17.5003 23.4803 18.424C23.9256 18.8729 24.1739 19.1593 24.2953 19.4807C24.4781 19.9647 24.306 20.344 24.1937 20.5979C24.1749 20.6401 24.1541 20.6863 24.1323 20.7376C23.9185 21.2441 23.6586 21.7299 23.3558 22.1889C22.816 22.9963 22.2691 23.6214 21.3561 24.0465C20.8872 24.2683 20.3741 24.3806 19.8555 24.375Z"
      fill="#812990"
    />
  </svg>
);

const IconCalendarCheck = () => (
  <svg
    className={styles.linkIcon}
    xmlns="http://www.w3.org/2000/svg"
    width={26}
    height={26}
    viewBox="0 0 26 26"
    fill="none"
    aria-hidden
  >
    <path
      fillRule="evenodd"
      clipRule="evenodd"
      d="M2.16663 3.37379C2.16663 2.94643 2.51308 2.59998 2.94044 2.59998H23.0595C23.4869 2.59998 23.8333 2.94643 23.8333 3.37379V6.46902C23.8333 6.89638 23.4869 7.24283 23.0595 7.24283H2.94044C2.51307 7.24283 2.16663 6.89638 2.16663 6.46902V3.37379ZM23.0595 8.79045H2.94044V21.9452C2.94044 22.3726 3.28689 22.719 3.71424 22.719H22.2857C22.713 22.719 23.0595 22.3726 23.0595 21.9452V8.79045ZM17.4634 13.9287C17.7371 13.6004 17.6927 13.1124 17.3644 12.8389C17.0361 12.5652 16.5481 12.6096 16.2746 12.9379L12.948 16.9298L11.2257 15.2076C10.9235 14.9054 10.4335 14.9054 10.1314 15.2076C9.8292 15.5097 9.8292 15.9997 10.1314 16.3019L12.4528 18.6233C12.6066 18.7771 12.8178 18.859 13.035 18.8492C13.2522 18.8393 13.4553 18.7385 13.5944 18.5716L17.4634 13.9287Z"
      fill="#812990"
    />
  </svg>
);

const IconCalendarStar = () => (
  <svg
    className={styles.linkIcon}
    xmlns="http://www.w3.org/2000/svg"
    width={26}
    height={26}
    viewBox="0 0 26 26"
    fill="none"
    aria-hidden
  >
    <path
      d="M20.5833 4.33335H19.5V3.25002C19.5 2.6544 19.0122 2.16669 18.4166 2.16669C17.821 2.16669 17.3333 2.6544 17.3333 3.25002V4.33335H8.66663V3.25002C8.66663 2.6544 8.17891 2.16669 7.58329 2.16669C6.98767 2.16669 6.49996 2.6544 6.49996 3.25002V4.33335H5.41663C3.62923 4.33335 2.16663 5.79596 2.16663 7.58335V20.5834C2.16663 22.3707 3.62923 23.8334 5.41663 23.8334H20.5833C22.3707 23.8334 23.8333 22.3707 23.8333 20.5834V7.58335C23.8333 5.79596 22.3707 4.33335 20.5833 4.33335ZM19.3159 12.5123L17.42 15.3725L18.3844 19.2398C18.4817 19.6518 18.341 20.0851 18.0157 20.3448C17.8099 20.5077 17.5719 20.5834 17.3333 20.5834C17.1709 20.5834 16.9974 20.5511 16.8456 20.4643L13 18.5468L9.15434 20.4643C8.77507 20.659 8.32015 20.605 7.98425 20.3448C7.65894 20.0851 7.51823 19.6518 7.61556 19.2398L8.57987 15.3725L6.68404 12.5123C6.45658 12.1875 6.4349 11.7543 6.63009 11.4073C6.81417 11.0502 7.18233 10.8334 7.58329 10.8334H10.2483L12.1007 8.07107C12.5017 7.46434 13.4983 7.46434 13.8992 8.07107L15.7517 10.8334H18.4166C18.8176 10.8334 19.1858 11.0502 19.3698 11.4073C19.565 11.7543 19.5433 12.1875 19.3159 12.5123Z"
      fill="#812990"
    />
  </svg>
);

const IconMapPin = () => (
  <svg
    className={styles.linkIcon}
    xmlns="http://www.w3.org/2000/svg"
    width={20}
    height={26}
    viewBox="0 0 20 26"
    fill="none"
    aria-hidden
  >
    <path
      d="M0.787842 9.92728C0.787842 17.1758 8.56158 23.983 8.90299 24.2719L9.5333 24.8182L10.1636 24.2719C10.505 23.9778 18.2788 17.1758 18.2788 9.92728C18.2788 5.10546 14.3551 1.18182 9.5333 1.18182C4.71148 1.18182 0.787842 5.10546 0.787842 9.92728ZM14.3919 9.92728C14.3919 12.6113 12.2173 14.7859 9.5333 14.7859C6.84926 14.7859 4.67471 12.6113 4.67471 9.92728C4.67471 7.24324 6.84926 5.06869 9.5333 5.06869C12.2173 5.06869 14.3919 7.24849 14.3919 9.92728Z"
      fill="#812990"
    />
  </svg>
);

function QuickBar({ messages, locale }: { messages: HeroQuickBarMessages; locale: Locale }) {
  const [name, setName] = useState("");
  const [contact, setContact] = useState("");
  const [department, setDepartment] = useState("");
  const [consent, setConsent] = useState(true);

  const onSubmit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
  };

  return (
    <div className={styles.bar}>
      <div className={styles.cluster}>
        <p className={styles.headline}>
          <span className={styles.headlineLead}>{messages.headlineLead}</span>{" "}
          <span className={styles.headlineRest}>{messages.headlineRest}</span>
        </p>

        <form className={styles.formBlock} onSubmit={onSubmit} noValidate>
          <input
            className={clsx(styles.field, styles.fieldName)}
            name="name"
            type="text"
            autoComplete="name"
            placeholder={messages.namePlaceholder}
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
          <input
            className={clsx(styles.field, styles.fieldContact)}
            name="contact"
            type="tel"
            autoComplete="tel"
            inputMode="tel"
            placeholder={messages.contactPlaceholder}
            value={contact}
            onChange={(e) => setContact(e.target.value)}
          />
          <div className={styles.selectWrap}>
            <select
              className={styles.select}
              name="department"
              aria-label={messages.departmentPlaceholder}
              value={department}
              onChange={(e) => setDepartment(e.target.value)}
            >
              <option value="">{messages.departmentPlaceholder}</option>
              {messages.departmentOptions.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
            <svg
              className={styles.selectChevron}
              xmlns="http://www.w3.org/2000/svg"
              width={11}
              height={7}
              viewBox="0 0 11 7"
              fill="none"
              aria-hidden
            >
              <path
                d="M0.5 0.5L5.5 5.5L10.5 0.5"
                stroke="#9C9C9C"
                strokeLinecap="round"
              />
            </svg>
          </div>

          <div className={styles.consentRow}>
            <label className={styles.checkboxLabel}>
              <input
                className={styles.checkbox}
                type="checkbox"
                checked={consent}
                onChange={(e) => setConsent(e.target.checked)}
              />
              <span className={styles.consentText}>
                <span>{messages.consentLabel}</span>
                <a className={styles.consentDetailLink} href={`/${locale}/privacy#collection`}>
                  [{messages.consentViewDetail}]
                </a>
              </span>
            </label>
            <button className={styles.submit} type="submit">
              {messages.submit}
            </button>
          </div>
        </form>
      </div>

      <div className={styles.divider} role="presentation" />

      <nav className={styles.links} aria-label="Quick links">
        <a className={styles.linkItem} href={messages.phoneHref}>
          <IconPhone />
          <span>{messages.phoneConsult}</span>
        </a>
        <a className={styles.linkItem} href={`/${locale}/reservation`}>
          <IconCalendarCheck />
          <span>{messages.onlineReservation}</span>
        </a>
        <a className={styles.linkItem} href={`/${locale}/community`}>
          <IconCalendarStar />
          <span>{messages.events}</span>
        </a>
        <a className={styles.linkItem} href={`/${locale}/support#directions`}>
          <IconMapPin />
          <span>{messages.directions}</span>
        </a>
      </nav>
    </div>
  );
}

/* ---------- 메인 히어로(첫 화면) ---------- */

/** 그리드·글래스·타이틀은 `MainPage` 전역 레이어 — 여기서는 퀵바가 있는 히어로 구역만. */
export function MainHero({ heroQuickBar, locale, titleRef }: MainHeroProps) {
  const titleText = "신세계안과";

  return (
    <section className={styles.section} aria-label="Hero">
      <div className={styles.titleWrap}>
        {/* h1 자체는 글래스 텍스처 bbox 기준이라 transform 금지 — 내부 span 만 애니메이션. */}
        <h1 ref={titleRef} className={styles.title} data-hero-intro="title" aria-label={titleText}>
          {Array.from(titleText).map((ch, i) => (
            <span key={`${ch}-${i}`} className={styles.titleChar} data-hero-char aria-hidden>
              {ch}
            </span>
          ))}
        </h1>
      </div>
      <div className={styles.quickDock} data-hero-intro="quickbar">
        <QuickBar messages={heroQuickBar} locale={locale} />
      </div>
    </section>
  );
}

/* ---------- 실험용 Eye 씬 (필요 시 레이아웃에 배치) ---------- */

const EyeModel = () => {
  const groupRef = useRef<Group>(null);

  useFrame((_, delta) => {
    if (!groupRef.current) {
      return;
    }

    groupRef.current.rotation.y += delta * 0.35;
    groupRef.current.rotation.x = Math.sin(performance.now() * 0.0004) * 0.12;
  });

  return (
    <Float speed={1.2} rotationIntensity={0.25} floatIntensity={0.45}>
      <group ref={groupRef}>
        <mesh>
          <sphereGeometry args={[1.1, 48, 48]} />
          <meshStandardMaterial color="#bccbff" roughness={0.15} metalness={0.08} />
        </mesh>
        <mesh scale={0.45} position={[0.35, 0.08, 0.88]}>
          <sphereGeometry args={[1, 32, 32]} />
          <meshStandardMaterial color="#2d3d75" roughness={0.25} metalness={0.5} />
        </mesh>
      </group>
    </Float>
  );
};

export function EyeScene() {
  return (
    <div className={styles.eyeRoot} aria-hidden>
      <Canvas
        dpr={[1, 1.5]}
        frameloop="demand"
        gl={{ antialias: false, alpha: true, powerPreference: "high-performance" }}
        camera={{ fov: 36, position: [0, 0, 6.8] }}
      >
        <ambientLight intensity={0.8} />
        <directionalLight position={[2, 3, 4]} intensity={1.2} />
        <pointLight position={[-3, -2, 2]} intensity={0.45} />
        <Suspense fallback={null}>
          <EyeModel />
        </Suspense>
      </Canvas>
    </div>
  );
}
