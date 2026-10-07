export const CONSULTATION_TENANTS = {
  hiragumi: {
    key: 'hiragumi',
    companyName: '有限会社 平組',
    shortName: '平組',
    serviceName: '平組 AI社内相談窓口',
    logoUrl: 'https://hiragumi.rac-solution.com/wp-content/uploads/2026/10/平組流ロゴ.png',
    businessContext: '鹿児島県内を中心に足場・仮設工事、土工工事等を行う建設会社。少人数の現場班、職長・リーダー、外国人従業員を含む多様な社員が働く。',
    principles: [
      '相談者の安全と不利益防止を優先する',
      '本人が述べた内容と会社が確認済みの事実を分ける',
      '相談対象者本人へ自動共有しない',
      '必要最小限の担当者だけが内容を扱う',
      '外国語相談は原文の意味を保ち、日本語へ翻訳して管理側へ提示する'
    ],
    subjectOptions: [
      { value: 'unknown', label: '分からない・特定しない' },
      { value: 'coworker', label: '同僚・他の社員' },
      { value: 'leader', label: '職長・班長・リーダー' },
      { value: 'manager', label: '管理職' },
      { value: 'officer', label: '役員' },
      { value: 'vice_president', label: '副社長' },
      { value: 'president', label: '社長' },
      { value: 'company', label: '会社・制度全体' }
    ],
    accessPolicy: '相談内容は役職による一括閲覧ではなく、案件ごとに必要な担当者へ限定して共有する。',
    routingRules: {
      president: 'Rac solution外部人事窓口を優先。社長本人には自動共有しない。',
      vice_president: '社長およびRac solution外部人事へ。副社長本人には自動共有しない。',
      officer: '社長・副社長・Rac solutionのうち相談対象者を除く担当者へ限定共有。',
      manager: '社長・副社長・指定人事担当・Rac solutionのうち必要最小限へ共有。',
      leader: '指定人事担当または経営側担当・Rac solutionへ共有。対象の職長・リーダー本人には自動共有しない。',
      coworker: '指定人事担当または経営側担当・Rac solutionへ共有。相談対象者本人には自動共有しない。',
      company: '社長・副社長・指定人事担当・Rac solutionのうち必要最小限へ共有。',
      unknown: '指定人事担当またはRac solutionで一次確認し、共有先を決める。'
    }
  }
};

export function getConsultationTenant(key = 'hiragumi') {
  return CONSULTATION_TENANTS[key] || CONSULTATION_TENANTS.hiragumi;
}

export function routeForSubject(tenant, subjectLevel = 'unknown') {
  const rules = tenant?.routingRules || {};
  return rules[subjectLevel] || rules.unknown || '指定担当者へ限定共有';
}
