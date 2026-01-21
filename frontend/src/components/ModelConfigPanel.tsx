import type { ConfigMode, TrioModel } from '../types';
import { ValidationError } from './ValidationError';
import { ModeToggle } from './ModeToggle';
import { TrioConfig } from './TrioConfig';

interface ModelConfigPanelProps {
  readonly mode: ConfigMode;
  readonly onModeChange: (mode: ConfigMode) => void;
  readonly model: string;
  readonly onModelChange: (model: string) => void;
  readonly trioConfig: TrioModel;
  readonly onTrioConfigChange: (config: TrioModel) => void;
  readonly validationError: string | null;
}

export function ModelConfigPanel({
  mode,
  onModeChange,
  model,
  onModelChange,
  trioConfig,
  onTrioConfigChange,
  validationError,
}: ModelConfigPanelProps) {
  return (
    <div data-testid="model-config-panel" className="model-config-panel">
      <h2>Model Configuration</h2>

      <ModeToggle mode={mode} onModeChange={onModeChange} />

      {mode === 'simple' ? (
        <div className="form-group">
          <label htmlFor="model-input">Model</label>
          <input
            id="model-input"
            data-testid="model-input"
            type="text"
            className="model-input"
            value={model}
            onChange={(e) => { onModelChange(e.target.value); }}
            placeholder="e.g., llama3.2:1b"
          />
          {validationError && <ValidationError message={validationError} />}
        </div>
      ) : (
        <TrioConfig
          config={trioConfig}
          onConfigChange={onTrioConfigChange}
          validationError={validationError}
        />
      )}
    </div>
  );
}
