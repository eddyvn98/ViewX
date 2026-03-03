import { MetadataRoute } from 'next';

export default function manifest(): MetadataRoute.Manifest {
    return {
        name: 'Vivutrade - Trading Chart & Strategy Platform',
        short_name: 'Vivutrade',
        description: 'High-performance trading chart, real-time strategy matrix monitor, and backtest analytics dashboard.',
        start_url: '/',
        display: 'standalone',
        background_color: '#ffffff',
        theme_color: '#0ea5e9',
        icons: [
            {
                src: '/icon.svg',
                sizes: 'any',
                type: 'image/svg+xml',
            },
            {
                src: '/favicon.ico',
                sizes: '48x48 32x32 16x16',
                type: 'image/x-icon',
            },
        ],
    };
}
