import { useState } from 'react';
import type { EnsembleMember } from '../types';

interface EnsembleMemberRowProps {
  readonly index: number;
  readonly member: EnsembleMember;
  readonly onUpdate: (member: EnsembleMember) => void;
  readonly onRemove: () => void;
  readonly canRemove: boolean;
}

export function EnsembleMemberRow({
  index,
  member,
  onUpdate,
  onRemove,
  canRemove,
}: EnsembleMemberRowProps) {
  const [showSystemPrompt, setShowSystemPrompt] = useState(!!member.system_prompt);

  return (
    <div className="ensemble-member-row" data-testid={`ensemble-member-${String(index)}`}>
      <div className="member-header">
        <span className="member-number">#{index + 1}</span>
        {canRemove && (
          <button
            type="button"
            className="remove-member-button"
            onClick={onRemove}
            title="Remove member"
          >
            x
          </button>
        )}
      </div>

      <div className="member-fields">
        <div className="form-group">
          <label htmlFor={`member-model-${String(index)}`}>Model</label>
          <input
            id={`member-model-${String(index)}`}
            type="text"
            className="model-input"
            value={member.model}
            onChange={(e) => { onUpdate({ ...member, model: e.target.value }); }}
            placeholder="e.g., llama3.2:1b"
          />
        </div>

        <div className="system-prompt-toggle">
          <label>
            <input
              type="checkbox"
              checked={showSystemPrompt}
              onChange={(e) => {
                setShowSystemPrompt(e.target.checked);
                if (!e.target.checked) {
                  onUpdate({ ...member, system_prompt: undefined });
                }
              }}
            />
            <span>System prompt</span>
          </label>
        </div>

        {showSystemPrompt && (
          <div className="form-group">
            <textarea
              className="system-prompt-input"
              value={member.system_prompt || ''}
              onChange={(e) =>
                { onUpdate({ ...member, system_prompt: e.target.value || undefined }); }
              }
              placeholder="Optional system prompt for this model..."
              rows={2}
            />
          </div>
        )}
      </div>
    </div>
  );
}
