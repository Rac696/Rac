import { getJob } from '../lib/jobs.js';

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method Not Allowed' });
  if (!process.env.OPENAI_API_KEY) return res.status(500).json({ error: 'OPENAI_API_KEY is not configured' });

  try {
    const transcript = Array.isArray(req.body?.transcript) ? req.body.transcript : [];
    const candidateName = String(req.body?.candidateName || '').slice(0, 80);
    const jobKey = String(req.body?.jobKey || 'nanshu_worker');
    const job = getJob(jobKey);
    const plan = req.body?.plan && typeof req.body.plan === 'object' ? req.body.plan : null;

    const compact = transcript.slice(-80).map(x => `${x.role === 'candidate' ? '応募者' : 'AI面接官'}: ${String(x.text || '').slice(0, 2200)}`).join('\n');
    const pre = plan ? JSON.stringify({
      candidate_brief: plan.candidate_brief || '',
      document_facts: plan.document_facts || [],
      inconsistencies_or_gaps: plan.inconsistencies_or_gaps || [],
      assessment_hypotheses_to_verify: plan.assessment_hypotheses_to_verify || [],
      must_confirm: plan.must_confirm || []
    }).slice(0, 12000) : '事前資料なし';

    const schema = {
      type: 'object',
      additionalProperties: false,
      properties: {
        summary: { type: 'string' },
        confirmed_facts: { type: 'array', items: { type: 'string' } },
        document_interview_differences: { type: 'array', items: { type: 'string' } },
        unresolved_points: { type: 'array', items: { type: 'string' } },
        follow_up_questions: { type: 'array', items: { type: 'string' } },
        conditions_mentioned: { type: 'array', items: { type: 'string' } },
        assessment_hypotheses_checked: { type: 'array', items: { type: 'string' } }
      },
      required: [
        'summary','confirmed_facts','document_interview_differences','unresolved_points',
        'follow_up_questions','conditions_mentioned','assessment_hypotheses_checked'
      ]
    };

    const body = {
      model: 'gpt-5.6-luna',
      input: [
        {
          role: 'system',
          content: [{ type: 'input_text', text: `あなたはRac solutionの採用面接記録整理アシスタントです。
対象企業: ${job.company}
職種: ${job.position}
職種背景: ${job.roleContext}
主な確認軸: ${job.coreFocus.join('、')}
応募者名: ${candidateName || '未入力'}

事前資料とAI一次面接を照合し、人間面接で使える形に整理してください。
採用・不採用、推薦、ランキング、点数、人物の優劣、適性判定は行わないでください。
事実と未確認事項を分け、本人の人格を断定しないでください。
書類と面接回答に差異がある場合は断定せず「差異・追加確認事項」として記載してください。
適性診断は仮説としてのみ扱い、面接で具体例が確認できたかどうかを整理してください。
声質・話し方・アクセント・外見等は評価材料にしません。
職務上不要なセンシティブ情報は整理対象から除外してください。` }]
        },
        {
          role: 'user',
          content: [{ type: 'input_text', text: `【事前資料から作成した面接計画】\n${pre}\n\n【AI一次面接記録】\n${compact}` }]
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
      max_output_tokens: 2200
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
