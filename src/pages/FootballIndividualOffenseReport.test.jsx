import React from 'react';
import { render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import baselineRecord from '../data/footballCompletedBaselineGameRecord.json';
import FootballIndividualOffenseReport from './FootballIndividualOffenseReport';

describe('FootballIndividualOffenseReport', () => {
  it('renders one branded away-left and home-right report with all sections', () => {
    const { container } = render(
      <MemoryRouter>
        <FootballIndividualOffenseReport envelope={baselineRecord.envelope} />
      </MemoryRouter>,
    );
    expect(screen.getByRole('heading', { level: 1, name: 'Individual Offense' })).toBeInTheDocument();
    expect(screen.getByRole('img', { name: 'StrataSportsSuite' })).toBeInTheDocument();
    expect(screen.getByRole('img', { name: 'StrataFootball' })).toBeInTheDocument();
    const columns = container.querySelectorAll('.football-individual-offense-team');
    expect(columns).toHaveLength(2);
    expect(columns[0]).toHaveAttribute('data-team', 'V');
    expect(columns[1]).toHaveAttribute('data-team', 'H');
    expect(container.querySelector('.football-individual-offense-grid')).toBeInTheDocument();
    expect(screen.getAllByRole('heading', { level: 4 })).toHaveLength(18);
    expect(container.querySelectorAll('.football-individual-offense-total')).toHaveLength(18);
  });

  it('renders the return supercolumns and the requested new tables', () => {
    render(
      <MemoryRouter>
        <FootballIndividualOffenseReport envelope={baselineRecord.envelope} />
      </MemoryRouter>,
    );
    const returns = screen.getByRole('table', { name: 'Fairmont St. returns' });
    ['PUNT', 'KICKOFF', 'INTERCEPTION'].forEach((heading) => {
      expect(within(returns).getByRole('columnheader', { name: heading })).toHaveAttribute('colspan', '3');
    });
    expect(within(screen.getByRole('table', { name: 'Fairmont St. field goals' })).getByText('41 Yards')).toBeInTheDocument();
    expect(within(screen.getByRole('table', { name: 'Fairmont St. kickoffs' })).getByRole('row', { name: /Totals 7 444 63\.4 2 0/ })).toHaveClass('football-quickie-l3-row');
    expect(screen.getByRole('table', { name: 'West Virginia St. all-purpose yards' })).toBeInTheDocument();
    expect(screen.getByRole('table', { name: 'Fairmont St. fumbles' })).toBeInTheDocument();
  });

  it('reuses the full Quickie offense tables without leader limits', () => {
    render(
      <MemoryRouter>
        <FootballIndividualOffenseReport envelope={baselineRecord.envelope} />
      </MemoryRouter>,
    );
    const receiving = screen.getByRole('table', { name: 'Fairmont St. receiving' });
    expect(within(receiving).getAllByRole('row').length).toBeGreaterThan(6);
    expect(within(receiving).getByRole('columnheader', { name: 'YAC' })).toBeInTheDocument();
    expect(within(screen.getByRole('table', { name: 'West Virginia St. rushing' })).getByRole('row', { name: /Totals 46 .* 327/ })).toHaveClass('football-individual-offense-total');
  });
});
