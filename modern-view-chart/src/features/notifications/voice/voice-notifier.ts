export type AlertVoicePayload = {
    symbol: string;
    price: number;
    direction?: 'bullish' | 'bearish';
    message?: string;
};

export type VoiceNotifierConfig = {
    lang: string;
    enabled: boolean;
    cooldownMs: number;
    preferPreGeneratedAudio: boolean;
    preGeneratedAudioBasePath: string;
};

const DEFAULT_CONFIG: VoiceNotifierConfig = {
    lang: 'vi-VN',
    enabled: true,
    cooldownMs: 3000,
    preferPreGeneratedAudio: true,
    preGeneratedAudioBasePath: '/audio/alerts',
};

/**
 * Voice notifier for runtime trading alerts.
 * - Queue playback to avoid overlap.
 * - Per-alert cooldown to avoid repeated speech spam on fast ticks.
 * - Prefer server-provided message, fallback to Vietnamese template.
 */
export class VoiceNotifier {
    private cfg: VoiceNotifierConfig;
    private lastSpeakAt = new Map<string, number>();
    private queue: string[] = [];
    private speaking = false;
    private audioUrlCache = new Map<string, string | null>();
    private staticAudioMap: Record<string, string> = {};
    private unlocked = false;
    private audioContext: AudioContext | null = null;

    constructor(config?: Partial<VoiceNotifierConfig>) {
        this.cfg = { ...DEFAULT_CONFIG, ...(config || {}) };
        console.log('[VoiceNotifier] Initialized', this.cfg);
    }

    setEnabled(enabled: boolean) {
        this.cfg.enabled = enabled;
        console.log('[VoiceNotifier] Enabled set to:', enabled);
    }

    setPreferPreGeneratedAudio(enabled: boolean) {
        this.cfg.preferPreGeneratedAudio = enabled;
        console.log('[VoiceNotifier] PreferPreGeneratedAudio set to:', enabled);
    }

    warmAudioCache(items: Array<{ text: string; url: string }>) {
        items.forEach((item) => {
            const text = String(item.text || '').trim();
            const url = String(item.url || '').trim();
            if (!text || !url) return;
            this.staticAudioMap[text] = url;
            this.audioUrlCache.set(text, url);
        });
    }

    private async ensureVoicesLoaded(): Promise<void> {
        if (typeof window === 'undefined' || !('speechSynthesis' in window)) return;
        if (window.speechSynthesis.getVoices().length > 0) return;

        return new Promise((resolve) => {
            const handler = () => {
                window.speechSynthesis.removeEventListener('voiceschanged', handler);
                resolve();
            };
            window.speechSynthesis.addEventListener('voiceschanged', handler);
            // Timeout as fallback
            setTimeout(resolve, 1000);
        });
    }

    /**
     * Mobile browsers block audio/speech until a user interaction occurs.
     * Call this inside a click handler to "unlock" audio playback for the session.
     */
    /**
     * Synchronous part of the unlock. 
     * MUST be called directly in the event handler (before any await).
     */
    syncUnlock(): void {
        if (typeof window === 'undefined') return;
        console.log('[VoiceNotifier] Sync unlocking audio system...');
        
        try {
            // 1. Kickstart Speech Synthesis synchronously
            if ('speechSynthesis' in window) {
                window.speechSynthesis.cancel();
                // A single space is often enough to unlock without being heard
                const utterance = new SpeechSynthesisUtterance(' ');
                utterance.volume = 0.01; // Tiny volume
                window.speechSynthesis.speak(utterance);
                
                if (window.speechSynthesis.paused) {
                    window.speechSynthesis.resume();
                }
            }

            // 2. Initialize AudioContext if not exists
            const AudioContextClass = (window as any).AudioContext || (window as any).webkitAudioContext;
            if (AudioContextClass && !this.audioContext) {
                this.audioContext = new AudioContextClass();
                // We can't await resume here, but creating it helps
            }
        } catch (err) {
            console.warn('[VoiceNotifier] Sync unlock failed:', err);
        }
    }

