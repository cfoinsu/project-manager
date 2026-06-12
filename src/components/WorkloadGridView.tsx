import React, { useState, useEffect, useCallback } from 'react';
import * as api from '../utils/api';
import { useAuthStore } from '../store/authStore';
import type { Workload, Assignment } from '../types';
import {
  Zap, RefreshCw, CheckCircle, AlertTriangle, Clock,
  ChevronLeft, ChevronRight, TrendingUp, Users
} from 'lucide-react';

interface WorkloadGridViewProps {
  projectId: string;
  assignments: Assignment[];
  onSelectCell?: (workload: Workload) => void;
  selectedWorkloadId?: string | null;
}

// 월요일 기준 주 라벨
function formatWeekLabel(weekStart: string): string {
  const d = new Date(weekStart);
  const end = new Date(d);
  end.setDate(end.getDate() + 6);
  const m1 = d.getMonth() + 1;
  const d1 = d.getDate();
  const m2 = end.getMonth() + 1;
  const d2 = end.getDate();
  return `${m1}/${d1}~${m2}/${d2}`;
}

function getStatusColor(ratio: number, isOverloaded: boolean): string {
  if (isOverloaded) return 'bg-red-500';
  if (ratio === 0) return 'bg-gray-100';
  if (ratio <= 50) return 'bg-emerald-400';
  if (ratio <= 80) return 'bg-toss-blue';
  if (ratio <= 100) return 'bg-amber-400';
  return 'bg-red-500';
}

function getStatusBadge(totalRatio: number) {
  if (totalRatio > 100) return { label: '과부하', color: 'text-red-600 bg-red-50 border-red-200' };
  if (totalRatio > 80) return { label: '주의', color: 'text-amber-600 bg-amber-50 border-amber-200' };
  return { label: '정상', color: 'text-emerald-600 bg-emerald-50 border-emerald-200' };
}

