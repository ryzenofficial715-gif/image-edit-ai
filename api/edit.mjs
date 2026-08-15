import { QwenImageEdit, getTokenCount } from './utils/qwenClient.mjs';

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const { imageBase64, prompt, lora } = req.body;
    if (!imageBase64 || !prompt) return res.status(400).json({ error: 'Image & prompt wajib diisi' });

    const ai = new QwenImageEdit(true);
    const result = await ai.editImage({ imageBase64, prompt, lora: lora || 'Photo-to-Anime' });

    res.status(200).json({ success: true, image: result, tokensUsed: getTokenCount() });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
}