import crypto from 'node:crypto';
import { getConsultationTenant, routeForSubject } from '../lib/consultation-tenants.js';

const ISO = new Set(['ja','en','zh','ko','vi','id','km','th','my','ne','hi','bn','ur','tl','ms','ru','uk','de','fr','es','pt','it','tr','ar','fa','sw','af','mn','ta','te','mr']);

async function readBody(req) {
  if (req.body && typeof req.body === 'object') return req.body;
  if (typeof req.body === 'string' && req.body.trim()) return JSON.parse(req.body);
  return await new Promise((resolve, reject) => {
    let data = '';
    req.setEncoding('utf8');
    req.on('data', c => data += c);
    req.on('end', () => {
      try { resolve(data ? JSON.parse(data) : {}); } catch (e) { reject(e); }
    });
    req.on('error', reject);
  });
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).send('Method Not Allowed');
  if (!process.env.OPENAI_API_KEY) return res.status(500).send('OPENAI_API_KEY is not configured');

  try {
    const p = await readBody(req);
    const sdp = String(p.sdp || '');
    if (!sdp.trim()) return res.status(400).send('SDP is required');

    const tenant = getConsultationTenant(String(p.tenantKey || 'hiragumi'));
    const consultationId = String(p.consultationId || '').slice(0, 80);
    const languageName = String(p.languageName || '自動判定').slice(0, 120);
    const languageCode = ISO.has(String(p.languageCode || '').toLowerCase()) ? String(p.languageCode).toLowerCase() : '';
    const category = String(p.category || '相談').slice(0, 120);
    const identityMode = p.identityMode === 'named' ? 'named' : 'anonymous';
    const employeeName = identityMode === 'named' ? String(p.employeeName || '').slice(0, 100) : '';
    const affiliation = String(p.affiliation || '').slice(0, 160);
    const initialNote = String(p.initialNote || '').slice(0, 1800);
    const subjectLevel = String(p.subjectLevel || 'unknown').slice(0, 60);
    const initialRoute = routeForSubject(tenant, subjectLevel);

    const languageInstruction = languageCode
      ? `相談者が選択した言語は「${languageName}」です。原則その言語で会話し、本人が別言語へ切り替えた場合はその言語へ合わせてください。`
      : `相談者が希望する言語は「${languageName}」です。最初の発話から実際の言語を判断し、その言語で会話を続けてください。`;

    const instructions = `
あなたは株式会社Rac solutionが運用する「${tenant.serviceName}」のAI聞き取り担当です。
対象会社は「${tenant.companyName}」です。
会社背景: ${tenant.businessContext}
相談ID: ${consultationId}
相談分類: ${category}
相談対象の区分: ${subjectLevel}
相談方法: ${identityMode === 'anonymous' ? '匿名。氏名を聞かない。' : `記名。氏名は「${employeeName}」。`}
所属・現場等: ${affiliation || '未入力'}
事前メモ: ${initialNote || 'なし'}
想定共有先: ${initialRoute}

${languageInstruction}

目的は、会社の相談担当者が安全かつ公平に初動判断できるよう、相談者の申告、本人への影響、希望対応、共有範囲を中立に確認することです。

必須原則:
- 一度に質問は必ず1つだけ。
- 原則6〜10問程度。必要な情報が揃えば早く終えてよい。
- 既に答えた内容を繰り返さない。
- 本人が終了を希望したら終了する。
- 「会社側で確認済みの事実」と「相談者がそう述べている内容」を混同しない。
- パワハラ、違法、犯罪、懲戒対象等と断定しない。
- 法的判断、医療診断、懲戒判断をしない。
- 声質、アクセント、日本語の流暢さから信用性・性格・能力を評価しない。
- 匿名相談では氏名を聞かない。
- 不要なセンシティブ情報を聞かない。
- 相談対象者本人へ内容を共有すると約束しない。逆に「絶対に誰にも伝わらない」とも約束しない。
- 会社の安全確保や法令対応等で共有が必要になる可能性があることを前提に、本人の共有希望を確認する。

平組で特に確認する観点:
- 現場・班・職長・上司との関係
- 具体的な発言・行動、いつ・どこで・何回程度か
- 作業指示や報連相が伝わっているか
- 外国人社員の場合、言語や説明不足が原因になっていないか
- 安全上の危険、無理な作業、保護具、作業手順
- 給与、残業、休日、手当の認識差
- 配置、評価、役割、教育の問題
- 退職意向がある場合、何が解消すれば継続可能か
- 本人が会社に何をしてほしいか
- 誰まで共有してよいか、共有してほしくない相手がいるか

緊急対応:
生命・身体に差し迫った危険、暴力、重大事故、自傷他害の差し迫りがある場合は長い聞き取りを続けず、安全な場所への移動と地域の緊急窓口、会社の安全担当、信頼できる人への連絡を優先するよう伝える。

終了前:
1. 相談者の言語で、AIが理解した内容を短く要約する。
2. 訂正点がないか確認する。
3. 会社に希望する対応を確認する。
4. 誰まで共有してよいか、共有してほしくない相手がいるかを確認する。
5. 相談IDを案内する。

開始時は短く挨拶し、「今日はどのようなことで相談したいですか」に相当する質問を1つだけしてください。
`;

    const transcription = {
      model: 'gpt-4o-mini-transcribe',
      prompt: `${tenant.companyName}の社内相談。建設現場、職長、班、上司、人間関係、安全、給与、残業、休日、配置、評価、退職意向、外国人社員の言語・作業指示等について話す可能性がある。希望言語: ${languageName}`
    };
    if (languageCode) transcription.language = languageCode;

    const sessionConfig = JSON.stringify({
      type: 'realtime',
      model: 'gpt-realtime-2.1',
      output_modalities: ['audio'],
      instructions,
      audio: {
        input: {
          transcription,
          turn_detection: {
            type: 'server_vad',
            threshold: 0.30,
            prefix_padding_ms: 500,
            silence_duration_ms: 700,
            create_response: true,
            interrupt_response: true
          },
          noise_reduction: { type: 'far_field' }
        },
        output: { voice: 'marin' }
      }
    });

    const fd = new FormData();
    fd.set('sdp', sdp);
    fd.set('session', new Blob([sessionConfig], { type: 'application/json' }));

    const safetyId = crypto.createHash('sha256')
      .update(`${tenant.key}:counsel:${consultationId || 'anonymous'}`)
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
    if (!r.ok) {
      console.error('OpenAI Realtime create call failed', r.status, text.slice(0, 1200));
      return res.status(r.status).send(text);
    }
    res.setHeader('Content-Type', 'application/sdp');
    res.setHeader('Cache-Control', 'no-store');
    return res.status(200).send(text);
  } catch (e) {
    console.error(e);
    return res.status(500).send('Failed to create consultation session');
  }
}
