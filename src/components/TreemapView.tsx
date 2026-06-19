import React, { useMemo, useState } from 'react';
import type { FolderNode } from '../types';
import { ChevronRight, Folder, ArrowUpLeft } from 'lucide-react';
import { CustomSelect } from './CustomSelect';

const checkMatch = (n: FolderNode, query: string): boolean => {
  if (!query) return true;
  if (n.name.toLowerCase().includes(query.toLowerCase())) return true;
  if (n.children) {
    return n.children.some(c => checkMatch(c, query));
  }
  return false;
};

interface TreemapViewProps {
  rootNode: FolderNode;
  activeNode: FolderNode;
  onNodeSelect: (node: FolderNode) => void;
  onShowToast: (message: string) => void;
  searchQuery?: string;
}

interface RectPartition {
  node: FolderNode;
  x: number; // percentage (0-100)
  y: number; // percentage (0-100)
  w: number; // percentage (0-100)
  h: number; // percentage (0-100)
}

// Slice-and-dice layout partition function returning values in percentages (0-100)
const partitionRects = (
  nodes: FolderNode[],
  x: number,
  y: number,
  w: number,
  h: number,
  horizontal: boolean
): RectPartition[] => {
  if (nodes.length === 0) return [];
  const sum = nodes.reduce((acc, n) => acc + n.size, 0);
  if (sum === 0) return [];

  if (nodes.length === 1) {
    return [{ node: nodes[0], x, y, w, h }];
  }

  let halfSum = 0;
  let splitIdx = 0;
  for (let i = 0; i < nodes.length; i++) {
    halfSum += nodes[i].size;
    if (halfSum >= sum / 2 || i === nodes.length - 1) {
      splitIdx = i + 1;
      break;
    }
  }

  const part1 = nodes.slice(0, splitIdx);
  const part2 = nodes.slice(splitIdx);

  const part1Sum = part1.reduce((acc, n) => acc + n.size, 0);
  const ratio = part1Sum / sum;

  if (horizontal) {
    const w1 = w * ratio;
    return [
      ...partitionRects(part1, x, y, w1, h, !horizontal),
      ...partitionRects(part2, x + w1, y, w - w1, h, !horizontal)
    ];
  } else {
    const h1 = h * ratio;
    return [
      ...partitionRects(part1, x, y, w, h1, !horizontal),
      ...partitionRects(part2, x, y + h1, w, h - h1, !horizontal)
    ];
  }
};

// Deterministic and category-based folder color helper
const getNodeColorClass = (name: string, path: string): string => {
  const lowerName = name.toLowerCase();
  if (lowerName.includes('디자인') || lowerName.includes('design') || lowerName.includes('02_')) {
    return 'bg-gradient-to-br from-[#3182F6] to-[#1b6cd5] text-white border-transparent';
  }
  if (lowerName.includes('개발') || lowerName.includes('dev') || lowerName.includes('development') || lowerName.includes('03_')) {
    return 'bg-gradient-to-br from-[#00B06C] to-[#009057] text-white border-transparent';
  }
  if (lowerName.includes('산출물') || lowerName.includes('output') || lowerName.includes('build') || lowerName.includes('deliver') || lowerName.includes('04_')) {
    return 'bg-gradient-to-br from-[#A855F7] to-[#8B5CF6] text-white border-transparent';
  }
  if (lowerName.includes('운영') || lowerName.includes('ops') || lowerName.includes('operation') || lowerName.includes('05_')) {
    return 'bg-gradient-to-br from-[#FFAD0D] to-[#E09200] text-white border-transparent';
  }
  if (lowerName.includes('기획') || lowerName.includes('plan') || lowerName.includes('planning') || lowerName.includes('01_')) {
    return 'bg-gradient-to-br from-[#64748B] to-[#475569] text-white border-transparent';
  }
  if (lowerName.includes('기타') || lowerName.includes('others')) {
    return 'bg-gradient-to-br from-[#94a3b8] to-[#64748b] text-white border-transparent';
  }

  // Fallback palette
  const palettes = [
    'bg-gradient-to-br from-[#3182F6] to-[#1b6cd5] text-white border-transparent',
    'bg-gradient-to-br from-[#00B06C] to-[#009057] text-white border-transparent',
    'bg-gradient-to-br from-[#A855F7] to-[#8B5CF6] text-white border-transparent',
    'bg-gradient-to-br from-[#FFAD0D] to-[#E09200] text-white border-transparent',
    'bg-gradient-to-br from-[#64748B] to-[#475569] text-white border-transparent',
    'bg-gradient-to-br from-[#EC4899] to-[#D946EF] text-white border-transparent',
  ];
  
  let hash = 0;
  for (let i = 0; i < path.length; i++) {
    hash = path.charCodeAt(i) + ((hash << 5) - hash);
  }
  const index = Math.abs(hash) % palettes.length;
  return palettes[index];
};

