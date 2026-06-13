import { isTauri } from './tauriBridge';
import type { Project, Process, Task, Document, Template, TempConfig, FolderTemplate } from '../types';
import { apiRequest } from './api';

const isTauriMode = isTauri();

const getServerMode = (): boolean => {
  try {
    const token = localStorage.getItem('pa_token');
    return !!token && !token.startsWith('mock-jwt-token-for-');
  } catch {
    return false;
  }
};

// Helper to dynamically load Tauri invoke function with type-safety bypass
const getInvoke = async (): Promise<any> => {
  // @ts-ignore
  const { invoke } = await import('@tauri-apps/api');
  return invoke;
};

// Mock Initial Templates for Browser Fallback
const DEFAULT_WEB_TEMPLATE_CONFIG: TempConfig = {
  processes: [
    {
      name: "01_기획",
      description: "요구사항 정의 및 화면 설계",
      tasks: [
        { title: "요구사항 분석 및 정리", description: "고객 요구사항을 파악하고 분석 문서화", priority: "높음" },
        { title: "메뉴 구조 설계 (IA)", description: "사이트 구조 마인드맵 및 IA 설계", priority: "보통" },
        { title: "화면 정의서 작성", description: "주요 화면 와이어프레임 설계", priority: "긴급" }
      ],
      required_docs: [
        { name: "요구사항정의서.docx", type: "docx" },
        { name: "IA.xlsx", type: "xlsx" }
      ]
    },
    {
      name: "02_디자인",
      description: "UI/UX 디자인 시안 제작",
      tasks: [
        { title: "메인 디자인 시안 확정", description: "메인 페이지 및 주요 키 비주얼 디자인", priority: "긴급" },
        { title: "아이콘 및 이미지 에셋 추출", description: "퍼블리싱용 그래픽 에셋 분리 및 저장", priority: "보통" }
      ],
      required_docs: [
        { name: "디자인_시안.psd", type: "psd" },
        { name: "logo.png", type: "png" }
      ]
    },
    {
      name: "03_개발",
      description: "웹 퍼블리싱 및 기능 구현",
      tasks: [
        { title: "HTML/CSS 마크업", description: "반응형 디자인 구조 퍼블리싱", priority: "높음" },
        { title: "프론트엔드 로직 개발", description: "React 및 상태 관리 모듈 개발", priority: "긴급" },
        { title: "백엔드 API 연동", description: "서버 통신 데이터 바인딩", priority: "보통" }
      ],
      required_docs: [
        { name: "index.html", type: "html" },
        { name: "App.tsx", type: "tsx" }
      ]
    },
    {
      name: "04_산출물",
      description: "검수, 배포 및 매뉴얼 전달",
      tasks: [
        { title: "QA 버그 수정", description: "기능 검수 및 결함 대응", priority: "긴급" },
        { title: "프로덕션 배포", description: "서버 환경 설정 및 배포 완료", priority: "높음" },
        { title: "운영 가이드 및 설명서 작성", description: "인계 문서 작성 완료", priority: "보통" }
      ],
      required_docs: [
        { name: "QA_보고서.pdf", type: "pdf" },
        { name: "설명서.txt", type: "txt" },
        { name: "버전관리.txt", type: "txt" }
      ]
    }
  ]
};

// Initialize Browser LocalStorage database
const initLocalStorageDb = () => {
  if (!localStorage.getItem('pa_templates')) {
    const defaultTemplate: Template = {
      id: 'template-default-web',
      name: '표준 웹 개발 템플릿',
      description: '기획부터 디자인, 퍼블리싱, 개발, 배포까지 전 과정을 포함하는 기본 웹 구축 템플릿',
      config_json: JSON.stringify(DEFAULT_WEB_TEMPLATE_CONFIG),
      created_at: new Date().toISOString().replace('T', ' ').slice(0, 19)
    };
    localStorage.setItem('pa_templates', JSON.stringify([defaultTemplate]));
  }
  if (!localStorage.getItem('pa_projects')) {
    localStorage.setItem('pa_projects', JSON.stringify([]));
  }
  if (!localStorage.getItem('pa_processes')) {
    localStorage.setItem('pa_processes', JSON.stringify([]));
  }
  if (!localStorage.getItem('pa_tasks')) {
    localStorage.setItem('pa_tasks', JSON.stringify([]));
  }
  if (!localStorage.getItem('pa_documents')) {
    localStorage.setItem('pa_documents', JSON.stringify([]));
  }
};

