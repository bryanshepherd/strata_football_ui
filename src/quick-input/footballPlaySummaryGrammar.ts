import type {
  DraftParticipant,
  DraftPenalty,
  DraftWarning,
  DraftWarningCode,
  FootballDraftIntent,
  Spot,
  TeamCode,
} from './footballIntentSchema';
import { isCanonicalSpot } from './footballIntentSchema';
import { formatFootballClockDisplay } from '../utils/footballClock';

export type FootballPlaySummaryWarning = DraftWarning;

export type FootballPlaySummaryResult = {
  summaryText: string;
  warnings: FootballPlaySummaryWarning[];
};

type SummaryContext = {
  intent: FootballDraftIntent;
  warnings: FootballPlaySummaryWarning[];
};

export function generateFootballPlaySummary(intent: FootballDraftIntent): FootballPlaySummaryResult {
  const context: SummaryContext = {
    intent,
    warnings: [...intent.warnings],
  };

  const playSummary = summaryForPlay(context);
  const penaltyText = intent.play.family === 'penalty' ? '' : penaltiesSummary(context, intent.penalties, { attached: true });
  const summaryText = penaltyText
    ? sentence(`${stripTerminalPunctuation(playSummary)}, ${penaltyText}`)
    : playSummary;

  return {
    summaryText,
    warnings: context.warnings,
  };
}

function summaryForPlay(context: SummaryContext): string {
  const { intent } = context;

  if (intent.play.family === 'penalty') {
    return penaltiesSummary(context, intent.penalties) || 'Penalty details pending.';
  }

  if (intent.play.family === 'try') return trySummary(context);
  if (intent.play.family === 'rush') return rushSummary(context);
  if (intent.result.code === 'fumble') return fumbleSummary(context);
  if (intent.play.family === 'pass' && intent.play.subtype === 'sack') return sackSummary(context);
  if (intent.play.family === 'pass' && intent.play.subtype === 'interception') return interceptionSummary(context);
  if (intent.play.family === 'pass') return passSummary(context);
  if (intent.play.family === 'punt') return puntSummary(context);
  if (intent.play.family === 'kickoff') return kickoffSummary(context);
  if (intent.play.family === 'fieldGoal') return fieldGoalSummary(context);
  if (intent.play.family === 'gameControl') return gameControlSummary(context);

  addWarning(context, 'UNSUPPORTED_PLAY_FAMILY', `No summary template for ${intent.play.family}`, 'play.family');
  return `${teamAbbr(intent, intent.play.actionTeam)} play summary pending.`;
}

function rushSummary(context: SummaryContext): string {
  const { intent } = context;
  const rusher = requiredPlayer(context, primaryParticipant(intent), 'participants.primary');
  const team = teamAbbr(intent, intent.play.actionTeam);
  const scoring = intent.result.scoring?.type === 'touchdown' || intent.result.code === 'touchdown';
  const safety = intent.result.scoring?.type === 'safety' || intent.result.code === 'safety';
  const base = `${team} ${formatPlayer(rusher)} rush`;

  const resultPhrase = scoring
    ? `${yardagePhrase(context, intent.result.yards, 'result.yards')}${intent.result.endYardLine ? ` ${spotPhrase(context, 'to', intent.result.endYardLine, 'result.endYardLine')}` : ''} for a touchdown`
    : safety
      ? `${yardagePhrase(context, intent.result.yards, 'result.yards')} ${spotPhrase(context, 'to', intent.result.endYardLine, 'result.endYardLine')} for a safety`
    : `${yardagePhrase(context, intent.result.yards, 'result.yards')} ${spotPhrase(context, 'to', intent.result.endYardLine, 'result.endYardLine')}`;

  const clauses = [`${base} ${resultPhrase}`];
  clauses.push(...lateralClauses(context));
  if (intent.result.firstDown && !scoring) clauses.push('for a first down');
  if (intent.result.code === 'outOfBounds') clauses.push('out-of-bounds');
  const tacklers = tacklerPhrase(intent.participants.defenders);
  if (tacklers) clauses.push(tacklers);
  if (intent.result.fumble) {
    const forcedBy = intent.participants.forcedBy ?? participantByPlayerId(intent, intent.result.fumble.forcedByPlayerId);
    const recoveredBy = intent.participants.recoveredBy ?? participantByPlayerId(intent, intent.result.fumble.recoveredByPlayerId);
    clauses.push(`fumbled ${spotPhrase(context, 'at', intent.result.fumble.spot ?? intent.result.endYardLine, 'result.fumble.spot')}`);
    if (forcedBy) clauses.push(`forced by ${formatPlayer(forcedBy)}`);
    clauses.push(`recovered by ${formatPlayer(recoveredBy)} for ${teamAbbr(intent, intent.result.fumble.recoveredByTeam)} ${spotPhrase(context, 'at', intent.result.fumble.recoverySpot, 'result.fumble.recoverySpot')}`);
  }

  return sentence(joinClauses(clauses));
}

