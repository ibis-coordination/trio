import type { ConfigMode, EnsembleModel } from '../types';
import { ValidationError } from './ValidationError';
import { ModeToggle } from './ModeToggle';
import { EnsembleConfig } from './EnsembleConfig';

interface ModelConfigPanelProps {
  readonly mode: ConfigMode;
  readonly onModeChange: (mode: ConfigMode) => void;
  readonly model: string;
  readonly onModelChange: (model: string) => void;
  readonly ensembleConfig: EnsembleModel;
  readonly onEnsembleConfigChange: (config: EnsembleModel) => void;
  readonly validationError: string | null;
}

export function ModelConfigPanel({
  mode,
  onModeChange,
  model,
  onModelChange,
  ensembleConfig,
  onEnsembleConfigChange,
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
        <EnsembleConfig
          config={ensembleConfig}
          onConfigChange={onEnsembleConfigChange}
          validationError={validationError}
        />
      )}
    </div>
  );
}
