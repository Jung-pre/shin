"use client";

/* eslint-disable @next/next/no-img-element */
import { useRef } from "react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { useGSAP } from "@gsap/react";
import type { YoutubeSectionMessages } from "@/shared/i18n/messages";
import styles from "./youtube-section.module.css";

export interface YoutubeSectionProps {
  messages: YoutubeSectionMessages;
}

gsap.registerPlugin(ScrollTrigger, useGSAP);

export function YoutubeSection({ messages }: YoutubeSectionProps) {
  const sectionRef = useRef<HTMLElement>(null);
  const heroLinkRef = useRef<HTMLAnchorElement>(null);
  const rightHeaderRef = useRef<HTMLDivElement>(null);
  const thumbWrapRef = useRef<HTMLDivElement>(null);
  const thumbGridRef = useRef<HTMLUListElement>(null);

  useGSAP(
    () => {
      const section = sectionRef.current;
      if (!section) return;

      const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      const thumbItems = Array.from(thumbGridRef.current?.querySelectorAll(`.${styles.thumbItem}`) ?? []);

      if (reduceMotion) {
        gsap.set([heroLinkRef.current, rightHeaderRef.current, thumbWrapRef.current, ...thumbItems].filter(Boolean), {
          autoAlpha: 1,
          clearProps: "all",
        });
        return;
      }

      gsap.set([heroLinkRef.current, rightHeaderRef.current, thumbWrapRef.current], {
        autoAlpha: 0,
        y: 30,
      });

      gsap.set(thumbItems, {
        autoAlpha: 0,
        y: 16,
      });

      const tl = gsap.timeline({
        scrollTrigger: {
          trigger: section,
          start: "top 76%",
          once: true,
        },
      });

      tl.to(heroLinkRef.current, {
        autoAlpha: 1,
        y: 0,
        duration: 0.92,
        ease: "power3.out",
      })
        .to(
          rightHeaderRef.current,
          {
            autoAlpha: 1,
            y: 0,
            duration: 0.82,
            ease: "power3.out",
          },
          "-=0.5",
        )
        .to(
          thumbWrapRef.current,
          {
            autoAlpha: 1,
            y: 0,
            duration: 0.72,
            ease: "power3.out",
          },
          "-=0.38",
        )
        .to(thumbItems, {
          autoAlpha: 1,
          y: 0,
          duration: 0.5,
          ease: "power2.out",
          stagger: 0.08,
          clearProps: "opacity,visibility,transform",
        });
    },
    { scope: sectionRef },
  );

  return (
    <section ref={sectionRef} className={styles.section} aria-labelledby="youtube-section-heading">
      <div className={styles.inner}>
        <div className={styles.content}>
          <a ref={heroLinkRef} href={messages.heroHref ?? "#"} className={styles.heroLink}>
            <img
              src={messages.heroImageSrc}
              alt={messages.heroImageAlt}
              className={styles.heroImage}
              loading="lazy"
              decoding="async"
            />
          </a>

          <div className={styles.rightColumn}>
            <div ref={rightHeaderRef}>
              <h2 id="youtube-section-heading" className={styles.title}>
                <span className={styles.titleAccent}>{messages.titleAccent}</span>
                <br />
                <span>{messages.titleSuffix}</span>
              </h2>

              <a href={messages.ctaHref ?? "#"} className={styles.cta}>
                <span className={styles.ctaDot} aria-hidden />
                <span>{messages.ctaLabel}</span>
              </a>
            </div>

            <div ref={thumbWrapRef} className={styles.thumbWrap}>
              <ul ref={thumbGridRef} className={styles.thumbGrid}>
                {messages.thumbnails.map((thumbnail, index) => (
                  <li key={`${thumbnail.imageSrc}-${index}`} className={styles.thumbItem}>
                    <a href={thumbnail.href ?? "#"} className={styles.thumbLink}>
                      <img
                        src={thumbnail.imageSrc}
                        alt={thumbnail.alt}
                        className={styles.thumbImage}
                        loading="lazy"
                        decoding="async"
                      />
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
