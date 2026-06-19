import React, { useMemo, useState } from 'react';
import { AlertTriangle, CheckCircle2, RotateCcw, Trash2, X } from 'lucide-react';
import { useProjectStore } from '../store/projectStore';
import { ModalOverlay } from './ModalOverlay';
import { readProjectRisks, writeProjectRisks, type ProjectRiskItem, type ProjectRiskLevel, type ProjectRiskStatus } from '../utils/projectRiskStore';
import { requestDeleteConfirmation } from '../utils/deleteConfirm';

const levelOptions: { value: ProjectRiskLevel; label: string; className: string }[] = [
  { value: 'HIGH', label: '높음', className: 'bg-rose-50 text-rose-600 border-rose-100' },
  { value: 'MEDIUM', label: '중간', className: 'bg-amber-50 text-amber-600 border-amber-100' },
  { value: 'LOW', label: '낮음', className: 'bg-emerald-50 text-emerald-600 border-emerald-100' }
];

export const ProjectIssuesView: React.FC = () => {
  const { activeProject } = useProjectStore();
  const [risks, setRisks] = useState<ProjectRiskItem[]>(readProjectRisks);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [level, setLevel] = useState<ProjectRiskLevel>('MEDIUM');
  const [statusFilter, setStatusFilter] = useState<'all' | ProjectRiskStatus>('open');
  const [resolvingRiskId, setResolvingRiskId] = useState<string | null>(null);
  const [resolutionNote, setResolutionNote] = useState('');

  const projectRisks = useMemo(() => {
    if (!activeProject) return [];
    return risks
      .filter((risk) => risk.project_id === activeProject.id)
      .filter((risk) => statusFilter === 'all' || (risk.status || 'open') === statusFilter)
      .sort((a, b) => {
        const statusOrder = Number((a.status || 'open') === 'resolved') - Number((b.status || 'open') === 'resolved');
        if (statusOrder !== 0) return statusOrder;
        return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
      });
  }, [activeProject, risks, statusFilter]);

  const counts = useMemo(() => {
    const scoped = activeProject ? risks.filter((risk) => risk.project_id === activeProject.id) : [];
    return {
      all: scoped.length,
      open: scoped.filter((risk) => (risk.status || 'open') === 'open').length,
      resolved: scoped.filter((risk) => risk.status === 'resolved').length,
      high: scoped.filter((risk) => (risk.status || 'open') === 'open' && risk.level === 'HIGH').length
    };
  }, [activeProject, risks]);

  const persist = (next: ProjectRiskItem[]) => {
    setRisks(next);
    writeProjectRisks(next);
  };

  const handleAddRisk = () => {
    if (!activeProject || !title.trim()) return;
    const nextRisk: ProjectRiskItem = {
      id: `risk-${Date.now()}`,
      project_id: activeProject.id,
      title: title.trim(),
      description: description.trim(),
      level,
      status: 'open',
      created_at: new Date().toISOString()
    };
    persist([nextRisk, ...risks]);
    setTitle('');
    setDescription('');
    setLevel('MEDIUM');
  };

  const handleStartResolve = (risk: ProjectRiskItem) => {
    setResolvingRiskId(risk.id);
    setResolutionNote(risk.resolution_note || '');
  };

  const handleCancelResolve = () => {
    setResolvingRiskId(null);
    setResolutionNote('');
  };

  const handleConfirmResolve = (id: string) => {
    if (!resolutionNote.trim()) return;
    persist(risks.map((risk) => (
      risk.id === id
        ? {
          ...risk,
          status: 'resolved',
          resolved_at: new Date().toISOString(),
          resolution_note: resolutionNote.trim()
        }
        : risk
    )));
    handleCancelResolve();
  };

  const handleReopen = (id: string) => {
    persist(risks.map((risk) => (
      risk.id === id
        ? { ...risk, status: 'open', resolved_at: undefined }
        : risk
    )));
  };

  const handleDelete = (id: string) => {
    const target = risks.find((risk) => risk.id === id);
    if (!requestDeleteConfirmation({
      title: '이슈 및 리스크 삭제',
      targetName: target?.title,
      description: '삭제한 이슈 및 리스크 기록은 복구할 수 없습니다.',
    })) return;
    persist(risks.filter((risk) => risk.id !== id));
  };

  const resolvingRisk = resolvingRiskId ? risks.find((risk) => risk.id === resolvingRiskId) : null;

  if (!activeProject) {
    return (
      <div className="flex h-full items-center justify-center text-sm font-bold text-slate-400">
        선택된 프로젝트가 없습니다.
      </div>
    );
  }

  return (
    <div className="h-full overflow-y-auto pr-2 pb-10 text-left">
      <div className="mb-5 flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-xs font-black text-rose-500">ISSUES & RISKS</p>
          <h1 className="mt-1 text-2xl font-black text-slate-950 dark:text-slate-100">이슈 및 리스크 관리</h1>
          <p className="mt-1 text-sm font-bold text-slate-500 dark:text-slate-400">
            프로젝트 진행을 막는 이슈와 일정, 품질, 인력 리스크를 별도로 작성하고 처리 상태를 관리합니다.
          </p>
        </div>
        <div className="grid grid-cols-4 gap-2">
          <Metric label="전체" value={counts.all} />
          <Metric label="열림" value={counts.open} tone="blue" />
          <Metric label="높음" value={counts.high} tone="rose" />
          <Metric label="해결" value={counts.resolved} tone="emerald" />
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-[360px_minmax(0,1fr)] gap-4">
        <section className="rounded-2xl border border-slate-200/70 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 shadow-sm">
          <h2 className="text-sm font-black text-slate-950 dark:text-slate-100">새 이슈 작성</h2>
          <div className="mt-4 space-y-3">
            <label className="block">
              <span className="text-xs font-bold text-slate-400">제목</span>
              <input
                value={title}
                onChange={(event) => setTitle(event.target.value)}
                placeholder="예: 메인 페이지 반응형 이슈"
                className="mt-1 w-full rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 px-3 py-3 text-sm font-bold text-slate-900 dark:text-slate-100 outline-none focus:ring-2 focus:ring-toss-blue/15"
              />
            </label>
            <label className="block">
              <span className="text-xs font-bold text-slate-400">위험도</span>
              <div className="mt-1 grid grid-cols-3 gap-2">
                {levelOptions.map((option) => (
                  <button
                    key={option.value}
                    onClick={() => setLevel(option.value)}
                    className={`rounded-xl border px-3 py-2 text-xs font-black transition-all ${
                      level === option.value
                        ? option.className
                        : 'border-slate-200 dark:border-slate-800 text-slate-500 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-950'
                    }`}
                  >
                    {option.label}
                  </button>
                ))}
              </div>
            </label>
            <label className="block">
              <span className="text-xs font-bold text-slate-400">상세 내용</span>
              <textarea
                value={description}
                onChange={(event) => setDescription(event.target.value)}
                placeholder="발생 배경, 영향 범위, 필요한 조치를 적어주세요."
                rows={6}
                className="mt-1 w-full resize-none rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 px-3 py-3 text-sm font-semibold text-slate-800 dark:text-slate-100 outline-none focus:ring-2 focus:ring-toss-blue/15"
              />
            </label>
            <button
              onClick={handleAddRisk}
              disabled={!title.trim()}
              className="w-full rounded-xl bg-rose-500 px-4 py-3 text-sm font-black text-white disabled:cursor-not-allowed disabled:opacity-40"
            >
              이슈 등록
            </button>
          </div>
        </section>

        <section className="rounded-2xl border border-slate-200/70 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 shadow-sm">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <h2 className="text-sm font-black text-slate-950 dark:text-slate-100">관리 목록</h2>
            <div className="flex rounded-xl bg-slate-100 dark:bg-slate-950 p-1">
              {[
                { key: 'open', label: '열림' },
                { key: 'resolved', label: '해결' },
                { key: 'all', label: '전체' }
              ].map((item) => (
                <button
                  key={item.key}
                  onClick={() => setStatusFilter(item.key as typeof statusFilter)}
                  className={`rounded-lg px-3 py-2 text-xs font-black transition-colors ${
                    statusFilter === item.key
                      ? 'bg-white dark:bg-slate-800 text-toss-blue shadow-sm'
                      : 'text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-100'
                  }`}
                >
                  {item.label}
                </button>
              ))}
            </div>
          </div>

          {projectRisks.length === 0 ? (
            <div className="flex min-h-[360px] flex-col items-center justify-center rounded-xl border border-dashed border-slate-200 dark:border-slate-800 text-center">
              <AlertTriangle className="h-8 w-8 text-slate-300" />
              <p className="mt-3 text-sm font-black text-slate-500">표시할 이슈가 없습니다.</p>
              <p className="mt-1 text-xs font-bold text-slate-400">좌측에서 새 이슈를 등록하면 이곳에서 관리할 수 있습니다.</p>
            </div>
          ) : (
            <div className="max-h-[620px] overflow-y-auto divide-y divide-slate-100 dark:divide-slate-800 pr-1">
              {projectRisks.map((risk) => {
                const option = levelOptions.find((item) => item.value === risk.level) || levelOptions[1];
                const isResolved = risk.status === 'resolved';
                return (
                  <article key={risk.id} className="py-4">
                    <div className="flex items-start justify-between gap-4">
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className={`rounded-full border px-2.5 py-1 text-[11px] font-black ${option.className}`}>
                            {option.label}
                          </span>
                          <span className={`rounded-full px-2.5 py-1 text-[11px] font-black ${
                            isResolved ? 'bg-emerald-50 text-emerald-600' : 'bg-blue-50 text-toss-blue'
                          }`}>
                            {isResolved ? '해결' : '열림'}
                          </span>
                          <span className="text-[11px] font-bold text-slate-400">{risk.created_at.slice(0, 10)}</span>
                        </div>
                        <h3 className={`mt-2 text-sm font-black ${isResolved ? 'text-slate-400 line-through' : 'text-slate-950 dark:text-slate-100'}`}>
                          {risk.title}
                        </h3>
                        {risk.description && (
                          <p className="mt-2 whitespace-pre-wrap text-xs font-semibold leading-relaxed text-slate-500 dark:text-slate-400">
                            {risk.description}
                          </p>
                        )}
                        {isResolved && risk.resolution_note && (
                          <div className="mt-3 rounded-xl border border-emerald-100 bg-emerald-50/70 p-3 dark:border-emerald-950/40 dark:bg-emerald-950/20">
                            <p className="text-[11px] font-black text-emerald-600 dark:text-emerald-300">해결 내용</p>
                            <p className="mt-1 whitespace-pre-wrap text-xs font-semibold leading-relaxed text-slate-600 dark:text-slate-300">
                              {risk.resolution_note}
                            </p>
                            {risk.resolved_at && (
                              <p className="mt-2 text-[10px] font-bold text-slate-400">해결일 {risk.resolved_at.slice(0, 10)}</p>
                            )}
                          </div>
                        )}
                      </div>
                      <div className="flex shrink-0 items-center gap-1">
                        {isResolved ? (
                          <IconButton label="다시 열기" onClick={() => handleReopen(risk.id)}>
                            <RotateCcw className="h-4 w-4" />
                          </IconButton>
                        ) : (
                          <IconButton label="해결" onClick={() => handleStartResolve(risk)}>
                            <CheckCircle2 className="h-4 w-4" />
                          </IconButton>
                        )}
                        <IconButton label="삭제" danger onClick={() => handleDelete(risk.id)}>
                          <Trash2 className="h-4 w-4" />
                        </IconButton>
                      </div>
                    </div>
                  </article>
                );
              })}
            </div>
          )}
        </section>
      </div>
      {resolvingRisk && (
        <ModalOverlay onClose={handleCancelResolve} zIndex={120}>
          <section
            className="w-full max-w-lg rounded-2xl border border-slate-200 bg-white p-5 shadow-toss-lg dark:border-slate-800 dark:bg-slate-900"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="mb-4 flex items-start justify-between gap-4">
              <div className="min-w-0">
                <p className="text-xs font-black text-emerald-500">RESOLVE ISSUE</p>
                <h2 className="mt-1 truncate text-lg font-black text-slate-950 dark:text-slate-100">해결 내용 작성</h2>
                <p className="mt-2 text-sm font-bold text-slate-500 dark:text-slate-400">{resolvingRisk.title}</p>
              </div>
              <button
                type="button"
                title="닫기"
                aria-label="닫기"
                onClick={handleCancelResolve}
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-slate-800 dark:hover:text-slate-200"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <textarea
              value={resolutionNote}
              onChange={(event) => setResolutionNote(event.target.value)}
              placeholder="해결 방법, 반영 범위, 확인 결과를 남겨주세요."
              rows={7}
              autoFocus
              className="w-full resize-none rounded-xl border border-slate-200 bg-slate-50 px-3 py-3 text-sm font-semibold leading-relaxed text-slate-800 outline-none focus:ring-2 focus:ring-toss-blue/15 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-100"
            />
            <div className="mt-4 flex justify-end gap-2">
              <button
                type="button"
                onClick={handleCancelResolve}
                className="rounded-xl border border-slate-200 px-4 py-2.5 text-xs font-black text-slate-500 hover:bg-slate-50 dark:border-slate-800 dark:text-slate-300 dark:hover:bg-slate-950"
              >
                취소
              </button>
              <button
                type="button"
                onClick={() => handleConfirmResolve(resolvingRisk.id)}
                disabled={!resolutionNote.trim()}
                className="rounded-xl bg-emerald-500 px-4 py-2.5 text-xs font-black text-white disabled:cursor-not-allowed disabled:opacity-40"
              >
                해결 완료로 저장
              </button>
            </div>
          </section>
        </ModalOverlay>
      )}
    </div>
  );
};

