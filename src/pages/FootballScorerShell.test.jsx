import React from 'react';
import { render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import FootballReportPlaceholder from './FootballReportPlaceholder';
import FootballScorerShell from './FootballScorerShell';

const renderScorer = (initialEntry = '/') =>
  render(
    <MemoryRouter initialEntries={[initialEntry]}>
      <Routes>
        <Route path="/" element={<FootballScorerShell />} />
        <Route path="/reports" element={<FootballReportPlaceholder />} />
      </Routes>
    </MemoryRouter>,
  );

describe('FootballScorerShell', () => {
  it('renders the main scorer route from the default fixture envelope', () => {
    renderScorer();

    expect(screen.getByRole('heading', { name: /visitor tech at home state/i })).toBeInTheDocument();
    expect(screen.getByText('FB-NORMAL')).toBeInTheDocument();
    expect(screen.getByText('2 and 6')).toBeInTheDocument();
    expect(screen.getByText('H44')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: /play entry/i })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: /game log/i })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: /roster lookup/i })).toBeInTheDocument();
  });

  it('renders the acceptance fixture states without backend data', () => {
    const fixtures = [
      ['/?fixture=pregame', 'FB-PREGAME', 'Not set'],
      ['/?fixture=redzone', 'FB-REDZONE', 'Red zone'],
      ['/?fixture=goalToGo', 'FB-GOALTOGO', '2 and goal'],
      ['/?fixture=final', 'FB-FINAL', 'End of game.'],
    ];

    fixtures.forEach(([entry, gameId, expectedText]) => {
      const { unmount } = renderScorer(entry);
      expect(screen.getAllByText(gameId).length).toBeGreaterThan(0);
      expect(screen.getAllByText(expectedText).length).toBeGreaterThan(0);
      unmount();
    });
  });

  it('renders the report route without football providers', () => {
    renderScorer('/reports?fixture=final');

    expect(screen.getByRole('heading', { name: /reports/i })).toBeInTheDocument();
    expect(screen.getByText(/FB-FINAL/)).toBeInTheDocument();
    expect(screen.getByText('Report Workspace')).toBeInTheDocument();
  });

  it('shows a route error for an unknown fixture key', () => {
    renderScorer('/?fixture=missing');

    expect(screen.getByRole('heading', { name: /fixture not found/i })).toBeInTheDocument();
    expect(screen.getByText(/No fixture envelope exists/)).toBeInTheDocument();
  });
});
