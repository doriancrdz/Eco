import { clerkMiddleware, createRouteMatcher } from '@clerk/nextjs/server';

// Routes publiques essentielles (sign-in/sign-up gérées automatiquement par Clerk)
const isPublicRoute = createRouteMatcher([
  '/',
  '/pricing',
  '/api/stripe/webhook(.*)', // Webhook Stripe doit être public
]);

export default clerkMiddleware(async (auth, request) => {
  // Laisser Clerk gérer sign-in/sign-up automatiquement
  // Protéger uniquement les autres routes sauf les publiques
  if (!isPublicRoute(request)) {
    await auth.protect();
  }
});

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
};
