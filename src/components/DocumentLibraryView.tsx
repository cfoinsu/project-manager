import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import {
  uploadDocument,
  getDocuments,
  downloadDocument,
  updateDocument,
  deleteDocument,
  type DocTemplate
} from '../utils/api';
import { requestDeleteConfirmation } from '../utils/deleteConfirm';
import { useAuthStore } from '../store/authStore';
import {
  Upload, Search, Download, Trash2, Edit2, X,
  FileText, FileSpreadsheet, File, Image,
  FolderOpen, Tag, RefreshCw, CheckCircle,
  AlertTriangle, Plus, Archive, GripVertical
} from 'lucide-react';

// ─── 파일 크기 포맷 ──────────────────────────────
function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
}

// ─── 날짜 포맷 ────────────────────────────────────
function formatDate(dateStr: string): string {
  const d = new Date(dateStr.replace(' ', 'T'));
  return `${d.getFullYear()}.${String(d.getMonth() + 1).padStart(2, '0')}.${String(d.getDate()).padStart(2, '0')}`;
}

// ─── 파일 아이콘 ─────────────────────────────────
function FileIcon({ name, className = '' }: { mimeType?: string; name: string; className?: string }) {
  const ext = name.split('.').pop()?.toLowerCase() || '';
  if (['png', 'jpg', 'jpeg'].includes(ext)) {
    return <Image className={`${className} text-green-500`} />;
  }
  if (['xls', 'xlsx'].includes(ext)) {
    return <FileSpreadsheet className={`${className} text-emerald-650`} />;
  }
  if (['pdf'].includes(ext)) {
    return <FileText className={`${className} text-red-500`} />;
  }
  if (['hwp', 'hwpx', 'doc', 'docx'].includes(ext)) {
    return <FileText className={`${className} text-blue-500`} />;
  }
  if (['ppt', 'pptx'].includes(ext)) {
    return <File className={`${className} text-orange-550`} />;
  }
  return <Archive className={`${className} text-gray-400`} />;
}

// ─── 카테고리 뱃지 색상 ──────────────────────────
function getCategoryColor(cat: string): string {
  const map: Record<string, string> = {
    '계약': 'bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950/30 dark:text-blue-400 dark:border-blue-800/40',
    '기획': 'bg-purple-50 text-purple-700 border-purple-200 dark:bg-purple-950/30 dark:text-purple-400 dark:border-purple-800/40',
    '디자인': 'bg-pink-50 text-pink-700 border-pink-200 dark:bg-pink-950/30 dark:text-pink-400 dark:border-pink-800/40',
    '퍼블': 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/30 dark:text-amber-450 dark:border-amber-800/40',
    '개발': 'bg-teal-50 text-teal-700 border-teal-200 dark:bg-teal-950/30 dark:text-teal-400 dark:border-teal-800/40',
    '검수': 'bg-green-50 text-green-700 border-green-200 dark:bg-green-950/30 dark:text-green-400 dark:border-green-800/40',
    '산출물': 'bg-indigo-50 text-indigo-700 border-indigo-200 dark:bg-indigo-950/30 dark:text-indigo-400 dark:border-indigo-800/40',
    '기타': 'bg-gray-50 text-gray-600 border-gray-200 dark:bg-slate-800 dark:text-slate-400 dark:border-slate-700/60',
  };
  return map[cat] || 'bg-gray-50 text-gray-600 border-gray-200 dark:bg-slate-800 dark:text-slate-400 dark:border-slate-700/60';
}

// ─── 업로드 모달 ─────────────────────────────────
interface UploadModalProps {
  categories: string[];
  onClose: () => void;
  onSuccess: () => void;
}

