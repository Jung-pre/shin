"use client";

import Image from "next/image";
import { useRef } from "react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { useGSAP } from "@gsap/react";
import type { NewsSectionMessages } from "@/shared/i18n/messages";
import styles from "./news-section.module.css";

export interface NewsSectionProps {
  messages: NewsSectionMessages;
}

gsap.registerPlugin(ScrollTrigger, useGSAP);

export function NewsSection({ messages }: NewsSectionProps) {
  const sectionRef = useRef<HTMLElement>(null);
  const headerRef = useRef<HTMLDivElement>(null);
  const tabsRef = useRef<HTMLDivElement>(null);
  const cardListRef = useRef<HTMLUListElement>(null);

  useGSAP(
    () => {
      const section = sectionRef.current;
      if (!section) return;

      const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      const cardItems = Array.from(cardListRef.current?.querySelectorAll(`.${styles.cardItem}`) ?? []);

      if (reduceMotion) {
        gsap.set([headerRef.current, tabsRef.current, ...cardItems].filter(Boolean), { autoAlpha: 1, clearProps: "all" });
        return;
      }

      gsap.set([headerRef.current, tabsRef.current], {
        autoAlpha: 0,
        y: 30,
      });
      gsap.set(cardItems, {
        autoAlpha: 0,
        y: 24,
      });

      const tl = gsap.timeline({
        scrollTrigger: {
          trigger: section,
          start: "top 76%",
          once: true,
        },
      });

      tl.to(headerRef.current, {
        autoAlpha: 1,
        y: 0,
        duration: 0.88,
        ease: "power3.out",
      })
        .to(
          tabsRef.current,
          {
            autoAlpha: 1,
            y: 0,
            duration: 0.78,
            ease: "power3.out",
          },
          "-=0.48",
        )
        .to(cardItems, {
          autoAlpha: 1,
          y: 0,
          duration: 0.6,
          ease: "power2.out",
          stagger: 0.11,
          clearProps: "opacity,visibility,transform",
        });
    },
    { scope: sectionRef },
  );

  const getCategoryBadgeClassName = (category: string) => {
    if (category === "이벤트" || category === "Event") return styles.cardBadgeEvent;
    if (category === "언론보도" || category === "Press") return `${styles.cardBadgeEvent} ${styles.cardBadgePress}`;
    if (category === "공지사항" || category === "Notice") return `${styles.cardBadgeEvent} ${styles.cardBadgeNotice}`;
    return "";
  };

  return (
    <section ref={sectionRef} className={styles.section} aria-labelledby="news-section-heading">
      <div className={styles.inner}>
        <div ref={headerRef} className={styles.header}>
          <p className={styles.eyebrow} lang="en">
            <img
              src="/main/img_main_news_logo.webp"
              alt=""
              className={styles.eyebrowDot}
              aria-hidden="true"
              loading="lazy"
              decoding="async"
            />
            <span className={styles.eyebrowText}>{messages.eyebrowEn}</span>
          </p>
          <h2 id="news-section-heading" className={styles.title}>
            <span>{messages.titlePrefix}</span>
            <span className={styles.titleAccent}>{messages.titleAccent}</span>
            <span>{messages.titleSuffix}</span>
          </h2>

          <div ref={tabsRef} className={styles.tabs} role="tablist" aria-label={messages.tabAriaLabel}>
            {messages.tabs.map((tab, index) => (
              <button
                key={tab.label}
                type="button"
                role="tab"
                aria-selected={index === 0}
                className={`${styles.tab} ${index === 0 ? styles.tabActive : styles.tabInactive}`}
              >
                <span className={styles.tabDot} aria-hidden />
                <span className={styles.tabLabel}>{tab.label}</span>
              </button>
            ))}
          </div>
        </div>

        <ul ref={cardListRef} className={styles.cardList}>
          {messages.cards.map((card) => (
            <li key={`${card.category}-${card.title}`} className={styles.cardItem}>
              <a href={card.href ?? "#"} className={styles.cardLink}>
                <div className={styles.cardMedia}>
                  <Image
                    src={card.imageSrc}
                    alt={card.title}
                    fill
                    sizes="(max-width: 48rem) 100vw, (max-width: 80rem) 33vw, 25rem"
                    className={styles.cardImage}
                    loading="lazy"
                  />
                  <span className={`${styles.cardBadge} ${getCategoryBadgeClassName(card.category)}`}>
                    {card.category}
                  </span>
                </div>
                <div className={styles.cardMeta}>
                  <p className={styles.cardTitle}>{card.title}</p>
                  <p className={styles.cardDate}>{card.date}</p>
                </div>
              </a>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
