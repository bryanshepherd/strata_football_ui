// The initial onside recovery is separate from a later fumble during its return.
export const footballOnsideRecovery = (event) => {
  const onside = event?.result?.kick?.onside;
  if (!onside || (event.type ?? event.play?.family) !== 'kickoff') return null;
  const kickingTeam = event.participants?.kicker?.team || event.participants?.primary?.team || event.play?.actionTeam;
  if (onside.recoveredByTeam !== kickingTeam) return null;
  return {
    fumblerPlayerId: onside.touched ? onside.touchedByPlayerId : undefined,
    fumblerTeam: kickingTeam === 'H' ? 'V' : 'H',
    recoveredByPlayerId: onside.recoveredByPlayerId, recoveredByTeam: onside.recoveredByTeam,
    spot: event.result.kick.catchYardLine, recoverySpot: onside.recoverySpot,
    returnYards: onside.returned ? event.result.return?.returnYards ?? 0 : 0,
    turnover: onside.touched === true,
  };
};

export const footballFumbleRecords = (event) => {
  const onside = footballOnsideRecovery(event);
  return [onside?.fumblerPlayerId ? onside : null, event?.result?.fumble].filter(Boolean);
};

export const footballRecoveryRecords = (event) => [footballOnsideRecovery(event), event?.result?.fumble].filter(Boolean);
