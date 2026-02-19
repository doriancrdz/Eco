import { clerkMiddleware, createRouteMatcher } from '@clerk/nextjs/server';

// Routes publiques qui ne nécessitent PAS d'auth
const isPublicRoute = createRouteMatcher([
  '/',
  '/sign-in(.*)',
  '/sign-up(.*)',
  '/api/webhooks(.*)',
  '/api/stripe/webhook(.*)', // Webhook Stripe doit être public
  '/pricing',
]);

// Routes statiques à ignorer complètement
const isStaticRoute = createRouteMatcher([
  '/_next(.*)',
  '/favicon.ico',
  '/logo-eco.png',
  '/(.*).png',
  '/(.*).jpg',
  '/(.*).svg',
  '/(.*).ico',
]);

export default clerkMiddleware(async (auth, request) => {
  // Ignorer complètement les routes statiques
  if (isStaticRoute(request)) {
    return;
  }

  // Protéger toutes les routes sauf les publiques
  if (!isPublicRoute(request)) {
    await auth.protect();
  }
});

export const config = {
  matcher: [
    // Exclure les fichiers statiques Next.js et Vercel
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)',
  ],
};