function passSummary(context: SummaryContext): string {
  const { intent } = context;
  const passer = requiredPlayer(context, primaryParticipant(intent), 'participants.primary');
  const receiver = intent.participants.secondary;
  const team = teamAbbr(intent, intent.play.actionTeam);

  if (intent.play.subtype === 'incomplete' || intent.result.code === 'incomplete') {
    const clauses = receiver
      ? [`${team} ${formatPlayer(passer)} pass incomplete intended for ${formatPlayer(receiver)}`]
      : [`${team} ${formatPlayer(passer)} pass incomplete`];

    const breakup = participantByPlayerId(intent, intent.result.pass?.brokenUpByPlayerId);
    if (breakup) clauses.push(`broken up by ${formatPlayer(breakup)}`);
    const hurryDefenders = (intent.result.pass?.hurriedByPlayerIds ?? [])
      .map((playerId) => participantByPlayerId(intent, playerId))
      .filter(Boolean) as DraftParticipant[];
    if (hurryDefenders.length > 0) clauses.push(`hurried by ${formatPlayerList(hurryDefenders)}`);

    return sentence(joinClauses(clauses));
  }

  const target = receiver ?? participantByPlayerId(intent, intent.result.pass?.targetPlayerId);
  const scoring = intent.result.scoring?.type === 'touchdown' || intent.result.code === 'touchdown';
  const targetPhrase = target ? ` to ${formatPlayer(target)}` : '';
  if (!target) addWarning(context, 'UNRESOLVED_PLAYER', 'Pass receiver is missing', 'participants.secondary');

  const resultPhrase = scoring
    ? `${yardagePhrase(context, intent.result.yards, 'result.yards')} for a touchdown`
    : `${yardagePhrase(context, intent.result.yards, 'result.yards')} ${spotPhrase(context, 'to', intent.result.endYardLine, 'result.endYardLine')}`;

  const clauses = [`${team} ${formatPlayer(passer)} pass complete${targetPhrase} ${resultPhrase}`];
  clauses.push(...lateralClauses(context));
  if (intent.result.code === 'outOfBounds') clauses.push('out-of-bounds');
  const tacklers = tacklerPhrase(intent.participants.defenders);
  if (tacklers) clauses.push(tacklers);
  if (intent.result.fumble) {
    const forcedBy = intent.participants.forcedBy ?? participantByPlayerId(intent, intent.result.fumble.forcedByPlayerId);
    const recoveredBy = intent.participants.recoveredBy ?? participantByPlayerId(intent, intent.result.fumble.recoveredByPlayerId);
    const recoveryTeam = intent.result.fumble.recoveredByTeam;
    const fumbleSpot = intent.result.fumble.spot ?? intent.result.endYardLine;
    clauses.push(`fumbled ${spotPhrase(context, 'at', fumbleSpot, 'result.fumble.spot')}`);
    if (forcedBy) clauses.push(`forced by ${formatPlayer(forcedBy)}`);
    if (recoveredBy || recoveryTeam) {
      clauses.push(`recovered by ${formatPlayer(recoveredBy)} for ${teamAbbr(intent, recoveryTeam)} ${spotPhrase(context, 'at', intent.result.fumble.recoverySpot, 'result.fumble.recoverySpot')}`);
    }
  }

  return sentence(joinClauses(clauses));
}

function sackSummary(context: SummaryContext): string {
  const { intent } = context;
  const passer = requiredPlayer(context, primaryParticipant(intent), 'participants.primary');
  const team = teamAbbr(intent, intent.play.actionTeam);
  const defenders = defendersByRoles(intent, ['sack', 'tackler', 'assistTackler']);
  const defenderPhrase = defenders.length > 0 ? ` by ${formatPlayerList(defenders)}` : '';

  if (defenders.length === 0) {
    addWarning(context, 'MISSING_OPTIONAL_DEFENDER', 'Sack defender is missing', 'participants.defenders');
  }

  const yardage = typeof intent.result.yards === 'number'
    ? yardagePhrase(context, intent.result.yards, 'result.yards')
    : spotPhrase(context, 'at', intent.result.endYardLine, 'result.endYardLine');
  const endSpot = typeof intent.result.yards === 'number'
    ? ` ${spotPhrase(context, 'to', intent.result.endYardLine, 'result.endYardLine')}`
    : '';
  const fumble = intent.result.fumble ? ', fumbled' : '';

  return sentence(`${team} ${formatPlayer(passer)} sacked${defenderPhrase} ${yardage}${endSpot}${fumble}`);
}

function interceptionSummary(context: SummaryContext): string {
  const { intent } = context;
  const passer = requiredPlayer(context, primaryParticipant(intent), 'participants.primary');
  const receiver = intent.participants.secondary;
  const interceptor = requiredPlayer(
    context,
    participantByRole(intent, 'interceptor') ?? participantByPlayerId(intent, intent.result.turnover?.playerId),
    'participants.defenders',
  );
  const team = teamAbbr(intent, intent.play.actionTeam);
  const turnoverSpot = intent.result.turnover?.spot;
  const base = receiver
    ? `${team} ${formatPlayer(passer)} pass intended for ${formatPlayer(receiver)} intercepted by ${formatPlayer(interceptor)} ${spotPhrase(context, 'at', turnoverSpot, 'result.turnover.spot')}`
    : `${team} ${formatPlayer(passer)} pass intercepted by ${formatPlayer(interceptor)} ${spotPhrase(context, 'at', turnoverSpot, 'result.turnover.spot')}`;

  const returnYards = intent.result.turnover?.returnYards ?? intent.result.return?.returnYards;
  const returnEnd = intent.result.turnover?.returnEndYardLine ?? intent.result.return?.returnEndYardLine ?? intent.result.endYardLine;
  const clauses = [base];
  clauses.push(...lateralClauses(context));

  if (typeof returnYards === 'number' || returnEnd || intent.result.scoring?.type === 'touchdown') {
    if (intent.result.scoring?.type === 'touchdown') {
      clauses.push(`returned ${yardagePhrase(context, returnYards, 'result.turnover.returnYards')} for a touchdown`);
    } else if (intent.result.scoring?.type === 'safety') {
      clauses.push(`returned ${yardagePhrase(context, returnYards, 'result.turnover.returnYards')} for a safety`);
    } else {
      clauses.push(`returned ${yardagePhrase(context, returnYards, 'result.turnover.returnYards')} ${spotPhrase(context, 'to', returnEnd, 'result.turnover.returnEndYardLine')}`);
      if (intent.result.code === 'touchback') clauses.push('touchback');
    }
  }

  const tacklers = tacklerPhrase(defendersByRoles(intent, ['tackler', 'assistTackler']));
  if (tacklers) clauses.push(tacklers);

  return sentence(joinClauses(clauses));
}

