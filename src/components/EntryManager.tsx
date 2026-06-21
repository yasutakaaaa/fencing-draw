import { useState, useRef } from 'react';
import { useStore, useTournament } from '../store/useStore';
import type { Fencer, Weapon, Gender, AgeCategory } from '../types';

function parseCSV(text: string): string[][] {
  const rows: string[][] = [];
  let col = '';
  let row: string[] = [];
  let inQuote = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (inQuote) {
      if (ch === '"') {
        if (text[i + 1] === '"') { col += '"'; i++; }
        else inQuote = false;
      } else {
        col += ch;
      }
    } else {
      if (ch === '"') {
        inQuote = true;
      } else if (ch === ',') {
        row.push(col); col = '';
      } else if (ch === '\n') {
        row.push(col); col = '';
        if (row.some(c => c !== '')) rows.push(row);
        row = [];
      } else {
        col += ch;
      }
    }
  }
  row.push(col);
  if (row.some(c => c !== '')) rows.push(row);
  return rows;
}

const WEAPONS: Weapon[] = ['フルーレ', 'エペ', 'サーブル'];
const GENDERS: Gender[] = ['男子', '女子', '混合'];
const AGE_CATEGORIES: AgeCategory[] = ['ベテラン', 'シニア', 'ジュニア', 'カデ', 'その他'];

const emptyFencer = (): Omit<Fencer, 'id'> => ({
  lastName: '', firstName: '', lastNameKana: '', firstNameKana: '', club: '', grade: '',
});

