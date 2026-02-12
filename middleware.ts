import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";

const isProtectedRoute = createRouteMatcher([
  "/settings(.*)",
  "/api/transcribe(.*)",
  "/api/billing(.*)",
]);

export default clerkMiddleware(async (auth, req) => {
  // Routes publiques : /, /pricing, /sign-in, /sign-up, /api/stripe/webhook
  if (
    req.nextUrl.pathname === "/" ||
    req.nextUrl.pathname === "/pricing" ||
    req.nextUrl.pathname.startsWith("/sign-in") ||
    req.nextUrl.pathname.startsWith("/sign-up") ||
    req.nextUrl.pathname.startsWith("/api/stripe/webhook")
  ) {
    return;
  }

  // Protéger les routes définies
  if (isProtectedRoute(req)) {
    const { userId } = await auth();
    
    if (!userId) {
      // Rediriger vers la page de sign-in pour les pages
      if (req.nextUrl.pathname.startsWith("/settings")) {
        const signInUrl = new URL("/sign-in", req.url);
        signInUrl.searchParams.set("redirect_url", req.url);
        return NextResponse.redirect(signInUrl);
      }
      
      // Retourner 401 pour les API
      return NextResponse.json(
        { error: "Non authentifié" },
        { status: 401 }
      );
    }
  }
});

export const config = {
  matcher: ["/((?!.+\\.[\\w]+$|_next).*)", "/", "/(api|trpc)(.*)"],
};
