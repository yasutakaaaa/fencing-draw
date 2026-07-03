#!/usr/bin/env node
/**
 * テストデータ投入スクリプト
 * 3大会（未開催・進行中・完了）を Supabase に直接作成する
 *
 * Usage: node scripts/seed-test-data.mjs
 */

const SUPABASE_URL  = 'https://hkdthcoygwqdimcblkdt.supabase.co';
const ANON_KEY      = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImhrZHRoY295Z3dxZGltY2Jsa2R0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODI1NTk1NjMsImV4cCI6MjA5ODEzNTU2M30.EZ4rZDnGE0GbutyXxqm3-t6crxpxme-qt1XUdOWJV9o';
const TEST_EMAIL    = 'yasucomm591@gmail.com';
const TEST_PASSWORD = 'testtest';

// ── ヘルパー ────────────────────────────────────────────────────────
function uid() {
  return Math.random().toString(36).slice(2, 10);
}

const LAST_NAMES  = ['田中','鈴木','佐藤','山田','中村','小林','加藤','吉田','山口','松本','井上','木村','林','斎藤','清水','山崎','森','池田','橋本','阿部'];
const FIRST_M     = ['太郎','健一','誠','学','浩','武','裕','隆','勝','博','徹','修','雄太','拓也','翔','大輝','蓮','海斗','颯太','悠人'];
const FIRST_F     = ['花子','美香','恵子','由美','奈々','明日香','千春','絵里','麻衣','さくら','優子','愛','春奈','彩','萌','真央','陽菜','咲','莉子','結衣'];
const KANA_LAST   = ['タナカ','スズキ','サトウ','ヤマダ','ナカムラ','コバヤシ','カトウ','ヨシダ','ヤマグチ','マツモト','イノウエ','キムラ','ハヤシ','サイトウ','シミズ','ヤマザキ','モリ','イケダ','ハシモト','アベ'];
const KANA_M      = ['タロウ','ケンイチ','マコト','マナブ','ヒロシ','タケシ','ユウ','タカシ','マサル','ヒロシ','トオル','オサム','ユウタ','タクヤ','ショウ','ダイキ','レン','カイト','ソウタ','ユウト'];
const KANA_F      = ['ハナコ','ミカ','ケイコ','ユミ','ナナ','アスカ','チハル','エリ','マイ','サクラ','ユウコ','アイ','ハルナ','アヤ','モエ','マオ','ヒナ','サキ','リコ','ユイ'];
const CLUBS = ['日本体育大学','慶應義塾大学','早稲田大学','中央大学','明治大学','東海大学','法政大学','東京FC','新宿SC','渋谷FC','大阪FC','京都SC','東北FC','名古屋SC'];

function makeFencers(n, gender) {
  const firstNames = gender === '女子' ? FIRST_F : FIRST_M;
  const kanaFirst  = gender === '女子' ? KANA_F  : KANA_M;
  const used = new Set();
  const fencers = [];
  while (fencers.length < n) {
    const li = Math.floor(Math.random() * LAST_NAMES.length);
    const fi = Math.floor(Math.random() * firstNames.length);
    const ci = Math.floor(Math.random() * CLUBS.length);
    const key = `${li}-${fi}`;
    if (used.has(key)) continue;
    used.add(key);
    fencers.push({
      id: uid(),
      lastName: LAST_NAMES[li],
      firstName: firstNames[fi],
      lastNameKana: KANA_LAST[li],
      firstNameKana: kanaFirst[fi],
      club: CLUBS[ci],
    });
  }
  return fencers;
}

// プールにフェンサーを割り振る（storの assignPools と同等）
function assignPools(fencers, maxSize) {
  const n = fencers.length;
  const numPools = Math.max(1, Math.ceil(n / maxSize));
  const pools = Array.from({ length: numPools }, (_, i) => ({
    id: uid(), index: i, fencerIds: [], bouts: [],
  }));
  // 蛇行配置
  let dir = 1, poolIdx = 0;
  for (const f of fencers) {
    pools[poolIdx].fencerIds.push(f.id);
    poolIdx += dir;
    if (poolIdx >= numPools) { poolIdx = numPools - 1; dir = -1; }
    else if (poolIdx < 0)   { poolIdx = 0;              dir =  1; }
  }
  // ブランクプールを除去し、bout を生成
  return pools.filter(p => p.fencerIds.length > 0).map(p => {
    const bouts = [];
    for (let i = 0; i < p.fencerIds.length; i++) {
      for (let j = i + 1; j < p.fencerIds.length; j++) {
        bouts.push({
          id: uid(),
          fencerAId: p.fencerIds[i],
          fencerBId: p.fencerIds[j],
          scoreA: null, scoreB: null, winner: null,
        });
      }
    }
    return { ...p, bouts };
  });
}

