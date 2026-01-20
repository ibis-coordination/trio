import type { AggregationMethod } from '../types';

interface AggregationMethodSelectProps {
  readonly value: AggregationMethod;
  readonly onChange: (method: AggregationMethod) => void;
  readonly judgeModel?: string;
  readonly onJudgeModelChange?: (model: string) => void;
  readonly synthesizeModel?: string;
  readonly onSynthesizeModelChange?: (model: string) => void;
}

const AGGREGATION_METHODS: readonly { readonly value: AggregationMethod; readonly label: string; readonly description: string }[] = [
  { value: 'acceptance_voting', label: 'Acceptance Voting', description: 'Models vote on responses' },
  { value: 'random', label: 'Random', description: 'Random selection' },
  { value: 'judge', label: 'Judge', description: 'Separate model picks best' },
  { value: 'synthesize', label: 'Synthesize', description: 'Combine all responses' },
  { value: 'concat', label: 'Concat', description: 'Concatenate all responses' },
];

export function AggregationMethodSelect({
  value,
  onChange,
  judgeModel,
  onJudgeModelChange,
  synthesizeModel,
  onSynthesizeModelChange,
}: AggregationMethodSelectProps) {
  return (
    <div className="aggregation-method-section">
      <div className="form-group">
        <label htmlFor="aggregation-method">Aggregation Method</label>
        <select
          id="aggregation-method"
          className="aggregation-select"
          value={value}
          onChange={(e) => { onChange(e.target.value as AggregationMethod); }}
          data-testid="aggregation-method-select"
        >
          {AGGREGATION_METHODS.map((method) => (
            <option key={method.value} value={method.value}>
              {method.label}
            </option>
          ))}
        </select>
        <span className="aggregation-description">
          {AGGREGATION_METHODS.find((m) => m.value === value)?.description}
        </span>
      </div>

      {value === 'judge' && onJudgeModelChange && (
        <div className="form-group conditional-model">
          <label htmlFor="judge-model">Judge Model</label>
          <input
            id="judge-model"
            type="text"
            className="model-input"
            value={judgeModel || ''}
            onChange={(e) => { onJudgeModelChange(e.target.value); }}
            placeholder="e.g., gpt-4"
            data-testid="judge-model-input"
          />
        </div>
      )}

      {value === 'synthesize' && onSynthesizeModelChange && (
        <div className="form-group conditional-model">
          <label htmlFor="synthesize-model">Synthesize Model</label>
          <input
            id="synthesize-model"
            type="text"
            className="model-input"
            value={synthesizeModel || ''}
            onChange={(e) => { onSynthesizeModelChange(e.target.value); }}
            placeholder="e.g., gpt-4"
            data-testid="synthesize-model-input"
          />
        </div>
      )}
    </div>
  );
}
