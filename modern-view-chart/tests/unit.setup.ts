// Unit tests must not call browser-relative API routes or external notifiers.
// Individual tests can still replace fetch when they need a specific response.
import { voiceNotifier } from '../src/features/notifications/voice';

globalThis.fetch = async () => new Response(JSON.stringify({}), {
    status: 200,
    headers: { 'content-type': 'application/json' },
});

voiceNotifier.setEnabled = () => {};
voiceNotifier.setPreferPreGeneratedAudio = () => {};
voiceNotifier.notify = () => {};
