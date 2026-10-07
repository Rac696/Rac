export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ ok: false, error: 'Method Not Allowed' });
  res.setHeader('Cache-Control', 'no-store');
  if (!process.env.OPENAI_API_KEY) {
    return res.status(500).json({ ok: false, openaiStatus: 0, error: 'OPENAI_API_KEY is not configured' });
  }
  try {
    const r = await fetch('https://api.openai.com/v1/models/gpt-realtime-2.1', {
      headers: { Authorization: `Bearer ${process.env.OPENAI_API_KEY}` }
    });
    if (!r.ok) {
      let message = '';
      try {
        const d = await r.json();
        message = String(d?.error?.message || '');
      } catch (_) {}
      return res.status(502).json({
        ok: false,
        openaiStatus: r.status,
        error: message.slice(0, 240) || 'Realtime model access check failed'
      });
    }
    return res.status(200).json({ ok: true, openaiStatus: 200, model: 'gpt-realtime-2.1' });
  } catch (e) {
    return res.status(502).json({ ok: false, openaiStatus: 0, error: 'OpenAI connection failed' });
  }
}
