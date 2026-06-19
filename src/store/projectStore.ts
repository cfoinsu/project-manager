import { create } from 'zustand';
import type { Project, Process, Task, Document, Template, FolderNode, FolderTemplate, FolderTemplateNode } from '../types';
import * as db from '../utils/db';
import { scanDirectory, createDirectory, writeFileBytes } from '../utils/tauriBridge';
import { downloadDocumentBytes, createWorkLog } from '../utils/api';
import { useAuthStore } from './authStore';

interface ProjectState {
  projects: Project[];
  activeProject: Project | null;
  processes: Process[];
  tasks: Record<string, Task[]>; // Key: processId
  documents: Document[];
  templates: Template[];
  folderTemplates: FolderTemplate[];
  currentView: string;
  loading: boolean;
  rootNode: FolderNode | null;
  emptyFoldersList: FolderNode[];
  duplicateFilesList: string[];
  largeFilesList: FolderNode[];
  
  // Actions
  loadProjects: () => Promise<void>;
  loadTemplates: () => Promise<void>;
  loadFolderTemplates: () => Promise<void>;
  selectProject: (project: Project | null) => Promise<void>;
  refreshActiveProjectData: () => Promise<void>;
  setView: (view: string) => void;
  addProject: (name: string, path: string, code: string, templateId?: string, folderTemplateId?: string, startDate?: string, endDate?: string, description?: string) => Promise<Project>;
  removeProject: (id: string) => Promise<void>;
  updateProjectInfo: (id: string, updates: Partial<Project>) => Promise<void>;
  
  // Process & Task Actions
  addProcess: (name: string, description: string) => Promise<void>;
  removeProcess: (processId: string) => Promise<void>;
  updateProcessOrder: (reordered: Process[]) => Promise<void>;
  updateProcessDetail: (processId: string, updates: Partial<Process>) => Promise<void>;
  addTask: (processId: string, title: string, description: string, priority: string, startDate?: string, endDate?: string, startTime?: string, endTime?: string) => Promise<void>;
  updateTask: (task: Task) => Promise<void>;
  removeTask: (taskId: string, processId: string) => Promise<void>;
  
  // Sync & Analysis Actions
  scanAndSync: () => Promise<void>;
  addTemplateAction: (name: string, description: string, configJson: string) => Promise<void>;
  addFolderTemplateAction: (name: string, description: string, structureJson: string) => Promise<void>;
  removeFolderTemplateAction: (id: string) => Promise<void>;

  // Navigation hint: which tab to open when switching views
  pendingTab: string | null;
  setPendingTab: (tab: string | null) => void;
}

