import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  classifyPlayEdit,
  getDirectResultCodeOptions,
} from '../../play-editor/footballPlayEditPolicy';
import { recalculatePlayEditorPenaltyYards } from '../../play-editor/footballPlayEditYardage';
import { calculateYardsGained } from '../../utils/footballRulesEngine';

const RESULT_LABELS = {
  accepted: 'Accepted',
  blocked: 'Blocked',
  complete: 'Complete',
  downed: 'Downed',
  endOfPlay: 'End of Play',
  fairCatch: 'Fair Catch',
  failed: 'Failed',
  fumble: 'Fumble',
  incomplete: 'Incomplete',
  interception: 'Interception',
  made: 'Made',
  missed: 'Missed',
  muffed: 'Muffed',
  outOfBounds: 'Out of Bounds',
  returned: 'Returned',
  sack: 'Sack',
  safety: 'Safety',
  tackle: 'Tackle',
  touchdown: 'Touchdown',
  touchback: 'Touchback',
};

const ENFORCEMENT_OPTIONS = [
  ['previousSpot', 'Previous Spot'],
  ['spotOfFoul', 'Spot of Foul'],
  ['endOfPlay', 'End of Play'],
  ['succeedingSpot', 'Succeeding Spot'],
  ['try', 'Try'],
  ['freeKick', 'Free Kick'],
  ['successfulTouchdown', 'Successful Touchdown'],
];

const clone = (value) => JSON.parse(JSON.stringify(value));

const prepareDraft = (value) => recalculatePlayEditorPenaltyYards(clone(value));

const getAtPath = (value, path) => path.reduce((current, key) => current?.[key], value);

const setAtPath = (value, path, nextValue) => {
  const next = clone(value);
  let cursor = next;
  path.slice(0, -1).forEach((key, index) => {
    const followingKey = path[index + 1];
    if (cursor[key] === undefined || cursor[key] === null) {
      cursor[key] = typeof followingKey === 'number' ? [] : {};
    }
    cursor = cursor[key];
  });
  cursor[path[path.length - 1]] = nextValue;
  return next;
};

const collectChangedPaths = (original, edited, prefix = '') => {
  if (JSON.stringify(original) === JSON.stringify(edited)) return [];
  if (Array.isArray(original) || Array.isArray(edited)) return [prefix || 'play'];
  if (!original || !edited || typeof original !== 'object' || typeof edited !== 'object') {
    return [prefix || 'play'];
  }

  return [...new Set([...Object.keys(original), ...Object.keys(edited)])]
    .flatMap((key) => collectChangedPaths(
      original[key],
      edited[key],
      prefix ? `${prefix}.${key}` : key,
    ));
};

const playerLabel = (player) => {
  if (!player) return 'None';
  const team = player.team ? `${player.team} · ` : '';
  const jersey = player.jersey ? `#${player.jersey} ` : '';
  const position = player.position ? ` · ${player.position}` : '';
  return `${team}${jersey}${player.displayName || player.playerId}${position}`;
};

const participantFromRoster = (roster, playerId, role) => {
  const player = roster.find((candidate) => candidate.playerId === playerId);
  if (!player) return null;
  return {
    playerId: player.playerId,
    team: player.team,
    role,
    jersey: player.jersey,
    displayName: player.displayName,
    position: player.position,
  };
};

const familyName = (play) => {
  const type = humanize(play?.type || 'play');
  return play?.subtype ? `${type} · ${humanize(play.subtype)}` : type;
};

