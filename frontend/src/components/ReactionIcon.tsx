type Reaction = "support" | "hug" | "relate" | "helpful";
const colors: Record<Reaction, string> = {
  support: "#ed957c", hug: "#bada86", relate: "#cdb9df", helpful: "#f2cf54",
};
export function ReactionIcon({ type }: { type: Reaction }) {
  return (
    <svg className="reaction-icon" viewBox="0 0 48 48" aria-hidden="true" focusable="false">
      <circle cx="24" cy="24" r="23" fill={colors[type]} />
      <g fill="#fff7e7" stroke="#51412e" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        {type === "support" && <path d="M24 37 11 24C1 13 17 5 24 16 31 5 47 13 37 24Z" />}
        {type === "hug" && <>
          <circle cx="24" cy="21" r="12" />
          <path d="M19 19v1m10-1v1m-10 6q5 5 10 0" fill="none" />
          <path d="M7 28q0 12 17 12l10-7q3-3 0-5l-9 4M41 28q0 12-17 12l-10-7q-3-3 0-5l9 4" />
        </>}
        {type === "relate" && <>
          <circle cx="24" cy="22" r="14" />
          <path d="M16 15q3-2 6 0m5 1q3-2 6 1M19 20v1m11-1v1m-7 7q4-2 7 0" fill="none" />
          <path d="M15 40v-9l3-7q1-3 4-1l-1 8 10-2q4 0 3 3l-8 4-1 4Z" />
        </>}
        {type === "helpful" && <>
          <path d="M17 29c-10-12-2-19 7-19s17 7 7 19l-2 6H19Z" />
          <path d="M19 35h10v5H19Zm5-33v4M9 8l3 4m27-4-3 4" />
        </>}
      </g>
    </svg>
  );
}
