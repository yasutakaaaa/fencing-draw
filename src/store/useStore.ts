import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { Tournament, Fencer, Bout, DEMatch, AppPhase, TournamentLog, TournamentStatus } from '../types';
import { assignPools } from '../utils/pooling';
import { calcGlobalStats, applyAdvancement } from '../utils/ranking';
import { buildBracket, advanceWinner, revertDEMatch } from '../utils/bracket';

function generateId() {
  return Math.random().toString(36).slice(2, 10);
}

function defaultTournament(id?: string): Tournament {
  return {
    id: id ?? generateId(),
    name: '',
    date: new Date().toISOString().slice(0, 10),
    weapon: 'フルーレ',
    gender: '男子',
    ageCategory: 'シニア',
    ageCategoryCustom: '',
    status: '準備中',
    fencers: [],
    poolPhase: { type: 'pool', maxPoolSize: 7, advancement: { type: 'percent', value: 70 } },
    dePhase: { type: 'de', thirdPlace: true },
    pools: [],
    deMatches: [],
    appPhase: 'entry',
  };
}

/** 旧形式（single tournament）からのマイグレーション */
function migrateTournament(t: Tournament): Tournament {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const raw = t as any;
  return {
    ...t,
    ageCategory:        raw.ageCategory        ?? 'シニア',
    ageCategoryCustom:  raw.ageCategoryCustom  ?? '',
    status:             raw.status             ?? '準備中',
    fencers: t.fencers.map(f => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { note: _note, ...rest } = f as any;
      return rest as Fencer;
    }),
  };
}

export type ViewMode = 'admin' | 'viewer';

interface StoreState {
  tournaments: Tournament[];
  currentId: string | null;
  viewMode: ViewMode;
  logs: TournamentLog[];

  // ── ホーム画面 ──────────────────────────────
  createTournament: () => void;
  openTournament: (id: string) => void;
  closeTournament: () => void;
  duplicateTournament: (id: string) => void;
  deleteTournament: (id: string) => void;
  setTournamentStatus: (id: string, status: TournamentStatus) => void;
  exportTournamentJSON: (id: string) => string;
  importTournamentJSON: (json: string) => void;

  // ── 閲覧モード ─────────────────────────────
  setViewMode: (mode: ViewMode) => void;

  // ── 大会設定（現在の大会） ──────────────────
  setTournamentField: (field: keyof Tournament, value: unknown) => void;
  setPoolPhaseField: <K extends keyof Tournament['poolPhase']>(key: K, value: Tournament['poolPhase'][K]) => void;
  setDEPhaseField: <K extends keyof Tournament['dePhase']>(key: K, value: Tournament['dePhase'][K]) => void;

  // ── 選手管理 ───────────────────────────────
  addFencer: (fencer: Omit<Fencer, 'id'>) => void;
  updateFencer: (id: string, fencer: Partial<Omit<Fencer, 'id'>>) => void;
  deleteFencer: (id: string) => void;
  importFencers: (fencers: Omit<Fencer, 'id'>[]) => void;

  // ── フェーズ遷移 ───────────────────────────
  generatePools: () => void;
  setAppPhase: (phase: AppPhase) => void;

  // ── プールスコア ───────────────────────────
  updateBout: (poolId: string, boutId: string, updates: Partial<Bout>) => void;

  // ── DEブラケット ───────────────────────────
  generateBracket: () => void;
  updateDEMatch: (matchId: string, updates: Partial<DEMatch>) => void;
  confirmDEMatch: (matchId: string) => void;
  revertDEMatch: (matchId: string) => void;

  // ── ログ ───────────────────────────────────
  saveTournamentLog: () => string;
  deleteLog: (id: string) => void;
  restoreFromLog: (id: string) => void;

  // ── レガシー互換 ───────────────────────────
  exportJSON: () => string;
  importJSON: (json: string) => void;
  resetTournament: () => void;
}

// 現在の大会を取得するヘルパー
function getCurrent(tournaments: Tournament[], currentId: string | null): Tournament | undefined {
  return tournaments.find(t => t.id === currentId);
}

function updateCurrent(
  tournaments: Tournament[],
  currentId: string | null,
  updater: (t: Tournament) => Tournament
): Tournament[] {
  return tournaments.map(t => (t.id === currentId ? updater(t) : t));
}

