"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import styles from "./tuning-panel.module.css";

/**
 * 튜닝 값 스키마. CylinderSlideCanvas 에 그대로 내려가는 runtime parameter.
 * 여기에 없는 값 (예: FADE_CUTOFF_DEG) 은 별도 컴포넌트에서 참조.
 */
export interface RotatingSlideTuning {
  /** 카드 사이 각도 배수 (0.1~1.5). 5장 슬라이드에서 0.53 = 38.2° 간격. */
  spacingFactor: number;
  /** 원통 반지름 (world units). 카메라 거리 대비 크면 가로 펼침 폭이 커짐. */
  radius: number;
  /** 카드 가로 (world units) */
  cardWidth: number;
  /** 카드 세로 (world units) */
  cardHeight: number;
  /** 휨 강도 (0 = 납작, 1 = 원통 그대로) */
  bendAmount: number;
  /** 카메라 Z (world units). 기본 5.2. 클수록 멀리서 보는 느낌. */
  cameraZ: number;
  /** 카메라 FOV (degrees). 기본 32. 작을수록 원근 약해짐(망원). */
  fov: number;
  /** 사이드 페이드 컷오프 (degrees). 기본 95°. 이보다 큰 각도에서 fade=0. */
  fadeCutoffDeg: number;
  /** 사이드 카드 최소 밝기 (0 = 컴컴, 1 = 풀밝기 유지) */
  sideDim: number;
  /** 원통 X 축 기울기 (degrees). 사선 회전 느낌. 양수 = 위가 앞으로 기움. */
  cylinderTiltDeg: number;
  /** 카드 사이 Y 계단 (world units). 양수 = 뒤 카드일수록 위, 음수 = 아래. */
  cardYStep: number;
  /** 좌우 딤 페이드 폭 (0~45, %). 0=없음, 클수록 안쪽까지 가림. */
  vignetteWidth: number;
  /** 상하 딤 페이드 폭 (0~40, %). 위아래로 삐져나오는 카드 숨김. */
  vignetteHeight: number;
  /** 딤 오버레이 불투명도 (0~1). 0=색 오버레이 없음, 1=완전 불투명. */
  vignetteOpacity: number;
  /** 딤에 사용할 배경색 R (0~255) */
  vignetteBgR: number;
  /** 딤에 사용할 배경색 G (0~255) */
  vignetteBgG: number;
  /** 딤에 사용할 배경색 B (0~255) */
  vignetteBgB: number;
}

export const DEFAULT_TUNING: RotatingSlideTuning = {
  spacingFactor: 0.85,
  radius: 2,
  cardWidth: 1.9,
  cardHeight: 1.13,
  bendAmount: 1,
  cameraZ: 5.2,
  fov: 32,
  fadeCutoffDeg: 10,
  sideDim: 0,
  cylinderTiltDeg: 0,
  cardYStep: -0.96,
  vignetteWidth: 28,
  vignetteHeight: 24.5,
  vignetteOpacity: 1,
  vignetteBgR: 255,
  vignetteBgG: 255,
  vignetteBgB: 255,
};

const STORAGE_KEY = "rotating-slide-tuning-v2";

/**
 * localStorage 에서 저장값 로드. 스키마 mismatch · parse 에러는 기본값으로 fallback.
 */
function loadFromStorage(): RotatingSlideTuning {
  if (typeof window === "undefined") return DEFAULT_TUNING;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_TUNING;
    const parsed = JSON.parse(raw) as Partial<RotatingSlideTuning>;
    // 누락 키는 기본값으로 보충.
    return { ...DEFAULT_TUNING, ...parsed };
  } catch {
    return DEFAULT_TUNING;
  }
}

/**
 * 튜닝 상태 커스텀 훅. 저장소 연동 + setter 래핑.
 *   - SSR 에서는 DEFAULT_TUNING 으로 초기화.
 *   - 마운트 후 useEffect 에서 localStorage 값 동기화.
 */
export function useRotatingSlideTuning() {
  const [tuning, setTuning] = useState<RotatingSlideTuning>(DEFAULT_TUNING);

  // SSR 하이드레이션 이후 저장값 로드. 서버·클라 첫 렌더는 모두 DEFAULT_TUNING 이라
  // mismatch 는 나지 않는다. 이 케이스에서는 setState-in-effect 가 불가피한 패턴.
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setTuning(loadFromStorage());
  }, []);

  // tuning 변경 시 저장.
  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(tuning));
    } catch {
      /* storage 비활성 환경 — 무시 */
    }
  }, [tuning]);

  const reset = useCallback(() => {
    setTuning(DEFAULT_TUNING);
  }, []);

  const update = useCallback(
    <K extends keyof RotatingSlideTuning>(key: K, value: RotatingSlideTuning[K]) => {
      setTuning((prev) => ({ ...prev, [key]: value }));
    },
    [],
  );

  return { tuning, setTuning, reset, update };
}

