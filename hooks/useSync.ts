
import * as React from 'react';
// Fix: Use `import type` for User as it is used as a type, not a value. This resolves module resolution errors in some environments.
import type { User } from '@supabase/supabase-js';
import { checkSupabaseSchema, fetchDataFromSupabase, upsertDataToSupabase, FlatData, deleteDataFromSupabase, transformRemoteToLocal, fetchDeletionsFromSupabase } from './useOnlineData';
import { getSupabaseClient } from '../supabaseClient';
import { Client, Case, Stage, Session, CaseDocument, AppData, DeletedIds, getInitialDeletedIds, SyncDeletion } from '../types';

export type SyncStatus = 'loading' | 'syncing' | 'synced' | 'error' | 'unconfigured' | 'uninitialized';


interface UseSyncProps {
    user: User | null;
    localData: AppData;
    deletedIds: DeletedIds;
    onDataSynced: (mergedData: AppData) => void;
    onDeletionsSynced: (syncedDeletions: Partial<DeletedIds>) => void;
    onSyncStatusChange: (status: SyncStatus, error: string | null) => void;
    isOnline: boolean;
    isAuthLoading: boolean;
    syncStatus: SyncStatus;
}

const flattenData = (data: AppData): FlatData => {
    const cases = data.clients.flatMap(c => c.cases.map(cs => ({ ...cs, client_id: c.id })));
    const stages = cases.flatMap(cs => cs.stages.map(st => ({ ...st, case_id: cs.id })));
    const sessions = stages.flatMap(st => st.sessions.map(s => ({ ...s, stage_id: st.id })));
    const invoice_items = data.invoices.flatMap(inv => inv.items.map(item => ({ ...item, invoice_id: inv.id })));

    return {
        clients: data.clients.map(({ cases, ...client }) => client),
        cases: cases.map(({ stages, ...caseItem }) => caseItem),
        stages: stages.map(({ sessions, ...stage }) => stage),
        sessions,
        admin_tasks: data.adminTasks,
        appointments: data.appointments,
        accounting_entries: data.accountingEntries,
        assistants: data.assistants.map(name => ({ name })),
        invoices: data.invoices.map(({ items, ...inv }) => inv),
        invoice_items,
        case_documents: data.documents,
        profiles: data.profiles,
        site_finances: data.siteFinances,
    };
};

const constructData = (flatData: Partial<FlatData>): AppData => {
    const sessionMap = new Map<string, Session[]>();
    (flatData.sessions || []).forEach(s => {
        const stageId = (s as any).stage_id;
        if (!sessionMap.has(stageId)) sessionMap.set(stageId, []);
        sessionMap.get(stageId)!.push(s as Session);
    });

    const stageMap = new Map<string, Stage[]>();
    (flatData.stages || []).forEach(st => {
        const stage = { ...st, sessions: sessionMap.get(st.id) || [] } as Stage;
        const caseId = (st as any).case_id;
        if (!stageMap.has(caseId)) stageMap.set(caseId, []);
        stageMap.get(caseId)!.push(stage);
    });

    const caseMap = new Map<string, Case[]>();
    (flatData.cases || []).forEach(cs => {
        const caseItem = { ...cs, stages: stageMap.get(cs.id) || [] } as Case;
        const clientId = (cs as any).client_id;
        if (!caseMap.has(clientId)) caseMap.set(clientId, []);
        caseMap.get(clientId)!.push(caseItem);
    });
    
    const invoiceItemMap = new Map<string, any[]>();
    (flatData.invoice_items || []).forEach(item => {
        const invoiceId = (item as any).invoice_id;
        if(!invoiceItemMap.has(invoiceId)) invoiceItemMap.set(invoiceId, []);
        invoiceItemMap.get(invoiceId)!.push(item);
    });

    return {
        clients: (flatData.clients || []).map(c => ({ ...c, cases: caseMap.get(c.id) || [] } as Client)),
        adminTasks: (flatData.admin_tasks || []) as any,
        appointments: (flatData.appointments || []) as any,
        accountingEntries: (flatData.accounting_entries || []) as any,
        assistants: (flatData.assistants || []).map(a => a.name),
        invoices: (flatData.invoices || []).map(inv => ({...inv, items: invoiceItemMap.get(inv.id) || []})) as any,
        documents: (flatData.case_documents || []) as any,
        profiles: (flatData.profiles || []) as any,
        siteFinances: (flatData.site_finances || []) as any,
    };
};

