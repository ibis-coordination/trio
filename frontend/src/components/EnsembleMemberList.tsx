import type { EnsembleMember } from '../types';
import { EnsembleMemberRow } from './EnsembleMemberRow';

interface EnsembleMemberListProps {
  readonly members: readonly EnsembleMember[];
  readonly onMembersChange: (members: readonly EnsembleMember[]) => void;
}

export function EnsembleMemberList({ members, onMembersChange }: EnsembleMemberListProps) {
  const handleAddMember = () => {
    onMembersChange([...members, { model: '' }]);
  };

  const handleUpdateMember = (index: number, member: EnsembleMember) => {
    const updated = members.map((m, i) => (i === index ? member : m));
    onMembersChange(updated);
  };

  const handleRemoveMember = (index: number) => {
    const updated = members.filter((_, i) => i !== index);
    onMembersChange(updated);
  };

  return (
    <div className="ensemble-member-list">
      <div className="member-list-header">
        <label>Ensemble Members</label>
      </div>

      <div className="members-container">
        {members.map((member, index) => (
          <EnsembleMemberRow
            key={index}
            index={index}
            member={member}
            onUpdate={(m) => { handleUpdateMember(index, m); }}
            onRemove={() => { handleRemoveMember(index); }}
            canRemove={members.length > 1}
          />
        ))}
      </div>

      <button
        type="button"
        className="add-member-button"
        onClick={handleAddMember}
        data-testid="add-member-button"
      >
        + Add Member
      </button>
    </div>
  );
}
