import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    optimizePackageImports: ["@react-three/drei", "framer-motion", "gsap"],
  },
  images: {
    // next/image 를 쓰는 경로(rotating-slide 등) 에서 브라우저 네고시에이션에 맞춰
    // AVIF → WebP → PNG 순으로 제공. 원본 2~4MB PNG 들이 상황에 따라 수십~수백KB
    // 수준까지 떨어진다. (로컬 /public 이미지도 next/image 파이프라인을 탐.)
    formats: ["image/avif", "image/webp"],
    // 모바일 ~ 데스크톱 레이아웃에서 실제 요청될 대표 폭들. 너무 많으면 빌드/캐시 비용↑,
    // 너무 적으면 과잉 해상도 다운로드.
    deviceSizes: [640, 750, 828, 1080, 1200, 1440, 1920, 2560],
    imageSizes: [64, 96, 128, 256, 384],
  },
};

export default nextConfig;
