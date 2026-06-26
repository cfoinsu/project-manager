/**
 * OrgTreeView – 수평 조직도 트리 (ReactFlow)
 * 조직 → 부서 → 팀 → 인력 4단계를 마인드맵처럼 표시합니다.
 *
 * 레이아웃 전략:
 *  - 단순 반복(iterative) 방식: 커서(y)를 아래로 증가시키며 각 노드 위치 결정
 *  - 부모 카드는 자식들을 배치한 뒤 중앙값으로 결정 (bottom-up 방식)
 *  - globalY 클로저 방식을 사용하지 않아 이전 버그 제거
 */
import React, { useEffect } from 'react';
import ReactFlow, {
  Controls,
  Background,
  useNodesState,
  useEdgesState,
  Handle,
  Position,
  BackgroundVariant,
} from 'reactflow';
import type { Node, Edge, NodeProps } from 'reactflow';
import 'reactflow/dist/style.css';
import * as api from '../utils/api';
import type { User } from '../types';
import { Avatar } from './Avatar';
import { Building2, Users, Code2, Flag, BarChart2, ShoppingBag, PenTool } from 'lucide-react';

// ─── 타입 ─────────────────────────────────────────────────────
type DeptNode = api.OrgItem & { children: DeptNode[]; depth: number; path: string };

// ─── 트리 빌딩 ────────────────────────────────────────────────
function buildDeptTree(deps: api.OrgItem[]): DeptNode[] {
  const sorted = [...deps].sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0));
  const byId = new Map<string, DeptNode>();
  sorted.forEach((d) =>
    byId.set(d.id, { ...d, parent_id: d.parent_id || null, children: [], depth: 0, path: d.name })
  );
  const roots: DeptNode[] = [];
  sorted.forEach((d) => {
    const node = byId.get(d.id)!;
    const parent = node.parent_id ? byId.get(node.parent_id) : null;
    if (parent && parent.id !== node.id) parent.children.push(node);
    else roots.push(node);
  });
  const tag = (ns: DeptNode[], depth: number, pp = ''): DeptNode[] =>
    ns.map((n) => {
      n.depth = depth;
      n.path = pp ? `${pp} / ${n.name}` : n.name;
      n.children = tag(n.children, depth + 1, n.path);
      return n;
    });
  return tag(roots, 0);
}

function flatAll(ns: DeptNode[]): DeptNode[] {
  return ns.flatMap((n) => [n, ...flatAll(n.children)]);
}

// ─── 색상 & 아이콘 팔레트 ──────────────────────────────────────
const COLORS = [
  { bg: '#3B82F6', light: '#EFF6FF', text: '#2563EB' },
  { bg: '#10B981', light: '#ECFDF5', text: '#059669' },
  { bg: '#8B5CF6', light: '#F5F3FF', text: '#7C3AED' },
  { bg: '#F59E0B', light: '#FFFBEB', text: '#D97706' },
  { bg: '#64748B', light: '#F8FAFC', text: '#475569' },
  { bg: '#EF4444', light: '#FEF2F2', text: '#DC2626' },
];
const ICONS = [Code2, Flag, BarChart2, ShoppingBag, PenTool, Building2];
const color = (i: number) => COLORS[i % COLORS.length];
const icon  = (i: number) => ICONS[i % ICONS.length];
const renderPaletteIcon = (i: number, className: string) => {
  const Icon = icon(i);
  return <Icon className={className} />;
};

// ─── 레이아웃 상수 ─────────────────────────────────────────────
const ROOT_W  = 185;
const DEPT_W  = 210; const DEPT_H  = 96;
const TEAM_W  = 210; const TEAM_H  = 76;
const MEM_W   = 200; const MEM_H   = 72;
const H_GAP   = 60;  // 레벨 간 수평 간격
const V_GAP   = 18;  // 형제 노드 수직 간격
const DEPT_GAP = 32; // 부서 간 추가 여백

// X 좌표 (고정)
const X_ROOT = 0;
const X_DEPT = X_ROOT + ROOT_W + H_GAP;        // 245
const X_TEAM = X_DEPT + DEPT_W + H_GAP;        // 515
const X_MEM  = X_TEAM + TEAM_W + H_GAP;        // 785