if (!isTauriMode) {
  initLocalStorageDb();
}

// -------------------------------------------------------------
// Database Bridge functions (Tauri Invoke / LocalStorage Fallback)
// -------------------------------------------------------------

export const getProjects = async (): Promise<Project[]> => {
  if (getServerMode()) {
    const data = await apiRequest('/projects');
    return data.projects || [];
  } else if (isTauriMode) {
    const invoke = await getInvoke();
    return invoke('db_get_projects');
  } else {
    const projects = localStorage.getItem('pa_projects');
    return projects ? JSON.parse(projects) : [];
  }
};

// Generate a sequential project code like HC26001
// regionCode: 2-letter region (e.g. HC)
// typeCode: 1-letter project type (e.g. W for 웹)
// year: auto from current year
// seq: auto-incremented from existing projects
export const generateProjectCode = (regionCode: string, typeCode: string, existingProjects: Project[]): string => {
  const yearStr = new Date().getFullYear().toString().slice(-2); // '26'
  // prefix: 지역코드 + 연도 + (유형코드 선택사항)
  const prefix = typeCode ? `${regionCode}${yearStr}${typeCode}` : `${regionCode}${yearStr}`;

  // Find the max sequential number for this region+year(+type) prefix
  let maxSeq = 0;
  existingProjects.forEach(p => {
    if (p.code && p.code.startsWith(prefix)) {
      // Extract the numeric part after the prefix (e.g. HC26W001 → '001')
      const seqPart = p.code.slice(prefix.length);
      const num = parseInt(seqPart, 10);
      if (!isNaN(num) && num > maxSeq) {
        maxSeq = num;
      }
    }
  });

  const nextSeq = (maxSeq + 1).toString().padStart(3, '0');
  return `${prefix}${nextSeq}`;
};

export const createProject = async (
  name: string,
  path: string,
  code: string,
  templateId?: string,
  startDate?: string,
  endDate?: string,
  description?: string
): Promise<Project> => {
  if (getServerMode()) {
    const data = await apiRequest('/projects', {
      method: 'POST',
      body: JSON.stringify({ name, path, code, templateId, startDate, endDate, description })
    });
    return data.project;
  } else if (isTauriMode) {
    const invoke = await getInvoke();
    return invoke('db_create_project', { name, path, code, templateId, startDate, endDate, description });
  } else {
    const projects: Project[] = JSON.parse(localStorage.getItem('pa_projects') || '[]');
    const projectId = 'proj-' + Math.random().toString(36).substr(2, 9);
    const nowStr = new Date().toISOString().replace('T', ' ').slice(0, 19);

    const newProject: Project = {
      id: projectId,
      code,
      name,
      path,
      status: '진행중',
      health_score: 100,
      created_at: nowStr,
      updated_at: nowStr,
      start_date: startDate || '',
      end_date: endDate || '',
      description: description || ''
    };

    projects.unshift(newProject);
    localStorage.setItem('pa_projects', JSON.stringify(projects));

    // Handle Template Mapping if templateId is provided
    if (templateId) {
      const templates: Template[] = JSON.parse(localStorage.getItem('pa_templates') || '[]');
      const template = templates.find(t => t.id === templateId);
      if (template) {
        const config: TempConfig = JSON.parse(template.config_json);
        const processes: Process[] = JSON.parse(localStorage.getItem('pa_processes') || '[]');
        const tasks: Task[] = JSON.parse(localStorage.getItem('pa_tasks') || '[]');
        const documents: Document[] = JSON.parse(localStorage.getItem('pa_documents') || '[]');

        config.processes.forEach((tempProc, procIdx) => {
          const processId = 'proc-' + Math.random().toString(36).substr(2, 9);
          
          processes.push({
            id: processId,
            project_id: projectId,
            name: tempProc.name,
            description: tempProc.description,
            sort_order: procIdx,
            progress: 0.0,
            status: '대기',
            start_date: '',
            end_date: '',
            difficulty: '보통'
          });

          // Add tasks
          tempProc.tasks.forEach(tempTask => {
            const taskId = 'task-' + Math.random().toString(36).substr(2, 9);
            tasks.push({
              id: taskId,
              process_id: processId,
              title: tempTask.title,
              description: tempTask.description,
              assignee: '',
              status: '대기',
              priority: tempTask.priority,
              created_at: nowStr,
              updated_at: nowStr,
              start_date: '',
              end_date: ''
            });
          });

          // Add document requirements
          tempProc.required_docs.forEach(tempDoc => {
            const docId = 'doc-' + Math.random().toString(36).substr(2, 9);
            documents.push({
              id: docId,
              project_id: projectId,
              name: tempDoc.name,
              path: `${path}\\${tempProc.name}\\${tempDoc.name}`,
              type: tempDoc.type,
              size: 0,
              page_count: 0,
              updated_at: nowStr
            });
          });
        });

        localStorage.setItem('pa_processes', JSON.stringify(processes));
        localStorage.setItem('pa_tasks', JSON.stringify(tasks));
        localStorage.setItem('pa_documents', JSON.stringify(documents));
      }
    }

    return newProject;
  }
};

