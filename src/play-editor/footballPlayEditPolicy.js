const TURNOVER_RESULT_CODES = new Set([
  'interception',
  'fumble',
  'muffed',
  'turnover',
]);

const DIRECT_RESULT_PAIR = new Set(['outofbounds', 'tackle']);

const canonicalResultCode = (normalizedCode, fallback) => ({
  endofplay: 'endOfPlay',
  outofbounds: 'outOfBounds',
  tackle: 'tackle',
}[normalizedCode] || fallback);

export const normalizePlayResultCode = (value) => String(value || '')
  .replace(/[^a-z0-9]/gi, '')
  .toLowerCase();

export const isTurnoverPlay = (play) => {
  const result = play?.result || {};
  const resultCode = normalizePlayResultCode(result.code);
  return TURNOVER_RESULT_CODES.has(resultCode)
    || Boolean(result.turnover)
    || result.fumble?.turnover === true;
};

export const classifyPlayEdit = (originalPlay, editedPlay) => {
  const reasons = [];
  const originalType = String(originalPlay?.type || '');
  const editedType = String(editedPlay?.type || '');
  const originalSubtype = originalPlay?.subtype ?? null;
  const editedSubtype = editedPlay?.subtype ?? null;
  const originalResult = normalizePlayResultCode(originalPlay?.result?.code);
  const editedResult = normalizePlayResultCode(editedPlay?.result?.code);

  if (originalType !== editedType) {
    reasons.push('Changing the play type requires replacing the play.');
  }

  if (originalSubtype !== editedSubtype) {
    reasons.push('Changing this play subtype requires replacing the play.');
  }

  if ((originalPlay?.penalties?.length || 0) !== (editedPlay?.penalties?.length || 0)) {
    reasons.push('Adding or removing a penalty requires replacing the play.');
  }

  if (originalResult !== editedResult) {
    const isTackleOutOfBoundsSwap = DIRECT_RESULT_PAIR.has(originalResult)
      && DIRECT_RESULT_PAIR.has(editedResult);
    const isAllowedEndOfPlay = editedResult === 'endofplay'
      && !isTurnoverPlay(originalPlay)
      && !isTurnoverPlay(editedPlay);

    if (!isTackleOutOfBoundsSwap && !isAllowedEndOfPlay) {
      reasons.push('This result-code change requires replacing the play.');
    }
  }

  return {
    mode: reasons.length > 0 ? 'replace' : 'update',
    reasons,
  };
};

export const getDirectResultCodeOptions = (play) => {
  const original = normalizePlayResultCode(play?.result?.code);
  const options = [canonicalResultCode(original, play?.result?.code || '')];

  if (DIRECT_RESULT_PAIR.has(original)) {
    options.push(original === 'tackle' ? 'outOfBounds' : 'tackle');
  }

  if (!isTurnoverPlay(play) && original !== 'endofplay') {
    options.push('endOfPlay');
  }

  return [...new Set(options.filter(Boolean))];
};

export const isDirectResultCodeChange = (originalPlay, editedPlay) => (
  classifyPlayEdit(originalPlay, editedPlay).mode === 'update'
);
