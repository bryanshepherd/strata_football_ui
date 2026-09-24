import React from 'react';
import { fireEvent, render, screen, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import FootballFlowModal from './FootballFlowModal';

describe('FootballFlowModal team aliases', () => {
  it('asks the deadball first-down question with Yes and No controls', () => {
    const onTokenCommit = vi.fn();
    render(<FootballFlowModal onCancel={vi.fn()} onTokenCommit={onTokenCommit} state={{
      status: 'token.awaiting', flow: 'penalty', currentStep: 'penaltyDeadBallFirstDown', currentToken: '', tokens: {},
    }} />);
    expect(screen.getByText('Does the deadball foul award an automatic first down?')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /^Yes/ }));
    expect(onTokenCommit).toHaveBeenLastCalledWith('Y');
    fireEvent.keyDown(window, { key: 'n' });
    expect(onTokenCommit).toHaveBeenLastCalledWith('N');
  });

  it('asks the exact second-unsportsmanlike question and accepts Yes or No', () => {
    const onTokenCommit = vi.fn();
    render(<FootballFlowModal onCancel={vi.fn()} onTokenCommit={onTokenCommit}
      teamNames={{ H: 'Midway University', V: 'Bellarmine' }} state={{
        status: 'token.awaiting', flow: 'penalty', currentStep: 'penaltyEjected', currentToken: '',
        tokens: { penaltyTeam: 'H', penaltyPlayer: { jersey: '22' }, penaltyUnsportsmanlikeCount: 2 },
      }} />);
    expect(screen.getByText('Midway University # 22 has been charged a second unsportsmanlike conduct penalty. Has this player been ejected?')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /^Yes/ }));
    expect(onTokenCommit).toHaveBeenLastCalledWith('Y');
    fireEvent.keyDown(window, { key: 'n' });
    expect(onTokenCommit).toHaveBeenLastCalledWith('N');
  });

  it('offers Onside with N and scopes the touch question to the receiving team', () => {
    const onTokenCommit = vi.fn();
    const props = { onCancel: vi.fn(), onTokenCommit, teamNames: { H: 'Midway', V: 'Bellarmine' } };
    const { rerender } = render(<FootballFlowModal {...props} state={{ status: 'token.awaiting', flow: 'kick', currentStep: 'kickReceiveResult', currentToken: '', tokens: {} }} />);
    fireEvent.keyDown(window, { key: 'n' });
    expect(onTokenCommit).toHaveBeenLastCalledWith('N');
    expect(screen.getByRole('button', { name: /^Onside/ })).toBeInTheDocument();
    rerender(<FootballFlowModal {...props} state={{ status: 'token.awaiting', flow: 'kick', currentStep: 'onsideTouched', currentToken: '', tokens: { kicker: { team: 'H' } } }} />);
    expect(screen.getByText('Did Bellarmine touch the ball?')).toBeInTheDocument();
    fireEvent.keyDown(window, { key: 'y' });
    expect(onTokenCommit).toHaveBeenLastCalledWith('Y');
    rerender(<FootballFlowModal {...props} state={{ status: 'token.awaiting', flow: 'kick', currentStep: 'onsideToucher', currentToken: '', tokens: {} }} />);
    expect(screen.getByRole('textbox', { name: 'Who touched?' })).toBeInTheDocument();
    fireEvent.keyDown(window, { key: 't' });
    expect(onTokenCommit).toHaveBeenLastCalledWith('TM');
  });

  it('offers Dropped as a button and D hotkey', () => {
    const onTokenCommit = vi.fn();
    render(<FootballFlowModal onCancel={vi.fn()} onTokenCommit={onTokenCommit} state={{
      status: 'token.awaiting', flow: 'pass', currentStep: 'passResult', currentToken: '', tokens: {},
    }} />);
    fireEvent.click(screen.getByRole('button', { name: /^Dropped/ }));
    expect(onTokenCommit).toHaveBeenLastCalledWith('D');
    fireEvent.keyDown(window, { key: 'd' });
    expect(onTokenCommit).toHaveBeenCalledTimes(2);
    expect(onTokenCommit).toHaveBeenLastCalledWith('D');
  });

  it('submits a blank Intended For answer', () => {
    const onTokenCommit = vi.fn();
    render(<FootballFlowModal onCancel={vi.fn()} onTokenCommit={onTokenCommit} state={{
      status: 'token.awaiting', flow: 'pass', currentStep: 'intendedReceiverJersey', currentToken: '', tokens: {},
    }} />);
    expect(screen.getByRole('textbox', { name: 'Intended For jersey' })).toHaveValue('');
    fireEvent.click(screen.getByRole('button', { name: 'Enter' }));
    expect(onTokenCommit).toHaveBeenCalledWith('');
  });

  it('offers a team recovery button and hotkey alongside the player jersey input', () => {
    const onTokenCommit = vi.fn();
    render(<FootballFlowModal onCancel={vi.fn()} onTokenCommit={onTokenCommit} state={{
      status: 'token.awaiting', flow: 'rush', currentStep: 'recoverPlayerJersey', currentToken: '',
      tokens: { recoverTeam: 'H', laterals: [], tacklers: [], hurryDefenders: [], sackDefenders: [] },
    }} />);
    expect(screen.getByLabelText('Recovery player jersey')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /Team recovery/ }));
    expect(onTokenCommit).toHaveBeenLastCalledWith('TM');
    fireEvent.keyDown(window, { key: 't' });
    expect(onTokenCommit).toHaveBeenLastCalledWith('TM');
  });
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

  it('shows Returned and Spot the ball for a missed FGA and commits their R/S hotkeys', () => {
    const onTokenCommit = vi.fn();
    render(
      <FootballFlowModal
        onCancel={vi.fn()}
        onStepClick={vi.fn()}
        onTokenCommit={onTokenCommit}
        state={{
          status: 'token.awaiting', flow: 'kick', currentStep: 'fieldGoalReturnAttempted', currentToken: '',
          tokens: { kickMenuSelection: 'fieldGoal', laterals: [], tacklers: [], hurryDefenders: [], sackDefenders: [] },
        }}
      />,
    );
    expect(screen.getByRole('button', { name: 'Returned R' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Spot the ball S' })).toBeInTheDocument();
    expect(screen.queryByRole('textbox')).not.toBeInTheDocument();
    expect(screen.queryByText('No Return')).not.toBeInTheDocument();
    fireEvent.keyDown(window, { key: 'r', code: 'KeyR' });
    fireEvent.keyDown(window, { key: 's', code: 'KeyS' });
    fireEvent.click(screen.getByRole('button', { name: 'Returned R' }));
    fireEvent.click(screen.getByRole('button', { name: 'Spot the ball S' }));
    expect(onTokenCommit.mock.calls.map(([value]) => value)).toEqual(['R', 'S', 'R', 'S']);
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

  it('shows the previous scrimmage spot selected and accepts it with Enter', () => {
    const onTokenCommit = vi.fn();
    render(<FootballFlowModal
      onCancel={vi.fn()} onStepClick={vi.fn()} onTokenCommit={onTokenCommit}
      teamAliases={{ H: 'BST', V: 'LIV' }} teamNames={{ H: 'Bluefield State', V: 'Livingstone' }}
      state={{ status: 'token.awaiting', flow: 'kick', currentStep: 'fieldGoalNextSpot', currentToken: 'V22', selectCurrentToken: true,
        tokens: { kickMenuSelection: 'fieldGoal', kicker: { team: 'H' }, laterals: [], tacklers: [], hurryDefenders: [], sackDefenders: [] } }}
    />);
    const input = screen.getByLabelText('Next ball spot');
    expect(input).toHaveValue('V22');
    expect(input.selectionStart).toBe(0);
    expect(input.selectionEnd).toBe(3);
    expect(screen.getByRole('dialog')).toHaveTextContent('Confirm where Livingstone will begin its possession.');
    fireEvent.submit(input.closest('form'));
    expect(onTokenCommit).toHaveBeenCalledWith('V22');
    fireEvent.change(input, { target: { value: 'LIV20' } });
    fireEvent.submit(input.closest('form'));
    expect(onTokenCommit).toHaveBeenLastCalledWith('LIV20');
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

  it('removes Down Counts for both teams', () => {
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

    expect(screen.queryByText('Down Counts')).not.toBeInTheDocument();

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

  it('asks the exact possession question and accepts Yes and No hotkeys', () => {
    const onTokenCommit = vi.fn();
    render(<FootballFlowModal onCancel={vi.fn()} onTokenCommit={onTokenCommit} state={{ status: 'token.awaiting', flow: 'penalty', currentStep: 'penaltyAfterPossession', tokens: {} }} />);
    expect(screen.getByText('Did the foul happen after the change of possession?')).toBeInTheDocument();
    fireEvent.keyDown(window, { key: 'y' });
    expect(onTokenCommit).toHaveBeenLastCalledWith('Y');
    fireEvent.keyDown(window, { key: 'n' });
    expect(onTokenCommit).toHaveBeenLastCalledWith('N');
  });

  it('asks who currently has the ball for multiple changes and uses team aliases', () => {
    const onTokenCommit = vi.fn();
    render(<FootballFlowModal onCancel={vi.fn()} onTokenCommit={onTokenCommit} teamNames={{ H: 'Home State', V: 'Visitor Tech' }} teamAliases={{ H: 'W', V: 'F' }} state={{ status: 'token.awaiting', flow: 'penalty', currentStep: 'penaltyPossessionTeam', tokens: {} }} />);
    expect(screen.getByText('Who currently has the ball?')).toBeInTheDocument();
    expect(screen.queryByText('Did the foul happen after the change of possession?')).not.toBeInTheDocument();
    fireEvent.keyDown(window, { key: 'f' });
    expect(onTokenCommit).toHaveBeenLastCalledWith('V');
  });

  it('shows the calculated ball context and offers correction before committing', () => {
    const onTokenCommit = vi.fn();
    render(<FootballFlowModal onCancel={vi.fn()} onTokenCommit={onTokenCommit} teamNames={{ H: 'Home State', V: 'Visitor Tech' }} state={{ status: 'token.awaiting', flow: 'penalty', currentStep: 'penaltyConfirmContext', tokens: { penaltyContext: { possession: 'V', down: 1, distance: 10, yardLine: 'V21' } } }} />);
    expect(screen.getByText('Please confirm: Visitor Tech ball, 1st and 10 on the Visitor Tech 21.')).toBeInTheDocument();
    fireEvent.click(screen.getByText('No, correct context'));
    expect(onTokenCommit).toHaveBeenCalledWith('N');
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

describe('short onside kick choices', () => {
  it('offers the exact short-kick prompt with S, R, and E shortcuts', () => {
    const onTokenCommit = vi.fn();
    render(<FootballFlowModal onCancel={vi.fn()} onTokenCommit={onTokenCommit} state={{ status: 'token.awaiting', flow: 'kick', currentStep: 'onsideShortChoice', tokens: {} }} />);
    expect(screen.getByText('Kick did not travel 10 yards. Spot Ball for receiving team, continue recovery, or Enter Penalty?')).toBeInTheDocument();
    for (const key of ['s', 'r', 'e']) {
      fireEvent.keyDown(window, { key });
      expect(onTokenCommit).toHaveBeenLastCalledWith(key.toUpperCase());
    }
  });
  it('calls the kickoff penalty repeat choice Rekick', () => {
    const onTokenCommit = vi.fn();
    render(<FootballFlowModal onCancel={vi.fn()} onTokenCommit={onTokenCommit} state={{ status: 'token.awaiting', flow: 'penalty', currentStep: 'penaltyDown', tokens: {}, draft: { play: { family: 'kickoff' } } }} />);
    expect(screen.getByText('Rekick')).toBeInTheDocument();
    expect(screen.queryByText('Repeat Down')).not.toBeInTheDocument();
    fireEvent.keyDown(window, { key: 'r' });
    expect(onTokenCommit).toHaveBeenLastCalledWith('R');
  });
});
