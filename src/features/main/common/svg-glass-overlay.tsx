"use client";

import {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
  type CSSProperties,
  type RefObject,
} from "react";
import styles from "./svg-glass-overlay.module.css";

/**
 * 스크롤 뒷단 "경량 글래스" 레이어.
 *
 * 히어로에선 3D Canvas(MeshTransmissionMaterial) 가 굴절을 보여주고,
 * 히어로를 벗어나는 순간 이 SVG 오버레이가 페이드인 되어 페이지 끝까지 따라간다.
 * Figma 원본을 그대로 재현 (inner shadow, gradient stroke 유지).
 *
 * - filter/gradient id 는 SVG 별로 고유값(`_1_242`, `_1_239`)이라 충돌 없음.
 * - pointer-events: none → 뒤 DOM 상호작용 그대로 통과.
 * - opacity 는 부모(MainPage)에서 스크롤 진행도로 제어.
 * - lens1, lens2 모두 자체 옵션 패널로 독립 이동·스케일 조절 가능.
 */

interface LensConfig {
  offsetXRem: number;
  offsetYRem: number;
  scale: number;
}

const DEFAULT_LENS1_CONFIG: LensConfig = {
  offsetXRem: 2.6,
  offsetYRem: 0,
  scale: 1,
};

/**
 * lens2 오프셋 기본값 — 3D Canvas 의 orb2 와 시각적으로 일치하도록 튜닝된 위치
 * (lens1 우측에 살짝 겹침).
 */
const DEFAULT_LENS2_CONFIG: LensConfig = {
  offsetXRem: -3.25,
  offsetYRem: 0,
  scale: 1,
};

/**
 * 크로스페이드 트리거 — 스크롤 임계점 기반 토글 + CSS 트랜지션.
 *
 * 상단(히어로) 구간:
 *   - `triggerVh` — 뷰포트 이 지점 지나면 3D → SVG, 되돌아오면 SVG → 3D.
 *
 * 하단(페이지 끝) 구간 — "SVG → 3D → SVG → 0" 시퀀스:
 *   페이드-인 trigger 는 DOM sentinel (유튜브 섹션 바로 뒤) 위치 기반이라
 *   섹션 높이가 바뀌어도 anchor 가 따라간다.
 *   - `bottomGlassFadeInVh`  — sentinel 이 뷰포트를 몇 vh 통과하는 동안 글래스가 0 → 1 로 페이드인.
 *   - `bottomGlassFadeOutVh` — 페이지 하단 근접 시 글래스가 1 → 0 으로 페이드아웃 하는 구간 폭(vh).
 *   - `bottomFadeVh`         — 맨 아래 남은 스크롤이 이 값 이하일 때 SVG 를 최종 페이드 0.
 *
 * 기본값(1080 vh 기준) 개념도:
 *   sentinel.top >= vh          → SVG stable (글래스 0)
 *   sentinel.top ∈ (0, vh)      → SVG ↔ Glass 크로스페이드 (fadeInVh 폭)
 *   sentinel.top < 0, 여유 remaining → Glass hold
 *   remaining ∈ (fade, fade+out) → Glass → SVG 크로스페이드
 *   remaining ≤ fade            → SVG → 0
 */
interface CrossfadeConfig {
  triggerVh: number;
  bottomFadeVh: number;
  bottomGlassFadeInVh: number;
  bottomGlassFadeOutVh: number;
}

const DEFAULT_CROSSFADE: CrossfadeConfig = {
  triggerVh: 0.25,
  bottomFadeVh: 0.25,
  bottomGlassFadeInVh: 0.6,
  bottomGlassFadeOutVh: 0.3,
};

/**
 * 하단 구간 glass/svg opacity 계산.
 *   - `sentinelTop` : 유튜브 섹션 끝 sentinel 의 `getBoundingClientRect().top` (px).
 *                    null 이면 sentinel 못 찾음 → remaining 만 기준으로 fallback.
 *   - glass 준비 안 됐으면 SVG 단독 페이드만 수행.
 */
