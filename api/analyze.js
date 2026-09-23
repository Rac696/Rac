export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method Not Allowed' });
  if (!process.env.OPENAI_API_KEY) return res.status(500).json({ error: 'OPENAI_API_KEY is not configured' });

  try {
    const transcript = Array.isArray(req.body?.transcript) ? req.body.transcript : [];
    const candidateName = String(req.body?.candidateName || '').slice(0, 80);
    const compact = transcript.slice(-60).map(x => `${x.role === 'candidate' ? '応募者' : 'AI面接官'}: ${String(x.text || '').slice(0, 2000)}`).join('\n');

    const schema = {
      type: 'object',
      additionalProperties: false,
      properties: {
        summary: { type: 'string' },
        confirmed_facts: { type: 'array', items: { type: 'string' } },
        unresolved_points: { type: 'array', items: { type: 'string' } },
        follow_up_questions: { type: 'array', items: { type: 'string' } },
        conditions_mentioned: { type: 'array', items: { type: 'string' } }
      },
      required: ['summary','confirmed_facts','unresolved_points','follow_up_questions','conditions_mentioned']
    };

    const body = {
      model: 'gpt-5.6-luna',
      input: [
        {
          role: 'system',
          content: [{ type: 'input_text', text: `あなたはRac solutionの採用面接記録整理アシスタントです。南州建設株式会社の土木作業員のAI一次面接を、採用担当者が人間面接で使える形に整理してください。採用・不採用、推薦、ランキング、点数、適性判定は行わないでください。事実と未確認事項を分け、本人の人格を断定しないでください。声質・話し方・アクセント等は評価材料にしません。職務上不要なセンシティブ情報は整理対象から除外してください。応募者名: ${candidateName || '未入力'}` }]
        },
        {
          role: 'user',
          content: [{ type: 'input_text', text: `面接記録:\n${compact}` }]
        }
      ],
      text: {
        format: {
          type: 'json_schema',
          name: 'interview_summary',
          strict: true,
          schema
        }
      },
      max_output_tokens: 1800
    };

    const r = await fetch('https://api.openai.com/v1/responses', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(body)
    });

    const data = await r.json();
    if (!r.ok) return res.status(r.status).json({ error: data });

    let output = data.output_text || '';
    if (!output && Array.isArray(data.output)) {
      for (const item of data.output) {
        for (const c of (item.content || [])) {
          if (c.text) { output = c.text; break; }
        }
        if (output) break;
      }
    }

    return res.status(200).json(JSON.parse(output));
  } catch (e) {
    console.error(e);
    return res.status(500).json({ error: 'Failed to analyze interview' });
  }
}
