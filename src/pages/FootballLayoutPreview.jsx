import React, { useMemo, useState } from 'react';
import FootballScoreboard from '../components/scorer/FootballScoreboard';
import ScorerLayoutShell from '../components/scorer/ScorerLayoutShell';
import { getGameEnvelopeFixture } from '../data/footballGameEnvelopeFixtures';
import {
  createInitialFootballQuickInputState,
  transitionFootballQuickInput,
} from '../quick-input/footballConfirmedQuickInputMachine';
import { calculateYardsGained } from '../utils/footballRulesEngine';
import { formatFootballClockDisplay } from '../utils/footballClock';

const PLAY_BUTTONS = [
  { label: 'Rush', hotkey: 'R' },
  { label: 'Pass', hotkey: 'P' },
  { label: 'Punt', hotkey: 'U' },
  { label: 'Kick', hotkey: 'K' },
  { label: 'Penalty', hotkey: 'E' },
  { label: 'Game Control', hotkey: 'G' },
];

const TEAM_STAT_ROWS = [
  { label: '1st Downs', formatter: (stats) => formatNumberStat(stats.firstDowns) },
  { label: 'Rushing', formatter: (stats) => formatForYards(stats.rushAtt, stats.rushYds) },
  { label: 'Passing', formatter: (stats) => `${stats.passComp} for ${stats.passAtt}, ${stats.passInt} INT` },
  { label: 'Passing Yards', formatter: (stats) => formatNumberStat(stats.passYds) },
  { label: 'Plays', formatter: (stats) => formatForYards(stats.totalPlays, stats.totalYds) },
  { label: 'Avg/Play', formatter: (stats) => formatDecimal(stats.avgPerPlay) },
  { label: 'Kick Returns', formatter: (stats) => formatForYards(stats.kickReturnCount, stats.kickReturnYds) },
  { label: 'Punt Returns', formatter: (stats) => formatForYards(stats.puntReturnCount, stats.puntReturnYds) },
  { label: 'Int. Returns', formatter: (stats) => formatForYards(stats.intReturnCount, stats.intReturnYds) },
  { label: 'Fumble Returns', formatter: (stats) => formatForYards(stats.fumbleReturnCount, stats.fumbleReturnYds) },
  { label: 'Fumbles', formatter: (stats) => `${stats.fumbles}-${stats.fumblesLost} lost` },
  { label: 'Penalties', formatter: (stats) => formatForYards(stats.penalties, stats.penaltyYds) },
  { label: 'Punts', formatter: (stats) => `${stats.punts} for ${formatDecimal(stats.puntAverage)} yards` },
  { label: 'TOP', formatter: (stats) => formatPossessionTime(stats.timeOfPossession) },
  { label: '3rd Downs', formatter: (stats) => `${stats.thirdDownConversions} for ${stats.thirdDownAttempts}` },
  { label: '4th Downs', formatter: (stats) => `${stats.fourthDownConversions} for ${stats.fourthDownAttempts}` },
];

const formatStatus = (status) =>
  String(status || 'unknown').replace(/([a-z])([A-Z])/g, '$1 $2');

const toNumber = (value, fallback = 0) => {
  const numberValue = Number(value);
  return Number.isFinite(numberValue) ? numberValue : fallback;
};

const readFirstValue = (source, keys, fallback = 0) => {
  for (const key of keys) {
    const value = key.split('.').reduce((current, part) => current?.[part], source);
    if (value !== undefined && value !== null && value !== '') {
      return value;
    }
  }

  return fallback;
};

const formatNumberStat = (value) => String(toNumber(value));

const formatForYards = (count, yards) => `${toNumber(count)} for ${toNumber(yards)} yards`;

const formatDecimal = (value) => toNumber(value).toFixed(1);

const formatPossessionTime = (value) => {
  if (typeof value === 'string' && /^\d{1,2}:\d{2}$/.test(value)) {
    return formatFootballClockDisplay(value);
  }

  const seconds = Math.max(0, Math.floor(toNumber(value)));
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;

  return `${minutes}:${String(remainingSeconds).padStart(2, '0')}`;
};

