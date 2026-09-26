import fs from 'fs';
import { OAuth2Client } from 'google-auth-library';

const googleClient = new OAuth2Client();
const clientId = "213358192830-iocqi2ppmqqsnkks3rkq854aq6mriict.apps.googleusercontent.com";

const html = fs.readFileSync('C:\\Users\\hatha\\.gemini\\antigravity\\brain\\ef223ffa-259a-44e1-8775-e8c3303b2c69\\scratch\\gsi_transform.html', 'utf8');
const idx = html.indexOf('ZXlKa');
const sub = html.substring(idx);
const end = sub.search(/[^A-Za-z0-9_-]/);
const b64 = end !== -1 ? sub.substring(0, end) : sub;
const decoded = Buffer.from(b64, 'base64').toString('utf8');
const eyMatch = decoded.match(/ey[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}/);
const idToken = eyMatch[0];

console.log('Testing verifyIdToken locally...');
try {
  const ticket = await googleClient.verifyIdToken({
    idToken,
    audience: clientId,
  });
  console.log('SUCCESS! Payload:', ticket.getPayload());
} catch (e) {
  console.error('FAILED with error:', e.message, e.stack);
}
