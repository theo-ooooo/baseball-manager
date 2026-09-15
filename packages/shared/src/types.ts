import type { TacticCardState } from './tactic-cards';
import type { MatchCardDraft, MatchCardSummary } from './match-cards';
import type { AugmentationState, AugmentationKind } from './augmentations';
import type { ManagerRecord } from './manager-directory';
import type { InternationalState, InternationalDuty } from './international';
import type { LineupRecommendation } from './lineup-recommendation';
import type { ManagerCareer, ClubCareer, ClubManagerJob } from './manager-career';
import type { ScoutingState } from './scouting';
import type { TrainingPlan } from './training-plan';
import type { RegistrationState } from './registrations';
import type { TrainingCenter } from './training-center';
import type { MatchCommand, MatchCommandKind } from './match-commands';
import type { MatchMediaState } from './match-media';
import type { PitchingApproach } from './pitching-tactics';
import type {
  CareerBaseline,
  PlayerCareerRecord,
  WorldSimulation,
  MedicalCase,
  TradeOffer,
  DraftState,
} from './long-term';
export type Pos = 'P' | 'C' | 'IF' | 'OF' | 'DH';
export type Stats = {
  ab: number;
  h: number;
  hr: number;
  rbi: number;
  bb: number;
  k: number;
  outs: number;
  er: number;
  wins: number;
  g: number;
  saves?: number;
  holds?: number;
  hrAllowed?: number;
  sb?: number;
  cs?: number;
  sh?: number;
};
export type Player = {
  personality?: import('./personality').PlayerPersonality;
  id: string;
  name: string;
  original: string;
  club: string;
  pos: Pos;
  age: number;
  real: boolean;
  country: string;
  number: number;
  contact: number;
  power: number;
  speed: number;
  field: number;
  stuff: number;
  control: number;
  potential: number;
  condition: number;
  marketValue?: number;
  salary: number;
  years: number;
  contractSigned?: { year: number; day: number; dealId: string };
  stats: Stats;
  squad?: 'first' | 'reserve';
  familiarity?: Partial<Record<DefensivePosition, number>>;
  positionTraining?: DefensivePosition;
  reserveStats?: Stats;
  source?: string;
  ageEstimated?: boolean;
  rating?: RatingEvidence;
  /** Verified official photo identity from D1 catalog metadata; follows the player id across clubs. */
  portrait?: PlayerPortrait;
  mood?: PlayerMood;
  development?: PlayerDevelopment;
  trainingPlan?: TrainingPlan;
  remodel?: import('./player-remodel').PlayerRemodel;
  careerBaseline?: CareerBaseline;
  injury?: MedicalCase;
  internationalDuty?: InternationalDuty;
  nationalTeam?: { country: string; identity: string };
  observation?: {
    status: 'unknown' | 'scouted';
    overall?: [number, number];
    abilities?: Partial<Record<AbilityKey, [number, number]>>;
    date?: string;
  };
};
export type AbilityKey = 'contact' | 'power' | 'speed' | 'field' | 'stuff' | 'control';
export type GrowthStage = 'growth' | 'peak' | 'decline';
export type GrowthSnapshot = {
  date: string;
  age: number;
  overall: number;
  abilities: Record<AbilityKey, number>;
};
export type PlayerDevelopment = {
  version: 1;
  pattern: 'early' | 'steady' | 'late' | 'durable';
  stage: GrowthStage;
  // Simulation parameters are server-only, including when potential is revealed.
  curve?: { peak: number; decline: number; growth: number; durability: number };
  history: GrowthSnapshot[];
  lastTrained?: string;
  lastGames: { year: number; first: number; reserve: number };
};
export type Coach = {
  managerPersonId?: string;
  id: string;
  name: string;
  role: string;
  skill: number;
  salary: number;
  style: string;
  real?: boolean;
  sourceClub?: string;
  source?: string;
  verifiedRole?: string;
  contractUntil?: number;
};
export type Standing = {
  club: string;
  w: number;
  l: number;
  d: number;
  rf: number;
  ra: number;
  form: string[];
};
export type Result = {
  duel?: import('./tactical-duel').TacticalDuel;
  story?: import('./career-engagement').MatchStory;
  weather?: import('./match-weather').MatchWeather;
  managerReview?: {
    version: 1;
    club: string;
    commands: MatchCommand[];
    changes: MatchChange[];
    reunions?: { id: string; name: string }[];
  };

  matchCards?: MatchCardSummary;
  augmentation?: AugmentationKind;
  delegatedBy?: string;
  id: string;
  day: number;
  home: string;
  away: string;
  homeScore: number;
  awayScore: number;
  innings: (number | null)[][];
  hits: number[];
  errors: number[];
  log: { inning: number; half: number; text: string; score: number[]; play?: ReplayPlay }[];
  replayTeams?: [ReplayTeam, ReplayTeam];
  mvp: string;
  post?: boolean;
  friendly?: boolean;
  date?: string;
  fixtureId?: string;
};
export type NegotiationStatus =
  'pending' | 'accepted' | 'counter' | 'rejected' | 'withdrawn' | 'expired';
