
import * as React from 'react';
import type { User } from '@supabase/supabase-js';
import { checkSupabaseSchema, fetchDataFromSupabase, upsertDataToSupabase, FlatData, deleteDataFromSupabase, transformRemoteToLocal, fetchDeletionsFromSupabase } from './useOnlineData';
import { AppData, DeletedIds, getInitialDeletedIds, Session, Client, Case, Stage } from '../types';

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

// Helper to safely convert to Date
const revive = (d: any) => {
    if (!d) return new Date();
    const date = new Date(d);
    return isNaN(date.getTime()) ? new Date() : date;
};

const flattenData = (data: AppData): FlatData => {
    const cases = data.clients.flatMap(c => c.cases.map(cs => ({ ...cs, client_id: c.id })));
    const stages = cases.flatMap(cs => cs.stages.map(st => ({ ...st, case_id: cs.id })));
    const sessions = stages.flatMap(st => st.sessions.map(s => ({ ...s, stage_id: st.id })));
    return {
        clients: data.clients.map(({ cases, ...cl }) => cl),
        cases: cases.map(({ stages, ...cs }) => cs),
        stages: stages.map(({ sessions, ...st }) => st),
        sessions,
        admin_tasks: data.adminTasks,
        appointments: data.appointments,
        accounting_entries: data.accountingEntries,
        assistants: data.assistants.map(name => ({ name })),
        invoices: data.invoices.map(({ items, ...inv }) => inv),
        invoice_items: data.invoices.flatMap(inv => inv.items.map(i => ({ ...i, invoice_id: inv.id }))),
        case_documents: data.documents,
        profiles: data.profiles,
        site_finances: data.siteFinances,
    };
};

const constructData = (flat: Partial<FlatData>): AppData => {
    const sessionMap = new Map<string, Session[]>();
    (flat.sessions || []).forEach(s => {
        const sid = (s as any).stage_id;
        if (!sessionMap.has(sid)) sessionMap.set(sid, []);
        sessionMap.get(sid)!.push({ ...s, date: revive(s.date), nextSessionDate: s.nextSessionDate ? revive(s.nextSessionDate) : undefined } as Session);
    });

    const stageMap = new Map<string, Stage[]>();
    (flat.stages || []).forEach(st => {
        const stage = { 
            ...st, 
            firstSessionDate: st.firstSessionDate ? revive(st.firstSessionDate) : undefined,
            decisionDate: st.decisionDate ? revive(st.decisionDate) : undefined,
            sessions: sessionMap.get(st.id) || [] 
        } as Stage;
        const cid = (st as any).case_id;
        if (!stageMap.has(cid)) stageMap.set(cid, []);
        stageMap.get(cid)!.push(stage);
    });

    const caseMap = new Map<string, Case[]>();
    (flat.cases || []).forEach(cs => {
        const caseItem = { ...cs, stages: stageMap.get(cs.id) || [] } as Case;
        const clid = (cs as any).client_id;
        if (!caseMap.has(clid)) caseMap.set(clid, []);
        caseMap.get(clid)!.push(caseItem);
    });

    return {
        clients: (flat.clients || []).map(c => ({ ...c, cases: caseMap.get(c.id) || [] } as Client)),
        adminTasks: (flat.admin_tasks || []).map(t => ({ ...t, dueDate: revive(t.dueDate) })) as any,
        appointments: (flat.appointments || []).map(a => ({ ...a, date: revive(a.date) })) as any,
        accountingEntries: (flat.accounting_entries || []).map(e => ({ ...e, date: revive(e.date) })) as any,
        assistants: (flat.assistants || []).map(a => a.name),
        invoices: (flat.invoices || []).map(inv => ({ 
            ...inv, 
            issueDate: revive(inv.issueDate), 
            dueDate: revive(inv.dueDate),
            items: (flat.invoice_items || []).filter(i => (i as any).invoice_id === inv.id) 
        })) as any,
        documents: (flat.case_documents || []).map(d => ({ ...d, addedAt: revive(d.addedAt) })) as any,
        profiles: (flat.profiles || []) as any,
        siteFinances: (flat.site_finances || []) as any,
    };
};

