import type {
  DraftParticipant,
  DraftPenalty,
  FootballDraftIntent,
  Spot,
  TeamCode,
} from './footballIntentSchema';
import { isCanonicalSpot } from './footballIntentSchema';
import {
  createDraftPlayerResolution,
  resolvePlayerByJersey,
  type DuplicatePlayerResolutionResult,
  type PlayerResolutionRosterPlayer,
  type ResolvedPlayerCandidate,
} from './playerResolution';
import {
  generateFootballPlaySummary,
  type FootballPlaySummaryResult,
} from './footballPlaySummaryGrammar';
import {
  buildFootballEvent,
  type FootballEventBuildResult,
} from './footballEventBuilder';
import {
  findFootballPenaltyDefinition,
  type FootballPenaltyTableEntry,
} from './penaltyTable';

export type FootballQuickInputStateName =
  | 'idle'
  | 'token.awaiting'
  | 'token.validating'
  | 'jersey.disambiguating'
  | 'token.error'
  | 'draft.ready'
  | 'summary.reviewing'
  | 'penalty.editing'
  | 'submitting.confirmed'
  | 'submitted'
  | 'cancelled';

export type FootballQuickInputFlow = 'rush' | 'pass' | 'punt' | 'kick' | 'penalty' | 'gameControl';
export type RushResultSelection = 'tackle' | 'outOfBounds' | 'fumble' | 'lateral' | 'endOfPlay';
export type PassPrimaryResultSelection = 'complete' | 'incomplete' | 'sack' | 'sackFumble' | 'rushConversion' | 'interception';
export type CompletePassResultSelection = 'tackle' | 'outOfBounds' | 'fumble' | 'lateral' | 'endOfPlay';
export type PuntReceiveResultSelection = 'return' | 'touchback' | 'fairCatch' | 'outOfBounds' | 'muffed' | 'downed';
export type ReturnTerminalResultSelection = 'tackle' | 'outOfBounds' | 'fumble' | 'lateral' | 'endOfPlay';
export type KickMenuSelection = 'kickoff' | 'fieldGoal' | 'pat';
export type FieldGoalResultSelection = 'good' | 'missed' | 'blocked';
export type KickMissedReasonSelection = 'wideRight' | 'wideLeft' | 'short' | 'leftUpright' | 'rightUpright' | 'crossbar';
export type PatTypeSelection = 'rush' | 'pass' | 'kick';
export type PatKickResultSelection = 'good' | 'missed' | 'blocked';
export type PatRushResultSelection = 'good' | 'missed' | 'fumbled';
export type PatPassResultSelection = 'good' | 'missed' | 'incomplete' | 'intercepted' | 'fumbled';
export type PenaltySourceSelection = 'immediate' | 'queued';
export type PenaltyResolutionSelection = 'accepted' | 'declined' | 'offsetting';
export type PenaltyEnforcedFromSelection = 'PREVIOUS' | 'SPOT' | 'END';
export type PenaltyDownConsequenceSelection = 'REPEAT' | 'LOSS_OF_DOWN' | 'AUTO_FIRST';
export type GameControlMenuSelection = 'emergency' | 'quarter' | 'ballContext' | 'driveStart' | 'setPossession' | 'coinToss' | 'roster';
export type GameControlQuarterSelection = 'startQuarter' | 'endQuarter';
export type RushReturnType = 'Fumble' | 'Interception' | 'Field Goal' | 'Kickoff' | 'Punt' | 'Try';
export type RushTokenStep =
  | 'rusherJersey'
  | 'result'
  | 'yards'
  | 'endSpot'
  | 'tackleAJersey'
  | 'tackleBJersey'
  | 'tacklerJersey'
  | 'forcedByJersey'
  | 'recoverTeam'
  | 'recoverPlayerJersey'
  | 'recoverSpot'
  | 'fumbleReturned';
export type PassTokenStep =
  | 'passerJersey'
  | 'passResult'
  | 'receiverJersey'
  | 'caughtAtSpot'
  | 'completeResult'
  | 'intendedReceiverJersey'
  | 'passYardLine'
  | 'brokenUp'
  | 'brokenUpDefenderJersey'
  | 'hurried'
  | 'hurryDefender1Jersey'
  | 'hurryDefender2Jersey'
  | 'hurryDefender3Jersey'
  | 'sackDefenderAJersey'
  | 'sackDefenderBJersey'
  | 'sackSpot';
export type PuntTokenStep =
  | 'punterJersey'
  | 'puntSpot'
  | 'puntReceiveResult'
  | 'returnerJersey'
  | 'returnTerminalResult'
  | 'returnTackleAJersey'
  | 'returnTackleBJersey'
  | 'returnEndSpot'
  | 'downingPlayerJersey'
  | 'downedSpot';
export type KickTokenStep =
  | 'kickMenu'
  | 'kickerJersey'
  | 'kickReceiveResult'
  | 'returnerJersey'
  | 'kickReturnStartSpot'
  | 'returnTerminalResult'
  | 'returnTackleAJersey'
  | 'returnTackleBJersey'
  | 'returnEndSpot'
  | 'kickTouchbackSpot'
  | 'kickFairCatchSpot'
  | 'kickOutOfBoundsSpot';
export type FieldGoalTokenStep =
  | 'fieldGoalSpot'
  | 'fieldGoalResult'
  | 'fieldGoalMissedReason'
  | 'fieldGoalBlockedByJersey'
  | 'fieldGoalReturnAttempted';
export type PatTokenStep =
  | 'patType'
  | 'patKickResult'
  | 'patKickMissedReason'
  | 'patKickBlockedByJersey'
  | 'patKickReturnAttempted'
  | 'patRusherJersey'
  | 'patRushResult'
  | 'patRushReturnAttempted'
  | 'patPasserJersey'
  | 'patReceiverJersey'
  | 'patPassResult'
  | 'patPassReturnAttempted';
export type PenaltyTokenStep =
  | 'penaltyName'
  | 'penaltyTeam'
  | 'penaltyResolution'
  | 'penaltyPlayerJersey'
  | 'penaltyEnforcedFrom'
  | 'penaltySpotOfFoul'
  | 'penaltyFinalSpot'
  | 'penaltyDown'
  | 'offsettingSecondName'
  | 'offsettingSecondTeam'
  | 'offsettingPlayCounts';
export type GameControlTokenStep =
  | 'gameControlMenu'
  | 'gameControlQuarterMenu'
  | 'gameControlDown'
  | 'gameControlDistance'
  | 'gameControlSpot'
  | 'gameControlPossession';
export type FootballTokenStep = RushTokenStep | PassTokenStep | PuntTokenStep | KickTokenStep | FieldGoalTokenStep | PatTokenStep | PenaltyTokenStep | GameControlTokenStep;

export type FootballConfirmedQuickInputState = {
  status: FootballQuickInputStateName;
  flow?: FootballQuickInputFlow;
  currentStep?: FootballTokenStep;
  currentToken: string;
  tokens: FootballFlowTokens;
  draft?: FootballDraftIntent;
  summary?: FootballPlaySummaryResult;
  buildResult?: FootballEventBuildResult;
  duplicate?: FootballQuickInputDuplicateResolution;
  error?: FootballQuickInputError;
  queuedPenaltyRequested?: boolean;
};

export type RushFlowTokens = {
  rusher?: DraftParticipant;
  result?: RushResultSelection;
  yards?: number;
  endYardLine?: Spot;
  forcedBy?: DraftParticipant;
  recoverTeam?: TeamCode;
  recoverPlayer?: DraftParticipant;
  recoverSpot?: Spot;
  fumbleReturned?: boolean;
  returnFlow?: RushReturnFlowDraft;
  tacklers: DraftParticipant[];
};

export type PassFlowTokens = RushFlowTokens & {
  passer?: DraftParticipant;
  passResult?: PassPrimaryResultSelection;
  receiver?: DraftParticipant;
  caughtAtSpot?: Spot;
  completeResult?: CompletePassResultSelection;
  intendedReceiver?: DraftParticipant;
  passYardLine?: Spot;
  brokenUp?: boolean;
  brokenUpBy?: DraftParticipant;
  hurried?: boolean;
  hurryDefenders: DraftParticipant[];
  sackDefenders: DraftParticipant[];
  sackSpot?: Spot;
};

export type PuntFlowTokens = PassFlowTokens & {
  punter?: DraftParticipant;
  puntSpot?: Spot;
  puntReceiveResult?: PuntReceiveResultSelection;
  returner?: DraftParticipant;
  returnTerminalResult?: ReturnTerminalResultSelection;
  returnEndSpot?: Spot;
  downingPlayer?: DraftParticipant;
  downedSpot?: Spot;
};

export type KickFlowTokens = PuntFlowTokens & {
  kickMenuSelection?: KickMenuSelection;
  kicker?: DraftParticipant;
  kickReceiveResult?: PuntReceiveResultSelection;
  kickReturnStartSpot?: Spot;
  kickTouchbackSpot?: Spot;
  kickFairCatchSpot?: Spot;
  kickOutOfBoundsSpot?: Spot;
  fieldGoalSpot?: Spot;
  fieldGoalResult?: FieldGoalResultSelection;
  fieldGoalMissedReason?: KickMissedReasonSelection;
  fieldGoalReturnAttempted?: boolean;
  patType?: PatTypeSelection;
  patKickResult?: PatKickResultSelection;
  patKickMissedReason?: KickMissedReasonSelection;
  patKickReturnAttempted?: boolean;
  patRushResult?: PatRushResultSelection;
  patRushReturnAttempted?: boolean;
  patPassResult?: PatPassResultSelection;
  patPassReturnAttempted?: boolean;
};

export type PenaltyFlowTokens = KickFlowTokens & {
  penaltySource?: PenaltySourceSelection;
  penaltyName?: string;
  penaltyCode?: string;
  penaltyDefinition?: FootballPenaltyTableEntry;
  penaltyTeam?: TeamCode;
  penaltyResolution?: PenaltyResolutionSelection;
  penaltyPlayer?: DraftParticipant;
  penaltyEnforcedFrom?: PenaltyEnforcedFromSelection;
  penaltySpotOfFoul?: Spot;
  penaltyFinalSpot?: Spot;
  penaltyDownConsequence?: PenaltyDownConsequenceSelection;
  offsettingSecondName?: string;
  offsettingSecondCode?: string;
  offsettingSecondDefinition?: FootballPenaltyTableEntry;
  offsettingSecondTeam?: TeamCode;
  offsettingPreviousPlayCounts?: boolean;
};

export type GameControlFlowTokens = PenaltyFlowTokens & {
  gameControlSelection?: GameControlMenuSelection;
  gameControlQuarterSelection?: GameControlQuarterSelection;
  gameControlDown?: number;
  gameControlDistance?: number;
  gameControlSpot?: Spot;
  gameControlLineToGain?: Spot;
  gameControlPossession?: TeamCode;
};

export type FootballFlowTokens = GameControlFlowTokens;

export type RushReturnFlowDraft = {
  type: RushReturnType;
  fromSpot?: Spot;
  status: 'blocked';
  reason: string;
};

export type FootballQuickInputDuplicateResolution = {
  role:
    | 'rusher'
    | 'passer'
    | 'receiver'
    | 'intendedReceiver'
    | 'tackler'
    | 'sack'
    | 'passBreakup'
    | 'hurry'
    | 'forcedBy'
    | 'recoverer'
    | 'punter'
    | 'kicker'
    | 'returner'
    | 'blocker'
    | 'downingPlayer'
    | 'penalizedPlayer';
  jerseyToken: string;
  teamScope: TeamCode;
  actionContext: 'offense' | 'defense' | 'specialTeams' | 'penalty';
  candidates: DuplicatePlayerResolutionResult['candidates'];
  recommended: DuplicatePlayerResolutionResult['recommended'];
  recommendedPlayerId: string;
};

export type FootballQuickInputError = {
  code: string;
  message: string;
  field?: string;
};

export type FootballQuickInputContext = {
  game: FootballDraftIntent['game'];
  source: FootballDraftIntent['source'];
  play: Pick<FootballDraftIntent['play'], 'actionTeam' | 'possession' | 'period' | 'clock'>;
  prePlay: FootballDraftIntent['prePlay'];
  roster: readonly PlayerResolutionRosterPlayer[];
  intentId?: string;
  clientEventId?: string;
  now?: string;
  penalties?: DraftPenalty[];
  deriveRushYardsFromEndSpot?: boolean;
  calculateRushYards?: (input: {
    startYardLine: Spot | null | undefined;
    endYardLine: Spot;
    possession: TeamCode;
  }) => number | null | undefined;
};

export type FootballQuickInputEvent =
  | {
      type: 'START_RUSH';
      startedBy: 'hotkey' | 'button';
      hotkey?: 'R';
      intentId?: string;
      clientEventId?: string;
    }
  | {
      type: 'START_PASS';
      startedBy: 'hotkey' | 'button';
      hotkey?: 'P';
      intentId?: string;
      clientEventId?: string;
    }
  | {
      type: 'START_PUNT';
      startedBy: 'hotkey' | 'button';
      hotkey?: 'U';
      intentId?: string;
      clientEventId?: string;
    }
  | {
      type: 'START_KICK';
      startedBy: 'hotkey' | 'button';
      hotkey?: 'K';
      intentId?: string;
      clientEventId?: string;
    }
  | {
      type: 'START_PENALTY';
      startedBy: 'hotkey' | 'button';
      hotkey?: 'E';
      source?: PenaltySourceSelection;
      intentId?: string;
      clientEventId?: string;
    }
  | {
      type: 'START_GAME_CONTROL';
      startedBy: 'hotkey' | 'button';
      hotkey?: 'G';
      intentId?: string;
      clientEventId?: string;
    }
  | { type: 'INPUT_TOKEN'; value: string }
  | { type: 'COMMIT_TOKEN' }
  | { type: 'SELECT_DUPLICATE_PLAYER'; playerId: string }
  | { type: 'CANCEL_DUPLICATE' }
  | { type: 'ADD_TACKLER' }
  | { type: 'QUEUE_PENALTY_REQUEST' }
  | { type: 'GENERATE_SUMMARY' }
  | { type: 'EDIT_PLAY' }
  | { type: 'JUMP_TO_STEP'; stepId: string }
  | { type: 'CONFIRM_SUMMARY'; confirmedAt?: string; confirmedByUserId?: string }
  | { type: 'MARK_SUBMITTED' }
  | { type: 'CANCEL' };

export type FootballQuickInputTransitionResult = {
  state: FootballConfirmedQuickInputState;
};

export function createInitialFootballQuickInputState(): FootballConfirmedQuickInputState {
  return {
    status: 'idle',
    currentToken: '',
    tokens: initialTokens(),
  };
}

export function transitionFootballQuickInput(
  state: FootballConfirmedQuickInputState,
  event: FootballQuickInputEvent,
  context: FootballQuickInputContext,
): FootballQuickInputTransitionResult {
  if (event.type === 'CANCEL') {
    return { state: cancelledState() };
  }

  if (event.type === 'START_RUSH') {
    return {
      state: {
        status: 'token.awaiting',
        flow: 'rush',
        currentStep: 'rusherJersey',
        currentToken: '',
        tokens: initialTokens(),
      },
    };
  }

  if (event.type === 'START_PASS') {
    return {
      state: {
        status: 'token.awaiting',
        flow: 'pass',
        currentStep: 'passerJersey',
        currentToken: '',
        tokens: initialTokens(),
      },
    };
  }

  if (event.type === 'START_PUNT') {
    return {
      state: {
        status: 'token.awaiting',
        flow: 'punt',
        currentStep: 'punterJersey',
        currentToken: '',
        tokens: initialTokens(),
      },
    };
  }

  if (event.type === 'START_KICK') {
    return {
      state: {
        status: 'token.awaiting',
        flow: 'kick',
        currentStep: 'kickMenu',
        currentToken: '',
        tokens: initialTokens(),
      },
    };
  }

  if (event.type === 'START_PENALTY') {
    const source = event.source ?? (state.queuedPenaltyRequested || state.draft ? 'queued' : 'immediate');
    return {
      state: {
        ...cloneState(state),
        status: 'token.awaiting',
        flow: 'penalty',
        currentStep: 'penaltyName',
        currentToken: '',
        summary: undefined,
        buildResult: undefined,
        error: undefined,
        tokens: {
          ...initialTokens(),
          penaltySource: source,
        },
      },
    };
  }

  if (event.type === 'START_GAME_CONTROL') {
    return {
      state: {
        status: 'token.awaiting',
        flow: 'gameControl',
        currentStep: 'gameControlMenu',
        currentToken: '',
        tokens: initialTokens(),
      },
    };
  }

  if (event.type === 'INPUT_TOKEN') {
    if (!isTokenInputState(state)) return { state: cloneState(state) };
    return {
      state: {
        ...cloneState(state),
        status: 'token.awaiting',
        currentToken: event.value,
        error: undefined,
      },
    };
  }

  if (event.type === 'COMMIT_TOKEN') {
    return commitCurrentToken(state, context);
  }

  if (event.type === 'SELECT_DUPLICATE_PLAYER') {
    return selectDuplicatePlayer(state, event.playerId, context);
  }

  if (event.type === 'CANCEL_DUPLICATE') {
    if (state.status !== 'jersey.disambiguating' || !state.duplicate) return { state: cloneState(state) };
    return {
      state: {
        ...baseActiveState(state),
        status: 'token.awaiting',
        currentStep: stepForDuplicateRole(state.duplicate.role, state),
        currentToken: state.duplicate.jerseyToken,
        duplicate: undefined,
      },
    };
  }

  if (event.type === 'ADD_TACKLER') {
    if (!isActivePlayState(state)) return { state: cloneState(state) };
    return {
      state: {
        ...baseActiveState(state),
        status: 'token.awaiting',
        currentStep: 'tackleAJersey',
        currentToken: '',
      },
    };
  }

  if (event.type === 'QUEUE_PENALTY_REQUEST') {
    if (!isActivePlayState(state)) return { state: cloneState(state) };
    return {
      state: {
        ...baseActiveState(state),
        queuedPenaltyRequested: !state.queuedPenaltyRequested,
        error: state.queuedPenaltyRequested && state.error?.code === 'UNRESOLVED_QUEUED_PENALTY'
          ? undefined
          : state.error,
      },
    };
  }

  if (event.type === 'GENERATE_SUMMARY') {
    return generateSummary(state, context);
  }

  if (event.type === 'EDIT_PLAY') {
    return editPlay(state);
  }

  if (event.type === 'JUMP_TO_STEP') {
    return jumpToStep(state, event.stepId);
  }

  if (event.type === 'CONFIRM_SUMMARY') {
    return confirmSummary(state, event, context);
  }

  if (event.type === 'MARK_SUBMITTED') {
    if (state.status !== 'submitting.confirmed' || !state.buildResult?.ok) return { state: cloneState(state) };
    return {
      state: {
        ...cloneState(state),
        status: 'submitted',
      },
    };
  }

  return { state: cloneState(state) };
}

