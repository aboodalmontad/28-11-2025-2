import * as React from 'react';
import { Client, Session, AdminTask, Appointment, AccountingEntry, Case, Stage, Invoice, InvoiceItem, CaseDocument, AppData, DeletedIds, getInitialDeletedIds, Profile, SiteFinancialEntry, Permissions, defaultPermissions } from '../types';
import { useOnlineStatus } from './useOnlineStatus';
import type { User, RealtimeChannel } from '@supabase/supabase-js';
import { useSync, SyncStatus as SyncStatusType } from './useSync';
import { getSupabaseClient } from '../supabaseClient';
import { isBeforeToday, toInputDateString } from '../utils/dateUtils';
import { RealtimeAlert } from '../components/RealtimeNotifier';
import { getDb, DATA_STORE_NAME, DOCS_FILES_STORE_NAME, DOCS_METADATA_STORE_NAME, LOCAL_EXCLUDED_DOCS_STORE_NAME } from '../utils/db';
import { safeQuery } from './useOnlineData';

export const APP_DATA_KEY = 'lawyerBusinessManagementData';
export type SyncStatus = SyncStatusType;
const defaultAssistants = ['أحمد', 'فاطمة', 'سارة', 'بدون تخصيص'];

interface UserSettings {
    isAutoSyncEnabled: boolean;
    isAutoBackupEnabled: boolean;
    adminTasksLayout: 'horizontal' | 'vertical';
    locationOrder?: string[];
}

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
                lawyer_id: p.lawyer_id || null, 
                permissions: p.permissions || undefined, 
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
    const [excludedDocIds, setExcludedDocIds] = React.useState<Set<string>>(new Set());
    const [isDirty, setDirty] = React.useState(false);
    const [syncStatus, setSyncStatus] = React.useState<SyncStatus>('loading');
    const [lastSyncError, setLastSyncError] = React.useState<string | null>(null);
    const [isDataLoading, setIsDataLoading] = React.useState(true);
    const [isFetchingOwnerId, setIsFetchingOwnerId] = React.useState(false); 
    const [triggeredAlerts, setTriggeredAlerts] = React.useState<Appointment[]>([]);
    const [showUnpostponedSessionsModal, setShowUnpostponedSessionsModal] = React.useState(false);
    const [realtimeAlerts, setRealtimeAlerts] = React.useState<RealtimeAlert[]>([]);
    const [userApprovalAlerts, setUserApprovalAlerts] = React.useState<RealtimeAlert[]>([]);
    const [userSettings, setUserSettings] = React.useState<any>({ isAutoSyncEnabled: true, isAutoBackupEnabled: true, adminTasksLayout: 'horizontal', locationOrder: [] });
    const isOnline = useOnlineStatus();
    
    const userRef = React.useRef(user);
    userRef.current = user;
    const downloadQueueRef = React.useRef<Promise<void>>(Promise.resolve());

    const effectiveUserId = React.useMemo(() => {
        if (!user) return null;
        const currentUserProfile = data.profiles.find(p => p.id === user.id);
        if (currentUserProfile && currentUserProfile.lawyer_id) {
            return currentUserProfile.lawyer_id; 
        }
        const cached = localStorage.getItem(`lawyer_app_owner_id_${user.id}`);
        if (cached) return cached;
        
        return user.id; 
    }, [user, data.profiles]);

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

    const downloadMissingFiles = React.useCallback(async (documents: CaseDocument[]) => {
        const pendingDocs = documents.filter(d => d.localState === 'pending_download');
        if (pendingDocs.length === 0) return;

        downloadQueueRef.current = downloadQueueRef.current.then(async () => {
            const supabase = getSupabaseClient();
            if (!supabase) return;
            const db = await getDb();

            for (const doc of pendingDocs) {
                if (typeof navigator !== 'undefined' && !navigator.onLine) break;

                try {
                    const existingFile = await db.get(DOCS_FILES_STORE_NAME, doc.id);
                    if (existingFile) {
                        const updatedDoc = { ...doc, localState: 'synced' as const };
                        await db.put(DOCS_METADATA_STORE_NAME, updatedDoc, doc.id);
                        updateData(prev => ({...prev, documents: prev.documents.map(d => d.id === doc.id ? updatedDoc : d)}), { markDirty: false });
                        continue;
                    }

                    if (!doc.storagePath) throw new Error(`Missing storage path for doc ${doc.id}`);

                    const downloadingDoc = { ...doc, localState: 'downloading' as const };
                    await db.put(DOCS_METADATA_STORE_NAME, downloadingDoc, doc.id);
                    updateData(prev => ({...prev, documents: prev.documents.map(d => d.id === doc.id ? downloadingDoc : d)}), { markDirty: false });
                    
                    const { data: blob, error } = await supabase.storage.from('documents').download(doc.storagePath);
                    
                    if (error) {
                        if ((error as any).status === 404 || (error as any).statusCode === 404) {
                            throw new Error(`FILE_NOT_FOUND: ${doc.name}`);
                        }
                        throw error;
                    }
                    if (!blob) throw new Error("Downloaded blob is empty");

                    const file = new File([blob], doc.name, { type: doc.type });
                    await db.put(DOCS_FILES_STORE_NAME, file, doc.id);
                    const completedDoc = { ...doc, localState: 'synced' as const };
                    await db.put(DOCS_METADATA_STORE_NAME, completedDoc, doc.id);
                    updateData(prev => ({...prev, documents: prev.documents.map(d => d.id === doc.id ? completedDoc : d)}), { markDirty: false });

                } catch (e: any) {
                    let errorMsg = e.message || (typeof e === 'object' ? JSON.stringify(e) : String(e));
                    if (errorMsg === '{}') errorMsg = 'Unknown network error';
                    
                    console.error(`Failed to auto-download doc ${doc.id}:`, errorMsg);

                    const isNetworkError = errorMsg.includes('Failed to fetch') || errorMsg.toLowerCase().includes('network');
                    if (isNetworkError) {
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
        if (!user || isAuthLoading) {
            if (!isAuthLoading) setIsDataLoading(false);
            return;
        }
        setIsDataLoading(true);
        let cancelled = false;

        const loadData = async () => {
            try {
                let ownerId = user.id;
                const cachedOwnerId = localStorage.getItem(`lawyer_app_owner_id_${user.id}`);
                if (cachedOwnerId) ownerId = cachedOwnerId;

                const supabase = getSupabaseClient();
                const isOnlineNow = typeof navigator !== 'undefined' ? navigator.onLine : true;
                
                if (isOnlineNow && supabase) {
                    setIsFetchingOwnerId(true);
                    try {
                        // CRITICAL: We fetch the profile with a fallback to prevent infinite loading if the recursion issue still exists in DB
                        const profilePromise = safeQuery<{ lawyer_id: string | null }>(() => supabase.from('profiles').select('lawyer_id').eq('id', user.id).maybeSingle());
                        
                        // Wait for profile, but timeout after 10 seconds if it hangs
                        const profile = await Promise.race([
                            profilePromise,
                            new Promise<null>((resolve) => setTimeout(() => resolve(null), 10000))
                        ]);

                        if (profile && profile.lawyer_id) {
                            ownerId = profile.lawyer_id;
                            localStorage.setItem(`lawyer_app_owner_id_${user.id}`, ownerId);
                        } else if (profile) {
                            ownerId = user.id;
                            localStorage.setItem(`lawyer_app_owner_id_${user.id}`, ownerId);
                        }
                    } catch (e) {
                        console.warn("Could not definitively resolve owner ID from server:", e);
                    } finally {
                        setIsFetchingOwnerId(false);
                    }
                }

                const db = await getDb();
                const [storedData, localDocsMetadata, storedExcludedDocs] = await Promise.all([
                    db.get(DATA_STORE_NAME, ownerId),
                    db.getAll(DOCS_METADATA_STORE_NAME),
                    db.getAll(LOCAL_EXCLUDED_DOCS_STORE_NAME)
                ]);
                
                if (cancelled) return;

                const excludedIdsSet = new Set<string>((storedExcludedDocs || []).map((d: any) => d.id));
                setExcludedDocIds(excludedIdsSet);

                const validatedData = validateAndFixData(storedData, user);
                const localDocsMetadataMap = new Map((localDocsMetadata as any[]).map((meta: any) => [meta.id, meta]));
                const finalDocs = validatedData.documents.map(doc => {
                    if (excludedIdsSet.has(doc.id)) return null;
                    const localMeta: any = localDocsMetadataMap.get(doc.id);
                    return { ...doc, localState: localMeta?.localState || doc.localState || 'pending_download' };
                }).filter(doc => !!doc) as CaseDocument[];
                
                const finalData = { ...validatedData, documents: finalDocs };
                setData(finalData);
                setIsDataLoading(false);

                if (isOnlineNow) {
                    downloadMissingFiles(finalDocs);
                } else {
                    setSyncStatus('synced');
                }
            } catch (error) {
                console.error('Failed to load data:', error);
                setSyncStatus('error');
                setLastSyncError('فشل تحميل البيانات المحلية.');
                setIsDataLoading(false);
                setIsFetchingOwnerId(false);
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
            const localDocsMetadata = await db.getAll(DOCS_METADATA_STORE_NAME);
            const currentExcluded = await db.getAll(LOCAL_EXCLUDED_DOCS_STORE_NAME);
            const excludedIds = new Set(currentExcluded.map((e: any) => e.id));

            const finalDocs = safeArray(validatedMergedData.documents, (doc: any) => {
                if (!doc || typeof doc !== 'object' || !doc.id) return undefined;
                if (excludedIds.has(doc.id)) return undefined; 

                const localMeta = (localDocsMetadata as any[]).find((meta: any) => meta.id === doc.id);
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
            if (isOnline) downloadMissingFiles(finalDocs);

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
    }, [updateData]);

    const { manualSync, fetchAndRefresh } = useSync({
        user: userRef.current ? { ...userRef.current, id: effectiveUserId || userRef.current.id } as User : null, 
        localData: data, 
        deletedIds,
        onDataSynced: handleDataSynced,
        onDeletionsSynced: handleDeletionsSynced,
        onSyncStatusChange: handleSyncStatusChange,
        onDocumentsUploaded: handleDocumentsUploaded,
        excludedDocIds, 
        isOnline, isAuthLoading: isAuthLoading || isFetchingOwnerId, syncStatus 
    });

    React.useEffect(() => {
        if (isOnline && isDirty && userSettings.isAutoSyncEnabled && syncStatus !== 'syncing' && !isFetchingOwnerId) {
            const handler = setTimeout(() => { manualSync(); }, 15000);
            return () => clearTimeout(handler);
        }
    }, [isOnline, isDirty, userSettings.isAutoSyncEnabled, syncStatus, manualSync, isFetchingOwnerId]);

    React.useEffect(() => {
        if (isOnline && userSettings.isAutoSyncEnabled && syncStatus !== 'syncing' && syncStatus !== 'loading' && !isFetchingOwnerId) {
            manualSync();
        }
    }, [isOnline, userSettings.isAutoSyncEnabled, manualSync, isFetchingOwnerId]); 

    const addRealtimeAlert = React.useCallback((message: string, type: 'sync' | 'userApproval' = 'sync') => {
        setRealtimeAlerts(prev => [...prev, { id: Date.now(), message, type }]);
    }, []);

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
        setInvoicesState: (updater: (prev: Invoice[]) => Invoice[]) => updateData(prev => ({ ...prev, invoices: updater(prev.invoices) })),
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
             const docPathsToDelete = docsToDelete.map(doc => doc.storagePath).filter(Boolean);
             updateData(p => {
                const updatedClients = p.clients.map(c => c.id === clientId ? { ...c, cases: c.cases.filter(cs => cs.id !== caseId) } : c);
                return { ...p, clients: updatedClients, documents: p.documents.filter(doc => doc.caseId !== caseId) };
             });
             if (effectiveUserId) {
                 const db = await getDb();
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
        deleteDocument: async (doc: CaseDocument) => {
            const db = await getDb();
            await db.delete(DOCS_FILES_STORE_NAME, doc.id);
            await db.delete(DOCS_METADATA_STORE_NAME, doc.id);
            await db.put(LOCAL_EXCLUDED_DOCS_STORE_NAME, { id: doc.id, excludedAt: new Date() }, doc.id);
            setExcludedDocIds(prev => new Set(prev).add(doc.id));
            updateData(p => ({ ...p, documents: p.documents.filter(d => d.id !== doc.id) }));
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
            const supabase = getSupabaseClient();
            const doc = data.documents.find(d => d.id === docId);
            if (!doc) return null;
            const localFile = await db.get(DOCS_FILES_STORE_NAME, docId);
            if (localFile) return localFile;
            if (doc.localState === 'pending_download' && isOnline && supabase) {
                try {
                    updateData(prev => ({...prev, documents: prev.documents.map(d => d.id === docId ? {...d, localState: 'downloading' } : d)}), { markDirty: false });
                    const { data: blob, error } = await supabase.storage.from('documents').download(doc.storagePath);
                    if (error) {
                        if ((error as any).status === 404 || (error as any).statusCode === 404) {
                             throw new Error(`FILE_NOT_FOUND: ${doc.name}`);
                        }
                        throw error;
                    }
                    if (!blob) throw new Error("Empty blob");
                    const downloadedFile = new File([blob], doc.name, { type: doc.type });
                    await db.put(DOCS_FILES_STORE_NAME, downloadedFile, doc.id);
                    await db.put(DOCS_METADATA_STORE_NAME, { ...doc, localState: 'synced' }, doc.id);
                    updateData(prev => ({...prev, documents: prev.documents.map(d => d.id === docId ? {...d, localState: 'synced'} : d)}), { markDirty: false });
                    return downloadedFile;
                } catch (e: any) {
                    let errorMsg = e.message || (typeof e === 'object' ? JSON.stringify(e) : String(e));
                    if (errorMsg === '{}') errorMsg = 'Unknown network error';
                    console.error(`Failed to download doc ${doc.id}:`, errorMsg);
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