import { clerkMiddleware, createRouteMatcher } from '@clerk/nextjs/server';

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

export default clerkMiddleware(async (auth, request) => {
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
