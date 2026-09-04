import React from 'react';
import { render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import baselineRecord from '../data/footballCompletedBaselineGameRecord.json';
import {
  FOOTBALL_DASHBOARD_STORAGE_KEY,
  saveDashboardSeededFootballEnvelope,
} from '../services/footballDashboardService';
import FootballTeamStatsReport from './FootballTeamStatsReport';

describe('FootballTeamStatsReport', () => {
  it('renders the standard branding and three-column L2 header', () => {
    render(
      <MemoryRouter>
        <FootballTeamStatsReport envelope={baselineRecord.envelope} />
      </MemoryRouter>,
    );

    expect(screen.getByRole('img', { name: 'StrataSportsSuite' })).toHaveAttribute('src', '/strata-sports-suite.png');
    expect(screen.getByRole('heading', { level: 1, name: 'Team Stats' })).toBeInTheDocument();
    expect(screen.getByText('Fairmont St. vs. West Virginia St. (September 27, 2025)')).toBeInTheDocument();
    expect(screen.getByRole('img', { name: 'StrataFootball' })).toHaveAttribute('src', '/strata-football.png');
    const table = screen.getByRole('table', { name: 'Team stats' });
    expect(within(table).getByRole('columnheader', { name: 'STAT' })).toBeInTheDocument();
    expect(within(table).getByRole('columnheader', { name: 'Fairmont St.' })).toBeInTheDocument();
    expect(within(table).getByRole('columnheader', { name: 'West Virginia St.' })).toBeInTheDocument();
  });

  it('renders populated heading rows and the requested return formats', () => {
    render(
      <MemoryRouter>
        <FootballTeamStatsReport envelope={baselineRecord.envelope} />
      </MemoryRouter>,
    );
    const table = screen.getByRole('table', { name: 'Team stats' });
    expect(within(table).getByRole('row', { name: 'First Downs 26 24' })).toBeInTheDocument();
    expect(within(table).getByRole('row', { name: 'Punts 4-107 4-185' })).toBeInTheDocument();
    expect(within(table).getByRole('row', { name: 'Kickoff Returns (Num-Yds-TD) 6-76-0 4-96-0' })).toBeInTheDocument();
    expect(within(table).getByRole('row', { name: 'Time of Possession 28:42 31:18' })).toBeInTheDocument();
    expect(within(table).getByRole('row', { name: 'Points Off Turnover 0 7' })).toBeInTheDocument();
  });

  it('uses the recovered local envelope selected by the static report URL', () => {
    const envelope = structuredClone(baselineRecord.envelope);
    envelope.gameId = 'FB-RECOVERED-TEAM-STATS';
    envelope.rosters.gameId = envelope.gameId;
    envelope.game.teams.V.name = 'Recovered Visitor';
    envelope.game.teams.H.name = 'Recovered Home';
    saveDashboardSeededFootballEnvelope(envelope.gameId, envelope);
    window.history.pushState(
      {},
      '',
      '/football-scorer/index.html?report=team-stats&gameId=FB-RECOVERED-TEAM-STATS&dashboardGameId=DASH-RECOVERED-TEAM-STATS',
    );

    try {
      render(
        <MemoryRouter>
          <FootballTeamStatsReport />
        </MemoryRouter>,
      );

      const table = screen.getByRole('table', { name: 'Team stats' });
      expect(within(table).getByRole('columnheader', { name: 'Recovered Visitor' })).toBeInTheDocument();
      expect(within(table).getByRole('columnheader', { name: 'Recovered Home' })).toBeInTheDocument();
      expect(screen.getByRole('link', { name: 'Back to scorer' })).toHaveAttribute(
        'href',
        '/index.html?envelopeGameId=FB-RECOVERED-TEAM-STATS&dashboardGameId=DASH-RECOVERED-TEAM-STATS',
      );
    } finally {
      window.localStorage.removeItem(FOOTBALL_DASHBOARD_STORAGE_KEY);
      window.history.replaceState({}, '', '/');
    }
  });

  it('repairs omitted end-of-half and kickoff-return touchdown possession before rendering', () => {
    const envelope = structuredClone(baselineRecord.envelope);
    const segment = (team, startPeriod, startClock, endClock, suffix) => ({
      driveId: `DRV-${team}-${startPeriod}-${suffix}`,
      team,
      startPeriod,
      startClock,
      endPeriod: startPeriod,
      endClock,
      result: 'punt',
      plays: 1,
      yards: 0,
    });
    const visitorSegments = [
      { startPeriod: 1, startClock: '12:00', endPeriod: 1, endClock: '05:21' },
      { startPeriod: 2, startClock: '12:00', endPeriod: 2, endClock: '06:23' },
      { startPeriod: 3, startClock: '12:00', endPeriod: 3, endClock: '08:44' },
      { startPeriod: 4, startClock: '12:00', endPeriod: 4, endClock: '05:38' },
    ];
    const homeSegments = [
      { startPeriod: 1, startClock: '05:21', endPeriod: 1, endClock: '00:00' },
      { startPeriod: 2, startClock: '06:23', endPeriod: 2, endClock: '01:12' },
      { startPeriod: 3, startClock: '08:44', endPeriod: 3, endClock: '08:20' },
      { startPeriod: 3, startClock: '08:06', endPeriod: 3, endClock: '00:00' },
      { startPeriod: 4, startClock: '05:38', endPeriod: 4, endClock: '00:00' },
    ];
    envelope.game.rules = { ...envelope.game.rules, periods: 4, minutesPerPeriod: 12 };
    envelope.game.period = 4;
    envelope.clock = { ...envelope.clock, period: 4, clock: '00:00', clockTenths: 0 };
    envelope.events = [
      {
        eventId: 'KICKOFF-RETURN-TD-REPORT',
        sequence: 82,
        status: 'accepted',
        type: 'kickoff',
        subtype: 'returned',
        period: 3,
        clock: '08:20',
        possession: 'H',
        participants: {
          kicker: { playerId: 'H-KICKER', team: 'H', role: 'kicker' },
          returner: { playerId: 'V-RETURNER', team: 'V', role: 'returner' },
        },
        result: {
          code: 'touchdown',
          return: { type: 'Kickoff' },
          scoring: { team: 'V', points: 6, type: 'touchdown' },
        },
        penalties: [],
      },
      {
        eventId: 'CLOCK-AFTER-KICKOFF-RETURN-TD-REPORT',
        sequence: 83,
        status: 'accepted',
        type: 'gameControl',
        subtype: 'setClock',
        period: 3,
        clock: '08:20',
        result: { code: 'clockUpdate', gameControl: { action: 'setClock', clock: '08:06' } },
        penalties: [],
      },
    ];
    envelope.drives = {
      current: null,
      completed: [
        ...visitorSegments.map((item, index) => segment('V', item.startPeriod, item.startClock, item.endClock, index)),
        ...homeSegments.map((item, index) => segment('H', item.startPeriod, item.startClock, item.endClock, index)),
        {
          driveId: 'DRV-V-END-OF-HALF',
          team: 'V',
          startPeriod: 2,
          startClock: '01:12',
          endPeriod: 3,
          endClock: '12:00',
          result: 'endOfHalf',
          plays: 1,
          yards: 0,
        },
      ],
    };
    envelope.stats.teams.V = {
      ...envelope.stats.teams.V,
      possessionSegments: visitorSegments,
      timeOfPossession: 21 * 60 + 54,
    };
    envelope.stats.teams.H = {
      ...envelope.stats.teams.H,
      possessionSegments: homeSegments,
      timeOfPossession: 24 * 60 + 40,
    };

    render(
      <MemoryRouter>
        <FootballTeamStatsReport envelope={envelope} />
      </MemoryRouter>,
    );

    const table = screen.getByRole('table', { name: 'Team stats' });
    expect(within(table).getByRole('row', { name: 'Time of Possession 23:20 24:40' })).toBeInTheDocument();
    expect(within(table).getByRole('row', { name: '2nd Quarter 6:49 5:11' })).toBeInTheDocument();
    expect(within(table).getByRole('row', { name: '3rd Quarter 3:30 8:30' })).toBeInTheDocument();
  });
});