function fumbleSummary(context: SummaryContext): string {
  const { intent } = context;
  const carrier = intent.participants.fumbler ?? primaryParticipant(intent);
  const forcedBy = intent.participants.forcedBy ?? participantByPlayerId(intent, intent.result.fumble?.forcedByPlayerId);
  const recoveredBy = intent.participants.recoveredBy ?? participantByPlayerId(intent, intent.result.fumble?.recoveredByPlayerId);
  const recoveringTeam = intent.result.fumble?.recoveredByTeam;
  const team = teamAbbr(intent, intent.play.actionTeam);
  const fumbleSpot = intent.result.fumble?.spot ?? intent.result.endYardLine;
  const clauses = [`${team} ${formatPlayer(carrier)} fumbled ${spotPhrase(context, 'at', fumbleSpot, 'result.fumble.spot')}`];

  if (forcedBy) clauses.push(`forced by ${formatPlayer(forcedBy)}`);

  if (recoveredBy || recoveringTeam) {
    const recovery = `recovered by ${formatPlayer(recoveredBy)} for ${teamAbbr(intent, recoveringTeam)}`;
    const recoverySpot = intent.result.fumble?.recoverySpot
      ? ` ${spotPhrase(context, 'at', intent.result.fumble.recoverySpot, 'result.fumble.recoverySpot')}`
      : '';
    clauses.push(`${recovery}${recoverySpot}`);
  }

  if (typeof intent.result.fumble?.returnYards === 'number' || intent.result.fumble?.returnEndYardLine) {
    const returnEnd = intent.result.fumble?.returnEndYardLine ?? intent.result.endYardLine;
    if (intent.result.scoring?.type === 'touchdown') {
      clauses.push(`returned ${yardagePhrase(context, intent.result.fumble?.returnYards, 'result.fumble.returnYards')} for a touchdown`);
    } else if (intent.result.scoring?.type === 'safety') {
      clauses.push(`returned ${yardagePhrase(context, intent.result.fumble?.returnYards, 'result.fumble.returnYards')} for a safety`);
    } else {
      clauses.push(`returned ${yardagePhrase(context, intent.result.fumble?.returnYards, 'result.fumble.returnYards')} ${spotPhrase(context, 'to', returnEnd, 'result.fumble.returnEndYardLine')}`);
      if (intent.result.code === 'touchback') clauses.push('touchback');
    }
  }

  return sentence(joinClauses(clauses));
}

function puntSummary(context: SummaryContext): string {
  const { intent } = context;
  const punter = requiredPlayer(context, participantByRole(intent, 'punter') ?? primaryParticipant(intent), 'participants.primary');
  const team = teamAbbr(intent, intent.play.actionTeam);
  const distance = distancePhrase(context, intent.result.kick?.kickYards, 'result.kick.kickYards');
  const catchSpot = intent.result.kick?.catchYardLine;
  const returner = intent.participants.returner ?? participantByPlayerId(intent, intent.result.return?.returnerPlayerId);
  const blockedBy = intent.result.kick?.blockedByPlayerId
    ? participantByPlayerId(intent, intent.result.kick.blockedByPlayerId)
    : undefined;
  const puntLead = `${team} ${formatPlayer(punter)} punt${blockedBy ? ` blocked by ${formatPlayer(blockedBy)},` : ''}`;

  if ((intent.result.code === 'touchback' || intent.play.subtype === 'touchback') && !intent.result.return && !intent.result.fumble) {
    return sentence(`${puntLead} ${distance} into the end zone, touchback`);
  }

  if ((intent.result.code === 'outOfBounds' || intent.play.subtype === 'outOfBounds') && !intent.result.return) {
    return sentence(`${puntLead} ${distance} out-of-bounds ${spotPhrase(context, 'at', intent.result.endYardLine, 'result.endYardLine')}`);
  }

  if (intent.result.code === 'blocked' || intent.play.subtype === 'blocked') {
    const blocker = participantByRole(intent, 'blocker') ?? intent.participants.defenders[0];
    return sentence(`${team} ${formatPlayer(punter)} punt blocked${blocker ? ` by ${formatPlayer(blocker)}` : ''} ${spotPhrase(context, 'at', intent.result.endYardLine, 'result.endYardLine')}`);
  }

  const clauses = [`${puntLead} ${distance} ${spotPhrase(context, 'to', catchSpot, 'result.kick.catchYardLine')}`];

  if (intent.result.code === 'fairCatch' || intent.play.subtype === 'fairCatch') {
    clauses.push(returner ? `fair catch by ${formatPlayer(returner)}` : 'fair catch');
  } else if (intent.result.code === 'downed' || intent.play.subtype === 'downed') {
    const downingPlayer = intent.participants.others[0];
    clauses.push(downingPlayer ? `downed by ${formatPlayer(downingPlayer)}` : 'downed');
  } else if (intent.result.code === 'muffed' || intent.play.subtype === 'muffed') {
    clauses.push(returner ? `muffed by ${formatPlayer(returner)}` : 'muffed');
    appendRecoveryClause(context, clauses);
  } else if (returner || intent.result.return) {
    const returnLead = `${formatPlayer(returner)} return ${yardagePhrase(context, intent.result.return?.returnYards, 'result.return.returnYards')}`;
    if (intent.result.scoring?.type === 'touchdown') clauses.push(`${returnLead} for a touchdown`);
    else if (intent.result.scoring?.type === 'safety') clauses.push(`${returnLead} for a safety`);
    else {
      clauses.push(`${returnLead} ${spotPhrase(context, 'to', intent.result.return?.returnEndYardLine ?? intent.result.endYardLine, 'result.return.returnEndYardLine')}`);
      if (intent.result.code === 'touchback') clauses.push('touchback');
    }
    if (intent.result.code === 'outOfBounds') clauses.push('out-of-bounds');
    const tacklers = tacklerPhrase(defendersByRoles(intent, ['tackler', 'assistTackler']));
    if (tacklers) clauses.push(tacklers);
    appendReturnFumbleClauses(context, clauses);
  }
  clauses.push(...lateralClauses(context));

  return sentence(joinClauses(clauses));
}