export default function FootballPlayEditorModal({
  isOpen,
  onClose,
  onReplace,
  onSave,
  play,
  roster = [],
  saveError = '',
  teamNames = { H: 'Home', V: 'Visitor' },
}) {
  const [draft, setDraft] = useState(() => prepareDraft(play));
  const [showDiscardPrompt, setShowDiscardPrompt] = useState(false);
  const [showReplacePrompt, setShowReplacePrompt] = useState(false);
  const firstInputRef = useRef(null);
  const baselinePlay = useMemo(() => prepareDraft(play), [play]);

  useEffect(() => {
    if (!isOpen) return;
    setDraft(clone(baselinePlay));
    setShowDiscardPrompt(false);
    setShowReplacePrompt(false);
    window.setTimeout(() => firstInputRef.current?.focus(), 0);
  }, [baselinePlay, isOpen]);

  const changedPaths = useMemo(() => collectChangedPaths(baselinePlay, draft), [baselinePlay, draft]);
  const editDecision = useMemo(() => classifyPlayEdit(baselinePlay, draft), [baselinePlay, draft]);
  const hasChanges = changedPaths.length > 0;

  const update = (path, value) => setDraft((current) => (
    recalculatePlayEditorPenaltyYards(setAtPath(current, path, value))
  ));

  const updateMany = (updates) => setDraft((current) => recalculatePlayEditorPenaltyYards(
    updates.reduce(
      (next, [path, value]) => setAtPath(next, path, value),
      current,
    ),
  ));

  const requestClose = () => {
    if (hasChanges) setShowDiscardPrompt(true);
    else onClose();
  };

  useEffect(() => {
    if (!isOpen) return undefined;
    const handleKeyDown = (event) => {
      if (event.key !== 'Escape') return;
      event.preventDefault();
      if (showReplacePrompt) setShowReplacePrompt(false);
      else if (showDiscardPrompt) setShowDiscardPrompt(false);
      else requestClose();
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, hasChanges, showDiscardPrompt, showReplacePrompt]);

  if (!isOpen || !play || !draft) return null;

  const save = (event) => {
    event?.preventDefault();
    if (!hasChanges || editDecision.mode !== 'update') return;
    onSave(clone(draft), {
      mode: 'update',
      changedPaths,
      reasons: [],
    });
  };

  const beginReplacement = () => {
    setShowReplacePrompt(false);
    onReplace?.(clone(play), {
      mode: 'replace',
      reason: 'The play structure needs to be rebuilt.',
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-zinc-950/70 p-2 sm:p-5" role="presentation">
      <form
        aria-label={`Edit Play ${draft.sequence}`}
        aria-modal="true"
        className="relative flex h-[96vh] w-full max-w-[1120px] flex-col overflow-hidden rounded-xl border border-zinc-300 bg-zinc-100 shadow-2xl sm:h-[92vh]"
        onSubmit={save}
        role="dialog"
      >
        <header className="shrink-0 border-b border-zinc-300 bg-white px-4 py-3 sm:px-6">
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-xs font-black uppercase tracking-[0.14em] text-emerald-700">Edit {draft.type} play</span>
                <span className="rounded bg-zinc-100 px-2 py-0.5 text-xs font-bold text-zinc-600">Play #{draft.sequence}</span>
                <span className="rounded bg-zinc-900 px-2 py-0.5 text-xs font-bold uppercase text-white">{familyName(draft)}</span>
                {hasChanges && (
                  <span className="rounded bg-amber-100 px-2 py-0.5 text-xs font-bold text-amber-900">
                    {changedPaths.length} field{changedPaths.length === 1 ? '' : 's'} changed
                  </span>
                )}
              </div>
              <h1 className="mt-1 text-lg font-black text-zinc-950 sm:text-xl">Edit this play’s recorded details</h1>
              <p className="mt-1 line-clamp-2 max-w-4xl text-xs text-zinc-600 sm:text-sm">{draft.description}</p>
            </div>
            <button
              aria-label="Close play editor"
              className="grid h-9 w-9 shrink-0 place-items-center rounded border border-zinc-300 bg-white text-xl font-semibold text-zinc-500 hover:bg-zinc-100 hover:text-zinc-900"
              onClick={requestClose}
              type="button"
            >
              ×
            </button>
          </div>
        </header>

        <ReadOnlyContext play={play} teamNames={teamNames} />

        <main className="min-h-0 flex-1 overflow-y-auto p-3 sm:p-5">
          <div className="mx-auto max-w-5xl space-y-4">
            <ReplacementBoundary onReplace={() => setShowReplacePrompt(true)} play={play} />

            <PlayOwnedFields
              draft={draft}
              firstInputRef={firstInputRef}
              roster={roster}
              teamNames={teamNames}
              update={update}
              updateMany={updateMany}
            />

            {draft.penalties?.length > 0 ? (
              <EditorSection
                subtitle="Only penalties already attached to this play can be edited here."
                title={`Penalty details (${draft.penalties.length})`}
              >
                <div className="space-y-4">
                  {draft.penalties.map((penalty, index) => (
                    <PenaltyEditor
                      index={index}
                      key={penalty.penaltyId || index}
                      onChange={(key, value) => update(['penalties', index, key], value)}
                      penalty={penalty}
                      roster={roster}
                      teamNames={teamNames}
                    />
                  ))}
                </div>
                <StructuralNote onReplace={() => setShowReplacePrompt(true)}>
                  Adding or removing a penalty requires replacing the play.
                </StructuralNote>
              </EditorSection>
            ) : (
              <section className="rounded-lg border border-dashed border-zinc-300 bg-white p-4 sm:p-5">
                <div className="text-sm font-black text-zinc-900">No penalty is attached to this play.</div>
                <p className="mt-1 text-sm text-zinc-600">A penalty cannot be added through direct edit.</p>
                <button className="mt-3 text-sm font-black text-amber-800 underline" onClick={() => setShowReplacePrompt(true)} type="button">
                  Replace the play to add one
                </button>
              </section>
            )}
          </div>
        </main>

        {saveError && (
          <div className="shrink-0 border-t border-red-200 bg-red-50 px-4 py-2 text-sm font-bold text-red-900" role="alert">
            {saveError}
          </div>
        )}

        <footer className="flex shrink-0 flex-wrap items-center justify-between gap-3 border-t border-zinc-300 bg-white px-4 py-3 sm:px-6">
          <div className="min-w-0 text-xs text-zinc-600">
            {hasChanges ? (
              <><span className="font-black text-zinc-900">Changed:</span> {changedPaths.join(', ')}</>
            ) : 'No changes yet.'}
          </div>
          <div className="flex items-center gap-2">
            <button className="rounded border border-zinc-300 bg-white px-4 py-2 text-sm font-black text-zinc-700 hover:bg-zinc-100" onClick={requestClose} type="button">Cancel</button>
            <button
              className="rounded border border-zinc-300 bg-white px-4 py-2 text-sm font-black text-zinc-700 hover:bg-zinc-100 disabled:cursor-not-allowed disabled:opacity-40"
              disabled={!hasChanges}
              onClick={() => setDraft(clone(baselinePlay))}
              type="button"
            >
              Reset
            </button>
            <button
              className="rounded bg-emerald-700 px-4 py-2 text-sm font-black text-white hover:bg-emerald-800 disabled:cursor-not-allowed disabled:bg-emerald-300"
              disabled={!hasChanges || editDecision.mode !== 'update'}
              type="submit"
            >
              Save Changes
            </button>
          </div>
        </footer>

        {showDiscardPrompt && (
          <ConfirmationDialog
            confirmLabel="Discard Changes"
            onCancel={() => setShowDiscardPrompt(false)}
            onConfirm={onClose}
            title="Discard play edits?"
          >
            The changes made in this modal will be lost.
          </ConfirmationDialog>
        )}

        {showReplacePrompt && (
          <ConfirmationDialog
            confirmLabel="Start Replacement"
            onCancel={() => setShowReplacePrompt(false)}
            onConfirm={beginReplacement}
            tone="amber"
            title="Replace this play?"
          >
            Use replacement when the play type, result family, or penalty presence is wrong. The existing play will not be edited in place.
          </ConfirmationDialog>
        )}
      </form>
    </div>
  );
}

const ReadOnlyContext = ({ play, teamNames }) => {
  const pre = play.preState || {};
  const possession = teamNames[play.possession] || play.possession || 'Not set';
  const downDistance = pre.down ? `${pre.down}${ordinal(pre.down)} & ${pre.distance ?? '?'}` : 'Not set';
  return (
    <section aria-label="Locked play context" className="shrink-0 border-b border-zinc-300 bg-zinc-950 px-4 py-3 text-white sm:px-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="text-[10px] font-black uppercase tracking-[0.14em] text-zinc-400">Locked context · reference only</div>
          <div className="mt-1 flex flex-wrap gap-x-5 gap-y-1 text-sm font-bold">
            <span>Q{play.period} {formatClock(play.clock)}</span>
            <span>{possession}</span>
            <span>{downDistance}</span>
            <span>Ball at {pre.yardLine || 'Not set'}</span>
          </div>
        </div>
        <div className="rounded border border-zinc-700 bg-zinc-900 px-3 py-1.5 text-xs font-bold text-zinc-300">
          Context cannot be edited here
        </div>
      </div>
    </section>
  );
};

const ReplacementBoundary = ({ onReplace, play }) => (
  <section className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-amber-300 bg-amber-50 px-4 py-3">
    <div>
      <div className="text-sm font-black text-amber-950">Wrong play type, result family, or penalty presence?</div>
      <p className="mt-0.5 text-xs text-amber-900">This editor stays within the existing {familyName(play)} play structure.</p>
    </div>
    <button className="rounded border border-amber-500 bg-white px-3 py-2 text-sm font-black text-amber-900 hover:bg-amber-100" onClick={onReplace} type="button">
      Replace This Play
    </button>
  </section>
);

const PlayOwnedFields = ({ draft, firstInputRef, roster, teamNames, update, updateMany }) => {
  const common = (
    <CommonResultFields
      draft={draft}
      firstInputRef={firstInputRef}
      update={update}
      updateMany={updateMany}
    />
  );

  if (draft.type === 'rush') {
    return (
      <>
        <EditorSection subtitle="Edit only the values produced by this rushing play." title="Rush fields">
          {common}
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <ParticipantField label="Rusher" onChange={(playerId) => update(['participants', 'primary'], participantFromRoster(roster, playerId, 'rusher'))} participant={draft.participants?.primary} roster={roster} />
            <PlayerCollection label="Tacklers" onChange={(players) => update(['participants', 'defenders'], players)} participants={draft.participants?.defenders || []} role="tackler" roster={roster} />
          </div>
        </EditorSection>
        {draft.result?.fumble && (
          <FumbleFields draft={draft} roster={roster} teamNames={teamNames} update={update} />
        )}
        <ExistingLateralFields draft={draft} roster={roster} update={update} />
      </>
    );
  }

  if (draft.type === 'pass') {
    return (
      <>
        <EditorSection subtitle="The pass family is fixed; edit only its recorded participants and result details." title="Pass fields">
          {common}
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <ParticipantField label="Passer" onChange={(playerId) => update(['participants', 'primary'], participantFromRoster(roster, playerId, 'passer'))} participant={draft.participants?.primary} roster={roster} />
            <ParticipantField
              label={draft.subtype === 'complete' ? 'Receiver' : 'Intended receiver'}
              onChange={(playerId) => updateMany([
                [['participants', 'secondary'], participantFromRoster(roster, playerId, draft.subtype === 'complete' ? 'receiver' : 'intendedReceiver')],
                [['result', 'pass', 'targetPlayerId'], playerId || null],
              ])}
              participant={draft.participants?.secondary}
              roster={roster}
            />
          </div>
          <PassFields draft={draft} roster={roster} update={update} />
        </EditorSection>
        {draft.result?.turnover && <TurnoverFields draft={draft} roster={roster} teamNames={teamNames} update={update} />}
        {draft.result?.return && <ReturnFields draft={draft} roster={roster} update={update} />}
        {draft.result?.fumble && <FumbleFields draft={draft} roster={roster} teamNames={teamNames} update={update} />}
        <ExistingLateralFields draft={draft} roster={roster} update={update} />
      </>
    );
  }

  if (['punt', 'kickoff', 'fieldGoal', 'try'].includes(draft.type)) {
    return (
      <>
        <EditorSection subtitle={`Edit only the values recorded for this ${humanize(draft.type)}.`} title={`${humanize(draft.type)} fields`}>
          {common}
          <KickFields draft={draft} roster={roster} update={update} />
        </EditorSection>
        {draft.result?.return && <ReturnFields draft={draft} roster={roster} update={update} />}
        {draft.result?.fumble && <FumbleFields draft={draft} roster={roster} teamNames={teamNames} update={update} />}
        <ExistingLateralFields draft={draft} roster={roster} update={update} />
      </>
    );
  }

  return (
    <EditorSection subtitle="Only fields already owned by this play can be changed." title={`${humanize(draft.type)} fields`}>
      {common}
    </EditorSection>
  );
};

const CommonResultFields = ({ draft, firstInputRef, update, updateMany }) => {
  const resultOptions = getDirectResultCodeOptions(draft).map((code) => [code, RESULT_LABELS[code] || humanize(code)]);
  const derivesScrimmageYards = draft.type === 'rush'
    || (draft.type === 'pass' && !['incomplete', 'interception'].includes(draft.result?.code));
  const calculatedYards = derivesScrimmageYards
    ? calculateYardsGained(draft.preState?.yardLine, draft.result?.endYardLine, draft.possession)
    : null;

  const updateEndSpot = (endYardLine) => {
    const yards = calculateYardsGained(draft.preState?.yardLine, endYardLine, draft.possession);
    const updates = [
      [['result', 'endYardLine'], endYardLine],
      [['result', 'yards'], yards],
    ];
    if (draft.result?.pass?.terminalYardLine !== undefined) {
      updates.push([['result', 'pass', 'terminalYardLine'], endYardLine]);
    }
    if (draft.result?.pass?.passingYards !== undefined) {
      updates.push([['result', 'pass', 'passingYards'], yards]);
    }
    if (draft.result?.pass?.receivingYards !== undefined) {
      updates.push([['result', 'pass', 'receivingYards'], yards]);
    }
    updateMany(updates);
  };

  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
      <SelectField inputRef={firstInputRef} label="Result" onChange={(value) => update(['result', 'code'], value)} options={resultOptions} value={draft.result?.code || ''} />
      {derivesScrimmageYards && (
        <>
          <TextField hint="H35, V20, 50" label="End spot" onChange={updateEndSpot} value={draft.result?.endYardLine || ''} />
          <CalculatedField label="Yards" value={calculatedYards} />
          <CheckboxField checked={Boolean(draft.result?.firstDown)} label="First down credited" onChange={(value) => update(['result', 'firstDown'], value)} />
        </>
      )}
    </div>
  );
};

const PassFields = ({ draft, roster, update }) => {
  const pass = draft.result?.pass;
  if (!pass) return null;
  return (
    <div className="mt-4 rounded border border-zinc-300 bg-zinc-50 p-4">
      <h3 className="text-sm font-black">Passing statistics</h3>
      <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {pass.caughtAtYardLine !== undefined && <TextField label="Caught at" onChange={(value) => update(['result', 'pass', 'caughtAtYardLine'], value)} value={pass.caughtAtYardLine || ''} />}
        {pass.intendedYardLine !== undefined && <TextField label="Intended spot" onChange={(value) => update(['result', 'pass', 'intendedYardLine'], value)} value={pass.intendedYardLine || ''} />}
        {pass.passingYards !== undefined && <CalculatedField label="Passing yards" value={pass.passingYards} />}
        {pass.receivingYards !== undefined && <CalculatedField label="Receiving yards" value={pass.receivingYards} />}
        {pass.interceptionYardLine !== undefined && <TextField label="Interception spot" onChange={(value) => update(['result', 'pass', 'interceptionYardLine'], value)} value={pass.interceptionYardLine || ''} />}
        {pass.interceptionReturnYards !== undefined && <NumberField label="Interception return yards" onChange={(value) => update(['result', 'pass', 'interceptionReturnYards'], value)} value={pass.interceptionReturnYards ?? ''} />}
        {pass.brokenUpByPlayerId !== undefined && (
          <RosterSelect label="Broken up by" onChange={(value) => update(['result', 'pass', 'brokenUpByPlayerId'], value || null)} roster={roster} value={pass.brokenUpByPlayerId || ''} />
        )}
      </div>
      {pass.hurriedByPlayerIds !== undefined && (
        <div className="mt-3">
          <PlayerIdCollection label="Hurries" onChange={(ids) => update(['result', 'pass', 'hurriedByPlayerIds'], ids)} playerIds={pass.hurriedByPlayerIds || []} roster={roster} />
        </div>
      )}
    </div>
  );
};

const KickFields = ({ draft, roster, update }) => {
  const kick = draft.result?.kick || {};
  const participantFields = {
    punt: [['punter', 'Punter', 'punter'], ['returner', 'Returner', 'returner']],
    kickoff: [['kicker', 'Kicker', 'kicker'], ['returner', 'Returner', 'returner']],
    fieldGoal: [['kicker', 'Kicker', 'kicker'], ['holder', 'Holder', 'holder']],
    try: [['kicker', 'Kicker', 'kicker'], ['holder', 'Holder', 'holder']],
  }[draft.type] || [];
  return (
    <>
      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        {participantFields.map(([slot, label, role]) => (
          <ParticipantField key={slot} label={label} onChange={(playerId) => update(['participants', slot], participantFromRoster(roster, playerId, role))} participant={draft.participants?.[slot]} roster={roster} />
        ))}
      </div>
      {draft.result?.kick && (
        <div className="mt-4 grid gap-3 rounded border border-zinc-300 bg-zinc-50 p-4 sm:grid-cols-2 lg:grid-cols-4">
          {kick.kickYards !== undefined && <NumberField label="Kick yards" onChange={(value) => update(['result', 'kick', 'kickYards'], value)} value={kick.kickYards ?? ''} />}
          {kick.kickSpot !== undefined && <TextField label="Kick spot" onChange={(value) => update(['result', 'kick', 'kickSpot'], value)} value={kick.kickSpot || ''} />}
          {kick.catchYardLine !== undefined && <TextField label="Catch spot" onChange={(value) => update(['result', 'kick', 'catchYardLine'], value)} value={kick.catchYardLine || ''} />}
          {kick.attemptYards !== undefined && <NumberField label="Attempt yards" onChange={(value) => update(['result', 'kick', 'attemptYards'], value)} value={kick.attemptYards ?? ''} />}
          {kick.blockedByPlayerId !== undefined && <RosterSelect label="Blocked by" onChange={(value) => update(['result', 'kick', 'blockedByPlayerId'], value || null)} roster={roster} value={kick.blockedByPlayerId || ''} />}
          {kick.missedReason !== undefined && <TextField label="Miss reason" onChange={(value) => update(['result', 'kick', 'missedReason'], value || null)} value={kick.missedReason || ''} />}
        </div>
      )}
    </>
  );
};

const TurnoverFields = ({ draft, roster, teamNames, update }) => {
  const turnover = draft.result.turnover;
  return (
    <EditorSection subtitle="These fields exist because the selected play is already a turnover." title="Turnover fields">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <SelectField label="Recovering team" onChange={(value) => update(['result', 'turnover', 'team'], value)} options={teamOptions(teamNames)} value={turnover.team || ''} />
        <RosterSelect label="Player" onChange={(value) => update(['result', 'turnover', 'playerId'], value || null)} roster={roster} value={turnover.playerId || ''} />
        <TextField label="Turnover spot" onChange={(value) => update(['result', 'turnover', 'spot'], value)} value={turnover.spot || ''} />
        <NumberField label="Return yards" onChange={(value) => update(['result', 'turnover', 'returnYards'], value)} value={turnover.returnYards ?? ''} />
        <TextField label="Return end spot" onChange={(value) => update(['result', 'turnover', 'returnEndYardLine'], value)} value={turnover.returnEndYardLine || ''} />
      </div>
    </EditorSection>
  );
};

const ReturnFields = ({ draft, roster, update }) => {
  const returned = draft.result.return;
  const returnCodes = returned.resultCode === 'T'
    ? [['T', 'Tackle'], ['O', 'Out of Bounds']]
    : returned.resultCode === 'O'
      ? [['O', 'Out of Bounds'], ['T', 'Tackle']]
      : [[returned.resultCode || '.', humanize(returned.resultCode || 'End of Play')]];
  return (
    <EditorSection subtitle="Edit only the return already recorded as part of this play." title="Return fields">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <RosterSelect label="Returner" onChange={(value) => update(['result', 'return', 'returnerPlayerId'], value || null)} roster={roster} value={returned.returnerPlayerId || ''} />
        <NumberField label="Return yards" onChange={(value) => update(['result', 'return', 'returnYards'], value)} value={returned.returnYards ?? ''} />
        <TextField label="Return start" onChange={(value) => update(['result', 'return', 'returnStartYardLine'], value)} value={returned.returnStartYardLine || ''} />
        <TextField label="Return end" onChange={(value) => update(['result', 'return', 'returnEndYardLine'], value)} value={returned.returnEndYardLine || ''} />
        <SelectField label="Return result" onChange={(value) => update(['result', 'return', 'resultCode'], value)} options={returnCodes} value={returned.resultCode || '.'} />
      </div>
      <div className="mt-3">
        <PlayerIdCollection label="Tacklers" onChange={(ids) => update(['result', 'return', 'tackledByPlayerIds'], ids)} playerIds={returned.tackledByPlayerIds || []} roster={roster} />
      </div>
    </EditorSection>
  );
};

const FumbleFields = ({ draft, roster, teamNames, update }) => {
  const fumble = draft.result.fumble;
  return (
    <EditorSection subtitle="These fields exist because this play already contains a fumble." title="Fumble fields">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <RosterSelect label="Fumbler" onChange={(value) => update(['result', 'fumble', 'fumblerPlayerId'], value || null)} roster={roster} value={fumble.fumblerPlayerId || ''} />
        <RosterSelect label="Forced by" onChange={(value) => update(['result', 'fumble', 'forcedByPlayerId'], value || null)} roster={roster} value={fumble.forcedByPlayerId || ''} />
        <TextField label="Fumble spot" onChange={(value) => update(['result', 'fumble', 'spot'], value)} value={fumble.spot || ''} />
        <RosterSelect label="Recovered by" onChange={(value) => update(['result', 'fumble', 'recoveredByPlayerId'], value || null)} roster={roster} value={fumble.recoveredByPlayerId || ''} />
        <SelectField label="Recovery team" onChange={(value) => update(['result', 'fumble', 'recoveredByTeam'], value)} options={teamOptions(teamNames)} value={fumble.recoveredByTeam || ''} />
        <TextField label="Recovery spot" onChange={(value) => update(['result', 'fumble', 'recoverySpot'], value)} value={fumble.recoverySpot || ''} />
        <NumberField label="Return yards" onChange={(value) => update(['result', 'fumble', 'returnYards'], value)} value={fumble.returnYards ?? ''} />
        <TextField label="Return end spot" onChange={(value) => update(['result', 'fumble', 'returnEndYardLine'], value)} value={fumble.returnEndYardLine || ''} />
      </div>
    </EditorSection>
  );
};

const ExistingLateralFields = ({ draft, roster, update }) => {
  const laterals = draft.result?.laterals || [];
  if (laterals.length === 0) return null;
  return (
    <EditorSection subtitle="Only laterals already recorded on this play are editable." title="Lateral fields">
      <div className="space-y-3">
        {laterals.map((lateral, index) => (
          <div className="grid gap-3 rounded border border-zinc-300 bg-zinc-50 p-3 sm:grid-cols-3" key={index}>
            <RosterSelect label="From" onChange={(value) => update(['result', 'laterals', index, 'fromPlayerId'], value || null)} roster={roster} value={lateral.fromPlayerId || ''} />
            <RosterSelect label="To" onChange={(value) => update(['result', 'laterals', index, 'toPlayerId'], value || null)} roster={roster} value={lateral.toPlayerId || ''} />
            <TextField label="At spot" onChange={(value) => update(['result', 'laterals', index, 'spot'], value)} value={lateral.spot || ''} />
          </div>
        ))}
      </div>
    </EditorSection>
  );
};

const PenaltyEditor = ({ index, onChange, penalty, roster, teamNames }) => (
  <div className="rounded-lg border border-zinc-300 bg-zinc-50">
    <div className="border-b border-zinc-200 px-4 py-3">
      <div className="text-sm font-black text-zinc-950">Penalty {index + 1}: {penalty.name || penalty.code || 'Unnamed'}</div>
      <div className="mt-0.5 text-xs text-zinc-500">Existing penalty · cannot be removed here</div>
    </div>
    <div className="grid gap-3 p-4 sm:grid-cols-2 lg:grid-cols-4">
      <TextField label="Code" onChange={(value) => onChange('code', value)} value={penalty.code || ''} />
      <TextField label="Name" onChange={(value) => onChange('name', value)} value={penalty.name || ''} />
      <SelectField label="Team" onChange={(value) => onChange('team', value)} options={teamOptions(teamNames)} value={penalty.team || ''} />
      <RosterSelect label="Penalized player" noneLabel="Team penalty / not recorded" onChange={(value) => onChange('playerId', value || null)} roster={roster} value={penalty.playerId || ''} />
      <SelectField label="Timing" onChange={(value) => onChange('timing', value)} options={[['liveBall', 'Live Ball'], ['deadBall', 'Dead Ball']]} value={penalty.timing || 'liveBall'} />
      <SelectField label="Status" onChange={(value) => onChange('status', value)} options={[['accepted', 'Accepted'], ['declined', 'Declined'], ['offsetting', 'Offsetting'], ['pending', 'Pending']]} value={penalty.status || 'accepted'} />
      <CalculatedField invalidText="Complete the enforcement and final spots" label="Penalty yards" value={penalty.yards} />
      <SelectField label="Enforced from" onChange={(value) => onChange('enforcedFrom', value)} options={ENFORCEMENT_OPTIONS} value={penalty.enforcedFrom || 'previousSpot'} />
      <TextField label="Spot of foul" onChange={(value) => onChange('spotOfFoul', value)} value={penalty.spotOfFoul || ''} />
      <TextField label="Final spot" onChange={(value) => onChange('finalSpot', value)} value={penalty.finalSpot || ''} />
      <TextField label="Notes" onChange={(value) => onChange('notes', value)} value={penalty.notes || ''} />
    </div>
    <div className="grid gap-3 border-t border-zinc-200 p-4 sm:grid-cols-2 lg:grid-cols-4">
      <CheckboxField checked={Boolean(penalty.automaticFirstDown)} label="Automatic first down" onChange={(value) => onChange('automaticFirstDown', value)} />
      <CheckboxField checked={Boolean(penalty.lossOfDown)} label="Loss of down" onChange={(value) => onChange('lossOfDown', value)} />
      <CheckboxField checked={Boolean(penalty.replayDown)} label="Replay down" onChange={(value) => onChange('replayDown', value)} />
      <CheckboxField checked={Boolean(penalty.downCounts)} label="Down counts" onChange={(value) => onChange('downCounts', value)} />
      <CheckboxField checked={Boolean(penalty.carryOverToKickoff)} label="Carry over to kickoff" onChange={(value) => onChange('carryOverToKickoff', value)} />
      <CheckboxField checked={Boolean(penalty.ejected)} label="Player ejected" onChange={(value) => onChange('ejected', value)} />
    </div>
  </div>
);

const PlayerCollection = ({ label, onChange, participants, role, roster }) => {
  const add = () => {
    const candidate = roster.find((player) => !participants.some((participant) => participant.playerId === player.playerId));
    if (candidate) onChange([...participants, participantFromRoster(roster, candidate.playerId, role)]);
  };
  return (
    <div className="rounded border border-zinc-300 bg-zinc-50 p-3">
      <div className="flex items-center justify-between gap-3">
        <div className="text-xs font-black uppercase tracking-wide text-zinc-600">{label}</div>
        <button className="rounded border border-zinc-300 bg-white px-2 py-1 text-xs font-black" onClick={add} type="button">Add Player</button>
      </div>
      <div className="mt-2 space-y-2">
        {participants.map((participant, index) => (
          <div className="flex items-end gap-2" key={`${participant.playerId}-${index}`}>
            <div className="min-w-0 flex-1">
              <RosterSelect label={`${label} ${index + 1}`} onChange={(playerId) => onChange(participants.map((item, itemIndex) => itemIndex === index ? participantFromRoster(roster, playerId, item.role || role) : item))} roster={roster} value={participant.playerId} />
            </div>
            <button aria-label={`Remove ${label} ${index + 1}`} className="rounded border border-red-200 bg-white px-3 py-2 text-sm font-black text-red-700" onClick={() => onChange(participants.filter((_, itemIndex) => itemIndex !== index))} type="button">Remove</button>
          </div>
        ))}
        {participants.length === 0 && <p className="text-sm text-zinc-500">None recorded.</p>}
      </div>
    </div>
  );
};

const PlayerIdCollection = ({ label, onChange, playerIds, roster }) => {
  const add = () => {
    const candidate = roster.find((player) => !playerIds.includes(player.playerId));
    if (candidate) onChange([...playerIds, candidate.playerId]);
  };
  return (
    <div className="rounded border border-zinc-300 bg-zinc-50 p-3">
      <div className="flex items-center justify-between gap-3">
        <div className="text-xs font-black uppercase tracking-wide text-zinc-600">{label}</div>
        <button className="rounded border border-zinc-300 bg-white px-2 py-1 text-xs font-black" onClick={add} type="button">Add Player</button>
      </div>
      <div className="mt-2 space-y-2">
        {playerIds.map((playerId, index) => (
          <div className="flex items-end gap-2" key={`${playerId}-${index}`}>
            <div className="min-w-0 flex-1">
              <RosterSelect label={`${label} ${index + 1}`} onChange={(value) => onChange(playerIds.map((id, itemIndex) => itemIndex === index ? value : id))} roster={roster} value={playerId} />
            </div>
            <button aria-label={`Remove ${label} ${index + 1}`} className="rounded border border-red-200 bg-white px-3 py-2 text-sm font-black text-red-700" onClick={() => onChange(playerIds.filter((_, itemIndex) => itemIndex !== index))} type="button">Remove</button>
          </div>
        ))}
        {playerIds.length === 0 && <p className="text-sm text-zinc-500">None recorded.</p>}
      </div>
    </div>
  );
};

const ParticipantField = ({ label, onChange, participant, roster }) => (
  <RosterSelect label={label} onChange={onChange} roster={roster} value={participant?.playerId || ''} />
);

const RosterSelect = ({ label, noneLabel = 'Not recorded', onChange, roster, value }) => (
  <SelectField label={label} onChange={onChange} options={[['', noneLabel], ...roster.map((player) => [player.playerId, playerLabel(player)])]} value={value || ''} />
);

const EditorSection = ({ children, subtitle, title }) => (
  <section className="rounded-lg border border-zinc-300 bg-white">
    <div className="border-b border-zinc-200 px-4 py-3 sm:px-5">
      <h2 className="text-base font-black text-zinc-950">{title}</h2>
      {subtitle && <p className="mt-0.5 text-xs text-zinc-500 sm:text-sm">{subtitle}</p>}
    </div>
    <div className="p-4 sm:p-5">{children}</div>
  </section>
);

const StructuralNote = ({ children, onReplace }) => (
  <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-950">
    <span>{children}</span>
    <button className="font-black underline" onClick={onReplace} type="button">Replace This Play</button>
  </div>
);

const TextField = ({ hint, label, onChange, value }) => (
  <label className="block min-w-0">
    <span className="text-xs font-black uppercase tracking-wide text-zinc-600">{label}</span>
    <input className="mt-1 w-full rounded border border-zinc-300 bg-white px-3 py-2 text-sm font-medium text-zinc-950 outline-none focus:border-emerald-600 focus:ring-2 focus:ring-emerald-100" onChange={(event) => onChange(event.target.value)} value={value ?? ''} />
    {hint && <span className="mt-1 block text-xs text-zinc-500">{hint}</span>}
  </label>
);

const NumberField = ({ label, onChange, value }) => (
  <label className="block min-w-0">
    <span className="text-xs font-black uppercase tracking-wide text-zinc-600">{label}</span>
    <input className="mt-1 w-full rounded border border-zinc-300 bg-white px-3 py-2 text-sm font-medium text-zinc-950 outline-none focus:border-emerald-600 focus:ring-2 focus:ring-emerald-100" onChange={(event) => onChange(event.target.value === '' ? null : Number(event.target.value))} type="number" value={value ?? ''} />
  </label>
);

const SelectField = ({ inputRef, label, onChange, options, value }) => (
  <label className="block min-w-0">
    <span className="text-xs font-black uppercase tracking-wide text-zinc-600">{label}</span>
    <select className="mt-1 w-full rounded border border-zinc-300 bg-white px-3 py-2 text-sm font-medium text-zinc-950 outline-none focus:border-emerald-600 focus:ring-2 focus:ring-emerald-100" onChange={(event) => onChange(event.target.value)} ref={inputRef} value={value ?? ''}>
      {options.map(([optionValue, optionLabel]) => <option key={optionValue} value={optionValue}>{optionLabel}</option>)}
    </select>
  </label>
);

const CheckboxField = ({ checked, label, onChange }) => (
  <label className="flex min-h-[42px] items-center gap-2 rounded border border-zinc-300 bg-zinc-50 px-3 py-2 text-sm font-bold text-zinc-800">
    <input checked={checked} className="h-4 w-4 accent-emerald-700" onChange={(event) => onChange(event.target.checked)} type="checkbox" />
    <span>{label}</span>
  </label>
);

const CalculatedField = ({ invalidText = 'Enter a valid end spot', label, value }) => (
  <div className="block min-w-0">
    <div className="flex items-center justify-between gap-2">
      <span className="text-xs font-black uppercase tracking-wide text-zinc-600">{label}</span>
      <span className="rounded bg-emerald-100 px-1.5 py-0.5 text-[10px] font-black uppercase tracking-wide text-emerald-800">Auto</span>
    </div>
    <output
      aria-label={`Calculated ${label.toLowerCase()}`}
      className={`mt-1 block w-full rounded border px-3 py-2 text-sm font-black ${
        typeof value === 'number'
          ? 'border-emerald-200 bg-emerald-50 text-emerald-950'
          : 'border-red-200 bg-red-50 text-red-800'
      }`}
    >
      {typeof value === 'number' ? value : invalidText}
    </output>
  </div>
);

const ConfirmationDialog = ({ children, confirmLabel, onCancel, onConfirm, title, tone = 'red' }) => (
  <div className="absolute inset-0 z-10 grid place-items-center bg-zinc-950/60 p-4">
    <section aria-label={title} aria-modal="true" className="w-full max-w-md rounded-lg border border-zinc-300 bg-white p-5 shadow-2xl" role="alertdialog">
      <h2 className="text-lg font-black text-zinc-950">{title}</h2>
      <p className="mt-2 text-sm leading-6 text-zinc-600">{children}</p>
      <div className="mt-5 flex justify-end gap-2">
        <button className="rounded border border-zinc-300 px-4 py-2 text-sm font-black text-zinc-700" onClick={onCancel} type="button">Keep Editing</button>
        <button className={`rounded px-4 py-2 text-sm font-black text-white ${tone === 'amber' ? 'bg-amber-700' : 'bg-red-700'}`} onClick={onConfirm} type="button">{confirmLabel}</button>
      </div>
    </section>
  </div>
);

const teamOptions = (teamNames) => [['H', teamNames.H || 'Home'], ['V', teamNames.V || 'Visitor']];

const formatClock = (clock) => String(clock || '').replace(/^0(?=\d:)/, '') || 'Not set';

const ordinal = (down) => ({ 1: 'st', 2: 'nd', 3: 'rd', 4: 'th' }[Number(down)] || 'th');

const humanize = (value) => String(value || '')
  .replace(/([a-z])([A-Z])/g, '$1 $2')
  .replace(/[_-]+/g, ' ')
  .replace(/\b\w/g, (letter) => letter.toUpperCase());

export {
  collectChangedPaths,
  getAtPath,
};
