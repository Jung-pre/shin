"use client";

import Image from "next/image";
import { useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { useGSAP } from "@gsap/react";
import type { ReviewSectionMessages } from "@/shared/i18n/messages";
import styles from "./review-section.module.css";

export interface ReviewSectionProps {
  messages: ReviewSectionMessages;
}

gsap.registerPlugin(ScrollTrigger, useGSAP);

function ReviewLockIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width="40" height="40" viewBox="0 0 40 40" fill="none" aria-hidden>
      <path
        d="M30.0013 29.9993C30.6957 29.9993 31.286 29.7563 31.7721 29.2702C32.2582 28.7841 32.5013 28.1938 32.5013 27.4993C32.5013 26.8049 32.2582 26.2146 31.7721 25.7285C31.286 25.2424 30.6957 24.9993 30.0013 24.9993C29.3069 24.9993 28.7166 25.2424 28.2305 25.7285C27.7444 26.2146 27.5013 26.8049 27.5013 27.4993C27.5013 28.1938 27.7444 28.7841 28.2305 29.2702C28.7166 29.7563 29.3069 29.9993 30.0013 29.9993ZM30.0013 34.9993C30.8346 34.9993 31.6124 34.8049 32.3346 34.416C33.0569 34.0271 33.6541 33.4855 34.1263 32.791C33.4874 32.4021 32.8207 32.1174 32.1263 31.9368C31.4319 31.7563 30.7235 31.666 30.0013 31.666C29.2791 31.666 28.5707 31.7563 27.8763 31.9368C27.1819 32.1174 26.5152 32.4021 25.8763 32.791C26.3485 33.4855 26.9457 34.0271 27.668 34.416C28.3902 34.8049 29.168 34.9993 30.0013 34.9993ZM15.0013 13.3327H25.0013V9.99935C25.0013 8.61046 24.5152 7.4299 23.543 6.45768C22.5707 5.48546 21.3902 4.99935 20.0013 4.99935C18.6124 4.99935 17.4319 5.48546 16.4596 6.45768C15.4874 7.4299 15.0013 8.61046 15.0013 9.99935V13.3327ZM20.418 36.666H10.0013C9.08464 36.666 8.29991 36.3396 7.64714 35.6868C6.99436 35.0341 6.66797 34.2493 6.66797 33.3327V16.666C6.66797 15.7493 6.99436 14.9646 7.64714 14.3118C8.29991 13.6591 9.08464 13.3327 10.0013 13.3327H11.668V9.99935C11.668 7.69379 12.4805 5.72852 14.1055 4.10352C15.7305 2.47852 17.6957 1.66602 20.0013 1.66602C22.3069 1.66602 24.2721 2.47852 25.8971 4.10352C27.5221 5.72852 28.3346 7.69379 28.3346 9.99935V13.3327H30.0013C30.918 13.3327 31.7027 13.6591 32.3555 14.3118C33.0082 14.9646 33.3346 15.7493 33.3346 16.666V18.8327C32.8346 18.666 32.3138 18.541 31.7721 18.4577C31.2305 18.3743 30.6402 18.3327 30.0013 18.3327V16.666H10.0013V33.3327H18.8346C19.0569 33.9993 19.2791 34.5757 19.5013 35.0618C19.7235 35.548 20.0291 36.0827 20.418 36.666ZM30.0013 38.3327C27.6957 38.3327 25.7305 37.5202 24.1055 35.8952C22.4805 34.2702 21.668 32.3049 21.668 29.9993C21.668 27.6938 22.4805 25.7285 24.1055 24.1035C25.7305 22.4785 27.6957 21.666 30.0013 21.666C32.3069 21.666 34.2721 22.4785 35.8971 24.1035C37.5221 25.7285 38.3346 27.6938 38.3346 29.9993C38.3346 32.3049 37.5221 34.2702 35.8971 35.8952C34.2721 37.5202 32.3069 38.3327 30.0013 38.3327Z"
        fill="white"
      />
    </svg>
  );
}

