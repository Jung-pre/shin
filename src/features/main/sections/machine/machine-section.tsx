"use client";

/* eslint-disable @next/next/no-img-element */
import { useCallback, useEffect, useRef, useState } from "react";
import dynamic from "next/dynamic";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import gsap from "gsap";
import { useGSAP } from "@gsap/react";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import type { MachineSectionMessages } from "@/shared/i18n/messages";
import styles from "./machine-section.module.css";
import {
  DEFAULT_MODEL_SCENE_CONFIG,
  VISUMAX_800_DEFAULT_CONFIG,
  type ModelSceneConfig,
} from "./visumax-model-scene";
import { VisumaxConfigPanel } from "./visumax-config-panel";

/**
 * dev 튜닝용 GLB 옵션 패널 노출 스위치.
 *   - false: 코드/상태 관리 로직은 그대로 유지, UI 렌더만 스킵 → 프로덕션 깨끗.
 *   - true: 우측 하단 플로팅 패널 표시 (오버레이 스케일/위치/회전 등 실시간 튜닝).
 * 다시 켜려면 이 플래그만 true 로 바꾸면 된다.
 */
const SHOW_VISUMAX_CONFIG_PANEL = false;

/**
 * VISUMAX 800 이미지 위에 겹쳐 올릴 3D 모델 오버레이.
 * R3F Canvas 는 무거우므로 SSR 제외 + 동적 로드.
 */
const VisumaxModelScene = dynamic(
  () => import("./visumax-model-scene").then((mod) => mod.VisumaxModelScene),
  { ssr: false },
);

gsap.registerPlugin(ScrollTrigger, useGSAP);

export interface MachineSectionProps {
  messages: MachineSectionMessages;
}

