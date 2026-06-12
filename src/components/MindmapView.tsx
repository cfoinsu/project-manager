import React, { useState, useEffect, useCallback, useMemo } from 'react';
import ReactFlow, {
  Controls,
  Background,
  useNodesState,
  useEdgesState,
  Handle,
  Position
} from 'reactflow';
import type { Node, Edge, NodeProps } from 'reactflow';
import type { FolderNode } from '../types';
import { Folder, ChevronRight, ChevronDown, HelpCircle, HardDrive } from 'lucide-react';


// Custom Node Component to match Toss Aesthetics
const FolderAtlasNode: React.FC<NodeProps> = ({ data }) => {
  const { node, isExpanded, onToggleExpand, onSelectNode, isSelected, isSearchMatch } = data;
  
  // Format bytes helper
  const formatBytes = (bytes: number) => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
  };

  const hasChildren = node.is_dir && node.children && node.children.length > 0;

  return (
    <div
      onClick={() => onSelectNode(node)}
      className={`border px-4 py-3 rounded-2xl shadow-toss font-sans min-w-[210px] max-w-[300px] bg-white dark:bg-slate-800 text-toss-gray-800 dark:text-slate-100 transition-all cursor-pointer ${
        isSelected 
          ? 'border-toss-blue border-2 ring-4 ring-toss-blue/10 dark:ring-toss-blue/30' 
          : 'border-toss-gray-200 dark:border-slate-700 hover:border-toss-gray-400 dark:hover:border-slate-500'
      } ${isSearchMatch ? 'search-match' : ''}`}
    >
      <Handle type="target" position={Position.Left} className="!bg-toss-gray-400 dark:!bg-slate-600" />
      
      <div className="flex items-center justify-between gap-2 overflow-hidden">
        <div className="flex items-center gap-2.5 overflow-hidden">
          <Folder className={`w-5.5 h-5.5 shrink-0 ${node.is_dir ? 'text-amber-400 dark:text-amber-500' : 'text-toss-gray-400'}`} />
          <div className="flex flex-col text-left overflow-hidden">
            <span className="text-base font-extrabold truncate leading-tight">{node.name}</span>
            <span className="text-xs text-toss-gray-400 dark:text-slate-500 leading-none mt-1">
              {formatBytes(node.size)}
            </span>
          </div>
        </div>

        {/* Expand / Collapse Button inside node */}
        {hasChildren && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              onToggleExpand(node.path);
            }}
            className="w-6 h-6 rounded-lg bg-toss-gray-100 dark:bg-slate-700 hover:bg-toss-blue-light dark:hover:bg-toss-blue/20 hover:text-toss-blue flex items-center justify-center transition-colors shrink-0"
          >
            {isExpanded ? (
              <ChevronDown className="w-3.5 h-3.5" />
            ) : (
              <ChevronRight className="w-3.5 h-3.5" />
            )}
          </button>
        )}
      </div>

      <div className="mt-2.5 pt-2.5 border-t border-toss-gray-100 dark:border-slate-700 flex justify-between text-xs text-toss-gray-500 dark:text-slate-400">
        <span>폴더: {node.folder_count}개</span>
        <span>파일: {node.file_count}개</span>
      </div>

      <Handle type="source" position={Position.Right} className="!bg-toss-gray-400 dark:!bg-slate-600" />
    </div>
  );
};

// Register custom node type
const nodeTypes = {
  folderAtlasNode: FolderAtlasNode
};

interface MindmapViewProps {
  rootNode: FolderNode;
  selectedNode: FolderNode | null;
  onNodeSelect: (node: FolderNode) => void;
  searchQuery?: string;
}

