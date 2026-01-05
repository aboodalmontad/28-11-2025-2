
import * as React from 'react';
import type { User } from '@supabase/supabase-js';
import { checkSupabaseSchema, fetchDataFromSupabase, upsertDataToSupabase, FlatData, transformRemoteToLocal, mapFetchError, fetchDeletionsFromSupabase } from './useOnlineData.js';
import { Client, Case, Stage, Session, AppData, DeletedIds } from '../types.js';

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

export const useSync = ({ user, localData, onDataSynced, onSyncStatusChange, isOnline, isAuthLoading, syncStatus }: UseSyncProps) => {
    const setStatus = (status: SyncStatus, error: string | null = null) => { 
        onSyncStatusChange(status, error); 
    };

    const manualSync = React.useCallback(async () => {
        // إذا لم يكن هناك إنترنت، لا تحاول المزامنة ولكن لا تظهر خطأ أحمر إلا إذا كانت المزامنة جارية فعلاً وفشلت
        if (!isOnline || !user || user.access_token === 'offline') {
            if (syncStatus === 'syncing' || syncStatus === 'loading') {
                setStatus('synced');
            }
            return;
        }
    
        setStatus('syncing');
        try {
            const schemaCheck = await checkSupabaseSchema();
            if (!schemaCheck.success) {
                const mappedErr = schemaCheck.error === 'network' ? 'error' : (schemaCheck.error as SyncStatus);
                setStatus(mappedErr, schemaCheck.message);
                return;
            }
    
            const remoteDataRaw = await fetchDataFromSupabase();
            const remoteFlatData = transformRemoteToLocal(remoteDataRaw);
            let localFlatData = flattenData(localData);

            const flatUpserts: Partial<FlatData> = {};
            const mergedFlatData: Partial<FlatData> = {};

            const tables = Object.keys(localFlatData) as (keyof FlatData)[];
            for (const key of tables) {
                const locals = ((localFlatData as any)[key] || []) as any[];
                const remotes = ((remoteFlatData as any)[key] || []) as any[];
                const remoteMap = new Map(remotes.map((i: any) => [i.id ?? i.name, i]));
                const finalMerged = new Map<string, any>();
                const toUpsert: any[] = [];

                for (const local of locals) {
                    const id = local.id ?? local.name;
                    const remote = remoteMap.get(id);
                    if (!remote || new Date(local.updated_at || 0) >= new Date(remote.updated_at || 0)) {
                        toUpsert.push(local);
                        finalMerged.set(id, local);
                    } else {
                        finalMerged.set(id, remote);
                    }
                }
                for (const remote of remotes) {
                    const id = remote.id ?? remote.name;
                    if (!finalMerged.has(id)) finalMerged.set(id, remote);
                }
                (flatUpserts as any)[key] = toUpsert;
                (mergedFlatData as any)[key] = Array.from(finalMerged.values());
            }
            
            await upsertDataToSupabase(flatUpserts as FlatData, user);
            onDataSynced(constructData(mergedFlatData as FlatData));
            setStatus('synced');
        } catch (err: any) {
            console.error("Sync Failure:", err);
            setStatus('error', mapFetchError(err)); 
        }
    }, [isOnline, user, localData, syncStatus, isAuthLoading, onDataSynced]);

    return { manualSync };
};
