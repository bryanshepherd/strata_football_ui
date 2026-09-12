import React from 'react';
import { fireEvent, render, screen, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { getGameEnvelopeFixture } from '../data/footballGameEnvelopeFixtures';
import { FootballEventLogSlot } from './FootballScorerShell';

function quarterEnvelope() {
  const envelope = structuredClone(getGameEnvelopeFixture('normal'));
  envelope.clock.period = 2;
  envelope.game.period = 2;
  envelope.drives = { current: null, completed: [] };
  envelope.liveState.driveId = null;
  envelope.events = [
    { eventId: 'kickoff', sequence: 1, status: 'accepted', type: 'kickoff', period: 1, clock: '15:00', description: 'Opening kickoff.' },
    { eventId: 'penalty', sequence: 2, status: 'accepted', type: 'penalty', period: 1, clock: '14:55', description: 'Kickoff penalty.' },
    { eventId: 'correction', sequence: 3, status: 'accepted', type: 'gameControl', subtype: 'setBallContext', result: { gameControl: { action: 'setBallContext' } }, period: 1, clock: '14:55', description: 'Ball context correction.' },
    { eventId: 'rush', sequence: 4, status: 'accepted', type: 'rush', period: 2, clock: '15:00', description: 'Second quarter rush.' },
  ];
  return envelope;
}

const chooseQuarter = (name) => fireEvent.click(screen.getByRole('tab', { name }));
const expectSelected = (name) => expect(screen.getByRole('tab', { name })).toHaveAttribute('aria-selected', 'true');

describe('Football game log quarter tabs', () => {
  it('opens on the current quarter and keeps original play identities when reviewing penalties and corrections', () => {
    const envelope = quarterEnvelope();
    const original = structuredClone(envelope);
    const onEditEvent = vi.fn();
    render(<FootballEventLogSlot envelope={envelope} onEditEvent={onEditEvent} />);

    expect(screen.getAllByRole('tab').map((tab) => tab.textContent)).toEqual(['Q1', 'Q2', 'Q3', 'Q4']);
    expectSelected('Q2');
    expect(screen.getByRole('tabpanel', { name: 'Q2' })).toHaveTextContent('Second quarter rush.');
    expect(screen.queryByText('Opening kickoff.')).not.toBeInTheDocument();
    chooseQuarter('Q1');
    const panel = screen.getByRole('tabpanel', { name: 'Q1' });
    expect(within(panel).getAllByRole('listitem').map((row) => within(row).getByRole('button').getAttribute('aria-label')))
      .toEqual(['Edit ball context revision 3', 'Edit play 2', 'Edit play 1']);
    fireEvent.click(within(panel).getByRole('button', { name: 'Edit play 2' }));
    expect(onEditEvent).toHaveBeenLastCalledWith(envelope.events[1]);
    fireEvent.click(within(panel).getByRole('button', { name: 'Edit ball context revision 3' }));
    expect(onEditEvent).toHaveBeenLastCalledWith(envelope.events[2]);
    expect(envelope).toEqual(original);
  });

  it('shows the recorded starting context with the requested separators and team labels', () => {
    const envelope = quarterEnvelope();
    envelope.operatorTeamAliases = { H: 'W', V: 'S' };
    envelope.game.teams.H.abbr = 'WNFELD';
    envelope.liveState = { ...envelope.liveState, possession: 'V', down: 4, distance: 2, yardLine: 'H10' };
    envelope.events[3] = {
      ...envelope.events[3],
      clock: '08:24',
      possession: 'H',
      preState: { possession: 'H', down: 2, distance: 5, yardLine: 'H44' },
      postState: { possession: 'H', down: 1, distance: 10, yardLine: 'V43' },
    };
    render(<FootballEventLogSlot envelope={envelope} />);

    expect(screen.getByText('Q2 8:24 · W - 2 & 5 · W44')).toBeInTheDocument();
    expect(screen.queryByText(/Q2 · 8:24/)).not.toBeInTheDocument();
    expect(screen.queryByText(/1 & 10/)).not.toBeInTheDocument();
    expect(screen.queryByText(/4 & 2/)).not.toBeInTheDocument();
  });

  it.each([null, undefined, '', '  '])('omits an unentered time without adding an extra separator: %j', (clock) => {
    const envelope = quarterEnvelope();
    envelope.events[3] = {
      ...envelope.events[3], clock, possession: 'V',
      preState: { possession: 'V', down: 3, distance: 7, yardLine: '50' },
    };
    render(<FootballEventLogSlot envelope={envelope} />);

    expect(screen.getByText('Q2 · V - 3 & 7 · 50')).toBeInTheDocument();
    expect(screen.queryByText(/--:--/)).not.toBeInTheDocument();
  });

  it('shows an entered zero clock and goal-to-go without fabricating a series for a kickoff', () => {
    const envelope = quarterEnvelope();
    envelope.events[3] = {
      ...envelope.events[3], clock: '00:00', possession: 'H',
      preState: { possession: 'H', down: 4, distance: 3, goalToGo: true, yardLine: 'V03' },
    };
    envelope.events[0].preState = { possession: null, down: null, distance: null, yardLine: 'H35' };
    render(<FootballEventLogSlot envelope={envelope} />);

    expect(screen.getByText('Q2 0:00 · H - 4 & Goal · V03')).toBeInTheDocument();
    chooseQuarter('Q1');
    expect(screen.getByText('Q1 15:00 · — · H35')).toBeInTheDocument();
    expect(screen.queryByText(/&/)).not.toBeInTheDocument();
  });

  it('keeps the reviewed quarter after a deletion but follows a new quarter or game', () => {
    const envelope = quarterEnvelope();
    const { rerender } = render(<FootballEventLogSlot envelope={envelope} onEditEvent={vi.fn()} />);
    chooseQuarter('Q1');
    const afterDelete = { ...envelope, events: envelope.events.filter((event) => event.eventId !== 'penalty') };
    rerender(<FootballEventLogSlot envelope={afterDelete} onEditEvent={vi.fn()} />);
    expectSelected('Q1');
    expect(screen.queryByText('Kickoff penalty.')).not.toBeInTheDocument();
    expect(screen.getByText('Opening kickoff.')).toBeInTheDocument();

    const nextQuarter = { ...afterDelete, clock: { ...envelope.clock, period: 3 } };
    rerender(<FootballEventLogSlot envelope={nextQuarter} />);
    expectSelected('Q3');
    expect(screen.getByRole('tabpanel')).toHaveTextContent('No accepted events in Q3.');
    chooseQuarter('Q1');
    rerender(<FootballEventLogSlot envelope={{ ...nextQuarter, gameId: 'ANOTHER-GAME' }} />);
    expectSelected('Q3');
  });

  it('includes overtime and supports keyboard navigation through empty and recorded quarters', () => {
    const envelope = quarterEnvelope();
    envelope.clock.period = 5;
    envelope.events.push({ eventId: 'ot2', sequence: 5, status: 'accepted', type: 'rush', period: 6, clock: '00:00', description: 'Second overtime rush.' });
    render(<FootballEventLogSlot envelope={envelope} />);

    expectSelected('OT1');
    const firstOT = screen.getByRole('tab', { name: 'OT1' });
    fireEvent.keyDown(firstOT, { key: 'ArrowRight' });
    expectSelected('OT2');
    expect(screen.getByRole('tab', { name: 'OT2' })).toHaveFocus();
    expect(screen.getByRole('tabpanel', { name: 'OT2' })).toHaveTextContent('Second overtime rush.');
    expect(screen.getByRole('tabpanel')).toHaveTextContent('OT2 0:00');
    fireEvent.keyDown(document.activeElement, { key: 'ArrowRight' });
    expectSelected('Q1');
    fireEvent.keyDown(document.activeElement, { key: 'ArrowLeft' });
    expectSelected('OT2');
    fireEvent.keyDown(document.activeElement, { key: 'Home' });
    expectSelected('Q1');
    fireEvent.keyDown(document.activeElement, { key: 'End' });
    expectSelected('OT2');
    expect(envelope.clock.period).toBe(5);
  });

  it('places quarter-start controls in the quarter they open without moving the preceding end-quarter record', () => {
    const envelope = quarterEnvelope();
    envelope.events = [
      { eventId: 'end-q1', sequence: 1, type: 'gameControl', period: 1, clock: '00:00', result: { gameControl: { action: 'endQuarter', period: 1 } }, description: 'End quarter 1.' },
      { eventId: 'start-q2', sequence: 2, type: 'gameControl', period: 1, clock: '00:00', result: { gameControl: { action: 'startQuarter', period: 2 } }, description: 'Start quarter 2.' },
    ];
    render(<FootballEventLogSlot envelope={envelope} />);

    expect(screen.getByRole('tabpanel', { name: 'Q2' })).toHaveTextContent('Start quarter 2.');
    expect(screen.queryByText('End quarter 1.')).not.toBeInTheDocument();
    chooseQuarter('Q1');
    expect(screen.getByRole('tabpanel', { name: 'Q1' })).toHaveTextContent('End quarter 1.');
    expect(screen.queryByText('Start quarter 2.')).not.toBeInTheDocument();
  });

  it('shows a drive start only in the quarter where the drive began', () => {
    const envelope = quarterEnvelope();
    envelope.events = [envelope.events[0], envelope.events[3]].map((event) => ({
      ...event,
      preState: { driveId: 'CROSS-QUARTER', possession: 'H', yardLine: 'H25' },
    }));
    envelope.drives.current = { driveId: 'CROSS-QUARTER', team: 'H', startPeriod: 1, startClock: '00:20', startYardLine: 'H25' };
    render(<FootballEventLogSlot envelope={envelope} />);

    expect(screen.queryByRole('separator', { name: /Drive Start/ })).not.toBeInTheDocument();
    expect(screen.getByRole('tabpanel')).toHaveTextContent('Second quarter rush.');
    chooseQuarter('Q1');
    expect(screen.getAllByRole('separator', { name: /Drive Start/ })).toHaveLength(1);
    expect(screen.getByRole('tabpanel')).toHaveTextContent('Opening kickoff.');
    expect(screen.getByRole('tabpanel')).toHaveTextContent('0:20');
    expect(screen.queryByText('Second quarter rush.')).not.toBeInTheDocument();
  });
});
