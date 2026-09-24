import { footballOffensivePlayYards } from '../scoring/footballReturnTouchdown';
import { confirmedPenaltyAfterPossessionChange } from './footballPenaltyPossession';
import { footballYardsAfterCatch } from './footballReceivingYardage';

const relativeSpot = (spot, team, length) => {
  if (!['H', 'V'].includes(team)) return null;
  const value = String(spot || '').trim().toUpperCase();
  if (value === 'GOAL') return length;
  if (value === '50' || value === 'MIDFIELD') return length / 2;
  const match = value.match(/^([HV])(\d{1,2})$/);
  if (!match || Number(match[2]) > length / 2) return null;
  return match[1] === team ? Number(match[2]) : length - Number(match[2]);
};

// A final enforcement spot moves the ball for the next play. It is never
// the endpoint used to credit the runner, passer, or receiver on this play.
export const footballStatisticalFoulSpot = (event) => {
  if (!['rush', 'pass'].includes(event?.type) || confirmedPenaltyAfterPossessionChange(event)) return null;
  return [...(event.penalties || [])].reverse().find((penalty) => (
    penalty.status === 'accepted'
    && penalty.spotOfFoul
    && ['spot', 'spotoffoul'].includes(String(penalty.enforcedFrom || '').toLowerCase())
  ))?.spotOfFoul || null;
};

export const footballSpotFoulStatisticalYards = (event, length = 100) => {
  const team = event?.possession || event?.preState?.possession;
  const start = relativeSpot(event?.preState?.yardLine, team, length);
  const end = relativeSpot(footballStatisticalFoulSpot(event), team, length);
  return start !== null && end !== null ? end - start : null;
};

export const footballStatisticalRushYards = (event, length = 100) => (
  footballSpotFoulStatisticalYards(event, length) ?? footballOffensivePlayYards(event, length)
);

export const footballStatisticalPassYards = (event, length = 100) => {
  const cutoff = footballSpotFoulStatisticalYards(event, length);
  if (cutoff !== null) return cutoff;
  const recorded = Number(event?.result?.pass?.passingYards ?? event?.result?.yards) || 0;
  if (event?.result?.pass?.outcome !== 'complete' || !event?.result?.fumble?.turnover) return recorded;
  const team = event.possession || event.preState?.possession;
  const start = relativeSpot(event?.preState?.yardLine, team, length);
  const end = relativeSpot(event?.result?.pass?.terminalYardLine, team, length);
  return start !== null && end !== null ? end - start : recorded;
};

// The stats projection already applies the spot-foul cutoff. Report-only
// fumble corrections must not subtract those uncredited yards a second time.
export const footballRushReportCorrection = (event, length = 100) => (
  footballSpotFoulStatisticalYards(event, length) !== null ? 0
    : footballStatisticalRushYards(event, length) - (Number(event?.result?.yards) || 0)
);
export const footballPassReportCorrection = (event, length = 100) => (
  footballSpotFoulStatisticalYards(event, length) !== null ? 0
    : footballStatisticalPassYards(event, length) - (Number(event?.result?.pass?.passingYards ?? event?.result?.yards) || 0)
);

export const footballStatisticalYardsAfterCatch = (event, length = 100) => {
  const foulSpot = footballStatisticalFoulSpot(event);
  if (!foulSpot) return footballYardsAfterCatch(event, length);
  const pass = event?.result?.pass;
  const team = event.possession || event.preState?.possession;
  const end = relativeSpot(foulSpot, team, length);
  if (end === null) return footballYardsAfterCatch(event, length);
  const caught = relativeSpot(pass?.catchYardLine ?? pass?.caughtAtYardLine, team, length);
  if (caught !== null) return end - caught;
  const recordedYac = footballYardsAfterCatch(event, length);
  const actualEnd = relativeSpot(pass?.terminalYardLine ?? event?.result?.endYardLine, team, length);
  return recordedYac !== null && actualEnd !== null ? recordedYac + end - actualEnd : null;
};
