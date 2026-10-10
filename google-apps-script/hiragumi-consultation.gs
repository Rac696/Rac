const NORMAL_SHEET_ID = '1bgFGrTLPOK05J438sVWct-aZpvpWqB4sp19jpcYvf4c';
const PRESIDENT_SHEET_ID = '1UYxTNzWeFC9PcNaVLamDIapNKvKE5CX-SDXfQ9igkfI';
const SHEET_NAME = '相談一覧';

function doPost(e) {
  const lock = LockService.getScriptLock();
  lock.waitLock(20000);
  try {
    const payload = JSON.parse(e.postData && e.postData.contents ? e.postData.contents : '{}');
    const props = PropertiesService.getScriptProperties();
    const expectedSecret = props.getProperty('CONSULT_WEBHOOK_SECRET');
    if (!expectedSecret || payload.secret !== expectedSecret) {
      return json_({ ok: false, error: 'Unauthorized' });
    }

    const c = payload.case || {};
    if (!/^HG-\d{8}-[A-F0-9]{8}$/.test(String(c.consultationId || ''))) {
      return json_({ ok: false, error: 'Invalid consultation ID' });
    }
    if (!String(c.content || '').trim()) {
      return json_({ ok: false, error: 'Content is required' });
    }

    const presidentCase = String(c.subjectLevel || '') === 'president';
    const spreadsheetId = presidentCase ? PRESIDENT_SHEET_ID : NORMAL_SHEET_ID;
    const notifyTo = presidentCase
      ? props.getProperty('PRESIDENT_NOTIFY_EMAIL')
      : props.getProperty('NORMAL_NOTIFY_EMAIL');

    const ss = SpreadsheetApp.openById(spreadsheetId);
    const sh = ss.getSheetByName(SHEET_NAME);
    if (!sh) throw new Error('相談一覧 sheet not found');

    const subjectLabel = subjectLabel_(c.subjectLevel);
    const identityLabel = c.identityMode === 'named' ? '記名' : '匿名';
    const received = c.receivedAt ? new Date(c.receivedAt) : new Date();

    sh.appendRow([
      String(c.consultationId || ''),
      received,
      '未確認',
      identityLabel,
      c.identityMode === 'named' ? String(c.employeeName || '') : '',
      String(c.affiliation || ''),
      String(c.languageName || c.languageCode || ''),
      String(c.content || ''),
      '',
      subjectLabel,
      String(c.shareAvoid || ''),
      '',
      '',
      '',
      '',
      '',
      new Date()
    ]);

    const row = sh.getLastRow();
    sh.getRange(row, 2).setNumberFormat('yyyy/mm/dd hh:mm:ss');
    sh.getRange(row, 17).setNumberFormat('yyyy/mm/dd hh:mm:ss');

    const rowUrl = 'https://docs.google.com/spreadsheets/d/' + spreadsheetId +
      '/edit#gid=' + sh.getSheetId() + '&range=A' + row + ':Q' + row;

    if (notifyTo) {
      const subject = presidentCase
        ? '【平組 社内相談窓口】新規相談（社長対象） ' + c.consultationId
        : '【平組 社内相談窓口】新規相談 ' + c.consultationId;
      const body = [
        '新しい相談が届きました。',
        '',
        '相談ID：' + c.consultationId,
        '受付日時：' + Utilities.formatDate(received, 'Asia/Tokyo', 'yyyy/MM/dd HH:mm:ss'),
        '相談対象：' + subjectLabel,
        '',
        '相談本文はメールには記載していません。',
        '管理台帳で確認してください。',
        rowUrl
      ].join('\n');

      MailApp.sendEmail({
        to: notifyTo,
        subject: subject,
        body: body,
        name: '平組 社内相談窓口'
      });
    }

    return json_({ ok: true, consultationId: c.consultationId });
  } catch (err) {
    console.error(err);
    return json_({ ok: false, error: String(err && err.message ? err.message : err) });
  } finally {
    lock.releaseLock();
  }
}

function subjectLabel_(v) {
  const map = {
    unknown: 'わからない・その他',
    coworker: '同僚',
    leader: '職長・リーダー',
    manager: '管理職',
    officer: '役員',
    vice_president: '副社長',
    president: '社長',
    company: '会社・制度全体'
  };
  return map[String(v || '')] || map.unknown;
}

function json_(obj) {
  return ContentService
    .createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}
