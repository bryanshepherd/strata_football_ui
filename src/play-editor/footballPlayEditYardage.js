import { calculateYardsGained } from '../utils/footballRulesEngine';

const clone = (value) => JSON.parse(JSON.stringify(value));

const normalizeEnforcementSpot = (value) => String(value || '')
  .replace(/[^a-z]/gi, '')
  .toLowerCase();

const terminalPlaySpot = (play) => play?.result?.endYardLine
  ?? play?.result?.return?.returnEndYardLine
  ?? play?.result?.fumble?.returnEndYardLine
  ?? play?.result?.turnover?.returnEndYardLine
  ?? play?.result?.fumble?.recoverySpot
  ?? play?.result?.turnover?.spot
  ?? null;

export const penaltyEnforcementBasisSpot = (play, penalty, penaltyIndex = 0) => {
  const enforcedFrom = normalizeEnforcementSpot(penalty?.enforcedFrom);

  if (['previous', 'previousspot', 'freekick', 'freekickspot', 'try', 'tryspot'].includes(enforcedFrom)) {
    return play?.preState?.yardLine ?? null;
  }

  if (['spot', 'spotoffoul'].includes(enforcedFrom)) {
    return penalty?.spotOfFoul ?? null;
  }

  if (['succeeding', 'succeedingspot'].includes(enforcedFrom)) {
    const previousFinalSpot = play?.penalties
      ?.slice(0, penaltyIndex)
      .reverse()
      .find((candidate) => candidate?.status === 'accepted' && candidate?.finalSpot)
      ?.finalSpot;
    return previousFinalSpot ?? terminalPlaySpot(play);
  }

  if (['end', 'endofplay'].includes(enforcedFrom)) {
    return terminalPlaySpot(play);
  }

  return null;
};

export const calculateEditedPenaltyYards = (play, penalty, penaltyIndex = 0) => {
  if (penalty?.status === 'declined' || penalty?.status === 'offsetting') return 0;
  if (penalty?.status !== 'accepted' || penalty?.carryOverToKickoff) return null;

  const basisSpot = penaltyEnforcementBasisSpot(play, penalty, penaltyIndex);
  const finalSpot = penalty?.finalSpot;
  const enforcedFrom = normalizeEnforcementSpot(penalty?.enforcedFrom);
  const possession = ['end', 'endofplay', 'succeeding', 'succeedingspot'].includes(enforcedFrom)
    ? play?.result?.nextPossession ?? play?.possession ?? play?.preState?.possession
    : play?.possession ?? play?.preState?.possession;
  const yards = calculateYardsGained(basisSpot, finalSpot, possession);

  return typeof yards === 'number' ? Math.abs(yards) : null;
};

export const recalculatePlayEditorPenaltyYards = (play) => {
  const next = clone(play);
  if (!Array.isArray(next?.penalties)) return next;
  next.penalties = next.penalties.map((penalty, index) => ({
    ...penalty,
    yards: calculateEditedPenaltyYards(next, penalty, index),
  }));
  return next;
};

export {
  normalizeEnforcementSpot,
  terminalPlaySpot,
};
