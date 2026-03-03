import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export function middleware(request: NextRequest) {
    const url = request.nextUrl;
    const hostname = request.headers.get('host') || '';

    // Allowed public assets and system paths that should NOT be rewritten
    if (
        url.pathname.startsWith('/_next') ||
        url.pathname.startsWith('/api') ||
        url.pathname.startsWith('/brand') ||
        url.pathname.startsWith('/favicon.ico') ||
        url.pathname.startsWith('/robots.txt') ||
        url.pathname.startsWith('/sitemap.xml')
    ) {
        return NextResponse.next();
    }

    // Define chart domains (including local dev variations)
    const isChartDomain =
        hostname.startsWith('chart.') ||
        // allow testing via chart.localhost:3000
        (hostname.includes('localhost') && hostname.startsWith('chart.'));

    // If traffic comes to chart.vivutrade.io.vn and isn't already going to /chart -> rewrite it to /chart
    if (isChartDomain && !url.pathname.startsWith('/chart')) {
        url.pathname = `/chart${url.pathname === '/' ? '' : url.pathname}`;
        return NextResponse.rewrite(url);
    }

    // Note: We don't force redirect from vivutrade.io.vn/chart to chart.vivutrade.io.vn 
    // to allow fallback access if subdomains have DNS issues. 
    // But root (/) on vivutrade.io.vn will serve the default app/page.tsx (Landing).

    return NextResponse.next();
}

export const config = {
    matcher: [
        // Ignore static files, we only want to run middleware on pages/api
        '/((?!_next/static|_next/image|favicon.ico).*)',
    ],
};
