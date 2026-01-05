
import * as React from 'react';
import { Client, Session, AdminTask, Appointment, AccountingEntry, Case, Stage, Invoice, InvoiceItem, CaseDocument, AppData, DeletedIds, getInitialDeletedIds, Profile, SiteFinancialEntry, Permissions, defaultPermissions, SyncStatus } from '../types.js';
import { useOnlineStatus } from './useOnlineStatus.js';
import type { User } from '@supabase/supabase-js';
import { useSync } from './useSync.js';
import { getSupabaseClient } from '../supabaseClient.js';
import { isBeforeToday } from '../utils/dateUtils.js';
import { RealtimeAlert } from '../components/RealtimeNotifier.js';
import { getDb, DATA_STORE_NAME, DOCS_FILES_STORE_NAME, PENDING_DELETIONS_STORE_NAME } from '../utils/db.js';

const defaultAssistants = ['أحمد', 'فاطمة', 'سارة', 'بدون تخصيص'];

const getInitialData = (): AppData => ({
    clients: [], adminTasks: [], appointments: [], accountingEntries: [], invoices: [], assistants: [...defaultAssistants], documents: [], profiles: [], siteFinances: [],
});

const reviveDate = (date: any): Date => {
    if (date === null || date === undefined || date === '') return new Date(0);
    if (date instanceof Date) return isNaN(date.getTime()) ? new Date(0) : date;
    
    if (typeof date === 'string') {
        if (date.includes('T')) {
            const d = new Date(date);
            return isNaN(d.getTime()) ? new Date(0) : d;
        }
        const match = date.match(/^(\d{4})-(\d{2})-(\d{2})$/);
        if (match) {
            const year = parseInt(match[1], 10);
            const month = parseInt(match[2], 10) - 1;
            const day = parseInt(match[3], 10);
            return new Date(year, month, day, 12, 0, 0, 0);
        }
    }
    const d = new Date(date);
    return isNaN(d.getTime()) ? new Date(0) : d;
};

const validateAndFixData = (loadedData: any): AppData => {
    if (!loadedData || typeof loadedData !== 'object') return getInitialData();
    const data = { ...getInitialData(), ...loadedData };
    return {
        clients: (Array.isArray(data.clients) ? data.clients : []).map((c: any) => ({
            ...c, updated_at: reviveDate(c.updated_at),
            cases: (Array.isArray(c.cases) ? c.cases : []).map((cs: any) => ({
                ...cs, updated_at: reviveDate(cs.updated_at),
                stages: (Array.isArray(cs.stages) ? cs.stages : []).map((st: any) => ({
                    ...st, updated_at: reviveDate(st.updated_at),
                    sessions: (Array.isArray(st.sessions) ? st.sessions : []).map((s: any) => ({
                        ...s, date: reviveDate(s.date), updated_at: reviveDate(s.updated_at),
                    }))
                }))
            }))
        })),
        adminTasks: (Array.isArray(data.adminTasks) ? data.adminTasks : []).map((t: any) => ({ ...t, dueDate: reviveDate(t.dueDate), updated_at: reviveDate(t.updated_at) })),
        appointments: (Array.isArray(data.appointments) ? data.appointments : []).map((a: any) => ({ ...a, date: reviveDate(a.date), updated_at: reviveDate(a.updated_at) })),
        accountingEntries: (Array.isArray(data.accountingEntries) ? data.accountingEntries : []).map((e: any) => ({ ...e, date: reviveDate(e.date), updated_at: reviveDate(e.updated_at) })),
        invoices: (Array.isArray(data.invoices) ? data.invoices : []).map((inv: any) => ({ ...inv, issueDate: reviveDate(inv.issueDate), dueDate: reviveDate(inv.dueDate), updated_at: reviveDate(inv.updated_at), items: Array.isArray(inv.items) ? inv.items : [] })),
        assistants: Array.isArray(data.assistants) ? data.assistants : [...defaultAssistants],
        documents: (Array.isArray(data.documents) ? data.documents : []).map((d: any) => ({ ...d, addedAt: reviveDate(d.addedAt), updated_at: reviveDate(d.updated_at) })),
        profiles: (Array.isArray(data.profiles) ? data.profiles : []).map((p: any) => ({ ...p, updated_at: reviveDate(p.updated_at) })),
        siteFinances: (Array.isArray(data.siteFinances) ? data.siteFinances : []).map((sf: any) => ({ ...sf, updated_at: reviveDate(sf.updated_at) })),
    };
};