function kickoffSummary(context: SummaryContext): string {
  const { intent } = context;
  const kicker = requiredPlayer(context, participantByRole(intent, 'kicker') ?? primaryParticipant(intent), 'participants.primary');
  const team = teamAbbr(intent, intent.play.actionTeam);

  if ((intent.result.code === 'touchback' || intent.play.subtype === 'touchback') && !intent.result.return && !intent.result.fumble) {
    return sentence(`${team} ${formatPlayer(kicker)} kickoff into the end zone, touchback`);
  }

  if ((intent.result.code === 'outOfBounds' || intent.play.subtype === 'outOfBounds') && !intent.result.return) {
    const rekick = intent.penalties.some((penalty) => (
      penalty.code === 'FKI'
      && penalty.status === 'accepted'
      && (penalty.replayDown || penalty.downConsequence === 'REPEAT')
    ));
    const outOfBoundsSpot = intent.result.kick?.outOfBoundsYardLine ?? intent.result.endYardLine;
    const outOfBoundsPhrase = canonicalSpotPhrase(context, 'at', outOfBoundsSpot, 'result.kick.outOfBoundsYardLine');
    if (rekick) return sentence(`${team} ${formatPlayer(kicker)} kickoff out-of-bounds ${outOfBoundsPhrase}`);
    const awardedSpot = intent.result.endYardLine;
    const awardedPhrase = awardedSpot && awardedSpot !== outOfBoundsSpot
      ? `, ball spotted ${spotPhrase(context, 'at', awardedSpot, 'result.endYardLine')}`
      : '';
    return sentence(`${team} ${formatPlayer(kicker)} kickoff out-of-bounds ${outOfBoundsPhrase}${awardedPhrase}`);
  }

  const distance = distancePhrase(context, intent.result.kick?.kickYards, 'result.kick.kickYards');
  const catchSpot = intent.result.kick?.catchYardLine;
  const returner = intent.participants.returner ?? participantByPlayerId(intent, intent.result.return?.returnerPlayerId);
  const clauses = [`${team} ${formatPlayer(kicker)} kickoff ${distance} ${spotPhrase(context, 'to', catchSpot, 'result.kick.catchYardLine')}`];

  if (intent.play.subtype === 'onside') {
    const recovery = intent.participants.recoveredBy ?? participantByPlayerId(intent, intent.result.fumble?.recoveredByPlayerId);
    clauses.push(`recovered by ${formatPlayer(recovery)} for ${teamAbbr(intent, intent.result.fumble?.recoveredByTeam ?? intent.result.nextPossession ?? intent.play.actionTeam)} ${spotPhrase(context, 'at', intent.result.fumble?.recoverySpot ?? intent.result.endYardLine, 'result.fumble.recoverySpot')}`);
  } else if (intent.result.code === 'fairCatch' || intent.play.subtype === 'fairCatch') {
    clauses.push(returner ? `fair catch by ${formatPlayer(returner)}` : 'fair catch');
  } else if (intent.result.code === 'muffed' || intent.play.subtype === 'muffed') {
    clauses.push(returner ? `muffed by ${formatPlayer(returner)}` : 'muffed');
    appendRecoveryClause(context, clauses);
  } else if (returner || intent.result.return) {
    const returnLead = `${formatPlayer(returner)} return ${yardagePhrase(context, intent.result.return?.returnYards, 'result.return.returnYards')}`;
    if (intent.result.scoring?.type === 'touchdown') clauses.push(`${returnLead} for a touchdown`);
    else if (intent.result.scoring?.type === 'safety') clauses.push(`${returnLead} for a safety`);
    else {
      clauses.push(`${returnLead} ${spotPhrase(context, 'to', intent.result.return?.returnEndYardLine ?? intent.result.endYardLine, 'result.return.returnEndYardLine')}`);
      if (intent.result.code === 'touchback') clauses.push('touchback');
    }
    if (intent.result.code === 'outOfBounds') clauses.push('out-of-bounds');
    const tacklers = tacklerPhrase(intent.participants.defenders);
    if (tacklers) clauses.push(tacklers);
    appendReturnFumbleClauses(context, clauses);
  }
  clauses.push(...lateralClauses(context));

  return sentence(joinClauses(clauses));
}

