import React, { useEffect, useRef, useState } from 'react';
import { searchFootballPenaltyTable } from '../../quick-input/penaltyTable';
import FootballFlowProgress from './FootballFlowProgress';

const stepCopy = {
  rusherJersey: {
    title: 'Rush',
    label: 'Rusher jersey',
    helper: 'Enter the ball carrier jersey number.',
    placeholder: '22',
  },
  result: {
    title: 'Rush result',
    label: 'Result',
    helper: 'Choose how the run ended.',
    placeholder: 'T',
  },
  endSpot: {
    title: 'Rush',
    label: 'Final ball spot',
    helper: 'Enter the final spot. Rush yards are calculated from the pre-play spot.',
    placeholder: 'V49',
  },
  tackleAJersey: {
    title: 'Rush tackler',
    label: 'Tackler jersey',
    helper: 'Enter the primary tackler jersey number.',
    placeholder: '44',
  },
  tackleBJersey: {
    title: 'Rush tackler',
    label: 'Second tackler jersey',
    helper: 'Enter a second tackler jersey number, or press Enter to skip.',
    placeholder: '44',
  },
  tacklerJersey: {
    title: 'Rush tackler',
    label: 'Tackler jersey',
    helper: 'Enter a tackler jersey number, or press Enter to skip.',
    placeholder: '44',
  },
  forcedByJersey: {
    title: 'Fumble',
    label: 'Forced by jersey',
    helper: 'Enter the defender who forced the fumble.',
    placeholder: '44',
  },
  recoverTeam: {
    title: 'Fumble recovery',
    label: 'Recovering team',
    helper: 'Enter H or V.',
    placeholder: 'H',
  },
  recoverPlayerJersey: {
    title: 'Fumble recovery',
    label: 'Recovery player jersey',
    helper: 'Enter the player who recovered the fumble.',
    placeholder: '22',
  },
  recoverSpot: {
    title: 'Fumble recovery',
    label: 'Recovery spot',
    helper: 'Enter the recovery spot.',
    placeholder: 'V49',
  },
  fumbleReturned: {
    title: 'Fumble recovery',
    label: 'Returned?',
    helper: 'Enter yes or no. Returned fumbles are blocked in this pass.',
    placeholder: 'No',
  },
  passerJersey: {
    title: 'Pass',
    label: 'Passer jersey',
    helper: 'Enter the quarterback/passer jersey number.',
    placeholder: '12',
  },
  passResult: {
    title: 'Pass result',
    label: 'Result',
    helper: 'Choose how the pass play resolved.',
    placeholder: 'C',
  },
  receiverJersey: {
    title: 'Pass receiver',
    label: 'Receiver jersey',
    helper: 'Enter the receiver jersey number.',
    placeholder: '88',
  },
  caughtAtSpot: {
    title: 'Pass caught at',
    label: 'Caught At yardline',
    helper: 'Enter the catch spot, or press Enter to skip.',
    placeholder: 'V49',
  },
  completeResult: {
    title: 'Complete pass result',
    label: 'Complete result',
    helper: 'Choose how the completed pass ended. C means Lateral here.',
    placeholder: 'T',
  },
  intendedReceiverJersey: {
    title: 'Pass target',
    label: 'Intended For jersey',
    helper: 'Enter the intended receiver jersey number.',
    placeholder: '88',
  },
  passYardLine: {
    title: 'Pass yardline',
    label: 'Yardline',
    helper: 'Enter the pass target/interception yardline, or press Enter to skip.',
    placeholder: 'V49',
  },
  brokenUp: {
    title: 'Pass broken up',
    label: 'Broken Up?',
    helper: 'Enter yes or no. If yes, one defender is required.',
    placeholder: 'No',
  },
  brokenUpDefenderJersey: {
    title: 'Pass broken up',
    label: 'Broken up by jersey',
    helper: 'Enter exactly one defender jersey.',
    placeholder: '44',
  },
  hurried: {
    title: 'Pass hurried',
    label: 'Hurried?',
    helper: 'Enter yes or no. If yes, up to three defenders may be entered.',
    placeholder: 'No',
  },
  hurryDefender1Jersey: {
    title: 'Pass hurry',
    label: 'Hurry defender jersey',
    helper: 'Enter the hurry defender jersey number.',
    placeholder: '44',
  },
  hurryDefender2Jersey: {
    title: 'Pass hurry',
    label: 'Second hurry defender jersey',
    helper: 'Enter another hurry defender jersey, or press Enter to skip.',
    placeholder: '44',
  },
  hurryDefender3Jersey: {
    title: 'Pass hurry',
    label: 'Third hurry defender jersey',
    helper: 'Enter a third hurry defender jersey, or press Enter to finish.',
    placeholder: '44',
  },
  sackDefenderAJersey: {
    title: 'Sack',
    label: 'Sacked By jersey',
    helper: 'Enter the first sack defender jersey number.',
    placeholder: '44',
  },
  sackDefenderBJersey: {
    title: 'Sack',
    label: 'Second sack defender jersey',
    helper: 'Enter a second sack defender jersey, or press Enter to skip.',
    placeholder: '44',
  },
  sackSpot: {
    title: 'Sack yardline',
    label: 'Sack yardline',
    helper: 'Enter the sack spot. Yardage is calculated from the pre-play spot.',
    placeholder: 'H37',
  },
  punterJersey: {
    title: 'Punt',
    label: 'Punter jersey',
    helper: 'Enter the punter jersey number.',
    placeholder: '9',
  },
  puntSpot: {
    title: 'Punt spot',
    label: 'Receive or dead-ball spot',
    helper: 'Enter the punt catch, receive, or dead-ball spot.',
    placeholder: 'V26',
  },
  puntReceiveResult: {
    title: 'Kick receive result',
    label: 'Receive result',
    helper: 'Choose the kick receive result. T means Touchback and C means Fair Catch here.',
    placeholder: 'R',
  },
  returnerJersey: {
    title: 'Punt returner',
    label: 'Returner jersey',
    helper: 'Enter the returner jersey number.',
    placeholder: '3',
  },
  returnTerminalResult: {
    title: 'Return result',
    label: 'Return result',
    helper: 'Choose how the live return ended. T means Tackle and C means Lateral here.',
    placeholder: 'T',
  },
  returnTackleAJersey: {
    title: 'Return tackler',
    label: 'Tackler jersey',
    helper: 'Enter the primary return tackler jersey number.',
    placeholder: '44',
  },
  returnTackleBJersey: {
    title: 'Return tackler',
    label: 'Second tackler jersey',
    helper: 'Enter a second return tackler jersey number, or press Enter to skip.',
    placeholder: '44',
  },
  returnEndSpot: {
    title: 'Return final spot',
    label: 'Final spot',
    helper: 'Enter the return final spot.',
    placeholder: 'V31',
  },
  downingPlayerJersey: {
    title: 'Punt downed',
    label: 'Downing player jersey',
    helper: 'Enter the downing player jersey, or press Enter to skip.',
    placeholder: '22',
  },
  downedSpot: {
    title: 'Punt downed',
    label: 'Downed spot',
    helper: 'Enter the downed spot.',
    placeholder: 'V12',
  },
  kickMenu: {
    title: 'Kick',
    label: 'Kick type',
    helper: 'Choose Kickoff / Free Kick, Field Goal, or PAT.',
    placeholder: 'O',
  },
  kickerJersey: {
    title: 'Kickoff / Free Kick',
    label: 'Kicker jersey',
    helper: 'Enter the kicker jersey number.',
    placeholder: '9',
  },
  kickReceiveResult: {
    title: 'Kick receive result',
    label: 'Receive result',
    helper: 'Choose the kick receive result. T means Touchback and C means Fair Catch here.',
    placeholder: 'R',
  },
  kickReturnStartSpot: {
    title: 'Kick return start',
    label: 'Return start spot',
    helper: 'Enter the catch or return start spot.',
    placeholder: 'V20',
  },
  kickTouchbackSpot: {
    title: 'Kick touchback',
    label: 'Touchback spot',
    helper: 'Confirm the touchback spot.',
    placeholder: 'V25',
  },
  kickFairCatchSpot: {
    title: 'Kick fair catch',
    label: 'Fair catch spot',
    helper: 'Enter the fair catch spot.',
    placeholder: 'V26',
  },
  kickOutOfBoundsSpot: {
    title: 'Kick out of bounds',
    label: 'Out-of-bounds spot',
    helper: 'Enter the dead-ball spot.',
    placeholder: 'V35',
  },
  fieldGoalSpot: {
    title: 'Field goal',
    label: 'Yardline kicked from',
    helper: 'Enter the spot of the kick.',
    placeholder: 'V18',
  },
  fieldGoalResult: {
    title: 'Field goal result',
    label: 'Result',
    helper: 'Choose the field goal result.',
    placeholder: 'G',
  },
  fieldGoalMissedReason: {
    title: 'Missed how?',
    label: 'Missed how?',
    helper: 'Choose the missed field goal reason.',
    placeholder: 'R',
  },
  fieldGoalBlockedByJersey: {
    title: 'Field goal blocked',
    label: 'Blocked by jersey',
    helper: 'Enter the player who blocked the kick.',
    placeholder: '44',
  },
  fieldGoalReturnAttempted: {
    title: 'Return Attempted?',
    label: 'Return Attempted?',
    helper: 'Choose whether the missed or blocked field goal was returned.',
    placeholder: 'N',
  },
  patType: {
    title: 'PAT Type',
    label: 'PAT Type',
    helper: 'Choose rush, pass, or kick.',
    placeholder: 'K',
  },
  patKickResult: {
    title: 'Kick PAT result',
    label: 'Result',
    helper: 'Choose the kick PAT result.',
    placeholder: 'G',
  },
  patKickMissedReason: {
    title: 'Missed how?',
    label: 'Missed how?',
    helper: 'Choose the missed PAT reason.',
    placeholder: 'R',
  },
  patKickBlockedByJersey: {
    title: 'Kick PAT blocked',
    label: 'Blocked by jersey',
    helper: 'Enter the player who blocked the kick.',
    placeholder: '44',
  },
  patKickReturnAttempted: {
    title: 'Return Attempted?',
    label: 'Return Attempted?',
    helper: 'Choose whether the blocked PAT was returned.',
    placeholder: 'N',
  },
  patRusherJersey: {
    title: 'Rush PAT',
    label: 'Rusher jersey',
    helper: 'Enter the two-point rusher jersey number.',
    placeholder: '22',
  },
  patRushResult: {
    title: 'Rush PAT result',
    label: 'Result',
    helper: 'Choose the rush PAT result.',
    placeholder: 'G',
  },
  patRushReturnAttempted: {
    title: 'Return Attempted?',
    label: 'Return Attempted?',
    helper: 'Choose whether the fumbled try was returned.',
    placeholder: 'N',
  },
  patPasserJersey: {
    title: 'Pass PAT',
    label: 'Passer jersey',
    helper: 'Enter the two-point passer jersey number.',
    placeholder: '12',
  },
  patReceiverJersey: {
    title: 'Pass PAT',
    label: 'Receiver jersey',
    helper: 'Enter the two-point receiver jersey number.',
    placeholder: '88',
  },
  patPassResult: {
    title: 'Pass PAT result',
    label: 'Result',
    helper: 'Choose the pass PAT result.',
    placeholder: 'G',
  },
  patPassReturnAttempted: {
    title: 'Return Attempted?',
    label: 'Return Attempted?',
    helper: 'Choose whether the intercepted or fumbled try was returned.',
    placeholder: 'N',
  },
  penaltyName: {
    title: 'Penalty',
    label: 'Penalty',
    helper: 'Search by penalty name or code, then select a table entry. Unmatched text is treated as Other.',
    placeholder: 'HOLD or Holding',
  },
  penaltyTeam: {
    title: 'Penalty team',
    label: 'Team',
    helper: 'Choose the team charged with the penalty.',
    placeholder: 'H',
  },
  penaltyResolution: {
    title: 'Penalty resolution',
    label: 'Resolution',
    helper: 'Choose accepted, declined, or offsetting.',
    placeholder: 'A',
  },
  penaltyPlayerJersey: {
    title: 'Penalty player',
    label: 'Penalized player # (optional)',
    helper: 'Enter a penalized player jersey, or press Enter to skip.',
    placeholder: '56',
  },
  penaltyEnforcedFrom: {
    title: 'Enforced From',
    label: 'Enforced From',
    helper: 'Choose previous spot, spot of foul, or succeeding spot.',
    placeholder: 'P',
  },
  penaltySpotOfFoul: {
    title: 'Spot of Foul',
    label: 'Spot of Foul',
    helper: 'Enter the foul spot.',
    placeholder: 'V45',
  },
  penaltyFinalSpot: {
    title: 'Penalty final spot',
    label: 'Final Spot',
    helper: 'Enter the ball spot after enforcement.',
    placeholder: 'H45',
  },
  penaltyDown: {
    title: 'Down',
    label: 'Down',
    helper: 'Choose repeat down, loss of down, or automatic first down.',
    placeholder: 'R',
  },
  offsettingSecondName: {
    title: 'Offsetting penalty',
    label: 'Matching Penalty',
    helper: 'Search by penalty name or code for the matching offsetting foul.',
    placeholder: 'OFF or Offside',
  },
  offsettingSecondTeam: {
    title: 'Offsetting team',
    label: 'Matching Penalty Team',
    helper: 'Choose the team for the matching penalty.',
    placeholder: 'V',
  },
  offsettingPlayCounts: {
    title: 'Offsetting fouls',
    label: 'Does the previous play count?',
    helper: 'Choose whether the previous play counts.',
    placeholder: 'N',
  },
  gameControlMenu: {
    title: 'Game Control',
    label: 'Game Control',
    helper: 'Choose a non-play game operation. Coin Toss is hidden until pregame detection is wired.',
    placeholder: 'B',
  },
  gameControlQuarterMenu: {
    title: 'Quarter Functions',
    label: 'Quarter Function',
    helper: 'Choose Start Quarter or End Quarter.',
    placeholder: 'S',
  },
  gameControlDown: {
    title: 'Ball Context',
    label: 'Down',
    helper: 'Enter the current down.',
    placeholder: '1',
  },
  gameControlDistance: {
    title: 'Ball Context',
    label: 'Distance',
    helper: 'Enter the distance. Line to gain is calculated from spot plus distance.',
    placeholder: '10',
  },
  gameControlSpot: {
    title: 'Ball Context',
    label: 'Spot',
    helper: 'Enter the ball spot. Line to gain will be calculated from this spot and distance.',
    placeholder: 'H35',
  },
  gameControlPossession: {
    title: 'Set Possession',
    label: 'Possession Team',
    helper: 'Choose Home or Visitor.',
    placeholder: 'H',
  },
};

