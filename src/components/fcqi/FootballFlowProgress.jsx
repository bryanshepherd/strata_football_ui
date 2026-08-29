import React from 'react';

const GENERIC_FLOW_STEPS = {
  teamPlay: [
    ['teamPlay.type', 'Team Play'],
    ['teamPlay.player', 'Player'],
    ['teamPlay.detail', 'Details'],
  ],
  pass: [
    ['pass.passer', 'Passer'],
    ['pass.result', 'Result'],
    ['pass.detail', 'Details'],
    ['pass.spot', 'Spot'],
  ],
  punt: [
    ['punt.punter', 'Punter'],
    ['punt.spot', 'Spot'],
    ['punt.receive', 'Receive'],
    ['punt.result', 'Result'],
  ],
  kick: [
    ['kick.type', 'Kick Type'],
    ['kick.player', 'Player'],
    ['kick.result', 'Result'],
    ['kick.detail', 'Details'],
  ],
  penalty: [
    ['penalty.name', 'Penalty'],
    ['penalty.team', 'Team'],
    ['penalty.resolution', 'Resolution'],
    ['penalty.enforcement', 'Enforcement'],
  ],
  gameControl: [
    ['gameControl.menu', 'Game Control'],
    ['gameControl.branch', 'Function'],
    ['gameControl.detail', 'Details'],
  ],
};

const RUSH_RESULT_LABELS = {
  tackle: 'Tackle',
  outOfBounds: 'Out of Bounds',
  fumble: 'Fumble',
  lateral: 'Lateral',
  endOfPlay: 'End of Play',
};

export default function FootballFlowProgress({ onStepClick, steps = [] }) {
  if (!steps.length) return null;

  return (
    <nav aria-label="FCQI flow progress" className="mb-4">
      <ol className="flex flex-wrap items-center gap-1.5 text-xs font-bold">
        {steps.map((step, index) => (
          <React.Fragment key={step.id}>
            <li>
              <FlowStepButton onStepClick={onStepClick} step={step} />
            </li>
            {index < steps.length - 1 && (
              <li aria-hidden="true" className="text-zinc-400">
                -&gt;
              </li>
            )}
          </React.Fragment>
        ))}
      </ol>
    </nav>
  );
}

export function buildFootballFlowProgressSteps(state) {
  if (!state?.flow || state.status === 'idle' || state.status === 'cancelled' || state.status === 'submitted') {
    return [];
  }

  if (state.flow === 'rush') return buildRushProgressSteps(state);
  return buildGenericProgressSteps(state);
}

function FlowStepButton({ onStepClick, step }) {
  const classes = [
    'max-w-full rounded border px-2 py-1.5 shadow-sm',
    step.status === 'complete' ? 'whitespace-nowrap border-emerald-700 bg-emerald-100 text-emerald-950' : '',
    step.status === 'current' ? 'whitespace-normal break-words border-red-700 bg-red-100 text-red-950' : '',
    step.status === 'future' ? 'whitespace-nowrap border-zinc-300 bg-zinc-100 text-zinc-500' : '',
    step.clickable ? 'hover:bg-emerald-200 focus:outline-none focus:ring-2 focus:ring-emerald-200' : 'cursor-default',
  ].filter(Boolean).join(' ');

  if (!step.clickable) {
    return (
      <span
        className={classes}
        data-fcqi-step-id={step.id}
        data-fcqi-step-status={step.status}
      >
        {step.value || step.label}
      </span>
    );
  }

  return (
    <button
      className={classes}
      data-fcqi-step-id={step.id}
      data-fcqi-step-status={step.status}
      onClick={() => onStepClick?.(step.id)}
      type="button"
    >
      {step.value || step.label}
    </button>
  );
}

