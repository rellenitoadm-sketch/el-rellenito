'use client';

import { useState } from 'react';

interface GravixLogoProps {
  height?: number;
  className?: string;
}

/**
 * Gravix Solutions logo.
 * Uses the official PNG at /public/gravix.png. If that file isn't present yet,
 * it falls back automatically to an inline SVG replica so the footer never
 * shows a broken image.
 */
export default function GravixLogo({ height = 18, className = '' }: GravixLogoProps) {
  const [usePng, setUsePng] = useState(true);

  if (usePng) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src="/gravix.png"
        alt="Gravix"
        style={{ height, width: 'auto' }}
        className={className}
        onError={() => setUsePng(false)}
      />
    );
  }

  // Fallback replica
  return (
    <svg
      height={height}
      viewBox="0 0 168 32"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      role="img"
      aria-label="Gravix"
    >
      <defs>
        <linearGradient id="gravix-emblem" x1="16" y1="1" x2="16" y2="31" gradientUnits="userSpaceOnUse">
          <stop stopColor="#1E0935" />
          <stop offset="1" stopColor="#7B2CBF" />
        </linearGradient>
      </defs>
      <circle cx="16" cy="16" r="15" fill="url(#gravix-emblem)" />
      <path d="M16 6 L17.9 14.1 L26 16 L17.9 17.9 L16 26 L14.1 17.9 L6 16 L14.1 14.1 Z" fill="#fff" />
      <text
        x="38"
        y="23"
        fontFamily="Georgia, 'Times New Roman', serif"
        fontSize="20"
        fontWeight="700"
        letterSpacing="0.5"
        fill="#5B21B6"
      >
        Gravix
      </text>
    </svg>
  );
}
