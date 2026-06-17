import React, { useEffect, useMemo, useState } from 'react';
import { Activity, ArrowRight, FolderOpen, X } from 'lucide-react';
import { useProjectStore } from '../store/projectStore';
import { useAuthStore } from '../store/authStore';
import * as api from '../utils/api';
import { getMeetings } from '../utils/collaborationApi';
import type { Assignment, Meeting, User, Workload } from '../types';
import { getRegionCodes } from '../types';
import { Avatar } from './Avatar';
import { ModalOverlay } from './ModalOverlay';
import { RegionPickerModal } from './RegionPickerModal';
import { openInExplorer } from '../utils/tauriBridge';
import { PROJECT_RISK_UPDATED_EVENT, readProjectRisksByProjectId, type ProjectRiskItem } from '../utils/projectRiskStore';
import { Badge, Button, DashboardGrid, DashboardGridItem, EmptyState, Page, PageBody, PageHeader, Panel } from './ui';

export const ProjectOverview: React.FC = () => {
  const REGION_CODES = getRegionCodes();
  const {
    activeProject,
    processes,
    tasks,
    documents,
    rootNode,
    setView,
    scanAndSync,
    updateProjectInfo,
    duplicateFilesList,
    largeFilesList
  } = useProjectStore();
  const { user, serverMode } = useAuthStore();

  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [workloads, setWorkloads] = useState<Workload[]>([]);
  const [meetings, setMeetings] = useState<Meeting[]>([]);
  const [projectRisks, setProjectRisks] = useState<ProjectRiskItem[]>([]);
  const [loadingData, setLoadingData] = useState(false);

  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isRegionPickerOpen, setIsRegionPickerOpen] = useState(false);
  const [editContractAmount, setEditContractAmount] = useState('');
  const [editImportance, setEditImportance] = useState('');
  const [editPriority, setEditPriority] = useState('');
  const [editClientName, setEditClientName] = useState('');
  const [editClientRegion, setEditClientRegion] = useState('');
  const [editClientDepartment, setEditClientDepartment] = useState('');
  const [editClientContactName, setEditClientContactName] = useState('');
  const [editClientContactPhone, setEditClientContactPhone] = useState('');
  const [editClientContactEmail, setEditClientContactEmail] = useState('');
  const [editDescription, setEditDescription] = useState('');
  const [editBusinessPurpose, setEditBusinessPurpose] = useState('');
  const [editMajorScope, setEditMajorScope] = useState('');
  const [editSpecialNotes, setEditSpecialNotes] = useState('');

  useEffect(() => {
    const fetchData = async () => {
      if (!activeProject) return;
      setLoadingData(true);
      try {
        const [allAssigns, allUsers, workloadData, meetingData] = await Promise.all([
          api.getAssignments(serverMode, user?.role || 'member', user?.id || ''),
          api.getUsers(serverMode),
          api.getWorkloads(serverMode, { project_id: activeProject.id }),
          getMeetings(activeProject.id)
        ]);
        setAssignments(allAssigns.filter((assignment) => assignment.project_id === activeProject.id));
        setUsers(allUsers);
        setWorkloads(workloadData);
        setMeetings(meetingData);
      } catch (error) {
        console.error('Failed to fetch overview data:', error);
      } finally {
        setLoadingData(false);
      }
    };
    fetchData();
  }, [activeProject, serverMode, user]);

  useEffect(() => {
    if (!activeProject) {
      setProjectRisks([]);
      return;
    }
    const loadRisks = () => {
      setProjectRisks(readProjectRisksByProjectId(activeProject.id));
    };
    loadRisks();
    window.addEventListener(PROJECT_RISK_UPDATED_EVENT, loadRisks);
    return () => window.removeEventListener(PROJECT_RISK_UPDATED_EVENT, loadRisks);
  }, [activeProject?.id]);

  const handleOpenEditModal = () => {
    if (!activeProject) return;
    setEditContractAmount(activeProject.contract_amount || '');
    setEditImportance(activeProject.importance || 'Medium');
    setEditPriority(activeProject.priority || 'P3');
    setEditClientName(activeProject.client_name || '');
    setEditClientRegion(activeProject.client_region || '');
    setEditClientDepartment(activeProject.client_department || '');
    setEditClientContactName(activeProject.client_contact_name || '');
    setEditClientContactPhone(activeProject.client_contact_phone || '');
    setEditClientContactEmail(activeProject.client_contact_email || '');
    setEditDescription(activeProject.description || '');
    setEditBusinessPurpose(activeProject.business_purpose || '');
    setEditMajorScope(activeProject.major_scope || '');
    setEditSpecialNotes(activeProject.special_notes || '');
    setIsEditModalOpen(true);
  };

  useEffect(() => {
    const openEdit = () => handleOpenEditModal();
    window.addEventListener('project-overview:open-edit', openEdit);
    return () => window.removeEventListener('project-overview:open-edit', openEdit);
  }, [activeProject]);

  const handleSaveAllInfo = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!activeProject) return;
    await updateProjectInfo(activeProject.id, {
      contract_amount: editContractAmount,
      importance: editImportance,
      priority: editPriority,
      client_name: editClientName,
      client_region: editClientRegion,
      client_department: editClientDepartment,
      client_contact_name: editClientContactName,
      client_contact_phone: editClientContactPhone,
      client_contact_email: editClientContactEmail,
      description: editDescription,
      business_purpose: editBusinessPurpose,
      major_scope: editMajorScope,
      special_notes: editSpecialNotes
    });
    setIsEditModalOpen(false);
  };

  const formatCurrency = (value?: string) => {
    if (!value) return '미등록';
    const clean = value.replace(/[^0-9]/g, '');
    if (!clean) return value;
    return `₩ ${Number(clean).toLocaleString()}`;
  };

  const dDayLabel = useMemo(() => {
    if (!activeProject?.end_date) return '-';
    const end = new Date(activeProject.end_date);
    end.setHours(0, 0, 0, 0);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const diff = Math.ceil((end.getTime() - today.getTime()) / 86400000);
    if (diff > 0) return `D - ${diff}`;
    if (diff === 0) return 'D-Day';
    return `D + ${Math.abs(diff)}`;
  }, [activeProject?.end_date]);

  const allTasks = useMemo(() => Object.values(tasks).flat(), [tasks]);
  const totalProgress = useMemo(() => {
    if (processes.length === 0) return 0;
    return Math.round(processes.reduce((sum, process) => sum + process.progress, 0) / processes.length * 100);
  }, [processes]);
  const scheduleRiskSummary = useMemo(() => {
    const progressPercent = Math.max(0, Math.min(100, totalProgress));
    if (!activeProject?.start_date || !activeProject?.end_date) {
      return {
        label: '일정 정보 없음',
        desc: '프로젝트 시작일과 종료일 설정이 필요합니다.',
        elapsedPercent: 0,
        progressPercent,
        gap: 0,
        score: 0,
        chipClass: 'bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-300',
        barClass: 'bg-slate-400'
      };
    }

    const start = new Date(activeProject.start_date);
    const end = new Date(activeProject.end_date);
    const today = new Date();
    start.setHours(0, 0, 0, 0);
    end.setHours(0, 0, 0, 0);
    today.setHours(0, 0, 0, 0);

    const totalDays = Math.max(1, Math.ceil((end.getTime() - start.getTime()) / 86400000));
    const elapsedDays = Math.max(0, Math.min(totalDays, Math.ceil((today.getTime() - start.getTime()) / 86400000)));
    const elapsedPercent = Math.round((elapsedDays / totalDays) * 100);
    const gap = Math.max(0, elapsedPercent - progressPercent);
    const score = Math.min(100, Math.round(gap * 1.2));

    if (score >= 45) {
      return {
        label: '위험',
        desc: '일정 소모 대비 진척이 크게 늦습니다.',
        elapsedPercent,
        progressPercent,
        gap,
        score,
        chipClass: 'bg-rose-50 text-rose-600 dark:bg-rose-950/30 dark:text-rose-300',
        barClass: 'bg-rose-500'
      };
    }
    if (score >= 20) {
      return {
        label: '주의',
        desc: '진척 속도 점검과 우선순위 조정이 필요합니다.',
        elapsedPercent,
        progressPercent,
        gap,
        score,
        chipClass: 'bg-amber-50 text-amber-600 dark:bg-amber-950/30 dark:text-amber-300',
        barClass: 'bg-amber-500'
      };
    }
    return {
      label: '양호',
      desc: '현재 일정 흐름은 관리 가능한 수준입니다.',
      elapsedPercent,
      progressPercent,
      gap,
      score,
      chipClass: 'bg-emerald-50 text-emerald-600 dark:bg-emerald-950/30 dark:text-emerald-300',
      barClass: 'bg-emerald-500'
    };
  }, [activeProject?.end_date, activeProject?.start_date, totalProgress]);

  const todayKey = new Date().toISOString().slice(0, 10);
  const completedTasks = allTasks.filter((task) => task.status.includes('완료'));
  const openTasks = allTasks.filter((task) => !task.status.includes('완료'));
  const recentCompletedTasks = completedTasks.slice(-3).reverse();
  const riskTasks = openTasks
    .filter((task) => task.priority === '긴급' || task.priority === '높음' || Boolean(task.end_date && task.end_date <= todayKey))
    .slice(0, 3);
  const visibleRisks = [
    ...[...projectRisks]
      .sort((a, b) => {
        const statusOrder = Number((a.status || 'open') === 'resolved') - Number((b.status || 'open') === 'resolved');
        if (statusOrder !== 0) return statusOrder;
        return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
      })
      .map((risk) => {
        const isResolved = risk.status === 'resolved';
        return {
          title: risk.title,
          sub: isResolved
            ? `해결: ${risk.resolution_note || '해결 내용 미작성'}`
            : risk.description || '등록된 리스크입니다.',
          meta: isResolved ? '해결' : risk.level
        };
      }),
    ...riskTasks.map((task) => ({
      title: task.title,
      sub: task.description || '확인이 필요한 작업입니다.',
      meta: task.end_date && task.end_date <= todayKey ? 'D-0' : task.priority
    }))
  ].slice(0, 6);

  const sortedMeetings = useMemo(() => {
    return [...meetings].sort((a, b) => {
      const aTime = new Date(`${a.start_date}T${a.start_time || '00:00'}`).getTime();
      const bTime = new Date(`${b.start_date}T${b.start_time || '00:00'}`).getTime();
      return Math.abs(aTime - Date.now()) - Math.abs(bTime - Date.now());
    });
  }, [meetings]);
  const upcomingMeetings = sortedMeetings.filter((meeting) => {
    return new Date(`${meeting.start_date}T${meeting.end_time || meeting.start_time || '00:00'}`).getTime() >= Date.now();
  });
  const nextMeeting = upcomingMeetings[0] || null;
  const completedMeetings = Math.max(meetings.length - upcomingMeetings.length, 0);

  const dailyChartData = useMemo(() => {
    const result: { label: string; count: number }[] = [];
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    for (let index = 6; index >= 0; index -= 1) {
      const date = new Date(today);
      date.setDate(today.getDate() - index);
      const key = date.toISOString().slice(0, 10);
      const count = allTasks.filter((task) => {
        if (task.status.includes('완료')) return false;
        const start = task.start_date || task.end_date || '';
        const end = task.end_date || task.start_date || '';
        return start <= key && key <= end;
      }).length;
      result.push({ label: `${String(date.getMonth() + 1).padStart(2, '0')}/${String(date.getDate()).padStart(2, '0')}`, count });
    }
    return result;
  }, [allTasks]);
  const totalWorkloadRatio = useMemo(() => {
    return workloads.reduce((sum, workload) => sum + (workload.work_ratio || 0), 0);
  }, [workloads]);

  if (!activeProject) {
    return (
      <div className="flex h-full items-center justify-center text-sm font-bold text-slate-400">
        선택된 프로젝트가 없습니다.
      </div>
    );
  }

  const healthScore = activeProject.health_score || 0;
  const contractNumber = Number((activeProject.contract_amount || '').replace(/[^0-9]/g, '')) || 0;
  const executedBudget = contractNumber ? Math.round(contractNumber * totalProgress / 100) : 0;
  const dateLine = `${activeProject.start_date || '미지정'} ~ ${activeProject.end_date || '미지정'}`;
  const chartMax = Math.max(...dailyChartData.map((item) => item.count), 1);
  const chartPoints = dailyChartData.map((item, index) => ({
    x: 44 + index * 78,
    y: 130 - (item.count / chartMax) * 88,
    ...item
  }));
  const chartPath = chartPoints.map((point, index) => `${index === 0 ? 'M' : 'L'} ${point.x} ${point.y}`).join(' ');
  const recentUpdates = [
    ...completedTasks.slice(-2).map((task) => ({ title: '작업이 완료되었습니다.', sub: task.title, meta: '작업' })),
    ...meetings.slice(-1).map((meeting) => ({ title: '회의가 등록되었습니다.', sub: meeting.title, meta: '회의' }))
  ].slice(0, 3);
  const userById = new Map(users.map((item) => [item.id, item]));

  return (
    <Page scroll className="h-full pr-2 pb-10 text-left select-none">
      <PageHeader
        title={activeProject.name}
        description="Project Overview"
        actions={(
          <Button variant="primary" onClick={handleOpenEditModal}>
            사업 정보 수정
          </Button>
        )}
      />

      <DashboardGrid>
        <DashboardGridItem span={2}>
        <DashboardMetricCard title="건강도">
          <div className="flex items-center gap-4">
            <div className="relative w-20 h-20 rounded-full flex items-center justify-center" style={{ background: `conic-gradient(#10b981 ${healthScore * 3.6}deg, #edf2f7 0deg)` }}>
              <div className="w-14 h-14 rounded-full bg-white dark:bg-slate-950 flex flex-col items-center justify-center">
                <span className="text-2xl font-black text-slate-950 dark:text-slate-100">{healthScore}</span>
                <span className="text-[10px] font-black text-slate-400">/100</span>
              </div>
            </div>
            <div className="text-[11px] font-black text-emerald-600">지난 주 대비 ▲ 5</div>
          </div>
        </DashboardMetricCard>
        </DashboardGridItem>
        <DashboardGridItem span={2}>
        <DashboardMetricCard title="진행률">
          <span className="text-3xl font-black text-slate-950 dark:text-slate-100">{totalProgress}%</span>
          <div className="mt-4 h-2 rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden">
            <div className="h-full rounded-full bg-toss-blue" style={{ width: `${totalProgress}%` }} />
          </div>
          <p className="mt-3 text-[11px] font-bold text-slate-500">지난 주 대비 ▲ 8%</p>
        </DashboardMetricCard>
        </DashboardGridItem>
        <DashboardGridItem span={2}>
        <DashboardMetricCard title="중요도">
          <div className="flex items-center gap-2">
            <span className="w-3 h-3 rounded-full bg-rose-500" />
            <span className="text-2xl font-black text-slate-950 dark:text-slate-100">{activeProject.importance || 'Medium'}</span>
          </div>
          <p className="mt-4 text-[11px] font-bold text-slate-500">최상위 중요 프로젝트</p>
        </DashboardMetricCard>
        </DashboardGridItem>
        <DashboardGridItem span={2}>
        <DashboardMetricCard title="우선순위">
          <span className="text-3xl font-black text-indigo-600">{activeProject.priority || 'P3'}</span>
          <p className="mt-4 text-[11px] font-bold text-slate-500">최우선</p>
        </DashboardMetricCard>
        </DashboardGridItem>
        <DashboardGridItem span={2}>
        <DashboardMetricCard title="예산 (계약금액)">
          <span className="text-2xl font-black text-slate-950 dark:text-slate-100">{formatCurrency(activeProject.contract_amount)}</span>
          <p className="mt-4 text-[11px] font-bold text-slate-500">집행률 {totalProgress}% ({formatCurrency(String(executedBudget))})</p>
        </DashboardMetricCard>
        </DashboardGridItem>
        <DashboardGridItem span={2}>
        <DashboardMetricCard title="기간">
          <span className="text-sm font-black text-slate-900 dark:text-slate-100">{dateLine}</span>
          <p className="mt-5 text-sm font-black text-toss-blue">{dDayLabel}</p>
        </DashboardMetricCard>
        </DashboardGridItem>
      </DashboardGrid>

      <PageBody>
      <section className="pm-overview-hero mb-4">
        <div className="pm-overview-hero__grid">
          <div className="pm-overview-hero__summary">
            <p className="pm-overview-hero__eyebrow">프로젝트 설명</p>
            <h2 className="pm-overview-hero__description">
              {activeProject.description || '등록된 프로젝트 설명이 없습니다.'}
            </h2>
            <div className="pm-overview-hero__badges">
              <Badge tone="neutral">
                {activeProject.importance || 'Medium'}
              </Badge>
              <Badge tone="meeting">
                {activeProject.priority || 'P3'}
              </Badge>
              <Badge tone="task">
                {dateLine}
              </Badge>
            </div>
          </div>
          <div className="pm-overview-hero__aside">
            <NarrativeBlock title="사업 목적" value={activeProject.business_purpose} empty="등록된 사업 목적이 없습니다." />
            <NarrativeBlock title="주요 범위" value={activeProject.major_scope} empty="등록된 주요 범위가 없습니다." />
            <NarrativeBlock title="특이사항" value={activeProject.special_notes} empty="등록된 특이사항이 없습니다." />
          </div>
        </div>
      </section>

      <SectionGroup title="회의와 사업 맥락">
        <div className="grid grid-cols-1 xl:grid-cols-4 gap-4">
        <OverviewCard title="다음 예정 회의">
          {nextMeeting ? (
            <div className="flex h-full flex-col">
              <h3 className="text-base font-black text-slate-950 dark:text-slate-100">{nextMeeting.title}</h3>
              <p className="mt-3 text-xs font-bold text-slate-600 dark:text-slate-400">{nextMeeting.start_date} {nextMeeting.start_time} ~ {nextMeeting.end_time}</p>
              <p className="mt-2 text-xs font-bold text-slate-500">{nextMeeting.location || '장소 미정'}</p>
              <div className="mt-5 flex -space-x-2">
                {(nextMeeting.attendees || []).slice(0, 4).map((idOrName) => {
                  const detail = userById.get(idOrName);
                  return <Avatar key={idOrName} name={detail?.name || idOrName} profileImage={detail?.profile_image} className="w-7 h-7 text-[10px] ring-2 ring-white" />;
                })}
                {(nextMeeting.attendees || []).length > 4 && <span className="w-7 h-7 rounded-full bg-slate-100 text-[10px] font-black text-slate-500 flex items-center justify-center ring-2 ring-white">+{(nextMeeting.attendees || []).length - 4}</span>}
              </div>
              <button onClick={() => setView('projects_meetings')} className="mt-auto w-fit px-4 py-2 rounded-lg bg-toss-blue text-white text-xs font-black">회의 보기</button>
            </div>
          ) : (
            <EmptyState text="예정된 회의가 없습니다." />
          )}
        </OverviewCard>

        <OverviewCard title="회의 현황">
          <div className="grid grid-cols-3 gap-2 text-center">
            <MeetingStat label="예정" value={upcomingMeetings.length} active />
            <MeetingStat label="진행" value={0} />
            <MeetingStat label="완료" value={completedMeetings} />
          </div>
          <div className="mt-4 divide-y divide-slate-100 dark:divide-slate-800">
            {sortedMeetings.slice(0, 3).map((meeting) => (
              <button key={meeting.id} onClick={() => setView('projects_meetings')} className="w-full flex items-center gap-3 py-3 text-left hover:text-toss-blue">
                <span className="w-14 text-[11px] font-black text-slate-500">{meeting.start_date.slice(5)}</span>
                <span className="w-14 text-xs font-black text-slate-800 dark:text-slate-200">{meeting.start_time}</span>
                <span className="flex-1 text-xs font-bold truncate">{meeting.title}</span>
              </button>
            ))}
            {sortedMeetings.length === 0 && <EmptyState text="등록된 회의가 없습니다." />}
          </div>
        </OverviewCard>

        <OverviewCard title="사업 정보" action="편집" onAction={handleOpenEditModal}>
          <InfoRow label="계약금액" value={formatCurrency(activeProject.contract_amount)} />
          <InfoRow label="중요도" value={activeProject.importance || '미지정'} accent={activeProject.importance === 'Critical' ? 'rose' : 'blue'} />
          <InfoRow label="우선순위" value={activeProject.priority || '미지정'} accent="indigo" />
          <InfoRow label="프로젝트 유형" value={activeProject.business_purpose || '웹사이트 구축'} />
          <InfoRow label="계약 상태" value={activeProject.status || '진행중'} />
          <InfoRow label="예산 집행률" value={`${totalProgress}%`} progress={totalProgress} />
        </OverviewCard>

        <OverviewCard title="발주처 정보" action="편집" onAction={handleOpenEditModal}>
          <InfoRow label="발주처명" value={activeProject.client_name || '미지정'} />
          <InfoRow label="지역" value={activeProject.client_region || '미지정'} />
          <InfoRow label="담당 부서" value={activeProject.client_department || '미지정'} />
          <InfoRow label="담당자" value={activeProject.client_contact_name || '미지정'} />
          <InfoRow label="연락처" value={activeProject.client_contact_phone || '미지정'} />
          <InfoRow label="이메일" value={activeProject.client_contact_email || '미지정'} />
        </OverviewCard>
        </div>
      </SectionGroup>

      <SectionGroup title="진행 흐름">
        <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
        <OverviewCard title="프로젝트 작업량 추이" action="최근 7일">
          <svg className="w-full h-40" viewBox="0 0 590 170">
            <path d={chartPath} fill="none" stroke="#3182F6" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
            {chartPoints.map((point) => (
              <g key={point.label}>
                <circle cx={point.x} cy={point.y} r="4" fill="#fff" stroke="#3182F6" strokeWidth="2" />
                <text x={point.x} y={point.y - 10} textAnchor="middle" className="text-[10px] font-black fill-current text-toss-blue">{point.count}</text>
                <text x={point.x} y="158" textAnchor="middle" className="text-[10px] font-bold fill-current text-slate-400">{point.label}</text>
              </g>
            ))}
          </svg>
        </OverviewCard>
        <OverviewCard title="프로세스 단계 진행률" action="단계별 보기" onAction={() => setView('projects_process')}>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 py-4">
            {processes.slice(0, 4).map((process, index) => (
              <div key={process.id} className="flex flex-col items-center gap-3">
                <span className="text-xs font-black text-slate-700 dark:text-slate-300">0{index + 1}. {process.name}</span>
                <div className="w-20 h-20 rounded-full flex items-center justify-center" style={{ background: `conic-gradient(${index === 0 ? '#10b981' : index === 1 ? '#3182F6' : index === 2 ? '#f59e0b' : '#7c3aed'} ${Math.round(process.progress * 100) * 3.6}deg, #e8edf5 0deg)` }}>
                  <div className="w-14 h-14 rounded-full bg-white dark:bg-slate-950 flex items-center justify-center text-sm font-black">{Math.round(process.progress * 100)}%</div>
                </div>
              </div>
            ))}
            {processes.length === 0 && <EmptyState text="등록된 프로세스가 없습니다." />}
          </div>
        </OverviewCard>
        <OverviewCard title="일정 진행 위험도" action="분석 보기" onAction={() => setView('projects_analysis')}>
          <div className="flex items-start justify-between gap-4">
            <div>
              <span className={`rounded-full px-3 py-1 text-[11px] font-black ${scheduleRiskSummary.chipClass}`}>
                {scheduleRiskSummary.label}
              </span>
              <p className="mt-4 text-3xl font-black text-slate-950 dark:text-slate-100">{scheduleRiskSummary.score}</p>
              <p className="mt-1 text-xs font-bold text-slate-400">위험도 점수 / 100</p>
            </div>
            <div className="text-right">
              <p className="text-xs font-black text-slate-500 dark:text-slate-400">GAP {scheduleRiskSummary.gap}%</p>
              <p className="mt-2 max-w-40 text-[11px] font-semibold leading-relaxed text-slate-500 dark:text-slate-400">{scheduleRiskSummary.desc}</p>
            </div>
          </div>
          <div className="mt-5 space-y-3">
            <RiskProgress label="일정 경과" value={scheduleRiskSummary.elapsedPercent} className="bg-slate-400" />
            <RiskProgress label="프로젝트 진척" value={scheduleRiskSummary.progressPercent} className={scheduleRiskSummary.barClass} />
          </div>
        </OverviewCard>
        </div>
      </SectionGroup>

      <SectionGroup title="운영 상태">
        <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
        <OverviewCard title="최근 업데이트">
          <CompactList items={recentUpdates} empty="최근 업데이트가 없습니다." />
        </OverviewCard>
        <OverviewCard title="최근 완료 작업">
          <CompactList items={recentCompletedTasks.map((task) => ({ title: task.title, sub: task.description || '설명 없음', meta: task.end_date || '' }))} empty="최근 완료 작업이 없습니다." />
        </OverviewCard>
        <OverviewCard title="이슈 및 리스크" action="이슈 관리" onAction={() => setView('projects_issues')}>
          <CompactList items={visibleRisks} empty="현재 표시할 리스크가 없습니다." danger />
        </OverviewCard>
        </div>
      </SectionGroup>

      <SectionGroup title="리소스와 진단">
        <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
        <OverviewCard title="투입 인력">
          {loadingData ? (
            <div className="py-10 text-center text-xs font-bold text-slate-400">데이터를 불러오는 중...</div>
          ) : (
            <CompactList
              items={assignments.slice(0, 4).map((assignment) => ({
                title: assignment.user_name || '이름 없음',
                sub: assignment.role || '역할 미지정',
                meta: `${assignment.allocation_percent}%`
              }))}
              empty="투입 인력이 없습니다."
            />
          )}
        </OverviewCard>
        <OverviewCard title="문서 및 폴더 진단" action="분석 보기" onAction={() => setView('projects_analysis')}>
          <InfoRow label="등록 문서" value={`${documents.length}건`} />
          <InfoRow label="폴더 매칭" value={rootNode ? '스캔 완료' : '미스캔'} accent="blue" />
          <InfoRow label="중복 파일" value={`${duplicateFilesList.length}건`} />
          <InfoRow label="대용량 파일" value={`${largeFilesList.length}건`} />
          <InfoRow label="누적 투입률" value={`${totalWorkloadRatio}%`} accent="blue" />
        </OverviewCard>
        <OverviewCard title="빠른 작업">
          <div className="flex flex-col gap-2">
            <div className="pm-overview-actions">
              <Button variant="primary" icon={<Activity className="w-4 h-4" />} onClick={scanAndSync}>
                폴더 구조 동기화
              </Button>
              <Button variant="secondary" icon={<FolderOpen className="w-4 h-4" />} onClick={() => openInExplorer(activeProject.path)}>
                프로젝트 폴더 열기
              </Button>
            </div>
          </div>
        </OverviewCard>
        </div>
      </SectionGroup>

      {isEditModalOpen && (
        <ModalOverlay onClose={() => setIsEditModalOpen(false)} zIndex={9000}>
          <div className="bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-2xl p-6 shadow-toss-lg max-w-2xl w-full max-h-[85vh] overflow-y-auto text-left animate-scale-in flex flex-col gap-5 scrollbar-thin" onClick={(event) => event.stopPropagation()}>
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
              <div>
                <span className="text-xs font-bold text-toss-blue">Project Information</span>
                <h3 className="text-base font-extrabold text-toss-gray-900 dark:text-slate-100 mt-0.5">프로젝트 정보 수정</h3>
              </div>
              <button type="button" onClick={() => setIsEditModalOpen(false)} className="p-2 rounded-xl hover:bg-toss-gray-100 dark:hover:bg-slate-800 text-toss-gray-400 cursor-pointer transition-colors"><X className="w-4 h-4" /></button>
            </div>
            <form onSubmit={handleSaveAllInfo} className="flex flex-col gap-5">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <TextField label="계약금액" value={editContractAmount} onChange={setEditContractAmount} />
                <SelectField label="중요도" value={editImportance} onChange={setEditImportance} options={['Critical', 'High', 'Medium', 'Low']} />
                <SelectField label="우선순위" value={editPriority} onChange={setEditPriority} options={['P1', 'P2', 'P3', 'P4']} />
                <TextField label="발주처명" value={editClientName} onChange={setEditClientName} />
                <button type="button" onClick={() => setIsRegionPickerOpen(true)} className="flex flex-col gap-1.5 text-left">
                  <span className="text-xs font-bold text-slate-400">지역</span>
                  <span className="w-full text-xs font-bold bg-slate-50 dark:bg-slate-855 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2.5 text-slate-800 dark:text-slate-100">{editClientRegion || '지역 선택'}</span>
                </button>
                <TextField label="담당 부서" value={editClientDepartment} onChange={setEditClientDepartment} />
                <TextField label="담당자" value={editClientContactName} onChange={setEditClientContactName} />
                <TextField label="연락처" value={editClientContactPhone} onChange={setEditClientContactPhone} />
                <TextField label="이메일" value={editClientContactEmail} onChange={setEditClientContactEmail} type="email" />
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <TextareaField label="프로젝트 설명" value={editDescription} onChange={setEditDescription} />
                <TextareaField label="사업 목적" value={editBusinessPurpose} onChange={setEditBusinessPurpose} />
                <TextareaField label="주요 범위" value={editMajorScope} onChange={setEditMajorScope} />
                <TextareaField label="특이사항" value={editSpecialNotes} onChange={setEditSpecialNotes} />
              </div>
              <div className="flex justify-end gap-2 border-t border-slate-100 dark:border-slate-800 pt-4">
                <button type="button" onClick={() => setIsEditModalOpen(false)} className="px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-bold text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer">취소</button>
                <button type="submit" className="px-4 py-2.5 rounded-xl bg-toss-blue text-white text-xs font-extrabold hover:bg-blue-600 cursor-pointer">저장하기</button>
              </div>
            </form>
          </div>
        </ModalOverlay>
      )}

      <RegionPickerModal
        isOpen={isRegionPickerOpen}
        onClose={() => setIsRegionPickerOpen(false)}
        zIndex={10000}
        onSelect={(code) => {
          const selectedRegionName = REGION_CODES.find((region) => region.code === code)?.name || code;
          setEditClientRegion(selectedRegionName);
        }}
      />
      </PageBody>
    </Page>
  );
};

