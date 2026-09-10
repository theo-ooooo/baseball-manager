'use client';
import { memo, useId } from 'react';
import { bases } from '@dugout/shared/replay';

/** Static field art shares the exact coordinate system used by the saved replay. */
export const Stadium2DField = memo(function Stadium2DField({ viewBox }: { viewBox: string }) {
  const id = useId().replaceAll(':', '');
  const field = 'M 186 350 Q 768 -120 1350 350 L 823 936 Q 768 966 713 936 Z';
  const stand = 'M 117 338 Q 768 -234 1419 338 L 870 985 Q 768 1050 666 985 Z';
  return (
    <svg className="stadium-background field-2d" viewBox={viewBox} aria-label="2D 야구장 전술 시점">
      <defs>
        <linearGradient id={`${id}-ground`} x2="0" y2="1">
          <stop stopColor="#14272c" />
          <stop offset="1" stopColor="#0b1c25" />
        </linearGradient>
        <linearGradient id={`${id}-clay`} x2="0.7" y2="1">
          <stop stopColor="#c39369" />
          <stop offset="1" stopColor="#ad7954" />
        </linearGradient>
        <pattern
          id={`${id}-grass`}
          width="160"
          height="160"
          patternUnits="userSpaceOnUse"
          patternTransform="rotate(28)"
        >
          <rect width="160" height="160" fill="#397b59" />
          <rect width="80" height="160" fill="#428964" />
          <path d="M 1 0 V 160 M 80 0 V 160" stroke="#73a181" strokeOpacity=".14" />
        </pattern>
        <pattern id={`${id}-seats`} width="18" height="16" patternUnits="userSpaceOnUse">
          <rect width="18" height="16" fill="#203e50" />
          <rect x="3" y="2" width="10" height="9" rx="2" fill="#59778a" />
          <path d="M 3 11 H 13" stroke="#132d3c" strokeWidth="3" />
        </pattern>
        <pattern id={`${id}-clay-grain`} width="47" height="41" patternUnits="userSpaceOnUse">
          <circle cx="9" cy="15" r="1" fill="#f8d1a3" opacity=".25" />
          <circle cx="29" cy="33" r="1" fill="#71472d" opacity=".2" />
        </pattern>
        <clipPath id={`${id}-field`}>
          <path d={field} />
        </clipPath>
        <filter id={`${id}-shadow`} x="-.15" y="-.15" width="1.3" height="1.3">
          <feDropShadow dx="0" dy="12" stdDeviation="15" floodColor="#000" floodOpacity=".38" />
        </filter>
      </defs>
      <rect width="1536" height="1024" fill={`url(#${id}-ground)`} />
      <path
        d={stand}
        fill={`url(#${id}-seats)`}
        stroke="#0c202b"
        strokeWidth="30"
        filter={`url(#${id}-shadow)`}
      />
      <path
        d="M 140 340 Q 768 -197 1396 340 L 855 964 Q 768 1020 681 964 Z"
        fill="none"
        stroke="#a5b5bd"
        strokeOpacity=".3"
        strokeWidth="4"
      />
      <path
        d="M 164 345 Q 768 -158 1372 345 L 839 947 Q 768 992 697 947 Z"
        fill="none"
        stroke="#152e3b"
        strokeWidth="13"
      />
      <path d={field} fill={`url(#${id}-clay)`} stroke="#112e29" strokeWidth="16" />
      <g clipPath={`url(#${id}-field)`}>
        <path
          d="M 207 367 Q 768 -71 1329 367 L 811 915 Q 768 940 725 915 Z"
          fill={`url(#${id}-grass)`}
        />
        <path
          d="M 499 667 C 456 520 550 362 768 359 C 986 362 1080 520 1037 667 L 818 912 Q 768 944 718 912 Z"
          fill={`url(#${id}-clay)`}
        />
        <path
          d="M 499 667 C 456 520 550 362 768 359 C 986 362 1080 520 1037 667 L 818 912 Q 768 944 718 912 Z"
          fill={`url(#${id}-clay-grain)`}
        />
        <path
          d="M 768 806 L 585 632 L 768 478 L 951 632 Z"
          fill={`url(#${id}-grass)`}
          stroke="#376f50"
          strokeWidth="3"
        />
        <circle
          cx="768"
          cy="643"
          r="39"
          fill={`url(#${id}-clay)`}
          stroke="#c7986d"
          strokeWidth="3"
        />
        <circle cx="768" cy="867" r="51" fill={`url(#${id}-clay)`} />
        <path
          d="M 768 867 L 186 350 M 768 867 L 1350 350"
          stroke="#f8efdb"
          strokeWidth="4"
          fill="none"
        />
        <path
          d="M 670 916 Q 768 811 866 916"
          stroke="#f8efdb"
          strokeWidth="2"
          strokeDasharray="10 10"
          fill="none"
          opacity=".8"
        />
        <path
          d="M 755 849 H 730 V 883 H 755 M 781 849 H 806 V 883 H 781"
          fill="none"
          stroke="#f6edda"
          strokeWidth="2"
        />
        <circle
          cx="511"
          cy="787"
          r="21"
          fill="none"
          stroke="#f6edda"
          strokeWidth="2"
          opacity=".8"
        />
        <circle
          cx="1025"
          cy="787"
          r="21"
          fill="none"
          stroke="#f6edda"
          strokeWidth="2"
          opacity=".8"
        />
        {bases.slice(1, 4).map((b, i) => (
          <rect
            key={i}
            x={b.x - 9}
            y={b.y - 9}
            width="18"
            height="18"
            rx="1"
            fill="#fffaf0"
            stroke="#70533c"
            strokeWidth="1.5"
            transform={`rotate(45 ${b.x} ${b.y})`}
          />
        ))}
        <path d="M 759 857 H 777 V 867 L 768 876 L 759 867 Z" fill="#fffaf0" />
        <rect x="757" y="638" width="22" height="7" rx="1" fill="#fffaf0" />
      </g>
      <path d="M 186 350 Q 768 -120 1350 350" stroke="#e9c85a" strokeWidth="5" fill="none" />
      <g fill="#c8dcce" fontSize="15" fontWeight="600" textAnchor="middle" letterSpacing="2">
        <text x="280" y="345" transform="rotate(-27 280 345)">
          LEFT FIELD
        </text>
        <text x="768" y="151">
          CENTER FIELD
        </text>
        <text x="1256" y="345" transform="rotate(27 1256 345)">
          RIGHT FIELD
        </text>
      </g>
      <g fill="#112c38" stroke="#61808c" strokeWidth="2">
        <rect x="430" y="791" width="126" height="26" rx="4" transform="rotate(45 430 791)" />
        <rect x="1106" y="791" width="126" height="26" rx="4" transform="rotate(135 1106 791)" />
      </g>
      <g transform="translate(624 42)">
        <rect width="288" height="50" rx="4" fill="#0c202b" stroke="#526e7b" strokeWidth="2" />
        <text
          x="144"
          y="31"
          fill="#c4dacd"
          fontSize="17"
          fontWeight="600"
          textAnchor="middle"
          letterSpacing="5"
        >
          DUGOUT PARK
        </text>
      </g>
    </svg>
  );
});
