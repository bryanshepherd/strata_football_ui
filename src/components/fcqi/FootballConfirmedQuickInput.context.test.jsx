import { describe, expect, it } from 'vitest';
import { getGameEnvelopeFixture } from '../../data/footballGameEnvelopeFixtures';
import { buildQuickInputContext } from './FootballConfirmedQuickInput';

describe('FootballConfirmedQuickInput context', () => {
  it('uses the saved second-half kicking team instead of stale prior-event possession', () => {
    const envelope = JSON.parse(JSON.stringify(getGameEnvelopeFixture('halftime')));
    envelope.clock = { ...envelope.clock, period: 3, clock: '15:00' };
    envelope.game = { ...envelope.game, period: 3, status: 'inProgress' };
    envelope.pregame = { ...envelope.pregame, gamePhase: 'awaitingKickoff' };
    envelope.liveState = {
      ...envelope.liveState,
      possession: null,
      yardLine: 'V40',
      kickoffTeam: 'V',
      nextPlayContext: 'awaitingKickoff',
    };
    envelope.events = [{
      clientEventId: 'start-q3',
      sequence: 83,
      type: 'gameControl',
      possession: 'H',
      participants: { primary: { team: 'H' } },
      result: { gameControl: { action: 'startQuarter', secondHalf: { kickingTeam: 'V' } } },
    }];

    const context = buildQuickInputContext(envelope, {
      startedBy: 'button', seed: 'fcqi-kick-84', startedAt: '2026-08-29T00:00:00.000Z',
    });

    expect(context.play).toMatchObject({ actionTeam: 'V', possession: null, period: 3 });
    expect(context.prePlay.setupContext).toBe('awaitingKickoff');
  });
});
