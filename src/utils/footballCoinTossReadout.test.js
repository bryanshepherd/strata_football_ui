import { describe, expect, it } from 'vitest';
import { footballCaptainLines, footballCoinTossLines } from './footballCoinTossReadout';

const game = () => ({
  game: { teams: { V: { name: 'Livingstone' }, H: { name: 'Bluefield State' } } },
  rosters: { teams: {
    V: { players: { receiver: { playerId: 'receiver', jersey: '3', displayName: 'Ronald Lindsey' }, defender: { playerId: 'defender', jersey: '3', displayName: 'Xzaivion Betts' } } },
    H: { players: [{ playerId: 'zero', jersey: '0', firstName: 'Kamaree', lastName: 'Wells' }] },
  } },
  pregame: { coinToss: {
    status: 'complete', winnerTeam: 'V', winnerInitialChoice: 'receive',
    firstHalfKickingTeam: 'H', firstHalfReceivingTeam: 'V',
    captains: { V: [{ playerId: 'receiver', jerseyNumber: '3' }], H: [{ playerId: 'zero', jerseyNumber: '0' }] },
  } },
});

describe('coin-toss captain readout', () => {
  it('prints away and home captains on separate lines before the toss, using player identity', () => {
    const envelope = game();
    const before = structuredClone(envelope);
    expect(footballCoinTossLines(envelope)).toEqual([
      'Livingstone Captains: 3 - Ronald Lindsey',
      'Bluefield State Captains: 0 - Kamaree Wells',
      'Livingstone won the toss and elected to receive. Bluefield State will kick to Livingstone.',
    ]);
    expect(envelope).toEqual(before);
  });

  it('keeps selected order and distinct captains who share a number', () => {
    const envelope = game();
    envelope.pregame.coinToss.captains.V.push({ playerId: 'defender', jerseyNumber: '3' });
    envelope.pregame.coinToss.captains.V.push({ playerId: 'receiver', jerseyNumber: '3' });
    expect(footballCaptainLines(envelope)[0]).toBe('Livingstone Captains: 3 - Ronald Lindsey, 3 - Xzaivion Betts');
  });

  it('omits each empty team and omits all captain text if neither team has selections', () => {
    const envelope = game();
    envelope.pregame.coinToss.captains.V = [];
    expect(footballCaptainLines(envelope)).toEqual(['Bluefield State Captains: 0 - Kamaree Wells']);
    delete envelope.pregame.coinToss.captains;
    expect(footballCoinTossLines(envelope)).toEqual(['Livingstone won the toss and elected to receive. Bluefield State will kick to Livingstone.']);
    delete envelope.pregame;
    expect(footballCoinTossLines(envelope)).toEqual([]);
  });

  it('uses current roster numbers and saved details only when a roster identity is unavailable', () => {
    const envelope = game();
    envelope.rosters.teams.V.players.receiver.jersey = '8';
    expect(footballCaptainLines(envelope)[0]).toBe('Livingstone Captains: 8 - Ronald Lindsey');
    envelope.pregame.coinToss.captains.V = [{ playerId: 'missing', jerseyNumber: '9', name: "Alex O'Neil" }, {}];
    expect(footballCaptainLines(envelope)[0]).toBe("Livingstone Captains: 9 - Alex O'Neil");
  });
});
