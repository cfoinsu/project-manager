export type ProjectRiskLevel = 'HIGH' | 'MEDIUM' | 'LOW';
export type ProjectRiskStatus = 'open' | 'resolved';

export interface ProjectRiskItem {
  id: string;
  project_id: string;
  title: string;
  description?: string;
  level: ProjectRiskLevel;
  status?: ProjectRiskStatus;
  created_at: string;
  resolved_at?: string;
  resolution_note?: string;
}

const STORAGE_KEY = 'pa_project_risks';
export const PROJECT_RISK_UPDATED_EVENT = 'project-risk:updated';

export const readProjectRisks = (): ProjectRiskItem[] => {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]') as ProjectRiskItem[];
  } catch {
    return [];
  }
};

export const readProjectRisksByProjectId = (projectId: string): ProjectRiskItem[] => {
  return readProjectRisks().filter((risk) => risk.project_id === projectId);
};

export const writeProjectRisks = (risks: ProjectRiskItem[]) => {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(risks));
  window.dispatchEvent(new CustomEvent(PROJECT_RISK_UPDATED_EVENT));
};
