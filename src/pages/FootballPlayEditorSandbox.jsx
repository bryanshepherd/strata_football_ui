import React, { useMemo, useState } from 'react';
import FootballPlayEditorModal from '../components/editor/FootballPlayEditorModal';
import { formatFootballClockDisplay } from '../utils/footballClock';

const ROSTER = [
  { playerId: '600309ad-35f6-7a21-ca81-c0f62b3e1a31', team: 'V', jersey: '11', displayName: 'Nino Marzullo', position: 'QB' },
  { playerId: 'fair-5', team: 'V', jersey: '5', displayName: 'Winston Page', position: 'WR' },
  { playerId: 'fair-2', team: 'V', jersey: '2', displayName: 'LeJay Hatcher', position: 'RB' },
  { playerId: 'fair-9', team: 'V', jersey: '9', displayName: 'Fred Highsmith', position: 'WR' },
  { playerId: 'dedb51e1-0b2b-a81b-5267-7e948dc18d8d', team: 'H', jersey: '8', displayName: 'Mike Wilson', position: 'LB' },
  { playerId: 'wvsu-3', team: 'H', jersey: '3', displayName: 'Shawn Russ Jr.', position: 'DB' },
  { playerId: 'wvsu-20', team: 'H', jersey: '20', displayName: 'Jomax Reed', position: 'DB' },
  { playerId: 'wvsu-38', team: 'H', jersey: '38', displayName: 'Joseph Shrader', position: 'K' },
  { playerId: 'wvsu-35', team: 'H', jersey: '35', displayName: 'Jasha Brown', position: 'RB' },
];

const BASE_STATE = {
  possession: 'V',
  down: 1,
  distance: 10,
  yardLine: 'H46',
  lineToGain: 'H36',
  goalToGo: false,
  redZone: false,
  driveId: 'DRV-0017',
  driveNumber: 17,
};

