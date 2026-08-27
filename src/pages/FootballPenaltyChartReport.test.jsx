import React from 'react';
import { render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import baselineRecord from '../data/footballCompletedBaselineGameRecord.json';
import {
  FOOTBALL_DASHBOARD_STORAGE_KEY,
  saveDashboardSeededFootballEnvelope,
} from '../services/footballDashboardService';
import FootballPenaltyChartReport from './FootballPenaltyChartReport';

describe('FootballPenaltyChartReport', () => {
  it('renders one branded page per team with a forced second-page boundary', () => {
    const { container } = render(
      <MemoryRouter>
        <FootballPenaltyChartReport envelope={baselineRecord.envelope} />
      </MemoryRouter>,
    );

    expect(screen.getAllByRole('heading', { level: 1, name: 'Penalty Chart' })).toHaveLength(2);
    expect(screen.getAllByText('Fairmont St. vs. West Virginia St. (September 27, 2025)')).toHaveLength(2);
    expect(screen.getAllByRole('img', { name: 'StrataSportsSuite' })).toHaveLength(2);
    expect(screen.getAllByRole('img', { name: 'StrataFootball' })).toHaveLength(2);
    expect(screen.getByRole('heading', { level: 2, name: 'Fairmont St.' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 2, name: 'West Virginia St.' })).toBeInTheDocument();

    const pages = container.querySelectorAll('[data-football-report="penalty-chart"]');
    expect(pages).toHaveLength(2);
    expect(pages[0]).toHaveAttribute('data-team', 'V');
    expect(pages[1]).toHaveAttribute('data-team', 'H');
    expect(pages[1]).toHaveClass('football-penalty-chart-page-break');
  });

  it('renders exactly two rows per penalty and highlights accepted information rows only', () => {
    const { container } = render(
      <MemoryRouter>
        <FootballPenaltyChartReport envelope={baselineRecord.envelope} />
      </MemoryRouter>,
    );

    expect(screen.getAllByRole('heading', { level: 3 })).toHaveLength(6);
    const entries = container.querySelectorAll('.football-penalty-entry');
    expect(entries).toHaveLength(19);
    entries.forEach((entry) => expect(within(entry).getAllByRole('row')).toHaveLength(2));
    expect(container.querySelectorAll('.football-penalty-info-accepted')).toHaveLength(17);
    expect(container.querySelectorAll('.football-penalty-info-standard')).toHaveLength(2);
    expect(container.querySelector('[data-disposition="declined"] .football-penalty-info-accepted')).toBeNull();
  });

  it('renders the seven information columns and reprints the play text', () => {
    render(
      <MemoryRouter>
        <FootballPenaltyChartReport envelope={baselineRecord.envelope} />
      </MemoryRouter>,
    );
    const table = screen.getByRole('table', { name: 'Fairmont St. Offensive Penalties' });
    ['DOWN & DISTANCE', 'PRE-FOUL SPOT', 'DISPOSITION', 'FOUL NAME', 'PLAYER', 'YARDS', 'POST-FOUL SPOT'].forEach((heading) => {
      expect(within(table).getByRole('columnheader', { name: heading })).toBeInTheDocument();
    });
    expect(within(table).getByText('FAIR #11 Nino Marzullo pass complete to #5 Winston Page for 1 yard to the H29, tackled by #20 TJ Lomax, PENALTY FAIR Offensive Pass Interference (#4 Davin Driskell), 15 yards to the H45, replay down.')).toBeInTheDocument();
  });

  it('uses the recovered local envelope selected by the static report URL', () => {
    const envelope = structuredClone(baselineRecord.envelope);
    envelope.gameId = 'FB-RECOVERED-PENALTY-CHART';
    envelope.rosters.gameId = envelope.gameId;
    envelope.game.teams.V.name = 'Recovered Visitor';
    envelope.game.teams.H.name = 'Recovered Home';
    saveDashboardSeededFootballEnvelope(envelope.gameId, envelope);
    window.history.pushState(
      {},
      '',
      '/football-scorer/index.html?report=penalty-chart&gameId=FB-RECOVERED-PENALTY-CHART&dashboardGameId=DASH-RECOVERED-PENALTY-CHART',
    );

    try {
      render(
        <MemoryRouter>
          <FootballPenaltyChartReport />
        </MemoryRouter>,
      );
      expect(screen.getByRole('heading', { level: 2, name: 'Recovered Visitor' })).toBeInTheDocument();
      expect(screen.getByRole('heading', { level: 2, name: 'Recovered Home' })).toBeInTheDocument();
      expect(screen.getByRole('link', { name: 'Back to scorer' })).toHaveAttribute(
        'href',
        '/index.html?envelopeGameId=FB-RECOVERED-PENALTY-CHART&dashboardGameId=DASH-RECOVERED-PENALTY-CHART',
      );
    } finally {
      window.localStorage.removeItem(FOOTBALL_DASHBOARD_STORAGE_KEY);
      window.history.replaceState({}, '', '/');
    }
  });
});
