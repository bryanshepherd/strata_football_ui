const DEFAULT_OFFICIAL_ROLES = [
  'Referee',
  'Umpire',
  'Head Linesman',
  'Line Judge',
  'Field Judge',
  'Side Judge',
  'Back Judge',
  'Replay Official',
  'Scorer',
];

const validTimestamp = (value) => {
  if (!value) return '';
  const date = new Date(value);
  return Number.isFinite(date.getTime()) ? date.toISOString() : '';
};

const eventTimestamp = (event) => validTimestamp(event?.acceptedAt || event?.createdAt);

const acceptedEvents = (envelope) => [...(envelope?.events || [])]
  .filter((event) => !event?.status || event.status === 'accepted')
  .sort((left, right) => Number(left?.sequence || 0) - Number(right?.sequence || 0));

const finalEventForEnvelope = (envelope, events) => {
  const periods = Number(envelope?.game?.rules?.periods || 4);
  return [...events].reverse().find((event) => (
    event?.type === 'gameControl'
    && ['endGame', 'endQuarter'].includes(event?.subtype)
    && Number(event?.period || event?.result?.period || 0) >= periods
  )) || events.at(-1);
};

const recordForTeam = (record) => ({
  overall: String(record?.overall || ''),
  conference: String(record?.conference || ''),
});

const officialsForWrapUp = (officials) => {
  if (Array.isArray(officials) && officials.length > 0) {
    return officials.map((official) => ({
      role: String(official?.role || ''),
      name: String(official?.name || ''),
    }));
  }
  return DEFAULT_OFFICIAL_ROLES.map((role) => ({ role, name: '' }));
};

export function calculateFootballGameDurationMinutes(startedAt, endedAt) {
  const start = new Date(startedAt).getTime();
  const end = new Date(endedAt).getTime();
  if (!Number.isFinite(start) || !Number.isFinite(end) || end < start) return null;
  return Math.round((end - start) / 60_000);
}
export function formatFootballGameDuration(durationMinutes) {
  if (!Number.isFinite(durationMinutes) || durationMinutes < 0) return 'Not available';
  const totalMinutes = Math.round(durationMinutes);
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  return `${hours}:${String(minutes).padStart(2, '0')}`;
}

export function isoToFootballDateTimeLocal(value) {
  const timestamp = validTimestamp(value);
  if (!timestamp) return '';
  const date = new Date(timestamp);
  const pad = (part) => String(part).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

export function footballDateTimeLocalToIso(value) {
  return validTimestamp(value);
}

export function createFootballGameWrapUpDraft(envelope) {
  const existing = envelope?.game?.wrapUp || {};
  const events = acceptedEvents(envelope);
  const firstEventAt = eventTimestamp(events[0]);
  const finalEventAt = eventTimestamp(finalEventForEnvelope(envelope, events));
  const scheduledAt = validTimestamp(envelope?.game?.scheduledAt);
  const envelopeUpdatedAt = validTimestamp(envelope?.updatedAt);
  const startedAt = validTimestamp(existing.startedAt) || firstEventAt || scheduledAt;
  const endedAt = validTimestamp(existing.endedAt)
    || finalEventAt
    || (envelope?.game?.status === 'final' ? envelopeUpdatedAt : '');

  return {
    previousRecords: {
      H: recordForTeam(existing.previousRecords?.H || envelope?.game?.teamRecords?.H),
      V: recordForTeam(existing.previousRecords?.V || envelope?.game?.teamRecords?.V),
    },
    startedAt,
    endedAt,
    durationMinutes: calculateFootballGameDurationMinutes(startedAt, endedAt),
    officials: officialsForWrapUp(existing.officials || envelope?.game?.officials),
    weather: {
      temperatureF: existing.weather?.temperatureF ?? '',
      wind: String(existing.weather?.wind || ''),
      conditions: String(existing.weather?.conditions || ''),
    },
    attendance: existing.attendance ?? '',
    notes: String(existing.notes || ''),
    completedAt: validTimestamp(existing.completedAt) || null,
    updatedAt: validTimestamp(existing.updatedAt) || null,
  };
}

export function applyFootballGameWrapUp(envelope, input, savedAt = new Date().toISOString()) {
  const startedAt = validTimestamp(input?.startedAt);
  const endedAt = validTimestamp(input?.endedAt);
  const durationMinutes = calculateFootballGameDurationMinutes(startedAt, endedAt);
  if (!startedAt || !endedAt || durationMinutes === null) {
    throw new Error('Enter a valid start and end time. The end time cannot be before the start time.');
  }

  const attendance = input?.attendance === '' || input?.attendance == null
    ? null
    : Number(input.attendance);
  if (attendance !== null && (!Number.isSafeInteger(attendance) || attendance < 0)) {
    throw new Error('Attendance must be a whole number of zero or greater.');
  }

  const temperatureF = input?.weather?.temperatureF === '' || input?.weather?.temperatureF == null
    ? null
    : Number(input.weather.temperatureF);
  if (temperatureF !== null && !Number.isFinite(temperatureF)) {
    throw new Error('Temperature must be a number.');
  }

  const timestamp = validTimestamp(savedAt) || new Date().toISOString();
  const currentWrapUp = envelope?.game?.wrapUp || {};
  const wrapUp = {
    previousRecords: {
      H: recordForTeam(input?.previousRecords?.H),
      V: recordForTeam(input?.previousRecords?.V),
    },
    startedAt,
    endedAt,
    durationMinutes,
    officials: officialsForWrapUp(input?.officials),
    weather: {
      temperatureF,
      wind: String(input?.weather?.wind || '').trim(),
      conditions: String(input?.weather?.conditions || '').trim(),
    },
    attendance,
    notes: String(input?.notes || '').trim(),
    completedAt: validTimestamp(currentWrapUp.completedAt) || timestamp,
    updatedAt: timestamp,
  };

  return {
    ...envelope,
    updatedAt: timestamp,
    game: {
      ...envelope.game,
      status: 'final',
      wrapUp,
    },
    pregame: envelope.pregame
      ? { ...envelope.pregame, gamePhase: 'final' }
      : envelope.pregame,
  };
}
