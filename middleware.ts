import { clerkMiddleware, createRouteMatcher } from '@clerk/nextjs/server';
import { NextResponse } from 'next/server';

// Routes publiques (accessibles sans authentification)
const isPublicRoute = createRouteMatcher([
  '/sign-in(.*)',
  '/sign-up(.*)',
  '/api/webhooks(.*)',
  '/api/generate-summary', // appelé en interne par transcribe/background (pas de session Clerk)
  '/',
  '/pricing',
  '/legal/terms',
  '/legal/privacy',
  '/legal/mentions',
]);

// Bloquer les scanners/botnets sur les routes API (pas les pages publiques)
const BOT_UA_PATTERNS = [
  /zgrab/i, /masscan/i, /nuclei/i, /nmap/i, /sqlmap/i,
  /python-requests/i, /go-http-client\/1\./i, /curl\/[0-9]/i,
  /dirsearch/i, /nikto/i, /wfuzz/i, /gobuster/i, /ffuf/i,
];

export default clerkMiddleware(async (auth, request) => {
  const { pathname } = request.nextUrl;

  // Bloquer les bots scanners sur les routes API uniquement
  if (pathname.startsWith('/api/')) {
    const ua = request.headers.get('user-agent') ?? '';
    if (!ua || BOT_UA_PATTERNS.some((p) => p.test(ua))) {
      return new NextResponse(null, { status: 403 });
    }
  }

  // Protéger toutes les routes sauf les routes publiques
  if (!isPublicRoute(request)) {
    await auth.protect();
  }
});

export const config = {
  matcher: [
    // Matcher Clerk recommandé
    '/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)',
    '/(api|trpc)(.*)',
  ],
};
