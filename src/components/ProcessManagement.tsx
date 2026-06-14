import React, { useState } from 'react';
import { useProjectStore } from '../store/projectStore';
import { 
  Plus, 
  Trash2, 
  ArrowUp, 
  ArrowDown, 
  Copy, 
  Layers,
  Pencil,
  X,
  Clock,
  CheckCircle2,
  AlertCircle,
  CalendarDays,
} from 'lucide-react';
import type { Process, Task } from '../types';
import { RangeDatePicker } from './RangeDatePicker';
import { CustomSelect } from './CustomSelect';

// ─── 남은 일수 계산 ───────────────────────────────────────────
function getRemainingDays(endDate?: string): { days: number; label: string; color: string } | null {
  if (!endDate) return null;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const end = new Date(endDate);
  end.setHours(0, 0, 0, 0);
  const diff = Math.ceil((end.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
  if (diff < 0) return { days: diff, label: `${Math.abs(diff)}일 초과`, color: 'text-rose-500 bg-rose-50 dark:bg-rose-900/20 border-rose-200 dark:border-rose-800/40' };
  if (diff === 0) return { days: 0, label: '오늘 마감', color: 'text-amber-600 bg-amber-50 dark:bg-amber-900/20 border-amber-200 dark:border-amber-800/40' };
  if (diff <= 7) return { days: diff, label: `D-${diff}`, color: 'text-amber-500 bg-amber-50 dark:bg-amber-900/20 border-amber-200 dark:border-amber-800/40' };
  return { days: diff, label: `D-${diff}`, color: 'text-slate-500 bg-slate-50 dark:bg-slate-800/60 border-slate-200 dark:border-slate-700/60' };
}

// ─── 편집 모달 ────────────────────────────────────────────────
interface EditModalProps {
  proc: Process;
  projectStartDate?: string;
  projectEndDate?: string;
  onSave: (updates: Partial<Process>) => Promise<void>;
  onClose: () => void;
}

const EditModal: React.FC<EditModalProps> = ({ proc, projectStartDate, projectEndDate, onSave, onClose }) => {
  const [name, setName] = useState(proc.name);
  const [description, setDescription] = useState(proc.description || '');
  const [status, setStatus] = useState(proc.status || '대기');
  const [difficulty, setDifficulty] = useState(proc.difficulty || '보통');
  const [progress, setProgress] = useState(Math.round(proc.progress * 100));
  const [startDate, setStartDate] = useState(proc.start_date || '');
  const [endDate, setEndDate] = useState(proc.end_date || '');
  const [saving, setSaving] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    setSaving(true);
    try {
      await onSave({
        name: name.trim(),
        description: description.trim(),
        status,
        difficulty,
        progress: progress / 100,
        start_date: startDate || undefined,
        end_date: endDate || undefined,
      });
      onClose();
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4" onClick={onClose}>
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" />
      <div
        className="relative bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-700 w-full max-w-lg animate-scale-in"
        onClick={e => e.stopPropagation()}
      >
        {/* 헤더 */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 dark:border-slate-800">
          <div>
            <span className="text-[11px] font-bold text-toss-blue uppercase tracking-wider">Process Edit</span>
            <h3 className="text-base font-extrabold text-slate-800 dark:text-slate-100">프로세스 편집</h3>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400 cursor-pointer transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="px-6 py-5 flex flex-col gap-5">
          {/* 단계 명칭 */}
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-bold text-slate-500 dark:text-slate-400">단계 명칭 *</label>
            <input
              type="text"
              value={name}
              onChange={e => setName(e.target.value)}
              required
              placeholder="예: 05_퍼블리싱"
              className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 text-sm font-semibold bg-slate-50 dark:bg-slate-800 text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-toss-blue/30 focus:border-toss-blue transition-all"
            />
          </div>

          {/* 설명 */}
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-bold text-slate-500 dark:text-slate-400">상세 설명</label>
            <textarea
              value={description}
              onChange={e => setDescription(e.target.value)}
              placeholder="프로세스에 대한 간단한 설명"
              rows={2}
              className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 text-sm font-semibold bg-slate-50 dark:bg-slate-800 text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-toss-blue/30 focus:border-toss-blue transition-all resize-none"
            />
          </div>

          {/* 상태 + 난이도 */}
          <div className="grid grid-cols-2 gap-4">
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-bold text-slate-500 dark:text-slate-400">진행 상태</label>
              <CustomSelect
                value={status}
                onChange={e => setStatus(e.target.value)}
                className="w-full text-sm font-bold bg-slate-50 dark:bg-slate-800"
              >
                <option value="대기">대기</option>
                <option value="진행중">진행중</option>
                <option value="완료">완료</option>
              </CustomSelect>
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-bold text-slate-500 dark:text-slate-400">난이도</label>
              <CustomSelect
                value={difficulty}
                onChange={e => setDifficulty(e.target.value)}
                className="w-full text-sm font-bold bg-slate-50 dark:bg-slate-800"
              >
                <option value="낮음">낮음</option>
                <option value="보통">보통</option>
                <option value="높음">높음</option>
                <option value="매우높음">매우높음</option>
              </CustomSelect>
            </div>
          </div>

          {/* 진행률 슬라이더 및 입력 필드 */}
          <div className="flex flex-col gap-2">
            <div className="flex justify-between items-center">
              <label className="text-xs font-bold text-slate-500 dark:text-slate-400">진행률</label>
              <div className="relative flex items-center w-24">
                <input
                  type="number"
                  min={0}
                  max={100}
                  value={progress}
                  onChange={e => setProgress(Math.min(Math.max(Number(e.target.value) || 0, 0), 100))}
                  className="toss-input py-1 px-2.5 text-right pr-6 text-xs font-extrabold w-full h-[32px]"
                />
                <span className="absolute right-2 text-xs text-toss-gray-455 font-bold">%</span>
              </div>
            </div>
            <input
              type="range"
              min={0}
              max={100}
              step={1}
              value={progress}
              onChange={e => setProgress(Number(e.target.value))}
              className="w-full h-1.5 bg-gray-150 dark:bg-slate-800 rounded-lg appearance-none cursor-pointer accent-toss-blue"
            />
            <div className="flex gap-1 mt-0.5">
              {[0, 25, 50, 75, 100].map(val => (
                <button
                  key={val}
                  type="button"
                  onClick={() => setProgress(val)}
                  className={`flex-1 py-1 rounded-lg text-[10px] font-bold transition-all cursor-pointer ${
                    progress === val
                      ? 'bg-toss-blue text-white shadow-soft-sm'
                      : 'bg-slate-100 dark:bg-slate-850 text-slate-550 hover:bg-slate-200 dark:hover:bg-slate-800'
                  }`}
                >
                  {val}%
                </button>
              ))}
            </div>
          </div>

          {/* 기간 설정 */}
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-bold text-slate-500 dark:text-slate-400">프로세스 기간</label>
            {!projectStartDate || !projectEndDate ? (
              <div className="px-3 py-2.5 rounded-xl border border-dashed border-slate-200 dark:border-slate-700 text-xs text-slate-400 dark:text-slate-500 font-medium">
                ⚠️ 대시보드에서 프로젝트 전체 기간을 먼저 설정해 주세요.
              </div>
            ) : (
              <RangeDatePicker
                startDate={startDate}
                endDate={endDate}
                onChange={(s, e) => { setStartDate(s); setEndDate(e); }}
                minDate={projectStartDate}
                maxDate={projectEndDate}
                placeholder="프로세스 기간 선택"
              />
            )}
          </div>

          {/* 버튼 */}
          <div className="flex gap-3 pt-1">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 text-sm font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors cursor-pointer"
            >
              취소
            </button>
            <button
              type="submit"
              disabled={saving || !name.trim()}
              className="flex-1 py-2.5 rounded-xl bg-toss-blue text-white text-sm font-bold hover:bg-blue-600 disabled:opacity-40 disabled:cursor-not-allowed transition-colors cursor-pointer flex items-center justify-center gap-2"
            >
              {saving ? (
                <div className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />
              ) : null}
              저장하기
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

// ─── 메인 ProcessManagement ────────────────────────────────────
export const ProcessManagement: React.FC = () => {
  const { activeProject, processes, tasks, addProcess, removeProcess, updateProcessOrder, updateProcessDetail, scanAndSync } = useProjectStore();
  const [modalOpen, setModalOpen] = useState(false);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [editingProc, setEditingProc] = useState<Process | null>(null);

  const handleUpdateDetail = async (id: string, updates: Partial<Process>) => {
    if ((updates.start_date !== undefined || updates.end_date !== undefined) &&
        (!activeProject?.start_date || !activeProject?.end_date)) {
      alert('프로젝트 전체 기간이 먼저 설정되어야 프로세스 기간을 지정할 수 있습니다.');
      await scanAndSync();
      return;
    }

    const proc = processes.find(p => p.id === id);
    if (!proc) return;

    const newStart = updates.start_date !== undefined ? updates.start_date : proc.start_date;
    const newEnd = updates.end_date !== undefined ? updates.end_date : proc.end_date;

    if (newStart && newEnd && newStart > newEnd) {
      alert('시작일은 종료일보다 늦을 수 없습니다.');
      await scanAndSync();
      return;
    }

    if (newStart && activeProject?.start_date && newStart < activeProject.start_date) {
      alert(`프로세스 시작일은 프로젝트 시작일(${activeProject.start_date})보다 빠를 수 없습니다.`);
      await scanAndSync();
      return;
    }

    if (newEnd && activeProject?.end_date && newEnd > activeProject.end_date) {
      alert(`프로세스 종료일은 프로젝트 종료일(${activeProject.end_date})보다 늦을 수 없습니다.`);
      await scanAndSync();
      return;
    }

    const { tasks } = useProjectStore.getState();
    const processTasks = tasks[id] || [];
    for (const task of processTasks) {
      if (task.start_date && newStart && task.start_date < newStart) {
        alert(`세부 작업 '${task.title}'의 시작일이 프로세스 시작일보다 빠릅니다.`);
        await scanAndSync();
        return;
      }
      if (task.end_date && newEnd && task.end_date > newEnd) {
        alert(`세부 작업 '${task.title}'의 종료일이 프로세스 종료일보다 늦습니다.`);
        await scanAndSync();
        return;
      }
    }

    await updateProcessDetail(id, updates);
  };

  const handleAddProcess = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name) return;
    await addProcess(name, description);
    setName('');
    setDescription('');
    setModalOpen(false);
  };

  const handleMoveUp = async (idx: number) => {
    if (idx === 0) return;
    const reordered = [...processes];
    [reordered[idx - 1], reordered[idx]] = [reordered[idx], reordered[idx - 1]];
    await updateProcessOrder(reordered);
    await scanAndSync();
  };

  const handleMoveDown = async (idx: number) => {
    if (idx === processes.length - 1) return;
    const reordered = [...processes];
    [reordered[idx], reordered[idx + 1]] = [reordered[idx + 1], reordered[idx]];
    await updateProcessOrder(reordered);
    await scanAndSync();
  };

  const handleDuplicate = async (proc: Process) => {
    await addProcess(proc.name + ' 복사본', proc.description || '');
  };

  const handleRemove = async (id: string) => {
    if (confirm('이 프로세스를 삭제하시겠습니까? (연결된 모든 작업도 함께 삭제됩니다)')) {
      await removeProcess(id);
    }
  };

  const statusIcon = (status: string) => {
    if (status === '완료') return <CheckCircle2 className="w-3.5 h-3.5" />;
    if (status === '진행중') return <Clock className="w-3.5 h-3.5" />;
    return <AlertCircle className="w-3.5 h-3.5" />;
  };

  const statusColor = (status: string) => {
    if (status === '완료') return 'text-emerald-600 bg-emerald-50 dark:bg-emerald-900/20 border-emerald-200 dark:border-emerald-800/40';
    if (status === '진행중') return 'text-toss-blue bg-sky-50 dark:bg-sky-900/20 border-sky-200 dark:border-sky-800/40';
    return 'text-slate-500 bg-slate-100 dark:bg-slate-800 border-slate-200 dark:border-slate-700';
  };

  const difficultyColor = (d?: string) => {
    if (d === '매우높음') return 'text-rose-500 font-bold';
    if (d === '높음') return 'text-amber-500 font-bold';
    if (d === '낮음') return 'text-emerald-500 font-semibold';
    return 'text-slate-500 font-semibold';
  };

  return (
    <div className="cds--overview-container animate-slide-up">
      {/* Title Header */}
      <div className="cds--process-header-wrap">
        <div className="cds--column-flex">
          <span className="text-xs font-bold text-toss-blue mb-1">Process Config</span>
          <h1 className="cds--overview-header-title">프로세스 단계 관리</h1>
        </div>
        <button
          onClick={() => setModalOpen(true)}
          className="cds--btn cds--btn-primary px-5 py-3 flex items-center gap-1.5 font-bold shadow-sm cursor-pointer"
        >
          <Plus className="w-4.5 h-4.5" />
          <span>신규 단계 추가</span>
        </button>
      </div>

      {/* Processes List */}
      <div className="cds--process-list-container">
        {processes.length === 0 ? (
          <div className="cds--process-empty-list">
            <Layers className="cds--process-empty-icon" />
            <p className="cds--process-empty-text">정의된 프로젝트 프로세스 단계가 없습니다.</p>
            <button onClick={() => setModalOpen(true)} className="cds--btn cds--btn-primary cds--process-empty-btn">
              프로세스 첫 단추 생성
            </button>
          </div>
        ) : (
          <div className="cds--process-cards-list">
            {processes.map((proc, index) => {
              const remaining = getRemainingDays(proc.end_date);
              const isOverdue = remaining && remaining.days < 0;

              // 칸반 작업 요약 데이터 조회
              const processTasks = tasks[proc.id] || [];
              const totalCount = processTasks.length;
              const todoCount = processTasks.filter((t: Task) => t.status === '대기').length;
              const progressCount = processTasks.filter((t: Task) => t.status === '진행중').length;
              const reviewCount = processTasks.filter((t: Task) => t.status === '검토중').length;
              const doneCount = processTasks.filter((t: Task) => t.status === '완료').length;

              // 실제 작업 기반 진행률 계산 (작업이 없으면 기존 수동 진행률 사용)
              const actualProgressPercent = totalCount > 0 
                ? Math.round((doneCount / totalCount) * 100) 
                : Math.round(proc.progress * 100);

              return (
                <div
                  key={proc.id}
                  className={`cds--process-row-card transition-all ${isOverdue ? 'border-rose-200/60 dark:border-rose-800/30' : ''}`}
                >
                  <div className="cds--process-row-main">
                    {/* Left: Index + Info */}
                    <div className="cds--process-row-left">
                      <div className="cds--process-row-index">{index + 1}</div>
                      <div className="cds--process-row-info">
                        <div className="cds--process-row-title-wrap">
                          <span className="cds--process-row-title">{proc.name}</span>
                          {/* 상태 배지 */}
                          <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-bold border ${statusColor(proc.status)}`}>
                            {statusIcon(proc.status)}
                            {proc.status}
                          </span>
                          {/* 남은 일수 배지 */}
                          {remaining && (
                            <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-bold border ${remaining.color}`}>
                              <CalendarDays className="w-3 h-3" />
                              {remaining.label}
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-3 mt-0.5">
                          <span className="cds--process-row-desc">{proc.description || '상세 내용 없음'}</span>
                          {proc.difficulty && (
                            <span className={`text-[11px] ${difficultyColor(proc.difficulty)}`}>
                              난이도: {proc.difficulty}
                            </span>
                          )}
                          {proc.start_date && proc.end_date && (
                            <span className="text-[11px] text-slate-400 dark:text-slate-500 font-medium">
                              {proc.start_date} ~ {proc.end_date}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Right: Actions */}
                    <div className="cds--process-row-right">
                      {/* 진행률 */}
                      <div className="flex flex-col items-end gap-1 min-w-[80px]">
                        <div className="flex items-center gap-1.5">
                          <span className="text-[11px] font-bold text-slate-400 dark:text-slate-500">진행률</span>
                          <span className="text-sm font-extrabold text-toss-blue">{actualProgressPercent}%</span>
                        </div>
                        <div className="w-20 h-1.5 rounded-full bg-slate-100 dark:bg-slate-700 overflow-hidden">
                          <div
                            className={`h-full rounded-full transition-all ${
                              proc.status === '완료' || actualProgressPercent === 100 ? 'bg-emerald-500' : 'bg-toss-blue'
                            }`}
                            style={{ width: `${actualProgressPercent}%` }}
                          />
                        </div>
                      </div>

                      {/* 순서 조정 */}
                      <div className="cds--process-order-controls">
                        <button onClick={() => handleMoveUp(index)} disabled={index === 0} className="cds--process-order-btn" title="위로 이동">
                          <ArrowUp className="w-4 h-4" />
                        </button>
                        <button onClick={() => handleMoveDown(index)} disabled={index === processes.length - 1} className="cds--process-order-btn" title="아래로 이동">
                          <ArrowDown className="w-4 h-4" />
                        </button>
                      </div>

                      {/* 편집·복제·삭제 */}
                      <div className="cds--process-action-group">
                        <button
                          onClick={() => setEditingProc(proc)}
                          className="cds--process-action-btn text-toss-blue hover:bg-blue-50 dark:hover:bg-blue-900/20"
                          title="편집"
                        >
                          <Pencil className="w-4 h-4" />
                        </button>
                        <button onClick={() => handleDuplicate(proc)} className="cds--process-action-btn" title="단계 복제">
                          <Copy className="w-4 h-4" />
                        </button>
                        <button onClick={() => handleRemove(proc.id)} className="cds--process-action-btn-danger" title="단계 삭제">
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* 기간·난이도 빠른 설정 & 작업 현황 요약 */}
                  <div className="cds--process-detail-row flex items-center justify-between flex-wrap gap-3">
                    <div className="flex items-center gap-6">
                      <div className="cds--process-detail-item">
                        <span className="cds--process-detail-label">기간 설정</span>
                        {!activeProject?.start_date || !activeProject?.end_date ? (
                          <div
                            onClick={() => alert('프로젝트 전체 기간이 먼저 설정되어야 합니다.')}
                            className="cds--process-datepicker-disabled"
                          >
                            프로젝트 전체 기간 설정 필요
                          </div>
                        ) : (
                          <RangeDatePicker
                            startDate={proc.start_date || ''}
                            endDate={proc.end_date || ''}
                            onChange={(start, end) => handleUpdateDetail(proc.id, { start_date: start, end_date: end })}
                            minDate={activeProject.start_date}
                            maxDate={activeProject.end_date}
                            placeholder="프로세스 기간 선택"
                            className="w-64"
                            compact={true}
                          />
                        )}
                      </div>

                      <div className="cds--process-detail-item">
                        <span className="cds--process-detail-label">난이도</span>
                        <CustomSelect
                          value={proc.difficulty || '보통'}
                          onChange={(e) => handleUpdateDetail(proc.id, { difficulty: e.target.value })}
                          className="cds--text-input font-bold"
                          style={{ width: 'auto', padding: '0.375rem 1.5rem 0.375rem 0.625rem' }}
                        >
                          <option value="낮음">낮음</option>
                          <option value="보통">보통</option>
                          <option value="높음">높음</option>
                          <option value="매우높음">매우높음</option>
                        </CustomSelect>
                      </div>
                    </div>

                    {/* 작업 요약 배지 */}
                    <div className="cds--process-detail-item flex items-center gap-1.5 select-none ml-auto">
                      <span className="cds--process-detail-label text-[11px] font-bold text-slate-400">작업 현황</span>
                      <div className="flex items-center gap-1 flex-wrap">
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-500 border border-slate-200/40">
                          대기 {todoCount}
                        </span>
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-sky-50 dark:bg-sky-950/40 text-toss-blue border border-sky-200/40">
                          진행 {progressCount}
                        </span>
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-amber-50 dark:bg-amber-950/40 text-amber-500 border border-amber-200/40">
                          검토 {reviewCount}
                        </span>
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 border border-emerald-200/40">
                          완료 {doneCount}
                        </span>
                        <span className="text-xs font-black text-slate-400 dark:text-slate-500 ml-1">
                          (총 {totalCount}개 작업)
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* 신규 등록 모달 */}
      {modalOpen && (
        <div className="cds--modal-overlay" onClick={() => setModalOpen(false)}>
          <div className="cds--modal-container animate-scale-in" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="cds--modal-title">새 프로세스 단계 추가</h3>
              <button onClick={() => setModalOpen(false)} className="p-1.5 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400 cursor-pointer">
                <X className="w-4 h-4" />
              </button>
            </div>
            <form onSubmit={handleAddProcess} className="cds--modal-form">
              <div className="cds--column-flex gap-1.5">
                <label className="text-xs font-bold text-toss-gray-450 dark:text-slate-400">단계 명칭</label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="예: 05_퍼블리싱, 마크업 검수"
                  required
                  className="cds--text-input font-semibold"
                />
              </div>
              <div className="cds--column-flex gap-1.5">
                <label className="text-xs font-bold text-toss-gray-450 dark:text-slate-400">상세 설명</label>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="예: 퍼블리싱 산출물 생성 및 반응형 검수 프로세스"
                  rows={3}
                  className="cds--text-input font-semibold resize-none"
                />
              </div>
              <div className="cds--modal-footer-btns">
                <button type="button" onClick={() => setModalOpen(false)} className="cds--btn cds--btn-secondary cds--modal-btn-cancel">취소</button>
                <button type="submit" className="cds--btn cds--btn-primary cds--modal-btn-submit">추가하기</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 편집 모달 */}
      {editingProc && (
        <EditModal
          proc={editingProc}
          projectStartDate={activeProject?.start_date}
          projectEndDate={activeProject?.end_date}
          onSave={async (updates) => {
            await handleUpdateDetail(editingProc.id, updates);
          }}
          onClose={() => setEditingProc(null)}
        />
      )}
    </div>
  );
};
