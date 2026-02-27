import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

export function proxy(request: NextRequest) {
  const host = request.headers.get("host") ?? "";
  const url = request.nextUrl.clone();

  // docs.batondx.dev → /docs/*
  if (host.startsWith("docs.") && !url.pathname.startsWith("/docs")) {
    url.pathname = `/docs${url.pathname === "/" ? "" : url.pathname}`;
    return NextResponse.rewrite(url);
  }

  // marketplace.batondx.dev → /marketplace/*
  if (host.startsWith("marketplace.") && !url.pathname.startsWith("/marketplace")) {
    url.pathname = `/marketplace${url.pathname === "/" ? "" : url.pathname}`;
    return NextResponse.rewrite(url);
  }

  // batondx.dev → (marketing)/* — kein Rewrite nötig
  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next|favicon.ico|api|_static).*)"],
};
