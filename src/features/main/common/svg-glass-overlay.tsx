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
 * 크로스페이드 트리거 — 스크롤을 이 지점(뷰포트 높이 비율) 지나면 3D → SVG 로 전환,
 * 되돌아오면 SVG → 3D 로 복귀. 스크롤에 연속 연동하지 않고 임계점 기반 토글 + CSS 트랜지션.
 *
 * `bottomFadeVh` — 페이지 맨 아래에서 이 정도 남았을 때 SVG 도 함께 사라짐 (스르륵 페이드 아웃).
 */
interface CrossfadeConfig {
  triggerVh: number;
  bottomFadeVh: number;
}

// 기존 startVh(0.05) 대비 10vh 내려서 0.15 에서 전환.
const DEFAULT_CROSSFADE: CrossfadeConfig = {
  triggerVh: 0.15,
  bottomFadeVh: 0.25,
};

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
}

export const SvgGlassOverlay = forwardRef<HTMLDivElement, SvgGlassOverlayProps>(function SvgGlassOverlay(
  { glassLayerRef },
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

    const compute = () => {
      const vh = window.innerHeight || 1;
      const { triggerVh, bottomFadeVh } = crossfadeRef.current;
      const y = window.scrollY;
      const triggerPx = vh * triggerVh;
      const bottomPx = Math.max(1, vh * bottomFadeVh);

      const docHeight = Math.max(
        document.documentElement.scrollHeight,
        document.body.scrollHeight,
      );
      const remaining = docHeight - (y + vh);
      // 하단 페이드 계수(0..1) — 남은 스크롤이 bottomPx 에 들어서면 1→0 으로 선형 감소.
      const bottomFactor = Math.min(1, Math.max(0, remaining / bottomPx));

      const isAtTop = y < triggerPx;
      const glassOpacity = isAtTop ? 1 : 0;
      // SVG 는 트리거를 넘으면 1 을 기본으로 하되, 하단 근접 시 bottomFactor 로 감쇠.
      const svgOpacity = isAtTop ? 0 : bottomFactor;

      return { glassOpacity, svgOpacity, isAtTop };
    };

    const apply = () => {
      const { glassOpacity, svgOpacity, isAtTop } = compute();
      const svgTarget = overlayRef.current;
      const glassTarget = glassLayerRef?.current ?? null;

      // 주의: visibility 를 opacity 와 동시에 토글하면 CSS opacity transition 이 보이지 않는다
      //       (visibility: hidden 은 즉시 적용되어 페이드가 무시됨). 그래서 여기서는
      //       opacity 만 건드리고 visibility 는 항상 'visible' 로 고정한다.
      //       pointer-events: none 이 이미 걸려 있어 상호작용도 차단됨.
      if (glassTarget && Math.abs(glassOpacity - lastGlassOpacity) > 0.005) {
        glassTarget.style.opacity = glassOpacity.toFixed(3);
        glassTarget.style.visibility = "visible";
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

    const rafId = requestAnimationFrame(apply);
    window.addEventListener("scroll", apply, { passive: true });
    window.addEventListener("resize", apply);
    return () => {
      cancelAnimationFrame(rafId);
      window.removeEventListener("scroll", apply);
      window.removeEventListener("resize", apply);
    };
  }, [glassLayerRef]);

  // trigger/bottom 값이 바뀌면 (패널 조작) 즉시 한 번 다시 계산해서 결과 반영.
  useEffect(() => {
    if (typeof window === "undefined") return;
    const vh = window.innerHeight || 1;
    const y = window.scrollY;
    const triggerPx = vh * crossfade.triggerVh;
    const bottomPx = Math.max(1, vh * crossfade.bottomFadeVh);
    const docHeight = Math.max(
      document.documentElement.scrollHeight,
      document.body.scrollHeight,
    );
    const remaining = docHeight - (y + vh);
    const bottomFactor = Math.min(1, Math.max(0, remaining / bottomPx));
    const isAtTop = y < triggerPx;
    const glassOpacity = isAtTop ? 1 : 0;
    const svgOpacity = isAtTop ? 0 : bottomFactor;

    const svgTarget = overlayRef.current;
    const glassTarget = glassLayerRef?.current ?? null;
    if (glassTarget) {
      glassTarget.style.opacity = glassOpacity.toFixed(3);
      glassTarget.style.visibility = "visible";
      // 패널 조작으로 즉시 재계산하는 경로에서도 z-index 를 맞춰줘야 상태 일관성 유지.
      glassTarget.style.zIndex = isAtTop ? "3" : "1";
    }
    if (svgTarget) {
      svgTarget.style.opacity = svgOpacity.toFixed(3);
      svgTarget.style.visibility = "visible";
    }
  }, [crossfade, glassLayerRef]);

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
