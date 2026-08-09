import { describe, expect, it } from 'vitest';
import { normalizeFootballScoringSetupEnvelope } from '../services/footballDashboardService';
import { fixtureOptions, getGameEnvelopeFixture } from './footballGameEnvelopeFixtures';

describe('second-quarter recovery fixture', () => {
  it('restores the accepted first quarter and stops before either second-quarter pass', () => {
    const fixture = getGameEnvelopeFixture('secondQuarterRecovery');
    const envelope = normalizeFootballScoringSetupEnvelope(fixture);

    expect(fixtureOptions).toContainEqual({
      key: 'secondQuarterRecovery',
      label: 'Second Quarter Recovery',
    });
    expect(envelope.game).toMatchObject({
      status: 'inProgress',
      period: 2,
      teams: {
        H: { name: 'West Virginia St.', score: 3 },
        V: { name: 'Fairmont St.', score: 7 },
      },
    });
    expect(envelope.clock).toMatchObject({ period: 2, clock: '15:00' });
    expect(envelope.liveState).toMatchObject({
      possession: 'H',
      down: 2,
      distance: 10,
      yardLine: 'H26',
      lineToGain: 'H36',
      driveId: 'DRV-0007',
    });
    expect(envelope.events).toHaveLength(45);
    expect(envelope.events.at(-1)).toMatchObject({
      sequence: 45,
      type: 'gameControl',
      subtype: 'startQuarter',
    });
    expect(envelope.events.some((event) => event.clientEventId === 'fcqi-pass-53-client')).toBe(false);
    expect(envelope.events.some((event) => event.clientEventId === 'fcqi-pass-54-client')).toBe(false);
    expect(envelope.stats.sourceEventSequence).toBe(45);
    expect(envelope.operatorTeamAliases).toEqual({ H: 'W', V: 'F' });
  });
});