function fieldGoalSummary(context: SummaryContext): string {
  const { intent } = context;
  const kicker = requiredPlayer(context, participantByRole(intent, 'kicker') ?? primaryParticipant(intent), 'participants.primary');
  const team = teamAbbr(intent, intent.play.actionTeam);
  const distance = attemptDistance(context, intent.result.kick?.attemptYards, 'result.kick.attemptYards');

  if (intent.result.return) {
    const attemptResult = intent.result.kick?.blockedByPlayerId ? 'blocked' : 'no good';
    const returner = intent.participants.returner ?? participantByPlayerId(intent, intent.result.return.returnerPlayerId);
    const returnResult = intent.result.scoring?.type === 'touchdown'
      ? 'for a touchdown'
      : `${yardagePhrase(context, intent.result.return.returnYards, 'result.return.returnYards')} ${spotPhrase(context, 'to', intent.result.return.returnEndYardLine, 'result.return.returnEndYardLine')}`;
    return sentence(`${team} ${formatPlayer(kicker)} ${distance} field goal ${attemptResult}, returned by ${formatPlayer(returner)} ${returnResult}`);
  }

  if (intent.result.code === 'blocked' || intent.play.subtype === 'blocked') {
    const blocker = participantByRole(intent, 'blocker') ?? intent.participants.defenders[0];
    return sentence(`${team} ${formatPlayer(kicker)} ${distance} field goal blocked${blocker ? ` by ${formatPlayer(blocker)}` : ''}`);
  }

  if (intent.result.code === 'missed' || intent.play.subtype === 'missed') {
    const clauses = [`${team} ${formatPlayer(kicker)} ${distance} field goal no good`];
    const missedReason = missedReasonPhrase(intent.result.kick?.missedReason);
    if (missedReason) clauses.push(missedReason);
    if (intent.participants.returner || intent.result.return) {
      clauses.push(`returned by ${formatPlayer(intent.participants.returner)} ${yardagePhrase(context, intent.result.return?.returnYards, 'result.return.returnYards')} ${spotPhrase(context, 'to', intent.result.return?.returnEndYardLine ?? intent.result.endYardLine, 'result.return.returnEndYardLine')}`);
    }
    return sentence(joinClauses(clauses));
  }

  return sentence(`${team} ${formatPlayer(kicker)} ${distance} field goal good`);
}

function gameControlSummary(context: SummaryContext): string {
  const { intent } = context;
  const team = teamAbbr(intent, intent.play.actionTeam);
  const control = intent.result.gameControl;

  if (!control) return sentence(`${team} game control update`);

  if (control.action === 'setBallContext') {
    return sentence(`${team} ball context set to ${control.down ?? '?'} and ${control.distance ?? '?'} at ${formatSpot(control.spot)}${control.lineToGain ? `, line to gain ${formatSpot(control.lineToGain)}` : ''}`);
  }

  if (control.action === 'setPossession') {
    return sentence(`Possession set to ${teamAbbr(intent, control.possession)}`);
  }

  if (control.action === 'setClock') return sentence(`Game clock set to ${control.clock ?? intent.play.clock ?? '00:00'}`);
  if (control.action === 'timeout') {
    const clock = formatFootballClockDisplay(control.clock ?? intent.play.clock, '0:00');
    if (control.timeoutType === 'officials') return sentence(`(${clock}) Officials Timeout`);
    if (control.timeoutType === 'media') return sentence(`(${clock}) Media Timeout`);
    return sentence(`(${clock}) Timeout called by ${teamName(intent, control.teamSide ?? intent.play.actionTeam)}`);
  }
  if (control.action === 'challenge') {
    const status = String(control.challengeStatus ?? 'initiated').replace(/([a-z])([A-Z])/g, '$1 $2');
    return sentence(`${teamAbbr(intent, control.teamSide ?? intent.play.actionTeam)} challenge ${status}`);
  }
  if (control.action === 'startQuarter') return sentence(`Start quarter ${control.period ?? intent.play.period}`);
  if (control.action === 'endQuarter') return sentence(`End quarter ${control.period ?? intent.play.period}`);
  if (control.action === 'startDrive') return sentence(`${teamAbbr(intent, control.possession ?? intent.play.actionTeam)} drive starts at ${formatSpot(control.spot)}`);
  if (control.action === 'coinToss') return sentence('Coin toss control');
  if (control.action === 'emergency') return sentence(`Emergency clock stop at ${control.clock ?? intent.play.clock ?? '00:00'}`);
  if (control.action === 'rosterFunction') return sentence('Roster function control');

  return sentence(`${team} game control update`);
}

function trySummary(context: SummaryContext): string {
  const { intent } = context;
  const team = teamAbbr(intent, intent.play.actionTeam);

  if (intent.result.return) {
    const returner = intent.participants.returner ?? participantByPlayerId(intent, intent.result.return.returnerPlayerId);
    const returnResult = intent.result.scoring?.type === 'defensiveConversion'
      ? 'for a defensive conversion'
      : `${yardagePhrase(context, intent.result.return.returnYards, 'result.return.returnYards')} ${spotPhrase(context, 'to', intent.result.return.returnEndYardLine, 'result.return.returnEndYardLine')}`;
    return sentence(`${team} try ${intent.result.code}, returned by ${formatPlayer(returner)} ${returnResult}`);
  }

  if (intent.play.subtype === 'rush') {
    const result = intent.result.code === 'made'
      ? 'good'
      : intent.result.code === 'fumble'
        ? 'fumbled'
        : 'failed';
    return sentence(`${team} two-point rush by ${formatPlayer(primaryParticipant(intent))} ${result}`);
  }

  if (intent.play.subtype === 'pass') {
    const passer = primaryParticipant(intent);
    const receiver = intent.participants.secondary;
    const includeReceiver = Boolean(receiver) && intent.result.code !== 'interception';
    const phrase = includeReceiver
      ? `two-point pass from ${formatPlayer(passer)} to ${formatPlayer(receiver)}`
      : `two-point pass from ${formatPlayer(passer)}`;
    const result = intent.result.code === 'made'
      ? 'good'
      : intent.result.code === 'incomplete'
        ? 'incomplete'
        : intent.result.code === 'interception'
          ? 'intercepted'
          : intent.result.code === 'fumble'
            ? 'fumbled'
            : 'failed';
    return sentence(`${team} ${phrase} ${result}`);
  }

  if (intent.play.subtype === 'defensiveReturn') {
    return sentence(`${team} try failed, returned by ${formatPlayer(intent.participants.returner)} for a defensive conversion`);
  }

  const kicker = requiredPlayer(context, participantByRole(intent, 'kicker') ?? primaryParticipant(intent), 'participants.primary');
  if (intent.result.code === 'blocked' || intent.play.subtype === 'blocked') {
    const blocker = participantByRole(intent, 'blocker') ?? intent.participants.defenders[0];
    return sentence(`${team} ${formatPlayer(kicker)} extra point blocked${blocker ? ` by ${formatPlayer(blocker)}` : ''}`);
  }

  if (intent.result.code === 'missed' || intent.play.subtype === 'missed') {
    const missedReason = missedReasonPhrase(intent.result.kick?.missedReason);
    return sentence(`${team} ${formatPlayer(kicker)} extra point no good${missedReason ? `, ${missedReason}` : ''}`);
  }

  return sentence(`${team} ${formatPlayer(kicker)} extra point good`);
}