interface Range {
  min: number;
  max: number;
  step: number;
  decimals: number;
}

const RANGES: Record<keyof RotatingSlideTuning, Range> = {
  spacingFactor:   { min: 0.1,  max: 1.5,  step: 0.01, decimals: 2 },
  radius:          { min: 1.2,  max: 8,    step: 0.05, decimals: 2 },
  cardWidth:       { min: 0.6,  max: 5,    step: 0.05, decimals: 2 },
  cardHeight:      { min: 0.4,  max: 4,    step: 0.05, decimals: 2 },
  bendAmount:      { min: 0,    max: 1,    step: 0.01, decimals: 2 },
  cameraZ:         { min: 2.5,  max: 14,   step: 0.1,  decimals: 1 },
  fov:             { min: 15,   max: 80,   step: 0.5,  decimals: 1 },
  fadeCutoffDeg:   { min: 10,   max: 180,  step: 1,    decimals: 0 },
  sideDim:         { min: 0,    max: 1,    step: 0.01, decimals: 2 },
  cylinderTiltDeg: { min: -45,  max: 45,   step: 0.5,  decimals: 1 },
  cardYStep:       { min: -1.5, max: 1.5,  step: 0.02, decimals: 2 },
  vignetteWidth:   { min: 0,    max: 45,   step: 0.5,  decimals: 1 },
  vignetteHeight:  { min: 0,    max: 40,   step: 0.5,  decimals: 1 },
  vignetteOpacity: { min: 0,    max: 1,    step: 0.01, decimals: 2 },
  vignetteBgR:     { min: 0,    max: 255,  step: 1,    decimals: 0 },
  vignetteBgG:     { min: 0,    max: 255,  step: 1,    decimals: 0 },
  vignetteBgB:     { min: 0,    max: 255,  step: 1,    decimals: 0 },
};

const LABELS: Record<keyof RotatingSlideTuning, string> = {
  spacingFactor:   "카드 간격 배수",
  radius:          "원통 반지름",
  cardWidth:       "카드 가로",
  cardHeight:      "카드 세로",
  bendAmount:      "휨 강도",
  cameraZ:         "카메라 Z",
  fov:             "카메라 FOV(°)",
  fadeCutoffDeg:   "페이드 컷오프(°)",
  sideDim:         "사이드 dim",
  cylinderTiltDeg: "원통 기울기(°)  ← 사선",
  cardYStep:       "카드 Y 계단",
  vignetteWidth:   "좌우 딤 폭(%)",
  vignetteHeight:  "상하 딤 폭(%)",
  vignetteOpacity: "딤 강도 (opacity)",
  vignetteBgR:     "배경색 R",
  vignetteBgG:     "배경색 G",
  vignetteBgB:     "배경색 B",
};

const GROUPS: { title: string; keys: (keyof RotatingSlideTuning)[] }[] = [
  {
    title: "배치 / 간격",
    keys: ["spacingFactor", "radius"],
  },
  {
    title: "카드 사이즈",
    keys: ["cardWidth", "cardHeight", "bendAmount"],
  },
  {
    title: "사선 / 계단  ★",
    keys: ["cylinderTiltDeg", "cardYStep"],
  },
  {
    title: "카메라",
    keys: ["cameraZ", "fov"],
  },
  {
    title: "페이드 / 딤",
    keys: [
      "fadeCutoffDeg", "sideDim",
      "vignetteWidth", "vignetteHeight",
      "vignetteOpacity",
      "vignetteBgR", "vignetteBgG", "vignetteBgB",
    ],
  },
];

export interface RotatingSlideTuningPanelProps {
  tuning: RotatingSlideTuning;
  onChange: <K extends keyof RotatingSlideTuning>(
    key: K,
    value: RotatingSlideTuning[K],
  ) => void;
  onReset: () => void;
  /** 현재 activeIndex — 보조 정보로 표시 */
  activeIndex?: number;
}

/**
 * 회전 슬라이드 튜닝용 플로팅 패널.
 *   - 헤더 드래그로 이동.
 *   - 토글로 접기.
 *   - JSON 복사 버튼 → 현재 값을 콘솔에 출력 + clipboard 복사.
 */
