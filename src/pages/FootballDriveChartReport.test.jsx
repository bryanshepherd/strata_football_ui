import React from 'react';
import { render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import baselineRecord from '../data/footballCompletedBaselineGameRecord.json';
import {
  FOOTBALL_DASHBOARD_STORAGE_KEY,
  saveDashboardSeededFootballEnvelope,
} from '../services/footballDashboardService';
import FootballDriveChartReport from './FootballDriveChartReport';

describe('FootballDriveChartReport', () => {
  it('renders the team charts first and the chronological chart on a forced second page', () => {
    const { container } = render(
      <MemoryRouter>
        <FootballDriveChartReport envelope={baselineRecord.envelope} />
      </MemoryRouter>,
    );

    expect(screen.getAllByRole('heading', { level: 1, name: 'Drive Chart' })).toHaveLength(2);
    expect(screen.getAllByText('Fairmont St. vs. West Virginia St. (September 27, 2025)')).toHaveLength(2);
    expect(screen.getAllByRole('img', { name: 'StrataSportsSuite' })).toHaveLength(2);
    expect(screen.getAllByRole('img', { name: 'StrataFootball' })).toHaveLength(2);
    expect(screen.getByRole('heading', { level: 2, name: 'Fairmont St. Drive Chart' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 3, name: 'Fairmont St. Breakdown' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 2, name: 'West Virginia St. Drive Chart' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 3, name: 'West Virginia St. Breakdown' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 2, name: 'Chronological Drive Chart' })).toBeInTheDocument();

    const pages = container.querySelectorAll('[data-football-report^="drive-chart"]');
    expect(pages).toHaveLength(2);
    expect(pages[0]).toHaveAttribute('data-football-report', 'drive-chart-teams');
    expect(pages[1]).toHaveAttribute('data-football-report', 'drive-chart-chronological');
    expect(pages[1]).toHaveClass('football-drive-chart-page-break');
  });

  it('renders the requested chart columns and every drive in team and chronological order', () => {
    const { container } = render(
      <MemoryRouter>
        <FootballDriveChartReport envelope={baselineRecord.envelope} />
      </MemoryRouter>,
    );
    const chronological = screen.getByRole('table', { name: 'Chronological drive chart' });
    ['TEAM', 'QTR', 'START SPOT', 'START TIME', 'HOW OBTAINED', 'END SPOT', 'END TIME', 'HOW LOST', 'PLAYS', 'YARDS', 'TIME'].forEach((heading) => {
      expect(within(chronological).getByRole('columnheader', { name: heading })).toBeInTheDocument();
    });
    expect(within(screen.getByRole('table', { name: 'Fairmont St. drive chart' })).getAllByRole('row')).toHaveLength(14);
    expect(within(screen.getByRole('table', { name: 'West Virginia St. drive chart' })).getAllByRole('row')).toHaveLength(16);
    expect(within(chronological).getAllByRole('row')).toHaveLength(29);
    expect(container.querySelectorAll('.football-drive-chart-table tbody tr')).toHaveLength(56);
    expect(within(chronological).getByRole('row', { name: 'WVSU 4 H25 0:37 Kickoff H24 0:00 End of Game 1 -1 0:37' })).toBeInTheDocument();
  });

  it('renders both requested quarterly breakdowns', () => {
    render(
      <MemoryRouter>
        <FootballDriveChartReport envelope={baselineRecord.envelope} />
      </MemoryRouter>,
    );
    const visitor = screen.getByRole('table', { name: 'Fairmont St. drive breakdown' });
    const home = screen.getByRole('table', { name: 'West Virginia St. drive breakdown' });
    ['Q1', 'Q2', 'Q3', 'Q4', 'TOTAL'].forEach((heading) => {
      expect(within(visitor).getByRole('columnheader', { name: heading })).toBeInTheDocument();
      expect(within(home).getByRole('columnheader', { name: heading })).toBeInTheDocument();
    });
    expect(within(visitor).getByRole('row', { name: '3rd Down Efficiency 0-2 0-1 3-7 1-4 4-14' })).toBeInTheDocument();
    expect(within(visitor).getByRole('row', { name: '4th Down Efficiency 0-0 0-1 1-2 1-1 2-4' })).toBeInTheDocument();
    expect(within(home).getByRole('row', { name: '3rd Down Efficiency 1-3 3-4 1-1 0-2 5-10' })).toBeInTheDocument();
    expect(within(home).getByRole('row', { name: '4th Down Efficiency 0-0 0-0 0-0 0-0 0-0' })).toBeInTheDocument();
  });

  it('uses the recovered local envelope selected by the static report URL', () => {
    const envelope = structuredClone(baselineRecord.envelope);
    envelope.gameId = 'FB-RECOVERED-DRIVE-CHART';
    envelope.rosters.gameId = envelope.gameId;
    envelope.game.teams.V.name = 'Recovered Visitor';
    envelope.game.teams.H.name = 'Recovered Home';
    saveDashboardSeededFootballEnvelope(envelope.gameId, envelope);
    window.history.pushState(
      {},
      '',
      '/football-scorer/index.html?report=drive-chart&gameId=FB-RECOVERED-DRIVE-CHART&dashboardGameId=DASH-RECOVERED-DRIVE-CHART',
    );

    try {
      render(
        <MemoryRouter>
          <FootballDriveChartReport />
        </MemoryRouter>,
      );
      expect(screen.getByRole('heading', { level: 2, name: 'Recovered Visitor Drive Chart' })).toBeInTheDocument();
      expect(screen.getByRole('heading', { level: 2, name: 'Recovered Home Drive Chart' })).toBeInTheDocument();
      expect(screen.getByRole('link', { name: 'Back to scorer' })).toHaveAttribute(
        'href',
        '/index.html?envelopeGameId=FB-RECOVERED-DRIVE-CHART&dashboardGameId=DASH-RECOVERED-DRIVE-CHART',
      );
    } finally {
      window.localStorage.removeItem(FOOTBALL_DASHBOARD_STORAGE_KEY);
      window.history.replaceState({}, '', '/');
    }
  });
});
