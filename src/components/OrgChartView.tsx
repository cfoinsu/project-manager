import React, { useState, useCallback, useRef } from 'react';
import * as api from '../utils/api';
import type { User } from '../types';
import { Avatar } from './Avatar';
import { OrgAddModal } from './OrgAddModal';
import { OrgTreeView } from './OrgTreeView';
import {
  Star, MoreVertical, Plus, Users,
  Code2, Flag, BarChart2, ShoppingBag,
  PenTool, Building2, UserRound, Trash2, Pencil, X, Save,
  ChevronRight, LayoutGrid, GitBranch,
} from 'lucide-react';

// ──────────────────────────────────────────────────────────────
// Types
// ──────────────────────────────────────────────────────────────
type OrgItemType = 'departments' | 'positions' | 'job-roles';
type ViewMode = 'kanban' | 'tree';

type DepartmentTreeNode = api.OrgItem & {
  children: DepartmentTreeNode[];
  depth: number;
  path: string;
};

// ──────────────────────────────────────────────────────────────
// Helpers
// ──────────────────────────────────────────────────────────────
const buildDepartmentTree = (departments: api.OrgItem[]): DepartmentTreeNode[] => {
  const sorted = [...departments].sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0) || a.name.localeCompare(b.name, 'ko'));
  const byId = new Map<string, DepartmentTreeNode>();
  sorted.forEach((d) => byId.set(d.id, { ...d, parent_id: d.parent_id || null, children: [], depth: 0, path: d.name }));
  const roots: DepartmentTreeNode[] = [];
  sorted.forEach((d) => {
    const node = byId.get(d.id)!;
    const parent = node.parent_id ? byId.get(node.parent_id) : null;
    if (parent && parent.id !== node.id) parent.children.push(node);
    else roots.push(node);
  });
  const assignMeta = (nodes: DepartmentTreeNode[], depth: number, parentPath = ''): DepartmentTreeNode[] =>
    nodes.map((n) => { n.depth = depth; n.path = parentPath ? `${parentPath} / ${n.name}` : n.name; n.children = assignMeta(n.children, depth + 1, n.path); return n; });
  return assignMeta(roots, 0);
};

const flattenTree = (nodes: DepartmentTreeNode[]): DepartmentTreeNode[] =>
  nodes.flatMap((n) => [n, ...flattenTree(n.children)]);

// Color palette
const PALETTES = [
  { iconBg: 'bg-blue-500',   text: 'text-blue-600',   light: 'bg-blue-50'   },
  { iconBg: 'bg-emerald-500', text: 'text-emerald-600', light: 'bg-emerald-50' },
  { iconBg: 'bg-purple-500',  text: 'text-purple-600',  light: 'bg-purple-50'  },
  { iconBg: 'bg-orange-500',  text: 'text-orange-600',  light: 'bg-orange-50'  },
  { iconBg: 'bg-slate-500',   text: 'text-slate-600',   light: 'bg-slate-50'   },
  { iconBg: 'bg-rose-500',    text: 'text-rose-600',    light: 'bg-rose-50'    },
];
const DEPT_ICONS = [Code2, Flag, BarChart2, ShoppingBag, PenTool, Building2];
const getPalette   = (i: number) => PALETTES[i % PALETTES.length];
const getDeptIcon  = (i: number) => DEPT_ICONS[i % DEPT_ICONS.length];
const deptCode     = (name: string) => name.slice(0, 3).toUpperCase().replace(/\s+/, '');