const SAMPLE_PLAYS = [
  {
    clientEventId: 'fcqi-rush-148-client',
    type: 'rush',
    subtype: null,
    createdAt: '2026-08-26T04:07:53.131Z',
    period: 3,
    clock: '06:55',
    possession: 'V',
    preState: BASE_STATE,
    postState: {
      ...BASE_STATE,
      yardLine: 'H27',
      lineToGain: 'H17',
      down: 1,
      distance: 10,
    },
    participants: {
      primary: participant('600309ad-35f6-7a21-ca81-c0f62b3e1a31', 'rusher'),
      secondary: null,
      defenders: [],
      returner: null,
      kicker: null,
      punter: null,
      holder: null,
      fumbler: null,
      forcedBy: null,
      recoveredBy: null,
      penalizedPlayers: [participant('dedb51e1-0b2b-a81b-5267-7e948dc18d8d', 'penalizedPlayer')],
      others: [],
    },
    result: {
      code: 'outOfBounds',
      yards: 4,
      endYardLine: 'H42',
      firstDown: true,
      driveEnds: false,
      laterals: [],
    },
    penalties: [
      {
        penaltyId: 'fcqi-penalty-149-client-pen-1',
        code: 'PF',
        name: 'Personal Foul',
        team: 'H',
        playerId: 'dedb51e1-0b2b-a81b-5267-7e948dc18d8d',
        timing: 'liveBall',
        status: 'accepted',
        yards: 15,
        enforcedFrom: 'endOfPlay',
        spotOfFoul: '',
        finalSpot: 'H27',
        automaticFirstDown: true,
        lossOfDown: false,
        replayDown: false,
        downCounts: false,
        carryOverToKickoff: false,
        ejected: false,
        notes: '',
      },
    ],
    description: 'FAIR #11 Nino Marzullo rush for 4 yards to the H42, out-of-bounds, PENALTY WVSU Personal Foul (#8 Mike Wilson), 15 yards to the H27, automatic first down.',
    source: {
      kind: 'fcqi',
      draftIntentId: 'fcqi-rush-148-intent',
      draftRevision: 3,
      summaryRevision: 3,
      confirmedAt: '2026-08-26T04:07:53.131Z',
    },
    confirmation: {
      summaryText: 'FAIR #11 Nino Marzullo rush for 4 yards to the H42, out-of-bounds, PENALTY WVSU Personal Foul (#8 Mike Wilson), 15 yards to the H27, automatic first down.',
      confirmedAt: '2026-08-26T04:07:53.131Z',
    },
    warnings: [],
    eventId: 'LOCAL-000129',
    sequence: 129,
    status: 'accepted',
    acceptedAt: '2026-08-26T04:07:53.131Z',
  },
  {
    clientEventId: 'sandbox-pass-130',
    type: 'pass',
    subtype: 'incomplete',
    createdAt: '2026-08-26T04:09:11.000Z',
    period: 3,
    clock: '06:55',
    possession: 'V',
    preState: {
      ...BASE_STATE,
      down: 2,
      yardLine: 'H27',
      lineToGain: 'H17',
    },
    postState: {
      ...BASE_STATE,
      down: 3,
      yardLine: 'H27',
      lineToGain: 'H17',
    },
    participants: {
      primary: participant('600309ad-35f6-7a21-ca81-c0f62b3e1a31', 'passer'),
      secondary: participant('fair-5', 'intendedReceiver'),
      defenders: [participant('wvsu-20', 'passBreakup')],
      returner: null,
      kicker: null,
      punter: null,
      holder: null,
      fumbler: null,
      forcedBy: null,
      recoveredBy: null,
      penalizedPlayers: [],
      others: [],
    },
    result: {
      code: 'incomplete',
      yards: 0,
      endYardLine: 'H27',
      firstDown: false,
      driveEnds: false,
      pass: {
        outcome: 'incomplete',
        startYardLine: 'H27',
        terminalYardLine: 'H27',
        targetPlayerId: 'fair-5',
        completed: false,
        brokenUpByPlayerId: 'wvsu-20',
        hurriedByPlayerIds: [],
      },
      laterals: [],
    },
    penalties: [],
    description: 'FAIR #11 Nino Marzullo pass incomplete intended for #5 Winston Page, broken up by #20 Jomax Reed.',
    source: { kind: 'fcqi', draftIntentId: 'sandbox-pass-130-intent', draftRevision: 2, summaryRevision: 2, confirmedAt: '2026-08-26T04:09:11.000Z' },
    confirmation: { summaryText: 'FAIR #11 Nino Marzullo pass incomplete intended for #5 Winston Page, broken up by #20 Jomax Reed.', confirmedAt: '2026-08-26T04:09:11.000Z' },
    warnings: [],
    eventId: 'LOCAL-000130',
    sequence: 130,
    status: 'accepted',
    acceptedAt: '2026-08-26T04:09:11.000Z',
  },
  {
    clientEventId: 'sandbox-interception-137',
    type: 'pass',
    subtype: 'interception',
    createdAt: '2026-08-26T04:23:44.000Z',
    period: 3,
    clock: '04:28',
    possession: 'V',
    preState: {
      possession: 'V', down: 3, distance: 8, yardLine: 'H38', lineToGain: 'H30', goalToGo: false, redZone: false, driveId: 'DRV-0018', driveNumber: 18,
    },
    postState: {
      possession: 'H', down: 1, distance: 10, yardLine: 'H44', lineToGain: 'V46', goalToGo: false, redZone: false, driveId: 'DRV-0019', driveNumber: 19,
    },
    participants: {
      primary: participant('600309ad-35f6-7a21-ca81-c0f62b3e1a31', 'passer'),
      secondary: participant('fair-9', 'intendedReceiver'),
      defenders: [participant('wvsu-3', 'interceptor')],
      returner: participant('wvsu-3', 'returner'),
      kicker: null,
      punter: null,
      holder: null,
      fumbler: null,
      forcedBy: null,
      recoveredBy: null,
      penalizedPlayers: [],
      others: [],
    },
    result: {
      code: 'interception',
      yards: 0,
      endYardLine: 'H44',
      firstDown: false,
      driveEnds: true,
      nextPossession: 'H',
      pass: {
        outcome: 'interception',
        startYardLine: 'H38',
        terminalYardLine: 'H44',
        interceptionYardLine: 'H36',
        targetPlayerId: 'fair-9',
        completed: false,
        interceptionReturnYards: 8,
      },
      turnover: {
        type: 'interception',
        team: 'H',
        playerId: 'wvsu-3',
        spot: 'H36',
        returnYards: 8,
        returnEndYardLine: 'H44',
      },
      return: {
        type: 'Interception',
        returnerPlayerId: 'wvsu-3',
        returnYards: 8,
        returnStartYardLine: 'H36',
        returnEndYardLine: 'H44',
        resultCode: 'T',
        tackledByPlayerIds: ['fair-2'],
      },
      laterals: [],
    },
    penalties: [],
    description: 'WVSU #3 Shawn Russ Jr. intercepted #11 Nino Marzullo at the H36 and returned 8 yards to the H44, tackled by #2 LeJay Hatcher.',
    source: { kind: 'fcqi', draftIntentId: 'sandbox-interception-137-intent', draftRevision: 4, summaryRevision: 4, confirmedAt: '2026-08-26T04:23:44.000Z' },
    confirmation: { summaryText: 'WVSU #3 Shawn Russ Jr. intercepted #11 Nino Marzullo at the H36 and returned 8 yards to the H44, tackled by #2 LeJay Hatcher.', confirmedAt: '2026-08-26T04:23:44.000Z' },
    warnings: [],
    eventId: 'LOCAL-000137',
    sequence: 137,
    status: 'accepted',
    acceptedAt: '2026-08-26T04:23:44.000Z',
  },
];

