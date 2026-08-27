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
    envelope.stats.teams.V.firstDowns = 27;
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
      expect(within(table).getByRole('row', { name: 'First Downs 27 24' })).toBeInTheDocument();
      expect(screen.getByRole('link', { name: 'Back to scorer' })).toHaveAttribute(
        'href',
        '/index.html?envelopeGameId=FB-RECOVERED-TEAM-STATS&dashboardGameId=DASH-RECOVERED-TEAM-STATS',
      );
    } finally {
      window.localStorage.removeItem(FOOTBALL_DASHBOARD_STORAGE_KEY);
      window.history.replaceState({}, '', '/');
    }
  });
});
