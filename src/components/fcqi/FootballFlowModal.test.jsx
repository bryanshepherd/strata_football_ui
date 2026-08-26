import React from 'react';
import { fireEvent, render, screen, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import FootballFlowModal from './FootballFlowModal';

describe('FootballFlowModal team aliases', () => {
  it('offers Spike, Kneel Down, and Aborted Play as team-charged choices', () => {
    const onTokenCommit = vi.fn();
    render(
      <FootballFlowModal
        onCancel={vi.fn()}
        onStepClick={vi.fn()}
        onTokenCommit={onTokenCommit}
        state={{
          status: 'token.awaiting',
          flow: 'teamPlay',
          currentStep: 'teamPlayMenu',
          currentToken: '',
          tokens: { laterals: [], tacklers: [], hurryDefenders: [], sackDefenders: [] },
        }}
      />,
    );

    expect(screen.getByRole('button', { name: /^Spike\b/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /^Kneel Down\b/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /^Aborted Play\b/ })).toBeInTheDocument();
    expect(screen.queryByText(/Team incomplete pass/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/Team rush; player retained/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/Team rush and team fumble/i)).not.toBeInTheDocument();
    fireEvent.keyDown(window, { key: 'k', code: 'KeyK' });
    expect(onTokenCommit).toHaveBeenCalledWith('K');
  });

  it('asks for the fumble yard line first in the Aborted Play flow', () => {
    render(
      <FootballFlowModal
        onCancel={vi.fn()}
        onStepClick={vi.fn()}
        onTokenCommit={vi.fn()}
        state={{
          status: 'token.awaiting',
          flow: 'teamPlay',
          currentStep: 'teamPlayFumbleSpot',
          currentToken: '',
          tokens: {
            teamPlaySelection: 'aborted',
            result: 'fumble',
            laterals: [],
            tacklers: [],
            hurryDefenders: [],
            sackDefenders: [],
          },
        }}
      />,
    );

    expect(screen.getByRole('textbox', { name: 'Fumbled At' })).toBeInTheDocument();
  });

  it('uses Backspace for text editing until the field is empty, then goes back a step', () => {
    const onBackStep = vi.fn();
    render(
      <FootballFlowModal
        onBackStep={onBackStep}
        onCancel={vi.fn()}
        onStepClick={vi.fn()}
        onTokenCommit={vi.fn()}
        state={{
          status: 'token.awaiting',
          flow: 'rush',
          currentStep: 'rusherJersey',
          currentToken: '22',
          tokens: { laterals: [], tacklers: [], hurryDefenders: [], sackDefenders: [] },
        }}
      />,
    );

    const input = screen.getByRole('textbox', { name: /rusher jersey/i });
    fireEvent.keyDown(input, { key: 'Backspace', code: 'Backspace' });
    expect(onBackStep).not.toHaveBeenCalled();

    fireEvent.change(input, { target: { value: '' } });
    fireEvent.keyDown(input, { key: 'Backspace', code: 'Backspace' });
    expect(onBackStep).toHaveBeenCalledTimes(1);
  });

  it('uses Backspace immediately on a button-only step', () => {
    const onBackStep = vi.fn();
    render(
      <FootballFlowModal
        onBackStep={onBackStep}
        onCancel={vi.fn()}
        onStepClick={vi.fn()}
        onTokenCommit={vi.fn()}
        state={{
          status: 'token.awaiting',
          flow: 'rush',
          currentStep: 'result',
          currentToken: '',
          tokens: { laterals: [], tacklers: [], hurryDefenders: [], sackDefenders: [] },
        }}
      />,
    );

    fireEvent.keyDown(window, { key: 'Backspace', code: 'Backspace' });
    expect(onBackStep).toHaveBeenCalledTimes(1);
  });

  it('maps the physical Escape key to the modal Esc control', () => {
    const onCancel = vi.fn();
    render(
      <FootballFlowModal
        onCancel={onCancel}
        onStepClick={vi.fn()}
        onTokenCommit={vi.fn()}
        state={{
          status: 'token.awaiting',
          flow: 'rush',
          currentStep: 'rusherJersey',
          currentToken: '',
          tokens: { laterals: [], tacklers: [], hurryDefenders: [], sackDefenders: [] },
        }}
      />,
    );

    fireEvent.keyDown(window, { key: 'Escape', code: 'Escape' });

    expect(onCancel).toHaveBeenCalledTimes(1);
  });

  it('offers the configured kickoff touchback advance decision with keyboard choices', () => {
    const onTokenCommit = vi.fn();
    render(
      <FootballFlowModal
        onCancel={vi.fn()}
        onStepClick={vi.fn()}
        onTokenCommit={onTokenCommit}
        state={{
          status: 'token.awaiting',
          flow: 'kick',
          currentStep: 'kickDownedTouchbackDecision',
          currentToken: '',
          tokens: {
            laterals: [],
            tacklers: [],
            hurryDefenders: [],
            sackDefenders: [],
            downedSpot: 'V10',
            kickDownedTouchbackTargetSpot: 'V20',
          },
        }}
      />,
    );

    expect(screen.getByRole('dialog', { name: 'Advance Ball To Touchback Spot?' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Advance Ball Y' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Keep Downed Spot N' })).toBeInTheDocument();
    expect(screen.getByText(/downed at V10, before the configured V20/i)).toBeInTheDocument();

    fireEvent.keyDown(window, { key: 'y', code: 'KeyY' });
    expect(onTokenCommit).toHaveBeenLastCalledWith('Y');
  });

  it('offers the configured fair-catch touchback advance decision with fair-catch wording', () => {
    const onTokenCommit = vi.fn();
    render(
      <FootballFlowModal
        onCancel={vi.fn()}
        onStepClick={vi.fn()}
        onTokenCommit={onTokenCommit}
        state={{
          status: 'token.awaiting',
          flow: 'kick',
          currentStep: 'kickFairCatchTouchbackDecision',
          currentToken: '',
          tokens: {
            laterals: [],
            tacklers: [],
            hurryDefenders: [],
            sackDefenders: [],
            kickFairCatchSpot: 'V10',
            kickFairCatchTouchbackTargetSpot: 'V20',
          },
        }}
      />,
    );

    expect(screen.getByRole('dialog', { name: 'Advance Ball To Touchback Spot?' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Advance Ball Y' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Keep Fair Catch Spot N' })).toBeInTheDocument();
    expect(screen.getByText(/fair caught at V10, before the configured V20/i)).toBeInTheDocument();

    fireEvent.keyDown(window, { key: 'n', code: 'KeyN' });
    expect(onTokenCommit).toHaveBeenLastCalledWith('N');
  });

  it('shows the full ruleset penalty catalog before the operator filters it', () => {
    const { rerender } = render(
      <FootballFlowModal
        onCancel={vi.fn()}
        onStepClick={vi.fn()}
        onTokenCommit={vi.fn()}
        penaltyRuleset="NCAA"
        state={{
          status: 'token.awaiting',
          flow: 'penalty',
          currentStep: 'penaltyName',
          currentToken: '',
          tokens: { laterals: [], tacklers: [], hurryDefenders: [], sackDefenders: [] },
        }}
      />,
    );

    expect(screen.getByRole('button', { name: /helping ball carrier/i })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /incidental face mask/i })).not.toBeInTheDocument();

    rerender(
      <FootballFlowModal
        onCancel={vi.fn()}
        onStepClick={vi.fn()}
        onTokenCommit={vi.fn()}
        penaltyRuleset="NFHS"
        state={{
          status: 'token.awaiting',
          flow: 'penalty',
          currentStep: 'penaltyName',
          currentToken: '',
          tokens: { laterals: [], tacklers: [], hurryDefenders: [], sackDefenders: [] },
        }}
      />,
    );

    expect(screen.getByRole('button', { name: /incidental face mask/i })).toBeInTheDocument();
  });

  it('capitalizes a recovering-team letter as it is entered', () => {
    render(
      <FootballFlowModal
        onCancel={vi.fn()}
        onStepClick={vi.fn()}
        onTokenCommit={vi.fn()}
        state={{
          status: 'token.awaiting',
          flow: 'kick',
          currentStep: 'recoverTeam',
          currentToken: '',
          tokens: { laterals: [], tacklers: [], hurryDefenders: [], sackDefenders: [] },
        }}
        teamAliases={{ H: 'W', V: 'F' }}
      />,
    );

    const input = screen.getByRole('textbox', { name: /recovering team/i });
    fireEvent.change(input, { target: { value: 'w' } });
    expect(input).toHaveValue('W');
  });

  it('accepts three- or four-digit game clocks and hides an optional leading zero', () => {
    const onTokenCommit = vi.fn();
    render(
      <FootballFlowModal
        onCancel={vi.fn()}
        onStepClick={vi.fn()}
        onTokenCommit={onTokenCommit}
        state={{
          status: 'token.awaiting',
          flow: 'gameControl',
          currentStep: 'gameControlClock',
          currentToken: '08:42',
          tokens: { laterals: [], tacklers: [], hurryDefenders: [], sackDefenders: [] },
        }}
      />,
    );

    const input = screen.getByRole('textbox', { name: 'Game Clock' });
    expect(input).toHaveAttribute('inputmode', 'numeric');
    expect(input).toHaveValue('8:42');

    fireEvent.change(input, { target: { value: '801' } });
    expect(input).toHaveValue('8:01');
    fireEvent.submit(input.closest('form'));
    expect(onTokenCommit).toHaveBeenLastCalledWith('8:01');

    fireEvent.change(input, { target: { value: '0801' } });
    expect(input).toHaveValue('8:01');
    fireEvent.change(input, { target: { value: '1234' } });
    expect(input).toHaveValue('12:34');
  });

  it('shows configured team hotkeys and commits canonical team codes', () => {
    const onTokenCommit = vi.fn();
    render(
      <FootballFlowModal
        onCancel={vi.fn()}
        onStepClick={vi.fn()}
        onTokenCommit={onTokenCommit}
        state={{
          status: 'token.awaiting',
          flow: 'penalty',
          currentStep: 'penaltyTeam',
          currentToken: '',
          tokens: { laterals: [], tacklers: [], hurryDefenders: [], sackDefenders: [] },
        }}
        teamAliases={{ H: 'W', V: 'F' }}
      />,
    );

    expect(screen.getByRole('button', { name: 'Home W' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Visitor F' })).toBeInTheDocument();
    fireEvent.keyDown(window, { key: 'w', code: 'KeyW' });
    expect(onTokenCommit).toHaveBeenLastCalledWith('H');
    fireEvent.click(screen.getByRole('button', { name: 'Visitor F' }));
    expect(onTokenCommit).toHaveBeenLastCalledWith('V');
  });

  it('uses team names and aliases for timeouts and includes Officials and Media', () => {
    const onTokenCommit = vi.fn();
    render(
      <FootballFlowModal
        onCancel={vi.fn()}
        onStepClick={vi.fn()}
        onTokenCommit={onTokenCommit}
        state={{
          status: 'token.awaiting',
          flow: 'gameControl',
          currentStep: 'gameControlPossession',
          currentToken: '',
          tokens: {
            laterals: [],
            tacklers: [],
            hurryDefenders: [],
            sackDefenders: [],
            gameControlSelection: 'timeout',
          },
        }}
        teamAliases={{ H: 'W', V: 'F' }}
        teamNames={{ H: 'West Virginia St.', V: 'Fairmont St.' }}
      />,
    );

    expect(screen.getByRole('button', { name: 'West Virginia St. W' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Fairmont St. F' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Officials O' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Media M' })).toBeInTheDocument();
    fireEvent.keyDown(window, { key: 'o', code: 'KeyO' });
    expect(onTokenCommit).toHaveBeenCalledWith('O');
  });

  it('labels the timeout clock prompt and accepts the current clock as a replaceable default', () => {
    render(
      <FootballFlowModal
        onCancel={vi.fn()}
        onStepClick={vi.fn()}
        onTokenCommit={vi.fn()}
        state={{
          status: 'token.awaiting',
          flow: 'gameControl',
          currentStep: 'gameControlClock',
          currentToken: '08:42',
          selectCurrentToken: true,
          tokens: {
            laterals: [],
            tacklers: [],
            hurryDefenders: [],
            sackDefenders: [],
            gameControlSelection: 'timeout',
            gameControlPossession: 'H',
          },
        }}
      />,
    );

    const dialog = screen.getByRole('dialog', { name: 'Timeout Clock' });
    const input = within(dialog).getByLabelText('Game Clock');
    expect(dialog).toHaveTextContent('What does the game clock read?');
    expect(input).toHaveValue('8:42');
    expect(input).toHaveClass('font-mono', 'text-2xl', 'tracking-widest');
    expect(input.selectionStart).toBe(0);
    expect(input.selectionEnd).toBe(4);
    expect(within(dialog).getByRole('button', { name: 'Record Clock' })).toHaveClass('bg-sky-700');
    expect(within(dialog).queryByRole('button', { name: 'Enter' })).not.toBeInTheDocument();
  });

  it('turns yellow and shows the flag shortcut while a penalty is queued', () => {
    render(
      <FootballFlowModal
        onCancel={vi.fn()}
        onStepClick={vi.fn()}
        onTokenCommit={vi.fn()}
        state={{
          status: 'token.awaiting',
          flow: 'rush',
          currentStep: 'rusherJersey',
          currentToken: '',
          queuedPenaltyRequested: true,
          tokens: { laterals: [], tacklers: [], hurryDefenders: [], sackDefenders: [] },
        }}
      />,
    );

    const dialog = screen.getByRole('dialog', { name: 'Rush' });
    expect(dialog).toHaveAttribute('data-penalty-queued', 'true');
    expect(dialog).toHaveClass('border-amber-400', 'bg-amber-50');
    expect(screen.getByText('Shift+E for Flag on the Play')).toBeInTheDocument();
  });

  it('uses context-aware Hurry and No Hurry buttons with Y/N hotkeys', () => {
    const onTokenCommit = vi.fn();
    render(
      <FootballFlowModal
        onCancel={vi.fn()}
        onStepClick={vi.fn()}
        onTokenCommit={onTokenCommit}
        state={{
          status: 'token.awaiting',
          flow: 'pass',
          currentStep: 'hurried',
          currentToken: '',
          tokens: { laterals: [], tacklers: [], hurryDefenders: [], sackDefenders: [] },
        }}
      />,
    );

    expect(screen.getByRole('button', { name: 'Hurry Y' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'No Hurry N' })).toBeInTheDocument();
    expect(screen.queryByRole('textbox')).not.toBeInTheDocument();
    fireEvent.keyDown(window, { key: 'y', code: 'KeyY' });
    expect(onTokenCommit).toHaveBeenCalledWith('Y');
  });

  it('uses Broken Up and No Pass Breakup buttons with B/N hotkeys', () => {
    const onTokenCommit = vi.fn();
    render(
      <FootballFlowModal
        onCancel={vi.fn()}
        onStepClick={vi.fn()}
        onTokenCommit={onTokenCommit}
        state={{
          status: 'token.awaiting',
          flow: 'pass',
          currentStep: 'passBreakup',
          currentToken: '',
          tokens: { laterals: [], tacklers: [], hurryDefenders: [], sackDefenders: [] },
        }}
      />,
    );

    expect(screen.getByRole('button', { name: 'Broken Up B' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'No Pass Breakup N' })).toBeInTheDocument();
    expect(screen.queryByRole('textbox')).not.toBeInTheDocument();
    fireEvent.keyDown(window, { key: 'b', code: 'KeyB' });
    expect(onTokenCommit).toHaveBeenCalledWith('B');
  });

  it('uses button-only Touchback and Safety choices with T/S hotkeys', () => {
    const onTokenCommit = vi.fn();
    render(
      <FootballFlowModal
        onCancel={vi.fn()}
        onStepClick={vi.fn()}
        onTokenCommit={onTokenCommit}
        state={{
          status: 'token.awaiting',
          flow: 'kick',
          currentStep: 'returnOwnGoalDecision',
          currentToken: '',
          tokens: { laterals: [], tacklers: [], hurryDefenders: [], sackDefenders: [] },
        }}
      />,
    );

    expect(screen.getByRole('dialog', { name: 'Touchback or Safety?' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Touchback T' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Safety S' })).toBeInTheDocument();
    expect(screen.queryByRole('textbox')).not.toBeInTheDocument();
    fireEvent.keyDown(window, { key: 't', code: 'KeyT' });
    expect(onTokenCommit).toHaveBeenCalledWith('T');
    fireEvent.keyDown(window, { key: 's', code: 'KeyS' });
    expect(onTokenCommit).toHaveBeenCalledWith('S');
  });

  it('uses button-only Rekick and Spot the Ball choices with R/S hotkeys', () => {
    const onTokenCommit = vi.fn();
    render(
      <FootballFlowModal
        onCancel={vi.fn()}
        onStepClick={vi.fn()}
        onTokenCommit={onTokenCommit}
        state={{
          status: 'token.awaiting',
          flow: 'kick',
          currentStep: 'kickOutOfBoundsDecision',
          currentToken: '',
          tokens: { laterals: [], tacklers: [], hurryDefenders: [], sackDefenders: [] },
        }}
      />,
    );

    expect(screen.getByRole('dialog', { name: 'Rekick or Spot the Ball?' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Rekick R' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Spot the Ball S' })).toBeInTheDocument();
    expect(screen.queryByRole('textbox')).not.toBeInTheDocument();
    fireEvent.keyDown(window, { key: 's', code: 'KeyS' });
    expect(onTokenCommit).toHaveBeenCalledWith('S');
  });

  it('shows the prefilled Free Kick Infraction and accepts it with A', () => {
    const onTokenCommit = vi.fn();
    render(
      <FootballFlowModal
        onCancel={vi.fn()}
        onStepClick={vi.fn()}
        onTokenCommit={onTokenCommit}
        state={{
          status: 'token.awaiting',
          flow: 'kick',
          currentStep: 'kickRekickPenaltyReview',
          currentToken: '',
          tokens: {
            laterals: [],
            tacklers: [],
            hurryDefenders: [],
            sackDefenders: [],
            kickRekickSpot: 'H30',
            kicker: { jersey: '9', displayName: 'Owen Clark', team: 'H' },
          },
        }}
        teamNames={{ H: 'Home State', V: 'Visitor Tech' }}
      />,
    );

    expect(screen.getByText(/Free Kick Infraction · Home State · #9 Owen Clark · 5 yards · Accepted · Previous Spot · Repeat Down · Rekick at H30/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Accept Penalty A' })).toBeInTheDocument();
    fireEvent.keyDown(window, { key: 'a', code: 'KeyA' });
    expect(onTokenCommit).toHaveBeenCalledWith('A');
  });

  it('asks whether the defense attempted a return after a missed PAT', () => {
    render(
      <FootballFlowModal
        onCancel={vi.fn()}
        onStepClick={vi.fn()}
        onTokenCommit={vi.fn()}
        state={{
          status: 'token.awaiting',
          flow: 'kick',
          currentStep: 'patKickReturnAttempted',
          currentToken: '',
          tokens: { laterals: [], tacklers: [], hurryDefenders: [], sackDefenders: [] },
        }}
      />,
    );

    expect(screen.getByRole('dialog', { name: 'Attempted Return by the Defense?' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Attempted Return Y' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'No Return N' })).toBeInTheDocument();
  });

  it('labels the punt fair-catch player as Fair Caught By', () => {
    render(
      <FootballFlowModal
        onCancel={vi.fn()}
        onStepClick={vi.fn()}
        onTokenCommit={vi.fn()}
        state={{
          status: 'token.awaiting',
          flow: 'punt',
          currentStep: 'returnerJersey',
          currentToken: '',
          tokens: {
            laterals: [],
            tacklers: [],
            hurryDefenders: [],
            sackDefenders: [],
            puntReceiveResult: 'fairCatch',
          },
        }}
      />,
    );

    expect(screen.getByLabelText('Fair Caught By')).toBeInTheDocument();
    expect(screen.queryByLabelText('Returner jersey')).not.toBeInTheDocument();
  });

  it('offers Down Counts only for a succeeding-spot foul by the offensive team', () => {
    const baseState = {
      status: 'token.awaiting',
      flow: 'rush',
      currentStep: 'penaltyDown',
      currentToken: 'D',
      tokens: {
        laterals: [],
        tacklers: [],
        hurryDefenders: [],
        sackDefenders: [],
        penaltyEnforcedFrom: 'END',
        penaltyTeam: 'H',
      },
    };
    const { rerender } = render(
      <FootballFlowModal
        actionTeam="H"
        onCancel={vi.fn()}
        onStepClick={vi.fn()}
        onTokenCommit={vi.fn()}
        state={baseState}
      />,
    );

    expect(screen.getByText('Down Counts')).toBeInTheDocument();
    expect(screen.getByText('The completed play stands. Apply the normal next-down or series result, then enforce the foul from the succeeding spot.')).toBeInTheDocument();

    rerender(
      <FootballFlowModal
        actionTeam="H"
        onCancel={vi.fn()}
        onStepClick={vi.fn()}
        onTokenCommit={vi.fn()}
        state={{
          ...baseState,
          tokens: { ...baseState.tokens, penaltyTeam: 'V' },
        }}
      />,
    );

    expect(screen.queryByText('Down Counts')).not.toBeInTheDocument();
  });

  it('capitalizes team aliases immediately in yardline fields', () => {
    render(
      <FootballFlowModal
        onCancel={vi.fn()}
        onStepClick={vi.fn()}
        onTokenCommit={vi.fn()}
        state={{
          status: 'token.awaiting',
          flow: 'kick',
          currentStep: 'returnEndSpot',
          currentToken: '',
          tokens: { laterals: [], tacklers: [], hurryDefenders: [], sackDefenders: [] },
        }}
        teamAliases={{ H: 'W', V: 'F' }}
      />,
    );

    const input = screen.getByLabelText('Final spot');
    fireEvent.change(input, { target: { value: 'w26' } });

    expect(input).toHaveValue('W26');
    expect(input).toHaveAttribute('autocapitalize', 'characters');
    expect(input).toHaveAttribute('spellcheck', 'false');
  });
});
