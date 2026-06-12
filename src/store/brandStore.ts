import { create } from 'zustand';

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

function loadConfig(): BrandConfig {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) return { ...DEFAULT_CONFIG, ...JSON.parse(stored) };
  } catch {}
  return DEFAULT_CONFIG;
}

// ─── 스토어 ───────────────────────────────────────────────────
interface BrandStore extends BrandConfig {
  update: (config: Partial<BrandConfig>) => void;
  reset: () => void;
}

export const useBrandStore = create<BrandStore>((set) => ({
  ...loadConfig(),

  update: (config) => {
    set((prev) => {
      const next = { ...prev, ...config };
      localStorage.setItem(STORAGE_KEY, JSON.stringify({
        companyName: next.companyName,
        slogan: next.slogan,
        logoDataUrl: next.logoDataUrl,
        primaryColor: next.primaryColor,
      }));
      return next;
    });
  },

  reset: () => {
    localStorage.removeItem(STORAGE_KEY);
    set(DEFAULT_CONFIG);
  },
}));
