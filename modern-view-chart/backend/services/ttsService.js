import axios from 'axios';

/**
 * Service to generate high-quality AI speech.
 * Uses Google Cloud TTS as primary (Neural2) and has fallback logic.
 */
class TTSService {
    constructor() {
        this.apiKey = process.env.GEMINI_API_KEY;
        this.googleApiUrl = 'https://texttospeech.googleapis.com/v1/text:synthesize';
    }

    /**
     * Generates MP3 audio from text.
     */
    async generateSpeech(text, languageCode = 'vi-VN') {
        console.log(`[TTSService] Generating speech for: "${text}" [${languageCode}]`);
        try {
            // Try Google Cloud TTS first if API key is available
            if (this.apiKey && this.apiKey.startsWith('AIzaSy')) {
                console.log('[TTSService] Using Google Cloud TTS...');
                return await this.generateGoogleTTS(text, languageCode);
            }
            
            throw new Error('Valid Google API Key not found');
        } catch (error) {
            console.error('[TTSService] Error:', error.message);
            throw error;
        }
    }

    async generateGoogleTTS(text, languageCode) {
        if (!this.apiKey) throw new Error('No API Key');

        const response = await axios.post(
            `${this.googleApiUrl}?key=${this.apiKey}`,
            {
                input: { text },
                voice: {
                    languageCode,
                    // Neural2-A is a very high quality Vietnamese female voice
                    name: languageCode === 'vi-VN' ? 'vi-VN-Neural2-A' : 'en-US-Neural2-F',
                },
                audioConfig: {
                    audioEncoding: 'MP3',
                },
            }
        );

        if (response.data && response.data.audioContent) {
            return Buffer.from(response.data.audioContent, 'base64');
        }
        throw new Error('No audio content');
    }
}

export const ttsService = new TTSService();
