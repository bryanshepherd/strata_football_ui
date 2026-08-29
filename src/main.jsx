import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter, Routes, Route } from 'react-router-dom'
import FootballDashboard from './pages/FootballDashboard.jsx'
import FootballLayoutPreview from './pages/FootballLayoutPreview.jsx'
import FootballPlayEditorSandbox from './pages/FootballPlayEditorSandbox.jsx'
import FootballDriveChartReport from './pages/FootballDriveChartReport.jsx'
import FootballIndividualOffenseReport from './pages/FootballIndividualOffenseReport.jsx'
import FootballMaxPrepsExportReport from './pages/FootballMaxPrepsExportReport.jsx'
import FootballPenaltyChartReport from './pages/FootballPenaltyChartReport.jsx'
import FootballPlayByPlayReport from './pages/FootballPlayByPlayReport.jsx'
import FootballQuickieStatsReport from './pages/FootballQuickieStatsReport.jsx'
import FootballScoringSummaryReport from './pages/FootballScoringSummaryReport.jsx'
import FootballScorerShell from './pages/FootballScorerShell.jsx'
import FootballTeamStatsReport from './pages/FootballTeamStatsReport.jsx'
import GlobalErrorBoundary from './components/GlobalErrorBoundary.jsx'
import './index.css'

const requestedReport = new URLSearchParams(window.location.search).get('report')

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <GlobalErrorBoundary>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<FootballDashboard />} />
          <Route path="/dashboard" element={<FootballDashboard />} />
          <Route path="/scorer" element={<FootballScorerShell />} />
          <Route path="/football-layout-preview" element={<FootballLayoutPreview />} />
          <Route path="/football-play-editor-sandbox" element={<FootballPlayEditorSandbox />} />
          <Route path="/reports" element={<FootballScoringSummaryReport />} />
          <Route path="/reports/scoring-summary" element={<FootballScoringSummaryReport />} />
          <Route path="/reports/drive-chart" element={<FootballDriveChartReport />} />
          <Route path="/reports/individual-offense" element={<FootballIndividualOffenseReport />} />
          <Route path="/reports/maxpreps-export" element={<FootballMaxPrepsExportReport />} />
          <Route path="/reports/team-stats" element={<FootballTeamStatsReport />} />
          <Route path="/reports/penalty-chart" element={<FootballPenaltyChartReport />} />
          <Route path="/reports/play-by-play" element={<FootballPlayByPlayReport />} />
          <Route path="/reports/quickie-stats" element={<FootballQuickieStatsReport />} />
          <Route path="/quickie" element={<FootballQuickieStatsReport />} />
          <Route
            path="*"
            element={requestedReport === 'scoring-summary'
              ? <FootballScoringSummaryReport />
              : requestedReport === 'drive-chart'
                ? <FootballDriveChartReport />
              : requestedReport === 'individual-offense'
                ? <FootballIndividualOffenseReport />
              : requestedReport === 'team-stats'
                ? <FootballTeamStatsReport />
                : requestedReport === 'penalty-chart'
                  ? <FootballPenaltyChartReport />
                : requestedReport === 'play-by-play'
                  ? <FootballPlayByPlayReport />
                : requestedReport === 'maxpreps-export'
                  ? <FootballMaxPrepsExportReport />
                : ['quickie', 'quickie-stats'].includes(requestedReport)
                  ? <FootballQuickieStatsReport />
                : <FootballScorerShell />}
          />
        </Routes>
      </BrowserRouter>
    </GlobalErrorBoundary>
  </React.StrictMode>,
)
