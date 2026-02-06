
import * as React from 'react';
import type { User } from '@supabase/supabase-js';
import { fetchDataFromSupabase, upsertDataToSupabase, FlatData, deleteDataFromSupabase, transformRemoteToLocal, fetchDeletionsFromSupabase } from './useOnlineData';
import { AppData, DeletedIds, Session, Client, Case, Stage } from '../types';

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

const revive = (d: any) => d ? new Date(d) : new Date();

const flattenData = (data: AppData): FlatData => {
    const cases = (data.clients || []).flatMap(c => (c.cases || []).map(cs => ({ ...cs, client_id: c.id })));
    const stages = cases.flatMap(cs => (cs.stages || []).map(st => ({ ...st, case_id: cs.id })));
    const sessions = stages.flatMap(st => (st.sessions || []).map(s => ({ ...s, stage_id: st.id })));
    return {
        clients: (data.clients || []).map(({ cases, ...cl }) => cl),
        cases: cases.map(({ stages, ...cs }) => cs),
        stages: stages.map(({ sessions, ...st }) => st),
        sessions,
        admin_tasks: data.adminTasks || [],
        appointments: data.appointments || [],
        accounting_entries: data.accountingEntries || [],
        assistants: (data.assistants || []).map(name => ({ name })),
        invoices: (data.invoices || []).map(({ items, ...inv }) => inv),
        invoice_items: (data.invoices || []).flatMap(inv => (inv.items || []).map(i => ({ ...i, invoice_id: inv.id }))),
        case_documents: data.documents || [],
        profiles: data.profiles || [],
        site_finances: data.siteFinances || [],
    };
};

const constructData = (flat: Partial<FlatData>): AppData => {
    const sessionMap = new Map<string, Session[]>();
    (flat.sessions || []).forEach(s => {
        const sid = (s as any).stage_id;
        if (!sessionMap.has(sid)) sessionMap.set(sid, []);
        sessionMap.get(sid)!.push({ ...s, date: revive(s.date) } as Session);
    });

    const stageMap = new Map<string, Stage[]>();
    (flat.stages || []).forEach(st => {
        const stage = { ...st, sessions: sessionMap.get(st.id) || [] } as Stage;
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
        invoices: (flat.invoices || []).map(inv => ({ ...inv, issueDate: revive(inv.issueDate), dueDate: revive(inv.dueDate), items: (flat.invoice_items || []).filter(i => (i as any).invoice_id === inv.id) })) as any,
        documents: (flat.case_documents || []).map(d => ({ ...d, addedAt: revive(d.addedAt) })) as any,
        profiles: (flat.profiles || []) as any,
        siteFinances: (flat.site_finances || []) as any,
    };
};

export const useSync = ({ user, localData, deletedIds, onDataSynced, onDeletionsSynced, onSyncStatusChange, isOnline, isAuthLoading, syncStatus }: UseSyncProps) => {
    
    const isSyncingRef = React.useRef(false);

    const manualSync = React.useCallback(async () => {
        if (!isOnline || !user || isSyncingRef.current) {
            if (syncStatus === 'loading') onSyncStatusChange('synced', null); // خروج آمن من حالة التحميل
            return;
        }

        isSyncingRef.current = true;
        onSyncStatusChange('syncing', 'جاري المزامنة...');
        
        try {
            const [remoteRaw, remoteDeletions] = await Promise.all([
                fetchDataFromSupabase().catch(() => ({})),
                fetchDeletionsFromSupabase().catch(() => [])
            ]);
            
            const remoteFlat = transformRemoteToLocal(remoteRaw);
            const localFlat = flattenData(localData);

            const mergedFlat: Partial<FlatData> = {};
            const toUpsert: Partial<FlatData> = {};

            const tables = Object.keys(localFlat) as (keyof FlatData)[];
            tables.forEach(table => {
                const localItems = (localFlat as any)[table] || [];
                const remoteItems = (remoteFlat as any)[table] || [];
                const mergedMap = new Map<string, any>();
                const upsertList: any[] = [];

                remoteItems.forEach((r: any) => { if(r) mergedMap.set(r.id || r.name, r); });

                localItems.forEach((l: any) => {
                    if (!l) return;
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

            await Promise.all([
                upsertDataToSupabase(toUpsert, user).catch(e => console.warn("Upsert failed", e)),
                deleteDataFromSupabase({
                    clients: deletedIds.clients.map(id => ({id} as any)),
                    cases: deletedIds.cases.map(id => ({id} as any)),
                } as any, user).catch(e => console.warn("Delete failed", e))
            ]);

            onDataSynced(constructData(mergedFlat));
            onDeletionsSynced(deletedIds);
            onSyncStatusChange('synced', null);
        } catch (err: any) {
            console.error("Sync Error:", err);
            onSyncStatusChange('error', err.message || "فشل المزامنة");
        } finally {
            isSyncingRef.current = false;
        }
    }, [isOnline, user, localData, deletedIds, onDataSynced, onDeletionsSynced, onSyncStatusChange]);

    React.useEffect(() => {
        if (isOnline && !isAuthLoading && user && syncStatus === 'loading') {
            const timer = setTimeout(manualSync, 1000);
            return () => clearTimeout(timer);
        } else if ((!isOnline || !user) && syncStatus === 'loading') {
            onSyncStatusChange('synced', null);
        }
    }, [isOnline, isAuthLoading, !!user, syncStatus]);

    return { manualSync };
};