// ─── 레이아웃 계산 (반복 방식, 정확한 배치) ──────────────────────
function computeLayout(
  tree: DeptNode[],
  all:  DeptNode[],
  users: User[]
): Map<string, { x: number; y: number }> {
  const pos = new Map<string, { x: number; y: number }>();

  /** 사용자가 해당 노드에 직접 배정된 경우 */
  const directMembers = (node: DeptNode) =>
    users.filter(
      (u) =>
        u.department === node.path ||
        (node.depth === 0 && u.department === node.name)
    );

  let cursor = 0; // 현재 Y 위치 커서 (아래로만 증가)

  for (const dept of tree) {
    const deptCursorStart = cursor;
    const teams = all.filter((n) => n.depth === 1 && n.parent_id === dept.id);
    const deptDirectM = directMembers(dept);

    if (teams.length === 0) {
      // ── 팀 없는 부서 ──────────────────────────────────
      if (deptDirectM.length === 0) {
        // 부서 카드만
        pos.set(dept.id, { x: X_DEPT, y: cursor });
        cursor += DEPT_H + V_GAP;
      } else {
        // 직속 인력 배치 → 부서 카드를 인력 중앙에 맞춤
        const memTop = cursor;
        deptDirectM.forEach((m) => {
          pos.set(`mem:${dept.id}:${m.id}`, { x: X_MEM, y: cursor });
          cursor += MEM_H + V_GAP;
        });
        const memBottom = cursor - V_GAP;
        const deptY = memTop + (memBottom - memTop - DEPT_H) / 2;
        pos.set(dept.id, { x: X_DEPT, y: Math.max(memTop, deptY) });
        cursor += V_GAP;
      }
    } else {
      // ── 팀이 있는 부서 ────────────────────────────────
      for (const team of teams) {
        const teamTop = cursor;
        const tMembers = directMembers(team);

        if (tMembers.length === 0) {
          // 팀 카드만
          pos.set(team.id, { x: X_TEAM, y: cursor });
          cursor += TEAM_H + V_GAP;
        } else {
          // 인력 배치 → 팀 카드를 인력 중앙에 맞춤
          const memTop = cursor;
          tMembers.forEach((m) => {
            pos.set(`mem:${team.id}:${m.id}`, { x: X_MEM, y: cursor });
            cursor += MEM_H + V_GAP;
          });
          const memBottom = cursor - V_GAP;
          const teamY = memTop + (memBottom - memTop - TEAM_H) / 2;
          pos.set(team.id, { x: X_TEAM, y: Math.max(teamTop, teamY) });
          cursor += V_GAP;
        }
      }

      // 부서 카드: 소속 팀들 전체 영역의 중앙
      const teamsBottom = cursor - V_GAP;
      const teamsSpan   = teamsBottom - deptCursorStart;
      const deptY       = deptCursorStart + (teamsSpan - DEPT_H) / 2;
      pos.set(dept.id, { x: X_DEPT, y: Math.max(deptCursorStart, deptY) });

      cursor += DEPT_GAP; // 부서 간 추가 여백
    }
  }

  // 루트 노드: 전체 높이의 중앙
  const totalH = cursor - V_GAP;
  const rootY  = Math.max(0, (totalH - DEPT_H) / 2);
  pos.set('__root__', { x: X_ROOT, y: rootY });

  return pos;
}

// ─── 커스텀 ReactFlow 노드들 ─────────────────────────────────

const RootNode: React.FC<NodeProps> = () => (
  <div
    className="rounded-3xl text-white shadow-2xl p-4 select-none"
    style={{ width: ROOT_W, background: '#1E293B' }}
  >
    <Handle
      type="source"
      position={Position.Right}
      style={{ background: '#475569', border: 'none', width: 10, height: 10 }}
    />
    <div className="flex items-center gap-2.5">
      <div className="w-9 h-9 rounded-2xl bg-blue-500 flex items-center justify-center shrink-0">
        <Building2 className="w-5 h-5 text-white" />
      </div>
      <div>
        <p className="text-sm font-black leading-tight">Project Atlas</p>
        <p className="text-[10px] text-slate-400 mt-0.5">본사 조직</p>
      </div>
    </div>
    <div className="mt-3">
      <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-white/10 text-[10px] font-black text-slate-200">
        <Building2 className="w-3 h-3" /> 조직
      </span>
    </div>
  </div>
);

