import { useState } from 'react';
import type { TrioMember } from '../types';

interface TrioMemberRowProps {
  readonly label: 'A' | 'B' | 'C';
  readonly member: TrioMember;
  readonly onUpdate: (member: TrioMember) => void;
}

// Get the role description for each member
const getRoleDescription = (label: 'A' | 'B' | 'C'): string => {
  switch (label) {
    case 'A':
      return 'First perspective';
    case 'B':
      return 'Second perspective';
    case 'C':
      return 'Synthesizer';
  }
};

export function TrioMemberRow({
  label,
  member,
  onUpdate,
}: TrioMemberRowProps) {
  // Extract system prompt from messages if present
  const systemPrompt = member.messages?.find((m) => m.role === 'system')?.content ?? '';
  const [showSystemPrompt, setShowSystemPrompt] = useState(!!systemPrompt);

  const handleSystemPromptChange = (value: string) => {
    if (value.trim()) {
      onUpdate({
        ...member,
        messages: [{ role: 'system', content: value }],
      });
    } else {
      onUpdate({
        ...member,
        messages: undefined,
      });
    }
  };

  return (
    <div className="trio-member-row" data-testid={`trio-member-${label}`}>
      <div className="member-header">
        <span className="member-label">Model {label}</span>
        <span className="member-role">{getRoleDescription(label)}</span>
      </div>

      <div className="member-fields">
        <div className="form-group">
          <label htmlFor={`member-model-${label}`}>Model</label>
          <input
            id={`member-model-${label}`}
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
                  onUpdate({ ...member, messages: undefined });
                }
              }}
            />
            <span>System prompt (variance vector)</span>
          </label>
        </div>

        {showSystemPrompt && (
          <div className="form-group">
            <textarea
              className="system-prompt-input"
              value={systemPrompt}
              onChange={(e) => { handleSystemPromptChange(e.target.value); }}
              placeholder={label === 'C'
                ? 'Optional instructions for synthesis...'
                : 'Optional perspective/stance for this model...'}
              rows={2}
            />
          </div>
        )}
      </div>
    </div>
  );
}