function commitCurrentToken(
  state: FootballConfirmedQuickInputState,
  context: FootballQuickInputContext,
): FootballQuickInputTransitionResult {
  if (state.status !== 'token.awaiting' && state.status !== 'token.error') {
    return { state: cloneState(state) };
  }

  if (!state.flow || !state.currentStep) {
    return { state: tokenError(state, 'INVALID_FLOW', 'No active token is awaiting commit') };
  }

  if (state.flow === 'pass' && isPassSpecificTokenStep(state.currentStep)) {
    return commitPassToken(state, context);
  }

  if (state.flow === 'punt' && isPuntSpecificTokenStep(state.currentStep)) {
    return commitPuntToken(state, context);
  }

  if (state.flow === 'kick' && isKickSpecificTokenStep(state.currentStep)) {
    return commitKickToken(state, context);
  }

  if (state.flow === 'penalty' && isPenaltySpecificTokenStep(state.currentStep)) {
    return commitPenaltyToken(state, context);
  }

  if (state.flow === 'gameControl' && isGameControlSpecificTokenStep(state.currentStep)) {
    return commitGameControlToken(state, context);
  }

  if (state.currentStep === 'rusherJersey') {
    return resolveJerseyToken(state, context, {
      role: 'rusher',
      teamScope: context.play.possession ?? context.play.actionTeam,
      actionContext: 'offense',
      nextStep: 'result',
    });
  }

  if (state.currentStep === 'result') {
    return commitRushResult(state);
  }

  if (state.currentStep === 'tacklerJersey' || state.currentStep === 'tackleAJersey' || state.currentStep === 'tackleBJersey') {
    return commitTacklerToken(state, context);
  }

  if (state.currentStep === 'forcedByJersey') {
    return resolveJerseyToken(state, context, {
      role: 'forcedBy',
      teamScope: opposingTeam(context.play.possession ?? context.play.actionTeam),
      actionContext: 'defense',
      nextStep: 'recoverTeam',
    });
  }

  if (state.currentStep === 'recoverTeam') {
    const recoverTeam = parseTeamCode(state.currentToken);
    if (!recoverTeam) {
      return { state: tokenError(state, 'INVALID_RECOVER_TEAM', 'Recovering team must be H or V', 'result.fumble.recoveredByTeam') };
    }
    return {
      state: {
        ...baseActiveState(state),
        status: 'token.awaiting',
        currentStep: 'recoverPlayerJersey',
        currentToken: '',
        tokens: {
          ...cloneTokens(state.tokens),
          recoverTeam,
        },
      },
    };
  }

  if (state.currentStep === 'recoverPlayerJersey') {
    if (!state.tokens.recoverTeam) {
      return { state: tokenError(state, 'MISSING_RECOVER_TEAM', 'Recovering team is required before recovery player', 'result.fumble.recoveredByTeam') };
    }
    return resolveJerseyToken(state, context, {
      role: 'recoverer',
      teamScope: state.tokens.recoverTeam,
      actionContext: state.tokens.recoverTeam === (context.play.possession ?? context.play.actionTeam) ? 'offense' : 'defense',
      nextStep: 'recoverSpot',
    });
  }

  if (state.currentStep === 'recoverSpot') {
    const recoverSpot = parseSpot(state.currentToken);
    if (!recoverSpot) {
      return { state: tokenError(state, 'INVALID_SPOT', 'Recovery spot must use canonical spot format', 'result.fumble.recoverySpot') };
    }

    return {
      state: {
        ...baseActiveState(state),
        status: 'token.awaiting',
        currentStep: 'fumbleReturned',
        currentToken: '',
        tokens: {
          ...cloneTokens(state.tokens),
          recoverSpot,
        },
      },
    };
  }

  if (state.currentStep === 'fumbleReturned') {
    const returned = parseBooleanToken(state.currentToken);
    if (returned === null) {
      return { state: tokenError(state, 'INVALID_RETURNED_FLAG', 'Returned must be yes/no', 'result.fumble.returned') };
    }

    if (returned) {
      return {
        state: tokenError(
          {
            ...baseActiveState(state),
            tokens: {
              ...cloneTokens(state.tokens),
              fumbleReturned: true,
              returnFlow: {
                type: 'Fumble',
                fromSpot: state.tokens.recoverSpot,
                status: 'blocked',
                reason: 'Return flow not implemented yet',
              },
            },
          },
          'RETURN_FLOW_NOT_IMPLEMENTED',
          'Return flow not implemented yet',
          'result.return',
        ),
      };
    }

    const readyState = makeReadyState({
      ...baseActiveState(state),
      tokens: {
        ...cloneTokens(state.tokens),
        fumbleReturned: false,
      },
    }, context);
    return { state: readyState };
  }

  if (state.currentStep === 'yards') {
    const yards = parseYards(state.currentToken);
    if (yards === null) {
      return { state: tokenError(state, 'INVALID_YARDS', 'Rush yards must be a number', 'result.yards') };
    }
    return {
      state: {
        ...baseActiveState(state),
        status: 'token.awaiting',
        currentStep: 'endSpot',
        currentToken: '',
        tokens: {
          ...cloneTokens(state.tokens),
          yards,
        },
      },
    };
  }

  if (state.currentStep === 'endSpot') {
    const endYardLine = parseSpot(state.currentToken);
    if (!endYardLine) {
      return { state: tokenError(state, 'INVALID_SPOT', 'End spot must use canonical spot format', 'result.endYardLine') };
    }
    const yards = state.tokens.yards ?? deriveRushYards(context, endYardLine);
    if (typeof yards !== 'number') {
      return {
        state: tokenError(
          state,
          'INVALID_YARDS_DERIVATION',
          'Rush yards could not be derived from the pre-play spot and end spot',
          'result.yards',
        ),
      };
    }

    const nextState = {
      ...baseActiveState(state),
      status: 'draft.ready' as const,
      currentStep: undefined,
      currentToken: '',
      tokens: {
        ...cloneTokens(state.tokens),
        yards,
        endYardLine,
      },
    };

    if (state.flow === 'pass' && state.tokens.completeResult === 'lateral') {
      return {
        state: tokenError(
          {
            ...baseActiveState(state),
            tokens: nextState.tokens,
          },
          'LATERAL_FLOW_NOT_IMPLEMENTED',
          'Lateral flow not implemented yet',
          'result.lateral',
        ),
      };
    }

    if (state.flow === 'pass' && state.tokens.completeResult === 'fumble') {
      return {
        state: {
          ...baseActiveState(state),
          status: 'token.awaiting',
          currentStep: 'forcedByJersey',
          currentToken: '',
          tokens: nextState.tokens,
        },
      };
    }

    return { state: makeReadyState(nextState, context) };
  }

  return { state: tokenError(state, 'UNSUPPORTED_TOKEN', `Unsupported token step: ${state.currentStep}`) };
}

function commitPassToken(
  state: FootballConfirmedQuickInputState,
  context: FootballQuickInputContext,
): FootballQuickInputTransitionResult {
  if (state.currentStep === 'passerJersey') {
    return resolveJerseyToken(state, context, {
      role: 'passer',
      teamScope: context.play.possession ?? context.play.actionTeam,
      actionContext: 'offense',
      nextStep: 'passResult',
    });
  }

  if (state.currentStep === 'passResult') {
    return commitPassPrimaryResult(state);
  }

  if (state.currentStep === 'receiverJersey') {
    return resolveJerseyToken(state, context, {
      role: 'receiver',
      teamScope: context.play.possession ?? context.play.actionTeam,
      actionContext: 'offense',
      nextStep: 'caughtAtSpot',
    });
  }

  if (state.currentStep === 'caughtAtSpot') {
    const spot = parseOptionalSpot(state.currentToken);
    if (spot === false) {
      return { state: tokenError(state, 'INVALID_SPOT', 'Caught At spot must use canonical spot format', 'result.pass.caughtAtYardLine') };
    }
    return {
      state: {
        ...baseActiveState(state),
        status: 'token.awaiting',
        currentStep: 'completeResult',
        currentToken: '',
        tokens: {
          ...cloneTokens(state.tokens),
          caughtAtSpot: spot || undefined,
        },
      },
    };
  }

  if (state.currentStep === 'completeResult') {
    return commitCompletePassResult(state);
  }

  if (state.currentStep === 'intendedReceiverJersey') {
    return resolveJerseyToken(state, context, {
      role: 'intendedReceiver',
      teamScope: context.play.possession ?? context.play.actionTeam,
      actionContext: 'offense',
      nextStep: 'passYardLine',
    });
  }

  if (state.currentStep === 'passYardLine') {
    const spot = parseOptionalSpot(state.currentToken);
    if (spot === false) {
      return { state: tokenError(state, 'INVALID_SPOT', 'Pass yardline must use canonical spot format', 'result.pass.intendedYardLine') };
    }
    return {
      state: {
        ...baseActiveState(state),
        status: 'token.awaiting',
        currentStep: 'brokenUp',
        currentToken: '',
        tokens: {
          ...cloneTokens(state.tokens),
          passYardLine: spot || undefined,
        },
      },
    };
  }

  if (state.currentStep === 'brokenUp') {
    const brokenUp = parseOptionalBooleanToken(state.currentToken);
    if (brokenUp === null) {
      return { state: tokenError(state, 'INVALID_BROKEN_UP_FLAG', 'Broken Up must be yes, no, or blank', 'result.pass.brokenUp') };
    }
    return {
      state: {
        ...baseActiveState(state),
        status: 'token.awaiting',
        currentStep: brokenUp ? 'brokenUpDefenderJersey' : 'hurried',
        currentToken: '',
        tokens: {
          ...cloneTokens(state.tokens),
          brokenUp,
        },
      },
    };
  }

  if (state.currentStep === 'brokenUpDefenderJersey') {
    if (!state.currentToken.trim()) {
      return { state: tokenError(state, 'MISSING_PASS_BREAKUP', 'Broken up requires exactly one defender', 'participants.defenders') };
    }
    return resolveJerseyToken(state, context, {
      role: 'passBreakup',
      teamScope: opposingTeam(context.play.possession ?? context.play.actionTeam),
      actionContext: 'defense',
      nextStep: 'hurried',
    });
  }

  if (state.currentStep === 'hurried') {
    const hurried = parseOptionalBooleanToken(state.currentToken);
    if (hurried === null) {
      return { state: tokenError(state, 'INVALID_HURRIED_FLAG', 'Hurried must be yes, no, or blank', 'result.pass.hurried') };
    }

    const tokens = {
      ...cloneTokens(state.tokens),
      hurried,
    };

    if (hurried) {
      return {
        state: {
          ...baseActiveState(state),
          status: 'token.awaiting',
          currentStep: 'hurryDefender1Jersey',
          currentToken: '',
          tokens,
        },
      };
    }

    if (state.tokens.passResult === 'interception') return blockInterceptionReturn(state, tokens);
    return { state: makeReadyState({ ...baseActiveState(state), tokens }, context) };
  }

  if (
    state.currentStep === 'hurryDefender1Jersey'
    || state.currentStep === 'hurryDefender2Jersey'
    || state.currentStep === 'hurryDefender3Jersey'
  ) {
    return commitHurryDefenderToken(state, context);
  }

  if (state.currentStep === 'sackDefenderAJersey' || state.currentStep === 'sackDefenderBJersey') {
    return commitSackDefenderToken(state, context);
  }

  if (state.currentStep === 'sackSpot') {
    const sackSpot = parseSpot(state.currentToken);
    if (!sackSpot) {
      return { state: tokenError(state, 'INVALID_SPOT', 'Sack yardline must use canonical spot format', 'result.endYardLine') };
    }
    const yards = deriveRushYards(context, sackSpot);
    const tokens = {
      ...cloneTokens(state.tokens),
      sackSpot,
      yards,
      endYardLine: sackSpot,
    };

    if (state.tokens.passResult === 'sackFumble') {
      return {
        state: {
          ...baseActiveState(state),
          status: 'token.awaiting',
          currentStep: 'recoverTeam',
          currentToken: '',
          tokens: {
            ...tokens,
            forcedBy: tokens.sackDefenders[0],
          },
        },
      };
    }

    return { state: makeReadyState({ ...baseActiveState(state), tokens }, context) };
  }

  return { state: tokenError(state, 'UNSUPPORTED_TOKEN', `Unsupported pass token step: ${state.currentStep}`) };
}

function commitPuntToken(
  state: FootballConfirmedQuickInputState,
  context: FootballQuickInputContext,
): FootballQuickInputTransitionResult {
  if (state.currentStep === 'punterJersey') {
    return resolveJerseyToken(state, context, {
      role: 'punter',
      teamScope: context.play.possession ?? context.play.actionTeam,
      actionContext: 'specialTeams',
      nextStep: 'puntSpot',
    });
  }

  if (state.currentStep === 'puntSpot') {
    const puntSpot = parseSpot(state.currentToken);
    if (!puntSpot) {
      return { state: tokenError(state, 'INVALID_SPOT', 'Punt received/dead-ball spot must use canonical spot format', 'result.kick.catchYardLine') };
    }
    return {
      state: {
        ...baseActiveState(state),
        status: 'token.awaiting',
        currentStep: 'puntReceiveResult',
        currentToken: '',
        tokens: {
          ...cloneTokens(state.tokens),
          puntSpot,
        },
      },
    };
  }

  if (state.currentStep === 'puntReceiveResult') {
    return commitPuntReceiveResult(state, context);
  }

  if (state.currentStep === 'returnerJersey') {
    return resolveJerseyToken(state, context, {
      role: 'returner',
      teamScope: opposingTeam(context.play.possession ?? context.play.actionTeam),
      actionContext: 'specialTeams',
      nextStep: state.tokens.puntReceiveResult === 'fairCatch' ? undefined : 'returnTerminalResult',
    });
  }

  if (state.currentStep === 'returnTerminalResult') {
    return commitReturnTerminalResult(state);
  }

  if (state.currentStep === 'returnTackleAJersey' || state.currentStep === 'returnTackleBJersey') {
    return commitReturnTacklerToken(state, context);
  }

  if (state.currentStep === 'returnEndSpot') {
    const returnEndSpot = parseSpot(state.currentToken);
    if (!returnEndSpot) {
      return { state: tokenError(state, 'INVALID_SPOT', 'Return final spot must use canonical spot format', 'result.return.returnEndYardLine') };
    }
    return {
      state: makeReadyState({
        ...baseActiveState(state),
        tokens: {
          ...cloneTokens(state.tokens),
          returnEndSpot,
        },
      }, context),
    };
  }

  if (state.currentStep === 'downingPlayerJersey') {
    const trimmed = state.currentToken.trim();
    if (!trimmed) {
      return {
        state: {
          ...baseActiveState(state),
          status: 'token.awaiting',
          currentStep: 'downedSpot',
          currentToken: '',
          tokens: cloneTokens(state.tokens),
        },
      };
    }

    return resolveJerseyToken(state, context, {
      role: 'downingPlayer',
      teamScope: context.play.possession ?? context.play.actionTeam,
      actionContext: 'specialTeams',
      nextStep: 'downedSpot',
    });
  }

  if (state.currentStep === 'downedSpot') {
    const downedSpot = parseSpot(state.currentToken);
    if (!downedSpot) {
      return { state: tokenError(state, 'INVALID_SPOT', 'Downed spot must use canonical spot format', 'result.endYardLine') };
    }
    return {
      state: makeReadyState({
        ...baseActiveState(state),
        tokens: {
          ...cloneTokens(state.tokens),
          downedSpot,
        },
      }, context),
    };
  }

  return { state: tokenError(state, 'UNSUPPORTED_TOKEN', `Unsupported punt token step: ${state.currentStep}`) };
}

function commitKickToken(
  state: FootballConfirmedQuickInputState,
  context: FootballQuickInputContext,
): FootballQuickInputTransitionResult {
  if (state.currentStep === 'kickMenu') {
    const selection = parseKickMenuSelection(state.currentToken);
    if (!selection) {
      return {
        state: tokenError(
          state,
          'INVALID_KICK_MENU_SELECTION',
          'Kick menu selection must be O, F, or A.',
          'play.subtype',
        ),
      };
    }

    return {
      state: {
        ...baseActiveState(state),
        status: 'token.awaiting',
        currentStep: selection === 'pat' ? 'patType' : 'kickerJersey',
        currentToken: '',
        tokens: {
          ...cloneTokens(state.tokens),
          kickMenuSelection: selection,
        },
      },
    };
  }

  if (state.currentStep === 'kickerJersey') {
    return resolveJerseyToken(state, context, {
      role: 'kicker',
      teamScope: context.play.possession ?? context.play.actionTeam,
      actionContext: 'specialTeams',
      nextStep: state.tokens.kickMenuSelection === 'fieldGoal'
        ? 'fieldGoalSpot'
        : state.tokens.kickMenuSelection === 'pat'
          ? 'patKickResult'
          : 'kickReceiveResult',
    });
  }

  if (state.currentStep === 'fieldGoalSpot') {
    const fieldGoalSpot = parseSpot(state.currentToken);
    if (!fieldGoalSpot) {
      return { state: tokenError(state, 'INVALID_SPOT', 'Field goal kick spot must use canonical spot format', 'result.kick.kickSpot') };
    }
    return {
      state: {
        ...baseActiveState(state),
        status: 'token.awaiting',
        currentStep: 'fieldGoalResult',
        currentToken: '',
        tokens: {
          ...cloneTokens(state.tokens),
          fieldGoalSpot,
        },
      },
    };
  }

  if (state.currentStep === 'fieldGoalResult') {
    return commitFieldGoalResult(state, context);
  }

  if (state.currentStep === 'fieldGoalMissedReason') {
    const fieldGoalMissedReason = parseKickMissedReason(state.currentToken);
    if (!fieldGoalMissedReason) {
      return { state: tokenError(state, 'INVALID_MISSED_REASON', 'Missed field goal reason must be R, L, S, E, I, or C.', 'result.kick.missedReason') };
    }
    return advanceAfterReturnEligibility({
      ...baseActiveState(state),
      tokens: {
        ...cloneTokens(state.tokens),
        fieldGoalMissedReason,
      },
    }, context, 'fieldGoal');
  }

  if (state.currentStep === 'fieldGoalBlockedByJersey') {
    return resolveJerseyToken(state, context, {
      role: 'blocker',
      teamScope: opposingTeam(context.play.possession ?? context.play.actionTeam),
      actionContext: 'defense',
      nextStep: context.game.rules?.fgReturn ? 'fieldGoalReturnAttempted' : undefined,
    });
  }

  if (state.currentStep === 'fieldGoalReturnAttempted') {
    return commitReturnAttempted(state, context, 'fieldGoal');
  }

  if (state.currentStep === 'patType') {
    return commitPatType(state);
  }

  if (state.currentStep === 'patKickResult') {
    return commitPatKickResult(state, context);
  }

  if (state.currentStep === 'patKickMissedReason') {
    const patKickMissedReason = parseKickMissedReason(state.currentToken);
    if (!patKickMissedReason) {
      return { state: tokenError(state, 'INVALID_MISSED_REASON', 'Missed PAT reason must be R, L, S, E, I, or C.', 'result.kick.missedReason') };
    }
    return {
      state: makeReadyState({
        ...baseActiveState(state),
        tokens: {
          ...cloneTokens(state.tokens),
          patKickMissedReason,
        },
      }, context),
    };
  }

  if (state.currentStep === 'patKickBlockedByJersey') {
    return resolveJerseyToken(state, context, {
      role: 'blocker',
      teamScope: opposingTeam(context.play.possession ?? context.play.actionTeam),
      actionContext: 'defense',
      nextStep: context.game.rules?.patReturns ? 'patKickReturnAttempted' : undefined,
    });
  }

  if (state.currentStep === 'patKickReturnAttempted') {
    return commitReturnAttempted(state, context, 'pat');
  }

  if (state.currentStep === 'patRusherJersey') {
    return resolveJerseyToken(state, context, {
      role: 'rusher',
      teamScope: context.play.possession ?? context.play.actionTeam,
      actionContext: 'offense',
      nextStep: 'patRushResult',
    });
  }

  if (state.currentStep === 'patRushResult') {
    return commitPatRushResult(state, context);
  }

  if (state.currentStep === 'patRushReturnAttempted') {
    return commitReturnAttempted(state, context, 'pat');
  }

  if (state.currentStep === 'patPasserJersey') {
    return resolveJerseyToken(state, context, {
      role: 'passer',
      teamScope: context.play.possession ?? context.play.actionTeam,
      actionContext: 'offense',
      nextStep: 'patReceiverJersey',
    });
  }

  if (state.currentStep === 'patReceiverJersey') {
    return resolveJerseyToken(state, context, {
      role: 'receiver',
      teamScope: context.play.possession ?? context.play.actionTeam,
      actionContext: 'offense',
      nextStep: 'patPassResult',
    });
  }

  if (state.currentStep === 'patPassResult') {
    return commitPatPassResult(state, context);
  }

  if (state.currentStep === 'patPassReturnAttempted') {
    return commitReturnAttempted(state, context, 'pat');
  }

  if (state.currentStep === 'kickReceiveResult') {
    return commitKickReceiveResult(state, context);
  }

  if (state.currentStep === 'returnerJersey') {
    return resolveJerseyToken(state, context, {
      role: 'returner',
      teamScope: opposingTeam(context.play.possession ?? context.play.actionTeam),
      actionContext: 'specialTeams',
      nextStep: state.tokens.kickReceiveResult === 'fairCatch' ? 'kickFairCatchSpot' : 'kickReturnStartSpot',
    });
  }

  if (state.currentStep === 'kickReturnStartSpot') {
    const kickReturnStartSpot = parseSpot(state.currentToken);
    if (!kickReturnStartSpot) {
      return { state: tokenError(state, 'INVALID_SPOT', 'Kick return start spot must use canonical spot format', 'result.kick.catchYardLine') };
    }
    return {
      state: {
        ...baseActiveState(state),
        status: 'token.awaiting',
        currentStep: 'returnTerminalResult',
        currentToken: '',
        tokens: {
          ...cloneTokens(state.tokens),
          kickReturnStartSpot,
        },
      },
    };
  }

  if (state.currentStep === 'returnTerminalResult') {
    return commitReturnTerminalResult(state);
  }

  if (state.currentStep === 'returnTackleAJersey' || state.currentStep === 'returnTackleBJersey') {
    return commitReturnTacklerToken(state, context);
  }

  if (state.currentStep === 'returnEndSpot') {
    const returnEndSpot = parseSpot(state.currentToken);
    if (!returnEndSpot) {
      return { state: tokenError(state, 'INVALID_SPOT', 'Return final spot must use canonical spot format', 'result.return.returnEndYardLine') };
    }
    return {
      state: makeReadyState({
        ...baseActiveState(state),
        tokens: {
          ...cloneTokens(state.tokens),
          returnEndSpot,
        },
      }, context),
    };
  }

  if (state.currentStep === 'kickTouchbackSpot') {
    const kickTouchbackSpot = parseSpot(state.currentToken);
    if (!kickTouchbackSpot) {
      return { state: tokenError(state, 'INVALID_SPOT', 'Touchback spot must use canonical spot format', 'result.endYardLine') };
    }
    return {
      state: makeReadyState({
        ...baseActiveState(state),
        tokens: {
          ...cloneTokens(state.tokens),
          kickTouchbackSpot,
        },
      }, context),
    };
  }

  if (state.currentStep === 'kickFairCatchSpot') {
    const kickFairCatchSpot = parseSpot(state.currentToken);
    if (!kickFairCatchSpot) {
      return { state: tokenError(state, 'INVALID_SPOT', 'Fair catch spot must use canonical spot format', 'result.kick.catchYardLine') };
    }
    return {
      state: makeReadyState({
        ...baseActiveState(state),
        tokens: {
          ...cloneTokens(state.tokens),
          kickFairCatchSpot,
        },
      }, context),
    };
  }

  if (state.currentStep === 'kickOutOfBoundsSpot') {
    const kickOutOfBoundsSpot = parseSpot(state.currentToken);
    if (!kickOutOfBoundsSpot) {
      return { state: tokenError(state, 'INVALID_SPOT', 'Out-of-bounds spot must use canonical spot format', 'result.endYardLine') };
    }
    return {
      state: makeReadyState({
        ...baseActiveState(state),
        tokens: {
          ...cloneTokens(state.tokens),
          kickOutOfBoundsSpot,
        },
      }, context),
    };
  }

  return { state: tokenError(state, 'UNSUPPORTED_TOKEN', `Unsupported kick token step: ${state.currentStep}`) };
}

