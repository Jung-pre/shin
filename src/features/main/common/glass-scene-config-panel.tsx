"use client";

import { useCallback, useMemo, useState } from "react";
import {
  type GlassConfigBoolKey,
  type GlassConfigFieldSpec,
  type GlassConfigNumKey,
  type GlassConfigStrKey,
  type GlassConfigFieldSection,
  type SceneConfig,
} from "./glass-scene-config.types";
import {
  GLASS_CONFIG_SECTIONS,
  GLASS_HERO_IMAGE_ALIGNMENT_SECTION,
  GLASS_LENS_FORM_ADVANCED,
} from "./glass-scene-config-sections";
import { getDefaultFlatLensPatch, lensFlatnessToScales } from "./glass-lens-geometry";
import styles from "./glass-orbs-scene.module.css";

const formatSliderValue = (value: number, integer?: boolean) => {
  if (integer) return Math.round(value).toString();
  if (Math.abs(value) >= 10) return value.toFixed(1);
  return value.toFixed(2);
};

export type GlassSceneConfigPanelVariant = "full" | "heroImageAlignment";

export interface GlassSceneConfigPanelProps {
  config: SceneConfig;
  onChange: (next: SceneConfig) => void;
  onReset: () => void;
  /**
   * full: 기존 전체 패널.
   * heroImageAlignment: `img_hero` / 전송 buffer DOM 정합(맞춤·배율·포커스·px 보정) 섹션만, 레이어 펼침.
   */
  variant?: GlassSceneConfigPanelVariant;
}

