"use client";

import { useEffect, useState, type ChangeEvent } from "react";
import { createPortal } from "react-dom";
import styles from "./visumax-config-panel.module.css";
// 패널은 타입/상수만 필요 → 경량 config 모듈에서 import (씬 모듈 평가를 유발하지 않음).
import {
  ENV_PRESET_OPTIONS,
  type EnvPresetKey,
  type ModelSceneConfig,
} from "./visumax-model-config";

/**
 * VISUMAX 800 / 500 두 모델의 3D 씬 설정을 개별로 튜닝할 수 있는 플로팅 패널.
 *
 * - 사이즈(scale) / 위치(x,y,z) / 기본 자세(rotationX,Y) / 드래그 회전 범위(azimuth, polar) 제어
 * - 좌측 하단에는 SVG 글래스 패널이 있어 여기는 우측 하단으로 배치 → 충돌 회피
 * - 상태는 `MachineSection` 이 보유해 씬에 props 로 내려주고, 변경 핸들러만 여기로 주입
 */

interface VisumaxConfigPanelProps {
  config800: ModelSceneConfig;
  config500: ModelSceneConfig;
  onChange800: (next: ModelSceneConfig) => void;
  onChange500: (next: ModelSceneConfig) => void;
  onReset800: () => void;
  onReset500: () => void;
}

type ModelKey = "800" | "500";

interface ModelSectionProps {
  title: string;
  config: ModelSceneConfig;
  onChange: (next: ModelSceneConfig) => void;
  onReset: () => void;
}

const ModelSection = ({ title, config, onChange, onReset }: ModelSectionProps) => {
  const handleNumber =
    (key: keyof ModelSceneConfig) => (event: ChangeEvent<HTMLInputElement>) => {
      onChange({ ...config, [key]: Number(event.target.value) });
    };

  const handleEnvPreset = (event: ChangeEvent<HTMLSelectElement>) => {
    onChange({ ...config, envPreset: event.target.value as EnvPresetKey });
  };

  const toDeg = (rad: number) => ((rad * 180) / Math.PI).toFixed(1);

  return (
    <section className={styles.panelSection}>
      <div className={styles.panelSectionHead}>
        <span className={styles.panelSectionTitle}>{title}</span>
        <button type="button" className={styles.panelReset} onClick={onReset}>
          reset
        </button>
      </div>

      {/* 메인 사이즈 조절: overlayScale 은 Canvas(프레임) 자체를 키움 → 잘리지 않고 커짐.
       *   scale(아래) 은 프레임은 그대로 두고 모델만 키우기 때문에 프레임 밖이 잘림 → 미세조정용. */}
      <label className={styles.panelField}>
        <span>전체 크기 (overlay): {config.overlayScale.toFixed(2)}×</span>
        <input
          type="range"
          min={0.5}
          max={2.5}
          step={0.01}
          value={config.overlayScale}
          onChange={handleNumber("overlayScale")}
        />
      </label>

      <label className={styles.panelField}>
        <span>모델 배수 (잘릴 수 있음): {config.scale.toFixed(2)}</span>
        <input
          type="range"
          min={0.1}
          max={3}
          step={0.01}
          value={config.scale}
          onChange={handleNumber("scale")}
        />
      </label>

      <div className={styles.panelFieldGroup}>
        <span className={styles.panelFieldGroupLabel}>위치 (world unit)</span>
        <label className={styles.panelField}>
          <span>X: {config.positionX.toFixed(2)}</span>
          <input
            type="range"
            min={-3}
            max={3}
            step={0.05}
            value={config.positionX}
            onChange={handleNumber("positionX")}
          />
        </label>
        <label className={styles.panelField}>
          <span>Y: {config.positionY.toFixed(2)}</span>
          <input
            type="range"
            min={-3}
            max={3}
            step={0.05}
            value={config.positionY}
            onChange={handleNumber("positionY")}
          />
        </label>
        <label className={styles.panelField}>
          <span>Z: {config.positionZ.toFixed(2)}</span>
          <input
            type="range"
            min={-3}
            max={3}
            step={0.05}
            value={config.positionZ}
            onChange={handleNumber("positionZ")}
          />
        </label>
      </div>

      <div className={styles.panelFieldGroup}>
        <span className={styles.panelFieldGroupLabel}>기본 자세 (rotation)</span>
        <label className={styles.panelField}>
          <span>X(tilt): {toDeg(config.rotationX)}°</span>
          <input
            type="range"
            min={-Math.PI / 2}
            max={Math.PI / 2}
            step={0.01}
            value={config.rotationX}
            onChange={handleNumber("rotationX")}
          />
        </label>
        <label className={styles.panelField}>
          <span>Y(yaw): {toDeg(config.rotationY)}°</span>
          <input
            type="range"
            min={-Math.PI}
            max={Math.PI}
            step={0.01}
            value={config.rotationY}
            onChange={handleNumber("rotationY")}
          />
        </label>
      </div>

      <div className={styles.panelFieldGroup}>
        <span className={styles.panelFieldGroupLabel}>컨트롤러 허용 범위 (±)</span>
        <label className={styles.panelField}>
          <span>Azimuth(좌우): ±{toDeg(config.azimuthLimit)}°</span>
          <input
            type="range"
            min={0}
            max={Math.PI / 2}
            step={0.01}
            value={config.azimuthLimit}
            onChange={handleNumber("azimuthLimit")}
          />
        </label>
        <label className={styles.panelField}>
          <span>Polar(상하): ±{toDeg(config.polarLimit)}°</span>
          <input
            type="range"
            min={0}
            max={Math.PI / 3}
            step={0.01}
            value={config.polarLimit}
            onChange={handleNumber("polarLimit")}
          />
        </label>
      </div>

      <div className={styles.panelFieldGroup}>
        <span className={styles.panelFieldGroupLabel}>조명 / Environment</span>
        {/* 쨍함의 주 원인은 envIntensity + studio preset.
         *   톤이 강하게 느껴지면 envIntensity 부터 내려보고, 그래도 뿌옇게 보이면
         *   ambient 를 살짝 낮추는 순서가 효과적. */}
        <label className={styles.panelField}>
          <span>Ambient(전역): {config.ambientIntensity.toFixed(2)}</span>
          <input
            type="range"
            min={0}
            max={2}
            step={0.01}
            value={config.ambientIntensity}
            onChange={handleNumber("ambientIntensity")}
          />
        </label>
        <label className={styles.panelField}>
          <span>Directional(방향광): {config.directionalIntensity.toFixed(2)}</span>
          <input
            type="range"
            min={0}
            max={3}
            step={0.01}
            value={config.directionalIntensity}
            onChange={handleNumber("directionalIntensity")}
          />
        </label>
        <label className={styles.panelField}>
          <span>Env(HDRI 반사): {config.envIntensity.toFixed(2)}</span>
          <input
            type="range"
            min={0}
            max={2}
            step={0.01}
            value={config.envIntensity}
            onChange={handleNumber("envIntensity")}
          />
        </label>
        <label className={styles.panelField}>
          <span>Env Preset</span>
          <select
            className={styles.panelSelect}
            value={config.envPreset}
            onChange={handleEnvPreset}
          >
            {ENV_PRESET_OPTIONS.map((preset) => (
              <option key={preset} value={preset}>
                {preset}
              </option>
            ))}
          </select>
        </label>
      </div>
    </section>
  );
};