const SectionGroup = ({ title, children }: { title: string; children: React.ReactNode }) => (
  <Panel title={title} className="mb-4">
    {children}
  </Panel>
);

const DashboardMetricCard = ({ title, children }: { title: string; children: React.ReactNode }) => (
  <Panel flush className="min-h-[150px]">
    <h2 className="mb-4 text-xs font-black text-slate-500 dark:text-slate-400">{title}</h2>
    {children}
  </Panel>
);

const OverviewCard = ({ title, action, onAction, children }: { title: string; action?: string; onAction?: () => void; children: React.ReactNode }) => (
  <Panel
    title={title}
    className="min-h-[230px]"
    actions={action && (
        <Button variant="ghost" size="sm" onClick={onAction}>
          {action} <ArrowRight className="w-3 h-3" />
        </Button>
    )}
  >
    {children}
  </Panel>
);

const MeetingStat = ({ label, value, active = false }: { label: string; value: number; active?: boolean }) => (
  <div className={`rounded-lg px-3 py-2 ${active ? 'bg-blue-50 dark:bg-blue-950/30 text-toss-blue' : 'bg-slate-50 dark:bg-slate-850 text-slate-500'}`}>
    <p className="text-[11px] font-black">{label}</p>
    <p className="mt-1 text-sm font-black">{value}</p>
  </div>
);