const rushResultButtons = [
  { label: 'Tackle', hotkey: 'T', value: 'T' },
  { label: 'Out of Bounds', hotkey: 'O', value: 'O' },
  { label: 'Fumble', hotkey: 'F', value: 'F' },
  { label: 'Lateral', hotkey: 'C', value: 'C' },
  { label: 'End of Play', hotkey: '.', value: '.' },
];

const passResultButtons = [
  { label: 'Complete', hotkey: 'C', value: 'C' },
  { label: 'Incomplete', hotkey: 'I', value: 'I' },
  { label: 'Sack', hotkey: 'S', value: 'S' },
  { label: 'Sack Fumble', hotkey: 'F', value: 'F' },
  { label: 'Rush Conversion', hotkey: 'R', value: 'R' },
  { label: 'Intercepted', hotkey: 'X', value: 'X' },
];

const completeResultButtons = rushResultButtons;

const puntReceiveResultButtons = [
  { label: 'Return', hotkey: 'R', value: 'R' },
  { label: 'Touchback', hotkey: 'T', value: 'T' },
  { label: 'Fair Catch', hotkey: 'C', value: 'C' },
  { label: 'Out of Bounds', hotkey: 'O', value: 'O' },
  { label: 'Muffed', hotkey: 'M', value: 'M' },
  { label: 'Downed', hotkey: 'D', value: 'D' },
];

