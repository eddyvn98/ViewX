import type { Config } from "tailwindcss";
import animate from "tailwindcss-animate";

const config: Config = {
    darkMode: "class",
    content: [
        "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
        "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
        "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
        "./src/features/**/*.{js,ts,jsx,tsx,mdx}",
    ],
    theme: {
        extend: {
            fontFamily: {
                sans: ['var(--font-be-vietnam)', 'sans-serif'],
                outfit: ['var(--font-outfit)', 'sans-serif'],
                inter: ['var(--font-inter)', 'sans-serif'],
            },
            colors: {
                background: 'hsl(var(--background))',
                foreground: 'hsl(var(--foreground))',
                card: {
                    DEFAULT: 'hsl(var(--card))',
                    foreground: 'hsl(var(--card-foreground))'
                },
                popover: {
                    DEFAULT: 'hsl(var(--popover))',
                    foreground: 'hsl(var(--popover-foreground))'
                },
                primary: {
                    DEFAULT: 'hsl(var(--primary))',
                    foreground: 'hsl(var(--primary-foreground))'
                },
                secondary: {
                    DEFAULT: 'hsl(var(--secondary))',
                    foreground: 'hsl(var(--secondary-foreground))'
                },
                muted: {
                    DEFAULT: 'hsl(var(--muted))',
                    foreground: 'hsl(var(--muted-foreground))'
                },
                accent: {
                    DEFAULT: 'hsl(var(--accent))',
                    foreground: 'hsl(var(--accent-foreground))'
                },
                destructive: {
                    DEFAULT: 'hsl(var(--destructive))',
                    foreground: 'hsl(var(--destructive-foreground))'
                },
                border: 'hsl(var(--border))',
                input: 'hsl(var(--input))',
                ring: 'hsl(var(--ring))',
                chart: {
                    '1': 'hsl(var(--chart-1))',
                    '2': 'hsl(var(--chart-2))',
                    '3': 'hsl(var(--chart-3))',
                    '4': 'hsl(var(--chart-4))',
                    '5': 'hsl(var(--chart-5))'
                }
            },
            borderRadius: {
                lg: 'var(--radius)',
                md: 'calc(var(--radius) - 2px)',
                sm: 'calc(var(--radius) - 4px)'
            },
            keyframes: {
                'wheel-up-out': {
                    '0%': { transform: 'translateY(0) rotateX(0deg)', opacity: '1', filter: 'brightness(1)' },
                    '100%': { transform: 'translateY(-100%) rotateX(-90deg)', opacity: '0', filter: 'brightness(0.5)' }
                },
                'wheel-up-in': {
                    '0%': { transform: 'translateY(100%) rotateX(90deg)', opacity: '0', filter: 'brightness(0.5)' },
                    '100%': { transform: 'translateY(0) rotateX(0deg)', opacity: '1', filter: 'brightness(1)' }
                },
                'wheel-down-out': {
                    '0%': { transform: 'translateY(0) rotateX(0deg)', opacity: '1', filter: 'brightness(1)' },
                    '100%': { transform: 'translateY(100%) rotateX(90deg)', opacity: '0', filter: 'brightness(0.5)' }
                },
                'wheel-down-in': {
                    '0%': { transform: 'translateY(-100%) rotateX(-90deg)', opacity: '0', filter: 'brightness(0.5)' },
                    '100%': { transform: 'translateY(0) rotateX(0deg)', opacity: '1', filter: 'brightness(1)' }
                },
                'slide-in-right-custom': {
                    '0%': { transform: 'translateX(20px)', opacity: '0' },
                    '100%': { transform: 'translateX(0)', opacity: '1' }
                },
                'slide-out-left-custom': {
                    '0%': { transform: 'translateX(0)', opacity: '1' },
                    '100%': { transform: 'translateX(-20px)', opacity: '0' }
                }
            },
            animation: {
                'wheel-up-in': 'wheel-in-bottom 0.3s cubic-bezier(0.23, 1, 0.32, 1) forwards',
                'wheel-up-out': 'wheel-out-top 0.3s cubic-bezier(0.23, 1, 0.32, 1) forwards',
                'wheel-down-in': 'wheel-in-top 0.3s cubic-bezier(0.23, 1, 0.32, 1) forwards',
                'wheel-down-out': 'wheel-out-bottom 0.3s cubic-bezier(0.23, 1, 0.32, 1) forwards',
                'slide-in-right': 'slide-in-right-custom 0.3s cubic-bezier(0.23, 1, 0.32, 1) forwards',
                'slide-out-left': 'slide-out-left-custom 0.3s cubic-bezier(0.23, 1, 0.32, 1) forwards'
            }
        }
    },
    plugins: [animate],
};
export default config;