const InfoRow = ({ label, value, accent, progress }: { label: string; value: React.ReactNode; accent?: 'rose' | 'blue' | 'indigo'; progress?: number }) => (
  <div className="pm-info-row">
    <span className="pm-info-row__label">{label}</span>
    <div className="pm-info-row__value-wrap">
      {typeof progress === 'number' && (
        <div className="pm-info-row__progress">
          <div className="pm-info-row__progress-fill" style={{ width: `${progress}%` }} />
        </div>
      )}
      <span className={`pm-info-row__value ${accent ? `pm-info-row__value--${accent}` : ''}`}>
        {value}
      </span>
    </div>
  </div>
);

const RiskProgress = ({ label, value, className }: { label: string; value: number; className: string }) => (
  <div>
    <div className="mb-1 flex items-center justify-between text-[11px] font-black">
      <span className="text-slate-500 dark:text-slate-400">{label}</span>
      <span className="text-slate-800 dark:text-slate-200">{value}%</span>
    </div>
    <div className="h-2 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
      <div className={`h-full rounded-full ${className}`} style={{ width: `${Math.max(0, Math.min(100, value))}%` }} />
    </div>
  </div>
);

const NarrativeBlock = ({ title, value, empty }: { title: string; value?: string; empty: string }) => (
  <div className="pm-overview-narrative">
    <h3 className="pm-overview-narrative__title">{title}</h3>
    <p className="pm-overview-narrative__text">
      {value || <span className="pm-overview-narrative__empty">{empty}</span>}
    </p>
  </div>
);