export const useProjectStore = create<ProjectState>((set, get) => ({
  projects: [],
  activeProject: null,
  processes: [],
  tasks: {},
  documents: [],
  templates: [],
  folderTemplates: [],
  currentView: 'dashboard',
  loading: false,
  rootNode: null,
  emptyFoldersList: [],
  duplicateFilesList: [],
  largeFilesList: [],
  pendingTab: null,

  setPendingTab: (tab) => set({ pendingTab: tab }),

  loadProjects: async () => {
    set({ loading: true });
    try {
      const projects = await db.getProjects();
      const templates = await db.getTemplates();
      const folderTemplates = await db.getFolderTemplates();
      set({ projects, templates, folderTemplates });
    } catch (e) {
      console.error('Failed to load projects/templates/folderTemplates:', e);
    } finally {
      set({ loading: false });
    }
  },

  loadFolderTemplates: async () => {
    try {
      const folderTemplates = await db.getFolderTemplates();
      set({ folderTemplates });
    } catch (e) {
      console.error('Failed to load folder templates:', e);
    }
  },

  loadTemplates: async () => {
    try {
      const templates = await db.getTemplates();
      set({ templates });
    } catch (e) {
      console.error(e);
    }
  },

  selectProject: async (project) => {
    if (!project) {
      set({ activeProject: null, processes: [], tasks: {}, documents: [], rootNode: null, emptyFoldersList: [], duplicateFilesList: [], largeFilesList: [] });
      return;
    }

    set({ loading: true, activeProject: project });
    try {
      // 1. Load processes
      const processes = await db.getProcesses(project.id);
      
      // 2. Load tasks for all processes
      const tasksMap: Record<string, Task[]> = {};
      for (const proc of processes) {
        tasksMap[proc.id] = await db.getTasks(proc.id);
      }

      // 3. Load documents
      const documents = await db.getDocuments(project.id);

      set({ 
        processes, 
        tasks: tasksMap, 
        documents,
        rootNode: null
      });

      // 4. Trigger filesystem scan & health calculation
      await get().scanAndSync();
    } catch (e) {
      console.error('Failed to select project:', e);
    } finally {
      set({ loading: false });
    }
  },

  refreshActiveProjectData: async () => {
    const { activeProject } = get();
    if (!activeProject) return;

    try {
      const processes = await db.getProcesses(activeProject.id);
      const tasksMap: Record<string, Task[]> = {};
      for (const proc of processes) {
        tasksMap[proc.id] = await db.getTasks(proc.id);
      }
      const documents = await db.getDocuments(activeProject.id);
      const projects = await db.getProjects();
      const activeProjectUpdated = projects.find(p => p.id === activeProject.id) || activeProject;

      set({
        projects,
        activeProject: activeProjectUpdated,
        processes,
        tasks: tasksMap,
        documents
      });
    } catch (e) {
      console.error('Failed to refresh active project data:', e);
    }
  },

  setView: (view) => set({ currentView: view }),

  addProject: async (name, path, code, templateId, folderTemplateId, startDate, endDate, description) => {
    set({ loading: true });
    try {
      const project = await db.createProject(name, path, code, templateId, startDate, endDate, description);
      await get().loadProjects();

      // If a folder template is provided, physically create directories and copy template documents
      if (folderTemplateId) {
        const folderTemplates = get().folderTemplates;
        const folderTemplate = folderTemplates.find(t => t.id === folderTemplateId);
        if (folderTemplate) {
          try {
            const nodes: FolderTemplateNode[] = JSON.parse(folderTemplate.structure_json);
            
            // 1. Create the project root folder physically
            await createDirectory(project.path);
            
            // 2. Define recursive generator function for physical folder/files
            const generateStructure = async (currentPath: string, nodeList: FolderTemplateNode[]) => {
              for (const node of nodeList) {
                const nodePath = `${currentPath}\\${node.name}`;
                if (node.is_dir) {
                  // Create directory
                  await createDirectory(nodePath);
                  // Recursively generate children
                  if (node.children && node.children.length > 0) {
                    await generateStructure(nodePath, node.children);
                  }
                } else {
                  // Create file
                  if (node.template_doc_id) {
                    try {
                      const bytes = await downloadDocumentBytes(node.template_doc_id);
                      await writeFileBytes(nodePath, bytes);
                    } catch (downloadErr) {
                      console.error(`Failed to download template for ${node.name}:`, downloadErr);
                      // Fallback to empty file
                      await writeFileBytes(nodePath, new Uint8Array());
                    }
                  } else {
                    // No template linked, generate empty placeholder file
                    await writeFileBytes(nodePath, new Uint8Array());
                  }
                }
              }
            };
            
            // Start recursive physical generation
            await generateStructure(project.path, nodes);

            // 3. Generate document requirements in the database for tracking
            const docRecords: Document[] = [];
            const collectDocRequirements = (currentRelPath: string, nodeList: FolderTemplateNode[]) => {
              for (const node of nodeList) {
                const nodeRelPath = currentRelPath ? `${currentRelPath}\\${node.name}` : node.name;
                if (node.is_dir) {
                  if (node.children) {
                    collectDocRequirements(nodeRelPath, node.children);
                  }
                } else {
                  const docId = 'doc-' + Math.random().toString(36).substr(2, 9);
                  const ext = node.name.split('.').pop() || 'docx';
                  docRecords.push({
                    id: docId,
                    project_id: project.id,
                    name: node.name,
                    path: `${project.path}\\${nodeRelPath}`,
                    type: ext,
                    size: 0,
                    page_count: 0,
                    updated_at: new Date().toISOString().replace('T', ' ').slice(0, 19)
                  });
                }
              }
            };

            collectDocRequirements('', nodes);
            if (docRecords.length > 0) {
              await db.saveDocuments(docRecords);
            }

          } catch (e) {
            console.error('Error auto-generating folder structure from template:', e);
          }
        }
      }

      return project;
    } finally {
      set({ loading: false });
    }
  },

  removeProject: async (id) => {
    set({ loading: true });
    try {
      await db.deleteProject(id);
      const { activeProject } = get();
      if (activeProject && activeProject.id === id) {
        set({ activeProject: null, processes: [], tasks: {}, documents: [], rootNode: null });
      }
      await get().loadProjects();
    } finally {
      set({ loading: false });
    }
  },

  updateProjectInfo: async (id, updates) => {
    await db.updateProject(id, updates);
    // Reload projects to reflect changes everywhere
    const projects = await db.getProjects();
    const { activeProject } = get();
    const updatedActive = activeProject?.id === id
      ? { ...activeProject, ...updates }
      : activeProject;
    set({ projects, activeProject: updatedActive });
  },

  addProcess: async (name, description) => {
    const { activeProject, processes } = get();
    if (!activeProject) return;

    const newProcess: Process = {
      id: 'proc-' + Math.random().toString(36).substr(2, 9),
      project_id: activeProject.id,
      name,
      description,
      sort_order: processes.length,
      progress: 0.0,
      status: '대기',
      start_date: '',
      end_date: '',
      difficulty: '보통'
    };

    const updatedProcesses = [...processes, newProcess];
    await db.saveProcesses([newProcess]);
    set({ processes: updatedProcesses });
    await get().scanAndSync();
  },

  updateProcessDetail: async (processId, updates) => {
    const { processes } = get();
    const updatedProcesses = processes.map(p => 
      p.id === processId ? { ...p, ...updates } : p
    );
    await db.saveProcesses(updatedProcesses);
    set({ processes: updatedProcesses });
    await get().scanAndSync();
  },

  removeProcess: async (processId) => {
    const { processes, tasks } = get();
    const updatedProcesses = processes.filter(p => p.id !== processId).map((p, idx) => ({ ...p, sort_order: idx }));
    
    // In local db mode, deleting is handled.
    // For localstorage bridge, it is simulated. We will just save processes
    await db.saveProcesses(updatedProcesses);
    
    const updatedTasks = { ...tasks };
    delete updatedTasks[processId];
    
    set({ processes: updatedProcesses, tasks: updatedTasks });
    await get().scanAndSync();
  },

  updateProcessOrder: async (reordered) => {
    const sorted = reordered.map((p, idx) => ({ ...p, sort_order: idx }));
    await db.saveProcesses(sorted);
    set({ processes: sorted });
  },

  addTask: async (processId, title, description, priority, startDate, endDate, startTime, endTime) => {
    const { tasks } = get();
    const nowStr = new Date().toISOString().replace('T', ' ').slice(0, 19);
    
    const newTask: Task = {
      id: 'task-' + Math.random().toString(36).substr(2, 9),
      process_id: processId,
      title,
      description,
      assignee: '',
      status: '대기',
      priority,
      created_at: nowStr,
      updated_at: nowStr,
      start_date: startDate || '',
      end_date: endDate || '',
      start_time: startTime || '',
      end_time: endTime || ''
    };

    const processTasks = tasks[processId] || [];
    const updatedTasks = {
      ...tasks,
      [processId]: [...processTasks, newTask]
    };

    await db.saveTasks([newTask]);
    set({ tasks: updatedTasks });

    try {
      const user = useAuthStore.getState().user;
      const userName = user?.name || '알 수 없음';
      
      const now = new Date();
      const year = now.getFullYear();
      const month = String(now.getMonth() + 1).padStart(2, '0');
      const day = String(now.getDate()).padStart(2, '0');
      const hour = String(now.getHours()).padStart(2, '0');
      const minute = String(now.getMinutes()).padStart(2, '0');
      const second = String(now.getSeconds()).padStart(2, '0');
      const logDate = `${year}-${month}-${day} ${hour}:${minute}:${second}`;

      const token = localStorage.getItem('pa_token');
      const serverMode = !!token && !token.startsWith('mock-jwt-token-for-');

      await createWorkLog(serverMode, {
        task_id: newTask.id,
        content: `[작업 추가] ${userName}님이 새로운 작업 [${title}]을(를) 추가했습니다.`,
        hours: null,
        log_date: logDate
      });
    } catch (err) {
      console.error('Failed to create task addition log:', err);
    }
    
    // Update process progress
    await get().scanAndSync();
  },

  updateTask: async (task) => {
    const { tasks } = get();
    const processId = task.process_id;
    const processTasks = tasks[processId] || [];
    const updatedTask = {
      ...task,
      updated_at: new Date().toISOString().replace('T', ' ').slice(0, 19)
    };
    
    const oldTask = processTasks.find(t => t.id === task.id);
    const statusChanged = oldTask && oldTask.status !== task.status;

    const updatedTasks = {
      ...tasks,
      [processId]: processTasks.map(t => t.id === task.id ? updatedTask : t)
    };

    await db.saveTasks([updatedTask]);
    set({ tasks: updatedTasks });

    if (statusChanged) {
      try {
        const user = useAuthStore.getState().user;
        const userName = user?.name || '알 수 없음';
        
        // Format current timestamp: YYYY-MM-DD HH:mm:ss
        const now = new Date();
        const year = now.getFullYear();
        const month = String(now.getMonth() + 1).padStart(2, '0');
        const day = String(now.getDate()).padStart(2, '0');
        const hour = String(now.getHours()).padStart(2, '0');
        const minute = String(now.getMinutes()).padStart(2, '0');
        const second = String(now.getSeconds()).padStart(2, '0');
        const logDate = `${year}-${month}-${day} ${hour}:${minute}:${second}`;

        const token = localStorage.getItem('pa_token');
        const serverMode = !!token && !token.startsWith('mock-jwt-token-for-');

        await createWorkLog(serverMode, {
          task_id: task.id,
          content: `[상태 변경] ${userName}님이 작업을 [${task.status}] 상태로 이동시켰습니다.`,
          hours: null,
          log_date: logDate
        });
      } catch (err) {
        console.error('Failed to create status change log:', err);
      }
    }
    
    // Recalculate progress
    await get().scanAndSync();
  },

  removeTask: async (taskId, processId) => {
    const { tasks } = get();
    const processTasks = tasks[processId] || [];
    
    const updatedTasks = {
      ...tasks,
      [processId]: processTasks.filter(t => t.id !== taskId)
    };

    // Simulated task removal is supported locally.
    // In our bridge we just save tasks without it. (Wait, let's make sure it deletes in localStorage too if not tauri).
    // Actually we can add delete_task or similar, but for now we just handle state
    set({ tasks: updatedTasks });
    await get().scanAndSync();
  },

  scanAndSync: async () => {
    const { activeProject, processes, tasks, documents } = get();
    if (!activeProject) return;

    try {
      // 1. Filesystem scan (Tauri scan or Mock Generator fallback)
      const tree = await scanDirectory(activeProject.path);
      
      // 2. Crawl the directory and build a flat map of files present
      const filesMap = new Map<string, { size: number; path: string; name: string }>();
      const emptyFolders: FolderNode[] = [];
      const duplicateCountMap = new Map<string, number>();
      const duplicates: string[] = [];
      const largeFiles: FolderNode[] = [];

      const traverse = (n: FolderNode) => {
        if (n.is_dir) {
          const isEmpty = n.file_count === 0 && n.folder_count === 0;
          if (isEmpty) {
            emptyFolders.push(n);
          }
          if (n.children) {
            n.children.forEach(traverse);
          }
        } else {
          // File
          const lowerName = n.name.toLowerCase();
          filesMap.set(lowerName, { size: n.size, path: n.path, name: n.name });
          
          // Duplicate check
          duplicateCountMap.set(lowerName, (duplicateCountMap.get(lowerName) || 0) + 1);
          if ((duplicateCountMap.get(lowerName) || 0) > 1 && !duplicates.includes(n.name)) {
            duplicates.push(n.name);
          }

          // Large files check (>100MB)
          if (n.size > 100 * 1024 * 1024) {
            largeFiles.push(n);
          }
        }
      };

      traverse(tree);

      // 3. Document Requirements matching
      let foundRequiredDocsCount = 0;
      const updatedDocuments = documents.map(doc => {
        const fileMatch = filesMap.get(doc.name.toLowerCase());
        if (fileMatch) {
          foundRequiredDocsCount++;
          return {
            ...doc,
            path: fileMatch.path,
            size: fileMatch.size,
            updated_at: new Date().toISOString().replace('T', ' ').slice(0, 19)
          };
        }
        return {
          ...doc,
          size: 0 // Reset size to 0 if missing
        };
      });

      // Save documents to db
      await db.saveDocuments(updatedDocuments);

      // 4. Update Process Progress & Statuses
      const updatedProcesses = processes.map(proc => {
        const procTasks = tasks[proc.id] || [];
        if (procTasks.length === 0) {
          return { ...proc, progress: 1.0, status: '완료' };
        }
        const completed = procTasks.filter(t => t.status === '완료').length;
        const progress = completed / procTasks.length;
        
        let status = '대기';
        if (progress === 1.0) status = '완료';
        else if (progress > 0.0 || procTasks.some(t => t.status === '진행중' || t.status === '검토중')) status = '진행중';

        return { ...proc, progress, status };
      });

      await db.saveProcesses(updatedProcesses);

      // 5. Structure Check
      // We check if directories matching the process names exist at the root
      let structureMatchCount = 0;
      const rootFolders = tree.children?.filter(c => c.is_dir).map(c => c.name.toLowerCase()) || [];
      updatedProcesses.forEach(proc => {
        // Match clean name, e.g. "01_기획" matching "01_기획" or "기획"
        const cleanName = proc.name.toLowerCase();
        const hasFolder = rootFolders.some(rfName => rfName.includes(cleanName) || cleanName.includes(rfName));
        if (hasFolder) {
          structureMatchCount++;
        }
      });

      // 6. HEALTH SCORE CALCULATIONS (100 pts max)
      // - Process Progress: 40 pts
      const totalProgressSum = updatedProcesses.reduce((acc, p) => acc + p.progress, 0);
      const avgProgress = updatedProcesses.length > 0 ? totalProgressSum / updatedProcesses.length : 1.0;
      const processScore = avgProgress * 40;

      // - Document Completeness: 30 pts
      const documentScore = documents.length > 0 ? (foundRequiredDocsCount / documents.length) * 30 : 30;

      // - Structure Suitability: 20 pts
      const structureScore = updatedProcesses.length > 0 ? (structureMatchCount / updatedProcesses.length) * 20 : 20;

      // - Cleanliness Score: 10 pts
      // Deduct 2 pts per empty folder (up to 5 pts)
      // Deduct 2 pts per duplicate file type (up to 5 pts)
      const emptyFolderDeduction = Math.min(emptyFolders.length * 2, 5);
      const duplicateDeduction = Math.min(duplicates.length * 2, 5);
      const cleanlinessScore = Math.max(10 - emptyFolderDeduction - duplicateDeduction, 0);

      const healthScore = Math.round(processScore + documentScore + structureScore + cleanlinessScore);

      // Save new health score in project
      await db.updateProjectHealth(activeProject.id, healthScore);

      // Reload project list to sync sidebar list
      const projects = await db.getProjects();
      const activeProjectUpdated = projects.find(p => p.id === activeProject.id) || { ...activeProject, health_score: healthScore };

      set({
        rootNode: tree,
        documents: updatedDocuments,
        processes: updatedProcesses,
        emptyFoldersList: emptyFolders,
        duplicateFilesList: duplicates,
        largeFilesList: largeFiles,
        projects,
        activeProject: activeProjectUpdated
      });
    } catch (e) {
      console.error('Scan and Sync failed:', e);
    }
  },

  addTemplateAction: async (name, description, configJson) => {
    await db.saveTemplate(name, description, configJson);
    await get().loadTemplates();
  },

  addFolderTemplateAction: async (name, description, structureJson) => {
    await db.saveFolderTemplate(name, description, structureJson);
    await get().loadFolderTemplates();
  },

  removeFolderTemplateAction: async (id) => {
    await db.deleteFolderTemplate(id);
    await get().loadFolderTemplates();
  }
}));
