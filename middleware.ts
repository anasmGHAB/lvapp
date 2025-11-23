import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";

// 1. On définit ici les pages qui doivent être accessibles SANS être connecté
const isPublicRoute = createRouteMatcher([
    '/sign-in(.*)',
    '/sign-up(.*)'
]);

export default clerkMiddleware(async (auth, req) => {
    // 2. Si la page demandée n'est PAS publique, alors on la protège
    if (!isPublicRoute(req)) {
        await auth.protect();
    }
});

export const config = {
    matcher: [
        // Ignore les fichiers statiques et images
        '/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)',
        // Protège toujours les API
        '/(api|trpc)(.*)',
    ],
};
