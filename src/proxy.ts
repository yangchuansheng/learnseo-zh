import { NextResponse, type NextRequest } from "next/server";
import { localeFromPathname } from "@/lib/localization";

export function proxy(request: NextRequest) {
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("x-learningseo-locale", localeFromPathname(request.nextUrl.pathname));

  return NextResponse.next({ request: { headers: requestHeaders } });
}

export const config = {
  matcher: ["/((?!_next|api|favicon.ico).*)"],
};
