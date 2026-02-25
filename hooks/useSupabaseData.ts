
import * as React from 'react';
import { Client, Session, AdminTask, Appointment, AccountingEntry, Case, Stage, Invoice, InvoiceItem, CaseDocument, AppData, DeletedIds, getInitialDeletedIds, Profile, SiteFinancialEntry, Permissions, defaultPermissions } from '../types.ts';
import { useOnlineStatus } from './useOnlineStatus.ts';
// Fix: Use `import type` for User and RealtimeChannel as they are used as types, not a value.
import type { User, RealtimeChannel } from '@supabase/supabase-js';
import { useSync, SyncStatus as SyncStatusType } from './useSync.ts';
import { getSupabaseClient } from '../supabaseClient.ts';
import { isBeforeToday, toInputDateString } from '../utils/dateUtils.ts';
import { RealtimeAlert } from '../components/RealtimeNotifier.tsx';
import { getDb, DATA_STORE_NAME, DOCS_FILES_STORE_NAME, DOCS_METADATA_STORE_NAME, LOCAL_EXCLUDED_DOCS_STORE_NAME } from '../utils/db.ts';
import { isNetworkError, fetchDataFromSupabase, fetchDeletionsFromSupabase, fetchWithRetry, getFriendlyErrorMessage, checkSupabaseSchema } from './useOnlineData.ts';

export const APP_DATA_KEY = 'lawyerBusinessManagementData';
export type SyncStatus = SyncStatusType;
const defaultAssistants = ['أحمد', 'فاطمة', 'سارة', 'بدون تخصيص'];

// --- User Settings Management ---
interface UserSettings {
    isAutoSyncEnabled: boolean;
    isAutoBackupEnabled: boolean;
    adminTasksLayout: 'horizontal' | 'vertical';
    locationOrder?: string[];
}

const defaultSettings: UserSettings = {
    isAutoSyncEnabled: true,
    isAutoBackupEnabled: true,
    adminTasksLayout: 'horizontal',
    locationOrder: [],
};

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

const validateAssistantsList = (list: any): string[] => {
    if (!Array.isArray(list)) return [...defaultAssistants];
    const uniqueAssistants = new Set(list.filter(item => typeof item === 'string' && item.trim() !== ''));
    uniqueAssistants.add('بدون تخصيص');
    return Array.from(uniqueAssistants);
};

const safeArray = <T, U>(arr: any, mapFn: (doc: any, index: number) => U | undefined): U[] => {
    if (!Array.isArray(arr)) return [];
    return arr.reduce((acc: U[], doc: any, index: number) => {
        if (!doc) return acc;
        try {
            const result = mapFn(doc, index);
            if (result !== undefined) acc.push(result);
        } catch (e) { console.error('Error processing item:', e); }
        return acc;
    }, []);
};

const reviveDate = (date: any): Date => {
    if (!date) return new Date();
    if (date instanceof Date) return date;
    const d = new Date(date);
    return isNaN(d.getTime()) ? new Date() : d;
};

/**
 * Robust helper for optional date fields. 
 * Correctly handles null, undefined, empty strings, and existing Date objects.
 */
const reviveOptionalDate = (date: any): Date | undefined => {
    if (date === null || date === undefined || date === '') return undefined;
    if (date instanceof Date) return date;
    const d = new Date(date);
    return isNaN(d.getTime()) ? undefined : d;
};

const validateDocuments = (doc: any, userId: string): CaseDocument | undefined => {
    if (!doc || typeof doc !== 'object' || !doc.id || !doc.name) return undefined;
    return {
        id: String(doc.id),
        caseId: String(doc.caseId || doc.case_id),
        userId: String(doc.userId || doc.user_id || userId),
        name: String(doc.name),
        type: String(doc.type || 'application/octet-stream'),
        size: Number(doc.size || 0),
        addedAt: reviveDate(doc.addedAt || doc.added_at),
        storagePath: String(doc.storagePath || doc.storage_path || ''),
        localState: doc.localState || 'pending_download', 
        updated_at: reviveDate(doc.updated_at),
    };
};

