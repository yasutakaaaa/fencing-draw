import { create } from 'zustand';
import type { User } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase';
import type {
  Tournament, TournamentEvent, EventStatus,
  Fencer, Bout, DEMatch, AppPhase, TournamentLog, TournamentStatus,
  PhaseConfig, PoolPhaseConfig, DEPhaseConfig, PhaseRuntime, DEPhaseRuntime,
  Pool, FencerStats, Weapon, Gender, AgeCategory, TournamentFormat,
} from '../types';

export function categoryLabel(t: { weapon: Weapon; gender: Gender; ageCategory: AgeCategory; ageCategoryCustom?: string; format?: TournamentFormat }): string {
  const age = t.ageCategory === 'その他' ? (t.ageCategoryCustom || 'その他') : t.ageCategory;
  const fmt = t.format && t.format !== '個人' ? ` ${t.format}` : '';
  return `${age} ${t.gender}${fmt} ${t.weapon}`;
}

import { assignPools } from '../utils/pooling';
import { calcGlobalStats, applyAdvancement } from '../utils/ranking';
import { buildBracket, advanceWinner, revertDEMatch as revertDEMatchUtil } from '../utils/bracket';

function generateId() {
  return Math.random().toString(36).slice(2, 10);
}

// ── デフォルト作成 ────────────────────────────────────────────────────
function defaultPhases(): PhaseConfig[] {
  return [
    { id: generateId(), type: 'pool', maxPoolSize: 7, advancement: { type: 'percent', value: 70 } },
    { id: generateId(), type: 'de', thirdPlace: true, classification: false, classificationPlacements: [] },
  ];
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
    format: '個人',
    status: '準備中',
    fencers: [],
    phases: defaultPhases(),
    phaseRuntimes: [],
    activePhaseIdx: -1,
  };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function migrateTournament(raw: any): Tournament {
  if (Array.isArray(raw.phases)) {
    const fencers = (raw.fencers ?? []).map((f: any) => {
      const { note: _n, ...rest } = f;
      return rest as Fencer;
    });
    return {
      ...raw,
      fencers,
      ageCategory: raw.ageCategory ?? 'シニア',
      ageCategoryCustom: raw.ageCategoryCustom ?? '',
      format: raw.format ?? '個人',
      status: raw.status ?? '準備中',
      // DEPhaseConfig後方互換: classificationPlacements が未設定の場合補完
      phases: Array.isArray(raw.phases) ? raw.phases.map((p: PhaseConfig) =>
        p.type === 'de' && !(p as DEPhaseConfig).classificationPlacements
          ? { ...(p as DEPhaseConfig), classificationPlacements: [] }
          : p
      ) : raw.phases,
    } as Tournament;
  }

  const poolPhaseId = generateId();
  const dePhaseId = generateId();
  const phases: PhaseConfig[] = [];
  const phaseRuntimes: PhaseRuntime[] = [];

  if (raw.poolPhase) {
    phases.push({
      id: poolPhaseId, type: 'pool',
      maxPoolSize: raw.poolPhase.maxPoolSize ?? 7,
      advancement: raw.poolPhase.advancement ?? { type: 'percent', value: 70 },
    });
    const pools: Pool[] = raw.pools ?? [];
    if (pools.length > 0) {
      const inputFencerIds = pools.flatMap((p: Pool) => p.fencerIds);
      phaseRuntimes.push({
        phaseId: poolPhaseId, type: 'pool', pools,
        subPhase: raw.appPhase === 'advancement' ? 'advancement' : 'running',
        inputFencerIds,
      });
    }
  } else {
    phases.push({ id: poolPhaseId, type: 'pool', maxPoolSize: 7, advancement: { type: 'percent', value: 70 } });
  }

  if (raw.dePhase) {
    phases.push({ id: dePhaseId, type: 'de', thirdPlace: raw.dePhase.thirdPlace ?? true, classification: false, classificationPlacements: [] });
    const deMatches: DEMatch[] = raw.deMatches ?? [];
    if (deMatches.length > 0) {
      const firstRoundMatches = deMatches.filter((m: DEMatch) => m.round === 0 && !m.isBye);
      const inputFencerIds = firstRoundMatches.flatMap((m: DEMatch) =>
        [m.fencerAId, m.fencerBId].filter(Boolean) as string[]);
      phaseRuntimes.push({ phaseId: dePhaseId, type: 'de', deMatches, inputFencerIds });
    }
  } else {
    phases.push({ id: dePhaseId, type: 'de', thirdPlace: true, classification: false, classificationPlacements: [] });
  }

  let activePhaseIdx = -1;
  if (raw.appPhase === 'pool' || raw.appPhase === 'advancement') activePhaseIdx = 0;
  else if (raw.appPhase === 'bracket') { activePhaseIdx = phases.findIndex(p => p.type === 'de'); if (activePhaseIdx === -1) activePhaseIdx = 0; }
  else if (raw.appPhase === 'results') activePhaseIdx = phases.length;

  const fencers = (raw.fencers ?? []).map((f: any) => { const { note: _n, ...rest } = f; return rest as Fencer; });

  return {
    id: raw.id ?? generateId(), name: raw.name ?? '',
    date: raw.date ?? new Date().toISOString().slice(0, 10),
    weapon: raw.weapon ?? 'フルーレ', gender: raw.gender ?? '男子',
    ageCategory: raw.ageCategory ?? 'シニア', ageCategoryCustom: raw.ageCategoryCustom ?? '',
    format: raw.format ?? '個人',
    status: raw.status ?? '準備中', fencers, phases, phaseRuntimes, activePhaseIdx,
  };
}