// ──────────────────────────────────────────────────────────────
// Props
// ──────────────────────────────────────────────────────────────
interface OrgChartViewProps {
  departments: api.OrgItem[];
  users: User[];
  addValue: string;
  onAddValueChange: (value: string) => void;
  onAdd: (parentId?: string | null, nameOverride?: string) => void;
  onDelete: (id: string) => void;
  editingItem: { type: OrgItemType; id: string; name: string } | null;
  setEditingItem: (item: { type: OrgItemType; id: string; name: string } | null) => void;
  onSaveEdit: () => void;
  draggingItem: { type: OrgItemType; id: string } | null;
  setDraggingItem: (item: { type: OrgItemType; id: string } | null) => void;
  dragOverItem: { type: OrgItemType; id: string } | null;
  setDragOverItem: (item: { type: OrgItemType; id: string } | null) => void;
  onDropDepartment: (type: OrgItemType, draggedId: string, targetId: string) => void;
  draggingUserId: string | null;
  setDraggingUserId: (id: string | null) => void;
  dragOverDepartmentId: string | null;
  setDragOverDepartmentId: (id: string | null) => void;
  onMoveUser: (userId: string, departmentName: string | null) => void | Promise<void>;
  onMoveDepartmentParent: (departmentId: string, parentId: string | null) => void | Promise<void>;
  /** 인력 추가 클릭 시 계정관리 탭으로 이동 */
  onGoToUsers?: () => void;
}

// ──────────────────────────────────────────────────────────────
// Modal state type
// ──────────────────────────────────────────────────────────────
interface ModalState {
  type: 'department' | 'team';
  parentId: string | null;
  parentName?: string;
}