function penaltiesSummary(
  context: SummaryContext,
  penalties: readonly DraftPenalty[],
  options: { attached?: boolean } = {},
): string {
  if (penalties.length === 0) return '';

  if (penalties.every((penalty) => penalty.status === 'offsetting')) {
    const previousPlayCounts = penalties[0]?.offsetting?.previousPlayCounts;
    const penaltyList = penalties.map((penalty) => penaltyBasicText(context, penalty)).join('; ');
    if (previousPlayCounts === true) return sentence(`Offsetting penalties after the play: ${penaltyList}. Previous play counts`);
    if (previousPlayCounts === false) return sentence(`Offsetting penalties: ${penaltyList}. Previous play does not count`);
    return sentence(`Penalties offset: ${penaltyList}`);
  }

  if (options.attached) {
    return penalties.map((penalty) => attachedPenaltyText(context, penalty)).join('; ');
  }

  if (penalties.length === 1) {
    return sentence(penaltyText(context, penalties[0]));
  }

  return sentence(penalties.map((penalty) => penaltyText(context, penalty)).join('; '));
}

function penaltyText(context: SummaryContext, penalty: DraftPenalty): string {
  const parts = [`PENALTY ${penaltyBasicText(context, penalty)}`];

  if (penalty.status === 'declined') {
    parts.push('declined');
    appendPenaltyEjection(context, penalty, parts);
    return parts.join(', ');
  }

  if (penalty.status === 'pending') {
    addWarning(context, 'PENALTY_PENDING', 'Penalty enforcement is pending', `penalties.${penalty.penaltyId}`);
    parts.push('pending enforcement');
    return parts.join(', ');
  }

  if (penalty.status === 'accepted') parts.push(penaltyEnforcementText(context, penalty));
  if (penalty.downConsequence === 'AUTO_FIRST' || penalty.automaticFirstDown) parts.push('automatic first down');
  if (penalty.downConsequence === 'LOSS_OF_DOWN' || penalty.lossOfDown) parts.push('loss of down');
  if ((penalty.downConsequence === 'REPEAT' || penalty.replayDown) && !context.intent.prePlay.setupContext) parts.push('replay down');
  if (penalty.downConsequence === 'DOWN_COUNTS' || penalty.downCounts) parts.push('down counts');
  if (penalty.carryOverToKO) parts.push('enforced on the kickoff');
  appendPenaltyEjection(context, penalty, parts);

  return parts.join(', ');
}

function attachedPenaltyText(context: SummaryContext, penalty: DraftPenalty): string {
  const parts = [`PENALTY ${penaltyBasicText(context, penalty)}`];

  if (penalty.status === 'declined') {
    parts.push('declined');
    appendPenaltyEjection(context, penalty, parts);
    return parts.join(', ');
  }

  if (penalty.status === 'pending') {
    addWarning(context, 'PENALTY_PENDING', 'Penalty enforcement is pending', `penalties.${penalty.penaltyId}`);
    parts.push('pending enforcement');
    return parts.join(', ');
  }

  if (penalty.status === 'accepted') {
    const yardsText = penaltyDisplayYards(context, penalty);
    if (penalty.enforcedFrom === 'SPOT' && penalty.spotOfFoul && penalty.finalSpot) {
      parts.push(`enforced ${yardsText} from ${formatSpot(penalty.spotOfFoul)} to ${formatSpot(penalty.finalSpot)}`);
    } else if (penalty.finalSpot) {
      parts.push(`${yardsText} to ${formatSpot(penalty.finalSpot)}`);
    } else {
      parts.push(yardsText);
    }
  }

  if (penalty.downConsequence === 'AUTO_FIRST' || penalty.automaticFirstDown) parts.push('automatic first down');
  if (penalty.downConsequence === 'LOSS_OF_DOWN' || penalty.lossOfDown) parts.push('loss of down');
  if (penalty.downConsequence === 'REPEAT' || penalty.replayDown) parts.push('replay down');
  if (penalty.downConsequence === 'DOWN_COUNTS' || penalty.downCounts) parts.push('down counts');
  if (penalty.carryOverToKO) parts.push('enforced on the kickoff');
  appendPenaltyEjection(context, penalty, parts);

  return parts.join(', ');
}

function appendPenaltyEjection(context: SummaryContext, penalty: DraftPenalty, parts: string[]): void {
  if (!penalty.ejected) return;
  const playerId = penalty.ejectedPlayerId ?? penalty.penalizedPlayerId ?? penalty.playerId ?? undefined;
  const participant = participantByPlayerId(context.intent, playerId);
  parts.push(`${participant ? formatPlayer(participant) : 'penalized person'} ejected from the game`);
}