const resolveTeamStatsSource = (envelope, teamCode) => {
  const teams = envelope.stats?.teams || {};
  const sideKey = teamCode === 'H' ? 'home' : 'visitor';
  const dbTeamKey = teamCode === 'H' ? 'HOME' : 'VISITOR';

  return teams[teamCode] || teams[sideKey] || teams[dbTeamKey] || {};
};

const buildPreviewTeamStats = (envelope, teamCode) => {
  const source = resolveTeamStatsSource(envelope, teamCode);
  const rushAtt = toNumber(readFirstValue(source, ['rush.att', 'rushing.att', 'rushAtt', 'RushPlays', 'rushing_attempts']));
  const rushYds = toNumber(readFirstValue(source, ['rush.yds', 'rushing.yds', 'rushYds', 'RushYards', 'rushing_yards']));
  const passComp = toNumber(readFirstValue(source, ['pass.cmp', 'passing.cmp', 'passComp', 'PassComp', 'completions']));
  const passAtt = toNumber(readFirstValue(source, ['pass.att', 'passing.att', 'passAtt', 'PassAtt', 'attempts']));
  const passYds = toNumber(readFirstValue(source, ['pass.yds', 'passing.yds', 'passYds', 'PassYards', 'passing_yards']));
  const totalPlays = toNumber(readFirstValue(source, ['plays', 'totalPlays', 'total_plays'], rushAtt + passAtt));
  const totalYds = toNumber(readFirstValue(source, ['yards', 'totalYds', 'total_yards'], rushYds + passYds));
  const punts = toNumber(readFirstValue(source, ['punts.num', 'punts.count', 'punts', 'Punts']));
  const puntAverage = toNumber(readFirstValue(source, ['punts.avg', 'puntAverage', 'punt_average', 'PuntAverage']));

  return {
    firstDowns: toNumber(readFirstValue(source, ['first_downs', 'firstDowns'])),
    rushAtt,
    rushYds,
    passComp,
    passAtt,
    passInt: toNumber(readFirstValue(source, ['pass.int', 'passing.int', 'passInt', 'Interceptions', 'interceptions'])),
    passYds,
    totalPlays,
    totalYds,
    avgPerPlay: totalPlays > 0 ? totalYds / totalPlays : 0,
    kickReturnCount: toNumber(readFirstValue(source, ['kick_returns.num', 'kickReturns.num', 'kickReturns.count', 'kickReturnCount'])),
    kickReturnYds: toNumber(readFirstValue(source, ['kick_returns.yds', 'kickReturns.yds', 'kickReturnYds'])),
    puntReturnCount: toNumber(readFirstValue(source, ['punt_returns.num', 'puntReturns.num', 'puntReturns.count', 'puntReturnCount'])),
    puntReturnYds: toNumber(readFirstValue(source, ['punt_returns.yds', 'puntReturns.yds', 'puntReturnYds'])),
    intReturnCount: toNumber(readFirstValue(source, ['int_returns.num', 'intReturns.num', 'intReturns.count', 'intReturnCount'])),
    intReturnYds: toNumber(readFirstValue(source, ['int_returns.yds', 'intReturns.yds', 'intReturnYds'])),
    fumbleReturnCount: toNumber(readFirstValue(source, ['fumble_returns.num', 'fumbleReturns.num', 'fumbleReturns.count', 'fumbleReturnCount'])),
    fumbleReturnYds: toNumber(readFirstValue(source, ['fumble_returns.yds', 'fumbleReturns.yds', 'fumbleReturnYds'])),
    fumbles: toNumber(readFirstValue(source, ['fumbles.num', 'fumbles.count', 'fumbles'])),
    fumblesLost: toNumber(readFirstValue(source, ['fumbles.lost', 'fumblesLost'])),
    penalties: toNumber(readFirstValue(source, ['penalties.num', 'penalties.count', 'penalties', 'Penalties'])),
    penaltyYds: toNumber(readFirstValue(source, ['penalties.yds', 'penaltyYds', 'PenaltyYards'])),
    punts,
    puntAverage,
    timeOfPossession: readFirstValue(source, ['possession', 'timeOfPossession', 'time_of_possession', 'TOP'], '0:00'),
    thirdDownConversions: toNumber(readFirstValue(source, ['third_down.made', 'thirdDown.made', 'thirdDownConversions'])),
    thirdDownAttempts: toNumber(readFirstValue(source, ['third_down.att', 'thirdDown.att', 'thirdDownAttempts'])),
    fourthDownConversions: toNumber(readFirstValue(source, ['fourth_down.made', 'fourthDown.made', 'fourthDownConversions'])),
    fourthDownAttempts: toNumber(readFirstValue(source, ['fourth_down.att', 'fourthDown.att', 'fourthDownAttempts'])),
  };
};

