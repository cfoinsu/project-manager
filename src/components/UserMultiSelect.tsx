import React, { useEffect, useRef, useState } from 'react';
import { Check, Search, UserPlus } from 'lucide-react';
import type { User } from '../types';
import { Avatar } from './Avatar';

interface UserMultiSelectProps {
  users: User[];
  selectedIds: string[];
  onChange: (ids: string[], names: string[]) => void;
  placeholder?: string;
  buttonClassName?: string;
}

export const UserMultiSelect: React.FC<UserMultiSelectProps> = ({
  users,
  selectedIds,
  onChange,
  placeholder = '인력 선택',
  buttonClassName = '',
}) => {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [tempSelectedIds, setTempSelectedIds] = useState<string[]>(selectedIds);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setTempSelectedIds(selectedIds);
  }, [selectedIds]);

  useEffect(() => {
    const handleOutside = (event: MouseEvent) => {
      if (ref.current && !ref.current.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handleOutside);
    return () => document.removeEventListener('mousedown', handleOutside);
  }, []);

  const filtered = users.filter((user) => {
    const keyword = search.trim().toLowerCase();
    if (!keyword) return true;
    return [user.name, user.username, user.department, user.position]
      .filter(Boolean)
      .some((value) => String(value).toLowerCase().includes(keyword));
  });

  const confirm = () => {
    const names = users.filter((user) => tempSelectedIds.includes(user.id)).map((user) => user.name);
    onChange(tempSelectedIds, names);
    setOpen(false);
  };

  const selectedUsers = users.filter((user) => selectedIds.includes(user.id));

  return (
    <div ref={ref} className="relative w-full">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        className={buttonClassName || 'w-full min-h-[44px] px-3 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-850 text-sm font-bold outline-none flex items-center justify-between gap-2 text-left cursor-pointer'}
      >
        <span className="flex items-center gap-2 min-w-0">
          <UserPlus className="w-4 h-4 text-slate-400 shrink-0" />
          {selectedUsers.length === 0 ? (
            <span className="text-slate-400">{placeholder}</span>
          ) : (
            <span className="truncate">{selectedUsers.map((user) => user.name).join(', ')}</span>
          )}
        </span>
        <span className="text-[11px] font-black text-slate-400 shrink-0">{selectedUsers.length}명</span>
      </button>

      {open && (
        <div className="absolute top-full left-0 right-0 mt-1 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-2xl shadow-2xl z-[9999] overflow-hidden animate-scale-in">
          <div className="p-2 border-b border-slate-100 dark:border-slate-800">
            <div className="flex items-center gap-2 px-2 py-1.5 bg-slate-50 dark:bg-slate-800 rounded-xl">
              <Search className="w-3.5 h-3.5 text-slate-400" />
              <input
                autoFocus
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="이름, 부서 검색"
                className="flex-1 text-xs bg-transparent outline-none text-slate-700 dark:text-slate-200 placeholder-slate-400"
              />
            </div>
          </div>
          <div className="max-h-56 overflow-y-auto py-1">
            {filtered.length === 0 ? (
              <p className="text-center text-xs text-slate-400 py-4">검색 결과 없음</p>
            ) : filtered.map((user) => {
              const selected = tempSelectedIds.includes(user.id);
              return (
                <button
                  key={user.id}
                  type="button"
                  onClick={() => {
                    setTempSelectedIds((prev) => selected ? prev.filter((id) => id !== user.id) : [...prev, user.id]);
                  }}
                  className={`w-full flex items-center gap-2.5 px-3 py-2 text-left transition-colors cursor-pointer ${selected ? 'bg-blue-50 dark:bg-blue-900/20' : 'hover:bg-slate-50 dark:hover:bg-slate-800'}`}
                >
                  <Avatar name={user.name} profileImage={user.profile_image} className="w-7 h-7 text-[10px] shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-bold text-slate-800 dark:text-slate-100">{user.name}</p>
                    <p className="text-[10px] text-slate-400">{[user.department, user.position].filter(Boolean).join(' · ')}</p>
                  </div>
                  {selected && <Check className="w-3.5 h-3.5 text-toss-blue shrink-0" />}
                </button>
              );
            })}
          </div>
          <div className="p-2 bg-slate-50 dark:bg-slate-900 border-t border-slate-100 dark:border-slate-800">
            <button type="button" onClick={confirm} className="w-full py-2 bg-toss-blue hover:bg-toss-blue-dark text-white text-xs font-bold rounded-xl transition-all cursor-pointer text-center">
              확인
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