export const deleteProject = async (id: string): Promise<void> => {
  if (getServerMode()) {
    await apiRequest(`/projects/${id}`, { method: 'DELETE' });
  } else if (isTauriMode) {
    const invoke = await getInvoke();
    return invoke('db_delete_project', { id });
  } else {
    // Cascade delete in LocalStorage
    let projects: Project[] = JSON.parse(localStorage.getItem('pa_projects') || '[]');
    projects = projects.filter(p => p.id !== id);
    localStorage.setItem('pa_projects', JSON.stringify(projects));

    let processes: Process[] = JSON.parse(localStorage.getItem('pa_processes') || '[]');
    const procsToDelete = processes.filter(p => p.project_id === id).map(p => p.id);
    processes = processes.filter(p => p.project_id !== id);
    localStorage.setItem('pa_processes', JSON.stringify(processes));

    let tasks: Task[] = JSON.parse(localStorage.getItem('pa_tasks') || '[]');
    tasks = tasks.filter(t => !procsToDelete.includes(t.process_id));
    localStorage.setItem('pa_tasks', JSON.stringify(tasks));

    let documents: Document[] = JSON.parse(localStorage.getItem('pa_documents') || '[]');
    documents = documents.filter(d => d.project_id !== id);
    localStorage.setItem('pa_documents', JSON.stringify(documents));
  }
};
export const getProcesses = async (projectId: string): Promise<Process[]> => {
  if (getServerMode()) {
    const data = await apiRequest(`/processes?project_id=${projectId}`);
    return data.processes || [];
  } else if (isTauriMode) {
    const invoke = await getInvoke();
    return invoke('db_get_processes', { projectId });
  } else {
    const processes: Process[] = JSON.parse(localStorage.getItem('pa_processes') || '[]');
    return processes.filter(p => p.project_id === projectId).sort((a, b) => a.sort_order - b.sort_order);
  }
};

export const saveProcesses = async (processesList: Process[]): Promise<void> => {
  if (getServerMode()) {
    await apiRequest('/processes/save', {
      method: 'POST',
      body: JSON.stringify({ processes: processesList })
    });
  } else if (isTauriMode) {
    const invoke = await getInvoke();
    return invoke('db_save_processes', { processes: processesList });
  } else {
    const processes: Process[] = JSON.parse(localStorage.getItem('pa_processes') || '[]');
    processesList.forEach(proc => {
      const idx = processes.findIndex(p => p.id === proc.id);
      if (idx > -1) {
        processes[idx] = proc;
      } else {
        processes.push(proc);
      }
    });
    localStorage.setItem('pa_processes', JSON.stringify(processes));
  }
};

