import * as React from 'react';
import type { User } from '@supabase/supabase-js';
import { checkSupabaseSchema, fetchDataFromSupabase, upsertDataToSupabase, FlatData, deleteDataFromSupabase, transformRemoteToLocal, fetchDeletionsFromSupabase, isNetworkError, fetchWithRetry } from './useOnlineData.ts';
import { getSupabaseClient } from '../supabaseClient.ts';
import { Client, Case, Stage, Session, CaseDocument, AppData, DeletedIds, getInitialDeletedIds, SyncDeletion } from '../types.ts';
import { getDb, DOCS_FILES_STORE_NAME } from '../utils/db.ts';

export type SyncStatus = 'loading' | 'syncing' | 'synced' | 'error' | 'unconfigured' | 'uninitialized';

interface UseSyncProps {
    user: User | null;
    effectiveUserId: string | null;
    localData: AppData;
    deletedIds: DeletedIds;
    onDataSynced: (mergedData: AppData) => void;
    onDeletionsSynced: (syncedDeletions: Partial<DeletedIds>) => void;
    onSyncStatusChange: (status: SyncStatus, error: string | null) => void;
    onDocumentsUploaded?: (uploadedDocIds: string[]) => void;
    excludedDocIds?: Set<string>;
    isOnline: boolean;
    isAuthLoading: boolean;
    syncStatus: SyncStatus;
}

const flattenData = (data: AppData): FlatData => {
    const cases = data.clients.flatMap(c => c.cases.map(cs => ({ ...cs, client_id: c.id, clientId: c.id })));
    const stages = cases.flatMap(cs => cs.stages.map(st => ({ ...st, case_id: cs.id, caseId: cs.id })));
    const sessions = stages.flatMap(st => st.sessions.map(s => ({ ...s, stage_id: st.id, stageId: st.id })));
    const invoice_items = data.invoices.flatMap(inv => inv.items.map(item => ({ ...item, invoice_id: inv.id, invoiceId: inv.id })));

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
        const stageId = (s as any).stageId || (s as any).stage_id;
        if (stageId) {
            if (!sessionMap.has(stageId)) sessionMap.set(stageId, []);
            sessionMap.get(stageId)!.push(s as Session);
        }
    });

    const stageMap = new Map<string, Stage[]>();
    (flatData.stages || []).forEach(st => {
        const stage = { ...st, sessions: sessionMap.get(st.id) || [] } as Stage;
        const caseId = (st as any).caseId || (st as any).case_id;
        if (caseId) {
            if (!stageMap.has(caseId)) stageMap.set(caseId, []);
            stageMap.get(caseId)!.push(stage);
        }
    });

    const caseMap = new Map<string, Case[]>();
    (flatData.cases || []).forEach(cs => {
        const caseItem = { ...cs, stages: stageMap.get(cs.id) || [] } as Case;
        const clientId = (cs as any).clientId || (cs as any).client_id;
        if (clientId) {
            if (!caseMap.has(clientId)) caseMap.set(clientId, []);
            caseMap.get(clientId)!.push(caseItem);
        }
    });
    
    const invoiceItemMap = new Map<string, any[]>();
    (flatData.invoice_items || []).forEach(item => {
        const invoiceId = (item as any).invoiceId || (item as any).invoice_id;
        if(invoiceId) {
            if(!invoiceItemMap.has(invoiceId)) invoiceItemMap.set(invoiceId, []);
            invoiceItemMap.get(invoiceId)!.push(item);
        }
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
            const remoteDate = new Date(remoteItem.updated_at || 0).getTime();
            const localDate = new Date(existingItem.updated_at || 0).getTime();
            if (remoteDate > localDate) finalItems.set(id, remoteItem);
        } else { finalItems.set(id, remoteItem); }
    }
    return Array.from(finalItems.values());
};

