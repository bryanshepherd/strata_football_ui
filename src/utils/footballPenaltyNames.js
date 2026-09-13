import { footballPenaltyDisplayName, footballPenaltyRulesetFromRules } from '../quick-input/penaltyTable';

const escapeRegExp = value => String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

// Read only foul-name clauses. Preserve every other word of historical play text.
const nameClauses = (envelope, text) => {
  const immediate = /^Penalty:\s+(.+?)\s+on\s+[^,]+(?:,|$)/i.exec(text);
  if (immediate) return [{ name: immediate[1], start: immediate.index + immediate[0].indexOf(immediate[1]) }];
  const aliases = [...new Set(['H', 'V', ...Object.values(envelope?.game?.teams || {})
    .flatMap(team => [team.name, team.abbr]).filter(Boolean)])]
    .sort((a, b) => b.length - a.length).map(escapeRegExp).join('|');
  const pattern = new RegExp(`(\\bPENALTY\\s+(?:(?:${aliases})\\s+)?)(.+?)(?=\\s+\\(#|[,;]|\\.$|$)`, 'gi');
  return [...text.matchAll(pattern)].map(match => ({ name: match[2].trim(), start: match.index + match[1].length }));
};

export const footballEventPenaltyName = (envelope, event, penalty, index) => footballPenaltyDisplayName(
  penalty,
  footballPenaltyRulesetFromRules(envelope?.game?.rules),
  nameClauses(envelope, String(event?.description || ''))[index]?.name,
);

export const repairFootballPenaltyNames = (envelope, event) => {
  if (!event?.penalties?.length || (!event.description && !event.confirmation?.summaryText)) return event;
  let changed = false;
  const penalties = event.penalties.map((penalty, index) => {
    const name = footballEventPenaltyName(envelope, event, penalty, index);
    if (name === penalty.name || name.toUpperCase() === String(penalty.code || '').trim().toUpperCase()
      || name === 'Penalty') return penalty;
    changed = true;
    return { ...penalty, name };
  });
  const repairText = value => {
    if (typeof value !== 'string') return value;
    let text = value;
    const clauses = nameClauses(envelope, text);
    for (let index = clauses.length - 1; index >= 0; index -= 1) {
      const clause = clauses[index];
      const penalty = penalties[index];
      if (!penalty?.name || clause.name.toUpperCase() !== String(penalty.code || '').trim().toUpperCase()) continue;
      text = text.slice(0, clause.start) + penalty.name + text.slice(clause.start + clause.name.length);
    }
    return text;
  };
  const description = repairText(event.description);
  const summaryText = repairText(event.confirmation?.summaryText);
  if (!changed && description === event.description && summaryText === event.confirmation?.summaryText) return event;
  return {
    ...event, penalties, description,
    ...(event.confirmation ? { confirmation: { ...event.confirmation, summaryText } } : {}),
  };
};