// プールの試合に結果を入力（fraction: 0〜1 の完了率）
function fillBouts(pools, fraction = 1) {
  return pools.map(pool => ({
    ...pool,
    bouts: pool.bouts.map((bout, i) => {
      if (i / pool.bouts.length >= fraction) return bout;
      const sA = Math.floor(Math.random() * 6);
      const sB = Math.floor(Math.random() * 6);
      const scoreA = Math.max(sA, sB) === sA ? 5 : sA;
      const scoreB = scoreA === 5 ? sB : 5;
      return { ...bout, scoreA, scoreB, winner: scoreA === 5 ? 'A' : 'B' };
    }),
  }));
}

// ブラケット（最大64名対応のシンプルな実装）
function buildBracket(fencerIds, thirdPlace) {
  const n = fencerIds.length;
  const size = [2,4,8,16,32,64].find(s => s >= n) ?? 64;
  const rounds = Math.log2(size);
  const matches = [];

  // Round 0: seeded fencers vs BYE
  for (let pos = 0; pos < size / 2; pos++) {
    const a = fencerIds[pos * 2]   ?? null;
    const b = fencerIds[pos * 2 + 1] ?? null;
    const isBye = !b;
    matches.push({
      id: uid(), round: 0, position: pos,
      fencerAId: a, fencerBId: b,
      scoreA: null, scoreB: null, winner: isBye ? 'A' : null,
      isBye,
    });
  }
  // Higher rounds (empty initially)
  for (let r = 1; r < rounds; r++) {
    for (let pos = 0; pos < size / Math.pow(2, r + 1); pos++) {
      matches.push({
        id: uid(), round: r, position: pos,
        fencerAId: null, fencerBId: null,
        scoreA: null, scoreB: null, winner: null,
        isBye: false,
      });
    }
  }
  // 3位決定戦
  if (thirdPlace) {
    matches.push({
      id: uid(), round: rounds - 1, position: 1,
      fencerAId: null, fencerBId: null,
      scoreA: null, scoreB: null, winner: null,
      isBye: false, isThirdPlace: true,
    });
  }
  return matches;
}

// BYE選手を次ラウンドへ進める（R0のみ）
function advanceByes(matches) {
  const next = matches.map(m => ({ ...m }));
  for (const m of next.filter(m => m.round === 0 && m.isBye)) {
    const winner = m.fencerAId;
    const targetRound = 1;
    const targetPos  = Math.floor(m.position / 2);
    const isA = m.position % 2 === 0;
    const target = next.find(x => x.round === targetRound && x.position === targetPos);
    if (target) {
      if (isA) target.fencerAId = winner;
      else     target.fencerBId = winner;
    }
  }
  return next;
}

// ── デフォルトフェーズ ──────────────────────────────────────────────
function defaultPhases() {
  return [
    { id: uid(), type: 'pool', maxPoolSize: 7, advancement: { type: 'percent', value: 70 } },
    { id: uid(), type: 'de', thirdPlace: true, classification: false, classificationPlacements: [] },
  ];
}

// ── 大会データ構築 ──────────────────────────────────────────────────
function makeTournament({ id, eventId, name, date, weapon, gender, ageCategory, format = '個人', status, fencers, state }) {
  const phases = defaultPhases();
  let phaseRuntimes = [];
  let activePhaseIdx = -1;

  if (state === 'pool-running') {
    const pools = fillBouts(assignPools(fencers, 7), 0.5); // 50% complete
    phaseRuntimes = [{
      phaseId: phases[0].id, type: 'pool',
      pools, subPhase: 'running',
      inputFencerIds: fencers.map(f => f.id),
    }];
    activePhaseIdx = 0;
  } else if (state === 'pool-advancement') {
    const pools = fillBouts(assignPools(fencers, 7), 1); // 100% complete
    phaseRuntimes = [{
      phaseId: phases[0].id, type: 'pool',
      pools, subPhase: 'advancement',
      inputFencerIds: fencers.map(f => f.id),
    }];
    activePhaseIdx = 0;
  } else if (state === 'bracket') {
    const pools = fillBouts(assignPools(fencers, 7), 1);
    // 上位 70% を通過
    const advCount = Math.round(fencers.length * 0.7);
    const advancedIds = fencers.slice(0, advCount).map(f => f.id);
    const deMatches = advanceByes(buildBracket(advancedIds, true));
    phaseRuntimes = [
      {
        phaseId: phases[0].id, type: 'pool',
        pools, subPhase: 'advancement',
        inputFencerIds: fencers.map(f => f.id),
      },
      {
        phaseId: phases[1].id, type: 'de',
        deMatches,
        inputFencerIds: advancedIds,
      },
    ];
    activePhaseIdx = 1;
  } else if (state === 'results') {
    const pools = fillBouts(assignPools(fencers, 7), 1);
    const advCount = Math.round(fencers.length * 0.7);
    const advancedIds = fencers.slice(0, advCount).map(f => f.id);
    phaseRuntimes = [
      {
        phaseId: phases[0].id, type: 'pool',
        pools, subPhase: 'advancement',
        inputFencerIds: fencers.map(f => f.id),
      },
    ];
    activePhaseIdx = phases.length; // results phase
  }

  return {
    id, eventId, name, date, weapon, gender, ageCategory,
    ageCategoryCustom: '', format, status,
    fencers, phases, phaseRuntimes, activePhaseIdx,
  };
}