export const getTasks = async (processId: string): Promise<Task[]> => {
  if (getServerMode()) {
    const data = await apiRequest(`/tasks?process_id=${processId}`);
    return data.tasks || [];
  } else if (isTauriMode) {
    const invoke = await getInvoke();
    return invoke('db_get_tasks', { processId });
  } else {
    const tasks: Task[] = JSON.parse(localStorage.getItem('pa_tasks') || '[]');
    return tasks.filter(t => t.process_id === processId);
  }
};

export const saveTasks = async (tasksList: Task[]): Promise<void> => {
  if (getServerMode()) {
    await apiRequest('/tasks/save', {
      method: 'POST',
      body: JSON.stringify({ tasks: tasksList })
    });
  } else if (isTauriMode) {
    const invoke = await getInvoke();
    return invoke('db_save_tasks', { tasks: tasksList });
  } else {
    const tasks: Task[] = JSON.parse(localStorage.getItem('pa_tasks') || '[]');
    tasksList.forEach(task => {
      const idx = tasks.findIndex(t => t.id === task.id);
      if (idx > -1) {
        tasks[idx] = task;
      } else {
        tasks.push(task);
      }
    });
    localStorage.setItem('pa_tasks', JSON.stringify(tasks));
  }
};

export const getDocuments = async (projectId: string): Promise<Document[]> => {
  if (getServerMode()) {
    const data = await apiRequest(`/projects/${projectId}/documents`);
    return data.documents || [];
  } else if (isTauriMode) {
    const invoke = await getInvoke();
    return invoke('db_get_documents', { projectId });
  } else {
    const documents: Document[] = JSON.parse(localStorage.getItem('pa_documents') || '[]');
    return documents.filter(d => d.project_id === projectId);
  }
};

export const saveDocuments = async (documentsList: Document[]): Promise<void> => {
  if (getServerMode()) {
    await apiRequest('/projects/documents/save', {
      method: 'POST',
      body: JSON.stringify({ documents: documentsList })
    });
  } else if (isTauriMode) {
    const invoke = await getInvoke();
    return invoke('db_save_documents', { documents: documentsList });
  } else {
    const documents: Document[] = JSON.parse(localStorage.getItem('pa_documents') || '[]');
    documentsList.forEach(doc => {
      const idx = documents.findIndex(d => d.id === doc.id);
      if (idx > -1) {
        documents[idx] = doc;
      } else {
        documents.push(doc);
      }
    });
    localStorage.setItem('pa_documents', JSON.stringify(documents));
  }
};

export const getTemplates = async (): Promise<Template[]> => {
  if (getServerMode()) {
    const data = await apiRequest('/projects/templates/list');
    return data.templates || [];
  } else if (isTauriMode) {
    const invoke = await getInvoke();
    return invoke('db_get_templates');
  } else {
    const templates = localStorage.getItem('pa_templates');
    return templates ? JSON.parse(templates) : [];
  }
};

export const saveTemplate = async (name: string, description: string, configJson: string, id?: string): Promise<Template> => {
  if (getServerMode()) {
    const data = await apiRequest('/projects/templates/save', {
      method: 'POST',
      body: JSON.stringify({ id, name, description, configJson })
    });
    return data.template;
  } else if (isTauriMode) {
    const invoke = await getInvoke();
    return invoke('db_save_template', { id, name, description, configJson });
  } else {
    const templates: Template[] = JSON.parse(localStorage.getItem('pa_templates') || '[]');
    const tempId = id || 'temp-' + Math.random().toString(36).substr(2, 9);
    const nowStr = new Date().toISOString().replace('T', ' ').slice(0, 19);

    const newTemplate: Template = {
      id: tempId,
      name,
      description,
      config_json: configJson,
      created_at: nowStr
    };

    const idx = templates.findIndex(t => t.id === tempId);
    if (idx > -1) {
      templates[idx] = newTemplate;
    } else {
      templates.push(newTemplate);
    }

    localStorage.setItem('pa_templates', JSON.stringify(templates));
    return newTemplate;
  }
};

