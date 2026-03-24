import { defineRouting } from 'next-intl/routing';
import { createNavigation } from 'next-intl/navigation';

export const routing = defineRouting({
    // A list of all locales that are supported
    locales: ['vi', 'en'],

    // Used when no locale matches
    defaultLocale: 'vi',

    // Support localized pathnames
    pathnames: {
        '/premium-ai': {
            en: '/premium-ai',
            vi: '/goi-cao-cap'
        }
    }
});

// Lightweight wrappers around Next.js' navigation APIs
// that will consider the routing configuration
export const { Link, redirect, usePathname, useRouter, getPathname } =
    createNavigation(routing);
