export default function Logo({ height = 52 }: { height?: number }) {
  // SVG coordinate space is 0 0 116 58
  // Top H right edge: x=38, Bottom H right edge: x=65
  // Text starts 5 units after each H's right edge
  const scale = height / 58;
  return (
    <svg
      viewBox="0 0 116 58"
      style={{ height, width: 116 * scale }}
      xmlns="http://www.w3.org/2000/svg"
    >
      {/* Top H left bar */}
      <rect x="2" y="2" width="9" height="28" rx="1.5" fill="#6b7280"/>
      {/* Top H crossbar */}
      <rect x="2" y="14" width="36" height="8" rx="1.5" fill="#6b7280"/>
      {/* Bottom H crossbar */}
      <rect x="29" y="39" width="36" height="8" rx="1.5" fill="#6b7280"/>
      {/* Bottom H right bar */}
      <rect x="56" y="28" width="9" height="28" rx="1.5" fill="#6b7280"/>
      {/* Shared green bar */}
      <rect x="29" y="2" width="9" height="54" rx="1.5" fill="#22c55e"/>
      {/* "omegrown" — starts 5px after top H right edge (x=38) */}
      <text x="43" y="24" dominantBaseline="auto" fontSize="13" fontWeight="600" letterSpacing="-0.3" fill="#6b7280">omegrown</text>
      <text x="70" y="50" dominantBaseline="auto" fontSize="13" fontWeight="600" letterSpacing="-0.3" fill="#22c55e">ealth</text>
    </svg>
  );
}