export const updateProjectHealth = async (id: string, healthScore: number): Promise<void> => {
  if (getServerMode()) {
    await apiRequest(`/projects/${id}`, {
      method: 'PUT',
      body: JSON.stringify({ health_score: healthScore })
    });
  } else if (isTauriMode) {
    const invoke = await getInvoke();
    return invoke('db_update_project_health', { id, healthScore });
  } else {
    const projects: Project[] = JSON.parse(localStorage.getItem('pa_projects') || '[]');
    const idx = projects.findIndex(p => p.id === id);
    if (idx > -1) {
      projects[idx].health_score = healthScore;
      projects[idx].updated_at = new Date().toISOString().replace('T', ' ').slice(0, 19);
      localStorage.setItem('pa_projects', JSON.stringify(projects));
    }
  }
};

export const updateProject = async (
  id: string,
  updates: { name?: string; code?: string; status?: string; start_date?: string; end_date?: string; description?: string }
): Promise<void> => {
  if (getServerMode()) {
    await apiRequest(`/projects/${id}`, {
      method: 'PUT',
      body: JSON.stringify(updates)
    });
  } else if (isTauriMode) {
    const invoke = await getInvoke();
    return invoke('db_update_project', { id, ...updates });
  } else {
    const projects: Project[] = JSON.parse(localStorage.getItem('pa_projects') || '[]');
    const idx = projects.findIndex(p => p.id === id);
    if (idx > -1) {
      if (updates.name !== undefined) projects[idx].name = updates.name;
      if (updates.code !== undefined) projects[idx].code = updates.code;
      if (updates.status !== undefined) projects[idx].status = updates.status;
      if (updates.start_date !== undefined) projects[idx].start_date = updates.start_date;
      if (updates.end_date !== undefined) projects[idx].end_date = updates.end_date;
      if (updates.description !== undefined) projects[idx].description = updates.description;
      projects[idx].updated_at = new Date().toISOString().replace('T', ' ').slice(0, 19);
      localStorage.setItem('pa_projects', JSON.stringify(projects));
    }
  }
};

export const getFolderTemplates = async (): Promise<FolderTemplate[]> => {
  if (getServerMode()) {
    const data = await apiRequest('/projects/folder_templates/list');
    return data.templates || [];
  } else if (isTauriMode) {
    const invoke = await getInvoke();
    return invoke('db_get_folder_templates');
  } else {
    const templates = localStorage.getItem('pa_folder_templates');
    return templates ? JSON.parse(templates) : [];
  }
};

export const saveFolderTemplate = async (
  name: string,
  description: string,
  structureJson: string,
  id?: string
): Promise<FolderTemplate> => {
  if (getServerMode()) {
    const data = await apiRequest('/projects/folder_templates/save', {
      method: 'POST',
      body: JSON.stringify({ id, name, description, structureJson })
    });
    return data.template;
  } else if (isTauriMode) {
    const invoke = await getInvoke();
    return invoke('db_save_folder_template', { id, name, description, structure_json: structureJson });
  } else {
    const templates: FolderTemplate[] = JSON.parse(localStorage.getItem('pa_folder_templates') || '[]');
    const tempId = id || 'foldertemp-' + Math.random().toString(36).substr(2, 9);
    const nowStr = new Date().toISOString().replace('T', ' ').slice(0, 19);

    const newTemplate: FolderTemplate = {
      id: tempId,
      name,
      description,
      structure_json: structureJson,
      created_at: nowStr
    };

    const idx = templates.findIndex(t => t.id === tempId);
    if (idx > -1) {
      templates[idx] = newTemplate;
    } else {
      templates.push(newTemplate);
    }

    localStorage.setItem('pa_folder_templates', JSON.stringify(templates));
    return newTemplate;
  }
};

export const deleteFolderTemplate = async (id: string): Promise<void> => {
  if (getServerMode()) {
    await apiRequest(`/projects/folder_templates/${id}`, {
      method: 'DELETE'
    });
  } else if (isTauriMode) {
    const invoke = await getInvoke();
    return invoke('db_delete_folder_template', { id });
  } else {
    const templates: FolderTemplate[] = JSON.parse(localStorage.getItem('pa_folder_templates') || '[]');
    const filtered = templates.filter(t => t.id !== id);
    localStorage.setItem('pa_folder_templates', JSON.stringify(filtered));
  }
};
