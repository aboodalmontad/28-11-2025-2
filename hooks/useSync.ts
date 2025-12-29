
import * as React from 'react';
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

export const useSync = ({ user, localData, deletedIds, onDataSynced, onDeletionsSynced, onSyncStatusChange, onDocumentsUploaded, excludedDocIds, isOnline, isAuthLoading, syncStatus }: UseSyncProps) => {
    const userRef = React.useRef(user);
    const localDataRef = React.useRef(localData);
    const deletedIdsRef = React.useRef(deletedIds);
    const syncStatusRef = React.useRef(syncStatus);
    const isSyncing = React.useRef(false);

    userRef.current = user;
    localDataRef.current = localData;
    deletedIdsRef.current = deletedIds;
    syncStatusRef.current = syncStatus;

    const setStatus = (status: SyncStatus, error: string | null = null) => { onSyncStatusChange(status, error); };

    const manualSync = React.useCallback(async () => {
        if (isSyncing.current || isAuthLoading) return;
        const currentUser = userRef.current;
        if (!isOnline || !currentUser) {
            setStatus('error', isOnline ? 'يجب تسجيل الدخول.' : 'أنت غير متصل بالإنترنت.');
            return;
        }
    
        isSyncing.current = true;
        setStatus('syncing', 'جاري التحقق...');
        
        try {
            const schemaCheck = await checkSupabaseSchema();
            if (!schemaCheck.success) {
                setStatus(schemaCheck.error as SyncStatus, schemaCheck.message);
                isSyncing.current = false;
                return;
            }

            // 1. جلب البيانات والحذوفات
            const [remoteDataRaw, remoteDeletions] = await Promise.all([
                fetchDataFromSupabase(),
                fetchDeletionsFromSupabase()
            ]);
            const remoteFlatData = transformRemoteToLocal(remoteDataRaw);
            const localFlatData = flattenData(localDataRef.current);
            
            // 2. معالجة الحذف المحلي ورفعه للسحابة
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
                case_documents: deletedIdsRef.current.documents.map(id => ({ id })) as any,
            };

            if (Object.values(flatDeletes).some(arr => arr && arr.length > 0)) {
                await deleteDataFromSupabase(flatDeletes, currentUser);
                onDeletionsSynced(deletedIdsRef.current);
            }

            // 3. دمج البيانات (الأحدث يفوز)
            const flatUpserts: Partial<FlatData> = {};
            const mergedFlatData: Partial<FlatData> = {};

            for (const key of Object.keys(localFlatData) as (keyof FlatData)[]) {
                const localItems = (localFlatData as any)[key] as any[];
                const remoteItems = (remoteFlatData as any)[key] as any[] || [];
                const localMap = new Map(localItems.map(i => [i.id ?? i.name, i]));
                const remoteMap = new Map(remoteItems.map(i => [i.id ?? i.name, i]));
                const finalItems = new Map<string, any>();
                const toUpsert: any[] = [];

                // معالجة البيانات المحلية
                for (const l of localItems) {
                    const id = l.id ?? l.name;
                    const r = remoteMap.get(id);
                    if (r) {
                        const lTime = new Date(l.updated_at || 0).getTime();
                        const rTime = new Date(r.updated_at || 0).getTime();
                        if (lTime > rTime) { toUpsert.push(l); finalItems.set(id, l); }
                        else { finalItems.set(id, r); }
                    } else {
                        toUpsert.push(l); finalItems.set(id, l);
                    }
                }

                // إضافة البيانات السحابية الجديدة
                for (const r of remoteItems) {
                    const id = r.id ?? r.name;
                    if (!finalItems.has(id)) finalItems.set(id, r);
                }

                (flatUpserts as any)[key] = toUpsert;
                (mergedFlatData as any)[key] = Array.from(finalItems.values());
            }

            // 4. رفع التغييرات
            await upsertDataToSupabase(flatUpserts as FlatData, currentUser);
            
            const finalData = constructData(mergedFlatData as FlatData);
            onDataSynced(finalData);
            setStatus('synced');
        } catch (err: any) {
            console.error("Sync Error:", err);
            setStatus('error', `خطأ: ${err.message}`);
        } finally {
            isSyncing.current = false;
        }
    }, [isOnline, isAuthLoading, onDataSynced, onDeletionsSynced]);

    // Fix: Added fetchAndRefresh alias for manualSync to resolve property missing error in useSupabaseData.
    const fetchAndRefresh = manualSync;

    return { manualSync, fetchAndRefresh };
};
