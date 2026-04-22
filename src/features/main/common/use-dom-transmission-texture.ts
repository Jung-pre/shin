"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type RefObject } from "react";
import { CanvasTexture, SRGBColorSpace } from "three";

export interface ImageTransmissionTexture {
  /** 마운트 시 1회 생성된 고정 텍스처 인스턴스 (MeshTransmissionMaterial buffer 에 꽂는다) */
  texture: CanvasTexture | null;
  /** 리드로우(이미지 로드 / resize / target bbox 변화) 시 증가하는 버전 — demand frameloop invalidate 트리거 */
  version: number;
}

export interface UseImageTransmissionTextureOptions {
  /**
   * 정렬 기준이 될 DOM 요소 ref.
   * 지정 시: 이 요소의 중심(center-center)이 이미지 중심과 일치하도록 정렬.
   * 미지정 시: 뷰포트 중심에 이미지 중심 정렬.
   */
  targetRef?: RefObject<HTMLElement | null>;
  /**
   * "cover" (기본) — 이미지가 뷰포트를 완전히 덮도록 확대 (background-size: cover 와 동일, 넘치는 부분은 잘림)
   * "contain" — 이미지가 뷰포트 안에 완전히 들어가도록 축소 (background-size: contain, 남는 부분은 backgroundColor)
   */
  fit?: "cover" | "contain";
  /** 이미지 기본 스케일 배율 (cover/contain 기준에서 * 배율). 1 = 기본. 1.2 = 20% 크게. */
  zoom?: number;
  /** 이미지를 그린 뒤 남는 여백 배경색. 투명이면 env 컬러 드러남. */
  backgroundColor?: string;
  /**
   * R3F 의 `invalidate()` 함수 — 전달 시 redraw 직후 직접 호출해서
   * React state 리렌더 경유 없이 다음 프레임 렌더를 즉시 예약.
   *
   * demand frameloop 에서 스크롤 ↔ 텍스처 동기화의 체인 지연
   * (setVersion → React commit → Canvas 재렌더 감지) 를 제거하는 목적.
   */
  invalidate?: () => void;
  /**
   * 소스 이미지 내부의 가로 포커스 지점 (0 ~ 1, 기본 0.5 = 이미지 가로 정중앙).
   * 이 지점이 targetRef 의 가로 중심 (또는 뷰포트 중심) 에 정렬된다.
   */
  srcFocusX?: number;
  /**
   * 소스 이미지 내부의 세로 포커스 지점 (0 ~ 1, 기본 0.5 = 이미지 세로 정중앙).
   *
   * 예시: 원본 히어로 이미지(1920×1000) 에 세로로 여백을 추가해 1920×2000 으로 확장한 경우,
   *   실제 콘텐츠(=글래스에 비쳐야 할 부분) 는 이미지 상단 절반(Y: 0~1000) 에 위치한다.
   *   그 중심은 전체 높이의 25% 지점이므로 `srcFocusY: 0.25` 로 지정하면 된다.
   *   이렇게 하지 않고 기본(0.5) 을 쓰면 이미지 정중앙(=확장 여백 부분) 이 타겟에 맞춰져
   *   렌즈 안에 비어 있는 하단부가 보이게 된다.
   */
  srcFocusY?: number;
}

/**
 * 렌즈(MeshTransmissionMaterial) 의 `buffer` uniform 에 꽂을 이미지 텍스처 훅.
 *
 * 정렬 규칙 — CSS 의 `background-position: center center; background-size: cover;` 와 동일:
 *   1. 이미지의 기하학적 중심(0.5, 0.5) 을 targetRef bbox 중심 (없으면 뷰포트 중심) 에 둠.
 *   2. fit="cover" 이면 이미지를 뷰포트 전체를 덮도록 확대 (긴 쪽에 맞춤, 반대쪽은 잘림).
 *   3. fit="contain" 이면 뷰포트 안에 전부 들어가도록 축소 (짧은 쪽에 맞춤, 반대쪽 여백).
 *
 * 캔버스는 뷰포트 픽셀의 0.5 배 해상도로 — buffer 는 MTM resolution 이 작아 그대로도 충분.
 *
 * 텍스처 "인스턴스" 는 마운트 시 1회만 생성하고 내용만 갱신.
 * drei 가 buffer 참조가 바뀌면 간혹 재질이 투명으로 주저앉는 이슈를 회피하기 위함.
 */