function computeBottomOpacities(
  sentinelTop: number | null,
  remainingVh: number,
  vh: number,
  cfg: CrossfadeConfig,
  isGlassReady: boolean,
): { glassOpacity: number; svgOpacity: number } {
  const bottomFade = Math.max(0.0001, cfg.bottomFadeVh);

  // glass 미준비 or sentinel 미존재 → SVG 단독 페이드.
  if (!isGlassReady || sentinelTop === null) {
    const svg = Math.min(1, Math.max(0, remainingVh / bottomFade));
    return { glassOpacity: 0, svgOpacity: svg };
  }

  const fadeIn = Math.max(0.0001, cfg.bottomGlassFadeInVh);
  const fadeOut = Math.max(0.0001, cfg.bottomGlassFadeOutVh);
  const fadeInPx = fadeIn * vh;
  const fadeOutVh = fadeOut;

  // Fade-in progress — sentinel 이 뷰포트를 통과하는 정도로 계산.
  //   sentinel.top >= vh         → inProgress=0 (sentinel 이 아직 뷰포트 밑)
  //   sentinel.top ∈ (vh - fadeIn*vh, vh) → 선형 보간
  //   sentinel.top <= vh - fadeIn*vh      → inProgress=1 (완전히 통과)
  const inProgress = Math.min(1, Math.max(0, (vh - sentinelTop) / fadeInPx));

  // Fade-out progress — 페이지 하단 remaining 이 (fade, fade+fadeOut) 구간일 때 1→0.
  //   remaining >= fade + fadeOut → outProgress=1 (아직 멀음)
  //   remaining = fade            → outProgress=0 (fade out 완료)
  const outProgress = Math.min(
    1,
    Math.max(0, (remainingVh - bottomFade) / fadeOutVh),
  );

  const glassOpacity = Math.min(inProgress, outProgress);
  // SVG: 하단 최종 페이드 구간에선 remaining 기반으로 감쇠, 아니면 glass 의 보수값.
  const svgOpacity =
    remainingVh <= bottomFade
      ? Math.min(1, Math.max(0, remainingVh / bottomFade))
      : 1 - glassOpacity;

  return { glassOpacity, svgOpacity };
}
/** 역방향(아래→위) 복귀 시 idle apply 스케줄링 여유 (스크롤 이벤트 종료 감지용) */
const REVERSE_HANDOFF_IDLE_MS = 140;

/**
 * dev 튜닝용 렌즈 옵션 패널 노출 스위치.
 *   - false: state/핸들러는 유지, UI 만 스킵 → 크로스페이드/SVG 위치 로직은 그대로 동작.
 *   - true: 좌측 하단 토글 버튼 + 팝업 패널 노출.
 */
const SHOW_LENS_CONFIG_PANEL = false;

interface LensConfigPanelProps {
  lens1: LensConfig;
  lens2: LensConfig;
  onChangeLens1: (next: LensConfig) => void;
  onChangeLens2: (next: LensConfig) => void;
  onResetLens1: () => void;
  onResetLens2: () => void;
  crossfade: CrossfadeConfig;
  onChangeCrossfade: (next: CrossfadeConfig) => void;
  onResetCrossfade: () => void;
}

interface LensFieldSetProps {
  title: string;
  config: LensConfig;
  onChange: (next: LensConfig) => void;
  onReset: () => void;
}

const LensFieldSet = ({ title, config, onChange, onReset }: LensFieldSetProps) => {
  const handleNumber = (key: keyof LensConfig) => (event: React.ChangeEvent<HTMLInputElement>) => {
    onChange({ ...config, [key]: Number(event.target.value) });
  };

  return (
    <section className={styles.panelSection}>
      <div className={styles.panelSectionHead}>
        <span className={styles.panelSectionTitle}>{title}</span>
        <button type="button" className={styles.panelReset} onClick={onReset}>
          reset
        </button>
      </div>
      <label className={styles.panelField}>
        <span>X 오프셋(rem): {config.offsetXRem.toFixed(2)}</span>
        <input
          type="range"
          min={-40}
          max={40}
          step={0.05}
          value={config.offsetXRem}
          onChange={handleNumber("offsetXRem")}
        />
      </label>
      <label className={styles.panelField}>
        <span>Y 오프셋(rem): {config.offsetYRem.toFixed(2)}</span>
        <input
          type="range"
          min={-40}
          max={40}
          step={0.05}
          value={config.offsetYRem}
          onChange={handleNumber("offsetYRem")}
        />
      </label>
      <label className={styles.panelField}>
        <span>스케일 배율: {config.scale.toFixed(2)}</span>
        <input
          type="range"
          min={0.3}
          max={2}
          step={0.01}
          value={config.scale}
          onChange={handleNumber("scale")}
        />
      </label>
    </section>
  );
};

interface CrossfadeFieldSetProps {
  config: CrossfadeConfig;
  onChange: (next: CrossfadeConfig) => void;
  onReset: () => void;
}

const CrossfadeFieldSet = ({ config, onChange, onReset }: CrossfadeFieldSetProps) => {
  const handleNumber = (key: keyof CrossfadeConfig) => (event: React.ChangeEvent<HTMLInputElement>) => {
    onChange({ ...config, [key]: Number(event.target.value) });
  };

  return (
    <section className={styles.panelSection}>
      <div className={styles.panelSectionHead}>
        <span className={styles.panelSectionTitle}>크로스페이드 트리거 (뷰포트 비율)</span>
        <button type="button" className={styles.panelReset} onClick={onReset}>
          reset
        </button>
      </div>
      <label className={styles.panelField}>
        <span>전환 지점 (vh 비율): {config.triggerVh.toFixed(2)}</span>
        <input
          type="range"
          min={0}
          max={1.5}
          step={0.01}
          value={config.triggerVh}
          onChange={handleNumber("triggerVh")}
        />
      </label>
      <label className={styles.panelField}>
        <span>하단 페이드 (vh 남음): {config.bottomFadeVh.toFixed(2)}</span>
        <input
          type="range"
          min={0}
          max={1.5}
          step={0.01}
          value={config.bottomFadeVh}
          onChange={handleNumber("bottomFadeVh")}
        />
      </label>
    </section>
  );
};

