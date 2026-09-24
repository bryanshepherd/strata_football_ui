import { confirmedPenaltyAfterPossessionChange } from './footballPenaltyPossession';

// Keep this exception separate from yardline math: other spot-enforced fouls
// still credit the play through the foul spot, even when the spots are equal.
export const hasAcceptedDpiSpotPenalty = (event) => (event?.penalties || []).some((penalty) => (
  penalty.status === 'accepted'
  && (
    String(penalty.code || '').trim().toUpperCase() === 'DPI'
    || String(penalty.name || '').trim().toLowerCase() === 'defensive pass interference'
  )
  && ['spot', 'spotoffoul'].includes(String(penalty.enforcedFrom || '').trim().toLowerCase())
));

export const countsAsFootballDrivePlay = (event) => (
  ['rush', 'pass', 'punt', 'fieldGoal'].includes(event?.type)
  && !hasAcceptedDpiSpotPenalty(event)
  && (confirmedPenaltyAfterPossessionChange(event) || !(event.penalties || []).some(penalty => (
    penalty.status === 'accepted' && ['PREVIOUS', 'previousSpot'].includes(penalty.enforcedFrom)
  )))
);

// Historical drive counters are derived data. Refresh affected counters only
// when the full accepted log is available, without altering spots or contexts.
export const repairDpiSpotDrivePlayCounts = (envelope) => {
  const events = [...(envelope?.events || [])].filter(event => !event.status || event.status === 'accepted')
    .sort((a, b) => Number(a.sequence) - Number(b.sequence));
  if (events.some((event, index) => Number(event.sequence) !== index + 1)) return envelope;
  const dpi = events.filter(hasAcceptedDpiSpotPenalty);
  if (!dpi.length || !envelope.drives) return envelope;
  const matches = (event, drive) => drive.driveId && event.preState?.driveId
    ? event.preState.driveId === drive.driveId
    : Number(drive.driveNumber) > 0 && Number(event.preState?.driveNumber) === Number(drive.driveNumber);
  const repair = drive => {
    if (!drive || !dpi.some(event => matches(event, drive))) return drive;
    return { ...drive, plays: events.filter(event => matches(event, drive) && countsAsFootballDrivePlay(event)).length };
  };
  return { ...envelope, drives: { ...envelope.drives,
    completed: (envelope.drives.completed || []).map(repair), current: repair(envelope.drives.current),
  } };
};
