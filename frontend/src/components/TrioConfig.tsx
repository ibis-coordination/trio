import type { TrioModel, TrioMember } from '../types';
import { TrioMemberList } from './TrioMemberList';
import { ValidationError } from './ValidationError';

interface TrioConfigProps {
  readonly config: TrioModel;
  readonly onConfigChange: (config: TrioModel) => void;
  readonly validationError: string | null;
}

export function TrioConfig({
  config,
  onConfigChange,
  validationError,
}: TrioConfigProps) {
  const handleMembersChange = (members: readonly [TrioMember, TrioMember, TrioMember]) => {
    onConfigChange({ trio: members });
  };

  return (
    <div className="trio-config" data-testid="trio-config">
      <TrioMemberList
        members={config.trio}
        onMembersChange={handleMembersChange}
      />

      {validationError && <ValidationError message={validationError} />}
    </div>
  );
}