export function RotatingSlideTuningPanel({
  tuning,
  onChange,
  onReset,
  activeIndex,
}: RotatingSlideTuningPanelProps) {
  const [collapsed, setCollapsed] = useState(false);
  const [position, setPosition] = useState<{ x: number; y: number } | null>(null);
  const [dragging, setDragging] = useState(false);
  const dragStateRef = useRef<{
    startX: number;
    startY: number;
    origX: number;
    origY: number;
  } | null>(null);

  // 드래그 핸들러.
  const onPointerDown = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      if (e.button !== 0) return;
      const target = e.currentTarget;
      target.setPointerCapture(e.pointerId);

      const rect = target.parentElement?.getBoundingClientRect();
      const origX = position?.x ?? rect?.left ?? 0;
      const origY = position?.y ?? rect?.top ?? 0;

      dragStateRef.current = {
        startX: e.clientX,
        startY: e.clientY,
        origX,
        origY,
      };
      setDragging(true);
    },
    [position],
  );

  const onPointerMove = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    const s = dragStateRef.current;
    if (!s) return;
    const dx = e.clientX - s.startX;
    const dy = e.clientY - s.startY;
    const nextX = s.origX + dx;
    const nextY = s.origY + dy;

    // viewport 바깥으로 나가지 않도록 clamp.
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const panelRect = e.currentTarget.parentElement?.getBoundingClientRect();
    const w = panelRect?.width ?? 300;
    const h = panelRect?.height ?? 200;
    const clampedX = Math.max(0, Math.min(vw - w, nextX));
    const clampedY = Math.max(0, Math.min(vh - h, nextY));

    setPosition({ x: clampedX, y: clampedY });
  }, []);

  const onPointerUp = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    if (e.currentTarget.hasPointerCapture(e.pointerId)) {
      e.currentTarget.releasePointerCapture(e.pointerId);
    }
    dragStateRef.current = null;
    setDragging(false);
  }, []);

  const handleCopy = useCallback(async () => {
    const snapshot = JSON.stringify(tuning, null, 2);
    console.info("[RotatingSlideTuning] 현재 값:\n" + snapshot);
    try {
      await navigator.clipboard.writeText(snapshot);
    } catch {
      /* clipboard 권한 없음 — 콘솔 출력으로 대체 */
    }
  }, [tuning]);

  const style: React.CSSProperties | undefined = position
    ? { top: position.y, left: position.x, right: "auto" }
    : undefined;

  return (
    <div className={styles.panel} style={style}>
      <div
        className={styles.header}
        data-dragging={dragging ? "true" : "false"}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
      >
        <div className={styles.title}>
          Rotating Slide Tuner
          {typeof activeIndex === "number" ? ` · active ${activeIndex}` : null}
        </div>
        <div className={styles.actions}>
          <button
            className={styles.iconBtn}
            type="button"
            onClick={() => setCollapsed((v) => !v)}
            title={collapsed ? "펼치기" : "접기"}
          >
            {collapsed ? "▾" : "▴"}
          </button>
        </div>
      </div>

      <div className={styles.body} data-collapsed={collapsed ? "true" : "false"}>
        {GROUPS.map((group) => {
          const isColorGroup = group.keys.includes("vignetteBgR");
          return (
            <div key={group.title} className={styles.group}>
              <div className={styles.groupTitle}>{group.title}</div>

              {/* RGB 그룹에만 색상 스와치 표시 */}
              {isColorGroup ? (
                <div className={styles.colorSwatchRow}>
                  <div
                    className={styles.colorSwatch}
                    style={{
                      background: `rgb(${tuning.vignetteBgR},${tuning.vignetteBgG},${tuning.vignetteBgB})`,
                      opacity: tuning.vignetteOpacity,
                    }}
                  />
                  <span className={styles.colorHex}>
                    #{Math.round(tuning.vignetteBgR).toString(16).padStart(2, "0")}
                    {Math.round(tuning.vignetteBgG).toString(16).padStart(2, "0")}
                    {Math.round(tuning.vignetteBgB).toString(16).padStart(2, "0")}
                    {" "}/{" "}
                    {Math.round(tuning.vignetteOpacity * 100)}%
                  </span>
                </div>
              ) : null}

              {group.keys.map((key) => {
                const range = RANGES[key];
                const value = tuning[key];
                return (
                  <div key={key} className={styles.row}>
                    <div className={styles.rowHead}>
                      <span className={styles.label}>{LABELS[key]}</span>
                      <span className={styles.value}>
                        {value.toFixed(range.decimals)}
                      </span>
                    </div>
                    <input
                      className={styles.slider}
                      type="range"
                      min={range.min}
                      max={range.max}
                      step={range.step}
                      value={value}
                      onChange={(e) =>
                        onChange(key, Number.parseFloat(e.target.value))
                      }
                    />
                  </div>
                );
              })}
            </div>
          );
        })}
      </div>

      <div className={styles.footer}>
        <button className={styles.footerBtn} type="button" onClick={onReset}>
          기본값
        </button>
        <button
          className={styles.footerBtn}
          type="button"
          data-accent="true"
          onClick={handleCopy}
        >
          값 복사
        </button>
      </div>
    </div>
  );
}
