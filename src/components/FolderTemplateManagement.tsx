import React, { useState, useEffect, useMemo, useCallback } from 'react';
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
  ChevronDown,
  X
} from 'lucide-react';
import type { FolderTemplateNode } from '../types';
import { getDocuments, type DocTemplate } from '../utils/api';
import { requestDeleteConfirmation } from '../utils/deleteConfirm';

// Recursive Folder Tree Node Editor Component
interface TreeNodeEditorProps {
  node: FolderTemplateNode;
  path: number[];
  onUpdateNode: (path: number[], updatedNode: FolderTemplateNode) => void;
  onDeleteNode: (path: number[]) => void;
  onOpenDocSelector: (path: number[]) => void;
  docTemplates: DocTemplate[];
}

const TreeNodeEditor: React.FC<TreeNodeEditorProps> = ({
  node,
  path,
  onUpdateNode,
  onDeleteNode,
  onOpenDocSelector,
  docTemplates
}) => {
  const [isExpanded, setIsExpanded] = useState(true);

  const handleNameChange = (val: string) => {
    const updated = { ...node, name: val };
    onUpdateNode(path, updated);
  };

  const handleClearDocTemplate = () => {
    const updated = { ...node, template_doc_id: undefined };
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

  const getFileParts = (filename: string) => {
    const lastDotIdx = filename.lastIndexOf('.');
    if (lastDotIdx === -1) {
      return { base: filename, ext: '' };
    }
    return {
      base: filename.substring(0, lastDotIdx),
      ext: filename.substring(lastDotIdx)
    };
  };

  const matchedDoc = docTemplates.find(dt => dt.id === node.template_doc_id);
  const { base: baseName, ext: fileExt } = getFileParts(node.name);

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
          value={node.is_dir ? node.name : baseName}
          onChange={(e) => {
            const val = e.target.value;
            if (node.is_dir) {
              handleNameChange(val);
            } else {
              handleNameChange(val + fileExt);
            }
          }}
          placeholder={node.is_dir ? '폴더명 입력' : '파일명 입력'}
          required
          className="text-xs px-2.5 py-1.5 bg-white dark:bg-slate-855 border border-toss-gray-200/50 dark:border-slate-800 rounded-lg focus:outline-none focus:ring-1 focus:ring-toss-blue/60 transition-all font-semibold max-w-[160px]"
        />

        {!node.is_dir && fileExt && (
          <span className="px-2 py-1 bg-slate-100 dark:bg-slate-855 text-slate-500 dark:text-slate-400 font-mono text-[10px] font-extrabold rounded-md border border-slate-200/30 shrink-0" title="확장자">
            {fileExt}
          </span>
        )}

        {!node.is_dir && (
          <div className="flex items-center gap-1.5 shrink-0">
            {matchedDoc ? (
              <button
                type="button"
                onClick={() => onOpenDocSelector(path)}
                className="px-2.5 py-1.5 bg-toss-blue-light/40 hover:bg-toss-blue-light/70 dark:bg-toss-blue/10 dark:hover:bg-toss-blue/20 text-toss-blue rounded-lg text-[11px] font-extrabold border border-toss-blue-light/50 transition-all cursor-pointer shrink-0"
                title={`연동된 양식: ${matchedDoc.original_name}`}
              >
                양식 변경
              </button>
            ) : (
              <button
                type="button"
                onClick={() => onOpenDocSelector(path)}
                className="px-2.5 py-1.5 bg-slate-50 hover:bg-slate-100 dark:bg-slate-855 border border-toss-gray-200/50 dark:border-slate-800 text-toss-gray-450 dark:text-slate-400 rounded-lg text-[11px] font-bold transition-all cursor-pointer shrink-0"
              >
                양식 연동
              </button>
            )}

            {node.template_doc_id && (
              <button
                type="button"
                onClick={handleClearDocTemplate}
                className="p-1 hover:bg-rose-50 dark:hover:bg-rose-955/20 text-toss-red rounded-lg transition-colors cursor-pointer shrink-0"
                title="연동 해제"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
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
              onUpdateNode={onUpdateNode}
              onDeleteNode={onDeleteNode}
              onOpenDocSelector={onOpenDocSelector}
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

  // Modal states for Document Template Selector
  const [isDocSelectorOpen, setIsDocSelectorOpen] = useState(false);
  const [activePathForDocSelector, setActivePathForDocSelector] = useState<number[] | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('전체');

  useEffect(() => {
    if (!isDocSelectorOpen) {
      setSearchQuery('');
      setSelectedCategory('전체');
    }
  }, [isDocSelectorOpen]);

  // Form states for creation
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [structure, setStructure] = useState<FolderTemplateNode[]>([
    {
      name: '01_기획',
      is_dir: true,
      children: []
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

  const categories = useMemo(() => {
    const cats = new Set<string>();
    cats.add('전체');
    docTemplates.forEach(dt => {
      if (dt.category) cats.add(dt.category);
    });
    return Array.from(cats);
  }, [docTemplates]);

  const filteredTemplates = useMemo(() => {
    return docTemplates.filter(dt => {
      const matchesCategory = selectedCategory === '전체' || dt.category === selectedCategory;
      const matchesSearch = 
        dt.original_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (dt.tags && dt.tags.toLowerCase().includes(searchQuery.toLowerCase())) ||
        (dt.description && dt.description.toLowerCase().includes(searchQuery.toLowerCase()));
      return matchesCategory && matchesSearch;
    });
  }, [docTemplates, selectedCategory, searchQuery]);

  const getNodeByPath = (nodeList: FolderTemplateNode[], p: number[]): FolderTemplateNode | null => {
    if (p.length === 0) return null;
    const idx = p[0];
    if (idx === undefined || idx < 0 || idx >= nodeList.length) return null;
    const current = nodeList[idx];
    if (p.length === 1) {
      return current;
    }
    if (current.children) {
      return getNodeByPath(current.children, p.slice(1));
    }
    return null;
  };

  const handleSelectDocTemplate = (selectedDoc: DocTemplate) => {
    if (!activePathForDocSelector) return;
    
    const currentNode = getNodeByPath(structure, activePathForDocSelector);

    const nextNode = currentNode ? { ...currentNode } : { name: '', is_dir: false };
    nextNode.template_doc_id = selectedDoc.id;
    if (!nextNode.name || nextNode.name === '새 파일.docx') {
      nextNode.name = selectedDoc.original_name;
    }

    handleUpdateNode(activePathForDocSelector, nextNode);
    
    setIsDocSelectorOpen(false);
    setActivePathForDocSelector(null);
  };

  const handleAddRootFolder = () => {
    setStructure([
      ...structure,
      { name: `새 폴더`, is_dir: true, children: [] }
    ]);
  };

  const handleOpenDocSelector = useCallback((p: number[]) => {
    setActivePathForDocSelector(p);
    setIsDocSelectorOpen(true);
  }, []);

  const handleUpdateNode = useCallback((path: number[], updatedNode: FolderTemplateNode) => {
    setStructure(prev => {
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
      return updateRecurse(prev, path);
    });
  }, []);

  const handleDeleteNode = useCallback((path: number[]) => {
    const findNode = (nodeList: FolderTemplateNode[], p: number[]): FolderTemplateNode | undefined => {
      const node = nodeList[p[0]];
      if (!node || p.length === 1) return node;
      return findNode(node.children || [], p.slice(1));
    };
    const target = findNode(structure, path);
    if (!requestDeleteConfirmation({
      title: '폴더 양식 항목 삭제',
      targetName: target?.name,
      description: '하위 폴더와 연결된 문서 항목도 함께 삭제됩니다.',
    })) return;

    setStructure(prev => {
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
      return deleteRecurse(prev, path);
    });
  }, [structure]);

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
        children: []
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
    const target = folderTemplates.find((template) => template.id === id);
    if (requestDeleteConfirmation({
      title: '폴더 양식 삭제',
      targetName: target?.name,
      description: '삭제한 폴더 양식은 다시 만들어야 복구할 수 있습니다.',
    })) {
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
                    onOpenDocSelector={handleOpenDocSelector}
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

      {/* ─── Document Template Selector Modal ─── */}
      {isDocSelectorOpen && (
        <div 
          className="fixed inset-0 bg-slate-955/40 dark:bg-slate-955/70 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-fade-in"
          onClick={() => {
            setIsDocSelectorOpen(false);
            setActivePathForDocSelector(null);
          }}
        >
          <div 
            className="bg-white/95 dark:bg-slate-900/95 border border-gray-100 dark:border-slate-800 rounded-[28px] p-6 shadow-toss-lg max-w-2xl w-full h-[500px] text-left animate-scale-in flex flex-col gap-4"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex items-center justify-between shrink-0">
              <div className="flex flex-col text-left">
                <span className="text-xs font-bold text-toss-blue">Select Document Template</span>
                <h3 className="text-base font-extrabold text-toss-gray-900 dark:text-slate-100 mt-0.5">양식 서류 선택</h3>
              </div>
              <button 
                type="button"
                onClick={() => {
                  setIsDocSelectorOpen(false);
                  setActivePathForDocSelector(null);
                }}
                className="p-2 rounded-xl hover:bg-toss-gray-100 dark:hover:bg-slate-800 text-toss-gray-400 cursor-pointer transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Search Input */}
            <div className="relative flex items-center shrink-0">
              <input
                type="text"
                placeholder="서류 양식 명칭 또는 태그 검색..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full text-xs pl-4 pr-10 py-3 bg-slate-50 dark:bg-slate-855 border border-toss-gray-200/50 dark:border-slate-800 rounded-xl focus:outline-none focus:ring-1 focus:ring-toss-blue/60 transition-all font-semibold text-toss-gray-800 dark:text-slate-200"
              />
              {searchQuery && (
                <button 
                  type="button"
                  onClick={() => setSearchQuery('')}
                  className="absolute right-3 p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            {/* Content: 2 Columns */}
            <div className="flex-1 flex gap-4 min-h-0">
              {/* Left Column: Categories List */}
              <div className="w-44 shrink-0 flex flex-col gap-1 overflow-y-auto pr-1">
                <span className="text-[10px] font-bold text-toss-gray-400 dark:text-slate-500 uppercase tracking-wider mb-1 px-2">카테고리</span>
                {categories.map(cat => {
                  const count = cat === '전체' 
                    ? docTemplates.length 
                    : docTemplates.filter(d => d.category === cat).length;
                  return (
                    <button
                      key={cat}
                      type="button"
                      onClick={() => setSelectedCategory(cat)}
                      className={`flex items-center justify-between px-3 py-2 rounded-xl text-xs font-bold text-left cursor-pointer transition-all ${
                        selectedCategory === cat
                          ? 'bg-toss-blue/10 text-toss-blue dark:bg-toss-blue/20'
                          : 'text-toss-gray-500 hover:bg-slate-55 dark:text-slate-400 dark:hover:bg-slate-850'
                      }`}
                    >
                      <span className="truncate">{cat}</span>
                      <span className="text-[10px] font-semibold opacity-70 ml-1">{count}</span>
                    </button>
                  );
                })}
              </div>

              {/* Right Column: Files Grid/List */}
              <div className="flex-1 flex flex-col gap-2 overflow-y-auto pr-1 border-l border-toss-gray-150 dark:border-slate-800/80 pl-4">
                <span className="text-[10px] font-bold text-toss-gray-400 dark:text-slate-500 uppercase tracking-wider mb-1">양식 파일 목록 ({filteredTemplates.length})</span>
                {filteredTemplates.length === 0 ? (
                  <div className="flex-1 flex flex-col items-center justify-center text-toss-gray-400 select-none py-10">
                    <FileText className="w-10 h-10 text-toss-gray-300 mb-2 animate-pulse" />
                    <p className="text-xs font-bold">검색 결과가 없습니다.</p>
                  </div>
                ) : (
                  <div className="flex flex-col gap-1.5">
                    {filteredTemplates.map(doc => (
                      <div
                        key={doc.id}
                        onClick={() => handleSelectDocTemplate(doc)}
                        className="flex items-center gap-3 p-3 border border-toss-gray-200/50 dark:border-slate-800 bg-white hover:bg-slate-50 dark:bg-slate-900 dark:hover:bg-slate-850 rounded-2xl cursor-pointer transition-all group"
                      >
                        <FileText className="w-8 h-8 text-emerald-500 shrink-0" />
                        <div className="flex-1 min-w-0 text-left">
                          <p className="text-xs font-extrabold text-toss-gray-800 dark:text-slate-200 group-hover:text-toss-blue transition-colors truncate">
                            {doc.original_name}
                          </p>
                          <p className="text-[10px] text-toss-gray-450 dark:text-slate-500 font-medium truncate mt-0.5">
                            {doc.category ? `[${doc.category}] ` : ''}{doc.description || '설명 없음'}
                          </p>
                        </div>
                        <span className="text-[10px] font-semibold text-slate-400 bg-slate-50 dark:bg-slate-800/80 px-2 py-1 rounded-lg border border-slate-200/30 shrink-0">
                          {(doc.file_size / 1024).toFixed(1)} KB
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};