const returnTerminalResultButtons = rushResultButtons;

const kickMenuButtons = [
  { label: 'Kickoff / Free Kick', hotkey: 'O', value: 'O' },
  { label: 'Field Goal', hotkey: 'F', value: 'F' },
  { label: 'PAT', hotkey: 'A', value: 'A' },
];

const fieldGoalResultButtons = [
  { label: 'Good', hotkey: 'G', value: 'G' },
  { label: 'Missed', hotkey: 'M', value: 'M' },
  { label: 'Blocked', hotkey: 'B', value: 'B' },
];

const missedReasonButtons = [
  { label: 'Wide Right', hotkey: 'R', value: 'R' },
  { label: 'Wide Left', hotkey: 'L', value: 'L' },
  { label: 'Short', hotkey: 'S', value: 'S' },
  { label: 'Left Upright', hotkey: 'E', value: 'E' },
  { label: 'Right Upright', hotkey: 'I', value: 'I' },
  { label: 'Crossbar', hotkey: 'C', value: 'C' },
];

const patTypeButtons = [
  { label: 'Rush', hotkey: 'R', value: 'R' },
  { label: 'Pass', hotkey: 'P', value: 'P' },
  { label: 'Kick', hotkey: 'K', value: 'K' },
];

const patRushResultButtons = [
  { label: 'Good', hotkey: 'G', value: 'G' },
  { label: 'Missed', hotkey: 'M', value: 'M' },
  { label: 'Fumbled', hotkey: 'F', value: 'F' },
];