export default function EntryManager() {
  const tournament = useTournament();
  const {
    setTournamentField, setPoolPhaseField, setDEPhaseField,
    addFencer, updateFencer, deleteFencer, importFencers, generatePools,
  } = useStore();

  const [form, setForm] = useState(emptyFencer());
  const [editId, setEditId] = useState<string | null>(null);
  const [error, setError] = useState('');
  const csvRef = useRef<HTMLInputElement>(null);

  if (!tournament) return null;

  const handleSubmit = () => {
    if (!form.lastName || !form.firstName) { setError('苗字と名前は必須です'); return; }
    if (editId) { updateFencer(editId, form); setEditId(null); }
    else addFencer(form);
    setForm(emptyFencer());
    setError('');
  };

  const startEdit = (f: Fencer) => {
    setEditId(f.id);
    setForm({
      lastName: f.lastName, firstName: f.firstName,
      lastNameKana: f.lastNameKana, firstNameKana: f.firstNameKana,
      club: f.club, grade: f.grade ?? '',
    });
  };

  const cancelEdit = () => { setEditId(null); setForm(emptyFencer()); setError(''); };

  const handleCSV = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = ev => {
      const raw = (ev.target?.result as string) ?? '';
      const text = raw.replace(/^﻿/, '').replace(/\r\n/g, '\n').replace(/\r/g, '\n');
      const rows = parseCSV(text);
      const parsed: Omit<Fencer, 'id'>[] = [];
      for (const cols of rows) {
        if (cols.length < 2) continue;
        let offset = 0;
        if (/^(No\.?|番号|#|\d+)$/i.test(cols[0].trim())) offset = 1;
        if (/^(苗字|lastName|last.?name)$/i.test(cols[offset]?.trim() ?? '')) continue;
        if (!cols[offset]?.trim()) continue;
        parsed.push({
          lastName:      cols[offset]?.trim() ?? '',
          firstName:     cols[offset + 1]?.trim() ?? '',
          lastNameKana:  cols[offset + 2]?.trim() ?? '',
          firstNameKana: cols[offset + 3]?.trim() ?? '',
          club:          cols[offset + 4]?.trim() ?? '',
          grade:         cols[offset + 5]?.trim() ?? '',
        });
      }
      if (parsed.length === 0) {
        alert('インポートできる選手データが見つかりませんでした。');
        return;
      }
      importFencers(parsed);
      alert(`${parsed.length}名をインポートしました。`);
    };
    reader.readAsText(file, 'UTF-8');
    e.target.value = '';
  };

  const downloadTemplate = () => {
    const header = ['No.', '苗字', '名前', '苗字かな', '名前かな', '所属', '学年'];
    const samples = [
      ['1', '山田', '太郎', 'やまだ', 'たろう', '東京フェンシングクラブ', '高2'],
      ['2', '鈴木', '花子', 'すずき', 'はなこ', '大阪FC', ''],
      ['3', '佐藤', '次郎', 'さとう', 'じろう', '名古屋クラブ', ''],
    ];
    const csv = [header, ...samples].map(r => r.map(c => `"${c}"`).join(',')).join('\r\n');
    const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = 'fencing_entry_template.csv'; a.click();
    URL.revokeObjectURL(url);
  };

  const canGenerate = tournament.fencers.length >= 2;

  return (
    <div className="space-y-6">
      {/* ── 大会設定 ─────────────────────────────────── */}
      <div className="bg-white border border-gray-200 rounded-xl p-5 shadow-sm">
        <h2 className="text-lg font-bold text-gray-800 mb-4">大会設定</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="sm:col-span-2">
            <label className="block text-sm font-medium text-gray-700 mb-1">大会名</label>
            <input
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              value={tournament.name}
              onChange={e => setTournamentField('name', e.target.value)}
              placeholder="○○フェンシング大会"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">開催日</label>
            <input
              type="date"
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              value={tournament.date}
              onChange={e => setTournamentField('date', e.target.value)}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">種目</label>
            <select
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              value={tournament.weapon}
              onChange={e => setTournamentField('weapon', e.target.value as Weapon)}
            >
              {WEAPONS.map(w => <option key={w}>{w}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">性別</label>
            <select
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              value={tournament.gender}
              onChange={e => setTournamentField('gender', e.target.value as Gender)}
            >
              {GENDERS.map(g => <option key={g}>{g}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">年代カテゴリ</label>
            <select
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              value={tournament.ageCategory}
              onChange={e => setTournamentField('ageCategory', e.target.value as AgeCategory)}
            >
              {AGE_CATEGORIES.map(c => <option key={c}>{c}</option>)}
            </select>
          </div>
          {tournament.ageCategory === 'その他' && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">カテゴリ詳細</label>
              <input
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                value={tournament.ageCategoryCustom ?? ''}
                onChange={e => setTournamentField('ageCategoryCustom', e.target.value)}
                placeholder="例: U13, マスターズ50"
              />
            </div>
          )}
        </div>

        <div className="mt-4 grid grid-cols-2 sm:grid-cols-3 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">プール最大人数</label>
            <input
              type="number" min={3} max={10}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              value={tournament.poolPhase.maxPoolSize}
              onChange={e => setPoolPhaseField('maxPoolSize', Number(e.target.value))}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">通過方式</label>
            <select
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              value={tournament.poolPhase.advancement.type}
              onChange={e => setPoolPhaseField('advancement', { ...tournament.poolPhase.advancement, type: e.target.value as 'percent' | 'count' })}
            >
              <option value="percent">パーセント</option>
              <option value="count">人数</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              {tournament.poolPhase.advancement.type === 'percent' ? '通過率 (%)' : '通過人数'}
            </label>
            <input
              type="number" min={1}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              value={tournament.poolPhase.advancement.value}
              onChange={e => setPoolPhaseField('advancement', { ...tournament.poolPhase.advancement, value: Number(e.target.value) })}
            />
          </div>
        </div>

        <div className="mt-3">
          <label className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer w-fit">
            <input
              type="checkbox" className="w-4 h-4 accent-blue-600"
              checked={tournament.dePhase.thirdPlace}
              onChange={e => setDEPhaseField('thirdPlace', e.target.checked)}
            />
            3位決定戦あり
          </label>
        </div>
      </div>

      {/* ── 選手追加フォーム ─────────────────────────── */}
      <div className="bg-white border border-gray-200 rounded-xl p-5 shadow-sm">
        <h2 className="text-lg font-bold text-gray-800 mb-4">
          {editId ? '選手編集' : '選手追加'}
        </h2>
        {error && <p className="text-red-600 text-sm mb-3">{error}</p>}
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          {([
            { label: '苗字*',    key: 'lastName',      placeholder: '山田' },
            { label: '名前*',    key: 'firstName',     placeholder: '太郎' },
            { label: '苗字（かな）', key: 'lastNameKana',  placeholder: 'やまだ' },
            { label: '名前（かな）', key: 'firstNameKana', placeholder: 'たろう' },
            { label: '所属',     key: 'club',          placeholder: '○○大学' },
            { label: '学年',     key: 'grade',         placeholder: '高2' },
          ] as const).map(({ label, key, placeholder }) => (
            <div key={key}>
              <label className="block text-xs font-medium text-gray-600 mb-1">{label}</label>
              <input
                className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                value={form[key as keyof typeof form] ?? ''}
                onChange={e => setForm(f => ({ ...f, [key]: e.target.value }))}
                placeholder={placeholder}
                // スマホでEnterで追加
                onKeyDown={e => { if (e.key === 'Enter') handleSubmit(); }}
              />
            </div>
          ))}
        </div>
        <div className="mt-3 flex gap-2 flex-wrap">
          <button
            className="bg-blue-600 hover:bg-blue-700 text-white px-5 py-2.5 rounded-lg text-sm font-bold transition-colors"
            onClick={handleSubmit}
          >
            {editId ? '更新' : '追加'}
          </button>
          {editId && (
            <button
              className="bg-gray-200 hover:bg-gray-300 text-gray-700 px-4 py-2.5 rounded-lg text-sm font-medium transition-colors"
              onClick={cancelEdit}
            >
              キャンセル
            </button>
          )}
          <div className="ml-auto flex gap-2">
            <button
              className="bg-gray-100 hover:bg-gray-200 text-gray-600 px-4 py-2.5 rounded-lg text-sm font-medium transition-colors"
              onClick={downloadTemplate}
            >
              テンプレートDL
            </button>
            <label className="bg-green-600 hover:bg-green-700 text-white px-4 py-2.5 rounded-lg text-sm font-bold transition-colors cursor-pointer">
              CSVインポート
              <input ref={csvRef} type="file" accept=".csv" className="hidden" onChange={handleCSV} />
            </label>
          </div>
        </div>
        <p className="text-xs text-gray-400 mt-2">
          CSV: No.,苗字,名前,苗字かな,名前かな,所属,学年（ヘッダー行は自動スキップ・UTF-8）
        </p>
      </div>

      {/* ── 選手一覧 ─────────────────────────────────── */}
      <div className="bg-white border border-gray-200 rounded-xl p-5 shadow-sm">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-bold text-gray-800">
            エントリー選手 <span className="text-blue-600 font-bold">{tournament.fencers.length}</span>名
          </h2>
        </div>

        {tournament.fencers.length === 0 ? (
          <p className="text-gray-400 text-sm py-8 text-center">選手が登録されていません</p>
        ) : (
          <div className="overflow-x-auto -mx-1">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-200 text-left text-gray-600">
                  <th className="pb-2 px-1 font-medium w-8">#</th>
                  <th className="pb-2 px-1 font-medium">氏名</th>
                  <th className="pb-2 px-1 font-medium hidden sm:table-cell">ふりがな</th>
                  <th className="pb-2 px-1 font-medium">所属</th>
                  <th className="pb-2 px-1 font-medium hidden sm:table-cell">学年</th>
                  <th className="pb-2 px-1"></th>
                </tr>
              </thead>
              <tbody>
                {tournament.fencers.map((f, i) => (
                  <tr key={f.id} className={`border-b border-gray-100 ${editId === f.id ? 'bg-blue-50' : 'hover:bg-gray-50'}`}>
                    <td className="py-2 px-1 text-gray-400">{i + 1}</td>
                    <td className="py-2 px-1 font-medium text-gray-800">{f.lastName}{f.firstName}</td>
                    <td className="py-2 px-1 text-gray-500 hidden sm:table-cell">{f.lastNameKana}{f.firstNameKana}</td>
                    <td className="py-2 px-1 text-gray-600">{f.club}</td>
                    <td className="py-2 px-1 text-gray-400 text-xs hidden sm:table-cell">{f.grade}</td>
                    <td className="py-2 px-1">
                      <div className="flex gap-3 justify-end">
                        <button className="text-blue-600 hover:text-blue-800 text-xs py-1" onClick={() => startEdit(f)}>編集</button>
                        <button className="text-red-500 hover:text-red-700 text-xs py-1" onClick={() => deleteFencer(f.id)}>削除</button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <div className="mt-4">
          <button
            className={`w-full py-3.5 rounded-xl font-bold text-base transition-colors ${
              canGenerate
                ? 'bg-blue-600 hover:bg-blue-700 text-white shadow-md'
                : 'bg-gray-200 text-gray-400 cursor-not-allowed'
            }`}
            disabled={!canGenerate}
            onClick={generatePools}
          >
            組み合わせを作成（プール分け）→
          </button>
          {!canGenerate && (
            <p className="text-xs text-gray-400 text-center mt-1">選手を2名以上登録してください</p>
          )}
        </div>
      </div>
    </div>
  );
}
