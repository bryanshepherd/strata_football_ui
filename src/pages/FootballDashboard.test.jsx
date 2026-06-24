import React from 'react';
import { fireEvent, render, screen, within } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it } from 'vitest';
import {
  FOOTBALL_DASHBOARD_STORAGE_KEY,
  listFootballDashboardGames,
} from '../services/footballDashboardService';
import FootballDashboard from './FootballDashboard';

const renderDashboard = () =>
  render(
    <MemoryRouter initialEntries={['/']}>
      <Routes>
        <Route path="/" element={<FootballDashboard />} />
        <Route path="/scorer" element={<div>Scorer</div>} />
      </Routes>
    </MemoryRouter>,
  );

describe('FootballDashboard', () => {
  beforeEach(() => {
    window.localStorage.removeItem(FOOTBALL_DASHBOARD_STORAGE_KEY);
  });

  it('renders the football game list and create game form', () => {
    renderDashboard();

    expect(screen.getByRole('heading', { name: /football dashboard/i })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: /create football game/i })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: /football games/i })).toBeInTheDocument();
    expect(screen.getByLabelText(/visitor team/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/home team/i)).toBeInTheDocument();
    expect(screen.getByText(/roster attachment/i)).toBeInTheDocument();
    expect(screen.getByText(/no football games yet/i)).toBeInTheDocument();
  });

  it('creates a seeded football game and shows it in the list', () => {
    renderDashboard();

    fireEvent.click(screen.getByRole('button', { name: /create game/i }));

    expect(screen.getByText('FB-VIS-AT-HOM-001')).toBeInTheDocument();
    expect(screen.getByText('VIS at HOM')).toBeInTheDocument();
    expect(screen.getByText('Visitor Tech at Home State')).toBeInTheDocument();
    expect(screen.getByText('Seeded')).toBeInTheDocument();
    expect(screen.getByText(/1 games/i)).toBeInTheDocument();

    const storedGames = listFootballDashboardGames();
    expect(storedGames).toHaveLength(1);
    expect(storedGames[0].envelope.gameId).toBe('FB-VIS-AT-HOM-001');
    expect(storedGames[0].envelope.events).toEqual([]);
  });

  it('links each dashboard game to the scorer with a real gameId', () => {
    renderDashboard();

    fireEvent.click(screen.getByRole('button', { name: /create game/i }));

    const row = screen.getByText('FB-VIS-AT-HOM-001').closest('tr');
    const launchLink = within(row).getByRole('link', { name: /launch scorer/i });

    expect(launchLink).toHaveAttribute('href', '/scorer?gameId=FB-VIS-AT-HOM-001');
  });

  it('validates that home and visitor teams differ before creating a game', () => {
    renderDashboard();

    fireEvent.change(screen.getByLabelText(/visitor team/i), { target: { value: 'TEAM-H' } });
    fireEvent.click(screen.getByRole('button', { name: /create game/i }));

    expect(screen.getByText(/home and visitor teams must be different/i)).toBeInTheDocument();
    expect(listFootballDashboardGames()).toHaveLength(0);
  });
});
