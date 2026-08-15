import { addToken, getTokenCount, getTokenList } from './utils/qwenClient.mjs';

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();

  if (req.method === 'GET') {
    return res.status(200).json({ tokens: getTokenCount(), list: getTokenList() });
  }

  if (req.method === 'POST') {
    const { token } = req.body;
    if (!token || !token.startsWith('hf_')) {
      return res.status(400).json({ error: 'Token tidak valid. Harus diawali hf_' });
    }
    addToken(token);
    return res.status(200).json({ success: true, tokens: getTokenCount() });
  }

  res.status(405).json({ error: 'Method not allowed' });
}