const DeptNodeCard: React.FC<NodeProps> = ({ data }) => {
  const { name, code, colorIdx, teamCount, memberCount, leaderName } = data;
  const c    = color(colorIdx);
  return (
    <div
      className="rounded-2xl bg-white shadow-md select-none"
      style={{
        width: DEPT_W,
        padding: '14px 14px 12px',
        border: `1.5px solid #F1F5F9`,
        borderLeft: `3.5px solid ${c.bg}`,
      }}
    >
      <Handle type="target" position={Position.Left}  style={{ background: c.bg, border: 'none', width: 10, height: 10 }} />
      <Handle type="source" position={Position.Right} style={{ background: c.bg, border: 'none', width: 10, height: 10 }} />
      <div className="flex items-start gap-2.5">
        <div
          className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0 shadow-sm"
          style={{ background: c.bg }}
        >
          {renderPaletteIcon(colorIdx, 'w-4 h-4 text-white')}
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-black text-slate-800 truncate">{name}</p>
          <p className="text-[10px] font-black uppercase tracking-widest mt-0.5" style={{ color: c.text }}>
            {code}
          </p>
        </div>
      </div>
      <div className="mt-2.5 text-[11px] font-bold text-slate-500 space-y-0.5">
        <p>팀 {teamCount}개 · 인력 {memberCount}명</p>
        {leaderName && <p className="text-slate-400 truncate">본부장: {leaderName}</p>}
      </div>
    </div>
  );
};

const TeamNodeCard: React.FC<NodeProps> = ({ data }) => {
  const { name, colorIdx, memberCount, leaderName } = data;
  const c = color(colorIdx);
  return (
    <div
      className="rounded-2xl bg-white shadow-md flex items-center gap-2.5 select-none"
      style={{ width: TEAM_W, padding: '12px 14px', border: '1.5px solid #F1F5F9' }}
    >
      <Handle type="target" position={Position.Left}  style={{ background: c.bg, border: 'none', width: 10, height: 10 }} />
      <Handle type="source" position={Position.Right} style={{ background: c.bg, border: 'none', width: 10, height: 10 }} />
      <div
        className="w-8 h-8 rounded-xl flex items-center justify-center shrink-0"
        style={{ background: c.light }}
      >
        <Users className="w-4 h-4" style={{ color: c.bg }} />
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-xs font-black text-slate-800 truncate">{name}</p>
        {leaderName && (
          <p className="text-[10px] font-bold text-slate-400 mt-0.5 truncate">팀장: {leaderName}</p>
        )}
      </div>
      <span
        className="shrink-0 text-[10px] font-black px-2 py-1 rounded-lg whitespace-nowrap"
        style={{ background: c.light, color: c.text }}
      >
        인력 {memberCount}명
      </span>
    </div>
  );
};

const MemberNodeCard: React.FC<NodeProps> = ({ data }) => {
  const { member } = data;
  return (
    <div
      className="rounded-2xl bg-white shadow-md flex items-center gap-2.5 select-none"
      style={{ width: MEM_W, padding: '10px 12px', border: '1.5px solid #F1F5F9' }}
    >
      <Handle type="target" position={Position.Left} style={{ background: '#CBD5E1', border: 'none', width: 8, height: 8 }} />
      <Avatar
        name={member.name}
        profileImage={member.profile_image}
        className="w-8 h-8 text-[10px] shrink-0"
      />
      <div className="min-w-0 flex-1">
        <p className="text-xs font-black text-slate-800 truncate">{member.name}</p>
        <p className="text-[10px] font-bold text-slate-400 mt-0.5 truncate">
          {member.job_role || member.position || member.role}
        </p>
      </div>
      <span className="shrink-0 text-[10px] font-black px-2 py-1 rounded-lg bg-blue-50 text-blue-600">
        100%
      </span>
    </div>
  );
};

// 컴포넌트 외부에 nodeTypes를 정의해야 리렌더링 시 새 참조가 생기지 않음
const NODE_TYPES = {
  orgRoot:    RootNode,
  department: DeptNodeCard,
  team:       TeamNodeCard,
  member:     MemberNodeCard,
} as const;

// ─── 메인 컴포넌트 ────────────────────────────────────────────
interface OrgTreeViewProps {
  departments: api.OrgItem[];
  users: User[];
}