export const WorkloadGridView: React.FC<WorkloadGridViewProps> = ({
  projectId, assignments, onSelectCell, selectedWorkloadId
}) => {
  const { serverMode } = useAuthStore();
  const [workloads, setWorkloads] = useState<Workload[]>([]);
  const [loading, setLoading] = useState(false);
  const [generatingId, setGeneratingId] = useState<string | null>(null);
  const [weekOffset, setWeekOffset] = useState(0); // 현재 표시 구간 오프셋 (8주 단위)
  const [editingCell, setEditingCell] = useState<{ id: string; value: number } | null>(null);

  const fetchWorkloads = useCallback(async () => {
    if (!projectId) return;
    setLoading(true);
    try {
      const data = await api.getWorkloads(serverMode, { project_id: projectId });
      setWorkloads(data);
    } catch (err) {
      console.error('워크로드 로드 실패:', err);
    } finally {
      setLoading(false);
    }
  }, [projectId, serverMode]);

  useEffect(() => {
    fetchWorkloads();
  }, [fetchWorkloads]);

  // 모든 주 목록 추출 (전체 기간)
  const allWeeks = [...new Set(workloads.map(w => w.week_start))].sort();

  // 표시할 주 (8주 단위 슬라이딩)
  const VISIBLE_WEEKS = 8;
  const startIdx = Math.max(0, weekOffset * VISIBLE_WEEKS);
  const visibleWeeks = allWeeks.slice(startIdx, startIdx + VISIBLE_WEEKS);

  // 사용자별 그룹화
  const userIds = [...new Set(assignments.map(a => a.user_id))];
  const userMap: Record<string, { name: string; email: string; assignments: Assignment[] }> = {};
  for (const a of assignments) {
    if (!userMap[a.user_id]) {
      userMap[a.user_id] = { name: a.user_name || '알 수 없음', email: a.user_email || '', assignments: [] };
    }
    userMap[a.user_id].assignments.push(a);
  }

  // workload lookup: user_id + week_start → workload[]
  const wlMap: Record<string, Workload[]> = {};
  for (const wl of workloads) {
    const key = `${wl.user_id}__${wl.week_start}`;
    if (!wlMap[key]) wlMap[key] = [];
    wlMap[key].push(wl);
  }

  // 특정 셀의 총 work_ratio
  const getCellTotal = (userId: string, week: string) => {
    return (wlMap[`${userId}__${week}`] || []).reduce((s, w) => s + w.work_ratio, 0);
  };

  // assignment 기반 workload 자동 생성
  const handleGenerate = async (assignmentId: string) => {
    setGeneratingId(assignmentId);
    try {
      await api.generateWorkload(serverMode, assignmentId);
      await fetchWorkloads();
    } catch (err) {
      console.error('워크로드 생성 실패:', err);
    } finally {
      setGeneratingId(null);
    }
  };

  // workload ratio 인라인 수정
  const handleCellEdit = async (wl: Workload, newRatio: number) => {
    try {
      await api.updateWorkload(serverMode, wl.id, { work_ratio: newRatio });
      setWorkloads(prev => prev.map(w => w.id === wl.id ? { ...w, work_ratio: newRatio } : w));
    } catch (err) {
      console.error('워크로드 수정 실패:', err);
    }
    setEditingCell(null);
  };

  // status 토글 (UI에서 책불도 기능 예약)
  const _handleStatusToggle = async (_wl: Workload) => {};
  void _handleStatusToggle;

  const maxPages = Math.ceil(allWeeks.length / VISIBLE_WEEKS);

  if (assignments.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-gray-400">
        <Users className="w-10 h-10 mb-3 opacity-40" />
        <p className="text-sm font-medium">배정된 인력이 없습니다.</p>
        <p className="text-xs mt-1">먼저 인력을 배정한 후 워크로드를 생성하세요.</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      {/* 헤더 */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <TrendingUp className="w-4 h-4 text-toss-blue" />
          <span className="text-sm font-bold text-gray-800">주간 작업량 그리드</span>
          <span className="text-xs text-gray-400 ml-1">(전체 {allWeeks.length}주)</span>
        </div>
        <div className="flex items-center gap-2">
          {/* 범례 */}
          <div className="flex items-center gap-3 text-xs text-gray-500 mr-2">
            <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-sm bg-emerald-400 inline-block" />~50%</span>
            <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-sm bg-toss-blue inline-block" />~80%</span>
            <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-sm bg-amber-400 inline-block" />~100%</span>
            <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-sm bg-red-500 inline-block" />과부하</span>
          </div>
          <button
            onClick={() => setWeekOffset(o => Math.max(0, o - 1))}
            disabled={weekOffset === 0}
            className="p-1.5 rounded-lg border border-gray-200 hover:bg-gray-50 disabled:opacity-30 disabled:cursor-not-allowed transition-all"
          >
            <ChevronLeft className="w-3.5 h-3.5" />
          </button>
          <span className="text-xs text-gray-500 min-w-[70px] text-center">
            {weekOffset + 1} / {Math.max(1, maxPages)} 구간
          </span>
          <button
            onClick={() => setWeekOffset(o => Math.min(maxPages - 1, o + 1))}
            disabled={weekOffset >= maxPages - 1}
            className="p-1.5 rounded-lg border border-gray-200 hover:bg-gray-50 disabled:opacity-30 disabled:cursor-not-allowed transition-all"
          >
            <ChevronRight className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={fetchWorkloads}
            className="p-1.5 rounded-lg border border-gray-200 hover:bg-gray-50 transition-all"
            title="새로고침"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* Assignment 생성 버튼 영역 */}
      <div className="flex flex-wrap gap-2">
        {assignments.map(a => {
          const hasWorkload = workloads.some(w => w.assignment_id === a.id);
          return (
            <button
              key={a.id}
              onClick={() => handleGenerate(a.id)}
              disabled={generatingId === a.id}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all ${
                hasWorkload
                  ? 'border-gray-200 text-gray-500 hover:bg-gray-50'
                  : 'border-toss-blue text-toss-blue bg-blue-50 hover:bg-blue-100'
              }`}
            >
              {generatingId === a.id ? (
                <RefreshCw className="w-3 h-3 animate-spin" />
              ) : (
                <Zap className="w-3 h-3" />
              )}
              {a.user_name} 워크로드 {hasWorkload ? '재생성' : '생성'}
            </button>
          );
        })}
      </div>

      {/* 주간 그리드 테이블 */}
      {allWeeks.length === 0 ? (
        <div className="text-center py-12 text-gray-400 text-sm border border-dashed border-gray-200 rounded-xl">
          워크로드 생성 버튼을 눌러 주간 작업량을 생성하세요.
        </div>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-gray-200">
          <table className="w-full border-collapse text-xs">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-200">
                <th className="text-left px-4 py-3 font-bold text-gray-600 min-w-[140px] sticky left-0 bg-gray-50 z-10 border-r border-gray-200">
                  인력
                </th>
                {visibleWeeks.map(week => (
                  <th key={week} className="px-2 py-3 font-semibold text-gray-500 min-w-[80px] text-center">
                    {formatWeekLabel(week)}
                  </th>
                ))}
                <th className="px-3 py-3 font-bold text-gray-600 text-center min-w-[60px]">합계</th>
              </tr>
            </thead>
            <tbody>
              {userIds.map((userId, uidx) => {
                const userInfo = userMap[userId];
                if (!userInfo) return null;
                const userAssigns = userInfo.assignments;

                return userAssigns.map((assign) => {
                  // 이 assignment의 workload들
                  const assignWls = workloads.filter(w => w.assignment_id === assign.id);

                  return (
                    <tr
                      key={assign.id}
                      className={`border-b border-gray-100 hover:bg-gray-50/50 transition-colors ${
                        uidx % 2 === 0 ? 'bg-white' : 'bg-gray-50/30'
                      }`}
                    >
                      {/* 인력 정보 셀 */}
                      <td className="px-4 py-3 sticky left-0 bg-inherit z-10 border-r border-gray-100">
                        <div className="flex flex-col gap-0.5">
                          <span className="font-bold text-gray-800">{userInfo.name}</span>
                          <span className="text-gray-400 text-xs">{assign.role}</span>
                          <div className="flex items-center gap-1 mt-0.5">
                            <span className="px-1.5 py-0.5 bg-blue-50 text-toss-blue rounded text-xs font-semibold">
                              배정 {assign.allocation_percent}%
                            </span>
                          </div>
                        </div>
                      </td>

                      {/* 주별 셀 */}
                      {visibleWeeks.map(week => {
                        const wl = assignWls.find(w => w.week_start === week);
                        const ratio = wl ? wl.work_ratio : 0;
                        // 이 사용자의 이 주 전체 합산 (모든 프로젝트)
                        const cellTotal = getCellTotal(userId, week);
                        const isOver = cellTotal > 100;
                        const isEditing = editingCell?.id === wl?.id;
                        const isSelected = wl && selectedWorkloadId === wl.id;

                        return (
                          <td key={week} className="px-1.5 py-2 text-center">
                            {wl ? (
                              <div
                                className={`relative group cursor-pointer rounded-lg transition-all ${
                                  isSelected ? 'ring-2 ring-toss-blue ring-offset-1' : ''
                                }`}
                                onClick={() => onSelectCell && onSelectCell(wl)}
                              >
                                {/* 비율 바 */}
                                <div className="relative h-9 rounded-lg overflow-hidden bg-gray-100">
                                  <div
                                    className={`absolute bottom-0 left-0 right-0 transition-all duration-300 ${getStatusColor(ratio, isOver)}`}
                                    style={{ height: `${Math.min(ratio, 100)}%` }}
                                  />
                                  <div className="absolute inset-0 flex items-center justify-center">
                                    {isEditing ? (
                                      <input
                                        type="number"
                                        min={0}
                                        max={100}
                                        defaultValue={ratio}
                                        autoFocus
                                        onClick={e => e.stopPropagation()}
                                        onKeyDown={e => {
                                          if (e.key === 'Enter') {
                                            handleCellEdit(wl, Number((e.target as HTMLInputElement).value));
                                          } else if (e.key === 'Escape') {
                                            setEditingCell(null);
                                          }
                                        }}
                                        onBlur={e => handleCellEdit(wl, Number(e.target.value))}
                                        className="w-10 text-center text-xs font-bold bg-white/90 rounded border border-toss-blue outline-none z-20 relative"
                                      />
                                    ) : (
                                      <span
                                        className={`text-xs font-bold relative z-10 ${
                                          ratio > 40 ? 'text-white' : 'text-gray-600'
                                        }`}
                                        onDoubleClick={e => {
                                          e.stopPropagation();
                                          setEditingCell({ id: wl.id, value: ratio });
                                        }}
                                        title="더블클릭으로 수정"
                                      >
                                        {ratio}%
                                      </span>
                                    )}
                                  </div>
                                </div>

                                {/* 완료 뱃지 */}
                                {wl.status === 'done' && (
                                  <div className="absolute -top-1 -right-1 z-20">
                                    <CheckCircle className="w-3.5 h-3.5 text-emerald-500 fill-white" />
                                  </div>
                                )}

                                {/* 과부하 경고 */}
                                {isOver && (
                                  <div className="absolute -top-1 -left-1 z-20">
                                    <AlertTriangle className="w-3.5 h-3.5 text-red-500 fill-white" />
                                  </div>
                                )}

                                {/* Hover 툴팁 */}
                                <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 z-30 hidden group-hover:flex flex-col gap-1 bg-gray-900 text-white text-xs rounded-lg px-3 py-2 shadow-xl whitespace-nowrap pointer-events-none">
                                  <div className="font-bold">{formatWeekLabel(week)}</div>
                                  <div>작업량: <span className="text-amber-300">{ratio}%</span></div>
                                  <div>예상: {wl.expected_hours?.toFixed(1) || '-'}시간</div>
                                  <div>상태: {wl.status === 'done' ? '✅ 완료' : '📋 예정'}</div>
                                  {isOver && <div className="text-red-400 font-bold">⚠ 이 주 총합 {cellTotal}% (과부하)</div>}
                                  <div className="text-gray-400 text-xs mt-0.5">더블클릭: 수정 / 클릭: 댓글</div>
                                </div>
                              </div>
                            ) : (
                              <div className="h-9 rounded-lg bg-gray-50 border border-dashed border-gray-200 flex items-center justify-center">
                                <span className="text-gray-300 text-xs">-</span>
                              </div>
                            )}
                          </td>
                        );
                      })}

                      {/* 평균/합 */}
                      <td className="px-3 py-2 text-center">
                        {(() => {
                          const validRatios = visibleWeeks
                            .map(w => assignWls.find(x => x.week_start === w)?.work_ratio || 0)
                            .filter(r => r > 0);
                          const avg = validRatios.length
                            ? Math.round(validRatios.reduce((a, b) => a + b, 0) / validRatios.length)
                            : 0;
                          const badge = getStatusBadge(avg);
                          return (
                            <span className={`px-2 py-0.5 rounded-full text-xs font-bold border ${badge.color}`}>
                              {avg}%
                            </span>
                          );
                        })()}
                      </td>
                    </tr>
                  );
                });
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* 하단 안내 */}
      <div className="flex items-center gap-2 text-xs text-gray-400">
        <Clock className="w-3 h-3" />
        <span>셀 <strong>더블클릭</strong>으로 작업량 직접 수정 · <strong>클릭</strong>으로 댓글 패널 열기</span>
      </div>
    </div>
  );
};
