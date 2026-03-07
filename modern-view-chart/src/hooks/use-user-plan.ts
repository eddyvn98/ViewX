'use client';

import { useState, useEffect } from 'react';

export type UserPlan = 'free' | 'pro' | 'pro_plus';

export function useUserPlan() {
    const [plan, setPlan] = useState<UserPlan>('free');
    const [isAuthenticated, setIsAuthenticated] = useState(false);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        if (typeof window === 'undefined') return;

        const updatePlan = () => {
            const raw = localStorage.getItem('auth_user') || '';
            const token = localStorage.getItem('auth_access_token');

            setIsAuthenticated(!!token);

            if (!raw) {
                setPlan('free');
                setIsLoading(false);
                return;
            }

            try {
                const user = JSON.parse(raw);
                // Plan might be nested in subscription object from backend
                const userPlan = user.subscription?.plan || user.plan || 'free';
                setPlan(userPlan as UserPlan);
            } catch (e) {
                console.error('Failed to parse user from localStorage', e);
                setPlan('free');
            } finally {
                setIsLoading(false);
            }
        };

        updatePlan();
        window.addEventListener('storage', updatePlan);
        return () => window.removeEventListener('storage', updatePlan);
    }, []);

    return {
        plan,
        isAuthenticated,
        isLoading,
        isPro: plan === 'pro' || plan === 'pro_plus',
        isProPlus: plan === 'pro_plus',
        isFree: plan === 'free',
    };
}
