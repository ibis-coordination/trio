import { ValidationError } from './ValidationError';

interface ModelConfigPanelProps {
  model: string;
  onModelChange: (model: string) => void;
  validationError: string | null;
}

export function ModelConfigPanel({
  model,
  onModelChange,
  validationError,
}: ModelConfigPanelProps) {
  return (
    <div data-testid="model-config-panel" className="model-config-panel">
      <h2>Model Configuration</h2>
      <div className="form-group">
        <label htmlFor="model-input">Model</label>
        <input
          id="model-input"
          data-testid="model-input"
          type="text"
          className="model-input"
          value={model}
          onChange={(e) => onModelChange(e.target.value)}
          placeholder="e.g., llama3.2:1b"
        />
        {validationError && <ValidationError message={validationError} />}
      </div>
    </div>
  );
}