function commitPenaltyToken(
  state: FootballConfirmedQuickInputState,
  context: FootballQuickInputContext,
): FootballQuickInputTransitionResult {
  if (state.currentStep === 'penaltyName') {
    const selection = resolvePenaltySelection(state.currentToken);
    if (!selection) {
      return { state: tokenError(state, 'MISSING_PENALTY_NAME', 'Penalty name is required', 'penalties.name') };
    }
    return {
      state: {
        ...baseActiveState(state),
        status: 'token.awaiting',
        currentStep: 'penaltyTeam',
        currentToken: '',
        tokens: {
          ...cloneTokens(state.tokens),
          penaltyName: selection.name,
          penaltyCode: selection.code,
          penaltyDefinition: selection.definition,
        },
      },
    };
  }

  if (state.currentStep === 'penaltyTeam') {
    const team = parseTeamCode(state.currentToken);
    if (!team) {
      return { state: tokenError(state, 'INVALID_PENALTY_TEAM', 'Penalty team must be H or V', 'penalties.team') };
    }
    return {
      state: {
        ...baseActiveState(state),
        status: 'token.awaiting',
        currentStep: 'penaltyResolution',
        currentToken: '',
        tokens: {
          ...cloneTokens(state.tokens),
          penaltyTeam: team,
        },
      },
    };
  }

  if (state.currentStep === 'penaltyResolution') {
    const resolution = parsePenaltyResolution(state.currentToken);
    if (!resolution) {
      return { state: tokenError(state, 'INVALID_PENALTY_RESOLUTION', 'Penalty resolution must be A, D, or O.', 'penalties.status') };
    }
    const tokens = {
      ...cloneTokens(state.tokens),
      penaltyResolution: resolution,
    };
    if (resolution === 'declined') return finalizePenaltyEntry({ ...baseActiveState(state), tokens }, context);
    if (resolution === 'offsetting') {
      return {
        state: {
          ...baseActiveState(state),
          status: 'token.awaiting',
          currentStep: 'offsettingSecondName',
          currentToken: '',
          tokens,
        },
      };
    }
    return {
      state: {
        ...baseActiveState(state),
        status: 'token.awaiting',
        currentStep: 'penaltyPlayerJersey',
        currentToken: '',
        tokens,
      },
    };
  }

  if (state.currentStep === 'penaltyPlayerJersey') {
    const source = state.tokens.penaltySource ?? 'immediate';
    const defaultEnforcedFrom = source === 'immediate'
      ? 'PREVIOUS'
      : defaultPenaltyEnforcement(state.tokens.penaltyDefinition);
    const defaultDownConsequence = source === 'immediate'
      ? 'REPEAT'
      : defaultPenaltyDownConsequence(state.tokens.penaltyDefinition);
    const nextStep = source === 'immediate' ? 'penaltyFinalSpot' : 'penaltyEnforcedFrom';
    const nextTokens = {
      ...cloneTokens(state.tokens),
      penaltyEnforcedFrom: defaultEnforcedFrom,
      penaltyDownConsequence: defaultDownConsequence,
    };
    const nextToken = nextStep === 'penaltyEnforcedFrom'
      ? penaltyEnforcedFromInputCode(defaultEnforcedFrom)
      : suggestedPenaltyFinalSpot(context, nextTokens, state.draft) ?? '';
    const trimmed = state.currentToken.trim();
    if (!trimmed) {
      return {
        state: {
          ...baseActiveState(state),
          status: 'token.awaiting',
          currentStep: nextStep,
          currentToken: nextToken,
          tokens: nextTokens,
        },
      };
    }
    return resolveJerseyToken(state, context, {
      role: 'penalizedPlayer',
      teamScope: state.tokens.penaltyTeam ?? context.play.actionTeam,
      actionContext: 'penalty',
      nextStep,
    });
  }

  if (state.currentStep === 'penaltyEnforcedFrom') {
    const enforcedFrom = parsePenaltyEnforcedFrom(state.currentToken);
    if (!enforcedFrom) {
      return { state: tokenError(state, 'INVALID_ENFORCED_FROM', 'Enforced From must be P, F, or S.', 'penalties.enforcedFrom') };
    }
    const nextTokens = {
      ...cloneTokens(state.tokens),
      penaltyEnforcedFrom: enforcedFrom,
    };
    const nextStep = enforcedFrom === 'SPOT' ? 'penaltySpotOfFoul' : 'penaltyFinalSpot';
    return {
      state: {
        ...baseActiveState(state),
        status: 'token.awaiting',
        currentStep: nextStep,
        currentToken: nextStep === 'penaltyFinalSpot'
          ? suggestedPenaltyFinalSpot(context, nextTokens, state.draft) ?? ''
          : '',
        tokens: nextTokens,
      },
    };
  }

  if (state.currentStep === 'penaltySpotOfFoul') {
    const spotOfFoul = parseSpot(state.currentToken);
    if (!spotOfFoul) {
      return { state: tokenError(state, 'INVALID_SPOT_OF_FOUL', 'Spot of foul must use canonical spot format', 'penalties.spotOfFoul') };
    }
    return {
      state: {
        ...baseActiveState(state),
        status: 'token.awaiting',
        currentStep: 'penaltyFinalSpot',
        currentToken: suggestedPenaltyFinalSpot(context, {
          ...cloneTokens(state.tokens),
          penaltySpotOfFoul: spotOfFoul,
        }, state.draft) ?? '',
        tokens: {
          ...cloneTokens(state.tokens),
          penaltySpotOfFoul: spotOfFoul,
        },
      },
    };
  }

  if (state.currentStep === 'penaltyFinalSpot') {
    const finalSpot = parseSpot(state.currentToken);
    if (!finalSpot) {
      return { state: tokenError(state, 'INVALID_PENALTY_FINAL_SPOT', 'Penalty final spot must use canonical spot format', 'penalties.finalSpot') };
    }
    const source = state.tokens.penaltySource ?? 'immediate';
    const nextState = {
      ...baseActiveState(state),
      tokens: {
        ...cloneTokens(state.tokens),
        penaltyFinalSpot: finalSpot,
      },
    };
    if (source === 'immediate') return finalizePenaltyEntry(nextState, context);
    const downDefault = penaltyDownInputCode(nextState.tokens.penaltyDownConsequence ?? defaultPenaltyDownConsequence(nextState.tokens.penaltyDefinition));
    return {
      state: {
        ...nextState,
        status: 'token.awaiting',
        currentStep: 'penaltyDown',
        currentToken: downDefault,
      },
    };
  }

  if (state.currentStep === 'penaltyDown') {
    const downConsequence = parsePenaltyDownConsequence(state.currentToken);
    if (!downConsequence) {
      return { state: tokenError(state, 'INVALID_DOWN_CONSEQUENCE', 'Down must be R, L, or A.', 'penalties.downConsequence') };
    }
    return finalizePenaltyEntry({
      ...baseActiveState(state),
      tokens: {
        ...cloneTokens(state.tokens),
        penaltyDownConsequence: downConsequence,
      },
    }, context);
  }

  if (state.currentStep === 'offsettingSecondName') {
    const selection = resolvePenaltySelection(state.currentToken);
    if (!selection) {
      return { state: tokenError(state, 'MISSING_OFFSETTING_PENALTY_NAME', 'Matching offsetting penalty name is required', 'penalties.1.name') };
    }
    return {
      state: {
        ...baseActiveState(state),
        status: 'token.awaiting',
        currentStep: 'offsettingSecondTeam',
        currentToken: '',
        tokens: {
          ...cloneTokens(state.tokens),
          offsettingSecondName: selection.name,
          offsettingSecondCode: selection.code,
          offsettingSecondDefinition: selection.definition,
        },
      },
    };
  }

  if (state.currentStep === 'offsettingSecondTeam') {
    const team = parseTeamCode(state.currentToken);
    if (!team) {
      return { state: tokenError(state, 'INVALID_OFFSETTING_TEAM', 'Matching offsetting penalty team must be H or V', 'penalties.1.team') };
    }
    return {
      state: {
        ...baseActiveState(state),
        status: 'token.awaiting',
        currentStep: 'offsettingPlayCounts',
        currentToken: '',
        tokens: {
          ...cloneTokens(state.tokens),
          offsettingSecondTeam: team,
        },
      },
    };
  }

  if (state.currentStep === 'offsettingPlayCounts') {
    const previousPlayCounts = parseBooleanToken(state.currentToken);
    if (previousPlayCounts === null) {
      return { state: tokenError(state, 'MISSING_OFFSETTING_PLAY_COUNTS', 'Does the previous play count? Enter Y or N.', 'penalties.offsetting.previousPlayCounts') };
    }
    return finalizePenaltyEntry({
      ...baseActiveState(state),
      tokens: {
        ...cloneTokens(state.tokens),
        offsettingPreviousPlayCounts: previousPlayCounts,
      },
    }, context);
  }

  return { state: tokenError(state, 'UNSUPPORTED_TOKEN', `Unsupported penalty token step: ${state.currentStep}`) };
}

function commitGameControlToken(
  state: FootballConfirmedQuickInputState,
  context: FootballQuickInputContext,
): FootballQuickInputTransitionResult {
  if (state.currentStep === 'gameControlMenu') {
    const selection = parseGameControlMenuSelection(state.currentToken);
    if (!selection) {
      return {
        state: tokenError(
          state,
          'INVALID_GAME_CONTROL_SELECTION',
          'Game Control selection must be E, Q, B, D, P, C, or R.',
          'play.subtype',
        ),
      };
    }

    if (selection === 'emergency') {
      return gameControlBlocked(state, selection, 'EMERGENCY_NOT_IMPLEMENTED', 'Emergency controls not implemented yet');
    }

    if (selection === 'roster') {
      return gameControlBlocked(state, selection, 'ROSTER_FUNCTIONS_NOT_IMPLEMENTED', 'Roster functions not implemented yet');
    }

    if (selection === 'driveStart') {
      return gameControlBlocked(state, selection, 'DRIVE_START_CONTROL_NOT_IMPLEMENTED', 'Drive start control submit not implemented yet');
    }

    if (selection === 'coinToss') {
      return gameControlBlocked(state, selection, 'COIN_TOSS_NOT_IMPLEMENTED', 'Coin toss flow not implemented yet');
    }

    if (selection === 'quarter') {
      return {
        state: {
          ...baseActiveState(state),
          status: 'token.awaiting',
          currentStep: 'gameControlQuarterMenu',
          currentToken: '',
          tokens: {
            ...cloneTokens(state.tokens),
            gameControlSelection: selection,
          },
        },
      };
    }

    if (selection === 'setPossession') {
      return {
        state: {
          ...baseActiveState(state),
          status: 'token.awaiting',
          currentStep: 'gameControlPossession',
          currentToken: '',
          tokens: {
            ...cloneTokens(state.tokens),
            gameControlSelection: selection,
          },
        },
      };
    }

    return {
      state: {
        ...baseActiveState(state),
        status: 'token.awaiting',
        currentStep: 'gameControlDown',
        currentToken: context.prePlay.down ? String(context.prePlay.down) : '',
        tokens: {
          ...cloneTokens(state.tokens),
          gameControlSelection: selection,
        },
      },
    };
  }

  if (state.currentStep === 'gameControlQuarterMenu') {
    const selection = parseGameControlQuarterSelection(state.currentToken);
    if (!selection) {
      return {
        state: tokenError(
          state,
          'INVALID_QUARTER_FUNCTION_SELECTION',
          'Quarter Function selection must be S or E.',
          'play.subtype',
        ),
      };
    }

    return gameControlBlocked(
      {
        ...baseActiveState(state),
        tokens: {
          ...cloneTokens(state.tokens),
          gameControlQuarterSelection: selection,
        },
      },
      'quarter',
      selection === 'startQuarter' ? 'START_QUARTER_CONTROL_NOT_IMPLEMENTED' : 'END_QUARTER_CONTROL_NOT_IMPLEMENTED',
      selection === 'startQuarter'
        ? 'Start quarter control submit not implemented yet'
        : 'End quarter control submit not implemented yet',
    );
  }

  if (state.currentStep === 'gameControlDown') {
    const down = parseDown(state.currentToken);
    if (down === null) {
      return { state: tokenError(state, 'INVALID_DOWN', 'Down must be 1, 2, 3, or 4.', 'prePlay.down') };
    }

    return {
      state: {
        ...baseActiveState(state),
        status: 'token.awaiting',
        currentStep: 'gameControlDistance',
        currentToken: typeof context.prePlay.distance === 'number' ? String(context.prePlay.distance) : '',
        tokens: {
          ...cloneTokens(state.tokens),
          gameControlDown: down,
        },
      },
    };
  }

  if (state.currentStep === 'gameControlDistance') {
    const distance = parseNonNegativeInteger(state.currentToken);
    if (distance === null) {
      return { state: tokenError(state, 'INVALID_DISTANCE', 'Distance must be a non-negative number.', 'prePlay.distance') };
    }

    return {
      state: {
        ...baseActiveState(state),
        status: 'token.awaiting',
        currentStep: 'gameControlSpot',
        currentToken: context.prePlay.yardLine ?? '',
        tokens: {
          ...cloneTokens(state.tokens),
          gameControlDistance: distance,
        },
      },
    };
  }

  if (state.currentStep === 'gameControlSpot') {
    const spot = parseSpot(state.currentToken);
    if (!spot) {
      return { state: tokenError(state, 'INVALID_SPOT', 'Ball context spot must use canonical spot format.', 'prePlay.yardLine') };
    }

    const lineToGain = deriveLineToGain(
      spot,
      state.tokens.gameControlDistance ?? 0,
      context.play.possession ?? context.play.actionTeam,
    );
    const tokens = {
      ...cloneTokens(state.tokens),
      gameControlSpot: spot,
      gameControlLineToGain: lineToGain,
    };

    return {
      state: tokenError(
        {
          ...baseActiveState(state),
          tokens,
        },
        'BALL_CONTEXT_CONTROL_NOT_IMPLEMENTED',
        `Ball context control submit not implemented yet${lineToGain ? `. Line to gain: ${lineToGain}` : ''}`,
        'play.subtype',
      ),
    };
  }

  if (state.currentStep === 'gameControlPossession') {
    const team = parseTeamCode(state.currentToken);
    if (!team) {
      return { state: tokenError(state, 'INVALID_POSSESSION_TEAM', 'Possession team must be H or V.', 'play.possession') };
    }

    return {
      state: tokenError(
        {
          ...baseActiveState(state),
          tokens: {
            ...cloneTokens(state.tokens),
            gameControlPossession: team,
          },
        },
        'SET_POSSESSION_CONTROL_NOT_IMPLEMENTED',
        'Set possession control submit not implemented yet',
        'play.possession',
      ),
    };
  }

  return { state: tokenError(state, 'UNSUPPORTED_TOKEN', `Unsupported game control token step: ${state.currentStep}`) };
}

function gameControlBlocked(
  state: FootballConfirmedQuickInputState,
  selection: GameControlMenuSelection,
  code: string,
  message: string,
): FootballQuickInputTransitionResult {
  return {
    state: tokenError(
      {
        ...baseActiveState(state),
        tokens: {
          ...cloneTokens(state.tokens),
          gameControlSelection: selection,
        },
      },
      code,
      message,
      'play.subtype',
    ),
  };
}

function resolveJerseyToken(
  state: FootballConfirmedQuickInputState,
  context: FootballQuickInputContext,
  options: {
    role: FootballQuickInputDuplicateResolution['role'];
    teamScope: TeamCode;
    actionContext: 'offense' | 'defense' | 'specialTeams' | 'penalty';
    nextStep?: FootballTokenStep;
  },
): FootballQuickInputTransitionResult {
  const resolution = resolvePlayerByJersey({
    jerseyToken: state.currentToken,
    teamScope: options.teamScope,
    actionContext: options.actionContext,
    roster: context.roster,
  });

  if (resolution.kind === 'error') {
    return { state: tokenError(state, resolution.error.code, resolution.error.message) };
  }

  if (resolution.kind === 'duplicate') {
    return {
      state: {
        ...baseActiveState(state),
        status: 'jersey.disambiguating',
        duplicate: {
          role: options.role,
          jerseyToken: resolution.jerseyToken,
          teamScope: resolution.teamScope,
          actionContext: options.actionContext,
          candidates: resolution.candidates,
          recommended: resolution.recommended,
          recommendedPlayerId: resolution.recommended.playerId,
        },
      },
    };
  }

  const participant = participantFromCandidate(resolution.player, {
    role: options.role,
    resolution: resolution.resolution,
  });

  return {
    state: advanceAfterPlayerCommit(state, participant, options.role, options.nextStep, context),
  };
}

function selectDuplicatePlayer(
  state: FootballConfirmedQuickInputState,
  playerId: string,
  context: FootballQuickInputContext,
): FootballQuickInputTransitionResult {
  if (state.status !== 'jersey.disambiguating' || !state.duplicate) {
    return { state: cloneState(state) };
  }

  const selected = state.duplicate.candidates.find((candidate) => candidate.playerId === playerId);
  if (!selected) {
    return {
      state: {
        ...cloneState(state),
        status: 'token.error',
        error: {
          code: 'INVALID_DUPLICATE_SELECTION',
          message: 'Selected player is not one of the duplicate jersey candidates',
        },
      },
    };
  }

  const duplicateCandidateIds = state.duplicate.candidates.map((candidate) => candidate.playerId);
  const resolution = createDraftPlayerResolution({
    source: 'duplicateConfirmed',
    jerseyToken: state.duplicate.jerseyToken,
    teamScope: state.duplicate.teamScope,
    actionContext: state.duplicate.actionContext,
    duplicateCandidateIds,
    recommendedPlayerId: state.duplicate.recommendedPlayerId,
    selectedRecommended: selected.playerId === state.duplicate.recommendedPlayerId,
  });
  const participant = participantFromCandidate(selected, {
    role: state.duplicate.role,
    resolution,
  });
  const duplicateNextStep = nextStepAfterDuplicate(state.duplicate.role, state);

  return {
    state: advanceAfterPlayerCommit(state, participant, state.duplicate.role, duplicateNextStep, context),
  };
}

function commitRushResult(state: FootballConfirmedQuickInputState): FootballQuickInputTransitionResult {
  const result = parseRushResult(state.currentToken);
  if (!result) {
    return {
      state: tokenError(
        state,
        'INVALID_RUSH_RESULT',
        'Rush result must be T, O, F, C, or .',
        'result.code',
      ),
    };
  }

  if (result === 'lateral') {
    return {
      state: tokenError(
        {
          ...baseActiveState(state),
          tokens: {
            ...cloneTokens(state.tokens),
            result,
          },
        },
        'LATERAL_FLOW_NOT_IMPLEMENTED',
        'Lateral flow not implemented yet',
        'result.lateral',
      ),
    };
  }

  return {
    state: {
      ...baseActiveState(state),
      status: 'token.awaiting',
      currentStep: nextStepForRushResult(result),
      currentToken: '',
      tokens: {
        ...cloneTokens(state.tokens),
        result,
      },
    },
  };
}

function commitPassPrimaryResult(state: FootballConfirmedQuickInputState): FootballQuickInputTransitionResult {
  const result = parsePassPrimaryResult(state.currentToken);
  if (!result) {
    return {
      state: tokenError(
        state,
        'INVALID_PASS_RESULT',
        'Pass result must be C, I, S, F, R, or X.',
        'result.code',
      ),
    };
  }

  if (result === 'rushConversion') {
    if (!state.tokens.passer) {
      return { state: tokenError(state, 'MISSING_PASSER', 'Rush conversion requires a resolved passer', 'participants.primary') };
    }
    return {
      state: {
        ...baseActiveState(state),
        flow: 'rush',
        status: 'token.awaiting',
        currentStep: 'result',
        currentToken: '',
        tokens: {
          ...initialTokens(),
          rusher: {
            ...cloneParticipant(state.tokens.passer),
            role: 'rusher',
            participantId: `rusher-${state.tokens.passer.playerId}`,
          },
        },
        draft: undefined,
        summary: undefined,
        buildResult: undefined,
      },
    };
  }

  return {
    state: {
      ...baseActiveState(state),
      status: 'token.awaiting',
      currentStep: nextStepForPassResult(result),
      currentToken: '',
      tokens: {
        ...cloneTokens(state.tokens),
        passResult: result,
      },
    },
  };
}

function commitCompletePassResult(state: FootballConfirmedQuickInputState): FootballQuickInputTransitionResult {
  const result = parseCompletePassResult(state.currentToken);
  if (!result) {
    return {
      state: tokenError(
        state,
        'INVALID_COMPLETE_PASS_RESULT',
        'Complete result must be T, O, F, C, or .',
        'result.pass.completeResultCode',
      ),
    };
  }

  return {
    state: {
      ...baseActiveState(state),
      status: 'token.awaiting',
      currentStep: nextStepForCompletePassResult(result),
      currentToken: '',
      tokens: {
        ...cloneTokens(state.tokens),
        completeResult: result,
      },
    },
  };
}

