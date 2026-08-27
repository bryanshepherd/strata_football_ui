import { describe, expect, it } from 'vitest';
import baselineRecord from '../data/footballCompletedBaselineGameRecord.json';
import {
  buildFootballScoringSummary,
  formatFootballReportDate,
  formatFootballReportTime,
} from './footballScoringSummary';

describe('football scoring summary projection', () => {
  const report = buildFootballScoringSummary(baselineRecord.envelope);

  it('uses the completed Fairmont State at West Virginia State example game', () => {
    expect(report.gameId).toBe('FB-ca7d777b-a8aa-4a26-bd20-b10f7bb621a7');
    expect(report.reportMatchup).toBe('Fairmont St. vs. West Virginia St. (September 27, 2025)');
    expect(report.matchup).toBe('Fairmont St. (2-2, 0-2 MEC) vs. West Virginia St. (3-1, 2-0 MEC)');
  });

  it('projects score by quarter and omits unused overtime columns', () => {
    expect(report.periods.map((period) => period.label)).toEqual(['1ST', '2ND', '3RD', '4TH']);
    expect(report.scoreByQuarter.V).toEqual({ periods: { 1: 7, 2: 7, 3: 11, 4: 14 }, total: 39 });
    expect(report.scoreByQuarter.H).toEqual({ periods: { 1: 3, 2: 23, 3: 21, 4: 13 }, total: 60 });
  });

  it('builds the chronological V-H scoring ledger', () => {
    expect(report.scoring).toHaveLength(27);
    expect(report.scoring[0]).toMatchObject({ quarter: '1', time: '13:32', team: 'FAIR', score: '6-0' });
    expect(report.scoring[1]).toMatchObject({ team: 'FAIR', score: '7-0' });
    expect(report.scoring.at(-1)).toMatchObject({ quarter: '4', time: '00:37', team: 'FAIR', score: '39-60' });
  });

  it('formats game details in the report timezone', () => {
    expect(formatFootballReportDate('2025-09-27T17:30:00.000Z')).toBe('September 27, 2025');
    expect(formatFootballReportTime('2025-09-27T20:42:00.000Z')).toBe('4:42 PM');
    expect(report.gameDetails).toEqual({
      date: 'September 27, 2025',
      scheduledTime: '1:30 PM',
      kickoffTime: '1:30 PM',
      endOfGame: '4:42 PM',
      duration: '3:12',
      site: 'Institute, WV',
      venue: 'Lakin-Ray Field at Dickerson Stadium',
      attendance: '—',
      weather: '—',
      wind: '—',
    });
  });

  it('prints only entered officials in the required precedence order', () => {
    expect(report.officials).toEqual([
      { role: 'REFEREE', name: 'Kenny Johnson' },
      { role: 'UMPIRE', name: 'Terry Swauger' },
      { role: 'LINESMAN', name: 'Janis Worklan' },
      { role: 'LINE JUDGE', name: 'Joey Tortorella' },
      { role: 'BACK JUDGE', name: 'Brian Shar' },
      { role: 'FIELD JUDGE', name: 'Tyler Starcher' },
      { role: 'SIDE JUDGE', name: 'Brian Collett' },
      { role: 'SCORER', name: 'Bryan Shepherd' },
    ]);
  });
});
