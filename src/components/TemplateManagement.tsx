import React, { useState, useEffect } from 'react';
import { useProjectStore } from '../store/projectStore';
import { 
  Plus, 
  Trash, 
  PlusCircle, 
  FileText, 
  ChevronRight, 
  Save, 
  ListTodo,
  Trash2
} from 'lucide-react';
import type { TempConfig, TempProcess } from '../types';
import { CustomSelect } from './CustomSelect';
import { getDocuments, type DocTemplate } from '../utils/api';

export const TemplateManagement: React.FC = () => {
  const { templates, addTemplateAction } = useProjectStore();
  const [selectedTemplateId, setSelectedTemplateId] = useState<string | null>(templates[0]?.id || null);
  const [isCreating, setIsCreating] = useState(false);
  const [docTemplates, setDocTemplates] = useState<DocTemplate[]>([]);

  useEffect(() => {
    const loadDocTemplates = async () => {
      try {
        const docs = await getDocuments();
        setDocTemplates(docs);
      } catch (e) {
        console.error('Failed to load document templates:', e);
      }
    };
    loadDocTemplates();
  }, []);

  // Form states for creation
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [processes, setProcesses] = useState<TempProcess[]>([
    {
      name: '01_기획',
      description: '프로젝트 요구사항 기획 단계',
      tasks: [{ title: '요구사항 정리', description: '', priority: '보통' }],
      required_docs: [{ name: '요구사항정의서.docx', type: 'docx' }]
    }
  ]);

  const activeTemplate = templates.find(t => t.id === selectedTemplateId) || templates[0];

  const handleAddProcess = () => {
    setProcesses([
      ...processes,
      {
        name: `0${processes.length + 1}_프로세스`,
        description: '',
        tasks: [],
        required_docs: []
      }
    ]);
  };

  const handleRemoveProcess = (pIdx: number) => {
    setProcesses(processes.filter((_, idx) => idx !== pIdx));
  };

  const handleProcessNameChange = (pIdx: number, val: string) => {
    const next = [...processes];
    next[pIdx].name = val;
    setProcesses(next);
  };

  const handleProcessDescChange = (pIdx: number, val: string) => {
    const next = [...processes];
    next[pIdx].description = val;
    setProcesses(next);
  };

  // Task actions in builder
  const handleAddTask = (pIdx: number) => {
    const next = [...processes];
    next[pIdx].tasks.push({ title: '', description: '', priority: '보통' });
    setProcesses(next);
  };

  const handleRemoveTask = (pIdx: number, tIdx: number) => {
    const next = [...processes];
    next[pIdx].tasks = next[pIdx].tasks.filter((_, idx) => idx !== tIdx);
    setProcesses(next);
  };

  const handleTaskTitleChange = (pIdx: number, tIdx: number, val: string) => {
    const next = [...processes];
    next[pIdx].tasks[tIdx].title = val;
    setProcesses(next);
  };

  const handleTaskPriorityChange = (pIdx: number, tIdx: number, val: string) => {
    const next = [...processes];
    next[pIdx].tasks[tIdx].priority = val;
    setProcesses(next);
  };

  // Doc actions in builder
  const handleAddDoc = (pIdx: number) => {
    const next = [...processes];
    next[pIdx].required_docs.push({ name: '', type: 'docx' });
    setProcesses(next);
  };

  const handleRemoveDoc = (pIdx: number, dIdx: number) => {
    const next = [...processes];
    next[pIdx].required_docs = next[pIdx].required_docs.filter((_, idx) => idx !== dIdx);
    setProcesses(next);
  };

  const handleDocNameChange = (pIdx: number, dIdx: number, val: string) => {
    const next = [...processes];
    next[pIdx].required_docs[dIdx].name = val;
    
    // Auto fill type extension if user writes .docx, .pdf, etc.
    const extMatch = val.match(/\.([a-zA-Z0-9]+)$/);
    if (extMatch) {
      next[pIdx].required_docs[dIdx].type = extMatch[1];
    }
    setProcesses(next);
  };

  const handleDocTemplateChange = (pIdx: number, dIdx: number, val: string) => {
    const next = [...processes];
    next[pIdx].required_docs[dIdx].template_doc_id = val || undefined;
    
    // Auto fill name and type if empty
    const linkedTemplate = docTemplates.find(dt => dt.id === val);
    if (linkedTemplate && !next[pIdx].required_docs[dIdx].name) {
      next[pIdx].required_docs[dIdx].name = linkedTemplate.original_name;
      const extMatch = linkedTemplate.original_name.match(/\.([a-zA-Z0-9]+)$/);
      if (extMatch) {
        next[pIdx].required_docs[dIdx].type = extMatch[1];
      }
    }
    setProcesses(next);
  };

  const handleSaveTemplate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name || processes.length === 0) return;

    // Validate processes have names
    if (processes.some(p => !p.name)) {
      alert('모든 프로세스의 이름을 입력해 주세요.');
      return;
    }

    const config: TempConfig = { processes };
    await addTemplateAction(name, description, JSON.stringify(config));
    
    // Reset Form
    setName('');
    setDescription('');
    setProcesses([
      {
        name: '01_기획',
        description: '프로젝트 요구사항 기획 단계',
        tasks: [{ title: '요구사항 정리', description: '', priority: '보통' }],
        required_docs: [{ name: '요구사항정의서.docx', type: 'docx' }]
      }
    ]);
    setIsCreating(false);
  };

  return (
    <div className="w-full flex-1 flex min-h-0 overflow-hidden bg-white dark:bg-slate-900 border border-toss-gray-200/50 dark:border-slate-800 rounded-[28px] shadow-sm relative text-left select-none animate-slide-up">
      {/* Left panel: List of templates */}
      <div className="w-72 shrink-0 border-r border-toss-gray-200/60 dark:border-slate-800 flex flex-col h-full bg-slate-50/50 dark:bg-slate-900/25 p-5 gap-5 pb-10">
        <div className="flex justify-between items-center shrink-0">
          <div className="flex flex-col">
            <span className="text-xs font-bold text-toss-blue">Settings</span>
            <h2 className="text-xl font-extrabold text-toss-gray-900 dark:text-slate-100 mt-0.5">템플릿 보관함</h2>
          </div>
          <button
            onClick={() => setIsCreating(true)}
            className="p-2.5 rounded-xl bg-toss-blue-light/50 dark:bg-toss-blue/15 text-toss-blue hover:bg-toss-blue-light transition-all cursor-pointer"
            title="새 템플릿 작성"
          >
            <Plus className="w-4.5 h-4.5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto flex flex-col gap-3 pr-1 scrollbar-thin">
          {templates.map(temp => (
            <div
              key={temp.id}
              onClick={() => {
                setSelectedTemplateId(temp.id);
                setIsCreating(false);
              }}
              className={`p-4 rounded-2xl border transition-all cursor-pointer flex items-center justify-between text-left ${
                !isCreating && selectedTemplateId === temp.id
                  ? 'border-toss-blue bg-toss-blue-light/15 dark:bg-toss-blue/10'
                  : 'border-toss-gray-200/60 dark:border-slate-800 bg-white dark:bg-slate-900 hover:border-toss-gray-300'
              }`}
            >
              <div className="flex flex-col overflow-hidden pr-2">
                <span className="text-sm font-bold text-toss-gray-800 dark:text-slate-200 truncate">{temp.name}</span>
                <span className="text-xs text-toss-gray-450 dark:text-slate-500 truncate mt-1 leading-normal">
                  {temp.description || '설명 없음'}
                </span>
              </div>
              <ChevronRight className="w-4.5 h-4.5 text-toss-gray-300 shrink-0" />
            </div>
          ))}
        </div>
      </div>

      {/* Right panel: Details OR Builder Form */}
      <div className="flex-1 flex flex-col min-w-0 overflow-y-auto p-6 pb-10 bg-white dark:bg-slate-900">
        
        {isCreating ? (
          /* ==============================================
             Builder Form
             ============================================== */
          <form onSubmit={handleSaveTemplate} className="flex flex-col gap-6 max-w-2xl w-full">
            <div className="flex justify-between items-center border-b border-toss-gray-150 dark:border-slate-800/80 pb-4">
              <h2 className="text-xl font-extrabold text-toss-gray-900 dark:text-slate-100">새 프로세스 템플릿 만들기</h2>
              <div className="flex gap-2.5">
                <button
                  type="button"
                  onClick={() => setIsCreating(false)}
                  className="px-4.5 py-2.5 text-xs font-bold text-toss-gray-550 border border-toss-gray-250 hover:bg-toss-gray-50 dark:text-slate-400 dark:border-slate-850 dark:hover:bg-slate-800 rounded-xl transition-colors cursor-pointer"
                >
                  취소
                </button>
                <button
                  type="submit"
                  className="toss-btn toss-btn-primary px-4.5 py-2.5 text-xs font-bold rounded-xl flex items-center gap-1 cursor-pointer"
                >
                  <Save className="w-3.5 h-3.5" />
                  템플릿 저장
                </button>
              </div>
            </div>

            {/* Template Basic Info */}
            <div className="flex flex-col gap-4">
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-bold text-toss-gray-450 dark:text-slate-400">템플릿 이름</label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="예: 백엔드 API 서버 구축 템플릿"
                  required
                  className="text-sm px-4 py-3 bg-white dark:bg-slate-900 border border-toss-gray-250 dark:border-slate-800 rounded-2xl focus:outline-none focus:ring-2 focus:ring-toss-blue/60 transition-all font-semibold"
                />
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-bold text-toss-gray-450 dark:text-slate-400">설명</label>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="예: RESTful API 기획 및 개발 산출물을 포함하는 템플릿"
                  rows={2}
                  className="text-sm px-4 py-3 bg-white dark:bg-slate-900 border border-toss-gray-250 dark:border-slate-800 rounded-2xl focus:outline-none focus:ring-2 focus:ring-toss-blue/60 transition-all font-semibold resize-none"
                />
              </div>
            </div>

            {/* Process builder list */}
            <div className="flex flex-col gap-5">
              <div className="flex justify-between items-center">
                <h3 className="text-sm font-extrabold text-toss-gray-800 dark:text-slate-200">하위 프로세스 구성 ({processes.length})</h3>
                <button
                  type="button"
                  onClick={handleAddProcess}
                  className="px-3.5 py-2 text-xs font-bold text-toss-blue bg-toss-blue-light/50 hover:bg-toss-blue-light dark:bg-toss-blue/15 rounded-xl flex items-center gap-1.5 transition-colors cursor-pointer"
                >
                  <PlusCircle className="w-3.5 h-3.5" />
                  프로세스 단계 추가
                </button>
              </div>

              <div className="flex flex-col gap-5">
                {processes.map((proc, pIdx) => (
                  <div 
                    key={pIdx}
                    className="p-5 bg-slate-50/40 dark:bg-slate-850/40 border border-toss-gray-200/50 dark:border-slate-800 rounded-3xl flex flex-col gap-4 relative"
                  >
                    {/* Delete process btn */}
                    <button
                      type="button"
                      onClick={() => handleRemoveProcess(pIdx)}
                      className="absolute top-4 right-4 p-1.5 rounded-lg text-toss-gray-400 hover:text-toss-red hover:bg-toss-red/10 transition-colors cursor-pointer"
                      title="프로세스 삭제"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="flex flex-col gap-1">
                        <label className="text-xs font-bold text-toss-gray-400">단계 폴더명 (실제 디렉토리명 매칭)</label>
                        <input
                          type="text"
                          value={proc.name}
                          onChange={(e) => handleProcessNameChange(pIdx, e.target.value)}
                          placeholder="예: 01_기획"
                          required
                          className="text-xs px-3.5 py-2.5 bg-toss-gray-50 dark:bg-slate-850 border border-toss-gray-200/50 dark:border-slate-800 rounded-xl focus:outline-none focus:ring-1 focus:ring-toss-blue/60 transition-all font-semibold"
                        />
                      </div>
                      <div className="flex flex-col gap-1">
                        <label className="text-xs font-bold text-toss-gray-400">설명</label>
                        <input
                          type="text"
                          value={proc.description || ''}
                          onChange={(e) => handleProcessDescChange(pIdx, e.target.value)}
                          placeholder="예: 기획서 및 메뉴 작성 단계"
                          className="text-xs px-3.5 py-2.5 bg-toss-gray-50 dark:bg-slate-855 border border-toss-gray-200/50 dark:border-slate-800 rounded-xl focus:outline-none focus:ring-1 focus:ring-toss-blue/60 transition-all font-semibold"
                        />
                      </div>
                    </div>

                    {/* Sub Tasks builder */}
                    <div className="flex flex-col gap-2 mt-2">
                      <div className="flex justify-between items-center text-xs font-bold text-toss-gray-450 dark:text-slate-400 uppercase tracking-wider">
                        <span>프로세스 하위 태스크</span>
                        <button
                          type="button"
                          onClick={() => handleAddTask(pIdx)}
                          className="text-toss-blue hover:underline text-xs flex items-center gap-1 cursor-pointer"
                        >
                          <Plus className="w-3 h-3" /> 작업 추가
                        </button>
                      </div>
                      
                      {proc.tasks.length === 0 ? (
                        <p className="text-xs text-toss-gray-400 italic py-2">등록된 하위 작업이 없습니다.</p>
                      ) : (
                        <div className="flex flex-col gap-2">
                          {proc.tasks.map((task, tIdx) => (
                            <div key={tIdx} className="flex gap-2 items-center">
                              <input
                                type="text"
                                value={task.title}
                                onChange={(e) => handleTaskTitleChange(pIdx, tIdx, e.target.value)}
                                placeholder="작업 제목 입력"
                                required
                                className="flex-1 text-xs px-3.5 py-2 bg-toss-gray-50 dark:bg-slate-850 border border-toss-gray-200/50 dark:border-slate-800 rounded-xl focus:outline-none font-semibold"
                              />
                              <CustomSelect
                                value={task.priority}
                                onChange={(e) => handleTaskPriorityChange(pIdx, tIdx, e.target.value)}
                                className="text-xs px-3.5 py-2 bg-toss-gray-50 dark:bg-slate-850 border border-toss-gray-200/50 dark:border-slate-800 rounded-xl focus:outline-none font-semibold cursor-pointer"
                              >
                                <option value="낮음">낮음</option>
                                <option value="보통">보통</option>
                                <option value="높음">높음</option>
                                <option value="긴급">긴급</option>
                              </CustomSelect>
                              <button
                                type="button"
                                onClick={() => handleRemoveTask(pIdx, tIdx)}
                                className="p-1.5 text-toss-gray-400 hover:text-toss-red rounded-lg transition-colors cursor-pointer"
                              >
                                <Trash className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>

                    {/* Required Documents builder */}
                    <div className="flex flex-col gap-2 mt-2">
                      <div className="flex justify-between items-center text-xs font-bold text-toss-gray-450 dark:text-slate-400 uppercase tracking-wider">
                        <span>프로세스 필수 산출물 문서</span>
                        <button
                          type="button"
                          onClick={() => handleAddDoc(pIdx)}
                          className="text-toss-blue hover:underline text-xs flex items-center gap-1 cursor-pointer"
                        >
                          <Plus className="w-3 h-3" /> 문서 규격 추가
                        </button>
                      </div>

                      {proc.required_docs.length === 0 ? (
                        <p className="text-xs text-toss-gray-400 italic py-2">등록된 필수 산출물이 없습니다.</p>
                      ) : (
                        <div className="flex flex-col gap-2">
                          {proc.required_docs.map((doc, dIdx) => (
                            <div key={dIdx} className="flex gap-2 items-center">
                              <input
                                type="text"
                                value={doc.name}
                                onChange={(e) => handleDocNameChange(pIdx, dIdx, e.target.value)}
                                placeholder="요구사항정의서.docx"
                                required
                                className="flex-1 text-xs px-3.5 py-2 bg-toss-gray-50 dark:bg-slate-850 border border-toss-gray-200/50 dark:border-slate-800 rounded-xl focus:outline-none font-semibold"
                              />
                              <CustomSelect
                                value={doc.template_doc_id || ''}
                                onChange={(e) => handleDocTemplateChange(pIdx, dIdx, e.target.value)}
                                className="text-xs px-3 py-2 bg-toss-gray-50 dark:bg-slate-850 border border-toss-gray-200/50 dark:border-slate-800 rounded-xl focus:outline-none font-semibold cursor-pointer max-w-[200px]"
                              >
                                <option value="">(양식 연동 안함)</option>
                                {docTemplates.map(dt => (
                                  <option key={dt.id} value={dt.id}>
                                    {dt.original_name}
                                  </option>
                                ))}
                              </CustomSelect>
                              <span className="text-xs uppercase font-bold text-toss-gray-400 bg-toss-gray-100 dark:bg-slate-800 px-2.5 py-2 rounded-xl shrink-0 select-none">
                                {doc.type} 파일
                              </span>
                              <button
                                type="button"
                                onClick={() => handleRemoveDoc(pIdx, dIdx)}
                                className="p-1.5 text-toss-gray-400 hover:text-toss-red rounded-lg transition-colors cursor-pointer"
                              >
                                <Trash className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>

                  </div>
                ))}
              </div>
            </div>
          </form>
        ) : activeTemplate ? (
          /* ==============================================
             Visual Details Viewer
             ============================================== */
          <div className="flex flex-col gap-6 text-left max-w-2xl w-full">
            <div className="flex flex-col gap-1 border-b border-toss-gray-150 dark:border-slate-800/80 pb-4">
              <h2 className="text-xl font-extrabold text-toss-gray-900 dark:text-slate-100">{activeTemplate.name}</h2>
              <p className="text-sm text-toss-gray-500 dark:text-slate-400 mt-1 font-medium">{activeTemplate.description}</p>
            </div>

            {/* Config tree visualization */}
            <div className="flex flex-col gap-6">
              <h3 className="text-xs font-bold text-toss-gray-400 dark:text-slate-500 uppercase tracking-wider">템플릿 세부 구조</h3>
              
              <div className="flex flex-col gap-4">
                {(JSON.parse(activeTemplate.config_json) as TempConfig).processes.map((proc, pIdx) => (
                  <div 
                    key={pIdx}
                    className="p-5 bg-slate-50/40 dark:bg-slate-850/40 border border-toss-gray-200/50 dark:border-slate-800 rounded-3xl flex flex-col gap-4"
                  >
                    <div className="flex items-center gap-2">
                      <span className="w-7 h-7 rounded-xl bg-toss-blue-light dark:bg-toss-blue/20 text-toss-blue font-extrabold flex items-center justify-center text-xs shrink-0 select-none">
                        {pIdx + 1}
                      </span>
                      <div className="flex flex-col">
                        <span className="text-sm font-extrabold text-toss-gray-800 dark:text-slate-200">{proc.name}</span>
                        <span className="text-xs text-toss-gray-450 dark:text-slate-500 font-semibold mt-0.5">{proc.description || '설명 없음'}</span>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      {/* Tasks visual list */}
                      <div className="flex flex-col gap-2">
                        <span className="text-xs font-bold text-toss-gray-400 uppercase flex items-center gap-1.5 border-b border-toss-gray-100 dark:border-slate-850 pb-1.5 select-none">
                          <ListTodo className="w-3.5 h-3.5" /> 하위 태스크 ({proc.tasks.length})
                        </span>
                        {proc.tasks.length === 0 ? (
                          <span className="text-xs text-toss-gray-400 italic">없음</span>
                        ) : (
                          <div className="flex flex-col gap-1.5">
                            {proc.tasks.map((t, idx) => (
                              <div key={idx} className="flex justify-between items-center text-xs p-2 rounded-xl bg-toss-gray-50 dark:bg-slate-850">
                                <span className="font-bold text-toss-gray-700 dark:text-slate-300 truncate max-w-[160px]">{t.title}</span>
                                <span className="text-xs font-extrabold px-2 py-0.5 bg-white dark:bg-slate-800 text-toss-blue rounded-md border border-toss-gray-150 dark:border-slate-700">
                                  {t.priority}
                                </span>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>

                      {/* Required Docs visual list */}
                      <div className="flex flex-col gap-2">
                        <span className="text-xs font-bold text-toss-gray-400 uppercase flex items-center gap-1.5 border-b border-toss-gray-100 dark:border-slate-850 pb-1.5 select-none">
                          <FileText className="w-3.5 h-3.5" /> 필수 증적 산출물 ({proc.required_docs.length})
                        </span>
                        {proc.required_docs.length === 0 ? (
                          <span className="text-xs text-toss-gray-400 italic">없음</span>
                        ) : (
                          <div className="flex flex-col gap-1.5">
                            {proc.required_docs.map((d, idx) => (
                              <div key={idx} className="flex justify-between items-center text-xs p-2 rounded-xl bg-toss-gray-50 dark:bg-slate-850 gap-2">
                                <div className="flex flex-col min-w-0">
                                  <span className="font-bold text-toss-gray-700 dark:text-slate-300 truncate max-w-[160px]">{d.name}</span>
                                  {d.template_doc_id && (
                                    <span className="text-[10px] text-toss-blue font-bold mt-0.5">양식 연동됨</span>
                                  )}
                                </div>
                                <span className="text-xs uppercase font-black text-toss-gray-455 bg-white dark:bg-slate-800 px-2 py-0.5 rounded-md border border-toss-gray-150 dark:border-slate-700 shrink-0">
                                  {d.type}
                                </span>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>

                  </div>
                ))}
              </div>
            </div>
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <p className="text-sm text-toss-gray-450 dark:text-slate-400">템플릿이 없습니다. 새 템플릿을 생성해 주세요.</p>
          </div>
        )}

      </div>
    </div>
  );
};
