import React, { useState, useEffect } from 'react';
import { useProjectStore } from '../store/projectStore';
import { 
  Plus, 
  Trash, 
  PlusCircle, 
  FileText, 
  ChevronRight, 
  Save, 
  FolderPlus, 
  FilePlus, 
  Folder,
  Trash2,
  ChevronDown
} from 'lucide-react';
import type { FolderTemplateNode } from '../types';
import { CustomSelect } from './CustomSelect';
import { getDocuments, type DocTemplate } from '../utils/api';

// Recursive Folder Tree Node Editor Component
interface TreeNodeEditorProps {
  node: FolderTemplateNode;
  path: number[];
  onUpdateNode: (path: number[], updatedNode: FolderTemplateNode) => void;
  onDeleteNode: (path: number[]) => void;
  docTemplates: DocTemplate[];
}

const TreeNodeEditor: React.FC<TreeNodeEditorProps> = ({
  node,
  path,
  onUpdateNode,
  onDeleteNode,
  docTemplates
}) => {
  const [isExpanded, setIsExpanded] = useState(true);

  const handleNameChange = (val: string) => {
    const updated = { ...node, name: val };
    onUpdateNode(path, updated);
  };

  const handleDocTemplateChange = (val: string) => {
    const updated = { ...node, template_doc_id: val || undefined };
    const matched = docTemplates.find(dt => dt.id === val);
    if (matched && !node.name) {
      updated.name = matched.original_name;
    }
    onUpdateNode(path, updated);
  };

  const handleAddChild = (isDir: boolean) => {
    const newChild: FolderTemplateNode = isDir 
      ? { name: '새 폴더', is_dir: true, children: [] }
      : { name: '새 파일.docx', is_dir: false };
    
    const updated = {
      ...node,
      children: [...(node.children || []), newChild]
    };
    onUpdateNode(path, updated);
    setIsExpanded(true);
  };

  const handleUpdateChild = (childIdx: number, childPath: number[], updatedChild: FolderTemplateNode) => {
    const nextChildren = [...(node.children || [])];
    
    if (childPath.length === 1) {
      nextChildren[childIdx] = updatedChild;
    } else {
      const subPath = childPath.slice(1);
      const childNode = nextChildren[childIdx];
      
      const updateSubNode = (n: FolderTemplateNode, p: number[], newVal: FolderTemplateNode): FolderTemplateNode => {
        if (p.length === 1) {
          const childrenCopy = [...(n.children || [])];
          childrenCopy[p[0]] = newVal;
          return { ...n, children: childrenCopy };
        } else {
          const childrenCopy = [...(n.children || [])];
          childrenCopy[p[0]] = updateSubNode(childrenCopy[p[0]], p.slice(1), newVal);
          return { ...n, children: childrenCopy };
        }
      };
      
      nextChildren[childIdx] = updateSubNode(childNode, subPath, updatedChild);
    }
    
    onUpdateNode(path, { ...node, children: nextChildren });
  };

  const handleDeleteChild = (childIdx: number, childPath: number[]) => {
    const nextChildren = [...(node.children || [])];
    if (childPath.length === 1) {
      nextChildren.splice(childIdx, 1);
    } else {
      const subPath = childPath.slice(1);
      const childNode = nextChildren[childIdx];
      
      const deleteSubNode = (n: FolderTemplateNode, p: number[]): FolderTemplateNode => {
        if (p.length === 1) {
          const childrenCopy = [...(n.children || [])];
          childrenCopy.splice(p[0], 1);
          return { ...n, children: childrenCopy };
        } else {
          const childrenCopy = [...(n.children || [])];
          childrenCopy[p[0]] = deleteSubNode(childrenCopy[p[0]], p.slice(1));
          return { ...n, children: childrenCopy };
        }
      };
      nextChildren[childIdx] = deleteSubNode(childNode, subPath);
    }
    onUpdateNode(path, { ...node, children: nextChildren });
  };

  return (
    <div className="flex flex-col gap-1.5 ml-4 pl-3.5 border-l border-toss-gray-200/60 dark:border-slate-800 relative py-1">
      {/* Node Info Row */}
      <div className="flex items-center gap-2 text-xs py-1 hover:bg-slate-50/50 dark:hover:bg-slate-800/30 rounded-xl pr-3">
        {node.is_dir ? (
          <button 
            type="button" 
            onClick={() => setIsExpanded(!isExpanded)} 
            className="p-1 hover:bg-toss-gray-100 dark:hover:bg-slate-800 rounded-lg text-toss-gray-400 shrink-0"
          >
            {isExpanded ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
          </button>
        ) : (
          <span className="w-5.5 shrink-0" />
        )}

        {node.is_dir ? (
          <Folder className="w-4 h-4 text-toss-blue shrink-0" />
        ) : (
          <FileText className="w-4 h-4 text-emerald-500 shrink-0" />
        )}

        <input
          type="text"
          value={node.name}
          onChange={(e) => handleNameChange(e.target.value)}
          placeholder={node.is_dir ? '폴더명 입력' : '파일명 입력'}
          required
          className="text-xs px-2.5 py-1.5 bg-white dark:bg-slate-850 border border-toss-gray-200/50 dark:border-slate-800 rounded-lg focus:outline-none focus:ring-1 focus:ring-toss-blue/60 transition-all font-semibold max-w-[160px]"
        />

        {!node.is_dir && (
          <CustomSelect
            value={node.template_doc_id || ''}
            onChange={(e) => handleDocTemplateChange(e.target.value)}
            className="text-[11px] px-2 py-1 bg-white dark:bg-slate-850 border border-toss-gray-200/50 dark:border-slate-800 rounded-lg focus:outline-none font-semibold cursor-pointer max-w-[160px]"
          >
            <option value="">(연동할 서류 양식 선택)</option>
            {docTemplates.map(dt => (
              <option key={dt.id} value={dt.id}>{dt.original_name}</option>
            ))}
          </CustomSelect>
        )}

        {/* Action Buttons */}
        <div className="flex items-center gap-1 ml-auto">
          {node.is_dir && (
            <>
              <button
                type="button"
                onClick={() => handleAddChild(true)}
                className="p-1 text-toss-blue hover:bg-toss-blue-light/50 dark:hover:bg-toss-blue/10 rounded-lg transition-colors cursor-pointer"
                title="하위 폴더 추가"
              >
                <FolderPlus className="w-3.5 h-3.5" />
              </button>
              <button
                type="button"
                onClick={() => handleAddChild(false)}
                className="p-1 text-emerald-500 hover:bg-emerald-500/10 rounded-lg transition-colors cursor-pointer"
                title="하위 파일 추가"
              >
                <FilePlus className="w-3.5 h-3.5" />
              </button>
            </>
          )}
          <button
            type="button"
            onClick={() => onDeleteNode(path)}
            className="p-1 text-toss-gray-400 hover:text-toss-red rounded-lg transition-colors cursor-pointer"
            title="삭제"
          >
            <Trash className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Recursive Children Render */}
      {node.is_dir && isExpanded && node.children && (
        <div className="flex flex-col gap-1.5">
          {node.children.map((child, idx) => (
            <TreeNodeEditor
              key={idx}
              node={child}
              path={[...path, idx]}
              onUpdateNode={(childPath, updatedChild) => handleUpdateChild(idx, childPath, updatedChild)}
              onDeleteNode={(childPath) => handleDeleteChild(idx, childPath)}
              docTemplates={docTemplates}
            />
          ))}
          {node.children.length === 0 && (
            <p className="text-[10px] text-toss-gray-400 italic ml-6 py-1 select-none">빈 폴더</p>
          )}
        </div>
      )}
    </div>
  );
};