function commitPuntReceiveResult(
  state: FootballConfirmedQuickInputState,
  context: FootballQuickInputContext,
): FootballQuickInputTransitionResult {
  const result = parsePuntReceiveResult(state.currentToken);
  if (!result) {
    return {
      state: tokenError(
        state,
        'INVALID_PUNT_RECEIVE_RESULT',
        'Punt receive result must be R, T, C, O, M, or D.',
        'result.kick.receiveResultCode',
      ),
    };
  }

  const tokens = {
    ...cloneTokens(state.tokens),
    puntReceiveResult: result,
  };

  if (result === 'muffed') {
    return {
      state: tokenError(
        {
          ...baseActiveState(state),
          tokens,
        },
        'MUFFED_PUNT_NOT_IMPLEMENTED',
        'Muffed punt flow not implemented yet',
        'result.kick.receiveResultCode',
      ),
    };
  }

  if (result === 'return' || result === 'fairCatch') {
    return {
      state: {
        ...baseActiveState(state),
        status: 'token.awaiting',
        currentStep: 'returnerJersey',
        currentToken: '',
        tokens,
      },
    };
  }

  if (result === 'downed') {
    return {
      state: {
        ...baseActiveState(state),
        status: 'token.awaiting',
        currentStep: 'downingPlayerJersey',
        currentToken: '',
        tokens,
      },
    };
  }

  return { state: makeReadyState({ ...baseActiveState(state), tokens }, context) };
}

function commitKickReceiveResult(
  state: FootballConfirmedQuickInputState,
  context: FootballQuickInputContext,
): FootballQuickInputTransitionResult {
  const result = parsePuntReceiveResult(state.currentToken);
  if (!result) {
    return {
      state: tokenError(
        state,
        'INVALID_KICK_RECEIVE_RESULT',
        'Kick receive result must be R, T, C, O, M, or D.',
        'result.kick.receiveResultCode',
      ),
    };
  }

  const tokens = {
    ...cloneTokens(state.tokens),
    kickReceiveResult: result,
  };

  if (result === 'muffed') {
    return {
      state: tokenError(
        {
          ...baseActiveState(state),
          tokens,
        },
        'MUFFED_KICKOFF_NOT_IMPLEMENTED',
        'Muffed kickoff/free kick flow not implemented yet',
        'result.kick.receiveResultCode',
      ),
    };
  }

  if (result === 'downed') {
    return {
      state: tokenError(
        {
          ...baseActiveState(state),
          tokens,
        },
        'DOWNED_KICKOFF_NOT_IMPLEMENTED',
        'Downed kickoff/free kick flow not implemented yet',
        'result.kick.receiveResultCode',
      ),
    };
  }

  if (result === 'return' || result === 'fairCatch') {
    return {
      state: {
        ...baseActiveState(state),
        status: 'token.awaiting',
        currentStep: 'returnerJersey',
        currentToken: '',
        tokens,
      },
    };
  }

  if (result === 'touchback') {
    if (context.game.rules?.touchbackSpot) {
      return {
        state: makeReadyState({
          ...baseActiveState(state),
          tokens: {
            ...tokens,
            kickTouchbackSpot: context.game.rules.touchbackSpot,
          },
        }, context),
      };
    }

    return {
      state: {
        ...baseActiveState(state),
        status: 'token.awaiting',
        currentStep: 'kickTouchbackSpot',
        currentToken: '',
        tokens,
      },
    };
  }

  return {
    state: {
      ...baseActiveState(state),
      status: 'token.awaiting',
      currentStep: 'kickOutOfBoundsSpot',
      currentToken: '',
      tokens,
    },
  };
}

function commitFieldGoalResult(
  state: FootballConfirmedQuickInputState,
  context: FootballQuickInputContext,
): FootballQuickInputTransitionResult {
  const result = parseFieldGoalResult(state.currentToken);
  if (!result) {
    return { state: tokenError(state, 'INVALID_FIELD_GOAL_RESULT', 'Field goal result must be G, M, or B.', 'result.code') };
  }

  const tokens = {
    ...cloneTokens(state.tokens),
    fieldGoalResult: result,
  };

  if (result === 'good') {
    return { state: makeReadyState({ ...baseActiveState(state), tokens }, context) };
  }

  if (result === 'missed') {
    return {
      state: {
        ...baseActiveState(state),
        status: 'token.awaiting',
        currentStep: 'fieldGoalMissedReason',
        currentToken: '',
        tokens,
      },
    };
  }

  return {
    state: {
      ...baseActiveState(state),
      status: 'token.awaiting',
      currentStep: 'fieldGoalBlockedByJersey',
      currentToken: '',
      tokens,
    },
  };
}

function commitPatType(state: FootballConfirmedQuickInputState): FootballQuickInputTransitionResult {
  const patType = parsePatType(state.currentToken);
  if (!patType) {
    return { state: tokenError(state, 'INVALID_PAT_TYPE', 'PAT type must be R, P, or K.', 'play.subtype') };
  }

  const nextStep: FootballTokenStep = patType === 'kick'
    ? 'kickerJersey'
    : patType === 'rush'
      ? 'patRusherJersey'
      : 'patPasserJersey';

  return {
    state: {
      ...baseActiveState(state),
      status: 'token.awaiting',
      currentStep: nextStep,
      currentToken: '',
      tokens: {
        ...cloneTokens(state.tokens),
        patType,
      },
    },
  };
}

function commitPatKickResult(
  state: FootballConfirmedQuickInputState,
  context: FootballQuickInputContext,
): FootballQuickInputTransitionResult {
  const result = parsePatKickResult(state.currentToken);
  if (!result) {
    return { state: tokenError(state, 'INVALID_PAT_KICK_RESULT', 'Kick PAT result must be G, M, or B.', 'result.code') };
  }

  const tokens = {
    ...cloneTokens(state.tokens),
    patKickResult: result,
  };

  if (result === 'good') {
    return { state: makeReadyState({ ...baseActiveState(state), tokens }, context) };
  }

  if (result === 'missed') {
    return {
      state: {
        ...baseActiveState(state),
        status: 'token.awaiting',
        currentStep: 'patKickMissedReason',
        currentToken: '',
        tokens,
      },
    };
  }

  return {
    state: {
      ...baseActiveState(state),
      status: 'token.awaiting',
      currentStep: 'patKickBlockedByJersey',
      currentToken: '',
      tokens,
    },
  };
}

function commitPatRushResult(
  state: FootballConfirmedQuickInputState,
  context: FootballQuickInputContext,
): FootballQuickInputTransitionResult {
  const result = parsePatRushResult(state.currentToken);
  if (!result) {
    return { state: tokenError(state, 'INVALID_PAT_RUSH_RESULT', 'Rush PAT result must be G, M, or F.', 'result.code') };
  }

  const nextState = {
    ...baseActiveState(state),
    tokens: {
      ...cloneTokens(state.tokens),
      patRushResult: result,
    },
  };

  if (result === 'fumbled' && context.game.rules?.patReturns) {
    return {
      state: {
        ...nextState,
        status: 'token.awaiting',
        currentStep: 'patRushReturnAttempted',
        currentToken: '',
      },
    };
  }

  return { state: makeReadyState(nextState, context) };
}

function commitPatPassResult(
  state: FootballConfirmedQuickInputState,
  context: FootballQuickInputContext,
): FootballQuickInputTransitionResult {
  const result = parsePatPassResult(state.currentToken);
  if (!result) {
    return { state: tokenError(state, 'INVALID_PAT_PASS_RESULT', 'Pass PAT result must be G, M, I, X, or F.', 'result.code') };
  }

  const nextState = {
    ...baseActiveState(state),
    tokens: {
      ...cloneTokens(state.tokens),
      patPassResult: result,
    },
  };

  if ((result === 'intercepted' || result === 'fumbled') && context.game.rules?.patReturns) {
    return {
      state: {
        ...nextState,
        status: 'token.awaiting',
        currentStep: 'patPassReturnAttempted',
        currentToken: '',
      },
    };
  }

  return { state: makeReadyState(nextState, context) };
}

function advanceAfterReturnEligibility(
  state: FootballConfirmedQuickInputState,
  context: FootballQuickInputContext,
  kind: 'fieldGoal',
): FootballQuickInputTransitionResult {
  if (kind === 'fieldGoal' && context.game.rules?.fgReturn) {
    return {
      state: {
        ...state,
        status: 'token.awaiting',
        currentStep: 'fieldGoalReturnAttempted',
        currentToken: '',
      },
    };
  }

  return { state: makeReadyState(state, context) };
}

function commitReturnAttempted(
  state: FootballConfirmedQuickInputState,
  context: FootballQuickInputContext,
  kind: 'fieldGoal' | 'pat',
): FootballQuickInputTransitionResult {
  const attempted = parseBooleanToken(state.currentToken);
  if (attempted === null) {
    return { state: tokenError(state, 'INVALID_RETURN_ATTEMPTED', 'Return Attempted must be yes or no.', 'result.return') };
  }

  const tokens = {
    ...cloneTokens(state.tokens),
    ...(kind === 'fieldGoal'
      ? { fieldGoalReturnAttempted: attempted }
      : state.currentStep === 'patKickReturnAttempted'
        ? { patKickReturnAttempted: attempted }
        : state.currentStep === 'patRushReturnAttempted'
          ? { patRushReturnAttempted: attempted }
          : { patPassReturnAttempted: attempted }),
  };

  if (attempted) {
    return {
      state: tokenError(
        {
          ...baseActiveState(state),
          tokens,
        },
        kind === 'fieldGoal' ? 'FIELD_GOAL_RETURN_NOT_IMPLEMENTED' : 'PAT_RETURN_NOT_IMPLEMENTED',
        kind === 'fieldGoal' ? 'Field goal return not implemented yet' : 'PAT return not implemented yet',
        'result.return',
      ),
    };
  }

  return { state: makeReadyState({ ...baseActiveState(state), tokens }, context) };
}

function commitReturnTerminalResult(state: FootballConfirmedQuickInputState): FootballQuickInputTransitionResult {
  const result = parseReturnTerminalResult(state.currentToken);
  if (!result) {
    return {
      state: tokenError(
        state,
        'INVALID_RETURN_TERMINAL_RESULT',
        'Return terminal result must be T, O, F, C, or .',
        'result.return.resultCode',
      ),
    };
  }

  const tokens = {
    ...cloneTokens(state.tokens),
    returnTerminalResult: result,
  };

  if (result === 'fumble') {
    return {
      state: tokenError(
        {
          ...baseActiveState(state),
          tokens,
        },
        'FUMBLE_RETURN_NOT_IMPLEMENTED',
        'Fumble return not implemented yet',
        'result.return',
      ),
    };
  }

  if (result === 'lateral') {
    return {
      state: tokenError(
        {
          ...baseActiveState(state),
          tokens,
        },
        'LATERAL_FLOW_NOT_IMPLEMENTED',
        'Lateral flow not implemented yet',
        'result.lateral',
      ),
    };
  }

  return {
    state: {
      ...baseActiveState(state),
      status: 'token.awaiting',
      currentStep: result === 'tackle' || result === 'outOfBounds' ? 'returnTackleAJersey' : 'returnEndSpot',
      currentToken: '',
      tokens,
    },
  };
}

function commitReturnTacklerToken(
  state: FootballConfirmedQuickInputState,
  context: FootballQuickInputContext,
): FootballQuickInputTransitionResult {
  const trimmed = state.currentToken.trim();
  const isFirst = state.currentStep === 'returnTackleAJersey';

  if (!trimmed) {
    if (state.tokens.returnTerminalResult === 'tackle' && isFirst && state.tokens.tacklers.length === 0) {
      return { state: tokenError(state, 'MISSING_TACKLER', 'Tackle result requires at least one tackler', 'participants.defenders') };
    }
    return {
      state: {
        ...baseActiveState(state),
        status: 'token.awaiting',
        currentStep: 'returnEndSpot',
        currentToken: '',
        tokens: cloneTokens(state.tokens),
      },
    };
  }

  return resolveJerseyToken(state, context, {
    role: 'tackler',
    teamScope: context.play.possession ?? context.play.actionTeam,
    actionContext: 'specialTeams',
    nextStep: isFirst ? 'returnTackleBJersey' : 'returnEndSpot',
  });
}

function commitHurryDefenderToken(
  state: FootballConfirmedQuickInputState,
  context: FootballQuickInputContext,
): FootballQuickInputTransitionResult {
  const trimmed = state.currentToken.trim();
  const nextStep = state.currentStep === 'hurryDefender1Jersey'
    ? 'hurryDefender2Jersey'
    : state.currentStep === 'hurryDefender2Jersey'
      ? 'hurryDefender3Jersey'
      : undefined;

  if (!trimmed) {
    if (state.currentStep === 'hurryDefender1Jersey' && state.tokens.hurryDefenders.length === 0) {
      return { state: tokenError(state, 'MISSING_HURRY_DEFENDER', 'Hurried pass requires at least one defender or choose no.', 'participants.defenders') };
    }
    if (state.tokens.passResult === 'interception') return blockInterceptionReturn(state, cloneTokens(state.tokens));
    return { state: makeReadyState({ ...baseActiveState(state), tokens: cloneTokens(state.tokens) }, context) };
  }

  return resolveJerseyToken(state, context, {
    role: 'hurry',
    teamScope: opposingTeam(context.play.possession ?? context.play.actionTeam),
    actionContext: 'defense',
    nextStep,
  });
}

function commitSackDefenderToken(
  state: FootballConfirmedQuickInputState,
  context: FootballQuickInputContext,
): FootballQuickInputTransitionResult {
  const trimmed = state.currentToken.trim();
  const isFirst = state.currentStep === 'sackDefenderAJersey';

  if (!trimmed) {
    if (isFirst || state.tokens.sackDefenders.length === 0) {
      return { state: tokenError(state, 'MISSING_SACK_DEFENDER', 'Sack requires at least one defender', 'participants.defenders') };
    }
    return {
      state: {
        ...baseActiveState(state),
        status: 'token.awaiting',
        currentStep: 'sackSpot',
        currentToken: '',
        tokens: cloneTokens(state.tokens),
      },
    };
  }

  return resolveJerseyToken(state, context, {
    role: 'sack',
    teamScope: opposingTeam(context.play.possession ?? context.play.actionTeam),
    actionContext: 'defense',
    nextStep: isFirst ? 'sackDefenderBJersey' : 'sackSpot',
  });
}

function blockInterceptionReturn(
  state: FootballConfirmedQuickInputState,
  tokens: FootballFlowTokens,
): FootballQuickInputTransitionResult {
  return {
    state: tokenError(
      {
        ...baseActiveState(state),
        tokens: {
          ...tokens,
          returnFlow: {
            type: 'Interception',
            fromSpot: tokens.passYardLine,
            status: 'blocked',
            reason: 'Return flow not implemented yet',
          },
        },
      },
      'RETURN_FLOW_NOT_IMPLEMENTED',
      'Return flow not implemented yet',
      'result.return',
    ),
  };
}

function commitTacklerToken(
  state: FootballConfirmedQuickInputState,
  context: FootballQuickInputContext,
): FootballQuickInputTransitionResult {
  const trimmed = state.currentToken.trim();
  const result = state.tokens.result;
  const isFirstTackler = state.currentStep === 'tackleAJersey' || state.currentStep === 'tacklerJersey';

  if (!trimmed) {
    if (result === 'tackle' && isFirstTackler && state.tokens.tacklers.length === 0) {
      return { state: tokenError(state, 'MISSING_TACKLER', 'Tackle result requires at least one tackler', 'participants.defenders') };
    }

    return {
      state: {
        ...baseActiveState(state),
        status: 'token.awaiting',
        currentStep: 'endSpot',
        currentToken: '',
        tokens: cloneTokens(state.tokens),
      },
    };
  }

  return resolveJerseyToken(state, context, {
    role: 'tackler',
    teamScope: opposingTeam(context.play.possession ?? context.play.actionTeam),
    actionContext: 'defense',
    nextStep: isFirstTackler ? 'tackleBJersey' : 'endSpot',
  });
}

function makeReadyState(
  state: FootballConfirmedQuickInputState,
  context: FootballQuickInputContext,
): FootballConfirmedQuickInputState {
  const readyState = {
    ...baseActiveState(state),
    status: 'draft.ready' as const,
    currentStep: undefined,
    currentToken: '',
    duplicate: undefined,
  };

  return {
    ...readyState,
    draft: readyState.flow === 'pass'
      ? buildPassDraft(readyState, context)
      : readyState.flow === 'punt'
        ? buildPuntDraft(readyState, context)
        : readyState.flow === 'kick'
          ? buildKickDraft(readyState, context)
          : readyState.flow === 'penalty'
            ? buildPenaltyOnlyDraft(readyState, context)
            : buildRushDraft(readyState, context),
  };
}

function advanceAfterPlayerCommit(
  state: FootballConfirmedQuickInputState,
  participant: DraftParticipant,
  role: FootballQuickInputDuplicateResolution['role'],
  nextStep: FootballTokenStep | undefined,
  context: FootballQuickInputContext,
): FootballConfirmedQuickInputState {
  const tokens = cloneTokens(state.tokens);
  if (role === 'rusher') tokens.rusher = participant;
  if (role === 'passer') tokens.passer = participant;
  if (role === 'receiver') tokens.receiver = participant;
  if (role === 'intendedReceiver') tokens.intendedReceiver = participant;
  if (role === 'punter') tokens.punter = participant;
  if (role === 'kicker') tokens.kicker = participant;
  if (role === 'returner') tokens.returner = participant;
  if (role === 'downingPlayer') tokens.downingPlayer = participant;
  if (role === 'tackler') tokens.tacklers = [...tokens.tacklers, participant];
  if (role === 'blocker') tokens.tacklers = [...tokens.tacklers, participant];
  if (role === 'sack') tokens.sackDefenders = [...tokens.sackDefenders, participant];
  if (role === 'passBreakup') tokens.brokenUpBy = participant;
  if (role === 'hurry') tokens.hurryDefenders = [...tokens.hurryDefenders, participant];
  if (role === 'forcedBy') tokens.forcedBy = participant;
  if (role === 'recoverer') tokens.recoverPlayer = participant;
  if (role === 'penalizedPlayer') {
    tokens.penaltyPlayer = participant;
    const source = tokens.penaltySource ?? 'immediate';
    tokens.penaltyEnforcedFrom = source === 'immediate'
      ? 'PREVIOUS'
      : defaultPenaltyEnforcement(tokens.penaltyDefinition);
    tokens.penaltyDownConsequence = source === 'immediate'
      ? 'REPEAT'
      : defaultPenaltyDownConsequence(tokens.penaltyDefinition);
  }

  if ((role === 'tackler' || role === 'blocker' || role === 'sack' || role === 'hurry' || role === 'returner' || role === 'penalizedPlayer') && !nextStep) {
    return makeReadyState({
      ...baseActiveState(state),
      tokens,
      duplicate: undefined,
    }, context);
  }

  return {
    ...baseActiveState(state),
    status: 'token.awaiting',
    currentStep: nextStep,
    currentToken: role === 'penalizedPlayer' && nextStep === 'penaltyEnforcedFrom'
      ? penaltyEnforcedFromInputCode(tokens.penaltyEnforcedFrom)
      : role === 'penalizedPlayer' && nextStep === 'penaltyFinalSpot'
        ? suggestedPenaltyFinalSpot(context, tokens, state.draft) ?? ''
      : '',
    tokens,
    duplicate: undefined,
  };
}

function generateSummary(
  state: FootballConfirmedQuickInputState,
  context: FootballQuickInputContext,
): FootballQuickInputTransitionResult {
  if (state.status !== 'draft.ready' && state.status !== 'penalty.editing') {
    return { state: cloneState(state) };
  }

  const draft = state.draft ?? (
    state.flow === 'pass'
      ? buildPassDraft(state, context)
      : state.flow === 'punt'
        ? buildPuntDraft(state, context)
        : state.flow === 'kick'
          ? buildKickDraft(state, context)
          : state.flow === 'penalty'
            ? buildPenaltyOnlyDraft(state, context)
            : buildRushDraft(state, context)
  );
  const summary = generateFootballPlaySummary(draft);
  const nextDraft: FootballDraftIntent = {
    ...cloneDraft(draft),
    status: 'summaryGenerated',
    updatedAt: context.now ?? draft.updatedAt,
  };

  return {
    state: {
      ...baseActiveState(state),
      status: 'summary.reviewing',
      currentStep: undefined,
      currentToken: '',
      draft: nextDraft,
      summary,
    },
  };
}

