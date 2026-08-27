import { describe, expect, it } from 'vitest';
import baselineRecord from '../data/footballCompletedBaselineGameRecord.json';
import { buildFootballPenaltyChartReport } from './footballPenaltyChart';

const section = (report, team, sectionId) => (
  report.teams[team].sections.find((candidate) => candidate.id === sectionId)
);

describe('football penalty chart report projection', () => {
  const report = buildFootballPenaltyChartReport(baselineRecord.envelope);

  it('uses the completed example game and creates three ordered sections per team', () => {
    expect(report.gameId).toBe('FB-ca7d777b-a8aa-4a26-bd20-b10f7bb621a7');
    expect(report.reportTitle).toBe('Penalty Chart');
    expect(report.reportMatchup).toBe('Fairmont St. vs. West Virginia St. (September 27, 2025)');
    expect(report.penaltyCount).toBe(19);
    expect(report.teams.V.sections.map((item) => item.title)).toEqual([
      'Offensive Penalties',
      'Defensive Penalties',
      'Special Teams Penalties',
    ]);
    expect(report.teams.H.sections.map((item) => item.title)).toEqual([
      'Offensive Penalties',
      'Defensive Penalties',
      'Special Teams Penalties',
    ]);
  });

  it('classifies penalties by possession and moves kick and try setup penalties to special teams', () => {
    expect(section(report, 'V', 'offense').penalties).toHaveLength(3);
    expect(section(report, 'V', 'defense').penalties).toHaveLength(3);
    expect(section(report, 'V', 'specialTeams').penalties).toHaveLength(2);
    expect(section(report, 'H', 'offense').penalties).toHaveLength(3);
    expect(section(report, 'H', 'defense').penalties).toHaveLength(4);
    expect(section(report, 'H', 'specialTeams').penalties).toHaveLength(4);
    expect(section(report, 'H', 'specialTeams').penalties.map((penalty) => penalty.sequence)).toEqual([124, 134, 138, 140]);
    expect(section(report, 'V', 'specialTeams').penalties.find((penalty) => penalty.sequence === 141)).toMatchObject({
      downAndDistance: '—',
      preFoulSpot: 'V48',
      foulName: 'Holding',
      postFoulSpot: 'V38',
    });
    expect(section(report, 'H', 'specialTeams').penalties.find((penalty) => penalty.sequence === 124)).toMatchObject({
      downAndDistance: '—',
      foulName: 'Offsides',
    });
  });

  it('projects the requested information row and exact play-by-play row', () => {
    const penalty = section(report, 'V', 'offense').penalties.find((candidate) => candidate.sequence === 144);
    expect(penalty).toMatchObject({
      downAndDistance: '2 & 3',
      preFoulSpot: 'H30',
      disposition: 'Accepted',
      foulName: 'Offensive Pass Interference',
      player: '#4 Davin Driskell',
      yards: '15',
      postFoulSpot: 'H45',
      accepted: true,
    });
    expect(penalty.play).toBe('FAIR #11 Nino Marzullo pass complete to #5 Winston Page for 1 yard to the H29, tackled by #20 TJ Lomax, PENALTY FAIR Offensive Pass Interference (#4 Davin Driskell), 15 yards to the H45, replay down.');
  });

  it('leaves declined and offsetting information rows unhighlighted', () => {
    const declined = section(report, 'H', 'offense').penalties.find((candidate) => candidate.sequence === 201);
    expect(declined).toMatchObject({
      disposition: 'Declined',
      foulName: 'Holding',
      yards: '—',
      postFoulSpot: 'H26',
      accepted: false,
    });

    const envelope = structuredClone(baselineRecord.envelope);
    const event = envelope.events.find((candidate) => candidate.sequence === 201);
    event.penalties[0].status = 'offsetting';
    const offsettingReport = buildFootballPenaltyChartReport(envelope);
    const offsetting = section(offsettingReport, 'H', 'offense').penalties.find((candidate) => candidate.sequence === 201);
    expect(offsetting).toMatchObject({
      disposition: 'Offsetting',
      postFoulSpot: 'H28',
      accepted: false,
    });
  });
});