const CompactList = ({ items, empty, danger = false }: { items: { title: string; sub: string; meta: string }[]; empty: string; danger?: boolean }) => {
  if (items.length === 0) return <EmptyState text={empty} />;
  return (
    <div className="pm-compact-list">
      {items.map((item, index) => (
        <div key={`${item.title}-${index}`} className="pm-compact-list__item">
          <div className="pm-compact-list__content">
            <p className="pm-compact-list__title">{item.title}</p>
            <p className="pm-compact-list__sub">{item.sub}</p>
          </div>
          <Badge tone={danger ? 'danger' : 'neutral'}>{item.meta}</Badge>
        </div>
      ))}
    </div>
  );
};

const TextField = ({ label, value, onChange, type = 'text' }: { label: string; value: string; onChange: (value: string) => void; type?: string }) => (
  <label className="flex flex-col gap-1.5">
    <span className="text-xs font-bold text-slate-400">{label}</span>
    <input type={type} value={value} onChange={(event) => onChange(event.target.value)} className="w-full text-xs font-bold bg-slate-50 dark:bg-slate-855 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2.5 outline-none focus:ring-2 focus:ring-toss-blue/15 text-slate-800 dark:text-slate-100" />
  </label>
);

const SelectField = ({ label, value, onChange, options }: { label: string; value: string; onChange: (value: string) => void; options: string[] }) => (
  <label className="flex flex-col gap-1.5">
    <span className="text-xs font-bold text-slate-400">{label}</span>
    <select value={value} onChange={(event) => onChange(event.target.value)} className="w-full text-xs font-bold bg-slate-50 dark:bg-slate-855 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2.5 outline-none focus:ring-2 focus:ring-toss-blue/15 text-slate-800 dark:text-slate-100">
      {options.map((option) => <option key={option} value={option}>{option}</option>)}
    </select>
  </label>
);

const TextareaField = ({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) => (
  <label className="flex flex-col gap-1.5">
    <span className="text-xs font-bold text-slate-400">{label}</span>
    <textarea value={value} onChange={(event) => onChange(event.target.value)} rows={3} className="w-full text-xs font-semibold bg-slate-50 dark:bg-slate-855 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 outline-none focus:ring-2 focus:ring-toss-blue/15 resize-none text-slate-800 dark:text-slate-100" />
  </label>
);