function editPlay(state: FootballConfirmedQuickInputState): FootballQuickInputTransitionResult {
  if (state.status !== 'summary.reviewing' && state.status !== 'draft.ready') {
    return { state: cloneState(state) };
  }

  const tokens = cloneTokens(state.tokens);
  if (state.flow === 'kick' && tokens.kickMenuSelection === 'fieldGoal') {
    tokens.fieldGoalResult = undefined;
    tokens.fieldGoalMissedReason = undefined;
    tokens.fieldGoalReturnAttempted = undefined;
    tokens.tacklers = [];

    return {
      state: {
        ...baseActiveState(state),
        status: 'token.awaiting',
        currentStep: tokens.fieldGoalSpot ? 'fieldGoalResult' : 'fieldGoalSpot',
        currentToken: '',
        tokens,
        draft: undefined,
        summary: undefined,
        buildResult: undefined,
        error: undefined,
      },
    };
  }

  if (state.flow === 'kick' && tokens.kickMenuSelection === 'pat') {
    tokens.patKickResult = undefined;
    tokens.patKickMissedReason = undefined;
    tokens.patKickReturnAttempted = undefined;
    tokens.patRushResult = undefined;
    tokens.patRushReturnAttempted = undefined;
    tokens.patPassResult = undefined;
    tokens.patPassReturnAttempted = undefined;
    tokens.tacklers = [];

    return {
      state: {
        ...baseActiveState(state),
        status: 'token.awaiting',
        currentStep: tokens.patType === 'rush'
          ? 'patRushResult'
          : tokens.patType === 'pass'
            ? 'patPassResult'
            : tokens.patType === 'kick'
              ? 'patKickResult'
              : 'patType',
        currentToken: '',
        tokens,
        draft: undefined,
        summary: undefined,
        buildResult: undefined,
        error: undefined,
      },
    };
  }

  if (state.flow === 'kick' && tokens.kicker) {
    tokens.kickReceiveResult = undefined;
    tokens.returner = undefined;
    tokens.kickReturnStartSpot = undefined;
    tokens.returnTerminalResult = undefined;
    tokens.returnEndSpot = undefined;
    tokens.kickTouchbackSpot = undefined;
    tokens.kickFairCatchSpot = undefined;
    tokens.kickOutOfBoundsSpot = undefined;
    tokens.tacklers = [];

    return {
      state: {
        ...baseActiveState(state),
        status: 'token.awaiting',
        currentStep: 'kickReceiveResult',
        currentToken: '',
        tokens,
        draft: undefined,
        summary: undefined,
        buildResult: undefined,
        error: undefined,
      },
    };
  }

  if (state.flow === 'punt' && tokens.punter) {
    tokens.puntReceiveResult = undefined;
    tokens.returner = undefined;
    tokens.returnTerminalResult = undefined;
    tokens.returnEndSpot = undefined;
    tokens.downingPlayer = undefined;
    tokens.downedSpot = undefined;
    tokens.tacklers = [];

    return {
      state: {
        ...baseActiveState(state),
        status: 'token.awaiting',
        currentStep: tokens.puntSpot ? 'puntReceiveResult' : 'puntSpot',
        currentToken: '',
        tokens,
        draft: undefined,
        summary: undefined,
        buildResult: undefined,
        error: undefined,
      },
    };
  }

  if (tokens.rusher) {
    tokens.result = undefined;
    tokens.tacklers = [];
    tokens.endYardLine = undefined;
    tokens.forcedBy = undefined;
    tokens.recoverTeam = undefined;
    tokens.recoverPlayer = undefined;
    tokens.recoverSpot = undefined;
    tokens.fumbleReturned = undefined;
    tokens.returnFlow = undefined;

    return {
      state: {
        ...baseActiveState(state),
        status: 'token.awaiting',
        currentStep: 'result',
        currentToken: '',
        tokens,
        draft: undefined,
        summary: undefined,
        buildResult: undefined,
        error: undefined,
      },
    };
  }

  return {
    state: {
      ...baseActiveState(state),
      status: 'token.awaiting',
      currentStep: 'rusherJersey',
      currentToken: '',
      tokens: initialTokens(),
      draft: undefined,
      summary: undefined,
      buildResult: undefined,
      error: undefined,
    },
  };
}

function jumpToStep(
  state: FootballConfirmedQuickInputState,
  stepId: string,
): FootballQuickInputTransitionResult {
  if (!isActivePlayState(state) || state.flow !== 'rush') {
    return { state: cloneState(state) };
  }

  if (stepId === 'rush.rusher') return jumpToRushRusher(state);
  if (stepId === 'rush.result') return jumpToRushResult(state);
  if (stepId === 'rush.tacklers') return jumpToRushTacklers(state);
  if (stepId === 'rush.spot') return jumpToRushSpot(state);

  return { state: cloneState(state) };
}

function jumpToRushRusher(state: FootballConfirmedQuickInputState): FootballQuickInputTransitionResult {
  const tokens = cloneTokens(state.tokens);
  tokens.result = undefined;
  tokens.tacklers = [];
  tokens.endYardLine = undefined;
  clearRushContinuationTokens(tokens);

  return {
    state: {
      ...baseActiveState(state),
      status: 'token.awaiting',
      currentStep: 'rusherJersey',
      currentToken: state.tokens.rusher?.jersey ?? '',
      tokens,
      draft: undefined,
      summary: undefined,
      buildResult: undefined,
      duplicate: undefined,
    },
  };
}

function jumpToRushResult(state: FootballConfirmedQuickInputState): FootballQuickInputTransitionResult {
  if (!state.tokens.rusher) return { state: cloneState(state) };

  const tokens = cloneTokens(state.tokens);
  tokens.tacklers = [];
  tokens.endYardLine = undefined;
  clearRushContinuationTokens(tokens);

  return {
    state: {
      ...baseActiveState(state),
      status: 'token.awaiting',
      currentStep: 'result',
      currentToken: rushResultInputCode(tokens.result),
      tokens,
      draft: undefined,
      summary: undefined,
      buildResult: undefined,
      duplicate: undefined,
    },
  };
}

function jumpToRushTacklers(state: FootballConfirmedQuickInputState): FootballQuickInputTransitionResult {
  if (!state.tokens.rusher || (state.tokens.result !== 'tackle' && state.tokens.result !== 'outOfBounds')) {
    return { state: cloneState(state) };
  }

  const tokens = cloneTokens(state.tokens);
  tokens.endYardLine = undefined;

  return {
    state: {
      ...baseActiveState(state),
      status: 'token.awaiting',
      currentStep: 'tackleAJersey',
      currentToken: tokens.tacklers[0]?.jersey ?? '',
      tokens,
      draft: undefined,
      summary: undefined,
      buildResult: undefined,
      duplicate: undefined,
    },
  };
}

function jumpToRushSpot(state: FootballConfirmedQuickInputState): FootballQuickInputTransitionResult {
  if (!state.tokens.rusher || !state.tokens.result) return { state: cloneState(state) };

  const tokens = cloneTokens(state.tokens);

  return {
    state: {
      ...baseActiveState(state),
      status: 'token.awaiting',
      currentStep: 'endSpot',
      currentToken: tokens.endYardLine ?? '',
      tokens,
      draft: undefined,
      summary: undefined,
      buildResult: undefined,
      duplicate: undefined,
    },
  };
}

function clearRushContinuationTokens(tokens: FootballFlowTokens): void {
  tokens.forcedBy = undefined;
  tokens.recoverTeam = undefined;
  tokens.recoverPlayer = undefined;
  tokens.recoverSpot = undefined;
  tokens.fumbleReturned = undefined;
  tokens.returnFlow = undefined;
}

function confirmSummary(
  state: FootballConfirmedQuickInputState,
  event: Extract<FootballQuickInputEvent, { type: 'CONFIRM_SUMMARY' }>,
  context: FootballQuickInputContext,
): FootballQuickInputTransitionResult {
  if (state.status !== 'summary.reviewing' || !state.draft || !state.summary) {
    return { state: cloneState(state) };
  }

  if (state.queuedPenaltyRequested) {
    return {
      state: {
        ...cloneState(state),
        status: 'summary.reviewing',
        error: {
          code: 'UNRESOLVED_QUEUED_PENALTY',
          message: 'Penalty queued — resolve before submitting',
          field: 'penalties',
        },
      },
    };
  }

  const confirmedAt = event.confirmedAt ?? context.now ?? state.draft.updatedAt;
  const confirmedDraft: FootballDraftIntent = {
    ...cloneDraft(state.draft),
    status: 'confirmed',
    updatedAt: confirmedAt,
    confirmation: {
      summaryText: state.summary.summaryText,
      summaryRevision: state.draft.revision,
      confirmedAt,
      confirmedByUserId: event.confirmedByUserId ?? context.source.userId,
      operatorAction: 'confirmSubmit',
      penaltiesReviewed: true,
      warningsAcknowledged: state.summary.warnings.map((warning) => warning.code),
    },
  };
  const buildResult = buildFootballEvent(confirmedDraft);

  return {
    state: {
      ...baseActiveState(state),
      status: 'submitting.confirmed',
      currentStep: undefined,
      currentToken: '',
      draft: confirmedDraft,
      summary: state.summary,
      buildResult,
    },
  };
}

function buildRushDraft(
  state: Pick<FootballConfirmedQuickInputState, 'tokens'>,
  context: FootballQuickInputContext,
): FootballDraftIntent {
  const rusher = state.tokens.rusher;
  if (!rusher) {
    throw new Error('Cannot build rush draft without a resolved rusher');
  }

  const revision = 1;
  return {
    schemaVersion: 'football.draftIntent.v1',
    intentId: context.intentId ?? 'fcqi-rush-draft-1',
    clientEventId: context.clientEventId ?? 'fcqi-rush-client-1',
    status: 'readyForSummary',
    createdAt: context.source.startedAt,
    updatedAt: context.now ?? context.source.startedAt,
    revision,
    game: cloneGameContext(context.game),
    source: { ...context.source, startedBy: context.source.startedBy ?? 'hotkey', hotkey: context.source.hotkey ?? 'R' },
    play: {
      family: 'rush',
      subtype: null,
      actionTeam: context.play.actionTeam,
      possession: context.play.possession,
      period: context.play.period,
      clock: context.play.clock,
    },
    prePlay: { ...context.prePlay },
    participants: {
      primary: cloneParticipant(rusher),
      fumbler: state.tokens.result === 'fumble' ? cloneParticipant(rusher) : undefined,
      forcedBy: state.tokens.forcedBy ? cloneParticipant(state.tokens.forcedBy) : undefined,
      recoveredBy: state.tokens.recoverPlayer ? cloneParticipant(state.tokens.recoverPlayer) : undefined,
      defenders: state.tokens.tacklers.map(cloneParticipant),
      penalizedPlayers: [],
      others: [],
    },
    result: buildRushResult(state.tokens, context),
    penalties: (context.penalties ?? []).map((penalty) => ({ ...penalty })),
    warnings: state.tokens.result === 'endOfPlay'
      ? [{
          code: 'UNSUPPORTED_PLAY_FAMILY',
          severity: 'info',
          message: 'FCQI rush result endOfPlay mapped to neutral tackle result code for the current schema.',
          field: 'result.code',
          source: 'fcqi',
        }]
      : [],
  };
}

function buildPassDraft(
  state: Pick<FootballConfirmedQuickInputState, 'tokens'>,
  context: FootballQuickInputContext,
): FootballDraftIntent {
  const passer = state.tokens.passer;
  if (!passer) {
    throw new Error('Cannot build pass draft without a resolved passer');
  }

  const revision = 1;
  const subtype = passSubtype(state.tokens);
  const result = buildPassResult(state.tokens, context);
  const fumbler = passFumbler(state.tokens);

  return {
    schemaVersion: 'football.draftIntent.v1',
    intentId: context.intentId ?? 'fcqi-pass-draft-1',
    clientEventId: context.clientEventId ?? 'fcqi-pass-client-1',
    status: 'readyForSummary',
    createdAt: context.source.startedAt,
    updatedAt: context.now ?? context.source.startedAt,
    revision,
    game: cloneGameContext(context.game),
    source: { ...context.source, startedBy: context.source.startedBy ?? 'hotkey', hotkey: context.source.hotkey ?? 'P' },
    play: {
      family: 'pass',
      subtype,
      actionTeam: context.play.actionTeam,
      possession: context.play.possession,
      period: context.play.period,
      clock: context.play.clock,
    },
    prePlay: { ...context.prePlay },
    participants: {
      primary: cloneParticipant({
        ...passer,
        role: subtype === 'sack' ? 'sackVictim' : 'passer',
        participantId: `${subtype === 'sack' ? 'sackVictim' : 'passer'}-${passer.playerId}`,
      }),
      secondary: state.tokens.receiver
        ? cloneParticipant(state.tokens.receiver)
        : state.tokens.intendedReceiver
          ? cloneParticipant(state.tokens.intendedReceiver)
          : undefined,
      fumbler: fumbler ? cloneParticipant(fumbler) : undefined,
      forcedBy: state.tokens.forcedBy ? cloneParticipant(state.tokens.forcedBy) : undefined,
      recoveredBy: state.tokens.recoverPlayer ? cloneParticipant(state.tokens.recoverPlayer) : undefined,
      defenders: passDefenders(state.tokens).map(cloneParticipant),
      penalizedPlayers: [],
      others: [],
    },
    result,
    penalties: (context.penalties ?? []).map((penalty) => ({ ...penalty })),
    warnings: [],
  };
}

function passSubtype(tokens: FootballFlowTokens): FootballDraftIntent['play']['subtype'] {
  if (tokens.passResult === 'complete') return 'complete';
  if (tokens.passResult === 'incomplete') return 'incomplete';
  if (tokens.passResult === 'sack' || tokens.passResult === 'sackFumble') return 'sack';
  if (tokens.passResult === 'interception') return 'interception';
  return 'incomplete';
}

function buildPassResult(tokens: FootballFlowTokens, context: FootballQuickInputContext): FootballDraftIntent['result'] {
  if (tokens.passResult === 'incomplete') {
    return {
      code: 'incomplete',
      driveEnds: false,
      pass: {
        targetPlayerId: tokens.intendedReceiver?.playerId,
        completed: false,
        intendedYardLine: tokens.passYardLine,
        brokenUpByPlayerId: tokens.brokenUpBy?.playerId,
        hurriedByPlayerIds: tokens.hurryDefenders.map((defender) => defender.playerId),
      },
    };
  }

  if (tokens.passResult === 'sack' || tokens.passResult === 'sackFumble') {
    const endYardLine = tokens.sackSpot;
    const yards = endYardLine ? (tokens.yards ?? deriveRushYards(context, endYardLine)) : tokens.yards;
    const base: FootballDraftIntent['result'] = {
      code: 'sack',
      yards,
      endYardLine,
      driveEnds: false,
    };
    if (tokens.passResult !== 'sackFumble') return base;
    return attachFumbleToResult(base, tokens, context, tokens.passer, endYardLine);
  }

  const endYardLine = tokens.endYardLine;
  const yards = endYardLine ? (tokens.yards ?? deriveRushYards(context, endYardLine)) : tokens.yards;
  const code = tokens.completeResult === 'outOfBounds' ? 'outOfBounds' : 'complete';
  const base: FootballDraftIntent['result'] = {
    code,
    yards,
    endYardLine,
    driveEnds: false,
    pass: {
      targetPlayerId: tokens.receiver?.playerId,
      completed: true,
      caughtAtYardLine: tokens.caughtAtSpot,
      completeResultCode: completeResultCode(tokens.completeResult),
    },
  };

  if (tokens.completeResult === 'fumble') {
    return attachFumbleToResult(base, tokens, context, tokens.receiver, endYardLine);
  }

  return base;
}

function attachFumbleToResult(
  base: FootballDraftIntent['result'],
  tokens: FootballFlowTokens,
  context: FootballQuickInputContext,
  fumbler: DraftParticipant | undefined,
  fumbleSpot: Spot | undefined,
): FootballDraftIntent['result'] {
  const actionTeam = context.play.possession ?? context.play.actionTeam;
  const turnover = Boolean(tokens.recoverTeam && tokens.recoverTeam !== actionTeam);
  return {
    ...base,
    fumble: {
      fumblerPlayerId: fumbler?.playerId ?? '',
      forcedByPlayerId: tokens.forcedBy?.playerId ?? tokens.sackDefenders[0]?.playerId,
      spot: fumbleSpot,
      recoveredByPlayerId: tokens.recoverPlayer?.playerId,
      recoveredByTeam: tokens.recoverTeam,
      recoverySpot: tokens.recoverSpot,
      turnover,
    },
    turnover: turnover
      ? {
          type: 'fumble',
          team: tokens.recoverTeam,
          playerId: tokens.recoverPlayer?.playerId,
          spot: tokens.recoverSpot,
        }
      : undefined,
    nextPossession: turnover ? tokens.recoverTeam : context.play.possession,
  };
}

function passFumbler(tokens: FootballFlowTokens): DraftParticipant | undefined {
  if (tokens.passResult === 'sackFumble') return tokens.passer
    ? {
        ...tokens.passer,
        role: 'fumbler',
        participantId: `fumbler-${tokens.passer.playerId}`,
      }
    : undefined;
  if (tokens.completeResult === 'fumble') return tokens.receiver
    ? {
        ...tokens.receiver,
        role: 'fumbler',
        participantId: `fumbler-${tokens.receiver.playerId}`,
      }
    : undefined;
  return undefined;
}

function passDefenders(tokens: FootballFlowTokens): DraftParticipant[] {
  return [
    ...tokens.tacklers,
    ...tokens.sackDefenders,
    ...(tokens.brokenUpBy ? [tokens.brokenUpBy] : []),
    ...tokens.hurryDefenders,
  ];
}

function buildPuntDraft(
  state: Pick<FootballConfirmedQuickInputState, 'tokens'>,
  context: FootballQuickInputContext,
): FootballDraftIntent {
  const punter = state.tokens.punter;
  if (!punter) {
    throw new Error('Cannot build punt draft without a resolved punter');
  }

  const revision = 1;
  const result = buildPuntResult(state.tokens, context);
  const subtype = puntSubtype(state.tokens);

  return {
    schemaVersion: 'football.draftIntent.v1',
    intentId: context.intentId ?? 'fcqi-punt-draft-1',
    clientEventId: context.clientEventId ?? 'fcqi-punt-client-1',
    status: 'readyForSummary',
    createdAt: context.source.startedAt,
    updatedAt: context.now ?? context.source.startedAt,
    revision,
    game: cloneGameContext(context.game),
    source: { ...context.source, startedBy: context.source.startedBy ?? 'hotkey', hotkey: context.source.hotkey ?? 'U' },
    play: {
      family: 'punt',
      subtype,
      actionTeam: context.play.actionTeam,
      possession: context.play.possession,
      period: context.play.period,
      clock: context.play.clock,
    },
    prePlay: { ...context.prePlay },
    participants: {
      primary: cloneParticipant({
        ...punter,
        role: 'punter',
        participantId: `punter-${punter.playerId}`,
      }),
      returner: state.tokens.returner ? cloneParticipant(state.tokens.returner) : undefined,
      defenders: state.tokens.tacklers.map(cloneParticipant),
      punter: cloneParticipant({
        ...punter,
        role: 'punter',
        participantId: `punter-${punter.playerId}`,
      }),
      penalizedPlayers: [],
      others: state.tokens.downingPlayer ? [cloneParticipant(state.tokens.downingPlayer)] : [],
    },
    result,
    penalties: (context.penalties ?? []).map((penalty) => ({ ...penalty })),
    warnings: [],
  };
}

function puntSubtype(tokens: FootballFlowTokens): FootballDraftIntent['play']['subtype'] {
  if (tokens.puntReceiveResult === 'return') return 'returned';
  if (tokens.puntReceiveResult === 'touchback') return 'touchback';
  if (tokens.puntReceiveResult === 'fairCatch') return 'fairCatch';
  if (tokens.puntReceiveResult === 'outOfBounds') return 'outOfBounds';
  if (tokens.puntReceiveResult === 'muffed') return 'muffed';
  if (tokens.puntReceiveResult === 'downed') return 'downed';
  return 'downed';
}

function buildPuntResult(tokens: FootballFlowTokens, context: FootballQuickInputContext): FootballDraftIntent['result'] {
  const receiveResult = tokens.puntReceiveResult;
  const catchYardLine = puntCatchSpot(tokens);
  const endYardLine = puntEndSpot(tokens, context);
  const kickYards = catchYardLine ? derivePuntYards(context, catchYardLine) : undefined;
  const baseKick = {
    catchYardLine,
    kickYards,
    receiveResultCode: puntReceiveResultCode(receiveResult),
  };

  if (receiveResult === 'return') {
    const returnEndYardLine = tokens.returnEndSpot;
    const returnYards = returnEndYardLine && tokens.puntSpot
      ? deriveReturnYards(context, tokens.puntSpot, returnEndYardLine)
      : undefined;
    const code = tokens.returnTerminalResult === 'outOfBounds' ? 'outOfBounds' : 'returned';
    return {
      code,
      endYardLine: returnEndYardLine,
      nextPossession: opposingTeam(context.play.possession ?? context.play.actionTeam),
      driveEnds: true,
      kick: baseKick,
      return: {
        type: 'Punt',
        returnerPlayerId: tokens.returner?.playerId,
        returnYards,
        returnStartYardLine: tokens.puntSpot,
        returnEndYardLine,
        resultCode: returnTerminalResultCode(tokens.returnTerminalResult),
        tackledByPlayerIds: tokens.tacklers.map((tackler) => tackler.playerId),
      },
    };
  }

  return {
    code: puntResultCode(receiveResult),
    endYardLine,
    nextPossession: opposingTeam(context.play.possession ?? context.play.actionTeam),
    driveEnds: true,
    kick: baseKick,
  };
}

function buildKickDraft(
  state: Pick<FootballConfirmedQuickInputState, 'tokens'>,
  context: FootballQuickInputContext,
): FootballDraftIntent {
  if (state.tokens.kickMenuSelection === 'fieldGoal') return buildFieldGoalDraft(state, context);
  if (state.tokens.kickMenuSelection === 'pat') return buildTryDraft(state, context);
  return buildKickoffDraft(state, context);
}

