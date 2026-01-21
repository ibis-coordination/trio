import { useState } from 'react';
import type { TrioDetails } from '../types';

interface TrioDetailsPanelProps {
  readonly details: TrioDetails;
}

export function TrioDetailsPanel({ details }: TrioDetailsPanelProps) {
  const [isExpanded, setIsExpanded] = useState(false);

  const truncateText = (text: string, maxLength: number = 200): string => {
    if (text.length <= maxLength) return text;
    return text.slice(0, maxLength) + '...';
  };

  return (
    <div className="trio-details-panel" data-testid="trio-details-panel">
      <button
        type="button"
        className="trio-details-toggle"
        onClick={() => { setIsExpanded(!isExpanded); }}
      >
        <span className="toggle-icon">{isExpanded ? '▼' : '▶'}</span>
        <span>Trio Details</span>
        <span className="synthesis-badge">Synthesized</span>
      </button>

      {isExpanded && (
        <div className="trio-details-content">
          <div className="perspectives-list">
            {/* Model A's response */}
            <div className="perspective-card perspective-a">
              <div className="perspective-header">
                <span className="perspective-label">Model A</span>
                <span className="perspective-model">{details.model_a}</span>
              </div>
              <div className="perspective-response">
                {details.response_a ? truncateText(details.response_a) : <em>No response</em>}
              </div>
            </div>

            {/* Model B's response */}
            <div className="perspective-card perspective-b">
              <div className="perspective-header">
                <span className="perspective-label">Model B</span>
                <span className="perspective-model">{details.model_b}</span>
              </div>
              <div className="perspective-response">
                {details.response_b ? truncateText(details.response_b) : <em>No response</em>}
              </div>
            </div>

            {/* Model C (synthesizer) */}
            <div className="perspective-card perspective-c synthesizer">
              <div className="perspective-header">
                <span className="perspective-label">Model C</span>
                <span className="perspective-model">{details.model_c}</span>
                <span className="synthesizer-badge">Synthesizer</span>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
