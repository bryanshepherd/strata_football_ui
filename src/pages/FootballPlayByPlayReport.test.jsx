import React from 'react';
import { render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import baselineRecord from '../data/footballCompletedBaselineGameRecord.json';
import FootballPlayByPlayReport from './FootballPlayByPlayReport';

describe('FootballPlayByPlayReport', () => {
  afterEach(() => {
    window.history.replaceState({}, '', '/');
  });

  it('renders a branded play page and a quarter-only Quickie page for every quarter', () => {
    const { container } = render(
      <MemoryRouter>
        <FootballPlayByPlayReport envelope={baselineRecord.envelope} />
      </MemoryRouter>,
    );
    const playPages = [...container.querySelectorAll('[data-football-report="play-by-play-quarter"]')];
    const quickiePages = [...container.querySelectorAll('[data-football-report="play-by-play-quarter-quickie"]')];

    expect(playPages).toHaveLength(4);
    expect(quickiePages).toHaveLength(4);
    expect(playPages[0]).not.toHaveClass('football-play-by-play-page-break');
    expect(playPages.slice(1).every((page) => page.classList.contains('football-play-by-play-page-break'))).toBe(true);
    expect(quickiePages.every((page) => page.classList.contains('football-play-by-play-page-break'))).toBe(true);
    expect(screen.getAllByRole('img', { name: 'StrataSportsSuite' })).toHaveLength(8);
    expect(screen.getAllByRole('img', { name: 'StrataFootball' })).toHaveLength(8);
    expect(within(quickiePages[2]).getByText('Third Quarter')).toBeInTheDocument();
    expect(within(quickiePages[2]).getByRole('row', { name: 'Score 11 21' })).toBeInTheDocument();
  });

  it('renders the three unlabelled play columns and styled drive and score rows', () => {
    const { container } = render(
      <MemoryRouter>
        <FootballPlayByPlayReport envelope={baselineRecord.envelope} />
      </MemoryRouter>,
    );
    const firstQuarter = container.querySelector('[data-football-report="play-by-play-quarter"][data-quarter="1"]');
    const table = within(firstQuarter).getByRole('table', { name: 'First Quarter play-by-play' });
    const driveStart = within(table).getByText('WVSU drive start at 14:54.').closest('tr');
    const score = within(table).getByText('FAIR 7 – WVSU 0').closest('tr');
    const driveEnd = within(table).getByText('WVSU drive: 4 plays, -12 yards, 1:22; Punt.').closest('tr');

    expect(within(table).queryAllByRole('columnheader')).toHaveLength(0);
    expect(within(table).getAllByText('WVSU 26').length).toBeGreaterThan(0);
    expect(driveStart).toHaveClass('football-play-by-play-drive-start');
    expect(driveStart.firstElementChild).toHaveAttribute('colspan', '3');
    expect(score).toHaveClass('football-play-by-play-score');
    expect(driveEnd).toHaveClass('football-play-by-play-drive-end');
  });

  it('does not force a break before the first quarter included in a partial report', () => {
    window.history.replaceState({}, '', '/?startQuarter=3&endQuarter=4');
    const { container } = render(
      <MemoryRouter>
        <FootballPlayByPlayReport envelope={baselineRecord.envelope} />
      </MemoryRouter>,
    );
    const playPages = [...container.querySelectorAll('[data-football-report="play-by-play-quarter"]')];

    expect(playPages).toHaveLength(2);
    expect(playPages[0]).toHaveAttribute('data-quarter', '3');
    expect(playPages[0]).not.toHaveClass('football-play-by-play-page-break');
    expect(playPages[1]).toHaveClass('football-play-by-play-page-break');
  });
});