function penaltyDisplayYards(context: SummaryContext, penalty: DraftPenalty): string {
  if (typeof penalty.yards === 'number') {
    const yards = Math.abs(penalty.yards);
    return `${yards} ${pluralize('yard', yards)}`;
  }

  if (penalty.status === 'accepted') {
    addWarning(context, 'PENALTY_MISSING_YARDS', 'Accepted penalty is missing yards', `penalties.${penalty.penaltyId}.yards`);
  }

  return 'yards pending';
}

function penaltyEnforcementText(context: SummaryContext, penalty: DraftPenalty): string {
  const yardsText = penaltyDisplayYards(context, penalty);
  const originSpot = penalty.enforcedFrom === 'SPOT'
    ? penalty.spotOfFoul
    : penalty.enforcedFrom === 'PREVIOUS'
      ? context.intent.prePlay.yardLine ?? undefined
      : undefined;

  if (originSpot && penalty.finalSpot) {
    return `${yardsText} from ${formatSpot(originSpot)} to ${formatSpot(penalty.finalSpot)}`;
  }
  if (penalty.finalSpot) {
    return `${yardsText} from ${formatEnforcementSpot(penalty.enforcedFrom)} to ${formatSpot(penalty.finalSpot)}`;
  }
  return `${yardsText} from ${formatEnforcementSpot(penalty.enforcedFrom)}`;
}

function penaltyBasicText(context: SummaryContext, penalty: DraftPenalty): string {
  const name = penalty.name || penalty.code || 'Penalty';
  const playerId = penalty.penalizedPlayerId ?? penalty.playerId ?? undefined;
  const participant = participantByPlayerId(context.intent, playerId);
  const playerText = participant ? ` (${formatPlayer(participant)})` : '';
  return `${teamAbbr(context.intent, penalty.team)} ${name}${playerText}`;
}

function primaryParticipant(intent: FootballDraftIntent): DraftParticipant | undefined {
  return intent.participants.primary;
}

function participantByRole(intent: FootballDraftIntent, role: DraftParticipant['role']): DraftParticipant | undefined {
  return allParticipants(intent).find((participant) => participant.role === role);
}

function lateralClauses(context: SummaryContext): string[] {
  const { intent } = context;
  return (intent.result.laterals ?? []).map((lateral) => {
    const recipient = participantByPlayerId(intent, lateral.toPlayerId);
    return `lateral to ${formatPlayer(recipient)} ${spotPhrase(context, 'at', lateral.spot, 'result.laterals.spot')}`;
  });
}

function appendRecoveryClause(context: SummaryContext, clauses: string[]): void {
  const { intent } = context;
  const fumble = intent.result.fumble;
  if (!fumble) return;
  const recovery = intent.participants.recoveredBy ?? participantByPlayerId(intent, fumble.recoveredByPlayerId);
  if (recovery || fumble.recoveredByTeam) {
    clauses.push(`recovered by ${formatPlayer(recovery)} for ${teamAbbr(intent, fumble.recoveredByTeam)} ${spotPhrase(context, 'at', fumble.recoverySpot, 'result.fumble.recoverySpot')}`);
  }
  if (fumble.returnEndYardLine || typeof fumble.returnYards === 'number') {
    clauses.push(`returned ${yardagePhrase(context, fumble.returnYards, 'result.fumble.returnYards')} ${spotPhrase(context, 'to', fumble.returnEndYardLine, 'result.fumble.returnEndYardLine')}`);
  }
}

function appendReturnFumbleClauses(context: SummaryContext, clauses: string[]): void {
  const { intent } = context;
  const fumble = intent.result.fumble;
  if (!fumble) return;
  const forcedBy = intent.participants.forcedBy ?? participantByPlayerId(intent, fumble.forcedByPlayerId);
  clauses.push(`fumbled ${spotPhrase(context, 'at', fumble.spot, 'result.fumble.spot')}`);
  if (forcedBy) clauses.push(`forced by ${formatPlayer(forcedBy)}`);
  appendRecoveryClause(context, clauses);
}

function participantByPlayerId(intent: FootballDraftIntent, playerId: string | undefined): DraftParticipant | undefined {
  if (!playerId) return undefined;
  return allParticipants(intent).find((participant) => participant.playerId === playerId);
}

function defendersByRoles(intent: FootballDraftIntent, roles: DraftParticipant['role'][]): DraftParticipant[] {
  return intent.participants.defenders.filter((participant) => roles.includes(participant.role));
}

function allParticipants(intent: FootballDraftIntent): DraftParticipant[] {
  const participants = intent.participants;
  return [
    participants.primary,
    participants.secondary,
    ...participants.defenders,
    participants.returner,
    participants.kicker,
    participants.punter,
    participants.holder,
    participants.fumbler,
    participants.forcedBy,
    participants.recoveredBy,
    ...participants.penalizedPlayers,
    ...participants.others,
  ].filter((participant): participant is DraftParticipant => Boolean(participant));
}

function requiredPlayer(context: SummaryContext, participant: DraftParticipant | undefined, field: string): DraftParticipant | undefined {
  if (!participant) {
    addWarning(context, 'UNRESOLVED_PLAYER', 'Required player is missing', field);
  }
  return participant;
}

function formatPlayer(participant: DraftParticipant | undefined): string {
  if (!participant) return 'unknown player';
  const jersey = participant.jersey ? `#${participant.jersey}` : '';
  const name = participant.displayName?.trim();
  return [jersey, name].filter(Boolean).join(' ') || 'unknown player';
}

