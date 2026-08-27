import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter, Routes, Route } from 'react-router-dom'
import FootballDashboard from './pages/FootballDashboard.jsx'
import FootballLayoutPreview from './pages/FootballLayoutPreview.jsx'
import FootballPlayEditorSandbox from './pages/FootballPlayEditorSandbox.jsx'
import FootballScoringSummaryReport from './pages/FootballScoringSummaryReport.jsx'
import FootballScorerShell from './pages/FootballScorerShell.jsx'
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
          <Route path="/quickie" element={<FootballScoringSummaryReport />} />
          <Route
            path="*"
            element={requestedReport === 'scoring-summary'
              ? <FootballScoringSummaryReport />
              : <FootballScorerShell />}
          />
        </Routes>
      </BrowserRouter>
    </GlobalErrorBoundary>
  </React.StrictMode>,
)
