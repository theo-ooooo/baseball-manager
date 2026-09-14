export type ManagerBackgroundEntry = {
  from: string;
  to?: string;
  team: string;
  role: string;
  detail?: string;
  source?: string;
};

export type ManagerPlayingCareer = {
  from: string;
  to: string;
  position: string;
  summary: string;
  retirement: string;
  record?: string;
  entries: ManagerBackgroundEntry[];
  sources?: { label: string; url: string }[];
};

export type ManagerBackground = {
  version: 1 | 2;
  kind: 'fictional' | 'verified';
  summary: string;
  asOf?: string;
  entries: ManagerBackgroundEntry[];
  playingCareer?: ManagerPlayingCareer;
};