const mergeForRefresh = <T extends { id: any; updated_at?: Date | string }>(local: T[], remote: T[]): T[] => {
    const finalItems = new Map<any, T>();
    for (const localItem of local) { finalItems.set(localItem.id ?? (localItem as any).name, localItem); }
    for (const remoteItem of remote) {
        const id = remoteItem.id ?? (remoteItem as any).name;
        const existingItem = finalItems.get(id);
        if (existingItem) {
            const remoteDate = new Date(remoteItem.updated_at || 0);
            const localDate = new Date(existingItem.updated_at || 0);
            if (remoteDate > localDate) finalItems.set(id, remoteItem);
        } else { finalItems.set(id, remoteItem); }
    }
    return Array.from(finalItems.values());
};

// Filters local items against remote deletion log to prevent "Zombie" data resurrection
const applyDeletionsToLocal = (localFlatData: FlatData, deletions: SyncDeletion[]): FlatData => {
    if (!deletions || deletions.length === 0) return localFlatData;

    const deletionMap = new Map<string, string>(); // RecordID -> DeletedAt ISO
    deletions.forEach(d => {
        // We use a composite key or just record_id if table matches.
        // Assuming record_id is unique enough or we check table.
        // For simpler logic here, we check record_id + table match
        deletionMap.set(`${d.table_name}:${d.record_id}`, d.deleted_at);
    });

    const filterItems = (items: any[], tableName: string) => {
        return items.filter(item => {
            const id = item.id ?? item.name;
            const key = `${tableName}:${id}`;
            const deletedAtStr = deletionMap.get(key);
            
            if (deletedAtStr) {
                // If item exists locally but was deleted remotely...
                const deletedAt = new Date(deletedAtStr).getTime();
                const updatedAt = new Date(item.updated_at || 0).getTime();
                
                // If the local item hasn't been updated since it was deleted remotely, purge it.
                // We add a small buffer (e.g., 2 seconds) to avoid clock skew issues.
                if (updatedAt < (deletedAt + 2000)) {
                    return false; // Remove from local view
                }
            }
            return true;
        });
    };

    return {
        ...localFlatData,
        clients: filterItems(localFlatData.clients, 'clients'),
        cases: filterItems(localFlatData.cases, 'cases'),
        stages: filterItems(localFlatData.stages, 'stages'),
        sessions: filterItems(localFlatData.sessions, 'sessions'),
        admin_tasks: filterItems(localFlatData.admin_tasks, 'admin_tasks'),
        appointments: filterItems(localFlatData.appointments, 'appointments'),
        accounting_entries: filterItems(localFlatData.accounting_entries, 'accounting_entries'),
        invoices: filterItems(localFlatData.invoices, 'invoices'),
        invoice_items: filterItems(localFlatData.invoice_items, 'invoice_items'),
        case_documents: filterItems(localFlatData.case_documents, 'case_documents'),
        // Assistants logic is name-based, might be tricky but let's try
        assistants: filterItems(localFlatData.assistants, 'assistants'),
        site_finances: filterItems(localFlatData.site_finances, 'site_finances'),
    };
};