// ──────────────────────────────────────────────────────────────
// Main Component
// ──────────────────────────────────────────────────────────────
export const OrgChartView: React.FC<OrgChartViewProps> = ({
  departments,
  users,
  onAdd,
  onDelete,
  editingItem,
  setEditingItem,
  onSaveEdit,
  draggingItem,
  setDraggingItem,
  dragOverItem,
  setDragOverItem,
  draggingUserId,
  setDraggingUserId,
  dragOverDepartmentId,
  setDragOverDepartmentId,
  onMoveUser,
  onMoveDepartmentParent,
  onGoToUsers,
}) => {
  const [viewMode, setViewMode] = useState<ViewMode>('kanban');
  const [modal, setModal] = useState<ModalState | null>(null);
  const [favoriteDepts, setFavoriteDepts] = useState<Set<string>>(new Set());
  const [selectedDeptId, setSelectedDeptId] = useState<string | null>(null);
  const [selectedTeamId, setSelectedTeamId] = useState<string | null>(null);
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  const tree      = buildDepartmentTree(departments);
  const all       = flattenTree(tree);
  const rootDepts = all.filter((n) => n.depth === 0);
  const teamNodes = all.filter((n) => n.depth === 1);
  const unassigned = users.filter((u) => !u.department);

  const getDirectMembers = useCallback(
    (node: DepartmentTreeNode) =>
      users.filter((u) => u.department === node.path || (node.depth === 0 && u.department === node.name)),
    [users]
  );
  const getSubtreeMembers = useCallback(
    (node: DepartmentTreeNode): User[] => [
      ...getDirectMembers(node),
      ...flattenTree(node.children).flatMap(getDirectMembers),
    ],
    [getDirectMembers]
  );

  const selectedDept = selectedDeptId ? rootDepts.find((d) => d.id === selectedDeptId) : null;
  const visibleTeams = selectedDept
    ? all.filter((n) => n.depth === 1 && n.parent_id === selectedDept.id)
    : teamNodes;
  const selectedTeam = selectedTeamId ? all.find((n) => n.id === selectedTeamId) : null;
  const visibleMembers = selectedTeam
    ? getSubtreeMembers(selectedTeam)
    : selectedDept
    ? getSubtreeMembers(selectedDept)
    : users.filter((u) => u.department);

  const toggleFav = (id: string) => setFavoriteDepts((prev) => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n; });

  const openAddModal = (type: 'department' | 'team', parentId: string | null, parentName?: string) =>
    setModal({ type, parentId, parentName });

  const handleModalConfirm = (name: string) => {
    if (!modal) return;
    onAdd(modal.parentId, name);
    setModal(null);
  };

  const isDescendant = (target: DepartmentTreeNode, ancestorId: string): boolean => {
    if (!target.parent_id) return false;
    if (target.parent_id === ancestorId) return true;
    const parent = all.find((n) => n.id === target.parent_id);
    return parent ? isDescendant(parent, ancestorId) : false;
  };

  const cleanup = () => {
    setDraggingItem(null);
    setDragOverItem(null);
    setDraggingUserId(null);
    setDragOverDepartmentId(null);
  };

  const handleDropOnNode = (e: React.DragEvent, node: DepartmentTreeNode) => {
    e.preventDefault();
    if (draggingUserId) {
      const member = users.find((u) => u.id === draggingUserId);
      if (member && window.confirm(`'${member.name}'을(를) '${node.name}'에 배정할까요?`)) onMoveUser(draggingUserId, node.path);
    } else if (draggingItem?.type === 'departments' && draggingItem.id !== node.id) {
      if (isDescendant(node, draggingItem.id)) alert('하위 조직으로 자기 자신을 이동할 수 없습니다.');
      else onMoveDepartmentParent(draggingItem.id, node.id);
    }
    cleanup();
  };

  const handleDropToRoot = (e: React.DragEvent) => { e.preventDefault(); if (draggingItem?.type === 'departments') onMoveDepartmentParent(draggingItem.id, null); cleanup(); };
  const handleDropToUnassigned = (e: React.DragEvent) => {
    e.preventDefault();
    if (draggingUserId) {
      const member = users.find((u) => u.id === draggingUserId);
      if (member && window.confirm(`'${member.name}'을(를) 미배정 상태로 변경할까요?`)) onMoveUser(draggingUserId, null);
    }
    cleanup();
  };

  const deptIndex = (id: string) => rootDepts.findIndex((d) => d.id === id);

  // ── View toggle header ─────────────────────────────────────
  const ViewToggle = (
    <div className="flex items-center gap-1 bg-slate-100 rounded-2xl p-1">
      <button
        onClick={() => setViewMode('kanban')}
        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-black transition-all ${
          viewMode === 'kanban' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'
        }`}
      >
        <LayoutGrid className="w-3.5 h-3.5" />
        칸반 보기
      </button>
      <button
        onClick={() => setViewMode('tree')}
        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-black transition-all ${
          viewMode === 'tree' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'
        }`}
      >
        <GitBranch className="w-3.5 h-3.5" />
        트리 보기
      </button>
    </div>
  );

  // ── Tree View ──────────────────────────────────────────────
  if (viewMode === 'tree') {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', height: '100%', gap: 10 }}>
        {/* 헤더 */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 4px', flexShrink: 0 }}>
          <p className="text-xs font-bold text-slate-500">
            조직 전체 트리를 확인합니다. 빈 공간을 드래그하면 이동, 스크롤로 확대/축소합니다.
          </p>
          {ViewToggle}
        </div>
        {/* ReactFlow 캔버스 – 명시적 높이 필요 */}
        <div style={{ flex: 1, minHeight: 0, borderRadius: 24, overflow: 'hidden', border: '1px solid #E2E8F0' }}>
          <OrgTreeView departments={departments} users={users} />
        </div>
      </div>
    );
  }

  // ── Kanban View ────────────────────────────────────────────
  return (
    <>
      {/* Add/Edit modal */}
      {modal && (
        <OrgAddModal
          type={modal.type}
          parentName={modal.parentName}
          onConfirm={handleModalConfirm}
          onClose={() => setModal(null)}
        />
      )}

      <div
        className="org-chart-root flex h-full bg-[#F1F5F9] rounded-3xl overflow-hidden border border-slate-200/80 shadow-sm"
        onClick={() => openMenuId && setOpenMenuId(null)}
      >
        {/* ━━━━ Col 1: 조직 ━━━━ */}
        <OrgColumn title="조직" width="w-[200px]" topRight={ViewToggle} className="border-r border-slate-200/80">
          <div className="px-3 pt-1">
            <div
              onDragOver={(e) => e.preventDefault()}
              onDrop={handleDropToRoot}
              className="rounded-2xl bg-[#1E293B] p-4 text-white shadow-xl cursor-default select-none"
            >
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-2.5">
                  <div className="w-9 h-9 rounded-xl bg-blue-500 flex items-center justify-center shrink-0">
                    <Building2 className="w-5 h-5 text-white" />
                  </div>
                  <div>
                    <p className="text-sm font-black leading-tight">Project Atlas</p>
                    <p className="text-[10px] font-semibold text-slate-400 mt-0.5">본사 조직</p>
                  </div>
                </div>
                <MoreVertical className="w-4 h-4 text-slate-500" />
              </div>
              <div className="mt-3">
                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-white/10 text-[10px] font-black text-slate-200">
                  <Building2 className="w-3 h-3" /> 조직
                </span>
              </div>
            </div>
            {rootDepts.length > 0 && (
              <div className="mt-4 space-y-1">
                {rootDepts.map((dept, i) => {
                  const pal = getPalette(i);
                  const DI  = getDeptIcon(i);
                  const isSel = selectedDeptId === dept.id;
                  return (
                    <button key={dept.id} onClick={() => { setSelectedDeptId(isSel ? null : dept.id); setSelectedTeamId(null); }}
                      className={`w-full flex items-center gap-2 px-2.5 py-1.5 rounded-xl text-left text-[11px] font-bold transition-all ${isSel ? 'bg-white text-blue-600 shadow-sm ring-1 ring-blue-200' : 'text-slate-500 hover:bg-white/60 hover:text-slate-700'}`}
                    >
                      <div className={`w-5 h-5 rounded-md ${pal.iconBg} flex items-center justify-center shrink-0`}>
                        <DI className="w-3 h-3 text-white" />
                      </div>
                      <span className="truncate">{dept.name}</span>
                      <ChevronRight className={`w-3 h-3 ml-auto shrink-0 transition-transform ${isSel ? 'rotate-90 text-blue-500' : 'text-slate-300'}`} />
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </OrgColumn>

        <ColSeparator />

        {/* ━━━━ Col 2: 부서 ━━━━ */}
        <OrgColumn title="부서" width="w-[230px]" actionLabel="+ 부서 추가" onAction={() => openAddModal('department', null)} className="border-r border-slate-200/80">
          <div className="space-y-3 px-3">
            {rootDepts.length === 0 && <EmptyState label="등록된 부서가 없습니다" />}
            {rootDepts.map((dept, i) => {
              const pal = getPalette(i);
              const DI  = getDeptIcon(i);
              const isFav = favoriteDepts.has(dept.id);
              const isSel = selectedDeptId === dept.id;
              const teams  = all.filter((n) => n.depth === 1 && n.parent_id === dept.id);
              const allM   = getSubtreeMembers(dept);
              const leader = getDirectMembers(dept)[0] ?? allM[0];
              const isEditingThis  = editingItem?.type === 'departments' && editingItem.id === dept.id;
              const isDraggingThis = draggingItem?.type === 'departments' && draggingItem.id === dept.id;
              const isDragOverThis = dragOverItem?.id === dept.id && !isDraggingThis;
              const isUserDragOver = dragOverDepartmentId === dept.id && !!draggingUserId;

              return (
                <div key={dept.id}
                  draggable
                  onDragStart={(e) => { if ((e.target as HTMLElement).closest('[data-nodrag]')) return; setDraggingItem({ type: 'departments', id: dept.id }); }}
                  onDragOver={(e) => { e.preventDefault(); draggingUserId ? setDragOverDepartmentId(dept.id) : setDragOverItem({ type: 'departments', id: dept.id }); }}
                  onDragLeave={() => { if (dragOverDepartmentId === dept.id) setDragOverDepartmentId(null); if (dragOverItem?.id === dept.id) setDragOverItem(null); }}
                  onDrop={(e) => handleDropOnNode(e, dept)}
                  onDragEnd={cleanup}
                  onClick={() => { setSelectedDeptId(isSel ? null : dept.id); setSelectedTeamId(null); }}
                  className={`relative rounded-2xl border bg-white p-4 cursor-pointer transition-all select-none ${isDraggingThis ? 'opacity-40 scale-[0.98]' : ''} ${isDragOverThis || isUserDragOver ? 'border-blue-400 ring-2 ring-blue-100 bg-blue-50/20' : isSel ? 'border-blue-300 ring-2 ring-blue-50 shadow-md shadow-blue-100/60' : 'border-slate-100 hover:border-slate-200 hover:shadow-sm'}`}
                >
                  <div className="flex items-start gap-2.5">
                    <div className={`w-10 h-10 rounded-xl ${pal.iconBg} flex items-center justify-center shrink-0 shadow-sm`}>
                      <DI className="w-5 h-5 text-white" />
                    </div>
                    <div className="min-w-0 flex-1">
                      {isEditingThis ? (
                        <input data-nodrag value={editingItem!.name}
                          onChange={(e) => setEditingItem({ ...editingItem!, name: e.target.value })}
                          onKeyDown={(e) => { if (e.key === 'Enter') onSaveEdit(); if (e.key === 'Escape') setEditingItem(null); }}
                          autoFocus onClick={(e) => e.stopPropagation()}
                          className="w-full px-2 py-1 rounded-lg bg-slate-50 border border-slate-200 text-sm font-bold outline-none focus:ring-1 focus:ring-blue-300"
                        />
                      ) : (
                        <p className="text-sm font-black text-slate-800 truncate">{dept.name}</p>
                      )}
                      <p className={`text-[10px] font-black mt-0.5 uppercase tracking-widest ${pal.text}`}>{deptCode(dept.name)}</p>
                    </div>
                    <div className="flex items-center gap-0.5 shrink-0" data-nodrag onClick={(e) => e.stopPropagation()}>
                      <button onClick={() => toggleFav(dept.id)} className="p-1.5 rounded-lg hover:bg-slate-50 transition-colors">
                        <Star className={`w-3.5 h-3.5 transition-colors ${isFav ? 'fill-amber-400 text-amber-400' : 'text-slate-300 hover:text-amber-300'}`} />
                      </button>
                      <div className="relative">
                        <button onClick={() => setOpenMenuId(openMenuId === dept.id ? null : dept.id)} className="p-1.5 rounded-lg hover:bg-slate-50 transition-colors">
                          <MoreVertical className="w-3.5 h-3.5 text-slate-400" />
                        </button>
                        {openMenuId === dept.id && (
                          <ContextMenu>
                            <ContextItem icon={<Pencil className="w-3.5 h-3.5" />} label="이름 변경" onClick={() => { setEditingItem({ type: 'departments', id: dept.id, name: dept.name }); setOpenMenuId(null); }} />
                            <ContextItem icon={<Plus className="w-3.5 h-3.5" />} label="팀 추가" blue onClick={() => { openAddModal('team', dept.id, dept.name); setOpenMenuId(null); }} />
                            <ContextItem icon={<Trash2 className="w-3.5 h-3.5" />} label="삭제" red onClick={() => { onDelete(dept.id); setOpenMenuId(null); }} />
                          </ContextMenu>
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="mt-3 text-[11px] font-bold text-slate-500 space-y-0.5">
                    <p>팀 {teams.length}개 · 인력 {allM.length}명</p>
                    {leader && <p className="text-slate-400 truncate">본부장: {leader.name}</p>}
                  </div>
                  {isEditingThis && (
                    <div className="mt-2.5 flex gap-1.5" data-nodrag onClick={(e) => e.stopPropagation()}>
                      <button onClick={onSaveEdit} className="flex-1 py-1.5 rounded-xl bg-blue-500 text-white text-[11px] font-black flex items-center justify-center gap-1 hover:bg-blue-600"><Save className="w-3 h-3" /> 저장</button>
                      <button onClick={() => setEditingItem(null)} className="py-1.5 px-3 rounded-xl bg-slate-100 text-slate-500 text-[11px] font-black hover:bg-slate-200"><X className="w-3 h-3" /></button>
                    </div>
                  )}
                  {(isDragOverThis || isUserDragOver) && (
                    <div className="mt-2 rounded-xl bg-blue-50 px-3 py-1.5 text-[11px] font-black text-blue-500 text-center">
                      {draggingUserId ? '이 부서에 배정' : '이 부서로 이동'}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </OrgColumn>

        <ColSeparator />

        {/* ━━━━ Col 3: 팀 ━━━━ */}
        <OrgColumn title="팀" width="w-[210px]" actionLabel="+ 팀 추가"
          onAction={() => { if (selectedDeptId) { const d = rootDepts.find((r) => r.id === selectedDeptId); openAddModal('team', selectedDeptId, d?.name); } else alert('팀을 추가할 부서를 먼저 선택하세요.'); }}
          className="border-r border-slate-200/80"
        >
          <div className="space-y-2.5 px-3">
            {visibleTeams.length === 0 && <EmptyState label={selectedDept ? '이 부서에 팀이 없습니다' : '부서를 선택하세요'} />}
            {visibleTeams.map((team) => {
              const pi  = deptIndex(team.parent_id ?? '');
              const pal = getPalette(pi >= 0 ? pi : 0);
              const members  = getSubtreeMembers(team);
              const leader   = getDirectMembers(team)[0];
              const isSel    = selectedTeamId === team.id;
              const isDraggingThis = draggingItem?.type === 'departments' && draggingItem.id === team.id;
              const isDragOverThis = dragOverItem?.id === team.id && !isDraggingThis;
              const isUserDragOver = dragOverDepartmentId === team.id && !!draggingUserId;
              const isEditingThis  = editingItem?.type === 'departments' && editingItem.id === team.id;

              return (
                <div key={team.id}
                  draggable
                  onDragStart={(e) => { if ((e.target as HTMLElement).closest('[data-nodrag]')) return; setDraggingItem({ type: 'departments', id: team.id }); }}
                  onDragOver={(e) => { e.preventDefault(); draggingUserId ? setDragOverDepartmentId(team.id) : setDragOverItem({ type: 'departments', id: team.id }); }}
                  onDragLeave={() => { if (dragOverDepartmentId === team.id) setDragOverDepartmentId(null); if (dragOverItem?.id === team.id) setDragOverItem(null); }}
                  onDrop={(e) => handleDropOnNode(e, team)}
                  onDragEnd={cleanup}
                  onClick={() => setSelectedTeamId(isSel ? null : team.id)}
                  className={`flex items-center gap-2.5 rounded-2xl border bg-white px-3 py-3 cursor-pointer transition-all select-none ${isDraggingThis ? 'opacity-40 scale-[0.98]' : ''} ${isDragOverThis || isUserDragOver ? 'border-blue-400 ring-2 ring-blue-100 bg-blue-50/20' : isSel ? 'border-blue-300 ring-2 ring-blue-50 shadow-md shadow-blue-100/60' : 'border-slate-100 hover:border-slate-200 hover:shadow-sm'}`}
                >
                  <div className={`w-8 h-8 rounded-xl ${pal.light} flex items-center justify-center shrink-0`}>
                    <Users className={`w-4 h-4 ${pal.text}`} />
                  </div>
                  <div className="min-w-0 flex-1">
                    {isEditingThis ? (
                      <input data-nodrag value={editingItem!.name}
                        onChange={(e) => setEditingItem({ ...editingItem!, name: e.target.value })}
                        onKeyDown={(e) => { if (e.key === 'Enter') onSaveEdit(); if (e.key === 'Escape') setEditingItem(null); }}
                        autoFocus onClick={(e) => e.stopPropagation()}
                        className="w-full px-2 py-1 rounded-lg bg-slate-50 border border-slate-200 text-xs font-bold outline-none"
                      />
                    ) : (
                      <p className="text-xs font-black text-slate-800 truncate">{team.name}</p>
                    )}
                    {leader && <p className="text-[10px] font-bold text-slate-400 truncate mt-0.5">팀장: {leader.name}</p>}
                  </div>
                  <div className="flex flex-col items-end gap-1 shrink-0" data-nodrag onClick={(e) => e.stopPropagation()}>
                    <span className={`text-[10px] font-black px-2 py-0.5 rounded-lg ${pal.light} ${pal.text}`}>인력 {members.length}명</span>
                    <div className="flex gap-0.5">
                      <button onClick={() => setEditingItem({ type: 'departments', id: team.id, name: team.name })} className="p-1 rounded hover:bg-slate-100 text-slate-400 transition-colors"><Pencil className="w-3 h-3" /></button>
                      <button onClick={() => onDelete(team.id)} className="p-1 rounded hover:bg-red-50 text-slate-400 hover:text-red-500 transition-colors"><Trash2 className="w-3 h-3" /></button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </OrgColumn>

        <ColSeparator />

        {/* ━━━━ Col 4: 파트 / 인력 ━━━━ */}
        <OrgColumn title="파트 / 인력" width="flex-1 min-w-[210px]"
          actionLabel="+ 인력 추가"
          onAction={() => onGoToUsers ? onGoToUsers() : alert('사용자 계정 관리 탭에서 인력을 추가해 주세요.')}
          className="border-r border-slate-200/80"
        >
          <div className="space-y-2 px-3">
            {visibleMembers.length === 0 && <EmptyState label={selectedDept || selectedTeam ? '배정된 인력이 없습니다' : '부서 또는 팀을 선택하세요'} />}
            {visibleMembers.map((member) => {
              const isDragging = draggingUserId === member.id;
              return (
                <div key={member.id} draggable onDragStart={() => setDraggingUserId(member.id)} onDragEnd={cleanup}
                  title="드래그해서 팀/부서로 이동"
                  className={`group flex items-center gap-3 rounded-2xl border bg-white px-3.5 py-3 cursor-grab active:cursor-grabbing transition-all ${isDragging ? 'opacity-40 scale-[0.98] ring-2 ring-blue-200' : 'border-slate-100 hover:border-blue-200 hover:shadow-sm'}`}
                >
                  <Avatar name={member.name} profileImage={member.profile_image} className="w-9 h-9 text-[11px] shrink-0" />
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-black text-slate-800 truncate">{member.name}</p>
                    <p className="text-[11px] font-bold text-slate-400 truncate">{member.job_role || member.position || member.role}</p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <span className="text-xs font-black text-blue-600 bg-blue-50 px-2 py-1 rounded-lg">100%</span>
                    <MoreVertical className="w-3.5 h-3.5 text-slate-200 group-hover:text-slate-400 transition-colors" />
                  </div>
                </div>
              );
            })}
          </div>
        </OrgColumn>

        {/* ━━━━ Col 5: 미배정 인력 ━━━━ */}
        <div
          onDragOver={(e) => { e.preventDefault(); if (draggingUserId) setDragOverDepartmentId('__unassigned__'); }}
          onDragLeave={() => { if (dragOverDepartmentId === '__unassigned__') setDragOverDepartmentId(null); }}
          onDrop={handleDropToUnassigned}
          className={`w-[190px] shrink-0 flex flex-col transition-all ${dragOverDepartmentId === '__unassigned__' ? 'bg-blue-50/60' : 'bg-[#F1F5F9]'}`}
        >
          <div className="px-4 pt-5 pb-3 border-b border-slate-200/70 flex items-center justify-between shrink-0">
            <h4 className="text-xs font-black text-slate-700">미배정 인력</h4>
            <span className="px-2 py-1 rounded-full bg-white border border-slate-200 text-[11px] font-black text-blue-500">{unassigned.length}</span>
          </div>
          <div className="flex-1 overflow-y-auto p-3 space-y-2 scrollbar-thin">
            {unassigned.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-10 text-center">
                <div className="w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center mb-2"><UserRound className="w-5 h-5 text-slate-400" /></div>
                <p className="text-[11px] font-bold text-slate-400">미배정 인력 없음</p>
              </div>
            ) : (
              unassigned.map((member) => {
                const isDragging = draggingUserId === member.id;
                return (
                  <div key={member.id} draggable onDragStart={() => setDraggingUserId(member.id)} onDragEnd={cleanup}
                    className={`flex items-center gap-2.5 rounded-2xl border bg-white px-3 py-2.5 cursor-grab active:cursor-grabbing transition-all ${isDragging ? 'opacity-40 scale-[0.98]' : 'border-slate-100 hover:border-blue-200 hover:shadow-sm'}`}
                  >
                    <Avatar name={member.name} profileImage={member.profile_image} className="w-8 h-8 text-[10px] shrink-0" />
                    <div className="min-w-0 flex-1">
                      <p className="text-xs font-black text-slate-800 truncate">{member.name}</p>
                      <p className="text-[10px] font-bold text-slate-400 truncate">{member.job_role || member.position || member.role}</p>
                    </div>
                    <span className="text-[10px] font-black text-slate-400">0%</span>
                  </div>
                );
              })
            )}
            <button
              onClick={() => onGoToUsers ? onGoToUsers() : alert('사용자 계정 관리 탭에서 인력을 추가해 주세요.')}
              className="w-full py-2.5 rounded-2xl border border-dashed border-slate-300 text-xs font-black text-blue-500 hover:bg-white/60 hover:border-blue-300 transition-all"
            >
              + 인력 추가
            </button>
          </div>
        </div>
      </div>
    </>
  );
};

// ──────────────────────────────────────────────────────────────
// Sub-components
// ──────────────────────────────────────────────────────────────
interface OrgColumnProps {
  title: string;
  width?: string;
  actionLabel?: string;
  onAction?: () => void;
  topRight?: React.ReactNode;
  className?: string;
  children: React.ReactNode;
}

const OrgColumn: React.FC<OrgColumnProps> = ({ title, width = '', actionLabel, onAction, topRight, className = '', children }) => (
  <div className={`flex flex-col bg-[#F1F5F9] ${width} ${className}`}>
    <div className="px-4 pt-4 pb-3 border-b border-slate-200/70 flex items-center justify-between shrink-0 gap-2">
      <h4 className="text-xs font-black text-slate-700 shrink-0">{title}</h4>
      {topRight}
      {actionLabel && onAction && (
        <button onClick={onAction} className="text-[11px] font-black text-blue-500 hover:text-blue-600 transition-colors shrink-0">
          {actionLabel}
        </button>
      )}
    </div>
    <div className="flex-1 overflow-y-auto py-3 scrollbar-thin">{children}</div>
  </div>
);

const ColSeparator: React.FC = () => (
  <div className="flex items-center justify-center w-5 shrink-0 bg-[#F1F5F9] relative">
    <div className="absolute left-1/2 -translate-x-1/2 w-px bg-slate-300" style={{ top: 120, bottom: 40 }} />
  </div>
);

const EmptyState: React.FC<{ label: string }> = ({ label }) => (
  <div className="rounded-2xl border border-dashed border-slate-300 p-6 text-center">
    <p className="text-xs font-bold text-slate-400">{label}</p>
  </div>
);

interface ContextMenuProps { children: React.ReactNode; }
const ContextMenu: React.FC<ContextMenuProps> = ({ children }) => (
  <div className="absolute right-0 top-7 z-30 w-36 bg-white border border-slate-100 rounded-2xl shadow-xl py-1.5" style={{ animation: 'scaleUp 0.15s ease' }}>
    {children}
    <style>{`@keyframes scaleUp { from { opacity:0; transform:scale(0.92) translateY(-4px); } to { opacity:1; transform:scale(1); } }`}</style>
  </div>
);

interface ContextItemProps { icon: React.ReactNode; label: string; onClick: () => void; blue?: boolean; red?: boolean; }
const ContextItem: React.FC<ContextItemProps> = ({ icon, label, onClick, blue, red }) => (
  <button onClick={onClick}
    className={`w-full flex items-center gap-2 px-3 py-2 text-xs font-bold transition-colors ${red ? 'text-red-500 hover:bg-red-50' : blue ? 'text-blue-600 hover:bg-blue-50' : 'text-slate-600 hover:bg-slate-50'}`}
  >
    {icon}{label}
  </button>
);
