import React, { useState, useEffect } from 'react';
import { MapPin, X, ChevronRight } from 'lucide-react';
import { getKoreaRegions } from '../types';

interface RegionPickerModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelect: (code: string) => void;
}

export const RegionPickerModal: React.FC<RegionPickerModalProps> = ({
  isOpen,
  onClose,
  onSelect,
}) => {
  const KOREA_REGIONS = getKoreaRegions();
  const [pickerSelectedProvince, setPickerSelectedProvince] = useState<string>('서울특별시');
  const [disabledRegions, setDisabledRegions] = useState<string[]>([]);

  useEffect(() => {
    try {
      const saved = localStorage.getItem('pa_disabled_regions');
      if (saved) {
        setDisabledRegions(JSON.parse(saved));
      } else {
        setDisabledRegions([]);
      }
    } catch (e) {
      console.error(e);
      setDisabledRegions([]);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 bg-slate-950/40 dark:bg-slate-950/70 backdrop-blur-sm z-[60] flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div
        className="bg-white/95 dark:bg-slate-900/95 border border-slate-100 dark:border-slate-800/80 rounded-[28px] p-7 shadow-toss-lg max-w-2xl w-full text-left animate-scale-in flex flex-col gap-5 backdrop-filter backdrop-blur-md"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between">
          <h3 className="text-base font-extrabold text-toss-gray-900 dark:text-slate-100 flex items-center gap-2">
            <MapPin className="w-5 h-5 text-toss-blue animate-pulse" />
            <span>지역 선택</span>
          </h3>
          <button
            onClick={onClose}
            className="p-2 rounded-xl hover:bg-toss-gray-100 dark:hover:bg-slate-800 text-toss-gray-400 dark:text-slate-500 cursor-pointer transition-colors duration-200"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 border border-slate-100/80 dark:border-slate-800/60 rounded-3xl p-4 bg-slate-50/30 dark:bg-slate-950/20">
          {/* Left Pane: Provinces */}
          <div className="flex flex-col gap-1 pr-2 border-r border-slate-100 dark:border-slate-800/80 max-h-[350px] overflow-y-auto scrollbar-thin">
            {KOREA_REGIONS.map((group) => {
              const activeCount = group.subRegions.filter((r) => !disabledRegions.includes(r.code)).length;
              const isSelected = pickerSelectedProvince === group.name;
              return (
                <button
                  key={group.name}
                  type="button"
                  onClick={() => setPickerSelectedProvince(group.name)}
                  className={`flex items-center justify-between px-3.5 py-2.5 rounded-full text-left text-xs font-bold transition-all duration-300 hover:scale-[1.02] cursor-pointer ${
                    isSelected
                      ? 'bg-toss-blue text-white shadow-sm shadow-toss-blue/30 scale-[1.02]'
                      : 'text-toss-gray-700 dark:text-slate-350 hover:bg-slate-100/50 dark:hover:bg-slate-800/50'
                  }`}
                >
                  <span>{group.name}</span>
                  <span
                    className={`text-[10px] px-1.5 py-0.5 rounded-full font-extrabold transition-all duration-300 ${
                      isSelected
                        ? 'bg-white/25 text-white'
                        : activeCount === 0
                        ? 'bg-rose-500/10 text-rose-500 dark:bg-rose-500/20'
                        : 'bg-toss-blue/10 text-toss-blue dark:bg-toss-blue/20 dark:text-sky-400'
                    }`}
                  >
                    {activeCount}
                  </span>
                </button>
              );
            })}
          </div>

          {/* Right Pane: Cities Grid */}
          <div className="md:col-span-2 flex flex-col gap-3 max-h-[350px] overflow-y-auto pl-1 pr-1 scrollbar-thin">
            <span className="text-xs font-extrabold text-toss-gray-800 dark:text-slate-350 px-1 flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-toss-blue"></span>
              <span>{pickerSelectedProvince} 상세 지역 목록</span>
            </span>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {KOREA_REGIONS.find((g) => g.name === pickerSelectedProvince)
                ?.subRegions.filter((r) => !disabledRegions.includes(r.code))
                .map((r) => {
                  return (
                    <button
                      key={r.code}
                      type="button"
                      onClick={() => {
                        onSelect(r.code);
                        onClose();
                      }}
                      className="flex items-center justify-between px-4 py-3 rounded-2xl border border-slate-150/70 dark:border-slate-800/60 bg-white dark:bg-slate-850 hover:bg-toss-blue/5 dark:hover:bg-toss-blue/10 hover:border-toss-blue/30 dark:hover:border-toss-blue/30 text-xs text-left transition-all duration-300 hover:scale-[1.03] cursor-pointer group shadow-sm hover:shadow-md"
                    >
                      <div className="flex flex-col gap-0.5">
                        <span className="font-mono font-extrabold text-toss-blue dark:text-sky-400">
                          {r.code}
                        </span>
                        <span className="font-extrabold text-toss-gray-800 dark:text-slate-200 group-hover:text-toss-blue dark:group-hover:text-sky-400 transition-colors duration-200">
                          {r.name}
                        </span>
                      </div>
                      <ChevronRight className="w-3.5 h-3.5 text-slate-350 group-hover:text-toss-blue dark:group-hover:text-sky-400 group-hover:translate-x-0.5 transition-all duration-200 shrink-0" />
                    </button>
                  );
                })}
              {KOREA_REGIONS.find((g) => g.name === pickerSelectedProvince)
                ?.subRegions.filter((r) => !disabledRegions.includes(r.code)).length === 0 && (
                <div className="col-span-full py-8 text-center text-xs text-slate-400 dark:text-slate-500 font-semibold">
                  활성화된 상세 지역이 없습니다.
                  <br />
                  <span className="text-[10px] text-slate-400 font-normal">
                    환경설정 &gt; 지역 코드 설정에서 활성화할 수 있습니다.
                  </span>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
