const isTeam = (team) => team === 'H' || team === 'V';
const opponent = (team) => team === 'H' ? 'V' : 'H';

export function confirmedPenaltyAfterPossessionChange(event) {
  const context = event?.result?.penaltyContext;
  return context?.confirmed === true && ['afterChange', 'multipleChanges'].includes(context.decision);
}

// Use the play's possession history, not just its starting and ending teams:
// an interception or kick return can be fumbled back to the original team.
export function footballPossessionChanges(play) {
  const result = play?.result || {};
  const family = play?.play?.family || play?.type;
  const original = play?.play?.actionTeam || play?.possession || play?.preState?.possession
    || play?.participants?.kicker?.team;
  if (!isTeam(original)) return { count: 0, teams: [], finalTeam: null };
  const teams = [original];
  const visit = (team) => {
    if (isTeam(team) && teams.at(-1) !== team) teams.push(team);
  };
  if (Array.isArray(result.possessionChanges)) {
    result.possessionChanges.forEach(visit);
  } else {
    const interception = result.pass?.outcome === 'interception'
      || result.turnover?.type === 'interception'
      || play?.play?.subtype === 'interception'
      || play?.subtype === 'interception';
    const kick = family === 'kickoff' || family === 'punt';
    const returnType = String(result.return?.type || '').toLowerCase();
    const receivingOutcome = result.nextPossession === opponent(original)
      || ['returned', 'touchback', 'fairCatch', 'downed', 'outOfBounds'].includes(result.code);
    if (interception || (kick && receivingOutcome) || ['interception', 'punt', 'kickoff', 'field goal', 'try'].includes(returnType)) {
      // A muff alone is not possession. Ordinary receiving outcomes are.
      const receiveResult = result.kick?.receiveResultCode;
      if (interception || !['M', 'muffed', 'onside'].includes(receiveResult || result.code)) visit(opponent(original));
    }
    visit(result.fumble?.recoveredByTeam);
    visit(result.turnover?.recoveredBy || result.turnover?.team);
    visit(result.nextPossession);
  }
  return { count: teams.length - 1, teams, finalTeam: teams.at(-1) };
}

export function validPenaltyBallContext(value) {
  if (!value || !isTeam(value.possession) || value.confirmed !== true) return false;
  if (!['beforeChange', 'afterChange', 'multipleChanges'].includes(value.decision)) return false;
  if (typeof value.startNewDrive !== 'boolean') return false;
  if (!Number.isInteger(value.down) || value.down < 1 || value.down > 4) return false;
  if (!Number.isInteger(value.distance) || value.distance < 1 || value.distance > 99) return false;
  if (!/^(?:[HV](?:0[1-9]|[1-4][0-9])|50)$/.test(value.yardLine)) return false;
  if (value.setupContext !== undefined) {
    if (value.startNewDrive || !['awaitingKickoff', 'awaitingTry', 'awaitingSafetyKick'].includes(value.setupContext)) return false;
    if (value.setupContext === 'awaitingTry') return value.scoring?.type === 'touchdown' && isTeam(value.scoring.team) && value.scoring.points === 6;
    if (value.setupContext === 'awaitingSafetyKick') return value.scoring?.type === 'safety' && isTeam(value.scoring.team) && value.scoring.points === 2;
    return value.scoring === undefined;
  }
  if (value.scoring !== undefined) return false;
  const relative = value.yardLine === '50' ? 50
    : value.yardLine[0] === value.possession ? Number(value.yardLine.slice(1)) : 100 - Number(value.yardLine.slice(1));
  return value.distance <= 100 - relative;
}
