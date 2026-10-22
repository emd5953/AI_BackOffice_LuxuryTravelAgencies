import { NextResponse, type NextRequest } from "next/server";
import { accessError } from "./lib/operations/auth";

export function proxy(request: NextRequest) {
  return accessError(request) || NextResponse.next();
}
export const config = {
  matcher: [
    "/operations/:path*",
    "/today/:path*",
    "/inbox/:path*",
    "/clients/:path*",
    "/dashboard/:path*",
    "/trips/:path*",
  ],
};
