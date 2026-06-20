import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { Tournament, Fencer, Bout, DEMatch, AppPhase, TournamentLog } from '../types';
import { assignPools } from '../utils/pooling';
import { calcGlobalStats, applyAdvancement } from '../utils/ranking';
import { buildBracket, advanceWinner, revertDEMatch } from '../utils/bracket';

function generateId() {
  return Math.random().toString(36).slice(2, 10);
}

function defaultTournament(): Tournament {
  return {
    id: generateId(),
    name: '',
    date: new Date().toISOString().slice(0, 10),
    weapon: 'フルーレ',
    gender: '男子',
    showCompetitiveHistory: false,
    fencers: [],
    poolPhase: { type: 'pool', maxPoolSize: 7, advancement: { type: 'percent', value: 70 } },
    dePhase: { type: 'de', thirdPlace: true },
    pools: [],
    deMatches: [],
    appPhase: 'entry',
  };
}

interface StoreState {
  tournament: Tournament;
  logs: TournamentLog[];

  // Tournament setup
  setTournamentField: (field: keyof Tournament, value: unknown) => void;
  setPoolPhaseField: <K extends keyof Tournament['poolPhase']>(key: K, value: Tournament['poolPhase'][K]) => void;
  setDEPhaseField: <K extends keyof Tournament['dePhase']>(key: K, value: Tournament['dePhase'][K]) => void;

  // Entry management
  addFencer: (fencer: Omit<Fencer, 'id'>) => void;
  updateFencer: (id: string, fencer: Partial<Omit<Fencer, 'id'>>) => void;
  deleteFencer: (id: string) => void;
  importFencers: (fencers: Omit<Fencer, 'id'>[]) => void;

  // Phase transitions
  generatePools: () => void;
  setAppPhase: (phase: AppPhase) => void;

  // Pool scoring
  updateBout: (poolId: string, boutId: string, updates: Partial<Bout>) => void;

  // DE bracket
  generateBracket: () => void;
  updateDEMatch: (matchId: string, updates: Partial<DEMatch>) => void;
  confirmDEMatch: (matchId: string) => void;
  revertDEMatch: (matchId: string) => void;

  // Log
  saveTournamentLog: () => string;
  deleteLog: (id: string) => void;
  restoreFromLog: (id: string) => void;

  // Persistence
  exportJSON: () => string;
  importJSON: (json: string) => void;
  resetTournament: () => void;
}

export const useStore = create<StoreState>()(
  persist(
    (set, get) => ({
      tournament: defaultTournament(),
      logs: [],

      setTournamentField: (field, value) =>
        set(s => ({ tournament: { ...s.tournament, [field]: value } })),

      setPoolPhaseField: (key, value) =>
        set(s => ({
          tournament: {
            ...s.tournament,
            poolPhase: { ...s.tournament.poolPhase, [key]: value },
          },
        })),

      setDEPhaseField: (key, value) =>
        set(s => ({
          tournament: {
            ...s.tournament,
            dePhase: { ...s.tournament.dePhase, [key]: value },
          },
        })),

      addFencer: fencer =>
        set(s => ({
          tournament: {
            ...s.tournament,
            fencers: [...s.tournament.fencers, { ...fencer, id: generateId() }],
          },
        })),

      updateFencer: (id, updates) =>
        set(s => ({
          tournament: {
            ...s.tournament,
            fencers: s.tournament.fencers.map(f => (f.id === id ? { ...f, ...updates } : f)),
          },
        })),

      deleteFencer: id =>
        set(s => ({
          tournament: {
            ...s.tournament,
            fencers: s.tournament.fencers.filter(f => f.id !== id),
          },
        })),

      importFencers: fencers =>
        set(s => ({
          tournament: {
            ...s.tournament,
            fencers: [
              ...s.tournament.fencers,
              ...fencers.map(f => ({ ...f, id: generateId() })),
            ],
          },
        })),

      generatePools: () =>
        set(s => {
          const pools = assignPools(s.tournament.fencers, s.tournament.poolPhase.maxPoolSize);
          return { tournament: { ...s.tournament, pools, appPhase: 'pool' } };
        }),

      setAppPhase: phase =>
        set(s => ({ tournament: { ...s.tournament, appPhase: phase } })),

      updateBout: (poolId, boutId, updates) =>
        set(s => ({
          tournament: {
            ...s.tournament,
            pools: s.tournament.pools.map(p =>
              p.id !== poolId
                ? p
                : {
                    ...p,
                    bouts: p.bouts.map(b => (b.id !== boutId ? b : { ...b, ...updates })),
                  }
            ),
          },
        })),

      generateBracket: () =>
        set(s => {
          const t = s.tournament;
          const globalStats = calcGlobalStats(t.pools, t.fencers);
          const withAdvancement = applyAdvancement(
            globalStats,
            t.poolPhase.advancement.type,
            t.poolPhase.advancement.value,
            t.fencers.length
          );
          const deMatches = buildBracket(withAdvancement, t.dePhase.thirdPlace);
          return { tournament: { ...t, deMatches, appPhase: 'bracket' } };
        }),

      updateDEMatch: (matchId, updates) =>
        set(s => ({
          tournament: {
            ...s.tournament,
            deMatches: s.tournament.deMatches.map(m =>
              m.id !== matchId ? m : { ...m, ...updates }
            ),
          },
        })),

      confirmDEMatch: matchId => {
        const { tournament } = get();
        const updated = advanceWinner(tournament.deMatches, matchId);
        set({ tournament: { ...tournament, deMatches: updated } });
      },

      revertDEMatch: matchId => {
        const { tournament } = get();
        const updated = revertDEMatch(tournament.deMatches, matchId);
        set({ tournament: { ...tournament, deMatches: updated } });
      },

      saveTournamentLog: () => {
        const { tournament, logs } = get();
        const logId = generateId();
        const entry: TournamentLog = {
          id: logId,
          tournamentId: tournament.id,
          name: tournament.name || '無題大会',
          date: tournament.date,
          weapon: tournament.weapon,
          gender: tournament.gender,
          fencerCount: tournament.fencers.length,
          savedAt: new Date().toISOString(),
          snapshot: JSON.parse(JSON.stringify(tournament)),
        };
        set({ logs: [entry, ...logs] });
        return logId;
      },

      deleteLog: (id) =>
        set(s => ({ logs: s.logs.filter(l => l.id !== id) })),

      restoreFromLog: (id) => {
        const { logs } = get();
        const log = logs.find(l => l.id === id);
        if (log) set({ tournament: JSON.parse(JSON.stringify(log.snapshot)) });
      },

      exportJSON: () => JSON.stringify(get().tournament, null, 2),

      importJSON: json => {
        try {
          const data = JSON.parse(json) as Tournament;
          // 旧データに showCompetitiveHistory がない場合の互換対応
          if (data.showCompetitiveHistory === undefined) data.showCompetitiveHistory = false;
          set({ tournament: data });
        } catch {
          alert('JSONの読み込みに失敗しました');
        }
      },

      resetTournament: () => set({ tournament: defaultTournament() }),
    }),
    { name: 'fencing-tournament' }
  )
);
