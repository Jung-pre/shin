"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type RefObject } from "react";
import { CanvasTexture, SRGBColorSpace } from "three";

export interface ImageTransmissionTexture {
  /** 마운트 시 1회 생성된 고정 텍스처 인스턴스 (MeshTransmissionMaterial buffer 에 꽂는다) */
  texture: CanvasTexture | null;
  /** 리드로우(이미지 로드 / resize / target bbox 변화) 시 증가하는 버전 — demand frameloop invalidate 트리거 */
  version: number;
  /** 원본 이미지(webp/png) 로드 및 첫 draw 완료 여부 */
  isSourceReady: boolean;
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
  /**
   * false 면 이미지 로딩/drawImage 를 스킵하고 캔버스를 완전 투명(clear) 상태로 유지.
   * MTM 굴절 레이어가 비어 있으면 env 반사와 `<canvas alpha:true>` 뒤 DOM 이 그대로 비쳐
   * "투명한 유리" 느낌이 된다. 기본 true (기존 동작 유지).
   */
  renderImage?: boolean;
  /**
   * 히어로 아래로는 `targetRef` 정렬을 이 문서 스크롤 Y 에 **고정** (그때 보던 img_hero 정합 유지).
   * `null`/미전달 = 항상 실시간 스크롤.
   */
  lockTextureAtScrollYRef?: RefObject<number | null>;
  /**
   * `next/image` `fill` + `object-fit: cover` 이 깔리는 **박스**(예: 히어로 `section` 루트).
   * 전달 시 cover/contain 스케일이 `window` 전체가 아닌 이 rect 의 width·height 를 쓴다.
   * DOM 배경과 전송 캔버스가 1:1로 맞지 않는 “이중 잔상” 의 주요 원인이 전·후자 불일치였다.
   */
  sourceLayoutRef?: RefObject<HTMLElement | null>;
  /**
   * MeshTransmission buffer 를 샘플링하는 실제 R3F canvas 박스.
   * 글래스 레이어가 전체 뷰포트가 아닌 중앙 밴드일 때 window 좌표로 텍스처를 그리면
   * canvas-local sampling 좌표와 DOM 좌표가 섞여 큰 Y 오차가 난다.
   */
  sampleViewportRef?: RefObject<HTMLElement | null>;
  /** target 중심 기준 추가 이동(px) — DOM 글자와 buffer 스케일/정합 미세 조정 */
  centerOffsetXPx?: number;
  centerOffsetYPx?: number;
}

