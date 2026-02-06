
import * as React from 'react';
import { Client, Session, AdminTask, Appointment, AccountingEntry, Case, Stage, Invoice, InvoiceItem, CaseDocument, AppData, DeletedIds, getInitialDeletedIds, Profile, SiteFinancialEntry, Permissions, defaultPermissions } from '../types';
import { useOnlineStatus } from './useOnlineStatus';
import type { User, RealtimeChannel } from '@supabase/supabase-js';
import { useSync, SyncStatus as SyncStatusType } from './useSync';
import { getSupabaseClient } from '../supabaseClient';
import { isBeforeToday, toInputDateString } from '../utils/dateUtils';
import { RealtimeAlert } from '../components/RealtimeNotifier';
import { getDb, DATA_STORE_NAME, DOCS_FILES_STORE_NAME, DOCS_METADATA_STORE_NAME, LOCAL_EXCLUDED_DOCS_STORE_NAME } from '../utils/db';

export const APP_DATA_KEY = 'lawyerBusinessManagementData';
export type SyncStatus = SyncStatusType;
const defaultAssistants = ['أحمد', 'فاطمة', 'سارة', 'بدون تخصيص'];

const getInitialData = (): AppData => ({
    clients: [] as Client[],
    adminTasks: [] as AdminTask[],
    appointments: [] as Appointment[],
    accountingEntries: [] as AccountingEntry[],
    invoices: [] as Invoice[],
    assistants: [...defaultAssistants],
    documents: [] as CaseDocument[],
    profiles: [] as Profile[],
    siteFinances: [] as SiteFinancialEntry[],
});

const reviveDate = (date: any): Date => {
    if (!date) return new Date();
    if (date instanceof Date) return date;
    const d = new Date(date);
    return isNaN(d.getTime()) ? new Date() : d;
};

const safeArray = <T, U>(arr: any, mapFn: (item: any, index: number) => U | undefined): U[] => {
    if (!Array.isArray(arr)) return [];
    return arr.reduce((acc: U[], item: any, index: number) => {
        if (!item) return acc;
        try {
            const result = mapFn(item, index);
            if (result !== undefined) acc.push(result);
        } catch (e) { console.error('Error processing array item:', e); }
        return acc;
    }, []);
};

