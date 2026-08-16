import { footballTeamAliasesForEnvelope } from './footballTeamAliases';

const RULE_SPOT_FIELDS = {
  kickoffSpot: 'H',
  touchbackSpot: 'H',
  nonKickTouchbackSpot: 'H',
  kickoffTouchbackSpot: 'H',
  safetyKickSpot: 'H',
  patSpot: 'V',
};

const canonicalTeamSide = (value, teamAliases = {}) => {
  const prefix = String(value || '').trim().toUpperCase();
  if (prefix === 'H' || prefix === 'V') return prefix;
  if (prefix && prefix === teamAliases.H) return 'H';
  if (prefix && prefix === teamAliases.V) return 'V';
  return '';
};

/**
 * Normalize a yard-line value without coercing arbitrary objects into strings.
 * A bare number is only meaningful when the caller supplies its field-relative
 * side (rule yardlines use H for "own" and V for "opponent").
 */
export function normalizeFootballSpot(value, { teamAliases = {}, defaultSide = '' } = {}) {
  if (value === null || value === undefined || value === '') return null;

  if (typeof value === 'number') {
    if (!Number.isInteger(value) || value < 0 || value > 50) return null;
    if (value === 50) return '50';
    const side = canonicalTeamSide(defaultSide, teamAliases);
    return side ? `${side}${String(value).padStart(2, '0')}` : null;
  }

  if (typeof value !== 'string') return null;
  const normalized = value.trim().toUpperCase();
  if (normalized === '50' || normalized === 'H50' || normalized === 'V50') return '50';
  if (normalized === 'GOAL') return 'goal';

  const match = normalized.match(/^([A-Z])?(\d{1,2})$/);
  if (!match) return null;
  const yard = Number(match[2]);
  if (!Number.isInteger(yard) || yard < 0 || yard > 49) return null;
  const side = canonicalTeamSide(match[1] || defaultSide, teamAliases);
  return side ? `${side}${String(yard).padStart(2, '0')}` : null;
}

/**
 * Repair the dashboard/API rule representation as it enters scorer state.
 * Invalid object-shaped values are omitted so downstream logic can use its
 * explicit fallback instead of receiving "[object Object]".
 */
export function normalizeFootballEnvelopeRuleSpots(envelope) {
  const rules = envelope?.game?.rules;
  if (!rules || typeof rules !== 'object' || Array.isArray(rules)) return envelope;

  const teamAliases = footballTeamAliasesForEnvelope(envelope);
  const normalizedRules = { ...rules };
  let changed = false;

  for (const [field, defaultSide] of Object.entries(RULE_SPOT_FIELDS)) {
    if (!Object.prototype.hasOwnProperty.call(rules, field)) continue;
    const normalized = normalizeFootballSpot(rules[field], { teamAliases, defaultSide });
    if (!normalized) {
      delete normalizedRules[field];
      changed = true;
    } else if (normalized !== rules[field]) {
      normalizedRules[field] = normalized;
      changed = true;
    }
  }

  return changed
    ? { ...envelope, game: { ...envelope.game, rules: normalizedRules } }
    : envelope;
}

export function formatFootballSpotForDisplay(value, envelope) {
  const teamAliases = footballTeamAliasesForEnvelope(envelope);
  const normalized = normalizeFootballSpot(value, { teamAliases });
  if (!normalized) return null;
  if (normalized === '50') return normalized;
  if (normalized === 'goal') return 'Goal';
  return `${teamAliases[normalized[0]] || normalized[0]}${normalized.slice(1)}`;
}
