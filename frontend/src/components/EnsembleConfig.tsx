import type { EnsembleModel, EnsembleMember, AggregationMethod } from '../types';
import { EnsembleMemberList } from './EnsembleMemberList';
import { AggregationMethodSelect } from './AggregationMethodSelect';
import { ValidationError } from './ValidationError';

interface EnsembleConfigProps {
  readonly config: EnsembleModel;
  readonly onConfigChange: (config: EnsembleModel) => void;
  readonly validationError: string | null;
}

export function EnsembleConfig({
  config,
  onConfigChange,
  validationError,
}: EnsembleConfigProps) {
  const handleMembersChange = (members: readonly EnsembleMember[]) => {
    onConfigChange({ ...config, ensemble: members });
  };

  const handleAggregationChange = (method: AggregationMethod) => {
    onConfigChange({ ...config, aggregation_method: method });
  };

  const handleJudgeModelChange = (model: string) => {
    onConfigChange({ ...config, judge_model: model || undefined });
  };

  const handleSynthesizeModelChange = (model: string) => {
    onConfigChange({ ...config, synthesize_model: model || undefined });
  };

  return (
    <div className="ensemble-config" data-testid="ensemble-config">
      <EnsembleMemberList
        members={config.ensemble}
        onMembersChange={handleMembersChange}
      />

      <AggregationMethodSelect
        value={config.aggregation_method}
        onChange={handleAggregationChange}
        judgeModel={config.judge_model}
        onJudgeModelChange={handleJudgeModelChange}
        synthesizeModel={config.synthesize_model}
        onSynthesizeModelChange={handleSynthesizeModelChange}
      />

      {validationError && <ValidationError message={validationError} />}
    </div>
  );
}