const validateAndFixData = (loadedData: any, user: User | null): AppData => {
    if (!loadedData || typeof loadedData !== 'object') return getInitialData();
    const isValidObject = (item: any): item is Record<string, any> => item && typeof item === 'object' && !Array.isArray(item);
    
    return {
        clients: safeArray(loadedData.clients, (client) => {
             if (!isValidObject(client) || !client.id || !client.name) return undefined;
             return {
                 id: String(client.id),
                 name: String(client.name),
                 contactInfo: String(client.contactInfo || ''),
                 updated_at: reviveDate(client.updated_at),
                 user_id: client.user_id,
                 cases: safeArray(client.cases, (caseItem) => {
                     if (!isValidObject(caseItem) || !caseItem.id) return undefined;
                     return {
                         id: String(caseItem.id),
                         subject: String(caseItem.subject || ''),
                         clientName: String(caseItem.clientName || client.name),
                         opponentName: String(caseItem.opponentName || ''),
                         feeAgreement: String(caseItem.feeAgreement || ''),
                         status: ['active', 'closed', 'on_hold'].includes(caseItem.status) ? caseItem.status : 'active',
                         updated_at: reviveDate(caseItem.updated_at),
                         user_id: caseItem.user_id,
                         stages: safeArray(caseItem.stages, (stage) => {
                             if (!isValidObject(stage) || !stage.id) return undefined;
                             return {
                                 id: String(stage.id),
                                 court: String(stage.court || ''),
                                 caseNumber: String(stage.caseNumber || ''),
                                 firstSessionDate: stage.firstSessionDate ? reviveDate(stage.firstSessionDate) : undefined,
                                 decisionDate: stage.decisionDate ? reviveDate(stage.decisionDate) : undefined,
                                 decisionNumber: String(stage.decisionNumber || ''),
                                 decisionSummary: String(stage.decisionSummary || ''),
                                 decisionNotes: String(stage.decisionNotes || ''),
                                 updated_at: reviveDate(stage.updated_at),
                                 user_id: stage.user_id,
                                 sessions: safeArray(stage.sessions, (session) => {
                                     if (!isValidObject(session) || !session.id) return undefined;
                                     return {
                                         id: String(session.id),
                                         court: String(session.court || stage.court),
                                         caseNumber: String(session.caseNumber || stage.caseNumber),
                                         date: reviveDate(session.date),
                                         clientName: String(session.clientName || caseItem.clientName),
                                         opponentName: String(session.opponentName || caseItem.opponentName),
                                         postponementReason: session.postponementReason,
                                         nextPostponementReason: session.nextPostponementReason,
                                         isPostponed: !!session.isPostponed,
                                         nextSessionDate: session.nextSessionDate ? reviveDate(session.nextSessionDate) : undefined,
                                         assignee: session.assignee,
                                         stageId: session.stageId,
                                         stageDecisionDate: session.stageDecisionDate ? reviveDate(session.stageDecisionDate) : undefined,
                                         updated_at: reviveDate(session.updated_at),
                                         user_id: session.user_id,
                                     };
                                 }),
                             };
                         }),
                     };
                 }),
             };
        }),
        adminTasks: safeArray(loadedData.adminTasks, (task, index) => {
            if (!isValidObject(task) || !task.id) return undefined;
            return {
                id: String(task.id),
                task: String(task.task || ''),
                dueDate: reviveDate(task.dueDate),
                completed: !!task.completed,
                importance: ['normal', 'important', 'urgent'].includes(task.importance) ? task.importance : 'normal',
                assignee: task.assignee,
                location: task.location,
                updated_at: reviveDate(task.updated_at),
                orderIndex: typeof task.orderIndex === 'number' ? task.orderIndex : index,
            };
        }),
        appointments: safeArray(loadedData.appointments, (apt) => {
            if (!isValidObject(apt) || !apt.id) return undefined;
            return {
                id: String(apt.id),
                title: String(apt.title || ''),
                time: String(apt.time || '00:00'),
                date: reviveDate(apt.date),
                importance: ['normal', 'important', 'urgent'].includes(apt.importance) ? apt.importance : 'normal',
                completed: !!apt.completed,
                notified: !!apt.notified,
                reminderTimeInMinutes: Number(apt.reminderTimeInMinutes || 15),
                assignee: apt.assignee,
                updated_at: reviveDate(apt.updated_at),
            };
        }),
        accountingEntries: safeArray(loadedData.accountingEntries, (entry) => {
            if (!isValidObject(entry) || !entry.id) return undefined;
            return {
                id: String(entry.id),
                type: ['income', 'expense'].includes(entry.type) ? entry.type : 'income',
                amount: Number(entry.amount || 0),
                date: reviveDate(entry.date),
                description: String(entry.description || ''),
                clientId: String(entry.clientId || ''),
                caseId: String(entry.caseId || ''),
                clientName: String(entry.clientName || ''),
                updated_at: reviveDate(entry.updated_at),
            };
        }),
        invoices: safeArray(loadedData.invoices, (invoice) => {
            if (!isValidObject(invoice) || !invoice.id) return undefined;
            return {
                id: String(invoice.id),
                clientId: String(invoice.clientId || ''),
                clientName: String(invoice.clientName || ''),
                caseId: invoice.caseId,
                caseSubject: invoice.caseSubject,
                issueDate: reviveDate(invoice.issueDate),
                dueDate: reviveDate(invoice.dueDate),
                items: safeArray(invoice.items, (item) => {
                    if (!isValidObject(item) || !item.id) return undefined;
                    return {
                        id: String(item.id),
                        description: String(item.description || ''),
                        amount: Number(item.amount || 0),
                        updated_at: reviveDate(item.updated_at),
                    };
                }),
                taxRate: Number(invoice.taxRate || 0),
                discount: Number(invoice.discount || 0),
                status: ['draft', 'sent', 'paid', 'overdue'].includes(invoice.status) ? invoice.status : 'draft',
                notes: invoice.notes,
                updated_at: reviveDate(invoice.updated_at),
            };
        }),
        assistants: Array.isArray(loadedData.assistants) ? loadedData.assistants : [...defaultAssistants],
        documents: safeArray(loadedData.documents, (doc) => {
             if (!isValidObject(doc) || !doc.id) return undefined;
             return {
                 id: String(doc.id),
                 caseId: String(doc.caseId || ''),
                 userId: String(doc.userId || ''),
                 name: String(doc.name || ''),
                 type: String(doc.type || 'application/octet-stream'),
                 size: Number(doc.size || 0),
                 storagePath: String(doc.storagePath || ''),
                 localState: ['synced', 'pending_upload', 'pending_download', 'error', 'downloading'].includes(doc.localState) ? doc.localState : 'synced',
                 addedAt: reviveDate(doc.addedAt),
                 updated_at: reviveDate(doc.updated_at),
             } as CaseDocument;
        }),
        profiles: Array.isArray(loadedData.profiles) ? loadedData.profiles : [],
        siteFinances: Array.isArray(loadedData.siteFinances) ? loadedData.siteFinances : [],
    };
};

