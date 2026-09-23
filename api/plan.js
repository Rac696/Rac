import { getJob } from '../lib/jobs.js';

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method Not Allowed' });
  if (!process.env.OPENAI_API_KEY) return res.status(500).json({ error: 'OPENAI_API_KEY is not configured' });

  try {
    const jobKey = String(req.body?.jobKey || 'nanshu_worker');
    const job = getJob(jobKey);
    const candidateName = String(req.body?.candidateName || '').slice(0, 80);
    const resume = String(req.body?.resume || '').slice(0, 9000);
    const career = String(req.body?.career || '').slice(0, 12000);
    const assessment = String(req.body?.assessment || '').slice(0, 9000);
    const applicationMessage = String(req.body?.applicationMessage || '').slice(0, 5000);

    const schema = {
      type: 'object',
      additionalProperties: false,
      properties: {
        candidate_brief: { type: 'string' },
        document_facts: { type: 'array', items: { type: 'string' } },
        inconsistencies_or_gaps: { type: 'array', items: { type: 'string' } },
        assessment_hypotheses_to_verify: { type: 'array', items: { type: 'string' } },
        must_confirm: { type: 'array', items: { type: 'string' } },
        tailored_questions: { type: 'array', items: { type: 'string' } },
        excluded_sensitive_info: { type: 'array', items: { type: 'string' } }
      },
      required: [
        'candidate_brief','document_facts','inconsistencies_or_gaps','assessment_hypotheses_to_verify',
        'must_confirm','tailored_questions','excluded_sensitive_info'
      ]
    };

    const system = `あなたは株式会社Rac solutionの採用面接設計アシスタントです。
会社・求人・応募者資料をもとに、人間の採用担当者が後で確認しやすいAI一次面接の質問設計を作ってください。

重要な制約:
- 採用・不採用、推薦、ランキング、点数、人物の優劣、適性の断定はしない。
- 履歴書・職務経歴書の事実と、適性診断から生じる仮説を明確に分ける。
- 適性診断は「仮説→面接で確認」にのみ使う。診断結果だけで性格や職務適性を決めない。
- 年齢、性別、家族構成、妊娠、宗教、思想信条、病歴等の職務上不要なセンシティブ情報は質問設計に使わない。
- 外見、声、アクセント、話し方を評価材料にしない。
- 経歴の空白や転職理由等は、責める表現ではなく事実確認の質問にする。
- tailored_questions は一度に1問ずつ聞ける自然な日本語で、8〜12問程度。資料ですでに確定している事実を無駄に聞き直さない。
- 書類上の矛盾・曖昧さ・不足情報があれば、面接で確認する質問に変換する。

対象企業: ${job.company}
職種: ${job.position}
職種背景: ${job.roleContext}
会社・求人で主に確認する軸: ${job.coreFocus.join('、')}
応募者名: ${candidateName || '未入力'}`;

    const user = `以下の事前資料を整理し、この応募者専用のAI一次面接設計を作ってください。

【履歴書等の要約】
${resume || '未入力'}

【職務経歴書等の要約】
${career || '未入力'}

【適性診断結果】
${assessment || '未入力'}

【応募時メッセージ・本人コメント】
${applicationMessage || '未入力'}
`;

    const body = {
      model: 'gpt-5.6-luna',
      input: [
        { role: 'system', content: [{ type: 'input_text', text: system }] },
        { role: 'user', content: [{ type: 'input_text', text: user }] }
      ],
      text: {
        format: {
          type: 'json_schema',
          name: 'interview_plan',
          strict: true,
          schema
        }
      },
      max_output_tokens: 2600
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

    const plan = JSON.parse(output);
    return res.status(200).json({
      jobKey,
      company: job.company,
      position: job.position,
      plan
    });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ error: 'Failed to build interview plan' });
  }
}