    async unlock(): Promise<void> {
        if (this.unlocked) return;
        
        // Ensure sync part is called (even if already called by UI)
        this.syncUnlock();

        try {
            // Async part: resume context
            if (this.audioContext && this.audioContext.state === 'suspended') {
                await this.audioContext.resume();
            }

            this.unlocked = true;
            this.playUnlockBeep();
            console.log('[VoiceNotifier] Audio system fully unlocked');
        } catch (err) {
            console.error('[VoiceNotifier] Async unlock failed:', err);
        }
    }

    private playUnlockBeep() {
        if (!this.audioContext) return;
        try {
            const osc = this.audioContext.createOscillator();
            const gain = this.audioContext.createGain();
            osc.connect(gain);
            gain.connect(this.audioContext.destination);
            gain.gain.setValueAtTime(0.01, this.audioContext.currentTime);
            gain.gain.exponentialRampToValueAtTime(0.0001, this.audioContext.currentTime + 0.1);
            osc.start();
            osc.stop(this.audioContext.currentTime + 0.1);
        } catch (e) {}
    }

    notify(payload: AlertVoicePayload): void {
        console.log('[VoiceNotifier] notify() called with payload:', payload);
        if (!this.cfg.enabled) {
            console.warn('[VoiceNotifier] notify ignored: Voice alerts disabled in config');
            return;
        }
        if (typeof window === 'undefined' || !('speechSynthesis' in window)) {
            console.error('[VoiceNotifier] notify failed: speechSynthesis not available in window');
            return;
        }

        const text = this.buildVietnameseText(payload);
        if (!text) {
            console.warn('[VoiceNotifier] notify ignored: No text generated from payload');
            return;
        }

        const key = `${payload.symbol}:${payload.price}:${payload.direction || 'na'}`;
        const now = Date.now();
        const last = this.lastSpeakAt.get(key) || 0;
        if (now - last < this.cfg.cooldownMs) {
            console.log('[VoiceNotifier] notify ignored: Cooldown active for', key);
            return;
        }
        this.lastSpeakAt.set(key, now);

        console.log('[VoiceNotifier] Adding to queue:', text);
        this.queue.push(text);
        if (!this.speaking) {
            void this.drain();
        }
    }

    private buildVietnameseText(payload: AlertVoicePayload): string {
        if (payload.message && payload.message.trim().length > 0) {
            return payload.message.trim();
        }

        const symbol = String(payload.symbol || '').trim();
        if (!symbol) return '';

        const price = Number(payload.price);
        const normalizedPrice = Number.isFinite(price) ? price : payload.price;

        const directionText =
            payload.direction === 'bullish'
                ? '\u0111\u00e3 c\u1eaft l\u00ean'
                : payload.direction === 'bearish'
                    ? '\u0111\u00e3 c\u1eaft xu\u1ed1ng'
                    : '\u0111\u00e3 ch\u1ea1m m\u1ee9c';

        return `C\u1ea3nh b\u00e1o. ${symbol} ${directionText} t\u1ea1i m\u1ee9c ${normalizedPrice}.`;
    }

    private async drain(): Promise<void> {
        this.speaking = true;
        console.log('[VoiceNotifier] drain() starting queue processing...');
        try {
            while (this.queue.length > 0) {
                const text = this.queue.shift();
                if (!text) continue;
                console.log('[VoiceNotifier] Processing item:', text);
                const playedAudio = await this.tryPlayPreGeneratedAudio(text);
                if (!playedAudio) {
                    console.log('[VoiceNotifier] Falling back to Web Speech API for:', text);
                    await this.speakWithWebSpeech(text);
                }
            }
        } catch (err) {
            console.error('[VoiceNotifier] drain() error:', err);
        } finally {
            console.log('[VoiceNotifier] drain() completed');
            this.speaking = false;
        }
    }

    private async tryPlayPreGeneratedAudio(text: string): Promise<boolean> {
        if (!this.cfg.preferPreGeneratedAudio) return false;
        const url = this.resolveAudioUrl(text);
        if (!url) return false;
        console.log('[VoiceNotifier] Attempting to play pre-generated audio:', url);
        const success = await this.playAudioUrl(url);
        if (!success) {
            console.warn('[VoiceNotifier] Failed to play pre-generated audio for:', text);
            this.audioUrlCache.set(text, null);
        } else {
            console.log('[VoiceNotifier] Successfully played pre-generated audio');
        }
        return success;
    }

