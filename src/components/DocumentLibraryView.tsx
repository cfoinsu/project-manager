import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  uploadDocument,
  getDocuments,
  downloadDocument,
  updateDocument,
  deleteDocument,
  type DocTemplate
} from '../utils/api';
import { useAuthStore } from '../store/authStore';
import {
  Upload, Search, Download, Trash2, Edit2, X,
  FileText, FileSpreadsheet, File, Image,
  FolderOpen, Tag, RefreshCw, CheckCircle,
  AlertTriangle, Clock, Plus, Archive
} from 'lucide-react';

// ─── 카테고리 목록 ───────────────────────────────
const CATEGORIES = ['전체', '계약서', '품의서', '보고서', '기획서', '견적서', '회의록', '기타'];

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
    return <FileSpreadsheet className={`${className} text-emerald-600`} />;
  }
  if (['pdf'].includes(ext)) {
    return <FileText className={`${className} text-red-500`} />;
  }
  if (['hwp', 'hwpx', 'doc', 'docx'].includes(ext)) {
    return <FileText className={`${className} text-blue-500`} />;
  }
  if (['ppt', 'pptx'].includes(ext)) {
    return <File className={`${className} text-orange-500`} />;
  }
  return <Archive className={`${className} text-gray-400`} />;
}

// ─── 카테고리 뱃지 색상 ──────────────────────────
function getCategoryColor(cat: string): string {
  const map: Record<string, string> = {
    '계약서': 'bg-blue-50 text-blue-700 border-blue-200',
    '품의서': 'bg-purple-50 text-purple-700 border-purple-200',
    '보고서': 'bg-amber-50 text-amber-700 border-amber-200',
    '기획서': 'bg-teal-50 text-teal-700 border-teal-200',
    '견적서': 'bg-green-50 text-green-700 border-green-200',
    '회의록': 'bg-indigo-50 text-indigo-700 border-indigo-200',
    '기타': 'bg-gray-50 text-gray-600 border-gray-200',
  };
  return map[cat] || map['기타'];
}

// ─── 업로드 모달 ─────────────────────────────────
interface UploadModalProps {
  onClose: () => void;
  onSuccess: () => void;
}

const UploadModal: React.FC<UploadModalProps> = ({ onClose, onSuccess }) => {
  const [dragOver, setDragOver] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [category, setCategory] = useState('기타');
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
          <button onClick={onClose} className="p-2 rounded-xl hover:bg-gray-100 dark:hover:bg-slate-800 text-gray-400 transition-colors cursor-pointer">
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
                  onClick={e => { e.stopPropagation(); setSelectedFile(null); }}
                  className="mt-1.5 text-xs text-toss-gray-400 hover:text-rose-500 transition-colors font-bold cursor-pointer"
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
            <label className="text-xs font-bold text-toss-gray-450 dark:text-slate-500 uppercase tracking-wider">카테고리</label>
            <div className="flex flex-wrap gap-2">
              {CATEGORIES.filter(c => c !== '전체').map(cat => (
                <button
                  key={cat}
                  onClick={() => setCategory(cat)}
                  className={`px-3 py-1.5 rounded-full text-xs font-bold border transition-all cursor-pointer ${
                    category === cat
                      ? 'bg-toss-blue text-white border-toss-blue'
                      : 'bg-gray-50 dark:bg-slate-805 text-toss-gray-650 dark:text-slate-300 border-gray-200 dark:border-slate-700 hover:border-toss-blue'
                  }`}
                >
                  {cat}
                </button>
              ))}
            </div>
          </div>

          {/* 태그 */}
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-toss-gray-450 dark:text-slate-500 uppercase tracking-wider">태그 (쉼표 구분)</label>
            <input
              type="text"
              value={tags}
              onChange={e => setTags(e.target.value)}
              placeholder="예: 표준, 2024년, 본사용"
              className="toss-input"
            />
          </div>

          {/* 설명 */}
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-toss-gray-450 dark:text-slate-500 uppercase tracking-wider">설명 (선택)</label>
            <textarea
              value={description}
              onChange={e => setDescription(e.target.value)}
              placeholder="이 양식에 대한 간단한 설명..."
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
            <button onClick={onClose} className="toss-btn toss-btn-secondary flex-1 py-3 font-bold rounded-xl cursor-pointer">
              취소
            </button>
            <button
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
  doc: DocTemplate;
  onClose: () => void;
  onSuccess: () => void;
}