const validateAndFixData = (loadedData: any, user: User | null): AppData => {
    const userId = user?.id || '';
    if (!loadedData || typeof loadedData !== 'object') return getInitialData();
    const isValidObject = (item: any): item is Record<string, any> => item && typeof item === 'object' && !Array.isArray(item);
    
    return {
        clients: safeArray(loadedData.clients, (client) => {
             if (!isValidObject(client) || !client.id || !client.name) return undefined;
             const clientUserId = client.user_id;
             return {
                 id: String(client.id),
                 name: String(client.name),
                 contactInfo: String(client.contactInfo || client.contact_info || ''),
                 updated_at: reviveDate(client.updated_at),
                 user_id: clientUserId,
                 cases: safeArray(client.cases, (caseItem) => {
                     if (!isValidObject(caseItem) || !caseItem.id) return undefined;
                     return {
                         id: String(caseItem.id),
                         subject: String(caseItem.subject || ''),
                         clientName: String(caseItem.clientName || caseItem.client_name || client.name),
                         opponentName: String(caseItem.opponentName || caseItem.opponent_name || ''),
                         feeAgreement: String(caseItem.feeAgreement || caseItem.fee_agreement || ''),
                         status: ['active', 'closed', 'on_hold'].includes(caseItem.status) ? caseItem.status : 'active',
                         updated_at: reviveDate(caseItem.updated_at),
                         user_id: clientUserId,
                         stages: safeArray(caseItem.stages, (stage) => {
                             if (!isValidObject(stage) || !stage.id) return undefined;
                             return {
                                 id: String(stage.id),
                                 court: String(stage.court || ''),
                                 caseNumber: String(stage.caseNumber || stage.case_number || ''),
                                 firstSessionDate: reviveOptionalDate(stage.firstSessionDate || stage.first_session_date),
                                 decisionDate: reviveOptionalDate(stage.decisionDate || stage.decision_date),
                                 decisionNumber: String(stage.decisionNumber || stage.decision_number || ''),
                                 decisionSummary: String(stage.decisionSummary || stage.decision_summary || ''),
                                 decisionNotes: String(stage.decisionNotes || stage.decision_notes || ''),
                                 updated_at: reviveDate(stage.updated_at),
                                 user_id: clientUserId,
                                 sessions: safeArray(stage.sessions, (session) => {
                                     if (!isValidObject(session) || !session.id) return undefined;
                                     return {
                                         id: String(session.id),
                                         court: String(session.court || stage.court),
                                         caseNumber: String(session.caseNumber || session.case_number || stage.caseNumber),
                                         date: reviveDate(session.date),
                                         clientName: String(session.clientName || session.client_name || caseItem.clientName),
                                         opponentName: String(session.opponentName || session.opponent_name || caseItem.opponentName),
                                         postponementReason: session.postponementReason || session.postponement_reason,
                                         nextPostponementReason: session.nextPostponementReason || session.next_postponement_reason,
                                         isPostponed: !!session.isPostponed || !!session.is_postponed,
                                         nextSessionDate: reviveOptionalDate(session.nextSessionDate || session.next_session_date),
                                         assignee: session.assignee,
                                         stageId: session.stageId || session.stage_id || stage.id,
                                         stageDecisionDate: reviveOptionalDate(session.stageDecisionDate || session.stage_decision_date),
                                         updated_at: reviveDate(session.updated_at),
                                         user_id: clientUserId,
                                     };
                                 }),
                             };
                         }),
                     };
                 }),
             };
        }),
        adminTasks: safeArray(loadedData.adminTasks || loadedData.admin_tasks, (task, index) => {
            if (!isValidObject(task) || !task.id) return undefined;
            return {
                id: String(task.id),
                task: String(task.task || ''),
                dueDate: reviveDate(task.dueDate || task.due_date),
                completed: !!task.completed,
                importance: ['normal', 'important', 'urgent'].includes(task.importance) ? task.importance : 'normal',
                assignee: task.assignee,
                location: task.location,
                updated_at: reviveDate(task.updated_at),
                orderIndex: typeof (task.orderIndex || task.order_index) === 'number' ? (task.orderIndex || task.order_index) : index,
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
                reminderTimeInMinutes: Number(apt.reminderTimeInMinutes || apt.reminder_time_in_minutes || 15),
                assignee: apt.assignee,
                updated_at: reviveDate(apt.updated_at),
            };
        }),
        accountingEntries: safeArray(loadedData.accountingEntries || loadedData.accounting_entries, (entry) => {
            if (!isValidObject(entry) || !entry.id) return undefined;
            return {
                id: String(entry.id),
                type: ['income', 'expense'].includes(entry.type) ? entry.type : 'income',
                amount: Number(entry.amount || 0),
                date: reviveDate(entry.date),
                description: String(entry.description || ''),
                clientId: String(entry.clientId || entry.client_id || ''),
                caseId: String(entry.caseId || entry.case_id || ''),
                clientName: String(entry.clientName || entry.client_name || ''),
                updated_at: reviveDate(entry.updated_at),
            };
        }),
        invoices: safeArray(loadedData.invoices, (invoice) => {
            if (!isValidObject(invoice) || !invoice.id) return undefined;
            return {
                id: String(invoice.id),
                clientId: String(invoice.clientId || invoice.client_id || ''),
                clientName: String(invoice.clientName || invoice.client_name || ''),
                caseId: invoice.caseId || invoice.case_id,
                caseSubject: invoice.caseSubject || invoice.case_subject,
                issueDate: reviveDate(invoice.issueDate || invoice.issue_date),
                dueDate: reviveDate(invoice.dueDate || invoice.due_date),
                items: safeArray(invoice.items, (item) => {
                    if (!isValidObject(item) || !item.id) return undefined;
                    return {
                        id: String(item.id),
                        description: String(item.description || ''),
                        amount: Number(item.amount || 0),
                        updated_at: reviveDate(item.updated_at),
                    };
                }),
                taxRate: Number(invoice.taxRate || invoice.tax_rate || 0),
                discount: Number(invoice.discount || 0),
                status: ['draft', 'sent', 'paid', 'overdue'].includes(invoice.status) ? invoice.status : 'draft',
                notes: invoice.notes,
                updated_at: reviveDate(invoice.updated_at),
            };
        }),
        assistants: validateAssistantsList(loadedData.assistants),
        documents: safeArray(loadedData.documents || loadedData.case_documents, (doc) => validateDocuments(doc, userId)),
        profiles: safeArray(loadedData.profiles, (p) => {
            if (!isValidObject(p) || !p.id) return undefined;
            return {
                id: String(p.id),
                full_name: String(p.full_name || ''),
                mobile_number: String(p.mobile_number || ''),
                is_approved: !!p.is_approved,
                is_active: p.is_active !== false,
                mobile_verified: !!p.mobile_verified,
                otp_code: p.otp_code,
                otp_expires_at: p.otp_expires_at,
                subscription_start_date: p.subscription_start_date || null,
                subscription_end_date: p.subscription_end_date || null,
                role: ['user', 'admin'].includes(p.role) ? p.role : 'user',
                lawyer_id: p.lawyer_id || null, 
                permissions: p.permissions || undefined, 
                created_at: p.created_at,
                updated_at: reviveDate(p.updated_at),
            };
        }),
        siteFinances: safeArray(loadedData.siteFinances || loadedData.site_finances, (sf) => {
            if (!isValidObject(sf) || !sf.id) return undefined;
            return {
                id: Number(sf.id),
                user_id: sf.user_id || null,
                type: ['income', 'expense'].includes(sf.type) ? sf.type : 'income',
                payment_date: String(sf.payment_date || ''),
                amount: Number(sf.amount || 0),
                description: sf.description || null,
                payment_method: sf.payment_method || null,
                category: sf.category,
                profile_full_name: sf.profile_full_name,
                updated_at: reviveDate(sf.updated_at),
            };
        }),
    };
};