export function MachineSection({ messages }: MachineSectionProps) {
  const sectionRef = useRef<HTMLElement>(null);
  const pinRef = useRef<HTMLDivElement>(null);
  const [progress, setProgress] = useState(0);
  const reduceMotion = useReducedMotion();
  // 두 GLB 모델의 설정을 개별 관리 — 설정 패널에서 실시간 튜닝.
  //   800 은 디자인 확정값(VISUMAX_800_DEFAULT_CONFIG) 로 시작, 500 은 표준값.
  const [config800, setConfig800] = useState<ModelSceneConfig>(VISUMAX_800_DEFAULT_CONFIG);
  const [config500, setConfig500] = useState<ModelSceneConfig>(DEFAULT_MODEL_SCENE_CONFIG);
  // GLB 로드 완료 → 뒤 이미지 페이드아웃 트리거.
  //   useCallback 으로 레퍼런스 고정 → VisumaxModelScene 내부 메모이제이션(Bounds 재피팅 방지) 유지.
  const [modelLoaded800, setModelLoaded800] = useState(false);
  const [modelLoaded500, setModelLoaded500] = useState(false);
  const handleModel800Loaded = useCallback(() => setModelLoaded800(true), []);
  const handleModel500Loaded = useCallback(() => setModelLoaded500(true), []);

  // dev 편의: 코드에서 default const 를 수정하면 Fast Refresh 가 모듈을 재평가해
  // 새 레퍼런스의 상수가 들어온다. deps 에 상수를 걸어두면 그 변화에 반응해 state 를
  // 새 default 로 자동 동기화 → "코드 수정 → 저장 → 바로 화면 반영". 슬라이더 조정은
  // 상수 레퍼런스를 바꾸지 않으므로 이 effect 가 돌지 않아 유저 조정값이 덮어쓰이지 않는다.
  useEffect(() => {
    setConfig800(VISUMAX_800_DEFAULT_CONFIG);
  }, [VISUMAX_800_DEFAULT_CONFIG]);
  useEffect(() => {
    setConfig500(DEFAULT_MODEL_SCENE_CONFIG);
  }, [DEFAULT_MODEL_SCENE_CONFIG]);
  const primaryMachine = messages.machines[0];
  const machines = messages.machines.length > 0 ? messages.machines : [primaryMachine];

  useGSAP(
    () => {
      const section = sectionRef.current;
      const pinEl = pinRef.current;
      if (!section || !pinEl) return;
      const progressState = { value: 0 };
      const smoothProgress = gsap.quickTo(progressState, "value", {
        duration: 0.22,
        ease: "power2.out",
        onUpdate: () => setProgress(progressState.value),
      });

      const pinST = ScrollTrigger.create({
        trigger: section,
        start: "top top",
        end: "bottom bottom",
        pin: pinEl,
        pinSpacing: true,
        scrub: 1,
        anticipatePin: 1,
        invalidateOnRefresh: true,
        onUpdate: (self) => smoothProgress(self.progress),
      });

      gsap.fromTo(
        pinEl,
        { autoAlpha: 0, y: 20 },
        {
          autoAlpha: 1,
          y: 0,
          duration: 0.8,
          ease: "power3.out",
          scrollTrigger: {
            trigger: section,
            start: "top 75%",
            once: true,
          },
        },
      );

      return () => {
        pinST.kill();
      };
    },
    { scope: sectionRef },
  );

  const segmentCount = 3;
  const phase = progress * segmentCount;
  const activeIndex = Math.min(machines.length - 1, Math.max(0, Math.floor(phase)));
  const activeMachine = machines[activeIndex];
  const isVisumax800 = activeMachine.nameEn === "VISUMAX 800";
  const isVisumax500 = activeMachine.nameEn === "VISUMAX 500";
  const isCatalysLaser = activeMachine.nameEn === "Catalys laser";
  const eyebrowLabel = activeMachine.headlineEyebrowLabel ?? messages.eyebrowLabel;
  const titleText = activeMachine.headlineTitle ?? messages.title;
  const [titleLine1 = "", titleLine2 = ""] = titleText.split("\n");
  const topDescription = activeMachine.headlineDescription ?? messages.description;
  const ctaLabel = activeMachine.headlineCtaLabel ?? activeMachine.nameEn ?? messages.ctaLabel;
  const sectionBgImage = activeMachine.bgImageSrc ?? "/main/img_main_machine_bg01.png";

  return (
    <section ref={sectionRef} className={styles.section} aria-label="Advanced technology systems">
      <div ref={pinRef} className={styles.pinShell}>
        <AnimatePresence mode="sync" initial={false}>
          <motion.div
            key={`${activeMachine.nameEn}-bg`}
            className={styles.bgLayer}
            style={{ backgroundImage: `url("${sectionBgImage}")` }}
            initial={reduceMotion ? { opacity: 0 } : { opacity: 0, scale: 1.01 }}
            animate={reduceMotion ? { opacity: 1 } : { opacity: 1, scale: 1 }}
            exit={reduceMotion ? { opacity: 0 } : { opacity: 0, scale: 0.995 }}
            transition={reduceMotion ? { duration: 0.2 } : { duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
            aria-hidden
          />
        </AnimatePresence>
        <div className={styles.inner}>
          <div className={styles.copy}>
            <div className={styles.headlineBlock}>
              <p className={styles.eyebrow}>
                <img
                  src="/main/img_main_machine_logo.png"
                  alt=""
                  className={styles.eyebrowDot}
                  aria-hidden="true"
                  loading="lazy"
                  decoding="async"
                />
                <span className={styles.eyebrowText}>{eyebrowLabel}</span>
              </p>

              <h2 className={styles.title}>
              <span
                className={`${styles.titleLinePrimary} ${isVisumax500 ? styles.titleLinePrimary500 : ""} ${isCatalysLaser ? styles.titleLinePrimaryCatalys : ""}`}
              >
                {titleLine1}
              </span>
                <span className={styles.titleLineSecondary}>{titleLine2}</span>
              </h2>
              <p className={styles.description}>{topDescription}</p>
              <button type="button" className={styles.cta}>
                <span className={styles.ctaText}>{ctaLabel}</span>
              </button>
            </div>

            <AnimatePresence mode="sync" initial={false}>
              <motion.div
                key={activeMachine.nameEn}
                className={`${styles.machineInfoBlock} ${isVisumax800 ? styles.machineInfoBlock800 : ""} ${isVisumax500 ? styles.machineInfoBlock500 : ""} ${isCatalysLaser ? styles.machineInfoBlockCatalys : ""}`}
                initial={reduceMotion ? { opacity: 0 } : { opacity: 0, y: 14 }}
                animate={reduceMotion ? { opacity: 1 } : { opacity: 1, y: 0 }}
                exit={reduceMotion ? { opacity: 0 } : { opacity: 0, y: -8 }}
                transition={reduceMotion ? { duration: 0.2 } : { duration: 0.38, ease: [0.22, 1, 0.36, 1] }}
              >
                <p
                  className={`${styles.machineBackdropTitle} ${isVisumax800 ? styles.machineBackdropTitle800 : ""} ${isVisumax500 ? styles.machineBackdropTitle500 : ""}`}
                  aria-hidden
                >
                  {activeMachine.nameEn}
                </p>
                <p className={styles.machineTitle}>
                  <span
                    className={`${styles.machineTitleKo} ${isVisumax500 ? styles.machineTitleKo500 : ""} ${isCatalysLaser ? styles.machineTitleKoCatalys : ""}`}
                  >
                    {activeMachine.nameKo}
                  </span>
                  <span className={styles.machineTitleEn}>{activeMachine.nameEn}</span>
                </p>
                <p className={styles.machineDesc}>
                  {activeMachine.description}
                </p>
              </motion.div>
            </AnimatePresence>
          </div>

          <AnimatePresence mode="sync" initial={false}>
            <motion.div
              key={activeMachine.imageSrc}
              className={`${styles.imageWrap} ${isVisumax500 ? styles.imageWrap500 : ""} ${isCatalysLaser ? styles.imageWrapCatalys : ""}`}
              aria-hidden
              initial={reduceMotion ? { opacity: 0 } : { opacity: 0, x: 18 }}
              animate={reduceMotion ? { opacity: 1 } : { opacity: 1, x: 0 }}
              exit={reduceMotion ? { opacity: 0 } : { opacity: 0, x: -12 }}
              transition={reduceMotion ? { duration: 0.2 } : { duration: 0.42, ease: [0.22, 1, 0.36, 1] }}
            >
              <img
                src={activeMachine.imageSrc ?? ""}
                alt=""
                className={`${styles.machineImage} ${isVisumax500 ? styles.machineImage500 : ""} ${isCatalysLaser ? styles.machineImageCatalys : ""} ${
                  (isVisumax800 && modelLoaded800) || (isVisumax500 && modelLoaded500)
                    ? styles.machineImageHidden
                    : ""
                }`}
                loading="lazy"
                decoding="async"
              />
              {isVisumax800 ? (
                <div
                  className={styles.modelOverlay}
                  aria-hidden
                  style={{ ["--overlay-scale" as string]: config800.overlayScale }}
                >
                  <VisumaxModelScene
                    modelUrl="/main/visumax800.glb"
                    config={config800}
                    onLoaded={handleModel800Loaded}
                  />
                </div>
              ) : null}
              {isVisumax500 ? (
                <div
                  className={styles.modelOverlay}
                  aria-hidden
                  style={{ ["--overlay-scale" as string]: config500.overlayScale }}
                >
                  <VisumaxModelScene
                    modelUrl="/main/visumax500.glb"
                    config={config500}
                    onLoaded={handleModel500Loaded}
                  />
                </div>
              ) : null}
            </motion.div>
          </AnimatePresence>
        </div>
      </div>

      {/* GLB 모델 옵션 패널 — SHOW_VISUMAX_CONFIG_PANEL 로 숨김 처리.
       *   state/핸들러는 그대로 살아있어 내부 씬은 정상 동작, UI 만 스킵. */}
      {SHOW_VISUMAX_CONFIG_PANEL ? (
        <VisumaxConfigPanel
          config800={config800}
          config500={config500}
          onChange800={setConfig800}
          onChange500={setConfig500}
          onReset800={() => setConfig800(VISUMAX_800_DEFAULT_CONFIG)}
          onReset500={() => setConfig500(DEFAULT_MODEL_SCENE_CONFIG)}
        />
      ) : null}
    </section>
  );
}