export const useStore = create<StoreState>()(
  persist(
    (set, get) => ({
      tournaments: [],
      currentId: null,
      viewMode: 'admin',
      logs: [],

      // ── ホーム画面 ──────────────────────────────
      createTournament: () => {
        const t = defaultTournament();
        set(s => ({ tournaments: [t, ...s.tournaments], currentId: t.id, viewMode: 'admin' }));
      },

      openTournament: (id) => {
        set({ currentId: id, viewMode: 'admin' });
      },

      closeTournament: () => {
        set({ currentId: null });
      },

      duplicateTournament: (id) => {
        const { tournaments } = get();
        const src = tournaments.find(t => t.id === id);
        if (!src) return;
        const copy: Tournament = {
          ...JSON.parse(JSON.stringify(src)),
          id: generateId(),
          name: `${src.name}（コピー）`,
          status: '準備中',
        };
        set(s => ({ tournaments: [copy, ...s.tournaments] }));
      },

      deleteTournament: (id) => {
        set(s => ({
          tournaments: s.tournaments.filter(t => t.id !== id),
          currentId: s.currentId === id ? null : s.currentId,
        }));
      },

      setTournamentStatus: (id, status) => {
        set(s => ({
          tournaments: s.tournaments.map(t => t.id === id ? { ...t, status } : t),
        }));
      },

      exportTournamentJSON: (id) => {
        const t = get().tournaments.find(x => x.id === id);
        return JSON.stringify(t ?? {}, null, 2);
      },

      importTournamentJSON: (json) => {
        try {
          const data = JSON.parse(json) as Tournament;
          const migrated = migrateTournament({ ...defaultTournament(data.id), ...data });
          set(s => {
            const exists = s.tournaments.some(t => t.id === migrated.id);
            const tournaments = exists
              ? s.tournaments.map(t => t.id === migrated.id ? migrated : t)
              : [migrated, ...s.tournaments];
            return { tournaments };
          });
          alert('インポートしました。');
        } catch {
          alert('JSONの読み込みに失敗しました');
        }
      },

      // ── 閲覧モード ─────────────────────────────
      setViewMode: (mode) => set({ viewMode: mode }),

      // ── 大会設定 ───────────────────────────────
      setTournamentField: (field, value) =>
        set(s => ({ tournaments: updateCurrent(s.tournaments, s.currentId, t => ({ ...t, [field]: value })) })),

      setPoolPhaseField: (key, value) =>
        set(s => ({
          tournaments: updateCurrent(s.tournaments, s.currentId, t => ({
            ...t, poolPhase: { ...t.poolPhase, [key]: value },
          })),
        })),

      setDEPhaseField: (key, value) =>
        set(s => ({
          tournaments: updateCurrent(s.tournaments, s.currentId, t => ({
            ...t, dePhase: { ...t.dePhase, [key]: value },
          })),
        })),

      // ── 選手管理 ───────────────────────────────
      addFencer: fencer =>
        set(s => ({
          tournaments: updateCurrent(s.tournaments, s.currentId, t => ({
            ...t,
            fencers: [...t.fencers, { ...fencer, id: generateId() }],
          })),
        })),

      updateFencer: (id, updates) =>
        set(s => ({
          tournaments: updateCurrent(s.tournaments, s.currentId, t => ({
            ...t,
            fencers: t.fencers.map(f => f.id === id ? { ...f, ...updates } : f),
          })),
        })),

      deleteFencer: id =>
        set(s => ({
          tournaments: updateCurrent(s.tournaments, s.currentId, t => ({
            ...t,
            fencers: t.fencers.filter(f => f.id !== id),
          })),
        })),

      importFencers: fencers =>
        set(s => ({
          tournaments: updateCurrent(s.tournaments, s.currentId, t => ({
            ...t,
            fencers: [...t.fencers, ...fencers.map(f => ({ ...f, id: generateId() }))],
          })),
        })),

      // ── フェーズ遷移 ───────────────────────────
      generatePools: () =>
        set(s => ({
          tournaments: updateCurrent(s.tournaments, s.currentId, t => {
            const pools = assignPools(t.fencers, t.poolPhase.maxPoolSize);
            return { ...t, pools, appPhase: 'pool', status: '進行中' };
          }),
        })),

      setAppPhase: phase =>
        set(s => ({
          tournaments: updateCurrent(s.tournaments, s.currentId, t => ({ ...t, appPhase: phase })),
        })),

      // ── プールスコア ───────────────────────────
      updateBout: (poolId, boutId, updates) =>
        set(s => ({
          tournaments: updateCurrent(s.tournaments, s.currentId, t => ({
            ...t,
            pools: t.pools.map(p =>
              p.id !== poolId ? p : {
                ...p,
                bouts: p.bouts.map(b => b.id !== boutId ? b : { ...b, ...updates }),
              }
            ),
          })),
        })),

      // ── DEブラケット ───────────────────────────
      generateBracket: () =>
        set(s => ({
          tournaments: updateCurrent(s.tournaments, s.currentId, t => {
            const globalStats = calcGlobalStats(t.pools, t.fencers);
            const withAdv = applyAdvancement(
              globalStats, t.poolPhase.advancement.type, t.poolPhase.advancement.value, t.fencers.length
            );
            const deMatches = buildBracket(withAdv, t.dePhase.thirdPlace);
            return { ...t, deMatches, appPhase: 'bracket' };
          }),
        })),

      updateDEMatch: (matchId, updates) =>
        set(s => ({
          tournaments: updateCurrent(s.tournaments, s.currentId, t => ({
            ...t,
            deMatches: t.deMatches.map(m => m.id !== matchId ? m : { ...m, ...updates }),
          })),
        })),

      confirmDEMatch: matchId => {
        const { tournaments, currentId } = get();
        const t = getCurrent(tournaments, currentId);
        if (!t) return;
        const updated = advanceWinner(t.deMatches, matchId);
        set(s => ({
          tournaments: updateCurrent(s.tournaments, s.currentId, x => ({ ...x, deMatches: updated })),
        }));
      },

      revertDEMatch: matchId => {
        const { tournaments, currentId } = get();
        const t = getCurrent(tournaments, currentId);
        if (!t) return;
        const updated = revertDEMatch(t.deMatches, matchId);
        set(s => ({
          tournaments: updateCurrent(s.tournaments, s.currentId, x => ({ ...x, deMatches: updated })),
        }));
      },

      // ── ログ ───────────────────────────────────
      saveTournamentLog: () => {
        const { tournaments, currentId, logs } = get();
        const t = getCurrent(tournaments, currentId);
        if (!t) return '';
        const logId = generateId();
        const entry: TournamentLog = {
          id: logId,
          tournamentId: t.id,
          name: t.name || '無題大会',
          date: t.date,
          weapon: t.weapon,
          gender: t.gender,
          fencerCount: t.fencers.length,
          savedAt: new Date().toISOString(),
          snapshot: JSON.parse(JSON.stringify(t)),
        };
        // 大会を「終了」状態に
        set(s => ({
          logs: [entry, ...logs],
          tournaments: updateCurrent(s.tournaments, s.currentId, x => ({ ...x, status: '終了' })),
        }));
        return logId;
      },

      deleteLog: (id) =>
        set(s => ({ logs: s.logs.filter(l => l.id !== id) })),

      restoreFromLog: (id) => {
        const { logs } = get();
        const log = logs.find(l => l.id === id);
        if (!log) return;
        const restored = migrateTournament(JSON.parse(JSON.stringify(log.snapshot)));
        set(s => {
          const exists = s.tournaments.some(t => t.id === restored.id);
          const tournaments = exists
            ? s.tournaments.map(t => t.id === restored.id ? restored : t)
            : [restored, ...s.tournaments];
          return { tournaments, currentId: restored.id };
        });
      },

      // ── レガシー互換（単一大会のJSON） ─────────
      exportJSON: () => {
        const { tournaments, currentId } = get();
        const t = getCurrent(tournaments, currentId);
        return JSON.stringify(t ?? {}, null, 2);
      },

      importJSON: (json) => {
        get().importTournamentJSON(json);
      },

      resetTournament: () => {
        const t = defaultTournament();
        set(s => ({ tournaments: [t, ...s.tournaments], currentId: t.id }));
      },
    }),
    {
      name: 'fencing-tournament-v2',
      // 旧キー（fencing-tournament）からのマイグレーション
      onRehydrateStorage: () => (state) => {
        if (!state) return;
        // マイグレーション: 旧ストレージには tournaments が無い場合がある
        if (!state.tournaments) {
          state.tournaments = [];
        }
        // 各大会のフィールドを安全にマイグレーション
        state.tournaments = state.tournaments.map(t => migrateTournament(t));
      },
    }
  )
);

// 現在の大会を取得するセレクター（コンポーネントで使用）
export function useTournament() {
  const { tournaments, currentId } = useStore();
  return tournaments.find(t => t.id === currentId) ?? null;
}
