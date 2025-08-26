export function getPositionPriority(pos) {
  const p = (pos||'').toUpperCase();
  if (['RB','TB','FB','HB','QB','WR'].includes(p)) return 1;      // offense skill
  if (['KR','PR','K','P'].includes(p)) return 2;                   // ST
  return 3;                                                        // defense / other
}

export function getPositionPriorityAdvanced(m = {}) {
  const side = (m.side || '').toLowerCase();
  const pos  = (m.position || '').toLowerCase();
  
  // Check specific position fields from API
  const offPos = (m.off_position || '').toLowerCase();
  const defPos = (m.def_position || '').toLowerCase();
  const stPos = (m.st_position || '').toLowerCase();

  // Base: offense > defense > special teams > unknown
  let base = 0;
  if (offPos) base = 300;
  else if (defPos) base = 200;
  else if (stPos) base = 100;
  else if (side === 'offense') base = 300;
  else if (side === 'defense') base = 200;
  else if (side.includes('special')) base = 100;

  // Use the most relevant position for ordering
  const relevantPos = offPos || defPos || stPos || pos;

  // Finer ordering within side (earlier = higher priority)
  const order = [
    // Offense skill first
    'rb','hb','tb','fb','qb','wr','te',
    // OL
    'lt','lg','c','rg','rt','ol',
    // Defense front/seconday
    'de','dt','nt','dl','mlb','olb','ilb','lb','cb','db','fs','ss','s',
    // ST
    'kr','pr','k','p'
  ];
  const idx = order.indexOf(relevantPos);
  const bonus = idx >= 0 ? (order.length - idx) : 0;

  return base + bonus; // higher = better
}

export function chooseDefaultIndex(matches = []) {
  let bestIdx = 0, bestScore = -1;
  matches.forEach((m, i) => {
    const score = getPositionPriorityAdvanced(m);
    if (score > bestScore) { bestScore = score; bestIdx = i; }
  });
  return bestIdx;
}
