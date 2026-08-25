import { describe, expect, it } from 'vitest';
import { buildEjectionReportNotes } from './FootballReportPlaceholder';

describe('Football report ejection notes', () => {
  it('creates a printable note for an ejected penalized player', () => {
    const notes = buildEjectionReportNotes({
      game: {
        teams: {
          H: { name: 'Home State' },
          V: { name: 'Visitor Tech' },
        },
      },
      rosters: {
        teams: {
          H: {
            players: {
              'H-56': { jersey: '56', displayName: 'Casey Jones' },
            },
          },
        },
      },
      events: [{
        eventId: 'event-7',
        period: 2,
        clock: '08:41',
        penalties: [{
          penaltyId: 'penalty-1',
          code: 'PF',
          team: 'H',
          playerId: 'H-56',
          notes: 'EJECTION: H-56 ejected from the game.',
        }],
      }],
    });

    expect(notes).toEqual([{
      id: 'event-7-penalty-1',
      text: 'Home State #56 Casey Jones was ejected from the game (PF, Q2 8:41).',
    }]);
  });
});
