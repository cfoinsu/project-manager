import React, { useMemo } from 'react';
import type { FolderNode, ScanMetrics } from '../types';
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, PieChart, Pie, Cell } from 'recharts';
import { FolderTree, FileText, HardDrive, LayoutGrid } from 'lucide-react';


interface DashboardStatsProps {
  activeNode: FolderNode;
}

export const DashboardStats: React.FC<DashboardStatsProps> = ({ activeNode }) => {
  // Format bytes helper
  const formatBytes = (bytes: number) => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
  };

  // 1. Calculate overall metrics for activeNode subtree
  const metrics = useMemo<ScanMetrics>(() => {
    let maxD = 0;
    const findMaxDepth = (n: FolderNode, currentDepth: number) => {
      if (currentDepth > maxD) maxD = currentDepth;
      if (n.children) {
        n.children.forEach(c => findMaxDepth(c, currentDepth + 1));
      }
    };
    findMaxDepth(activeNode, 0);

    return {
      totalFolders: activeNode.folder_count,
      totalFiles: activeNode.file_count,
      totalSize: activeNode.size,
      maxDepth: maxD
    };
  }, [activeNode]);

  // 2. Extract Top 10 largest folders/files directly inside the current active node
  const largestItemsData = useMemo(() => {
    const list = activeNode.children || [];
    return list
      .map(child => ({
        name: child.name,
        size: child.size,
        formattedSize: formatBytes(child.size),
        isDir: child.is_dir,
        rawBytes: child.size
      }))
      .sort((a, b) => b.rawBytes - a.rawBytes)
      .slice(0, 8)
      .map(item => ({
        ...item,
        sizeMB: parseFloat((item.rawBytes / (1024 * 1024)).toFixed(1))
      }));
  }, [activeNode]);

  // 3. Extract File Extension Breakdown from activeNode subtree
  const extensionData = useMemo(() => {
    const extSizes: Record<string, number> = {};
    const extCounts: Record<string, number> = {};

    const traverse = (n: FolderNode) => {
      if (!n.is_dir) {
        const parts = n.name.split('.');
        const ext = parts.length > 1 ? parts.pop()?.toLowerCase() || 'no-extension' : 'no-extension';
        extSizes[ext] = (extSizes[ext] || 0) + n.size;
        extCounts[ext] = (extCounts[ext] || 0) + 1;
      } else if (n.children) {
        n.children.forEach(traverse);
      }
    };
    
    traverse(activeNode);

    const data = Object.keys(extSizes).map(ext => ({
      name: `.${ext}`,
      value: extSizes[ext],
      count: extCounts[ext],
      formattedSize: formatBytes(extSizes[ext])
    }));

    // Sort descending by value (size)
    data.sort((a, b) => b.value - a.value);

    if (data.length <= 5) {
      return data;
    } else {
      const top5 = data.slice(0, 5);
      const restValue = data.slice(5).reduce((acc, curr) => acc + curr.value, 0);
      const restCount = data.slice(5).reduce((acc, curr) => acc + curr.count, 0);
      return [
        ...top5,
        {
          name: '기타 (Others)',
          value: restValue,
          count: restCount,
          formattedSize: formatBytes(restValue)
        }
      ];
    }
  }, [activeNode]);

  // Colors for Recharts Pie Chart (Toss vibrant colors)
  const COLORS = ['#3182F6', '#00B06C', '#FFAD0D', '#F04452', '#A855F7', '#64748B'];

  return (
    <div className="w-full flex flex-col gap-6">
      {/* 4 Stats Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 animate-slide-up">
        {/* Card 1 */}
        <div className="toss-card flex items-center gap-4 bg-white dark:bg-slate-900 border border-toss-gray-200/50 dark:border-slate-800">
          <div className="w-12 h-12 rounded-2xl bg-toss-blue-light dark:bg-toss-blue/20 flex items-center justify-center shrink-0">
            <FolderTree className="w-6 h-6 text-toss-blue" />
          </div>
          <div className="flex flex-col text-left">
            <span className="text-xs text-toss-gray-500 dark:text-slate-400 font-medium">총 폴더 수</span>
            <span className="text-2xl font-bold text-toss-gray-800 dark:text-slate-100 mt-1">
              {metrics.totalFolders.toLocaleString()}개
            </span>
          </div>
        </div>

        {/* Card 2 */}
        <div className="toss-card flex items-center gap-4 bg-white dark:bg-slate-900 border border-toss-gray-200/50 dark:border-slate-800">
          <div className="w-12 h-12 rounded-2xl bg-emerald-50 dark:bg-emerald-500/20 flex items-center justify-center shrink-0">
            <FileText className="w-6 h-6 text-toss-green" />
          </div>
          <div className="flex flex-col text-left">
            <span className="text-xs text-toss-gray-500 dark:text-slate-400 font-medium">총 파일 수</span>
            <span className="text-2xl font-bold text-toss-gray-800 dark:text-slate-100 mt-1">
              {metrics.totalFiles.toLocaleString()}개
            </span>
          </div>
        </div>

        {/* Card 3 */}
        <div className="toss-card flex items-center gap-4 bg-white dark:bg-slate-900 border border-toss-gray-200/50 dark:border-slate-800">
          <div className="w-12 h-12 rounded-2xl bg-amber-50 dark:bg-amber-500/20 flex items-center justify-center shrink-0">
            <HardDrive className="w-6 h-6 text-toss-yellow" />
          </div>
          <div className="flex flex-col text-left">
            <span className="text-xs text-toss-gray-500 dark:text-slate-400 font-medium">전체 용량</span>
            <span className="text-2xl font-bold text-toss-gray-800 dark:text-slate-100 mt-1">
              {formatBytes(metrics.totalSize)}
            </span>
          </div>
        </div>

        {/* Card 4 */}
        <div className="toss-card flex items-center gap-4 bg-white dark:bg-slate-900 border border-toss-gray-200/50 dark:border-slate-800">
          <div className="w-12 h-12 rounded-2xl bg-purple-50 dark:bg-purple-500/20 flex items-center justify-center shrink-0">
            <LayoutGrid className="w-6 h-6 text-purple-600 dark:text-purple-400" />
          </div>
          <div className="flex flex-col text-left">
            <span className="text-xs text-toss-gray-500 dark:text-slate-400 font-medium">최대 깊이</span>
            <span className="text-2xl font-bold text-toss-gray-800 dark:text-slate-100 mt-1">
              {metrics.maxDepth}
            </span>
          </div>
        </div>
      </div>

      {/* 2 Charts row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Chart 1: Bar Chart of largest children */}
        <div className="toss-card flex flex-col h-[350px]">
          <h3 className="text-sm font-semibold text-toss-gray-800 dark:text-slate-200 text-left mb-4">
            상위 하위 폴더/파일 용량 비교
          </h3>
          <div className="flex-1 w-full text-xs">
            {largestItemsData.length === 0 ? (
              <div className="h-full flex items-center justify-center text-toss-gray-400 dark:text-slate-600">
                표시할 데이터가 없습니다
              </div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={largestItemsData} layout="vertical" margin={{ left: 10, right: 10, top: 0, bottom: 0 }}>
                  <XAxis type="number" unit=" MB" stroke="#94a3b8" fontSize={10} tickLine={false} />
                  <YAxis type="category" dataKey="name" stroke="#94a3b8" fontSize={9} width={80} tickLine={false} />
                  <Tooltip
                    formatter={(val) => [`${val} MB`, '용량']}
                    contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 8px 24px rgba(0,0,0,0.08)' }}
                  />
                  <Bar dataKey="sizeMB" fill="#3182F6" radius={[0, 8, 8, 0]} barSize={14} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>

        {/* Chart 2: Pie Chart of extensions */}
        <div className="toss-card flex flex-col h-[350px]">
          <h3 className="text-sm font-semibold text-toss-gray-800 dark:text-slate-200 text-left mb-4">
            파일 확장자 용량 비율
          </h3>
          <div className="flex-1 w-full flex items-center justify-center relative">
            {extensionData.length === 0 ? (
              <div className="text-toss-gray-400 dark:text-slate-600">
                파일이 없습니다
              </div>
            ) : (
              <div className="w-full h-full flex flex-col md:flex-row items-center gap-4">
                {/* Pie chart graphic */}
                <div className="flex-1 h-full w-full min-h-[180px] max-h-[220px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={extensionData}
                        cx="50%"
                        cy="50%"
                        innerRadius={60}
                        outerRadius={80}
                        paddingAngle={2}
                        dataKey="value"
                      >
                        {extensionData.map((_, index) => (
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

                {/* Pie chart legend */}
                <div className="flex flex-col gap-2 text-left w-full md:w-48 shrink-0 pr-4">
                  {extensionData.map((entry, index) => (
                    <div key={entry.name} className="flex items-center justify-between text-xs">
                      <div className="flex items-center gap-1.5 overflow-hidden">
                        <span
                          className="w-2.5 h-2.5 rounded-full shrink-0"
                          style={{ backgroundColor: COLORS[index % COLORS.length] }}
                        />
                        <span className="font-medium text-toss-gray-700 dark:text-slate-300 truncate">
                          {entry.name}
                        </span>
                      </div>
                      <span className="text-toss-gray-400 dark:text-slate-500 font-semibold shrink-0">
                        {entry.formattedSize} ({entry.count}개)
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
