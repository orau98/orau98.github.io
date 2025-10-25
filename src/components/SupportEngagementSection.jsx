import React, { useState } from 'react';

const SUPPORT_PLANS = [
  { value: '1000', label: 'ライトプラン', description: '幼虫観察会の運営サポート', amount: '¥1,000 / 月' },
  { value: '3000', label: 'スタンダードプラン', description: 'モニタリング機材の更新費', amount: '¥3,000 / 月' },
  { value: '7000', label: 'プレミアムプラン', description: '広葉樹苗の植栽支援', amount: '¥7,000 / 月' },
  { value: 'custom', label: 'カスタムプラン', description: '自分に合った金額で応援', amount: '任意の金額' }
];

const SPONSORS = [
  {
    name: 'GreenPulse テクノロジーズ',
    note: 'ドローン解析で生息域の植生を高頻度モニタリング',
    icon: (
      <svg viewBox="0 0 48 48" xmlns="http://www.w3.org/2000/svg" className="w-9 h-9 text-emerald-700">
        <rect x="6" y="6" width="36" height="36" rx="10" className="fill-emerald-200" />
        <path d="M14 26c6-10 14-10 20 0-6 6-10 8-14 8s-8-2-6-8z" className="fill-emerald-500" />
        <circle cx="24" cy="20" r="4" className="fill-emerald-900" />
      </svg>
    )
  },
  {
    name: 'LeafWorks ホールディングス',
    note: '苗木供給とCSR寄付プログラムで植栽をバックアップ',
    icon: (
      <svg viewBox="0 0 48 48" xmlns="http://www.w3.org/2000/svg" className="w-9 h-9 text-lime-600">
        <circle cx="24" cy="24" r="18" className="fill-lime-100" />
        <path d="M16 30c6-8 12-10 20-8-4 8-10 12-18 12z" className="fill-lime-400" />
        <path d="M18 22c4-4 8-6 12-4-2 4-6 6-12 6z" className="fill-emerald-700" />
      </svg>
    )
  },
  {
    name: 'ForestLink バンク',
    note: '寄付決済と成果連動型資金プランを共同開発',
    icon: (
      <svg viewBox="0 0 48 48" xmlns="http://www.w3.org/2000/svg" className="w-9 h-9 text-emerald-800">
        <rect x="5" y="8" width="38" height="32" rx="8" className="fill-emerald-400" />
        <path d="M15 20h18l-3 12h-12l-3-12z" className="fill-emerald-900/70" />
        <path d="M18 18c0-4 3-7 6-7s6 3 6 7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" fill="none" />
      </svg>
    )
  }
];

