import type { ConfigMode } from '../types';

interface ModeToggleProps {
  readonly mode: ConfigMode;
  readonly onModeChange: (mode: ConfigMode) => void;
}

export function ModeToggle({ mode, onModeChange }: ModeToggleProps) {
  return (
    <div className="mode-toggle" data-testid="mode-toggle">
      <label className="mode-option">
        <input
          type="radio"
          name="mode"
          value="simple"
          checked={mode === 'simple'}
          onChange={() => { onModeChange('simple'); }}
        />
        <span>Simple</span>
      </label>
      <label className="mode-option">
        <input
          type="radio"
          name="mode"
          value="ensemble"
          checked={mode === 'ensemble'}
          onChange={() => { onModeChange('ensemble'); }}
        />
        <span>Ensemble</span>
      </label>
    </div>
  );
}
