/* eslint-disable @next/next/no-img-element -- 정적 카드 썸네일 */
import type { AcademicPublicationsSectionMessages } from "@/shared/i18n/messages";
import styles from "./academic-publications-section.module.css";

const ACADEMIC_CARD_IMAGES = [
  "/main/img_main_academic01.png",
  "/main/img_main_academic02.png",
  "/main/img_main_academic03.png",
  "/main/img_main_academic04.png",
  "/main/img_main_academic05.png",
] as const;

function CardViewMoreIcon() {
  return (
    <svg
      className={styles.cardViewBtnIcon}
      xmlns="http://www.w3.org/2000/svg"
      width={24}
      height={24}
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden
    >
      <path
        d="M6.34314 17.6567L17.6568 6.34303"
        stroke="white"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M9.17163 6.34326H17.6569V14.8285"
        stroke="white"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export interface AcademicPublicationsSectionProps {
  messages: AcademicPublicationsSectionMessages;
}

export function AcademicPublicationsSection({ messages }: AcademicPublicationsSectionProps) {
  return (
    <section className={styles.section} aria-labelledby="academic-publications-heading">
      <div className={styles.inner}>
        <div className={styles.intro}>
          <div className={styles.copy}>
            <p className={styles.eyebrow}>
              <img
                src="/main/img_main_academic_logo.png"
                alt=""
                className={styles.eyebrowLogo}
                loading="eager"
                decoding="async"
              />
              <span lang="en" className={styles.eyebrowEn}>
                {messages.eyebrowEn}
              </span>
            </p>
            <h2 id="academic-publications-heading" className={styles.title}>
              {messages.title}
            </h2>
            <p className={styles.description}>{messages.description}</p>
          </div>
          <div className={styles.ctaWrap}>
            <button type="button" className={styles.cta}>
              <span className={styles.ctaDot} aria-hidden />
              <span className={styles.ctaLabel}>{messages.ctaLabel}</span>
            </button>
          </div>
        </div>

        <ul className={styles.cardGrid}>
          {ACADEMIC_CARD_IMAGES.map((src, index) => (
            <li key={src} className={styles.cardItem}>
              <a
                className={styles.cardLink}
                href="#"
                aria-label={`${messages.cardViewMore} — ${index + 1}`}
              >
                <img src={src} alt="" className={styles.cardImage} loading="lazy" decoding="async" />
                <span className={styles.hoverLayer}>
                  <span className={styles.cardViewBtn}>
                    <span className={styles.cardViewBtnText}>{messages.cardViewMore}</span>
                    <CardViewMoreIcon />
                  </span>
                </span>
              </a>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
