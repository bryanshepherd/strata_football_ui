import React from 'react';

const reportAsset = (filename) => `${import.meta.env.BASE_URL}${filename}`;

export const FootballReportHeader = ({ matchup, title }) => (
  <header className="football-report-standard-header">
    <img
      alt="StrataSportsSuite"
      className="football-report-suite-logo"
      src={reportAsset('strata-sports-suite.png')}
    />
    <div className="football-report-standard-header-copy">
      <h1>{title}</h1>
      <p>{matchup}</p>
    </div>
  </header>
);

export const FootballReportFooterBrand = () => (
  <footer className="football-report-brand-footer" aria-label="Football report branding">
    <img alt="StrataFootball" src={reportAsset('strata-football.png')} />
  </footer>
);
