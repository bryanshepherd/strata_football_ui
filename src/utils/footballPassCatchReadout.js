// Presentation only: a recorded catch location is required. Never derive it
// from gain/YAC, or change the event description stored by the scorer.
export const formatFootballPassCatchReadout = (event, text) => {
  const pass = event?.result?.pass;
  const caughtAt = String(pass?.catchYardLine || pass?.caughtAtYardLine || '').trim().toUpperCase();
  if (event?.type !== 'pass' || !/^[HV]\d{1,2}$/.test(caughtAt)) return text;

  // Match the existing completion wording, leaving names and credited yards
  // intact. Incompletions, interceptions and already-formatted text do not match.
  const completion = text.match(/^(.*?\bpass complete to .+?) for (no gain|(?:a )?loss of \d+ yards?|\d+ yards?)(?: to the ([HV]\d{1,2}|[A-Za-z][A-Za-z0-9]* \d{1,2}|(?:[HV] )?(?:goal line|end zone)))?(?= for a |,|\.$|$)(.*)$/);
  if (!completion || / at the /i.test(completion[1])) return text;
  const [, lead, yardage, endSpot, remainder] = completion;
  const catchLead = `${lead} at the ${caughtAt}`;
  const penaltyIndex = remainder.search(/, (?:Deadball foul, )?PENALTY\b/);
  const penalty = penaltyIndex >= 0 ? remainder.slice(penaltyIndex) : '.';
  const ending = (penaltyIndex >= 0 ? remainder.slice(0, penaltyIndex) : remainder).replace(/\.$/, '');
  const simple = ending.match(/^(?: for a (touchdown|safety))?(, out-of-bounds)?(?:, tackled by (.+))?$/);

  // Keep lateral, fumble, recovery and other continuation clauses in their
  // original order; their terminal spot may belong to a different player.
  if (!simple) return text.replace(lead, catchLead);
  const [, score, outOfBounds, tacklers] = simple;
  const gain = yardage === 'no gain' ? 'for no gain'
    : /loss of /.test(yardage) ? `for a ${yardage.replace(/^a /, '')}`
      : `for a gain of ${yardage}`;
  const terminal = tacklers
    ? `, tackled by ${tacklers}${endSpot ? ` at the ${endSpot}` : ''}`
    : endSpot ? `, ${outOfBounds ? 'out-of-bounds at' : 'advanced to'} the ${endSpot}` : '';
  return `${catchLead}${terminal} ${gain}${score ? ` for a ${score}` : ''}${outOfBounds && (tacklers || !endSpot) ? outOfBounds : ''}${penalty}`;
};