const UploadModal: React.FC<UploadModalProps> = ({ categories, onClose, onSuccess }) => {
  const [dragOver, setDragOver] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [category, setCategory] = useState(categories[0] || '기타');
  const [tags, setTags] = useState('');
  const [description, setDescription] = useState('');
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files[0];
    if (file) setSelectedFile(file);
  };

  const handleSubmit = async () => {
    if (!selectedFile) return;
    setUploading(true);
    setError(null);
    try {
      const formData = new FormData();
      formData.append('file', selectedFile);
      formData.append('category', category);
      formData.append('tags', tags);
      formData.append('description', description);
      await uploadDocument(formData);
      onSuccess();
    } catch (err: any) {
      setError(err.message || '업로드 중 오류가 발생했습니다.');
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-slate-950/40 dark:bg-slate-950/70 backdrop-blur-sm z-[100] flex items-center justify-center p-4 animate-fade-in">
      <div className="w-full max-w-[520px] bg-white/95 dark:bg-slate-900/95 rounded-[28px] border border-gray-100 dark:border-slate-800 shadow-toss-lg overflow-hidden backdrop-blur-md">
        {/* 헤더 */}
        <div className="flex items-center justify-between px-6 py-5 border-b border-gray-100/50 dark:border-slate-800/40">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-sky-500/10 flex items-center justify-center">
              <Upload className="w-4 h-4 text-toss-blue" />
            </div>
            <span className="text-base font-extrabold text-toss-gray-900 dark:text-slate-100">서류 양식 업로드</span>
          </div>
          <button onClick={onClose} className="p-2 rounded-xl hover:bg-gray-100 dark:hover:bg-slate-800 text-gray-400 transition-colors cursor-pointer border-none bg-transparent">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-6 space-y-4">
          {/* 드래그앤드롭 영역 */}
          <div
            className={`border-2 border-dashed rounded-[20px] p-8 text-center transition-all cursor-pointer ${
              dragOver
                ? 'border-toss-blue bg-sky-500/5 scale-[1.01]'
                : selectedFile
                ? 'border-emerald-500/40 bg-emerald-500/5'
                : 'border-gray-200/80 dark:border-slate-700/80 hover:border-toss-blue hover:bg-sky-500/5'
            }`}
            onDragOver={e => { e.preventDefault(); setDragOver(true); }}
            onDragLeave={() => setDragOver(false)}
            onDrop={handleDrop}
            onClick={() => inputRef.current?.click()}
          >
            <input
              ref={inputRef}
              type="file"
              className="hidden"
              accept=".hwp,.hwpx,.pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.png,.jpg,.jpeg,.txt,.zip"
              onChange={e => e.target.files?.[0] && setSelectedFile(e.target.files[0])}
            />
            {selectedFile ? (
              <div className="flex flex-col items-center gap-2">
                <CheckCircle className="w-10 h-10 text-emerald-500" />
                <p className="text-sm font-bold text-toss-gray-800 dark:text-slate-200">{selectedFile.name}</p>
                <p className="text-xs text-toss-gray-400">{formatFileSize(selectedFile.size)}</p>
                <button
                  type="button"
                  onClick={e => { e.stopPropagation(); setSelectedFile(null); }}
                  className="mt-1.5 text-xs text-toss-gray-400 hover:text-rose-500 transition-colors font-bold cursor-pointer border-none bg-transparent"
                >
                  × 파일 변경
                </button>
              </div>
            ) : (
              <div className="flex flex-col items-center gap-2 text-toss-gray-400">
                <FolderOpen className="w-10 h-10 opacity-30 text-toss-blue" />
                <p className="text-xs font-bold text-toss-gray-700 dark:text-slate-300">파일을 드래그하거나 클릭하여 선택</p>
                <p className="text-[10px] text-toss-gray-400">HWP, PDF, DOCX, XLSX, PPT, 이미지 등 (최대 50MB)</p>
              </div>
            )}
          </div>

          {/* 카테고리 */}
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-toss-gray-450 dark:text-slate-500 uppercase tracking-wider block text-left">카테고리 그룹 선택</label>
            <div className="flex flex-wrap gap-2 max-h-32 overflow-y-auto p-1 border border-gray-100 dark:border-slate-800 rounded-xl bg-slate-50/50 dark:bg-slate-850/45 scrollbar-thin">
              {categories.map(cat => (
                <button
                  key={cat}
                  type="button"
                  onClick={() => setCategory(cat)}
                  className={`px-3 py-1.5 rounded-full text-xs font-bold border transition-all cursor-pointer ${
                    category === cat
                      ? 'bg-toss-blue text-white border-toss-blue'
                      : 'bg-white dark:bg-slate-800 text-toss-gray-650 dark:text-slate-300 border-gray-200 dark:border-slate-700 hover:border-toss-blue'
                  }`}
                >
                  {cat}
                </button>
              ))}
            </div>
          </div>

          {/* 태그 */}
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-toss-gray-455 dark:text-slate-500 uppercase tracking-wider block text-left">태그 (쉼표 구분)</label>
            <input
              type="text"
              value={tags}
              onChange={e => setTags(e.target.value)}
              placeholder="예: 표준, 2026년, 제출용"
              className="toss-input"
            />
          </div>

          {/* 설명 */}
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-toss-gray-455 dark:text-slate-500 uppercase tracking-wider block text-left">양식 설명 (선택)</label>
            <textarea
              value={description}
              onChange={e => setDescription(e.target.value)}
              placeholder="이 양식에 대한 용도 및 가이드를 작성하세요..."
              rows={2}
              className="toss-input resize-none"
            />
          </div>

          {error && (
            <div className="flex items-center gap-2 px-3.5 py-3 bg-rose-500/10 border border-rose-500/20 rounded-xl text-rose-500 text-xs font-semibold">
              <AlertTriangle className="w-4 h-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* 버튼 */}
          <div className="flex gap-3 pt-1">
            <button type="button" onClick={onClose} className="toss-btn toss-btn-secondary flex-1 py-3 font-bold rounded-xl cursor-pointer">
              취소
            </button>
            <button
              type="button"
              onClick={handleSubmit}
              disabled={!selectedFile || uploading}
              className="toss-btn toss-btn-primary flex-1 py-3 font-bold rounded-xl cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed transition-all flex items-center justify-center gap-2"
            >
              {uploading ? (
                <><RefreshCw className="w-3.5 h-3.5 animate-spin" />업로드 중...</>
              ) : (
                <><Upload className="w-3.5 h-3.5" />업로드</>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

// ─── 편집 모달 ────────────────────────────────────
interface EditModalProps {
  categories: string[];
  doc: DocTemplate;
  onClose: () => void;
  onSuccess: () => void;
}

const EditModal: React.FC<EditModalProps> = ({ categories, doc, onClose, onSuccess }) => {
  const [name, setName] = useState(doc.original_name);
  const [category, setCategory] = useState(doc.category);
  const [tags, setTags] = useState(doc.tags);
  const [description, setDescription] = useState(doc.description);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSave = async () => {
    setSaving(true);
    setError(null);
    try {
      await updateDocument(doc.id, { original_name: name, category, tags, description });
      onSuccess();
    } catch (err: any) {
      setError(err.message || '저장 중 오류가 발생했습니다.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-slate-950/40 dark:bg-slate-950/70 backdrop-blur-sm z-[100] flex items-center justify-center p-4 animate-fade-in">
      <div className="w-full max-w-[480px] bg-white/95 dark:bg-slate-900/95 rounded-[28px] border border-gray-100 dark:border-slate-800 shadow-toss-lg overflow-hidden backdrop-blur-md">
        <div className="flex items-center justify-between px-6 py-5 border-b border-gray-100/50 dark:border-slate-800/40">
          <span className="text-base font-extrabold text-toss-gray-900 dark:text-slate-100">문서 정보 수정</span>
          <button onClick={onClose} className="p-2 rounded-xl hover:bg-gray-100 dark:hover:bg-slate-800 text-gray-400 transition-colors cursor-pointer border-none bg-transparent">
            <X className="w-4 h-4" />
          </button>
        </div>
        <div className="p-6 space-y-4">
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-toss-gray-455 dark:text-slate-500 uppercase tracking-wider block text-left">파일명</label>
            <input
              type="text"
              value={name}
              onChange={e => setName(e.target.value)}
              className="toss-input"
            />
          </div>
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-toss-gray-455 dark:text-slate-500 uppercase tracking-wider block text-left">카테고리 그룹 선택</label>
            <div className="flex flex-wrap gap-2 max-h-32 overflow-y-auto p-1 border border-gray-100 dark:border-slate-800 rounded-xl bg-slate-50/50 dark:bg-slate-850/45 scrollbar-thin">
              {categories.map(cat => (
                <button 
                  key={cat} 
                  type="button"
                  onClick={() => setCategory(cat)}
                  className={`px-3 py-1.5 rounded-full text-xs font-bold border transition-all cursor-pointer ${
                    category === cat 
                      ? 'bg-toss-blue text-white border-toss-blue' 
                      : 'bg-white dark:bg-slate-800 text-toss-gray-650 dark:text-slate-300 border-gray-200 dark:border-slate-700 hover:border-toss-blue'
                  }`}
                >
                  {cat}
                </button>
              ))}
            </div>
          </div>
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-toss-gray-455 dark:text-slate-500 uppercase tracking-wider block text-left">태그 (쉼표 구분)</label>
            <input 
              type="text" 
              value={tags} 
              onChange={e => setTags(e.target.value)}
              className="toss-input" 
            />
          </div>
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-toss-gray-455 dark:text-slate-500 uppercase tracking-wider block text-left">설명</label>
            <textarea 
              value={description} 
              onChange={e => setDescription(e.target.value)} 
              rows={2}
              className="toss-input resize-none" 
            />
          </div>
          {error && (
            <div className="flex items-center gap-2 px-3.5 py-3 bg-rose-500/10 border border-rose-500/20 rounded-xl text-rose-500 text-xs font-semibold">
              <AlertTriangle className="w-4 h-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}
          <div className="flex gap-3 pt-1">
            <button type="button" onClick={onClose} className="toss-btn toss-btn-secondary flex-1 py-3 font-bold rounded-xl cursor-pointer">취소</button>
            <button type="button" onClick={handleSave} disabled={saving}
              className="toss-btn toss-btn-primary flex-1 py-3 font-bold rounded-xl cursor-pointer disabled:opacity-40 transition-all flex items-center justify-center gap-2">
              {saving ? <><RefreshCw className="w-3.5 h-3.5 animate-spin" />저장 중...</> : '저장'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

// ─── 메인 뷰 ─────────────────────────────────────
export const DocumentLibraryView: React.FC = () => {
  const { user: currentUser } = useAuthStore();
  const [documents, setDocuments] = useState<DocTemplate[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeCategory, setActiveCategory] = useState('전체');
  const [showUpload, setShowUpload] = useState(false);
  const [editingDoc, setEditingDoc] = useState<DocTemplate | null>(null);
  const [downloadingId, setDownloadingId] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  // 유동적 카테고리/그룹 관리 상태
  const [categories, setCategories] = useState<string[]>(() => {
    const saved = localStorage.getItem('pa_document_categories');
    return saved ? JSON.parse(saved) : ['계약', '기획', '디자인', '퍼블', '개발', '검수', '산출물', '기타'];
  });
  const [isAddingCategory, setIsAddingCategory] = useState(false);
  const [newCategoryInput, setNewCategoryInput] = useState('');

  // 그룹명 편집 및 Drag & Drop 상태
  const [editingCatName, setEditingCatName] = useState<string | null>(null);
  const [editingCatInput, setEditingCatInput] = useState('');
  const [draggingIndex, setDraggingIndex] = useState<number | null>(null);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);

  const canManage = currentUser?.role === 'admin' || currentUser?.role === 'manager';

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 3000);
  };

  const fetchDocuments = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      // 클라이언트 측 실시간 즉시 검색 및 빠른 카테고리 변경을 위해 전체 문서를 로드합니다.
      const data = await getDocuments({});
      setDocuments(data);
    } catch (err: any) {
      setError(err.message || '문서 목록을 불러올 수 없습니다.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchDocuments();
  }, [fetchDocuments]);

  const handleDownload = async (doc: DocTemplate) => {
    setDownloadingId(doc.id);
    try {
      await downloadDocument(doc.id, doc.original_name);
      showToast(`"${doc.original_name}" 다운로드 완료`);
    } catch {
      showToast('다운로드에 실패했습니다.');
    } finally {
      setDownloadingId(null);
    }
  };

  const handleDelete = async (doc: DocTemplate) => {
    if (!requestDeleteConfirmation({
      title: '문서 파일 삭제',
      targetName: doc.original_name,
      description: '이 작업은 되돌릴 수 없습니다.',
    })) return;
    try {
      await deleteDocument(doc.id);
      setDocuments(prev => prev.filter(d => d.id !== doc.id));
      showToast('파일이 삭제되었습니다.');
    } catch (err: any) {
      showToast(err.message || '삭제 실패');
    }
  };

  // 검색 디바운스/처리
  const handleSearch = (val: string) => {
    setSearchQuery(val);
  };

  // 동적 카테고리 추가
  const handleAddCategory = () => {
    const name = newCategoryInput.trim();
    if (!name) return;
    if (categories.includes(name)) {
      alert('이미 존재하는 그룹 이름입니다.');
      return;
    }
    const updated = [...categories, name];
    setCategories(updated);
    localStorage.setItem('pa_document_categories', JSON.stringify(updated));
    setNewCategoryInput('');
    setIsAddingCategory(false);
    showToast(`"${name}" 그룹이 추가되었습니다.`);
  };

  // 동적 카테고리 삭제
  const handleDeleteCategory = (catToDelete: string) => {
    const hasDocs = documents.some((d) => d.category === catToDelete);
    if (hasDocs) {
      alert('이 그룹에 속해있는 서류 양식이 있습니다. 문서 정보를 먼저 다른 그룹으로 이동시킨 후 삭제가 가능합니다.');
      return;
    }
    if (!requestDeleteConfirmation({
      title: '문서 그룹 삭제',
      targetName: catToDelete,
      description: '삭제한 그룹은 다시 만들어야 복구할 수 있습니다.',
    })) return;
    const updated = categories.filter((c) => c !== catToDelete);
    setCategories(updated);
    localStorage.setItem('pa_document_categories', JSON.stringify(updated));
    if (activeCategory === catToDelete) {
      setActiveCategory('전체');
    }
    showToast(`"${catToDelete}" 그룹이 삭제되었습니다.`);
  };

  // 동적 카테고리 수정 (이름 변경) 및 소속 문서 카테고리 일괄 갱신
  const handleRenameCategory = async (oldName: string, newName: string) => {
    const trimmed = newName.trim();
    if (!trimmed) {
      setEditingCatName(null);
      return;
    }
    if (trimmed === oldName) {
      setEditingCatName(null);
      return;
    }
    if (categories.includes(trimmed)) {
      alert('이미 존재하는 그룹 이름입니다.');
      return;
    }

    try {
      // 1. 카테고리 목록 상태 업데이트 및 저장
      const updatedCategories = categories.map(cat => cat === oldName ? trimmed : cat);
      setCategories(updatedCategories);
      localStorage.setItem('pa_document_categories', JSON.stringify(updatedCategories));

      // 2. 오프라인 로컬 폴백용 pa_fallback_document_templates 문서 카테고리 일괄 업데이트
      const fallbackStr = localStorage.getItem('pa_fallback_document_templates');
      if (fallbackStr) {
        const fallbackDocs = JSON.parse(fallbackStr);
        const updatedFallback = fallbackDocs.map((doc: any) => {
          if (doc.category === oldName) {
            return { ...doc, category: trimmed };
          }
          return doc;
        });
        localStorage.setItem('pa_fallback_document_templates', JSON.stringify(updatedFallback));
      }

      // 3. 현재 documents 목록 상태 즉시 업데이트
      setDocuments(prev => prev.map(d => d.category === oldName ? { ...d, category: trimmed } : d));

      // 4. API 서버 DB 업데이트 (Promise.all 병렬 실행)
      const docsToUpdate = documents.filter(d => d.category === oldName);
      if (docsToUpdate.length > 0) {
        await Promise.all(docsToUpdate.map(doc => updateDocument(doc.id, { category: trimmed })));
      }

      // 5. 활성화된 카테고리명이 변경 대상이면 상태 업데이트
      if (activeCategory === oldName) {
        setActiveCategory(trimmed);
      }

      showToast(`그룹명이 "${oldName}"에서 "${trimmed}"(으)로 수정되었습니다.`);
    } catch (err: any) {
      showToast(err.message || '그룹명 수정 중 오류가 발생했습니다.');
    } finally {
      setEditingCatName(null);
    }
  };

  // Drag & Drop 이벤트 핸들러
  const handleDragStart = (e: React.DragEvent, index: number) => {
    if (!canManage) return;
    setDraggingIndex(index);
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', String(index));
  };

  const handleDragOver = (e: React.DragEvent, index: number) => {
    if (!canManage || draggingIndex === null) return;
    e.preventDefault();
    if (dragOverIndex !== index) {
      setDragOverIndex(index);
    }
  };

  const handleDragEnd = () => {
    setDraggingIndex(null);
    setDragOverIndex(null);
  };

  const handleDrop = (e: React.DragEvent, targetIndex: number) => {
    if (!canManage || draggingIndex === null) return;
    e.preventDefault();

    if (draggingIndex === targetIndex) {
      handleDragEnd();
      return;
    }

    const updated = [...categories];
    const [draggedItem] = updated.splice(draggingIndex, 1);
    updated.splice(targetIndex, 0, draggedItem);

    setCategories(updated);
    localStorage.setItem('pa_document_categories', JSON.stringify(updated));
    showToast('그룹 순서가 변경되었습니다.');
    handleDragEnd();
  };

  // 클라이언트 측 필터링 계산
  const filteredDocs = useMemo(() => {
    return documents.filter((doc) => {
      // Category Filter
      if (activeCategory !== '전체' && doc.category !== activeCategory) {
        return false;
      }
      // Search Filter
      if (searchQuery) {
        const q = searchQuery.toLowerCase();
        return (
          doc.original_name.toLowerCase().includes(q) ||
          (doc.tags && doc.tags.toLowerCase().includes(q)) ||
          (doc.description && doc.description.toLowerCase().includes(q))
        );
      }
      return true;
    });
  }, [documents, activeCategory, searchQuery]);

  // 테이블 렌더링 헬퍼 함수
  const renderTemplateTable = (docsList: DocTemplate[]) => {
    return (
      <div className="toss-card bg-white dark:bg-slate-900 border border-toss-gray-200/50 dark:border-slate-800/80 p-0 overflow-x-auto rounded-[24px] shadow-sm select-none">
        <table className="w-full text-sm text-left border-collapse min-w-[700px]">
          <thead>
            <tr className="border-b border-toss-gray-100 dark:border-slate-850 text-toss-gray-450 dark:text-slate-500 font-bold text-xs select-none bg-slate-50/50 dark:bg-slate-850/20">
              <th className="py-3 px-4 w-[35%] text-left">파일명</th>
              <th className="py-3 px-4 w-[25%] text-left">양식 설명</th>
              <th className="py-3 px-4 w-[15%] text-left">태그</th>
              <th className="py-3 px-4 w-[13%] text-left">등록일 · 크기</th>
              <th className="py-3 px-4 w-[12%] text-right pr-5">다운로드 / 관리</th>
            </tr>
          </thead>
          <tbody>
            {docsList.map((doc) => (
              <tr key={doc.id} className="border-b border-toss-gray-50/50 dark:border-slate-850/60 hover:bg-slate-50/40 dark:hover:bg-slate-855/10 transition-colors font-semibold text-xs text-toss-gray-800 dark:text-slate-200">
                {/* File name & Icon */}
                <td className="py-3.5 px-4">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div className="w-8.5 h-8.5 rounded-xl bg-gray-50 dark:bg-slate-800/60 flex items-center justify-center shrink-0 border border-gray-100/10">
                      <FileIcon name={doc.original_name} className="w-4.5 h-4.5" />
                    </div>
                    <div className="flex flex-col min-w-0 text-left">
                      <span className="font-extrabold truncate text-toss-gray-850 dark:text-slate-250 block" title={doc.original_name}>
                        {doc.original_name}
                      </span>
                      <span className="text-[10px] text-toss-gray-400 dark:text-slate-500 font-medium truncate mt-0.5">
                        등록: {doc.uploader_name || '시스템'}
                      </span>
                    </div>
                  </div>
                </td>
                {/* Description */}
                <td className="py-3.5 px-4 text-left text-toss-gray-650 dark:text-slate-400 font-medium">
                  <p className="line-clamp-2 leading-relaxed" title={doc.description}>
                    {doc.description || '-'}
                  </p>
                </td>
                {/* Tags */}
                <td className="py-3.5 px-4 text-left">
                  {doc.tags ? (
                    <div className="flex flex-wrap gap-1 max-w-[150px]">
                      {doc.tags.split(',').filter(Boolean).map((tag, i) => (
                        <span key={i} className="flex items-center gap-0.5 px-2 py-0.5 bg-gray-50 dark:bg-slate-800/80 text-toss-gray-500 dark:text-slate-400 rounded text-[9.5px] font-bold border border-gray-100/10">
                          <Tag className="w-2.5 h-2.5" />{tag.trim()}
                        </span>
                      ))}
                    </div>
                  ) : '-'}
                </td>
                {/* Created Date & Size */}
                <td className="py-3.5 px-4 text-left text-toss-gray-550 dark:text-slate-400">
                  <div className="flex flex-col text-left font-medium">
                    <span>{formatDate(doc.created_at)}</span>
                    <span className="text-[10px] text-toss-gray-400 mt-0.5 font-mono">{formatFileSize(doc.file_size)}</span>
                  </div>
                </td>
                {/* Actions */}
                <td className="py-3.5 px-4 text-right pr-5">
                  <div className="flex items-center justify-end gap-1.5">
                    <button
                      type="button"
                      onClick={() => handleDownload(doc)}
                      disabled={downloadingId === doc.id}
                      className="p-1.5 rounded-xl bg-toss-blue text-white hover:bg-blue-600 disabled:opacity-40 transition-colors cursor-pointer inline-flex border-none shadow-sm"
                      title="다운로드"
                    >
                      {downloadingId === doc.id ? (
                        <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                      ) : (
                        <Download className="w-3.5 h-3.5" />
                      )}
                    </button>
                    {canManage && (
                      <>
                        <button
                          type="button"
                          onClick={() => setEditingDoc(doc)}
                          className="p-1.5 rounded-xl bg-gray-50 hover:bg-gray-100 dark:bg-slate-800 dark:hover:bg-slate-750 text-toss-gray-450 dark:text-slate-400 border border-gray-150 dark:border-slate-700 transition-colors cursor-pointer inline-flex"
                          title="정보 수정"
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDelete(doc)}
                          className="p-1.5 rounded-xl bg-gray-50 hover:bg-rose-50 dark:bg-slate-800 dark:hover:bg-rose-950/20 text-rose-500 hover:text-rose-600 border border-gray-150 dark:border-slate-700 transition-colors cursor-pointer inline-flex"
                          title="삭제"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  };

  return (
    <div className="flex-1 flex flex-col h-full min-h-0 overflow-hidden text-left pr-1">
      {/* ── 상단 헤더 ── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 shrink-0 select-none pb-4 border-b border-gray-150/45 dark:border-slate-800/40">
        <div className="text-left">
          <h1 className="text-xl font-extrabold text-toss-gray-900 dark:text-slate-100">서류 양식 라이브러리</h1>
          <p className="text-xs text-toss-gray-450 dark:text-slate-500 font-bold mt-1.5">
            자주 쓰는 전사 공용 양식 파일을 폴더 그룹별로 체계적으로 관리하고 즉시 활용해 보세요.
            <span className="ml-2 px-2.5 py-0.5 rounded-full bg-sky-500/10 text-toss-blue text-[10px] font-bold border border-sky-500/10">
              전사 공용
            </span>
          </p>
        </div>
        {canManage && (
          <button
            onClick={() => setShowUpload(true)}
            className="toss-btn toss-btn-primary px-4 py-2.5 rounded-xl font-bold text-xs flex items-center gap-1.5 hover:scale-[1.02] active:scale-[0.98] transition-all self-start sm:self-auto"
          >
            <Plus className="w-4 h-4" />
            양식 업로드
          </button>
        )}
      </div>

      {/* ── 메인 콘텐츠 레이아웃 (사이드바 + 메인 리스트) ── */}
      <div className="flex-1 flex gap-5 mt-4 min-h-0 overflow-hidden">
        
        {/* 좌측: 그룹 리스트 사이드바 */}
        <div className="w-60 shrink-0 flex flex-col gap-3.5 bg-gray-50/50 dark:bg-slate-900/35 border border-gray-100/70 dark:border-slate-800/70 p-4.5 rounded-[24px] min-h-0 overflow-hidden select-none">
          <div className="flex items-center justify-between">
            <span className="text-xs font-black text-toss-gray-800 dark:text-slate-300">서류 그룹 목록</span>
            <span className="text-[10px] font-extrabold text-toss-blue bg-toss-blue/5 px-1.5 py-0.5 rounded border border-toss-blue/10">
              총 {categories.length}개
            </span>
          </div>

          {/* 카테고리 버튼 목록 */}
          <div className="flex-1 overflow-y-auto pr-0.5 space-y-1.5 scrollbar-thin min-h-0 text-left">
            <button
              onClick={() => setActiveCategory('전체')}
              className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-left transition-all cursor-pointer text-xs font-bold border-none ${
                activeCategory === '전체'
                  ? 'bg-toss-blue text-white shadow-sm'
                  : 'bg-transparent text-toss-gray-700 hover:bg-gray-100 dark:text-slate-350 dark:hover:bg-slate-800/80'
              }`}
            >
              <div className="flex items-center gap-2">
                <FolderOpen className="w-3.5 h-3.5" />
                <span>전체 양식</span>
              </div>
              <span className={`text-[10px] font-extrabold px-1.5 py-0.5 rounded-md ${activeCategory === '전체' ? 'bg-white/20 text-white' : 'bg-slate-100 dark:bg-slate-800 text-slate-400 dark:text-slate-500'}`}>
                {documents.length}
              </span>
            </button>

            {categories.map((cat, idx) => {
              const count = documents.filter((doc) => doc.category === cat).length;
              const isSelected = activeCategory === cat;
              return (
                <div
                  key={cat}
                  draggable={canManage && editingCatName !== cat}
                  onDragStart={(e) => handleDragStart(e, idx)}
                  onDragOver={(e) => handleDragOver(e, idx)}
                  onDrop={(e) => handleDrop(e, idx)}
                  onDragEnd={handleDragEnd}
                  className={`group relative flex items-center rounded-xl transition-all ${
                    draggingIndex === idx ? 'opacity-40 bg-slate-150 dark:bg-slate-800' : ''
                  } ${
                    dragOverIndex === idx && draggingIndex !== idx
                      ? 'border-t-2 border-toss-blue pt-1.5'
                      : ''
                  }`}
                >
                  {canManage && editingCatName !== cat && (
                    <div className="absolute -left-3.5 w-4 h-8 flex items-center justify-center text-toss-gray-300 dark:text-slate-600 cursor-grab active:cursor-grabbing opacity-0 group-hover:opacity-100 transition-opacity shrink-0 z-20">
                      <GripVertical className="w-3.5 h-3.5" />
                    </div>
                  )}

                  {editingCatName === cat ? (
                    <div className="flex-1 flex items-center gap-1 px-2 py-1.5 bg-white dark:bg-slate-900 border border-toss-blue rounded-xl z-10">
                      <input
                        type="text"
                        value={editingCatInput}
                        onChange={(e) => setEditingCatInput(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') handleRenameCategory(cat, editingCatInput);
                          if (e.key === 'Escape') setEditingCatName(null);
                        }}
                        className="flex-1 min-w-0 text-xs font-bold bg-transparent border-none outline-none text-toss-gray-800 dark:text-slate-200"
                        autoFocus
                      />
                      <button
                        type="button"
                        onClick={() => handleRenameCategory(cat, editingCatInput)}
                        className="p-1 text-toss-blue hover:text-blue-600 bg-transparent border-none cursor-pointer"
                        title="저장"
                      >
                        <CheckCircle className="w-3.5 h-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => setEditingCatName(null)}
                        className="p-1 text-toss-gray-400 hover:text-rose-500 bg-transparent border-none cursor-pointer"
                        title="취소"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ) : (
                    <>
                      <button
                        onClick={() => setActiveCategory(cat)}
                        className={`flex-1 flex items-center justify-between px-3 py-2.5 rounded-xl text-left transition-all cursor-pointer text-xs font-bold border-none ${
                          isSelected
                            ? 'bg-toss-blue text-white shadow-sm'
                            : 'bg-transparent text-toss-gray-700 hover:bg-gray-100 dark:text-slate-350 dark:hover:bg-slate-800/80'
                        }`}
                      >
                        <div className="flex items-center gap-2 truncate">
                          <FileText className="w-3.5 h-3.5 shrink-0" />
                          <span className="truncate">{cat}</span>
                        </div>
                        <span className={`text-[10px] font-extrabold px-1.5 py-0.5 rounded-md shrink-0 ${isSelected ? 'bg-white/20 text-white' : 'bg-slate-100 dark:bg-slate-800 text-slate-400 dark:text-slate-500'}`}>
                          {count}
                        </span>
                      </button>

                      {/* 커스텀 카테고리 수정/삭제 버튼들 (기타 제외) */}
                      {canManage && cat !== '기타' && (
                        <div className="absolute right-2 flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 p-0.5 rounded-lg shadow-sm">
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setEditingCatName(cat);
                              setEditingCatInput(cat);
                            }}
                            className="p-1 rounded text-toss-gray-450 hover:text-toss-blue hover:bg-gray-100 dark:text-slate-450 dark:hover:bg-slate-800 cursor-pointer border-none bg-transparent"
                            title="그룹 이름 수정"
                          >
                            <Edit2 className="w-3 h-3" />
                          </button>
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleDeleteCategory(cat);
                            }}
                            className="p-1 rounded text-toss-gray-450 hover:text-red-500 hover:bg-gray-100 dark:text-slate-450 dark:hover:bg-slate-800 cursor-pointer border-none bg-transparent"
                            title="그룹 삭제"
                          >
                            <X className="w-3 h-3" />
                          </button>
                        </div>
                      )}
                    </>
                  )}
                </div>
              );
            })}
          </div>

          {/* 그룹 생성기 */}
          {canManage && (
            <div className="pt-3 border-t border-gray-150/45 dark:border-slate-800/50 shrink-0">
              {isAddingCategory ? (
                <div className="flex flex-col gap-1.5 text-left">
                  <input
                    type="text"
                    placeholder="새 그룹명..."
                    value={newCategoryInput}
                    onChange={(e) => setNewCategoryInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') handleAddCategory();
                      if (e.key === 'Escape') setIsAddingCategory(false);
                    }}
                    className="w-full text-xs px-2.5 py-2 border border-toss-blue rounded-xl bg-white dark:bg-slate-900 focus:outline-none font-bold text-toss-gray-800 dark:text-slate-200"
                    autoFocus
                  />
                  <div className="flex gap-1.5">
                    <button
                      type="button"
                      onClick={() => setIsAddingCategory(false)}
                      className="flex-1 py-1 rounded-lg bg-gray-100 dark:bg-slate-800 text-[10px] font-bold text-slate-500 cursor-pointer border-none"
                    >
                      취소
                    </button>
                    <button
                      type="button"
                      onClick={handleAddCategory}
                      className="flex-1 py-1 rounded-lg bg-toss-blue text-[10px] font-bold text-white cursor-pointer border-none"
                    >
                      추가
                    </button>
                  </div>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => {
                    setNewCategoryInput('');
                    setIsAddingCategory(true);
                  }}
                  className="w-full py-2 border border-dashed border-gray-200 dark:border-slate-700 hover:border-toss-blue hover:text-toss-blue bg-transparent rounded-xl text-xs font-bold text-toss-gray-400 dark:text-slate-500 transition-all cursor-pointer flex items-center justify-center gap-1"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>새 그룹 추가</span>
                </button>
              )}
            </div>
          )}
        </div>

        {/* 우측: 서류 목록형 테이블 */}
        <div className="flex-1 flex flex-col min-h-0 overflow-hidden">
          
          {/* 검색 바 & 새로고침 */}
          <div className="flex items-center gap-3 shrink-0 mb-4 select-none">
            <div className="relative flex-1 max-w-sm">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => handleSearch(e.target.value)}
                placeholder="파일명, 태그, 설명으로 검색..."
                className="toss-input pl-10"
              />
            </div>
            <button
              onClick={fetchDocuments}
              className="toss-btn toss-btn-secondary p-2 rounded-xl transition-all cursor-pointer"
              title="새로고침"
            >
              <RefreshCw className={`w-3.5 h-3.5 text-toss-gray-500 ${loading ? 'animate-spin' : ''}`} />
            </button>
            <span className="text-xs font-bold text-toss-gray-400 ml-auto select-none">
              {loading ? '불러오는 중...' : `총 ${filteredDocs.length}개 검색`}
            </span>
          </div>

          {/* 테이블 컨텐츠 리스트 */}
          <div className="flex-1 overflow-y-auto pr-0.5 scrollbar-thin min-h-0">
            {error && (
              <div className="flex items-center gap-2 px-4 py-3 bg-rose-500/10 border border-rose-500/20 rounded-xl text-rose-500 text-xs font-semibold mb-4">
                <AlertTriangle className="w-4 h-4 shrink-0" />
                <span>{error}</span>
              </div>
            )}

            {filteredDocs.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-gray-400 select-none py-20 bg-slate-50/20 dark:bg-slate-900/10 border border-dashed border-gray-100 dark:border-slate-800 rounded-3xl">
                <FolderOpen className="w-12 h-12 mb-2 opacity-25 text-toss-blue" />
                <p className="text-xs font-black text-toss-gray-500 dark:text-slate-400">양식 내역을 찾을 수 없습니다.</p>
                <p className="text-[10px] text-toss-gray-400 mt-1">
                  {canManage ? '양식 업로드를 통해 첫 문서를 등록해 보세요.' : '검색 필터 또는 키워드를 변경해 보세요.'}
                </p>
              </div>
            ) : (
              <div className="space-y-6 pb-6">
                {activeCategory === '전체' ? (
                  categories.map((cat) => {
                    const catDocs = filteredDocs.filter((d) => d.category === cat);
                    if (catDocs.length === 0) return null;
                    return (
                      <div key={cat} className="space-y-2.5">
                        <div className="flex items-center gap-2 pb-1.5 border-b border-gray-100/80 dark:border-slate-800/80 select-none">
                          <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-black border ${getCategoryColor(cat)}`}>
                            {cat}
                          </span>
                          <span className="text-[10px] font-black text-toss-gray-400 dark:text-slate-500">
                            총 {catDocs.length}건
                          </span>
                        </div>
                        {renderTemplateTable(catDocs)}
                      </div>
                    );
                  })
                ) : (
                  <div className="space-y-2.5">
                    <div className="flex items-center gap-2 pb-1.5 border-b border-gray-100/80 dark:border-slate-800/80 select-none">
                      <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-black border ${getCategoryColor(activeCategory)}`}>
                        {activeCategory}
                      </span>
                      <span className="text-[10px] font-black text-toss-gray-400 dark:text-slate-500">
                        총 {filteredDocs.length}건
                      </span>
                    </div>
                    {renderTemplateTable(filteredDocs)}
                  </div>
                )}
              </div>
            )}
          </div>

        </div>

      </div>

      {/* ── 업로드 모달 ── */}
      {showUpload && (
        <UploadModal
          categories={categories}
          onClose={() => setShowUpload(false)}
          onSuccess={() => { setShowUpload(false); fetchDocuments(); showToast('파일이 업로드되었습니다!'); }}
        />
      )}

      {/* ── 편집 모달 ── */}
      {editingDoc && (
        <EditModal
          categories={categories}
          doc={editingDoc}
          onClose={() => setEditingDoc(null)}
          onSuccess={() => { setEditingDoc(null); fetchDocuments(); showToast('수정되었습니다.'); }}
        />
      )}

      {/* ── 토스트 피드백 ── */}
      {toast && (
        <div className="fixed bottom-6 right-6 z-[200] px-5 py-3 bg-gray-900 text-white text-sm font-semibold rounded-2xl shadow-xl flex items-center gap-2.5 animate-fade-in">
          <CheckCircle className="w-4 h-4 text-emerald-400" />
          {toast}
        </div>
      )}
    </div>
  );
};
