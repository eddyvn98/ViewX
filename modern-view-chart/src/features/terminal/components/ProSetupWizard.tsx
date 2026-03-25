'use client';

import { useState } from 'react';
import Link from 'next/link';
import { cn } from '@/lib/utils';
import { saveLegalConsent, type TradingSource } from '@/lib/legal/consent';
import { useTranslations } from 'next-intl';

type ProSetupWizardProps = {
  isProUser: boolean;
  isBridgeOnline: boolean;
  hasAccountLinked: boolean;
  hasLegalConsent: boolean;
  onboardingSource: TradingSource;
  onConsentSaved: () => void;
};

export function ProSetupWizard({
  isProUser,
  isBridgeOnline,
  hasAccountLinked,
  hasLegalConsent,
  onboardingSource,
  onConsentSaved,
}: ProSetupWizardProps) {
  const t = useTranslations('ProFlow');
  const [open, setOpen] = useState(false);

  const mark = (ok: boolean) => (ok ? t('statusDone') : t('statusTodo'));

  return (
    <>
      <div className="mx-2 mt-2 rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-[11px] text-amber-100">
        <div className="flex items-center justify-between gap-2">
          <div className="font-semibold tracking-wide">{t('checklistTitle', { source: onboardingSource })}</div>
          <button
            type="button"
            onClick={() => setOpen(true)}
            className="rounded border border-amber-400/40 px-2 py-1 text-[10px] hover:bg-amber-400/10"
          >
            {t('openSetup')}
          </button>
        </div>
        <div className="mt-1 space-y-0.5 text-[10px] leading-relaxed">
          <div>{mark(isProUser)} {t('stepPlanActive')}</div>
          <div>{mark(isBridgeOnline)} {t('stepBridgeConnected')}</div>
          <div>{mark(hasAccountLinked)} {t('stepAccountDetected')}</div>
          <div>{mark(hasLegalConsent)} {t('stepLegalAccepted')}</div>
        </div>
      </div>

      {open && (
        <div className="fixed inset-0 z-[1200] flex items-center justify-center bg-black/60 p-4">
          <div className="w-full max-w-lg rounded-xl border border-border bg-background p-4 shadow-2xl">
            <h3 className="text-sm font-bold text-foreground">{t('wizardTitle')}</h3>
            <p className="mt-1 text-xs text-muted-foreground">
              {t('wizardDesc')}
            </p>

            <div className="mt-3 space-y-2 text-xs">
              <div className="rounded-md border border-border/70 bg-secondary/20 p-2">
                <div className={cn('font-semibold', isProUser ? 'text-emerald-400' : 'text-amber-300')}>
                  {t('wizardStepPlanTitle', { status: isProUser ? t('statusDone') : t('statusRequired') })}
                </div>
                <p className="mt-1 text-muted-foreground">
                  {t('wizardStepPlanDesc')}
                </p>
                {!isProUser && (
                  <Link href="/pricing" className="mt-2 inline-block underline underline-offset-2">
                    {t('openPricing')}
                  </Link>
                )}
              </div>

              <div className="rounded-md border border-border/70 bg-secondary/20 p-2">
                <div className={cn('font-semibold', isBridgeOnline ? 'text-emerald-400' : 'text-amber-300')}>
                  {t('wizardStepBridgeTitle', { status: isBridgeOnline ? t('statusDone') : t('statusRequired') })}
                </div>
                <p className="mt-1 text-muted-foreground">
                  {t('wizardStepBridgeDesc')}
                </p>
              </div>

              <div className="rounded-md border border-border/70 bg-secondary/20 p-2">
                <div className={cn('font-semibold', hasAccountLinked ? 'text-emerald-400' : 'text-amber-300')}>
                  {t('wizardStepAccountTitle', { status: hasAccountLinked ? t('statusDone') : t('statusRequired') })}
                </div>
                <p className="mt-1 text-muted-foreground">
                  {t('wizardStepAccountDesc')}
                </p>
              </div>

              <div className="rounded-md border border-border/70 bg-secondary/20 p-2">
                <div className={cn('font-semibold', hasLegalConsent ? 'text-emerald-400' : 'text-amber-300')}>
                  {t('wizardStepLegalTitle', { status: hasLegalConsent ? t('statusDone') : t('statusRequired') })}
                </div>
                <p className="mt-1 text-muted-foreground">
                  {t('wizardStepLegalDesc')}
                </p>
                {!hasLegalConsent && (
                  <button
                    type="button"
                    onClick={() => {
                      saveLegalConsent(onboardingSource);
                      onConsentSaved();
                    }}
                    className="mt-2 rounded border border-border px-2 py-1 text-[11px] hover:bg-secondary/60"
                  >
                    {t('acceptLegalNow')}
                  </button>
                )}
                <div className="mt-2 flex gap-2">
                  <Link href="/terms" target="_blank" className="underline underline-offset-2">
                    {t('terms')}
                  </Link>
                  <Link href="/privacy" target="_blank" className="underline underline-offset-2">
                    {t('privacy')}
                  </Link>
                </div>
              </div>
            </div>

            <div className="mt-4 flex justify-end">
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="rounded-md border border-border px-3 py-1.5 text-xs text-muted-foreground hover:bg-secondary/50"
              >
                {t('close')}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