export const useSupabaseData = (user: User | null, isAuthLoading: boolean) => {
    const [data, setData] = React.useState<AppData>(getInitialData);
    const [isDirty, setDirty] = React.useState(false);
    const [syncStatus, setSyncStatus] = React.useState<SyncStatus>('loading');
    const [lastSyncError, setLastSyncError] = React.useState<string | null>(null);
    const [isDataLoading, setIsDataLoading] = React.useState(true);
    
    const [adminTasksLayout, setAdminTasksLayout] = React.useState<'horizontal' | 'vertical'>(() => 
        (localStorage.getItem('adminTasksLayout') as 'horizontal' | 'vertical') || 'horizontal'
    );
    const [locationOrder, setLocationOrder] = React.useState<string[]>(() => 
        JSON.parse(localStorage.getItem('locationOrder') || '[]')
    );
    const [isAutoSyncEnabled, setAutoSyncEnabled] = React.useState(true);
    const [isAutoBackupEnabled, setAutoBackupEnabled] = React.useState(true);

    React.useEffect(() => localStorage.setItem('adminTasksLayout', adminTasksLayout), [adminTasksLayout]);
    React.useEffect(() => localStorage.setItem('locationOrder', JSON.stringify(locationOrder)), [locationOrder]);

    const isOnline = useOnlineStatus();
    const userRef = React.useRef(user);
    userRef.current = user;
    const supabase = getSupabaseClient();
    const effectiveUserId = React.useMemo(() => user?.id || null, [user]);

    // 1. تحميل البيانات المحلية
    React.useEffect(() => {
        if (isAuthLoading) return;
        if (!user || !effectiveUserId) { setIsDataLoading(false); setSyncStatus('unconfigured'); return; }

        const loadInitial = async () => {
            try {
                const db = await getDb();
                const cachedData = await db.get(DATA_STORE_NAME, effectiveUserId);
                if (cachedData) {
                    setData(validateAndFixData(cachedData));
                    setIsDataLoading(false);
                    setSyncStatus('synced');
                } else {
                    if (isOnline) await manualSync();
                    else setSyncStatus('synced');
                    setIsDataLoading(false);
                }
            } catch (e) {
                setIsDataLoading(false);
                setSyncStatus('synced');
            }
        };
        loadInitial();
    }, [user, effectiveUserId, isAuthLoading]);

    const updateData = React.useCallback((updater: React.SetStateAction<AppData>, options: { markDirty?: boolean } = { markDirty: true }) => {
        if (!userRef.current || !effectiveUserId) return;
        setData(currentData => {
            const newData = typeof updater === 'function' ? (updater as any)(currentData) : updater;
            getDb().then(db => db.put(DATA_STORE_NAME, newData, effectiveUserId)).catch(e => console.error("DB Save failed:", e));
            if (options.markDirty) setDirty(true);
            return newData;
        });
    }, [effectiveUserId]);

    const recordDeletion = async (tableName: string, recordId: string) => {
        try {
            const db = await getDb();
            await db.add(PENDING_DELETIONS_STORE_NAME, { table_name: tableName, record_id: recordId, user_id: effectiveUserId });
            setDirty(true);
        } catch (e) { console.error("Failed to record deletion:", e); }
    };

    const onDataSynced = React.useCallback((mergedData: AppData) => {
        const fixedData = validateAndFixData(mergedData);
        updateData(fixedData, { markDirty: false });
        setDirty(false);
    }, [updateData]);

    const { manualSync } = useSync({
        user, localData: data, onDataSynced,
        onSyncStatusChange: (status, error) => { setSyncStatus(status); setLastSyncError(error); },
        isOnline, isAuthLoading, syncStatus
    });

    React.useEffect(() => {
        if (isOnline && isDirty && syncStatus === 'synced' && !isAuthLoading && user && isAutoSyncEnabled) {
            const timer = setTimeout(() => manualSync(), 3000);
            return () => clearTimeout(timer);
        }
    }, [isDirty, isOnline, manualSync, syncStatus, isAuthLoading, user, isAutoSyncEnabled]);

    const [triggeredAlerts, setTriggeredAlerts] = React.useState<Appointment[]>([]);
    const [showUnpostponedSessionsModal, setShowUnpostponedSessionsModal] = React.useState(false);
    const [realtimeAlerts, setRealtimeAlerts] = React.useState<RealtimeAlert[]>([]);
    const [userApprovalAlerts, setUserApprovalAlerts] = React.useState<RealtimeAlert[]>([]);

    const currentUserPermissions: Permissions = React.useMemo(() => {
        if (!user) return defaultPermissions;
        const profile = (data.profiles || []).find(p => p.id === user.id);
        if (profile?.lawyer_id) return { ...defaultPermissions, ...(profile.permissions || {}) };
        return {
            can_view_agenda: true, can_view_clients: true, can_add_client: true, can_edit_client: true, can_delete_client: true,
            can_view_cases: true, can_add_case: true, can_edit_case: true, can_delete_case: true,
            can_view_sessions: true, can_add_session: true, can_edit_session: true, can_delete_session: true,
            can_postpone_session: true, can_decide_session: true,
            can_view_documents: true, can_add_document: true, can_delete_document: true,
            can_view_finance: true, can_add_financial_entry: true, can_delete_financial_entry: true, can_manage_invoices: true,
            can_view_admin_tasks: true, can_add_admin_task: true, can_edit_admin_task: true, can_delete_admin_task: true,
            can_view_reports: true,
        };
    }, [user, data.profiles]);

    const allSessions = React.useMemo(() => (data.clients || []).flatMap(c => (c.cases || []).flatMap(cs => (cs.stages || []).flatMap(st => (st.sessions || []).map(s => ({ ...s, stageId: st.id, stageDecisionDate: st.decisionDate, user_id: c.user_id }))))), [data.clients]);
    const unpostponedSessions = React.useMemo(() => (data.clients || []).flatMap(c => (c.cases || []).flatMap(cs => (cs.stages || []).flatMap(st => (st.sessions || []).filter(s => !s.isPostponed && isBeforeToday(s.date) && !st.decisionDate).map(s => ({ ...s, stageId: st.id, stageDecisionDate: st.decisionDate }))))), [data.clients]);

    const postponeSession = React.useCallback((sessionId: string, nextDate: Date, nextReason: string) => {
        updateData(prev => {
            const newClients = prev.clients.map(client => ({
                ...client, updated_at: new Date(),
                cases: client.cases.map(caseItem => ({
                    ...caseItem, updated_at: new Date(),
                    stages: caseItem.stages.map(stage => {
                        const sessionIdx = stage.sessions.findIndex(s => s.id === sessionId);
                        if (sessionIdx === -1) return stage;
                        const updatedSessions = [...stage.sessions];
                        updatedSessions[sessionIdx] = { ...updatedSessions[sessionIdx], isPostponed: true, nextSessionDate: nextDate, nextPostponementReason: nextReason, updated_at: new Date() };
                        const newSession: Session = { id: `session-${Date.now()}`, date: nextDate, court: stage.court, caseNumber: stage.caseNumber, clientName: client.name, opponentName: caseItem.opponentName, isPostponed: false, postponementReason: nextReason, assignee: updatedSessions[sessionIdx].assignee || 'بدون تخصيص', updated_at: new Date() };
                        return { ...stage, sessions: [...updatedSessions, newSession], updated_at: new Date() };
                    })
                }))
            }));
            return { ...prev, clients: newClients };
        });
    }, [updateData]);

    const getDocumentFile = React.useCallback(async (docId: string): Promise<File | null> => {
        const db = await getDb();
        const file = await db.get(DOCS_FILES_STORE_NAME, docId);
        if (file) return file;
        const docMetadata = data.documents.find(d => d.id === docId);
        if (docMetadata && isOnline && supabase) {
             setData(prev => ({ ...prev, documents: prev.documents.map(d => d.id === docId ? { ...d, localState: 'downloading' } : d) }));
             try {
                 const { data: blob, error } = await supabase.storage.from('documents').download(docMetadata.storagePath);
                 if (error) throw error;
                 if (blob) {
                     const downloadedFile = new File([blob], docMetadata.name, { type: docMetadata.type });
                     await db.put(DOCS_FILES_STORE_NAME, downloadedFile, docId);
                     setData(prev => ({ ...prev, documents: prev.documents.map(d => d.id === docId ? { ...d, localState: 'synced' } : d) }));
                     return downloadedFile;
                 }
             } catch (e) { setData(prev => ({ ...prev, documents: prev.documents.map(d => d.id === docId ? { ...d, localState: 'error' } : d) })); }
        }
        return null;
    }, [data.documents, isOnline, supabase]);

    return {
        ...data,
        setClients: (updater: React.SetStateAction<Client[]>) => updateData(prev => ({ ...prev, clients: typeof updater === 'function' ? (updater as any)(prev.clients) : updater })),
        setAdminTasks: (updater: React.SetStateAction<AdminTask[]>) => updateData(prev => ({ ...prev, adminTasks: typeof updater === 'function' ? (updater as any)(prev.adminTasks) : updater })),
        setAppointments: (updater: React.SetStateAction<Appointment[]>) => updateData(prev => ({ ...prev, appointments: typeof updater === 'function' ? (updater as any)(prev.appointments) : updater })),
        setAccountingEntries: (updater: React.SetStateAction<AccountingEntry[]>) => updateData(prev => ({ ...prev, accountingEntries: typeof updater === 'function' ? (updater as any)(prev.accountingEntries) : updater })),
        setInvoices: (updater: React.SetStateAction<Invoice[]>) => updateData(prev => ({ ...prev, invoices: typeof updater === 'function' ? (updater as any)(prev.invoices) : updater })),
        setAssistants: (updater: React.SetStateAction<string[]>) => updateData(prev => ({ ...prev, assistants: typeof updater === 'function' ? (updater as any)(prev.assistants) : updater })),
        setProfiles: (updater: React.SetStateAction<Profile[]>) => updateData(prev => ({ ...prev, profiles: typeof updater === 'function' ? (updater as any)(prev.profiles) : updater })),
        setSiteFinances: (updater: React.SetStateAction<SiteFinancialEntry[]>) => updateData(prev => ({ ...prev, siteFinances: typeof updater === 'function' ? (updater as any)(prev.siteFinances) : updater })),
        setFullData: (newData: AppData) => updateData(newData),
        deleteClient: (id: string) => { recordDeletion('clients', id); updateData(prev => ({ ...prev, clients: prev.clients.filter(c => c.id !== id) })); },
        deleteCase: (caseId: string, clientId: string) => { recordDeletion('cases', caseId); updateData(prev => ({ ...prev, clients: prev.clients.map(c => c.id === clientId ? { ...c, cases: c.cases.filter(cs => cs.id !== caseId) } : c) })); },
        deleteStage: (stageId: string, caseId: string, clientId: string) => { recordDeletion('stages', stageId); updateData(prev => ({ ...prev, clients: prev.clients.map(c => c.id === clientId ? { ...c, cases: c.cases.map(cs => cs.id === caseId ? { ...cs, stages: cs.stages.filter(st => st.id !== stageId) } : cs) } : c) })); },
        deleteSession: (sessionId: string, stageId: string, caseId: string, clientId: string) => { recordDeletion('sessions', sessionId); updateData(prev => ({ ...prev, clients: prev.clients.map(c => c.id === clientId ? { ...c, cases: c.cases.map(cs => cs.id === caseId ? { ...cs, stages: cs.stages.map(st => st.id === stageId ? { ...st, sessions: st.sessions.filter(s => s.id !== sessionId) } : st) } : cs) } : c) })); },
        deleteAdminTask: (id: string) => { recordDeletion('admin_tasks', id); updateData(prev => ({ ...prev, adminTasks: prev.adminTasks.filter(t => t.id !== id) })); },
        deleteAppointment: (id: string) => { recordDeletion('appointments', id); updateData(prev => ({ ...prev, appointments: prev.appointments.filter(a => a.id !== id) })); },
        deleteAccountingEntry: (id: string) => { recordDeletion('accounting_entries', id); updateData(prev => ({ ...prev, accountingEntries: prev.accountingEntries.filter(e => e.id !== id) })); },
        deleteInvoice: (id: string) => { recordDeletion('invoices', id); updateData(prev => ({ ...prev, invoices: prev.invoices.filter(i => i.id !== id) })); },
        allSessions, unpostponedSessions, isDataLoading, isDirty, syncStatus, lastSyncError,
        manualSync, fetchAndRefresh: manualSync,
        triggeredAlerts, dismissAlert: (id: string) => setTriggeredAlerts(prev => prev.filter(a => a.id !== id)),
        showUnpostponedSessionsModal, setShowUnpostponedSessionsModal, postponeSession,
        realtimeAlerts, addRealtimeAlert: (message: string) => setRealtimeAlerts(prev => [...prev, { id: Date.now(), message }]),
        dismissRealtimeAlert: (id: number) => setRealtimeAlerts(prev => prev.filter(a => a.id !== id)),
        userApprovalAlerts, dismissUserApprovalAlert: (id: number) => setUserApprovalAlerts(prev => prev.filter(a => a.id !== id)),
        userId: user?.id, permissions: currentUserPermissions,
        isAutoSyncEnabled, setAutoSyncEnabled, isAutoBackupEnabled, setAutoBackupEnabled, 
        adminTasksLayout, setAdminTasksLayout, locationOrder, setLocationOrder,
        exportData: () => false, addDocuments: async () => {}, getDocumentFile
    };
};