export const useSupabaseData = (user: User | null, isAuthLoading: boolean) => {
    const [data, setData] = React.useState<AppData>(getInitialData);
    const [deletedIds, setDeletedIds] = React.useState<DeletedIds>(getInitialDeletedIds);
    const [excludedDocIds, setExcludedDocIds] = React.useState<Set<string>>(new Set());
    const [isDirty, setDirty] = React.useState(false);
    const [syncStatus, setSyncStatus] = React.useState<SyncStatus>('loading');
    const [lastSyncError, setLastSyncError] = React.useState<string | null>(null);
    const [lastSyncedAt, setLastSyncedAt] = React.useState<Date | null>(null);
    const [lastSyncAttemptAt, setLastSyncAttemptAt] = React.useState<Date | null>(null);
    const [isDataLoading, setIsDataLoading] = React.useState(true);
    const [triggeredAlerts, setTriggeredAlerts] = React.useState<Appointment[]>([]);
    const [showUnpostponedSessionsModal, setShowUnpostponedSessionsModal] = React.useState(false);
    const [realtimeAlerts, setRealtimeAlerts] = React.useState<RealtimeAlert[]>([]);
    const [userApprovalAlerts, setUserApprovalAlerts] = React.useState<RealtimeAlert[]>([]);
    const [userSettings, setUserSettings] = React.useState<any>({ isAutoSyncEnabled: true, isAutoBackupEnabled: true, adminTasksLayout: 'horizontal', locationOrder: [] });
    const isOnline = useOnlineStatus();
    
    const userRef = React.useRef(user);
    userRef.current = user;
    const syncStatusRef = React.useRef<SyncStatus>(syncStatus);
    syncStatusRef.current = syncStatus;
    const isSyncingRef = React.useRef(false);
    const pendingSyncRef = React.useRef(false);
    const downloadQueueRef = React.useRef<Promise<void>>(Promise.resolve());
    const supabaseClientRef = React.useRef<Awaited<ReturnType<typeof getSupabaseClient>> | null>(null);

    // --- EFFECTIVE USER ID LOGIC ---
    // Initialize Supabase client once
    React.useEffect(() => {
        const initSupabaseClient = async () => {
            const client = await getSupabaseClient();
            supabaseClientRef.current = client;
        };
        initSupabaseClient();
    }, [user?.id]);

    const effectiveUserId = React.useMemo(() => {
        if (!user) return null;
        
        // 1. Check profiles in data state (most up-to-date)
        const currentUserProfile = data.profiles.find(p => p.id === user.id);
        if (currentUserProfile && currentUserProfile.lawyer_id) {
            return currentUserProfile.lawyer_id;
        }

        // 2. Check localStorage (fallback for initial load)
        const cachedOwnerId = localStorage.getItem(`lawyer_app_owner_id_${user.id}`);
        if (cachedOwnerId) return cachedOwnerId;

        return user.id;
    }, [user, data.profiles]);

    const effectiveUserIdRef = React.useRef(effectiveUserId);
    effectiveUserIdRef.current = effectiveUserId;

    React.useEffect(() => {
        console.log("useSupabaseData: isDirty changed:", isDirty);
    }, [isDirty]);

    React.useEffect(() => {
        console.log("useSupabaseData: effectiveUserId changed:", effectiveUserId);
    }, [effectiveUserId]);

    const currentUserPermissions: Permissions = React.useMemo(() => {
        if (!user) return defaultPermissions;
        const currentUserProfile = data.profiles.find(p => p.id === user.id);
        if (currentUserProfile && currentUserProfile.lawyer_id) {
            return { ...defaultPermissions, ...currentUserProfile.permissions };
        }
        return {
            can_view_agenda: true,
            can_view_clients: true,
            can_add_client: true,
            can_edit_client: true,
            can_delete_client: true,
            can_view_cases: true,
            can_add_case: true,
            can_edit_case: true,
            can_delete_case: true,
            can_view_sessions: true,
            can_add_session: true,
            can_edit_session: true,
            can_delete_session: true,
            can_postpone_session: true,
            can_decide_session: true,
            can_view_documents: true,
            can_add_document: true,
            can_delete_document: true,
            can_view_finance: true,
            can_add_financial_entry: true,
            can_delete_financial_entry: true,
            can_manage_invoices: true,
            can_view_admin_tasks: true,
            can_add_admin_task: true,
            can_edit_admin_task: true,
            can_delete_admin_task: true,
            can_view_reports: true,
        };
    }, [user, data.profiles]);

    const updateData = React.useCallback((updater: React.SetStateAction<AppData>, options: { markDirty?: boolean } = { markDirty: true }) => {
        if (!userRef.current || !effectiveUserId) return;
        
        setData(currentData => {
            const newData = typeof updater === 'function' ? (updater as (prevState: AppData) => AppData)(currentData) : updater;
            getDb().then(db => {
                db.put(DATA_STORE_NAME, newData, effectiveUserId);
            }).catch(e => console.error("Failed to write to IDB", e));
            if (options.markDirty) {
                setDirty(true);
            }
            return newData;
        });
    }, [effectiveUserId]); 

    const setFullData = React.useCallback(async (newData: any) => {
        const validated = validateAndFixData(newData, userRef.current);
        updateData(validated);
    }, [updateData]);

    React.useEffect(() => {
        const settingsKey = `userSettings_${user?.id}`;
        try {
            const storedSettings = localStorage.getItem(settingsKey);
            if (storedSettings) {
                setUserSettings(JSON.parse(storedSettings));
            }
        } catch (e) {
            console.error("Failed to load user settings from localStorage", e);
        }
    }, [user?.id]);

    const updateSettings = (updater: (prev: any) => any) => {
        const newSettings = updater(userSettings);
        setUserSettings(newSettings);
        const settingsKey = `userSettings_${user?.id}`;
        localStorage.setItem(settingsKey, JSON.stringify(newSettings));
    };

    const downloadMissingFiles = React.useCallback(async (documents: CaseDocument[]) => {
        const pendingDocs = documents.filter(d => d.localState === 'pending_download');
        if (pendingDocs.length === 0) return;

        downloadQueueRef.current = downloadQueueRef.current.then(async () => {
            const supabase = supabaseClientRef.current;
            if (!supabase) return;
            const db = await getDb();

            for (const doc of pendingDocs) {
                if (typeof navigator !== 'undefined' && !navigator.onLine) {
                    console.log("Device is offline, pausing downloads.");
                    break;
                }

                try {
                    const existingFile = await db.get(DOCS_FILES_STORE_NAME, doc.id);
                    if (existingFile) {
                        const updatedDoc = { ...doc, localState: 'synced' as const };
                        await db.put(DOCS_METADATA_STORE_NAME, updatedDoc, doc.id);
                        updateData(prev => ({...prev, documents: prev.documents.map(d => d.id === doc.id ? updatedDoc : d)}), { markDirty: false });
                        continue;
                    }

                    if (!doc.storagePath) {
                        throw new Error(`Missing storage path for doc ${doc.id}`);
                    }

                    const downloadingDoc = { ...doc, localState: 'downloading' as const };
                    await db.put(DOCS_METADATA_STORE_NAME, downloadingDoc, doc.id);
                    updateData(prev => ({...prev, documents: prev.documents.map(d => d.id === doc.id ? downloadingDoc : d)}), { markDirty: false });
                    
                    const { data: blob, error } = await fetchWithRetry(() => supabase.storage.from('documents').download(doc.storagePath!));
                    
                    if (error) throw error;
                    if (!blob) throw new Error("Downloaded blob is empty");

                    const file = new File([blob], doc.name, { type: doc.type });
                    await db.put(DOCS_FILES_STORE_NAME, file, doc.id);
                    
                    const completedDoc = { ...doc, localState: 'synced' as const };
                    await db.put(DOCS_METADATA_STORE_NAME, completedDoc, doc.id);
                    
                    updateData(prev => ({...prev, documents: prev.documents.map(d => d.id === doc.id ? completedDoc : d)}), { markDirty: false });

                } catch (e: any) {
                    let errorMsg = 'Unknown error';
                    try {
                        if (typeof e === 'string') {
                            errorMsg = e;
                        } else if (e instanceof Error) {
                            errorMsg = e.message;
                        } else {
                            const possibleMsg = (e as any)?.message || (e as any)?.error_description || (e as any)?.statusText;
                            if (possibleMsg) {
                                errorMsg = possibleMsg;
                            } else {
                                const json = JSON.stringify(e);
                                if (json && json !== '{}') errorMsg = json;
                                else errorMsg = String(e);
                            }
                        }
                    } catch {
                        errorMsg = String(e);
                    }
                    
                    if (!isNetworkError(e)) {
                        console.error(`Failed to auto-download doc ${doc.id}:`, errorMsg);
                    } else {
                        console.warn(`Failed to auto-download doc ${doc.id} due to network error (offline).`);
                    }

                    if (isNetworkError(e)) {
                        console.warn(`Network error for doc ${doc.id}, keeping as pending_download for retry.`);
                        const pendingDoc = { ...doc, localState: 'pending_download' as const };
                        await db.put(DOCS_METADATA_STORE_NAME, pendingDoc, doc.id);
                        updateData(prev => ({...prev, documents: prev.documents.map(d => d.id === doc.id ? pendingDoc : d)}), { markDirty: false });
                    } else {
                        const errorDoc = { ...doc, localState: 'error' as const };
                        await db.put(DOCS_METADATA_STORE_NAME, errorDoc, doc.id);
                        updateData(prev => ({...prev, documents: prev.documents.map(d => d.id === doc.id ? errorDoc : d)}), { markDirty: false });
                    }
                }
            }
        });
    }, [updateData]);

    React.useEffect(() => {
        if (isAuthLoading) return;
        
        let cancelled = false;

        const loadData = async () => {
            setIsDataLoading(true);
            try {
                const supabase = supabaseClientRef.current;
                const isOnlineNow = typeof navigator !== 'undefined' ? navigator.onLine : true;
                
                if (isOnlineNow && supabase) {
                    const schemaCheck = await fetchWithRetry(() => checkSupabaseSchema());
                    if (!schemaCheck.success && schemaCheck.message.includes('إعداد')) {
                        setSyncStatus('unconfigured');
                        setIsDataLoading(false);
                        return;
                    }
                }

                if (!user) {
                    setSyncStatus('synced');
                    setIsDataLoading(false);
                    return;
                }

                let ownerId = user.id;
                const cachedOwnerId = localStorage.getItem(`lawyer_app_owner_id_${user.id}`);
                if (cachedOwnerId) {
                    ownerId = cachedOwnerId;
                }

                let fetchedProfileData: any = null;

                if (isOnlineNow && supabase) {
                    try {
                        const res: any = await fetchWithRetry(async () => 
                            await supabase!.from('profiles').select('*').eq('id', user!.id).maybeSingle()
                        );
                        fetchedProfileData = res?.data;

                        if (fetchedProfileData && fetchedProfileData.lawyer_id) {
                            ownerId = fetchedProfileData.lawyer_id;
                            localStorage.setItem(`lawyer_app_owner_id_${user.id}`, ownerId);
                        } else if (fetchedProfileData) {
                            ownerId = user.id;
                            localStorage.setItem(`lawyer_app_owner_id_${user.id}`, ownerId);
                        }
                    } catch (profileFetchErr) {
                        console.warn("Failed to fetch profile owner ID on startup (shaky network), using cached/fallback:", profileFetchErr);
                    }
                }

                const db = await getDb();
                const [storedData, storedDeletedIds, localDocsMetadata, storedExcludedDocs] = await Promise.all([
                    db.get(DATA_STORE_NAME, ownerId),
                    db.get(DATA_STORE_NAME, `deletedIds_${ownerId}`),
                    db.getAll(DOCS_METADATA_STORE_NAME),
                    db.getAll(LOCAL_EXCLUDED_DOCS_STORE_NAME)
                ]);
                
                if (cancelled) return;

                const excludedIdsSet = new Set<string>((storedExcludedDocs || []).map((d: any) => d.id));
                setExcludedDocIds(excludedIdsSet);

                const validatedData = validateAndFixData(storedData, user);

                // Merge fetched profile data to ensure effectiveUserId is correct immediately
                if (fetchedProfileData) {
                    const existingProfileIndex = validatedData.profiles.findIndex(p => p.id === user.id);
                    const newProfile = {
                        id: String(fetchedProfileData.id),
                        full_name: String(fetchedProfileData.full_name || ''),
                        mobile_number: String(fetchedProfileData.mobile_number || ''),
                        is_approved: !!fetchedProfileData.is_approved,
                        is_active: fetchedProfileData.is_active !== false,
                        mobile_verified: !!fetchedProfileData.mobile_verified,
                        otp_code: fetchedProfileData.otp_code,
                        otp_expires_at: fetchedProfileData.otp_expires_at,
                        subscription_start_date: fetchedProfileData.subscription_start_date || null,
                        subscription_end_date: fetchedProfileData.subscription_end_date || null,
                        role: ['user', 'admin'].includes(fetchedProfileData.role) ? fetchedProfileData.role : 'user',
                        lawyer_id: fetchedProfileData.lawyer_id || null, 
                        permissions: fetchedProfileData.permissions || undefined, 
                        created_at: fetchedProfileData.created_at,
                        updated_at: reviveDate(fetchedProfileData.updated_at),
                    };

                    if (existingProfileIndex >= 0) {
                        validatedData.profiles[existingProfileIndex] = { ...validatedData.profiles[existingProfileIndex], ...newProfile };
                    } else {
                        validatedData.profiles.push(newProfile as Profile);
                    }
                }
                const localDocsMetadataMap = new Map((localDocsMetadata as any[]).map((meta: any) => [meta.id, meta]));
                const finalDocs = validatedData.documents.map(doc => {
                    if (excludedIdsSet.has(doc.id)) return null;
                    const localMeta: any = localDocsMetadataMap.get(doc.id);
                    return { ...doc, localState: localMeta?.localState || doc.localState || 'pending_download' };
                }).filter(doc => !!doc) as CaseDocument[];
                
                const finalData = { ...validatedData, documents: finalDocs };
                
                setData(finalData);
                setDeletedIds(storedDeletedIds || getInitialDeletedIds());
                
                // Initial background sync
                if (isOnlineNow) {
                    manualSync().catch(err => {
                        if (!isNetworkError(err)) console.error("Initial sync failed:", err);
                    });
                    downloadMissingFiles(finalDocs);
                } else {
                    setSyncStatus('synced');
                }
            } catch (error) {
                if (!isNetworkError(error)) {
                    console.error('Failed to load data:', error);
                } else {
                    console.warn("Failed to load data due to network error (offline).");
                }
                setSyncStatus('error');
                const errorMsg = getFriendlyErrorMessage(error, 'فشل تحميل البيانات.');
                setLastSyncError(errorMsg);
            } finally {
                if (!cancelled) setIsDataLoading(false);
            }
        };
        loadData();
        return () => { cancelled = true; };
    }, [user?.id, isAuthLoading]); 

    const handleSyncStatusChange = React.useCallback((status: SyncStatus, error: string | null) => {
        setSyncStatus(status);
        setLastSyncError(error);
    }, []);

    const handleDataSynced = React.useCallback(async (mergedData: AppData) => {
        if (!effectiveUserId) return;
        try {
            const validatedMergedData = validateAndFixData(mergedData, userRef.current);
            const db = await getDb();
            let localDocsMetadata: any[] = [];
            try {
                localDocsMetadata = await db.getAll(DOCS_METADATA_STORE_NAME) || [];
            } catch (e) {
                console.warn("Failed to get local docs metadata, proceeding with empty list:", e);
            }
            
            const currentExcluded = await db.getAll(LOCAL_EXCLUDED_DOCS_STORE_NAME).catch(() => []);
            const excludedIds = new Set(currentExcluded.map((e: any) => e.id));

            const finalDocs = safeArray(validatedMergedData.documents, (doc: any) => {
                if (!doc || typeof doc !== 'object' || !doc.id) return undefined;
                if (excludedIds.has(doc.id)) return undefined; 

                const localMeta = Array.isArray(localDocsMetadata) ? localDocsMetadata.find((meta: any) => meta.id === doc.id) : undefined;
                const mergedDoc = {
                    ...doc,
                    localState: localMeta?.localState || doc.localState || 'pending_download'
                };
                return validateDocuments(mergedDoc, userRef.current?.id || '');
            });

            const finalData = { ...validatedMergedData, documents: finalDocs };

            try {
                await db.put(DATA_STORE_NAME, finalData, effectiveUserId);
            } catch (dbError: any) {
                console.error("Failed to save data to IndexedDB:", dbError);
                throw new Error(`فشل حفظ البيانات محلياً: ${dbError.message || dbError.name}`);
            }

            setData(finalData);
            setDirty(false);
            
            if (isOnline) {
                downloadMissingFiles(finalDocs);
            }

        } catch (e: any) {
            if (!isNetworkError(e)) {
                console.error("Critical error in handleDataSynced:", e);
            } else {
                console.warn("handleDataSynced failed due to network error (offline).");
            }
            throw e; // Re-throw to be caught by manualSync
        }
    }, [userRef, effectiveUserId, handleSyncStatusChange, isOnline, downloadMissingFiles]);
    
    const handleDeletionsSynced = React.useCallback(async (syncedDeletions: Partial<DeletedIds>) => {
        if (!effectiveUserId) return;
        const newDeletedIds = { ...deletedIds };
        let changed = false;
        for (const key of Object.keys(syncedDeletions) as Array<keyof DeletedIds>) {
            const synced = new Set((syncedDeletions[key] || []) as any[]);
            if (synced.size > 0) {
                newDeletedIds[key] = newDeletedIds[key].filter(id => !synced.has(id as any));
                changed = true;
            }
        }
        if (changed) {
            setDeletedIds(newDeletedIds);
            const db = await getDb();
            await db.put(DATA_STORE_NAME, newDeletedIds, `deletedIds_${effectiveUserId}`).catch(() => {});
        }
    }, [deletedIds, effectiveUserId]);

    const handleDocumentsUploaded = React.useCallback(async (uploadedIds: string[]) => {
        try {
            const db = await getDb();
            const tx = db.transaction(DOCS_METADATA_STORE_NAME, 'readwrite');
            const store = tx.objectStore(DOCS_METADATA_STORE_NAME);
            for (const id of uploadedIds) {
                const doc = await store.get(id);
                if (doc) {
                    doc.localState = 'synced';
                    await store.put(doc, id);
                }
            }
            await tx.done;

            updateData(prev => ({ 
                ...prev, 
                documents: prev.documents.map(d => uploadedIds.includes(d.id) ? { ...d, localState: 'synced' as const } : d) 
            }), { markDirty: false });
        } catch (e) {
            console.error("Failed to update uploaded docs in IDB", e);
        }
    }, [updateData]);

    const { manualSync: originalManualSync, fetchAndRefresh } = useSync({
        user: userRef.current, // Real User
        effectiveUserId, // Owner
        localData: data, 
        deletedIds,
        onDataSynced: handleDataSynced,
        onDeletionsSynced: handleDeletionsSynced,
        onSyncStatusChange: (status, error) => {
            handleSyncStatusChange(status, error);
            if (status === 'syncing') {
                isSyncingRef.current = true;
            } else if (status === 'synced') {
                isSyncingRef.current = false;
                setLastSyncedAt(new Date());
                if (pendingSyncRef.current) {
                    pendingSyncRef.current = false;
                    console.log("Executing pending sync...");
                    manualSync();
                }
            } else if (status === 'error') {
                isSyncingRef.current = false;
                if (pendingSyncRef.current) {
                    pendingSyncRef.current = false;
                    console.log("Executing pending sync...");
                    manualSync();
                }
            }
        },
        onDocumentsUploaded: handleDocumentsUploaded, 
        excludedDocIds, 
        isOnline, isAuthLoading, syncStatus
    });

    const manualSync = React.useCallback(async () => {
        if (isSyncingRef.current) {
            console.log("Sync already in progress, queuing next sync...");
            pendingSyncRef.current = true;
            return;
        }
        setLastSyncAttemptAt(new Date());
        return originalManualSync();
    }, [originalManualSync]);

    // --- BACKGROUND SYNC LOOP ---
    // This effect ensures that any local changes (isDirty) are synced to the cloud when online.
    React.useEffect(() => {
        if (!isOnline || isSyncingRef.current || !isDirty || !user || !effectiveUserId || !userSettings.isAutoSyncEnabled) return;

        // Debounce sync to avoid too many requests during rapid edits
        const timer = setTimeout(() => {
            console.log("Background sync triggered by local changes (isDirty).");
            manualSync();
        }, 3000);

        return () => clearTimeout(timer);
    }, [isDirty, isOnline, user?.id, effectiveUserId, manualSync, userSettings.isAutoSyncEnabled]);

    // Periodic sync check (every 2 minutes) even if not dirty, to catch missed realtime updates
    React.useEffect(() => {
        const interval = setInterval(() => {
            if (isOnline && !isSyncingRef.current && user && effectiveUserId && userSettings.isAutoSyncEnabled) {
                console.log("Periodic background sync check.");
                manualSync();
            }
        }, 2 * 60 * 1000);

        // Sync when window regains focus
        const handleFocus = () => {
            if (isOnline && !isSyncingRef.current && user && effectiveUserId && userSettings.isAutoSyncEnabled) {
                console.log("Window focused, triggering sync...");
                manualSync();
            }
        };
        window.addEventListener('focus', handleFocus);

        return () => {
            clearInterval(interval);
            window.removeEventListener('focus', handleFocus);
        };
    }, [isOnline, user?.id, effectiveUserId, manualSync, userSettings.isAutoSyncEnabled]);

    const addRealtimeAlert = React.useCallback((message: string, type: 'sync' | 'userApproval' = 'sync') => {
        setRealtimeAlerts((prev: any[]) => [...prev, { id: Date.now(), message, type }]);
    }, []);

    // --- REALTIME SUBSCRIPTION ---
    React.useEffect(() => {
        let channel: any = null;
        
        const setupRealtime = async () => {
            const supabase = supabaseClientRef.current;
            if (!supabase || !user || !effectiveUserId || !isOnline) return;

            console.log('Subscribing to realtime updates for office:', effectiveUserId);

            channel = supabase
                .channel(`office-updates-${effectiveUserId}`)
                .on(
                    'postgres_changes',
                    {
                        event: '*',
                        schema: 'public',
                    },
                    (payload: any) => {
                        // Only trigger sync if the change belongs to our office
                        const record = payload.new as any || payload.old as any;
                        if (!record) return;

                        let shouldSync = false;
                        const currentOwnerId = effectiveUserIdRef.current;

                        if (payload.table === 'profiles') {
                             // Sync if the profile is ME, or the profile belongs to my OFFICE (lawyer_id == currentOwnerId), or the profile IS the lawyer (id == currentOwnerId)
                             if (record.id === user.id || record.lawyer_id === currentOwnerId || record.id === currentOwnerId) {
                                 shouldSync = true;
                             }
                        } else {
                             // For other tables, check user_id
                             if (record.user_id === currentOwnerId) {
                                 shouldSync = true;
                             }
                        }
                        
                        if (shouldSync) {
                            console.log('Realtime update detected for office:', payload.table, payload.eventType);
                            
                            // Show a notification for remote updates
                            const tableNamesAr: Record<string, string> = {
                                'clients': 'الموكلين',
                                'cases': 'القضايا',
                                'stages': 'مراحل القضايا',
                                'sessions': 'الجلسات',
                                'admin_tasks': 'المهام الإدارية',
                                'appointments': 'المواعيد',
                                'accounting_entries': 'القيود المحاسبية',
                                'invoices': 'الفواتير',
                                'case_documents': 'المستندات',
                                'profiles': 'الملفات الشخصية',
                                'assistants': 'المساعدين'
                            };

                            const eventTypesAr: Record<string, string> = {
                                'INSERT': 'إضافة',
                                'UPDATE': 'تعديل',
                                'DELETE': 'حذف'
                            };

                            const tableName = tableNamesAr[payload.table] || payload.table;
                            const eventType = eventTypesAr[payload.eventType] || payload.eventType;
                            
                            addRealtimeAlert(`تم ${eventType} في ${tableName} من قبل مستخدم آخر. جاري المزامنة...`);
                            manualSync();
                        }
                    }
                )
                .subscribe((status: string) => {
                    if (status === 'SUBSCRIBED') {
                        console.log('Successfully subscribed to realtime office updates');
                    }
                });
        };

        setupRealtime();

        return () => {
            if (channel) {
                const supabase = supabaseClientRef.current;
                if (supabase && channel) supabase.removeChannel(channel);
            }
        };
    }, [user, effectiveUserId, isOnline, manualSync, addRealtimeAlert]);

    const createDeleteFunction = <T extends keyof DeletedIds>(entity: T) => async (id: DeletedIds[T][number]) => {
        if (!effectiveUserId) return;
        const db = await getDb();
        const newDeletedIds = { ...deletedIds, [entity]: [...deletedIds[entity], id] };
        setDeletedIds(newDeletedIds);
        await db.put(DATA_STORE_NAME, newDeletedIds, `deletedIds_${effectiveUserId}`).catch(() => {});
        setDirty(true);
    };

    return {
        ...data,
        setClients: (updater: (prev: Client[]) => Client[]) => updateData((prev: AppData) => ({ ...prev, clients: updater(prev.clients).map((c: Client) => ({ ...c, updated_at: new Date() })) })),
        setAdminTasks: (updater: (prev: AdminTask[]) => AdminTask[]) => updateData((prev: AppData) => ({ ...prev, adminTasks: updater(prev.adminTasks).map((t: AdminTask) => ({ ...t, updated_at: new Date() })) })),
        setAppointments: (updater: (prev: Appointment[]) => Appointment[]) => updateData((prev: AppData) => ({ ...prev, appointments: updater(prev.appointments).map((a: Appointment) => ({ ...a, updated_at: new Date() })) })),
        setAccountingEntries: (updater: (prev: AccountingEntry[]) => AccountingEntry[]) => updateData((prev: AppData) => ({ ...prev, accountingEntries: updater(prev.accountingEntries).map((e: AccountingEntry) => ({ ...e, updated_at: new Date() })) })),
        setInvoices: (updater: (prev: Invoice[]) => Invoice[]) => updateData((prev: AppData) => ({ ...prev, invoices: updater(prev.invoices).map((i: Invoice) => ({ ...i, updated_at: new Date() })) })),
        setAssistants: (updater: (prev: string[]) => string[]) => updateData((prev: AppData) => ({ ...prev, assistants: updater(prev.assistants) })),
        setDocuments: (updater: (prev: CaseDocument[]) => CaseDocument[]) => updateData((prev: AppData) => ({ ...prev, documents: updater(prev.documents).map((d: CaseDocument) => ({ ...d, updated_at: new Date() })) })),
        setProfiles: (updater: (prev: Profile[]) => Profile[]) => updateData((prev: AppData) => ({ ...prev, profiles: updater(prev.profiles).map((p: Profile) => ({ ...p, updated_at: new Date() })) })),
        setSiteFinances: (updater: (prev: SiteFinancialEntry[]) => SiteFinancialEntry[]) => updateData((prev: AppData) => ({ ...prev, siteFinances: updater(prev.siteFinances).map((f: SiteFinancialEntry) => ({ ...f, updated_at: new Date() })) })),
        lastSyncedAt,
        setFullData,
        allSessions: React.useMemo(() => data.clients.flatMap(c => c.cases.flatMap(cs => cs.stages.flatMap(st => st.sessions.map(s => ({...s, stageId: st.id, stageDecisionDate: st.decisionDate}))))), [data.clients]),
        unpostponedSessions: React.useMemo(() => {
            const today = new Date();
            today.setHours(0, 0, 0, 0);

            return data.clients.flatMap(c => 
                c.cases.flatMap(cs => 
                    cs.stages.flatMap(st => {
                        if (st.decisionDate) return [];
                        return st.sessions
                            .filter(s => !s.isPostponed && isBeforeToday(s.date))
                            .filter(s => {
                                const hasLaterSession = st.sessions.some(otherS => 
                                    new Date(otherS.date).getTime() > new Date(s.date).getTime()
                                );
                                return !hasLaterSession;
                            })
                            .map(s => ({
                                ...s, 
                                stageId: st.id, 
                                stageDecisionDate: st.decisionDate
                            }));
                    })
                )
            );
        }, [data.clients]),
        syncStatus, setSyncStatus, manualSync, lastSyncError, isDirty, userId: user?.id, effectiveUserId, isDataLoading,
        permissions: currentUserPermissions,
        isAutoSyncEnabled: userSettings.isAutoSyncEnabled, setAutoSyncEnabled: (v: boolean) => updateSettings(p => ({...p, isAutoSyncEnabled: v})),
        isAutoBackupEnabled: userSettings.isAutoBackupEnabled, setAutoBackupEnabled: (v: boolean) => updateSettings(p => ({...p, isAutoBackupEnabled: v})),
        adminTasksLayout: userSettings.adminTasksLayout, setAdminTasksLayout: (v: any) => updateSettings(p => ({...p, adminTasksLayout: v})),
        locationOrder: userSettings.locationOrder, setLocationOrder: (v: any) => updateSettings(p => ({...p, locationOrder: v})),
        exportData: React.useCallback(() => {
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
        }, [data]),
        triggeredAlerts, dismissAlert: (id: string) => setTriggeredAlerts(p => p.filter(a => a.id !== id)),
        realtimeAlerts, dismissRealtimeAlert: (id: number) => setRealtimeAlerts(p => p.filter(a => a.id !== id)),
        addRealtimeAlert,
        userApprovalAlerts, dismissUserApprovalAlert: (id: number) => setUserApprovalAlerts(p => p.filter(a => a.id !== id)),
        showUnpostponedSessionsModal, setShowUnpostponedSessionsModal,
        fetchAndRefresh,
        deleteClient: (id: string) => { updateData(p => ({ ...p, clients: p.clients.filter(c => c.id !== id) })); createDeleteFunction('clients')(id); },
        deleteCase: async (caseId: string, clientId: string) => {
            const docsToDelete = data.documents.filter(doc => doc.caseId === caseId);
            const docIdsToDelete = docsToDelete.map(doc => doc.id);
            const docPathsToDelete = docsToDelete.map(doc => doc.storagePath).filter(Boolean);
            
            updateData(p => {
                const updatedClients = p.clients.map(c => c.id === clientId ? { ...c, updated_at: new Date(), cases: c.cases.filter(cs => cs.id !== caseId) } : c);
                return { ...p, clients: updatedClients, documents: p.documents.filter(doc => doc.caseId !== caseId) };
            });
            
            if (effectiveUserId) {
                const db = await getDb();
                const newDeletedIds = { 
                    ...deletedIds, 
                    cases: [...deletedIds.cases, caseId], 
                    documents: [...deletedIds.documents, ...docIdsToDelete], 
                    documentPaths: [...deletedIds.documentPaths, ...docPathsToDelete] 
                };
                setDeletedIds(newDeletedIds);
                await db.put(DATA_STORE_NAME, newDeletedIds, `deletedIds_${effectiveUserId}`).catch(() => {});
                setDirty(true);
            }
        },
        deleteStage: (sid: string, cid: string, clid: string) => { 
            updateData(p => ({ 
                ...p, 
                clients: p.clients.map(c => c.id === clid ? { 
                    ...c, 
                    updated_at: new Date(),
                    cases: c.cases.map(cs => cs.id === cid ? { 
                        ...cs, 
                        updated_at: new Date(),
                        stages: cs.stages.filter(st => st.id !== sid) 
                    } : cs) 
                } : c) 
            })); 
            createDeleteFunction('stages')(sid); 
        },
        deleteSession: (sessId: string, stId: string, cid: string, clid: string) => { 
            updateData(p => ({ 
                ...p, 
                clients: p.clients.map(c => c.id === clid ? { 
                    ...c, 
                    updated_at: new Date(),
                    cases: c.cases.map(cs => cs.id === cid ? { 
                        ...cs, 
                        updated_at: new Date(),
                        stages: cs.stages.map(st => st.id === stId ? { 
                            ...st, 
                            updated_at: new Date(),
                            sessions: st.sessions.filter(s => s.id !== sessId) 
                        } : st) 
                    } : cs) 
                } : c) 
            })); 
            createDeleteFunction('sessions')(sessId); 
        },
        deleteAdminTask: (id: string) => { updateData(p => ({...p, adminTasks: p.adminTasks.filter(t => t.id !== id)})); createDeleteFunction('adminTasks')(id); },
        deleteAppointment: (id: string) => { updateData(p => ({...p, appointments: p.appointments.filter(a => a.id !== id)})); createDeleteFunction('appointments')(id); },
        deleteAccountingEntry: (id: string) => { updateData(p => ({...p, accountingEntries: p.accountingEntries.filter(e => e.id !== id)})); createDeleteFunction('accountingEntries')(id); },
        deleteInvoice: (id: string) => { updateData(p => ({...p, invoices: p.invoices.filter(i => i.id !== id)})); createDeleteFunction('invoices')(id); },
        deleteAssistant: (name: string) => { updateData(p => ({...p, assistants: p.assistants.filter(a => a !== name)})); createDeleteFunction('assistants')(name); },
        deleteDocument: async (doc: CaseDocument) => {
            try {
                const db = await getDb();
                await db.delete(DOCS_FILES_STORE_NAME, doc.id);
                await db.delete(DOCS_METADATA_STORE_NAME, doc.id);
                await db.put(LOCAL_EXCLUDED_DOCS_STORE_NAME, { id: doc.id, excludedAt: new Date() }, doc.id);
                setExcludedDocIds(prev => new Set(prev).add(doc.id));
                updateData(p => ({ ...p, documents: p.documents.filter(d => d.id !== doc.id) }));
            } catch (e) {
                console.error("Failed to delete document from IDB", e);
            }
        },
        addDocuments: async (caseId: string, files: FileList) => {
             const currentUser = userRef.current;
             if (!currentUser) {
                 console.error("Cannot add documents: User not authenticated or session invalid.");
                 throw new Error("يجب تسجيل الدخول لإضافة وثائق.");
             }
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
            const supabase = await getSupabaseClient();
            const doc = data.documents.find(d => d.id === docId);
            if (!doc) return null;
            const localFile = await db.get(DOCS_FILES_STORE_NAME, docId);
            if (localFile) return localFile;
            if (doc.localState === 'pending_download' && isOnline && supabase) {
                try {
                    updateData((prev: AppData) => ({...prev, documents: prev.documents.map(d => d.id === docId ? {...d, localState: 'downloading' } : d)}), { markDirty: false });
                    const { data: blob, error }: any = await fetchWithRetry(() => supabase.storage.from('documents').download(doc.storagePath!));
                    if (error || !blob) throw error || new Error("Empty blob");
                    const downloadedFile = new File([blob], doc.name, { type: doc.type });
                    await db.put(DOCS_FILES_STORE_NAME, downloadedFile, doc.id);
                    await db.put(DOCS_METADATA_STORE_NAME, { ...doc, localState: 'synced' }, doc.id);
                    updateData(prev => ({...prev, documents: prev.documents.map(d => d.id === docId ? {...d, localState: 'synced'} : d)}), { markDirty: false });
                    return downloadedFile;
                } catch (e: any) {
                    let errorMsg = 'Unknown error';
                    try {
                        if (typeof e === 'string') {
                            errorMsg = e;
                        } else if (e instanceof Error) {
                            errorMsg = e.message;
                        } else {
                            const possibleMsg = (e as any)?.message || (e as any)?.error_description || (e as any)?.statusText;
                            if (possibleMsg) {
                                errorMsg = possibleMsg;
                            } else {
                                const json = JSON.stringify(e, Object.getOwnPropertyNames(e));
                                if (json && json !== '{}') errorMsg = json;
                                else errorMsg = String(e);
                            }
                        }
                    } catch {
                        errorMsg = String(e);
                    }
                    if (!isNetworkError(e)) {
                        console.error(`Failed to download doc ${doc.id}:`, e);
                    } else {
                        console.warn(`Failed to download doc ${doc.id} due to network error (offline).`);
                    }
                    await db.put(DOCS_METADATA_STORE_NAME, { ...doc, localState: 'error' }, doc.id);
                    updateData(prev => ({...prev, documents: prev.documents.map(d => d.id === docId ? {...d, localState: 'error'} : d)}), { markDirty: false });
                }
            }
            return null;
        },
        postponeSession: (sessionId: string, newDate: Date, newReason: string) => {
             updateData(prev => {
                 const newClients = prev.clients.map(client => {
                    let clientModified = false;
                    const newCases = client.cases.map(caseItem => {
                        let caseModified = false;
                        const newStages = caseItem.stages.map(stage => {
                            const sessionIndex = stage.sessions.findIndex(s => s.id === sessionId);
                            if (sessionIndex !== -1) {
                                const oldSession = stage.sessions[sessionIndex];
                                const newSession: Session = { id: `session-${Date.now()}`, court: oldSession.court, caseNumber: oldSession.caseNumber, date: newDate, clientName: oldSession.clientName, opponentName: oldSession.opponentName, postponementReason: newReason, isPostponed: false, assignee: oldSession.assignee, updated_at: new Date(), user_id: oldSession.user_id };
                                const updatedOldSession: Session = { ...oldSession, isPostponed: true, nextSessionDate: newDate, nextPostponementReason: newReason, updated_at: new Date() };
                                const newSessions = [...stage.sessions]; newSessions[sessionIndex] = updatedOldSession; newSessions.push(newSession);
                                caseModified = true; clientModified = true;
                                return { ...stage, sessions: newSessions, updated_at: new Date() };
                            }
                            return stage;
                        });
                        if (caseModified) return { ...caseItem, stages: newStages, updated_at: new Date() };
                        return caseItem;
                    });
                    if (clientModified) return { ...client, cases: newCases, updated_at: new Date() };
                    return client;
                });
                return newClients.some((c, i) => c !== prev.clients[i]) ? { ...prev, clients: newClients } : prev;
             });
        }
    };
};
