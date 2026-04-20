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
    preferPreGeneratedAudio: false,
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
        const hash = this.hashText(text);
        const base = this.cfg.preGeneratedAudioBasePath.replace(/\/+$/, '');
        const url = `${base}/${hash}.mp3`;
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

    private speakWithWebSpeech(text: string): Promise<void> {
        return new Promise((resolve) => {
            try {
                if (window.speechSynthesis.speaking) {
                    console.log('[VoiceNotifier] speechSynthesis is currently speaking, canceling existing speech...');
                    window.speechSynthesis.cancel();
                }

                const utterance = new SpeechSynthesisUtterance(this.normalizeSpeechText(text));
                utterance.lang = this.cfg.lang;
                utterance.rate = 1;
                utterance.pitch = 1;
                utterance.volume = 1;
                
                utterance.onstart = () => console.log('[VoiceNotifier] Web Speech started speaking');
                utterance.onend = () => {
                    console.log('[VoiceNotifier] Web Speech finished speaking');
                    resolve();
                };
                utterance.onerror = (event) => {
                    console.error('[VoiceNotifier] Web Speech error:', event);
                    resolve();
                };
                
                window.speechSynthesis.speak(utterance);
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
