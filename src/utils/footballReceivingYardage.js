const numeric = (value) => value === undefined || value === null || String(value).trim() === ''
  ? null
  : Number.isFinite(Number(value)) ? Number(value) : null;

const relativeSpot = (spot, team, length) => {
  if (!['H', 'V'].includes(team)) return null;
  const value = String(spot || '').trim();
  if (/^goal$/i.test(value)) return length;
  if (/^(?:50|midfield)$/i.test(value)) return length / 2;
  const match = value.match(/^([HV])(\d{1,2})$/i);
  if (!match || Number(match[2]) > length / 2) return null;
  return match[1].toUpperCase() === team ? Number(match[2]) : length - Number(match[2]);
};

export const footballYardsAfterCatch = (event, fieldLength = 100) => {
  const pass = event?.result?.pass;
  const explicit = pass?.yardsAfterCatch ?? pass?.yac;
  if (explicit !== undefined && explicit !== null) return numeric(explicit);
  const length = Math.max(1, numeric(fieldLength) ?? 100);
  const team = event?.possession ?? event?.preState?.possession;
  const caught = relativeSpot(pass?.catchYardLine ?? pass?.caughtAtYardLine, team, length);
  const end = relativeSpot(pass?.terminalYardLine ?? event?.result?.endYardLine, team, length);
  return caught !== null && end !== null ? end - caught : null;
};

export const footballReceivingYardageWarning = (event, fieldLength = 100) => {
  const pass = event?.result?.pass;
  if (event?.type !== 'pass' || (pass?.outcome ?? event.subtype) !== 'complete') return null;
  const receivingYards = numeric(pass?.receivingYards ?? pass?.passingYards ?? event?.result?.yards);
  const yac = footballYardsAfterCatch(event, fieldLength);
  if (receivingYards === null || yac === null || yac - receivingYards < 10) return null;
  return {
    receivingYards, yac, excess: yac - receivingYards,
    catchSpot: pass?.catchYardLine ?? pass?.caughtAtYardLine,
    endSpot: pass?.terminalYardLine ?? event?.result?.endYardLine,
  };
};