// Recursive Treemap Block Renderer
const TreemapNode: React.FC<{
  node: FolderNode;
  x: number;
  y: number;
  w: number;
  h: number;
  depth: number;
  maxDepth: number;
  onNodeSelect: (node: FolderNode) => void;
  onShowToast: (msg: string) => void;
  formatBytes: (b: number) => string;
  searchQuery?: string;
  onNodeHover: (path: string | null) => void;
  hoveredPath: string | null;
}> = ({ node, x, y, w, h, depth, maxDepth, onNodeSelect, onShowToast, formatBytes, searchQuery, onNodeHover, hoveredPath }) => {
  const children = node.children || [];
  const validChildren = children
    .filter(c => c.size > 0)
    .sort((a, b) => b.size - a.size);

  const isDir = node.is_dir;
  const isLeaf = !isDir || validChildren.length === 0 || depth >= maxDepth || w < 12 || h < 12;

  // CSS Class styling with color codes matching extension types
  const getBlockStyle = () => {
    if (isDir) {
      if (!isLeaf) {
        if (depth === 0) return 'bg-toss-gray-50/50 border-toss-gray-300 dark:bg-slate-900/40 dark:border-slate-800';
        if (depth === 1) return 'bg-white/40 border-toss-gray-250 dark:bg-slate-800/20 dark:border-slate-800';
        return 'bg-toss-gray-100/30 border-toss-gray-200/50 dark:bg-slate-850/10 dark:border-slate-700/50';
      } else {
        return getNodeColorClass(node.name, node.path);
      }
    }

    // Leaf Files: Gradient styling by file format/extension
    const parts = node.name.split('.');
    const ext = parts.length > 1 ? parts.pop()?.toLowerCase() || '' : '';

    if (['psd', 'png', 'jpg', 'jpeg', 'gif', 'svg', 'ai', 'pdf'].includes(ext)) {
      return 'bg-gradient-to-br from-orange-400 to-rose-500 text-white border-transparent';
    }
    if (['zip', 'rar', '7z', 'tar', 'gz', 'exe', 'msi', 'bin'].includes(ext)) {
      return 'bg-gradient-to-br from-purple-500 to-indigo-600 text-white border-transparent';
    }
    if (['xlsx', 'xls', 'docx', 'doc', 'pptx', 'ppt', 'txt', 'md'].includes(ext)) {
      return 'bg-gradient-to-br from-emerald-400 to-teal-500 text-white border-transparent';
    }
    if (['ts', 'tsx', 'js', 'jsx', 'json', 'css', 'html', 'rs', 'py', 'c', 'cpp'].includes(ext)) {
      return 'bg-gradient-to-br from-sky-400 to-blue-500 text-white border-transparent';
    }
    return 'bg-gradient-to-br from-slate-400 to-slate-500 text-white border-slate-300 dark:border-slate-700';
  };

  const handleBlockClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    onNodeSelect(node);
  };

  const handleBlockDoubleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (isDir) {
      onNodeSelect(node);
      onShowToast(`폴더 내부로 진입했습니다: ${node.name}`);
    } else {
      onShowToast(`파일 정보: ${node.name} (${formatBytes(node.size)})`);
    }
  };

  const borderClass = isDir ? 'border' : 'border border-black/5 dark:border-white/5';
  const roundedClass = 'rounded-2xl';

  const isMatched = searchQuery ? checkMatch(node, searchQuery) : true;
  const searchOpacityClass = searchQuery ? (isMatched ? 'opacity-100 ring-2 ring-toss-blue/60 z-20 scale-[1.01]' : 'opacity-20') : '';
  const isAncestorOfHovered = hoveredPath ? hoveredPath.startsWith(node.path) : false;
  const hoverOutlineClass = isAncestorOfHovered ? 'ring-2 ring-toss-blue/45 dark:ring-toss-blue/60 z-20' : '';

  if (isLeaf) {
    const isVerySmall = w < 8 || h < 6;
    const isSmallText = w < 12 || h < 8;
    const paddingClass = w < 15 || h < 15 ? 'p-2.5' : 'p-5';

    return (
      <div
        onClick={handleBlockClick}
        onDoubleClick={handleBlockDoubleClick}
        onMouseEnter={() => onNodeHover(node.path)}
        onMouseLeave={() => onNodeHover(null)}
        style={{
          position: 'absolute',
          left: `${x}%`,
          top: `${y}%`,
          width: `${w}%`,
          height: `${h}%`,
          padding: '3px',
          boxSizing: 'border-box'
        }}
        className={`transition-all duration-300 ease-out hover:scale-[1.015] hover:brightness-105 active:scale-[0.99] z-10 ${searchOpacityClass}`}
      >
        <div
          className={`w-full h-full ${paddingClass} flex flex-col justify-start items-start overflow-hidden shadow-sm select-none transition-all ${borderClass} ${roundedClass} ${getBlockStyle()} ${hoverOutlineClass}`}
          title={`${node.name}\n크기: ${formatBytes(node.size)}`}
        >
          {!isVerySmall && (
            <div className="flex flex-col text-left overflow-hidden w-full">
              <span className={`font-extrabold truncate leading-tight w-full ${w < 15 || h < 15 ? 'text-xs' : 'text-sm sm:text-base'}`}>
                {node.name}
              </span>
              {!isSmallText && (
                <span className={`opacity-80 font-bold ${w < 15 || h < 15 ? 'text-[10px] mt-0.5' : 'text-xs sm:text-sm mt-1.5'}`}>
                  {formatBytes(node.size)}
                </span>
              )}
            </div>
          )}
        </div>
      </div>
    );
  }

  // Directory block rendering recursively
  return (
    <div
      style={{
        position: 'absolute',
        left: `${x}%`,
        top: `${y}%`,
        width: `${w}%`,
        height: `${h}%`,
        padding: '5px',
        boxSizing: 'border-box'
      }}
      className={`group/dir transition-all duration-300 ${searchOpacityClass}`}
      onMouseEnter={() => onNodeHover(node.path)}
      onMouseLeave={() => onNodeHover(null)}
    >
      <div
        onClick={handleBlockClick}
        onDoubleClick={handleBlockDoubleClick}
        className={`w-full h-full rounded-2xl flex flex-col overflow-hidden transition-all shadow-sm ${borderClass} ${getBlockStyle()} hover:shadow-toss dark:border-slate-800 ${hoverOutlineClass}`}
      >
        {/* Directory Header label */}
        <div className="h-[28px] px-3 shrink-0 flex items-center justify-between text-xs text-toss-gray-650 dark:text-slate-450 font-bold border-b border-toss-gray-200/40 dark:border-slate-800/40 select-none bg-toss-gray-100/10 dark:bg-slate-900/10">
          <div className="flex items-center gap-1.5 overflow-hidden pr-2">
            <Folder className="w-3.5 h-3.5 text-amber-400 shrink-0" />
            <span className="truncate">{node.name}</span>
          </div>
          <span className="shrink-0">{formatBytes(node.size)}</span>
        </div>

        {/* Directory Content Area with recursive children */}
        <div className="flex-1 w-full relative min-h-0">
          {partitionRects(validChildren, 0, 0, 100, 100, w > h).map((childRect) => (
            <TreemapNode
              key={childRect.node.path}
              node={childRect.node}
              x={childRect.x}
              y={childRect.y}
              w={childRect.w}
              h={childRect.h}
              depth={depth + 1}
              maxDepth={maxDepth}
              onNodeSelect={onNodeSelect}
              onShowToast={onShowToast}
              formatBytes={formatBytes}
              searchQuery={searchQuery}
              onNodeHover={onNodeHover}
              hoveredPath={hoveredPath}
            />
          ))}
        </div>
      </div>
    </div>
  );
};