function buildFieldGoalDraft(
  state: Pick<FootballConfirmedQuickInputState, 'tokens'>,
  context: FootballQuickInputContext,
): FootballDraftIntent {
  const kicker = state.tokens.kicker;
  if (!kicker) {
    throw new Error('Cannot build field goal draft without a resolved kicker');
  }

  const revision = 1;
  const result = buildFieldGoalResult(state.tokens, context);
  const subtype = fieldGoalSubtype(state.tokens);

  return {
    schemaVersion: 'football.draftIntent.v1',
    intentId: context.intentId ?? 'fcqi-field-goal-draft-1',
    clientEventId: context.clientEventId ?? 'fcqi-field-goal-client-1',
    status: 'readyForSummary',
    createdAt: context.source.startedAt,
    updatedAt: context.now ?? context.source.startedAt,
    revision,
    game: cloneGameContext(context.game),
    source: { ...context.source, startedBy: context.source.startedBy ?? 'hotkey', hotkey: context.source.hotkey ?? 'K' },
    play: {
      family: 'fieldGoal',
      subtype,
      actionTeam: context.play.actionTeam,
      possession: context.play.possession,
      period: context.play.period,
      clock: context.play.clock,
    },
    prePlay: { ...context.prePlay },
    participants: {
      primary: cloneParticipant({
        ...kicker,
        role: 'kicker',
        participantId: `kicker-${kicker.playerId}`,
      }),
      kicker: cloneParticipant({
        ...kicker,
        role: 'kicker',
        participantId: `kicker-${kicker.playerId}`,
      }),
      defenders: state.tokens.tacklers.map(cloneParticipant),
      penalizedPlayers: [],
      others: [],
    },
    result,
    penalties: (context.penalties ?? []).map((penalty) => ({ ...penalty })),
    warnings: [],
  };
}

function buildTryDraft(
  state: Pick<FootballConfirmedQuickInputState, 'tokens'>,
  context: FootballQuickInputContext,
): FootballDraftIntent {
  const primary = tryPrimaryParticipant(state.tokens);
  if (!primary) {
    throw new Error('Cannot build PAT draft without a resolved primary participant');
  }

  const revision = 1;
  const result = buildTryResult(state.tokens, context);
  const subtype = state.tokens.patType ?? 'kick';

  return {
    schemaVersion: 'football.draftIntent.v1',
    intentId: context.intentId ?? 'fcqi-pat-draft-1',
    clientEventId: context.clientEventId ?? 'fcqi-pat-client-1',
    status: 'readyForSummary',
    createdAt: context.source.startedAt,
    updatedAt: context.now ?? context.source.startedAt,
    revision,
    game: cloneGameContext(context.game),
    source: { ...context.source, startedBy: context.source.startedBy ?? 'hotkey', hotkey: context.source.hotkey ?? 'K' },
    play: {
      family: 'try',
      subtype,
      actionTeam: context.play.actionTeam,
      possession: null,
      period: context.play.period,
      clock: context.play.clock,
    },
    prePlay: {
      ...context.prePlay,
      possession: null,
      down: null,
      distance: null,
      yardLine: context.game.rules?.patSpot ?? context.prePlay.yardLine,
      lineToGain: null,
    },
    participants: {
      primary: cloneParticipant(primary),
      secondary: state.tokens.patType === 'pass' && state.tokens.receiver ? cloneParticipant(state.tokens.receiver) : undefined,
      kicker: state.tokens.patType === 'kick' && state.tokens.kicker ? cloneParticipant(state.tokens.kicker) : undefined,
      defenders: state.tokens.tacklers.map(cloneParticipant),
      penalizedPlayers: [],
      others: [],
    },
    result,
    penalties: (context.penalties ?? []).map((penalty) => ({ ...penalty })),
    warnings: [],
  };
}

function fieldGoalSubtype(tokens: FootballFlowTokens): FootballDraftIntent['play']['subtype'] {
  if (tokens.fieldGoalResult === 'good') return 'made';
  if (tokens.fieldGoalResult === 'blocked') return 'blocked';
  return 'missed';
}

function buildFieldGoalResult(tokens: FootballFlowTokens, context: FootballQuickInputContext): FootballDraftIntent['result'] {
  const code: FootballDraftIntent['result']['code'] = tokens.fieldGoalResult === 'good'
    ? 'made'
    : tokens.fieldGoalResult === 'blocked'
      ? 'blocked'
      : 'missed';
  return {
    code,
    endYardLine: tokens.fieldGoalSpot,
    driveEnds: true,
    kick: {
      kickSpot: tokens.fieldGoalSpot,
      attemptYards: tokens.fieldGoalSpot ? deriveFieldGoalAttemptYards(context, tokens.fieldGoalSpot) : undefined,
      missedReason: tokens.fieldGoalMissedReason,
      blockedByPlayerId: tokens.tacklers[0]?.playerId,
    },
    scoring: tokens.fieldGoalResult === 'good'
      ? { team: context.play.actionTeam, points: 3, type: 'fieldGoal' }
      : undefined,
  };
}

function tryPrimaryParticipant(tokens: FootballFlowTokens): DraftParticipant | undefined {
  if (tokens.patType === 'rush') return tokens.rusher
    ? {
        ...tokens.rusher,
        role: 'rusher',
        participantId: `rusher-${tokens.rusher.playerId}`,
      }
    : undefined;
  if (tokens.patType === 'pass') return tokens.passer
    ? {
        ...tokens.passer,
        role: 'passer',
        participantId: `passer-${tokens.passer.playerId}`,
      }
    : undefined;
  return tokens.kicker
    ? {
        ...tokens.kicker,
        role: 'kicker',
        participantId: `kicker-${tokens.kicker.playerId}`,
      }
    : undefined;
}

function buildTryResult(tokens: FootballFlowTokens, context: FootballQuickInputContext): FootballDraftIntent['result'] {
  if (tokens.patType === 'rush') {
    const made = tokens.patRushResult === 'good';
    return {
      code: made ? 'made' : tokens.patRushResult === 'fumbled' ? 'fumble' : 'failed',
      driveEnds: true,
      scoring: made ? { team: context.play.actionTeam, points: 2, type: 'twoPoint' } : undefined,
      fumble: tokens.patRushResult === 'fumbled' && tokens.rusher
        ? {
            fumblerPlayerId: tokens.rusher.playerId,
            turnover: false,
          }
        : undefined,
    };
  }

  if (tokens.patType === 'pass') {
    const made = tokens.patPassResult === 'good';
    const code: FootballDraftIntent['result']['code'] = made
      ? 'made'
      : tokens.patPassResult === 'incomplete'
        ? 'incomplete'
        : tokens.patPassResult === 'intercepted'
          ? 'interception'
          : tokens.patPassResult === 'fumbled'
            ? 'fumble'
            : 'failed';
    return {
      code,
      driveEnds: true,
      pass: {
        targetPlayerId: tokens.receiver?.playerId,
        completed: made,
      },
      scoring: made ? { team: context.play.actionTeam, points: 2, type: 'twoPoint' } : undefined,
      fumble: tokens.patPassResult === 'fumbled' && tokens.receiver
        ? {
            fumblerPlayerId: tokens.receiver.playerId,
            turnover: false,
          }
        : undefined,
    };
  }

  const made = tokens.patKickResult === 'good';
  return {
    code: made ? 'made' : tokens.patKickResult === 'blocked' ? 'blocked' : 'missed',
    driveEnds: true,
    kick: {
      kickSpot: context.game.rules?.patSpot,
      missedReason: tokens.patKickMissedReason,
      blockedByPlayerId: tokens.tacklers[0]?.playerId,
    },
    scoring: made ? { team: context.play.actionTeam, points: 1, type: 'patKick' } : undefined,
  };
}

function buildKickoffDraft(
  state: Pick<FootballConfirmedQuickInputState, 'tokens'>,
  context: FootballQuickInputContext,
): FootballDraftIntent {
  const kicker = state.tokens.kicker;
  if (!kicker) {
    throw new Error('Cannot build kickoff draft without a resolved kicker');
  }

  const revision = 1;
  const result = buildKickoffResult(state.tokens, context);
  const subtype = kickoffSubtype(state.tokens);

  return {
    schemaVersion: 'football.draftIntent.v1',
    intentId: context.intentId ?? 'fcqi-kickoff-draft-1',
    clientEventId: context.clientEventId ?? 'fcqi-kickoff-client-1',
    status: 'readyForSummary',
    createdAt: context.source.startedAt,
    updatedAt: context.now ?? context.source.startedAt,
    revision,
    game: cloneGameContext(context.game),
    source: { ...context.source, startedBy: context.source.startedBy ?? 'hotkey', hotkey: context.source.hotkey ?? 'K' },
    play: {
      family: 'kickoff',
      subtype,
      actionTeam: context.play.actionTeam,
      possession: null,
      period: context.play.period,
      clock: context.play.clock,
    },
    prePlay: {
      ...context.prePlay,
      possession: null,
      down: null,
      distance: null,
      lineToGain: null,
    },
    participants: {
      primary: cloneParticipant({
        ...kicker,
        role: 'kicker',
        participantId: `kicker-${kicker.playerId}`,
      }),
      kicker: cloneParticipant({
        ...kicker,
        role: 'kicker',
        participantId: `kicker-${kicker.playerId}`,
      }),
      returner: state.tokens.returner ? cloneParticipant(state.tokens.returner) : undefined,
      defenders: state.tokens.tacklers.map(cloneParticipant),
      penalizedPlayers: [],
      others: [],
    },
    result,
    penalties: (context.penalties ?? []).map((penalty) => ({ ...penalty })),
    warnings: [],
  };
}

function kickoffSubtype(tokens: FootballFlowTokens): FootballDraftIntent['play']['subtype'] {
  if (tokens.kickReceiveResult === 'return') return 'returned';
  if (tokens.kickReceiveResult === 'touchback') return 'touchback';
  if (tokens.kickReceiveResult === 'fairCatch') return 'fairCatch';
  if (tokens.kickReceiveResult === 'outOfBounds') return 'outOfBounds';
  if (tokens.kickReceiveResult === 'muffed') return 'muffed';
  if (tokens.kickReceiveResult === 'downed') return 'downed';
  return 'returned';
}

function buildKickoffResult(tokens: FootballFlowTokens, context: FootballQuickInputContext): FootballDraftIntent['result'] {
  const receiveResult = tokens.kickReceiveResult;
  const catchYardLine = kickoffCatchSpot(tokens);
  const endYardLine = kickoffEndSpot(tokens, context);
  const kickYards = catchYardLine ? deriveKickoffYards(context, catchYardLine) : undefined;
  const baseKick = {
    catchYardLine,
    kickYards,
    receiveResultCode: puntReceiveResultCode(receiveResult),
  };

  if (receiveResult === 'return') {
    const returnEndYardLine = tokens.returnEndSpot;
    const returnYards = returnEndYardLine && tokens.kickReturnStartSpot
      ? deriveReturnYards(context, tokens.kickReturnStartSpot, returnEndYardLine)
      : undefined;
    const code = tokens.returnTerminalResult === 'outOfBounds' ? 'outOfBounds' : 'returned';
    return {
      code,
      endYardLine: returnEndYardLine,
      nextPossession: opposingTeam(context.play.possession ?? context.play.actionTeam),
      driveEnds: false,
      kick: baseKick,
      return: {
        type: 'Kickoff',
        returnerPlayerId: tokens.returner?.playerId,
        returnYards,
        returnStartYardLine: tokens.kickReturnStartSpot,
        returnEndYardLine,
        resultCode: returnTerminalResultCode(tokens.returnTerminalResult),
        tackledByPlayerIds: tokens.tacklers.map((tackler) => tackler.playerId),
      },
    };
  }

  return {
    code: puntResultCode(receiveResult),
    endYardLine,
    nextPossession: opposingTeam(context.play.possession ?? context.play.actionTeam),
    driveEnds: false,
    kick: baseKick,
  };
}

function finalizePenaltyEntry(
  state: FootballConfirmedQuickInputState,
  context: FootballQuickInputContext,
): FootballQuickInputTransitionResult {
  const penalties = buildDraftPenaltiesFromTokens(state.tokens, context, state.tokens.penaltySource === 'queued' ? state.draft : undefined);
  const validationError = validatePenaltyTokenResult(penalties);
  if (validationError) return { state: tokenError(state, validationError.code, validationError.message, validationError.field) };

  if (state.tokens.penaltySource === 'queued') {
    if (!state.draft) {
      return { state: tokenError(state, 'MISSING_BASE_PLAY_DRAFT', 'Queued penalty resolution requires a play draft', 'draft') };
    }
    const draft = attachPenaltiesToDraft(state.draft, penalties, context);
    const summary = generateFootballPlaySummary(draft);
    return {
      state: {
        ...baseActiveState(state),
        status: 'summary.reviewing',
        flow: undefined,
        currentStep: undefined,
        currentToken: '',
        tokens: initialTokens(),
        draft,
        summary,
        queuedPenaltyRequested: false,
        duplicate: undefined,
      },
    };
  }

  return {
    state: makeReadyState({
      ...baseActiveState(state),
      tokens: {
        ...cloneTokens(state.tokens),
        penaltySource: 'immediate',
      },
    }, context),
  };
}

function buildPenaltyOnlyDraft(
  state: Pick<FootballConfirmedQuickInputState, 'tokens'>,
  context: FootballQuickInputContext,
): FootballDraftIntent {
  const penalties = buildDraftPenaltiesFromTokens(state.tokens, context);
  const resolution = state.tokens.penaltyResolution ?? 'accepted';
  const revision = 1;
  return {
    schemaVersion: 'football.draftIntent.v1',
    intentId: context.intentId ?? 'fcqi-penalty-draft-1',
    clientEventId: context.clientEventId ?? 'fcqi-penalty-client-1',
    status: 'readyForSummary',
    createdAt: context.source.startedAt,
    updatedAt: context.now ?? context.source.startedAt,
    revision,
    game: cloneGameContext(context.game),
    source: { ...context.source, startedBy: context.source.startedBy ?? 'hotkey', hotkey: context.source.hotkey ?? 'E' },
    play: {
      family: 'penalty',
      subtype: resolution,
      actionTeam: context.play.actionTeam,
      possession: context.play.possession,
      period: context.play.period,
      clock: context.play.clock,
    },
    prePlay: { ...context.prePlay },
    participants: {
      primary: undefined,
      defenders: [],
      penalizedPlayers: state.tokens.penaltyPlayer ? [cloneParticipant(state.tokens.penaltyPlayer)] : [],
      others: [],
    },
    result: {
      code: resolution,
      endYardLine: penalties.find((penalty) => penalty.finalSpot)?.finalSpot ?? context.prePlay.yardLine ?? undefined,
    },
    penalties,
    warnings: [],
  };
}

function attachPenaltiesToDraft(
  draft: FootballDraftIntent,
  penalties: DraftPenalty[],
  context: FootballQuickInputContext,
): FootballDraftIntent {
  const nextDraft = cloneDraft(draft);
  nextDraft.status = 'readyForSummary';
  nextDraft.updatedAt = context.now ?? nextDraft.updatedAt;
  nextDraft.revision += 1;
  nextDraft.penalties = [...nextDraft.penalties.map(clonePenalty), ...penalties.map(clonePenalty)];
  nextDraft.confirmation = undefined;
  nextDraft.participants.penalizedPlayers = [
    ...nextDraft.participants.penalizedPlayers.map(cloneParticipant),
    ...penalties
      .map((penalty) => penalty.playerId)
      .filter((playerId): playerId is string => Boolean(playerId))
      .map((playerId) => stateParticipantByPlayerId(draft, playerId))
      .filter((participant): participant is DraftParticipant => Boolean(participant))
      .map(cloneParticipant),
  ];
  return nextDraft;
}

function stateParticipantByPlayerId(draft: FootballDraftIntent, playerId: string): DraftParticipant | undefined {
  return allDraftParticipants(draft).find((participant) => participant.playerId === playerId);
}

function allDraftParticipants(draft: FootballDraftIntent): DraftParticipant[] {
  return [
    draft.participants.primary,
    draft.participants.secondary,
    ...draft.participants.defenders,
    draft.participants.returner,
    draft.participants.kicker,
    draft.participants.punter,
    draft.participants.holder,
    draft.participants.fumbler,
    draft.participants.forcedBy,
    draft.participants.recoveredBy,
    ...draft.participants.penalizedPlayers,
    ...draft.participants.others,
  ].filter((participant): participant is DraftParticipant => Boolean(participant));
}

function buildDraftPenaltiesFromTokens(
  tokens: FootballFlowTokens,
  context: FootballQuickInputContext,
  baseDraft?: FootballDraftIntent,
): DraftPenalty[] {
  const source = tokens.penaltySource ?? 'immediate';
  const resolution = tokens.penaltyResolution ?? 'accepted';
  const base = buildSingleDraftPenalty(tokens, context, baseDraft, {
    penaltyId: `${context.clientEventId ?? 'fcqi-penalty'}-pen-1`,
    name: tokens.penaltyName,
    code: tokens.penaltyCode,
    definition: tokens.penaltyDefinition,
    team: tokens.penaltyTeam,
    source,
    resolution,
  });

  if (resolution !== 'offsetting') return [base];

  const second = buildSingleDraftPenalty(tokens, context, baseDraft, {
    penaltyId: `${context.clientEventId ?? 'fcqi-penalty'}-pen-2`,
    name: tokens.offsettingSecondName,
    code: tokens.offsettingSecondCode,
    definition: tokens.offsettingSecondDefinition,
    team: tokens.offsettingSecondTeam,
    source,
    resolution,
  });
  return [base, second];
}

function buildSingleDraftPenalty(
  tokens: FootballFlowTokens,
  context: FootballQuickInputContext,
  baseDraft: FootballDraftIntent | undefined,
  input: {
    penaltyId: string;
    name?: string;
    code?: string;
    definition?: FootballPenaltyTableEntry;
    team?: TeamCode;
    source: PenaltySourceSelection;
    resolution: PenaltyResolutionSelection;
  },
): DraftPenalty {
  const penalty: DraftPenalty = {
    penaltyId: input.penaltyId,
    team: input.team ?? context.play.actionTeam,
    code: input.code ?? penaltyCodeFromName(input.name ?? 'Penalty'),
    name: input.name ?? 'Penalty',
    resolution: input.resolution,
    status: input.resolution,
    accepted: input.resolution === 'accepted',
    source: input.source,
    tableYards: input.definition?.yards,
    requiresYards: input.definition?.requiresYards,
    requiresSpot: input.definition?.requiresSpot,
    defaultEnforcement: input.definition?.defaultEnforcement,
    liveBall: input.definition?.liveBall ?? input.source === 'queued',
    automaticFirstDown: input.definition?.automaticFirstDown,
    lossOfDown: input.definition?.lossOfDown,
  };

  if (input.resolution === 'accepted') {
    penalty.playerId = tokens.penaltyPlayer?.playerId ?? null;
    penalty.penalizedPlayerId = tokens.penaltyPlayer?.playerId;
    penalty.enforcedFrom = tokens.penaltyEnforcedFrom ?? (input.source === 'immediate' ? 'PREVIOUS' : undefined);
    penalty.spotOfFoul = tokens.penaltySpotOfFoul;
    penalty.spot = tokens.penaltySpotOfFoul;
    penalty.finalSpot = tokens.penaltyFinalSpot;
    penalty.yards = derivePenaltyYards(context, tokens, baseDraft, penalty.enforcedFrom, penalty.finalSpot);
    penalty.downConsequence = tokens.penaltyDownConsequence ?? (input.source === 'immediate' ? 'REPEAT' : undefined);
    penalty.automaticFirstDown = penalty.downConsequence === 'AUTO_FIRST';
    penalty.lossOfDown = penalty.downConsequence === 'LOSS_OF_DOWN';
    penalty.replayDown = penalty.downConsequence === 'REPEAT';
  }

  if (input.resolution === 'offsetting') {
    penalty.offsetting = typeof tokens.offsettingPreviousPlayCounts === 'boolean'
      ? { previousPlayCounts: tokens.offsettingPreviousPlayCounts }
      : undefined;
    penalty.replayDown = tokens.offsettingPreviousPlayCounts === false;
  }

  return penalty;
}

function validatePenaltyTokenResult(penalties: DraftPenalty[]): FootballQuickInputError | null {
  if (penalties.length === 0) return { code: 'MISSING_PENALTY', message: 'Penalty details are required', field: 'penalties' };
  const resolution = penalties[0]?.status;
  if (resolution === 'accepted') {
    const penalty = penalties[0];
    if (!penalty.finalSpot) return { code: 'MISSING_PENALTY_FINAL_SPOT', message: 'Accepted penalty final spot is required', field: 'penalties.finalSpot' };
    if (penalty.enforcedFrom === 'SPOT' && !penalty.spotOfFoul) return { code: 'MISSING_SPOT_OF_FOUL', message: 'Spot of foul is required', field: 'penalties.spotOfFoul' };
    if (!penalty.enforcedFrom) return { code: 'MISSING_ENFORCED_FROM', message: 'Accepted penalty enforced-from value is required', field: 'penalties.enforcedFrom' };
    if (!penalty.downConsequence) return { code: 'MISSING_DOWN_CONSEQUENCE', message: 'Accepted penalty down consequence is required', field: 'penalties.downConsequence' };
    if (typeof penalty.yards !== 'number') {
      return { code: 'MISSING_PENALTY_YARDS', message: 'Accepted penalty yards could not be derived from enforcement spots', field: 'penalties.yards' };
    }
  }
  if (resolution === 'offsetting') {
    const teams = new Set(penalties.map((penalty) => penalty.team));
    if (teams.size < 2) return { code: 'INVALID_OFFSETTING_TEAMS', message: 'Offsetting penalties require at least one penalty on each team', field: 'penalties' };
    if (penalties.some((penalty) => typeof penalty.offsetting?.previousPlayCounts !== 'boolean')) {
      return { code: 'MISSING_OFFSETTING_PLAY_COUNTS', message: 'Offsetting penalties require previousPlayCounts', field: 'penalties.offsetting.previousPlayCounts' };
    }
  }
  return null;
}