export type NegotiationRound = {
  day: number;
  year: number;
  salary: number;
  years: number;
  message: string;
  side?: 'club' | 'player';
};
export type Deal = {
  id: string;
  player: Player;
  type: 'buy' | 'renew';
  salary: number;
  years: number;
  fee: number;
  agentFee: number;
  status: NegotiationStatus;
  message: string;
  day: number;
  year?: number;
  seller?: SellerDecision;
  stage?: 'club' | 'player';
  responseDay?: number;
  expires?: number;
  history?: NegotiationRound[];
  freeAgentTerms?: FreeAgentTerms;
};
export type FreeAgentTerms = { salary: number; years: number; basis: string };
export type CoachDeal = {
  id: string;
  coach: Coach;
  role: string;
  salary: number;
  years: number;
  day: number;
  year: number;
  status: NegotiationStatus;
  message: string;
  responseDay?: number;
  expires?: number;
  replacesId?: string;
  compensation: number;
  history: NegotiationRound[];
};
export type GameState = {
  deadlineMarket?: import('./deadline-market').DeadlineMarket;
  engagement?: import('./career-engagement').CareerEngagement;
  challenge?: import('./career-engagement').CareerChallenge;
  seasonStandings?: Record<string, string[]>;
  draftNotice?: string;
  tacticCards?: TacticCardState;
  augmentations?: AugmentationState;
  version: 1;
  year: number;
  day: number;
  club: string;
  manager: string;
  budget: number;
  seed: number;
  rounds: number;
  mode: 'short' | 'full';
  roster: Player[];
  lineup: string[];
  starter: string;
  tactic: string;
  training: string;
  trainingCenter?: TrainingCenter;
  staff: Coach[];
  coachAssignments?: Record<string, { club: string; coach: Coach }>;
  standings: Record<string, Standing[]>;
  history: Result[];
  news: NewsItem[];
  deals: Deal[];
  coachDeals?: CoachDeal[];
  ownership: Record<string, string>;
  transferred: Player[];
  clubLegacy?: import('./club-legacy').ClubLegacy;
  past: { year: number; rank: number; w: number; l: number; champion: string }[];
  phase: 'preseason' | 'regular' | import('./postseason').PostseasonStage | 'finished';
  series: import('./postseason').PostseasonSeries[];
  postseason?: import('./postseason').PostseasonState;
  weather?: import('./match-weather').WeatherSeason;
  champion: string;
  reputation: number;
  income: number;
  expenses: number;
  rules?: {
    firstSeasonTransferBan: boolean;
    startYear: number;
    preseason: boolean;
    revealPotential?: boolean;
  };
  defense?: Defense;
  tacticFamiliarity?: number;
  instructions?: TeamInstructions;
  tacticBook?: SavedTactic[];
  registrations?: RegistrationState;
  reserve?: { w: number; l: number; d: number; history: ReserveResult[] };
  saleOffers?: SaleOffer[];
  transferListed?: Record<string, number>;
  worldResults?: Result[];
  catalogVersion?: string;
  pitching?: PitchingPlan;
  liveMatch?: LiveMatch;
  calendar?: { openingDate: string; startDay: number; remaining?: Record<string, number> };
  progress?: DayProgress;
  scouting?: ScoutingState;
  knowledge?: { leagues: string[]; clubs: string[]; players?: string[] };
  managerCareer?: ManagerCareer;
  managerJobs?: Record<string, ClubManagerJob>;
  managerPeople?: Record<string, ManagerRecord>;
  /** Server-only preserved club operations; player contracts live in transferred. */
  clubCareers?: Record<string, ClubCareer>;
  worldRevenue?: Record<string, number>;
  finances?: {
    balanceVersion?: number;
    wageBudget?: number;
    lastWarningDay?: number;
    lastWarningPenalty?: number;
    days?: number;
    annualSupport: number;
    year: number;
    settledDays: number;
    paidWages: number;
    receivedSupport: number;
  };
  coachRecommendations?: {
    id: string;
    playerId: string;
    replacementId?: string;
    target: 'first' | 'reserve';
    date: string;
    status: 'pending' | 'accepted' | 'dismissed';
    reason: string;
    evidence?: {
      category: 'performance' | 'promotion';
      stats: string;
      threshold: string;
      condition: number;
      replacementReason?: string;
    };
  }[];
  media?: MatchMediaState;
  simulation?: WorldSimulation;
  international?: InternationalState;
  /** Transactional archive outbox. Not retained in the hot snapshot or public response. */
  pendingRecords?: PlayerCareerRecord[];
  trades?: TradeOffer[];
  draft?: DraftState;
  facilities?: { training: number; medical: number };
};
export type DayProgress = {
  from: number;
  to: number;
  stop: 'fixture' | 'report' | 'decision' | 'season' | null;
  newsIds: string[];
};
export type League = {
  id: string;
  name: string;
  country: string;
  flag: string;
  region: string;
  label: string;
  games: number;
  level: number;
  source: string;
  season: string;
};
export type Club = {
  ballpark?: { roof: 'covered'; source: string };
  id: string;
  name: string;
  short: string;
  league: string;
  color: string;
  city: string;
  division: string;
  logo?: ClubLogo;
  manager?: {
    name: string;
    source: string;
    asOf: string;
    background?: import('./manager-background').ManagerBackground;
  };
};
export type ClubLogo = {
  path: string;
  sourcePage: string;
  sourceUrl: string;
  sha256: string;
  mimeType: string;
  rightsNote: string;
};
export type RealSeed = {
  name: string;
  pos: string;
  age: number;
  number?: number;
  country?: string;
  rating?: number;
  ageEstimated?: boolean;
  source?: string;
};
export type Agent = { id: string; name: string; agency: string; fee: number; priority: string };
export type WorldCatalog = {
  draftRules?: Record<
    string,
    {
      year: number;
      date: string;
      rounds: number;
      previousYear: number;
      previousOrder: string[];
      source: string;
    }
  >;
  version: string;
  year: number;
  leagues: League[];
  clubs: Club[];
  players: Player[];
  agents: Agent[];
  coaches: Coach[];
  rosterNote: string;
  fixtures?: Fixture[];
};
export type FinanceEntry = {
  id: string;
  revision: number;
  year: number;
  day: number;
  kind: string;
  amount: number;
  balance: number;
  createdAt: string;
};