const patPassResultButtons = [
  { label: 'Good', hotkey: 'G', value: 'G' },
  { label: 'Missed', hotkey: 'M', value: 'M' },
  { label: 'Incomplete', hotkey: 'I', value: 'I' },
  { label: 'Intercepted', hotkey: 'X', value: 'X' },
  { label: 'Fumbled', hotkey: 'F', value: 'F' },
];

const returnAttemptedButtons = [
  { label: 'Yes', hotkey: 'Y', value: 'Y' },
  { label: 'No', hotkey: 'N', value: 'N' },
];

const penaltyTeamButtons = [
  { label: 'Home', hotkey: 'H', value: 'H' },
  { label: 'Visitor', hotkey: 'V', value: 'V' },
];

const penaltyResolutionButtons = [
  { label: 'Accepted', hotkey: 'A', value: 'A' },
  { label: 'Declined', hotkey: 'D', value: 'D' },
  { label: 'Offsetting', hotkey: 'O', value: 'O' },
];

const penaltyEnforcedFromButtons = [
  { label: 'Previous Spot', hotkey: 'P', value: 'P' },
  { label: 'Spot of Foul', hotkey: 'F', value: 'F' },
  { label: 'Succeeding Spot', hotkey: 'S', value: 'S' },
];

const penaltyDownButtons = [
  { label: 'Repeat Down', hotkey: 'R', value: 'R' },
  { label: 'Loss of Down', hotkey: 'L', value: 'L' },
  { label: 'Auto 1st Down', hotkey: 'A', value: 'A' },
];