export const MindmapView: React.FC<MindmapViewProps> = ({
  rootNode,
  selectedNode,
  onNodeSelect,
  searchQuery
}) => {
  const [nodes, setNodes, onNodesChange] = useNodesState([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);
  const [expandedPaths, setExpandedPaths] = useState<Set<string>>(new Set());

  // Reset expanded nodes to all folder paths when root node changes
  useEffect(() => {
    const allPaths = new Set<string>();
    const collect = (n: FolderNode) => {
      if (n.is_dir) {
        allPaths.add(n.path);
        n.children?.forEach(collect);
      }
    };
    collect(rootNode);
    setExpandedPaths(allPaths);
  }, [rootNode]);

  const toggleExpandPath = useCallback((path: string) => {
    setExpandedPaths(prev => {
      const next = new Set(prev);
      if (next.has(path)) {
        next.delete(path);
      } else {
        next.add(path);
      }
      return next;
    });
  }, []);

  // Construct flow layout from current expanded set
  useEffect(() => {
    const newNodes: Node[] = [];
    const newEdges: Edge[] = [];

    // Helper map to find nodes by path
    const nodeMap = new Map<string, FolderNode>();
    const registerNodes = (n: FolderNode) => {
      nodeMap.set(n.path, n);
      if (n.children) {
        n.children.forEach(registerNodes);
      }
    };
    registerNodes(rootNode);

    // Keep track of levels and Y spacing
    const levelCounts: Record<number, number> = {};
    const levelSpacingX = 320;
    const nodeSpacingY = 110;

    // Traverse tree and compile active nodes/edges based on expanded paths
    const traverse = (path: string, parentPath: string | null = null, depth = 0) => {
      const current = nodeMap.get(path);
      if (!current) return;

      // Increment level counter
      levelCounts[depth] = (levelCounts[depth] || 0) + 1;
      const indexInLevel = levelCounts[depth] - 1;

      // Position logic: Root is centered, children distributed vertically
      const x = depth * levelSpacingX;
      // We calculate y centered around 250px
      const y = indexInLevel * nodeSpacingY - (depth * 20); // slightly stagger depth

      const isExpanded = expandedPaths.has(path);
      const isSelected = selectedNode?.path === path;
      const isSearchMatch = searchQuery ? current.name.toLowerCase().includes(searchQuery.toLowerCase()) : false;

      newNodes.push({
        id: path,
        type: 'folderAtlasNode',
        position: { x, y },
        data: {
          node: current,
          isExpanded,
          isSelected,
          isSearchMatch,
          onToggleExpand: toggleExpandPath,
          onSelectNode: onNodeSelect
        }
      });

      if (parentPath) {
        newEdges.push({
          id: `${parentPath}-${path}`,
          source: parentPath,
          target: path,
          type: 'smoothstep',
          animated: isSelected || parentPath === selectedNode?.path || isSearchMatch,
          style: {
            strokeWidth: isSelected ? 3 : isSearchMatch ? 2.5 : 2,
            stroke: isSelected ? '#3182F6' : isSearchMatch ? '#3182F6' : '#cbd5e1'
          }
        });
      }

      // Traversed children only if this node is expanded
      if (isExpanded && current.children) {
        // limit rendering of files in the React Flow to avoid cluttering, only render folders
        const foldersOnly = current.children.filter(c => c.is_dir);
        foldersOnly.forEach(child => {
          traverse(child.path, path, depth + 1);
        });
      }
    };

    traverse(rootNode.path);

    // Dynamic vertical centering adjustment to prevent nodes overlapping
    // We adjust y values to center each column dynamically
    const columns: Record<number, Node[]> = {};
    newNodes.forEach(node => {
      const col = Math.floor(node.position.x / levelSpacingX);
      columns[col] = columns[col] || [];
      columns[col].push(node);
    });

    Object.keys(columns).forEach(colKey => {
      const col = columns[Number(colKey)];
      const totalHeight = (col.length - 1) * nodeSpacingY;
      const offset = -totalHeight / 2 + 200; // Center around y=200
      col.forEach((node, index) => {
        node.position.y = offset + index * nodeSpacingY;
      });
    });

    setNodes(newNodes);
    setEdges(newEdges);
  }, [rootNode, expandedPaths, selectedNode, searchQuery, toggleExpandPath, onNodeSelect, setNodes, setEdges]);

  // Adjust view when root changes
  const fitViewOptions = useMemo(() => ({ padding: 0.2 }), []);

  return (
    <div className="w-full h-full flex flex-col relative bg-white dark:bg-slate-900 rounded-2xl overflow-hidden border border-toss-gray-200/50 dark:border-slate-800/80">
      
      {/* Mindmap Guide header */}
      <div className="absolute top-4 left-4 z-10 flex flex-wrap gap-2.5">
        <div className="bg-white/80 dark:bg-slate-800/80 backdrop-blur-md px-3.5 py-2 rounded-full text-xs text-toss-gray-600 dark:text-slate-300 shadow-toss border border-toss-gray-200/50 dark:border-slate-700/50 flex items-center gap-1.5 select-none">
          <HardDrive className="w-4 h-4 text-toss-blue" />
          <span>마인드맵에서는 <b>폴더 노드</b>만 표시됩니다.</span>
        </div>
        <div className="bg-white/80 dark:bg-slate-800/80 backdrop-blur-md px-3.5 py-2 rounded-full text-xs text-toss-gray-650 dark:text-slate-300 shadow-toss border border-toss-gray-200/50 dark:border-slate-700/50 flex items-center gap-1.5 select-none">
          <HelpCircle className="w-4 h-4 text-toss-blue" />
          <span><b>[+] / [-]</b> 버튼으로 하위 폴더를 여닫을 수 있습니다.</span>
        </div>
      </div>

      <div className="flex-1 w-full h-full">
        <ReactFlow
          nodes={nodes}
          edges={edges}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          nodeTypes={nodeTypes}
          fitView
          fitViewOptions={fitViewOptions}
          minZoom={0.1}
          maxZoom={1.5}
        >
          <Background color="#cbd5e1" gap={16} size={1} />
          <Controls showInteractive={false} />
        </ReactFlow>
      </div>
    </div>
  );
};
