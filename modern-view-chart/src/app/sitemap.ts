import type { MetadataRoute } from 'next';
import { getSiteOrigin } from '@/lib/site-url';

const ROUTES = [
  { path: '', changeFrequency: 'weekly' as const, priority: 1 },
  { path: '/chart', changeFrequency: 'always' as const, priority: 0.9 },
  { path: '/strategy/dashboard', changeFrequency: 'daily' as const, priority: 0.8 },
  { path: '/about', changeFrequency: 'monthly' as const, priority: 0.6 },
  { path: '/contact', changeFrequency: 'yearly' as const, priority: 0.5 },
  { path: '/terms', changeFrequency: 'yearly' as const, priority: 0.4 },
  { path: '/privacy', changeFrequency: 'yearly' as const, priority: 0.4 },
];

export default function sitemap(): MetadataRoute.Sitemap {
  const baseUrl = getSiteOrigin();

  return ROUTES.flatMap((route) => ['vi', 'en'].map((locale) => ({
    url: `${baseUrl}/${locale}${route.path}`,
    changeFrequency: route.changeFrequency,
    priority: route.priority,
    alternates: {
      languages: {
        vi: `${baseUrl}/vi${route.path}`,
        en: `${baseUrl}/en${route.path}`,
        'x-default': `${baseUrl}/vi${route.path}`,
      },
    },
  })));
}
