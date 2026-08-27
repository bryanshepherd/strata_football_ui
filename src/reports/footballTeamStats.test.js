import { describe, expect, it } from 'vitest';
import baselineRecord from '../data/footballCompletedBaselineGameRecord.json';
import { buildFootballTeamStatsReport } from './footballTeamStats';

const valuesFor = (report, id) => report.rows.find((row) => row.id === id)?.values;

describe('football team stats report projection', () => {
  const report = buildFootballTeamStatsReport(baselineRecord.envelope);

  it('uses the completed example game and the standard report header', () => {
    expect(report.gameId).toBe('FB-ca7d777b-a8aa-4a26-bd20-b10f7bb621a7');
    expect(report.reportTitle).toBe('Team Stats');
    expect(report.reportMatchup).toBe('Fairmont St. vs. West Virginia St. (September 27, 2025)');
  });

  it('projects the requested offense and possession totals', () => {
    expect(valuesFor(report, 'first-downs')).toEqual({ V: '26', H: '24' });
    expect(valuesFor(report, 'first-downs-passing')).toEqual({ V: '17', H: '6' });
    expect(valuesFor(report, 'first-downs-penalty')).toEqual({ V: '4', H: '3' });
    expect(valuesFor(report, 'rushing-yards')).toEqual({ V: '204', H: '328' });
    expect(valuesFor(report, 'rushing-gained')).toEqual({ V: '215', H: '342' });
    expect(valuesFor(report, 'rushing-lost')).toEqual({ V: '11', H: '14' });
    expect(valuesFor(report, 'passing-cai')).toEqual({ V: '30-50-0', H: '7-17-0' });
    expect(valuesFor(report, 'passing-yards')).toEqual({ V: '313', H: '236' });
    expect(valuesFor(report, 'total-offense')).toEqual({ V: '517', H: '564' });
    expect(valuesFor(report, 'possession')).toEqual({ V: '28:42', H: '31:18' });
    expect(valuesFor(report, 'possession-1')).toEqual({ V: '6:36', H: '8:24' });
    expect(valuesFor(report, 'possession-4')).toEqual({ V: '6:42', H: '8:18' });
  });

  it('projects punts, kickoffs, returns, efficiencies, and turnover points', () => {
    expect(valuesFor(report, 'punts')).toEqual({ V: '4-107', H: '4-185' });
    expect(valuesFor(report, 'punt-net')).toEqual({ V: '22.3', H: '46.3' });
    expect(valuesFor(report, 'kickoffs')).toEqual({ V: '7-444', H: '10-539' });
    expect(valuesFor(report, 'kickoff-net')).toEqual({ V: '39.4', H: '36.1' });
    expect(valuesFor(report, 'kickoff-returns')).toEqual({ V: '6-76-0', H: '4-96-0' });
    expect(valuesFor(report, 'third-down')).toEqual({ V: '4-14', H: '5-10' });
    expect(valuesFor(report, 'fourth-down')).toEqual({ V: '2-4', H: '0-0' });
    expect(valuesFor(report, 'red-zone')).toEqual({ V: '4-5', H: '4-4' });
    expect(valuesFor(report, 'red-zone-touchdown')).toEqual({ V: '4-5', H: '2-4' });
    expect(valuesFor(report, 'red-zone-field-goal')).toEqual({ V: '0-5', H: '2-4' });
    expect(valuesFor(report, 'points-off-turnover')).toEqual({ V: '0', H: '7' });
  });

  it('keeps all L3 rows populated and includes the two requested separators', () => {
    const headings = report.rows.filter((row) => row.level === 'heading');
    headings.forEach((row) => {
      expect(row.values.V).not.toBe('');
      expect(row.values.H).not.toBe('');
    });
    expect(report.rows.filter((row) => row.separator)).toHaveLength(2);
    expect(report.rows.find((row) => row.id === 'penalties')?.variant).toBe('alternate');
    expect(report.rows.find((row) => row.id === 'fourth-down')?.variant).toBe('alternate');
  });
});