function formatPlayerList(participants: readonly DraftParticipant[]): string {
  const names = participants.map(formatPlayer);
  if (names.length <= 2) return names.join(' and ');
  return `${names.slice(0, -1).join(', ')}, and ${names[names.length - 1]}`;
}

function tacklerPhrase(defenders: readonly DraftParticipant[]): string {
  if (defenders.length === 0) return '';
  return `tackled by ${formatPlayerList(defenders)}`;
}

function missedReasonPhrase(reason: string | undefined): string {
  if (reason === 'wideRight') return 'wide right';
  if (reason === 'wideLeft') return 'wide left';
  if (reason === 'short') return 'short';
  if (reason === 'leftUpright') return 'left upright';
  if (reason === 'rightUpright') return 'right upright';
  if (reason === 'crossbar') return 'crossbar';
  return '';
}

function teamAbbr(intent: FootballDraftIntent, team: TeamCode | null | undefined): string {
  if (team === 'H') return intent.game.teams.H.abbr || 'HOM';
  if (team === 'V') return intent.game.teams.V.abbr || 'VIS';
  return 'TEAM';
}

function teamName(intent: FootballDraftIntent, team: TeamCode | null | undefined): string {
  if (team === 'H') return intent.game.teams.H.name || teamAbbr(intent, team);
  if (team === 'V') return intent.game.teams.V.name || teamAbbr(intent, team);
  return 'Team';
}

function yardagePhrase(context: SummaryContext, yards: number | undefined, field: string): string {
  if (typeof yards !== 'number') {
    addWarning(context, 'MISSING_YARDS', 'Yardage is missing', field);
    return 'yards pending';
  }
  if (yards > 0) return `for ${yards} ${pluralize('yard', yards)}`;
  if (yards === 0) return 'for no gain';
  return `for loss of ${Math.abs(yards)} ${pluralize('yard', Math.abs(yards))}`;
}

function distancePhrase(context: SummaryContext, yards: number | undefined, field: string): string {
  if (typeof yards !== 'number') {
    addWarning(context, 'MISSING_YARDS', 'Kick distance is missing', field);
    return 'yards pending';
  }
  return `${yards} ${pluralize('yard', yards)}`;
}

function attemptDistance(context: SummaryContext, yards: number | undefined, field: string): string {
  if (typeof yards !== 'number') {
    addWarning(context, 'MISSING_YARDS', 'Attempt distance is missing', field);
    return 'yardage-pending';
  }
  return `${yards}-yard`;
}

function spotPhrase(context: SummaryContext, preposition: 'to' | 'at' | 'from', spot: Spot | undefined, field: string): string {
  const formatted = formatSpot(spot);
  if (!formatted) {
    addWarning(context, spot ? 'INVALID_SPOT' : 'MISSING_SPOT', spot ? `Invalid field position: ${spot}` : 'Field position is missing', field);
    return `${preposition} spot pending`;
  }
  return `${preposition} ${formatted}`;
}

function canonicalSpotPhrase(context: SummaryContext, preposition: 'to' | 'at' | 'from', spot: Spot | undefined, field: string): string {
  if (!spot) {
    addWarning(context, 'MISSING_SPOT', 'Field position is missing', field);
    return `${preposition} spot pending`;
  }
  if (spot === '50' || spot === 'H50' || spot === 'V50') return `${preposition} midfield`;
  if (spot === 'goal') return `${preposition} the goal line`;
  if (!isCanonicalSpot(spot)) {
    addWarning(context, 'INVALID_SPOT', `Invalid field position: ${spot}`, field);
    return `${preposition} spot pending`;
  }
  const team = spot.slice(0, 1);
  const yard = spot.slice(1);
  if (Number(yard) === 0) return `${preposition} the ${team} goal line`;
  return `${preposition} the ${team}${yard}`;
}

function formatSpot(spot: Spot | undefined): string {
  if (!spot) return '';
  if (spot === '50' || spot === 'H50' || spot === 'V50') return 'midfield';
  if (spot === 'goal') return 'the goal line';
  if (!isCanonicalSpot(spot)) return '';

  const team = spot.slice(0, 1);
  const yard = Number(spot.slice(1));
  if (yard === 0) return `the ${team} goal line`;
  return `the ${team}${yard}`;
}

function formatEnforcementSpot(value: DraftPenalty['enforcedFrom']): string {
  if (value === 'PREVIOUS') return 'the previous spot';
  if (value === 'SPOT') return 'the spot';
  if (value === 'END') return 'the end of the run';
  if (value === 'TRY') return 'the try';
  if (value === 'FREE_KICK') return 'the free kick';
  if (value === 'SUCCESSFUL_TD') return 'the successful touchdown';
  return value;
}

function joinClauses(clauses: string[]): string {
  const [first, ...rest] = clauses.filter(Boolean);
  if (!first) return '';
  return [first, ...rest.map((clause) => `, ${clause}`)].join('');
}

function joinSentences(sentences: string[]): string {
  return sentences.filter(Boolean).join(' ');
}

function sentence(text: string): string {
  const trimmed = text.replace(/\s+/g, ' ').trim();
  if (!trimmed) return '';
  return /[.!?]$/.test(trimmed) ? trimmed : `${trimmed}.`;
}

function stripTerminalPunctuation(text: string): string {
  return text.trim().replace(/[.!?]+$/, '');
}

function pluralize(word: string, value: number): string {
  return Math.abs(value) === 1 ? word : `${word}s`;
}

function addWarning(
  context: SummaryContext,
  code: DraftWarningCode,
  message: string,
  field?: string,
): void {
  context.warnings.push({
    code,
    severity: code === 'UNRESOLVED_PLAYER' || code === 'PENALTY_PENDING' ? 'blocker' : 'warning',
    message,
    field,
    source: 'fpsg',
  });
}
