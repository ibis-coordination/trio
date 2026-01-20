import type { DebugInfo } from '../types';

interface DebugPanelProps {
  debugInfo: DebugInfo;
}

export function DebugPanel({ debugInfo }: DebugPanelProps) {
  return (
    <div data-testid="debug-panel" className="debug-panel">
      <h3>Debug Info</h3>

      <div className="debug-section">
        <h4>Last Request</h4>
        <pre data-testid="debug-request" className="debug-code">
          {debugInfo.lastRequest
            ? JSON.stringify(debugInfo.lastRequest, null, 2)
            : 'No request yet'}
        </pre>
      </div>

      <div className="debug-section">
        <h4>Last Response</h4>
        <pre data-testid="debug-response" className="debug-code">
          {debugInfo.lastResponse
            ? JSON.stringify(debugInfo.lastResponse, null, 2)
            : 'No response yet'}
        </pre>
      </div>

      {debugInfo.lastHeaders && (
        <div className="debug-section">
          <h4>Response Headers</h4>
          <pre className="debug-code">
            {JSON.stringify(debugInfo.lastHeaders, null, 2)}
          </pre>
        </div>
      )}
    </div>
  );
}