export const useImageTransmissionTexture = (
  src: string,
  options: UseImageTransmissionTextureOptions = {},
): ImageTransmissionTexture => {
  const {
    targetRef,
    fit = "cover",
    zoom = 1,
    backgroundColor,
    invalidate,
    srcFocusX = 0.5,
    srcFocusY = 0.5,
  } = options;

  const texture = useMemo((): CanvasTexture | null => {
    if (typeof document === "undefined") {
      return null;
    }
    const canvas = document.createElement("canvas");
    canvas.width = 4;
    canvas.height = 4;
    const ctx = canvas.getContext("2d");
    if (ctx) {
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(0, 0, 4, 4);
    }
    const tex = new CanvasTexture(canvas);
    tex.colorSpace = SRGBColorSpace;
    tex.needsUpdate = true;
    return tex;
  }, []);

  const imgRef = useRef<HTMLImageElement | null>(null);
  const imgReadyRef = useRef(false);
  const [version, setVersion] = useState(0);

  /** 캔버스에 현재 뷰포트·target 기준으로 이미지를 cover/contain + center-center 로 재묘사 */
  const redraw = useCallback(() => {
    if (!texture) return;
    const img = imgRef.current;
    if (!img || !imgReadyRef.current) return;
    if (typeof window === "undefined") return;

    const canvas = texture.image as HTMLCanvasElement;
    const viewW = Math.max(2, Math.floor(window.innerWidth));
    const viewH = Math.max(2, Math.floor(window.innerHeight));

    // 성능: 캔버스 실제 픽셀은 절반 해상도면 충분.
    const scaleDown = 0.5;
    const canvasW = Math.max(2, Math.floor(viewW * scaleDown));
    const canvasH = Math.max(2, Math.floor(viewH * scaleDown));

    // 리사이즈 비용이 크므로 실제 크기가 바뀌었을 때만 canvas.width/height 를 건드림.
    // width/height 할당은 내부 버퍼를 버리고 재할당하므로 매 스크롤마다 호출하면 체감 느려짐.
    if (canvas.width !== canvasW || canvas.height !== canvasH) {
      canvas.width = canvasW;
      canvas.height = canvasH;
    }
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    ctx.clearRect(0, 0, canvasW, canvasH);
    if (backgroundColor) {
      ctx.fillStyle = backgroundColor;
      ctx.fillRect(0, 0, canvasW, canvasH);
    }

    // 뷰포트 좌표 → 캔버스 좌표로 변환하는 배율
    const toCanvas = (px: number) => px * scaleDown;

    const imgW = img.naturalWidth || img.width || 1;
    const imgH = img.naturalHeight || img.height || 1;

    // cover: 이미지가 뷰포트를 덮도록 → 배율은 max(viewW/imgW, viewH/imgH)
    // contain: 이미지가 뷰포트 안에 들어오도록 → 배율은 min(...)
    const baseScale =
      fit === "contain"
        ? Math.min(viewW / imgW, viewH / imgH)
        : Math.max(viewW / imgW, viewH / imgH);
    const scale = baseScale * Math.max(0.01, zoom);

    const drawW = imgW * scale;
    const drawH = imgH * scale;

    // 중심 좌표 — target 지정 시 해당 요소의 bbox 중심, 없으면 뷰포트 중심.
    // 스크롤에 따라 rect.top 이 자연스럽게 음수로 내려가므로 1:1 동기화는 이 한 줄로 성립.
    const target = targetRef?.current ?? null;
    const rect = target?.getBoundingClientRect();
    const centerX =
      rect && rect.width > 0 ? rect.left + rect.width / 2 : viewW / 2;
    const centerY =
      rect && rect.height > 0 ? rect.top + rect.height / 2 : viewH / 2;

    // 포커스 포인트(srcFocusX/Y · 0~1) 가 centerX/Y 에 오도록 좌상단 좌표 계산.
    //   - 기본 0.5 면 이미지 정중앙이 타겟 중심에 정렬 (기존 동작과 동일).
    //   - 이미지가 세로로 확장되어 콘텐츠가 상단에만 있는 경우 srcFocusY = 0.25 등으로
    //     지정하면 콘텐츠 중심이 타겟 중심에 정렬되어 렌즈에 "알맹이" 가 보인다.
    const drawX = centerX - drawW * srcFocusX;
    const drawY = centerY - drawH * srcFocusY;

    ctx.drawImage(
      img,
      toCanvas(drawX),
      toCanvas(drawY),
      toCanvas(drawW),
      toCanvas(drawH),
    );

    texture.needsUpdate = true;
    // demand frameloop 에서 즉시 다음 프레임 렌더를 예약. React state 체인을 우회해 지연 제거.
    invalidate?.();
  }, [texture, targetRef, fit, zoom, backgroundColor, invalidate, srcFocusX, srcFocusY]);

  // 이미지 로드
  useEffect(() => {
    if (!texture) return;
    let alive = true;

    const img = new Image();
    img.crossOrigin = "anonymous";
    img.decoding = "async";

    const handleLoad = () => {
      if (!alive) return;
      imgRef.current = img;
      imgReadyRef.current = true;
      redraw();
    };

    img.addEventListener("load", handleLoad, { once: true });
    img.addEventListener(
      "error",
      () => {
        /* 로드 실패 → placeholder 유지 */
      },
      { once: true },
    );
    img.src = src;

    return () => {
      alive = false;
      imgReadyRef.current = false;
      imgRef.current = null;
    };
  }, [texture, src, redraw]);

  // resize / scroll / target bbox 변화 / 웹폰트 로드 시 재정렬
  //
  // 핵심: 글래스 렌즈는 position: fixed 로 뷰포트에 고정돼 있지만,
  // 그 안에 비치는 이미지는 실제 히어로(스크롤되는 DOM)를 "찍어놓은" 스냅샷이다.
  // 스크롤할 때 getBoundingClientRect().top 이 자연스레 음수로 내려가므로,
  // 스크롤 이벤트마다 redraw 만 걸어 주면 targetRef 기준 중심 정렬이 그대로 반영되어
  // 렌즈 안의 이미지가 실제 히어로가 스크롤되는 것처럼 위로 흘러 올라간다.
  //
  // 스크롤은 rAF 스로틀 없이 "이벤트 발생 즉시" redraw 로 보내서 체인 지연을 제거.
  // 브라우저는 passive scroll 이벤트를 이미 프레임 레이트 안쪽으로 묶어 주므로
  // 동기 호출해도 실질 redraw 횟수는 프레임당 1 회 수준이며,
  // rAF 를 추가로 거치던 "한 프레임 뒤로 밀리는" 지연만 없앤다.
  useEffect(() => {
    if (!texture) return;
    if (typeof window === "undefined") return;

    let raf = 0;
    const scheduleRaf = () => {
      if (raf) return;
      raf = window.requestAnimationFrame(() => {
        raf = 0;
        redraw();
      });
    };

    // 성능 가드: 글래스는 히어로 구간(triggerVh ≈ 0.25) 만 보이고 그 밑으론
    //   opacity 0 으로 페이드 아웃 → SVG 오버레이로 교체된다. 그 구간에서도
    //   스크롤마다 drawImage(1.47MB) + invalidate() 체인이 돌면 CPU·GPU 모두
    //   불필요하게 깨어난다. 여기서 스크롤 위치가 "확실히 글래스 밖" 이면 redraw 를
    //   스킵한다. 다시 상단으로 올라오면 위치가 조건을 통과해 자연스레 재개됨.
    //
    //   (crossfade triggerVh 기본 0.25 + 약간의 여유 0.05 = 0.3vh 이후 스킵)
    const HIDDEN_SCROLL_VH = 0.3;
    const isGlassHidden = () =>
      window.scrollY > (window.innerHeight || 0) * (1 + HIDDEN_SCROLL_VH);

    // 스크롤은 즉시 동기 redraw — 지연 체인 제거. 단, 글래스가 숨겨진
    // 구간에서는 스킵해 passive 리스너만 등록된 상태로 둔다.
    const onScroll = () => {
      if (isGlassHidden()) return;
      redraw();
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    // resize / ResizeObserver / 폰트 로드는 덜 자주 + 캔버스 재할당 가능성이 있으니 rAF 로 묶음.
    window.addEventListener("resize", scheduleRaf);

    const target = targetRef?.current ?? null;
    let ro: ResizeObserver | null = null;
    if (target && typeof ResizeObserver !== "undefined") {
      ro = new ResizeObserver(() => scheduleRaf());
      ro.observe(target);
    }

    const fonts = (document as Document & { fonts?: FontFaceSet }).fonts;
    const onFontsReady = () => scheduleRaf();
    fonts?.addEventListener?.("loadingdone", onFontsReady);

    return () => {
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", scheduleRaf);
      ro?.disconnect();
      fonts?.removeEventListener?.("loadingdone", onFontsReady);
      if (raf) window.cancelAnimationFrame(raf);
    };
  }, [texture, redraw, targetRef]);

  return { texture, version };
};