// ── Helpers ───────────────────────────────────────────────────────────
function getCurrent(tournaments: Tournament[], currentId: string | null): Tournament | undefined {
  return tournaments.find(t => t.id === currentId);
}
function updateCurrent(tournaments: Tournament[], currentId: string | null, updater: (t: Tournament) => Tournament): Tournament[] {
  return tournaments.map(t => (t.id === currentId ? updater(t) : t));
}
function getActiveConfig(t: Tournament): PhaseConfig | null {
  if (t.activePhaseIdx < 0 || t.activePhaseIdx >= t.phases.length) return null;
  return t.phases[t.activePhaseIdx];
}
function getActiveRuntime(t: Tournament): PhaseRuntime | null {
  const config = getActiveConfig(t);
  if (!config) return null;
  return t.phaseRuntimes.find(r => r.phaseId === config.id) ?? null;
}
function computeAdvancedFencerIds(t: Tournament): string[] {
  const config = getActiveConfig(t);
  const runtime = getActiveRuntime(t);
  if (!config || config.type !== 'pool' || !runtime || runtime.type !== 'pool') return t.fencers.map(f => f.id);
  const stats = calcGlobalStats(runtime.pools, t.fencers);
  const advancement = config.advancement;
  if (!advancement) return stats.sort((a, b) => a.globalRank - b.globalRank).map(s => s.fencerId);
  const withAdv = applyAdvancement(stats, advancement.type, advancement.value, runtime.inputFencerIds.length);
  return withAdv.filter(s => s.advanced).sort((a, b) => a.globalRank - b.globalRank).map(s => s.fencerId);
}

// ── Supabase 読み込みパーサー ──────────────────────────────────────────
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function parseSupabaseRows(rows: any[]): { events: TournamentEvent[]; tournaments: Tournament[] } {
  const events: TournamentEvent[] = [];
  const tournaments: Tournament[] = [];

  for (const row of rows) {
    const data = row.data ?? {};
    events.push({
      id: row.id,
      ownerId: row.owner_id ?? undefined,
      name: row.name ?? '',
      date: row.date ?? '',
      venue: data.venue ?? '',
      status: (row.status as EventStatus) ?? '未',
      pin: data.pin ?? '',
      categoryIds: data.categoryIds ?? [],
    });
    const categories: Record<string, unknown> = data.categories ?? {};
    for (const cat of Object.values(categories)) {
      tournaments.push(migrateTournament(cat));
    }
  }

  return { events, tournaments };
}

export type SaveStatus = 'idle' | 'saving' | 'saved' | 'error';
export type ViewMode = 'admin' | 'viewer';

interface StoreState {
  // ── Auth ──────────────────────────────────────────────────
  user: User | null;
  isLoading: boolean;
  saveStatus: SaveStatus;
  hasLocalData: boolean;

  // ── データ ────────────────────────────────────────────────
  events: TournamentEvent[];
  tournaments: Tournament[];
  currentId: string | null;
  currentEventId: string | null;
  viewMode: ViewMode;
  logs: TournamentLog[];

  // ── Realtime / 同時編集 ────────────────────────────────────
  lastUpdated: Date | null;
  conflictWarning: boolean;
  dismissConflict: () => void;

  // ── Auth アクション ────────────────────────────────────────
  initializeStore: () => Promise<void>;
  signIn: (email: string, password: string) => Promise<{ error?: string }>;
  signUp: (email: string, password: string) => Promise<{ error?: string }>;
  signOut: () => Promise<void>;
  migrateFromLocalStorage: () => Promise<void>;

  // ── イベント管理 ────────────────────────────────────────────
  createEvent: (data: Omit<TournamentEvent, 'id' | 'categoryIds' | 'ownerId'>) => string;
  updateEvent: (id: string, updates: Partial<Omit<TournamentEvent, 'id' | 'categoryIds' | 'ownerId'>>) => void;
  deleteEvent: (id: string) => Promise<void>;
  addCategory: (eventId: string, weapon: Weapon, gender: Gender, ageCategory: AgeCategory, ageCategoryCustom?: string, format?: TournamentFormat) => string;
  removeCategory: (categoryId: string) => void;

  // ── ホーム画面 ──────────────────────────────────────────────
  openEvent: (eventId: string) => void;
  closeEvent: () => void;
  createTournament: () => void;
  openTournament: (id: string) => void;
  closeTournament: () => void;
  duplicateTournament: (id: string) => void;
  deleteTournament: (id: string) => void;
  setTournamentStatus: (id: string, status: TournamentStatus) => void;
  exportTournamentJSON: (id: string) => string;
  importTournamentJSON: (json: string) => void;

