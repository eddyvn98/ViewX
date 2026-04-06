import { Metadata } from 'next';
import { ActivationForm } from './ActivationForm';

export const metadata: Metadata = {
    title: 'MT5 Activation | vivutrade',
    description: 'Activate your MT5 connection securely.',
};

export default function Mt5ActivationPage() {
    return (
        <main className="min-h-screen w-full overflow-y-auto bg-slate-950 px-4">
            <div className="absolute inset-0 overflow-hidden pointer-events-none">
                <div className="absolute -top-[20%] -left-[10%] w-[50%] h-[50%] rounded-full bg-emerald-500/10 blur-[120px]" />
                <div className="absolute top-[30%] -right-[10%] w-[40%] h-[60%] rounded-full bg-blue-500/10 blur-[120px]" />
            </div>

            <div className="relative z-10 mx-auto flex min-h-screen w-full max-w-5xl flex-col justify-center py-10">
                <div className="mx-auto mb-8 w-full max-w-2xl text-center">
                    <p className="text-xs font-semibold uppercase tracking-[0.34em] text-emerald-300">
                        MT5 consent flow
                    </p>
                    <h2 className="mt-3 text-2xl font-bold text-white md:text-3xl">
                        Complete consent, then return to chart
                    </h2>
                    <p className="mt-3 text-sm leading-relaxed text-slate-300">
                        This screen records your consent locally and unlocks the terminal once the bridge and account state are ready.
                    </p>
                </div>

                <div className="w-full text-center">
                    <ActivationForm />
                </div>
            </div>
            
             <footer className="relative z-10 py-8 text-center text-xs text-muted-foreground/50">
                &copy; 2026 Vivutrade Global. All rights reserved.
            </footer>
        </main>
    );
}