export const OrgTreeView: React.FC<OrgTreeViewProps> = ({ departments, users }) => {
  const [nodes, setNodes, onNodesChange] = useNodesState([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);

  useEffect(() => {
    const tree = buildDeptTree(departments);
    const all  = flatAll(tree);
    const rootDepts = all.filter((n) => n.depth === 0);

    const directMembers = (node: DeptNode) =>
      users.filter(
        (u) =>
          u.department === node.path ||
          (node.depth === 0 && u.department === node.name)
      );

    const pos = computeLayout(tree, all, users);

    const flowNodes: Node[] = [];
    const flowEdges: Edge[] = [];

    const mkEdge = (id: string, source: string, target: string, stroke = '#CBD5E1'): Edge => ({
      id,
      source,
      target,
      type: 'smoothstep',
      animated: false,
      style: { stroke, strokeWidth: 1.5 },
    });

    // 루트 노드
    const rootPos = pos.get('__root__') ?? { x: 0, y: 0 };
    flowNodes.push({
      id: '__root__',
      type: 'orgRoot',
      position: rootPos,
      data: {},
      draggable: false,
      selectable: false,
    });

    rootDepts.forEach((dept, di) => {
      const dPos = pos.get(dept.id);
      if (!dPos) return;

      const teams = all.filter((n) => n.depth === 1 && n.parent_id === dept.id);
      const deptM = directMembers(dept);
      const allM  = [...deptM, ...teams.flatMap((t) => directMembers(t))];
      const leader = allM[0];

      // 부서 노드
      flowNodes.push({
        id: dept.id,
        type: 'department',
        position: dPos,
        data: {
          name:        dept.name,
          code:        dept.name.slice(0, 4).toUpperCase(),
          colorIdx:    di,
          teamCount:   teams.length,
          memberCount: allM.length,
          leaderName:  leader?.name,
        },
        draggable: false,
        selectable: false,
      });
      flowEdges.push(mkEdge(`e-root-${dept.id}`, '__root__', dept.id, '#94A3B8'));

      if (teams.length === 0) {
        // 팀 없이 직속 인력만 있는 경우
        deptM.forEach((member) => {
          const key    = `mem:${dept.id}:${member.id}`;
          const mPos   = pos.get(key);
          if (!mPos) return;
          const nodeId = `memn-${dept.id}-${member.id}`;
          flowNodes.push({
            id: nodeId, type: 'member', position: mPos,
            data: { member }, draggable: false, selectable: false,
          });
          flowEdges.push(mkEdge(`e-${dept.id}-${nodeId}`, dept.id, nodeId, '#E2E8F0'));
        });
      } else {
        teams.forEach((team) => {
          const tPos = pos.get(team.id);
          if (!tPos) return;
          const tMembers = directMembers(team);
          const tLeader  = tMembers[0];

          // 팀 노드
          flowNodes.push({
            id: team.id,
            type: 'team',
            position: tPos,
            data: {
              name:        team.name,
              colorIdx:    di,
              memberCount: tMembers.length,
              leaderName:  tLeader?.name,
            },
            draggable: false,
            selectable: false,
          });
          flowEdges.push(mkEdge(`e-${dept.id}-${team.id}`, dept.id, team.id));

          // 팀 소속 인력 노드
          tMembers.forEach((member) => {
            const key    = `mem:${team.id}:${member.id}`;
            const mPos   = pos.get(key);
            if (!mPos) return;
            const nodeId = `memn-${team.id}-${member.id}`;
            flowNodes.push({
              id: nodeId, type: 'member', position: mPos,
              data: { member }, draggable: false, selectable: false,
            });
            flowEdges.push(mkEdge(`e-${team.id}-${nodeId}`, team.id, nodeId, '#E2E8F0'));
          });
        });
      }
    });

    setNodes(flowNodes);
    setEdges(flowEdges);
  }, [departments, users, setNodes, setEdges]);

  return (
    <ReactFlow
      nodes={nodes}
      edges={edges}
      onNodesChange={onNodesChange}
      onEdgesChange={onEdgesChange}
      nodeTypes={NODE_TYPES as any}
      fitView
      fitViewOptions={{ padding: 0.15, maxZoom: 1.0 }}
      minZoom={0.15}
      maxZoom={2.0}
      panOnDrag
      panOnScroll={false}
      zoomOnScroll
      nodesDraggable={false}
      elementsSelectable={false}
      proOptions={{ hideAttribution: true }}
      style={{ background: '#F8FAFC', borderRadius: 24 }}
    >
      <Controls
        showInteractive={false}
        style={{
          display: 'flex', flexDirection: 'column', gap: 2,
          background: 'white', border: '1px solid #E2E8F0',
          borderRadius: 16, overflow: 'hidden', boxShadow: '0 2px 8px rgba(0,0,0,0.08)',
          padding: 4,
        }}
      />
      <Background variant={BackgroundVariant.Dots} gap={28} size={1.5} color="#E2E8F0" />
    </ReactFlow>
  );
};
