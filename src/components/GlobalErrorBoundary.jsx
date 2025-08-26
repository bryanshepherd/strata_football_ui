import React from 'react';

/**
 * Global Error Boundary for the Strata Football UI
 * 
 * Catches JavaScript errors anywhere in the component tree and displays
 * a fallback UI instead of crashing the entire application.
 */
export default class GlobalErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { 
      hasError: false, 
      error: null, 
      errorInfo: null 
    };
  }

  static getDerivedStateFromError(error) {
    // Update state so the next render will show the fallback UI
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    // Update state with error details
    this.setState({
      error: error,
      errorInfo: errorInfo
    });
    
    // Log error details for debugging
    console.error('[ErrorBoundary] Component tree crashed:', error, errorInfo);
    
    // TODO(contracts): Send to external error reporting service
    // Could send to Sentry, LogRocket, or custom error tracking
  }

  render() {
    if (this.state.hasError) {
      // Fallback UI when something crashes
      return (
        <div style={{
          padding: '20px',
          backgroundColor: '#fee',
          border: '2px solid #dc2626',
          borderRadius: '8px',
          margin: '20px',
          fontFamily: 'Arial, sans-serif'
        }}>
          <h2 style={{
            color: '#dc2626',
            marginTop: '0',
            fontSize: '1.5rem'
          }}>
            🏈 Application Error
          </h2>
          
          <p style={{
            fontSize: '1rem',
            marginBottom: '16px',
            color: '#374151'
          }}>
            Something went wrong in the football scoring application. 
            Please refresh the page or contact support if the problem persists.
          </p>

          <details style={{
            backgroundColor: '#f9fafb',
            border: '1px solid #d1d5db',
            borderRadius: '4px',
            padding: '12px',
            marginBottom: '16px'
          }}>
            <summary style={{
              cursor: 'pointer',
              fontWeight: 'bold',
              color: '#374151'
            }}>
              Error Details (for developers)
            </summary>
            
            <div style={{
              marginTop: '12px',
              fontSize: '0.875rem',
              fontFamily: 'monospace'
            }}>
              <div>
                <strong>Error:</strong>
                <pre style={{
                  backgroundColor: '#f3f4f6',
                  padding: '8px',
                  borderRadius: '4px',
                  marginTop: '4px',
                  whiteSpace: 'pre-wrap',
                  wordBreak: 'break-word'
                }}>
                  {this.state.error && this.state.error.toString()}
                </pre>
              </div>
              
              {this.state.errorInfo && (
                <div style={{ marginTop: '12px' }}>
                  <strong>Component Stack:</strong>
                  <pre style={{
                    backgroundColor: '#f3f4f6',
                    padding: '8px',
                    borderRadius: '4px',
                    marginTop: '4px',
                    whiteSpace: 'pre-wrap',
                    fontSize: '0.75rem',
                    wordBreak: 'break-word'
                  }}>
                    {this.state.errorInfo.componentStack}
                  </pre>
                </div>
              )}
            </div>
          </details>

          <div style={{
            display: 'flex',
            gap: '12px',
            flexWrap: 'wrap'
          }}>
            <button
              onClick={() => window.location.reload()}
              style={{
                backgroundColor: '#dc2626',
                color: 'white',
                border: 'none',
                padding: '8px 16px',
                borderRadius: '4px',
                cursor: 'pointer',
                fontSize: '0.875rem',
                fontWeight: '500'
              }}
            >
              Reload Application
            </button>
            
            <button
              onClick={() => {
                // Reset error boundary state
                this.setState({
                  hasError: false,
                  error: null,
                  errorInfo: null
                });
              }}
              style={{
                backgroundColor: '#6b7280',
                color: 'white',
                border: 'none',
                padding: '8px 16px',
                borderRadius: '4px',
                cursor: 'pointer',
                fontSize: '0.875rem',
                fontWeight: '500'
              }}
            >
              Try Again
            </button>
            
            <button
              onClick={() => {
                const errorReport = {
                  error: this.state.error?.toString(),
                  stack: this.state.error?.stack,
                  componentStack: this.state.errorInfo?.componentStack,
                  timestamp: new Date().toISOString(),
                  userAgent: navigator.userAgent,
                  url: window.location.href
                };
                
                // Copy error report to clipboard
                navigator.clipboard.writeText(JSON.stringify(errorReport, null, 2))
                  .then(() => {
                    alert('Error report copied to clipboard');
                  })
                  .catch(() => {
                    console.log('Error report:', errorReport);
                    alert('Error report logged to console');
                  });
              }}
              style={{
                backgroundColor: '#374151',
                color: 'white',
                border: 'none',
                padding: '8px 16px',
                borderRadius: '4px',
                cursor: 'pointer',
                fontSize: '0.875rem',
                fontWeight: '500'
              }}
            >
              Copy Error Report
            </button>
          </div>
          
          <div style={{
            marginTop: '16px',
            padding: '12px',
            backgroundColor: '#f0f9ff',
            border: '1px solid #0ea5e9',
            borderRadius: '4px',
            fontSize: '0.875rem'
          }}>
            <strong>💡 Recovery Options:</strong>
            <ul style={{ marginTop: '8px', paddingLeft: '20px' }}>
              <li>Refresh the page to restart the application</li>
              <li>Check if this issue happens consistently</li>
              <li>Try a different browser or clear browser cache</li>
              <li>Report this error to the development team</li>
            </ul>
          </div>
        </div>
      );
    }

    // No error, render children normally
    return this.props.children;
  }
}