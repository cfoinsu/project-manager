import React, { useMemo, useState } from 'react';
import type { FolderNode } from '../types';
import { ResponsiveContainer, PieChart, Pie, Cell, Tooltip } from 'recharts';
import { FolderOpen, Copy, ExternalLink, Info } from 'lucide-react';
import { openFile, openInExplorer } from '../utils/tauriBridge';
import { FullscreenLoadingOverlay } from './ModalOverlay';

interface FolderDetailsProps {
  node: FolderNode;
  onShowToast: (message: string) => void;
}

export const FolderDetails: React.FC<FolderDetailsProps> = ({ node, onShowToast }) => {
  const [openingLabel, setOpeningLabel] = useState<string | null>(null);

  // Format bytes helper
  const formatBytes = (bytes: number) => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
  };

  const handleOpenFolder = async () => {
    setOpeningLabel(node.is_dir ? `폴더를 여는 중입니다: ${node.name}` : `파일을 실행하는 중입니다: ${node.name}`);
    try {
      if (node.is_dir) {
        await openInExplorer(node.path);
        onShowToast(`폴더를 열었습니다: ${node.name}`);
      } else {
        await openFile(node.path);
        onShowToast(`파일을 실행했습니다: ${node.name}`);
      }
    } catch (err) {
      onShowToast(`열기 실패: ${err}`);
    } finally {
      setOpeningLabel(null);
    }
  };

  const handleCopyPath = async () => {
    try {
      await navigator.clipboard.writeText(node.path);
      onShowToast('경로가 클립보드에 복사되었습니다.');
    } catch (err) {
      onShowToast('복사 실패: ' + err);
    }
  };

  const handleCopyName = async () => {
    try {
      await navigator.clipboard.writeText(node.name);
      onShowToast('이름이 클립보드에 복사되었습니다.');
    } catch (err) {
      onShowToast('복사 실패: ' + err);
    }
  };

  const handleShowExplorer = async () => {
    setOpeningLabel(`탐색기에서 여는 중입니다: ${node.name}`);
    try {
      await openInExplorer(node.path);
      onShowToast(`탐색기에서 열었습니다: ${node.name}`);
    } catch (err) {
      onShowToast(`탐색기 열기 실패: ${err}`);
    } finally {
      setOpeningLabel(null);
    }
  };

  // 1. Calculate children size distribution for Pie Chart
  const chartData = useMemo(() => {
    const children = node.children || [];
    const list = children
      .filter(c => c.size > 0)
      .sort((a, b) => b.size - a.size);

    if (list.length === 0) return [];

    const data = list.map(child => ({
      name: child.name,
      value: child.size,
      formattedSize: formatBytes(child.size),
      isDir: child.is_dir
    }));

    if (data.length <= 4) {
      return data;
    } else {
      const top4 = data.slice(0, 4);
      const restValue = data.slice(4).reduce((acc, curr) => acc + curr.value, 0);
      return [
        ...top4,
        {
          name: '기타 (Others)',
          value: restValue,
          formattedSize: formatBytes(restValue),
          isDir: false
        }
      ];
    }
  }, [node]);

  const formattedModified = useMemo(() => {
    if (!node.modified) return '정보 없음';
    const date = new Date(node.modified * 1000);
    return date.toLocaleString('ko-KR', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      hour12: true
    });
  }, [node.modified]);

  const COLORS = ['#3182F6', '#A855F7', '#00B06C', '#FFAD0D', '#64748B'];

  return (
    <div className="cds--card cds--column-flex h-full overflow-y-auto text-left">
      {/* Title */}
      <h3 className="cds--details-title-container">
        <Info className="w-5.5 h-5.5 text-toss-blue" />
        <span>{node.name} 상세 정보</span>
      </h3>

      {/* Metadata list */}
      <div className="cds--details-metadata-container">
        <div className="cds--column-flex gap-1.5">
          <span className="cds--details-path-label">경로</span>
          <span className="cds--details-path-value">
            {node.path}
          </span>
        </div>

        <div className="cds--details-stats-grid">
          <div className="cds--column-flex">
            <span className="cds--details-stat-label">파일</span>
            <span className="cds--details-stat-value">
              {node.is_dir ? `${node.file_count.toLocaleString()}개` : '1개 (파일)'}
            </span>
          </div>

          <div className="cds--column-flex">
            <span className="cds--details-stat-label">폴더</span>
            <span className="cds--details-stat-value">
              {node.is_dir ? `${node.folder_count.toLocaleString()}개` : '0개'}
            </span>
          </div>

          <div className="cds--column-flex">
            <span className="cds--details-stat-label">크기</span>
            <span className="cds--details-stat-value">
              {formatBytes(node.size)}
            </span>
          </div>
        </div>

        <div className="cds--column-flex select-none">
          <span className="cds--details-modify-label">수정일</span>
          <span className="cds--details-modify-value">
            {formattedModified}
          </span>
        </div>
      </div>

      {/* Doughnut Chart of sub-items distribution */}
      {node.is_dir && chartData.length > 0 ? (
        <div className="cds--flex-1 cds--column-flex min-h-0 mb-6">
          <span className="cds--details-chart-header">하위 구성 비율</span>
          <div className="cds--details-chart-row">
            {/* Chart graphic */}
            <div className="cds--details-chart-graphic-wrap">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={chartData}
                    cx="50%"
                    cy="50%"
                    innerRadius={32}
                    outerRadius={48}
                    paddingAngle={2}
                    dataKey="value"
                  >
                    {chartData.map((_, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip
                    formatter={(_, __, props: any) => [props.payload.formattedSize, props.payload.name]}
                    contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 8px 24px rgba(0,0,0,0.08)' }}
                  />
                </PieChart>
              </ResponsiveContainer>
            </div>

            {/* Chart legend list */}
            <div className="cds--details-chart-legend scrollbar-thin">
              {chartData.map((entry, index) => (
                <div key={entry.name} className="cds--details-legend-item">
                  <div className="cds--details-legend-badge-wrap">
                    <span
                      className="cds--details-legend-badge"
                      style={{ backgroundColor: COLORS[index % COLORS.length] }}
                    />
                    <span className="cds--details-legend-name">{entry.name}</span>
                  </div>
                  <span className="cds--details-legend-value">
                    {entry.formattedSize}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      ) : (
        <div className="cds--details-empty-msg">
          하위 분석 정보가 없습니다.
        </div>
      )}

      {/* Spanning Buttons */}
      <div className="cds--column-flex gap-2 mt-auto shrink-0 select-none">
        <button
          onClick={handleOpenFolder}
          className="cds--btn cds--btn-primary w-full py-2.5 font-bold cds--row-flex justify-center gap-2 text-sm cursor-pointer"
        >
          <FolderOpen className="w-4.5 h-4.5" />
          <span>{node.is_dir ? '폴더 열기' : '파일 실행'}</span>
        </button>

        <div className="grid grid-cols-2 gap-2 text-xs font-bold">
          <button
            onClick={handleCopyPath}
            className="cds--btn cds--btn-secondary py-2 cds--row-flex justify-center gap-1.5 cursor-pointer"
          >
            <Copy className="w-4 h-4" />
            <span>경로 복사</span>
          </button>
          <button
            onClick={handleCopyName}
            className="cds--btn cds--btn-secondary py-2 cds--row-flex justify-center gap-1.5 cursor-pointer"
          >
            <Copy className="w-4 h-4" />
            <span>이름 복사</span>
          </button>
        </div>

        <button
          onClick={handleShowExplorer}
          className="cds--btn cds--btn-secondary py-2.5 text-sm cds--row-flex justify-center gap-2 border border-toss-gray-200/50 dark:border-slate-800 cursor-pointer"
        >
          <ExternalLink className="w-4.5 h-4.5" />
          <span>탐색기에서 보기</span>
        </button>
      </div>
      {openingLabel && (
        <FullscreenLoadingOverlay
          message={openingLabel}
          subMessage="외부 프로그램이 열릴 때까지 잠시 기다려 주세요."
        />
      )}
    </div>
  );
};
