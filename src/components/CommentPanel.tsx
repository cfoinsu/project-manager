import React, { useState, useEffect, useRef, useCallback } from 'react';
import * as api from '../utils/api';
import { useAuthStore } from '../store/authStore';
import type { Comment, Workload, Assignment } from '../types';
import { MessageSquare, Send, Trash2, X, Reply, Pencil, Check, ChevronDown, ChevronUp } from 'lucide-react';

interface CommentPanelProps {
  projectId: string;
  selectedWorkload?: Workload | null;
  selectedAssignment?: Assignment | null;
  taskId?: string | null;  // 작업 댓글일 때 실제 task.id 전달
  onClose?: () => void;
}

function timeAgo(dateStr: string): string {
  const now = new Date();
  const d = new Date(dateStr.replace(' ', 'T'));
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
  { bg: 'bg-blue-500', ring: 'ring-blue-200' },
  { bg: 'bg-violet-500', ring: 'ring-violet-200' },
  { bg: 'bg-emerald-500', ring: 'ring-emerald-200' },
  { bg: 'bg-amber-500', ring: 'ring-amber-200' },
  { bg: 'bg-pink-500', ring: 'ring-pink-200' },
  { bg: 'bg-indigo-500', ring: 'ring-indigo-200' },
  { bg: 'bg-teal-500', ring: 'ring-teal-200' },
  { bg: 'bg-rose-500', ring: 'ring-rose-200' },
];

function getAvatarPalette(name: string) {
  const idx = (name?.charCodeAt(0) || 0) % AVATAR_PALETTE.length;
  return AVATAR_PALETTE[idx];
}

// 직원 정보 뱃지 (부서·직급·역할)
function AuthorMeta({ department, position, jobRole }: { department?: string | null; position?: string | null; jobRole?: string | null }) {
  const tags = [department, position, jobRole].filter(Boolean);
  if (!tags.length) return null;
  return (
    <span className="flex items-center gap-1 flex-wrap">
      {tags.map((t, i) => (
        <span
          key={i}
          className="px-1.5 py-0.5 bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 text-[10px] font-semibold rounded-md border border-slate-200/60 dark:border-slate-700/60"
        >
          {t}
        </span>
      ))}
    </span>
  );
}

// ─── 단일 댓글 카드 ─────────────────────────────────────────────
interface CommentCardProps {
  comment: Comment;
  isOwn: boolean;
  isAdmin: boolean;
  currentUserId?: string;
  depth?: number;
  onDelete: (id: string) => void;
  onEdit: (id: string, content: string) => Promise<void>;
  onReply: (parentId: string, parentAuthorName: string) => void;
}

