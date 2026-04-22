"use client";

/* eslint-disable @next/next/no-img-element -- 정적 카드 썸네일 */
import { useRef } from "react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { useGSAP } from "@gsap/react";
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

gsap.registerPlugin(ScrollTrigger, useGSAP);

export function AcademicPublicationsSection({ messages }: AcademicPublicationsSectionProps) {
  const sectionRef = useRef<HTMLElement>(null);
  const copyRef = useRef<HTMLDivElement>(null);
  const ctaWrapRef = useRef<HTMLDivElement>(null);
  const cardGridRef = useRef<HTMLUListElement>(null);

  useGSAP(
    () => {
      const section = sectionRef.current;
      if (!section) return;

      const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      const cardItems = Array.from(cardGridRef.current?.querySelectorAll(`.${styles.cardItem}`) ?? []);

      if (reduceMotion) {
        gsap.set([copyRef.current, ctaWrapRef.current, ...cardItems].filter(Boolean), { autoAlpha: 1, clearProps: "all" });
        return;
      }

      gsap.set([copyRef.current, ctaWrapRef.current], {
        autoAlpha: 0,
        y: 28,
      });

      gsap.set(cardItems, {
        autoAlpha: 0,
        y: 20,
      });

      const tl = gsap.timeline({
        scrollTrigger: {
          trigger: section,
          start: "top 76%",
          once: true,
        },
      });

      tl.to(copyRef.current, {
        autoAlpha: 1,
        y: 0,
        duration: 0.88,
        ease: "power3.out",
      })
        .to(
          ctaWrapRef.current,
          {
            autoAlpha: 1,
            y: 0,
            duration: 0.78,
            ease: "power3.out",
          },
          "-=0.44",
        )
        .to(cardItems, {
          autoAlpha: 1,
          y: 0,
          duration: 0.58,
          ease: "power2.out",
          stagger: 0.1,
          clearProps: "opacity,visibility,transform",
        });
    },
    { scope: sectionRef },
  );

  return (
    <section ref={sectionRef} className={styles.section} aria-labelledby="academic-publications-heading">
      <img
        src="/main/bg_academic.png"
        alt=""
        className={styles.bgImage}
        aria-hidden="true"
        loading="lazy"
        decoding="async"
      />
      <div className={styles.inner}>
        <div className={styles.intro}>
          <div ref={copyRef} className={styles.copy}>
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
          <div ref={ctaWrapRef} className={styles.ctaWrap}>
            <button type="button" className={styles.cta}>
              <span className={styles.ctaDot} aria-hidden />
              <span className={styles.ctaLabel}>{messages.ctaLabel}</span>
            </button>
          </div>
        </div>

        <ul ref={cardGridRef} className={styles.cardGrid}>
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
