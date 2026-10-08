import crypto from 'node:crypto';

async function readBody(req) {
  if (req.body && typeof req.body === 'object') return req.body;
  if (typeof req.body === 'string' && req.body.trim()) return JSON.parse(req.body);
  return await new Promise((resolve, reject) => {
    let data = '';
    req.setEncoding('utf8');
    req.on('data', c => {
      data += c;
      if (data.length > 20000) reject(new Error('Payload too large'));
    });
    req.on('end', () => {
      try { resolve(data ? JSON.parse(data) : {}); } catch (e) { reject(e); }
    });
    req.on('error', reject);
  });
}

function clean(v, max) {
  return String(v ?? '').replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, '').trim().slice(0, max);
}

function makeConsultationId() {
  const d = new Date();
  const date = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Tokyo', year: 'numeric', month: '2-digit', day: '2-digit'
  }).format(d).replaceAll('-', '');
  const random = crypto.randomBytes(4).toString('hex').toUpperCase();
  return `HG-${date}-${random}`;
}

const SUBJECTS = new Set(['unknown','coworker','leader','manager','officer','vice_president','president','company']);

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  if (req.method !== 'POST') return res.status(405).json({ ok: false, error: 'Method Not Allowed' });

  try {
    const p = await readBody(req);
    if (p.website) return res.status(200).json({ ok: true, consultationId: makeConsultationId() });
    if (p.confirmed !== true) return res.status(400).json({ ok: false, error: 'Confirmation is required' });

    const content = clean(p.content, 12000);
    if (!content) return res.status(400).json({ ok: false, error: 'Consultation content is required' });

    const identityMode = p.identityMode === 'named' ? 'named' : 'anonymous';
    const employeeName = identityMode === 'named' ? clean(p.employeeName, 100) : '';
    if (identityMode === 'named' && !employeeName) {
      return res.status(400).json({ ok: false, error: 'Name is required for named consultation' });
    }

    const rawSubject = clean(p.subjectLevel, 40);
    const subjectLevel = SUBJECTS.has(rawSubject) ? rawSubject : 'unknown';
    const consultationId = makeConsultationId();
    const receivedAt = new Date().toISOString();

    const record = {
      consultationId,
      receivedAt,
      identityMode,
      employeeName,
      affiliation: clean(p.affiliation, 160),
      languageName: clean(p.languageName, 120),
      languageCode: clean(p.languageCode, 16),
      subjectLevel,
      shareAvoid: clean(p.shareAvoid, 500),
      content
    };

    const webhookUrl = process.env.HIRAGUMI_CONSULT_WEBHOOK_URL;
    const webhookSecret = process.env.HIRAGUMI_CONSULT_WEBHOOK_SECRET;
    if (!webhookUrl || !webhookSecret) {
      return res.status(503).json({ ok: false, error: 'Consultation storage is not configured' });
    }

    const upstream = await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      redirect: 'follow',
      body: JSON.stringify({ secret: webhookSecret, case: record })
    });

    const text = await upstream.text();
    let result = {};
    try { result = JSON.parse(text); } catch (_) {}

    if (!upstream.ok || result.ok !== true) {
      console.error('Consultation webhook failed', upstream.status, String(result.error || text).slice(0, 500));
      return res.status(502).json({ ok: false, error: 'Failed to save consultation' });
    }

    return res.status(200).json({ ok: true, consultationId });
  } catch (e) {
    console.error('Consultation submit failed', e?.message || e);
    return res.status(500).json({ ok: false, error: 'Failed to submit consultation' });
  }
}