const EditModal: React.FC<EditModalProps> = ({ doc, onClose, onSuccess }) => {
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
          <button onClick={onClose} className="p-2 rounded-xl hover:bg-gray-100 dark:hover:bg-slate-800 text-gray-400 transition-colors cursor-pointer">
            <X className="w-4 h-4" />
          </button>
        </div>
        <div className="p-6 space-y-4">
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-toss-gray-450 dark:text-slate-500 uppercase tracking-wider">파일명</label>
            <input
              type="text"
              value={name}
              onChange={e => setName(e.target.value)}
              className="toss-input"
            />
          </div>
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-toss-gray-455 dark:text-slate-500 uppercase tracking-wider">카테고리</label>
            <div className="flex flex-wrap gap-2">
              {CATEGORIES.filter(c => c !== '전체').map(cat => (
                <button 
                  key={cat} 
                  onClick={() => setCategory(cat)}
                  className={`px-3 py-1.5 rounded-full text-xs font-bold border transition-all cursor-pointer ${
                    category === cat 
                      ? 'bg-toss-blue text-white border-toss-blue' 
                      : 'bg-gray-50 dark:bg-slate-805 text-toss-gray-650 dark:text-slate-300 border-gray-200 dark:border-slate-700 hover:border-toss-blue'
                  }`}
                >
                  {cat}
                </button>
              ))}
            </div>
          </div>
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-toss-gray-450 dark:text-slate-500 uppercase tracking-wider">태그</label>
            <input 
              type="text" 
              value={tags} 
              onChange={e => setTags(e.target.value)}
              className="toss-input" 
            />
          </div>
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-toss-gray-450 dark:text-slate-500 uppercase tracking-wider">설명</label>
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
            <button onClick={onClose} className="toss-btn toss-btn-secondary flex-1 py-3 font-bold rounded-xl cursor-pointer">취소</button>
            <button onClick={handleSave} disabled={saving}
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

  const canManage = currentUser?.role === 'admin' || currentUser?.role === 'manager';

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 3000);
  };

  const fetchDocuments = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params: any = {};
      if (searchQuery) params.q = searchQuery;
      if (activeCategory !== '전체') params.category = activeCategory;
      const data = await getDocuments(params);
      setDocuments(data);
    } catch (err: any) {
      setError(err.message || '문서 목록을 불러올 수 없습니다.');
    } finally {
      setLoading(false);
    }
  }, [searchQuery, activeCategory]);

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
    if (!confirm(`"${doc.original_name}" 파일을 삭제하시겠습니까?\n이 작업은 되돌릴 수 없습니다.`)) return;
    try {
      await deleteDocument(doc.id);
      setDocuments(prev => prev.filter(d => d.id !== doc.id));
      showToast('파일이 삭제되었습니다.');
    } catch (err: any) {
      showToast(err.message || '삭제 실패');
    }
  };

  // 검색 디바운스
  const searchTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const handleSearch = (val: string) => {
    setSearchQuery(val);
    clearTimeout(searchTimer.current);
    searchTimer.current = setTimeout(() => {}, 0);
  };

  return (
    <div className="flex-1 flex flex-col gap-5 text-left h-full min-h-0 overflow-y-auto pr-1">
      {/* 헤더 */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 shrink-0 select-none">
        <div>
          <h1 className="text-xl font-extrabold text-toss-gray-900 dark:text-slate-100">서류 양식 라이브러리</h1>
          <p className="text-xs text-toss-gray-450 dark:text-slate-500 font-bold mt-1.5">
            자주 쓰는 양식 파일을 업로드해두고 필요할 때 바로 다운로드하세요.
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

      {/* 검색 + 카테고리 필터 */}
      <div className="flex flex-col sm:flex-row gap-3 shrink-0">
        {/* 검색창 */}
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={e => handleSearch(e.target.value)}
            placeholder="파일명, 태그, 설명으로 검색..."
            className="toss-input pl-10"
          />
        </div>

        {/* 카테고리 필터 탭 */}
        <div className="flex items-center gap-1.5 bg-gray-150/70 dark:bg-slate-800/60 p-1.5 rounded-full overflow-x-auto shrink-0 border border-gray-200/20">
          {CATEGORIES.map(cat => (
            <button
              key={cat}
              onClick={() => setActiveCategory(cat)}
              className={`px-4 py-1.5 rounded-full text-xs font-bold whitespace-nowrap transition-all cursor-pointer ${
                activeCategory === cat
                  ? 'bg-white text-toss-blue shadow-sm dark:bg-slate-900'
                  : 'text-toss-gray-450 hover:text-toss-gray-800 dark:text-slate-300 dark:hover:text-white'
              }`}
            >
              {cat}
            </button>
          ))}
        </div>
      </div>

      {/* 결과 카운트 + 새로고침 */}
      <div className="flex items-center justify-between shrink-0">
        <span className="text-xs font-bold text-toss-gray-400">
          {loading ? '불러오는 중...' : `총 ${documents.length}개 양식`}
        </span>
        <button onClick={fetchDocuments} className="toss-btn toss-btn-secondary p-2 rounded-xl transition-all cursor-pointer" title="새로고침">
          <RefreshCw className={`w-3.5 h-3.5 text-toss-gray-500 ${loading ? 'animate-spin' : ''}`} />
        </button>
      </div>

      {/* 에러 */}
      {error && (
        <div className="flex items-center gap-2 px-4 py-3 bg-rose-500/10 border border-rose-500/20 rounded-xl text-rose-500 text-xs font-semibold shrink-0">
          <AlertTriangle className="w-4 h-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* 문서 그리드 */}
      {loading && documents.length === 0 ? (
        <div className="flex-1 flex items-center justify-center">
          <div className="flex flex-col items-center gap-3 text-gray-400">
            <div className="w-8 h-8 border-2 border-gray-300 border-t-toss-blue rounded-full animate-spin" />
            <p className="text-xs font-bold">문서를 불러오는 중...</p>
          </div>
        </div>
      ) : documents.length === 0 ? (
        <div className="flex-1 flex flex-col items-center justify-center text-gray-400 select-none">
          <FolderOpen className="w-14 h-14 mb-3 opacity-25" />
          <p className="text-sm font-bold">
            {searchQuery || activeCategory !== '전체' ? '검색 결과가 없습니다.' : '아직 업로드된 양식이 없습니다.'}
          </p>
          <p className="text-xs mt-1 text-gray-300">
            {canManage && !searchQuery && activeCategory === '전체' && '"양식 업로드" 버튼으로 추가하세요.'}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {documents.map(doc => (
            <div
              key={doc.id}
              className="toss-card toss-card-hover hover:scale-[1.01] flex flex-col gap-3.5 p-5 relative overflow-hidden"
            >
              {/* 아이콘 + 카테고리 */}
              <div className="flex items-start justify-between">
                <div className="w-12 h-12 rounded-[18px] bg-gray-50 dark:bg-slate-800/40 flex items-center justify-center shrink-0 border border-gray-100/30">
                  <FileIcon mimeType={doc.mime_type} name={doc.original_name} className="w-6 h-6" />
                </div>
                <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold border ${getCategoryColor(doc.category)}`}>
                  {doc.category}
                </span>
              </div>

              {/* 파일명 */}
              <div className="flex-1">
                <p className="text-sm font-extrabold text-toss-gray-800 dark:text-slate-200 leading-snug line-clamp-2 break-all" title={doc.original_name}>
                  {doc.original_name}
                </p>
                {doc.description && (
                  <p className="text-xs text-toss-gray-450 dark:text-slate-400 mt-1.5 line-clamp-2 font-medium leading-relaxed">{doc.description}</p>
                )}
              </div>

              {/* 태그 */}
              {doc.tags && (
                <div className="flex flex-wrap gap-1">
                  {doc.tags.split(',').filter(Boolean).map((tag, i) => (
                    <span key={i} className="flex items-center gap-0.5 px-2 py-0.5 bg-gray-50 dark:bg-slate-800 text-toss-gray-500 dark:text-slate-400 rounded-md text-[10px] font-bold border border-gray-100/10">
                      <Tag className="w-2.5 h-2.5" />{tag.trim()}
                    </span>
                  ))}
                </div>
              )}

              {/* 메타 정보 */}
              <div className="flex items-center justify-between text-[11px] text-toss-gray-400 border-t border-gray-100/40 dark:border-slate-800/40 pt-3 font-semibold">
                <span className="flex items-center gap-1">
                  <Clock className="w-3 h-3" />
                  {formatDate(doc.created_at)}
                </span>
                <span>{formatFileSize(doc.file_size)}</span>
              </div>

              {/* 업로더 */}
              <div className="text-[11px] text-toss-gray-400 font-semibold">
                업로더: <span className="font-extrabold text-toss-gray-650 dark:text-slate-350">{doc.uploader_name || '-'}</span>
              </div>

              {/* 액션 버튼 */}
              <div className="flex gap-2 mt-auto">
                <button
                  onClick={() => handleDownload(doc)}
                  disabled={downloadingId === doc.id}
                  className="toss-btn toss-btn-primary flex-1 py-2 text-xs font-bold rounded-xl transition-all cursor-pointer"
                >
                  {downloadingId === doc.id ? (
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <Download className="w-3.5 h-3.5" />
                  )}
                  다운로드
                </button>
                {canManage && (
                  <div className="flex gap-1">
                    <button
                      onClick={() => setEditingDoc(doc)}
                      className="toss-btn toss-btn-secondary p-2 rounded-xl transition-all cursor-pointer"
                      title="수정"
                    >
                      <Edit2 className="w-3.5 h-3.5 text-toss-gray-450" />
                    </button>
                    <button
                      onClick={() => handleDelete(doc)}
                      className="toss-btn toss-btn-secondary p-2 rounded-xl transition-all cursor-pointer text-rose-500 hover:text-rose-600 hover:bg-rose-500/5"
                      title="삭제"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* 모달 */}
      {showUpload && (
        <UploadModal
          onClose={() => setShowUpload(false)}
          onSuccess={() => { setShowUpload(false); fetchDocuments(); showToast('파일이 업로드되었습니다!'); }}
        />
      )}

      {editingDoc && (
        <EditModal
          doc={editingDoc}
          onClose={() => setEditingDoc(null)}
          onSuccess={() => { setEditingDoc(null); fetchDocuments(); showToast('수정되었습니다.'); }}
        />
      )}

      {/* 토스트 알림 */}
      {toast && (
        <div className="fixed bottom-6 right-6 z-[200] px-5 py-3 bg-gray-900 text-white text-sm font-semibold rounded-2xl shadow-xl flex items-center gap-2.5 animate-fade-in">
          <CheckCircle className="w-4 h-4 text-emerald-400" />
          {toast}
        </div>
      )}
    </div>
  );
};
