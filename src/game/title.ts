/**
 * First-visit title card. Shown once in game mode, before the first "How to play".
 * Skipped when the visitor has been here before (tutorial flag set), asked for a view
 * explicitly (?view=play or ?view=plain), or followed a deep link to a station (#work).
 */
export function shouldShowTitle(opts: { view: string | null; hash: string; tutorialSeen: boolean }): boolean {
  if (opts.tutorialSeen) return false;
  if (opts.view === "play" || opts.view === "plain") return false;
  if (opts.hash.replace(/^#/, "") !== "") return false;
  return true;
}
