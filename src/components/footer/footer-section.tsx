"use client";

import Image from "next/image";
import { useRef, type CSSProperties } from "react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { useGSAP } from "@gsap/react";
import type { FooterSectionMessages } from "@/shared/i18n/messages";
import styles from "./footer-section.module.css";

export interface FooterSectionProps {
  messages: FooterSectionMessages;
  className?: string;
}

gsap.registerPlugin(ScrollTrigger, useGSAP);

export function FooterSection({ messages, className }: FooterSectionProps) {
  const sectionRef = useRef<HTMLElement>(null);
  const policyRef = useRef<HTMLUListElement>(null);
  const titleRef = useRef<HTMLHeadingElement>(null);
  const infoGridRef = useRef<HTMLDivElement>(null);
  const bottomBrandRef = useRef<HTMLDivElement>(null);
  const mapPanelRef = useRef<HTMLDivElement>(null);
  const titleLines = messages.title.split("\n");
  const snsIcons = [
    "/common/img_footer_sns01.webp",
    "/common/img_footer_sns02.webp",
    "/common/img_footer_sns03.webp",
    "/common/img_footer_sns04.webp",
    "/common/img_footer_sns05.webp",
  ];

  useGSAP(
    () => {
      const section = sectionRef.current;
      if (!section) return;

      const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      const leftTargets = [policyRef.current, titleRef.current, infoGridRef.current, bottomBrandRef.current].filter(Boolean);
      const mapTarget = mapPanelRef.current;

      if (reduceMotion) {
        gsap.set([...leftTargets, mapTarget].filter(Boolean), {
          autoAlpha: 1,
          x: 0,
          y: 0,
          clearProps: "opacity,visibility,transform",
        });
        return;
      }

      // blur 제거(페인트 부담 큼) — opacity + translate 만으로 동일한 등장 느낌 유지.
      gsap.set(leftTargets, {
        autoAlpha: 0,
        y: 26,
      });

      if (mapTarget) {
        gsap.set(mapTarget, {
          autoAlpha: 0,
          y: 30,
          x: 22,
        });
      }

      const tl = gsap.timeline({
        scrollTrigger: {
          trigger: section,
          start: "top 80%",
          once: true,
        },
      });

      tl.to(leftTargets, {
        autoAlpha: 1,
        y: 0,
        duration: 0.72,
        stagger: 0.14,
        ease: "power3.out",
      });

      if (mapTarget) {
        tl.to(
          mapTarget,
          {
            autoAlpha: 1,
            y: 0,
            x: 0,
            duration: 0.92,
            ease: "power3.out",
          },
          "-=0.28",
        );
      }
    },
    { scope: sectionRef },
  );

  return (
    <footer ref={sectionRef} className={[styles.section, className].filter(Boolean).join(" ")} aria-label={messages.ariaLabel}>
      <div className={styles.inner}>
        <div className={styles.content}>
          <div className={styles.leftColumn}>
            <ul ref={policyRef} className={styles.policyList}>
              {messages.policyLinks.map((policy) => (
                <li key={policy} className={styles.policyItem}>
                  <a href="#" className={styles.policyLink}>
                    {policy}
                  </a>
                </li>
              ))}
            </ul>
            <h2 ref={titleRef} className={styles.title}>
              {titleLines.map((line) => (
                <span key={line} className={styles.titleLine}>
                  {line}
                </span>
              ))}
            </h2>

            <div ref={infoGridRef} className={styles.infoGrid}>
              <div className={styles.infoBlock}>
                <p className={styles.infoTitle}>{messages.hoursTitle}</p>
                <div className={styles.hoursRows}>
                  {messages.hours.map((hour) => (
                    <p key={`${hour.label}-${hour.value}`} className={styles.infoLine}>
                      <span className={styles.infoLabel}>
                        {hour.label}
                        {hour.mutedLabel ? <span className={styles.infoMutedLabel}> {hour.mutedLabel}</span> : null}
                      </span>
                      <span className={styles.infoTime}>{hour.value}</span>
                    </p>
                  ))}
                </div>
                {messages.hoursNote ? <p className={styles.hoursNote}>{messages.hoursNote}</p> : null}
              </div>
              <div className={styles.infoBlock}>
                <p className={styles.infoTitle}>
                  <span>{messages.contactTitle}</span>
                  {messages.contactSubTitle ? <span className={styles.infoTitleSub}> {messages.contactSubTitle}</span> : null}
                </p>
                <p className={styles.contactValue}>{messages.contactValue}</p>
              </div>
            </div>

            <div ref={bottomBrandRef} className={styles.bottomBrand}>
              <div className={styles.bottomBrandTop}>
                <img
                  src="/common/img_footer_logo.webp"
                  alt={messages.brandName}
                  className={styles.brandLogo}
                  loading="lazy"
                  decoding="async"
                />
                <ul className={styles.snsList}>
                  {snsIcons.map((iconSrc, index) => (
                    <li key={iconSrc} className={styles.snsItem}>
                      <a href="#" className={styles.snsLink} aria-label={`sns-link-${index + 1}`}>
                        <Image
                          src={iconSrc}
                          alt=""
                          width={24}
                          height={24}
                          className={styles.snsIcon}
                          loading="lazy"
                        />
                      </a>
                    </li>
                  ))}
                </ul>
              </div>
              <p className={styles.companyInfoLine}>
                {messages.companyInfoLines.map((item) => (
                  <span key={`${item.label}-${item.value}`} className={styles.companyInfoPair}>
                    <span className={styles.companyInfoLabel}>{item.label}</span>
                    <span className={styles.companyInfoValue}>{item.value}</span>
                  </span>
                ))}
              </p>
              <p className={styles.addressLine}>
                <span className={styles.addressLabel}>주소</span>
                <span>{messages.addressLine}</span>
              </p>
              <p className={styles.addressLine}>
                <span className={styles.addressLabel}>주차타워</span>
                <span>{messages.parkingTowerLine}</span>
              </p>
              <p className={styles.copyright}>{messages.copyright}</p>
            </div>
          </div>

          <div
            ref={mapPanelRef}
            className={styles.mapPanel}
            role="img"
            aria-label={messages.mapAlt}
            style={{ backgroundImage: `url("${messages.mapImageSrc}")` } as CSSProperties}
          />
        </div>
      </div>
    </footer>
  );
}
