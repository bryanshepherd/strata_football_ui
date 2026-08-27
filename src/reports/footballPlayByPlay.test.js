import { describe, expect, it } from 'vitest';
import baselineRecord from '../data/footballCompletedBaselineGameRecord.json';
import {
  buildFootballPlayByPlayReport,
  formatFootballPlaySpot,
} from './footballPlayByPlay';

describe('football Play-by-Play projection', () => {
  it('builds chronological quarter sections with quarter-only Quickies', () => {
    const report = buildFootballPlayByPlayReport(baselineRecord.envelope);

    expect(report).toMatchObject({
      gameId: 'FB-ca7d777b-a8aa-4a26-bd20-b10f7bb621a7',
      reportTitle: 'Play-by-Play',
      periods: [1, 2, 3, 4],
    });
    expect(report.quarters.map((quarter) => quarter.label)).toEqual([
      'First Quarter',
      'Second Quarter',
      'Third Quarter',
      'Fourth Quarter',
    ]);
    expect(report.quarters.map((quarter) => quarter.quickie.scope.value)).toEqual([
      'quarter-1',
      'quarter-2',
      'quarter-3',
      'quarter-4',
    ]);
  });

  it('uses the entered pre-play context and replaces H/V spots with team abbreviations', () => {
    const report = buildFootballPlayByPlayReport(baselineRecord.envelope);
    const firstQuarter = report.quarters[0];
    const kickoff = firstQuarter.rows.find((row) => row.id === 'play-1');
    const firstScrimmagePlay = firstQuarter.rows.find((row) => row.id === 'play-2');

    expect(kickoff).toMatchObject({ downAndDistance: '', spot: 'FAIR 35' });
    expect(firstScrimmagePlay).toMatchObject({
      downAndDistance: '1st & 10',
      spot: 'WVSU 26',
      text: 'WVSU #10 Kaleb Jackson pass incomplete intended for #23 Jojo Restall.',
    });
    expect(formatFootballPlaySpot('50', report.teams)).toBe('50');
    expect(firstQuarter.rows.filter((row) => row.kind === 'play').every((row) => !/^[HV]\d/.test(row.spot))).toBe(true);
  });

  it('inserts exact drive starts, cumulative score changes, and drive summaries', () => {
    const report = buildFootballPlayByPlayReport(baselineRecord.envelope);
    const rows = report.quarters[0].rows;

    expect(rows.find((row) => row.id === 'drive-start-DRV-0001')?.text).toBe('WVSU drive start at 14:54.');
    expect(rows.find((row) => row.id === 'score-14')?.text).toBe('FAIR 6 – WVSU 0');
    expect(rows.find((row) => row.id === 'score-15')?.text).toBe('FAIR 7 – WVSU 0');
    expect(rows.find((row) => row.id === 'drive-end-DRV-0001')?.text).toBe(
      'WVSU drive: 4 plays, -12 yards, 1:22; Punt.',
    );
    expect(rows.findIndex((row) => row.id === 'drive-end-DRV-0001')).toBeGreaterThan(
      rows.findIndex((row) => row.id === 'play-6'),
    );
  });

  it('treats the first selected quarter as the first quarter of the report', () => {
    const report = buildFootballPlayByPlayReport(
      baselineRecord.envelope,
      new URLSearchParams('startQuarter=3&endQuarter=4'),
    );

    expect(report.periods).toEqual([3, 4]);
    expect(report.quarters[0].label).toBe('Third Quarter');
    expect(report.quarters[0].rows.find((row) => row.kind === 'score')?.text).toBe('FAIR 14 – WVSU 32');
    expect(report.quarters[0].quickie.rows.find((row) => row.id === 'score')?.values).toEqual({
      V: '11',
      H: '21',
    });
  });
});
