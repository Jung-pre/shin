import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    optimizePackageImports: ["@react-three/drei", "framer-motion", "gsap"],
  },
};

export default nextConfig;