export type DefensivePosition = 'P' | 'C' | '1B' | '2B' | '3B' | 'SS' | 'LF' | 'CF' | 'RF' | 'DH';
export type Defense = Record<DefensivePosition, string>;
export type TeamInstructions = {
  steal: number;
  patience: number;
  power: number;
  depth: number;
  pitching?: PitchingApproach;
};
export type SavedTactic = {
  id: string;
  name: string;
  tactic: string;
  lineup: string[];
  starter: string;
  defense: Defense;
  instructions: TeamInstructions;
  pitching?: PitchingPlan;
};
export type ReserveResult = {
  day: number;
  opponent: string;
  own: number;
  against: number;
  played: string[];
};

export type ReplayState = { outs: number; bases: (string | null)[]; score: number[] };
export type AutomaticPitchingChange = {
  from: string;
  reason: 'fatigue' | 'starter-limit' | 'runs' | 'relief-limit' | 'save' | 'protect-closer';
  outs: number;
  runs: number;
  energy?: number;
  lead: number;
  role: 'closer' | 'setup' | 'chase' | 'relief';
};
export type ReplayPlay = {
  battingIntent?: 'power' | 'patient';
  cards?: { own?: string; opponent?: string };
  augmentations?: {
    own?: import('./augmentations').AugmentationKind;
    opponent?: import('./augmentations').AugmentationKind;
    blocked?: true;
  };
  batter: string;
  pitcher: string;
  /** Automatic change immediately before this play; manual substitutions use MatchChange. */
  pitchingChange?: AutomaticPitchingChange;
  before: ReplayState;
  after: ReplayState;
  steal?: { runner: string; safe: boolean; to?: 2 | 3 };
  command?: MatchCommandKind;
  pitching?: PitchingApproach;
  /** Server-calculated remaining match energy before/after this recorded play. */
  energy?: { pitcher: [number, number]; batter?: [number, number]; runners?: [string, number][] };
  /** A standalone steal does not consume the batter's turn or count as an at-bat. */
  plateAppearance?: false;
  /** Actual defensive alignment at this plate appearance, after substitutions. */
  defense?: Defense;
};
export type ReplayTeam = {
  lineup: string[];
  defense: Defense;
  players: { id: string; name: string; number: number; condition?: number }[];
};