  // ── 閲覧モード ──────────────────────────────────────────────
  setViewMode: (mode: ViewMode) => void;

  // ── 大会設定 ────────────────────────────────────────────────
  setTournamentField: (field: keyof Tournament, value: unknown) => void;
  setPhases: (phases: PhaseConfig[]) => void;
  updatePhaseConfig: (phaseId: string, updates: Partial<PoolPhaseConfig> | Partial<DEPhaseConfig>) => void;
  setPoolPhaseField: <K extends string>(key: K, value: unknown) => void;
  setDEPhaseField: <K extends string>(key: K, value: unknown) => void;

  // ── 選手管理 ────────────────────────────────────────────────
  addFencer: (fencer: Omit<Fencer, 'id'>) => void;
  updateFencer: (id: string, fencer: Partial<Omit<Fencer, 'id'>>) => void;
  deleteFencer: (id: string) => void;
  importFencers: (fencers: Omit<Fencer, 'id'>[]) => void;

  // ── フェーズ遷移 ────────────────────────────────────────────
  startFirstPhase: () => void;
  setPoolSubPhase: (sub: 'running' | 'advancement') => void;
  startNextPhase: () => void;
  goBackToEntry: () => void;
  goToPreviousPhase: () => void;

  // ── レガシー互換 ────────────────────────────────────────────
  generatePools: () => void;
  generateBracket: () => void;
  setAppPhase: (phase: AppPhase) => void;

  // ── プール操作 ──────────────────────────────────────────────
  updateBout: (poolId: string, boutId: string, updates: Partial<Bout>) => void;
  setBoutPiste: (poolId: string, boutId: string, pisteNumber: number | undefined) => void;
  setFencerWithdrawn: (poolId: string, fencerId: string, withdrawn: boolean) => void;

  // ── DEブラケット ────────────────────────────────────────────
  updateDEMatch: (matchId: string, updates: Partial<DEMatch>) => void;
  confirmDEMatch: (matchId: string) => void;
  revertDEMatch: (matchId: string) => void;

  // ── ログ ────────────────────────────────────────────────────
  saveTournamentLog: () => string;
  deleteLog: (id: string) => void;
  restoreFromLog: (id: string) => void;

  // ── レガシー ────────────────────────────────────────────────
  exportJSON: () => string;
  importJSON: (json: string) => void;
  resetTournament: () => void;
}

