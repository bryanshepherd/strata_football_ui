const normalizedSpot = (spot) => {
  const match = String(spot || '').trim().toUpperCase().match(/^([HV])\s*(\d{1,2})$/);
  return match ? `${match[1]}${Number(match[2])}` : '';
};

export const isFootballSpotFoulAtFinalSpot = (penalty) => {
  const origin = String(penalty?.enforcedFrom || '').replace(/[^a-z]/gi, '').toLowerCase();
  const spot = normalizedSpot(penalty?.spotOfFoul);
  return penalty?.status === 'accepted' && ['spot', 'spotoffoul'].includes(origin)
    && Boolean(spot) && spot === normalizedSpot(penalty.finalSpot);
};

// Refresh legacy wording at display time, without rewriting saved descriptions
// or recalculating yards. Keep each replacement inside its own penalty clause.
export const formatFootballSpotFoulReadout = (event, text, teams = {}) => {
  let index = 0;
  return text.replace(/\bPENALTY\b[\s\S]*?(?=\bPENALTY\b|$)/g, (clause) => {
    const penalty = event?.penalties?.[index++];
    if (!isFootballSpotFoulAtFinalSpot(penalty)) return clause;
    const spot = normalizedSpot(penalty.spotOfFoul);
    const escape = (value) => String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const labels = [spot[0], teams[spot[0]]?.abbr].filter(Boolean).map(escape).join('|');
    const location = `(?:${labels})\\s*0*${spot.slice(1)}`;
    const enforcement = new RegExp(`\\b(?:enforced )?(\\d+(?:\\.\\d+)? yards?) from the ${location} to the (${location})(?=[,.]|$)`, 'i');
    return clause.replace(enforcement, (_match, yards, finalSpot) => `spot foul at the ${finalSpot} (${yards})`);
  });
};
