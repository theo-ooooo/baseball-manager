'use client';
import { type ReactNode } from 'react';
import { Search, X } from 'lucide-react';
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from '@/components/ui/select';
import { type Player } from '@dugout/shared/game-view';
import { isUnrated } from '@dugout/shared/ratings';

export { ClubBadge as Badge } from './club-badge';

export function Rating({ value, player }: { value: number; player?: Player }) {
  if (player && isUnrated(player)) return <span className="muted tiny">미평가</span>;
  return (
    <span className={`rating ${value >= 85 ? 'elite' : value >= 70 ? 'good' : ''}`}>
      {Math.round(value)}
      {player?.rating?.status === 'provisional' && '*'}
    </span>
  );
}

export function Choice({
  value,
  onChange,
  items,
  label,
}: {
  value: string;
  onChange: (v: string) => void;
  items: { value: string; label: string }[];
  label: string;
}) {
  return (
    <Select value={value} onValueChange={onChange}>
      <SelectTrigger className="select" aria-label={label}>
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {items.map((i) => (
          <SelectItem key={i.value} value={i.value}>
            {i.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

export function Metric({
  label,
  value,
  sub,
  icon,
}: {
  label: string;
  value: ReactNode;
  sub: ReactNode;
  icon?: ReactNode;
}) {
  return (
    <div className="metric">
      <div className="metric-top">
        {label}
        {icon}
      </div>
      <div className="metric-value">{value}</div>
      <div className="muted">{sub}</div>
    </div>
  );
}

export function SectionTitle({
  title,
  eyebrow,
  children,
}: {
  title: string;
  eyebrow?: string;
  children?: ReactNode;
}) {
  return (
    <div className="section-heading">
      <div>
        {eyebrow && <div className="eyebrow">{eyebrow}</div>}
        <h2>{title}</h2>
      </div>
      {children}
    </div>
  );
}

export function PlayerName({ p, onClick }: { p: Player; onClick?: (p: Player) => void }) {
  return (
    <button className="player-name" onClick={() => onClick?.(p)}>
      <span className={`player-avatar ${p.real ? '' : 'generated'}`}>{p.number}</span>
      <span>
        <strong>{p.name}</strong>
        <small>
          {positions[p.pos]}{' '}
          <span className={p.real ? 'real-tag' : 'gen-tag'}>{p.real ? '실명' : '가상'}</span>
        </small>
      </span>
    </button>
  );
}

export function SearchBox({
  value,
  onChange,
  placeholder = '선수 검색',
}: {
  value: string;
  onChange: (s: string) => void;
  placeholder?: string;
}) {
  return (
    <label className="search-box">
      <Search size={16} />
      <input
        aria-label={placeholder}
        placeholder={placeholder}
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />
      {value && (
        <button aria-label="검색어 지우기" onClick={() => onChange('')}>
          <X size={14} />
        </button>
      )}
    </label>
  );
}

export function Empty({ text }: { text: string }) {
  return (
    <div className="empty-state">
      <Search size={27} />
      <p>{text}</p>
    </div>
  );
}

export const positions: Record<string, string> = {
  P: '투수',
  C: '포수',
  IF: '내야수',
  OF: '외야수',
  DH: '지명타자',
};
