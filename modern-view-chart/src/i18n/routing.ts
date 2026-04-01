import { defineRouting } from 'next-intl/routing';
import { createNavigation } from 'next-intl/navigation';

export const routing = defineRouting({
    // A list of all locales that are supported
    locales: ['vi', 'en'],

    // Used when no locale matches
    defaultLocale: 'vi',

    // Support localized pathnames
    pathnames: {
        '/': {
            en: '/',
            vi: '/'
        },
        '/chart': {
            en: '/chart',
            vi: '/chart'
        },
        '/strategy/dashboard': {
            en: '/strategy/dashboard',
            vi: '/strategy/dashboard'
        },
        '/landing': {
            en: '/landing',
            vi: '/landing'
        },
        '/faq': {
            en: '/faq',
            vi: '/faq'
        },
        '/about': {
            en: '/about',
            vi: '/about'
        },
        '/methodology': {
            en: '/methodology',
            vi: '/methodology'
        },
        '/contact': {
            en: '/contact',
            vi: '/contact'
        },
        '/terms': {
            en: '/terms',
            vi: '/terms'
        },
        '/privacy': {
            en: '/privacy',
            vi: '/privacy'
        },
        '/plan-updates/free': {
            en: '/plan-updates/free',
            vi: '/plan-updates/free'
        },
        '/plan-updates/pro': {
            en: '/plan-updates/pro',
            vi: '/plan-updates/pro'
        },
        '/plan-updates/ai': {
            en: '/plan-updates/ai',
            vi: '/plan-updates/ai'
        },
        '/premium-ai': {
            en: '/premium-ai',
            vi: '/premium-ai'
        }
    }
});

// Lightweight wrappers around Next.js' navigation APIs
// that will consider the routing configuration
export const { Link, redirect, usePathname, useRouter, getPathname } =
    createNavigation(routing);