export const useSupabaseData = (user: User | null, isAuthLoading: boolean) => {
    const [data, setData] = React.useState<AppData>(getInitialData);
    const [deletedIds, setDeletedIds] = React.useState<DeletedIds>(getInitialDeletedIds);
    const [isDirty, setDirty] = React.useState(false);
    const [syncStatus, setSyncStatus] = React.useState<SyncStatus>('uninitialized');
    const [lastSyncError, setLastSyncError] = React.useState<string | null>(null);
    const [isDataLoading, setIsDataLoading] = React.useState(true);
    const [realtimeAlerts, setRealtimeAlerts] = React.useState<RealtimeAlert[]>([]);
    const [userApprovalAlerts, setUserApprovalAlerts] = React.useState<RealtimeAlert[]>([]);
    const [triggeredAlerts, setTriggeredAlerts] = React.useState<Appointment[]>([]);
    const [showUnpostponedSessionsModal, setShowUnpostponedSessionsModal] = React.useState(false);
    const [userSettings, setUserSettings] = React.useState<any>({ isAutoSyncEnabled: true, adminTasksLayout: 'horizontal', locationOrder: [] });
    const isOnline = useOnlineStatus();
    
    const userRef = React.useRef(user);
    userRef.current = user;

    const effectiveUserId = React.useMemo(() => {
        if (!user) return null;
        const profile = data.profiles.find(p => p.id === user.id);
        return profile?.lawyer_id || user.id;
    }, [user, data.profiles]);

    const currentUserPermissions: Permissions = React.useMemo(() => {
        if (!user) return defaultPermissions;
        const profile = data.profiles.find(p => p.id === user.id);
        if (profile && profile.lawyer_id) {
            return { ...defaultPermissions, ...profile.permissions };
        }
        return {
            can_view_agenda: true, can_view_clients: true, can_add_client: true, can_edit_client: true, can_delete_client: true,
            can_view_cases: true, can_add_case: true, can_edit_case: true, can_delete_case: true,
            can_view_sessions: true, can_add_session: true, can_edit_session: true, can_delete_session: true, can_postpone_session: true, can_decide_session: true,
            can_view_documents: true, can_add_document: true, can_delete_document: true,
            can_view_finance: true, can_add_financial_entry: true, can_delete_financial_entry: true, can_manage_invoices: true,
            can_view_admin_tasks: true, can_add_admin_task: true, can_edit_admin_task: true, can_delete_admin_task: true,
            can_view_reports: true,
        };
    }, [user, data.profiles]);

    const updateData = React.useCallback((updater: React.SetStateAction<AppData>, options = { markDirty: true }) => {
        if (!effectiveUserId) return;
        
        setData(current => {
            const next = typeof updater === 'function' ? (updater as any)(current) : updater;
            getDb().then(db => db.put(DATA_STORE_NAME, next, effectiveUserId));
            if (options.markDirty) setDirty(true);
            return next;
        });
    }, [effectiveUserId]);

    // "Offline First" Loader: Load from IndexedDB immediately
    React.useEffect(() => {
        // We can load data if we have a user ID, even if isAuthLoading is true (cached session)
        if (effectiveUserId) {
            const loadLocal = async () => {
                try {
                    const db = await getDb();
                    const [stored, storedDeleted] = await Promise.all([
                        db.get(DATA_STORE_NAME, effectiveUserId),
                        db.get(DATA_STORE_NAME, `deletedIds_${effectiveUserId}`)
                    ]);
                    
                    if (stored) {
                        setData(validateAndFixData(stored, userRef.current));
                    }
                    if (storedDeleted) {
                        setDeletedIds(storedDeleted);
                    }
                    
                    // CRITICAL: UI is now responsive with local data
                    setIsDataLoading(false);
                    
                    // Now that local is ready, trigger background sync if online
                    if (isOnline) setSyncStatus('loading');
                    else setSyncStatus('synced');
                } catch (e) {
                    console.error("Failed to load local data:", e);
                    setIsDataLoading(false);
                }
            };
            loadLocal();
        } else if (!isAuthLoading) {
            // No user and auth check finished
            setIsDataLoading(false);
        }
    }, [effectiveUserId, isAuthLoading, isOnline]);

    const handleSyncStatusChange = React.useCallback((status: SyncStatus, error: string | null) => {
        setSyncStatus(status);
        setLastSyncError(error);
    }, []);

    const handleDataSynced = React.useCallback((merged: AppData) => {
        if (!effectiveUserId) return;
        updateData(merged, { markDirty: false });
        setDirty(false);
    }, [effectiveUserId, updateData]);

    const { manualSync, fetchAndRefresh } = useSync({
        user: userRef.current ? { ...userRef.current, id: effectiveUserId || userRef.current.id } as User : null,
        localData: data, 
        deletedIds,
        onDataSynced: handleDataSynced,
        onDeletionsSynced: (synced) => {
            setDeletedIds(prev => {
                const next = { ...prev };
                Object.keys(synced).forEach(k => {
                    const syncedSet = new Set((synced as any)[k]);
                    (next as any)[k] = (prev as any)[k].filter((id: any) => !syncedSet.has(id));
                });
                return next;
            });
        },
        onSyncStatusChange: handleSyncStatusChange,
        isOnline, isAuthLoading, syncStatus
    });

    React.useEffect(() => {
        if (isOnline && isDirty && userSettings.isAutoSyncEnabled && syncStatus !== 'syncing' && syncStatus !== 'unconfigured') {
            const timer = setTimeout(manualSync, 5000);
            return () => clearTimeout(timer);
        }
    }, [isOnline, isDirty, syncStatus, manualSync, userSettings.isAutoSyncEnabled]);

    return {
        ...data,
        setClients: (u) => updateData(p => ({ ...p, clients: u(p.clients) })),
        setAdminTasks: (u) => updateData(p => ({ ...p, adminTasks: u(p.adminTasks) })),
        setAppointments: (u) => updateData(p => ({ ...p, appointments: u(p.appointments) })),
        setAccountingEntries: (u) => updateData(p => ({ ...p, accountingEntries: u(p.accountingEntries) })),
        setInvoices: (u) => updateData(p => ({ ...p, invoices: u(p.invoices) })),
        setProfiles: (u) => updateData(p => ({ ...p, profiles: u(p.profiles) })),
        setSiteFinances: (u) => updateData(p => ({ ...p, siteFinances: u(p.siteFinances) })),
        setAssistants: (u) => updateData(p => ({ ...p, assistants: u(p.assistants) })),
        setDocuments: (u) => updateData(p => ({ ...p, documents: u(p.documents) })),
        setFullData: (d: any) => updateData(validateAndFixData(d, userRef.current)),
        
        allSessions: React.useMemo(() => data.clients.flatMap(c => (c.cases || []).flatMap(cs => (cs.stages || []).flatMap(st => (st.sessions || []).map(s => ({...s, stageId: st.id, stageDecisionDate: st.decisionDate}))))), [data.clients]),
        unpostponedSessions: React.useMemo(() => data.clients.flatMap(c => (c.cases || []).flatMap(cs => (cs.stages || []).flatMap(st => (st.sessions || []).filter(s => !s.isPostponed && isBeforeToday(s.date) && !st.decisionDate).map(s => ({...s, stageId: st.id, stageDecisionDate: st.decisionDate}))))), [data.clients]),
        
        syncStatus, manualSync, lastSyncError, isDirty, isDataLoading, isOnline,
        userId: user?.id, effectiveUserId, permissions: currentUserPermissions,
        isAutoSyncEnabled: userSettings.isAutoSyncEnabled, setAutoSyncEnabled: (v: boolean) => setUserSettings((p:any) => ({...p, isAutoSyncEnabled: v})),
        isAutoBackupEnabled: true, setAutoBackupEnabled: () => {}, 
        adminTasksLayout: userSettings.adminTasksLayout || 'horizontal', setAdminTasksLayout: (v: any) => setUserSettings((p:any) => ({...p, adminTasksLayout: v})),
        locationOrder: userSettings.locationOrder || [], setLocationOrder: (v: any) => setUserSettings((p:any) => ({...p, locationOrder: v})),
        
        realtimeAlerts, addRealtimeAlert: (m: string) => setRealtimeAlerts(p => [...p, { id: Date.now(), message: m }]),
        dismissRealtimeAlert: (id: number) => setRealtimeAlerts(p => p.filter(a => a.id !== id)),
        userApprovalAlerts, dismissUserApprovalAlert: (id: number) => setUserApprovalAlerts(p => p.filter(a => a.id !== id)),
        triggeredAlerts, dismissAlert: (id: string) => setTriggeredAlerts(p => p.filter(a => a.id !== id)),
        showUnpostponedSessionsModal, setShowUnpostponedSessionsModal,
        fetchAndRefresh,
        
        exportData: () => {
             try {
                const dataToExport = { ...data, profiles: undefined, siteFinances: undefined };
                const jsonString = JSON.stringify(dataToExport, null, 2);
                const blob = new Blob([jsonString], { type: 'application/json' });
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a'); a.href = url;
                a.download = `lawyer_app_backup_${new Date().toISOString().replace(/[:.]/g, '-')}.json`;
                document.body.appendChild(a); a.click(); document.body.removeChild(a); URL.revokeObjectURL(url);
                return true;
            } catch (e) { console.error(e); return false; }
        },
        
        deleteClient: (id: string) => {
            updateData(p => ({ ...p, clients: p.clients.filter(c => c.id !== id) }));
            setDeletedIds(prev => ({ ...prev, clients: [...prev.clients, id] }));
        },
        deleteCase: async (caseId: string, clientId: string) => {
            updateData(p => ({ ...p, clients: p.clients.map(c => c.id === clientId ? { ...c, cases: c.cases.filter(cs => cs.id !== caseId) } : c) }));
            setDeletedIds(prev => ({ ...prev, cases: [...prev.cases, caseId] }));
        },
        deleteStage: (sid: string, cid: string, clid: string) => {
            updateData(p => ({ ...p, clients: p.clients.map(c => c.id === clid ? { ...c, cases: c.cases.map(cs => cs.id === cid ? { ...cs, stages: cs.stages.filter(st => st.id !== sid) } : cs) } : c) }));
            setDeletedIds(prev => ({ ...prev, stages: [...prev.stages, sid] }));
        },
        deleteSession: (sessId: string, stId: string, cid: string, clid: string) => {
            updateData(p => ({ ...p, clients: p.clients.map(c => c.id === clid ? { ...c, cases: c.cases.map(cs => cs.id === cid ? { ...cs, stages: cs.stages.map(st => st.id === stId ? { ...st, sessions: st.sessions.filter(s => s.id !== sessId) } : st) } : cs) } : c) }));
            setDeletedIds(prev => ({ ...prev, sessions: [...prev.sessions, sessId] }));
        },
        deleteAdminTask: (id: string) => {
            updateData(p => ({...p, adminTasks: p.adminTasks.filter(t => t.id !== id)}));
            setDeletedIds(prev => ({...prev, adminTasks: [...prev.adminTasks, id]}));
        },
        deleteAppointment: (id: string) => {
            updateData(p => ({...p, appointments: p.appointments.filter(a => a.id !== id)}));
            setDeletedIds(prev => ({...prev, appointments: [...prev.appointments, id]}));
        },
        deleteAccountingEntry: (id: string) => {
            updateData(p => ({...p, accountingEntries: p.accountingEntries.filter(e => e.id !== id)}));
            setDeletedIds(prev => ({...prev, accountingEntries: [...prev.accountingEntries, id]}));
        },
        deleteInvoice: (id: string) => {
            updateData(p => ({...p, invoices: p.invoices.filter(i => i.id !== id)}));
            setDeletedIds(prev => ({...prev, invoices: [...prev.invoices, id]}));
        },
        deleteAssistant: (name: string) => {
            updateData(p => ({...p, assistants: p.assistants.filter(a => a !== name)}));
            setDeletedIds(prev => ({...prev, assistants: [...prev.assistants, name]}));
        },
        deleteDocument: async (doc: CaseDocument) => {
            const db = await getDb();
            await db.delete(DOCS_FILES_STORE_NAME, doc.id);
            await db.delete(DOCS_METADATA_STORE_NAME, doc.id);
            updateData(p => ({ ...p, documents: p.documents.filter(d => d.id !== doc.id) }));
            setDeletedIds(prev => ({...prev, documents: [...prev.documents, doc.id], documentPaths: [...prev.documentPaths, doc.storagePath]}));
        },
        addDocuments: async (caseId: string, files: FileList) => {
             const currentUser = userRef.current;
             if (!currentUser) throw new Error("يجب تسجيل الدخول لإضافة وثائق.");
             const ownerId = effectiveUserId || currentUser.id;
             const db = await getDb();
             const newDocs: CaseDocument[] = [];
             for (let i = 0; i < files.length; i++) {
                 const file = files[i];
                 const docId = `doc-${Date.now()}-${i}`;
                 const lastDot = file.name.lastIndexOf('.');
                 const extension = lastDot !== -1 ? file.name.substring(lastDot) : '';
                 const safeStoragePath = `${ownerId}/${caseId}/${docId}${extension}`;
                 const doc: CaseDocument = {
                     id: docId, caseId, userId: ownerId, name: file.name, type: file.type || 'application/octet-stream', size: file.size, addedAt: new Date(), storagePath: safeStoragePath, localState: 'pending_upload', updated_at: new Date(),
                 };
                 await db.put(DOCS_FILES_STORE_NAME, file, doc.id);
                 await db.put(DOCS_METADATA_STORE_NAME, doc, doc.id);
                 newDocs.push(doc);
             }
             updateData(p => ({...p, documents: [...p.documents, ...newDocs]}));
        },
        getDocumentFile: async (docId: string): Promise<File | null> => {
            const db = await getDb();
            const doc = data.documents.find(d => d.id === docId);
            if (!doc) return null;
            return await db.get(DOCS_FILES_STORE_NAME, docId);
        },
        postponeSession: (sessionId: string, newDate: Date, newReason: string) => {
            updateData(prev => ({
                ...prev,
                clients: prev.clients.map(cl => ({
                    ...cl,
                    cases: cl.cases.map(cs => ({
                        ...cs,
                        stages: cs.stages.map(st => {
                            const sessionIndex = st.sessions.findIndex(s => s.id === sessionId);
                            if (sessionIndex !== -1) {
                                const oldSession = st.sessions[sessionIndex];
                                const newSession: Session = { id: `session-${Date.now()}`, court: oldSession.court, caseNumber: oldSession.caseNumber, date: newDate, clientName: oldSession.clientName, opponentName: oldSession.opponentName, postponementReason: newReason, isPostponed: false, assignee: oldSession.assignee, updated_at: new Date(), user_id: oldSession.user_id };
                                const updatedOldSession: Session = { ...oldSession, isPostponed: true, nextSessionDate: newDate, nextPostponementReason: newReason, updated_at: new Date() };
                                const newSessions = [...st.sessions]; newSessions[sessionIndex] = updatedOldSession; newSessions.push(newSession);
                                return { ...st, sessions: newSessions, updated_at: new Date() };
                            }
                            return st;
                        })
                    }))
                }))
            }));
        }
    };
};