export type PerformanceRecord = {
  name: string;
  league: string;
  season: number;
  kind: 'bat' | 'pitch';
  source: string;
  officialId?: string;
  club?: string;
  team?: string;
  ambiguous?: boolean;
  pa?: number;
  ab?: number;
  h?: number;
  hr?: number;
  tb?: number;
  bb?: number;
  k?: number;
  sb?: number;
  g?: number;
  outs?: number;
  er?: number;
  cs?: number;
  hbp?: number;
  sf?: number;
  gdp?: number;
  obp?: number;
  slg?: number;
  gs?: number;
  sv?: number;
  hld?: number;
};
export type PlayerPortrait = {
  league: 'kbo' | 'mlb';
  /** Official league player identifier that names the photo. */
  officialId: string;
  /** Official image URL for that identifier. */
  url: string;
  /** Official page listing the identifier, name, club and number used for the match. */
  source: string;
  asOf: string;
};
export type RatingEvidence = {
  version: string;
  status: 'rated' | 'provisional' | 'estimated' | 'missing';
  season: number;
  source?: string;
  record?: PerformanceRecord;
  method: string;
  estimatedAttributes: string[];
  base: Partial<
    Record<'contact' | 'power' | 'speed' | 'field' | 'stuff' | 'control' | 'potential', number>
  >;
};

export type Fixture = {
  id: string;
  date: string;
  home: string;
  away: string;
  league: string;
  time?: string;
  source?: string;
  generated?: boolean;
};

