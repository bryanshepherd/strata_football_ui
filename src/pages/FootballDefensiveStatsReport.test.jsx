import React from 'react';
import { render, screen, within } from '@testing-library/react';
import baselineRecord from '../data/footballCompletedBaselineGameRecord.json';
import FootballDefensiveStatsReport from './FootballDefensiveStatsReport';

describe('FootballDefensiveStatsReport', () => {
  it('renders the requested columns, branding and both teams in a continuous report', () => {
    const { container } = render(<FootballDefensiveStatsReport envelope={baselineRecord.envelope} />);
    expect(screen.getByRole('heading', { level: 1, name: 'Defensive Stats' })).toBeInTheDocument();
    expect(screen.getByRole('img', { name: 'StrataSportsSuite' })).toBeInTheDocument();
    expect(screen.getByRole('img', { name: 'StrataFootball' })).toBeInTheDocument();
    const tables = screen.getAllByRole('table');
    expect(tables).toHaveLength(2);
    tables.forEach((table) => {
      expect(within(table).getAllByRole('columnheader').map((cell) => cell.textContent)).toEqual([
        '#', 'Name', 'Solo', 'Ast', 'Total', 'Sacks-Yds', 'TFL-Yds', 'FF', 'FR-Yds', 'Int-Yds', 'BrUp', 'Blks', 'QBH',
      ]);
      expect(within(table).getAllByRole('row').length).toBeGreaterThan(5);
      expect(within(table).getByRole('rowheader', { name: 'Totals' })).toBeInTheDocument();
    });
    expect(container.querySelectorAll('.football-report-page')).toHaveLength(1);
    expect([...container.querySelectorAll('.football-defensive-stats-team')].map((team) => team.dataset.team)).toEqual(['V', 'H']);
    expect(screen.getByRole('button', { name: 'Print / Save PDF' })).toBeInTheDocument();
  });
});
