"use client";

import html2canvas from "html2canvas";
import { useEffect, useMemo } from "react";
import type { RefObject } from "react";
import { CanvasTexture, SRGBColorSpace } from "three";

/** html2canvas 연속 호출 시 텍스처 덮어쓰기 → 렌즈 깜빡임 방지 */
const MIN_MS_BETWEEN_CAPTURES = 380;
const SCROLL_DEBOUNCE_MS = 420;
const RESIZE_DEBOUNCE_MS = 280;
const FALLBACK_INTERVAL_MS = 1100;

const createPlaceholderTexture = (): CanvasTexture => {
  const canvas = document.createElement("canvas");
  canvas.width = 4;
  canvas.height = 4;
  const tex = new CanvasTexture(canvas);
  tex.colorSpace = SRGBColorSpace;
  tex.needsUpdate = true;
  return tex;
};

export const useDomTransmissionTexture = (sourceRef: RefObject<HTMLElement | null>): CanvasTexture | null => {
  const texture = useMemo((): CanvasTexture | null => {
    if (typeof document === "undefined") {
      return null;
    }
    return createPlaceholderTexture();
  }, []);

  useEffect(() => {
    if (!texture) {
      return;
    }

    let alive = true;
    let busy = false;
    let captureGeneration = 0;
    let lastCaptureCompletedAt = 0;
    let scrollDebounceId = 0;
    let resizeDebounceId = 0;

    const applySnapshot = (snapshot: HTMLCanvasElement, gen: number) => {
      if (!alive || gen !== captureGeneration) {
        return;
      }

      const clone = document.createElement("canvas");
      clone.width = snapshot.width;
      clone.height = snapshot.height;
      const ctx = clone.getContext("2d");
      if (ctx) {
        ctx.drawImage(snapshot, 0, 0);
      }

      texture.image = clone;
      texture.needsUpdate = true;
      lastCaptureCompletedAt = Date.now();
    };

    const capture = async (force = false) => {
      const element = sourceRef.current;
      if (!alive || !element || busy || !texture) {
        return;
      }

      const now = Date.now();
      if (!force && now - lastCaptureCompletedAt < MIN_MS_BETWEEN_CAPTURES) {
        return;
      }

      const gen = ++captureGeneration;
      busy = true;

      try {
        const width = Math.max(1, Math.floor(element.offsetWidth));
        const height = Math.max(1, Math.floor(element.offsetHeight));
        const scale = Math.min(1, typeof window !== "undefined" ? window.devicePixelRatio || 1 : 1);

        const snapshot = await html2canvas(element, {
          scale,
          useCORS: true,
          logging: false,
          backgroundColor: null,
          width,
          height,
          windowWidth: width,
          windowHeight: height,
          foreignObjectRendering: false,
          ignoreElements: (node) => node.tagName === "CANVAS" || node.tagName === "IFRAME",
          onclone: (doc) => {
            doc.querySelectorAll("[data-raster-title]").forEach((node) => {
              const el = node as HTMLElement;
              el.style.background = "none";
              el.style.backgroundClip = "border-box";
              el.style.webkitBackgroundClip = "unset";
              el.style.webkitTextFillColor = "#ffffff";
              el.style.color = "#ffffff";
            });
          },
        });

        if (!alive || gen !== captureGeneration) {
          return;
        }

        applySnapshot(snapshot, gen);
      } catch {
        /* 직전 텍스처 유지 */
      } finally {
        busy = false;
      }
    };

    const scheduleScrollCapture = () => {
      window.clearTimeout(scrollDebounceId);
      scrollDebounceId = window.setTimeout(() => {
        void capture(true);
      }, SCROLL_DEBOUNCE_MS);
    };

    const scheduleResizeCapture = () => {
      window.clearTimeout(resizeDebounceId);
      resizeDebounceId = window.setTimeout(() => {
        void capture(true);
      }, RESIZE_DEBOUNCE_MS);
    };

    void capture(true);

    const intervalId = window.setInterval(() => {
      void capture(false);
    }, FALLBACK_INTERVAL_MS);

    window.addEventListener("scroll", scheduleScrollCapture, { passive: true });
    window.addEventListener("resize", scheduleResizeCapture);

    return () => {
      alive = false;
      captureGeneration += 1;
      window.clearInterval(intervalId);
      window.clearTimeout(scrollDebounceId);
      window.clearTimeout(resizeDebounceId);
      window.removeEventListener("scroll", scheduleScrollCapture);
      window.removeEventListener("resize", scheduleResizeCapture);
    };
  }, [sourceRef, texture]);

  return texture;
};
