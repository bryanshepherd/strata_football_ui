import { describe, expect, it } from 'vitest';
import baselineRecord from '../data/footballCompletedBaselineGameRecord.json';
import { buildFootballDriveChartReport } from './footballDriveChart';

const breakdownRow = (report, team, id) => (
  report.teams[team].breakdown.find((row) => row.id === id)
);

describe('football drive chart report projection', () => {
  const report = buildFootballDriveChartReport(baselineRecord.envelope);

  it('uses the completed example game and preserves chronological drive order', () => {
    expect(report.gameId).toBe('FB-ca7d777b-a8aa-4a26-bd20-b10f7bb621a7');
    expect(report.reportTitle).toBe('Drive Chart');
    expect(report.reportMatchup).toBe('Fairmont St. vs. West Virginia St. (September 27, 2025)');
    expect(report.teams.V.drives).toHaveLength(13);
    expect(report.teams.H.drives).toHaveLength(15);
    expect(report.chronological).toHaveLength(28);
    expect(report.chronological.map((drive) => drive.driveNumber)).toEqual(
      Array.from({ length: 28 }, (_, index) => index + 1),
    );
  });

  it('projects start, finish, possession reasons, and elapsed time for each drive', () => {
    expect(report.chronological[0]).toMatchObject({
      teamLabel: 'WVSU',
      quarter: 1,
      startSpot: 'H26',
      startTime: '14:54',
      howObtained: 'Kickoff',
      endSpot: 'H14',
      endTime: '13:32',
      howLost: 'Punt',
      plays: 4,
      yards: -12,
      time: '1:22',
    });
    expect(report.chronological[6]).toMatchObject({
      driveNumber: 7,
      quarter: 1,
      startTime: '0:35',
      endTime: '14:38',
      endSpot: 'V00',
      howLost: 'Touchdown',
      time: '0:57',
    });
    expect(report.chronological[22]).toMatchObject({
      driveNumber: 23,
      endSpot: 'H06',
      howLost: 'Fumble',
    });
    expect(report.chronological[23]).toMatchObject({
      driveNumber: 24,
      howObtained: 'Fumble',
    });
  });

  it('includes the final kneel-down possession as an end-of-game drive', () => {
    expect(report.chronological.at(-1)).toMatchObject({
      driveNumber: 28,
      teamLabel: 'WVSU',
      quarter: 4,
      startSpot: 'H25',
      startTime: '0:37',
      howObtained: 'Kickoff',
      endSpot: 'H24',
      endTime: '0:00',
      howLost: 'End of Game',
      plays: 1,
      yards: -1,
      time: '0:37',
    });
  });

  it('reports the acquisition kickoff instead of a stale penalty-enforcement drive reason', () => {
    const envelope = structuredClone(baselineRecord.envelope);
    envelope.drives.current.startReason = 'penaltyEnforcement';

    const repairedReport = buildFootballDriveChartReport(envelope);

    expect(repairedReport.chronological.at(-1)).toMatchObject({
      driveNumber: 28,
      howObtained: 'Kickoff',
    });
  });

  it('breaks third and fourth downs and average field positions out by quarter', () => {
    expect(breakdownRow(report, 'V', 'third-down').values).toEqual({
      1: '0-2',
      2: '0-1',
      3: '3-7',
      4: '1-4',
      total: '4-14',
    });
    expect(breakdownRow(report, 'V', 'fourth-down').values).toEqual({
      1: '0-0',
      2: '0-1',
      3: '1-2',
      4: '1-1',
      total: '2-4',
    });
    expect(breakdownRow(report, 'H', 'third-down').values).toEqual({
      1: '1-3',
      2: '3-4',
      3: '1-1',
      4: '0-2',
      total: '5-10',
    });
    expect(breakdownRow(report, 'V', 'average-start').values.total).toBe('V31');
    expect(breakdownRow(report, 'V', 'average-end').values.total).toBe('H28.5');
    expect(breakdownRow(report, 'H', 'average-start').values.total).toBe('H33.9');
    expect(breakdownRow(report, 'H', 'average-end').values.total).toBe('V27.7');
  });
});
