// Use the challenging team, which can differ from the team in possession.
export function formatFootballChallengeReadout(control, teams = {}) {
  if (control?.action !== 'challenge') return null;
  const side = [control.teamSide, control.possession].find(value => value === 'H' || value === 'V')
    || (control.teamId && ['H', 'V'].find(value => teams[value]?.teamId === control.teamId));
  const team = side ? (teams[side]?.abbr || teams[side]?.name || (side === 'H' ? 'Home' : 'Visitor')) : null;
  const subject = team ? `Challenge by ${team}` : 'Challenge';
  switch (control.challengeStatus || 'initiated') {
    case 'initiated': return team ? `${team} is challenging the previous play.` : 'The previous play is under review.';
    case 'successful': return `${subject} is successful.`;
    case 'unsuccessful': return `${subject} is unsuccessful.`;
    case 'callStands': return `${subject}: the ruling on the field stands.`;
    case 'callConfirmed': return `${subject}: the ruling on the field is confirmed.`;
    case 'callOverturned': return `${subject}: the ruling on the field is overturned.`;
    default: return `${subject}.`;
  }
}
