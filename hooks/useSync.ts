import * as React from 'react';
// Fix: Use `import type` for User as it is used as a type, not a value. This resolves module resolution errors in some environments.
import type { User } from '@supabase/supabase-js';
import { checkSupabaseSchema, fetchDataFromSupabase, upsertDataToSupabase, FlatData, deleteDataFromSupabase, transformRemoteToLocal, fetchDeletionsFromSupabase } from './useOnlineData';
import { getSupabaseClient } from '../supabaseClient';
import { Client, Case, Stage, Session, CaseDocument, AppData, DeletedIds, getInitialDeletedIds, SyncDeletion } from '../types';
import { getDb, DOCS_FILES_STORE_NAME } from '../utils/db';

export type SyncStatus = 'loading' | 'syncing' | 'synced' | 'error' | 'unconfigured' | 'uninitialized';


interface UseSyncProps {
    user: User | null;
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

const applyDeletionsToLocal = (localFlatData: FlatData, deletions: SyncDeletion[]): FlatData => {
    if (!deletions || deletions.length === 0) return localFlatData;

    const deletionMap = new Map<string, string>(); // RecordID -> DeletedAt ISO
    deletions.forEach(d => {
        deletionMap.set(`${d.table_name}:${d.record_id}`, d.deleted_at);
    });

    const filterItems = (items: any[], tableName: string) => {
        return items.filter(item => {
            const id = item.id ?? item.name;
            const key = `${tableName}:${id}`;
            const deletedAtStr = deletionMap.get(key);
            
            if (deletedAtStr) {
                const deletedAt = new Date(deletedAtStr).getTime();
                const updatedAt = new Date(item.updated_at || 0).getTime();
                if (updatedAt < (deletedAt + 2000)) {
                    return false;
                }
            }
            return true;
        });
    };

    const filteredClients = filterItems(localFlatData.clients, 'clients');
    const clientIds = new Set(filteredClients.map(c => c.id));
    
    let filteredCases = filterItems(localFlatData.cases, 'cases');
    filteredCases = filteredCases.filter(c => clientIds.has(c.client_id));
    const caseIds = new Set(filteredCases.map(c => c.id));
    
    let filteredStages = filterItems(localFlatData.stages, 'stages');
    filteredStages = filteredStages.filter(s => caseIds.has(s.case_id));
    const stageIds = new Set(filteredStages.map(s => s.id));
    
    let filteredSessions = filterItems(localFlatData.sessions, 'sessions');
    filteredSessions = filteredSessions.filter(s => stageIds.has(s.stage_id));
    
    let filteredInvoices = filterItems(localFlatData.invoices, 'invoices');
    filteredInvoices = filteredInvoices.filter(i => clientIds.has(i.client_id));
    const invoiceIds = new Set(filteredInvoices.map(i => i.id));
    
    let filteredInvoiceItems = filterItems(localFlatData.invoice_items, 'invoice_items');
    filteredInvoiceItems = filteredInvoiceItems.filter(i => invoiceIds.has(i.invoice_id));
    
    let filteredDocs = filterItems(localFlatData.case_documents, 'case_documents');
    filteredDocs = filteredDocs.filter(d => caseIds.has(d.caseId)); 
    
    let filteredEntries = filterItems(localFlatData.accounting_entries, 'accounting_entries');
    filteredEntries = filteredEntries.filter(e => !e.clientId || clientIds.has(e.clientId));

    return {
        ...localFlatData,
        clients: filteredClients,
        cases: filteredCases,
        stages: filteredStages,
        sessions: filteredSessions,
        invoices: filteredInvoices,
        invoice_items: filteredInvoiceItems,
        case_documents: filteredDocs,
        accounting_entries: filteredEntries,
        admin_tasks: filterItems(localFlatData.admin_tasks, 'admin_tasks'),
        appointments: filterItems(localFlatData.appointments, 'appointments'),
        assistants: filterItems(localFlatData.assistants, 'assistants'),
        site_finances: filterItems(localFlatData.site_finances, 'site_finances'),
        profiles: localFlatData.profiles,
    };
};

const cleanupExpiredDocuments = async (remoteDocs: any[], supabase: any) => {
    const hours72Ago = new Date(Date.now() - 72 * 60 * 60 * 1000);
    const expiredDocs = remoteDocs.filter((d: any) => new Date(d.added_at) < hours72Ago);

    if (expiredDocs.length > 0) {
        console.log(`Cleaning up ${expiredDocs.length} expired documents from cloud...`);
        const expiredIds = expiredDocs.map((d: any) => d.id);
        const expiredPaths = expiredDocs.map((d: any) => d.storage_path).filter((p: any) => !!p);

        const { error: dbError } = await supabase.from('case_documents').delete().in('id', expiredIds);
        if (dbError) {
            console.error("Failed to delete expired docs metadata:", dbError);
        } else {
            if (expiredPaths.length > 0) {
                const { error: storageError } = await supabase.storage.from('documents').remove(expiredPaths);
                if (storageError) console.error("Failed to delete expired docs files:", storageError);
            }
        }
    }
};

export const useSync = ({ user, localData, deletedIds, onDataSynced, onDeletionsSynced, onSyncStatusChange, onDocumentsUploaded, excludedDocIds, isOnline, isAuthLoading, syncStatus }: UseSyncProps) => {
    const isSyncingInProgress = React.useRef(false);
    const isMounted = React.useRef(true);

    React.useEffect(() => {
        return () => { isMounted.current = false; };
    }, []);

    const userRef = React.useRef(user);
    const localDataRef = React.useRef(localData);
    const deletedIdsRef = React.useRef(deletedIds);
    const excludedDocIdsRef = React.useRef(excludedDocIds);

    userRef.current = user;
    localDataRef.current = localData;
    deletedIdsRef.current = deletedIds;
    excludedDocIdsRef.current = excludedDocIds;

    const setStatus = (status: SyncStatus, error: string | null = null) => { 
        if (isMounted.current) onSyncStatusChange(status, error); 
    };

    const manualSync = React.useCallback(async () => {
        // Strict guard against overlapping syncs
        if (isSyncingInProgress.current) {
            console.log("Sync already in progress, skipping duplicate call.");
            return;
        }
        
        const currentUser = userRef.current;
        if (isAuthLoading || !isOnline || !currentUser) {
            if (!isOnline) setStatus('error', 'يجب أن تكون متصلاً بالإنترنت للمزامنة.');
            return;
        }
    
        isSyncingInProgress.current = true;
        setStatus('syncing', 'جاري المزامنة...');
        
        try {
            const schemaCheck = await checkSupabaseSchema();
            if (!schemaCheck.success) {
                if (schemaCheck.error === 'unconfigured') setStatus('unconfigured');
                else if (schemaCheck.error === 'uninitialized') setStatus('uninitialized', schemaCheck.message);
                else setStatus('error', schemaCheck.message);
                isSyncingInProgress.current = false;
                return;
            }

            // 0. Upload Pending Files
            const pendingDocs = localDataRef.current.documents.filter(d => d.localState === 'pending_upload');
            const uploadedDocIds: string[] = [];
            const supabase = getSupabaseClient();

            if (pendingDocs.length > 0 && supabase) {
                const db = await getDb();
                for (const doc of pendingDocs) {
                    try {
                        const file = await db.get(DOCS_FILES_STORE_NAME, doc.id);
                        if (file) {
                            const { error: uploadError } = await supabase.storage.from('documents').upload(doc.storagePath, file, { upsert: true });
                            if (!uploadError) uploadedDocIds.push(doc.id);
                        }
                    } catch (e) { console.error(`Doc upload failed: ${doc.id}`, e); }
                }
                if (uploadedDocIds.length > 0 && onDocumentsUploaded) onDocumentsUploaded(uploadedDocIds);
            }

            // 1. Fetch Remote
            const [remoteDataRaw, remoteDeletions] = await Promise.all([
                fetchDataFromSupabase(),
                fetchDeletionsFromSupabase()
            ]);
            
            if (!isMounted.current) {
                isSyncingInProgress.current = false;
                return;
            }
            
            const remoteFlatData = transformRemoteToLocal(remoteDataRaw);
            if (supabase && remoteDataRaw.case_documents) await cleanupExpiredDocuments(remoteDataRaw.case_documents, supabase);

            // 2. Merge Logic
            let localFlatData = flattenData(localDataRef.current);
            localFlatData = applyDeletionsToLocal(localFlatData, remoteDeletions);

            const flatUpserts: Partial<FlatData> = {};
            const mergedFlatData: Partial<FlatData> = {};
            const deletedIdsSets = {
                clients: new Set(deletedIdsRef.current.clients), cases: new Set(deletedIdsRef.current.cases), stages: new Set(deletedIdsRef.current.stages),
                sessions: new Set(deletedIdsRef.current.sessions), adminTasks: new Set(deletedIdsRef.current.adminTasks), appointments: new Set(deletedIdsRef.current.appointments),
                accountingEntries: new Set(deletedIdsRef.current.accountingEntries), invoices: new Set(deletedIdsRef.current.invoices),
                invoiceItems: new Set(deletedIdsRef.current.invoiceItems), assistants: new Set(deletedIdsRef.current.assistants),
                documents: new Set(deletedIdsRef.current.documents), profiles: new Set(deletedIdsRef.current.profiles), siteFinances: new Set(deletedIdsRef.current.siteFinances),
            };

            for (const key of Object.keys(localFlatData) as (keyof FlatData)[]) {
                const localItems = (localFlatData as any)[key] as any[];
                const remoteItems = (remoteFlatData as any)[key] as any[] || [];
                const remoteMap = new Map(remoteItems.map(i => [i.id ?? i.name, i]));
                const finalMergedItems = new Map<string, any>();
                const itemsToUpsert: any[] = [];

                for (const localItem of localItems) {
                    const id = localItem.id ?? localItem.name;
                    if (key === 'case_documents' && localItem.localState === 'pending_upload' && !uploadedDocIds.includes(id)) {
                        finalMergedItems.set(id, localItem);
                        continue;
                    }
                    const remoteItem = remoteMap.get(id);
                    if (remoteItem) {
                        const localDate = new Date(localItem.updated_at || 0).getTime();
                        const remoteDate = new Date(remoteItem.updated_at || 0).getTime();
                        if (localDate > remoteDate) {
                            itemsToUpsert.push(localItem);
                            finalMergedItems.set(id, localItem);
                        } else { finalMergedItems.set(id, remoteItem); }
                    } else {
                        itemsToUpsert.push(localItem);
                        finalMergedItems.set(id, localItem);
                    }
                }

                for (const remoteItem of remoteItems) {
                    const id = remoteItem.id ?? remoteItem.name;
                    if (!finalMergedItems.has(id)) {
                        const entityKey = key === 'admin_tasks' ? 'adminTasks' : key === 'accounting_entries' ? 'accountingEntries' : key === 'invoice_items' ? 'invoiceItems' : key === 'case_documents' ? 'documents' : key === 'site_finances' ? 'siteFinances' : key;
                        const isLocallyDeleted = (deletedIdsSets as any)[entityKey]?.has(id);
                        const isExcludedDoc = key === 'case_documents' && excludedDocIdsRef.current?.has(id);
                        if (!isLocallyDeleted && !isExcludedDoc) finalMergedItems.set(id, remoteItem);
                    }
                }
                (flatUpserts as any)[key] = itemsToUpsert;
                (mergedFlatData as any)[key] = Array.from(finalMergedItems.values());
            }

            // 3. Deletions
            let successfulDeletions = getInitialDeletedIds();
            if (deletedIdsRef.current.documentPaths?.length > 0 && supabase) {
                await supabase.storage.from('documents').remove(deletedIdsRef.current.documentPaths);
                successfulDeletions.documentPaths = [...deletedIdsRef.current.documentPaths];
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

            await deleteDataFromSupabase(flatDeletes, currentUser);
            successfulDeletions = { ...successfulDeletions, ...deletedIdsRef.current };

            // 4. Upsert
            const upsertedDataRaw = await upsertDataToSupabase(flatUpserts as FlatData, currentUser);
            const upsertedFlatData = transformRemoteToLocal(upsertedDataRaw);
            const upsertedDataMap = new Map();
            Object.values(upsertedFlatData).forEach(arr => (arr as any[])?.forEach(item => upsertedDataMap.set(item.id ?? item.name, item)));

            for (const key of Object.keys(mergedFlatData) as (keyof FlatData)[]) {
                const mergedItems = (mergedFlatData as any)[key];
                if (Array.isArray(mergedItems)) (mergedFlatData as any)[key] = mergedItems.map((item: any) => upsertedDataMap.get(item.id ?? item.name) || item);
            }

            if (isMounted.current) {
                onDataSynced(constructData(mergedFlatData as FlatData));
                onDeletionsSynced(successfulDeletions);
                setStatus('synced');
            }
        } catch (err: any) {
            console.error("Sync Failure Details:", err);
            const msg = String(err.message || 'فشل المزامنة').toLowerCase();
            // Don't show abort errors as they are expected when navigation happens during sync
            if (!msg.includes('abort')) {
                setStatus('error', msg.includes('failed to fetch') ? 'تعذر الاتصال بالسيرفر. يرجى التحقق من الإنترنت.' : msg);
            }
        } finally {
            isSyncingInProgress.current = false;
        }
    }, [isOnline, onDataSynced, onDeletionsSynced, isAuthLoading, onDocumentsUploaded]);

    const fetchAndRefresh = React.useCallback(async () => {
        if (isSyncingInProgress.current) return;
        const currentUser = userRef.current;
        if (!isOnline || !currentUser) return;
        isSyncingInProgress.current = true;
        try {
            const remoteDataRaw = await fetchDataFromSupabase();
            if (isMounted.current) {
                const remoteFlatData = transformRemoteToLocal(remoteDataRaw);
                onDataSynced(constructData(remoteFlatData as FlatData));
                setStatus('synced');
            }
        } catch (err: any) {
            console.error("Refresh Failure:", err);
        } finally {
            isSyncingInProgress.current = false;
        }
    }, [isOnline, onDataSynced]);

    return { manualSync, fetchAndRefresh };
};