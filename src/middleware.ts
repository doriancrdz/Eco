import { clerkMiddleware } from "@clerk/nextjs/server";

export default clerkMiddleware(async (auth, req) => {
  const pathname = req.nextUrl.pathname;

  // Protect /settings
  if (pathname.startsWith("/settings")) {
    await auth.protect();
  }

  // (Optionnel) Protect APIs too:
  // if (pathname.startsWith("/api/")) await auth.protect();
});

export const config = {
  matcher: ["/((?!_next|.*\\..*).*)"],
};
