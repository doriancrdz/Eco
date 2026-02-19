import { clerkMiddleware, createRouteMatcher } from '@clerk/nextjs/server';

// Routes publiques qui ne nécessitent PAS d'auth
// IMPORTANT: /sign-in et /sign-up doivent être publiques pour que Clerk fonctionne correctement
const isPublicRoute = createRouteMatcher([
  '/',
  '/sign-in(.*)',
  '/sign-up(.*)',
  '/api/webhooks(.*)',
  '/api/stripe/webhook(.*)', // Webhook Stripe doit être public
  '/pricing',
]);

export default clerkMiddleware(async (auth, request) => {
  // Ne RIEN faire pour les routes publiques (sign-in/sign-up)
  // Cela permet à Clerk de gérer le processus d'authentification sans interférence
  if (isPublicRoute(request)) {
    return;
  }

  // Protéger toutes les autres routes
  await auth.protect();
});

export const config = {
  matcher: [
    // Exclure les fichiers statiques Next.js et Vercel
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)',
  ],
};
