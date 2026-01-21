import type { TrioMember } from '../types';
import { TrioMemberRow } from './TrioMemberRow';

// Labels for the three trio members
const MEMBER_LABELS = ['A', 'B', 'C'] as const;

interface TrioMemberListProps {
  readonly members: readonly [TrioMember, TrioMember, TrioMember];
  readonly onMembersChange: (members: readonly [TrioMember, TrioMember, TrioMember]) => void;
}

export function TrioMemberList({ members, onMembersChange }: TrioMemberListProps) {
  const handleUpdateMember = (index: number, member: TrioMember) => {
    const [m0, m1, m2] = members;
    const updated: readonly [TrioMember, TrioMember, TrioMember] = [
      index === 0 ? member : m0,
      index === 1 ? member : m1,
      index === 2 ? member : m2,
    ];
    onMembersChange(updated);
  };

  return (
    <div className="trio-member-list">
      <div className="member-list-header">
        <label>Trio Members</label>
        <span className="member-list-description">
          A and B generate responses in parallel, then C synthesizes them
        </span>
      </div>

      <div className="members-container">
        {members.map((member, index) => (
          <TrioMemberRow
            key={MEMBER_LABELS[index]}
            label={MEMBER_LABELS[index]}
            member={member}
            onUpdate={(m) => { handleUpdateMember(index, m); }}
          />
        ))}
      </div>
    </div>
  );
}