const CommentCard: React.FC<CommentCardProps> = ({
  comment,
  isOwn,
  isAdmin,
  currentUserId,
  depth = 0,
  onDelete,
  onEdit,
  onReply,
}) => {
  const [editing, setEditing] = useState(false);
  const [editValue, setEditValue] = useState(comment.content);
  const [savingEdit, setSavingEdit] = useState(false);
  const [showReplies, setShowReplies] = useState(true);
  const editRef = useRef<HTMLTextAreaElement>(null);
  const palette = getAvatarPalette(comment.author_name || '');

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

  const isReply = depth > 0;
  const replyCount = comment.replies?.length || 0;
  // 본인 댓글은 오른쪽 정렬 (답글 제외)
  const alignRight = isOwn && !isReply;

  return (
    <div className={`${isReply ? 'ml-10 mt-2' : ''}`}>
      {/* 답글 구분선 */}
      {isReply && (
        <div className="flex items-center gap-2 mb-2">
          <div className="w-6 h-px bg-slate-200 dark:bg-slate-700" />
          <Reply className="w-3 h-3 text-slate-400 dark:text-slate-500" />
        </div>
      )}

      <div className={`flex gap-3 group animate-fade-in ${alignRight ? 'flex-row-reverse' : ''}`}>
        {/* 아바타 */}
        <div className="shrink-0">
          <div
            className={`${isReply ? 'w-7 h-7 text-[10px]' : 'w-9 h-9 text-xs'} rounded-full ${palette.bg} ring-2 ${palette.ring} flex items-center justify-center text-white font-bold`}
          >
            {getInitials(comment.author_name || '?')}
          </div>
        </div>

        {/* 말풍선 */}
        <div className={`flex-1 min-w-0 flex flex-col ${alignRight ? 'items-end' : 'items-start'}`}>
          {/* 메타: 이름 + 부서/직급/역할 + 시간 */}
          <div className={`flex flex-wrap items-center gap-1.5 mb-1.5 ${alignRight ? 'flex-row-reverse' : ''}`}>
            <span className="text-[13px] font-extrabold text-slate-800 dark:text-slate-100">
              {comment.author_name || '알 수 없음'}
              {isOwn && <span className="ml-1 text-[10px] font-bold text-toss-blue">(나)</span>}
            </span>
            <AuthorMeta
              department={comment.author_department}
              position={comment.author_position}
              jobRole={comment.author_job_role}
            />
            <span className="text-[11px] text-slate-400 dark:text-slate-500">
              {timeAgo(comment.created_at)}
              {comment.updated_at && <span className="ml-1 opacity-70">(수정됨)</span>}
            </span>
          </div>

          {/* 본문 */}
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
                className="w-full resize-none text-[13px] px-3 py-2 border border-toss-blue rounded-xl focus:outline-none focus:ring-2 focus:ring-toss-blue/30 dark:bg-slate-800 dark:text-slate-100 dark:border-toss-blue/60 transition-all"
              />
              <div className="flex gap-2 mt-1.5 justify-end">
                <button
                  onClick={() => { setEditing(false); setEditValue(comment.content); }}
                  className="px-3 py-1 text-xs font-bold rounded-lg bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-600 transition-colors cursor-pointer"
                >
                  취소
                </button>
                <button
                  onClick={handleSaveEdit}
                  disabled={savingEdit}
                  className="px-3 py-1 text-xs font-bold rounded-lg bg-toss-blue text-white hover:bg-blue-600 disabled:opacity-40 transition-colors cursor-pointer flex items-center gap-1"
                >
                  {savingEdit ? (
                    <div className="w-3 h-3 border-2 border-white/40 border-t-white rounded-full animate-spin" />
                  ) : (
                    <Check className="w-3 h-3" />
                  )}
                  저장
                </button>
              </div>
            </div>
          ) : (
            <div
              className={`relative max-w-[88%] px-4 py-2.5 rounded-2xl text-[13px] leading-relaxed break-words shadow-sm border ${
                alignRight
                  ? 'bg-toss-blue text-white rounded-tr-sm border-toss-blue/20'
                  : 'bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-slate-200 rounded-tl-sm border-slate-100 dark:border-slate-700/60'
              }`}
            >
              {comment.content}
            </div>
          )}

          {/* 액션 버튼 */}
          {!editing && (
            <div className={`flex items-center gap-1 mt-1.5 opacity-0 group-hover:opacity-100 transition-opacity ${alignRight ? 'flex-row-reverse' : ''}`}>
              {depth === 0 && (
                <button
                  onClick={() => onReply(comment.id, comment.author_name || '알 수 없음')}
                  className="flex items-center gap-1 px-2 py-1 rounded-lg text-[11px] font-bold text-slate-400 hover:text-toss-blue hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-colors cursor-pointer"
                >
                  <Reply className="w-3 h-3" />
                  답글
                </button>
              )}
              {isOwn && (
                <button
                  onClick={() => setEditing(true)}
                  className="flex items-center gap-1 px-2 py-1 rounded-lg text-[11px] font-bold text-slate-400 hover:text-amber-500 hover:bg-amber-50 dark:hover:bg-amber-900/20 transition-colors cursor-pointer"
                >
                  <Pencil className="w-3 h-3" />
                  수정
                </button>
              )}
              {(isOwn || isAdmin) && (
                <button
                  onClick={() => onDelete(comment.id)}
                  className="flex items-center gap-1 px-2 py-1 rounded-lg text-[11px] font-bold text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors cursor-pointer"
                >
                  <Trash2 className="w-3 h-3" />
                  삭제
                </button>
              )}
            </div>
          )}
        </div>
      </div>

      {/* 답글 목록 */}
      {replyCount > 0 && (
        <div className="ml-12 mt-1">
          <button
            onClick={() => setShowReplies(v => !v)}
            className="flex items-center gap-1 text-[11px] font-bold text-toss-blue hover:underline cursor-pointer mb-1.5"
          >
            {showReplies ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
            답글 {replyCount}개
          </button>
          {showReplies && (
            <div className="flex flex-col gap-3">
              {comment.replies!.map(reply => (
                <CommentCard
                  key={reply.id}
                  comment={reply}
                  isOwn={reply.user_id === currentUserId}
                  isAdmin={isAdmin}
                  currentUserId={currentUserId}
                  depth={1}
                  onDelete={onDelete}
                  onEdit={onEdit}
                  onReply={onReply}
                />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

// ─── 메인 CommentPanel ────────────────────────────────────────
export const CommentPanel: React.FC<CommentPanelProps> = ({
  projectId,
  selectedWorkload,
  selectedAssignment,
  taskId,
  onClose,
}) => {
  const { user: currentUser, serverMode } = useAuthStore();

  const [comments, setComments] = useState<Comment[]>([]);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [input, setInput] = useState('');
  const [replyTarget, setReplyTarget] = useState<{ id: string; name: string } | null>(null);

  const inputRef = useRef<HTMLTextAreaElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  const contextLabel = selectedWorkload
    ? `📅 ${selectedWorkload.week_start} 주간 워크로드`
    : selectedAssignment
    ? `👤 ${selectedAssignment.user_name} (${selectedAssignment.role})`
    : `🗂 프로젝트 전체`;

  const flattenTree = (tree: Comment[]): Comment[] => {
    const result: Comment[] = [];
    tree.forEach(c => {
      result.push({ ...c, replies: undefined });
      if (c.replies?.length) result.push(...flattenTree(c.replies));
    });
    return result;
  };

  const buildTree = useCallback((flat: Comment[]): Comment[] => {
    const roots: Comment[] = [];
    const map = new Map<string, Comment>();
    flat.forEach(c => map.set(c.id, { ...c, replies: [] }));
    map.forEach(c => {
      if (c.parent_id) {
        const parent = map.get(c.parent_id);
        if (parent) {
          parent.replies = parent.replies || [];
          parent.replies.push(c);
        } else {
          roots.push(c);
        }
      } else {
        roots.push(c);
      }
    });
    roots.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
    roots.forEach(r => r.replies?.sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()));
    return roots;
  }, []);

  const fetchComments = useCallback(async () => {
    setLoading(true);
    try {
      const params: any = { project_id: projectId };
      if (selectedWorkload) params.workload_id = selectedWorkload.id;
      else if (selectedAssignment) params.assignment_id = selectedAssignment.id;
      const data = await api.getComments(serverMode, params);
      setComments(buildTree(data));
    } catch (err) {
      console.error('댓글 로드 실패:', err);
    } finally {
      setLoading(false);
    }
  }, [projectId, selectedWorkload, selectedAssignment, serverMode, buildTree]);

  useEffect(() => {
    fetchComments();
    inputRef.current?.focus();
  }, [fetchComments]);

  const totalCount = comments.reduce((acc, c) => acc + 1 + (c.replies?.length || 0), 0);

  const handleSubmit = async () => {
    if (!input.trim()) return;
    setSubmitting(true);
    try {
      // context 판별
      let context_type: 'project' | 'task' | 'assignment' = 'project';
      let context_id: string = projectId;
      const payload: any = {
        project_id: projectId,
        content: input.trim(),
        parent_id: replyTarget?.id || null,
      };
      if (taskId) {
        // 작업 댓글 — task_id 정상 저장
        context_type = 'task';
        context_id = taskId;
        payload.task_id = taskId;
        payload.assignment_id = `task_${taskId}`; // 하위호환용
      } else if (selectedWorkload) {
        payload.workload_id = selectedWorkload.id;
        context_type = 'assignment';
        context_id = selectedWorkload.id;
      } else if (selectedAssignment) {
        payload.assignment_id = selectedAssignment.id;
        context_type = 'assignment';
        context_id = selectedAssignment.id;
      }
      payload.context_type = context_type;
      payload.context_id = context_id;

      const newComment = await api.createComment(serverMode, payload);
      setComments(prev => buildTree([...flattenTree(prev), newComment]));
      setInput('');
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
      setComments(prev => buildTree(flattenTree(prev).filter(c => c.id !== commentId)));
    } catch (err) {
      console.error('댓글 삭제 실패:', err);
    }
  };

  const handleEdit = async (commentId: string, content: string) => {
    const updated = await api.updateComment(serverMode, commentId, content);
    setComments(prev => buildTree(flattenTree(prev).map(c => c.id === commentId ? { ...c, ...updated } : c)));
  };

  const handleReply = (parentId: string, parentAuthorName: string) => {
    setReplyTarget({ id: parentId, name: parentAuthorName });
    setTimeout(() => inputRef.current?.focus(), 100);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) handleSubmit();
  };

  const palette = getAvatarPalette(currentUser?.name || '');

  return (
    <div className="flex flex-col h-full bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-700/60 shadow-sm overflow-hidden">

      {/* ── 헤더 ── */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100 dark:border-slate-800 shrink-0">
        <div className="flex items-center gap-2">
          <MessageSquare className="w-4 h-4 text-toss-blue" />
          <span className="text-sm font-extrabold text-slate-800 dark:text-slate-100">댓글 및 답글</span>
          {totalCount > 0 && (
            <span className="px-2 py-0.5 bg-toss-blue text-white text-[10px] font-bold rounded-full">
              {totalCount}
            </span>
          )}
        </div>
        {onClose && (
          <button onClick={onClose} className="p-1 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer">
            <X className="w-4 h-4 text-slate-400" />
          </button>
        )}
      </div>

      {/* ── 컨텍스트 라벨 ── */}
      <div className="px-4 py-2 border-b border-slate-50 dark:border-slate-800/60 bg-slate-50 dark:bg-slate-800/30 shrink-0">
        <span className="text-xs text-slate-500 dark:text-slate-400 font-medium">{contextLabel}</span>
      </div>

      {/* ── 댓글 목록 ── */}
      <div
        ref={listRef}
        className="flex-1 overflow-y-auto px-4 py-4 flex flex-col gap-5 min-h-0"
        style={{ scrollBehavior: 'smooth' }}
      >
        {loading ? (
          <div className="flex items-center justify-center py-12 text-slate-400">
            <div className="w-5 h-5 border-2 border-slate-200 border-t-toss-blue rounded-full animate-spin" />
          </div>
        ) : comments.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-slate-400 select-none gap-2">
            <MessageSquare className="w-10 h-10 opacity-20" />
            <p className="text-xs font-semibold">첫 댓글을 남겨보세요.</p>
          </div>
        ) : (
          comments.map(comment => (
            <CommentCard
              key={comment.id}
              comment={comment}
              isOwn={comment.user_id === currentUser?.id}
              isAdmin={currentUser?.role === 'admin'}
              currentUserId={currentUser?.id}
              depth={0}
              onDelete={handleDelete}
              onEdit={handleEdit}
              onReply={handleReply}
            />
          ))
        )}
      </div>

      {/* ── 입력 영역 ── */}
      <div className="border-t border-slate-100 dark:border-slate-800 shrink-0 bg-white dark:bg-slate-900">

        {/* 답글 대상 배너 */}
        {replyTarget && (
          <div className="flex items-center justify-between px-4 pt-2.5 pb-0">
            <div className="flex items-center gap-1.5 text-[12px] text-toss-blue font-bold">
              <Reply className="w-3.5 h-3.5" />
              <span>{replyTarget.name}에게 답글 달기</span>
            </div>
            <button
              onClick={() => { setReplyTarget(null); setInput(''); }}
              className="p-0.5 rounded hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400 cursor-pointer"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        )}

        <div className="flex gap-3 items-end px-4 py-3">
          {/* 현재 사용자 아바타 */}
          <div className="shrink-0 mb-0.5">
            <div
              className={`w-8 h-8 rounded-full ${palette.bg} ring-2 ${palette.ring} flex items-center justify-center text-white text-[11px] font-bold`}
            >
              {getInitials(currentUser?.name || '?')}
            </div>
          </div>

          {/* 입력창 */}
          <div className="flex-1">
            {/* 현재 사용자 메타 */}
            {currentUser && (
              <div className="flex items-center gap-1 mb-1.5 flex-wrap">
                <span className="text-[12px] font-extrabold text-slate-700 dark:text-slate-200">{currentUser.name}</span>
                {([currentUser.department, currentUser.position, currentUser.job_role] as (string | null | undefined)[])
                  .filter((t): t is string => !!t)
                  .map((t, i) => (
                    <span
                      key={i}
                      className="px-1.5 py-0.5 bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 text-[10px] font-semibold rounded-md border border-slate-200/60 dark:border-slate-700/60"
                    >
                      {t}
                    </span>
                  ))}
              </div>
            )}
            <div className="relative">
              <textarea
                ref={inputRef}
                value={input}
                onChange={e => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder={replyTarget ? `${replyTarget.name}에게 답글 달기...` : '댓글을 남겨보세요...'}
                rows={2}
                className="w-full resize-none text-[13px] px-3.5 py-2.5 pr-12 border border-slate-200 dark:border-slate-700 rounded-2xl focus:outline-none focus:ring-2 focus:ring-toss-blue/30 focus:border-toss-blue dark:focus:border-toss-blue/70 bg-slate-50 dark:bg-slate-800 text-slate-800 dark:text-slate-100 placeholder-slate-300 dark:placeholder-slate-600 transition-all leading-relaxed"
                style={{ minHeight: '60px', maxHeight: '140px' }}
              />
              <button
                onClick={handleSubmit}
                disabled={submitting || !input.trim()}
                className="absolute bottom-2 right-2 w-8 h-8 rounded-xl bg-toss-blue text-white flex items-center justify-center hover:bg-blue-600 disabled:opacity-30 disabled:cursor-not-allowed transition-all active:scale-90 cursor-pointer shadow-sm"
              >
                {submitting ? (
                  <div className="w-3.5 h-3.5 border-2 border-white/40 border-t-white rounded-full animate-spin" />
                ) : (
                  <Send className="w-3.5 h-3.5" />
                )}
              </button>
            </div>
            <p className="text-[11px] text-slate-400 dark:text-slate-500 mt-1">
              Ctrl+Enter로 전송 &nbsp;·&nbsp; Esc로 수정 취소
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};