function buildRushProgressSteps(state) {
  const tokens = state.tokens || {};
  const currentId = currentRushStepId(state);
  const steps = [
    {
      id: 'rush.rusher',
      label: 'Rusher',
      value: participantLabel(tokens.rusher),
      complete: Boolean(tokens.rusher),
    },
    {
      id: 'rush.result',
      label: 'Result',
      value: RUSH_RESULT_LABELS[tokens.result],
      complete: Boolean(tokens.result),
    },
  ];

  if (tokens.result === 'tackle' || tokens.result === 'outOfBounds') {
    steps.push({
      id: 'rush.tacklers',
      label: 'Tacklers',
      value: participantsLabel(tokens.tacklers),
      complete: Boolean(tokens.tacklers?.length),
    });
  }

  steps.push({
    id: 'rush.spot',
    label: 'Spot',
    value: tokens.endYardLine,
    complete: Boolean(tokens.endYardLine),
  });

  return steps.map((step) => decorateStep(step, currentId));
}

function buildGenericProgressSteps(state) {
  const genericSteps = GENERIC_FLOW_STEPS[state.flow] || [];
  const currentIndex = genericCurrentIndex(state);

  return genericSteps.map(([id, label], index) => ({
    id,
    label,
    status: index < currentIndex ? 'complete' : index === currentIndex ? 'current' : 'future',
    clickable: false,
  }));
}

function decorateStep(step, currentId) {
  const status = step.id === currentId
    ? 'current'
    : step.complete
      ? 'complete'
      : 'future';

  return {
    id: step.id,
    label: step.label,
    status,
    value: step.value,
    clickable: status === 'complete',
  };
}

function currentRushStepId(state) {
  if (state.status === 'jersey.disambiguating' && state.duplicate?.role === 'rusher') return 'rush.rusher';
  if (state.currentStep === 'rusherJersey') return 'rush.rusher';
  if (state.currentStep === 'result') return 'rush.result';
  if (state.currentStep === 'tackleAJersey' || state.currentStep === 'tackleBJersey' || state.currentStep === 'tacklerJersey') {
    return 'rush.tacklers';
  }
  if (state.currentStep === 'endSpot') return 'rush.spot';
  return null;
}

function genericCurrentIndex(state) {
  const step = state.currentStep;
  if (state.flow === 'teamPlay') {
    if (step === 'teamPlayMenu') return 0;
    if (step === 'teamPlayPlayerJersey') return 1;
    return 2;
  }
  if (state.flow === 'pass') {
    if (step === 'passerJersey') return 0;
    if (step === 'passResult') return 1;
    if (step === 'sackSpot' || step === 'returnEndSpot' || step === 'endSpot') return 3;
    return 2;
  }
  if (state.flow === 'punt') {
    if (step === 'punterJersey') return 0;
    if (step === 'puntSpot') return 1;
    if (step === 'puntReceiveResult') return 2;
    return 3;
  }
  if (state.flow === 'kick') {
    if (step === 'kickMenu') return 0;
    if (String(step || '').endsWith('Jersey')) return 1;
    if (String(step || '').toLowerCase().includes('result') || step === 'patType') return 2;
    return 3;
  }
  if (state.flow === 'penalty') {
    if (step === 'penaltyName') return 0;
    if (step === 'penaltyTeam') return 1;
    if (step === 'penaltyTiming') return 2;
    if (step === 'penaltyResolution') return 3;
    return 3;
  }
  if (state.flow === 'gameControl') {
    if (step === 'gameControlMenu') return 0;
    if (step === 'gameControlQuarterMenu' || step === 'gameControlDown' || step === 'gameControlPossession') return 1;
    return 2;
  }
  return 0;
}

function participantLabel(participant) {
  if (!participant) return '';
  const name = participant.displayName || participant.playerName || participant.name || '';
  return `#${participant.jersey}${name ? ` ${lastName(name)}` : ''}`;
}

function participantsLabel(participants = []) {
  return participants.map(participantLabel).filter(Boolean).join(', ');
}

function lastName(name) {
  const parts = String(name).trim().split(/\s+/).filter(Boolean);
  return parts.at(-1) || '';
}
