const teamName = (teams, team) => teams?.[team]?.name || teams?.[team]?.abbr || team;

const electionText = (choice, direction) => {
  if (choice === 'kick') return 'kick';
  if (choice === 'receive') return 'receive';
  if (choice === 'defer') return 'defer';
  if (choice === 'side') return direction ? `defend the ${direction} goal` : 'choose direction';
  return '';
};

export const formatFootballHalfChoice = ({
  choice,
  choiceTeam,
  direction,
  directionChoiceTeam,
  kickingTeam,
  receivingTeam,
  teams,
  winner = false,
}) => {
  const election = electionText(choice, direction);
  if (!choiceTeam || !election || !kickingTeam || !receivingTeam) return null;
  const opening = winner
    ? `${teamName(teams, choiceTeam)} won the toss and elected to ${election}.`
    : `${teamName(teams, choiceTeam)} elected to ${election} to begin the second half.`;
  const directionAlreadyStated = choice === 'side' && choiceTeam === directionChoiceTeam;
  const directionClause = direction && directionChoiceTeam && !directionAlreadyStated
    ? `; ${teamName(teams, directionChoiceTeam)} will defend the ${direction} goal`
    : '';
  return `${opening} ${teamName(teams, kickingTeam)} will kick to ${teamName(teams, receivingTeam)}${directionClause}.`;
};

const textValue = value => String(value ?? '').trim();

export const footballCaptainLines = (envelope) => ['V', 'H'].flatMap(team => {
  const selections = envelope?.pregame?.coinToss?.captains?.[team];
  if (!Array.isArray(selections)) return [];
  const players = Object.values(envelope?.rosters?.teams?.[team]?.players || {});
  const seen = new Set();
  const names = selections.flatMap(selection => {
    if (!selection || typeof selection !== 'object') return [];
    const id = textValue(selection.playerId);
    if (id && seen.has(id)) return [];
    if (id) seen.add(id);
    // Never resolve by jersey: offensive and defensive players can share it.
    const player = id ? players.find(candidate => textValue(candidate.playerId) === id) : null;
    const jersey = textValue(player?.jersey ?? selection.jerseyNumber ?? selection.jersey);
    const name = textValue(player?.displayName)
      || [player?.firstName, player?.lastName].map(textValue).filter(Boolean).join(' ')
      || textValue(selection.displayName || selection.name);
    const label = [jersey, name].filter(Boolean).join(' - ');
    return label ? [label] : [];
  });
  if (!names.length) return [];
  return [`${teamName(envelope?.game?.teams, team)} Captains: ${names.join(', ')}`];
});

export const footballCoinTossLines = (envelope) => {
  const toss = envelope?.pregame?.coinToss;
  const result = toss?.status === 'complete' ? formatFootballHalfChoice({
    choice: toss.winnerInitialChoice,
    choiceTeam: toss.winnerTeam,
    direction: toss.direction,
    directionChoiceTeam: toss.directionChoiceTeam,
    kickingTeam: toss.firstHalfKickingTeam,
    receivingTeam: toss.firstHalfReceivingTeam,
    teams: envelope?.game?.teams,
    winner: true,
  }) : null;
  return [...footballCaptainLines(envelope), ...(result ? [result] : [])];
};