const buildFcqiPreviewRoster = (envelope) => {
  const fixturePlayers = Object.values(envelope.rosters?.teams || {}).flatMap((team) =>
    Object.values(team.players || {}),
  );

  return [
    ...fixturePlayers,
    {
      playerId: 'H-3-RB',
      team: 'H',
      jersey: '3',
      displayName: 'Jones',
      position: 'RB',
      off_position: 'RB',
      active: true,
    },
    {
      playerId: 'H-3-LB',
      team: 'H',
      jersey: '3',
      displayName: 'Smith',
      position: 'OLB',
      def_position: 'OLB',
      active: true,
    },
  ];
};

const buildFcqiPreviewContext = (envelope) => ({
  intentId: 'preview-fcqi-rush-intent-1',
  clientEventId: 'preview-fcqi-rush-client-1',
  now: envelope.updatedAt,
  game: {
    gameId: envelope.gameId,
    teams: {
      H: {
        team: 'H',
        teamId: envelope.game.teams.H.teamId,
        name: envelope.game.teams.H.name,
        abbr: envelope.game.teams.H.abbr,
      },
      V: {
        team: 'V',
        teamId: envelope.game.teams.V.teamId,
        name: envelope.game.teams.V.name,
        abbr: envelope.game.teams.V.abbr,
      },
    },
    rules: envelope.game.rules,
  },
  source: {
    kind: 'fcqi',
    startedBy: 'button',
    hotkey: 'R',
    startedAt: envelope.updatedAt,
    baseEnvelopeVersion: envelope.updatedAt,
    baseEventSequence: envelope.stats?.sourceEventSequence ?? envelope.events.length,
    sessionId: 'preview-fcqi-session',
    userId: 'preview-operator',
  },
  play: {
    actionTeam: envelope.liveState.possession || 'H',
    possession: envelope.liveState.possession || 'H',
    period: envelope.clock.period || envelope.game.period || 1,
    clock: envelope.clock.clock || null,
  },
  prePlay: {
    possession: envelope.liveState.possession || 'H',
    down: envelope.liveState.down,
    distance: envelope.liveState.distance,
    yardLine: envelope.liveState.yardLine,
    lineToGain: envelope.liveState.lineToGain,
    goalToGo: envelope.liveState.goalToGo,
    redZone: envelope.liveState.redZone,
    driveId: envelope.liveState.driveId,
    driveNumber: envelope.liveState.driveNumber || 0,
  },
  roster: buildFcqiPreviewRoster(envelope),
  deriveRushYardsFromEndSpot: true,
  calculateRushYards: ({ startYardLine, endYardLine, possession }) =>
    calculateYardsGained(startYardLine, endYardLine, possession),
});

