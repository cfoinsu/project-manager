import React, { useEffect, useMemo, useState, useRef } from 'react';
import { useAuthStore } from '../store/authStore';
import { 
  Database, 
  Trash2, 
  Sliders, 
  Info,
  ShieldAlert,
  Hash,
  MapPin,
  Briefcase,
  Tag,
  Globe,
  Check,
  Building2,
  Palette,
  ImagePlus,
  RotateCcw,
  Pencil,
  Activity,
  Plus,
  X
} from 'lucide-react';
import { isTauri } from '../utils/tauriBridge';
import { useProjectStore } from '../store/projectStore';
import { useBrandStore } from '../store/brandStore';
import { getApiBaseUrl, normalizeServerUrl, syncGlobalServerUrl, updateGlobalServerUrl } from '../utils/api';
import { getKoreaRegions, PROJECT_TYPE_CODES } from '../types';
import type { RegionGroup } from '../types';

export const SettingsView: React.FC = () => {
  const isTauriMode = isTauri();
  const { projects } = useProjectStore();
  const brand = useBrandStore();
  const { user, serverMode } = useAuthStore();
  const isAdmin = user?.role === 'admin';

  // ─── 서버 URL 상태
  const [serverUrl, setServerUrl] = useState(
    getApiBaseUrl()
  );

  // ─── 지역 설정 상태 및 핸들러
  const [regionsList, setRegionsList] = useState<RegionGroup[]>(() => getKoreaRegions());
  const [selectedProvinceName, setSelectedProvinceName] = useState<string>('서울특별시');
  const [disabledRegions, setDisabledRegions] = useState<string[]>(() => {
    try {
      const saved = localStorage.getItem('pa_disabled_regions');
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  // 지역 편집/추가 상태
  const [editingSubRegionCode, setEditingSubRegionCode] = useState<string | null>(null);
  const [editCodeValue, setEditCodeValue] = useState('');
  const [editNameValue, setEditNameValue] = useState('');

  const [isAddingSubRegion, setIsAddingSubRegion] = useState(false);
  const [newCodeValue, setNewCodeValue] = useState('');
  const [newNameValue, setNewNameValue] = useState('');

  const saveRegionsList = (newList: RegionGroup[]) => {
    setRegionsList(newList);
    localStorage.setItem('pa_custom_regions', JSON.stringify(newList));
  };

  const handleToggleRegion = (code: string) => {
    setDisabledRegions(prev => {
      const next = prev.includes(code) ? prev.filter(c => c !== code) : [...prev, code];
      localStorage.setItem('pa_disabled_regions', JSON.stringify(next));
      return next;
    });
  };

  const handleSaveEditSubRegion = (originalCode: string) => {
    const codeTrimmed = editCodeValue.trim().toUpperCase();
    const nameTrimmed = editNameValue.trim();

    if (!codeTrimmed || !nameTrimmed) {
      alert('코드와 지역명을 모두 입력해 주세요.');
      return;
    }
    if (!/^[A-Z0-9]+$/.test(codeTrimmed)) {
      alert('지역 코드는 영문 대문자와 숫자만 가능합니다.');
      return;
    }

    // 중복 체크
    const duplicate = regionsList.some(group =>
      group.subRegions.some(sub => sub.code === codeTrimmed && sub.code !== originalCode)
    );
    if (duplicate) {
      alert('이미 사용 중인 지역 코드입니다.');
      return;
    }

    const nextRegionsList = regionsList.map(group => {
      if (group.name === selectedProvinceName) {
        return {
          ...group,
          subRegions: group.subRegions.map(sub => {
            if (sub.code === originalCode) {
              return { code: codeTrimmed, name: nameTrimmed };
            }
            return sub;
          })
        };
      }
      return group;
    });

    if (originalCode !== codeTrimmed) {
      setDisabledRegions(prev => {
        let next = [...prev];
        if (prev.includes(originalCode)) {
          next = next.filter(c => c !== originalCode);
          next.push(codeTrimmed);
        }
        localStorage.setItem('pa_disabled_regions', JSON.stringify(next));
        return next;
      });
    }

    saveRegionsList(nextRegionsList);
    setEditingSubRegionCode(null);
  };

  const handleAddSubRegion = () => {
    const codeTrimmed = newCodeValue.trim().toUpperCase();
    const nameTrimmed = newNameValue.trim();

    if (!codeTrimmed || !nameTrimmed) {
      alert('코드와 지역명을 모두 입력해 주세요.');
      return;
    }
    if (!/^[A-Z0-9]+$/.test(codeTrimmed)) {
      alert('지역 코드는 영문 대문자와 숫자만 가능합니다.');
      return;
    }

    // 중복 체크
    const duplicate = regionsList.some(group =>
      group.subRegions.some(sub => sub.code === codeTrimmed)
    );
    if (duplicate) {
      alert('이미 사용 중인 지역 코드입니다.');
      return;
    }

    const nextRegionsList = regionsList.map(group => {
      if (group.name === selectedProvinceName) {
        return {
          ...group,
          subRegions: [...group.subRegions, { code: codeTrimmed, name: nameTrimmed }]
        };
      }
      return group;
    });

    saveRegionsList(nextRegionsList);
    setIsAddingSubRegion(false);
    setNewCodeValue('');
    setNewNameValue('');
  };

  const handleDeleteSubRegion = (code: string) => {
    const usageCount = codeStats.regionCounts[code] || 0;
    if (usageCount > 0) {
      alert(`이 지역 코드는 현재 ${usageCount}개의 프로젝트에서 사용 중이므로 삭제할 수 없습니다.`);
      return;
    }

    if (!confirm('정말 이 지역 코드를 삭제하시겠습니까?')) {
      return;
    }

    const nextRegionsList = regionsList.map(group => {
      if (group.name === selectedProvinceName) {
        return {
          ...group,
          subRegions: group.subRegions.filter(sub => sub.code !== code)
        };
      }
      return group;
    });

    setDisabledRegions(prev => {
      const next = prev.filter(c => c !== code);
      localStorage.setItem('pa_disabled_regions', JSON.stringify(next));
      return next;
    });

    saveRegionsList(nextRegionsList);
  };
  const [saveSuccess, setSaveSuccess] = useState(false);

  // ─── 브랜딩 편집 상태
  const [editingBrand, setEditingBrand] = useState(false);
  const [draftName, setDraftName] = useState(brand.companyName);
  const [draftSlogan, setDraftSlogan] = useState(brand.slogan);
  const [draftColor, setDraftColor] = useState(brand.primaryColor);
  const [draftLogo, setDraftLogo] = useState(brand.logoDataUrl);
  const [brandSaved, setBrandSaved] = useState(false);
  const logoInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    syncGlobalServerUrl().then((url) => {
      if (url) setServerUrl(url);
    });
  }, []);

  const handleSaveServerUrl = async () => {
    try {
      const url = normalizeServerUrl(serverUrl);
      const savedUrl = serverMode ? await updateGlobalServerUrl(url) : url;
      localStorage.setItem('pa_server_url', savedUrl);
      setServerUrl(savedUrl);
      setSaveSuccess(true);
      setTimeout(() => { setSaveSuccess(false); window.location.reload(); }, 1200);
    } catch (error: any) {
      alert(error.message || '서버 주소 저장에 실패했습니다.');
    }
  };

  // 브랜딩 저장
  const handleSaveBrand = () => {
    if (!draftName.trim()) { alert('시스템 명칭을 입력해 주세요.'); return; }
    brand.update({
      companyName: draftName.trim(),
      slogan: draftSlogan.trim(),
      primaryColor: draftColor,
      logoDataUrl: draftLogo,
    });
    setBrandSaved(true);
    setEditingBrand(false);
    setTimeout(() => setBrandSaved(false), 2000);
  };

  const handleLogoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 2 * 1024 * 1024) { alert('로고 이미지는 2MB 이하여야 합니다.'); return; }
    const reader = new FileReader();
    reader.onload = (ev) => {
      setDraftLogo(ev.target?.result as string || '');
    };
    reader.readAsDataURL(file);
  };

  const handleLogoRemove = () => setDraftLogo('');

  const handleResetBrand = () => {
    if (confirm('브랜딩을 기본값으로 초기화하시겠습니까?')) {
      brand.reset();
      setDraftName('Project Atlas');
      setDraftSlogan('Project OS');
      setDraftColor('#3182F6');
      setDraftLogo('');
      setEditingBrand(false);
    }
  };


  // 사용 중인 코드 목록 통계
  const codeStats = useMemo(() => {
    const regionCounts: Record<string, number> = {};
    const typeCounts: Record<string, number> = {};
    projects.forEach(p => {
      if (!p.code) return;
      // 지역 코드 추출 (앞 2자)
      const region = p.code.slice(0, 2);
      regionCounts[region] = (regionCounts[region] || 0) + 1;
      // 유형 코드 추출 (연도 2자 뒤 알파벳 1자)
      const afterYear = p.code.slice(4); // 예: W001 혹은 001
      const typeMatch = afterYear.match(/^([A-Z])\d/);
      if (typeMatch) {
        typeCounts[typeMatch[1]] = (typeCounts[typeMatch[1]] || 0) + 1;
      }
    });
    return { regionCounts, typeCounts };
  }, [projects]);

  const handleResetData = () => {
    if (window.confirm('정말 전체 데이터를 초기화하시겠습니까?\n프로젝트 내역 및 생성된 커스텀 템플릿이 모두 삭제됩니다.')) {
      localStorage.clear();
      window.location.reload();
    }
  };

  return (
    <div className="w-full flex-1 overflow-y-auto pr-1 flex flex-col gap-8 text-left select-none animate-slide-up pb-10 max-w-3xl">
      
      {/* Header */}
      <div className="flex flex-col shrink-0">
        <span className="text-xs font-bold text-toss-blue mb-1">Configuration</span>
        <h1 className="text-3xl font-extrabold text-toss-gray-900 dark:text-slate-100 tracking-tight">시스템 환경 설정</h1>
      </div>

      {/* ─── 브랜딩 설정 ─── */}
      <div className="flex flex-col gap-4">
        <h3 className="text-xs font-bold text-toss-gray-400 dark:text-slate-500 uppercase tracking-wider flex items-center gap-1.5 select-none">
          <Building2 className="w-4 h-4" /> 브랜드 / 시스템 정체성
        </h3>

        <div className="toss-card bg-white dark:bg-slate-900 border border-toss-gray-250 dark:border-slate-800 p-5 rounded-3xl flex flex-col gap-5">
          
          {/* 현재 브랜드 미리보기 */}
          <div className="flex items-center gap-4">
            {/* 로고 미리보기 */}
            <div
              className="w-14 h-14 rounded-2xl flex items-center justify-center shadow-sm shrink-0 overflow-hidden"
              style={{ backgroundColor: brand.logoDataUrl ? 'transparent' : brand.primaryColor + '20', border: `2px solid ${brand.primaryColor}30` }}
            >
              {brand.logoDataUrl ? (
                <img src={brand.logoDataUrl} alt="logo" className="w-full h-full object-contain" />
              ) : (
                <Activity className="w-7 h-7" style={{ color: brand.primaryColor }} />
              )}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-base font-extrabold text-slate-800 dark:text-slate-100 leading-tight">{brand.companyName}</p>
              <p className="text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider mt-0.5">{brand.slogan}</p>
              <div className="flex items-center gap-1.5 mt-1.5">
                <div className="w-3 h-3 rounded-full border border-slate-200" style={{ backgroundColor: brand.primaryColor }} />
                <span className="text-[11px] font-mono font-bold text-slate-400">{brand.primaryColor}</span>
              </div>
            </div>
            {isAdmin && (
              <div className="flex flex-col gap-1.5 shrink-0">
                <button
                  onClick={() => { setEditingBrand(v => !v); setDraftName(brand.companyName); setDraftSlogan(brand.slogan); setDraftColor(brand.primaryColor); setDraftLogo(brand.logoDataUrl); }}
                  className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-extrabold transition-colors cursor-pointer ${
                    editingBrand
                      ? 'bg-slate-100 dark:bg-slate-800 text-slate-600'
                      : 'bg-toss-blue text-white hover:bg-blue-600'
                  }`}
                >
                  <Pencil className="w-3.5 h-3.5" />
                  {editingBrand ? '편집 닫기' : '편집'}
                </button>
                <button
                  onClick={handleResetBrand}
                  className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold border border-slate-200 dark:border-slate-700 text-slate-500 hover:text-rose-500 hover:border-rose-300 transition-colors cursor-pointer"
                >
                  <RotateCcw className="w-3 h-3" />
                  초기화
                </button>
              </div>
            )}
          </div>

          {/* 편집 폼 */}
          {editingBrand && (
            <div className="flex flex-col gap-4 pt-4 border-t border-slate-100 dark:border-slate-800 animate-scale-in">
              
              {/* 로고 업로드 */}
              <div className="flex flex-col gap-2">
                <label className="text-xs font-bold text-slate-500 dark:text-slate-400 flex items-center gap-1.5">
                  <ImagePlus className="w-3.5 h-3.5" />
                  로고 이미지 (최대 2MB, PNG/JPG/SVG)
                </label>
                <div className="flex items-center gap-3">
                  <div
                    className="w-16 h-16 rounded-xl border-2 border-dashed border-slate-200 dark:border-slate-700 flex items-center justify-center overflow-hidden cursor-pointer hover:border-toss-blue transition-colors"
                    onClick={() => logoInputRef.current?.click()}
                    title="클릭하여 업로드"
                  >
                    {draftLogo ? (
                      <img src={draftLogo} alt="preview" className="w-full h-full object-contain" />
                    ) : (
                      <ImagePlus className="w-6 h-6 text-slate-300" />
                    )}
                  </div>
                  <div className="flex flex-col gap-2">
                    <button
                      type="button"
                      onClick={() => logoInputRef.current?.click()}
                      className="px-3 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 text-xs font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors cursor-pointer"
                    >
                      이미지 선택
                    </button>
                    {draftLogo && (
                      <button
                        type="button"
                        onClick={handleLogoRemove}
                        className="px-3 py-2 rounded-xl bg-rose-50 text-rose-500 text-xs font-bold hover:bg-rose-100 transition-colors cursor-pointer"
                      >
                        제거
                      </button>
                    )}
                  </div>
                  <input
                    ref={logoInputRef}
                    type="file"
                    accept="image/png,image/jpeg,image/svg+xml,image/webp"
                    className="hidden"
                    onChange={handleLogoUpload}
                  />
                  <p className="text-[11px] text-slate-400 leading-relaxed">
                    로고 없이 저장하면 기본<br />아이콘이 표시됩니다.
                  </p>
                </div>
              </div>

              {/* 명칭 + 슬로건 */}
              <div className="grid grid-cols-2 gap-3">
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-bold text-slate-500 dark:text-slate-400">시스템 명칭 *</label>
                  <input
                    type="text"
                    value={draftName}
                    onChange={e => setDraftName(e.target.value)}
                    placeholder="예: TechCorp PMS"
                    maxLength={30}
                    className="toss-input font-extrabold"
                  />
                </div>
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-bold text-slate-500 dark:text-slate-400">부제 / 슬로건</label>
                  <input
                    type="text"
                    value={draftSlogan}
                    onChange={e => setDraftSlogan(e.target.value)}
                    placeholder="예: Project Management System"
                    maxLength={40}
                    className="toss-input font-semibold"
                  />
                </div>
              </div>

              {/* 메인 컬러 */}
              <div className="flex flex-col gap-2">
                <label className="text-xs font-bold text-slate-500 dark:text-slate-400 flex items-center gap-1.5">
                  <Palette className="w-3.5 h-3.5" />
                  브랜드 메인 컬러
                </label>
                <div className="flex items-center gap-3 flex-wrap">
                  {/* 프리셋 */}
                  {['#3182F6','#8B5CF6','#10B981','#F59E0B','#EF4444','#EC4899','#06B6D4','#6366F1'].map(c => (
                    <button
                      key={c}
                      type="button"
                      onClick={() => setDraftColor(c)}
                      className={`w-7 h-7 rounded-full border-2 transition-transform cursor-pointer hover:scale-110 ${
                        draftColor === c ? 'border-slate-800 dark:border-white scale-110' : 'border-transparent'
                      }`}
                      style={{ backgroundColor: c }}
                    />
                  ))}
                  {/* 직접 선택 */}
                  <label className="relative cursor-pointer">
                    <input
                      type="color"
                      value={draftColor}
                      onChange={e => setDraftColor(e.target.value)}
                      className="absolute opacity-0 w-0 h-0"
                    />
                    <div className="w-7 h-7 rounded-full border-2 border-dashed border-slate-300 dark:border-slate-600 flex items-center justify-center hover:border-slate-500 transition-colors">
                      <Palette className="w-3.5 h-3.5 text-slate-400" />
                    </div>
                  </label>
                  <span className="font-mono text-xs font-bold text-slate-500">{draftColor}</span>
                </div>
              </div>

              {/* 실시간 미리보기 */}
              <div className="flex items-center gap-3 px-4 py-3 bg-slate-50 dark:bg-slate-800/40 rounded-2xl border border-slate-100 dark:border-slate-800">
                <div
                  className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0 overflow-hidden"
                  style={{ backgroundColor: draftLogo ? 'transparent' : draftColor + '20' }}
                >
                  {draftLogo ? (
                    <img src={draftLogo} alt="preview" className="w-full h-full object-contain" />
                  ) : (
                    <Activity className="w-5 h-5" style={{ color: draftColor }} />
                  )}
                </div>
                <div className="flex flex-col text-left">
                  <span className="text-sm font-extrabold text-slate-800 dark:text-slate-100 leading-none" style={{ color: draftColor === '#3182F6' ? undefined : draftColor }}>
                    {draftName || 'System Name'}
                  </span>
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mt-0.5">
                    {draftSlogan || 'Subtitle'}
                  </span>
                </div>
                <span className="ml-auto text-[10px] font-bold text-slate-400 bg-slate-100 dark:bg-slate-700 px-2 py-0.5 rounded-md">미리보기</span>
              </div>

              {/* 저장 버튼 */}
              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setEditingBrand(false)}
                  className="px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-50 cursor-pointer transition-colors"
                >
                  취소
                </button>
                <button
                  onClick={handleSaveBrand}
                  className="flex items-center gap-1.5 px-5 py-2 rounded-xl bg-toss-blue text-white text-xs font-extrabold hover:bg-blue-600 transition-colors cursor-pointer"
                >
                  <Check className="w-3.5 h-3.5" />
                  저장 및 적용
                </button>
              </div>
            </div>
          )}

          {brandSaved && (
            <div className="flex items-center gap-2 text-emerald-600 text-xs font-bold">
              <Check className="w-3.5 h-3.5" />
              브랜딩이 저장되었습니다. 사이드바와 로그인 화면에 즉시 반영됩니다.
            </div>
          )}
        </div>
      </div>

      <div className="flex flex-col gap-4">
        <h3 className="text-xs font-bold text-toss-gray-400 dark:text-slate-500 uppercase tracking-wider flex items-center gap-1.5 select-none">
          <Hash className="w-4 h-4" /> 프로젝트 코드 체계
        </h3>

        {/* Code Format Explanation */}
        <div className="toss-card bg-white dark:bg-slate-900 border border-toss-gray-250 dark:border-slate-800 p-5 rounded-3xl flex flex-col gap-5">
          
          {/* Code format visual */}
          <div className="flex flex-col gap-3">
            <span className="text-xs font-bold text-toss-gray-500 dark:text-slate-400">코드 생성 형식</span>
            <div className="flex items-stretch gap-0 rounded-[20px] overflow-hidden border border-gray-100 dark:border-slate-800 text-center text-sm font-extrabold font-mono shadow-soft-sm">
              <div className="flex-1 bg-sky-500/10 text-toss-blue px-3 py-3 flex flex-col gap-1">
                <span className="text-lg">HC</span>
                <span className="text-[10px] font-bold text-toss-blue/70 uppercase tracking-wider">지역코드</span>
              </div>
              <div className="w-px bg-gray-100 dark:bg-slate-800" />
              <div className="flex-1 bg-purple-500/10 text-purple-500 px-3 py-3 flex flex-col gap-1">
                <span className="text-lg">26</span>
                <span className="text-[10px] font-bold text-purple-400 uppercase tracking-wider">연도(자동)</span>
              </div>
              <div className="w-px bg-gray-100 dark:bg-slate-800" />
              <div className="flex-1 bg-amber-500/10 text-amber-600 dark:text-amber-400 px-3 py-3 flex flex-col gap-1">
                <span className="text-lg">W</span>
                <span className="text-[10px] font-bold text-amber-500/70 uppercase tracking-wider">유형(선택)</span>
              </div>
              <div className="w-px bg-gray-100 dark:bg-slate-800" />
              <div className="flex-1 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 px-3 py-3 flex flex-col gap-1">
                <span className="text-lg">001</span>
                <span className="text-[10px] font-bold text-emerald-500/70 uppercase tracking-wider">순번(자동)</span>
              </div>
            </div>
            <p className="text-xs text-toss-gray-450 dark:text-slate-500 font-semibold leading-relaxed">
              예시: <span className="font-mono font-extrabold text-toss-blue">HC26W001</span> = 홍천군 / 2026년 / 웹구축 / 1번째 프로젝트
              <br/>유형 코드 없이 생성 시: <span className="font-mono font-extrabold text-toss-blue">HC26001</span>
            </p>
          </div>

          <hr className="border-t border-gray-100/50 dark:border-slate-800/40" />

          {/* Usage stats */}
          {projects.length > 0 && (
            <div className="flex flex-col gap-3">
              <div className="flex items-center gap-2">
                <Tag className="w-3.5 h-3.5 text-toss-gray-400" />
                <span className="text-xs font-bold text-toss-gray-500 dark:text-slate-400">현재 사용 중인 코드 ({projects.length}개 프로젝트)</span>
              </div>
              <div className="flex flex-wrap gap-2">
                {projects.filter(p => p.code).map(p => (
                  <span key={p.id} className="px-2.5 py-0.5 rounded-full bg-sky-500/10 text-toss-blue text-xs font-extrabold font-mono border border-sky-500/10">
                    {p.code}
                  </span>
                ))}
                {projects.filter(p => !p.code).length > 0 && (
                  <span className="px-2.5 py-0.5 rounded-full bg-gray-100 dark:bg-slate-800 text-toss-gray-400 text-xs font-bold">
                    코드 없음 {projects.filter(p => !p.code).length}개
                  </span>
                )}
              </div>
            </div>
          )}

          <hr className="border-t border-gray-100/50 dark:border-slate-800/40" />

          {/* Region Codes Settings */}
          <div className="flex flex-col gap-3.5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <MapPin className="w-3.5 h-3.5 text-toss-gray-400" />
                <span className="text-xs font-bold text-toss-gray-500 dark:text-slate-400">지역 코드 활성/비활성 및 관리</span>
              </div>
              <span className="text-[10px] text-toss-gray-455 dark:text-slate-500">도 &gt; 시(군) 구조로 지역 코드를 활성화하거나 직접 수정/추가/삭제할 수 있습니다.</span>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 border border-gray-100 dark:border-slate-800/60 rounded-3xl p-4 bg-gray-50/20 dark:bg-slate-950/20">
              {/* Left Pane: Provinces */}
              <div className="flex flex-col gap-1 pr-2 border-r border-gray-100 dark:border-slate-800 max-h-80 overflow-y-auto scrollbar-thin">
                {regionsList.map(group => {
                  const activeCount = group.subRegions.filter(r => !disabledRegions.includes(r.code)).length;
                  const totalCount = group.subRegions.length;
                  const isSelected = selectedProvinceName === group.name;
                  return (
                    <button
                      key={group.name}
                      type="button"
                      onClick={() => {
                        setSelectedProvinceName(group.name);
                        setEditingSubRegionCode(null);
                        setIsAddingSubRegion(false);
                      }}
                      className={`flex items-center justify-between px-4 py-2.5 rounded-full text-left text-xs font-bold transition-all duration-200 hover:scale-[1.02] cursor-pointer ${
                        isSelected
                          ? 'bg-toss-blue text-white shadow-sm'
                          : 'text-toss-gray-700 dark:text-slate-350 hover:bg-slate-100/50 dark:hover:bg-slate-800/50'
                      }`}
                    >
                      <span>{group.name}</span>
                      <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-extrabold ${
                        activeCount === 0 
                          ? 'bg-red-500/10 text-red-500' 
                          : activeCount === totalCount 
                            ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400' 
                            : 'bg-amber-500/10 text-amber-600 dark:text-amber-400'
                      }`}>
                        {activeCount}/{totalCount}
                      </span>
                    </button>
                  );
                })}
              </div>

              {/* Right Pane: Cities Grid */}
              <div className="md:col-span-2 flex flex-col gap-3 max-h-80 overflow-y-auto pl-1 pr-1 scrollbar-thin">
                <div className="flex items-center justify-between px-1">
                  <span className="text-xs font-extrabold text-toss-gray-800 dark:text-slate-300 flex items-center gap-1.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-toss-blue"></span>
                    <span>{selectedProvinceName} 상세 지역 목록</span>
                  </span>
                  {isAdmin && (
                    <div className="flex items-center gap-2.5">
                      <button
                        type="button"
                        onClick={() => {
                          const targetGroup = regionsList.find(g => g.name === selectedProvinceName);
                          if (!targetGroup) return;
                          const targetCodes = targetGroup.subRegions.map(r => r.code);
                          const allActive = targetCodes.every(code => !disabledRegions.includes(code));
                          setDisabledRegions(prev => {
                            let next;
                            if (allActive) {
                              next = [...new Set([...prev, ...targetCodes])];
                            } else {
                              next = prev.filter(code => !targetCodes.includes(code));
                            }
                            localStorage.setItem('pa_disabled_regions', JSON.stringify(next));
                            return next;
                          });
                        }}
                        className="text-[10px] font-bold text-toss-blue hover:underline cursor-pointer"
                      >
                        {regionsList.find(g => g.name === selectedProvinceName)?.subRegions.every(r => !disabledRegions.includes(r.code))
                          ? '전체 비활성화'
                          : '전체 활성화'}
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setIsAddingSubRegion(true);
                          setNewCodeValue('');
                          setNewNameValue('');
                        }}
                        className="flex items-center gap-1 text-[10px] font-extrabold text-toss-blue bg-toss-blue/10 px-2 py-1 rounded-lg hover:bg-toss-blue/20 transition-all cursor-pointer"
                      >
                        <Plus className="w-3 h-3" />
                        지역 추가
                      </button>
                    </div>
                  )}
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {/* Inline Add Form */}
                  {isAddingSubRegion && (
                    <div className="col-span-full p-4 bg-toss-blue/5 dark:bg-toss-blue/10 border border-toss-blue/20 rounded-2xl flex flex-col gap-3 animate-scale-in">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-extrabold text-toss-blue">새 상세 지역 추가 ({selectedProvinceName})</span>
                        <button 
                          type="button"
                          onClick={() => setIsAddingSubRegion(false)}
                          className="p-1 rounded-md hover:bg-toss-blue/10 text-toss-gray-400 cursor-pointer"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                        <div className="flex flex-col gap-1">
                          <label className="text-[10px] font-bold text-slate-500">지역 코드 (예: TEST)</label>
                          <input
                            type="text"
                            placeholder="영문 대문자/숫자"
                            value={newCodeValue}
                            onChange={e => setNewCodeValue(e.target.value.toUpperCase())}
                            className="toss-input py-1.5 px-3 text-xs font-bold font-mono"
                          />
                        </div>
                        <div className="flex flex-col gap-1">
                          <label className="text-[10px] font-bold text-slate-500">지역명 (예: 테스트군)</label>
                          <input
                            type="text"
                            placeholder="한글/영문 지역명"
                            value={newNameValue}
                            onChange={e => setNewNameValue(e.target.value)}
                            className="toss-input py-1.5 px-3 text-xs font-bold"
                          />
                        </div>
                      </div>
                      <div className="flex justify-end gap-1.5">
                        <button
                          type="button"
                          onClick={() => setIsAddingSubRegion(false)}
                          className="px-3 py-1.5 border border-slate-200 dark:border-slate-700 text-[10px] font-bold text-slate-500 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-800 cursor-pointer"
                        >
                          취소
                        </button>
                        <button
                          type="button"
                          onClick={handleAddSubRegion}
                          className="px-3 py-1.5 bg-toss-blue text-[10px] font-extrabold text-white rounded-lg hover:bg-blue-600 cursor-pointer"
                        >
                          등록
                        </button>
                      </div>
                    </div>
                  )}

                  {regionsList.find(g => g.name === selectedProvinceName)?.subRegions.map(r => {
                    const isActive = !disabledRegions.includes(r.code);
                    const usageCount = codeStats.regionCounts[r.code] || 0;
                    const isEditing = editingSubRegionCode === r.code;

                    if (isEditing) {
                      return (
                        <div
                          key={r.code}
                          className="col-span-1 p-3.5 bg-white dark:bg-slate-855 border border-toss-blue/30 rounded-[20px] flex flex-col gap-2.5 shadow-md animate-scale-in"
                        >
                          <div className="flex flex-col gap-1.5">
                            <input
                              type="text"
                              placeholder="코드 (대문자)"
                              value={editCodeValue}
                              onChange={e => setEditCodeValue(e.target.value.toUpperCase())}
                              className="toss-input py-1 px-2.5 text-xs font-mono font-bold"
                            />
                            <input
                              type="text"
                              placeholder="지역명"
                              value={editNameValue}
                              onChange={e => setEditNameValue(e.target.value)}
                              className="toss-input py-1 px-2.5 text-xs font-bold"
                            />
                          </div>
                          <div className="flex justify-end gap-1.5">
                            <button
                              type="button"
                              onClick={() => setEditingSubRegionCode(null)}
                              className="px-2.5 py-1 border border-slate-200 dark:border-slate-700 text-[10px] font-bold text-slate-500 rounded-md hover:bg-slate-50 cursor-pointer"
                            >
                              취소
                            </button>
                            <button
                              type="button"
                              onClick={() => handleSaveEditSubRegion(r.code)}
                              className="px-3 py-1 bg-toss-blue text-[10px] font-extrabold text-white rounded-md hover:bg-blue-600 cursor-pointer"
                            >
                              저장
                            </button>
                          </div>
                        </div>
                      );
                    }

                    return (
                      <div
                        key={r.code}
                        className={`flex flex-col gap-2 p-3.5 rounded-[20px] border text-xs transition-all duration-200 ${
                          isActive
                            ? 'bg-white dark:bg-slate-850 border-slate-100 dark:border-slate-800/80 shadow-sm hover:shadow-md'
                            : 'bg-slate-50/40 dark:bg-slate-900/30 border-slate-100/20 dark:border-slate-900/20 opacity-60'
                        }`}
                      >
                        <div className="flex items-start justify-between w-full">
                          <div className="flex flex-col gap-0.5">
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <span className={`font-mono font-extrabold ${isActive ? 'text-toss-blue' : 'text-toss-gray-400 dark:text-slate-600'}`}>
                                {r.code}
                              </span>
                              <span className="font-extrabold text-toss-gray-800 dark:text-slate-300">
                                {r.name}
                              </span>
                            </div>
                            {usageCount > 0 && (
                              <span className="text-[10px] text-toss-blue font-bold mt-0.5">
                                사용 중: {usageCount}개 프로젝트
                              </span>
                            )}
                          </div>

                          <button
                            type="button"
                            onClick={() => handleToggleRegion(r.code)}
                            disabled={!isAdmin}
                            className={`relative inline-flex h-4.5 w-8 shrink-0 rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                              isActive ? 'bg-toss-blue' : 'bg-gray-200 dark:bg-slate-700'
                            } ${!isAdmin ? 'cursor-not-allowed opacity-60' : 'cursor-pointer'}`}
                          >
                            <span className={`pointer-events-none inline-block h-3.5 w-3.5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                              isActive ? 'translate-x-3.5' : 'translate-x-0'
                            }`} />
                          </button>
                        </div>

                        {isAdmin && (
                          <div className="flex items-center justify-end gap-1.5 pt-1.5 border-t border-slate-100/50 dark:border-slate-800/40 mt-1">
                            <button
                              type="button"
                              onClick={() => {
                                setEditingSubRegionCode(r.code);
                                setEditCodeValue(r.code);
                                setEditNameValue(r.name);
                              }}
                              className="p-1 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400 hover:text-toss-blue transition-colors cursor-pointer"
                              title="지역 코드 및 이름 수정"
                            >
                              <Pencil className="w-3.5 h-3.5" />
                            </button>
                            <button
                              type="button"
                              onClick={() => handleDeleteSubRegion(r.code)}
                              disabled={usageCount > 0}
                              className={`p-1 rounded-lg transition-colors ${
                                usageCount > 0
                                  ? 'text-slate-200 dark:text-slate-800 cursor-not-allowed'
                                  : 'hover:bg-rose-50 dark:hover:bg-rose-950/20 text-slate-400 hover:text-rose-500 cursor-pointer'
                              }`}
                              title={usageCount > 0 ? "프로젝트에서 사용 중인 코드는 삭제할 수 없습니다" : "지역 코드 삭제"}
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>

          <hr className="border-t border-gray-100/50 dark:border-slate-800/40" />

          {/* Type Codes Table */}
          <div className="flex flex-col gap-3">
            <div className="flex items-center gap-2">
              <Briefcase className="w-3.5 h-3.5 text-toss-gray-400" />
              <span className="text-xs font-bold text-toss-gray-500 dark:text-slate-400">프로젝트 유형 코드 목록</span>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5">
              {PROJECT_TYPE_CODES.map(t => (
                <div 
                  key={t.code}
                  className={`flex items-center justify-between px-3.5 py-2 rounded-2xl text-xs transition-colors ${
                    codeStats.typeCounts[t.code] 
                      ? 'bg-amber-500/10 border border-amber-500/20' 
                      : 'bg-gray-50/50 dark:bg-slate-850/40 border border-gray-100/50 dark:border-slate-800/40'
                  }`}
                >
                  <span className={`font-extrabold font-mono ${codeStats.typeCounts[t.code] ? 'text-amber-600 dark:text-amber-400' : 'text-toss-gray-600 dark:text-slate-400'}`}>
                    {t.code}
                  </span>
                  <span className="text-toss-gray-500 dark:text-slate-500 truncate ml-2 text-xs">{t.name}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Server Configuration Group */}
      <div className="flex flex-col gap-4">
        <h3 className="text-xs font-bold text-toss-gray-400 dark:text-slate-500 uppercase tracking-wider flex items-center gap-1.5 select-none">
          <Globe className="w-4 h-4" /> 사내 서버 연동 설정
        </h3>

        <div className="toss-card flex flex-col gap-4">
          <div className="flex flex-col gap-2">
            <label className="text-xs font-bold text-toss-gray-500 dark:text-slate-400">사내 백엔드 서버 URL</label>
            <div className="flex gap-2">
              <input
                type="text"
                value={serverUrl}
                onChange={(e) => setServerUrl(e.target.value)}
                placeholder="예: http://192.168.0.50:5000"
                className="toss-input flex-1 font-mono"
                disabled={!isAdmin}
              />
              {isAdmin && (
                <button
                  onClick={handleSaveServerUrl}
                  className="toss-btn toss-btn-primary px-4 py-2 text-xs h-[42px] shrink-0"
                >
                  {saveSuccess ? (
                    <><Check className="w-3.5 h-3.5" /> 저장됨</>
                  ) : (
                    '저장 및 반영'
                  )}
                </button>
              )}
            </div>
            <p className="text-[11px] text-toss-gray-450 dark:text-slate-500 leading-normal font-semibold">
              ※ 사내망 내 중앙 서버 컴퓨터의 IP와 포트(기본 5000)를 입력하십시오. (기본값: http://localhost:5000)
              <br />
              ※ 저장 시 연동 확인을 위해 페이지가 자동으로 새로고침됩니다.
            </p>
          </div>
        </div>
      </div>

      {/* Database Settings Group */}
      <div className="flex flex-col gap-4">
        <h3 className="text-xs font-bold text-toss-gray-400 dark:text-slate-500 uppercase tracking-wider flex items-center gap-1.5 select-none">
          <Database className="w-4 h-4" /> 데이터 스토리지 및 인프라
        </h3>
        
        <div className="toss-card bg-white dark:bg-slate-900 border border-toss-gray-250 dark:border-slate-800 p-5 rounded-3xl flex flex-col gap-4">
          <div className="flex flex-col text-left">
            <span className="text-xs font-bold text-toss-gray-500 dark:text-slate-400">데이터베이스 구동 모드</span>
            <span className="text-sm font-extrabold text-toss-gray-800 dark:text-slate-200 mt-1">
              {isTauriMode ? 'Native SQLite (인앱 백엔드 연동)' : 'Browser LocalStorage Fallback'}
            </span>
          </div>

          <div className="flex flex-col text-left">
            <span className="text-xs font-bold text-toss-gray-500 dark:text-slate-400">DB 파일 저장소 위치</span>
            <span className="text-xs font-bold text-toss-gray-650 dark:text-slate-450 mt-1 select-all break-all bg-toss-gray-50 dark:bg-slate-850 px-3.5 py-2.5 rounded-xl border border-toss-gray-200/50 dark:border-slate-800/60">
              {isTauriMode 
                ? 'AppData/Roaming/com.folder-atlas.app/project_atlas.db' 
                : '웹 브라우저 Sandbox 로컬 스토리지 캐시'}
            </span>
          </div>

          <hr className="border-t border-toss-gray-100 dark:border-slate-800/80 my-1" />

          {/* Reset button */}
          <div className="flex justify-between items-center">
            <div className="flex flex-col">
              <span className="text-xs font-bold text-toss-gray-800 dark:text-slate-200">애플리케이션 데이터 전체 포맷</span>
              <span className="text-xs text-toss-gray-450 dark:text-slate-500 mt-0.5">※ 데이터베이스를 최초 런칭 상태로 강제 복구 및 마이그레이션을 재수행합니다.</span>
            </div>
            {isAdmin && (
              <button
                onClick={handleResetData}
                className="px-4 py-2.5 bg-rose-50 hover:bg-rose-100 dark:bg-rose-500/10 dark:hover:bg-rose-500/20 text-toss-red text-xs font-extrabold rounded-xl border border-toss-red/20 flex items-center gap-1.5 transition-colors cursor-pointer"
              >
                <Trash2 className="w-3.5 h-3.5" />
                DB 전체 초기화
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Health Assessment Config Group */}
      <div className="flex flex-col gap-4">
        <h3 className="text-xs font-bold text-toss-gray-450 dark:text-slate-500 uppercase tracking-wider flex items-center gap-1.5 select-none">
          <Sliders className="w-4 h-4" /> 건강도(Health Score) 가중치 규칙
        </h3>
        
        <div className="toss-card bg-white dark:bg-slate-900 border border-toss-gray-250 dark:border-slate-800 p-5 rounded-3xl flex flex-col gap-4.5 text-xs text-toss-gray-750 dark:text-slate-350">
          <p className="font-semibold leading-relaxed text-toss-gray-500 dark:text-slate-400">
            프로젝트 운영체제는 아래의 4가지 평가지수 요소를 취합해 100점 만점으로 스코어링을 산출합니다. 현재는 표준 가중치가 활성화되어 있습니다.
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-2">
            <div className="p-4 bg-toss-gray-50 dark:bg-slate-850 rounded-2xl flex flex-col gap-1 border border-toss-gray-200/20">
              <span className="font-extrabold text-toss-gray-800 dark:text-slate-200">1. 하위 태스크 완료율 (40%)</span>
              <span className="text-xs text-toss-gray-450 dark:text-slate-500 mt-0.5">칸반 태스크 보드의 완료 상태 작업 비율</span>
            </div>

            <div className="p-4 bg-toss-gray-50 dark:bg-slate-850 rounded-2xl flex flex-col gap-1 border border-toss-gray-200/20">
              <span className="font-extrabold text-toss-gray-800 dark:text-slate-200">2. 필수 산출물 증적율 (30%)</span>
              <span className="text-xs text-toss-gray-455 dark:text-slate-500 mt-0.5">필수 템플릿 문서 매칭 파일 감지율</span>
            </div>

            <div className="p-4 bg-toss-gray-50 dark:bg-slate-850 rounded-2xl flex flex-col gap-1 border border-toss-gray-200/20">
              <span className="font-extrabold text-toss-gray-800 dark:text-slate-200">3. 폴더 구조 적합도 (20%)</span>
              <span className="text-xs text-toss-gray-450 dark:text-slate-500 mt-0.5">템플릿 폴더명과 실제 디렉토리명 일치도</span>
            </div>

            <div className="p-4 bg-toss-gray-50 dark:bg-slate-850 rounded-2xl flex flex-col gap-1 border border-toss-gray-200/20">
              <span className="font-extrabold text-toss-gray-800 dark:text-slate-200">4. 디렉토리 청결도 (10%)</span>
              <span className="text-xs text-toss-gray-450 dark:text-slate-500 mt-0.5">빈 폴더수 및 중복 파일명 존재 시 감점 차감</span>
            </div>
          </div>
        </div>
      </div>

      {/* System Information */}
      <div className="flex flex-col gap-4">
        <h3 className="text-xs font-bold text-toss-gray-455 dark:text-slate-500 uppercase tracking-wider flex items-center gap-1.5 select-none">
          <Info className="w-4 h-4" /> 앱 라이선스 및 정보
        </h3>

        <div className="toss-card bg-white dark:bg-slate-900 border border-toss-gray-250 dark:border-slate-800 p-5 rounded-3xl flex flex-col gap-3.5 text-xs text-toss-gray-500 dark:text-slate-400 font-semibold leading-relaxed">
          <div className="flex justify-between items-center text-toss-gray-800 dark:text-slate-200 border-b border-toss-gray-100 dark:border-slate-800/60 pb-3">
            <span className="font-extrabold text-sm text-toss-blue">Project Atlas (프로젝트 OS)</span>
            <span className="font-extrabold text-xs">v1.0.0 Stable (2026 Release)</span>
          </div>
          <p>
            Project Atlas는 실제 드라이브 폴더의 물리 데이터를 소스로 활용하여 태스크, 마인드맵, 산출물 관리를 동시 연동하는 차세대 프로젝트 관리 및 감사 시스템입니다.
          </p>
          <div className="flex items-center gap-1.5 text-xs text-toss-gray-400 mt-2 select-none">
            <ShieldAlert className="w-3.5 h-3.5 text-toss-gray-400" />
            <span>이 솔루션은 Tauri & SQLite 하이브리드 엔진을 탑재하고 있습니다.</span>
          </div>
        </div>
      </div>

    </div>
  );
};