export function ReviewSection({ messages }: ReviewSectionProps) {
  const sectionRef = useRef<HTMLElement>(null);
  const headlineBlockRef = useRef<HTMLDivElement>(null);
  const slideBlockRef = useRef<HTMLDivElement>(null);
  const tabsRef = useRef<HTMLDivElement>(null);
  const cardGridRef = useRef<HTMLUListElement>(null);
  const bandTickerRef = useRef<HTMLDivElement>(null);
  const reduceMotion = useReducedMotion();
  const [activeTab, setActiveTab] = useState(0);
  const filteredCards = messages.cards;
  const slides = useMemo(
    () => [
      { src: "/main/img_main_review01.webp", alt: messages.featuredAlt, href: messages.featuredHref ?? "#" },
      { src: "/main/img_main_review01_02.webp", alt: messages.featuredAlt, href: messages.featuredHref ?? "#" },
      { src: "/main/img_main_review01_03.webp", alt: messages.featuredAlt, href: messages.featuredHref ?? "#" },
      { src: "/main/img_main_review01_04.webp", alt: messages.featuredAlt, href: messages.featuredHref ?? "#" },
    ],
    [messages.featuredAlt, messages.featuredHref],
  );
  const [activeSlide, setActiveSlide] = useState(0);
  const [slideDirection, setSlideDirection] = useState<1 | -1>(1);

  useEffect(() => {
    setActiveSlide(0);
    setSlideDirection(1);
  }, [activeTab]);

  useEffect(() => {
    const ticker = bandTickerRef.current;
    if (!ticker || typeof window === "undefined" || !("IntersectionObserver" in window)) return;

    const io = new IntersectionObserver(
      ([entry]) => {
        ticker.dataset.paused = entry.isIntersecting ? "false" : "true";
      },
      { rootMargin: "15% 0px" },
    );
    io.observe(ticker);
    return () => io.disconnect();
  }, []);

  const handleSlide = (direction: 1 | -1) => {
    if (slides.length < 2) return;
    setSlideDirection(direction);
    setActiveSlide((prev) => {
      const next = prev + direction;
      if (next < 0) return slides.length - 1;
      if (next >= slides.length) return 0;
      return next;
    });
  };

  const accentText = "리얼후기";
  const accentIndex = messages.title.indexOf(accentText);
  const titlePrefix = accentIndex >= 0 ? messages.title.slice(0, accentIndex) : messages.title;
  const titleAccent = accentIndex >= 0 ? messages.title.slice(accentIndex, accentIndex + accentText.length) : "";

  useGSAP(
    () => {
      const section = sectionRef.current;
      if (!section) return;

      if (reduceMotion) {
        gsap.set(
          [
            headlineBlockRef.current,
            slideBlockRef.current,
            tabsRef.current,
            ...Array.from(cardGridRef.current?.querySelectorAll(`.${styles.cardLink}`) ?? []),
          ].filter(Boolean),
          { autoAlpha: 1, clearProps: "all" },
        );
        return;
      }

      const cardLinks = Array.from(cardGridRef.current?.querySelectorAll(`.${styles.cardLink}`) ?? []);

      gsap.set([headlineBlockRef.current, slideBlockRef.current, tabsRef.current], {
        autoAlpha: 0,
        y: 28,
      });

      gsap.set(cardLinks, {
        autoAlpha: 0,
        y: 18,
      });

      const tl = gsap.timeline({
        scrollTrigger: {
          trigger: section,
          // 섹션이 뷰포트에 조금만 들어와도 재생되도록(이전: top 74% = 스크롤이 더 필요했음)
          start: "top 90%",
          once: true,
        },
      });

      tl.to(headlineBlockRef.current, {
        autoAlpha: 1,
        y: 0,
        duration: 0.7,
        ease: "power3.out",
      })
        .to(
          slideBlockRef.current,
          {
            autoAlpha: 1,
            y: 0,
            duration: 0.58,
            ease: "power3.out",
          },
          "-=0.4",
        )
        .to(
          tabsRef.current,
          {
            autoAlpha: 1,
            y: 0,
            duration: 0.5,
            ease: "power2.out",
          },
          "-=0.36",
        )
        .to(
          cardLinks,
          {
            autoAlpha: 1,
            y: 0,
            duration: 0.38,
            ease: "power2.out",
            stagger: 0.04,
            clearProps: "opacity,visibility,transform",
          },
          // 탭/슬라이드와 겹쳐 카드 그리드가 이전보다 훨씬 이른 시점에 등장
          "-=0.52",
        );
    },
    { scope: sectionRef, dependencies: [reduceMotion] },
  );

  return (
    <section ref={sectionRef} className={styles.section} aria-labelledby="review-section-heading">
      <div className={styles.inner}>
        <div className={styles.leftColumn}>
          <div ref={headlineBlockRef} className={styles.headlineBlock}>
            <p className={styles.eyebrow} lang="en">
              <img
                src="/main/img_main_review_logo.webp"
                alt=""
                className={styles.eyebrowLogo}
                aria-hidden="true"
                loading="lazy"
                decoding="async"
              />
              <span className={styles.eyebrowText}>{messages.eyebrowEn}</span>
            </p>
            <h2 id="review-section-heading" className={styles.title}>
              <span>{titlePrefix}</span>
              {titleAccent ? <span className={styles.titleAccent}>{titleAccent}</span> : null}
            </h2>
            <p className={styles.description}>{messages.description}</p>

            <button type="button" className={styles.cta}>
              <span className={styles.ctaDot} aria-hidden />
              <span className={styles.ctaLabel}>{messages.ctaLabel}</span>
            </button>
          </div>

          <div ref={slideBlockRef}>
            <AnimatePresence mode="wait" initial={false}>
              <motion.a
                key={`${slides[activeSlide]?.src}-${activeSlide}`}
                href={slides[activeSlide]?.href ?? "#"}
                className={styles.featuredImageLink}
                initial={
                  reduceMotion
                    ? { opacity: 0 }
                    : { opacity: 0, x: slideDirection > 0 ? 16 : -16 }
                }
                animate={reduceMotion ? { opacity: 1 } : { opacity: 1, x: 0 }}
                exit={
                  reduceMotion
                    ? { opacity: 0 }
                    : { opacity: 0, x: slideDirection > 0 ? -14 : 14 }
                }
                transition={reduceMotion ? { duration: 0.2 } : { duration: 0.32, ease: [0.22, 1, 0.36, 1] }}
              >
                <img
                  src={slides[activeSlide]?.src ?? messages.featuredImageSrc}
                  alt={slides[activeSlide]?.alt ?? messages.featuredAlt}
                  className={styles.featuredImage}
                  loading="lazy"
                  decoding="async"
                />
              </motion.a>
            </AnimatePresence>
            <div className={styles.sliderControls}>
              <button
                type="button"
                className={styles.sliderButton}
                aria-label="이전 후기"
                onClick={() => handleSlide(-1)}
              >
                <Image
                  src="/main/btn_left.webp"
                  alt=""
                  width={37}
                  height={37}
                  aria-hidden
                  loading="lazy"
                />
              </button>
              <button
                type="button"
                className={styles.sliderButton}
                aria-label="다음 후기"
                onClick={() => handleSlide(1)}
              >
                <Image
                  src="/main/btn_right.webp"
                  alt=""
                  width={37}
                  height={37}
                  aria-hidden
                  loading="lazy"
                />
              </button>
            </div>
          </div>
        </div>

        <div className={styles.rightColumn}>
          <div ref={tabsRef} className={styles.tabs}>
            {messages.tabs.map((tab, index) => (
              <span key={tab} className={styles.tabGroup}>
                {index > 0 ? <span className={styles.tabDivider} aria-hidden /> : null}
                <button
                  type="button"
                  className={`${styles.tab} ${index === activeTab ? styles.tabActive : styles.tabInactive}`}
                  onClick={() => setActiveTab(index)}
                >
                  {tab}
                </button>
              </span>
            ))}
          </div>

          <ul ref={cardGridRef} className={styles.cardGrid}>
            {filteredCards.map((card, index) => (
              <li key={`${card.imageSrc}-${index}`} className={styles.cardItem}>
                <a href={card.href ?? "#"} className={styles.cardLink}>
                  <div className={styles.cardMedia}>
                    <Image
                      src={card.imageSrc}
                      alt={card.label}
                      fill
                      sizes="(max-width: 48rem) 100vw, (max-width: 80rem) 33vw, 28rem"
                      className={styles.cardImage}
                      loading="lazy"
                    />
                    <div className={styles.cardOverlay}>
                      <ReviewLockIcon />
                      <p className={styles.cardOverlayText}>
                        의료법에 따라 로그인 후
                        <br />
                        후기를 확인할 수 있습니다
                      </p>
                    </div>
                  </div>
                  <span className={styles.cardLabel}>{card.label}</span>
                </a>
              </li>
            ))}
          </ul>
        </div>
      </div>
      <div ref={bandTickerRef} className={styles.bandTicker} data-paused="true" aria-hidden>
        <div className={`${styles.bandTrack} ${styles.bandTrackA}`}>
          {Array.from({ length: 6 }).map((_, index) => (
            <span key={`band-a-${index}`}>SHINSEGAE</span>
          ))}
        </div>
        <div className={`${styles.bandTrack} ${styles.bandTrackB}`}>
          {Array.from({ length: 6 }).map((_, index) => (
            <span key={`band-b-${index}`}>SHINSEGAE</span>
          ))}
        </div>
      </div>
    </section>
  );
}
