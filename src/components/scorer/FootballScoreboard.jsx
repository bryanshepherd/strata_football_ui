import React from 'react';

const formatStatus = (status) =>
  String(status || 'unknown').replace(/([a-z])([A-Z])/g, '$1 $2');

const formatDownDistance = (liveState) => {
  if (!liveState.down || !liveState.distance) {
    return 'Not set';
  }

  if (liveState.goalToGo) {
    return `${liveState.down} and goal`;
  }

  return `${liveState.down} and ${liveState.distance}`;
};

const formatSpot = (liveState) => liveState.yardLine || 'Not set';

const resolveTeamTimeoutLimit = (envelope) => {
  const rules = envelope.game.rules || {};
  const configured = Number(
    rules.timeouts
    ?? rules.timeoutsPerHalf
    ?? rules.timeoutsPerGame
    ?? rules.timeoutFull
    ?? rules.timeout_full,
  );

  return Number.isFinite(configured) && configured > 0 ? configured : 3;
};

const resolveChallengeLimit = (envelope) => {
  const rules = envelope.game.rules || {};
  const configured = Number(
    rules.challenges
    ?? rules.challengesPerGame
    ?? rules.challengeCount
    ?? rules.replayChallenges,
  );

  return Number.isFinite(configured) && configured >= 0 ? configured : 2;
};

export default function FootballScoreboard({ envelope }) {
  const liveState = envelope.liveState;
  // `game.status` remains "pregame" until a kickoff is accepted. The explicit
  // pregame lifecycle is the authoritative display state in that interval.
  const displayStatus = envelope.pregame?.gamePhase || envelope.game.status;

  return (
    <div className="space-y-3 border-b border-zinc-300 bg-zinc-100 p-4">
      <section className="grid overflow-hidden rounded border border-zinc-300 bg-white md:grid-cols-[1fr_auto_1fr]">
        <TeamScoreCard envelope={envelope} teamCode="V" align="left" />
        <div className="flex flex-col items-center justify-center border-y border-zinc-200 bg-zinc-950 px-8 py-4 text-white md:border-x md:border-y-0">
          <div className="text-xs font-semibold uppercase tracking-wide text-zinc-400">
            {formatStatus(displayStatus)}
          </div>
          <div className="mt-1 text-4xl font-black tabular-nums">
            {envelope.clock.clock}
          </div>
          <div className="mt-1 text-sm text-zinc-300">
            Q{envelope.clock.period || '-'}
          </div>
        </div>
        <TeamScoreCard envelope={envelope} teamCode="H" align="right" />
      </section>

      <section className="grid gap-px overflow-hidden rounded border border-zinc-300 bg-zinc-300 text-sm md:grid-cols-3">
        <StripCell label="Down/Distance" value={formatDownDistance(liveState)} />
        <StripCell label="Spot" value={formatSpot(liveState)} />
        <StripCell label="Line To Gain" value={liveState.lineToGain || 'None'} />
      </section>
    </div>
  );
}

const TeamScoreCard = ({ envelope, teamCode, align }) => {
  const team = envelope.game.teams[teamCode];
  const hasPossession = envelope.liveState.possession === teamCode;
  const timeoutLimit = resolveTeamTimeoutLimit(envelope);
  const challengeLimit = resolveChallengeLimit(envelope);
  const timeoutCount = envelope.liveState.timeouts?.[teamCode] ?? timeoutLimit;
  const challengeCount = envelope.liveState.challenges?.[teamCode] ?? challengeLimit;
  const isHome = align === 'right';

  return (
    <div
      className={`flex items-center justify-between gap-3 p-4 ${
        isHome ? 'md:flex-row-reverse md:text-right' : ''
      }`}
    >
      <div className={`min-w-0 ${isHome ? 'items-end' : 'items-start'} flex flex-col`}>
        <div className={`flex items-center gap-2 ${isHome ? 'flex-row-reverse' : ''}`}>
          <div className="truncate text-sm font-semibold uppercase tracking-wide text-zinc-500">
            {team.abbr}
          </div>
          {hasPossession && <PossessionOval />}
        </div>
        <div className="truncate text-lg font-semibold">{team.name}</div>
        <TeamStatusChips
          challengeCount={challengeCount}
          challengeLimit={challengeLimit}
          side={teamCode}
          timeoutCount={timeoutCount}
          timeoutLimit={timeoutLimit}
        />
      </div>
      <div className="text-5xl font-black tabular-nums">{team.score}</div>
    </div>
  );
};

const PossessionOval = () => (
  <span
    aria-label="Possession football"
    className="relative inline-flex h-4 w-8 items-center justify-center rounded-[999px] border border-amber-950 bg-amber-800 shadow-sm"
  >
    <span className="h-px w-4 bg-amber-100" />
    <span className="absolute h-2.5 w-px bg-amber-100" />
  </span>
);

const TeamStatusChips = ({
  challengeCount,
  challengeLimit,
  side,
  timeoutCount,
  timeoutLimit,
}) => {
  const timeoutChips = (
    <div className="flex items-center gap-1" aria-label={`${side} timeouts`}>
      {Array.from({ length: timeoutLimit }, (_, index) => (
        <span
          key={`timeout-${index}`}
          className={`h-4 w-6 rounded-sm border text-[10px] font-bold leading-4 ${
            index < timeoutCount
              ? 'border-emerald-500 bg-emerald-500 text-white'
              : 'border-zinc-300 bg-zinc-200 text-zinc-400'
          }`}
        >
          T
        </span>
      ))}
    </div>
  );
  const challengeChips = (
    <div className="flex items-center gap-1" aria-label={`${side} challenges`}>
      {Array.from({ length: challengeLimit }, (_, index) => (
        <span
          key={`challenge-${index}`}
          className={`h-4 w-6 rounded-sm border text-[10px] font-bold leading-4 ${
            index < challengeCount
              ? 'border-red-500 bg-red-500 text-white'
              : 'border-zinc-300 bg-zinc-200 text-zinc-400'
          }`}
        >
          C
        </span>
      ))}
    </div>
  );

  return (
    <div className="mt-2 flex items-center gap-1">
      {side === 'H' ? challengeChips : timeoutChips}
      {side === 'H' ? timeoutChips : challengeChips}
    </div>
  );
};

const StripCell = ({ label, value }) => (
  <div className="bg-white p-3 text-zinc-950">
    <div className="text-xs font-semibold uppercase tracking-wide text-zinc-500">
      {label}
    </div>
    <div className="mt-1 text-lg font-semibold">{value}</div>
  </div>
);