function kickoffCatchSpot(tokens: FootballFlowTokens): Spot | undefined {
  if (tokens.kickReceiveResult === 'return') return tokens.kickReturnStartSpot;
  if (tokens.kickReceiveResult === 'fairCatch') return tokens.kickFairCatchSpot;
  if (tokens.kickReceiveResult === 'outOfBounds') return tokens.kickOutOfBoundsSpot;
  return undefined;
}

function kickoffEndSpot(tokens: FootballFlowTokens, context: FootballQuickInputContext): Spot | undefined {
  if (tokens.kickReceiveResult === 'touchback') {
    return tokens.kickTouchbackSpot ?? context.game.rules?.touchbackSpot;
  }
  if (tokens.kickReceiveResult === 'return') return tokens.returnEndSpot;
  if (tokens.kickReceiveResult === 'fairCatch') return tokens.kickFairCatchSpot;
  if (tokens.kickReceiveResult === 'outOfBounds') return tokens.kickOutOfBoundsSpot;
  return undefined;
}

function puntCatchSpot(tokens: FootballFlowTokens): Spot | undefined {
  if (tokens.puntReceiveResult === 'downed') return tokens.downedSpot ?? tokens.puntSpot;
  return tokens.puntSpot;
}

function puntEndSpot(tokens: FootballFlowTokens, context: FootballQuickInputContext): Spot | undefined {
  if (tokens.puntReceiveResult === 'touchback') {
    return context.game.rules?.touchbackSpot ?? tokens.puntSpot;
  }
  if (tokens.puntReceiveResult === 'return') return tokens.returnEndSpot;
  if (tokens.puntReceiveResult === 'downed') return tokens.downedSpot ?? tokens.puntSpot;
  return tokens.puntSpot;
}

function puntResultCode(result: PuntReceiveResultSelection | undefined): FootballDraftIntent['result']['code'] {
  if (result === 'touchback') return 'touchback';
  if (result === 'fairCatch') return 'fairCatch';
  if (result === 'outOfBounds') return 'outOfBounds';
  if (result === 'muffed') return 'muffed';
  if (result === 'downed') return 'downed';
  return 'returned';
}

function derivePuntYards(context: FootballQuickInputContext, catchYardLine: Spot): number | undefined {
  const possession = context.play.possession ?? context.play.actionTeam;
  const yards = context.calculateRushYards?.({
    startYardLine: context.prePlay.yardLine,
    endYardLine: catchYardLine,
    possession,
  });
  return typeof yards === 'number' ? yards : undefined;
}

function deriveKickoffYards(context: FootballQuickInputContext, catchYardLine: Spot): number | undefined {
  const receivingTeam = opposingTeam(context.play.possession ?? context.play.actionTeam);
  const startYardLine = context.game.rules?.kickoffSpot ?? context.prePlay.yardLine;
  const kickoffSpot = spotToTeamEngineYard(startYardLine, receivingTeam);
  const receiveSpot = spotToTeamEngineYard(catchYardLine, receivingTeam);
  if (typeof kickoffSpot !== 'number' || typeof receiveSpot !== 'number') return undefined;
  return kickoffSpot - receiveSpot;
}

function deriveFieldGoalAttemptYards(context: FootballQuickInputContext, kickSpot: Spot): number | undefined {
  const actionTeam = context.play.possession ?? context.play.actionTeam;
  const engineSpot = spotToTeamEngineYard(kickSpot, actionTeam);
  if (typeof engineSpot !== 'number') return undefined;
  // The entered kick spot is the actual held/kicked spot, so only add end-zone depth.
  return 100 - engineSpot + 10;
}

function deriveReturnYards(context: FootballQuickInputContext, startYardLine: Spot, endYardLine: Spot): number | undefined {
  const returnTeam = opposingTeam(context.play.possession ?? context.play.actionTeam);
  const yards = context.calculateRushYards?.({
    startYardLine,
    endYardLine,
    possession: returnTeam,
  });
  return typeof yards === 'number' ? yards : undefined;
}

function derivePenaltyYards(
  context: FootballQuickInputContext,
  tokens: FootballFlowTokens,
  baseDraft: FootballDraftIntent | undefined,
  enforcedFrom: PenaltyEnforcedFromSelection | undefined,
  finalSpot: Spot | undefined,
): number | undefined {
  if (!enforcedFrom || !finalSpot) return undefined;
  const basisSpot = penaltyEnforcementBasisSpot(context, tokens, baseDraft, enforcedFrom);
  if (!basisSpot) return undefined;
  const possession = baseDraft?.play.possession
    ?? baseDraft?.play.actionTeam
    ?? context.prePlay.possession
    ?? context.play.possession
    ?? context.play.actionTeam;
  const yards = context.calculateRushYards?.({
    startYardLine: basisSpot,
    endYardLine: finalSpot,
    possession,
  });
  if (typeof yards === 'number') return yards;
  const start = spotToTeamEngineYard(basisSpot, possession);
  const end = spotToTeamEngineYard(finalSpot, possession);
  return typeof start === 'number' && typeof end === 'number' ? end - start : undefined;
}

function suggestedPenaltyFinalSpot(
  context: FootballQuickInputContext,
  tokens: FootballFlowTokens,
  baseDraft: FootballDraftIntent | undefined,
): Spot | undefined {
  const tableYards = tokens.penaltyDefinition?.yards;
  const penaltyTeam = tokens.penaltyTeam;
  const enforcedFrom = tokens.penaltyEnforcedFrom;
  if (typeof tableYards !== 'number' || !penaltyTeam || !enforcedFrom) return undefined;

  const basisSpot = penaltyEnforcementBasisSpot(context, tokens, baseDraft, enforcedFrom);
  if (!basisSpot) return undefined;

  const possession = baseDraft?.play.possession
    ?? baseDraft?.play.actionTeam
    ?? context.prePlay.possession
    ?? context.play.possession
    ?? context.play.actionTeam;
  const basisEngineSpot = spotToTeamEngineYard(basisSpot, possession);
  if (typeof basisEngineSpot !== 'number') return undefined;

  const signedPenaltyYards = penaltyTeam === possession ? -Math.abs(tableYards) : Math.abs(tableYards);
  return engineYardToSpot(basisEngineSpot + signedPenaltyYards, possession);
}

function penaltyEnforcementBasisSpot(
  context: FootballQuickInputContext,
  tokens: FootballFlowTokens,
  baseDraft: FootballDraftIntent | undefined,
  enforcedFrom: PenaltyEnforcedFromSelection,
): Spot | undefined {
  if (enforcedFrom === 'PREVIOUS') return context.prePlay.yardLine;
  if (enforcedFrom === 'SPOT') return tokens.penaltySpotOfFoul;
  if (enforcedFrom === 'END') return baseDraft?.result.endYardLine;
  return undefined;
}

function participantFromCandidate(
  candidate: ResolvedPlayerCandidate,
  options: {
    role: FootballQuickInputDuplicateResolution['role'];
    resolution: DraftParticipant['resolution'];
  },
): DraftParticipant {
  const participantRole = participantRoleForResolutionRole(options.role);
  return {
    participantId: `${participantRole}-${candidate.playerId}`,
    playerId: candidate.playerId,
    team: candidate.team,
    role: participantRole,
    jersey: candidate.jersey,
    displayName: candidate.displayName,
    position: candidate.position,
    resolution: { ...options.resolution },
  };
}

function participantRoleForResolutionRole(
  role: FootballQuickInputDuplicateResolution['role'],
): DraftParticipant['role'] {
  if (role === 'passer') return 'passer';
  if (role === 'receiver') return 'receiver';
  if (role === 'intendedReceiver') return 'intendedReceiver';
  if (role === 'punter') return 'punter';
  if (role === 'kicker') return 'kicker';
  if (role === 'returner') return 'returner';
  if (role === 'blocker') return 'blocker';
  if (role === 'downingPlayer') return 'other';
  if (role === 'sack') return 'sack';
  if (role === 'passBreakup') return 'passBreakup';
  if (role === 'hurry') return 'other';
  if (role === 'forcedBy') return 'forcedFumble';
  if (role === 'recoverer') return 'recoverer';
  if (role === 'penalizedPlayer') return 'penalizedPlayer';
  return role;
}

function tokenError(
  state: FootballConfirmedQuickInputState,
  code: string,
  message: string,
  field?: string,
): FootballConfirmedQuickInputState {
  return {
    ...baseActiveState(state),
    status: 'token.error',
    error: { code, message, field },
  };
}

function parseYards(value: string): number | null {
  const trimmed = value.trim();
  if (!/^-?\d+$/.test(trimmed)) return null;
  return Number(trimmed);
}

function parseRushResult(value: string): RushResultSelection | null {
  const normalized = value.trim().toUpperCase();
  if (normalized === 'T' || normalized === 'TACKLE') return 'tackle';
  if (normalized === 'O' || normalized === 'OUT' || normalized === 'OUTOFBOUNDS' || normalized === 'OUT OF BOUNDS') return 'outOfBounds';
  if (normalized === 'F' || normalized === 'FUMBLE') return 'fumble';
  if (normalized === 'C' || normalized === 'LATERAL') return 'lateral';
  if (normalized === '.' || normalized === 'END' || normalized === 'ENDOFPPLAY' || normalized === 'ENDOFPLAY' || normalized === 'END OF PLAY') return 'endOfPlay';
  return null;
}

function rushResultInputCode(value: RushResultSelection | undefined): string {
  if (value === 'tackle') return 'T';
  if (value === 'outOfBounds') return 'O';
  if (value === 'fumble') return 'F';
  if (value === 'lateral') return 'C';
  if (value === 'endOfPlay') return '.';
  return '';
}

function parsePassPrimaryResult(value: string): PassPrimaryResultSelection | null {
  const normalized = value.trim().toUpperCase();
  if (normalized === 'C' || normalized === 'COMPLETE') return 'complete';
  if (normalized === 'I' || normalized === 'INCOMPLETE') return 'incomplete';
  if (normalized === 'S' || normalized === 'SACK') return 'sack';
  if (normalized === 'F' || normalized === 'SACK FUMBLE' || normalized === 'SACKFUMBLE') return 'sackFumble';
  if (normalized === 'R' || normalized === 'RUSH') return 'rushConversion';
  if (normalized === 'X' || normalized === 'INTERCEPTED' || normalized === 'INTERCEPTION') return 'interception';
  return null;
}

function parseCompletePassResult(value: string): CompletePassResultSelection | null {
  const normalized = value.trim().toUpperCase();
  if (normalized === 'T' || normalized === 'TACKLE') return 'tackle';
  if (normalized === 'O' || normalized === 'OUT' || normalized === 'OUTOFBOUNDS' || normalized === 'OUT OF BOUNDS') return 'outOfBounds';
  if (normalized === 'F' || normalized === 'FUMBLE') return 'fumble';
  if (normalized === 'C' || normalized === 'LATERAL') return 'lateral';
  if (normalized === '.' || normalized === 'END' || normalized === 'ENDOFPLAY' || normalized === 'END OF PLAY') return 'endOfPlay';
  return null;
}

function parseKickMenuSelection(value: string): KickMenuSelection | null {
  const normalized = value.trim().toUpperCase();
  if (normalized === 'O' || normalized === 'KICKOFF' || normalized === 'FREE KICK' || normalized === 'FREEKICK') return 'kickoff';
  if (normalized === 'F' || normalized === 'FIELD GOAL' || normalized === 'FIELDGOAL') return 'fieldGoal';
  if (normalized === 'A' || normalized === 'PAT' || normalized === 'TRY') return 'pat';
  return null;
}

function parseFieldGoalResult(value: string): FieldGoalResultSelection | null {
  const normalized = value.trim().toUpperCase();
  if (normalized === 'G' || normalized === 'GOOD') return 'good';
  if (normalized === 'M' || normalized === 'MISSED' || normalized === 'MISS') return 'missed';
  if (normalized === 'B' || normalized === 'BLOCKED' || normalized === 'BLOCK') return 'blocked';
  return null;
}

function parseKickMissedReason(value: string): KickMissedReasonSelection | null {
  const normalized = value.trim().toUpperCase();
  if (normalized === 'R' || normalized === 'WIDE RIGHT' || normalized === 'WIDERIGHT') return 'wideRight';
  if (normalized === 'L' || normalized === 'WIDE LEFT' || normalized === 'WIDELEFT') return 'wideLeft';
  if (normalized === 'S' || normalized === 'SHORT') return 'short';
  if (normalized === 'E' || normalized === 'LEFT UPRIGHT' || normalized === 'LEFTUPRIGHT') return 'leftUpright';
  if (normalized === 'I' || normalized === 'RIGHT UPRIGHT' || normalized === 'RIGHTUPRIGHT') return 'rightUpright';
  if (normalized === 'C' || normalized === 'CROSSBAR') return 'crossbar';
  return null;
}

function parsePatType(value: string): PatTypeSelection | null {
  const normalized = value.trim().toUpperCase();
  if (normalized === 'R' || normalized === 'RUSH') return 'rush';
  if (normalized === 'P' || normalized === 'PASS') return 'pass';
  if (normalized === 'K' || normalized === 'KICK') return 'kick';
  return null;
}

function parsePatKickResult(value: string): PatKickResultSelection | null {
  return parseFieldGoalResult(value);
}

function parsePatRushResult(value: string): PatRushResultSelection | null {
  const normalized = value.trim().toUpperCase();
  if (normalized === 'G' || normalized === 'GOOD') return 'good';
  if (normalized === 'M' || normalized === 'MISSED' || normalized === 'MISS' || normalized === 'FAILED') return 'missed';
  if (normalized === 'F' || normalized === 'FUMBLED' || normalized === 'FUMBLE') return 'fumbled';
  return null;
}

function parsePatPassResult(value: string): PatPassResultSelection | null {
  const normalized = value.trim().toUpperCase();
  if (normalized === 'G' || normalized === 'GOOD') return 'good';
  if (normalized === 'M' || normalized === 'MISSED' || normalized === 'MISS' || normalized === 'FAILED') return 'missed';
  if (normalized === 'I' || normalized === 'INCOMPLETE') return 'incomplete';
  if (normalized === 'X' || normalized === 'INTERCEPTED' || normalized === 'INTERCEPTION') return 'intercepted';
  if (normalized === 'F' || normalized === 'FUMBLED' || normalized === 'FUMBLE') return 'fumbled';
  return null;
}

function resolvePenaltySelection(value: string): {
  code: string;
  name: string;
  definition?: FootballPenaltyTableEntry;
} | null {
  const trimmed = value.trim();
  if (!trimmed) return null;
  const definition = findFootballPenaltyDefinition(trimmed);
  if (definition) {
    return {
      code: definition.code,
      name: definition.name,
      definition,
    };
  }
  return {
    code: penaltyCodeFromName(trimmed),
    name: trimmed,
  };
}

function defaultPenaltyEnforcement(definition: FootballPenaltyTableEntry | undefined): PenaltyEnforcedFromSelection {
  if (definition?.defaultEnforcement === 'SPOT') return 'SPOT';
  if (definition?.defaultEnforcement === 'END') return 'END';
  return 'PREVIOUS';
}

function defaultPenaltyDownConsequence(definition: FootballPenaltyTableEntry | undefined): PenaltyDownConsequenceSelection {
  if (definition?.lossOfDown) return 'LOSS_OF_DOWN';
  if (definition?.automaticFirstDown) return 'AUTO_FIRST';
  return 'REPEAT';
}

function penaltyEnforcedFromInputCode(value: PenaltyEnforcedFromSelection | undefined): string {
  if (value === 'SPOT') return 'F';
  if (value === 'END') return 'S';
  return 'P';
}

function penaltyDownInputCode(value: PenaltyDownConsequenceSelection | undefined): string {
  if (value === 'LOSS_OF_DOWN') return 'L';
  if (value === 'AUTO_FIRST') return 'A';
  return 'R';
}

function parsePenaltyResolution(value: string): PenaltyResolutionSelection | null {
  const normalized = value.trim().toUpperCase();
  if (normalized === 'A' || normalized === 'ACCEPTED') return 'accepted';
  if (normalized === 'D' || normalized === 'DECLINED') return 'declined';
  if (normalized === 'O' || normalized === 'OFFSETTING') return 'offsetting';
  return null;
}

function parsePenaltyEnforcedFrom(value: string): PenaltyEnforcedFromSelection | null {
  const normalized = value.trim().toUpperCase();
  if (normalized === 'P' || normalized === 'PREVIOUS' || normalized === 'PREVIOUS SPOT') return 'PREVIOUS';
  if (normalized === 'F' || normalized === 'SPOT' || normalized === 'SPOT OF FOUL') return 'SPOT';
  if (normalized === 'S' || normalized === 'END' || normalized === 'SUCCEEDING' || normalized === 'SUCCEEDING SPOT') return 'END';
  return null;
}

function parsePenaltyDownConsequence(value: string): PenaltyDownConsequenceSelection | null {
  const normalized = value.trim().toUpperCase();
  if (normalized === 'R' || normalized === 'REPEAT' || normalized === 'REPEAT DOWN') return 'REPEAT';
  if (normalized === 'L' || normalized === 'LOSS' || normalized === 'LOSS OF DOWN') return 'LOSS_OF_DOWN';
  if (normalized === 'A' || normalized === 'AUTO' || normalized === 'AUTO 1ST' || normalized === 'AUTO FIRST') return 'AUTO_FIRST';
  return null;
}

function parseGameControlMenuSelection(value: string): GameControlMenuSelection | null {
  const normalized = value.trim().toUpperCase();
  if (normalized === 'E' || normalized === 'EMERGENCY') return 'emergency';
  if (normalized === 'Q' || normalized === 'QUARTER' || normalized === 'QUARTER FUNCTIONS') return 'quarter';
  if (normalized === 'B' || normalized === 'BALL' || normalized === 'BALL CONTEXT') return 'ballContext';
  if (normalized === 'D' || normalized === 'DRIVE' || normalized === 'DRIVE START') return 'driveStart';
  if (normalized === 'P' || normalized === 'POSSESSION' || normalized === 'SET POSSESSION') return 'setPossession';
  if (normalized === 'C' || normalized === 'COIN' || normalized === 'COIN TOSS') return 'coinToss';
  if (normalized === 'R' || normalized === 'ROSTER' || normalized === 'ROSTER FUNCTIONS') return 'roster';
  return null;
}

function parseGameControlQuarterSelection(value: string): GameControlQuarterSelection | null {
  const normalized = value.trim().toUpperCase();
  if (normalized === 'S' || normalized === 'START' || normalized === 'START QUARTER') return 'startQuarter';
  if (normalized === 'E' || normalized === 'END' || normalized === 'END QUARTER') return 'endQuarter';
  return null;
}

function parseDown(value: string): number | null {
  const down = parseNonNegativeInteger(value);
  if (down === null || down < 1 || down > 4) return null;
  return down;
}

function parseNonNegativeInteger(value: string): number | null {
  const trimmed = value.trim();
  if (!/^\d+$/.test(trimmed)) return null;
  return Number(trimmed);
}

function penaltyCodeFromName(name: string): string {
  const words = name.trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return 'PEN';
  return words.map((word) => word[0]?.toUpperCase() ?? '').join('').slice(0, 6) || 'PEN';
}

function nextStepForRushResult(result: RushResultSelection): RushTokenStep {
  if (result === 'tackle') return 'tackleAJersey';
  if (result === 'outOfBounds') return 'tackleAJersey';
  if (result === 'fumble') return 'forcedByJersey';
  return 'endSpot';
}

function nextStepForPassResult(result: PassPrimaryResultSelection): PassTokenStep {
  if (result === 'complete') return 'receiverJersey';
  if (result === 'sack' || result === 'sackFumble') return 'sackDefenderAJersey';
  return 'intendedReceiverJersey';
}

function nextStepForCompletePassResult(result: CompletePassResultSelection): FootballTokenStep {
  if (result === 'tackle' || result === 'outOfBounds') return 'tackleAJersey';
  return 'endSpot';
}

function completeResultCode(result: CompletePassResultSelection | undefined): 'T' | 'O' | 'F' | 'C' | '.' | undefined {
  if (result === 'tackle') return 'T';
  if (result === 'outOfBounds') return 'O';
  if (result === 'fumble') return 'F';
  if (result === 'lateral') return 'C';
  if (result === 'endOfPlay') return '.';
  return undefined;
}

function parsePuntReceiveResult(value: string): PuntReceiveResultSelection | null {
  const normalized = value.trim().toUpperCase();
  if (normalized === 'R' || normalized === 'RETURN') return 'return';
  if (normalized === 'T' || normalized === 'TOUCHBACK') return 'touchback';
  if (normalized === 'C' || normalized === 'FAIR CATCH' || normalized === 'FAIRCATCH') return 'fairCatch';
  if (normalized === 'O' || normalized === 'OUT' || normalized === 'OUTOFBOUNDS' || normalized === 'OUT OF BOUNDS') return 'outOfBounds';
  if (normalized === 'M' || normalized === 'MUFF' || normalized === 'MUFFED') return 'muffed';
  if (normalized === 'D' || normalized === 'DOWN' || normalized === 'DOWNED') return 'downed';
  return null;
}

function parseReturnTerminalResult(value: string): ReturnTerminalResultSelection | null {
  const normalized = value.trim().toUpperCase();
  if (normalized === 'T' || normalized === 'TACKLE') return 'tackle';
  if (normalized === 'O' || normalized === 'OUT' || normalized === 'OUTOFBOUNDS' || normalized === 'OUT OF BOUNDS') return 'outOfBounds';
  if (normalized === 'F' || normalized === 'FUMBLE') return 'fumble';
  if (normalized === 'C' || normalized === 'LATERAL') return 'lateral';
  if (normalized === '.' || normalized === 'END' || normalized === 'ENDOFPLAY' || normalized === 'END OF PLAY') return 'endOfPlay';
  return null;
}

