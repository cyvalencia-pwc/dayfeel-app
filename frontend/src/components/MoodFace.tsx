export const moodColors = ["#82b9ee", "#ee7777", "#f3ad62", "#ab9aee", "#f2cf54"];

export function MoodFace({ score }: { score: number }) {
  return (
    <svg className="mood-face" viewBox="0 0 64 64" aria-hidden="true" focusable="false">
      <rect x="2" y="2" width="60" height="60" rx="10" fill={moodColors[score - 1]} />
      <g fill="none" stroke="#252922" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        {score === 1 && <path d="M23 15l-3-7 M29 15l-1-8 M35 15l1-8 M41 15l3-7" />}
        {score === 2 && <path d="M23 15c-7-9 1-12 3-4l1 4c-5-12 4-13 5-4l1 4c-3-12 5-12 6-3l1 3" />}
        {score === 3 && <path d="M25 10v6 M31 8v8 M37 10v6" />}
        {score === 4 && <path d="M22 12l5 5 5-7 5 7 5-5" />}
        {score === 5 && <path d="M26 15c-7-5 4-14 7-7s-6 12-6 7c0-5 10 6 13-3" />}
      </g>
      {score === 5 ? (
        <path d="M14 25l10 5-10 4 M50 25l-10 5 10 4" fill="none" stroke="#252922" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      ) : (
        <g>
          <ellipse cx="21" cy="29" rx="8" ry={score === 4 ? 4 : 7} fill="#fffdf2" />
          <ellipse cx="43" cy="29" rx="8" ry={score === 4 ? 4 : 7} fill="#fffdf2" />
          <ellipse cx={score === 3 ? 24 : 21} cy="29" rx="3.5" ry={score === 4 ? 4 : 5} fill="#252922" />
          <ellipse cx={score === 3 ? 46 : 43} cy="29" rx="3.5" ry={score === 4 ? 4 : 5} fill="#252922" />
        </g>
      )}
      <g stroke="#252922" strokeWidth="2" strokeLinecap="round" fill="none">
        {score === 1 && <path d="M21 50Q32 32 43 50" />}
        {score === 2 && <path d="M14 19l14 5 M36 24l14-5 M24 47Q32 41 40 47" />}
        {score === 3 && <path d="M15 21l10-3 M39 18l10 3 M23 44l4-2 4 3 4-3 6 2" />}
        {score === 4 && <path d="M23 41c1 15 17 15 18 0" />}
      </g>
      {score === 5 && (
        <>
          <path d="M17 41Q32 45 47 41C45 59 20 59 17 41Z" fill="#252922" />
          <path d="M19 42Q32 46 45 42L43 47Q32 51 21 47Z" fill="#fffdf2" />
          <path d="M26 44v5 M33 45v5 M40 44v5" stroke="#252922" strokeWidth="1" />
        </>
      )}
    </svg>
  );
}
