export const JOBS = {
  hiragumi_field: {
    company: '有限会社平組',
    position: '現場職（足場・土工・重機等）',
    category: 'construction',
    coreFocus: [
      '早朝勤務への適応', '屋外作業への適応', '少人数チーム', '職長・上司の指示への対応',
      '安全意識', '報告・連絡・相談', '通勤・現場移動', '長期定着', '資格・運転経験'
    ],
    roleContext: '鹿児島の建設・専門工事現場。経験年数だけでなく、安全意識、報連相、職長の指示への適応、少人数班での継続勤務を重視する。'
  },
  nanshu_worker: {
    company: '南州建設株式会社',
    position: '土木作業員',
    category: 'construction',
    coreFocus: [
      '応募理由', '屋外・現場作業経験', '早朝勤務', '暑さ寒さへの認識', '安全意識',
      '報告・連絡・相談', 'チーム作業', '通勤', '入社可能時期', '長期継続条件'
    ],
    roleContext: '道路・河川・舗装・下水等の土木現場。未経験でも、現場で安全に継続して働けるかを具体例で確認する。'
  },
  nanshu_manager: {
    company: '南州建設株式会社',
    position: '土木施工管理',
    category: 'construction_manager',
    coreFocus: [
      '保有資格', '施工管理経験', '担当工事', '工程管理', '安全管理', '品質管理',
      '協力会社調整', 'トラブル対応', '報連相', '転職理由', '入社可能時期'
    ],
    roleContext: '道路・河川・舗装等の施工管理。1級または2級土木施工管理技士を含め、資格と実務の両方を確認する。'
  },
  sogokenki_sales: {
    company: '総合建機株式会社',
    position: '法人ルート営業',
    category: 'sales',
    coreFocus: [
      '応募理由', '営業経験', '顧客関係構築', '自己管理', '出張対応', '運転',
      '目標管理', '失敗時の対応', '学習姿勢', 'スケジュール管理', '長期定着'
    ],
    roleContext: '建機・資材の専門商社。全国出張を伴う法人ルート営業。未経験者は学習姿勢・自己管理・顧客対応を重視する。'
  },
  sat_sales: {
    company: '株式会社SAT',
    position: '個人向け通信営業',
    category: 'sales',
    coreFocus: [
      '応募理由', '営業経験', '目標意識', '行動量', '断られた後の切替', '自己管理',
      '報連相', '成果報酬への理解', '勤務条件', '継続性'
    ],
    roleContext: '個人向け通信回線提案営業。成果型営業への適応、行動量、自己管理、継続性を具体例で確認する。'
  },
  airadensetsu_field: {
    company: '姶良電設',
    position: '電気工事・現場職',
    category: 'electrical_construction',
    coreFocus: [
      '応募理由', '電気・通信・空調経験', '資格', '安全意識', '工具・現場経験',
      '報連相', '未経験の場合の学習姿勢', '通勤', '入社可能時期', '長期定着'
    ],
    roleContext: '電気工事・通信・空調等の現場職。資格・経験に加え、安全意識、学習姿勢、現場適応を確認する。'
  }
};

export function getJob(jobKey) {
  return JOBS[jobKey] || JOBS.nanshu_worker;
}

export function publicJobs() {
  return Object.entries(JOBS).map(([key, j]) => ({
    key,
    company: j.company,
    position: j.position,
    category: j.category
  }));
}
