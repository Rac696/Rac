import { getConsultationTenant, routeForSubject } from '../lib/consultation-tenants.js';

function serverAccessWarning(level) {
  const map = {
    president: '社長本人には自動表示・自動通知しない。',
    vice_president: '副社長本人には自動表示・自動通知しない。',
    officer: '相談対象となっている役員本人には自動表示・自動通知しない。',
    manager: '相談対象となっている管理職本人には自動表示・自動通知しない。',
    leader: '相談対象となっている職長・班長・リーダー本人には自動表示・自動通知しない。',
    coworker: '相談対象となっている本人には自動表示・自動通知しない。',
    company: '制度・会社全体への相談。案件対応に必要な担当者だけに限定表示する。',
    unknown: '一次確認が終わるまで共有範囲を広げず、Rac solutionまたは指定人事担当で確認する。'
  };
  return map[level] || map.unknown;
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method Not Allowed' });
  if (!process.env.OPENAI_API_KEY) return res.status(500).json({ error: 'OPENAI_API_KEY is not configured' });

  try {
    const p = req.body || {};
    const tenant = getConsultationTenant(String(p.tenantKey || 'hiragumi'));
    const consultationId = String(p.consultationId || '').slice(0, 80);
    const languageName = String(p.languageName || '不明').slice(0, 120);
    const category = String(p.category || '相談').slice(0, 120);
    const identityMode = p.identityMode === 'named' ? '記名' : '匿名';
    const employeeName = identityMode === '記名' ? String(p.employeeName || '').slice(0, 100) : '記録しない';
    const affiliation = String(p.affiliation || '').slice(0, 160);
    const initialNote = String(p.initialNote || '').slice(0, 1800);
    const initialSubjectLevel = String(p.subjectLevel || 'unknown').slice(0, 60);

    const transcript = Array.isArray(p.transcript) ? p.transcript.slice(-80) : [];
    const log = transcript
      .map(x => `${x.role === 'employee' ? '相談者' : 'AI'}: ${String(x.text || '').slice(0, 2200)}`)
      .join('\n');

    const schema = {
      type: 'object',
      additionalProperties: false,
      properties: {
        detected_subject_level: {
          type: 'string',
          enum: ['unknown','coworker','leader','manager','officer','vice_president','president','company']
        },
        summary_ja: { type: 'string' },
        reported_facts_ja: { type: 'array', items: { type: 'string' } },
        perceptions_ja: { type: 'array', items: { type: 'string' } },
        requests_ja: { type: 'array', items: { type: 'string' } },
        disclosure_preferences_ja: { type: 'array', items: { type: 'string' } },
        unresolved_points_ja: { type: 'array', items: { type: 'string' } },
        organizational_points_ja: { type: 'array', items: { type: 'string' } },
        urgency: { type: 'string', enum: ['緊急','高','中','通常'] },
        urgency_reasons_ja: { type: 'array', items: { type: 'string' } },
        recommended_initial_actions_ja: { type: 'array', items: { type: 'string' } },
        policy_or_legal_flags_ja: { type: 'array', items: { type: 'string' } },
        route_context_ja: { type: 'string' },
        access_warning_context_ja: { type: 'string' },
        employee_receipt_text: { type: 'string' },
        translated_transcript_ja: {
          type: 'array',
          items: {
            type: 'object',
            additionalProperties: false,
            properties: {
              role: { type: 'string', enum: ['employee','ai'] },
              text_ja: { type: 'string' }
            },
            required: ['role','text_ja']
          }
        }
      },
      required: [
        'detected_subject_level','summary_ja','reported_facts_ja','perceptions_ja',
        'requests_ja','disclosure_preferences_ja','unresolved_points_ja',
        'organizational_points_ja','urgency','urgency_reasons_ja',
        'recommended_initial_actions_ja','policy_or_legal_flags_ja',
        'route_context_ja','access_warning_context_ja','employee_receipt_text',
        'translated_transcript_ja'
      ]
    };

    const routingMap = Object.entries(tenant.routingRules || {})
      .map(([k,v]) => `${k}: ${v}`)
      .join('\n');

    const system = `
あなたは株式会社Rac solutionの外部人事として「${tenant.serviceName}」の相談記録を整理するアシスタントです。
対象会社: ${tenant.companyName}
会社背景: ${tenant.businessContext}
アクセス方針: ${tenant.accessPolicy}

相談対象区分:
- coworker = 同僚・他の社員
- leader = 職長・班長・リーダー
- manager = 管理職
- officer = 役員
- vice_president = 副社長
- president = 社長
- company = 会社・制度全体
- unknown = 特定できない

平組のサーバー側共有ルール:
${routingMap}

重要:
- 会話から相談対象区分を detected_subject_level に分類する。断定できなければ unknown。
- 相談者が述べた出来事は、会社側で裏付ける前に「客観的に確認済みの事実」と断定しない。
- 人格、信用性、性格、能力を評価しない。
- パワハラ、違法、犯罪、懲戒対象等を断定しない。
- 法令・就業規則・給与計算等の確認が必要なら「制度・法令等の確認候補」とする。
- 誰が悪いかを即断せず、本人、上司、役割、ルール、情報伝達、業務設計、組織構造に切り分ける。
- 外国人社員の相談では、日本語能力そのものを問題視せず、会社側の説明・翻訳・指示方法の問題も確認する。
- 建設現場の安全問題では、現在も危険が続いているか、現場・作業・指示系統を優先して整理する。
- 処分や配置転換を自動決定しない。
- route_context_ja は、本人の共有希望や利害関係を踏まえて、サーバー側ルーティング時に注意すべき事情だけを書く。共有先そのものを自由に決めない。
- access_warning_context_ja は、本人が明示した「この人には見せないでほしい」等の事情を書く。

緊急度:
- 緊急: 現在進行の身体危険、暴力、重大事故、自傷他害の差し迫り。
- 高: 重大な安全問題、報復懸念、深刻な就業継続困難等で当日〜翌営業日の人対応が望ましい。
- 中: 数日以内に人事・経営側の確認が望ましい。
- 通常: 通常の改善・相談対応でよい。
これは法的結論や懲戒判断ではない。

employee_receipt_text:
- 相談者へ返す文章。
- 使用言語「${languageName}」で作る。
- 相談ID「${consultationId}」を含める。
- 受付内容、本人の希望、次に会社側で確認する趣旨を簡潔に書く。
- 会社側の事実確認前に結論が出たような表現をしない。
- 管理者向けの共有先や内部ルーティング詳細は書かない。

translated_transcript_ja:
- 発言単位で日本語へ忠実に翻訳する。
- 推測、評価、補足を加えない。
`;

    const body = {
      model: 'gpt-6-luna',
      input: [
        { role: 'system', content: [{ type: 'input_text', text: system }] },
        {
          role: 'user',
          content: [{
            type: 'input_text',
            text: `相談ID: ${consultationId}
会社: ${tenant.companyName}
分類: ${category}
相談方法: ${identityMode}
氏名: ${employeeName}
所属・現場: ${affiliation || '未入力'}
事前の相談対象区分: ${initialSubjectLevel}
事前メモ: ${initialNote || 'なし'}
使用言語: ${languageName}

会話記録:
${log || 'なし'}`
          }]
        }
      ],
      text: {
        format: {
          type: 'json_schema',
          name: 'hiragumi_consultation_report',
          strict: true,
          schema
        }
      },
      max_output_tokens: 6500
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

    const report = JSON.parse(output);
    const detectedLevel = report.detected_subject_level || 'unknown';

    report.recommended_route_ja = routeForSubject(tenant, detectedLevel);
    report.access_warning_ja = serverAccessWarning(detectedLevel);
    if (report.route_context_ja) report.recommended_route_ja += ` 補足: ${report.route_context_ja}`;
    if (report.access_warning_context_ja) report.access_warning_ja += ` 本人希望等: ${report.access_warning_context_ja}`;

    res.setHeader('Cache-Control', 'no-store');
    return res.status(200).json(report);
  } catch (e) {
    console.error(e);
    return res.status(500).json({ error: 'Failed to analyze consultation' });
  }
}
