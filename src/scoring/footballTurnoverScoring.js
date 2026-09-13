import { footballReturnTouchdown } from './footballReturnTouchdown';
import { confirmedPenaltyAfterPossessionChange } from '../utils/footballPenaltyPossession';
import { isFootballTryReplayEvent } from './footballDriveSummary';

const token = value => String(value || '').replace(/[^a-z]/gi, '').toLowerCase();
const counts = event => Boolean(event) && (!event.status || event.status === 'accepted')
  && (confirmedPenaltyAfterPossessionChange(event) || !(event.penalties || []).some(penalty => (
    penalty.status === 'offsetting' || (penalty.status === 'accepted' && penalty.timing !== 'deadBall'
      && (penalty.replayDown || ['previous', 'previousspot', 'spot', 'spotoffoul'].includes(token(penalty.enforcedFrom))))
  )));

// The drive belongs to the offense even when its opponent scores on the return.
// An intercepted pass gains no offensive yardage; a fumble ends at the loss spot.
export const footballReturnTouchdownDriveEnd = (event, driveTeam) => {
  if (!counts(event) || event?.result?.scoring?.team === driveTeam) return null;
  const returned = footballReturnTouchdown(event);
  if (!returned) return null;
  if (event.type === 'punt') return { result: 'punt', endYardLine: event.preState?.yardLine };
  if (!['rush', 'pass'].includes(event.type)) return null;
  if (returned.type === 'interception') return { result: 'turnover', endYardLine: event.preState?.yardLine };
  if (returned.type === 'fumble') return {
    result: 'turnover',
    endYardLine: event.result.fumble?.spot || event.result.fumble?.recoverySpot
      || event.result.turnover?.spot || event.preState?.yardLine,
  };
  return null;
};

export const footballPointsOffTurnovers = (envelope, events) => {
  const points = { H: 0, V: 0 };
  const turnoverDrives = new Map([
    ...(envelope?.drives?.completed || []), envelope?.drives?.current,
  ].filter(drive => drive?.driveId && (
    token(drive.startReason) === 'turnover' || /fumble|interception/.test(token(drive.startReason))
  )).map(drive => [drive.driveId, drive.team]));
  let pendingTouchdown = null;
  for (const event of events) {
    if (event?.status && event.status !== 'accepted') continue;
    const scoring = event.result?.scoring;
    const scoringTeam = scoring?.team;
    const score = Math.max(0, Number(scoring?.points) || 0);
    if (event.type === 'try') {
      if (counts(event) && pendingTouchdown?.eligible && pendingTouchdown.team === scoringTeam) {
        points[scoringTeam] += score;
      }
      // A replayed try has not finished this touchdown's scoring sequence.
      if (!isFootballTryReplayEvent(event)) pendingTouchdown = null;
      continue;
    }
    if (['gameControl', 'penalty'].includes(event.type)) continue;
    pendingTouchdown = null;
    if (!counts(event) || !['H', 'V'].includes(scoringTeam) || score === 0) continue;
    const returned = footballReturnTouchdown(event);
    const directTurnoverScore = returned && ['fumble', 'interception'].includes(returned.type);
    const offense = event.possession || event.preState?.possession;
    const eligible = Boolean(directTurnoverScore || (scoringTeam === offense
      && turnoverDrives.get(event.preState?.driveId) === scoringTeam));
    if (eligible) points[scoringTeam] += score;
    if (scoring.type === 'touchdown') pendingTouchdown = { team: scoringTeam, eligible };
  }
  return points;
};