export const useSync = ({ user, localData, deletedIds, onDataSynced, onDeletionsSynced, onSyncStatusChange, isOnline, isAuthLoading, syncStatus }: UseSyncProps) => {
    const userRef = React.useRef(user);
    userRef.current = user;

    const setStatus = (status: SyncStatus, error: string | null = null) => { onSyncStatusChange(status, error); };

    const manualSync = React.useCallback(async () => {
        if (syncStatus === 'syncing') return;
        if (isAuthLoading) return;
        const currentUser = userRef.current;
        if (!isOnline || !currentUser) {
            setStatus('error', isOnline ? 'يجب تسجيل الدخول للمزامنة.' : 'يجب أن تكون متصلاً بالإنترنت للمزامنة.');
            return;
        }
    
        setStatus('syncing', 'التحقق من الخادم...');
        const schemaCheck = await checkSupabaseSchema();
        if (!schemaCheck.success) {
            if (schemaCheck.error === 'unconfigured') setStatus('unconfigured');
            else if (schemaCheck.error === 'uninitialized') setStatus('uninitialized', `قاعدة البيانات غير مهيأة: ${schemaCheck.message}`);
            else setStatus('error', `فشل الاتصال: ${schemaCheck.message}`);
            return;
        }
    
        try {
            // 1. Fetch Remote Data AND Deletions Log to prevent zombie data
            setStatus('syncing', 'جاري جلب البيانات من السحابة...');
            const [remoteDataRaw, remoteDeletions] = await Promise.all([
                fetchDataFromSupabase(),
                fetchDeletionsFromSupabase()
            ]);
            const remoteFlatData = transformRemoteToLocal(remoteDataRaw);

            // 2. Prepare Local Data
            let localFlatData = flattenData(localData);
            
            // 3. Apply Remote Deletions to Local Data (The Zombie Fix)
            // If an item was deleted on another device, remove it from consideration here
            // so we don't accidentally re-upload it as "new".
            localFlatData = applyDeletionsToLocal(localFlatData, remoteDeletions);

            const isLocalEffectivelyEmpty = (localFlatData.clients.length === 0 && localFlatData.admin_tasks.length === 0 && localFlatData.appointments.length === 0 && localFlatData.accounting_entries.length === 0 && localFlatData.invoices.length === 0 && localFlatData.case_documents.length === 0);
            const hasPendingDeletions = Object.values(deletedIds).some(arr => arr.length > 0);
            const isRemoteEffectivelyEmpty = !remoteDataRaw || Object.values(remoteDataRaw).every(arr => arr?.length === 0);

            if (isLocalEffectivelyEmpty && !isRemoteEffectivelyEmpty && !hasPendingDeletions) {
                const freshData = constructData(remoteFlatData);
                onDataSynced(freshData);
                setStatus('synced');
                return;
            }
            
            const flatUpserts: Partial<FlatData> = {};
            const mergedFlatData: Partial<FlatData> = {};

            const deletedIdsSets = {
                clients: new Set(deletedIds.clients), cases: new Set(deletedIds.cases), stages: new Set(deletedIds.stages),
                sessions: new Set(deletedIds.sessions), adminTasks: new Set(deletedIds.adminTasks), appointments: new Set(deletedIds.appointments),
                accountingEntries: new Set(deletedIds.accountingEntries), invoices: new Set(deletedIds.invoices),
                invoiceItems: new Set(deletedIds.invoiceItems), assistants: new Set(deletedIds.assistants),
                documents: new Set(deletedIds.documents), profiles: new Set(deletedIds.profiles), siteFinances: new Set(deletedIds.siteFinances),
            };

            for (const key of Object.keys(localFlatData) as (keyof FlatData)[]) {
                const localItems = (localFlatData as any)[key] as any[];
                const remoteItems = (remoteFlatData as any)[key] as any[] || [];
                const localMap = new Map(localItems.map(i => [i.id ?? i.name, i]));
                const remoteMap = new Map(remoteItems.map(i => [i.id ?? i.name, i]));
                const finalMergedItems = new Map<string, any>();
                const itemsToUpsert: any[] = [];

                for (const localItem of localItems) {
                    const id = localItem.id ?? localItem.name;
                    let isParentDeleted = false;
                    if (key === 'cases' && deletedIdsSets.clients.has(localItem.client_id)) isParentDeleted = true;
                    if (key === 'stages' && deletedIdsSets.cases.has(localItem.case_id)) isParentDeleted = true;
                    if (key === 'sessions' && deletedIdsSets.stages.has(localItem.stage_id)) isParentDeleted = true;
                    if (key === 'invoice_items' && deletedIdsSets.invoices.has(localItem.invoice_id)) isParentDeleted = true;
                    if (key === 'case_documents' && deletedIdsSets.cases.has(localItem.caseId)) isParentDeleted = true;
                    if (isParentDeleted) continue; 

                    const remoteItem = remoteMap.get(id);
                    if (remoteItem) {
                        const localDate = new Date(localItem.updated_at || 0).getTime();
                        const remoteDate = new Date(remoteItem.updated_at || 0).getTime();
                        if (localDate > remoteDate) {
                            itemsToUpsert.push(localItem);
                            finalMergedItems.set(id, localItem);
                        } else { finalMergedItems.set(id, remoteItem); }
                    } else {
                        // It's local but not remote.
                        // Because we ran `applyDeletionsToLocal` earlier, we know this isn't a zombie.
                        // It's genuinely a new local item.
                        itemsToUpsert.push(localItem);
                        finalMergedItems.set(id, localItem);
                    }
                }

                for (const remoteItem of remoteItems) {
                    const id = remoteItem.id ?? remoteItem.name;
                    if (!localMap.has(id)) {
                        let isDeleted = false;
                        const entityKey = key === 'admin_tasks' ? 'adminTasks' : key === 'accounting_entries' ? 'accountingEntries' : key === 'invoice_items' ? 'invoiceItems' : key === 'case_documents' ? 'documents' : key === 'site_finances' ? 'siteFinances' : key;
                        const deletedSet = (deletedIdsSets as any)[entityKey];
                        if (deletedSet) isDeleted = deletedSet.has(id);
                        if (!isDeleted) finalMergedItems.set(id, remoteItem);
                    }
                }
                (flatUpserts as any)[key] = itemsToUpsert;
                (mergedFlatData as any)[key] = Array.from(finalMergedItems.values());
            }
            
            const validCaseIds = new Set((mergedFlatData.cases || []).map(c => c.id));
            if (mergedFlatData.case_documents) mergedFlatData.case_documents = mergedFlatData.case_documents.filter(doc => validCaseIds.has(doc.caseId));
            if (flatUpserts.case_documents) flatUpserts.case_documents = flatUpserts.case_documents.filter(doc => validCaseIds.has(doc.caseId));

            let successfulDeletions = getInitialDeletedIds();

            if (deletedIds.documentPaths && deletedIds.documentPaths.length > 0) {
                setStatus('syncing', 'جاري حذف الملفات من السحابة...');
                const supabase = getSupabaseClient();
                if (supabase) {
                    const { error: storageError } = await supabase.storage.from('documents').remove(deletedIds.documentPaths);
                    if (!storageError) successfulDeletions.documentPaths = deletedIds.documentPaths;
                }
            }
            
            const flatDeletes: Partial<FlatData> = {
                clients: deletedIds.clients.map(id => ({ id })) as any,
                cases: deletedIds.cases.map(id => ({ id })) as any,
                stages: deletedIds.stages.map(id => ({ id })) as any,
                sessions: deletedIds.sessions.map(id => ({ id })) as any,
                admin_tasks: deletedIds.adminTasks.map(id => ({ id })) as any,
                appointments: deletedIds.appointments.map(id => ({ id })) as any,
                accounting_entries: deletedIds.accountingEntries.map(id => ({ id })) as any,
                assistants: deletedIds.assistants.map(name => ({ name })),
                invoices: deletedIds.invoices.map(id => ({ id })) as any,
                invoice_items: deletedIds.invoiceItems.map(id => ({ id })) as any,
                case_documents: deletedIds.documents.map(id => ({ id })) as any,
                site_finances: deletedIds.siteFinances.map(id => ({ id })) as any,
            };

            if (Object.values(flatDeletes).some(arr => arr && arr.length > 0)) {
                setStatus('syncing', 'جاري حذف البيانات من السحابة...');
                await deleteDataFromSupabase(flatDeletes, currentUser);
                successfulDeletions = { ...successfulDeletions, ...deletedIds };
            }

            setStatus('syncing', 'جاري رفع البيانات إلى السحابة...');
            // NOTE: currentUser here might have an overridden ID (effectiveUserId) if passed from useSupabaseData
            const upsertedDataRaw = await upsertDataToSupabase(flatUpserts as FlatData, currentUser);
            const upsertedFlatData = transformRemoteToLocal(upsertedDataRaw);
            const upsertedDataMap = new Map();
            Object.values(upsertedFlatData).forEach(arr => (arr as any[])?.forEach(item => upsertedDataMap.set(item.id ?? item.name, item)));

            for (const key of Object.keys(mergedFlatData) as (keyof FlatData)[]) {
                const mergedItems = (mergedFlatData as any)[key];
                if (Array.isArray(mergedItems)) (mergedFlatData as any)[key] = mergedItems.map((item: any) => upsertedDataMap.get(item.id ?? item.name) || item);
            }

            const finalMergedData = constructData(mergedFlatData as FlatData);
            onDataSynced(finalMergedData);
            onDeletionsSynced(successfulDeletions);
            setStatus('synced');
        } catch (err: any) {
            let errorMessage = err.message || 'حدث خطأ غير متوقع.';
            if (errorMessage.toLowerCase().includes('failed to fetch')) errorMessage = 'فشل الاتصال بالخادم.';
            else console.error("Error during sync:", err);
            
            if ((errorMessage.includes('column') && errorMessage.includes('does not exist')) || errorMessage.includes('relation')) {
                setStatus('uninitialized', `هناك عدم تطابق في مخطط قاعدة البيانات: ${errorMessage}`); return;
            }
            if (err.table) errorMessage = `[جدول: ${err.table}] ${errorMessage}`;
            setStatus('error', `فشل المزامنة: ${errorMessage}`);
        }
    }, [localData, userRef, isOnline, onDataSynced, deletedIds, onDeletionsSynced, isAuthLoading, syncStatus]);

    const fetchAndRefresh = React.useCallback(async () => {
        if (syncStatus === 'syncing' || isAuthLoading) return;
        const currentUser = userRef.current;
        if (!isOnline || !currentUser) return;
    
        setStatus('syncing', 'جاري تحديث البيانات...');
        
        try {
            const [remoteDataRaw, remoteDeletions] = await Promise.all([
                fetchDataFromSupabase(),
                fetchDeletionsFromSupabase()
            ]);
            const remoteFlatDataUntyped = transformRemoteToLocal(remoteDataRaw);
    
            const deletedIdsSets = {
                clients: new Set(deletedIds.clients), cases: new Set(deletedIds.cases), stages: new Set(deletedIds.stages),
                sessions: new Set(deletedIds.sessions), adminTasks: new Set(deletedIds.adminTasks), appointments: new Set(deletedIds.appointments),
                accountingEntries: new Set(deletedIds.accountingEntries), invoices: new Set(deletedIds.invoices), invoiceItems: new Set(deletedIds.invoiceItems),
                assistants: new Set(deletedIds.assistants), documents: new Set(deletedIds.documents), profiles: new Set(deletedIds.profiles), siteFinances: new Set(deletedIds.siteFinances),
            };
    
            const remoteFlatData: Partial<FlatData> = {};
            for (const key of Object.keys(remoteFlatDataUntyped) as (keyof FlatData)[]) {
                const entityKey = key === 'admin_tasks' ? 'adminTasks' : key === 'accounting_entries' ? 'accountingEntries' : key === 'invoice_items' ? 'invoiceItems' : key === 'case_documents' ? 'documents' : key === 'site_finances' ? 'siteFinances' : key;
                const deletedSet = (deletedIdsSets as any)[entityKey];
                if (deletedSet && deletedSet.size > 0) {
                    (remoteFlatData as any)[key] = ((remoteFlatDataUntyped as any)[key] || []).filter((item: any) => !deletedSet.has(item.id ?? item.name));
                } else { (remoteFlatData as any)[key] = (remoteFlatDataUntyped as any)[key]; }
            }
    
            let localFlatData = flattenData(localData);
            // Apply deletions to local view before merge for refresh
            localFlatData = applyDeletionsToLocal(localFlatData, remoteDeletions);

            const mergedAssistants = Array.from(new Set([...localFlatData.assistants.map(a => a.name), ...(remoteFlatData.assistants || []).map(a => a.name)])).map(name => ({ name }));
    
            const mergedFlatData: FlatData = {
                clients: mergeForRefresh(localFlatData.clients, remoteFlatData.clients || []),
                cases: mergeForRefresh(localFlatData.cases, remoteFlatData.cases || []),
                stages: mergeForRefresh(localFlatData.stages, remoteFlatData.stages || []),
                sessions: mergeForRefresh(localFlatData.sessions, remoteFlatData.sessions || []),
                admin_tasks: mergeForRefresh(localFlatData.admin_tasks, remoteFlatData.admin_tasks || []),
                appointments: mergeForRefresh(localFlatData.appointments, remoteFlatData.appointments || []),
                accounting_entries: mergeForRefresh(localFlatData.accounting_entries, remoteFlatData.accounting_entries || []),
                assistants: mergedAssistants,
                invoices: mergeForRefresh(localFlatData.invoices, remoteFlatData.invoices || []),
                invoice_items: mergeForRefresh(localFlatData.invoice_items, remoteFlatData.invoice_items || []),
                case_documents: mergeForRefresh(localFlatData.case_documents, remoteFlatData.case_documents || []),
                profiles: mergeForRefresh(localFlatData.profiles, remoteFlatData.profiles || []),
                site_finances: mergeForRefresh(localFlatData.site_finances, remoteFlatData.site_finances || []),
            };
    
            const mergedData = constructData(mergedFlatData);
            onDataSynced(mergedData);
            setStatus('synced');
        } catch (err: any) {
            let errorMessage = err.message || 'حدث خطأ غير متوقع.';
            if (String(errorMessage).toLowerCase().includes('failed to fetch')) errorMessage = 'فشل الاتصال بالخادم.';
            else console.error("Error during realtime refresh:", err);
            setStatus('error', `فشل تحديث البيانات: ${errorMessage}`);
        }
    }, [localData, deletedIds, userRef, isOnline, onDataSynced, isAuthLoading, syncStatus]);

    return { manualSync, fetchAndRefresh };
};