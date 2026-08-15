import axios from 'axios';

const BASE_URL = 'https://prithivmlmods-qwen-image-edit-2509-loras-fast.hf.space/gradio_api';
const API_NAME = 'edit_image';
const WORKER_URL = process.env.QWEN_WORKER_URL || 'http://workers.proxy-1.ryuu-dev.my.id';

// TOKEN POOL - bisa diisi manual atau dari /api/tokens
let TOKEN_POOL = [
  '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'
];
let currentTokenIndex = 0;

function getCurrentToken() {
  return TOKEN_POOL[currentTokenIndex];
}

function rotateToken() {
  currentTokenIndex++;
  if (currentTokenIndex >= TOKEN_POOL.length) {
    currentTokenIndex = 0;
  }
  return getCurrentToken();
}

function addToken(token) {
  if (!TOKEN_POOL.includes(token)) {
    TOKEN_POOL.push(token);
  }
  return TOKEN_POOL.length;
}

function getTokenCount() {
  return TOKEN_POOL.length;
}

function getTokenList() {
  return TOKEN_POOL.map(t => t.slice(0, 8) + '...');
}

class QwenImageEdit {
  constructor(useToken = true) {
    this.useToken = useToken;
    this.axios = axios.create({
      timeout: 120000,
      headers: {
        'Content-Type': 'application/json',
        'Origin': 'https://prithivmlmods-qwen-image-edit-2509-loras-fast.hf.space',
        'Referer': 'https://prithivmlmods-qwen-image-edit-2509-loras-fast.hf.space/',
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/137.0.0.0 Safari/537.36'
      }
    });
  }

  async workerRequest(method, target, data = null, extra = {}) {
    const hfToken = getCurrentToken();
    return await this.axios({
      method,
      url: WORKER_URL,
      params: { url: target },
      data,
      headers: this.useToken && hfToken ? { 'Authorization': `Bearer ${hfToken}` } : {},
      ...extra
    });
  }

  parseSse(text) {
    let output = null;
    for (const line of text.split('\n')) {
      const trimmed = line.trim();
      if (!trimmed.startsWith('data:')) continue;
      const raw = trimmed.slice(5).trim();
      if (!raw || raw === '[DONE]') continue;
      let evt;
      try { evt = JSON.parse(raw); } catch { continue; }
      if (!evt) continue;
      if (Array.isArray(evt)) { output = evt; break; }
      if (evt.msg === 'process_completed') { output = evt.output?.data || null; break; }
      if (evt.msg === 'error' || evt.error) throw new Error(evt.error || 'Error server');
    }
    return output;
  }

  extractImage(output) {
    if (!Array.isArray(output) || output.length === 0) throw new Error('Respons tidak valid');
    const first = output[0];
    if (first?.image) return first.image;
    if (first?.url) return first.url;
    if (typeof first === 'string') return first;
    throw new Error('Struktur respons tidak valid');
  }

  async editImage({ imageBase64, prompt, lora = 'Photo-to-Anime' }) {
    const maxAttempts = Math.max(TOKEN_POOL.length * 3, 6);

    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      try {
        const start = await this.workerRequest('POST', `${BASE_URL}/call/${API_NAME}`, {
          data: [imageBase64, prompt, lora, 0, true, 1, 4]
        });

        if (start.status === 429 || start.data?.error) {
          rotateToken();
          await new Promise(r => setTimeout(r, 3000));
          continue;
        }

        const eventId = start.data?.event_id;
        if (!eventId) throw new Error('Tidak ada event_id');

        const res = await this.workerRequest('GET', `${BASE_URL}/call/${API_NAME}/${eventId}`, null, {
          timeout: 120000,
          responseType: 'text'
        });

        const output = this.parseSse(res.data);
        return this.extractImage(output);
      } catch (err) {
        const msg = (err.message || '').toLowerCase();
        if (msg.includes('limit') || msg.includes('quota') || msg.includes('429') || msg.includes('overloaded') || msg.includes('busy') || msg.includes('error')) {
          rotateToken();
          await new Promise(r => setTimeout(r, 4000));
          continue;
        }
        throw err;
      }
    }

    throw new Error('Semua token kena limit. Silakan tambah token baru di menu Token.');
  }
}

export { QwenImageEdit, addToken, getTokenCount, getTokenList };