export function GlassSceneConfigPanel({
  config,
  onChange,
  onReset,
  variant = "full",
}: GlassSceneConfigPanelProps) {
  const sectionList = useMemo((): readonly GlassConfigFieldSection[] => {
    if (variant === "heroImageAlignment") {
      return [GLASS_HERO_IMAGE_ALIGNMENT_SECTION];
    }
    return [...GLASS_CONFIG_SECTIONS, GLASS_LENS_FORM_ADVANCED];
  }, [variant]);
  const [bodyOpen, setBodyOpen] = useState(false);
  const [copyFeedback, setCopyFeedback] = useState(false);

  const copyLayerState = useCallback(async () => {
    const payload = JSON.stringify(config, null, 2);
    try {
      if (typeof navigator !== "undefined" && navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(payload);
      } else {
        const ta = document.createElement("textarea");
        ta.value = payload;
        ta.setAttribute("readonly", "");
        ta.style.position = "fixed";
        ta.style.left = "-9999px";
        document.body.appendChild(ta);
        ta.select();
        document.execCommand("copy");
        document.body.removeChild(ta);
      }
      setCopyFeedback(true);
      window.setTimeout(() => setCopyFeedback(false), 2000);
    } catch {
      setCopyFeedback(false);
    }
  }, [config]);

  const setSphere = () => {
    onChange({ ...config, ballMode: true, lensScalesManual: false });
  };

  const setFlatLens = () => {
    onChange({ ...config, ...getDefaultFlatLensPatch() });
  };

  const setFlatness = (t: number) => {
    const c = Math.min(1, Math.max(0, t));
    const s = lensFlatnessToScales(c);
    onChange({
      ...config,
      ballMode: false,
      lensFlatness: c,
      lensScalesManual: false,
      orbScaleXY: s.xy,
      orbScaleZ: s.z,
    });
  };

  const updateNumber = (key: GlassConfigNumKey, value: number, integer?: boolean) => {
    const v = integer ? Math.round(value) : value;
    if (key === "orbScaleXY" || key === "orbScaleZ") {
      onChange({ ...config, [key]: v, lensScalesManual: true, ballMode: false });
      return;
    }
    onChange({ ...config, [key]: v });
  };

  const updateBoolean = (key: GlassConfigBoolKey, value: boolean) => {
    if (key === "lensScalesManual" && !value) {
      const s = lensFlatnessToScales(config.lensFlatness);
      onChange({
        ...config,
        lensScalesManual: false,
        orbScaleXY: s.xy,
        orbScaleZ: s.z,
      });
      return;
    }
    onChange({ ...config, [key]: value });
  };

  const updateString = <K extends GlassConfigStrKey>(key: K, value: SceneConfig[K]) => {
    onChange({ ...config, [key]: value });
  };

  const renderField = (field: GlassConfigFieldSpec) => {
    if (field.type === "slider") {
      const value = config[field.key];
      return (
        <label key={String(field.key)} className={styles.layerField}>
          <span className={styles.layerFieldTitle}>
            {field.label}: {formatSliderValue(value, field.integer)}
          </span>
          <input
            type="range"
            min={field.min}
            max={field.max}
            step={field.step}
            value={value}
            onChange={(e) => {
              const n = Number(e.target.value);
              updateNumber(field.key, n, field.integer);
            }}
          />
        </label>
      );
    }
    if (field.type === "toggle") {
      const checked = config[field.key];
      return (
        <label
          key={String(field.key)}
          className={`${styles.layerField} ${styles.layerToggleRow}`}
        >
          <span className={styles.layerFieldTitle}>{field.label}</span>
          <input
            type="checkbox"
            checked={checked}
            onChange={(e) => updateBoolean(field.key, e.target.checked)}
          />
        </label>
      );
    }
    if (field.type === "color") {
      const value = config[field.key];
      return (
        <label
          key={String(field.key)}
          className={`${styles.layerField} ${styles.layerToggleRow}`}
        >
          <span className={styles.layerFieldTitle}>
            {field.label}: {value}
          </span>
          <input
            type="color"
            className={styles.layerColor}
            value={value}
            onChange={(e) => updateString(field.key, e.target.value as SceneConfig[typeof field.key])}
          />
        </label>
      );
    }
    const value = config[field.key];
    return (
      <label key={String(field.key)} className={styles.layerField}>
        <span className={styles.layerFieldTitle}>{field.label}</span>
        <select
          className={styles.layerSelect}
          value={value}
          onChange={(e) => updateString(field.key, e.target.value as SceneConfig[typeof field.key])}
        >
          {field.options.map((opt) => (
            <option key={opt} value={opt}>
              {opt}
            </option>
          ))}
        </select>
      </label>
    );
  };

  const renderSection = (section: GlassConfigFieldSection) => (
    <details
      key={section.id ?? section.title}
      className={styles.configPanelSection}
      open={variant === "heroImageAlignment" ? true : undefined}
    >
      <summary className={styles.configPanelSectionSummary}>{section.title}</summary>
      <div className={styles.configPanelSectionBody}>
        {section.fields.map((f) => renderField(f))}
      </div>
    </details>
  );

  return (
    <div className={styles.configPanelHost}>
      <div className={styles.configPanelToolbar}>
        <button
          type="button"
          className={styles.configPanelFab}
          onClick={() => setBodyOpen((o) => !o)}
        >
          {bodyOpen
            ? "옵션 접기"
            : variant === "heroImageAlignment"
              ? "img_hero 정합"
              : "글래스 옵션"}
        </button>
        {bodyOpen ? (
          <>
            <button
              type="button"
              className={copyFeedback ? styles.configPanelCopyDone : styles.configPanelCopy}
              onClick={copyLayerState}
            >
              {copyFeedback ? "복사됨" : "상태 복사"}
            </button>
            <button type="button" className={styles.configPanelReset} onClick={onReset}>
              기본값
            </button>
          </>
        ) : null}
      </div>
      {bodyOpen ? (
        <div className={styles.configPanelRoot}>
          <div className={styles.configPanelHead}>
            <span className={styles.configPanelTitle}>
              {variant === "heroImageAlignment" ? "img_hero — 전송 정합" : "글래스 씬"}
            </span>
            <p className={styles.configPanelHint}>
              {variant === "heroImageAlignment"
                ? "돔 속 전송 이미지와 DOM의 위치·크기를 맞춥니다. (맞춤, 배율, 포커스, px 보정)"
                : "형태를 고른 뒤 아래에서 재질·조명·인터랙션을 조절합니다."}
            </p>
          </div>

          {variant === "full" ? (
            <div className={styles.lensFormCard}>
              <span className={styles.lensFormLabel}>렌즈 형태</span>
              <div className={styles.lensFormSegments} role="group" aria-label="렌즈 형태">
                <button
                  type="button"
                  className={config.ballMode ? styles.lensFormSegOn : styles.lensFormSeg}
                  onClick={setSphere}
                >
                  완전 구
                </button>
                <button
                  type="button"
                  className={!config.ballMode ? styles.lensFormSegOn : styles.lensFormSeg}
                  onClick={setFlatLens}
                >
                  납작 렌즈
                </button>
              </div>
              {!config.ballMode ? (
                <label className={styles.lensFormFlatness}>
                  <span>
                    납짝도: {formatSliderValue(config.lensFlatness)}
                    {config.lensScalesManual ? " (수동 모드: 비활성)" : ""}
                  </span>
                  <input
                    type="range"
                    min={0}
                    max={1}
                    step={0.01}
                    value={config.lensFlatness}
                    disabled={config.lensScalesManual}
                    onChange={(e) => setFlatness(Number(e.target.value))}
                  />
                </label>
              ) : null}
            </div>
          ) : null}

          <div className={styles.configPanelScroll}>
            {sectionList.map((sec) => renderSection(sec))}
          </div>
        </div>
      ) : null}
    </div>
  );
}