export const useStore = create<StoreState>()((set, get) => {
  // ── Supabase 保存ヘルパー ──────────────────────────────────
  const saveTimers = new Map<string, ReturnType<typeof setTimeout>>();
  // 自分が起動した保存を Realtime ループから区別するフラグ
  let selfSaving = false;

  async function saveEvent(eventId: string) {
    const { events, tournaments, user } = get();
    if (!user) return;
    const event = events.find(e => e.id === eventId);
    if (!event) return;

    const categories: Record<string, Tournament> = {};
    event.categoryIds.forEach(catId => {
      const t = tournaments.find(t => t.id === catId);
      if (t) categories[catId] = t;
    });

    set({ saveStatus: 'saving' });
    selfSaving = true;
    try {
      const { error } = await supabase.from('tournaments').upsert({
        id: event.id,
        owner_id: user.id,
        name: event.name,
        date: event.date || null,
        status: event.status,
        data: { venue: event.venue, pin: event.pin, categoryIds: event.categoryIds, categories },
      }, { onConflict: 'id' });
      if (error) throw error;
      set({ saveStatus: 'saved', lastUpdated: new Date() });
      setTimeout(() => { if (get().saveStatus === 'saved') set({ saveStatus: 'idle' }); }, 2500);
    } catch (err) {
      console.error('[FencingDraw] Save failed:', err);
      set({ saveStatus: 'error' });
    } finally {
      setTimeout(() => { selfSaving = false; }, 3000);
    }
  }

  function scheduleSave(eventId: string, delay = 1500) {
    if (saveTimers.has(eventId)) clearTimeout(saveTimers.get(eventId)!);
    saveTimers.set(eventId, setTimeout(() => {
      saveTimers.delete(eventId);
      saveEvent(eventId);
    }, delay));
  }

  function saveCurrentEvent(immediate = false) {
    const { currentId, tournaments } = get();
    if (!currentId) return;
    const t = tournaments.find(x => x.id === currentId);
    if (!t?.eventId) return;
    if (immediate) saveEvent(t.eventId);
    else scheduleSave(t.eventId);
  }

  // ── localStorage マイグレーション検出 ─────────────────────
  const LS_KEY = 'fencing-tournament-v2';
  const hasLocalData = !!localStorage.getItem(LS_KEY);

  return {
    user: null,
    isLoading: true,
    saveStatus: 'idle',
    hasLocalData,
    events: [],
    tournaments: [],
    currentId: null,
    currentEventId: null,
    viewMode: 'viewer',
    logs: [],
    lastUpdated: null,
    conflictWarning: false,

    // ── Auth ────────────────────────────────────────────────
    initializeStore: async () => {
      set({ isLoading: true });
      try {
        const { data: { session } } = await supabase.auth.getSession();
        const { data: rows, error } = await supabase
          .from('tournaments')
          .select('id, owner_id, name, date, status, data')
          .order('created_at', { ascending: false });
        if (error) throw error;
        const { events, tournaments } = parseSupabaseRows(rows ?? []);
        set({
          user: session?.user ?? null,
          events,
          tournaments,
          isLoading: false,
          lastUpdated: new Date(),
          hasLocalData: !!localStorage.getItem(LS_KEY),
        });

        // ── Supabase Realtime 購読 ──────────────────────────
        supabase
          .channel('fencing-draw-realtime')
          .on('postgres_changes', { event: '*', schema: 'public', table: 'tournaments' }, (payload) => {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const newRow = (payload as any).new;
            if (!newRow?.id) return;

            // 自分自身の保存による Realtime は無視（ループ防止）
            if (selfSaving) return;

            const { events: curEvents, viewMode, currentId, tournaments: curTournaments } = get();
            const affectedEvent = curEvents.find(e => e.id === newRow.id);
            if (!affectedEvent) {
              // 新しい大会が追加された場合：再ロード
              get().initializeStore();
              return;
            }

            // 管理モードで編集中のイベントが更新された → 競合警告
            if (viewMode === 'admin' && currentId) {
              const ct = curTournaments.find(t => t.id === currentId);
              if (ct?.eventId === newRow.id) {
                set({ conflictWarning: true });
                return; // 管理モード中は自動上書きしない
              }
            }

            // 閲覧モード: データを更新
            const { events: updatedEvents, tournaments: updatedTournaments } = parseSupabaseRows([newRow]);
            set(s => ({
              events: s.events.map(e => e.id === newRow.id ? (updatedEvents[0] ?? e) : e),
              tournaments: s.tournaments.map(t => {
                const updated = updatedTournaments.find(ut => ut.id === t.id);
                // 現在編集中の tournament は上書きしない
                if (s.viewMode === 'admin' && t.id === s.currentId) return t;
                return updated ?? t;
              }),
              lastUpdated: new Date(),
            }));
          })
          .subscribe();

      } catch (err) {
        console.error('[FencingDraw] Load failed:', err);
        set({ isLoading: false });
      }
    },

    dismissConflict: () => set({ conflictWarning: false }),

    signIn: async (email, password) => {
      const { data, error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) return { error: error.message };
      set({ user: data.user });
      await get().initializeStore();
      return {};
    },

    signUp: async (email, password) => {
      const { data, error } = await supabase.auth.signUp({ email, password });
      if (error) return { error: error.message };
      set({ user: data.user ?? null });
      return {};
    },

    signOut: async () => {
      await supabase.auth.signOut();
      set({ user: null, currentId: null, currentEventId: null, viewMode: 'viewer' });
    },

    migrateFromLocalStorage: async () => {
      const { user } = get();
      if (!user) return;
      const raw = localStorage.getItem(LS_KEY);
      if (!raw) { set({ hasLocalData: false }); return; }
      try {
        const parsed = JSON.parse(raw);
        const state = parsed.state ?? parsed;
        const oldEvents: TournamentEvent[] = Array.isArray(state.events) ? state.events : [];
        const oldTournaments: Tournament[] = (Array.isArray(state.tournaments) ? state.tournaments : []).map(migrateTournament);

        // すでに unlinked な tournament を event でラップ
        if (oldEvents.length === 0) {
          for (const t of oldTournaments) {
            if (!t.eventId) {
              const eid = generateId();
              t.eventId = eid;
              oldEvents.push({
                id: eid, name: t.name || '無題大会', date: t.date, venue: '', pin: '',
                status: (t.status === '終了' ? '終了' : t.status === '進行中' ? '実施中' : '未') as EventStatus,
                categoryIds: [t.id],
              });
            }
          }
        }

        for (const event of oldEvents) {
          const categories: Record<string, Tournament> = {};
          event.categoryIds.forEach(id => {
            const t = oldTournaments.find(t => t.id === id);
            if (t) categories[id] = t;
          });
          await supabase.from('tournaments').upsert({
            id: event.id, owner_id: user.id,
            name: event.name, date: event.date || null, status: event.status,
            data: { venue: event.venue, pin: event.pin, categoryIds: event.categoryIds, categories },
          }, { onConflict: 'id' });
        }

        localStorage.removeItem(LS_KEY);
        set({ hasLocalData: false });
        await get().initializeStore();
      } catch (err) {
        console.error('[FencingDraw] Migration failed:', err);
      }
    },

    // ── イベント管理 ────────────────────────────────────────
    createEvent: (data) => {
      const { user } = get();
      const id = generateId();
      const event: TournamentEvent = { ...data, id, categoryIds: [], ownerId: user?.id };
      set(s => ({ events: [event, ...s.events] }));
      saveEvent(id);
      return id;
    },

    updateEvent: (id, updates) => {
      set(s => ({ events: s.events.map(e => e.id === id ? { ...e, ...updates } : e) }));
      scheduleSave(id, 500);
    },

    deleteEvent: async (id) => {
      const { events } = get();
      const event = events.find(e => e.id === id);
      if (!event) return;
      const keepIds = new Set(event.categoryIds);
      set(s => ({
        events: s.events.filter(e => e.id !== id),
        tournaments: s.tournaments.filter(t => !keepIds.has(t.id)),
        currentId: keepIds.has(s.currentId ?? '') ? null : s.currentId,
        currentEventId: s.currentEventId === id ? null : s.currentEventId,
      }));
      await supabase.from('tournaments').delete().eq('id', id);
    },

    addCategory: (eventId, weapon, gender, ageCategory, ageCategoryCustom = '', format = '個人') => {
      const t = defaultTournament();
      const category: Tournament = { ...t, eventId, weapon, gender, ageCategory, ageCategoryCustom, format, name: '' };
      set(s => ({
        tournaments: [...s.tournaments, category],
        events: s.events.map(e => e.id === eventId ? { ...e, categoryIds: [...e.categoryIds, category.id] } : e),
      }));
      saveEvent(eventId);
      return category.id;
    },

    removeCategory: (categoryId) => {
      const { tournaments } = get();
      const t = tournaments.find(x => x.id === categoryId);
      const eventId = t?.eventId;
      set(s => ({
        tournaments: s.tournaments.filter(t => t.id !== categoryId),
        events: s.events.map(e => ({ ...e, categoryIds: e.categoryIds.filter(id => id !== categoryId) })),
        currentId: s.currentId === categoryId ? null : s.currentId,
        currentEventId: s.currentId === categoryId ? (eventId ?? null) : s.currentEventId,
      }));
      if (eventId) saveEvent(eventId);
    },

    // ── ホーム画面 ──────────────────────────────────────────
    openEvent: (eventId) => set({ currentEventId: eventId, currentId: null }),
    closeEvent: () => set({ currentEventId: null, currentId: null }),

    createTournament: () => {
      const t = defaultTournament();
      set(s => ({ tournaments: [t, ...s.tournaments], currentId: t.id, viewMode: 'admin' }));
    },

    openTournament: (id) => {
      const { tournaments } = get();
      const t = tournaments.find(x => x.id === id);
      set({ currentId: id, viewMode: 'viewer', currentEventId: t?.eventId ?? null });
    },
    closeTournament: () => set({ currentId: null }),

    duplicateTournament: (id) => {
      const { tournaments } = get();
      const src = tournaments.find(t => t.id === id);
      if (!src) return;
      const copy: Tournament = {
        ...JSON.parse(JSON.stringify(src)), id: generateId(),
        name: `${src.name}（コピー）`, status: '準備中',
        phases: src.phases.map(p => ({ ...p, id: generateId() })),
        phaseRuntimes: [], activePhaseIdx: -1,
      };
      set(s => ({ tournaments: [copy, ...s.tournaments] }));
    },

    deleteTournament: (id) =>
      set(s => ({ tournaments: s.tournaments.filter(t => t.id !== id), currentId: s.currentId === id ? null : s.currentId })),

    setTournamentStatus: (id, status) =>
      set(s => ({ tournaments: s.tournaments.map(t => t.id === id ? { ...t, status } : t) })),

    exportTournamentJSON: (id) => JSON.stringify(get().tournaments.find(x => x.id === id) ?? {}, null, 2),

    importTournamentJSON: (json) => {
      try {
        const data = JSON.parse(json);
        const migrated = migrateTournament(data);
        set(s => {
          const exists = s.tournaments.some(t => t.id === migrated.id);
          const tournaments = exists ? s.tournaments.map(t => t.id === migrated.id ? migrated : t) : [migrated, ...s.tournaments];
          return { tournaments };
        });
        alert('インポートしました。');
      } catch { alert('JSONの読み込みに失敗しました'); }
    },

    // ── 閲覧モード ──────────────────────────────────────────
    setViewMode: (mode) => set({ viewMode: mode }),

    // ── 大会設定 ────────────────────────────────────────────
    setTournamentField: (field, value) => {
      set(s => ({ tournaments: updateCurrent(s.tournaments, s.currentId, t => ({ ...t, [field]: value })) }));
      saveCurrentEvent();
    },

    setPhases: (phases) => {
      set(s => ({ tournaments: updateCurrent(s.tournaments, s.currentId, t => ({ ...t, phases })) }));
      saveCurrentEvent();
    },

    updatePhaseConfig: (phaseId, updates) => {
      set(s => ({
        tournaments: updateCurrent(s.tournaments, s.currentId, t => ({
          ...t, phases: t.phases.map(p => p.id === phaseId ? { ...p, ...updates } as PhaseConfig : p),
        })),
      }));
      saveCurrentEvent();
    },

    setPoolPhaseField: (key, value) => {
      set(s => ({
        tournaments: updateCurrent(s.tournaments, s.currentId, t => {
          const pp = t.phases.find(p => p.type === 'pool') as PoolPhaseConfig | undefined;
          if (!pp) return t;
          return { ...t, phases: t.phases.map(p => p.id === pp.id ? { ...p, [key]: value } : p) };
        }),
      }));
      saveCurrentEvent();
    },

    setDEPhaseField: (key, value) => {
      set(s => ({
        tournaments: updateCurrent(s.tournaments, s.currentId, t => {
          const dp = t.phases.find(p => p.type === 'de') as DEPhaseConfig | undefined;
          if (!dp) return t;
          return { ...t, phases: t.phases.map(p => p.id === dp.id ? { ...p, [key]: value } : p) };
        }),
      }));
      saveCurrentEvent();
    },

    // ── 選手管理 ────────────────────────────────────────────
    addFencer: fencer => {
      set(s => ({
        tournaments: updateCurrent(s.tournaments, s.currentId, t => ({
          ...t, fencers: [...t.fencers, { ...fencer, id: generateId() }],
        })),
      }));
      saveCurrentEvent(true);
    },

    updateFencer: (id, updates) => {
      set(s => ({
        tournaments: updateCurrent(s.tournaments, s.currentId, t => ({
          ...t, fencers: t.fencers.map(f => f.id === id ? { ...f, ...updates } : f),
        })),
      }));
      saveCurrentEvent();
    },

    deleteFencer: id => {
      set(s => ({
        tournaments: updateCurrent(s.tournaments, s.currentId, t => ({
          ...t, fencers: t.fencers.filter(f => f.id !== id),
        })),
      }));
      saveCurrentEvent(true);
    },

    importFencers: fencers => {
      set(s => ({
        tournaments: updateCurrent(s.tournaments, s.currentId, t => ({
          ...t, fencers: [...t.fencers, ...fencers.map(f => ({ ...f, id: generateId() }))],
        })),
      }));
      saveCurrentEvent();
    },

    // ── フェーズ遷移 ────────────────────────────────────────
    startFirstPhase: () => {
      set(s => ({
        tournaments: updateCurrent(s.tournaments, s.currentId, t => {
          const firstConfig = t.phases[0];
          if (!firstConfig) return t;
          let newRuntime: PhaseRuntime;
          const inputFencerIds = t.fencers.map(f => f.id);
          if (firstConfig.type === 'pool') {
            const pools = assignPools(t.fencers, firstConfig.maxPoolSize);
            newRuntime = { phaseId: firstConfig.id, type: 'pool', pools, subPhase: 'running', inputFencerIds };
          } else {
            const fakeStats: FencerStats[] = t.fencers.map((f, i) => ({
              fencerId: f.id, victories: 0, matches: 0, vm: 0,
              touchesScored: 0, touchesReceived: 0, indicator: 0, poolRank: i + 1, globalRank: i + 1, advanced: true,
            }));
            const deMatches = buildBracket(fakeStats, (firstConfig as DEPhaseConfig).thirdPlace);
            newRuntime = { phaseId: firstConfig.id, type: 'de', deMatches, inputFencerIds };
          }
          const existingRuntimes = t.phaseRuntimes.filter(r => r.phaseId !== firstConfig.id);
          return { ...t, phaseRuntimes: [...existingRuntimes, newRuntime], activePhaseIdx: 0, status: '進行中' };
        }),
      }));
      saveCurrentEvent(true);
    },

    setPoolSubPhase: (sub) => {
      set(s => ({
        tournaments: updateCurrent(s.tournaments, s.currentId, t => {
          const config = getActiveConfig(t);
          if (!config || config.type !== 'pool') return t;
          return { ...t, phaseRuntimes: t.phaseRuntimes.map(r => r.phaseId === config.id && r.type === 'pool' ? { ...r, subPhase: sub } : r) };
        }),
      }));
      saveCurrentEvent(true);
    },

    startNextPhase: () => {
      set(s => ({
        tournaments: updateCurrent(s.tournaments, s.currentId, t => {
          const nextIdx = t.activePhaseIdx + 1;
          if (nextIdx >= t.phases.length) return { ...t, activePhaseIdx: t.phases.length };
          const nextConfig = t.phases[nextIdx];
          const existingRuntime = t.phaseRuntimes.find(r => r.phaseId === nextConfig.id);
          if (existingRuntime) return { ...t, activePhaseIdx: nextIdx };
          const advancedIds = computeAdvancedFencerIds(t);
          let newRuntime: PhaseRuntime;
          if (nextConfig.type === 'pool') {
            const inputFencers = advancedIds.map(id => t.fencers.find(f => f.id === id)).filter(Boolean) as Fencer[];
            const pools = assignPools(inputFencers, nextConfig.maxPoolSize);
            newRuntime = { phaseId: nextConfig.id, type: 'pool', pools, subPhase: 'running', inputFencerIds: advancedIds };
          } else {
            const fakeStats: FencerStats[] = advancedIds.map((id, i) => ({
              fencerId: id, victories: 0, matches: 0, vm: 0,
              touchesScored: 0, touchesReceived: 0, indicator: 0, poolRank: i + 1, globalRank: i + 1, advanced: true,
            }));
            const deMatches = buildBracket(fakeStats, nextConfig.thirdPlace);
            newRuntime = { phaseId: nextConfig.id, type: 'de', deMatches, inputFencerIds: advancedIds };
          }
          const existingRuntimes = t.phaseRuntimes.filter(r => r.phaseId !== nextConfig.id);
          return { ...t, phaseRuntimes: [...existingRuntimes, newRuntime], activePhaseIdx: nextIdx };
        }),
      }));
      saveCurrentEvent(true);
    },

    goBackToEntry: () => {
      set(s => ({ tournaments: updateCurrent(s.tournaments, s.currentId, t => ({ ...t, activePhaseIdx: -1 })) }));
      saveCurrentEvent(true);
    },

    goToPreviousPhase: () => {
      set(s => ({
        tournaments: updateCurrent(s.tournaments, s.currentId, t => ({ ...t, activePhaseIdx: Math.max(-1, t.activePhaseIdx - 1) })),
      }));
      saveCurrentEvent(true);
    },

    generatePools: () => get().startFirstPhase(),
    generateBracket: () => get().startNextPhase(),
    setAppPhase: (phase) => {
      const { setPoolSubPhase, goBackToEntry } = get();
      if (phase === 'entry') return goBackToEntry();
      if (phase === 'pool') return setPoolSubPhase('running');
      if (phase === 'advancement') return setPoolSubPhase('advancement');
    },

    // ── プールスコア ────────────────────────────────────────
    updateBout: (poolId, boutId, updates) => {
      set(s => ({
        tournaments: updateCurrent(s.tournaments, s.currentId, t => ({
          ...t,
          phaseRuntimes: t.phaseRuntimes.map(r =>
            r.type !== 'pool' ? r : {
              ...r,
              pools: r.pools.map(p =>
                p.id !== poolId ? p : { ...p, bouts: p.bouts.map(b => b.id !== boutId ? b : { ...b, ...updates }) }
              ),
            }
          ),
        })),
      }));
      saveCurrentEvent(); // debounced 1.5s
    },

    setBoutPiste: (poolId, boutId, pisteNumber) => {
      set(s => ({
        tournaments: updateCurrent(s.tournaments, s.currentId, t => ({
          ...t,
          phaseRuntimes: t.phaseRuntimes.map(r =>
            r.type !== 'pool' ? r : {
              ...r,
              pools: r.pools.map(p =>
                p.id !== poolId ? p : {
                  ...p,
                  bouts: p.bouts.map(b => b.id !== boutId ? b : { ...b, pisteNumber }),
                }
              ),
            }
          ),
        })),
      }));
      saveCurrentEvent(true);
    },

    setFencerWithdrawn: (poolId, fencerId, withdrawn) => {
      set(s => ({
        tournaments: updateCurrent(s.tournaments, s.currentId, t => ({
          ...t,
          phaseRuntimes: t.phaseRuntimes.map(r =>
            r.type !== 'pool' ? r : {
              ...r,
              pools: r.pools.map(p => {
                if (p.id !== poolId) return p;
                const current = p.withdrawnFencerIds ?? [];
                const next = withdrawn
                  ? [...new Set([...current, fencerId])]
                  : current.filter(id => id !== fencerId);
                return { ...p, withdrawnFencerIds: next };
              }),
            }
          ),
        })),
      }));
      saveCurrentEvent(true);
    },

    // ── DEブラケット ────────────────────────────────────────
    updateDEMatch: (matchId, updates) => {
      set(s => ({
        tournaments: updateCurrent(s.tournaments, s.currentId, t => ({
          ...t,
          phaseRuntimes: t.phaseRuntimes.map(r =>
            r.type !== 'de' ? r : { ...r, deMatches: r.deMatches.map(m => m.id !== matchId ? m : { ...m, ...updates }) }
          ),
        })),
      }));
      saveCurrentEvent();
    },

    confirmDEMatch: matchId => {
      const { tournaments, currentId } = get();
      const t = getCurrent(tournaments, currentId);
      if (!t) return;
      const deRuntime = getActiveRuntime(t) as DEPhaseRuntime | null;
      if (!deRuntime || deRuntime.type !== 'de') return;
      const updated = advanceWinner(deRuntime.deMatches, matchId);
      set(s => ({
        tournaments: updateCurrent(s.tournaments, s.currentId, x => ({
          ...x, phaseRuntimes: x.phaseRuntimes.map(r => r.phaseId === deRuntime.phaseId ? { ...r, deMatches: updated } : r),
        })),
      }));
      saveCurrentEvent(true);
    },

    revertDEMatch: matchId => {
      const { tournaments, currentId } = get();
      const t = getCurrent(tournaments, currentId);
      if (!t) return;
      const deRuntime = getActiveRuntime(t) as DEPhaseRuntime | null;
      if (!deRuntime || deRuntime.type !== 'de') return;
      const updated = revertDEMatchUtil(deRuntime.deMatches, matchId);
      set(s => ({
        tournaments: updateCurrent(s.tournaments, s.currentId, x => ({
          ...x, phaseRuntimes: x.phaseRuntimes.map(r => r.phaseId === deRuntime.phaseId ? { ...r, deMatches: updated } : r),
        })),
      }));
      saveCurrentEvent(true);
    },

    // ── ログ ────────────────────────────────────────────────
    saveTournamentLog: () => {
      const { tournaments, currentId, logs } = get();
      const t = getCurrent(tournaments, currentId);
      if (!t) return '';
      const logId = generateId();
      const entry: TournamentLog = {
        id: logId, tournamentId: t.id,
        name: t.name || '無題大会', date: t.date, weapon: t.weapon, gender: t.gender,
        fencerCount: t.fencers.length, savedAt: new Date().toISOString(),
        snapshot: JSON.parse(JSON.stringify(t)),
      };
      set(s => ({
        logs: [entry, ...logs],
        tournaments: updateCurrent(s.tournaments, s.currentId, x => ({ ...x, status: '終了' })),
      }));
      saveCurrentEvent(true);
      return logId;
    },

    deleteLog: (id) => set(s => ({ logs: s.logs.filter(l => l.id !== id) })),

    restoreFromLog: (id) => {
      const { logs } = get();
      const log = logs.find(l => l.id === id);
      if (!log) return;
      const restored = migrateTournament(JSON.parse(JSON.stringify(log.snapshot)));
      set(s => {
        const exists = s.tournaments.some(t => t.id === restored.id);
        const tournaments = exists ? s.tournaments.map(t => t.id === restored.id ? restored : t) : [restored, ...s.tournaments];
        return { tournaments, currentId: restored.id };
      });
      saveCurrentEvent(true);
    },

    // ── レガシー ────────────────────────────────────────────
    exportJSON: () => {
      const { tournaments, currentId } = get();
      return JSON.stringify(getCurrent(tournaments, currentId) ?? {}, null, 2);
    },
    importJSON: (json) => get().importTournamentJSON(json),
    resetTournament: () => {
      const t = defaultTournament();
      set(s => ({ tournaments: [t, ...s.tournaments], currentId: t.id }));
    },
  };
});

