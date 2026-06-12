import React, { useState, useEffect, useMemo } from 'react';
import type { FolderNode } from '../types';
import { Folder, File, ChevronRight, ChevronDown, MoreVertical, ExternalLink, Copy, FolderOpen } from 'lucide-react';
import { openFile, openInExplorer } from '../utils/tauriBridge';

interface FolderTreeProps {
  node: FolderNode;
  searchQuery: string;
  onNodeSelect: (node: FolderNode) => void;
  selectedNode: FolderNode | null;
  onShowToast: (message: string) => void;
}

export const FolderTree: React.FC<FolderTreeProps> = ({
  node,
  searchQuery,
  onNodeSelect,
  selectedNode,
  onShowToast
}) => {
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});

  const expandAll = () => {
    const next: Record<string, boolean> = {};
    const traverse = (n: FolderNode) => {
      if (n.is_dir) {
        next[n.path] = true;
        n.children?.forEach(traverse);
      }
    };
    traverse(node);
    setExpanded(next);
  };

  const collapseAll = () => {
    setExpanded({});
  };

  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; path: string; isDir: boolean; name: string } | null>(null);

  // Close context menu on click elsewhere
  useEffect(() => {
    const handleGlobalClick = () => setContextMenu(null);
    window.addEventListener('click', handleGlobalClick);
    return () => window.removeEventListener('click', handleGlobalClick);
  }, []);

  // Compute paths that should be expanded based on search query
  const searchMatchPaths = useMemo(() => {
    if (!searchQuery) return new Set<string>();

    const matches = new Set<string>();
    const checkNode = (n: FolderNode): boolean => {
      let isChildMatch = false;
      if (n.children) {
        for (const child of n.children) {
          if (checkNode(child)) {
            isChildMatch = true;
          }
        }
      }
      
      const isSelfMatch = n.name.toLowerCase().includes(searchQuery.toLowerCase());
      const hasMatch = isSelfMatch || isChildMatch;
      
      if (hasMatch && n.is_dir) {
        matches.add(n.path);
      }
      return hasMatch;
    };

    checkNode(node);
    return matches;
  }, [node, searchQuery]);

  // Expand folders automatically when search query matches their children
  useEffect(() => {
    if (searchQuery) {
      const newExpanded = { ...expanded };
      searchMatchPaths.forEach(path => {
        newExpanded[path] = true;
      });
      setExpanded(newExpanded);
    }
  }, [searchMatchPaths, searchQuery]);

  const toggleExpand = (path: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setExpanded(prev => ({ ...prev, [path]: !prev[path] }));
  };

  const handleNodeClick = (n: FolderNode) => {
    onNodeSelect(n);
  };

  const handleNodeDoubleClick = async (n: FolderNode) => {
    try {
      if (n.is_dir) {
        await openInExplorer(n.path);
        onShowToast(`윈도우 탐색기에서 폴더를 열었습니다: ${n.name}`);
      } else {
        await openFile(n.path);
        onShowToast(`파일을 실행했습니다: ${n.name}`);
      }
    } catch (err) {
      onShowToast(`오류 발생: ${err}`);
    }
  };

  const handleContextMenu = (e: React.MouseEvent, n: FolderNode) => {
    e.preventDefault();
    e.stopPropagation();
    setContextMenu({
      x: e.clientX,
      y: e.clientY,
      path: n.path,
      isDir: n.is_dir,
      name: n.name
    });
    onNodeSelect(n);
  };

  const handleContextAction = async (action: string) => {
    if (!contextMenu) return;
    const { path, name } = contextMenu;

    try {
      if (action === 'open') {
        if (contextMenu.isDir) {
          await openInExplorer(path);
          onShowToast(`폴더를 열었습니다: ${name}`);
        } else {
          await openFile(path);
          onShowToast(`파일을 열었습니다: ${name}`);
        }
      } else if (action === 'copy_path') {
        await navigator.clipboard.writeText(path);
        onShowToast(`경로가 복사되었습니다: ${path}`);
      } else if (action === 'copy_name') {
        await navigator.clipboard.writeText(name);
        onShowToast(`이름이 복사되었습니다: ${name}`);
      } else if (action === 'show_explorer') {
        await openInExplorer(path);
        onShowToast(`탐색기에서 열었습니다: ${name}`);
      }
    } catch (err) {
      onShowToast(`오류 발생: ${err}`);
    }
    setContextMenu(null);
  };

  // Human-readable size formatter
  const formatBytes = (bytes: number) => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
  };

  // Recursive tree renderer
  const renderTreeNode = (n: FolderNode): React.ReactNode => {
    const isExpanded = !!expanded[n.path];
    const isSelected = selectedNode?.path === n.path;
    
    // Search query filtering: hide nodes that don't match and don't contain matching descendants
    if (searchQuery) {
      const isMatch = n.name.toLowerCase().includes(searchQuery.toLowerCase());
      const hasMatchingDescendant = searchMatchPaths.has(n.path);
      if (!isMatch && !hasMatchingDescendant) {
        return null;
      }
    }

    return (
      <div key={n.path} className="select-none">
        {/* Row element */}
        <div
          onClick={() => handleNodeClick(n)}
          onDoubleClick={() => handleNodeDoubleClick(n)}
          onContextMenu={(e) => handleContextMenu(e, n)}
          style={{ paddingLeft: `${n.depth * 14 + 8}px` }}
          className={`group cds--tree-node ${isSelected ? 'cds--tree-node-active' : ''}`}
        >
          <div className="cds--row-flex gap-1.5 overflow-hidden">
            {/* Collapse/Expand chevron */}
            {n.is_dir ? (
              <button
                onClick={(e) => toggleExpand(n.path, e)}
                className="cds--tree-chevron-btn"
              >
                {isExpanded ? (
                  <ChevronDown className="w-3.5 h-3.5 text-toss-gray-500" />
                ) : (
                  <ChevronRight className="w-3.5 h-3.5 text-toss-gray-500" />
                )}
              </button>
            ) : (
              <div className="w-5" />
            )}

            {/* Icon */}
            {n.is_dir ? (
              <Folder className={`w-4 h-4 shrink-0 ${isSelected ? 'text-toss-blue' : 'text-amber-400 dark:text-amber-500'}`} />
            ) : (
              <File className={`w-4 h-4 shrink-0 ${isSelected ? 'text-toss-blue' : 'text-toss-gray-400'}`} />
            )}

            {/* File/Folder Name with search highlighting */}
            <span className="text-base truncate">
              {searchQuery ? (
                (() => {
                  const index = n.name.toLowerCase().indexOf(searchQuery.toLowerCase());
                  if (index === -1) return n.name;
                  const before = n.name.substring(0, index);
                  const match = n.name.substring(index, index + searchQuery.length);
                  const after = n.name.substring(index + searchQuery.length);
                  return (
                    <>
                      {before}
                      <mark className="cds--tree-node-text-match">{match}</mark>
                      {after}
                    </>
                  );
                })()
              ) : (
                n.name
              )}
            </span>
          </div>

          {/* Size / Metadata info */}
          <div className="cds--tree-item-meta-container">
            <span>{formatBytes(n.size)}</span>
            <button 
              onClick={(e) => handleContextMenu(e, n)}
              className="cds--tree-action-btn"
            >
              <MoreVertical className="w-3.5 h-3.5 text-toss-gray-500" />
            </button>
          </div>
        </div>

        {/* Children container */}
        {n.is_dir && isExpanded && n.children && (
          <div className="mt-0.5">
            {n.children.map(child => renderTreeNode(child))}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="cds--column-flex cds--flex-1 min-h-0 pr-1">
      {/* Tree Toolbar */}
      <div className="cds--tree-toolbar">
        <button
          onClick={expandAll}
          className="cds--btn cds--btn-primary px-3 py-1.5 rounded-lg text-xs"
        >
          모두 펼치기
        </button>
        <button
          onClick={collapseAll}
          className="cds--btn cds--btn-secondary px-3 py-1.5 rounded-lg text-xs"
        >
          모두 접기
        </button>
      </div>

      <div className="cds--flex-1 overflow-y-auto min-h-0">
        {renderTreeNode(node)}
      </div>

      {/* Context Menu Overlay */}
      {contextMenu && (
        <div
          style={{ top: `${contextMenu.y}px`, left: `${contextMenu.x}px` }}
          className="cds--tree-context-menu-container animate-scale-in"
        >
          <button
            onClick={() => handleContextAction('open')}
            className="cds--tree-context-menu-btn"
          >
            <FolderOpen className="w-4 h-4 text-toss-gray-500" />
            <span>{contextMenu.isDir ? '폴더 열기' : '파일 실행'}</span>
          </button>
          <button
            onClick={() => handleContextAction('copy_path')}
            className="cds--tree-context-menu-btn"
          >
            <Copy className="w-4 h-4 text-toss-gray-500" />
            <span>경로 복사</span>
          </button>
          <button
            onClick={() => handleContextAction('copy_name')}
            className="cds--tree-context-menu-btn"
          >
            <Copy className="w-4 h-4 text-toss-gray-500" />
            <span>이름 복사</span>
          </button>
          <div className="border-t border-toss-gray-100 dark:border-slate-700 my-1 w-full"></div>
          <button
            onClick={() => handleContextAction('show_explorer')}
            className="cds--tree-context-menu-btn"
          >
            <ExternalLink className="w-4 h-4 text-toss-gray-500" />
            <span>탐색기에서 보기</span>
          </button>
        </div>
      )}
    </div>
  );
};
