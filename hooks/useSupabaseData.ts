
import * as React from 'react';
import { Client, Session, AdminTask, Appointment, AccountingEntry, Case, Stage, Invoice, InvoiceItem, CaseDocument, AppData, DeletedIds, getInitialDeletedIds, Profile, SiteFinancialEntry, Permissions, defaultPermissions } from '../types';
import { useOnlineStatus } from './useOnlineStatus';
// Fix: Use `import type` for User and RealtimeChannel as they are used as types, not a value.
import type { User, RealtimeChannel } from '@supabase/supabase-js';
import { useSync, SyncStatus as SyncStatusType } from './useSync';
import { getSupabaseClient } from '../supabaseClient';
import { isBeforeToday, toInputDateString } from '../utils/dateUtils';
import { RealtimeAlert } from '../components/RealtimeNotifier';
import { getDb, DATA_STORE_NAME, DOCS_FILES_STORE_NAME, DOCS_METADATA_STORE_NAME, LOCAL_EXCLUDED_DOCS_STORE_NAME } from '../utils/db';

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
    const d = new Date(date);
    return isNaN(d.getTime()) ? new Date() : d;
};

const validateDocuments = (doc: any, userId: string): CaseDocument | undefined => {
    if (!doc || typeof doc !== 'object' || !doc.id || !doc.name) return undefined;
    return {
        id: String(doc.id),
        caseId: String(doc.caseId),
        userId: String(doc.userId || userId),
        name: String(doc.name),
        type: String(doc.type || 'application/octet-stream'),
        size: Number(doc.size || 0),
        addedAt: reviveDate(doc.addedAt),
        storagePath: String(doc.storagePath || ''),
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
                 contactInfo: String(client.contactInfo || ''),
                 updated_at: reviveDate(client.updated_at),
                 user_id: clientUserId,
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
                         user_id: clientUserId,
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
                                 user_id: clientUserId,
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
                                         stageDecisionDate: session.stageDecisionDate,
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
        assistants: validateAssistantsList(loadedData.assistants),
        documents: safeArray(loadedData.documents, (doc) => validateDocuments(doc, userId)),
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
                lawyer_id: p.lawyer_id || null, // New field
                permissions: p.permissions || undefined, // New field
                created_at: p.created_at,
                updated_at: reviveDate(p.updated_at),
            };
        }),
        siteFinances: safeArray(loadedData.siteFinances, (sf) => {
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
    // New State for locally excluded documents
    const [excludedDocIds, setExcludedDocIds] = React.useState<Set<string>>(new Set());
    const [isDirty, setDirty] = React.useState(false);
    const [syncStatus, setSyncStatus] = React.useState<SyncStatus>('loading');
    const [lastSyncError, setLastSyncError] = React.useState<string | null>(null);
    const [isDataLoading, setIsDataLoading] = React.useState(true);
    const [triggeredAlerts, setTriggeredAlerts] = React.useState<Appointment[]>([]);
    const [showUnpostponedSessionsModal, setShowUnpostponedSessionsModal] = React.useState(false);
    const [realtimeAlerts, setRealtimeAlerts] = React.useState<RealtimeAlert[]>([]);
    const [userApprovalAlerts, setUserApprovalAlerts] = React.useState<RealtimeAlert[]>([]);
    const [userSettings, setUserSettings] = React.useState<any>({ isAutoSyncEnabled: true, isAutoBackupEnabled: true, adminTasksLayout: 'horizontal', locationOrder: [] });
    const isOnline = useOnlineStatus();
    
    const userRef = React.useRef(user);
    userRef.current = user;
    const downloadQueueRef = React.useRef<Promise<void>>(Promise.resolve());

    // --- EFFECTIVE USER ID LOGIC ---
    // If the current user is an assistant, their data operations should technically belong 
    // to their lawyer (owner). The backend RLS handles this by checking lawyer_id.
    // However, for local storage (IndexedDB) and optimistic updates, we need to know who the "data owner" is.
    const effectiveUserId = React.useMemo(() => {
        if (!user) return null;
        const currentUserProfile = data.profiles.find(p => p.id === user.id);
        if (currentUserProfile && currentUserProfile.lawyer_id) {
            return currentUserProfile.lawyer_id; // I am an assistant, return lawyer ID
        }
        return user.id; // I am a lawyer/admin, return my ID
    }, [user, data.profiles]);

    // Current user's permissions (if assistant)
    const currentUserPermissions: Permissions = React.useMemo(() => {
        if (!user) return defaultPermissions;
        const currentUserProfile = data.profiles.find(p => p.id === user.id);
        if (currentUserProfile && currentUserProfile.lawyer_id) {
            // Merge defaultPermissions to ensure all keys exist
            return { ...defaultPermissions, ...currentUserProfile.permissions };
        }
        // Lawyers/Admins have full permissions explicitly defined to match Permissions type
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

    // Update Data: Use effectiveUserId for IDB key
    const updateData = React.useCallback((updater: React.SetStateAction<AppData>, options: { markDirty?: boolean } = { markDirty: true }) => {
        if (!userRef.current || !effectiveUserId) return;
        
        setData(currentData => {
            const newData = typeof updater === 'function' ? (updater as (prevState: AppData) => AppData)(currentData) : updater;
            getDb().then(db => {
                // IMPORTANT: We store data under the OWNER's ID so that assistants and lawyers see the same bucket locally
                db.put(DATA_STORE_NAME, newData, effectiveUserId);
            });
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

    // Auto-download missing files logic
    const downloadMissingFiles = React.useCallback(async (documents: CaseDocument[]) => {
        const pendingDocs = documents.filter(d => d.localState === 'pending_download');
        if (pendingDocs.length === 0) return;

        // Queue processing to avoid race conditions
        downloadQueueRef.current = downloadQueueRef.current.then(async () => {
            const supabase = getSupabaseClient();
            if (!supabase) return;
            const db = await getDb();

            for (const doc of pendingDocs) {
                try {
                    // Double check if file exists in DB (maybe metadata was stale)
                    const existingFile = await db.get(DOCS_FILES_STORE_NAME, doc.id);
                    if (existingFile) {
                        const updatedDoc = { ...doc, localState: 'synced' as const };
                        await db.put(DOCS_METADATA_STORE_NAME, updatedDoc, doc.id);
                        // Do not mark as dirty, this is just local state
                        updateData(prev => ({...prev, documents: prev.documents.map(d => d.id === doc.id ? updatedDoc : d)}), { markDirty: false });
                        continue;
                    }

                    if (!doc.storagePath) {
                        throw new Error(`Missing storage path for doc ${doc.id}`);
                    }

                    // Download
                    // UPDATE: Persist 'downloading' state to metadata store immediately.
                    // This ensures that if a sync happens during download, handleDataSynced sees 'downloading' and preserves it,
                    // preventing duplicate download attempts or state resets.
                    const downloadingDoc = { ...doc, localState: 'downloading' as const };
                    await db.put(DOCS_METADATA_STORE_NAME, downloadingDoc, doc.id);
                    // Do not mark as dirty
                    updateData(prev => ({...prev, documents: prev.documents.map(d => d.id === doc.id ? downloadingDoc : d)}), { markDirty: false });
                    
                    const { data: blob, error } = await supabase.storage.from('documents').download(doc.storagePath);
                    
                    if (error) throw error;
                    if (!blob) throw new Error("Downloaded blob is empty");

                    const file = new File([blob], doc.name, { type: doc.type });
                    await db.put(DOCS_FILES_STORE_NAME, file, doc.id);
                    
                    const completedDoc = { ...doc, localState: 'synced' as const };
                    await db.put(DOCS_METADATA_STORE_NAME, completedDoc, doc.id);
                    
                    // Do not mark as dirty
                    updateData(prev => ({...prev, documents: prev.documents.map(d => d.id === doc.id ? completedDoc : d)}), { markDirty: false });

                } catch (e: any) {
                    let errorMsg = 'Unknown error';
                    try {
                        if (typeof e === 'string') {
                            errorMsg = e;
                        } else if (e instanceof Error) {
                            errorMsg = e.message;
                        } else {
                            // Try to get useful info from Supabase/Postgrest Error objects
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
                    
                    console.error(`Failed to auto-download doc ${doc.id}:`, errorMsg);

                    // Mark as error to prevent infinite retries.
                    // IMPORTANT: Update metadata store first so next sync/load respects this state.
                    const errorDoc = { ...doc, localState: 'error' as const };
                    await db.put(DOCS_METADATA_STORE_NAME, errorDoc, doc.id);
                    // Do not mark as dirty, otherwise it loops
                    updateData(prev => ({...prev, documents: prev.documents.map(d => d.id === doc.id ? errorDoc : d)}), { markDirty: false });
                }
            }
        });
    }, [updateData]);

    // Load Data: Use effectiveUserId
    // Fixed: Dependency depends on user.id string, not user object, to prevent re-runs on token refresh
    React.useEffect(() => {
        if (!user || isAuthLoading) {
            if (!isAuthLoading) setIsDataLoading(false);
            return;
        }
        setIsDataLoading(true);
        let cancelled = false;

        const loadData = async () => {
            try {
                let ownerId = user.id;
                
                // 1. Try to get cached owner relationship (for assistants)
                const cachedOwnerId = localStorage.getItem(`lawyer_app_owner_id_${user.id}`);
                if (cachedOwnerId) {
                    ownerId = cachedOwnerId;
                }

                // 2. If online, verify/update relationship
                const supabase = getSupabaseClient();
                const isOnlineNow = typeof navigator !== 'undefined' ? navigator.onLine : true;
                if (isOnlineNow && supabase) {
                    const { data: profile } = await supabase.from('profiles').select('lawyer_id').eq('id', user.id).single();
                    if (profile && profile.lawyer_id) {
                        ownerId = profile.lawyer_id;
                        localStorage.setItem(`lawyer_app_owner_id_${user.id}`, ownerId);
                    } else if (profile) {
                        // I am the lawyer/admin
                        ownerId = user.id;
                        localStorage.setItem(`lawyer_app_owner_id_${user.id}`, ownerId);
                    }
                }

                // 3. Load Data from IDB using ownerId
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
                const localDocsMetadataMap = new Map((localDocsMetadata as any[]).map((meta: any) => [meta.id, meta]));
                const finalDocs = validatedData.documents.map(doc => {
                    // Skip if excluded locally
                    if (excludedIdsSet.has(doc.id)) return null;

                    const localMeta: any = localDocsMetadataMap.get(doc.id);
                    // If local metadata is missing, it implies we just synced this record but haven't downloaded file/meta yet.
                    // Or it's a fresh load. Default to pending_download if no file.
                    return { ...doc, localState: localMeta?.localState || doc.localState || 'pending_download' };
                }).filter(doc => !!doc) as CaseDocument[];
                
                const finalData = { ...validatedData, documents: finalDocs };
                
                setData(finalData);
                setDeletedIds(storedDeletedIds || getInitialDeletedIds());
                setIsDataLoading(false);

                if (isOnlineNow) {
                    manualSync().catch(console.error);
                    // Trigger auto-download after initial load/sync check
                    downloadMissingFiles(finalDocs);
                } else {
                    setSyncStatus('synced');
                }
            } catch (error) {
                console.error('Failed to load data:', error);
                setSyncStatus('error');
                setLastSyncError('فشل تحميل البيانات المحلية.');
                setIsDataLoading(false);
            }
        };
        loadData();
        return () => { cancelled = true; };
    // Remove downloadMissingFiles from deps to avoid loop. 
    // It's safe because manualSync and downloadMissingFiles use ref/stable callbacks internally where needed.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [user?.id, isAuthLoading]); 

    // Sync Status Callback
    const handleSyncStatusChange = React.useCallback((status: SyncStatus, error: string | null) => {
        setSyncStatus(status);
        setLastSyncError(error);
    }, []);

    const handleDataSynced = React.useCallback(async (mergedData: AppData) => {
        if (!effectiveUserId) return;
        try {
            const validatedMergedData = validateAndFixData(mergedData, userRef.current);
            const db = await getDb();
            const localDocsMetadata = await db.getAll(DOCS_METADATA_STORE_NAME);
            
            // Re-read excluded docs to be sure
            const currentExcluded = await db.getAll(LOCAL_EXCLUDED_DOCS_STORE_NAME);
            const excludedIds = new Set(currentExcluded.map((e: any) => e.id));

            const finalDocs = safeArray(validatedMergedData.documents, (doc: any) => {
                if (!doc || typeof doc !== 'object' || !doc.id) return undefined;
                if (excludedIds.has(doc.id)) return undefined; // Filter excluded

                const localMeta = (localDocsMetadata as any[]).find((meta: any) => meta.id === doc.id);
                // If it's a new doc from server, it won't have localMeta, so it becomes pending_download
                const mergedDoc = {
                    ...doc,
                    localState: localMeta?.localState || doc.localState || 'pending_download'
                };
                return validateDocuments(mergedDoc, userRef.current?.id || '');
            });

            const finalData = { ...validatedMergedData, documents: finalDocs };

            await db.put(DATA_STORE_NAME, finalData, effectiveUserId);
            setData(finalData);
            setDirty(false);
            
            // Trigger auto-download for newly synced files
            if (isOnline) {
                downloadMissingFiles(finalDocs);
            }

        } catch (e) {
            console.error("Critical error in handleDataSynced:", e);
            handleSyncStatusChange('error', 'فشل تحديث البيانات المحلية بعد المزامنة.');
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
            await db.put(DATA_STORE_NAME, newDeletedIds, `deletedIds_${effectiveUserId}`);
        }
    }, [deletedIds, effectiveUserId]);

    const handleDocumentsUploaded = React.useCallback(async (uploadedIds: string[]) => {
        const db = await getDb();
        
        // Update DB first (Metadata Store)
        const tx = db.transaction(DOCS_METADATA_STORE_NAME, 'readwrite');
        const store = tx.objectStore(DOCS_METADATA_STORE_NAME);
        for (const id of uploadedIds) {
            const doc = await store.get(id);
            if (doc) {
                doc.localState = 'synced';
                // Fix: Provide key (id) for out-of-line store updates
                await store.put(doc, id);
            }
        }
        await tx.done;

        // Update State without triggering sync loop
        updateData(prev => ({ 
            ...prev, 
            documents: prev.documents.map(d => uploadedIds.includes(d.id) ? { ...d, localState: 'synced' as const } : d) 
        }), { markDirty: false });
    }, [updateData]);

    // Use Sync Hook
    const { manualSync, fetchAndRefresh } = useSync({
        user: userRef.current ? { ...userRef.current, id: effectiveUserId || userRef.current.id } as User : null, // Pass effective ID to sync
        localData: data, 
        deletedIds,
        onDataSynced: handleDataSynced,
        onDeletionsSynced: handleDeletionsSynced,
        onSyncStatusChange: handleSyncStatusChange,
        onDocumentsUploaded: handleDocumentsUploaded, // Pass callback
        excludedDocIds, // Pass the set of excluded IDs
        isOnline, isAuthLoading, syncStatus
    });

    // Auto Sync
    React.useEffect(() => {
        if (isOnline && isDirty && userSettings.isAutoSyncEnabled && syncStatus !== 'syncing') {
            const handler = setTimeout(() => { manualSync(); }, 3000);
            return () => clearTimeout(handler);
        }
    }, [isOnline, isDirty, userSettings.isAutoSyncEnabled, syncStatus, manualSync]);

    const addRealtimeAlert = React.useCallback((message: string, type: 'sync' | 'userApproval' = 'sync') => {
        setRealtimeAlerts(prev => [...prev, { id: Date.now(), message, type }]);
    }, []);

    // Helper to persist deleted IDs using effective ID
    const createDeleteFunction = <T extends keyof DeletedIds>(entity: T) => async (id: DeletedIds[T][number]) => {
        if (!effectiveUserId) return;
        const db = await getDb();
        const newDeletedIds = { ...deletedIds, [entity]: [...deletedIds[entity], id] };
        setDeletedIds(newDeletedIds);
        await db.put(DATA_STORE_NAME, newDeletedIds, `deletedIds_${effectiveUserId}`);
        setDirty(true);
    };

    return {
        ...data,
        setClients: (updater) => updateData(prev => ({ ...prev, clients: updater(prev.clients) })),
        setAdminTasks: (updater) => updateData(prev => ({ ...prev, adminTasks: updater(prev.adminTasks) })),
        setAppointments: (updater) => updateData(prev => ({ ...prev, appointments: updater(prev.appointments) })),
        setAccountingEntries: (updater) => updateData(prev => ({ ...prev, accountingEntries: updater(prev.accountingEntries) })),
        setInvoices: (updater) => updateData(prev => ({ ...prev, invoices: updater(prev.invoices) })),
        setAssistants: (updater) => updateData(prev => ({ ...prev, assistants: updater(prev.assistants) })),
        setDocuments: (updater) => updateData(prev => ({ ...prev, documents: updater(prev.documents) })),
        setProfiles: (updater) => updateData(prev => ({ ...prev, profiles: updater(prev.profiles) })),
        setSiteFinances: (updater) => updateData(prev => ({ ...prev, siteFinances: updater(prev.siteFinances) })),
        setFullData,
        allSessions: React.useMemo(() => data.clients.flatMap(c => c.cases.flatMap(cs => cs.stages.flatMap(st => st.sessions.map(s => ({...s, stageId: st.id, stageDecisionDate: st.decisionDate}))))), [data.clients]),
        unpostponedSessions: React.useMemo(() => {
            return data.clients.flatMap(c => c.cases.flatMap(cs => cs.stages.flatMap(st => st.sessions.filter(s => !s.isPostponed && isBeforeToday(s.date) && !st.decisionDate).map(s => ({...s, stageId: st.id, stageDecisionDate: st.decisionDate})))));
        }, [data.clients]),
        syncStatus, manualSync, lastSyncError, isDirty, userId: user?.id, isDataLoading,
        effectiveUserId,
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
             // We do NOT add docs to global deletedIds here because that would delete from cloud for everyone
             // We only delete Case/Client which will cascade if needed, but for documents we want local independence mostly.
             // However, deleting a CASE is a global action, so it makes sense to delete associated docs globally too.
             // The specific request is about "Deleting a document" independently. Deleting a case deletes context.
             const docPathsToDelete = docsToDelete.map(doc => doc.storagePath).filter(Boolean);
             updateData(p => {
                const updatedClients = p.clients.map(c => c.id === clientId ? { ...c, cases: c.cases.filter(cs => cs.id !== caseId) } : c);
                return { ...p, clients: updatedClients, documents: p.documents.filter(doc => doc.caseId !== caseId) };
             });
             if (effectiveUserId) {
                 const db = await getDb();
                 // Here we DO delete globally because the Parent (Case) is gone.
                 const newDeletedIds = { ...deletedIds, cases: [...deletedIds.cases, caseId], documents: [...deletedIds.documents, ...docIdsToDelete], documentPaths: [...deletedIds.documentPaths, ...docPathsToDelete] };
                 setDeletedIds(newDeletedIds);
                 await db.put(DATA_STORE_NAME, newDeletedIds, `deletedIds_${effectiveUserId}`);
                 setDirty(true);
             }
        },
        deleteStage: (sid: string, cid: string, clid: string) => { updateData(p => ({ ...p, clients: p.clients.map(c => c.id === clid ? { ...c, cases: c.cases.map(cs => cs.id === cid ? { ...cs, stages: cs.stages.filter(st => st.id !== sid) } : cs) } : c) })); createDeleteFunction('stages')(sid); },
        deleteSession: (sessId: string, stId: string, cid: string, clid: string) => { updateData(p => ({ ...p, clients: p.clients.map(c => c.id === clid ? { ...c, cases: c.cases.map(cs => cs.id === cid ? { ...cs, stages: cs.stages.map(st => st.id === stId ? { ...st, sessions: st.sessions.filter(s => s.id !== sessId) } : st) } : cs) } : c) })); createDeleteFunction('sessions')(sessId); },
        deleteAdminTask: (id: string) => { updateData(p => ({...p, adminTasks: p.adminTasks.filter(t => t.id !== id)})); createDeleteFunction('adminTasks')(id); },
        deleteAppointment: (id: string) => { updateData(p => ({...p, appointments: p.appointments.filter(a => a.id !== id)})); createDeleteFunction('appointments')(id); },
        deleteAccountingEntry: (id: string) => { updateData(p => ({...p, accountingEntries: p.accountingEntries.filter(e => e.id !== id)})); createDeleteFunction('accountingEntries')(id); },
        deleteInvoice: (id: string) => { updateData(p => ({...p, invoices: p.invoices.filter(i => i.id !== id)})); createDeleteFunction('invoices')(id); },
        deleteAssistant: (name: string) => { updateData(p => ({...p, assistants: p.assistants.filter(a => a !== name)})); createDeleteFunction('assistants')(name); },
        // UPDATED: Local-only delete logic
        deleteDocument: async (doc: CaseDocument) => {
            const db = await getDb();
            // 1. Delete local file content
            await db.delete(DOCS_FILES_STORE_NAME, doc.id);
            // 2. Delete local metadata
            await db.delete(DOCS_METADATA_STORE_NAME, doc.id);
            // 3. Mark as locally excluded so it doesn't re-sync
            await db.put(LOCAL_EXCLUDED_DOCS_STORE_NAME, { id: doc.id, excludedAt: new Date() }, doc.id);
            setExcludedDocIds(prev => new Set(prev).add(doc.id));

            // 4. Update App State (remove from UI)
            updateData(p => ({ ...p, documents: p.documents.filter(d => d.id !== doc.id) }));
            
            // NOTE: We do NOT add to `deletedIds.documents` or `documentPaths`.
            // This ensures the deletion is local only and doesn't propagate to cloud/other users.
        },
        addDocuments: async (caseId: string, files: FileList) => {
             // Safe access to user from ref to avoid closure staleness issues in async callbacks
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
            const supabase = getSupabaseClient();
            const doc = data.documents.find(d => d.id === docId);
            if (!doc) return null;
            const localFile = await db.get(DOCS_FILES_STORE_NAME, docId);
            if (localFile) return localFile;
            if (doc.localState === 'pending_download' && isOnline && supabase) {
                try {
                    // Prevent download status from marking app as dirty to avoid sync loop
                    updateData(prev => ({...prev, documents: prev.documents.map(d => d.id === docId ? {...d, localState: 'downloading' } : d)}), { markDirty: false });
                    const { data: blob, error } = await supabase.storage.from('documents').download(doc.storagePath);
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
                            const json = JSON.stringify(e, Object.getOwnPropertyNames(e));
                            if (json && json !== '{}') errorMsg = json;
                            else errorMsg = String(e);
                        }
                    } catch {
                        errorMsg = String(e);
                    }
                    console.error(`Failed to download doc ${doc.id}:`, e);
                    // Mark as error to prevent infinite retries
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
