import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useProjectStore } from '../store/projectStore';
import { useAuthStore } from '../store/authStore';
import {
  getProjectAssets, uploadProjectAsset, deleteProjectAsset, getProjectAssetUrl,
  type ProjectAsset,
} from '../utils/api';
import { requestDeleteConfirmation } from '../utils/deleteConfirm';
import {
  Image as ImageIcon, Globe, Trash2, X, RefreshCw, ExternalLink,
  Monitor, AlertTriangle, FolderOpen, Maximize2, FileArchive,
} from 'lucide-react';

function formatFileSize(bytes: number): string {
  if (!bytes) return '0 B';
  const k = 1024, sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
}

export const ProjectDesignView: React.FC = () => {
  const { activeProject } = useProjectStore();
  const { user: currentUser, serverMode } = useAuthStore();
  const canManage = currentUser?.role === 'admin' || currentUser?.role === 'manager';

  const [assets, setAssets] = useState<ProjectAsset[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [uploadingType, setUploadingType] = useState<'image' | 'site' | null>(null);
  const [lightbox, setLightbox] = useState<ProjectAsset | null>(null);   // 이미지 확대
  const [siteView, setSiteView] = useState<ProjectAsset | null>(null);   // HTML 브라우저 보기
  const [toast, setToast] = useState<string | null>(null);

  const imageInputRef = useRef<HTMLInputElement>(null);
  const siteInputRef = useRef<HTMLInputElement>(null);

  const showToast = (m: string) => { setToast(m); window.setTimeout(() => setToast(null), 3000); };

  const fetchAssets = useCallback(async () => {
    if (!activeProject || !serverMode) return;
    setLoading(true);
    setError(null);
    try {
      setAssets(await getProjectAssets(activeProject.id));
    } catch (err: any) {
      setError(err.message || '불러오기 실패');
    } finally {
      setLoading(false);
    }
  }, [activeProject, serverMode]);

  useEffect(() => { fetchAssets(); }, [fetchAssets]);

  const handleUpload = async (files: FileList | null, type: 'image' | 'site') => {
    if (!files || files.length === 0 || !activeProject) return;
    setUploadingType(type);
    setError(null);
    try {
      for (const file of Array.from(files)) {
        const fd = new FormData();
        fd.append('file', file);
        fd.append('project_id', activeProject.id);
        fd.append('type', type);
        fd.append('title', file.name.replace(/\.[^.]+$/, ''));
        await uploadProjectAsset(fd);
      }
      await fetchAssets();
      showToast(type === 'image' ? '디자인 이미지가 업로드되었습니다.' : '퍼블 결과물이 업로드되었습니다.');
    } catch (err: any) {
      setError(err.message || '업로드 실패');
    } finally {
      setUploadingType(null);
    }
  };

  const handleDelete = async (asset: ProjectAsset) => {
    if (!requestDeleteConfirmation({
      title: asset.type === 'site' ? '퍼블 결과물 삭제' : '디자인 이미지 삭제',
      targetName: asset.title || asset.original_name,
      description: '이 작업은 되돌릴 수 없습니다.',
    })) return;
    try {
      await deleteProjectAsset(asset.id);
      setAssets(prev => prev.filter(a => a.id !== asset.id));
      showToast('삭제되었습니다.');
    } catch (err: any) {
      showToast(err.message || '삭제 실패');
    }
  };

  const images = assets.filter(a => a.type === 'image');
  const sites = assets.filter(a => a.type === 'site');

  // ── 프로젝트 미선택 ──
  if (!activeProject) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center text-toss-gray-400 select-none">
        <FolderOpen className="w-12 h-12 mb-3 opacity-30 text-toss-blue" />
        <p className="text-sm font-bold">먼저 프로젝트를 선택해 주세요.</p>
      </div>
    );
  }

  // ── 오프라인 모드 안내 ──
  if (!serverMode) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center text-toss-gray-400 select-none px-6 text-center">
        <Monitor className="w-12 h-12 mb-3 opacity-30 text-toss-blue" />
        <p className="text-sm font-bold text-toss-gray-600 dark:text-slate-300">디자인·퍼블 미리보기는 서버 연결 모드에서만 사용할 수 있습니다.</p>
        <p className="text-xs mt-1.5 text-toss-gray-400">파일을 팀과 공유하고 브라우저로 보려면 서버에 연결해 주세요.</p>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col h-full min-h-0 overflow-hidden text-left">
      {/* 헤더 */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 shrink-0 pb-4 border-b border-gray-150/45 dark:border-slate-800/40">
        <div>
          <h1 className="text-xl font-extrabold text-toss-gray-900 dark:text-slate-100">디자인 · 퍼블 미리보기</h1>
          <p className="text-xs text-toss-gray-450 dark:text-slate-500 font-bold mt-1.5">
            디자인 시안 이미지와 퍼블리싱(HTML) 결과물을 올려 팀과 함께 브라우저에서 바로 확인하세요.
          </p>
        </div>
        {canManage && (
          <div className="flex items-center gap-2 self-start sm:self-auto">
            <button
              onClick={() => imageInputRef.current?.click()}
              disabled={uploadingType !== null}
              className="toss-btn toss-btn-secondary px-3.5 py-2.5 rounded-xl font-bold text-xs flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
            >
              {uploadingType === 'image' ? <RefreshCw className="w-4 h-4 animate-spin" /> : <ImageIcon className="w-4 h-4" />}
              디자인 이미지
            </button>
            <button
              onClick={() => siteInputRef.current?.click()}
              disabled={uploadingType !== null}
              className="toss-btn toss-btn-primary px-3.5 py-2.5 rounded-xl font-bold text-xs flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
            >
              {uploadingType === 'site' ? <RefreshCw className="w-4 h-4 animate-spin" /> : <FileArchive className="w-4 h-4" />}
              퍼블 결과물(zip)
            </button>
            <input ref={imageInputRef} type="file" multiple accept="image/*" className="hidden"
              onChange={e => { handleUpload(e.target.files, 'image'); e.target.value = ''; }} />
            <input ref={siteInputRef} type="file" accept=".zip" className="hidden"
              onChange={e => { handleUpload(e.target.files, 'site'); e.target.value = ''; }} />
          </div>
        )}
      </div>

      <div className="flex-1 overflow-y-auto scrollbar-thin min-h-0 pt-4 space-y-8 pb-6 pr-1">
        {error && (
          <div className="flex items-center gap-2 px-4 py-3 bg-rose-500/10 border border-rose-500/20 rounded-xl text-rose-500 text-xs font-semibold">
            <AlertTriangle className="w-4 h-4 shrink-0" /><span>{error}</span>
          </div>
        )}

        {loading && assets.length === 0 && (
          <div className="flex items-center justify-center py-20 text-toss-gray-400 text-xs font-bold gap-2">
            <RefreshCw className="w-4 h-4 animate-spin" /> 불러오는 중...
          </div>
        )}

        {/* 퍼블 결과물 (HTML 브라우저 보기) */}
        <section className="space-y-3">
          <div className="flex items-center gap-2">
            <Globe className="w-4 h-4 text-toss-blue" />
            <h2 className="text-sm font-black text-toss-gray-800 dark:text-slate-200">퍼블리싱 결과물</h2>
            <span className="text-[10px] font-black text-toss-gray-400 bg-slate-100 dark:bg-slate-800 px-1.5 py-0.5 rounded">{sites.length}</span>
          </div>
          {sites.length === 0 ? (
            <p className="text-xs text-toss-gray-400 py-4">아직 등록된 퍼블 결과물이 없습니다. HTML/CSS/이미지가 담긴 폴더를 zip으로 압축해 업로드하세요.</p>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {sites.map(asset => (
                <div key={asset.id} className="group border border-gray-150 dark:border-slate-800 rounded-2xl p-4 bg-white dark:bg-slate-900 hover:shadow-md transition-all flex flex-col gap-3">
                  <div className="flex items-start gap-2.5">
                    <div className="w-10 h-10 rounded-xl bg-sky-500/10 flex items-center justify-center shrink-0">
                      <Globe className="w-5 h-5 text-toss-blue" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-extrabold text-toss-gray-850 dark:text-slate-200 truncate" title={asset.title || asset.original_name}>
                        {asset.title || asset.original_name}
                      </p>
                      <p className="text-[10px] text-toss-gray-400 font-mono truncate mt-0.5">{asset.entry_path}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5 mt-auto">
                    <button onClick={() => setSiteView(asset)}
                      className="flex-1 toss-btn toss-btn-primary py-2 rounded-lg text-xs font-bold flex items-center justify-center gap-1.5 cursor-pointer">
                      <Monitor className="w-3.5 h-3.5" />브라우저로 보기
                    </button>
                    <button onClick={() => window.open(getProjectAssetUrl(asset), '_blank')}
                      className="p-2 rounded-lg bg-gray-50 dark:bg-slate-800 text-toss-gray-500 hover:text-toss-blue border border-gray-150 dark:border-slate-700 cursor-pointer" title="새 탭에서 열기">
                      <ExternalLink className="w-3.5 h-3.5" />
                    </button>
                    {canManage && (
                      <button onClick={() => handleDelete(asset)}
                        className="p-2 rounded-lg bg-gray-50 dark:bg-slate-800 text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/20 border border-gray-150 dark:border-slate-700 cursor-pointer" title="삭제">
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

        {/* 디자인 이미지 */}
        <section className="space-y-3">
          <div className="flex items-center gap-2">
            <ImageIcon className="w-4 h-4 text-pink-500" />
            <h2 className="text-sm font-black text-toss-gray-800 dark:text-slate-200">디자인 시안</h2>
            <span className="text-[10px] font-black text-toss-gray-400 bg-slate-100 dark:bg-slate-800 px-1.5 py-0.5 rounded">{images.length}</span>
          </div>
          {images.length === 0 ? (
            <p className="text-xs text-toss-gray-400 py-4">아직 등록된 디자인 이미지가 없습니다.</p>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3">
              {images.map(asset => (
                <div key={asset.id} className="group relative rounded-2xl overflow-hidden border border-gray-150 dark:border-slate-800 bg-slate-50 dark:bg-slate-850 aspect-[4/3]">
                  <img
                    src={getProjectAssetUrl(asset)}
                    alt={asset.title || asset.original_name}
                    loading="lazy"
                    className="w-full h-full object-cover cursor-zoom-in transition-transform group-hover:scale-[1.03]"
                    onClick={() => setLightbox(asset)}
                  />
                  <div className="absolute inset-x-0 bottom-0 p-2 bg-gradient-to-t from-black/60 to-transparent opacity-0 group-hover:opacity-100 transition-opacity flex items-end justify-between">
                    <span className="text-[10px] font-bold text-white truncate pr-1">{asset.title || asset.original_name}</span>
                    <div className="flex items-center gap-1 shrink-0">
                      <button onClick={() => setLightbox(asset)} className="p-1 rounded bg-white/20 hover:bg-white/30 text-white cursor-pointer" title="크게 보기">
                        <Maximize2 className="w-3 h-3" />
                      </button>
                      {canManage && (
                        <button onClick={() => handleDelete(asset)} className="p-1 rounded bg-white/20 hover:bg-rose-500/70 text-white cursor-pointer" title="삭제">
                          <Trash2 className="w-3 h-3" />
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>

      {/* 이미지 라이트박스 */}
      {lightbox && (
        <div className="fixed inset-0 bg-black/80 z-[120] flex items-center justify-center p-6 animate-fade-in" onClick={() => setLightbox(null)}>
          <button className="absolute top-5 right-5 p-2.5 rounded-xl bg-white/10 hover:bg-white/20 text-white cursor-pointer border-none" onClick={() => setLightbox(null)}>
            <X className="w-5 h-5" />
          </button>
          <img src={getProjectAssetUrl(lightbox)} alt={lightbox.title} className="max-w-full max-h-full object-contain rounded-lg shadow-2xl" onClick={e => e.stopPropagation()} />
          <div className="absolute bottom-5 left-1/2 -translate-x-1/2 px-4 py-2 bg-black/50 rounded-full text-white text-xs font-bold">
            {lightbox.title || lightbox.original_name} · {formatFileSize(lightbox.file_size)}
          </div>
        </div>
      )}

      {/* HTML 브라우저 보기 */}
      {siteView && (
        <div className="fixed inset-0 bg-slate-950/70 z-[120] flex flex-col p-4 sm:p-8 animate-fade-in">
          <div className="flex items-center justify-between mb-3 shrink-0">
            <div className="flex items-center gap-2 min-w-0">
              <Globe className="w-4 h-4 text-sky-400 shrink-0" />
              <span className="text-sm font-bold text-white truncate">{siteView.title || siteView.original_name}</span>
            </div>
            <div className="flex items-center gap-2">
              <button onClick={() => window.open(getProjectAssetUrl(siteView), '_blank')}
                className="px-3 py-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-white text-xs font-bold flex items-center gap-1.5 cursor-pointer border-none">
                <ExternalLink className="w-3.5 h-3.5" />새 탭
              </button>
              <button onClick={() => setSiteView(null)} className="p-2 rounded-lg bg-white/10 hover:bg-white/20 text-white cursor-pointer border-none">
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>
          <iframe
            src={getProjectAssetUrl(siteView)}
            title={siteView.title || 'publish-preview'}
            className="flex-1 w-full rounded-xl bg-white border-none shadow-2xl"
            sandbox="allow-scripts allow-same-origin allow-popups allow-forms"
          />
        </div>
      )}

      {/* 토스트 */}
      {toast && (
        <div className="fixed bottom-6 right-6 z-[200] px-5 py-3 bg-gray-900 text-white text-sm font-semibold rounded-2xl shadow-xl flex items-center gap-2.5 animate-fade-in">
          <ImageIcon className="w-4 h-4 text-emerald-400" />{toast}
        </div>
      )}
    </div>
  );
};