const Metric = ({ label, value, tone = 'slate' }: { label: string; value: number; tone?: 'slate' | 'blue' | 'rose' | 'emerald' }) => {
  const toneClass = {
    slate: 'text-slate-950 dark:text-slate-100',
    blue: 'text-toss-blue',
    rose: 'text-rose-500',
    emerald: 'text-emerald-500'
  }[tone];

  return (
    <div className="min-w-20 rounded-xl border border-slate-200/70 dark:border-slate-800 bg-white dark:bg-slate-900 px-4 py-3 text-center shadow-sm">
      <p className="text-[11px] font-black text-slate-400">{label}</p>
      <p className={`mt-1 text-xl font-black ${toneClass}`}>{value}</p>
    </div>
  );
};

const IconButton = ({ label, danger = false, onClick, children }: { label: string; danger?: boolean; onClick: () => void; children: React.ReactNode }) => (
  <button
    type="button"
    title={label}
    aria-label={label}
    onClick={onClick}
    className={`flex h-9 w-9 items-center justify-center rounded-lg border text-xs font-black transition-colors ${
      danger
        ? 'border-rose-100 text-rose-500 hover:bg-rose-50 dark:border-rose-950/40 dark:hover:bg-rose-950/20'
        : 'border-slate-200 text-slate-500 hover:bg-slate-50 dark:border-slate-800 dark:text-slate-300 dark:hover:bg-slate-950'
    }`}
  >
    {children}
  </button>
);
