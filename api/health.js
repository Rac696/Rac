export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ ok: false, error: 'Method Not Allowed' });

  const hasKey = Boolean(process.env.OPENAI_API_KEY);
  return res.status(hasKey ? 200 : 503).json({
    ok: hasKey,
    service: 'Rac AI Interview',
    openai_api_key_configured: hasKey,
    realtime_model: 'gpt-realtime-2.1',
    timestamp: new Date().toISOString()
  });
}