    private resolveAudioUrl(text: string): string | null {
        if (Object.prototype.hasOwnProperty.call(this.staticAudioMap, text)) {
            return this.staticAudioMap[text];
        }
        if (this.audioUrlCache.has(text)) {
            return this.audioUrlCache.get(text) || null;
        }
        
        // Use our new high-quality AI TTS API
        const url = `/api/tts?text=${encodeURIComponent(text)}&lang=${this.cfg.lang}`;
        this.audioUrlCache.set(text, url);
        return url;
    }

    private playAudioUrl(url: string): Promise<boolean> {
        return new Promise((resolve) => {
            try {
                const audio = new Audio(url);
                let settled = false;
                const done = (value: boolean) => {
                    if (settled) return;
                    settled = true;
                    resolve(value);
                };
                const timer = window.setTimeout(() => done(false), 4000);
                audio.onended = () => {
                    window.clearTimeout(timer);
                    done(true);
                };
                audio.onerror = () => {
                    window.clearTimeout(timer);
                    done(false);
                };
                audio.oncanplaythrough = () => {
                    void audio.play().catch(() => {
                        window.clearTimeout(timer);
                        done(false);
                    });
                };
                audio.load();
            } catch (err) {
                console.error('[VoiceNotifier] playAudioUrl error:', err);
                resolve(false);
            }
        });
    }

    private async speakWithWebSpeech(text: string): Promise<void> {
        await this.ensureVoicesLoaded();

        return new Promise((resolve) => {
            try {
                if (typeof window === 'undefined' || !('speechSynthesis' in window)) {
                    return resolve();
                }

                if (window.speechSynthesis.speaking) {
                    console.log('[VoiceNotifier] speechSynthesis is currently speaking, canceling existing speech...');
                    window.speechSynthesis.cancel();
                }

                const utterance = new SpeechSynthesisUtterance(this.normalizeSpeechText(text));
                
                // Try to find a Vietnamese voice specifically
                const voices = window.speechSynthesis.getVoices();
                const viVoice = voices.find(v => v.lang.toLowerCase().replace('-', '_').startsWith('vi_') || v.lang.toLowerCase().startsWith('vi-'));
                
                if (viVoice) {
                    utterance.voice = viVoice;
                    console.log('[VoiceNotifier] Found Vietnamese voice:', viVoice.name, viVoice.lang);
                } else {
                    console.warn('[VoiceNotifier] No Vietnamese voice found, using default. Available:', voices.map(v => v.lang));
                }

                utterance.lang = viVoice ? viVoice.lang : 'vi-VN';
                utterance.rate = 1.0;
                utterance.pitch = 1.0;
                utterance.volume = 1.0;
                
                utterance.onstart = () => console.log('[VoiceNotifier] Web Speech started speaking');
                utterance.onend = () => {
                    console.log('[VoiceNotifier] Web Speech finished speaking');
                    resolve();
                };
                utterance.onerror = (event) => {
                    console.error('[VoiceNotifier] Web Speech error:', event);
                    resolve();
                };
                
                // Final kick for Android/Chrome
                window.speechSynthesis.resume();
                window.speechSynthesis.speak(utterance);

                // iOS/Android Bug workaround: if speech doesn't start, resume synthesis again
                if (window.speechSynthesis.paused || !window.speechSynthesis.speaking) {
                    window.speechSynthesis.resume();
                }
            } catch (err) {
                console.error('[VoiceNotifier] speakWithWebSpeech catch error:', err);
                resolve();
            }
        });
    }

    private normalizeSpeechText(text: string): string {
        return text
            .replace(/[\u{1F300}-\u{1FAFF}]/gu, '')
            .replace(/\s+/g, ' ')
            .trim();
    }

    private hashText(input: string): string {
        let hash = 2166136261;
        for (let i = 0; i < input.length; i += 1) {
            hash ^= input.charCodeAt(i);
            hash += (hash << 1) + (hash << 4) + (hash << 7) + (hash << 8) + (hash << 24);
        }
        return (hash >>> 0).toString(16);
    }
}
