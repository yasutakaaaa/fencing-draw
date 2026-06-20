export type Weapon = 'フルーレ' | 'エペ' | 'サーブル';
export type Gender = '男子' | '女子' | '混合';
export type PhaseType = 'pool' | 'de';
export type AdvancementType = 'percent' | 'count';
export type AppPhase = 'entry' | 'pool' | 'advancement' | 'bracket' | 'results';

export interface Fencer {
  id: string;
  lastName: string;
  firstName: string;
  lastNameKana: string;
  firstNameKana: string;
  club: string;
  note?: string; // 競技歴
}

export interface Bout {
  id: string;
  fencerAId: string;
  fencerBId: string;
  scoreA: number | null;
  scoreB: number | null;
  winner: 'A' | 'B' | null;
}

export interface Pool {
  id: string;
  index: number;
  fencerIds: string[];
  bouts: Bout[];
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
}

export interface PoolPhaseConfig {
  type: 'pool';
  maxPoolSize: number;
  advancement: { type: AdvancementType; value: number };
}

export interface DEPhaseConfig {
  type: 'de';
  thirdPlace: boolean;
}

export type PhaseConfig = PoolPhaseConfig | DEPhaseConfig;

export interface Tournament {
  id: string;
  name: string;
  date: string;
  weapon: Weapon;
  gender: Gender;
  showCompetitiveHistory: boolean;
  fencers: Fencer[];
  poolPhase: PoolPhaseConfig;
  dePhase: DEPhaseConfig;
  pools: Pool[];
  deMatches: DEMatch[];
  appPhase: AppPhase;
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
