import React, { useMemo, useState } from 'react';
import type { FolderNode, TemplateRule, RuleCheckReport } from '../types';
import { AlertCircle, PlusCircle } from 'lucide-react';
import { openInExplorer } from '../utils/tauriBridge';

interface AnalysisPanelProps {
  rootNode: FolderNode;
  activeNode: FolderNode;
  onNodeSelect: (node: FolderNode) => void;
  onShowToast: (message: string) => void;
}

const DEFAULT_TEMPLATE = `01_기획/
02_디자인/
03_개발/
04_산출물/
버전관리.txt`;

export const AnalysisPanel: React.FC<AnalysisPanelProps> = ({
  rootNode,
  activeNode,
  onNodeSelect,
  onShowToast
}) => {
  const [templateText] = useState(DEFAULT_TEMPLATE);

  // Format bytes helper
  const formatBytes = (bytes: number) => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
  };

  // 1. Recursive Empty Folder Finder
  const emptyFolders = useMemo<FolderNode[]>(() => {
    const list: FolderNode[] = [];
    const traverse = (n: FolderNode) => {
      if (n.is_dir) {
        const hasNoFiles = n.file_count === 0;
        const hasNoFolders = n.folder_count === 0;
        const isEmpty = hasNoFiles && hasNoFolders;
        if (isEmpty) {
          list.push(n);
        } else if (n.children) {
          n.children.forEach(traverse);
        }
      }
    };
    traverse(rootNode);
    return list;
  }, [rootNode]);

  // 2. Top 5 Largest Folders/Files
  const largestItems = useMemo<FolderNode[]>(() => {
    const list: FolderNode[] = [];
    const traverse = (n: FolderNode) => {
      list.push(n);
      if (n.children) {
        n.children.forEach(traverse);
      }
    };
    traverse(rootNode);
    return list
      .filter(n => n.path !== rootNode.path) // exclude root itself
      .sort((a, b) => b.size - a.size)
      .slice(0, 5);
  }, [rootNode]);

  // 3. Rule Compliance Checker (compares activeNode children with DEFAULT_TEMPLATE)
  const rules = useMemo<TemplateRule[]>(() => {
    return templateText
      .split('\n')
      .map(line => line.trim())
      .filter(line => line.length > 0)
      .map((line, idx) => {
        const isDir = line.endsWith('/');
        const cleanPath = isDir ? line.slice(0, -1) : line;
        return {
          id: `rule-${idx}`,
          name: cleanPath.split('/').pop() || cleanPath,
          path: cleanPath,
          is_dir: isDir,
          required: true
        };
      });
  }, [templateText]);

  const auditReport = useMemo<RuleCheckReport>(() => {
    const children = activeNode.children || [];
    const childrenMap = new Map<string, FolderNode>();
    children.forEach(c => childrenMap.set(c.name.toLowerCase(), c));

    const matched: string[] = [];
    const missing: string[] = [];
    const matchedRuleNames = new Set<string>();

    rules.forEach(rule => {
      const child = childrenMap.get(rule.name.toLowerCase());
      if (child && child.is_dir === rule.is_dir) {
        matched.push(rule.name);
        matchedRuleNames.add(rule.name.toLowerCase());
      } else {
        missing.push(rule.name + (rule.is_dir ? '/' : ''));
      }
    });

    const unexpected: string[] = [];
    children.forEach(c => {
      if (!matchedRuleNames.has(c.name.toLowerCase())) {
        unexpected.push(c.name + (c.is_dir ? '/' : ''));
      }
    });

    return {
      templateName: activeNode.name,
      missing,
      unexpected,
      matched,
      isValid: missing.length === 0 && unexpected.length === 0
    };
  }, [activeNode, rules]);

  // 4. Calculate Folder Health Score (out of 100)
  const healthScore = useMemo(() => {
    let score = 100;

    // Deduct points for empty folders (2 pts each, max 16 pts deduction)
    score -= Math.min(emptyFolders.length * 2, 16);

    // Deduct points for missing required folders (8 pts each)
    score -= auditReport.missing.length * 8;

    // Deduct points for unexpected items (3 pts each, max 15 pts deduction)
    score -= Math.min(auditReport.unexpected.length * 3, 15);

    return Math.max(score, 10); // floor of 10 points
  }, [emptyFolders.length, auditReport]);

  const healthText = useMemo(() => {
    if (healthScore >= 90) return '매우 좋음';
    if (healthScore >= 70) return '양호';
    return '보완 필요';
  }, [healthScore]);

  const handleOpenFolder = async (path: string, name: string) => {
    try {
      await openInExplorer(path);
      onShowToast(`폴더를 열었습니다: ${name}`);
    } catch (err) {
      onShowToast(`폴더 열기 실패: ${err}`);
    }
  };

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 select-none animate-slide-up">
      
      {/* 1. Folder Health Card */}
      <div className="toss-card bg-white dark:bg-slate-900 border border-toss-gray-200/50 dark:border-slate-800 p-6 flex flex-col items-center justify-between text-center min-h-[380px]">
        <h4 className="text-xs font-bold text-toss-gray-650 dark:text-slate-450 text-left w-full">폴더 건강도</h4>
        
        {/* Radial gauge */}
        <div className="relative w-36 h-36 flex items-center justify-center my-6">
          <svg className="w-full h-full -rotate-90">
            <circle
              cx="72"
              cy="72"
              r="64"
              className="stroke-toss-gray-100 dark:stroke-slate-800 fill-transparent"
              strokeWidth="10"
            />
            <circle
              cx="72"
              cy="72"
              r="64"
              style={{
                stroke: healthScore >= 90 ? '#00B06C' : healthScore >= 70 ? '#FFAD0D' : '#F04452',
                strokeWidth: '10',
                fill: 'transparent',
                transition: 'stroke-dashoffset 0.5s ease',
                strokeDasharray: `${2 * Math.PI * 64}`,
                strokeDashoffset: `${2 * Math.PI * 64 * (1 - healthScore / 100)}`
              }}
            />
          </svg>
          <div className="absolute flex flex-col items-center">
            <span className="text-4xl font-extrabold text-toss-gray-900 dark:text-slate-100">{healthScore}점</span>
            <span className={`text-xs font-bold mt-1 px-2.5 py-0.5 rounded-full bg-toss-gray-100 dark:bg-slate-800 ${
              healthScore >= 90 ? 'text-toss-green' : healthScore >= 70 ? 'text-toss-yellow' : 'text-toss-red'
            }`}>
              {healthText}
            </span>
          </div>
        </div>

        <p className="text-xs text-toss-gray-400 dark:text-slate-500 leading-relaxed text-left w-full mt-2">
          {healthScore >= 90 
            ? '✅ 폴더 구조가 매우 일치하며, 불필요하게 낭비되거나 누락된 영역이 거의 없습니다.'
            : '⚠️ 규칙에 어긋난 누락된 디렉토리가 있거나, 빈 폴더들이 많아 관리가 권장됩니다.'}
        </p>
      </div>

      {/* 2. Empty Folders Card */}
      <div className="toss-card bg-white dark:bg-slate-900 border border-toss-gray-200/50 dark:border-slate-800 p-6 flex flex-col min-h-[380px] text-left">
        <div className="flex items-center justify-between mb-4">
          <h4 className="text-xs font-bold text-toss-gray-650 dark:text-slate-450">빈 폴더 ({emptyFolders.length})</h4>
          <button 
            onClick={() => onShowToast('더 많은 리스트는 왼쪽 디렉토리 트리를 참고해 주세요.')}
            className="text-xs text-toss-gray-400 hover:text-toss-blue font-bold"
          >
            더보기
          </button>
        </div>

        <div className="flex-1 overflow-y-auto flex flex-col gap-2 pr-1 scrollbar-thin">
          {emptyFolders.length === 0 ? (
            <div className="h-full flex items-center justify-center text-xs text-toss-gray-400">
              빈 폴더가 없습니다.
            </div>
          ) : (
            emptyFolders.slice(0, 6).map(folder => (
              <div 
                key={folder.path}
                className="flex items-center justify-between p-2.5 rounded-xl bg-toss-gray-50 dark:bg-slate-850 hover:bg-toss-gray-100 dark:hover:bg-slate-800 border border-toss-gray-200/20 dark:border-slate-800/40"
              >
                <div className="flex flex-col overflow-hidden pr-2">
                  <span className="text-xs font-bold text-toss-gray-800 dark:text-slate-200 truncate">{folder.name}</span>
                  <span className="text-[8px] text-toss-gray-450 dark:text-slate-500 truncate mt-0.5">{folder.path}</span>
                </div>
                <button
                  onClick={() => handleOpenFolder(folder.path, folder.name)}
                  className="text-xs font-bold text-toss-gray-500 hover:text-toss-blue bg-white dark:bg-slate-700 px-2 py-1 rounded-md shadow-sm border border-toss-gray-200/50 dark:border-slate-650 shrink-0"
                >
                  열기
                </button>
              </div>
            ))
          )}
        </div>
      </div>

      {/* 3. Top 5 Large Folders Card */}
      <div className="toss-card bg-white dark:bg-slate-900 border border-toss-gray-200/50 dark:border-slate-800 p-6 flex flex-col min-h-[380px] text-left">
        <h4 className="text-xs font-bold text-toss-gray-650 dark:text-slate-450 mb-4">대용량 폴더 TOP 5</h4>
        
        <div className="flex-1 overflow-y-auto flex flex-col gap-2 pr-1 scrollbar-thin">
          {largestItems.length === 0 ? (
            <div className="h-full flex items-center justify-center text-xs text-toss-gray-400">
              항목이 존재하지 않습니다.
            </div>
          ) : (
            largestItems.map((item, index) => (
              <div 
                key={item.path}
                onClick={() => onNodeSelect(item)}
                className="flex items-center justify-between p-2.5 rounded-xl bg-toss-gray-50 dark:bg-slate-850 hover:bg-toss-blue-light dark:hover:bg-toss-blue/20 cursor-pointer border border-toss-gray-200/20 dark:border-slate-800/40 group"
              >
                <div className="flex items-center gap-2 overflow-hidden pr-2">
                  <span className="w-5 h-5 rounded-lg bg-toss-blue-light text-toss-blue flex items-center justify-center text-xs font-bold shrink-0">
                    {index + 1}
                  </span>
                  <div className="flex flex-col overflow-hidden">
                    <span className="text-xs font-bold text-toss-gray-800 dark:text-slate-200 truncate group-hover:text-toss-blue">{item.name}</span>
                    <span className="text-[8px] text-toss-gray-450 dark:text-slate-500 truncate mt-0.5">{item.path}</span>
                  </div>
                </div>
                <span className="text-xs font-extrabold text-toss-gray-750 dark:text-slate-300 shrink-0">
                  {formatBytes(item.size)}
                </span>
              </div>
            ))
          )}
        </div>
      </div>

      {/* 4. Rule Violations Card */}
      <div className="toss-card bg-white dark:bg-slate-900 border border-toss-gray-200/50 dark:border-slate-800 p-6 flex flex-col min-h-[380px] text-left">
        <h4 className="text-xs font-bold text-toss-gray-650 dark:text-slate-450 mb-4">규칙 위반</h4>
        
        <div className="flex-1 overflow-y-auto flex flex-col gap-4 pr-1 scrollbar-thin text-xs">
          {/* Missing items list */}
          <div className="flex flex-col gap-1.5">
            <span className="text-xs font-extrabold text-toss-red bg-toss-red-light dark:bg-toss-red/20 px-2 py-0.5 rounded-md w-max">
              누락된 항목 ({auditReport.missing.length})
            </span>
            <div className="flex flex-col gap-1">
              {auditReport.missing.length === 0 ? (
                <span className="text-xs text-toss-gray-400 pl-1">누락 없음</span>
              ) : (
                auditReport.missing.map(item => (
                  <span key={item} className="text-xs font-semibold text-toss-gray-700 dark:text-slate-350 pl-1 flex items-center gap-1">
                    <AlertCircle className="w-3 h-3 text-toss-red" />
                    <span>{item}</span>
                  </span>
                ))
              )}
            </div>
          </div>

          {/* Unexpected items list */}
          <div className="flex flex-col gap-1.5">
            <span className="text-xs font-extrabold text-toss-yellow bg-toss-yellow-light dark:bg-toss-yellow/20 px-2 py-0.5 rounded-md w-max">
              추가된 항목 ({auditReport.unexpected.length})
            </span>
            <div className="flex flex-col gap-1">
              {auditReport.unexpected.length === 0 ? (
                <span className="text-xs text-toss-gray-400 pl-1">추가 없음</span>
              ) : (
                auditReport.unexpected.map(item => (
                  <span key={item} className="text-xs font-semibold text-toss-gray-700 dark:text-slate-350 pl-1 flex items-center gap-1">
                    <PlusCircle className="w-3 h-3 text-toss-yellow" />
                    <span>{item}</span>
                  </span>
                ))
              )}
            </div>
          </div>
        </div>

        <div className="mt-4 pt-3 border-t border-toss-gray-100 dark:border-slate-800 text-xs text-toss-gray-400 dark:text-slate-500 leading-tight">
          💡 구조 규칙은 상단 **[구조 검수]** 탭에서 변경할 수 있습니다.
        </div>
      </div>
      
    </div>
  );
};
