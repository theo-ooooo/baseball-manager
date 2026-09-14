import { Cloud, CloudRain, Sun, Wind, Umbrella } from 'lucide-react';
import { cancellationLabel, weatherLabel, type MatchWeather } from '@dugout/shared/match-weather';

export function MatchWeatherStrip({
  weather,
  compact = false,
  showCancellation = false,
}: {
  weather: MatchWeather;
  compact?: boolean;
  showCancellation?: boolean;
}) {
  const Icon = weather.covered
    ? Umbrella
    : weather.sky === 'clear'
      ? Sun
      : weather.sky === 'cloudy'
        ? Cloud
        : CloudRain;
  return (
    <div className={`match-weather-strip ${compact ? 'compact' : ''}`} aria-label="경기 날씨">
      <span>
        <Icon size={16} />
        <strong>{weatherLabel(weather)}</strong>
      </span>
      <span>{weather.temperature}°C</span>
      {!compact && (
        <>
          <span>
            <Wind size={15} />
            {weather.wind}m/s
          </span>
          <span>
            그라운드{' '}
            {weather.ground === 'dry' ? '양호' : weather.ground === 'damp' ? '젖음' : '정비 필요'}
          </span>
        </>
      )}
      {!compact && showCancellation && weather.cancellation && (
        <b>{cancellationLabel(weather.cancellation)} 예정</b>
      )}
      {!compact && <small>게임 생성 날씨</small>}
    </div>
  );
}
