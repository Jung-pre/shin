import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { defaultLocale, locales } from "@/shared/config/i18n";

const PUBLIC_FILE = /\.[^/]+$/;

const hasLocalePrefix = (pathname: string) => {
  return locales.some((locale) => pathname === `/${locale}` || pathname.startsWith(`/${locale}/`));
};

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (
    pathname.startsWith("/_next") ||
    pathname.startsWith("/api") ||
    pathname.startsWith("/favicon.ico") ||
    PUBLIC_FILE.test(pathname)
  ) {
    return NextResponse.next();
  }

  if (hasLocalePrefix(pathname)) {
    return NextResponse.next();
  }

  const url = request.nextUrl.clone();
  const path = pathname === "/" ? "" : pathname;
  url.pathname = `/${defaultLocale}${path}`;

  return NextResponse.redirect(url);
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|sitemap.xml|robots.txt).*)"],
};
