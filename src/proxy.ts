import { NextResponse, type NextRequest } from "next/server";

export function proxy(request: NextRequest) {
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set(
    "x-learningseo-locale",
    /^\/en(?:\/|$)/.test(request.nextUrl.pathname) ? "en" : "zh-CN",
  );

  return NextResponse.next({ request: { headers: requestHeaders } });
}

export const config = {
  matcher: ["/((?!_next|api|favicon.ico).*)"],
};
