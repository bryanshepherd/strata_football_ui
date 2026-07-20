// Test component to verify DriveSummary works
import React from 'react';
import DriveSummary from './DriveSummary';

const sampleDriveModel = {
  offense: 'H',
  number: 3,
  start: 'H25',
  howGained: 'Kickoff',
  timeGainedSec: 155, // 2:35
  playsRush: 4,
  playsPass: 2,
  penCount: 1,
  penYards: -5
};

export default function DriveSummary_Test() {
  return (
    <div className="p-4 max-w-sm">
      <h2 className="text-lg font-bold mb-4">DriveSummary Test</h2>
      <DriveSummary model={sampleDriveModel} />
    </div>
  );
}