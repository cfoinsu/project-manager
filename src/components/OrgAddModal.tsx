import React, { useState, useEffect, useRef } from 'react';
import { Building2, Users, X, Plus } from 'lucide-react';

interface OrgAddModalProps {
  /** 추가할 항목 유형 */
  type: 'department' | 'team';
  /** 팀 추가 시 상위 부서명 */
  parentName?: string;
  /** 확인 콜백 */
  onConfirm: (name: string) => void;
  /** 닫기 콜백 */
  onClose: () => void;
}

export const OrgAddModal: React.FC<OrgAddModalProps> = ({
  type,
  parentName,
  onConfirm,
  onClose,
}) => {
  const [name, setName] = useState('');
  const [error, setError] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    // 모달 열릴 때 입력 필드에 포커스
    const timer = setTimeout(() => inputRef.current?.focus(), 80);
    return () => clearTimeout(timer);
  }, []);

  // ESC 키로 닫기
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = name.trim();
    if (!trimmed) {
      setError('이름을 입력해 주세요.');
      return;
    }
    onConfirm(trimmed);
  };

  const isDept = type === 'department';
  const Icon  = isDept ? Building2 : Users;
  const title = isDept ? '부서 추가' : '팀 추가';
  const placeholder = isDept ? '예) 개발본부, 기획팀' : '예) 프론트엔드팀, QA팀';
  const iconBg = isDept ? 'bg-blue-500' : 'bg-emerald-500';

  return (
    /* 배경 오버레이 */
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ backgroundColor: 'rgba(15,23,42,0.45)', backdropFilter: 'blur(4px)' }}
      onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      {/* 모달 카드 */}
      <div
        className="relative w-full max-w-md bg-white rounded-3xl shadow-2xl overflow-hidden"
        style={{ animation: 'scaleUp 0.18s cubic-bezier(0.34,1.56,0.64,1)' }}
      >
        {/* 헤더 */}
        <div className="flex items-center gap-3 px-6 pt-6 pb-5 border-b border-slate-100">
          <div className={`w-10 h-10 rounded-2xl ${iconBg} flex items-center justify-center shrink-0 shadow-sm`}>
            <Icon className="w-5 h-5 text-white" />
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="text-base font-black text-slate-800">{title}</h3>
            {!isDept && parentName && (
              <p className="text-xs font-bold text-slate-400 mt-0.5 truncate">
                상위 부서: <span className="text-slate-600">{parentName}</span>
              </p>
            )}
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 flex items-center justify-center rounded-xl hover:bg-slate-100 text-slate-400 hover:text-slate-600 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* 본문 */}
        <form onSubmit={handleSubmit} className="px-6 py-5 space-y-4">
          <div className="space-y-1.5">
            <label className="block text-xs font-black text-slate-500 uppercase tracking-wide">
              {isDept ? '부서명' : '팀명'} <span className="text-red-500">*</span>
            </label>
            <input
              ref={inputRef}
              value={name}
              onChange={(e) => { setName(e.target.value); setError(''); }}
              placeholder={placeholder}
              maxLength={30}
              className={`w-full px-4 py-3 rounded-2xl border text-sm font-semibold text-slate-800 placeholder-slate-300 outline-none transition-all ${
                error
                  ? 'border-red-300 ring-2 ring-red-100 bg-red-50/30'
                  : 'border-slate-200 focus:border-blue-300 focus:ring-2 focus:ring-blue-100 bg-slate-50 focus:bg-white'
              }`}
            />
            {error && (
              <p className="text-xs font-bold text-red-500 pl-1">{error}</p>
            )}
            <p className="text-[11px] font-bold text-slate-400 pl-1">{name.length}/30</p>
          </div>

          {/* 안내 텍스트 */}
          <div className="rounded-2xl bg-blue-50 px-4 py-3">
            <p className="text-xs font-bold text-blue-600">
              {isDept
                ? '부서를 추가하면 하위에 팀을 구성할 수 있습니다.'
                : `'${parentName || '선택된 부서'}' 하위에 팀이 추가됩니다.`}
            </p>
          </div>

          {/* 버튼 영역 */}
          <div className="flex gap-2.5 pt-1">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-3 rounded-2xl bg-slate-100 text-sm font-black text-slate-600 hover:bg-slate-200 transition-colors"
            >
              취소
            </button>
            <button
              type="submit"
              disabled={!name.trim()}
              className={`flex-1 py-3 rounded-2xl text-sm font-black text-white flex items-center justify-center gap-1.5 transition-all ${
                name.trim()
                  ? `${isDept ? 'bg-blue-500 hover:bg-blue-600' : 'bg-emerald-500 hover:bg-emerald-600'} shadow-sm`
                  : 'bg-slate-200 text-slate-400 cursor-not-allowed'
              }`}
            >
              <Plus className="w-4 h-4" />
              {title}
            </button>
          </div>
        </form>
      </div>

      <style>{`
        @keyframes scaleUp {
          from { opacity: 0; transform: scale(0.94) translateY(8px); }
          to   { opacity: 1; transform: scale(1)    translateY(0); }
        }
      `}</style>
    </div>
  );
};