export const VisumaxConfigPanel = ({
  config800,
  config500,
  onChange800,
  onChange500,
  onReset800,
  onReset500,
}: VisumaxConfigPanelProps) => {
  const [isOpen, setIsOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<ModelKey>("800");
  // Portal 마운트 게이트 — SSR 에서는 document 가 없음. 클라이언트 마운트 후에만 렌더.
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    setMounted(true);
  }, []);

  const panel = (
    <div className={styles.panel}>
      <button
        type="button"
        className={styles.panelToggle}
        onClick={() => setIsOpen((v) => !v)}
      >
        {isOpen ? "GLB 옵션 닫기" : "GLB 모델 옵션"}
      </button>
      {isOpen ? (
        <div className={styles.panelPopup}>
          <div className={styles.panelHead}>
            <span className={styles.panelTitle}>VISUMAX 3D 모델</span>
            <div className={styles.panelTabs}>
              <button
                type="button"
                className={`${styles.panelTab} ${activeTab === "800" ? styles.panelTabActive : ""}`}
                onClick={() => setActiveTab("800")}
              >
                VISUMAX 800
              </button>
              <button
                type="button"
                className={`${styles.panelTab} ${activeTab === "500" ? styles.panelTabActive : ""}`}
                onClick={() => setActiveTab("500")}
              >
                VISUMAX 500
              </button>
            </div>
          </div>
          {activeTab === "800" ? (
            <ModelSection
              title="VISUMAX 800"
              config={config800}
              onChange={onChange800}
              onReset={onReset800}
            />
          ) : (
            <ModelSection
              title="VISUMAX 500"
              config={config500}
              onChange={onChange500}
              onReset={onReset500}
            />
          )}
        </div>
      ) : null}
    </div>
  );

  // 패널을 body 로 Portal — MachineSection 안에 있으면 stacking context(foreground z:2)
  // 에 갇혀 glassLayer(z:3) 아래로 밀리고, 상위에 transform 이 있는 경우 position:fixed
  // 가 해당 ancestor 에 contained 되어 클릭이 안 먹는 케이스가 있다. body 직속이면 안전.
  if (!mounted) return null;
  return createPortal(panel, document.body);
};

export default VisumaxConfigPanel;
