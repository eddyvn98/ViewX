import Express from 'express';
import { ttsService } from '../services/ttsService.js';

const router = Express.Router();

/**
 * GET /api/tts?text=...&lang=...
 * Generates high-quality AI speech for the given text.
 */
router.get('/', async (req, res) => {
    const { text, lang } = req.query;

    if (!text) {
        return res.status(400).json({ error: 'Text parameter is required' });
    }

    try {
        const audioBuffer = await ttsService.generateSpeech(text, lang || 'vi-VN');
        
        res.setHeader('Content-Type', 'audio/mpeg');
        res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
        res.send(audioBuffer);
    } catch (error) {
        console.error('[TTSRouter] Error:', error.message);
        res.status(500).json({ error: 'Failed to generate speech' });
    }
});

export default router;
