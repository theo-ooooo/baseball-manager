import type { Pos } from './types';
export type TradeSuggestionPlayer = { id: string; name: string; pos: Pos; age: number };
export type TradeSuggestion = {
  club: string;
  incoming: TradeSuggestionPlayer[];
  outgoing: TradeSuggestionPlayer[];
  cash: number;
  reason: string;
  cost: string;
  deadlineId?: string;
};
export type TradeRecommendations = {
  revision: number;
  date: string;
  suggestions: TradeSuggestion[];
  message: string;
};
