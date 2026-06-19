import React, { useState, useMemo } from 'react';
import type { FolderNode, TemplateRule, RuleCheckReport } from '../types';
import { ShieldCheck, AlertCircle, PlusCircle, CheckCircle2, Clipboard, Download, Edit } from 'lucide-react';


interface RuleCheckerProps {
  activeNode: FolderNode;
  onShowToast: (message: string) => void;
}

const DEFAULT_TEMPLATE = `01_기획/
02_디자인/
03_개발/
04_산출물/
버전관리.txt`;

export const RuleChecker: React.FC<RuleCheckerProps> = ({ activeNode, onShowToast }) => {
  const [templateText, setTemplateText] = useState(DEFAULT_TEMPLATE);
  const [isEditing, setIsEditing] = useState(false);

  // Parse raw template text into structured TemplateRules
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

  // Run audit comparison between current active node children and template rules
  const auditReport = useMemo<RuleCheckReport>(() => {
    const children = activeNode.children || [];
    const childrenMap = new Map<string, FolderNode>();
    
    // Index children by relative name
    children.forEach(c => {
      childrenMap.set(c.name.toLowerCase(), c);
    });

    const matched: string[] = [];
    const missing: string[] = [];
    const matchedRuleNames = new Set<string>();

    // Check rules
    rules.forEach(rule => {
      const child = childrenMap.get(rule.name.toLowerCase());
      if (child && child.is_dir === rule.is_dir) {
        matched.push(`${rule.name}${rule.is_dir ? '/' : ''}`);
        matchedRuleNames.add(rule.name.toLowerCase());
      } else {
        missing.push(`${rule.name}${rule.is_dir ? '/' : ''}`);
      }
    });

    // Find unexpected files/folders (children that are not in the template)
    const unexpected: string[] = [];
    children.forEach(c => {
      if (!matchedRuleNames.has(c.name.toLowerCase())) {
        unexpected.push(`${c.name}${c.is_dir ? '/' : ''}`);
      }
    });

    const totalRules = rules.length;
    const matchedCount = matched.length;
    const isValid = matchedCount === totalRules && unexpected.length === 0;

    return {
      templateName: activeNode.name,
      missing,
      unexpected,
      matched,
      isValid
    };
  }, [activeNode, rules]);

  // Calculate compliance score
  const complianceScore = useMemo(() => {
    if (rules.length === 0) return 100;
    const score = Math.round((auditReport.matched.length / rules.length) * 100);
    return score;
  }, [rules, auditReport]);

  const generateTextReport = () => {
    return `=========================================
Folder Atlas 구조 검수 리포트
=========================================
기준 대상 폴더: ${activeNode.path}
검수 일시: ${new Date().toLocaleString()}
적용 규칙 개수: ${rules.length}개
일치 점수 (Compliance Score): ${complianceScore}%
구조 검수 결과: ${auditReport.isValid ? '정상 (통과)' : '보완 필요'}

-----------------------------------------
1. 일치하는 항목 [${auditReport.matched.length}개]
${auditReport.matched.map(item => `  [V] ${item}`).join('\n') || '  (없음)'}

2. 누락된 항목 [${auditReport.missing.length}개]
${auditReport.missing.map(item => `  [X] ${item}`).join('\n') || '  (없음)'}

3. 추가/예외 항목 [${auditReport.unexpected.length}개]
${auditReport.unexpected.map(item => `  [+] ${item}`).join('\n') || '  (없음)'}
=========================================`;
  };

  const handleCopyReport = async () => {
    try {
      const reportText = generateTextReport();
      await navigator.clipboard.writeText(reportText);
      onShowToast('검수 리포트가 클립보드에 복사되었습니다.');
    } catch (err) {
      onShowToast('리포트 복사 실패: ' + err);
    }
  };

  const handleDownloadReport = () => {
    const reportText = generateTextReport();
    const blob = new Blob([reportText], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `FolderAtlas_Audit_${activeNode.name}.txt`;
    link.click();
    URL.revokeObjectURL(url);
    onShowToast('검수 리포트 파일 다운로드가 시작되었습니다.');
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      {/* Template Editor column */}
      <div className="toss-card flex flex-col h-[480px]">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-semibold text-toss-gray-800 dark:text-slate-200">폴더 구조 규칙 편집</h3>
          <button
            onClick={() => setIsEditing(!isEditing)}
            className="text-xs text-toss-blue hover:text-toss-blue-hover flex items-center gap-1 font-semibold"
          >
            <Edit className="w-3.5 h-3.5" />
            <span>{isEditing ? '완료' : '수정'}</span>
          </button>
        </div>

        <p className="text-xs text-toss-gray-400 dark:text-slate-500 mb-3 text-left">
          줄바꿈 단위로 검사 규칙을 입력하세요. 폴더명 끝에는 <b>'/'</b>를 붙여야 폴더로 인식됩니다.
        </p>

        <textarea
          disabled={!isEditing}
          value={templateText}
          onChange={(e) => setTemplateText(e.target.value)}
          className={`flex-1 w-full p-4 rounded-xl font-mono text-xs focus:outline-none focus:ring-2 focus:ring-toss-blue resize-none transition-all ${
            isEditing
              ? 'bg-white dark:bg-slate-800 border border-toss-blue/50 text-toss-gray-900 dark:text-slate-100'
              : 'bg-toss-gray-100 dark:bg-slate-900 text-toss-gray-500 border border-transparent dark:text-slate-400'
          }`}
        />
        
        {!isEditing && (
          <button
            onClick={() => setIsEditing(true)}
            className="toss-btn toss-btn-secondary mt-3 text-xs w-full py-2.5"
          >
            규칙 편집하기
          </button>
        )}
      </div>

      {/* Results and Score column */}
      <div className="toss-card flex flex-col lg:col-span-2 h-[480px]">
        <div className="flex items-center justify-between mb-6 shrink-0">
          <div className="flex flex-col text-left">
            <h3 className="text-sm font-semibold text-toss-gray-800 dark:text-slate-200">구조 검수 결과</h3>
            <span className="text-xs text-toss-gray-400 mt-1">
              기준 폴더: <code className="px-1.5 py-0.5 rounded bg-toss-gray-100 dark:bg-slate-800 text-[10px] text-slate-400">{activeNode.path}</code>
            </span>
          </div>

          <div className="flex gap-2">
            <button
              onClick={handleCopyReport}
              className="text-xs toss-btn toss-btn-secondary py-1.5 px-3 flex items-center gap-1.5 font-medium"
            >
              <Clipboard className="w-3.5 h-3.5" />
              <span>복사</span>
            </button>
            <button
              onClick={handleDownloadReport}
              className="text-xs toss-btn toss-btn-primary py-1.5 px-3 flex items-center gap-1.5 font-medium"
            >
              <Download className="w-3.5 h-3.5" />
              <span>내보내기</span>
            </button>
          </div>
        </div>

        {/* Score metrics */}
        <div className="flex items-center gap-6 p-4 rounded-2xl bg-toss-gray-50 dark:bg-slate-950 border border-toss-gray-200/40 dark:border-slate-800/60 mb-6 shrink-0">
          <div className="relative w-16 h-16 shrink-0 flex items-center justify-center">
            {/* SVG circle logic */}
            <svg className="w-full h-full -rotate-90">
              <circle
                cx="32"
                cy="32"
                r="28"
                className="stroke-toss-gray-200 dark:stroke-slate-800 fill-transparent"
                strokeWidth="5"
              />
              <circle
                cx="32"
                cy="32"
                r="28"
                className="stroke-toss-blue fill-transparent transition-all duration-500"
                strokeWidth="5"
                strokeDasharray={`${2 * Math.PI * 28}`}
                strokeDashoffset={`${2 * Math.PI * 28 * (1 - complianceScore / 100)}`}
              />
            </svg>
            <span className="absolute text-sm font-bold text-toss-gray-800 dark:text-slate-200">{complianceScore}%</span>
          </div>

          <div className="flex flex-col text-left">
            <div className="flex items-center gap-1.5">
              {complianceScore === 100 ? (
                <>
                  <ShieldCheck className="w-4 h-4 text-toss-green" />
                  <span className="text-xs font-bold text-toss-green">구조 규칙 일치</span>
                </>
              ) : (
                <>
                  <AlertCircle className="w-4 h-4 text-toss-red" />
                  <span className="text-xs font-bold text-toss-red">구조 규칙 불일치 ({rules.length - auditReport.matched.length}개 누락)</span>
                </>
              )}
            </div>
            <p className="text-xs text-toss-gray-500 dark:text-slate-400 mt-1 leading-relaxed">
              {complianceScore === 100
                ? '현재 선택한 디렉토리가 템플릿 규칙에 명시된 모든 필수 구조를 정상적으로 충족하고 있습니다.'
                : '누락된 디렉토리를 복원하거나, 추가로 감지된 예외 항목들을 점검하여 프로젝트 정렬 규칙을 준수하세요.'}
            </p>
          </div>
        </div>

        {/* Breakdown tabs/lists */}
        <div className="flex-1 min-h-0 overflow-y-auto flex flex-col gap-4 text-xs pr-1">
          {/* Missing items (Red) */}
          {auditReport.missing.length > 0 && (
            <div className="text-left">
              <h4 className="font-semibold text-toss-red flex items-center gap-1 mb-2">
                <AlertCircle className="w-3.5 h-3.5" />
                <span>누락된 규칙 항목 ({auditReport.missing.length})</span>
              </h4>
              <div className="flex flex-wrap gap-2">
                {auditReport.missing.map(item => (
                  <span key={item} className="px-2.5 py-1.5 rounded-lg bg-toss-red-light text-toss-red font-medium dark:bg-toss-red/20 dark:text-red-400">
                    {item}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Unexpected extra items (Amber) */}
          {auditReport.unexpected.length > 0 && (
            <div className="text-left">
              <h4 className="font-semibold text-toss-yellow flex items-center gap-1 mb-2">
                <PlusCircle className="w-3.5 h-3.5" />
                <span>추가 감지 항목 ({auditReport.unexpected.length})</span>
              </h4>
              <div className="flex flex-wrap gap-2">
                {auditReport.unexpected.map(item => (
                  <span key={item} className="px-2.5 py-1.5 rounded-lg bg-toss-yellow-light text-toss-yellow font-medium dark:bg-toss-yellow/20 dark:text-yellow-400">
                    {item}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Matched items (Green) */}
          {auditReport.matched.length > 0 && (
            <div className="text-left">
              <h4 className="font-semibold text-toss-green flex items-center gap-1 mb-2">
                <CheckCircle2 className="w-3.5 h-3.5" />
                <span>일치한 항목 ({auditReport.matched.length})</span>
              </h4>
              <div className="flex flex-wrap gap-2">
                {auditReport.matched.map(item => (
                  <span key={item} className="px-2.5 py-1.5 rounded-lg bg-toss-green-light text-toss-green font-medium dark:bg-toss-green/20 dark:text-emerald-400">
                    {item}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