/**
 * 렌즈(MeshTransmissionMaterial) 의 `buffer` uniform 에 꽂을 이미지 텍스처 훅.
 *
 * 정합 규칙 — (sourceLayoutRef 가 있을 때) 그 요소에 대한 CSS `object-fit: cover` /
 *   `object-position` 과 동일한 스케일·크롭을 쓰고, (없을 때) 뷰포트 전체에 대해 동일.
 *   1. 포인트 (srcFocusX, srcFocusY) 가 targetRef bbox 중심(없으면 레이아웃 박스/뷰 중심)에 오도록 이미지 좌상단을 둔다.
 *   2. cover / contain 은 **레이아웃 박스** width·height (또는 뷰포트) 기준.
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
    renderImage = true,
    lockTextureAtScrollYRef,
    sourceLayoutRef,
    sampleViewportRef,
    centerOffsetXPx = 0,
    centerOffsetYPx = 0,
  } = options;

  /**
   * lockTextureAtScrollYRef 는 variant 전환 시 undefined ↔ object 로 바뀌어
   * useEffect deps 길이가 달라지는 HMR/리렌더 경고를 피하려고, **항상 같은 ref** 하나에
   * 바깥 ref 를 매 렌더 복사해 둔다(내부 .current = 부모가 준 ref 또는 null).
   */
  const lockOuterStoreRef = useRef(lockTextureAtScrollYRef);
  lockOuterStoreRef.current = lockTextureAtScrollYRef;

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
  const [isSourceReady, setIsSourceReady] = useState(false);

  /** 캔버스에 현재 뷰포트·target 기준으로 이미지를 cover/contain + center-center 로 재묘사 */
  const redraw = useCallback(() => {
    if (!texture) return;
    if (typeof window === "undefined") return;

    const canvas = texture.image as HTMLCanvasElement;
    const sampleRect = sampleViewportRef?.current?.getBoundingClientRect();
    const hasSampleViewport =
      sampleRect && sampleRect.width > 1 && sampleRect.height > 1;
    const sampleLeft = hasSampleViewport ? sampleRect.left : 0;
    const sampleTop = hasSampleViewport ? sampleRect.top : 0;
    const viewW = Math.max(
      2,
      Math.floor(hasSampleViewport ? sampleRect.width : window.innerWidth),
    );
    const viewH = Math.max(
      2,
      Math.floor(hasSampleViewport ? sampleRect.height : window.innerHeight),
    );

    const layoutRect = sourceLayoutRef?.current?.getBoundingClientRect();
    const hasLayout = layoutRect && layoutRect.width > 1 && layoutRect.height > 1;
    /** cover/contain — Next/Image `fill` 부모 box 와 동일한 기준 (미지정 시 뷰포트) */
    const layoutW = hasLayout ? layoutRect.width : viewW;
    const layoutH = hasLayout ? layoutRect.height : viewH;

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

    // 투명 모드: 캔버스를 clear 상태로 유지 → MTM 굴절 레이어가 비어 env 반사와
    // 뒤쪽 DOM 이 그대로 비친다. 하단 피날레 글래스에서 사용.
    if (!renderImage) {
      texture.needsUpdate = true;
      invalidate?.();
      return;
    }

    const img = imgRef.current;
    if (!img || !imgReadyRef.current) return;

    if (backgroundColor) {
      ctx.fillStyle = backgroundColor;
      ctx.fillRect(0, 0, canvasW, canvasH);
    }

    // 뷰포트 좌표 → 캔버스 좌표로 변환하는 배율
    const toCanvas = (px: number) => px * scaleDown;

    const imgW = img.naturalWidth || img.width || 1;
    const imgH = img.naturalHeight || img.height || 1;

    // cover: 이미지가 레이아웃 박스(또는 뷰포트)를 덮도록
    // contain: 그 안에 전부 들어오도록
    const baseScale =
      fit === "contain"
        ? Math.min(layoutW / imgW, layoutH / imgH)
        : Math.max(layoutW / imgW, layoutH / imgH);
    const scale = baseScale * Math.max(0.01, zoom);

    const drawW = imgW * scale;
    const drawH = imgH * scale;

    // 중심 좌표 — target 지정 시 해당 요소의 bbox 중심, 없으면 뷰포트 중심.
    // 스크롤에 따라 rect.top 이 자연스럽게 음수로 내려감(히어로와 1:1).
    // lockY 넘기면: 그 스크롤에 있을 때의 bbox 를 쓰는 것과 동일 → rect.top += (scrollY - lockY)
    const scrollY = window.scrollY || 0;
    const lockY = lockOuterStoreRef.current?.current;
    const effectiveScrollY =
      lockY != null && Number.isFinite(lockY) && lockY > 0 && scrollY >= lockY
        ? lockY
        : scrollY;
    const scrollShiftY = scrollY - effectiveScrollY;

    // 단, target 이 뷰포트에서 "너무 멀리" (원래는 폴백) — **고정(shiftY>0)**이면
    // 히어로 밖이어도 가상 rect 로 계속 img 를 채움(고정된 한 프레임).
    const target = targetRef?.current ?? null;
    const rect = target?.getBoundingClientRect();
    const adjTop = rect ? rect.top + scrollShiftY : 0;
    const adjBottom = rect ? rect.bottom + scrollShiftY : 0;
    const localAdjTop = adjTop - sampleTop;
    const localAdjBottom = adjBottom - sampleTop;
    const viewportFarMargin = viewH * 1.5;
    const targetInRange =
      rect &&
      rect.width > 0 &&
      (scrollShiftY > 0 ||
        (localAdjTop > -viewportFarMargin && localAdjBottom < viewH + viewportFarMargin));
    const baseCenterX =
      targetInRange && rect ? rect.left + rect.width / 2 - sampleLeft : viewW / 2;
    const baseCenterY =
      targetInRange && rect ? localAdjTop + rect.height / 2 : viewH / 2;
    const centerX = baseCenterX + centerOffsetXPx;
    const centerY = baseCenterY + centerOffsetYPx;

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
  }, [
    texture,
    targetRef,
    fit,
    zoom,
    backgroundColor,
    invalidate,
    srcFocusX,
    srcFocusY,
    renderImage,
    centerOffsetXPx,
    centerOffsetYPx,
    sourceLayoutRef,
    sampleViewportRef,
  ]);

  // 이미지 로드
  useEffect(() => {
    if (!texture) return;
    // 투명 모드: 이미지 다운로드·listener 붙이지 않음. 캔버스는 clear 상태로 바로 ready.
    if (!renderImage) {
      imgRef.current = null;
      imgReadyRef.current = true;
      setIsSourceReady(true);
      redraw();
      return;
    }
    let alive = true;

    const img = new Image();
    img.fetchPriority = "high";
    img.loading = "eager";
    img.decoding = "async";

    const handleLoad = () => {
      if (!alive) return;
      imgRef.current = img;
      imgReadyRef.current = true;
      setIsSourceReady(true);
      redraw();
      // onload 시점이 Canvas invalidate bridge보다 빠르면 첫 프레임 갱신이 누락될 수 있어
      // 한 번 더 마이크로 딜레이 재그리기 + version bump로 초기 표시를 보장한다.
      requestAnimationFrame(() => {
        if (!alive) return;
        redraw();
        setVersion((prev) => prev + 1);
      });
    };

    img.addEventListener("load", handleLoad, { once: true });
    img.addEventListener(
      "error",
      () => {
        imgReadyRef.current = false;
      },
    );
    img.src = src;

    return () => {
      // src 가 바뀌어 이 effect 가 cleanup 될 때는 "옛 이미지" 를 남겨 둔다 —
      //   · alive=false 로 옛 fetch 의 onload 가 뒤늦게 터지는 것만 차단.
      //   · imgRef / imgReadyRef / isSourceReady 는 그대로 유지 → 새 이미지 로드가
      //     끝날 때까지 기존 이미지가 그려져서 Scene 이 unmount 되지 않는다.
      //
      // 컴포넌트 자체가 unmount 되는 상황이면 texture 메모이즈도 사라져서
      //   이 경로에 남은 image ref 는 GC 대상 — 별도 해제 필요 없음.
      alive = false;
    };
  }, [texture, src, redraw, renderImage]);

  // resize / scroll / target bbox 변화 / 웹폰트 로드 시 재정렬
  //
  // 핵심: 글래스 렌즈는 position: fixed 로 뷰포트에 고정돼 있지만,
  // 그 안에 비치는 이미지는 실제 히어로(스크롤되는 DOM)를 "찍어놓은" 스냅샷이다.
  // 스크롤할 때 getBoundingClientRect().top 이 자연스레 음수로 내려가므로,
  // 스크롤 이벤트마다 redraw 만 걸어 주면 targetRef 기준 중심 정렬이 그대로 반영되어
  // 렌즈 안의 이미지가 실제 히어로가 스크롤되는 것처럼 위로 흘러 올라간다.
  //
  // 성능: Lenis 스무스 스크롤은 내부 RAF 마다 window.scrollTo 를 호출하므로
  // scroll 이벤트가 한 프레임에 여러 번 발생할 수 있다. drawImage + GPU
  // 텍스처 업로드 + MTM invalidate 가 그때마다 동기로 돌면 스크롤이 무거워진다.
  // 따라서 rAF 로 병합해 "프레임당 최대 1회" 로 스로틀한다 — 스크롤 방향/위치는
  // 프레임 시점의 최신 getBoundingClientRect() 을 쓰므로 모션 체감은 동일.
  useEffect(() => {
    if (!texture) return;
    if (typeof window === "undefined") return;

    let raf = 0;
    let lockedHiddenRedrawKey: string | null = null;
    const scheduleRaf = () => {
      if (raf) return;
      raf = window.requestAnimationFrame(() => {
        raf = 0;
        redraw();
      });
    };
    const scheduleFreshRaf = () => {
      lockedHiddenRedrawKey = null;
      scheduleRaf();
    };

    // 성능 가드 — "SVG → Glass" 전환 시 콜드 스타트 스파이크를 제거하기 위해
    // 실제 가시 구간보다 넓은 "프리월 버퍼" 를 둔다.
    //   · 상단: heroSection + 프리월 1.0vh 근처까지 redraw 허용
    //     → 사용자가 역방향으로 접근할 때 글래스가 보이기 전에 이미 최신 스냅샷이 캔버스에 그려져 있어
    //       opacity 0→1 전환 첫 프레임이 "따뜻한" 상태에서 시작.
    //   · 하단: 이미 3vh 수준에서 variant 전환이 일어나므로 remaining ≤ 1.5vh 여유로 충분.
    // 프리월 구간의 redraw 는 drawImage 1회 + GPU 업로드라 체감 ~1ms 수준, 히어로~타이포
    // 섹션 스크롤 전체에서 돌아도 비용 부담 미미.
    const HIDDEN_SCROLL_VH = 1.0;
    const BOTTOM_VISIBLE_VH = 1.5;
    const isGlassHidden = () => {
      const vh = window.innerHeight || 0;
      if (!vh) return false;
      const sy = window.scrollY;
      const nearTop = sy <= vh * (1 + HIDDEN_SCROLL_VH);
      if (nearTop) return false;
      const docH = Math.max(
        document.documentElement.scrollHeight,
        document.body.scrollHeight,
      );
      const remaining = docH - (sy + vh);
      const nearBottom = remaining <= vh * BOTTOM_VISIBLE_VH;
      return !nearBottom;
    };

    // 스크롤은 RAF 로 병합 — 한 프레임 안에 여러 번 와도 redraw 는 1회만.
    // 히어로 buffer 락은 lockY 이후 같은 스냅샷을 재사용하므로, 숨은 중간 구간에서는
    // 첫 locked frame 만 데우고 이후 반복 drawImage/GPU 업로드를 건너뛴다.
    const onScroll = () => {
      const hidden = isGlassHidden();
      const lockY = lockOuterStoreRef.current?.current;
      const isLocked =
        lockY != null && Number.isFinite(lockY) && lockY > 0 && window.scrollY >= lockY;

      if (!lockOuterStoreRef.current && hidden) return;
      if (hidden && isLocked) {
        const key = `${Math.round(lockY)}:${window.innerWidth}x${window.innerHeight}`;
        if (lockedHiddenRedrawKey === key) return;
        lockedHiddenRedrawKey = key;
      } else if (!hidden) {
        lockedHiddenRedrawKey = null;
      }
      scheduleRaf();
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", scheduleFreshRaf);

    const target = targetRef?.current ?? null;
    let ro: ResizeObserver | null = null;
    if (target && typeof ResizeObserver !== "undefined") {
      ro = new ResizeObserver(() => scheduleFreshRaf());
      ro.observe(target);
    }

    const layoutHost = sourceLayoutRef?.current ?? null;
    let roLayout: ResizeObserver | null = null;
    if (layoutHost && layoutHost !== target && typeof ResizeObserver !== "undefined") {
      roLayout = new ResizeObserver(() => scheduleFreshRaf());
      roLayout.observe(layoutHost);
    }

    const sampleHost = sampleViewportRef?.current ?? null;
    let roSample: ResizeObserver | null = null;
    if (
      sampleHost &&
      sampleHost !== target &&
      sampleHost !== layoutHost &&
      typeof ResizeObserver !== "undefined"
    ) {
      roSample = new ResizeObserver(() => scheduleFreshRaf());
      roSample.observe(sampleHost);
    }

    const fonts = (document as Document & { fonts?: FontFaceSet }).fonts;
    const onFontsReady = () => scheduleFreshRaf();
    fonts?.addEventListener?.("loadingdone", onFontsReady);

    return () => {
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", scheduleFreshRaf);
      ro?.disconnect();
      roLayout?.disconnect();
      roSample?.disconnect();
      fonts?.removeEventListener?.("loadingdone", onFontsReady);
      if (raf) window.cancelAnimationFrame(raf);
    };
  }, [texture, redraw, targetRef, sourceLayoutRef, sampleViewportRef]);

  return { texture, version, isSourceReady };
};