// Main Folder Template Management Component
export const FolderTemplateManagement: React.FC = () => {
  const { folderTemplates, addFolderTemplateAction, removeFolderTemplateAction, loadFolderTemplates } = useProjectStore();
  const [selectedTemplateId, setSelectedTemplateId] = useState<string | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [docTemplates, setDocTemplates] = useState<DocTemplate[]>([]);

  // Form states for creation
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [structure, setStructure] = useState<FolderTemplateNode[]>([
    {
      name: '01_기획',
      is_dir: true,
      children: [
        { name: '요구사항정의서.docx', is_dir: false }
      ]
    },
    {
      name: '02_디자인',
      is_dir: true,
      children: []
    }
  ]);

  useEffect(() => {
    loadFolderTemplates();
    const loadDocs = async () => {
      try {
        const docs = await getDocuments();
        setDocTemplates(docs);
      } catch (e) {
        console.error(e);
      }
    };
    loadDocs();
  }, []);

  // Set default selected template
  useEffect(() => {
    if (folderTemplates.length > 0 && !selectedTemplateId && !isCreating) {
      setSelectedTemplateId(folderTemplates[0].id);
    }
  }, [folderTemplates]);

  const activeTemplate = folderTemplates.find(t => t.id === selectedTemplateId) || folderTemplates[0];

  const handleAddRootFolder = () => {
    setStructure([
      ...structure,
      { name: `새 폴더`, is_dir: true, children: [] }
    ]);
  };

  const handleUpdateNode = (path: number[], updatedNode: FolderTemplateNode) => {
    const next = [...structure];
    
    const updateRecurse = (nodeList: FolderTemplateNode[], p: number[]): FolderTemplateNode[] => {
      const copy = [...nodeList];
      const idx = p[0];
      if (p.length === 1) {
        copy[idx] = updatedNode;
      } else {
        copy[idx] = {
          ...copy[idx],
          children: updateRecurse(copy[idx].children || [], p.slice(1))
        };
      }
      return copy;
    };
    
    setStructure(updateRecurse(next, path));
  };

  const handleDeleteNode = (path: number[]) => {
    const next = [...structure];
    
    const deleteRecurse = (nodeList: FolderTemplateNode[], p: number[]): FolderTemplateNode[] => {
      const copy = [...nodeList];
      const idx = p[0];
      if (p.length === 1) {
        copy.splice(idx, 1);
      } else {
        copy[idx] = {
          ...copy[idx],
          children: deleteRecurse(copy[idx].children || [], p.slice(1))
        };
      }
      return copy;
    };

    setStructure(deleteRecurse(next, path));
  };

  const handleSaveTemplate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name || structure.length === 0) return;

    if (structure.some(n => !n.name)) {
      alert('모든 폴더 및 파일 명칭을 올바르게 입력해 주세요.');
      return;
    }

    await addFolderTemplateAction(name, description, JSON.stringify(structure));
    
    // Reset Form
    setName('');
    setDescription('');
    setStructure([
      {
        name: '01_기획',
        is_dir: true,
        children: [
          { name: '요구사항정의서.docx', is_dir: false }
        ]
      },
      {
        name: '02_디자인',
        is_dir: true,
        children: []
      }
    ]);
    setIsCreating(false);
  };

  const handleDeleteTemplate = async (id: string) => {
    if (confirm('이 폴더 양식을 삭제하시겠습니까?')) {
      await removeFolderTemplateAction(id);
      setSelectedTemplateId(null);
    }
  };

  // Helper to render tree nodes recursively in visual details view
  const renderVisualNode = (node: FolderTemplateNode, depth: number, idx: number): React.ReactNode => {
    const matchedDoc = docTemplates.find(dt => dt.id === node.template_doc_id);
    return (
      <div key={idx} className="flex flex-col gap-1" style={{ marginLeft: `${depth * 18}px` }}>
        <div className="flex items-center gap-2 text-xs py-1">
          {node.is_dir ? (
            <Folder className="w-3.5 h-3.5 text-toss-blue shrink-0" />
          ) : (
            <FileText className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
          )}
          <span className="font-bold text-toss-gray-700 dark:text-slate-300">{node.name}</span>
          {matchedDoc && (
            <span className="text-[10px] text-toss-blue font-extrabold bg-toss-blue-light/45 px-2 py-0.5 rounded-md border border-toss-blue-light shrink-0">
              양식 연동: {matchedDoc.original_name}
            </span>
          )}
        </div>
        {node.is_dir && node.children && node.children.map((child, subIdx) => 
          renderVisualNode(child, depth + 1, subIdx)
        )}
      </div>
    );
  };

  return (
    <div className="w-full flex-1 flex min-h-0 overflow-hidden bg-white dark:bg-slate-900 border border-toss-gray-200/50 dark:border-slate-800 rounded-[28px] shadow-sm relative text-left select-none animate-slide-up">
      {/* Left panel: List of folder templates */}
      <div className="w-72 shrink-0 border-r border-toss-gray-200/60 dark:border-slate-800 flex flex-col h-full bg-slate-50/50 dark:bg-slate-900/25 p-5 gap-5 pb-10">
        <div className="flex justify-between items-center shrink-0">
          <div className="flex flex-col">
            <span className="text-xs font-bold text-toss-blue">Templates</span>
            <h2 className="text-xl font-extrabold text-toss-gray-900 dark:text-slate-100 mt-0.5">폴더 양식 라이브러리</h2>
          </div>
          <button
            onClick={() => setIsCreating(true)}
            className="p-2.5 rounded-xl bg-toss-blue-light/50 dark:bg-toss-blue/15 text-toss-blue hover:bg-toss-blue-light transition-all cursor-pointer"
            title="새 폴더 양식 등록"
          >
            <Plus className="w-4.5 h-4.5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto flex flex-col gap-3 pr-1 scrollbar-thin">
          {folderTemplates.map(temp => (
            <div
              key={temp.id}
              onClick={() => {
                setSelectedTemplateId(temp.id);
                setIsCreating(false);
              }}
              className={`p-4 rounded-2xl border transition-all cursor-pointer flex items-center justify-between text-left ${
                !isCreating && selectedTemplateId === temp.id
                  ? 'border-toss-blue bg-toss-blue-light/15 dark:bg-toss-blue/10'
                  : 'border-toss-gray-200/60 dark:border-slate-800 bg-white dark:bg-slate-900 hover:border-toss-gray-300'
              }`}
            >
              <div className="flex flex-col overflow-hidden pr-2">
                <span className="text-sm font-bold text-toss-gray-800 dark:text-slate-200 truncate">{temp.name}</span>
                <span className="text-xs text-toss-gray-450 dark:text-slate-500 truncate mt-1 leading-normal">
                  {temp.description || '설명 없음'}
                </span>
              </div>
              <ChevronRight className="w-4.5 h-4.5 text-toss-gray-300 shrink-0" />
            </div>
          ))}
        </div>
      </div>

      {/* Right panel: Details OR Builder Form */}
      <div className="flex-1 flex flex-col min-w-0 overflow-y-auto p-6 pb-10 bg-white dark:bg-slate-900">
        
        {isCreating ? (
          /* ==============================================
             Builder Form
             ============================================== */
          <form onSubmit={handleSaveTemplate} className="flex flex-col gap-6 max-w-2xl w-full">
            <div className="flex justify-between items-center border-b border-toss-gray-150 dark:border-slate-800/80 pb-4">
              <h2 className="text-xl font-extrabold text-toss-gray-900 dark:text-slate-100">새 폴더 양식 등록</h2>
              <div className="flex gap-2.5">
                <button
                  type="button"
                  onClick={() => setIsCreating(false)}
                  className="px-4.5 py-2.5 text-xs font-bold text-toss-gray-550 border border-toss-gray-250 hover:bg-toss-gray-50 dark:text-slate-400 dark:border-slate-850 dark:hover:bg-slate-850 rounded-xl transition-colors cursor-pointer"
                >
                  취소
                </button>
                <button
                  type="submit"
                  className="toss-btn toss-btn-primary px-4.5 py-2.5 text-xs font-bold rounded-xl flex items-center gap-1 cursor-pointer"
                >
                  <Save className="w-3.5 h-3.5" />
                  폴더 양식 저장
                </button>
              </div>
            </div>

            {/* Template Basic Info */}
            <div className="flex flex-col gap-4">
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-bold text-toss-gray-455 dark:text-slate-400">폴더 양식 이름</label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="예: 표준 기획 및 디자인 폴더 구조"
                  required
                  className="text-sm px-4 py-3 bg-white dark:bg-slate-900 border border-toss-gray-250 dark:border-slate-800 rounded-2xl focus:outline-none focus:ring-2 focus:ring-toss-blue/60 transition-all font-semibold"
                />
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-bold text-toss-gray-455 dark:text-slate-400">설명</label>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="예: 01_기획 및 02_디자인 실무 디렉토리와 가이드를 자동 배포해주는 양식"
                  rows={2}
                  className="text-sm px-4 py-3 bg-white dark:bg-slate-900 border border-toss-gray-250 dark:border-slate-800 rounded-2xl focus:outline-none focus:ring-2 focus:ring-toss-blue/60 transition-all font-semibold resize-none"
                />
              </div>
            </div>

            {/* Tree Structure builder */}
            <div className="flex flex-col gap-5">
              <div className="flex justify-between items-center">
                <h3 className="text-sm font-extrabold text-toss-gray-800 dark:text-slate-200">디렉토리 양식 구성</h3>
                <button
                  type="button"
                  onClick={handleAddRootFolder}
                  className="px-3.5 py-2 text-xs font-bold text-toss-blue bg-toss-blue-light/50 hover:bg-toss-blue-light dark:bg-toss-blue/15 rounded-xl flex items-center gap-1.5 transition-colors cursor-pointer"
                >
                  <PlusCircle className="w-3.5 h-3.5" />
                  루트 폴더 추가
                </button>
              </div>

              <div className="flex flex-col gap-2.5 p-5 bg-slate-50/40 dark:bg-slate-850/40 border border-toss-gray-200/50 dark:border-slate-800 rounded-3xl min-h-[180px]">
                {structure.map((node, idx) => (
                  <TreeNodeEditor
                    key={idx}
                    node={node}
                    path={[idx]}
                    onUpdateNode={handleUpdateNode}
                    onDeleteNode={handleDeleteNode}
                    docTemplates={docTemplates}
                  />
                ))}
                {structure.length === 0 && (
                  <p className="text-xs text-toss-gray-400 italic py-6 text-center select-none">구성 요소가 없습니다. 폴더를 먼저 추가해 주세요.</p>
                )}
              </div>
            </div>
          </form>
        ) : activeTemplate ? (
          /* ==============================================
             Visual Details Viewer
             ============================================== */
          <div className="flex flex-col gap-6 text-left max-w-2xl w-full">
            <div className="flex justify-between items-center border-b border-toss-gray-150 dark:border-slate-800/80 pb-4">
              <div className="flex flex-col gap-1">
                <h2 className="text-xl font-extrabold text-toss-gray-900 dark:text-slate-100">{activeTemplate.name}</h2>
                <p className="text-sm text-toss-gray-500 dark:text-slate-400 mt-1 font-medium">{activeTemplate.description}</p>
              </div>
              <button
                type="button"
                onClick={() => handleDeleteTemplate(activeTemplate.id)}
                className="px-3.5 py-2.5 text-xs font-bold text-toss-red bg-toss-red/10 hover:bg-toss-red/20 rounded-xl transition-all cursor-pointer flex items-center gap-1.5"
              >
                <Trash2 className="w-3.5 h-3.5" />
                양식 삭제
              </button>
            </div>

            {/* Folder tree visualization */}
            <div className="flex flex-col gap-4">
              <h3 className="text-xs font-bold text-toss-gray-400 dark:text-slate-500 uppercase tracking-wider">폴더 양식 구조</h3>
              
              <div className="p-5 bg-slate-50/40 dark:bg-slate-850/40 border border-toss-gray-200/50 dark:border-slate-800 rounded-3xl flex flex-col gap-2 min-h-[140px]">
                {(JSON.parse(activeTemplate.structure_json) as FolderTemplateNode[]).map((node, idx) => 
                  renderVisualNode(node, 0, idx)
                )}
              </div>
            </div>
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <p className="text-sm text-toss-gray-455 dark:text-slate-400">등록된 폴더 양식이 없습니다. 새 폴더 양식을 등록해 주세요.</p>
          </div>
        )}

      </div>
    </div>
  );
};
