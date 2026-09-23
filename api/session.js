import crypto from 'node:crypto';
import { getJob } from '../lib/jobs.js';

async function readJsonBody(req) {
  if (req.body && typeof req.body === 'object') return req.body;
  if (typeof req.body === 'string' && req.body.trim()) return JSON.parse(req.body);

  return await new Promise((resolve, reject) => {
    let data = '';
    req.setEncoding('utf8');
    req.on('data', chunk => data += chunk);
    req.on('end', () => {
      try { resolve(data ? JSON.parse(data) : {}); }
      catch (e) { reject(e); }
    });
    req.on('error', reject);
  });
}

function safeArray(value, maxItems = 10, maxLen = 500) {
  return Array.isArray(value)
    ? value.slice(0, maxItems).map(v => String(v || '').slice(0, maxLen)).filter(Boolean)
    : [];
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).send('Method Not Allowed');
  if (!process.env.OPENAI_API_KEY) return res.status(500).send('OPENAI_API_KEY is not configured');

  try {
    const payload = await readJsonBody(req);
    const sdp = String(payload?.sdp || '');
    if (!sdp.trim()) return res.status(400).send('SDP is required');

    const candidateName = String(payload?.candidateName || '').slice(0, 80);
    const jobKey = String(payload?.jobKey || 'nanshu_worker').slice(0, 120);
    const job = getJob(jobKey);
    const plan = payload?.plan && typeof payload.plan === 'object' ? payload.plan : null;

    const candidateBrief = String(plan?.candidate_brief || '').slice(0, 1800);
    const gaps = safeArray(plan?.inconsistencies_or_gaps, 8, 600);
    const hypotheses = safeArray(plan?.assessment_hypotheses_to_verify, 8, 600);
    const mustConfirm = safeArray(plan?.must_confirm, 10, 500);
    const tailored = safeArray(plan?.tailored_questions, 12, 800);

    const preContext = plan ? `
【事前資料からの応募者概要】
${candidateBrief || '特記事項なし'}

【書類の曖昧さ・面接で確認したい差異】
${gaps.length ? gaps.map((x,i)=>`${i+1}. ${x}`).join('\n') : '特になし'}

【適性診断からの確認仮説】
${hypotheses.length ? hypotheses.map((x,i)=>`${i+1}. ${x}`).join('\n') : '特になし'}
※これは仮説であり、診断結果だけで人物や適性を断定してはいけない。本人の具体例で確認すること。

【今回必ず確認したい事項】
${mustConfirm.length ? mustConfirm.map((x,i)=>`${i+1}. ${x}`).join('\n') : job.coreFocus.join('、')}

【応募者専用の初期質問候補】
${tailored.length ? tailored.map((x,i)=>`${i+1}. ${x}`).join('\n') : '事前資料なし。求人の確認軸から質問を組み立てる。'}
` : '事前資料は登録されていません。求人の確認軸から面接を組み立ててください。';

    const instructions = `
あなたは株式会社Rac solutionが運用するAI一次面接官です。
対象企業は「${job.company}」、職種は「${job.position}」です。
応募者名は「${candidateName || '応募者'}」です。

【求人・会社側の前提】
${job.roleContext}
主な確認軸: ${job.coreFocus.join('、')}

${preContext}

目的は、採用担当者が後の人間面接で確認しやすいように、職務に関係する事実・経験・希望条件・具体例を会話で集めることです。
あなた自身は採用・不採用を判断しません。点数、ランキング、合否、推薦、人物の優劣、適性判定を出しません。

会話ルール:
- 日本語の標準語で、落ち着いた自然な面接口調にする。
- 一度に質問は必ず1つだけ。
- 事前資料ですでに確定している事実を無駄に聞き直さない。ただし、経歴の背景や具体例を確認する必要がある場合は深掘りする。
- 応募者専用の初期質問候補を参考にするが、順番は固定しない。直前の回答に応じて最も情報価値が高い質問へ切り替える。
- 応募者の回答が曖昧・抽象的・書類情報と食い違う場合は、責めずに事実確認として自然に深掘りする。
- 既に答えた内容を繰り返し聞かない。
- 質問数の目安は8〜12問。必要な深掘りを優先し、十分な情報が揃えば終了する。
- 1回の発話は原則2〜4文以内。長い説明をしない。
- 応募者が質問の意味を尋ねた場合は短く説明し、その後質問に戻る。
- 声質、話し方、アクセント、感情、外見等から性格や能力を推測しない。
- 年齢、性別、家族構成、妊娠、宗教、思想信条、病歴など、職務上不要なセンシティブ情報を採用目的で尋ねたり判断に使ったりしない。
- 適性診断結果は仮説としてのみ扱い、本人の具体的な経験・行動例で確認する。

開始時は簡単に挨拶し、事前資料がある場合は資料を読んでいることを簡潔に伝えたうえで、応募理由または最も重要な未確認事項から1問だけ尋ねる。
必要事項が十分に揃ったら「以上でAI一次面接を終了します。ご回答ありがとうございました。担当者が内容を確認します。」と伝え、それ以上質問しない。
`;

    const keywords = [job.company, job.position, ...job.coreFocus]
      .map(v => String(v).replace(/[<>\r\n]/g, ' ').slice(0, 80))
      .filter(Boolean)
      .slice(0, 16);

    const sessionConfig = JSON.stringify({
      type: 'realtime',
      model: 'gpt-realtime-2.1',
      output_modalities: ['audio'],
      instructions,
      audio: {
        input: {
          transcription: {
            model: 'gpt-live-transcribe',
            languages: ['ja'],
            delay: 'low',
            prompt: `日本企業の採用面接。会社: ${job.company}。職種: ${job.position}。職務経験、安全、報連相、通勤、入社時期等について話す。`,
            keywords
          },
          turn_detection: {
            type: 'semantic_vad',
            eagerness: 'low',
            create_response: true,
            interrupt_response: true
          }
        },
        output: { voice: 'marin' }
      }
    });

    const fd = new FormData();
    fd.set('sdp', sdp);
    fd.set('session', sessionConfig);

    const safetyId = crypto
      .createHash('sha256')
      .update(`${jobKey}:${candidateName || 'anonymous'}`)
      .digest('hex');

    const r = await fetch('https://api.openai.com/v1/realtime/calls', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
        'OpenAI-Safety-Identifier': safetyId
      },
      body: fd
    });

    const text = await r.text();
    if (!r.ok) return res.status(r.status).send(text);
    res.setHeader('Content-Type', 'application/sdp');
    return res.status(200).send(text);
  } catch (e) {
    console.error(e);
    return res.status(500).send('Failed to create realtime session');
  }
}