export type PlayerMood = {
  value: number;
  role: 'core' | 'regular' | 'rotation' | 'prospect';
  reason: string;
  recent: boolean[];
  lastPlayedDay?: number;
  lastConcernDay?: number;
  promise?: { due: number; games: number; startGames: number };
};
export type NewsItem = {
  priority?: 'urgent' | 'story';
  id: string;
  year?: number;
  day: number;
  date?: string;
  title: string;
  body: string;
  kind: string;
  read?: boolean;
  playerId?: string;
  matchId?: string;
  choiceKind?: 'playingTime' | 'lineupCompetition';
  competitionId?: string;
  choice?: string;
  response?: string;
  actionView?:
    | 'schedule'
    | 'agents'
    | 'training'
    | 'staff'
    | 'squad'
    | 'market'
    | 'scouting'
    | 'media'
    | 'manager'
    | 'medical'
    | 'trade'
    | 'augmentations'
    | 'draft'
    | 'records'
    | 'jobs'
    | 'job-offers'
    | 'vision'
    | 'finance'
    | 'reserves'
    | 'tactics';
  sender?: { name: string; role: string };
  dealId?: string;
  tradeId?: string;
  scoutAssignmentId?: string;
  managerOfferId?: string;
  contractResolution?: 'signed';
  employmentClosed?: boolean;
  lineupRecommendation?: LineupRecommendation;
  internationalEventId?: string;
  report?: {
    purpose?: 'contractReview' | 'squadReview';
    facts?: { label: string; value: string }[];
    sections?: { title: string; body: string }[];
    players?: { id: string; name: string; detail: string; salary?: number; years?: number }[];
  };
};
export type SellerDecision = {
  club: string;
  status: 'accepted' | 'counter' | 'refused';
  role: string;
  fee: number;
  reason: string;
};
export type SaleOffer = {
  id: string;
  playerId: string;
  club: string;
  fee: number;
  day: number;
  expires: number;
  year: number;
};

export type PitchingPlan = {
  rotation: string[];
  bullpen: string[];
  closer: string;
  next: number;
  /** Disjoint subsets of bullpen. Missing in older careers. */
  setup?: string[];
  chase?: string[];
};
export type LiveMatch = {
  duel?: import('./tactical-duel').TacticalDuel;
  stakes?: import('./career-engagement').MatchStakes;
  weather?: import('./match-weather').MatchWeather;
  /** Frozen at kickoff. Missing in older games, which keep the previous simulation rules. */
  managers?: {
    version: 1;
    home?: import('./manager-ability').ManagerAbility;
    away?: import('./manager-ability').ManagerAbility;
  };
  cards?: MatchCardDraft;
  delegation?: { coachId: string; name: string; cursor: number };
  home: string;
  away: string;
  seed: number;
  cursor: number;
  finished: boolean;
  result: Result;
  opponents?: Player[][];
  /** Existing matches retain their original relief decisions when resumed. */
  pitchingVersion?: 2 | 3;
  /** Older in-progress games keep their original outcomes and fatigue rules. */
  energyVersion?: 1;
  bullpenVersion?: 1;
  warmups?: { playerId: string; cursor: number; mode: 'warm' | 'standby' }[];
  /** Saved once per generation; playback never invokes the simulator. */
  timeline?: Result;
  timelineVersion?: number;
  playbackId?: string;
  changes?: MatchChange[];
  commands?: MatchCommand[];
  /** Server-only frozen inputs and deferred effects. Never returned by the API. */
  prepared?: {
    input: MatchInput;
    effects: MatchPlayerEffect[];
  };
};
export type MatchInput = Pick<
  GameState,
  | 'year'
  | 'day'
  | 'club'
  | 'roster'
  | 'lineup'
  | 'starter'
  | 'staff'
  | 'tactic'
  | 'pitching'
  | 'instructions'
  | 'tacticFamiliarity'
  | 'augmentations'
  | 'tacticCards'
  | 'defense'
  | 'calendar'
>;
export type MatchPlayerEffect = Pick<Player, 'id' | 'stats' | 'condition' | 'familiarity'>;
export type MatchChange = {
  coldEntry?: boolean;
  cursor: number;
  lineup: string[];
  pitcher: string;
  defense: Defense;
  instructions: TeamInstructions;
};
