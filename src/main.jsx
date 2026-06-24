import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter, Routes, Route } from 'react-router-dom'
import FootballDashboard from './pages/FootballDashboard.jsx'
import FootballLayoutPreview from './pages/FootballLayoutPreview.jsx'
import FootballReportPlaceholder from './pages/FootballReportPlaceholder.jsx'
import FootballScorerShell from './pages/FootballScorerShell.jsx'
import GlobalErrorBoundary from './components/GlobalErrorBoundary.jsx'
import './index.css'

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <GlobalErrorBoundary>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<FootballDashboard />} />
          <Route path="/dashboard" element={<FootballDashboard />} />
          <Route path="/scorer" element={<FootballScorerShell />} />
          <Route path="/football-layout-preview" element={<FootballLayoutPreview />} />
          <Route path="/reports" element={<FootballReportPlaceholder />} />
          <Route path="/quickie" element={<FootballReportPlaceholder />} />
          <Route path="*" element={<FootballScorerShell />} />
        </Routes>
      </BrowserRouter>
    </GlobalErrorBoundary>
  </React.StrictMode>,
)
