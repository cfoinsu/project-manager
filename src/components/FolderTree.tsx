import React, { useState, useEffect, useMemo } from 'react';
import type { FolderNode } from '../types';
import { Folder, FileText, FileSpreadsheet, Image, FileCode, ChevronRight, ChevronDown, MoreVertical, ExternalLink, Copy, FolderOpen } from 'lucide-react';
import { openFile, openInExplorer, writeFileBytes, moveFileOrDir } from '../utils/tauriBridge';
import { useProjectStore } from '../store/projectStore';

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
  const [dragOverPath, setDragOverPath] = useState<string | null>(null);

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

  const [fileTypeFilter, setFileTypeFilter] = useState<'all' | 'document' | 'image' | 'code' | 'other'>('all');

  const docExtensions = ['doc', 'docx', 'xls', 'xlsx', 'ppt', 'pptx', 'pdf', 'hwp', 'hwpx', 'txt', 'csv'];
  const imageExtensions = ['png', 'jpg', 'jpeg', 'gif', 'bmp', 'svg', 'webp', 'psd', 'key', 'fig'];
  const codeExtensions = ['html', 'css', 'js', 'ts', 'tsx', 'py', 'rs', 'json', 'java', 'cs', 'cpp', 'go', 'sh', 'xml', 'yaml', 'yml'];

  const isMatchFilter = (filename: string, filter: string) => {
    const ext = filename.split('.').pop()?.toLowerCase() || '';
    if (filter === 'document') return docExtensions.includes(ext);
    if (filter === 'image') return imageExtensions.includes(ext);
    if (filter === 'code') return codeExtensions.includes(ext);
    if (filter === 'other') {
      return !docExtensions.includes(ext) && !imageExtensions.includes(ext) && !codeExtensions.includes(ext);
    }
    return true; // 'all'
  };

  // Compute paths that should be visible (directories that contain matching files or files themselves)
  const visiblePathsAndFiles = useMemo(() => {
    const visibleDirPaths = new Set<string>();
    const visibleFilePaths = new Set<string>();

    const checkNode = (n: FolderNode): boolean => {
      if (!n.is_dir) {
        const matchesSearch = !searchQuery || n.name.toLowerCase().includes(searchQuery.toLowerCase());
        const matchesFilter = fileTypeFilter === 'all' || isMatchFilter(n.name, fileTypeFilter);
        const isVisible = matchesSearch && matchesFilter;
        if (isVisible) {
          visibleFilePaths.add(n.path);
        }
        return isVisible;
      }

      let hasVisibleChild = false;
      if (n.children) {
        for (const child of n.children) {
          if (checkNode(child)) {
            hasVisibleChild = true;
          }
        }
      }

      const matchesSearchSelf = searchQuery ? n.name.toLowerCase().includes(searchQuery.toLowerCase()) : false;
      const isVisible = hasVisibleChild || matchesSearchSelf;
      if (isVisible) {
        visibleDirPaths.add(n.path);
      }
      return isVisible;
    };

    checkNode(node);
    return { dirs: visibleDirPaths, files: visibleFilePaths };
  }, [node, searchQuery, fileTypeFilter]);

  // Expand folders automatically when search query or filter matches their children
  useEffect(() => {
    if (searchQuery || fileTypeFilter !== 'all') {
      const newExpanded = { ...expanded };
      visiblePathsAndFiles.dirs.forEach(path => {
        newExpanded[path] = true;
      });
      setExpanded(newExpanded);
    }
  }, [visiblePathsAndFiles, searchQuery, fileTypeFilter]);

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

  // File type icon selector
  const getFileIcon = (name: string, isSelected: boolean) => {
    const ext = name.split('.').pop()?.toLowerCase() || '';
    const iconClass = `w-4 h-4 shrink-0 ${isSelected ? 'text-toss-blue' : ''}`;
    
    if (['xls', 'xlsx', 'csv'].includes(ext)) {
      return <FileSpreadsheet className={`${iconClass} ${isSelected ? '' : 'text-emerald-500'}`} />;
    }
    if (['png', 'jpg', 'jpeg', 'gif', 'psd', 'key', 'fig'].includes(ext)) {
      return <Image className={`${iconClass} ${isSelected ? '' : 'text-amber-500'}`} />;
    }
    if (['html', 'css', 'js', 'ts', 'tsx', 'py', 'rs', 'json', 'java', 'cs', 'cpp', 'go', 'sh', 'txt'].includes(ext)) {
      return <FileCode className={`${iconClass} ${isSelected ? '' : 'text-purple-500'}`} />;
    }
    return <FileText className={`${iconClass} ${isSelected ? '' : 'text-toss-blue'}`} />;
  };

  // Recursive tree renderer
  const renderTreeNode = (n: FolderNode): React.ReactNode => {
    const isExpanded = !!expanded[n.path];
    const isSelected = selectedNode?.path === n.path;
    
    // Filtering based on search query and file type filter
    if (n.path !== node.path) {
      if (n.is_dir && !visiblePathsAndFiles.dirs.has(n.path)) {
        return null;
      }
      if (!n.is_dir && !visiblePathsAndFiles.files.has(n.path)) {
        return null;
      }
    }

    const isDragOver = dragOverPath === n.path;

    return (
      <div key={n.path} className="select-none">
        {/* Row element */}
        <div
          onClick={() => handleNodeClick(n)}
          onDoubleClick={() => handleNodeDoubleClick(n)}
          onContextMenu={(e) => handleContextMenu(e, n)}
          style={{ paddingLeft: `${n.depth * 14 + 8}px` }}
          className={`group cds--tree-node ${isSelected ? 'cds--tree-node-active' : ''} ${isDragOver ? 'bg-toss-blue/10 border border-dashed border-toss-blue/40 rounded-xl' : ''}`}
          draggable={n.path !== node.path}
          onDragStart={(e) => {
            e.dataTransfer.setData('text/plain', n.path);
            e.dataTransfer.effectAllowed = 'move';
          }}
          onDragOver={(e) => {
            if (n.is_dir) {
              e.preventDefault();
              e.dataTransfer.dropEffect = 'move';
            }
          }}
          onDragEnter={(e) => {
            if (n.is_dir) {
              e.preventDefault();
              setDragOverPath(n.path);
            }
          }}
          onDragLeave={() => {
            setDragOverPath(null);
          }}
          onDrop={async (e) => {
            e.preventDefault();
            setDragOverPath(null);
            if (!n.is_dir) return;

            // Check if dragging files from outside
            const files = e.dataTransfer.files;
            if (files && files.length > 0) {
              onShowToast(`${files.length}개 파일 업로드 중...`);
              try {
                for (let i = 0; i < files.length; i++) {
                  const file = files[i];
                  const destPath = `${n.path}\\${file.name}`;
                  const arrayBuffer = await file.arrayBuffer();
                  const bytes = new Uint8Array(arrayBuffer);
                  await writeFileBytes(destPath, bytes);
                }
                onShowToast('파일 업로드 완료!');
                await useProjectStore.getState().scanAndSync();
              } catch (err) {
                onShowToast(`업로드 오류: ${err}`);
              }
              return;
            }

            // Dragging folder/file from inside the tree
            const srcPath = e.dataTransfer.getData('text/plain');
            if (srcPath && srcPath !== n.path) {
              if (n.path.startsWith(srcPath + '\\') || n.path === srcPath) {
                onShowToast('자기 자신이나 하위 폴더로는 이동할 수 없습니다.');
                return;
              }

              const name = srcPath.split('\\').pop() || srcPath.split('/').pop() || '';
              const destPath = `${n.path}\\${name}`;

              onShowToast('파일 이동 중...');
              try {
                await moveFileOrDir(srcPath, destPath);
                onShowToast('이동 완료!');
                await useProjectStore.getState().scanAndSync();
              } catch (err) {
                onShowToast(`이동 오류: ${err}`);
              }
            }
          }}
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
              getFileIcon(n.name, isSelected)
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
    <div className="flex flex-col flex-1 min-h-0 pr-1 w-full gap-3">
      {/* Combined Tree Toolbar & File Type Filter */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 shrink-0 select-none pb-2 border-b border-toss-gray-100 dark:border-slate-800/60">
        {/* Left Side: Expand / Collapse All */}
        <div className="flex gap-1.5">
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

        {/* Right Side: File Type Filters */}
        <div className="flex flex-wrap gap-1">
          {(['all', 'document', 'image', 'code', 'other'] as const).map(filter => {
            const labels: Record<string, string> = {
              all: '전체',
              document: '문서',
              image: '이미지',
              code: '코드',
              other: '기타'
            };
            const isActive = fileTypeFilter === filter;
            return (
              <button
                key={filter}
                onClick={() => setFileTypeFilter(filter)}
                className={`px-2.5 py-1.5 rounded-xl text-[10.5px] font-bold border transition-all cursor-pointer ${
                  isActive
                    ? 'bg-toss-blue text-white border-toss-blue'
                    : 'bg-slate-50 dark:bg-slate-850 text-toss-gray-650 dark:text-slate-355 border-toss-gray-200/50 dark:border-slate-800 hover:border-toss-blue'
                }`}
              >
                {labels[filter]}
              </button>
            );
          })}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto min-h-0 w-full pr-1">
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
