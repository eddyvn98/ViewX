import createMiddleware from 'next-intl/middleware';
import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { routing } from './i18n/routing';

const intlMiddleware = createMiddleware(routing);
const pageContentSecurityPolicy = [
    "default-src 'self'",
    "script-src 'self' 'unsafe-inline' https://unpkg.com https://cdn.jsdelivr.net https://cdnjs.cloudflare.com https://static.cloudflareinsights.com https://accounts.google.com",
    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com https://cdn.jsdelivr.net https://cdnjs.cloudflare.com https://accounts.google.com",
    "font-src 'self' https://fonts.gstatic.com data:",
    "img-src 'self' data: https:",
    "connect-src 'self' ws: wss: https://stream.binance.com:9443 https://api.binance.com https://cdn.jsdelivr.net https://cdnjs.cloudflare.com",
    "frame-src 'self' https://accounts.google.com",
    "worker-src 'self' blob:",
    "object-src 'none'",
    "base-uri 'self'",
    "frame-ancestors 'none'",
].join('; ');

function applySecurityHeaders(response: Response) {
    response.headers.delete('x-powered-by');
    response.headers.set('Content-Security-Policy', pageContentSecurityPolicy);
    response.headers.set('X-Frame-Options', 'DENY');
    response.headers.set('X-Content-Type-Options', 'nosniff');
    response.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');
    response.headers.set('Permissions-Policy', 'camera=(), geolocation=(), microphone=()');
    response.headers.set('Cross-Origin-Opener-Policy', 'same-origin-allow-popups');
    if (process.env.NODE_ENV === 'production') {
        response.headers.set('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
    }
    return response;
}

export default function proxy(request: NextRequest) {
    const pathname = request.nextUrl.pathname;
    const match = pathname.match(/^\/(vi|en)(\/.*)?$/i);
    const locale = match?.[1]?.toLowerCase();
    const localizedPath = match?.[2] || '/';
    const isBlockedPlanPath =
        localizedPath === '/plan-updates' ||
        localizedPath.startsWith('/plan-updates/') ||
        localizedPath.startsWith('/plan-details/');

    if (locale && isBlockedPlanPath) {
        const redirectUrl = new URL(`/${locale}/pricing`, request.url);
        return NextResponse.redirect(redirectUrl);
    }

    const response = intlMiddleware(request);
    return applySecurityHeaders(response);
}

export const config = {
    // Match all app routes except API, Next internals and static files.
    matcher: ['/((?!api|_next|_vercel|docs|.*\\..*).*)']
};
