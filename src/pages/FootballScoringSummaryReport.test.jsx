import React from 'react';
import { render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import baselineRecord from '../data/footballCompletedBaselineGameRecord.json';
import {
  FOOTBALL_DASHBOARD_STORAGE_KEY,
  saveDashboardSeededFootballEnvelope,
} from '../services/footballDashboardService';
import FootballScoringSummaryReport from './FootballScoringSummaryReport';

describe('FootballScoringSummaryReport', () => {
  it('renders the standard branded header and only the requested section names', () => {
    render(
      <MemoryRouter>
        <FootballScoringSummaryReport />
      </MemoryRouter>,
    );

    expect(screen.getByRole('img', { name: 'StrataSportsSuite' })).toHaveAttribute('src', '/strata-sports-suite.png');
    expect(screen.getByRole('heading', { level: 1, name: 'Scoring Summary' })).toBeInTheDocument();
    expect(screen.getByText('Fairmont St. vs. West Virginia St. (September 27, 2025)')).toBeInTheDocument();
    expect(screen.getByText('Fairmont St. (2-2, 0-2 MEC) vs. West Virginia St. (3-1, 2-0 MEC)')).toBeInTheDocument();
    expect(screen.getByRole('img', { name: 'StrataFootball' })).toHaveAttribute('src', '/strata-football.png');
    ['SCORE BY QUARTERS', 'SCORING SUMMARY', 'GAME DETAILS', 'OFFICIALS'].forEach((heading) => {
      expect(screen.getByRole('heading', { level: 2, name: heading })).toBeInTheDocument();
    });
    expect(screen.queryByText(/Section [1-4]/i)).not.toBeInTheDocument();
  });

  it('renders the baseline quarter totals and scoring ledger', () => {
    render(
      <MemoryRouter>
        <FootballScoringSummaryReport />
      </MemoryRouter>,
    );
    const quarterTable = screen.getByRole('table', { name: 'Score by quarters' });
    expect(within(quarterTable).getByRole('row', { name: 'Fairmont St. 7 7 11 14 39' })).toBeInTheDocument();
    expect(within(quarterTable).getByRole('row', { name: 'West Virginia St. 3 23 21 13 60' })).toBeInTheDocument();
    const scoringTable = screen.getByRole('table', { name: 'Scoring summary' });
    expect(within(scoringTable).getAllByRole('row')).toHaveLength(17);
    expect(within(scoringTable).getByRole('columnheader', { name: 'DRIVE' })).toBeInTheDocument();
    expect(within(scoringTable).getByText('LeJay Hatcher 5 yard rush (Richardson Kick)')).toBeInTheDocument();
    expect(within(scoringTable).getByText('7 Plays, 53 Yards, 3:43 TOP')).toBeInTheDocument();
    expect(within(scoringTable).getByText('Kaleb Jackson 74 yd. pass to Amare Ary (Kick Failed)')).toBeInTheDocument();
    expect(within(scoringTable).getByText('39-60')).toBeInTheDocument();
  });

  it('lists no more than six officials per print row', () => {
    const { container } = render(
      <MemoryRouter>
        <FootballScoringSummaryReport />
      </MemoryRouter>,
    );
    const grid = container.querySelector('.football-officials-grid');
    expect(grid.children).toHaveLength(8);
    expect(grid).toHaveTextContent('REFEREE');
    expect(grid).toHaveTextContent('SCORER');
    expect(grid).not.toHaveTextContent('REPLAY OFFICIAL');
  });

  it('uses the recovered local envelope selected by the static report URL', () => {
    const envelope = structuredClone(baselineRecord.envelope);
    envelope.gameId = 'FB-RECOVERED-REPORT';
    envelope.rosters.gameId = envelope.gameId;
    envelope.game.teams.V.name = 'Recovered Visitor';
    envelope.game.teams.H.name = 'Recovered Home';
    envelope.game.teams.V.score = 38;
    envelope.game.teams.H.score = 61;
    saveDashboardSeededFootballEnvelope(envelope.gameId, envelope);
    window.history.pushState(
      {},
      '',
      '/football-scorer/index.html?report=scoring-summary&gameId=FB-RECOVERED-REPORT&dashboardGameId=DASH-RECOVERED-REPORT',
    );

    try {
      render(
        <MemoryRouter>
          <FootballScoringSummaryReport />
        </MemoryRouter>,
      );

      expect(screen.getByText('Recovered Visitor vs. Recovered Home (September 27, 2025)')).toBeInTheDocument();
      expect(screen.getByRole('link', { name: 'Back to scorer' })).toHaveAttribute(
        'href',
        '/index.html?envelopeGameId=FB-RECOVERED-REPORT&dashboardGameId=DASH-RECOVERED-REPORT',
      );
    } finally {
      window.localStorage.removeItem(FOOTBALL_DASHBOARD_STORAGE_KEY);
      window.history.replaceState({}, '', '/');
    }
  });
});
