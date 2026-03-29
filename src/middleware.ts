import { getToken } from "next-auth/jwt";
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { pathnameRequiresUsername } from "@/lib/username-gate";

const CHOOSE_USERNAME_PATH = "/choose-username";

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (!pathnameRequiresUsername(pathname)) {
    return NextResponse.next();
  }

  const token = await getToken({
    req: request,
    secret: process.env.NEXTAUTH_SECRET
  });

  if (!token?.sub) {
    return NextResponse.next();
  }

  const username = token.username;
  if (typeof username === "string" && username.length > 0) {
    return NextResponse.next();
  }

  const url = request.nextUrl.clone();
  url.pathname = CHOOSE_USERNAME_PATH;
  url.searchParams.set("next", pathname);
  return NextResponse.redirect(url);
}

export const config = {
  matcher: [
    "/discover",
    "/discover/:path*",
    "/feed",
    "/feed/:path*",
    "/profile",
    "/profile/:path*"
  ]
};