const LensConfigPanel = ({
  lens1,
  lens2,
  onChangeLens1,
  onChangeLens2,
  onResetLens1,
  onResetLens2,
  crossfade,
  onChangeCrossfade,
  onResetCrossfade,
}: LensConfigPanelProps) => {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <div className={styles.panel}>
      <button type="button" className={styles.panelToggle} onClick={() => setIsOpen((v) => !v)}>
        {isOpen ? "SVG lens 닫기" : "SVG lens 옵션"}
      </button>
      {isOpen ? (
        <div className={styles.panelPopup}>
          <div className={styles.panelHead}>
            <span className={styles.panelTitle}>SVG Lens (경량 글래스)</span>
          </div>
          <CrossfadeFieldSet
            config={crossfade}
            onChange={onChangeCrossfade}
            onReset={onResetCrossfade}
          />
          <LensFieldSet
            title="Lens 1 (원)"
            config={lens1}
            onChange={onChangeLens1}
            onReset={onResetLens1}
          />
          <LensFieldSet
            title="Lens 2 (크레센트)"
            config={lens2}
            onChange={onChangeLens2}
            onReset={onResetLens2}
          />
        </div>
      ) : null}
    </div>
  );
};

const toTransform = (config: LensConfig): CSSProperties => ({
  transform: `translate(${config.offsetXRem}rem, ${config.offsetYRem}rem) scale(${config.scale})`,
});

interface SvgGlassOverlayProps {
  /**
   * 3D 글래스(Canvas) 레이어 ref — 스크롤 진행도에 따라 SVG 오버레이와
   * 크로스페이드 시키기 위해 opacity/visibility 를 직접 제어한다.
   * 생략하면 SVG 레이어만 페이드인 (3D 쪽은 건드리지 않음).
   */
  glassLayerRef?: RefObject<HTMLDivElement | null>;
  /**
   * 3D 글래스 준비 완료 여부.
   * - 첫 로드: GSAP 인트로가 글래스를 담당하므로 false 동안엔 SVG를 건드리지 않음.
   * - 역방향 리마운트: false 동안 SVG를 즉시 보여주고 true가 되면 부드럽게 전환.
   */
  glassReady?: boolean;
  /**
   * true = 역방향 리마운트 상황. false(기본) = 첫 로드.
   * 이 값이 true이면 !glassReady 동안 SVG를 즉시 보여준다.
   */
  isRemount?: boolean;
  /** glassReady가 true 로 전환되어 핸드오프가 완료됐을 때 부모에 알림 */
  onGlassReady?: () => void;
  /**
   * 유튜브 섹션 바로 뒤에 꽂은 0px sentinel ref.
   * 하단 SVG → 3D 글래스 페이드-인이 "언제 시작할지" 를 이 sentinel 의
   * `getBoundingClientRect().top` 으로 anchor 한다.
   * 생략 시 하단 글래스 시퀀스가 비활성(기존 SVG 단독 페이드로 fallback).
   */
  bottomGlassAnchorRef?: RefObject<HTMLDivElement | null>;
}

