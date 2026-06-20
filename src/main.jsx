import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter, Routes, Route } from 'react-router-dom'
import FootballReportPlaceholder from './pages/FootballReportPlaceholder.jsx'
import FootballScorerShell from './pages/FootballScorerShell.jsx'
import GlobalErrorBoundary from './components/GlobalErrorBoundary.jsx'
import './index.css'

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <GlobalErrorBoundary>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<FootballScorerShell />} />
          <Route path="/scorer" element={<FootballScorerShell />} />
          <Route path="/reports" element={<FootballReportPlaceholder />} />
          <Route path="/quickie" element={<FootballReportPlaceholder />} />
          <Route path="*" element={<FootballScorerShell />} />
        </Routes>
      </BrowserRouter>
    </GlobalErrorBoundary>
  </React.StrictMode>,
)