const SupportEngagementSection = ({ speciesName }) => {
  const [panelOpen, setPanelOpen] = useState(false);
  const [selectedPlan, setSelectedPlan] = useState('1000');
  const [customAmount, setCustomAmount] = useState('');
  const [submitted, setSubmitted] = useState(false);

  const handleTogglePanel = () => {
    setPanelOpen(prev => {
      const next = !prev;
      if (next) {
        setSubmitted(false);
      }
      return next;
    });
  };

  const handlePlanChange = (event) => {
    setSelectedPlan(event.target.value);
    if (event.target.value !== 'custom') {
      setCustomAmount('');
    }
  };

  const handleSubmit = (event) => {
    event.preventDefault();
    setSubmitted(true);
  };

  const handleClosePanel = () => {
    setPanelOpen(false);
  };

  return (
    <section className="bg-white/80 dark:bg-slate-800/70 backdrop-blur rounded-2xl shadow-xl border border-white/40 dark:border-slate-700/60 p-6 space-y-6">
      <div>
        <span className="inline-flex items-center px-3 py-1 rounded-full bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300 text-xs font-semibold tracking-wide">
          推し活 ✕ 保全（テスト）
        </span>
        <h3 className="mt-3 text-xl font-bold text-slate-800 dark:text-slate-100">
          {speciesName} を応援する保全モデル
        </h3>
        <p className="mt-2 text-sm text-slate-600 dark:text-slate-300 leading-relaxed">
          図鑑で得た知識をそのまま応援アクションに変換できるテスト機能です。保全団体の活動を可視化し、推し活感覚で寄付・参加ができる導線を検証しています。
        </p>
      </div>

      <div className="rounded-2xl border border-emerald-200/60 dark:border-emerald-800/40 bg-emerald-50/60 dark:bg-emerald-950/20 p-5 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
          <div>
            <h4 className="text-lg font-semibold text-emerald-800 dark:text-emerald-200">
              アオバの森リカバリープロジェクト
            </h4>
            <p className="text-sm text-emerald-700/80 dark:text-emerald-200/80">
              活動地域：北関東〜中部地方の広葉樹林
            </p>
          </div>
          <a
            href="mailto:info@aobamori.jp"
            className="inline-flex items-center px-3 py-1 text-sm font-semibold text-emerald-800 dark:text-emerald-100 bg-white/80 dark:bg-slate-900/30 border border-emerald-200/60 dark:border-emerald-800/50 rounded-full hover:bg-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-500 transition-colors"
          >
            お問い合わせ
          </a>
        </div>
        <ul className="space-y-2 text-sm text-emerald-900/90 dark:text-emerald-100/90 leading-relaxed">
          <li className="flex items-start gap-2">
            <span className="mt-1 w-2 h-2 rounded-full bg-emerald-500"></span>
            ミズキ科植物の植栽と林床管理による生息環境再生
          </li>
          <li className="flex items-start gap-2">
            <span className="mt-1 w-2 h-2 rounded-full bg-emerald-500"></span>
            幼虫発生期のモニタリングと市民参加型観察会の開催
          </li>
          <li className="flex items-start gap-2">
            <span className="mt-1 w-2 h-2 rounded-full bg-emerald-500"></span>
            自治体・農家と協働したライトトラップ運用の最適化
          </li>
        </ul>
        <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-2 text-sm text-emerald-900/80 dark:text-emerald-100/80">
          <div className="flex items-center gap-2">
            <dt className="font-semibold text-emerald-700 dark:text-emerald-200 min-w-[3rem]">設立</dt>
            <dd>2014年</dd>
          </div>
          <div className="flex items-center gap-2">
            <dt className="font-semibold text-emerald-700 dark:text-emerald-200 min-w-[3rem]">代表</dt>
            <dd>森田 葉月</dd>
          </div>
          <div className="flex items-center gap-2 sm:col-span-2">
            <dt className="font-semibold text-emerald-700 dark:text-emerald-200 min-w-[5rem]">透明性</dt>
            <dd>
              <a
                href="https://example.org/aoba-report.pdf"
                target="_blank"
                rel="noopener noreferrer"
                className="text-emerald-800 dark:text-emerald-200 underline decoration-emerald-300/70 hover:decoration-emerald-500"
              >
                2023透明性レポート（PDF）
              </a>
            </dd>
          </div>
        </dl>

        <div className="space-y-3">
          <p className="text-sm text-emerald-900/80 dark:text-emerald-100/80">
            推し活名で応援プランを選択し、活動の継続を後押しできます。
          </p>
          <button
            type="button"
            onClick={handleTogglePanel}
            className="mt-3 inline-flex items-center justify-center rounded-full bg-emerald-600 text-white px-5 py-2 text-sm font-semibold shadow-md shadow-emerald-600/30 hover:bg-emerald-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-500 transition-colors"
            aria-expanded={panelOpen}
            aria-controls="conservation-support-panel"
          >
            {panelOpen ? '応援プランを閉じる' : '応援プランを選ぶ'}
          </button>
        </div>

        {panelOpen && (
          <div
            id="conservation-support-panel"
            className="mt-4 rounded-xl border border-emerald-200/70 dark:border-emerald-900/60 bg-white/90 dark:bg-slate-900/60 p-4"
          >
            <form className="space-y-4" onSubmit={handleSubmit}>
              <fieldset className="space-y-2">
                <legend className="text-sm font-semibold text-emerald-800 dark:text-emerald-100">応援プラン</legend>
                <div className="grid gap-2">
                  {SUPPORT_PLANS.map(plan => (
                    <label
                      key={plan.value}
                      className={`option flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 rounded-lg border px-3 py-2 text-sm transition-colors ${
                        selectedPlan === plan.value
                          ? 'border-emerald-400 bg-emerald-50 text-emerald-900 dark:border-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-100'
                          : 'border-emerald-100 bg-white/70 dark:border-slate-700 dark:bg-slate-900/50 text-slate-700 dark:text-slate-200'
                      }`}
                    >
                      <span className="flex items-center gap-2">
                        <input
                          type="radio"
                          name="donation"
                          value={plan.value}
                          checked={selectedPlan === plan.value}
                          onChange={handlePlanChange}
                          className="h-4 w-4 text-emerald-600 focus:ring-emerald-500"
                        />
                        <span className="font-semibold">{plan.label}</span>
                      </span>
                      <span className="text-xs sm:text-sm text-emerald-700/80 dark:text-emerald-200/80">{plan.description}</span>
                      <span className="text-xs font-semibold text-emerald-600 dark:text-emerald-200">{plan.amount}</span>
                    </label>
                  ))}
                </div>
                <div className="flex items-center gap-2">
                  <label htmlFor="customAmount" className="text-xs font-semibold text-emerald-800 dark:text-emerald-200">
                    カスタム金額
                  </label>
                  <input
                    type="number"
                    id="customAmount"
                    name="customAmount"
                    min="500"
                    step="500"
                    value={customAmount}
                    onChange={(event) => setCustomAmount(event.target.value)}
                    disabled={selectedPlan !== 'custom'}
                    placeholder="¥3,000"
                    className="w-32 rounded-md border border-emerald-200 bg-white px-2 py-1 text-sm text-slate-700 disabled:opacity-50 dark:border-emerald-800 dark:bg-slate-900 dark:text-slate-100"
                  />
                </div>
              </fieldset>

              <div>
                <label htmlFor="donorName" className="text-sm font-semibold text-emerald-800 dark:text-emerald-100">
                  ニックネーム（推し活名）
                </label>
                <input
                  type="text"
                  id="donorName"
                  name="donorName"
                  placeholder="例：アオバ推しの葉っぱさん"
                  required
                  className="mt-1 w-full rounded-md border border-emerald-200 bg-white px-3 py-2 text-sm text-slate-700 placeholder:text-slate-400 focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-300 dark:border-emerald-800 dark:bg-slate-900 dark:text-slate-100"
                />
              </div>

              <div>
                <label htmlFor="donorEmail" className="text-sm font-semibold text-emerald-800 dark:text-emerald-100">
                  連絡用メールアドレス
                </label>
                <input
                  type="email"
                  id="donorEmail"
                  name="donorEmail"
                  placeholder="例：you@example.com"
                  required
                  className="mt-1 w-full rounded-md border border-emerald-200 bg-white px-3 py-2 text-sm text-slate-700 placeholder:text-slate-400 focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-300 dark:border-emerald-800 dark:bg-slate-900 dark:text-slate-100"
                />
              </div>

              <div className="form-actions flex flex-wrap items-center gap-3">
                <button
                  type="submit"
                  className="inline-flex items-center justify-center rounded-full bg-emerald-600 px-5 py-2 text-sm font-semibold text-white shadow-md shadow-emerald-600/30 hover:bg-emerald-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-500 transition-colors"
                >
                  応援を確定する
                </button>
                <button
                  type="button"
                  onClick={handleClosePanel}
                  className="text-sm font-semibold text-emerald-700 hover:text-emerald-600 dark:text-emerald-200 dark:hover:text-emerald-100"
                >
                  閉じる
                </button>
              </div>

              {submitted && (
                <div className="donation-confirmation mt-3 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-800 dark:border-emerald-800/60 dark:bg-emerald-900/40 dark:text-emerald-200">
                  ありがとうございます！応援内容を仮登録しました。追ってメールで詳細をお知らせします。
                </div>
              )}
            </form>
          </div>
        )}
      </div>

      <div className="rounded-2xl border border-slate-200/70 dark:border-slate-700/60 bg-white/70 dark:bg-slate-900/50 p-5">
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div>
            <h4 className="text-lg font-semibold text-slate-800 dark:text-slate-100">活動を支える企業（テスト）</h4>
            <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">
              企業サポートも推し活の大切なパートナー。支援内容をロゴと一緒に掲示し、協働の姿を紹介しています。
            </p>
          </div>
          <span className="text-xs text-slate-500 dark:text-slate-400 font-semibold">β 版 UI</span>
        </div>
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          {SPONSORS.map((sponsor) => (
            <article
              key={sponsor.name}
              className="flex items-start gap-3 rounded-xl border border-slate-200/70 dark:border-slate-700/60 bg-white/80 dark:bg-slate-900/60 p-3"
            >
              <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-emerald-100/70 dark:bg-emerald-900/40">
                {sponsor.icon}
              </div>
              <div>
                <h5 className="text-sm font-semibold text-slate-800 dark:text-slate-100">{sponsor.name}</h5>
                <p className="mt-1 text-xs text-slate-600 dark:text-slate-300 leading-relaxed">{sponsor.note}</p>
              </div>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
};

export default SupportEngagementSection;
