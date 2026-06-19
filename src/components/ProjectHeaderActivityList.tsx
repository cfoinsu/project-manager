import { EmptyState } from './ui/EmptyState';
import { ToneBadge } from './ui/ToneBadge';

export interface ProjectHeaderActivityItem {
  id: string;
  tone: 'task' | 'meeting' | 'assignment' | 'risk' | string;
  label: string;
  target: string;
  action: string;
  actor: string;
  when: string;
}

interface ProjectHeaderActivityListProps {
  items: ProjectHeaderActivityItem[];
}

export const ProjectHeaderActivityList = ({ items }: ProjectHeaderActivityListProps) => {
  if (items.length === 0) {
    return <EmptyState text="표시할 알림이 없습니다." />;
  }

  return (
    <>
      {items.map((item) => (
        <div key={item.id} className="flex gap-3 rounded-xl px-2 py-2.5 hover:bg-toss-gray-50 dark:hover:bg-slate-900">
          <ToneBadge tone={item.tone} className="mt-0.5 h-7 min-w-7 shrink-0 px-2 text-[10px]">
            {item.label}
          </ToneBadge>
          <div className="min-w-0 flex-1">
            <p className="truncate text-xs font-black text-slate-900 dark:text-slate-100">{item.target}</p>
            <p className="mt-1 truncate text-[11px] font-bold text-slate-500 dark:text-slate-400">
              {item.actor} / {item.action}
            </p>
            <p className="mt-1 text-[10px] font-bold text-slate-400">{item.when}</p>
          </div>
        </div>
      ))}
    </>
  );
};
