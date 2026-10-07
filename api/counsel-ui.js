export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method Not Allowed' });
  if (!process.env.OPENAI_API_KEY) return res.status(500).json({ error: 'OPENAI_API_KEY is not configured' });

  try {
    const languageName = String(req.body?.languageName || 'English').slice(0, 120);
    const schema = {
      type: 'object',
      additionalProperties: false,
      properties: {
        title: { type: 'string' },
        subtitle: { type: 'string' },
        identityLabel: { type: 'string' },
        anonymous: { type: 'string' },
        named: { type: 'string' },
        nameLabel: { type: 'string' },
        affiliationLabel: { type: 'string' },
        affiliationPlaceholder: { type: 'string' },
        subjectLabel: { type: 'string' },
        categoryLabel: { type: 'string' },
        memoLabel: { type: 'string' },
        memoPlaceholder: { type: 'string' },
        privacyNote: { type: 'string' },
        consent: { type: 'string' },
        startButton: { type: 'string' },
        liveWaiting: { type: 'string' },
        mute: { type: 'string' },
        resumeMic: { type: 'string' },
        finish: { type: 'string' },
        doneTitle: { type: 'string' }
      },
      required: [
        'title','subtitle','identityLabel','anonymous','named','nameLabel',
        'affiliationLabel','affiliationPlaceholder','subjectLabel','categoryLabel',
        'memoLabel','memoPlaceholder','privacyNote','consent','startButton',
        'liveWaiting','mute','resumeMic','finish','doneTitle'
      ]
    };

    const source = {
      title: '会社の相談窓口',
      subtitle: 'あなたが話しやすい言語で、AI相談員に音声で相談できます。',
      identityLabel: '相談方法',
      anonymous: '匿名で相談する',
      named: '名前を伝えて相談する',
      nameLabel: '氏名',
      affiliationLabel: '所属・現場など（任意）',
      affiliationPlaceholder: '例：足場1班、○○現場',
      subjectLabel: '主に誰・何についての相談ですか',
      categoryLabel: '相談内容',
      memoLabel: '最初に伝えておきたいこと（任意）',
      memoPlaceholder: '短く入力しても、音声だけでも大丈夫です',
      privacyNote: '相談内容は、対応に必要な担当者だけに共有します。相談対象者本人へ自動的に共有することはありません。緊急の安全確保や法令対応等で必要な場合は、最小限の範囲で共有することがあります。',
      consent: '会話を文字起こし・翻訳・要約し、会社の指定された相談担当者とRac solution外部人事が対応のため確認することに同意します。音声そのものは保存しない設計です。',
      startButton: '音声相談を始める',
      liveWaiting: 'AI相談員を接続しています…',
      mute: 'マイクを一時停止',
      resumeMic: 'マイクを再開',
      finish: '相談を終了して内容を確認する',
      doneTitle: '相談内容を受け付けました'
    };

    const body = {
      model: 'gpt-5.6-luna',
      input: [{
        role: 'system',
        content: [{
          type: 'input_text',
          text: `Translate a workplace employee consultation interface into ${languageName}. Use natural, plain language understandable by workers. Preserve meaning exactly, especially privacy and consent wording. Do not add legal promises or guarantees. Return only the required structured fields.`
        }]
      },{
        role: 'user',
        content: [{ type: 'input_text', text: JSON.stringify(source) }]
      }],
      text: {
        format: {
          type: 'json_schema',
          name: 'consultation_ui_translation',
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

    res.setHeader('Cache-Control', 'public, max-age=86400, s-maxage=604800');
    return res.status(200).json(JSON.parse(output));
  } catch (e) {
    console.error(e);
    return res.status(500).json({ error: 'Failed to translate consultation UI' });
  }
}