export const SvgGlassOverlay = forwardRef<HTMLDivElement, SvgGlassOverlayProps>(function SvgGlassOverlay(
  {
    glassLayerRef,
    glassReady = true,
    isRemount = false,
    onGlassReady,
    bottomGlassAnchorRef,
  },
  ref,
) {
  const [lens1, setLens1] = useState<LensConfig>(DEFAULT_LENS1_CONFIG);
  const [lens2, setLens2] = useState<LensConfig>(DEFAULT_LENS2_CONFIG);
  const [crossfade, setCrossfade] = useState<CrossfadeConfig>(DEFAULT_CROSSFADE);

  // 외부(ref 포워딩) 와 내부(스크롤 핸들러) 양쪽에서 참조해야 하므로
  // 로컬 ref 로 잡고, useImperativeHandle 로 부모 ref 에도 같은 엘리먼트를 노출.
  const overlayRef = useRef<HTMLDivElement | null>(null);
  useImperativeHandle<HTMLDivElement | null, HTMLDivElement | null>(ref, () => overlayRef.current, []);

  const lens1Style = toTransform(lens1);
  const lens2Style = toTransform(lens2);

  // 크로스페이드 로직:
  //   1) 상단 트리거(triggerVh) — 임계점 토글. 3D 글래스 ↔ SVG 를 1/0 으로 스왑.
  //        CSS transition(280ms) 이 실제 페이드 담당.
  //   2) 하단 페이드(bottomFadeVh) — 페이지 끝 도달 직전 구간을 스크롤 진행도에 비례해
  //        선형 페이드. 남은 스크롤 / bottomFadeVh 비율을 그대로 SVG opacity 로.
  //        구간 내에서 opacity 가 계속 바뀌므로 CSS transition 이 "따라오며" 부드럽게 보간.
  const crossfadeRef = useRef(crossfade);
  useEffect(() => {
    crossfadeRef.current = crossfade;
  }, [crossfade]);
  const glassReadyRef = useRef(glassReady);
  useEffect(() => {
    glassReadyRef.current = glassReady;
  }, [glassReady]);
  const isRemountRef = useRef(isRemount);
  useEffect(() => {
    isRemountRef.current = isRemount;
  }, [isRemount]);
  const onGlassReadyRef = useRef(onGlassReady);
  useEffect(() => {
    onGlassReadyRef.current = onGlassReady;
  }, [onGlassReady]);
  // 역방향 복귀 핸드오프 상태 추적
  const prevScrollYRef = useRef(0);
  const lastScrollTsRef = useRef(0);
  const wasBelowTriggerRef = useRef(false);
  const reverseHandoffPendingRef = useRef(false);

  useEffect(() => {
    if (typeof window === "undefined") return;

    // 직전에 적용한 값 캐시 — 상태가 동일하면 스타일 터치 생략.
    // 주의: 여기서 NaN 을 쓰면 `Math.abs(x - NaN) = NaN`, `NaN > 0.005 = false` 로
    //       첫 호출이 영영 스킵되어 opacity 가 한 번도 셋팅되지 않는다. 반드시 -1 같은
    //       실제 opacity 범위 밖의 숫자로 초기화할 것.
    let lastGlassOpacity = -1;
    let lastSvgOpacity = -1;
    // "" = 아직 미설정 (첫 호출에서 반드시 세팅됨)
    let lastGlassZ = "";
    let showRafId: number | null = null;

    const applyGlassOpacity = (el: HTMLDivElement, targetOpacity: number) => {
      const next = targetOpacity.toFixed(3);
      if (targetOpacity > 0) {
        const wasHidden = el.style.visibility === "hidden";
        el.style.visibility = "visible";
        // hidden -> visible 복귀 시 같은 프레임에 opacity 1을 주면 페이드가 스킵될 수 있어
        // 한 프레임 분리해서 0 -> 1 전환을 강제한다.
        if (wasHidden) {
          el.style.opacity = "0";
          if (showRafId) {
            cancelAnimationFrame(showRafId);
          }
          showRafId = requestAnimationFrame(() => {
            if (el.style.visibility === "visible") {
              el.style.opacity = next;
            }
            showRafId = null;
          });
          return;
        }
      }
      el.style.opacity = next;
    };

    const compute = () => {
      const isGlassReady = glassReadyRef.current;
      const vh = window.innerHeight || 1;
      const cfg = crossfadeRef.current;
      const { triggerVh } = cfg;
      const y = window.scrollY;
      const now = performance.now();
      const triggerPx = vh * triggerVh;

      const docHeight = Math.max(
        document.documentElement.scrollHeight,
        document.body.scrollHeight,
      );
      const remaining = docHeight - (y + vh);
      const remainingVh = remaining / vh;

      const isAtTop = y < triggerPx;
      const delta = y - prevScrollYRef.current;
      if (Math.abs(delta) > 0.3) {
        lastScrollTsRef.current = now;
      }
      prevScrollYRef.current = y;
      if (!isAtTop) {
        wasBelowTriggerRef.current = true;
        reverseHandoffPendingRef.current = true;
      }

      /**
       * 글래스 미준비 구간 처리 (상단):
       *   - 히어로 첫 로드: GSAP 인트로가 담당 → null 반환으로 SVG/glassLayer 를 건드리지 않음.
       *   - 상단에서 역방향 리마운트: 글래스가 준비될 때까지 SVG 를 즉시 노출.
       * 하단은 `computeBottomOpacities` 에서 isGlassReady 가 false 면 자동으로 SVG 단독 페이드
       * 로 fallback 하므로 별도 분기 없이 동일 공식 사용 → "미드스크롤 새로고침" 대응도 유지.
       */
      if (!isGlassReady && isAtTop && !isRemountRef.current) {
        return null; // 히어로 구간 첫 로드 — GSAP 담당
      }

      // 글래스가 막 준비됐으면(isRemount 후 첫 ready) 부모에 단발성 알림.
      // ref 를 즉시 false 로 내려 스크롤 틱마다 반복 호출되는 것을 방지.
      if (isGlassReady && isRemountRef.current) {
        isRemountRef.current = false;
        onGlassReadyRef.current?.();
      }

      if (isAtTop) {
        // 상단(히어로) 구간 — 기존 로직 유지.
        const canShowGlassAtTop = isGlassReady;
        const glassOpacity = canShowGlassAtTop ? 1 : 0;
        const svgOpacity = canShowGlassAtTop ? 0 : 1;
        if (canShowGlassAtTop) {
          // 핸드오프 완료: 이후 상단 미세 스크롤엔 대기 조건을 다시 강제하지 않음
          reverseHandoffPendingRef.current = false;
          wasBelowTriggerRef.current = false;
        }
        return { glassOpacity, svgOpacity, isAtTop };
      }

      // 하단(비-히어로) 구간 — sentinel 기반 시퀀스:
      //   SVG stable → SVG→Glass → Glass hold → Glass→SVG → SVG→0
      // 글래스가 준비되지 않았거나(모바일 등) sentinel 이 없으면 SVG 단독 페이드로 fallback.
      const sentinel = bottomGlassAnchorRef?.current ?? null;
      const sentinelTop = sentinel ? sentinel.getBoundingClientRect().top : null;
      const { glassOpacity, svgOpacity } = computeBottomOpacities(
        sentinelTop,
        remainingVh,
        vh,
        cfg,
        isGlassReady,
      );
      return { glassOpacity, svgOpacity, isAtTop };
    };

    const apply = () => {
      const computed = compute();
      if (!computed) return; // 첫 로드 미준비 구간 — 건드리지 않음
      const { glassOpacity, svgOpacity, isAtTop } = computed;
      const svgTarget = overlayRef.current;
      const glassTarget = glassLayerRef?.current ?? null;

      // glass 레이어 opacity/visibility 처리:
      //   - fade 는 CSS transition(280ms) 이 담당, JS 는 target 값만 토글.
      //   - opacity 0 으로 전환될 때 visibility 를 즉시 끄면 fade 가 보이지 않으므로
      //     반드시 transitionend 이후에만 hidden 으로 내림 (아래 리스너).
      //   - opacity 1 로 복귀할 때는 먼저 visibility 를 visible 로 올리고 나서 opacity 를 셋팅
      //     (그렇지 않으면 hidden 상태에서 transition 이 발화되지 않음).
      if (glassTarget && Math.abs(glassOpacity - lastGlassOpacity) > 0.005) {
        applyGlassOpacity(glassTarget, glassOpacity);
        lastGlassOpacity = glassOpacity;
      }
      // z-index 동적 토글:
      //   isAtTop(히어로 구간) → z:3 으로 타이틀 위 → 3D 굴절 효과 유지
      //   히어로 벗어남       → z:1 로 foreground(z:2) 뒤 → 머신 섹션 위에서 pointer 간섭 없음
      //   (pointer-events:none 이 이미 걸려있지만, 내부 패널/자식 중 auto 인 것들이
      //    예기치 않게 hit test 에 걸리는 케이스까지 z-index 로 원천 차단)
      if (glassTarget) {
        const nextZ = isAtTop ? "3" : "1";
        if (nextZ !== lastGlassZ) {
          glassTarget.style.zIndex = nextZ;
          lastGlassZ = nextZ;
        }
      }
      if (svgTarget && Math.abs(svgOpacity - lastSvgOpacity) > 0.005) {
        svgTarget.style.opacity = svgOpacity.toFixed(3);
        svgTarget.style.visibility = "visible";
        lastSvgOpacity = svgOpacity;
      }
    };

    // 역방향 핸드오프는 "스크롤 정지" 조건이 필요하므로,
    // 마지막 스크롤 이후 idle 시점에 apply()를 한 번 더 호출해 전환 누락을 방지한다.
    let idleApplyTimer: ReturnType<typeof setTimeout> | null = null;
    const scheduleIdleApply = () => {
      if (idleApplyTimer) {
        clearTimeout(idleApplyTimer);
      }
      idleApplyTimer = setTimeout(() => {
        requestAnimationFrame(apply);
        idleApplyTimer = null;
      }, REVERSE_HANDOFF_IDLE_MS + 16);
    };

    // fade 완료 후 합성 레이어에서 제외 — compositor 비용 제거용.
    //   · opacity transition 이 끝났을 때 opacity 가 0 이면 visibility:hidden 으로 내림.
    //   · 다시 opacity>0 으로 올라가는 경로는 apply() 에서 미리 visible 로 돌려놓는다.
    const glassTarget = glassLayerRef?.current ?? null;
    const handleGlassTransitionEnd = (e: TransitionEvent) => {
      if (e.propertyName !== "opacity") return;
      const el = glassTarget;
      if (!el) return;
      if (parseFloat(el.style.opacity || "1") < 0.01) {
        el.style.visibility = "hidden";
      }
    };
    glassTarget?.addEventListener("transitionend", handleGlassTransitionEnd);

    const rafId = requestAnimationFrame(apply);

    // apply() 는 내부에서 `scrollHeight` 와 sentinel `getBoundingClientRect` 같은
    // 레이아웃 읽기를 수행한다. 스크롤 이벤트 한 프레임에 여러 번 발생하면(네이티브
    // 모멘텀 등) 중복 레이아웃 읽기가 누적되므로 rAF 로 1프레임 1회로 병합.
    //   · scheduleIdleApply 는 "스크롤 정지 후 한번 더" 가 목적이라 이벤트 단위에 그대로 둔다.
    let applyRafId: number | null = null;
    const scheduleApply = () => {
      if (applyRafId !== null) return;
      applyRafId = requestAnimationFrame(() => {
        applyRafId = null;
        apply();
      });
    };

    const handleScroll = () => {
      scheduleApply();
      scheduleIdleApply();
    };
    window.addEventListener("scroll", handleScroll, { passive: true });
    window.addEventListener("resize", scheduleApply);
    return () => {
      cancelAnimationFrame(rafId);
      if (showRafId) {
        cancelAnimationFrame(showRafId);
      }
      if (applyRafId !== null) {
        cancelAnimationFrame(applyRafId);
      }
      window.removeEventListener("scroll", handleScroll);
      window.removeEventListener("resize", scheduleApply);
      glassTarget?.removeEventListener("transitionend", handleGlassTransitionEnd);
      if (idleApplyTimer) {
        clearTimeout(idleApplyTimer);
      }
    };
  }, [glassLayerRef, bottomGlassAnchorRef]);

  /**
   * glassReady / isRemount / crossfade 값이 바뀔 때 즉시 재계산.
   *
   *  ┌─ !glassReady & !isRemount ──┐  첫 로드: GSAP 인트로가 담당 → 아무것도 건드리지 않음
   *  ├─ !glassReady & isRemount ───┤  역방향 대기: SVG 즉시 노출, glassLayer 숨김
   *  └─ glassReady ────────────────┘  정상: 스크롤 위치 기준으로 재계산
   */
  useEffect(() => {
    if (typeof window === "undefined") return;
    const svgTarget = overlayRef.current;
    const glassTarget = glassLayerRef?.current ?? null;

    const vh = window.innerHeight || 1;
    const y = window.scrollY;
    const triggerPx = vh * crossfade.triggerVh;
    const docHeight = Math.max(
      document.documentElement.scrollHeight,
      document.body.scrollHeight,
    );
    const remaining = docHeight - (y + vh);
    const remainingVh = remaining / vh;
    const isAtTop = y < triggerPx;

    const sentinel = bottomGlassAnchorRef?.current ?? null;
    const sentinelTop = sentinel ? sentinel.getBoundingClientRect().top : null;

    if (!glassReady) {
      // 히어로 첫 로드(isAtTop + !isRemount) 는 GSAP 담당 → 건드리지 않음.
      if (isAtTop && !isRemount) return;

      // 그 외(히어로 밖 mid-scroll reload, 역방향 리마운트, 하단 글래스 마운트 대기 등):
      // SVG 를 즉시 노출하고 글래스 레이어는 숨김.
      const { svgOpacity } = computeBottomOpacities(
        sentinelTop,
        remainingVh,
        vh,
        crossfade,
        false,
      );
      if (glassTarget) {
        glassTarget.style.opacity = "0";
        glassTarget.style.zIndex = isAtTop ? "3" : "1";
      }
      if (svgTarget) {
        svgTarget.style.visibility = "visible";
        svgTarget.style.opacity = (isAtTop ? 1 : svgOpacity).toFixed(3);
      }
      return;
    }

    // glassReady = true 로 전환된 시점 — 스크롤 핸드오프 경로와 동일하게 ref 초기화.
    if (isRemountRef.current) {
      isRemountRef.current = false;
      onGlassReadyRef.current?.();
    }

    if (!isAtTop) {
      wasBelowTriggerRef.current = true;
      reverseHandoffPendingRef.current = true;
    }

    // 상단이면 glass=1 / svg=0, 하단이면 sentinel + remaining 기반 공식.
    const bottom = computeBottomOpacities(
      sentinelTop,
      remainingVh,
      vh,
      crossfade,
      true,
    );
    const glassOpacity = isAtTop ? 1 : bottom.glassOpacity;
    const svgOpacity = isAtTop ? 0 : bottom.svgOpacity;

    if (isAtTop) {
      reverseHandoffPendingRef.current = false;
      wasBelowTriggerRef.current = false;
    }

    if (glassTarget) {
      // hidden → visible 복귀 시 CSS transition 이 발화하려면
      // visibility 먼저 visible 로 올린 뒤 한 프레임 후 opacity 셋팅.
      if (glassOpacity > 0) {
        const wasHidden = glassTarget.style.visibility === "hidden";
        glassTarget.style.visibility = "visible";
        if (wasHidden) {
          glassTarget.style.opacity = "0";
          requestAnimationFrame(() => {
            if (glassTarget.style.visibility === "visible") {
              glassTarget.style.opacity = glassOpacity.toFixed(3);
            }
          });
        } else {
          glassTarget.style.opacity = glassOpacity.toFixed(3);
        }
      } else {
        glassTarget.style.opacity = glassOpacity.toFixed(3);
      }
      glassTarget.style.zIndex = isAtTop ? "3" : "1";
    }
    if (svgTarget) {
      svgTarget.style.opacity = svgOpacity.toFixed(3);
      svgTarget.style.visibility = "visible";
    }
  }, [crossfade, glassLayerRef, glassReady, isRemount, bottomGlassAnchorRef]);

  return (
    <>
      <div ref={overlayRef} className={styles.overlay} aria-hidden>
        <div className={styles.lensGroup}>
          <svg
            className={styles.lens1}
            style={lens1Style}
            xmlns="http://www.w3.org/2000/svg"
            width="536"
            height="535"
            viewBox="0 0 536 535"
            fill="none"
          >
            <g filter="url(#filter0_ii_1_242)">
              <path
                d="M535.086 267.457C535.086 415.221 415.307 535 267.543 535C119.779 535 0 415.221 0 267.457C0 119.692 119.779 0 267.543 0C415.307 0 535.086 119.779 535.086 267.457Z"
                fill="white"
                fillOpacity="0.01"
              />
              <path
                d="M267.543 1.02246C414.742 1.02254 534.062 120.344 534.062 267.457C534.062 414.656 414.742 533.976 267.543 533.977C120.344 533.977 1.02264 414.656 1.02246 267.457C1.02246 120.258 120.343 1.02246 267.543 1.02246Z"
                stroke="url(#paint0_linear_1_242)"
                strokeWidth="2.04589"
              />
            </g>
            <defs>
              <filter
                id="filter0_ii_1_242"
                x="-3.25355"
                y="-3.25355"
                width="540.509"
                height="540.422"
                filterUnits="userSpaceOnUse"
                colorInterpolationFilters="sRGB"
              >
                <feFlood floodOpacity="0" result="BackgroundImageFix" />
                <feBlend mode="normal" in="SourceGraphic" in2="BackgroundImageFix" result="shape" />
                <feColorMatrix
                  in="SourceAlpha"
                  type="matrix"
                  values="0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 127 0"
                  result="hardAlpha"
                />
                <feOffset dx="2.16903" dy="2.16903" />
                <feGaussianBlur stdDeviation="2.04589" />
                <feComposite in2="hardAlpha" operator="arithmetic" k2="-1" k3="1" />
                <feColorMatrix
                  type="matrix"
                  values="0 0 0 0 1 0 0 0 0 1 0 0 0 0 1 0 0 0 0.6 0"
                />
                <feBlend mode="normal" in2="shape" result="effect1_innerShadow_1_242" />
                <feColorMatrix
                  in="SourceAlpha"
                  type="matrix"
                  values="0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 127 0"
                  result="hardAlpha"
                />
                <feOffset dx="-3.25355" dy="-3.25355" />
                <feGaussianBlur stdDeviation="10.2294" />
                <feComposite in2="hardAlpha" operator="arithmetic" k2="-1" k3="1" />
                <feColorMatrix
                  type="matrix"
                  values="0 0 0 0 1 0 0 0 0 1 0 0 0 0 1 0 0 0 0.6 0"
                />
                <feBlend
                  mode="normal"
                  in2="effect1_innerShadow_1_242"
                  result="effect2_innerShadow_1_242"
                />
              </filter>
              <linearGradient
                id="paint0_linear_1_242"
                x1="236.433"
                y1="-13.0488"
                x2="549.831"
                y2="345.594"
                gradientUnits="userSpaceOnUse"
              >
                <stop stopColor="white" />
                <stop offset="0.524409" stopColor="white" stopOpacity="0" />
                <stop offset="1" stopColor="white" />
              </linearGradient>
            </defs>
          </svg>

          <svg
            className={styles.lens2}
            style={lens2Style}
            xmlns="http://www.w3.org/2000/svg"
            width="420"
            height="535"
            viewBox="0 0 420 535"
            fill="none"
          >
            <g filter="url(#filter0_ii_1_239)">
              <mask id="path-1-inside-1_1_239" fill="white">
                <path d="M151.713 0C299.477 0.000108677 419.256 119.779 419.256 267.457C419.256 415.221 299.477 535 151.713 535C95.3848 535 43.1244 517.593 0.0146484 487.866C66.3091 437.221 109.079 357.336 109.079 267.455C109.079 177.62 66.303 97.7512 0 47.1152C43.1125 17.3983 95.3786 0 151.713 0Z" />
              </mask>
              <path
                d="M151.713 0C299.477 0.000108677 419.256 119.779 419.256 267.457C419.256 415.221 299.477 535 151.713 535C95.3848 535 43.1244 517.593 0.0146484 487.866C66.3091 437.221 109.079 357.336 109.079 267.455C109.079 177.62 66.303 97.7512 0 47.1152C43.1125 17.3983 95.3786 0 151.713 0Z"
                fill="white"
                fillOpacity="0.01"
              />
              <path
                d="M151.713 0V-2.04589V-2.04589V0ZM419.256 267.457H421.302V267.457H419.256ZM151.713 535V537.046V537.046V535ZM0.0146484 487.866L-1.22735 486.24L-3.4664 487.951L-1.14675 489.551L0.0146484 487.866ZM109.079 267.455H111.125V267.455H109.079ZM0 47.1152L-1.1611 45.4307L-3.48185 47.0304L-1.24175 48.7412L0 47.1152ZM151.713 0V2.04589C298.348 2.046 417.21 120.909 417.21 267.457H419.256H421.302C421.302 118.649 300.607 -2.04578 151.713 -2.04589V0ZM419.256 267.457H417.21C417.21 414.091 298.347 532.954 151.713 532.954V535V537.046C300.607 537.046 421.302 416.351 421.302 267.457H419.256ZM151.713 535V532.954C95.8128 532.954 43.9553 515.68 1.17605 486.182L0.0146484 487.866L-1.14675 489.551C42.2936 519.505 94.9568 537.046 151.713 537.046V535ZM0.0146484 487.866L1.25665 489.492C68.0359 438.476 111.125 358 111.125 267.455H109.079H107.033C107.033 356.671 64.5822 435.965 -1.22735 486.24L0.0146484 487.866ZM109.079 267.455H111.125C111.125 176.955 68.0295 96.4955 1.24175 45.4893L0 47.1152L-1.24175 48.7412C64.5764 99.0069 107.033 178.285 107.033 267.455H109.079ZM0 47.1152L1.1611 48.7997C43.943 19.3107 95.8063 2.04589 151.713 2.04589V0V-2.04589C94.951 -2.04589 42.282 15.4859 -1.1611 45.4307L0 47.1152Z"
                fill="url(#paint0_linear_1_239)"
                mask="url(#path-1-inside-1_1_239)"
              />
            </g>
            <defs>
              <filter
                id="filter0_ii_1_239"
                x="-3.25355"
                y="-3.25355"
                width="424.678"
                height="540.423"
                filterUnits="userSpaceOnUse"
                colorInterpolationFilters="sRGB"
              >
                <feFlood floodOpacity="0" result="BackgroundImageFix" />
                <feBlend mode="normal" in="SourceGraphic" in2="BackgroundImageFix" result="shape" />
                <feColorMatrix
                  in="SourceAlpha"
                  type="matrix"
                  values="0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 127 0"
                  result="hardAlpha"
                />
                <feOffset dx="2.16903" dy="2.16903" />
                <feGaussianBlur stdDeviation="3.25355" />
                <feComposite in2="hardAlpha" operator="arithmetic" k2="-1" k3="1" />
                <feColorMatrix
                  type="matrix"
                  values="0 0 0 0 1 0 0 0 0 1 0 0 0 0 1 0 0 0 0.5 0"
                />
                <feBlend mode="normal" in2="shape" result="effect1_innerShadow_1_239" />
                <feColorMatrix
                  in="SourceAlpha"
                  type="matrix"
                  values="0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 127 0"
                  result="hardAlpha"
                />
                <feOffset dx="-3.25355" dy="-3.25355" />
                <feGaussianBlur stdDeviation="5.42258" />
                <feComposite in2="hardAlpha" operator="arithmetic" k2="-1" k3="1" />
                <feColorMatrix
                  type="matrix"
                  values="0 0 0 0 1 0 0 0 0 1 0 0 0 0 1 0 0 0 0.3 0"
                />
                <feBlend
                  mode="normal"
                  in2="effect1_innerShadow_1_239"
                  result="effect2_innerShadow_1_239"
                />
              </filter>
              <linearGradient
                id="paint0_linear_1_239"
                x1="185.253"
                y1="-13.0488"
                x2="499.632"
                y2="268.839"
                gradientUnits="userSpaceOnUse"
              >
                <stop stopColor="white" />
                <stop offset="0.524409" stopColor="white" stopOpacity="0" />
                <stop offset="1" stopColor="white" />
              </linearGradient>
            </defs>
          </svg>
        </div>
      </div>

      {SHOW_LENS_CONFIG_PANEL ? (
        <LensConfigPanel
          lens1={lens1}
          lens2={lens2}
          onChangeLens1={setLens1}
          onChangeLens2={setLens2}
          onResetLens1={() => setLens1(DEFAULT_LENS1_CONFIG)}
          onResetLens2={() => setLens2(DEFAULT_LENS2_CONFIG)}
          crossfade={crossfade}
          onChangeCrossfade={setCrossfade}
          onResetCrossfade={() => setCrossfade(DEFAULT_CROSSFADE)}
        />
      ) : null}
    </>
  );
});
