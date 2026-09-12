// Repair presentation from structured play facts without rewriting saved events.
export const formatFootballFumbleReadout = (event, text) => {
  const result = event?.result || {};
  const fumble = result.fumble || {};
  const scoring = result.scoring || {};
  const offense = event?.preState?.possession || event?.possession;
  if (event?.type !== 'rush' || scoring.type !== 'touchdown' || scoring.team === offense
    || fumble.recoveredByTeam !== scoring.team || !/\bfumbled\b/.test(text)) return text;

  const coordinate = (value) => {
    const match = String(value || '').match(/^([HV])(\d{1,2})$/);
    if (!match) return null;
    return match[1] === offense ? Number(match[2]) : 100 - Number(match[2]);
  };
  const start = coordinate(event?.preState?.yardLine);
  const end = coordinate(fumble.spot);
  if (start !== null && end !== null) {
    const yards = end - start;
    const gain = yards === 0 ? 'no gain' : yards < 0 ? `a loss of ${-yards} yards` : `${yards} ${yards === 1 ? 'yard' : 'yards'}`;
    text = text.replace(/\brush\b[^,]*/, `rush for ${gain} to the ${fumble.spot}`);
  }
  const returnYards = fumble.returnYards ?? result.return?.returnYards;
  if (typeof returnYards === 'number' && !/\breturned\b/.test(text)) {
    const penaltyIndex = text.search(/, (?:Deadball foul, )?PENALTY\b/);
    const play = penaltyIndex >= 0 ? text.slice(0, penaltyIndex) : text;
    const penalties = penaltyIndex >= 0 ? text.slice(penaltyIndex) : '.';
    text = `${play.replace(/[.\s]+$/, '')}, returned ${returnYards} ${returnYards === 1 ? 'yard' : 'yards'} for a touchdown${penalties}`;
  }
  return text;
};
