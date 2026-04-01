'use client';
import type { TradingSource } from '@/lib/legal/consent';

type Mt5ActivationWizardProps = {
  hasMt5Module: boolean;
  isBridgeOnline: boolean;
  hasAccountLinked: boolean;
  hasLegalConsent: boolean;
  onboardingSource: TradingSource;
  onConsentSaved: () => void;
};

export function Mt5ActivationWizard({
  hasMt5Module,
  isBridgeOnline,
  hasAccountLinked,
  hasLegalConsent,
  onboardingSource,
  onConsentSaved,
}: Mt5ActivationWizardProps) {
  void onConsentSaved;
  const mark = (ok: boolean) => (ok ? 'XONG' : 'CAN LAM');

  const openActivationGuide = () => {
    if (typeof window === 'undefined') return;
    const segments = window.location.pathname.split('/').filter(Boolean);
    const locale = segments[0] || 'vi';
    const url = `${window.location.origin}/${locale}/guides/terminal-setup`;
    window.open(url, '_blank', 'noopener,noreferrer');
  };

  return (
    <div className="mx-2 mt-2 rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-[11px] text-amber-900">
      <div className="flex items-center justify-between gap-2">
        <div className="font-semibold tracking-wide">Checklist kich hoat MT5 ({onboardingSource})</div>
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={openActivationGuide}
            className="rounded border border-cyan-500/50 px-2 py-1 text-[10px] text-cyan-800 hover:bg-cyan-100"
          >
            Mo trang kich hoat
          </button>
        </div>
      </div>

      <div className="mt-1 space-y-0.5 text-[10px] leading-relaxed">
        <div>{mark(hasMt5Module)} Module MT5 da kich hoat</div>
        <div>{mark(isBridgeOnline)} Bridge da ket noi</div>
        <div>{mark(hasAccountLinked)} Da nhan dien tai khoan giao dich</div>
        <div>{mark(hasLegalConsent)} Da chap thuan phap ly truoc khi giao dich that</div>
      </div>
    </div>
  );
}
