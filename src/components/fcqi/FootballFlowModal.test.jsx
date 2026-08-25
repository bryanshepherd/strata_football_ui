import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import FootballFlowModal from './FootballFlowModal';

describe('FootballFlowModal team aliases', () => {
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
