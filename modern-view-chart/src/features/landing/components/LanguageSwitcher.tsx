'use client';

import { useLocale } from 'next-intl';
import { useRouter, usePathname } from '@/i18n/routing';

export function LanguageSwitcher() {
    const locale = useLocale();
    const router = useRouter();
    const pathname = usePathname();

    const toggleLocale = () => {
        const nextLocale = locale === 'vi' ? 'en' : 'vi';
        router.replace(pathname, { locale: nextLocale });
    };

    return (
        <button
            onClick={toggleLocale}
            className="flex items-center gap-1.5 rounded-md border border-sky-200 bg-white px-3 py-2 text-[11px] font-black text-slate-800 transition-colors hover:bg-sky-50 uppercase tracking-widest"
        >
            <span className={locale === 'en' ? 'text-primary' : 'text-slate-400'}>EN</span>
            <span className="text-slate-200">|</span>
            <span className={locale === 'vi' ? 'text-primary' : 'text-slate-400'}>VI</span>
        </button>
    );
}