const applyDeletionsToLocal = (localFlatData: FlatData, deletions: SyncDeletion[]): FlatData => {
    if (!deletions || deletions.length === 0) return localFlatData;
    const deletionMap = new Map<string, string>();
    deletions.forEach(d => { deletionMap.set(`${d.table_name}:${d.record_id}`, d.deleted_at); });

    const filterItems = (items: any[], tableName: string) => {
        return items.filter(item => {
            const id = item.id ?? item.name;
            const key = `${tableName}:${id}`;
            const deletedAtStr = deletionMap.get(key);
            if (deletedAtStr) {
                const deletedAt = new Date(deletedAtStr).getTime();
                const updatedAt = new Date(item.updated_at || 0).getTime();
                if (updatedAt < (deletedAt + 2000)) return false;
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
        invoices: filterItems(localFlatData.invoices, 'invoices'),
        invoice_items: filterItems(localFlatData.invoice_items, 'invoice_items'),
        case_documents: filterItems(localFlatData.case_documents, 'case_documents'),
        accounting_entries: filterItems(localFlatData.accounting_entries, 'accounting_entries'),
        admin_tasks: filterItems(localFlatData.admin_tasks, 'admin_tasks'),
        appointments: filterItems(localFlatData.appointments, 'appointments'),
        assistants: filterItems(localFlatData.assistants, 'assistants'),
        site_finances: filterItems(localFlatData.site_finances, 'site_finances'),
        profiles: localFlatData.profiles,
    };
};

export const useSync = ({ user, effectiveUserId, localData, deletedIds, onDataSynced, onDeletionsSynced, onSyncStatusChange, onDocumentsUploaded, excludedDocIds, isOnline, isAuthLoading, syncStatus }: UseSyncProps) => {
    const userRef = React.useRef(user);
    const ownerRef = React.useRef(effectiveUserId);
    const localDataRef = React.useRef(localData);
    const deletedIdsRef = React.useRef(deletedIds);
    const excludedDocIdsRef = React.useRef(excludedDocIds);
    const syncStatusRef = React.useRef(syncStatus);

    userRef.current = user;
    ownerRef.current = effectiveUserId;
    localDataRef.current = localData;
    deletedIdsRef.current = deletedIds;
    excludedDocIdsRef.current = excludedDocIds;
    syncStatusRef.current = syncStatus;

    const setStatus = (status: SyncStatus, error: string | null = null) => { onSyncStatusChange(status, error); };

    const manualSync = React.useCallback(async () => {
        if (syncStatusRef.current === 'syncing' || isAuthLoading) return;
        const realUser = userRef.current;
        const ownerId = ownerRef.current;
        if (!isOnline || !realUser || !ownerId) return;

        setStatus('syncing', 'جاري المزامنة...');
        try {
            const schemaCheck = await fetchWithRetry(() => checkSupabaseSchema());
            if (!schemaCheck.success) {
                setStatus('error', schemaCheck.message);
                return;
            }

            const [remoteDataRaw, remoteDeletions] = await Promise.all([
                fetchWithRetry(() => fetchDataFromSupabase()),
                fetchWithRetry(() => fetchDeletionsFromSupabase())
            ]);

            const remoteFlatData = transformRemoteToLocal(remoteDataRaw);
            let localFlatData = applyDeletionsToLocal(flattenData(localDataRef.current), remoteDeletions);

            const flatUpserts: Partial<FlatData> = {};
            const mergedFlatData: Partial<FlatData> = {};

            for (const key of Object.keys(localFlatData) as (keyof FlatData)[]) {
                const localItems = (localFlatData as any)[key] || [];
                const remoteItems = (remoteFlatData as any)[key] || [];
                const remoteMap = new Map(remoteItems.map((i: any) => [i.id ?? i.name, i]));
                const finalMergedItems = new Map<string, any>();
                const itemsToUpsert: any[] = [];

                for (const localItem of localItems) {
                    const id = localItem.id ?? localItem.name;
                    const remoteItem = remoteMap.get(id);
                    // Fix: Cast localItem and remoteItem to any to safely access updated_at which may not exist on all entity types (like assistants)
                    if (!remoteItem || new Date((localItem as any).updated_at || 0).getTime() >= new Date((remoteItem as any).updated_at || 0).getTime()) {
                        itemsToUpsert.push(localItem);
                        finalMergedItems.set(id, localItem);
                    } else {
                        finalMergedItems.set(id, remoteItem);
                    }
                }
                for (const remoteItem of remoteItems) {
                    const id = remoteItem.id ?? remoteItem.name;
                    if (!finalMergedItems.has(id)) finalMergedItems.set(id, remoteItem);
                }
                (flatUpserts as any)[key] = itemsToUpsert;
                (mergedFlatData as any)[key] = Array.from(finalMergedItems.values());
            }

            const flatDeletes: Partial<FlatData> = {
                clients: deletedIdsRef.current.clients.map(id => ({ id })) as any,
                cases: deletedIdsRef.current.cases.map(id => ({ id })) as any,
                stages: deletedIdsRef.current.stages.map(id => ({ id })) as any,
                sessions: deletedIdsRef.current.sessions.map(id => ({ id })) as any,
                admin_tasks: deletedIdsRef.current.adminTasks.map(id => ({ id })) as any,
                appointments: deletedIdsRef.current.appointments.map(id => ({ id })) as any,
                accounting_entries: deletedIdsRef.current.accountingEntries.map(id => ({ id })) as any,
                assistants: deletedIdsRef.current.assistants.map(name => ({ name })),
                invoices: deletedIdsRef.current.invoices.map(id => ({ id })) as any,
                invoice_items: deletedIdsRef.current.invoiceItems.map(id => ({ id })) as any,
                case_documents: deletedIdsRef.current.documents.map(id => ({ id })) as any,
                site_finances: deletedIdsRef.current.siteFinances.map(id => ({ id })) as any,
            };

            if (Object.values(flatDeletes).some(arr => arr && arr.length > 0)) {
                await deleteDataFromSupabase(flatDeletes, realUser);
            }

            const upsertedDataRaw = await fetchWithRetry(() => upsertDataToSupabase(flatUpserts as FlatData, realUser, ownerId));
            const finalMergedData = constructData(mergedFlatData as FlatData);
            
            onDataSynced(finalMergedData);
            onDeletionsSynced(deletedIdsRef.current);
            setStatus('synced');
        } catch (err: any) {
            console.error("Sync Error:", err);
            setStatus('error', isNetworkError(err) ? 'فشل الاتصال بالشبكة.' : err.message);
        }
    }, [isOnline, onDataSynced, onDeletionsSynced, isAuthLoading]);

    // Fix: manualSync and fetchAndRefresh are often used interchangeably in the UI. 
    // fetchAndRefresh logic is inherently handled by manualSync (full bi-directional sync).
    return { manualSync, fetchAndRefresh: manualSync };
};