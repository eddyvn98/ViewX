import { defineRouting } from 'next-intl/routing';
import { createNavigation } from 'next-intl/navigation';

export const routing = defineRouting({
    // A list of all locales that are supported
    locales: ['vi', 'en'],

    // Used when no locale matches
    defaultLocale: 'vi',

    // Support localized pathnames
    pathnames: {
        '/': '/',
        '/about': '/about',
        '/chart': '/chart',
        '/contact': '/contact',
        '/faq': '/faq',
        '/landing': '/',
        '/methodology': '/methodology',
        '/mt5-activation': '/mt5-activation',
        '/pricing': '/pricing',
        '/plan-updates/ai': '/plan-updates/ai',
        '/plan-updates/free': '/plan-updates/free',
        '/plan-updates/pro': '/plan-updates/pro',
        '/privacy': '/privacy',
        '/premium-ai': {
            en: '/premium-ai',
            vi: '/goi-cao-cap'
        },
        '/your-mt5-guide': '/your-mt5-guide',
        '/strategy/dashboard': '/strategy/dashboard',
        '/terms': '/terms'
    }
});

// Lightweight wrappers around Next.js' navigation APIs
// that will consider the routing configuration
export const { Link, redirect, usePathname, useRouter, getPathname } =
    createNavigation(routing);
