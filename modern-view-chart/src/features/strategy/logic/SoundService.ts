
/**
 * SoundService - Synthesizes high-quality trading sounds using Web Audio API.
 * This avoids network latency and reliance on external assets.
 */
class SoundService {
    private ctx: AudioContext | null = null;
    private keepAliveTimer: any = null;

    private getContext() {
        if (!this.ctx) {
            // @ts-ignore
            const AudioContextClass = window.AudioContext || window.webkitAudioContext;
            if (AudioContextClass) {
                this.ctx = new AudioContextClass();
            }
        }
        return this.ctx;
    }

    async resume() {
        const ctx = this.getContext();
        if (ctx && ctx.state === 'suspended') {
            await ctx.resume();
            console.log('🔊 [SoundService] Audio Context Resumed');
        }
    }

    private playTone(freqs: number[], duration: number, type: OscillatorType = 'sine', volume = 0.3) {
        const ctx = this.getContext();
        if (!ctx) return;

        if (ctx.state === 'suspended') {
            ctx.resume().catch(() => { });
        }

        const now = ctx.currentTime;
        const masterGain = ctx.createGain();
        masterGain.connect(ctx.destination);
        masterGain.gain.setValueAtTime(volume, now);
        masterGain.gain.exponentialRampToValueAtTime(0.001, now + duration);

        freqs.forEach((freq, i) => {
            const osc = ctx.createOscillator();
            const gain = ctx.createGain();

            osc.type = type;
            osc.frequency.setValueAtTime(freq, now);

            // Subtle sweep for more organic feel
            osc.frequency.exponentialRampToValueAtTime(freq * 1.05, now + duration);

            gain.gain.setValueAtTime(volume / freqs.length, now);

            osc.connect(gain);
            gain.connect(masterGain);

            osc.start(now);
            osc.stop(now + duration);
        });
    }

    /**
     * Sweet upward harmonic for BUY signals
     */
    playBuy() {
        this.playTone([440, 554.37, 659.25], 0.3, 'sine', 0.25); // A4 Major
    }

    /**
     * Solid downward harmonic for SELL signals
     */
    playSell() {
        this.playTone([349.23, 261.63, 174.61], 0.4, 'sine', 0.25); // F downward
    }

    /**
     * High pitched single ping for TP targets
     */
    playTP() {
        this.playTone([880, 1760], 0.5, 'sine', 0.2);
    }

    /**
     * Low, dull double-tap for Stop Losses
     */
    playSL() {
        this.playTone([110], 0.1, 'square', 0.15);
        setTimeout(() => this.playTone([82.41], 0.2, 'square', 0.15), 100);
    }

    /**
     * Soft, modern "thinking" sound for AI audits
     */
    playAIThinking() {
        this.playTone([523.25, 783.99], 0.1, 'sine', 0.15); // C5 G5
    }

    /**
     * Alert sound for generic triggers
     */
    playAlert() {
        this.playTone([660, 880], 0.2, 'triangle', 0.2);
    }

    /**
     * Silent Heartbeat - Keeps JavaScript execution high-priority in background tabs.
     * Generates a nearly-inaudible sound at regular intervals.
     */
    enableKeepAlive() {
        if (this.keepAliveTimer) return;

        console.log('💓 [SoundService] Silent Heartbeat Enabled');
        const pulse = () => {
            // Play a very quiet, short tone every 25 seconds
            // Browser limit is usually 30s for background execution without activity
            this.playTone([20], 0.1, 'sine', 0.001);
            this.keepAliveTimer = setTimeout(pulse, 25000);
        };

        pulse();
    }

    disableKeepAlive() {
        if (this.keepAliveTimer) {
            clearTimeout(this.keepAliveTimer);
            this.keepAliveTimer = null;
            console.log('💔 [SoundService] Silent Heartbeat Disabled');
        }
    }
}

export const soundService = new SoundService();
