import React from 'react';
import { fireEvent, render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import baselineRecord from '../data/footballCompletedBaselineGameRecord.json';
import FootballQuickieStatsReport from './FootballQuickieStatsReport';

describe('FootballQuickieStatsReport', () => {
  it('renders one branded page with the three requested sections', () => {
    const { container } = render(
      <MemoryRouter>
        <FootballQuickieStatsReport envelope={baselineRecord.envelope} />
      </MemoryRouter>,
    );
    expect(screen.getByRole('heading', { level: 1, name: 'Quickie Stats' })).toBeInTheDocument();
    expect(screen.getByRole('img', { name: 'StrataSportsSuite' })).toBeInTheDocument();
    expect(screen.getByRole('img', { name: 'StrataFootball' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 2, name: 'TEAM STATS' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 2, name: 'INDIVIDUAL STATS' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 2, name: 'SCORING SUMMARY' })).toBeInTheDocument();
    expect(container.querySelectorAll('[data-football-report="quickie-stats"]')).toHaveLength(1);
    expect(screen.queryByText(/top 3|top 4|top 2/i)).not.toBeInTheDocument();
  });

  it('renders compact team rows and two side-by-side individual team columns', () => {
    const { container } = render(
      <MemoryRouter>
        <FootballQuickieStatsReport envelope={baselineRecord.envelope} />
      </MemoryRouter>,
    );
    const table = screen.getByRole('table', { name: 'Quickie team stats' });
    expect(within(table).getByRole('row', { name: 'Score 39 60' })).toBeInTheDocument();
    expect(within(table).getByRole('row', { name: 'Rushes-Net Yards 28-204 46-327' })).toHaveClass('football-quickie-l3-row');
    expect(within(table).getByRole('row', { name: 'Kickoff Returns 6-12.7 4-24.0' })).toBeInTheDocument();
    expect(container.querySelectorAll('.football-quickie-individual-team')).toHaveLength(2);
    expect(screen.getAllByRole('heading', { level: 4 })).toHaveLength(10);
  });

  it('prints only the scoring-play table from the scoring summary report', () => {
    render(
      <MemoryRouter>
        <FootballQuickieStatsReport envelope={baselineRecord.envelope} />
      </MemoryRouter>,
    );
    const scoring = screen.getByRole('table', { name: 'Quickie scoring summary' });
    ['QTR', 'TIME', 'TEAM', 'SCORING PLAY', 'DRIVE', 'SCORE (V-H)'].forEach((heading) => {
      expect(within(scoring).getByRole('columnheader', { name: heading })).toBeInTheDocument();
    });
    expect(within(scoring).getAllByRole('row')).toHaveLength(17);
    expect(screen.queryByRole('table', { name: 'Score by quarters' })).not.toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'GAME DETAILS' })).not.toBeInTheDocument();
  });

  it('switches to a quarter-only composite and updates every report section', () => {
    render(
      <MemoryRouter>
        <FootballQuickieStatsReport envelope={baselineRecord.envelope} />
      </MemoryRouter>,
    );
    fireEvent.change(screen.getByRole('combobox', { name: 'Quickie report scope' }), {
      target: { value: 'quarter-3' },
    });
    expect(screen.getAllByText('Third Quarter')).toHaveLength(2);
    expect(within(screen.getByRole('table', { name: 'Quickie team stats' })).getByRole('row', { name: 'Score 11 21' })).toBeInTheDocument();
    const scoring = screen.getByRole('table', { name: 'Quickie scoring summary' });
    expect(within(scoring).getAllByRole('row').slice(1).every((row) => within(row).getAllByRole('cell')[0].textContent === '3')).toBe(true);
    expect(window.location.search).toContain('scope=quarter');
    expect(window.location.search).toContain('quarter=3');
    window.history.replaceState({}, '', '/');
  });
});
