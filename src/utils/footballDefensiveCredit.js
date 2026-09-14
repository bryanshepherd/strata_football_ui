// Divide lost yards once. Preserve whole-yard totals by assigning any remainder
// to defenders in the operator's recorded order.
export const splitFootballDefensiveYards = (yards, defenders, defender) => {
  const index = defenders.indexOf(defender);
  if (index < 0 || !defenders.length) return 0;
  const loss = Math.max(0, Math.trunc(Number(yards) || 0));
  return Math.floor(loss / defenders.length) + (index < loss % defenders.length ? 1 : 0);
};
