import { useState } from 'react';
import type { VotingDetails } from '../types';

interface VotingDetailsPanelProps {
  readonly details: VotingDetails;
}

export function VotingDetailsPanel({ details }: VotingDetailsPanelProps) {
  const [isExpanded, setIsExpanded] = useState(false);

  const formatAggregationMethod = (method: string): string => {
    return method
      .split('_')
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');
  };

  const truncateText = (text: string, maxLength: number = 200): string => {
    if (text.length <= maxLength) return text;
    return text.slice(0, maxLength) + '...';
  };

  return (
    <div className="voting-details-panel" data-testid="voting-details-panel">
      <button
        type="button"
        className="voting-details-toggle"
        onClick={() => { setIsExpanded(!isExpanded); }}
      >
        <span className="toggle-icon">{isExpanded ? '▼' : '▶'}</span>
        <span>Voting Details</span>
        <span className="aggregation-badge">{formatAggregationMethod(details.aggregation_method)}</span>
      </button>

      {isExpanded && (
        <div className="voting-details-content">
          <div className="candidates-list">
            {details.candidates.map((candidate, index) => (
              <div
                key={index}
                className={`candidate-card ${index === details.winner_index ? 'winner' : ''}`}
              >
                <div className="candidate-header">
                  <span className="candidate-model">{candidate.model}</span>
                  {index === details.winner_index && (
                    <span className="winner-badge">Winner</span>
                  )}
                  {candidate.votes && (
                    <span className="vote-counts">
                      Accepted: {candidate.votes.accepted} | Preferred: {candidate.votes.preferred}
                    </span>
                  )}
                </div>
                <div className="candidate-response">
                  {truncateText(candidate.response)}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
