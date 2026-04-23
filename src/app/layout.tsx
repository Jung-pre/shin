import type { Metadata } from "next";
import { Marcellus } from "next/font/google";
import "pretendard/dist/web/static/pretendard.css";
import "./globals.css";

const marcellus = Marcellus({
  weight: "400",
  subsets: ["latin"],
  variable: "--font-marcellus",
  display: "swap",
});

export const metadata: Metadata = {
  metadataBase: new URL("https://gwangju-eye.com"),
  title: {
    default: "광주신세계안과",
    template: "%s | 광주신세계안과",
  },
  description: "광주신세계안과 공식 웹사이트",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ko" className={marcellus.variable}>
      <head>
        <link
          rel="preload"
          as="image"
          href="/main/img_hero.webp"
          type="image/webp"
          fetchPriority="high"
        />
      </head>
      <body>{children}</body>
    </html>
  );
}
