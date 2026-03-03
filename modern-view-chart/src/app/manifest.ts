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
                src: '/favicon.ico',
                sizes: '192x192',
                type: 'image/x-icon',
            },
        ],
    };
}
