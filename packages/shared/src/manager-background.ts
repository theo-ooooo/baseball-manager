export type ManagerBackground = {
  version: 1;
  kind: 'fictional' | 'verified';
  summary: string;
  asOf?: string;
  entries: {
    from: string;
    to?: string;
    team: string;
    role: string;
    detail?: string;
    source?: string;
  }[];
};
