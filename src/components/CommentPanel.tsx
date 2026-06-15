import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import * as api from '../utils/api';
import { useAuthStore } from '../store/authStore';
import { useProjectStore } from '../store/projectStore';
import type { Comment, Workload, Assignment } from '../types';
import { Avatar } from './Avatar';
import {
  MessageSquare, Send, X,
  Play, Pause, Mic, Paperclip,
  Link, FileText, ExternalLink, Hash, Clock
} from 'lucide-react';

interface CommentPanelProps {
  projectId: string;
  assignments?: Assignment[];
  selectedWorkload?: Workload | null;
  selectedAssignment?: Assignment | null;
  taskId?: string | null;
  onClose?: () => void;
  onProjectChange?: (projectId: string) => void;
}

function timeAgo(dateStr: string): string {
  const now = new Date();
  const utcStr = dateStr.endsWith('Z') ? dateStr : (dateStr.replace(' ', 'T') + 'Z');
  const d = new Date(utcStr);
  const diff = Math.floor((now.getTime() - d.getTime()) / 1000);
  if (diff < 60) return '방금 전';
  if (diff < 3600) return `${Math.floor(diff / 60)}분 전`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}시간 전`;
  return `${Math.floor(diff / 86400)}일 전`;
}

function getInitials(name: string): string {
  return name?.slice(0, 2) || '?';
}

const AVATAR_PALETTE = [
  { bg: 'bg-blue-500', ring: 'ring-blue-100 dark:ring-blue-900/30' },
  { bg: 'bg-violet-500', ring: 'ring-violet-100 dark:ring-violet-900/30' },
  { bg: 'bg-emerald-500', ring: 'ring-emerald-100 dark:ring-emerald-900/30' },
  { bg: 'bg-amber-500', ring: 'ring-amber-100 dark:ring-amber-900/30' },
  { bg: 'bg-pink-500', ring: 'ring-pink-100 dark:ring-pink-900/30' },
  { bg: 'bg-indigo-500', ring: 'ring-indigo-100 dark:ring-indigo-900/30' },
  { bg: 'bg-teal-500', ring: 'ring-teal-100 dark:ring-teal-900/30' },
  { bg: 'bg-rose-500', ring: 'ring-rose-100 dark:ring-rose-900/30' },
];

function getAvatarPalette(name: string) {
  const idx = (name?.charCodeAt(0) || 0) % AVATAR_PALETTE.length;
  return AVATAR_PALETTE[idx];
}

// ─── 단일 댓글 카드 ─────────────────────────────────────────────
const ALLOWED_REACTIONS = new Set(['👍', '❤️', '✅', '🔥']);

const normalizeReactionsForView = (reactions: Comment['reactions']) => {
  if (!reactions || typeof reactions !== 'object') return [];

  return Object.entries(reactions)
    .filter(([emoji]) => ALLOWED_REACTIONS.has(emoji))
    .map(([emoji, uids]) => [
      emoji,
      Array.isArray(uids) ? uids.filter(Boolean) : []
    ] as [string, string[]])
    .filter(([, uids]) => uids.length > 0);
};

interface CommentCardProps {
  comment: Comment;
  isOwn: boolean;
  isAdmin: boolean;
  currentUserId?: string;
  parentComment?: Comment | null;
  onDelete: (id: string) => void;
  onEdit: (id: string, content: string) => Promise<void>;
  onReply: (parentId: string, parentAuthorName: string) => void;
  onReact: (commentId: string, emoji: string) => void;
  playingAudioId: string | null;
  audioProgress: number;
  onTogglePlayAudio: (id: string) => void;
}

const CommentCard: React.FC<CommentCardProps> = ({
  comment,
  isOwn,
  isAdmin,
  currentUserId,
  parentComment = null,
  onDelete,
  onEdit,
  onReply,
  onReact,
  playingAudioId,
  audioProgress,
  onTogglePlayAudio,
}) => {
  const [editing, setEditing] = useState(false);
  const [editValue, setEditValue] = useState(comment.content);
  const [savingEdit, setSavingEdit] = useState(false);
  const normalizedReactions = normalizeReactionsForView(comment.reactions);
  const editRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (editing && editRef.current) {
      editRef.current.focus();
      editRef.current.selectionStart = editRef.current.value.length;
    }
  }, [editing]);

  const handleSaveEdit = async () => {
    if (!editValue.trim() || editValue.trim() === comment.content) {
      setEditing(false);
      setEditValue(comment.content);
      return;
    }
    setSavingEdit(true);
    try {
      await onEdit(comment.id, editValue.trim());
      setEditing(false);
    } finally {
      setSavingEdit(false);
    }
  };

  const alignRight = isOwn;

  // 특수 메시지 판별 (음성 녹음 / 첨부 파일)
  const isAudio = comment.content.startsWith('[Audio:') && comment.content.endsWith(']');
  const isFile = comment.content.startsWith('[File:') && comment.content.endsWith(']');

  // 파일 파싱
  const fileInfo = useMemo(() => {
    if (!isFile) return null;
    const match = comment.content.match(/\[File:\s*([^(]+)\s*\(([^)]+)\)\]/);
    if (match) {
      return { name: match[1].trim(), size: match[2].trim() };
    }
    return { name: comment.content.replace('[File: ', '').replace(']', ''), size: '알 수 없음' };
  }, [comment.content, isFile]);

  // 오디오 시간 파싱
  const audioDuration = useMemo(() => {
    if (!isAudio) return '0s';
    return comment.content.replace('[Audio: ', '').replace(']', '');
  }, [comment.content, isAudio]);

  const isPlayingThis = playingAudioId === comment.id;

  const dept = comment.author_department || '부서 없음';
  const pos = comment.author_position || comment.author_job_role || '역할 없음';

  return (
    <div id={`comment-${comment.id}`} className="w-full">
      <div className={`flex gap-3 group animate-fade-in ${alignRight ? 'flex-row-reverse' : ''}`}>
        {/* 아바타 */}
        <div className="shrink-0">
          <Avatar 
            name={comment.author_name} 
            profileImage={comment.author_profile_image} 
            className="w-9 h-9 text-xs" 
          />
        </div>

        {/* 말풍선 */}
        <div className={`flex-1 min-w-0 flex flex-col ${alignRight ? 'items-end' : 'items-start'}`}>
          {/* 이름 & 부서/역할 & 날짜 */}
          <div className={`flex items-center gap-2 mb-1 ${alignRight ? 'flex-row-reverse' : ''}`}>
            <span className="text-xs font-bold text-slate-800 dark:text-slate-200">
              {comment.author_name || '알 수 없음'}
              {isOwn && <span className="ml-1 text-[9px] font-bold text-toss-blue">(나)</span>}
            </span>
            <span className="text-[10px] bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 px-1.5 py-0.5 rounded-md font-semibold">
              {dept} · {pos}
            </span>
            <span className="text-[10px] text-slate-400 dark:text-slate-500">
              {timeAgo(comment.created_at)}
              {comment.updated_at && <span className="ml-1 opacity-70">(수정됨)</span>}
            </span>
          </div>

          {/* 본문 / 파일 / 음성 카드 */}
          {editing ? (
            <div className="w-full max-w-[90%]">
              <textarea
                ref={editRef}
                value={editValue}
                onChange={e => setEditValue(e.target.value)}
                onKeyDown={e => {
                  if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) handleSaveEdit();
                  if (e.key === 'Escape') { setEditing(false); setEditValue(comment.content); }
                }}
                rows={3}
                className="w-full resize-none text-xs px-3 py-2 border border-toss-blue rounded-xl focus:outline-none focus:ring-2 focus:ring-toss-blue/20 dark:bg-slate-800 dark:text-slate-100 dark:border-toss-blue/50 bg-white"
              />
              <div className="flex gap-2 mt-1.5 justify-end">
                <button
                  onClick={() => { setEditing(false); setEditValue(comment.content); }}
                  className="px-2.5 py-1 text-[11px] font-bold rounded-lg bg-slate-150 text-slate-650 hover:bg-slate-200 cursor-pointer"
                >
                  취소
                </button>
                <button
                  onClick={handleSaveEdit}
                  disabled={savingEdit}
                  className="px-2.5 py-1 text-[11px] font-bold rounded-lg bg-toss-blue text-white hover:bg-blue-600 disabled:opacity-40 cursor-pointer flex items-center gap-1"
                >
                  저장
                </button>
              </div>
            </div>
          ) : (
            <div className="max-w-[85%] relative flex flex-col gap-1">
              {/* 답글 인용 카드 */}
              {parentComment && (
                <div
                  onClick={() => {
                    const el = document.getElementById(`comment-${parentComment.id}`);
                    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' });
                  }}
                  className={`px-3 py-1.5 rounded-xl text-[11px] leading-tight border cursor-pointer hover:opacity-90 transition-opacity truncate max-w-full text-left ${
                    alignRight
                      ? 'bg-blue-600/30 text-blue-100 border-blue-500/20'
                      : 'bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 border-slate-200 dark:border-slate-700'
                  }`}
                >
                  <span className={`font-bold block text-[10px] ${alignRight ? 'text-blue-200' : 'text-toss-blue'}`}>
                    @{parentComment.author_name} ({parentComment.author_department || '부서 없음'} · {parentComment.author_position || parentComment.author_job_role || '역할 없음'})
                  </span>
                  <span className="opacity-80 block truncate">
                    {parentComment.content.startsWith('[Audio:')
                      ? '🎙️ 음성 메모'
                      : parentComment.content.startsWith('[File:')
                      ? '📁 첨부 파일'
                      : parentComment.content}
                  </span>
                </div>
              )}

              {/* 1. 음성 메모 렌더러 */}
              {isAudio ? (
                <div
                  className={`flex items-center gap-3 px-4 py-3 rounded-2xl border shadow-sm ${
                    alignRight
                      ? 'bg-gradient-to-r from-toss-blue to-blue-600 text-white border-blue-500/20 rounded-tr-sm'
                      : 'bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 border-slate-100 dark:border-slate-700 rounded-tl-sm'
                  }`}
                >
                  <button
                    onClick={() => onTogglePlayAudio(comment.id)}
                    className={`w-8 h-8 rounded-full flex items-center justify-center transition-transform hover:scale-105 active:scale-95 cursor-pointer shadow ${
                      alignRight
                        ? 'bg-white text-toss-blue'
                        : 'bg-toss-blue text-white'
                    }`}
                  >
                    {isPlayingThis ? (
                      <Pause className="w-3.5 h-3.5 fill-current" />
                    ) : (
                      <Play className="w-3.5 h-3.5 fill-current ml-0.5" />
                    )}
                  </button>
                  <div className="flex flex-col gap-1 min-w-[120px]">
                    <div className="flex items-end gap-0.5 h-6">
                      {[12, 24, 16, 8, 28, 20, 14, 26, 18, 10, 22, 16].map((h, i) => {
                        const active = isPlayingThis && (audioProgress / 100) * 12 > i;
                        return (
                          <span
                            key={i}
                            className={`w-[3px] rounded-full transition-all duration-300 ${
                              active
                                ? alignRight ? 'bg-yellow-300' : 'bg-toss-blue'
                                : alignRight ? 'bg-white/40' : 'bg-slate-300 dark:bg-slate-600'
                            }`}
                            style={{
                              height: `${h}px`,
                              transform: active ? 'scaleY(1.1)' : 'scaleY(1)'
                            }}
                          />
                        );
                      })}
                    </div>
                    <div className={`text-[10px] font-bold ${alignRight ? 'text-blue-150' : 'text-slate-400'}`}>
                      {isPlayingThis ? `재생 중... ${Math.round(audioProgress)}%` : `음성 메모 · ${audioDuration}`}
                    </div>
                  </div>
                </div>
              ) : isFile && fileInfo ? (
                /* 2. 파일 첨부 렌더러 */
                <div
                  className={`flex items-center gap-3 px-4 py-3.5 rounded-2xl border shadow-sm ${
                    alignRight
                      ? 'bg-blue-50 dark:bg-slate-800 text-slate-800 dark:text-slate-100 border-blue-100 dark:border-slate-700 rounded-tr-sm'
                      : 'bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 border-slate-150 dark:border-slate-700 rounded-tl-sm'
                  }`}
                >
                  <div className="w-10 h-10 rounded-xl bg-amber-500/10 flex items-center justify-center text-amber-500 shrink-0">
                    <FileText className="w-5 h-5" />
                  </div>
                  <div className="text-left min-w-[140px]">
                    <p className="text-xs font-bold text-slate-700 dark:text-slate-200 truncate max-w-[180px]">
                      {fileInfo.name}
                    </p>
                    <p className="text-[10px] text-slate-400 dark:text-slate-500 font-semibold mt-0.5">
                      {fileInfo.size}
                    </p>
                  </div>
                  <a
                    href="#"
                    onClick={e => e.preventDefault()}
                    className="p-2 rounded-lg bg-slate-50 dark:bg-slate-750 hover:bg-slate-100 text-slate-500 hover:text-toss-blue transition-colors cursor-pointer"
                    title="다운로드"
                  >
                    <ExternalLink className="w-3.5 h-3.5" />
                  </a>
                </div>
              ) : (
                /* 3. 일반 텍스트 말풍선 */
                <div
                  className={`px-4 py-2.5 rounded-2xl text-[13px] leading-relaxed break-words shadow-sm border ${
                    alignRight
                      ? 'bg-toss-blue text-white rounded-tr-sm border-toss-blue/20'
                      : 'bg-slate-50 dark:bg-slate-800 text-slate-750 dark:text-slate-250 rounded-tl-sm border-slate-100 dark:border-slate-700/60'
                  }`}
                >
                  {comment.content}
                </div>
              )}

              {/* 이모지 반응 라인 */}
              {normalizedReactions.length > 0 && (
                <div className={`flex items-center gap-1 mt-1.5 flex-wrap ${alignRight ? 'justify-end' : 'justify-start'}`}>
                  {normalizedReactions.map(([emoji, uids]) => {
                    const hasReacted = currentUserId ? uids.includes(currentUserId) : false;
                    return (
                      <button
                        key={emoji}
                        onClick={() => onReact(comment.id, emoji)}
                        className={`flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-bold border transition-all cursor-pointer hover:scale-105 active:scale-95 ${
                          hasReacted
                            ? 'bg-blue-50 dark:bg-blue-950/40 border-toss-blue/30 text-toss-blue'
                            : 'bg-white dark:bg-slate-850 border-slate-200 dark:border-slate-750 text-slate-500'
                        }`}
                      >
                        <span>{emoji}</span>
                        <span>{uids.length}</span>
                      </button>
                    );
                  })}
                </div>
              )}

              {/* 액션바 (수정, 삭제, 답글, 리액션 퀵버튼) */}
              <div className={`flex items-center gap-2 mt-1 opacity-0 group-hover:opacity-100 transition-opacity ${alignRight ? 'flex-row-reverse' : ''}`}>
                {['👍', '❤️', '✅', '🔥'].map(emoji => (
                  <button
                    key={emoji}
                    onClick={() => onReact(comment.id, emoji)}
                    className="w-5 h-5 flex items-center justify-center rounded-full bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-xs transition-all cursor-pointer"
                    title="반응 추가"
                  >
                    {emoji}
                  </button>
                ))}

                <div className="w-px h-3 bg-slate-200 dark:bg-slate-700 mx-1" />

                <button
                  onClick={() => onReply(comment.id, comment.author_name || '알 수 없음')}
                  className="flex items-center gap-1 px-1.5 py-0.5 rounded text-[11px] font-bold text-slate-400 hover:text-toss-blue transition-colors cursor-pointer"
                >
                  답글
                </button>
                {isOwn && (
                  <button
                    onClick={() => setEditing(true)}
                    className="flex items-center gap-1 px-1.5 py-0.5 rounded text-[11px] font-bold text-slate-400 hover:text-amber-500 transition-colors cursor-pointer"
                  >
                    수정
                  </button>
                )}
                {(isOwn || isAdmin) && (
                  <button
                    onClick={() => onDelete(comment.id)}
                    className="flex items-center gap-1 px-1.5 py-0.5 rounded text-[11px] font-bold text-slate-400 hover:text-red-500 transition-colors cursor-pointer"
                  >
                    삭제
                  </button>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

// ─── 메인 CommentPanel ────────────────────────────────────────
export const CommentPanel: React.FC<CommentPanelProps> = ({
  projectId,
  assignments = [],
  selectedWorkload,
  selectedAssignment,
  taskId,
  onClose,
  onProjectChange,
}) => {
  const { user: currentUser, serverMode } = useAuthStore();
  const { projects } = useProjectStore();

  const [allComments, setAllComments] = useState<Comment[]>([]);
  const [workloads, setWorkloads] = useState<Workload[]>([]);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [input, setInput] = useState('');
  const [replyTarget, setReplyTarget] = useState<{ id: string; name: string } | null>(null);

  // 음성 시뮬레이션 상태
  const [isRecording, setIsRecording] = useState(false);
  const [recordSeconds, setRecordSeconds] = useState(0);
  const recordInterval = useRef<any>(null);

  // 오디오 플레이어 시뮬레이션 상태
  const [playingAudioId, setPlayingAudioId] = useState<string | null>(null);
  const [audioProgress, setAudioProgress] = useState(0);
  const audioIntervalRef = useRef<any>(null);

  // 활성 채널 상태 (초기값: props에 기반)
  const [activeChannel, setActiveChannel] = useState<{
    type: 'project' | 'assignment' | 'workload';
    id: string;
    label: string;
  }>(() => {
    if (selectedWorkload) {
      return { type: 'workload', id: selectedWorkload.id, label: `📅 ${selectedWorkload.week_start} 워크로드` };
    }
    if (selectedAssignment) {
      return { type: 'assignment', id: selectedAssignment.id, label: `👤 ${selectedAssignment.user_name} (${selectedAssignment.role})` };
    }
    return { type: 'project', id: projectId, label: '🗂 프로젝트 전체 피드백' };
  });

  const [channelSearch, setChannelSearch] = useState('');
  const [showAttachMenu, setShowAttachMenu] = useState(false);

  const inputRef = useRef<HTMLTextAreaElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  // Props 변경 시 채널 자동 연동
  useEffect(() => {
    if (selectedWorkload) {
      setActiveChannel({ type: 'workload', id: selectedWorkload.id, label: `📅 ${selectedWorkload.week_start} 워크로드` });
    } else if (selectedAssignment) {
      setActiveChannel({ type: 'assignment', id: selectedAssignment.id, label: `👤 ${selectedAssignment.user_name} (${selectedAssignment.role})` });
    } else if (projectId) {
      setActiveChannel({ type: 'project', id: projectId, label: '🗂 프로젝트 전체 피드백' });
    }
  }, [selectedWorkload, selectedAssignment, projectId]);

  // 전체 코멘트 로딩 (원타임 로드 후 프론트엔드 필터링)
  const fetchAllComments = useCallback(async () => {
    if (!projectId) return;
    setLoading(true);
    try {
      let data;
      if (taskId) {
        data = await api.getComments(serverMode, { project_id: projectId, task_id: taskId });
      } else {
        data = await api.getComments(serverMode, { project_id: projectId });
      }
      setAllComments(data);

      if (!taskId) {
        const wlData = await api.getWorkloads(serverMode, { project_id: projectId });
        setWorkloads(wlData);
      }
    } catch (err) {
      console.error('댓글 로드 실패:', err);
    } finally {
      setLoading(false);
    }
  }, [projectId, serverMode, taskId]);

  useEffect(() => {
    fetchAllComments();
  }, [fetchAllComments, projectId]);

  // 활성 채널에 매핑되는 코멘트 필터링 및 시간순 정렬 (오래된 순 -> 최신 순)
  const filteredCommentsFlat = useMemo(() => {
    let filtered = allComments;
    if (taskId) {
      filtered = allComments.filter(c => c.task_id === taskId || c.assignment_id === `task_${taskId}`);
    } else if (activeChannel.type === 'project') {
      filtered = allComments.filter(c => !c.assignment_id && !c.workload_id && !c.task_id);
    } else if (activeChannel.type === 'assignment') {
      filtered = allComments.filter(c => c.assignment_id === activeChannel.id);
    } else if (activeChannel.type === 'workload') {
      filtered = allComments.filter(c => c.workload_id === activeChannel.id);
    }
    
    return [...filtered].sort((a, b) => {
      const utcStrA = a.created_at.endsWith('Z') ? a.created_at : (a.created_at.replace(' ', 'T') + 'Z');
      const utcStrB = b.created_at.endsWith('Z') ? b.created_at : (b.created_at.replace(' ', 'T') + 'Z');
      return new Date(utcStrA).getTime() - new Date(utcStrB).getTime();
    });
  }, [allComments, activeChannel, taskId]);

  // 스크롤을 항상 최하단으로 유지
  useEffect(() => {
    if (listRef.current) {
      listRef.current.scrollTop = listRef.current.scrollHeight;
    }
  }, [filteredCommentsFlat.length, activeChannel]);

  // 1. 좌측 사이드바: 활성화된 주차별 채널 목록 수집
  const activeWorkloadChannels = useMemo(() => {
    const workloadCommentMap: Record<string, string> = {};
    allComments.forEach(c => {
      if (c.workload_id) {
        const wl = workloads.find(w => w.id === c.workload_id);
        const weekStart = wl?.week_start || '알 수 없는 주차';
        workloadCommentMap[c.workload_id] = weekStart;
      }
    });
    if (selectedWorkload) {
      workloadCommentMap[selectedWorkload.id] = selectedWorkload.week_start;
    }

    return Object.entries(workloadCommentMap).map(([id, weekStart]) => ({
      id,
      weekStart
    }));
  }, [allComments, workloads, selectedWorkload]);

  // 2. 우측 사이드바: 링크 & 파일 아카이브 추출
  const linkArchive = useMemo(() => {
    const urlRegex = /(https?:\/\/[^\s]+)/g;
    const links: { url: string; author: string; dept?: string; pos?: string; date: string }[] = [];
    allComments
      .filter(c => {
        if (taskId) return c.task_id === taskId || c.assignment_id === `task_${taskId}`;
        if (activeChannel.type === 'project') return !c.assignment_id && !c.workload_id && !c.task_id;
        if (activeChannel.type === 'assignment') return c.assignment_id === activeChannel.id;
        return c.workload_id === activeChannel.id;
      })
      .forEach(c => {
        const matches = c.content.match(urlRegex);
        if (matches) {
          matches.forEach(url => links.push({
            url,
            author: c.author_name || '알 수 없음',
            dept: c.author_department || '부서 없음',
            pos: c.author_position || c.author_job_role || '역할 없음',
            date: c.created_at
          }));
        }
      });
    return links;
  }, [allComments, activeChannel, taskId]);

  const fileArchive = useMemo(() => {
    const files: { name: string; size: string; author: string; dept?: string; pos?: string; date: string }[] = [];
    allComments
      .filter(c => {
        if (taskId) return c.task_id === taskId || c.assignment_id === `task_${taskId}`;
        if (activeChannel.type === 'project') return !c.assignment_id && !c.workload_id && !c.task_id;
        if (activeChannel.type === 'assignment') return c.assignment_id === activeChannel.id;
        return c.workload_id === activeChannel.id;
      })
      .forEach(c => {
        if (c.content.startsWith('[File:') && c.content.endsWith(']')) {
          const match = c.content.match(/\[File:\s*([^(]+)\s*\(([^)]+)\)\]/);
          if (match) {
            files.push({
              name: match[1].trim(),
              size: match[2].trim(),
              author: c.author_name || '알 수 없음',
              dept: c.author_department || '부서 없음',
              pos: c.author_position || c.author_job_role || '역할 없음',
              date: c.created_at
            });
          }
        }
      });
    return files;
  }, [allComments, activeChannel, taskId]);

  // 3. 우측 사이드바: 상세 요약 산출용 활성 유저
  const activeUserMeta = useMemo(() => {
    if (activeChannel.type !== 'assignment') return null;
    const assign = assignments.find(a => a.id === activeChannel.id);
    if (!assign) return null;
    return assign;
  }, [activeChannel, assignments]);

  // 4. 이모지 토글 액션
  const handleToggleReaction = async (commentId: string, emoji: string) => {
    try {
      const res = await api.toggleCommentReaction(serverMode, commentId, emoji);
      setAllComments(prev => prev.map(c => c.id === commentId ? { ...c, reactions: res.reactions } : c));
    } catch (err) {
      console.error('반응 추가 실패:', err);
    }
  };

  // 5. 음성 시뮬레이션 타이머 제어
  const startRecording = () => {
    setIsRecording(true);
    setRecordSeconds(0);
    recordInterval.current = setInterval(() => {
      setRecordSeconds(s => s + 1);
    }, 1000);
  };

  const stopRecordingAndSend = async () => {
    clearInterval(recordInterval.current);
    setIsRecording(false);
    const dur = recordSeconds > 0 ? recordSeconds : 3;
    const voiceMsg = `[Audio: ${dur}s]`;
    setSubmitting(true);
    try {
      const payload: any = {
        project_id: projectId,
        content: voiceMsg,
        parent_id: replyTarget?.id || null,
      };
      if (taskId) {
        payload.task_id = taskId;
        payload.context_type = 'task';
        payload.context_id = taskId;
      } else if (activeChannel.type === 'assignment') {
        payload.assignment_id = activeChannel.id;
        payload.context_type = 'assignment';
        payload.context_id = activeChannel.id;
      } else if (activeChannel.type === 'workload') {
        payload.workload_id = activeChannel.id;
        payload.context_type = 'assignment';
        payload.context_id = activeChannel.id;
      }
      const newComment = await api.createComment(serverMode, payload);
      setAllComments(prev => [newComment, ...prev]);
      setReplyTarget(null);
    } catch (err) {
      console.error('음성 코멘트 작성 실패:', err);
    } finally {
      setSubmitting(false);
    }
  };

  // 6. 첨부파일 목록 및 Mock 전송
  const mockFiles = [
    { name: '요구사항_정의서_v1.4.pdf', size: '1.8 MB' },
    { name: '메인화면_디자인시안_최종.fig', size: '24.2 MB' },
    { name: '주간_인력배분_시뮬레이션.xlsx', size: '650 KB' }
  ];

  const handleSendMockFile = async (name: string, size: string) => {
    setShowAttachMenu(false);
    setSubmitting(true);
    const content = `[File: ${name} (${size})]`;
    try {
      const payload: any = {
        project_id: projectId,
        content,
        parent_id: replyTarget?.id || null,
      };
      if (taskId) {
        payload.task_id = taskId;
        payload.context_type = 'task';
        payload.context_id = taskId;
      } else if (activeChannel.type === 'assignment') {
        payload.assignment_id = activeChannel.id;
        payload.context_type = 'assignment';
        payload.context_id = activeChannel.id;
      } else if (activeChannel.type === 'workload') {
        payload.workload_id = activeChannel.id;
        payload.context_type = 'assignment';
        payload.context_id = activeChannel.id;
      }
      const newComment = await api.createComment(serverMode, payload);
      setAllComments(prev => [newComment, ...prev]);
      setReplyTarget(null);
    } catch (err) {
      console.error('파일 코멘트 작성 실패:', err);
    } finally {
      setSubmitting(false);
    }
  };

  // 7. 일반 텍스트 전송
  const handleSubmit = async (textToSend?: string) => {
    const content = textToSend || input.trim();
    if (!content) return;
    setSubmitting(true);
    try {
      const payload: any = {
        project_id: projectId,
        content,
        parent_id: replyTarget?.id || null,
      };
      if (taskId) {
        payload.task_id = taskId;
        payload.context_type = 'task';
        payload.context_id = taskId;
      } else if (activeChannel.type === 'assignment') {
        payload.assignment_id = activeChannel.id;
        payload.context_type = 'assignment';
        payload.context_id = activeChannel.id;
      } else if (activeChannel.type === 'workload') {
        payload.workload_id = activeChannel.id;
        payload.context_type = 'assignment';
        payload.context_id = activeChannel.id;
      } else {
        payload.context_type = 'project';
        payload.context_id = projectId;
      }

      const newComment = await api.createComment(serverMode, payload);
      setAllComments(prev => [newComment, ...prev]);
      if (!textToSend) setInput('');
      setReplyTarget(null);
    } catch (err) {
      console.error('댓글 작성 실패:', err);
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (commentId: string) => {
    try {
      await api.deleteComment(serverMode, commentId);
      setAllComments(prev => prev.filter(c => c.id !== commentId));
    } catch (err) {
      console.error('댓글 삭제 실패:', err);
    }
  };

  const handleEdit = async (commentId: string, content: string) => {
    try {
      const updated = await api.updateComment(serverMode, commentId, content);
      setAllComments(prev => prev.map(c => c.id === commentId ? { ...c, content: updated.content, updated_at: updated.updated_at } : c));
    } catch (err) {
      console.error('댓글 수정 실패:', err);
    }
  };

  const handleReply = (parentId: string, parentAuthorName: string) => {
    setReplyTarget({ id: parentId, name: parentAuthorName });
    setTimeout(() => inputRef.current?.focus(), 100);
  };

  // 8. 오디오 플레이어 시뮬레이션 타이머
  const handleTogglePlayAudio = (commentId: string) => {
    if (playingAudioId === commentId) {
      clearInterval(audioIntervalRef.current);
      setPlayingAudioId(null);
      setAudioProgress(0);
      return;
    }

    clearInterval(audioIntervalRef.current);
    setPlayingAudioId(commentId);
    setAudioProgress(0);

    audioIntervalRef.current = setInterval(() => {
      setAudioProgress(prog => {
        if (prog >= 100) {
          clearInterval(audioIntervalRef.current);
          setPlayingAudioId(null);
          return 0;
        }
        return prog + 8;
      });
    }, 250);
  };

  // 9. 추천 퀵 리스폰스 문구 목록
  const quickResponses = useMemo(() => {
    if (taskId) {
      return ['작업 진행 중 특이사항 확인 바랍니다.', '피드백 완료되었습니다. ✅', '추가 보완 조치 예정입니다.'];
    }
    if (activeChannel.type === 'project') {
      return ['확인했습니다. 👍', '프로젝트 인력 배정 시안 검토 바랍니다.', '일정이 적합하게 수립되었습니다.'];
    }
    if (activeChannel.type === 'assignment') {
      return ['배정 비율 확인했습니다. ✅', '과부하 우려로 투입율 하향 조정 필요합니다.', '업무 조율 완료되었습니다.'];
    }
    return ['이 주차 작업량 적합합니다.', '일정 연기 혹은 자원 충원 필요합니다. ⏳', '체크 완료.'];
  }, [activeChannel, taskId]);

  // 채널 목록 필터링 (검색어 대응)
  const filteredAssignments = useMemo(() => {
    return assignments.filter(a =>
      a.user_name?.toLowerCase().includes(channelSearch.toLowerCase()) ||
      a.role?.toLowerCase().includes(channelSearch.toLowerCase())
    );
  }, [assignments, channelSearch]);

  const activeProject = useMemo(() => {
    return projects.find(p => p.id === projectId);
  }, [projects, projectId]);

  // 대시보드 3단 레이아웃 여부 판별 (Task 사이드바가 아닐 때만)
  const isDashboardMode = !taskId;

  return (
    <div className={`flex bg-slate-50 dark:bg-slate-950 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-md overflow-hidden select-none text-left w-full ${
      isDashboardMode ? 'h-[650px]' : 'h-full'
    }`}>
      
      {/* ────────────────────────────────────────────────────────
          좌측 1단 패널: 채널 / 채팅방 목록
          ──────────────────────────────────────────────────────── */}
      {isDashboardMode && (
        <div className="w-64 border-r border-slate-200 dark:border-slate-850 bg-white dark:bg-slate-900 flex flex-col shrink-0 animate-fade-in">
          
          {/* 프로젝트 변경 선택 dropdown */}
          <div className="p-3 border-b border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-850/20">
            <label className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-wider block mb-1">활성 프로젝트</label>
            <select
              value={projectId}
              onChange={e => {
                if (onProjectChange) onProjectChange(e.target.value);
              }}
              className="w-full text-xs font-bold px-2.5 py-2 bg-white dark:bg-slate-850 border border-slate-200 dark:border-slate-750 rounded-xl focus:outline-none focus:border-toss-blue transition-all cursor-pointer text-slate-800 dark:text-slate-100"
            >
              <option value="">-- 프로젝트 선택 --</option>
              {projects.map(p => (
                <option key={p.id} value={p.id}>{p.code ? `[${p.code}] ` : ''}{p.name}</option>
              ))}
            </select>
          </div>

          {/* 채널 검색 */}
          <div className="p-3 border-b border-slate-100 dark:border-slate-850">
            <input
              type="text"
              value={channelSearch}
              onChange={e => setChannelSearch(e.target.value)}
              placeholder="피드백 채널 검색..."
              className="w-full text-xs font-semibold px-3 py-2 bg-slate-50 dark:bg-slate-850 rounded-xl border border-slate-200 dark:border-slate-750 focus:outline-none focus:border-toss-blue transition-all"
            />
          </div>

          {/* 채널 리스트 */}
          <div className="flex-1 overflow-y-auto p-2 flex flex-col gap-4">
            
            {/* 그룹 1. 공식 채널 */}
            <div>
              <div className="text-[10px] font-black text-slate-400 dark:text-slate-500 px-2.5 py-1 uppercase tracking-wider">공식 채널</div>
              <div className="flex flex-col gap-0.5 mt-1">
                <button
                  onClick={() => setActiveChannel({ type: 'project', id: projectId, label: '🗂 프로젝트 전체 피드백' })}
                  disabled={!projectId}
                  className={`flex items-center gap-2 px-2.5 py-2 rounded-xl text-xs font-bold transition-all w-full text-left disabled:opacity-40 disabled:cursor-not-allowed ${
                    activeChannel.type === 'project'
                      ? 'bg-blue-50 dark:bg-blue-950/40 text-toss-blue'
                      : 'text-slate-650 hover:bg-slate-50 dark:text-slate-400 dark:hover:bg-slate-850'
                  }`}
                >
                  <Hash className="w-4 h-4" />
                  <span># 프로젝트 전체 피드백</span>
                </button>
              </div>
            </div>

            {/* 그룹 2. 팀원별 채널 */}
            {projectId && (
              <div>
                <div className="text-[10px] font-black text-slate-400 dark:text-slate-500 px-2.5 py-1 uppercase tracking-wider">팀원별 전용 채널</div>
                <div className="flex flex-col gap-0.5 mt-1">
                  {filteredAssignments.map(a => {
                    const isSelected = activeChannel.type === 'assignment' && activeChannel.id === a.id;
                    const userPalette = getAvatarPalette(a.user_name || '');
                    return (
                      <button
                        key={a.id}
                        onClick={() => setActiveChannel({ type: 'assignment', id: a.id, label: `👤 ${a.user_name} (${a.role})` })}
                        className={`flex items-center gap-2.5 px-2.5 py-2 rounded-xl text-xs font-bold transition-all text-left w-full ${
                          isSelected
                            ? 'bg-blue-50 dark:bg-blue-950/40 text-toss-blue'
                            : 'text-slate-650 hover:bg-slate-50 dark:text-slate-400 dark:hover:bg-slate-850'
                        }`}
                      >
                        <div className={`w-6 h-6 rounded-full flex items-center justify-center text-[9px] text-white font-extrabold ${userPalette.bg}`}>
                          {getInitials(a.user_name || '')}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between">
                            <span className="truncate">{a.user_name}</span>
                            <span className="text-[9px] text-slate-400 dark:text-slate-500 font-semibold">{a.role}</span>
                          </div>
                          <p className="text-[9px] text-slate-400 dark:text-slate-500 font-medium truncate mt-0.5">
                            배정 {a.allocation_percent}% · 피드백
                          </p>
                        </div>
                      </button>
                    );
                  })}
                  {filteredAssignments.length === 0 && (
                    <div className="text-[11px] text-slate-400 text-center py-4">검색 결과가 없습니다.</div>
                  )}
                </div>
              </div>
            )}

            {/* 그룹 3. 주차별 피드백 */}
            {projectId && activeWorkloadChannels.length > 0 && (
              <div>
                <div className="text-[10px] font-black text-slate-400 dark:text-slate-500 px-2.5 py-1 uppercase tracking-wider">주차별 특이사항 피드백</div>
                <div className="flex flex-col gap-0.5 mt-1">
                  {activeWorkloadChannels.map(wl => {
                    const label = `📅 ${wl.weekStart} 주차`;
                    const isSelected = activeChannel.type === 'workload' && activeChannel.id === wl.id;
                    
                    return (
                      <button
                        key={wl.id}
                        onClick={() => setActiveChannel({ type: 'workload', id: wl.id, label })}
                        className={`flex items-center gap-2 px-2.5 py-2 rounded-xl text-xs font-bold transition-all text-left w-full ${
                          isSelected
                            ? 'bg-blue-50 dark:bg-blue-950/40 text-toss-blue'
                            : 'text-slate-650 hover:bg-slate-50 dark:text-slate-400 dark:hover:bg-slate-850'
                        }`}
                      >
                        <Clock className="w-4 h-4 text-slate-400" />
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-xs font-semibold">{wl.weekStart} 주간</p>
                          <p className="text-[9px] text-slate-400 truncate">주간 투입 피드백 채널</p>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

          </div>
        </div>
      )}

      {/* ────────────────────────────────────────────────────────
          중앙 2단 패널: 채팅 및 대화 영역
          ──────────────────────────────────────────────────────── */}
      <div className="flex-1 flex flex-col min-w-0 bg-slate-50 dark:bg-slate-900 h-full relative">
        
        {/* 중앙 헤더 */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 dark:border-slate-850 bg-white dark:bg-slate-900 shrink-0">
          <div className="flex items-center gap-2">
            <MessageSquare className="w-4 h-4 text-toss-blue" />
            <span className="text-sm font-extrabold text-slate-850 dark:text-slate-100">
              {taskId ? `📋 태스크 피드백 스레드` : activeChannel.label}
            </span>
          </div>
          {onClose && (
            <button
              onClick={onClose}
              className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400 hover:text-slate-600 transition-colors cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>

        {/* 대화 목록 영역 */}
        <div
          ref={listRef}
          className="flex-1 overflow-y-auto px-6 py-4 flex flex-col gap-6 scroll-smooth"
        >
          {!projectId ? (
            <div className="flex flex-col items-center justify-center py-24 text-slate-450 dark:text-slate-500 select-none gap-3">
              <div className="w-16 h-16 rounded-3xl bg-blue-50 dark:bg-slate-850 flex items-center justify-center text-toss-blue shadow-inner">
                <Hash className="w-8 h-8" />
              </div>
              <p className="text-sm font-black text-slate-700 dark:text-slate-350">활성 프로젝트가 선택되지 않았습니다.</p>
              <p className="text-xs text-slate-400 dark:text-slate-500 max-w-sm text-center leading-relaxed">
                좌측 상단의 활성 프로젝트 드롭다운을 통해 프로젝트를 선택하면 실시간 업무 소통 피드백 채널들이 로드됩니다.
              </p>
            </div>
          ) : loading ? (
            <div className="flex flex-col items-center justify-center py-20 text-slate-400">
              <div className="w-6 h-6 border-2 border-slate-200 border-t-toss-blue rounded-full animate-spin mb-2" />
              <p className="text-xs">피드백 데이터를 동기화하는 중...</p>
            </div>
          ) : filteredCommentsFlat.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 text-slate-400 select-none gap-2.5">
              <div className="w-12 h-12 rounded-2xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-400">
                <MessageSquare className="w-6 h-6 opacity-30" />
              </div>
              <p className="text-xs font-bold text-slate-500">본 채널에 등록된 피드백 코멘트가 없습니다.</p>
              <p className="text-[10px] text-slate-400">아래 입력 필드를 통해 전문적인 실시간 피드백을 전달해보세요.</p>
            </div>
          ) : (
            filteredCommentsFlat.map(comment => {
              const parentComment = comment.parent_id ? allComments.find(c => c.id === comment.parent_id) : null;
              return (
                <CommentCard
                  key={comment.id}
                  comment={comment}
                  isOwn={comment.user_id === currentUser?.id}
                  isAdmin={currentUser?.role === 'admin'}
                  currentUserId={currentUser?.id}
                  parentComment={parentComment}
                  onDelete={handleDelete}
                  onEdit={handleEdit}
                  onReply={handleReply}
                  onReact={handleToggleReaction}
                  playingAudioId={playingAudioId}
                  audioProgress={audioProgress}
                  onTogglePlayAudio={handleTogglePlayAudio}
                />
              );
            })
          )}
        </div>

        {/* 하단 입력 & 액션 영역 */}
        {projectId && (
          <div className="border-t border-slate-200 dark:border-slate-850 bg-white dark:bg-slate-900 p-4 flex flex-col gap-3 shrink-0">
            
            {/* 1. 추천 퀵 리스폰스 칩스 */}
            <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-thin">
              {quickResponses.map((res, i) => (
                <button
                  key={i}
                  type="button"
                  onClick={() => handleSubmit(res)}
                  className="px-3 py-1 bg-slate-50 hover:bg-slate-100 dark:bg-slate-800 dark:hover:bg-slate-750 text-slate-650 dark:text-slate-300 rounded-full border border-slate-200 dark:border-slate-750 text-[11px] font-bold cursor-pointer transition-all whitespace-nowrap active:scale-95 hover:border-toss-blue/30 hover:text-toss-blue"
                >
                  {res}
                </button>
              ))}
            </div>

            {/* 2. 답글 타겟 배너 */}
            {replyTarget && (
              <div className="flex items-center justify-between bg-blue-50/50 dark:bg-blue-950/20 px-3 py-1.5 rounded-lg border border-blue-100/40 text-xs">
                <span className="text-toss-blue font-bold">
                  @{replyTarget.name}님에게 남기는 답글
                </span>
                <button
                  onClick={() => setReplyTarget(null)}
                  className="text-slate-400 hover:text-slate-650 cursor-pointer"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            )}

            {/* 3. 메인 인풋 필드 */}
            <div className="flex gap-3 items-end">
              
              {/* 첨부파일 클립 */}
              <div className="relative">
                <button
                  type="button"
                  onClick={() => setShowAttachMenu(v => !v)}
                  className={`p-2 rounded-xl border flex items-center justify-center transition-colors cursor-pointer ${
                    showAttachMenu
                      ? 'border-toss-blue bg-blue-50 text-toss-blue'
                      : 'border-slate-200 dark:border-slate-750 hover:bg-slate-50 text-slate-400'
                  }`}
                  title="파일 피드백 첨부"
                >
                  <Paperclip className="w-4 h-4" />
                </button>

                {showAttachMenu && (
                  <div className="absolute bottom-full left-0 mb-2 w-56 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl shadow-xl p-2 z-50 animate-fade-in flex flex-col gap-1">
                    <p className="text-[10px] font-black text-slate-400 uppercase p-1.5 border-b border-slate-100 dark:border-slate-700">시뮬레이션 피드백 문서</p>
                    {mockFiles.map((f, i) => (
                      <button
                        key={i}
                        onClick={() => handleSendMockFile(f.name, f.size)}
                        className="text-left w-full px-2 py-1.5 hover:bg-slate-50 dark:hover:bg-slate-750 rounded-lg text-xs font-bold text-slate-700 dark:text-slate-200 flex items-center gap-2 cursor-pointer transition-colors"
                      >
                        <FileText className="w-3.5 h-3.5 text-toss-blue shrink-0" />
                        <div className="min-w-0 flex-1">
                          <p className="truncate">{f.name}</p>
                          <p className="text-[9px] text-slate-400">{f.size}</p>
                        </div>
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* 메인 텍스트 입력창 */}
              <div className="flex-1 relative">
                {isRecording ? (
                  /* 음성 녹음 중 바 */
                  <div className="w-full flex items-center justify-between border border-red-200 bg-red-50/50 dark:border-red-900/30 dark:bg-red-950/10 rounded-2xl px-4 py-2.5 min-h-[50px]">
                    <div className="flex items-center gap-2 text-xs font-bold text-red-500">
                      <span className="w-2.5 h-2.5 rounded-full bg-red-500 animate-pulse inline-block" />
                      <span>🎙️ 피드백 음성 녹음 중... ({recordSeconds}초)</span>
                    </div>
                    <button
                      onClick={stopRecordingAndSend}
                      className="px-3 py-1 bg-red-500 hover:bg-red-600 text-white rounded-lg text-xs font-bold cursor-pointer flex items-center gap-1 shadow-sm"
                    >
                      전송 및 완료
                    </button>
                  </div>
                ) : (
                  /* 텍스트 입력창 */
                  <textarea
                    ref={inputRef}
                    value={input}
                    onChange={e => setInput(e.target.value)}
                    onKeyDown={e => {
                      if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
                        e.preventDefault();
                        handleSubmit();
                      }
                    }}
                    placeholder={replyTarget ? `${replyTarget.name}님에게 답글 작성...` : '업무 조율 피드백을 기록하세요...'}
                    rows={2}
                    className="w-full resize-none text-[13px] px-3.5 py-2.5 pr-12 border border-slate-200 dark:border-slate-750 rounded-2xl focus:outline-none focus:ring-2 focus:ring-toss-blue/10 focus:border-toss-blue bg-slate-50 dark:bg-slate-850 text-slate-800 dark:text-slate-100 placeholder-slate-400 dark:placeholder-slate-500 transition-all leading-relaxed"
                    style={{ minHeight: '44px', maxHeight: '120px' }}
                  />
                )}

                {!isRecording && (
                  <button
                    type="button"
                    onClick={startRecording}
                    className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-red-500 transition-colors p-1 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-750 cursor-pointer"
                    title="음성 녹음 피드백"
                  >
                    <Mic className="w-4 h-4" />
                  </button>
                )}
              </div>

              {/* 전송 버튼 */}
              {!isRecording && (
                <button
                  onClick={() => handleSubmit()}
                  disabled={submitting || !input.trim()}
                  className="w-10 h-10 rounded-2xl bg-toss-blue text-white flex items-center justify-center hover:bg-blue-600 disabled:opacity-30 disabled:cursor-not-allowed transition-all active:scale-95 cursor-pointer shadow-sm shrink-0"
                >
                  <Send className="w-4 h-4" />
                </button>
              )}

            </div>

            <div className="flex justify-between text-[10px] text-slate-400 dark:text-slate-500 select-none">
              <span>Ctrl+Enter로 빠르게 피드백 제출</span>
              <span>🎙️ 마이크를 눌러 음성 메시지를 시뮬레이션 하세요</span>
            </div>

          </div>
        )}

      </div>

      {/* ────────────────────────────────────────────────────────
          우측 3단 패널: 채널 정보 / 인스펙터
          ──────────────────────────────────────────────────────── */}
      {isDashboardMode && (
        <div className="w-64 border-l border-slate-200 dark:border-slate-850 bg-white dark:bg-slate-900 flex flex-col shrink-0 overflow-y-auto p-4 select-none animate-fade-in">
          
          {activeChannel.type === 'assignment' && activeUserMeta ? (
            /* A. 인력 상세 인스펙터 */
            <div className="flex flex-col gap-5">
              {/* 프로필 헤더 */}
              <div className="flex flex-col items-center text-center pb-4 border-b border-slate-150 dark:border-slate-800">
                <div className={`w-16 h-16 rounded-3xl ${getAvatarPalette(activeUserMeta.user_name || '').bg} flex items-center justify-center text-white text-2xl font-black shadow-md mb-3`}>
                  {getInitials(activeUserMeta.user_name || '')}
                </div>
                <h2 className="text-sm font-extrabold text-slate-850 dark:text-slate-100">{activeUserMeta.user_name}</h2>
                <p className="text-[10px] bg-sky-500/10 text-toss-blue px-2 py-0.5 rounded-full font-bold mt-1.5 border border-sky-500/10">
                  {activeUserMeta.role}
                </p>
                <p className="text-[11px] text-slate-400 dark:text-slate-500 mt-1 truncate max-w-full">{activeUserMeta.user_email || '이메일 없음'}</p>
              </div>

              {/* 핵심 지표 */}
              <div>
                <h3 className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-wider mb-2">투입 성과 분석</h3>
                <div className="grid grid-cols-2 gap-2">
                  <div className="bg-slate-50 dark:bg-slate-850 p-2.5 rounded-xl border border-slate-150 dark:border-slate-800 text-left">
                    <p className="text-[9px] font-bold text-slate-455 dark:text-slate-500">배정 비율</p>
                    <p className="text-xs font-black text-slate-850 dark:text-slate-150 mt-1">{activeUserMeta.allocation_percent}%</p>
                  </div>
                  <div className="bg-slate-50 dark:bg-slate-850 p-2.5 rounded-xl border border-slate-150 dark:border-slate-800 text-left">
                    <p className="text-[9px] font-bold text-slate-455 dark:text-slate-500">피드백 수</p>
                    <p className="text-xs font-black text-slate-850 dark:text-slate-150 mt-1">
                      {allComments.filter(c => c.assignment_id === activeChannel.id).length}개
                    </p>
                  </div>
                </div>
              </div>

              {/* 미니 주간 워크로드 차트 */}
              <div>
                <h3 className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-wider mb-2">
                  주간 투입 흐름 (실시간)
                </h3>
                <div className="flex flex-col gap-1.5 bg-slate-50 dark:bg-slate-850 p-3 rounded-xl border border-slate-150 dark:border-slate-800">
                  <p className="text-[9px] text-slate-455 dark:text-slate-500 font-bold mb-1">최근 주간 배정 현황</p>
                  <div className="flex items-center gap-1.5 justify-around">
                    {(() => {
                      const userWls = workloads
                        .filter(w => w.user_id === activeUserMeta.user_id)
                        .sort((a, b) => a.week_start.localeCompare(b.week_start))
                        .slice(0, 4);

                      if (userWls.length === 0) {
                        return <span className="text-[9px] text-slate-400 py-2">워크로드가 생성되지 않음</span>;
                      }

                      return userWls.map((w, idx) => {
                        const ratio = w.work_ratio;
                        const isOver = w.is_overloaded || (w.total_ratio && w.total_ratio > 100);
                        
                        let barColor = 'bg-emerald-400';
                        if (isOver) barColor = 'bg-red-500';
                        else if (ratio > 80) barColor = 'bg-amber-400';
                        else if (ratio > 50) barColor = 'bg-toss-blue';

                        const displayWeek = w.week_start.slice(5); // Show MM-DD

                        return (
                          <div key={idx} className="flex flex-col items-center gap-1">
                            <span className="text-[8px] text-slate-400 font-bold">{displayWeek}</span>
                            <div className="w-5 h-8 bg-slate-200 dark:bg-slate-700 rounded-md relative overflow-hidden flex items-end">
                              <div className={`w-full ${barColor}`} style={{ height: `${Math.min(ratio, 100)}%` }} />
                            </div>
                            <span className="text-[8px] text-slate-500 font-black">{ratio}%</span>
                          </div>
                        );
                      });
                    })()}
                  </div>
                </div>
              </div>

              {/* 공유된 파일 / 문서 아카이브 (Convo 스타일) */}
              {fileArchive.length > 0 && (
                <div>
                  <h3 className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-wider mb-2 flex items-center justify-between">
                    <span>공유된 파일 목록 ({fileArchive.length})</span>
                  </h3>
                  <div className="flex flex-col gap-1.5 max-h-36 overflow-y-auto">
                    {fileArchive.map((f, i) => (
                      <div key={i} className="flex items-center gap-2 p-1.5 bg-slate-50 dark:bg-slate-850 rounded-lg border border-slate-150 dark:border-slate-800 text-[11px] font-bold">
                        <FileText className="w-3.5 h-3.5 text-amber-500 shrink-0" />
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-slate-750 dark:text-slate-200">{f.name}</p>
                          <p className="text-[8px] text-slate-400 font-medium">by {f.author} ({f.dept} · {f.pos})</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* 공유된 링크 아카이브 */}
              {linkArchive.length > 0 && (
                <div>
                  <h3 className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-wider mb-2">공유된 링크 ({linkArchive.length})</h3>
                  <div className="flex flex-col gap-1.5 max-h-36 overflow-y-auto">
                    {linkArchive.map((l, i) => (
                      <a
                        key={i}
                        href={l.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-2 p-1.5 bg-slate-50 hover:bg-slate-100 dark:bg-slate-850 dark:hover:bg-slate-800 rounded-lg border border-slate-150 dark:border-slate-800 text-[11px] font-bold text-toss-blue text-left transition-colors cursor-pointer"
                      >
                        <Link className="w-3 h-3 shrink-0" />
                        <div className="min-w-0 flex-1">
                          <p className="truncate">{l.url}</p>
                          <p className="text-[8px] text-slate-400 font-medium">by {l.author} ({l.dept} · {l.pos})</p>
                        </div>
                      </a>
                    ))}
                  </div>
                </div>
              )}

            </div>
          ) : (
            /* B. 프로젝트 전체 정보 인스펙터 */
            <div className="flex flex-col gap-5">
              <div className="flex flex-col items-center text-center pb-4 border-b border-slate-150 dark:border-slate-800">
                <div className="w-16 h-16 rounded-3xl bg-toss-blue/10 flex items-center justify-center text-toss-blue mb-3">
                  <Hash className="w-8 h-8" />
                </div>
                <h2 className="text-sm font-extrabold text-slate-850 dark:text-slate-100">프로젝트 종합 피드백</h2>
                <p className="text-[10px] text-slate-450 dark:text-slate-500 font-bold mt-1.5 truncate max-w-full">
                  {activeProject?.name || '공용 관리 채널'}
                </p>
              </div>

              <div>
                <h3 className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-wider mb-2">프로젝트 누적 배정</h3>
                <div className="bg-slate-50 dark:bg-slate-850 p-3 rounded-xl border border-slate-150 dark:border-slate-800 text-left flex flex-col gap-2">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-slate-500 font-bold">배정 인력</span>
                    <span className="text-slate-800 dark:text-slate-200 font-extrabold">{assignments.length}명</span>
                  </div>
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-slate-500 font-bold">누적 코멘트</span>
                    <span className="text-slate-800 dark:text-slate-200 font-extrabold">{allComments.length}개</span>
                  </div>
                </div>
              </div>

              {/* 공유된 파일 / 문서 아카이브 (프로젝트 전체) */}
              {fileArchive.length > 0 && (
                <div>
                  <h3 className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-wider mb-2">공유된 파일 목록 ({fileArchive.length})</h3>
                  <div className="flex flex-col gap-1.5 max-h-48 overflow-y-auto">
                    {fileArchive.map((f, i) => (
                      <div key={i} className="flex items-center gap-2 p-1.5 bg-slate-50 dark:bg-slate-850 rounded-lg border border-slate-150 dark:border-slate-800 text-[11px] font-bold">
                        <FileText className="w-3.5 h-3.5 text-amber-500 shrink-0" />
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-slate-750 dark:text-slate-200">{f.name}</p>
                          <p className="text-[8px] text-slate-400 font-medium">by {f.author} ({f.dept} · {f.pos})</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* 공유된 링크 아카이브 (프로젝트 전체) */}
              {linkArchive.length > 0 && (
                <div>
                  <h3 className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-wider mb-2">공유된 링크 ({linkArchive.length})</h3>
                  <div className="flex flex-col gap-1.5 max-h-48 overflow-y-auto">
                    {linkArchive.map((l, i) => (
                      <a
                        key={i}
                        href={l.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-2 p-1.5 bg-slate-50 hover:bg-slate-100 dark:bg-slate-850 dark:hover:bg-slate-800 rounded-lg border border-slate-150 dark:border-slate-800 text-[11px] font-bold text-toss-blue text-left transition-colors cursor-pointer"
                      >
                        <Link className="w-3 h-3 shrink-0" />
                        <div className="min-w-0 flex-1">
                          <p className="truncate">{l.url}</p>
                          <p className="text-[8px] text-slate-400 font-medium">by {l.author} ({l.dept} · {l.pos})</p>
                        </div>
                      </a>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

        </div>
      )}

    </div>
  );
};
