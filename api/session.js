export const config = { api: { bodyParser: false } };

function readRaw(req) {
  return new Promise((resolve, reject) => {
    let data = '';
    req.setEncoding('utf8');
    req.on('data', chunk => data += chunk);
    req.on('end', () => resolve(data));
    req.on('error', reject);
  });
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).send('Method Not Allowed');
  if (!process.env.OPENAI_API_KEY) return res.status(500).send('OPENAI_API_KEY is not configured');

  try {
    const sdp = await readRaw(req);
    const candidateName = String(req.headers['x-candidate-name'] || '').slice(0, 80);

    const instructions = `
あなたは株式会社Rac solutionが運用するAI一次面接官です。
対象企業は南州建設株式会社、職種は土木作業員です。
応募者名は「${candidateName || '応募者'}」です。

目的は、採用担当者が後の人間面接で確認しやすいように、職務に関係する事実・経験・希望条件・具体例を会話で集めることです。
あなた自身は採用・不採用を判断しません。点数、ランキング、合否、推薦、適性判定を出しません。

会話ルール:
- 日本語の標準語で、落ち着いた自然な面接口調にする。
- 一度に質問は必ず1つだけ。
- 応募者の回答を理解し、曖昧・抽象的・矛盾がある場合は自然に深掘りする。
- 既に答えた内容を繰り返し聞かない。
- 質問数の目安は8〜12問。ただし必要な深掘りを優先する。
- 1回の発話は原則2〜4文以内。長い説明をしない。
- 応募者が質問の意味を尋ねた場合は短く説明し、その後質問に戻る。
- 声質、話し方、アクセント、感情、外見等から性格や能力を推測しない。
- 年齢、性別、家族構成、妊娠、宗教、思想信条、病歴など、職務上不要なセンシティブ情報を採用評価目的で尋ねない。

主に確認する内容:
- 応募理由と仕事内容の理解
- これまでの仕事経験、現場・屋外・体を使う仕事の経験
- 転職・退職の背景（本人が話せる範囲）
- 早朝勤務、屋外作業、暑さ寒さへの認識
- 安全ルール、指示、報告・連絡・相談への考え方と具体例
- チーム作業での経験
- 通勤方法と通勤時間
- 入社可能時期
- 仕事を継続する上で会社に確認したい条件

開始時は簡単に挨拶し、「まず、今回この仕事に応募しようと思った理由を教えてください。」と尋ねる。
必要事項が十分に揃ったら「以上でAI一次面接を終了します。ご回答ありがとうございました。担当者が内容を確認します。」と伝え、それ以上質問しない。
`;

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
            prompt: '日本の建設会社の採用面接。土木作業員、道路、河川、舗装、安全、報連相、通勤、入社時期について話す。',
            keywords: ['南州建設', '土木作業員', '道路', '河川', '舗装', '安全', '報連相']
          },
          turn_detection: { type: 'semantic_vad' }
        },
        output: { voice: 'marin' }
      }
    });

    const fd = new FormData();
    fd.set('sdp', sdp);
    fd.set('session', sessionConfig);

    const r = await fetch('https://api.openai.com/v1/realtime/calls', {
      method: 'POST',
      headers: { Authorization: `Bearer ${process.env.OPENAI_API_KEY}` },
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
