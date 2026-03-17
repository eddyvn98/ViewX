/**
 * SoundService - Synthesizes high-quality trading sounds using Web Audio API.
 * This avoids network latency and reliance on external assets.
 */
type AudioContextCtor = typeof AudioContext;
type WindowWithWebkitAudio = Window & {
    AudioContext?: AudioContextCtor;
    webkitAudioContext?: AudioContextCtor;
};

class SoundService {
    private ctx: AudioContext | null = null;
    private keepAliveTimer: ReturnType<typeof setTimeout> | null = null;

    private getContext() {
        if (!this.ctx) {
            const windowRef = window as WindowWithWebkitAudio;
            const AudioContextClass = windowRef.AudioContext || windowRef.webkitAudioContext;
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
            console.log('[SoundService] Audio Context Resumed');
        }
    }

    private playTone(freqs: number[], duration: number, type: OscillatorType = 'sine', volume = 0.3) {
        const ctx = this.getContext();
        if (!ctx) return;

        if (ctx.state === 'suspended') {
            void ctx.resume().catch(() => undefined);
        }

        const now = ctx.currentTime;
        const masterGain = ctx.createGain();
        masterGain.connect(ctx.destination);
        masterGain.gain.setValueAtTime(volume, now);
        masterGain.gain.exponentialRampToValueAtTime(0.001, now + duration);

        freqs.forEach((freq) => {
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

    playBuy() {
        this.playTone([440, 554.37, 659.25], 0.3, 'sine', 0.25);
    }

    playSell() {
        this.playTone([349.23, 261.63, 174.61], 0.4, 'sine', 0.25);
    }

    playTP() {
        this.playTone([880, 1760], 0.5, 'sine', 0.2);
    }

    playSL() {
        this.playTone([110], 0.1, 'square', 0.15);
        setTimeout(() => this.playTone([82.41], 0.2, 'square', 0.15), 100);
    }

    playAIThinking() {
        this.playTone([523.25, 783.99], 0.1, 'sine', 0.15);
    }

    playAlert() {
        this.playTone([660, 880], 0.2, 'triangle', 0.2);
    }

    enableKeepAlive() {
        if (this.keepAliveTimer) return;

        console.log('[SoundService] Silent Heartbeat Enabled');
        const pulse = () => {
            this.playTone([20], 0.1, 'sine', 0.001);
            this.keepAliveTimer = setTimeout(pulse, 25000);
        };

        pulse();
    }

    disableKeepAlive() {
        if (this.keepAliveTimer) {
            clearTimeout(this.keepAliveTimer);
            this.keepAliveTimer = null;
            console.log('[SoundService] Silent Heartbeat Disabled');
        }
    }
}

export const soundService = new SoundService();