const offsettingPlayCountsButtons = [
  { label: 'Yes, play counts', hotkey: 'Y', value: 'Y' },
  { label: 'No, play is cancelled', hotkey: 'N', value: 'N' },
];

const gameControlMenuButtons = [
  { label: 'Emergency', hotkey: 'E', value: 'E' },
  { label: 'Quarter Functions', hotkey: 'Q', value: 'Q' },
  { label: 'Ball Context', hotkey: 'B', value: 'B' },
  { label: 'Drive Start', hotkey: 'D', value: 'D' },
  { label: 'Set Possession', hotkey: 'P', value: 'P' },
  { label: 'Roster Functions', hotkey: 'R', value: 'R' },
];

const quarterFunctionButtons = [
  { label: 'Start Quarter', hotkey: 'S', value: 'S' },
  { label: 'End Quarter', hotkey: 'E', value: 'E' },
];

export default function FootballFlowModal({
  state,
  prePlaySpot,
  onCancel,
  onStepClick,
  onTokenCommit,
  progressSteps = [],
}) {
  const [value, setValue] = useState(state.currentToken || '');
  const inputRef = useRef(null);
  const activeStep = state.currentStep ? stepCopy[state.currentStep] : null;
  const activeButtons = resultButtonsForStep(state.currentStep);
  const buttonOnly = Boolean(activeButtons);
  const penaltyOptions = isPenaltySelectionStep(state.currentStep)
    ? searchFootballPenaltyTable(value, 8)
    : [];

  useEffect(() => {
    setValue(state.currentToken || '');
  }, [state.currentStep, state.currentToken, state.status]);

  useEffect(() => {
    inputRef.current?.focus();
  }, [state.currentStep, state.status]);

  useEffect(() => {
    if (!activeButtons || state.status !== 'token.awaiting') return undefined;

    const onKeyDown = (event) => {
      if (event.defaultPrevented || event.metaKey || event.ctrlKey || event.altKey) return;
      const match = activeButtons.find((button) => button.hotkey.toLowerCase() === event.key.toLowerCase());
      if (!match) return;
      event.preventDefault();
      onTokenCommit(match.value);
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [onTokenCommit, state.currentStep, state.status]);

  if (!activeStep || (state.status !== 'token.awaiting' && state.status !== 'token.error')) {
    return null;
  }

  const onSubmit = (event) => {
    event.preventDefault();
    onTokenCommit(value);
  };

  return (
    <ModalFrame
      eyebrow="Football confirmed quick input"
      onCancel={onCancel}
      onStepClick={onStepClick}
      progressSteps={state.flow === 'gameControl' ? [] : progressSteps}
      title={activeStep.title}
    >
      <form className="space-y-4" onSubmit={onSubmit}>
        {activeButtons && (
          <div className="grid gap-2 sm:grid-cols-2">
            {activeButtons.map((button) => (
              <button
                key={button.value}
                className="flex items-center justify-between gap-3 rounded border border-zinc-300 bg-white px-3 py-3 text-left text-sm font-semibold text-zinc-900 hover:border-emerald-700 hover:bg-emerald-50"
                onClick={() => onTokenCommit(button.value)}
                type="button"
              >
                <span>{button.label}</span>
                <span className="grid h-7 min-w-7 place-items-center rounded border border-zinc-300 bg-zinc-50 px-2 text-xs font-black">
                  {button.hotkey}
                </span>
              </button>
            ))}
          </div>
        )}
        {penaltyOptions.length > 0 && (
          <div className="grid max-h-60 gap-2 overflow-auto rounded border border-zinc-200 bg-zinc-50 p-2 sm:grid-cols-2">
            {penaltyOptions.map((penalty) => (
              <button
                key={penalty.code}
                className="flex items-center justify-between gap-3 rounded border border-zinc-300 bg-white px-3 py-2 text-left text-sm font-semibold text-zinc-900 hover:border-emerald-700 hover:bg-emerald-50"
                onClick={() => onTokenCommit(penalty.code)}
                type="button"
              >
                <span className="min-w-0">
                  <span className="block truncate">{penalty.name}</span>
                  <span className="block text-xs font-medium text-zinc-500">
                    Default {penalty.defaultEnforcement}
                    {typeof penalty.yards === 'number' ? `, ${penalty.yards} yd reference` : ''}
                  </span>
                </span>
                <span className="grid h-7 min-w-10 place-items-center rounded border border-zinc-300 bg-zinc-50 px-2 text-xs font-black">
                  {penalty.code}
                </span>
              </button>
            ))}
          </div>
        )}
        <div>
          {!buttonOnly && (
            <>
              <label className="text-sm font-semibold text-zinc-900" htmlFor={`fcqi-${state.currentStep}`}>
                {activeStep.label}
              </label>
              <input
                ref={inputRef}
                aria-invalid={state.status === 'token.error' ? 'true' : 'false'}
                className="mt-2 w-full rounded border border-zinc-300 bg-white px-3 py-2 text-lg font-semibold tabular-nums outline-none focus:border-emerald-700 focus:ring-2 focus:ring-emerald-100"
                id={`fcqi-${state.currentStep}`}
                onChange={(event) => setValue(event.target.value)}
                placeholder={activeStep.placeholder}
                value={value}
              />
            </>
          )}
          <p className={buttonOnly ? 'text-sm text-zinc-600' : 'mt-2 text-sm text-zinc-600'}>
            {activeStep.helper}
            {state.currentStep === 'endSpot' && prePlaySpot ? ` Current spot: ${prePlaySpot}.` : ''}
          </p>
          {state.error && (
            <p className="mt-2 rounded border border-red-200 bg-red-50 px-3 py-2 text-sm font-semibold text-red-800">
              {state.error.message}
            </p>
          )}
        </div>

        <div className="flex flex-wrap justify-end gap-2">
          <button
            className="rounded border border-zinc-300 px-3 py-2 text-sm font-semibold text-zinc-800 hover:bg-zinc-50"
            onClick={onCancel}
            type="button"
          >
            Cancel
          </button>
          {!buttonOnly && (
            <button
              className="rounded bg-emerald-700 px-3 py-2 text-sm font-semibold text-white hover:bg-emerald-800"
              type="submit"
            >
              Enter
            </button>
          )}
        </div>
      </form>
    </ModalFrame>
  );
}

const ModalFrame = ({ children, eyebrow, onCancel, onStepClick, progressSteps, title }) => (
  <div className="fixed inset-0 z-40 grid place-items-center bg-zinc-950/55 p-4" role="presentation">
    <section
      aria-label={title}
      aria-modal="true"
      className="w-full max-w-md rounded border border-zinc-300 bg-white shadow-xl"
      role="dialog"
    >
      <div className="flex items-start justify-between gap-4 border-b border-zinc-200 px-5 py-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-emerald-700">{eyebrow}</p>
          <h2 className="mt-1 text-lg font-semibold text-zinc-950">{title}</h2>
        </div>
        <button
          aria-label="Cancel quick input"
          className="rounded border border-zinc-300 px-2 py-1 text-sm font-semibold text-zinc-700 hover:bg-zinc-50"
          onClick={onCancel}
          type="button"
        >
          Esc
        </button>
      </div>
      <div className="p-5">
        <FootballFlowProgress onStepClick={onStepClick} steps={progressSteps} />
        {children}
      </div>
    </section>
  </div>
);

function resultButtonsForStep(step) {
  if (step === 'result') return rushResultButtons;
  if (step === 'passResult') return passResultButtons;
  if (step === 'completeResult') return completeResultButtons;
  if (step === 'puntReceiveResult') return puntReceiveResultButtons;
  if (step === 'kickMenu') return kickMenuButtons;
  if (step === 'kickReceiveResult') return puntReceiveResultButtons;
  if (step === 'returnTerminalResult') return returnTerminalResultButtons;
  if (step === 'fieldGoalResult') return fieldGoalResultButtons;
  if (step === 'fieldGoalMissedReason') return missedReasonButtons;
  if (step === 'fieldGoalReturnAttempted') return returnAttemptedButtons;
  if (step === 'patType') return patTypeButtons;
  if (step === 'patKickResult') return fieldGoalResultButtons;
  if (step === 'patKickMissedReason') return missedReasonButtons;
  if (step === 'patKickReturnAttempted') return returnAttemptedButtons;
  if (step === 'patRushResult') return patRushResultButtons;
  if (step === 'patRushReturnAttempted') return returnAttemptedButtons;
  if (step === 'patPassResult') return patPassResultButtons;
  if (step === 'patPassReturnAttempted') return returnAttemptedButtons;
  if (step === 'penaltyTeam' || step === 'offsettingSecondTeam') return penaltyTeamButtons;
  if (step === 'penaltyResolution') return penaltyResolutionButtons;
  if (step === 'penaltyEnforcedFrom') return penaltyEnforcedFromButtons;
  if (step === 'penaltyDown') return penaltyDownButtons;
  if (step === 'offsettingPlayCounts') return offsettingPlayCountsButtons;
  if (step === 'gameControlMenu') return gameControlMenuButtons;
  if (step === 'gameControlQuarterMenu') return quarterFunctionButtons;
  if (step === 'gameControlPossession') return penaltyTeamButtons;
  return null;
}

function isPenaltySelectionStep(step) {
  return step === 'penaltyName' || step === 'offsettingSecondName';
}