export default function FootballLayoutPreview() {
  const envelope = getGameEnvelopeFixture('normal');

  return (
    <main className="flex min-h-screen flex-col bg-zinc-100 text-zinc-950">
      <header className="border-b border-zinc-300 bg-white px-4 py-3">
        <div className="mx-auto flex max-w-[1500px] items-center justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-emerald-700">
              Layout Preview
            </p>
            <h1 className="text-xl font-semibold">Football Canonical Scorer Shell</h1>
          </div>
          <span className="rounded border border-zinc-300 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-zinc-600">
            Preview only
          </span>
        </div>
      </header>

      <ScorerLayoutShell
        scoreboard={<FootballScoreboard envelope={envelope} />}
        stats={<PreviewStatsSlot envelope={envelope} />}
        input={<PreviewInputSlot envelope={envelope} />}
        eventLog={<PreviewEventLogSlot envelope={envelope} />}
        inputAssistant={<PreviewInputAssistantSlot envelope={envelope} />}
      />
    </main>
  );
}

const PreviewStatsSlot = ({ envelope }) => {
  const visitorStats = buildPreviewTeamStats(envelope, 'V');
  const homeStats = buildPreviewTeamStats(envelope, 'H');

  return (
    <div className="h-full min-h-0 p-2">
      <section className="flex h-full min-h-0 flex-col overflow-hidden rounded border border-zinc-300 bg-white" aria-label="Team Stats">
        <div className="shrink-0 border-b border-zinc-200 px-3 py-1.5">
          <h2 className="text-sm font-bold">Team Stats</h2>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto">
          <table className="w-full table-fixed text-[10px] leading-tight">
            <thead className="bg-zinc-50 text-[9px] uppercase tracking-wide text-zinc-500">
              <tr>
                <th className="w-[30%] px-2 py-1 text-left font-bold">VIS</th>
                <th className="w-[40%] px-1 py-1 text-center font-bold">Stat</th>
                <th className="w-[30%] px-2 py-1 text-right font-bold">HOME</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100">
              {TEAM_STAT_ROWS.map(({ label, formatter }) => (
                <tr key={label}>
                  <td className="px-2 py-1 text-left font-semibold tabular-nums text-zinc-900">
                    {formatter(visitorStats)}
                  </td>
                  <th className="px-1 py-1 text-center font-medium text-zinc-500">
                    {label}
                  </th>
                  <td className="px-2 py-1 text-right font-semibold tabular-nums text-zinc-900">
                    {formatter(homeStats)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
};

const PreviewInputSlot = ({ envelope }) => {
  const currentDrive = envelope.drives.current;
  const team = currentDrive?.team ? envelope.game.teams[currentDrive.team] : null;

  return (
    <div className="space-y-4 p-4">
      <section className="rounded border border-zinc-300 bg-white">
        <div className="grid gap-px overflow-hidden rounded bg-zinc-200 text-sm md:grid-cols-5">
          <PreviewDriveMetric label="Drive" value={currentDrive?.driveId || 'None'} />
          <PreviewDriveMetric label="Team" value={team?.abbr || 'None'} />
          <PreviewDriveMetric label="Start" value={currentDrive?.startYardLine || 'None'} />
          <PreviewDriveMetric label="Plays" value={String(currentDrive?.plays ?? 0)} />
          <PreviewDriveMetric label="Yards" value={String(currentDrive?.yards ?? 0)} />
        </div>
        <div className="border-t border-zinc-200 px-4 py-3 text-sm font-medium text-zinc-700">
          Drive {envelope.liveState.driveNumber || '-'} · {currentDrive?.result || 'Active'}
        </div>
      </section>

      <section className="rounded border border-zinc-300 bg-white">
        <div className="border-b border-zinc-200 px-4 py-3">
          <h2 className="text-base font-semibold">Play Entry</h2>
        </div>
        <div className="p-4">
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            {PLAY_BUTTONS.map(({ label, hotkey }) => (
              <button
                key={label}
                className="flex items-center justify-between gap-3 rounded border border-zinc-300 bg-white px-3 py-3 text-sm font-semibold text-zinc-500"
                disabled
                type="button"
              >
                <span>{label}</span>
                <kbd className="min-w-7 rounded border border-zinc-300 bg-zinc-100 px-2 py-0.5 text-center font-mono text-xs font-bold text-zinc-700">
                  {hotkey}
                </kbd>
              </button>
            ))}
          </div>
        </div>
      </section>

      <FcqiRushPreviewPanel envelope={envelope} />
    </div>
  );
};

const FcqiRushPreviewPanel = ({ envelope }) => {
  const context = useMemo(() => buildFcqiPreviewContext(envelope), [envelope]);
  const [machineState, setMachineState] = useState(() => createInitialFootballQuickInputState());
  const [jerseyValue, setJerseyValue] = useState('');
  const [resultValue, setResultValue] = useState('');
  const [endSpotValue, setEndSpotValue] = useState('');
  const [tacklerAValue, setTacklerAValue] = useState('');
  const [tacklerBValue, setTacklerBValue] = useState('');

  const dispatch = (event) => {
    setMachineState((current) => transitionFootballQuickInput(current, event, context).state);
  };

  const startRush = () => {
    setJerseyValue('');
    setResultValue('');
    setEndSpotValue('');
    setTacklerAValue('');
    setTacklerBValue('');
    dispatch({ type: 'START_RUSH', startedBy: 'button' });
  };

  const commitValue = (value) => {
    setMachineState((current) =>
      transitionFootballQuickInput(
        transitionFootballQuickInput(current, { type: 'INPUT_TOKEN', value }, context).state,
        { type: 'COMMIT_TOKEN' },
        context,
      ).state,
    );
  };

  const handleEnterCommit = (event, value) => {
    if (event.key === 'Enter') {
      event.preventDefault();
      commitValue(value);
    }
  };

  const buildResultJson = machineState.buildResult
    ? JSON.stringify(machineState.buildResult, null, 2)
    : 'No build result yet.';

  return (
    <section className="rounded border border-emerald-300 bg-white" aria-label="FCQI Rush Preview">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-emerald-100 px-4 py-3">
        <div>
          <h2 className="text-base font-semibold text-zinc-950">FCQI Rush Preview</h2>
          <p className="mt-1 text-xs font-medium text-zinc-500">
            Preview harness only. Built requests are not submitted.
          </p>
        </div>
        <button
          className="rounded border border-emerald-600 bg-emerald-600 px-3 py-2 text-sm font-semibold text-white"
          onClick={startRush}
          type="button"
        >
          Start Rush
        </button>
      </div>

      <div className="space-y-4 p-4">
        <div className="grid gap-2 text-xs sm:grid-cols-3">
          <FcqiStatePill label="Machine State" value={machineState.status} />
          <FcqiStatePill label="Current Step" value={machineState.currentStep || 'none'} />
          <FcqiStatePill label="Client Event" value={machineState.draft?.clientEventId || 'not built'} />
        </div>

        <div className="grid gap-3 md:grid-cols-5">
          <FcqiTokenInput
            disabled={machineState.currentStep !== 'rusherJersey'}
            label="Rusher Jersey"
            onChange={setJerseyValue}
            onKeyDown={(event) => handleEnterCommit(event, jerseyValue)}
            placeholder="22 or duplicate 3"
            value={jerseyValue}
          />
          <FcqiTokenInput
            disabled={machineState.currentStep !== 'result'}
            label="Result"
            onChange={setResultValue}
            onKeyDown={(event) => handleEnterCommit(event, resultValue)}
            placeholder="T/O/F/C/."
            value={resultValue}
          />
          <FcqiTokenInput
            disabled={machineState.currentStep !== 'tackleAJersey' && machineState.currentStep !== 'tacklerJersey'}
            label="Tackler A"
            onChange={setTacklerAValue}
            onKeyDown={(event) => handleEnterCommit(event, tacklerAValue)}
            placeholder="44"
            value={tacklerAValue}
          />
          <FcqiTokenInput
            disabled={machineState.currentStep !== 'tackleBJersey'}
            label="Tackler B"
            onChange={setTacklerBValue}
            onKeyDown={(event) => handleEnterCommit(event, tacklerBValue)}
            placeholder="skip"
            value={tacklerBValue}
          />
          <FcqiTokenInput
            disabled={machineState.currentStep !== 'endSpot'}
            label="End Spot"
            onChange={setEndSpotValue}
            onKeyDown={(event) => handleEnterCommit(event, endSpotValue)}
            placeholder="V49"
            value={endSpotValue}
          />
        </div>

        {machineState.status === 'jersey.disambiguating' && machineState.duplicate && (
          <div className="rounded border border-amber-300 bg-amber-50 p-3" role="dialog" aria-label="Duplicate jersey selector">
            <div className="text-sm font-semibold text-amber-950">
              Duplicate #{machineState.duplicate.jerseyToken}: choose player
            </div>
            <div className="mt-2 grid gap-2 sm:grid-cols-2">
              {machineState.duplicate.candidates.map((candidate) => (
                <button
                  className={`rounded border bg-white px-3 py-2 text-left text-sm ${
                    candidate.playerId === machineState.duplicate.recommendedPlayerId
                      ? 'border-emerald-500'
                      : 'border-zinc-300'
                  }`}
                  key={candidate.playerId}
                  onClick={() => dispatch({ type: 'SELECT_DUPLICATE_PLAYER', playerId: candidate.playerId })}
                  type="button"
                >
                  <span className="font-semibold">#{candidate.jersey} {candidate.displayName}</span>
                  <span className="ml-2 text-xs text-zinc-500">{candidate.position || 'POS'}</span>
                  {candidate.playerId === machineState.duplicate.recommendedPlayerId && (
                    <span className="ml-2 rounded bg-emerald-100 px-1.5 py-0.5 text-[10px] font-bold uppercase text-emerald-800">
                      Recommended
                    </span>
                  )}
                </button>
              ))}
            </div>
            <button
              className="mt-2 text-xs font-semibold text-amber-900 underline"
              onClick={() => dispatch({ type: 'CANCEL_DUPLICATE' })}
              type="button"
            >
              Cancel duplicate selection
            </button>
          </div>
        )}

        {machineState.status === 'draft.ready' && (
          <div className="rounded border border-zinc-200 bg-zinc-50 p-3">
            <div className="text-sm font-semibold">Draft ready</div>
            <div className="mt-1 text-xs text-zinc-600">
              Rusher: {machineState.tokens.rusher?.displayName || 'none'} · Result: {machineState.tokens.result || 'none'} · Yards: {machineState.tokens.yards ?? 'none'} · End spot: {machineState.tokens.endYardLine || machineState.tokens.recoverSpot || 'none'}
            </div>
            <div className="mt-3 flex flex-wrap gap-2">
              <button
                className="rounded border border-zinc-900 bg-zinc-900 px-3 py-2 text-sm font-semibold text-white"
                onClick={() => dispatch({ type: 'GENERATE_SUMMARY' })}
                type="button"
              >
                Generate Summary
              </button>
            </div>
          </div>
        )}

        {machineState.error && (
          <div className="rounded border border-red-300 bg-red-50 px-3 py-2 text-sm font-semibold text-red-800">
            {machineState.error.message}
          </div>
        )}

        {machineState.status === 'summary.reviewing' && machineState.summary && (
          <div className="rounded border border-sky-300 bg-sky-50 p-3">
            <div className="text-sm font-semibold text-sky-950">Summary Review</div>
            <p className="mt-2 text-sm text-zinc-950">{machineState.summary.summaryText}</p>
            <button
              className="mt-3 rounded border border-sky-700 bg-sky-700 px-3 py-2 text-sm font-semibold text-white"
              onClick={() => dispatch({ type: 'CONFIRM_SUMMARY' })}
              type="button"
            >
              Confirm Build Request
            </button>
          </div>
        )}

        {machineState.status === 'submitting.confirmed' && (
          <div className="rounded border border-emerald-300 bg-emerald-50 px-3 py-2 text-sm font-semibold text-emerald-900">
            Built request only — not submitted
          </div>
        )}

        <details className="rounded border border-zinc-200 bg-zinc-50 p-3">
          <summary className="cursor-pointer text-sm font-semibold">Build Result JSON</summary>
          <pre className="mt-3 max-h-72 overflow-auto whitespace-pre-wrap text-xs text-zinc-700">
            {buildResultJson}
          </pre>
        </details>

        <button
          className="text-xs font-semibold text-zinc-500 underline"
          onClick={() => dispatch({ type: 'CANCEL' })}
          type="button"
        >
          Cancel FCQI Draft
        </button>
      </div>
    </section>
  );
};

const FcqiStatePill = ({ label, value }) => (
  <div className="rounded border border-zinc-200 bg-zinc-50 px-3 py-2">
    <div className="font-semibold uppercase tracking-wide text-zinc-500">{label}</div>
    <div className="mt-1 font-mono text-sm font-bold text-zinc-950">{value}</div>
  </div>
);

const FcqiTokenInput = ({
  disabled,
  label,
  onChange,
  onKeyDown,
  placeholder,
  value,
}) => (
  <label className="block text-sm font-semibold text-zinc-700">
    {label}
    <input
      className="mt-1 w-full rounded border border-zinc-300 px-3 py-2 text-sm disabled:bg-zinc-100 disabled:text-zinc-400"
      disabled={disabled}
      onChange={(event) => onChange(event.target.value)}
      onKeyDown={onKeyDown}
      placeholder={placeholder}
      type="text"
      value={value}
    />
  </label>
);

const PreviewDriveMetric = ({ label, value }) => (
  <div className="bg-white p-3">
    <div className="text-xs font-semibold uppercase tracking-wide text-zinc-500">
      {label}
    </div>
    <div className="mt-1 text-lg font-semibold">{value}</div>
  </div>
);

const PreviewEventLogSlot = ({ envelope }) => (
  <div className="h-full p-4">
    <section className="flex h-full min-h-0 flex-col rounded border border-zinc-300 bg-white">
      <div className="border-b border-zinc-200 px-4 py-3">
        <h2 className="text-base font-semibold">Game Log</h2>
      </div>
      <div className="min-h-0 flex-1 overflow-auto">
        {envelope.events.length === 0 ? (
          <div className="p-4 text-sm text-zinc-600">No accepted events.</div>
        ) : (
          <ol className="divide-y divide-zinc-200">
            {envelope.events
              .slice()
              .reverse()
              .map((event) => (
                <li key={event.eventId} className="p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="text-sm font-semibold capitalize">
                        {event.type}
                        {event.subtype ? ` · ${event.subtype}` : ''}
                      </div>
                      <p className="mt-1 text-sm text-zinc-700">
                        {event.description || event.result?.code || 'Accepted event'}
                      </p>
                    </div>
                    <span className="shrink-0 rounded bg-zinc-100 px-2 py-1 text-xs font-semibold text-zinc-600">
                      #{event.sequence}
                    </span>
                  </div>
                  <div className="mt-2 text-xs text-zinc-500">
                    Q{event.period || '-'} {formatFootballClockDisplay(event.clock, '--:--')} · {event.possession || '-'}
                  </div>
                </li>
              ))}
          </ol>
        )}
      </div>
    </section>
  </div>
);

const PreviewInputAssistantSlot = ({ envelope }) => {
  const lastEvent = envelope.events[envelope.events.length - 1];

  return (
    <section className="border-t border-zinc-300 bg-white px-4 py-3" aria-label="Input Assistant">
      <div className="mx-auto flex max-w-[1500px] flex-wrap items-center justify-between gap-3 text-sm">
        <div className="min-w-0">
          <div className="text-xs font-semibold uppercase tracking-wide text-zinc-500">
            Input Assistant
          </div>
          <div className="mt-1 font-medium text-zinc-900">
            Ready for next football event.
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2 text-xs font-semibold text-zinc-600">
          <span className="rounded bg-emerald-50 px-2 py-1 text-emerald-800">
            {formatStatus(envelope.game.status)}
          </span>
          <span className="rounded bg-zinc-100 px-2 py-1">
            Last event: {lastEvent?.sequence ? `#${lastEvent.sequence}` : 'None'}
          </span>
        </div>
      </div>
    </section>
  );
};
