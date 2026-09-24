import React from 'react';
import { fireEvent, render, screen, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import FootballActivePlayFlags from './FootballActivePlayFlags';

const context = { possession: 'H', down: 2, distance: 5, yardLine: 'H30', lineToGain: 'H35', goalToGo: false };
const play = (sequence, patch = {}) => ({ eventId: `play-${sequence}`, sequence, type: 'rush', status: 'accepted', period: sequence, clock: '02:00', preState: context, postState: context, result: { code: 'tackle' }, ...patch });
const envelope = () => ({ events: [play(1), play(2, { preState: { ...context, yardLine: 'H25' } }), play(3, { preState: { ...context, down: 1, distance: 10 } })] });
const callbacks = () => ({ onEditPlay: vi.fn(), onChallengeRescore: vi.fn() });

describe('active play flags', () => {
  it('lists mismatches across periods and opens the exact flagged play', () => {
    const game = envelope();
    const actions = callbacks();
    render(<FootballActivePlayFlags envelope={game} {...actions} />);
    expect(screen.getByText('2 flags need review')).toBeInTheDocument();
    const second = screen.getByRole('button', { name: 'Review context mismatch for play 2' });
    expect(second).toHaveTextContent('Q2 · 2:00');
    expect(second).toHaveTextContent('Context mismatch: ball spot');
    expect(screen.getByRole('button', { name: 'Review context mismatch for play 3' })).toHaveTextContent('down, distance');
    fireEvent.click(second);
    expect(actions.onEditPlay).toHaveBeenCalledWith(game.events[1]);
  });

  it('removes resolved flags and does not flag the first play for lacking a predecessor', () => {
    const game = envelope();
    const actions = callbacks();
    const view = render(<FootballActivePlayFlags envelope={game} {...actions} />);
    view.rerender(<FootballActivePlayFlags envelope={{ ...game, events: game.events.map(event => ({ ...event, preState: context })) }} {...actions} />);
    expect(screen.getByText('No active play flags')).toBeInTheDocument();
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
  });

  it('identifies the challenged play and opens its unfinished challenge correction', () => {
    const target = play(1);
    const challenge = { eventId: 'challenge', sequence: 2, type: 'gameControl', status: 'accepted', result: { gameControl: { action: 'challenge', challengeStatus: 'callOverturned', challengedEventId: target.eventId, rescore: { status: 'pending' } } } };
    const game = { events: [target, challenge] };
    const actions = callbacks();
    const view = render(<FootballActivePlayFlags envelope={game} {...actions} />);
    expect(screen.getByText('1 flag needs review')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Review challenge for play 1' }));
    expect(actions.onChallengeRescore).toHaveBeenCalledWith(challenge);
    const complete = structuredClone(challenge);
    complete.result.gameControl.rescore.status = 'complete';
    view.rerender(<FootballActivePlayFlags envelope={{ events: [target, complete] }} {...actions} />);
    expect(screen.getByText('No active play flags')).toBeInTheDocument();
  });

  it('excludes rejected events and prevents opening another correction while editing', () => {
    const game = envelope();
    game.events[2].status = 'rejected';
    const actions = callbacks();
    render(<FootballActivePlayFlags envelope={game} {...actions} disabled />);
    const panel = screen.getByRole('region', { name: 'Active play flags' });
    expect(within(panel).getAllByRole('button')).toHaveLength(1);
    const button = within(panel).getByRole('button');
    expect(button).toBeDisabled();
    fireEvent.click(button);
    expect(actions.onEditPlay).not.toHaveBeenCalled();
  });
});
