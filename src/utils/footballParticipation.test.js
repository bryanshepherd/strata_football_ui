import { describe, expect, it } from 'vitest';
import { applyFootballParticipation, footballParticipationForEnvelope, hasFootballPlayerStats } from './footballParticipation';

export const participationFixture = () => ({
  gameId: 'FB-PARTICIPATION', updatedAt: 'before', game: { teams: { H: { name: 'Home' }, V: { name: 'Away' } } },
  rosters: { teams: { H: { players: Object.fromEntries(['starter', 'holder', 'penalty', 'stats', 'manual', 'unused', 'inactive'].map((id) => [id,
    { playerId: id, team: 'H', jersey: '7', displayName: id, active: id !== 'inactive' },
  ])) }, V: { players: { visitor: { playerId: 'visitor', team: 'V', jersey: '7', displayName: 'Visitor', active: true } } } } },
  pregame: { starters: { offense: { H: ['starter'], V: [] } } },
  events: [{ type: 'fieldGoal', status: 'accepted', participants: { holder: { playerId: 'holder', team: 'H' } }, penalties: [{ status: 'declined', playerId: 'penalty', team: 'H' }] }],
  stats: { players: { stats: { playerId: 'stats', team: 'H', rushAttempts: 1, rushYards: 0 }, unused: { playerId: 'unused', jersey: 7, rushAttempts: 0 } } },
});

describe('Football participation', () => {
  it('locks starters, no-stat actors, declined penalty actors and players with stats while preserving duplicate jersey identities', () => {
    const state = footballParticipationForEnvelope(participationFixture());
    for (const id of ['starter', 'holder', 'penalty', 'stats']) expect(state.H[id]).toMatchObject({ played: true, locked: true });
    for (const id of ['manual', 'unused']) expect(state.H[id]).toMatchObject({ played: false, locked: false });
    expect(state.V.visitor).toMatchObject({ played: false, locked: false });
    expect(state.H.inactive.active).toBe(false);
  });

  it('recognizes every starter unit and nested legacy result/penalty actors without counting rejected events or confirmation history', () => {
    const game = participationFixture();
    game.pregame.starters = { defense: { H: ['starter'] }, specialTeams: { V: ['visitor'] } };
    game.events = [{ result: { pass: { hurriedByPlayerIds: ['holder'] }, fumble: { recoveredByPlayerId: 'manual' } }, penalties: [{ chargedTo: { playerId: 'penalty' } }], confirmation: { oldActor: { playerId: 'unused' } } }, { status: 'rejected', participants: { primary: { playerId: 'unused' } } }];
    const state = footballParticipationForEnvelope(game);
    for (const id of ['starter', 'holder', 'manual', 'penalty']) expect(state.H[id].locked).toBe(true);
    expect(state.V.visitor.locked).toBe(true);
    expect(state.H.unused.locked).toBe(false);
  });

  it('saves only manual choices, preserves hidden inactive selections, and cannot override automatic participation', () => {
    const game = participationFixture();
    game.participation = { manualPlayed: { H: ['inactive'], V: [] } };
    const before = JSON.stringify(game);
    const saved = applyFootballParticipation(game, { H: ['manual', 'starter', 'bad-id'], V: ['visitor'] }, 'saved');
    expect(saved.participation.manualPlayed).toEqual({ H: ['manual', 'inactive'], V: ['visitor'] });
    expect(saved.events).toBe(game.events);
    expect(saved.stats).toBe(game.stats);
    expect(JSON.stringify(game)).toBe(before);
    const cleared = applyFootballParticipation(saved, { H: [], V: [] });
    expect(footballParticipationForEnvelope(cleared).H.manual.played).toBe(false);
    expect(footballParticipationForEnvelope(cleared).H.starter.played).toBe(true);
    expect(cleared.participation.manualPlayed.H).toEqual(['inactive']);
  });

  it('releases an automatic lock when its last play is removed, without creating a manual selection', () => {
    const game = applyFootballParticipation(participationFixture(), { H: ['manual', 'holder'] });
    game.events = [];
    const state = footballParticipationForEnvelope(game);
    expect(state.H.holder).toMatchObject({ played: false, locked: false });
    expect(state.H.manual).toMatchObject({ played: true, locked: false });
  });

  it('counts negative and nested statistics but ignores identity fields and zero-only stat lines', () => {
    expect(hasFootballPlayerStats({ rushYards: -2 })).toBe(true);
    expect(hasFootballPlayerStats({ defense: { tackles: '1' } })).toBe(true);
    expect(hasFootballPlayerStats({ jersey: 7, gp: 1, active: true, rushAttempts: 0, pass: { att: 0 } })).toBe(false);
  });

  it('recognizes a legacy named defender without confusing two players sharing the number', () => {
    const game = participationFixture();
    game.events = [{ possession: 'V', type: 'pass', description: 'Pass incomplete, broken up by #7 holder.' }];
    const state = footballParticipationForEnvelope(game);
    expect(state.H.holder.locked).toBe(true);
    expect(state.H.unused.locked).toBe(false);
  });
});
