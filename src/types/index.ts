export type Weapon = 'フルーレ' | 'エペ' | 'サーブル';
export type Gender = '男子' | '女子' | '混合';
export type AgeCategory = 'ベテラン' | 'シニア' | 'ジュニア' | 'カデ' | 'その他';
export type TournamentFormat = '個人' | '団体';
export type TournamentStatus = '準備中' | '進行中' | '終了';
export type EventStatus = '未' | '実施中' | '終了';
export type AdvancementType = 'percent' | 'count';
export type AppPhase = 'entry' | 'pool' | 'advancement' | 'bracket' | 'results';

// ── TournamentEvent（大会コンテナ）───────────────────────────────────
export interface TournamentEvent {
  id: string;
  ownerId?: string;
  name: string;
  date: string;
  venue: string;
  status: EventStatus;
  pin: string;
  categoryIds: string[];
}

export interface Fencer {
  id: string;
  lastName: string;
  firstName: string;
  lastNameKana: string;
  firstNameKana: string;
  club: string;
  grade?: string;
}

export interface Bout {
  id: string;
  fencerAId: string;
  fencerBId: string;
  scoreA: number | null;
  scoreB: number | null;
  winner: 'A' | 'B' | null;
  pisteNumber?: number;  // 試合場番号
}

export interface Pool {
  id: string;
  index: number;
  fencerIds: string[];
  bouts: Bout[];
  withdrawnFencerIds?: string[];  // 途中棄権した選手ID
}

export interface FencerStats {
  fencerId: string;
  victories: number;
  matches: number;
  vm: number;
  touchesScored: number;
  touchesReceived: number;
  indicator: number;
  poolRank: number;
  globalRank: number;
  advanced: boolean;
  withdrawn?: boolean;
}

export interface DEMatch {
  id: string;
  round: number;
  position: number;
  fencerAId: string | null;
  fencerBId: string | null;
  scoreA: number | null;
  scoreB: number | null;
  winner: 'A' | 'B' | null;
  isBye: boolean;
  isThirdPlace?: boolean;
  classificationLevel?: number;  // 5=5-8位, 9=9-16位 etc.
}

// ── Phase configs (設定のみ、データなし) ──────────────────────────────
export interface PoolPhaseConfig {
  id: string;
  type: 'pool';
  maxPoolSize: number;
  advancement: { type: AdvancementType; value: number } | null;
}

export interface DEPhaseConfig {
  id: string;
  type: 'de';
  thirdPlace: boolean;
  classification: boolean;
  classificationPlacements: number[];  // [4]=3位, [4,8]=3位+5-8位, etc.
}

export type PhaseConfig = PoolPhaseConfig | DEPhaseConfig;

// ── Phase runtimes (実行時データ) ─────────────────────────────────────
export interface PoolPhaseRuntime {
  phaseId: string;
  type: 'pool';
  pools: Pool[];
  subPhase: 'running' | 'advancement';
  inputFencerIds: string[];
}

export interface DEPhaseRuntime {
  phaseId: string;
  type: 'de';
  deMatches: DEMatch[];
  inputFencerIds: string[];
}

export type PhaseRuntime = PoolPhaseRuntime | DEPhaseRuntime;

// ── Tournament（カテゴリ）───────────────────────────────────────────────
export interface Tournament {
  id: string;
  name: string;
  eventId?: string;
  date: string;
  weapon: Weapon;
  gender: Gender;
  ageCategory: AgeCategory;
  ageCategoryCustom?: string;
  format: TournamentFormat;   // 個人 / 団体
  status: TournamentStatus;
  fencers: Fencer[];

  phases: PhaseConfig[];
  phaseRuntimes: PhaseRuntime[];
  activePhaseIdx: number;
}

export interface TournamentLog {
  id: string;
  tournamentId: string;
  name: string;
  date: string;
  weapon: Weapon;
  gender: Gender;
  fencerCount: number;
  savedAt: string;
  snapshot: Tournament;
}