// ── メイン ──────────────────────────────────────────────────────────
async function main() {
  const base = { 'Content-Type': 'application/json', 'apikey': ANON_KEY };

  // 1. サインイン
  console.log('🔑 サインイン中…');
  const signinRes = await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=password`, {
    method: 'POST',
    headers: base,
    body: JSON.stringify({ email: TEST_EMAIL, password: TEST_PASSWORD }),
  });
  const { access_token, error: authErr } = await signinRes.json();
  if (authErr || !access_token) {
    console.error('❌ サインイン失敗:', authErr);
    process.exit(1);
  }
  const auth = { ...base, 'Authorization': `Bearer ${access_token}` };

  // 2. 既存テストデータをクリーンアップ（名前にテスト識別子を含む行）
  console.log('🧹 既存テストイベント削除中…');
  const listRes = await fetch(`${SUPABASE_URL}/rest/v1/tournaments?select=id,name`, {
    headers: { ...auth, 'Prefer': 'return=representation' },
  });
  const rows = await listRes.json();
  const testIds = (rows ?? [])
    .filter(r => ['【未開催】春季大会','【進行中】東京都選手権','【完了】全国大会'].includes(r.name))
    .map(r => r.id);
  for (const id of testIds) {
    await fetch(`${SUPABASE_URL}/rest/v1/tournaments?id=eq.${id}`, {
      method: 'DELETE', headers: auth,
    });
    console.log(`  削除: ${id}`);
  }

  // ─────────────────────────────────────────────────────────────────
  // 大会 1: 未開催（エントリーのみ）
  // ─────────────────────────────────────────────────────────────────
  console.log('\n📋 大会1 作成: 【未開催】春季大会');
  const e1id = uid();
  const cat1a_id = uid(), cat1b_id = uid(), cat1c_id = uid();
  const cat1a = makeTournament({
    id: cat1a_id, eventId: e1id,
    name: 'シニア男子フルーレ', date: '2026-08-10',
    weapon: 'フルーレ', gender: '男子', ageCategory: 'シニア', format: '個人',
    status: '準備中', fencers: makeFencers(15, '男子'), state: 'entry',
  });
  const cat1b = makeTournament({
    id: cat1b_id, eventId: e1id,
    name: 'シニア女子フルーレ', date: '2026-08-10',
    weapon: 'フルーレ', gender: '女子', ageCategory: 'シニア', format: '個人',
    status: '準備中', fencers: makeFencers(12, '女子'), state: 'entry',
  });
  const cat1c = makeTournament({
    id: cat1c_id, eventId: e1id,
    name: 'カデ男子フルーレ', date: '2026-08-10',
    weapon: 'フルーレ', gender: '男子', ageCategory: 'カデ', format: '個人',
    status: '準備中', fencers: makeFencers(10, '男子'), state: 'entry',
  });
  await upsertEvent(auth, {
    id: e1id, name: '【未開催】春季大会', date: '2026-08-10',
    status: '未', venue: '○○体育館',
    categories: { [cat1a_id]: cat1a, [cat1b_id]: cat1b, [cat1c_id]: cat1c },
    categoryIds: [cat1a_id, cat1b_id, cat1c_id],
  }, access_token);

  // ─────────────────────────────────────────────────────────────────
  // 大会 2: 進行中（複数状態のカテゴリ混在）
  // ─────────────────────────────────────────────────────────────────
  console.log('\n📋 大会2 作成: 【進行中】東京都選手権');
  const e2id = uid();
  const cat2a_id = uid(), cat2b_id = uid(), cat2c_id = uid();

  // Cat A: プール戦進行中（50%完了）
  const cat2a = makeTournament({
    id: cat2a_id, eventId: e2id,
    name: 'シニア男子エペ', date: '2026-07-20',
    weapon: 'エペ', gender: '男子', ageCategory: 'シニア', format: '個人',
    status: '進行中', fencers: makeFencers(20, '男子'), state: 'pool-running',
  });
  // Cat B: プール戦完了→通過判定（ブラケット前）
  const cat2b = makeTournament({
    id: cat2b_id, eventId: e2id,
    name: 'シニア女子エペ', date: '2026-07-20',
    weapon: 'エペ', gender: '女子', ageCategory: 'シニア', format: '個人',
    status: '進行中', fencers: makeFencers(14, '女子'), state: 'pool-advancement',
  });
  // Cat C: エントリーのみ
  const cat2c = makeTournament({
    id: cat2c_id, eventId: e2id,
    name: 'ジュニア男子エペ', date: '2026-07-20',
    weapon: 'エペ', gender: '男子', ageCategory: 'ジュニア', format: '個人',
    status: '準備中', fencers: makeFencers(12, '男子'), state: 'entry',
  });
  await upsertEvent(auth, {
    id: e2id, name: '【進行中】東京都選手権', date: '2026-07-20',
    status: '実施中', venue: '東京武道館',
    categories: { [cat2a_id]: cat2a, [cat2b_id]: cat2b, [cat2c_id]: cat2c },
    categoryIds: [cat2a_id, cat2b_id, cat2c_id],
  }, access_token);

  // ─────────────────────────────────────────────────────────────────
  // 大会 3: 完了（プール戦〜トーナメント完了）
  // ─────────────────────────────────────────────────────────────────
  console.log('\n📋 大会3 作成: 【完了】全国大会');
  const e3id = uid();
  const cat3a_id = uid(), cat3b_id = uid();

  // Cat A: プール戦完了→ブラケット進行中
  const cat3a = makeTournament({
    id: cat3a_id, eventId: e3id,
    name: 'シニア男子サーブル', date: '2026-06-15',
    weapon: 'サーブル', gender: '男子', ageCategory: 'シニア', format: '個人',
    status: '終了', fencers: makeFencers(24, '男子'), state: 'bracket',
  });
  // Cat B: プール戦完了→最終順位
  const cat3b = makeTournament({
    id: cat3b_id, eventId: e3id,
    name: 'シニア女子サーブル', date: '2026-06-15',
    weapon: 'サーブル', gender: '女子', ageCategory: 'シニア', format: '個人',
    status: '終了', fencers: makeFencers(18, '女子'), state: 'results',
  });
  await upsertEvent(auth, {
    id: e3id, name: '【完了】全国大会', date: '2026-06-15',
    status: '終了', venue: '国立代々木体育館',
    categories: { [cat3a_id]: cat3a, [cat3b_id]: cat3b },
    categoryIds: [cat3a_id, cat3b_id],
  }, access_token);

  console.log('\n✅ テストデータ作成完了！');
  console.log('  大会1: 【未開催】春季大会       3カテゴリ, 15/12/10名');
  console.log('  大会2: 【進行中】東京都選手権    3カテゴリ, 20/14/12名（プール進行中+完了+エントリー）');
  console.log('  大会3: 【完了】全国大会          2カテゴリ, 24/18名（トーナメント+最終順位）');
}

async function upsertEvent(auth, { id, name, date, status, venue, categories, categoryIds }, ownerId) {
  // owner_id をアクセストークンから取得（JWTのsub）
  const parts = auth.Authorization.replace('Bearer ', '').split('.');
  const payload = JSON.parse(Buffer.from(parts[1], 'base64url').toString());

  const body = {
    id, name, date, status,
    owner_id: payload.sub,
    data: { venue, pin: '', categoryIds, categories },
  };
  const res = await fetch(`${SUPABASE_URL}/rest/v1/tournaments`, {
    method: 'POST',
    headers: { ...auth, 'Prefer': 'resolution=merge-duplicates,return=minimal' },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const err = await res.text();
    console.error(`  ❌ Upsert failed for ${name}:`, err);
  } else {
    const catCount = categoryIds.length;
    const fencerCount = Object.values(categories).reduce((s, c) => s + c.fencers.length, 0);
    console.log(`  ✓ ${name} (${catCount}カテゴリ, 計${fencerCount}名)`);
  }
}

main().catch(e => { console.error(e); process.exit(1); });