// ── useTournament: 後方互換フィールド付きで返す ────────────────────────
export function useTournament() {
  const { tournaments, currentId } = useStore();
  const raw = tournaments.find(t => t.id === currentId);
  if (!raw) return null;

  const isResultsPhase = raw.activePhaseIdx >= raw.phases.length;
  const activeConfig = (!isResultsPhase && raw.activePhaseIdx >= 0) ? raw.phases[raw.activePhaseIdx] : null;
  const activeRuntime = activeConfig ? raw.phaseRuntimes.find(r => r.phaseId === activeConfig.id) ?? null : null;

  const lastPoolRuntime = [...raw.phaseRuntimes].reverse().find(r => r.type === 'pool') ?? null;
  const lastDeRuntime   = [...raw.phaseRuntimes].reverse().find(r => r.type === 'de')   ?? null;

  const pools = activeRuntime?.type === 'pool' ? activeRuntime.pools
    : (lastPoolRuntime?.type === 'pool' ? lastPoolRuntime.pools : []);
  const deMatches = activeRuntime?.type === 'de' ? activeRuntime.deMatches
    : (lastDeRuntime?.type === 'de' ? lastDeRuntime.deMatches : []);

  const lastPoolConfig = lastPoolRuntime ? raw.phases.find(p => p.id === lastPoolRuntime.phaseId) as PoolPhaseConfig | undefined : undefined;
  const lastDeConfig   = lastDeRuntime   ? raw.phases.find(p => p.id === lastDeRuntime.phaseId)   as DEPhaseConfig   | undefined : undefined;

  const poolPhase = (activeConfig?.type === 'pool' ? activeConfig : lastPoolConfig) ?? null;
  const dePhase   = (activeConfig?.type === 'de'   ? activeConfig : lastDeConfig)   ?? null;

  let appPhase: AppPhase;
  if (raw.activePhaseIdx === -1) appPhase = 'entry';
  else if (isResultsPhase) appPhase = 'results';
  else if (activeConfig?.type === 'pool') appPhase = (activeRuntime?.type === 'pool' && activeRuntime.subPhase === 'advancement') ? 'advancement' : 'pool';
  else appPhase = 'bracket';

  return {
    ...raw, appPhase, pools, deMatches,
    poolPhase: (poolPhase ?? { id: '', type: 'pool' as const, maxPoolSize: 7, advancement: { type: 'percent' as const, value: 70 } }),
    dePhase:   (dePhase   ?? { id: '', type: 'de'   as const, thirdPlace: true, classification: false, classificationPlacements: [] }),
  };
}
