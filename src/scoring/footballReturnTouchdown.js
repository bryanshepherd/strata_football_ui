export const footballReturnTouchdown = (event) => {
  const result = event?.result || {};
  const scoring = result.scoring || {};
  if (scoring.type !== 'touchdown' || !['H', 'V'].includes(scoring.team)) return null;
  const offense = event?.preState?.possession || event?.possession;
  const returned = result.return || {};
  const fumble = result.fumble || {};
  const turnover = result.turnover || {};
  const people = event?.participants || {};
  const fumbleRecoveryTeam = fumble.recoveredByTeam
    || (String(turnover.type).toLowerCase() === 'fumble' ? turnover.recoveredBy || turnover.team : null);
  if (fumbleRecoveryTeam === scoring.team && scoring.team !== offense) {
    return { type: 'fumble', team: scoring.team, playerId: fumble.recoveredByPlayerId || returned.returnerPlayerId || people.recoveredBy?.playerId, yards: fumble.returnYards ?? returned.returnYards ?? turnover.returnYards ?? 0 };
  }
  if ((String(turnover.type).toLowerCase() === 'interception' || ['interception', 'intercepted'].includes(event?.subtype)) && scoring.team !== offense) {
    return { type: 'interception', team: scoring.team, playerId: returned.returnerPlayerId || people.interceptor?.playerId || people.returner?.playerId, yards: returned.returnYards ?? turnover.returnYards ?? 0 };
  }
  if (returned.type === 'Fumble') return { type: 'fumble', team: scoring.team, playerId: returned.returnerPlayerId, yards: returned.returnYards ?? 0 };
  if (['kickoff', 'punt'].includes(event?.type) && (people.returner?.playerId || returned.returnerPlayerId)) {
    return { type: event.type, team: scoring.team, playerId: returned.returnerPlayerId || people.returner?.playerId, yards: returned.returnYards ?? 0 };
  }
  return null;
};

export const footballOffensivePlayYards = (event, length = 100) => {
  const recorded = Number(event?.result?.yards || 0);
  if (footballReturnTouchdown(event)?.type !== 'fumble' || event?.type !== 'rush') return recorded;
  const offense = event?.preState?.possession || event?.possession;
  const coordinate = (value) => {
    const match = String(value || '').match(/^([HV])(\d{1,2})$/);
    return match ? (match[1] === offense ? Number(match[2]) : length - Number(match[2])) : null;
  };
  const start = coordinate(event?.preState?.yardLine);
  const end = coordinate(event?.result?.fumble?.spot);
  return start !== null && end !== null ? end - start : recorded;
};