export const TreemapView: React.FC<TreemapViewProps> = ({
  rootNode,
  activeNode,
  onNodeSelect,
  onShowToast,
  searchQuery
}) => {
  const [maxDepth, setMaxDepth] = useState(3);
  const [hoveredPath, setHoveredPath] = useState<string | null>(null);

  // Format bytes helper
  const formatBytes = (bytes: number) => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
  };

  // Build breadcrumbs path from rootNode to activeNode
  const breadcrumbs = useMemo(() => {
    const list: FolderNode[] = [];
    const findPath = (current: FolderNode, targetPath: string, pathAcc: FolderNode[]): boolean => {
      const newPath = [...pathAcc, current];
      if (current.path === targetPath) {
        list.push(...newPath);
        return true;
      }
      if (current.children) {
        for (const child of current.children) {
          if (findPath(child, targetPath, newPath)) return true;
        }
      }
      return false;
    };

    findPath(rootNode, activeNode.path, []);
    return list;
  }, [rootNode, activeNode]);

  // Build dynamic breadcrumb trail path for the hovered block
  const hoveredBreadcrumbs = useMemo(() => {
    if (!hoveredPath) return [];
    const list: FolderNode[] = [];
    const findPath = (current: FolderNode, targetPath: string, pathAcc: FolderNode[]): boolean => {
      const newPath = [...pathAcc, current];
      if (current.path === targetPath) {
        list.push(...newPath);
        return true;
      }
      if (current.children) {
        for (const child of current.children) {
          if (findPath(child, targetPath, newPath)) return true;
        }
      }
      return false;
    };
    findPath(rootNode, hoveredPath, []);
    return list;
  }, [rootNode, hoveredPath]);

  const navigateUp = () => {
    if (breadcrumbs.length > 1) {
      const parent = breadcrumbs[breadcrumbs.length - 2];
      onNodeSelect(parent);
    }
  };

  const children = activeNode.children || [];
  const hasValidChildren = children.some(c => c.size > 0);

  return (
    <div className="w-full h-full flex flex-col gap-4">
      {/* Breadcrumb Trail & Depth Controls */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between bg-white dark:bg-slate-900 px-5 py-3.5 rounded-2xl border border-toss-gray-250 dark:border-slate-800 shadow-toss gap-3 shrink-0">
        <div className="flex items-center gap-1.5 overflow-x-auto whitespace-nowrap scrollbar-thin w-full sm:w-auto">
          {breadcrumbs.map((crumb, idx) => (
            <React.Fragment key={crumb.path}>
              {idx > 0 && <ChevronRight className="w-4 h-4 text-toss-gray-400 shrink-0" />}
              <button
                onClick={() => onNodeSelect(crumb)}
                className={`text-base hover:text-toss-blue transition-colors cursor-pointer ${
                  idx === breadcrumbs.length - 1
                    ? 'text-toss-gray-900 dark:text-slate-100 font-extrabold'
                    : 'text-toss-gray-500 dark:text-slate-400 font-medium'
                }`}
              >
                {crumb.name}
              </button>
            </React.Fragment>
          ))}
        </div>

        {/* Toolbar controls (Depth slider + Upper directory link) */}
        <div className="flex items-center gap-4 shrink-0 w-full sm:w-auto justify-between sm:justify-end">
          <div className="flex items-center gap-2 text-sm font-bold text-toss-gray-650 dark:text-slate-350">
            <span>표시 깊이:</span>
            <CustomSelect
              value={maxDepth}
              onChange={(e) => setMaxDepth(Number(e.target.value))}
              className="bg-toss-gray-105 dark:bg-slate-800 border-none rounded-lg px-2.5 py-1.5 text-xs font-semibold focus:outline-none cursor-pointer"
            >
              <option value={1}>1단계 (직접 하위)</option>
              <option value={2}>2단계</option>
              <option value={3}>3단계 (기본)</option>
              <option value={4}>4단계 (상세)</option>
            </CustomSelect>
          </div>

          {breadcrumbs.length > 1 && (
            <button
              onClick={navigateUp}
              className="text-sm text-toss-blue hover:text-toss-blue-hover flex items-center gap-1.5 font-bold hover:underline bg-toss-blue-light dark:bg-toss-blue/20 dark:text-toss-blue px-3.5 py-2 rounded-full shrink-0 cursor-pointer"
            >
              <ArrowUpLeft className="w-4 h-4" />
              <span>상위 폴더로</span>
            </button>
          )}
        </div>
      </div>

      {/* Nested Treemap Canvas */}
      <div
        id="treemap-canvas"
        className="flex-1 w-full bg-toss-gray-105 dark:bg-slate-950 rounded-2xl relative overflow-hidden min-h-0 border border-toss-gray-200/50 dark:border-slate-800/80 shadow-inner"
      >
        {!hasValidChildren ? (
          <div className="absolute inset-0 flex flex-col items-center justify-center text-toss-gray-500 dark:text-slate-450">
            <Folder className="w-12 h-12 mb-2 text-toss-gray-300 dark:text-slate-700 animate-pulse" />
            <p className="text-base font-semibold">용량이 있는 파일 또는 하위 폴더가 없습니다.</p>
          </div>
        ) : (
          <div className="absolute inset-0 p-1.5">
            {partitionRects(
              children.filter(c => c.size > 0).sort((a, b) => b.size - a.size),
              0,
              0,
              100,
              100,
              true
            ).map((rect) => (
              <TreemapNode
                key={rect.node.path}
                node={rect.node}
                x={rect.x}
                y={rect.y}
                w={rect.w}
                h={rect.h}
                depth={1}
                maxDepth={maxDepth}
                onNodeSelect={onNodeSelect}
                onShowToast={onShowToast}
                formatBytes={formatBytes}
                searchQuery={searchQuery}
                onNodeHover={setHoveredPath}
                hoveredPath={hoveredPath}
              />
            ))}
          </div>
        )}
      </div>

      {/* Dynamic Breadcrumb Hierarchy Trail on Hover */}
      <div className="bg-white dark:bg-slate-900 border border-toss-gray-250 dark:border-slate-800 rounded-2xl p-4 flex items-center min-h-[56px] select-none shadow-sm text-sm font-bold transition-all shrink-0">
        <span className="text-toss-gray-400 dark:text-slate-500 mr-3 shrink-0">하이어라키 경로:</span>
        {hoveredBreadcrumbs.length === 0 ? (
          <span className="text-toss-gray-400 dark:text-slate-500 font-medium">트리맵 블록 위에 마우스를 올리면 연결된 디렉토리 경로가 실시간으로 여기에 보여집니다.</span>
        ) : (
          <div className="flex items-center gap-1.5 overflow-x-auto whitespace-nowrap scrollbar-none pr-1">
            {hoveredBreadcrumbs.map((crumb, idx) => (
              <React.Fragment key={crumb.path}>
                {idx > 0 && <ChevronRight className="w-4 h-4 text-toss-gray-300 dark:text-slate-700 shrink-0" />}
                <span className={`flex items-center gap-1 ${idx === hoveredBreadcrumbs.length - 1 ? 'text-toss-blue dark:text-toss-blue font-extrabold' : 'text-toss-gray-700 dark:text-slate-350'}`}>
                  {crumb.is_dir ? '📁' : '📄'} <span>{crumb.name}</span>
                </span>
              </React.Fragment>
            ))}
          </div>
        )}
      </div>

      {/* Logarithmic Size Legend Indicator (mockup style) */}
      <div className="bg-white dark:bg-slate-900 border border-toss-gray-250 dark:border-slate-800 rounded-2xl p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 shadow-sm select-none shrink-0 text-xs font-bold text-toss-gray-800 dark:text-slate-200">
        <div className="flex items-center gap-3 shrink-0">
          <span className="text-sm font-extrabold text-toss-gray-700 dark:text-slate-350">크기 범례</span>
        </div>
        <div className="flex-1 flex flex-col gap-1.5 max-w-xl w-full">
          {/* Gradient bar from Green (small) -> Blue (medium) -> Purple (large) */}
          <div className="h-2 w-full rounded-full bg-gradient-to-r from-[#00B06C] via-[#3182F6] to-[#A855F7]"></div>
          {/* Legend Ticks */}
          <div className="flex justify-between text-xs text-toss-gray-400 dark:text-slate-500 px-1 font-semibold">
            <span>10MB 미만</span>
            <span>10MB</span>
            <span>100MB</span>
            <span>1GB</span>
            <span>10GB</span>
            <span>100GB+</span>
          </div>
        </div>
      </div>
    </div>
  );
};
