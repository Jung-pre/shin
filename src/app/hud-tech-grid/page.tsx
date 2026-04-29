"use client";

import { HudTechGrid } from "@/features/experiments/hud-tech-grid";

/** 실험용 미리보기 — `/hud-tech-grid` */
export default function HudTechGridDemoPage() {
  return (
    <main
      style={{
        margin: 0,
        width: "100vw",
        height: "100vh",
        overflow: "hidden",
      }}
    >
      <HudTechGrid />
    </main>
  );
}