const TEAM_NAMES = { H: 'West Virginia State', V: 'Fairmont State' };

export default function FootballPlayEditorSandbox() {
  const [plays, setPlays] = useState(() => JSON.parse(JSON.stringify(SAMPLE_PLAYS)));
  const [selectedEventId, setSelectedEventId] = useState('LOCAL-000129');
  const [isEditorOpen, setIsEditorOpen] = useState(true);
  const [lastSave, setLastSave] = useState(null);

  const selectedPlay = useMemo(
    () => plays.find((play) => play.eventId === selectedEventId) || plays[0],
    [plays, selectedEventId],
  );

  const savePlay = (editedPlay, disposition) => {
    setPlays((current) => current.map((play) => play.eventId === editedPlay.eventId ? editedPlay : play));
    setLastSave({
      mode: disposition.mode,
      sequence: editedPlay.sequence,
      changedFields: disposition.changedPaths.length,
    });
    setIsEditorOpen(false);
  };

  const replacePlay = (originalPlay) => {
    setLastSave({
      mode: 'replace',
      sequence: originalPlay.sequence,
      changedFields: 0,
    });
    setIsEditorOpen(false);
  };

  return (
    <main className="min-h-screen bg-zinc-100 text-zinc-950">
      <header className="border-b border-zinc-300 bg-white px-4 py-4">
        <div className="mx-auto flex max-w-[1500px] flex-wrap items-center justify-between gap-4">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.14em] text-emerald-700">Prototype Sandbox</p>
            <h1 className="mt-1 text-2xl font-black">Play-Only Football Editor</h1>
            <p className="mt-1 text-sm text-zinc-600">Everything here is local and disposable. No game or envelope is submitted.</p>
          </div>
          <div className="rounded border border-amber-300 bg-amber-50 px-3 py-2 text-xs font-bold text-amber-950">Sandbox only · Save changes locally</div>
        </div>
      </header>

      <section className="border-b border-zinc-300 bg-zinc-950 text-white">
        <div className="mx-auto grid max-w-[1500px] grid-cols-[1fr_auto_1fr] items-center gap-4 px-4 py-4">
          <div>
            <div className="text-xs font-bold uppercase text-zinc-400">Fairmont State</div>
            <div className="text-3xl font-black">20</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-black">4:10</div>
            <div className="text-xs font-bold text-zinc-400">Q3</div>
          </div>
          <div className="text-right">
            <div className="text-xs font-bold uppercase text-zinc-400">West Virginia State</div>
            <div className="text-3xl font-black">40</div>
          </div>
        </div>
      </section>

      <section className="border-b border-zinc-300 bg-white">
        <div className="mx-auto grid max-w-[1500px] grid-cols-2 divide-x divide-zinc-200 sm:grid-cols-4 lg:grid-cols-8">
          <ContextMetric label="Down/Distance" value="1 & 10" />
          <ContextMetric label="Spot" value="H27" />
          <ContextMetric label="Line to Gain" value="H17" />
          <ContextMetric label="Drive" value="DRV-0017" />
          <ContextMetric label="Team" value="FAIR" />
          <ContextMetric label="Start" value="H46" />
          <ContextMetric label="Plays" value="6" />
          <ContextMetric label="Yards" value="42" />
        </div>
      </section>

      <div className="mx-auto grid max-w-[1500px] gap-5 p-4 lg:grid-cols-[1fr_340px]">
        <section className="overflow-hidden rounded-lg border border-zinc-300 bg-white">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-zinc-200 px-4 py-3">
            <div>
              <h2 className="font-black">Select a Play</h2>
              <p className="text-xs text-zinc-500">The first play is based on play 129 from the supplied trace.</p>
            </div>
            <button className="rounded bg-emerald-700 px-4 py-2 text-sm font-black text-white hover:bg-emerald-800" onClick={() => setIsEditorOpen(true)} type="button">Edit Selected Play</button>
          </div>
          <ol className="divide-y divide-zinc-200">
            {plays.map((play) => {
              const selected = play.eventId === selectedEventId;
              return (
                <li className={selected ? 'bg-emerald-50' : 'bg-white'} key={play.eventId}>
                  <button
                    aria-pressed={selected}
                    className="w-full px-4 py-4 text-left hover:bg-zinc-50"
                    onClick={() => setSelectedEventId(play.eventId)}
                    type="button"
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="text-sm font-black capitalize">{play.type}{play.subtype ? ` · ${humanize(play.subtype)}` : ''}</span>
                          {selected && <span className="rounded bg-emerald-700 px-2 py-0.5 text-[10px] font-black uppercase tracking-wide text-white">Selected</span>}
                        </div>
                        <p className="mt-1 text-sm leading-6 text-zinc-700">{play.description}</p>
                      </div>
                      <span className="shrink-0 rounded bg-zinc-100 px-2 py-1 text-xs font-black text-zinc-600">#{play.sequence}</span>
                    </div>
                    <div className="mt-2 text-xs font-bold text-zinc-500">Q{play.period} {formatFootballClockDisplay(play.clock)} · {play.possession || 'No possession'} · {humanize(play.result.code)}</div>
                  </button>
                </li>
              );
            })}
          </ol>
        </section>

        <aside className="space-y-4">
          <section className="rounded-lg border border-zinc-300 bg-white p-4">
            <h2 className="font-black">Editing boundary in this prototype</h2>
            <ul className="mt-3 space-y-2 text-sm text-zinc-700">
              <li className="rounded border border-emerald-200 bg-emerald-50 p-3"><strong>Direct edit:</strong> Fields owned by the existing play type</li>
              <li className="rounded border border-emerald-200 bg-emerald-50 p-3"><strong>Direct edit:</strong> Penalties already attached to the play</li>
              <li className="rounded border border-emerald-200 bg-emerald-50 p-3"><strong>Direct edit:</strong> Tackle ↔ Out of Bounds</li>
              <li className="rounded border border-emerald-200 bg-emerald-50 p-3"><strong>Direct edit:</strong> Non-turnover result → End of Play</li>
              <li className="rounded border border-amber-300 bg-amber-50 p-3"><strong>Replace play:</strong> Type, result family, or penalty presence</li>
              <li className="rounded border border-zinc-300 bg-zinc-50 p-3"><strong>Locked:</strong> Clock, possession, down, spot, drive, and record data</li>
            </ul>
          </section>

          {lastSave && (
            <section aria-live="polite" className={`rounded-lg border p-4 ${lastSave.mode === 'replace' ? 'border-amber-300 bg-amber-50' : 'border-emerald-300 bg-emerald-50'}`}>
              <div className="text-sm font-black">{lastSave.mode === 'replace' ? 'Replacement requested' : 'Sandbox edit saved'}</div>
              <div className="mt-1 text-sm">
                {lastSave.mode === 'replace'
                  ? `Play #${lastSave.sequence} would reopen in the normal replacement workflow.`
                  : `Play #${lastSave.sequence} · ${lastSave.changedFields} changed field${lastSave.changedFields === 1 ? '' : 's'}`}
              </div>
              <button className="mt-3 rounded border border-zinc-400 bg-white px-3 py-2 text-sm font-black" onClick={() => setIsEditorOpen(true)} type="button">Open Again</button>
            </section>
          )}
        </aside>
      </div>

      <FootballPlayEditorModal
        isOpen={isEditorOpen}
        onClose={() => setIsEditorOpen(false)}
        onReplace={replacePlay}
        onSave={savePlay}
        play={selectedPlay}
        roster={ROSTER}
        teamNames={TEAM_NAMES}
      />
    </main>
  );
}

const ContextMetric = ({ label, value }) => (
  <div className="min-w-0 px-3 py-3">
    <div className="truncate text-[10px] font-black uppercase tracking-wide text-zinc-500">{label}</div>
    <div className="mt-1 truncate text-sm font-black text-zinc-950">{value}</div>
  </div>
);

function participant(playerId, role) {
  const player = ROSTER.find((candidate) => candidate.playerId === playerId);
  return {
    playerId,
    team: player?.team || 'H',
    role,
    jersey: player?.jersey || '',
    displayName: player?.displayName || playerId,
    position: player?.position || '',
  };
}

const humanize = (value) => String(value || '')
  .replace(/([a-z])([A-Z])/g, '$1 $2')
  .replace(/[_-]+/g, ' ')
  .replace(/\b\w/g, (letter) => letter.toUpperCase());

export {
  ROSTER as footballPlayEditorSandboxRoster,
  SAMPLE_PLAYS as footballPlayEditorSandboxPlays,
};
