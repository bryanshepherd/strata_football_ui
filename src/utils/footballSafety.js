// Older sack events reached the own goal line and scored in the rules engine,
// but did not retain scoring metadata. Recover only that unambiguous case.
export const footballSafetyScoring = (event) => {
  const result = event?.result || {};
  if (result.scoring) return result.scoring.type === 'safety' ? result.scoring : null;
  const offense = event?.possession || event?.preState?.possession || event?.participants?.primary?.team;
  if (!['H', 'V'].includes(offense) || event?.type === 'try') return null;
  if (result.code === 'safety') return { team: offense === 'H' ? 'V' : 'H', points: 2, type: 'safety' };
  const sack = event?.type === 'pass' && (event.subtype === 'sack' || result.code === 'sack');
  if (!sack || result.fumble || result.turnover || result.return || !new RegExp(`^${offense}0{1,2}$`).test(result.endYardLine || '')) return null;
  if (event.penalties?.some((penalty) => (
    penalty.status === 'offsetting' || (penalty.status === 'accepted'
      && penalty.timing !== 'deadBall' && penalty.deadBall !== true && penalty.liveBall !== false)
  ))) return null;
  return { team: offense === 'H' ? 'V' : 'H', points: 2, type: 'safety' };
};

export const withFootballSafetyScoring = (event) => {
  const scoring = footballSafetyScoring(event);
  return scoring && !event?.result?.scoring
    ? { ...event, result: { ...event.result, scoring, driveEnds: true } }
    : event;
};

export const footballSafetyDefender = (event) => {
  const scoring = footballSafetyScoring(event);
  if (!scoring) return null;
  const defenders = (event?.participants?.defenders || []).filter((player) => (
    player.team === scoring.team && ['sack', 'tackler', 'assistTackler'].includes(player.role)
  ));
  return defenders.length === 1 ? defenders[0] : null;
};

export const formatFootballSafetyReadout = (event, text) => (
  footballSafetyScoring(event) && !/\bsafety\b/i.test(text)
    ? `${String(text || '').trim().replace(/[.\s]+$/, '')}. Safety.`
    : text
);
