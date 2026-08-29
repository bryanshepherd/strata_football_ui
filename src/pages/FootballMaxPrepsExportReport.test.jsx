import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { vi } from 'vitest';
import baselineRecord from '../data/footballCompletedBaselineGameRecord.json';
import FootballMaxPrepsExportReport from './FootballMaxPrepsExportReport';

describe('FootballMaxPrepsExportReport', () => {
  it('renders one downloadable accredited text export per team', () => {
    const createObjectUrl = vi.fn().mockReturnValue('blob:maxpreps-test');
    const revokeObjectUrl = vi.fn();
    const anchorClick = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});
    Object.defineProperty(URL, 'createObjectURL', { configurable: true, value: createObjectUrl });
    Object.defineProperty(URL, 'revokeObjectURL', { configurable: true, value: revokeObjectUrl });

    const { container } = render(
      <MemoryRouter>
        <FootballMaxPrepsExportReport envelope={baselineRecord.envelope} />
      </MemoryRouter>,
    );

    expect(screen.getByRole('heading', { level: 1, name: 'MaxPreps Export' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Download Fairmont St. .txt' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Download West Virginia St. .txt' })).toBeInTheDocument();
    expect(screen.getByText('42987abe-b839-405c-9e4b-955fd70852bc')).toBeInTheDocument();
    expect(container.querySelector('[data-football-report="maxpreps-export"]')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Download Fairmont St. .txt' }));
    expect(createObjectUrl).toHaveBeenCalledWith(expect.objectContaining({ type: 'text/plain;charset=utf-8' }));
    expect(anchorClick).toHaveBeenCalledTimes(1);
    expect(anchorClick.mock.instances[0].download).toBe('2025-09-27-fair-maxpreps.txt');
    expect(revokeObjectUrl).toHaveBeenCalledWith('blob:maxpreps-test');

    anchorClick.mockRestore();
  });
});
