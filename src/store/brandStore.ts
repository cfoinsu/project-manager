import { create } from 'zustand';
import { getApiBaseUrl } from '../utils/api';

// ─── 타입 ──────────────────────────────────────────────────────
export interface BrandConfig {
  companyName: string;      // 회사명 / 시스템명
  slogan: string;           // 부제 / 슬로건
  logoDataUrl: string;      // base64 또는 '' (기본 아이콘 사용)
  primaryColor: string;     // 브랜드 메인 컬러 (hex)
}

const STORAGE_KEY = 'pa_brand_config';

const DEFAULT_CONFIG: BrandConfig = {
  companyName: 'Project Atlas',
  slogan: 'Project OS',
  logoDataUrl: '',
  primaryColor: '#3182F6',
};

// 브라우저 타이틀 및 Favicon 동적 변경 유틸리티
export const updateBrowserBrand = (companyName: string, slogan: string, logoDataUrl?: string) => {
  if (typeof document === 'undefined') return;
  
  // 1. 브라우저 Title 업데이트
  document.title = `${companyName} - ${slogan || 'Project OS'}`;

  // 2. 브라우저 Favicon 업데이트
  let favicon = document.querySelector('link[rel*="icon"]') as HTMLLinkElement;
  if (!favicon) {
    favicon = document.createElement('link');
    favicon.rel = 'icon';
    document.head.appendChild(favicon);
  }
  
  if (logoDataUrl) {
    favicon.href = logoDataUrl;
  } else {
    favicon.href = '/favicon.svg';
  }
};

const getServerMode = (): boolean => {
  try {
    const token = localStorage.getItem('pa_token');
    return !!token && !token.startsWith('mock-jwt-token-for-');
  } catch {
    return false;
  }
};

function loadConfig(): BrandConfig {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) return { ...DEFAULT_CONFIG, ...JSON.parse(stored) };
  } catch {}
  return DEFAULT_CONFIG;
}

// ─── 스토어 ───────────────────────────────────────────────────
interface BrandStore extends BrandConfig {
  update: (config: Partial<BrandConfig>) => Promise<void>;
  reset: () => Promise<void>;
  loadFromServer: () => Promise<void>;
}

export const useBrandStore = create<BrandStore>((set, get) => ({
  ...loadConfig(),

  update: async (config) => {
    const prev = get();
    const next = { ...prev, ...config };
    
    // UI 우선 업데이트
    set({
      companyName: next.companyName,
      slogan: next.slogan,
      logoDataUrl: next.logoDataUrl,
      primaryColor: next.primaryColor,
    });
    
    // 브라우저 탭 설정 변경
    updateBrowserBrand(next.companyName, next.slogan, next.logoDataUrl);

    // 1. LocalStorage 캐시 저장
    localStorage.setItem(STORAGE_KEY, JSON.stringify({
      companyName: next.companyName,
      slogan: next.slogan,
      logoDataUrl: next.logoDataUrl,
      primaryColor: next.primaryColor,
    }));

    // 2. 서버 모드인 경우 서버에 동기화 저장
    if (getServerMode()) {
      try {
        const token = localStorage.getItem('pa_token');
        await fetch(`${getApiBaseUrl()}/brand`, {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          },
          body: JSON.stringify({
            companyName: next.companyName,
            slogan: next.slogan,
            logoDataUrl: next.logoDataUrl,
            primaryColor: next.primaryColor
          })
        });
      } catch (err) {
        console.error('Failed to sync brand config with server:', err);
      }
    }
  },

  reset: async () => {
    localStorage.removeItem(STORAGE_KEY);
    set(DEFAULT_CONFIG);
    updateBrowserBrand(DEFAULT_CONFIG.companyName, DEFAULT_CONFIG.slogan, DEFAULT_CONFIG.logoDataUrl);
  },

  loadFromServer: async () => {
    // 기본 로컬 캐시 적용 후 서버 조회 시도
    const local = loadConfig();
    updateBrowserBrand(local.companyName, local.slogan, local.logoDataUrl);

    try {
      const response = await fetch(`${getApiBaseUrl()}/brand`);
      if (response.ok) {
        const data = await response.json();
        set({
          companyName: data.companyName,
          slogan: data.slogan,
          logoDataUrl: data.logoDataUrl,
          primaryColor: data.primaryColor,
        });
        
        // 브라우저 탭 설정 변경
        updateBrowserBrand(data.companyName, data.slogan, data.logoDataUrl);

        // LocalStorage 동기화 캐싱
        localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
      }
    } catch (err) {
      console.error('Failed to load brand config from server:', err);
    }
  }
}));