function puntReceiveResultCode(result: PuntReceiveResultSelection | undefined): 'R' | 'T' | 'C' | 'O' | 'M' | 'D' | undefined {
  if (result === 'return') return 'R';
  if (result === 'touchback') return 'T';
  if (result === 'fairCatch') return 'C';
  if (result === 'outOfBounds') return 'O';
  if (result === 'muffed') return 'M';
  if (result === 'downed') return 'D';
  return undefined;
}

function returnTerminalResultCode(result: ReturnTerminalResultSelection | undefined): 'T' | 'O' | 'F' | 'C' | '.' | undefined {
  if (result === 'tackle') return 'T';
  if (result === 'outOfBounds') return 'O';
  if (result === 'fumble') return 'F';
  if (result === 'lateral') return 'C';
  if (result === 'endOfPlay') return '.';
  return undefined;
}

function nextStepAfterDuplicate(
  role: FootballQuickInputDuplicateResolution['role'],
  state: FootballConfirmedQuickInputState,
): FootballTokenStep | undefined {
  if (role === 'rusher') return state.flow === 'kick' && state.tokens.patType === 'rush' ? 'patRushResult' : 'result';
  if (role === 'passer') return state.flow === 'kick' && state.tokens.patType === 'pass' ? 'patReceiverJersey' : 'passResult';
  if (role === 'receiver') return state.flow === 'kick' && state.tokens.patType === 'pass' ? 'patPassResult' : 'caughtAtSpot';
  if (role === 'intendedReceiver') return 'passYardLine';
  if (role === 'punter') return 'puntSpot';
  if (role === 'kicker') {
    if (state.flow === 'kick' && state.tokens.kickMenuSelection === 'fieldGoal') return 'fieldGoalSpot';
    if (state.flow === 'kick' && state.tokens.kickMenuSelection === 'pat') return 'patKickResult';
    return 'kickReceiveResult';
  }
  if (role === 'blocker') return undefined;
  if (role === 'returner') {
    if (state.flow === 'kick') {
      return state.tokens.kickReceiveResult === 'fairCatch' ? 'kickFairCatchSpot' : 'kickReturnStartSpot';
    }
    return state.tokens.puntReceiveResult === 'fairCatch' ? undefined : 'returnTerminalResult';
  }
  if (role === 'downingPlayer') return 'downedSpot';
  if (role === 'tackler') {
    return state.currentStep === 'tackleAJersey' || state.currentStep === 'tacklerJersey'
      ? 'tackleBJersey'
      : 'endSpot';
  }
  if (role === 'sack') {
    return state.currentStep === 'sackDefenderAJersey'
      ? 'sackDefenderBJersey'
      : 'sackSpot';
  }
  if (role === 'passBreakup') return 'hurried';
  if (role === 'hurry') {
    if (state.currentStep === 'hurryDefender1Jersey') return 'hurryDefender2Jersey';
    if (state.currentStep === 'hurryDefender2Jersey') return 'hurryDefender3Jersey';
    return undefined;
  }
  if (role === 'forcedBy') return 'recoverTeam';
  if (role === 'recoverer') return 'recoverSpot';
  if (role === 'penalizedPlayer') return (state.tokens.penaltySource ?? 'immediate') === 'immediate'
    ? 'penaltyFinalSpot'
    : 'penaltyEnforcedFrom';
  return undefined;
}

function stepForDuplicateRole(
  role: FootballQuickInputDuplicateResolution['role'],
  state?: FootballConfirmedQuickInputState,
): FootballTokenStep {
  if (state?.currentStep && String(state.currentStep).endsWith('Jersey')) return state.currentStep;
  if (role === 'rusher') return 'rusherJersey';
  if (role === 'passer') return 'passerJersey';
  if (role === 'receiver') return 'receiverJersey';
  if (role === 'intendedReceiver') return 'intendedReceiverJersey';
  if (role === 'punter') return 'punterJersey';
  if (role === 'kicker') return 'kickerJersey';
  if (role === 'blocker') return 'fieldGoalBlockedByJersey';
  if (role === 'returner') return 'returnerJersey';
  if (role === 'downingPlayer') return 'downingPlayerJersey';
  if (role === 'sack') return 'sackDefenderAJersey';
  if (role === 'passBreakup') return 'brokenUpDefenderJersey';
  if (role === 'hurry') return 'hurryDefender1Jersey';
  if (role === 'forcedBy') return 'forcedByJersey';
  if (role === 'recoverer') return 'recoverPlayerJersey';
  if (role === 'penalizedPlayer') return 'penaltyPlayerJersey';
  return 'tackleAJersey';
}

function parseSpot(value: string): Spot | null {
  const normalized = value.trim().toUpperCase();
  if (isCanonicalSpot(normalized)) return normalized;
  return null;
}

function parseOptionalSpot(value: string): Spot | false | null {
  if (!value.trim()) return null;
  return parseSpot(value) ?? false;
}

function parseTeamCode(value: string): TeamCode | null {
  const normalized = value.trim().toUpperCase();
  if (normalized === 'H' || normalized === 'HOME') return 'H';
  if (normalized === 'V' || normalized === 'VISITOR' || normalized === 'AWAY') return 'V';
  return null;
}

function parseBooleanToken(value: string): boolean | null {
  const normalized = value.trim().toLowerCase();
  if (['y', 'yes', 'true', '1', 'returned'].includes(normalized)) return true;
  if (['n', 'no', 'false', '0', 'down'].includes(normalized)) return false;
  return null;
}

function parseOptionalBooleanToken(value: string): boolean | null {
  if (!value.trim()) return false;
  return parseBooleanToken(value);
}

function buildRushResult(tokens: RushFlowTokens, context: FootballQuickInputContext): FootballDraftIntent['result'] {
  const code = rushResultCode(tokens.result);
  const endYardLine = tokens.result === 'fumble' ? tokens.recoverSpot : tokens.endYardLine;
  const yards = endYardLine ? (tokens.yards ?? deriveRushYards(context, endYardLine)) : tokens.yards;
  const base = {
    code,
    yards,
    endYardLine,
    driveEnds: false,
  };

  if (tokens.result !== 'fumble') return base;

  const actionTeam = context.play.possession ?? context.play.actionTeam;
  const turnover = Boolean(tokens.recoverTeam && tokens.recoverTeam !== actionTeam);
  return {
    ...base,
    fumble: {
      fumblerPlayerId: tokens.rusher?.playerId ?? '',
      forcedByPlayerId: tokens.forcedBy?.playerId,
      spot: tokens.recoverSpot,
      recoveredByPlayerId: tokens.recoverPlayer?.playerId,
      recoveredByTeam: tokens.recoverTeam,
      recoverySpot: tokens.recoverSpot,
      turnover,
    },
    turnover: turnover
      ? {
          type: 'fumble',
          team: tokens.recoverTeam,
          playerId: tokens.recoverPlayer?.playerId,
          spot: tokens.recoverSpot,
        }
      : undefined,
    nextPossession: turnover ? tokens.recoverTeam : context.play.possession,
  };
}

function rushResultCode(result: RushResultSelection | undefined): FootballDraftIntent['result']['code'] {
  if (result === 'outOfBounds') return 'outOfBounds';
  if (result === 'fumble') return 'fumble';
  return 'tackle';
}

function deriveRushYards(context: FootballQuickInputContext, endYardLine: Spot): number | undefined {
  if (!context.deriveRushYardsFromEndSpot) return undefined;
  const possession = context.play.possession ?? context.play.actionTeam;
  const yards = context.calculateRushYards?.({
    startYardLine: context.prePlay.yardLine,
    endYardLine,
    possession,
  });
  return typeof yards === 'number' ? yards : undefined;
}

function opposingTeam(team: TeamCode): TeamCode {
  return team === 'H' ? 'V' : 'H';
}

function spotToTeamEngineYard(spot: Spot | null | undefined, team: TeamCode): number | undefined {
  if (!spot) return undefined;
  if (spot === '50' || spot === 'H50' || spot === 'V50') return 50;
  const side = spot.slice(0, 1);
  const yard = Number(spot.slice(1));
  if ((side !== 'H' && side !== 'V') || !Number.isFinite(yard)) return undefined;
  return side === team ? yard : 100 - yard;
}

function engineYardToSpot(value: number, team: TeamCode): Spot | undefined {
  if (!Number.isFinite(value)) return undefined;
  const clamped = Math.max(0, Math.min(100, Math.round(value)));
  if (clamped === 50) return '50';
  if (clamped <= 50) return `${team}${clamped}` as Spot;
  const opposite = opposingTeam(team);
  return `${opposite}${100 - clamped}` as Spot;
}

function deriveLineToGain(spot: Spot, distance: number, possession: TeamCode): Spot | undefined {
  const engineSpot = spotToTeamEngineYard(spot, possession);
  if (typeof engineSpot !== 'number') return undefined;
  return engineYardToSpot(engineSpot + distance, possession);
}

function isTokenInputState(state: FootballConfirmedQuickInputState): boolean {
  return state.status === 'token.awaiting' || state.status === 'token.error';
}

function isPassSpecificTokenStep(step: FootballTokenStep): step is PassTokenStep {
  return [
    'passerJersey',
    'passResult',
    'receiverJersey',
    'caughtAtSpot',
    'completeResult',
    'intendedReceiverJersey',
    'passYardLine',
    'brokenUp',
    'brokenUpDefenderJersey',
    'hurried',
    'hurryDefender1Jersey',
    'hurryDefender2Jersey',
    'hurryDefender3Jersey',
    'sackDefenderAJersey',
    'sackDefenderBJersey',
    'sackSpot',
  ].includes(step);
}

function isPuntSpecificTokenStep(step: FootballTokenStep): step is PuntTokenStep {
  return [
    'punterJersey',
    'puntSpot',
    'puntReceiveResult',
    'returnerJersey',
    'returnTerminalResult',
    'returnTackleAJersey',
    'returnTackleBJersey',
    'returnEndSpot',
    'downingPlayerJersey',
    'downedSpot',
  ].includes(step);
}

function isKickSpecificTokenStep(step: FootballTokenStep): step is KickTokenStep {
  return [
    'kickMenu',
    'kickerJersey',
    'kickReceiveResult',
    'returnerJersey',
    'kickReturnStartSpot',
    'returnTerminalResult',
    'returnTackleAJersey',
    'returnTackleBJersey',
    'returnEndSpot',
    'kickTouchbackSpot',
    'kickFairCatchSpot',
    'kickOutOfBoundsSpot',
    'fieldGoalSpot',
    'fieldGoalResult',
    'fieldGoalMissedReason',
    'fieldGoalBlockedByJersey',
    'fieldGoalReturnAttempted',
    'patType',
    'patKickResult',
    'patKickMissedReason',
    'patKickBlockedByJersey',
    'patKickReturnAttempted',
    'patRusherJersey',
    'patRushResult',
    'patRushReturnAttempted',
    'patPasserJersey',
    'patReceiverJersey',
    'patPassResult',
    'patPassReturnAttempted',
  ].includes(step);
}

function isPenaltySpecificTokenStep(step: FootballTokenStep): step is PenaltyTokenStep {
  return [
    'penaltyName',
    'penaltyTeam',
    'penaltyResolution',
    'penaltyPlayerJersey',
    'penaltyEnforcedFrom',
    'penaltySpotOfFoul',
    'penaltyFinalSpot',
    'penaltyDown',
    'offsettingSecondName',
    'offsettingSecondTeam',
    'offsettingPlayCounts',
  ].includes(step);
}

function isGameControlSpecificTokenStep(step: FootballTokenStep): step is GameControlTokenStep {
  return [
    'gameControlMenu',
    'gameControlQuarterMenu',
    'gameControlDown',
    'gameControlDistance',
    'gameControlSpot',
    'gameControlPossession',
  ].includes(step);
}

function isActivePlayState(state: FootballConfirmedQuickInputState): boolean {
  return (state.flow === 'rush' || state.flow === 'pass' || state.flow === 'punt' || state.flow === 'kick' || state.flow === 'penalty')
    && state.status !== 'idle'
    && state.status !== 'cancelled'
    && state.status !== 'submitted';
}

function baseActiveState(state: FootballConfirmedQuickInputState): FootballConfirmedQuickInputState {
  return {
    ...cloneState(state),
    error: undefined,
  };
}

function cancelledState(): FootballConfirmedQuickInputState {
  return {
    status: 'cancelled',
    currentToken: '',
    tokens: initialTokens(),
  };
}

function cloneState(state: FootballConfirmedQuickInputState): FootballConfirmedQuickInputState {
  return {
    ...state,
    tokens: cloneTokens(state.tokens),
    draft: state.draft ? cloneDraft(state.draft) : undefined,
    summary: state.summary ? cloneSummary(state.summary) : undefined,
    duplicate: state.duplicate ? cloneDuplicate(state.duplicate) : undefined,
    error: state.error ? { ...state.error } : undefined,
  };
}

function initialTokens(): FootballFlowTokens {
  return {
    tacklers: [],
    hurryDefenders: [],
    sackDefenders: [],
  };
}

function cloneTokens(tokens: FootballFlowTokens): FootballFlowTokens {
  return {
    rusher: tokens.rusher ? cloneParticipant(tokens.rusher) : undefined,
    result: tokens.result,
    yards: tokens.yards,
    endYardLine: tokens.endYardLine,
    forcedBy: tokens.forcedBy ? cloneParticipant(tokens.forcedBy) : undefined,
    recoverTeam: tokens.recoverTeam,
    recoverPlayer: tokens.recoverPlayer ? cloneParticipant(tokens.recoverPlayer) : undefined,
    recoverSpot: tokens.recoverSpot,
    fumbleReturned: tokens.fumbleReturned,
    returnFlow: tokens.returnFlow ? { ...tokens.returnFlow } : undefined,
    tacklers: tokens.tacklers.map(cloneParticipant),
    passer: tokens.passer ? cloneParticipant(tokens.passer) : undefined,
    passResult: tokens.passResult,
    receiver: tokens.receiver ? cloneParticipant(tokens.receiver) : undefined,
    caughtAtSpot: tokens.caughtAtSpot,
    completeResult: tokens.completeResult,
    intendedReceiver: tokens.intendedReceiver ? cloneParticipant(tokens.intendedReceiver) : undefined,
    passYardLine: tokens.passYardLine,
    brokenUp: tokens.brokenUp,
    brokenUpBy: tokens.brokenUpBy ? cloneParticipant(tokens.brokenUpBy) : undefined,
    hurried: tokens.hurried,
    hurryDefenders: tokens.hurryDefenders.map(cloneParticipant),
    sackDefenders: tokens.sackDefenders.map(cloneParticipant),
    sackSpot: tokens.sackSpot,
    punter: tokens.punter ? cloneParticipant(tokens.punter) : undefined,
    puntSpot: tokens.puntSpot,
    puntReceiveResult: tokens.puntReceiveResult,
    returner: tokens.returner ? cloneParticipant(tokens.returner) : undefined,
    returnTerminalResult: tokens.returnTerminalResult,
    returnEndSpot: tokens.returnEndSpot,
    downingPlayer: tokens.downingPlayer ? cloneParticipant(tokens.downingPlayer) : undefined,
    downedSpot: tokens.downedSpot,
    kickMenuSelection: tokens.kickMenuSelection,
    kicker: tokens.kicker ? cloneParticipant(tokens.kicker) : undefined,
    kickReceiveResult: tokens.kickReceiveResult,
    kickReturnStartSpot: tokens.kickReturnStartSpot,
    kickTouchbackSpot: tokens.kickTouchbackSpot,
    kickFairCatchSpot: tokens.kickFairCatchSpot,
    kickOutOfBoundsSpot: tokens.kickOutOfBoundsSpot,
    fieldGoalSpot: tokens.fieldGoalSpot,
    fieldGoalResult: tokens.fieldGoalResult,
    fieldGoalMissedReason: tokens.fieldGoalMissedReason,
    fieldGoalReturnAttempted: tokens.fieldGoalReturnAttempted,
    patType: tokens.patType,
    patKickResult: tokens.patKickResult,
    patKickMissedReason: tokens.patKickMissedReason,
    patKickReturnAttempted: tokens.patKickReturnAttempted,
    patRushResult: tokens.patRushResult,
    patRushReturnAttempted: tokens.patRushReturnAttempted,
    patPassResult: tokens.patPassResult,
    patPassReturnAttempted: tokens.patPassReturnAttempted,
    penaltySource: tokens.penaltySource,
    penaltyName: tokens.penaltyName,
    penaltyCode: tokens.penaltyCode,
    penaltyDefinition: tokens.penaltyDefinition ? { ...tokens.penaltyDefinition } : undefined,
    penaltyTeam: tokens.penaltyTeam,
    penaltyResolution: tokens.penaltyResolution,
    penaltyPlayer: tokens.penaltyPlayer ? cloneParticipant(tokens.penaltyPlayer) : undefined,
    penaltyEnforcedFrom: tokens.penaltyEnforcedFrom,
    penaltySpotOfFoul: tokens.penaltySpotOfFoul,
    penaltyFinalSpot: tokens.penaltyFinalSpot,
    penaltyDownConsequence: tokens.penaltyDownConsequence,
    offsettingSecondName: tokens.offsettingSecondName,
    offsettingSecondCode: tokens.offsettingSecondCode,
    offsettingSecondDefinition: tokens.offsettingSecondDefinition ? { ...tokens.offsettingSecondDefinition } : undefined,
    offsettingSecondTeam: tokens.offsettingSecondTeam,
    offsettingPreviousPlayCounts: tokens.offsettingPreviousPlayCounts,
    gameControlSelection: tokens.gameControlSelection,
    gameControlQuarterSelection: tokens.gameControlQuarterSelection,
    gameControlDown: tokens.gameControlDown,
    gameControlDistance: tokens.gameControlDistance,
    gameControlSpot: tokens.gameControlSpot,
    gameControlLineToGain: tokens.gameControlLineToGain,
    gameControlPossession: tokens.gameControlPossession,
  };
}

function cloneParticipant(participant: DraftParticipant): DraftParticipant {
  return {
    ...participant,
    resolution: {
      ...participant.resolution,
      duplicateCandidateIds: participant.resolution.duplicateCandidateIds
        ? [...participant.resolution.duplicateCandidateIds]
        : undefined,
    },
  };
}

function clonePenalty(penalty: DraftPenalty): DraftPenalty {
  return {
    ...penalty,
    offsetting: penalty.offsetting ? { ...penalty.offsetting } : undefined,
  };
}

function cloneDraft(draft: FootballDraftIntent): FootballDraftIntent {
  return {
    ...draft,
    game: cloneGameContext(draft.game),
    source: { ...draft.source },
    play: { ...draft.play },
    prePlay: { ...draft.prePlay },
    participants: {
      primary: draft.participants.primary ? cloneParticipant(draft.participants.primary) : undefined,
      secondary: draft.participants.secondary ? cloneParticipant(draft.participants.secondary) : undefined,
      defenders: draft.participants.defenders.map(cloneParticipant),
      returner: draft.participants.returner ? cloneParticipant(draft.participants.returner) : undefined,
      kicker: draft.participants.kicker ? cloneParticipant(draft.participants.kicker) : undefined,
      punter: draft.participants.punter ? cloneParticipant(draft.participants.punter) : undefined,
      holder: draft.participants.holder ? cloneParticipant(draft.participants.holder) : undefined,
      fumbler: draft.participants.fumbler ? cloneParticipant(draft.participants.fumbler) : undefined,
      forcedBy: draft.participants.forcedBy ? cloneParticipant(draft.participants.forcedBy) : undefined,
      recoveredBy: draft.participants.recoveredBy ? cloneParticipant(draft.participants.recoveredBy) : undefined,
      penalizedPlayers: draft.participants.penalizedPlayers.map(cloneParticipant),
      others: draft.participants.others.map(cloneParticipant),
    },
    result: {
      ...draft.result,
      pass: draft.result.pass ? { ...draft.result.pass } : undefined,
      kick: draft.result.kick ? { ...draft.result.kick } : undefined,
      return: draft.result.return ? { ...draft.result.return } : undefined,
      fumble: draft.result.fumble ? { ...draft.result.fumble } : undefined,
      turnover: draft.result.turnover ? { ...draft.result.turnover } : undefined,
      scoring: draft.result.scoring ? { ...draft.result.scoring } : undefined,
    },
    penalties: draft.penalties.map(clonePenalty),
    warnings: draft.warnings.map((warning) => ({ ...warning })),
    confirmation: draft.confirmation
      ? {
          ...draft.confirmation,
          warningsAcknowledged: [...draft.confirmation.warningsAcknowledged],
        }
      : undefined,
  };
}

function cloneGameContext(game: FootballDraftIntent['game']): FootballDraftIntent['game'] {
  return {
    ...game,
    teams: {
      H: { ...game.teams.H },
      V: { ...game.teams.V },
    },
    rules: game.rules ? { ...game.rules } : undefined,
  };
}

function cloneSummary(summary: FootballPlaySummaryResult): FootballPlaySummaryResult {
  return {
    summaryText: summary.summaryText,
    warnings: summary.warnings.map((warning) => ({ ...warning })),
  };
}

function cloneDuplicate(duplicate: FootballQuickInputDuplicateResolution): FootballQuickInputDuplicateResolution {
  return {
    ...duplicate,
    candidates: [...duplicate.candidates],
    recommended: duplicate.recommended,
  };
}