export const useSync = ({ user, localData, deletedIds, onDataSynced, onDeletionsSynced, onSyncStatusChange, isOnline, isAuthLoading, syncStatus }: UseSyncProps) => {
    
    const manualSync = React.useCallback(async () => {
        if (!isOnline || !user || syncStatus === 'syncing') return;

        onSyncStatusChange('syncing', 'جاري المزامنة مع السحابة...');
        try {
            const [remoteRaw, remoteDeletions] = await Promise.all([
                fetchDataFromSupabase(),
                fetchDeletionsFromSupabase()
            ]);
            const remoteFlat = transformRemoteToLocal(remoteRaw);
            const localFlat = flattenData(localData);

            const mergedFlat: Partial<FlatData> = {};
            const toUpsert: Partial<FlatData> = {};

            const tableKeys = Object.keys(localFlat) as (keyof FlatData)[];
            tableKeys.forEach(table => {
                const localItems = (localFlat as any)[table] || [];
                const remoteItems = (remoteFlat as any)[table] || [];
                const mergedMap = new Map<string, any>();
                const upsertList: any[] = [];

                remoteItems.forEach((r: any) => mergedMap.set(r.id || r.name, r));

                localItems.forEach((l: any) => {
                    const id = l.id || l.name;
                    const r = mergedMap.get(id);
                    if (!r || new Date(l.updated_at || 0) > new Date(r.updated_at || 0)) {
                        mergedMap.set(id, l);
                        upsertList.push(l);
                    }
                });

                remoteDeletions.filter(d => d.table_name === table).forEach(d => {
                    const item = mergedMap.get(d.record_id);
                    if (item && new Date(item.updated_at || 0) < new Date(d.deleted_at)) {
                        mergedMap.delete(d.record_id);
                    }
                });

                (mergedFlat as any)[table] = Array.from(mergedMap.values());
                (toUpsert as any)[table] = upsertList;
            });

            const deletionsFlat: Partial<FlatData> = {
                clients: deletedIds.clients.map(id => ({ id } as any)),
                cases: deletedIds.cases.map(id => ({ id } as any)),
                stages: deletedIds.stages.map(id => ({ id } as any)),
                sessions: deletedIds.sessions.map(id => ({ id } as any)),
                admin_tasks: deletedIds.adminTasks.map(id => ({ id } as any)),
                appointments: deletedIds.appointments.map(id => ({ id } as any)),
                accounting_entries: deletedIds.accountingEntries.map(id => ({ id } as any)),
                assistants: deletedIds.assistants.map(name => ({ name } as any)),
                invoices: deletedIds.invoices.map(id => ({ id } as any)),
                invoice_items: deletedIds.invoiceItems.map(id => ({ id } as any)),
                case_documents: deletedIds.documents.map(id => ({ id } as any)),
                profiles: deletedIds.profiles.map(id => ({ id } as any)),
                site_finances: deletedIds.siteFinances.map(id => ({ id: Number(id) } as any)),
            };

            await Promise.all([
                upsertDataToSupabase(toUpsert, user),
                deleteDataFromSupabase(deletionsFlat, user)
            ]);

            onDataSynced(constructData(mergedFlat));
            onDeletionsSynced(deletedIds);
            onSyncStatusChange('synced', null);
        } catch (err: any) {
            console.error("Sync Error Details:", err);
            
            let msg = "حدث خطأ غير معروف";
            if (typeof err === 'string') {
                msg = err;
            } else if (err?.message) {
                msg = err.message;
            } else if (err?.error_description) {
                msg = err.error_description;
            } else {
                try {
                    msg = JSON.stringify(err);
                } catch (e) {
                    msg = String(err);
                }
            }

            const isNetworkError = msg.toLowerCase().includes('failed to fetch') || 
                                 msg.toLowerCase().includes('network') || 
                                 msg.toLowerCase().includes('load failed');
            
            onSyncStatusChange('error', isNetworkError ? 'فشل الاتصال بالسيرفر (تحقق من الإنترنت)' : msg);
        }
    }, [isOnline, user, localData, deletedIds, syncStatus, onDataSynced, onDeletionsSynced, onSyncStatusChange]);

    // Delayed Background Sync: Wait 3 seconds after boot or connectivity to start syncing
    // This keeps the initial UI render smooth and fast.
    React.useEffect(() => {
        if (isOnline && !isAuthLoading && syncStatus === 'loading' && user) {
            const timer = setTimeout(() => {
                manualSync();
            }, 3000);
            return () => clearTimeout(timer);
        }
    }, [isOnline, isAuthLoading, syncStatus, manualSync, user]);

    return { manualSync, fetchAndRefresh: manualSync };
};
