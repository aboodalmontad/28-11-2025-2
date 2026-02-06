
import * as React from 'react';
import { Client, Session, AdminTask, Appointment, AccountingEntry, Case, Stage, Invoice, InvoiceItem, CaseDocument, AppData, DeletedIds, getInitialDeletedIds, Profile, SiteFinancialEntry, Permissions, defaultPermissions } from '../types';
import { useOnlineStatus } from './useOnlineStatus';
import type { User } from '@supabase/supabase-js';
import { useSync, SyncStatus as SyncStatusType } from './useSync';
import { getSupabaseClient } from '../supabaseClient';
import { isBeforeToday } from '../utils/dateUtils';
import { getDb, DATA_STORE_NAME } from '../utils/db';

export const APP_DATA_KEY = 'lawyerBusinessManagementData';
export type SyncStatus = SyncStatusType;
const defaultAssistants = ['أحمد', 'فاطمة', 'سارة', 'بدون تخصيص'];

const getInitialData = (): AppData => ({
    clients: [],
    adminTasks: [],
    appointments: [],
    accountingEntries: [],
    invoices: [],
    assistants: [...defaultAssistants],
    documents: [],
    profiles: [],
    siteFinances: [],
});

const reviveDate = (date: any): Date => {
    if (!date) return new Date();
    if (date instanceof Date) return date;
    try {
        const d = new Date(date);
        return isNaN(d.getTime()) ? new Date() : d;
    } catch {
        return new Date();
    }
};

const safeArray = <T>(arr: any): T[] => Array.isArray(arr) ? arr : [];

const validateAndFixData = (data: any): AppData => {
    const initial = getInitialData();
    if (!data) return initial;

    return {
        clients: safeArray<any>(data.clients).map((c: any) => ({
            ...c,
            updated_at: reviveDate(c.updated_at),
            cases: safeArray<any>(c.cases).map((cs: any) => ({
                ...cs,
                updated_at: reviveDate(cs.updated_at),
                stages: safeArray<any>(cs.stages).map((st: any) => ({
                    ...st,
                    updated_at: reviveDate(st.updated_at),
                    sessions: safeArray<any>(st.sessions).map((s: any) => ({
                        ...s,
                        updated_at: reviveDate(s.updated_at),
                        date: reviveDate(s.date),
                    })),
                })),
            })),
        })),
        adminTasks: safeArray<any>(data.adminTasks).map((t: any) => ({ ...t, dueDate: reviveDate(t.dueDate), updated_at: reviveDate(t.updated_at) })),
        appointments: safeArray<any>(data.appointments).map((a: any) => ({ ...a, date: reviveDate(a.date), updated_at: reviveDate(a.updated_at) })),
        accountingEntries: safeArray<any>(data.accountingEntries).map((e: any) => ({ ...e, date: reviveDate(e.date), updated_at: reviveDate(e.updated_at) })),
        invoices: safeArray<any>(data.invoices).map((inv: any) => ({
            ...inv,
            updated_at: reviveDate(inv.updated_at),
            items: safeArray<any>(inv.items).map((i: any) => ({ ...i, updated_at: reviveDate(i.updated_at) })),
        })),
        assistants: safeArray<any>(data.assistants).length > 0 ? data.assistants : initial.assistants,
        documents: safeArray<any>(data.documents).map((d: any) => ({ ...d, addedAt: reviveDate(d.addedAt), updated_at: reviveDate(d.updated_at) })),
        profiles: safeArray<any>(data.profiles).map((p: any) => ({...p, updated_at: reviveDate(p.updated_at)})),
        siteFinances: safeArray<any>(data.siteFinances).map((sf: any) => ({...sf, updated_at: reviveDate(sf.updated_at)})),
    };
};

export const useSupabaseData = (user: User | null, isAuthLoading: boolean) => {
    const [data, setData] = React.useState<AppData>(getInitialData());
    const [deletedIds, setDeletedIds] = React.useState<DeletedIds>(getInitialDeletedIds());
    const [syncStatus, setSyncStatus] = React.useState<SyncStatus>('loading');
    const [lastSyncError, setLastSyncError] = React.useState<string | null>(null);
    const [isDirty, setIsDirty] = React.useState(false);
    const [isDataLoading, setIsDataLoading] = React.useState(true);
    
    const isOnline = useOnlineStatus();

    const { permissions, effectiveUserId } = React.useMemo(() => {
        // Fix: Explicitly typed allProfiles as Profile[] to resolve property access errors on 'unknown'.
        const allProfiles = safeArray<Profile>(data.profiles);
        const myProfile = user ? allProfiles.find(p => p.id === user.id) : null;
        
        if (!user) return { permissions: defaultPermissions, effectiveUserId: null };
        
        // Fix: myProfile properties are now correctly typed and accessible.
        const isLawyerOwner = myProfile ? (!myProfile.lawyer_id || myProfile.role === 'admin') : true;
        
        if (isLawyerOwner) {
            const allGranted: Permissions = Object.keys(defaultPermissions).reduce((acc, key) => {
                acc[key as keyof Permissions] = true;
                return acc;
            }, {} as any) as Permissions;
            return { permissions: allGranted, effectiveUserId: user.id };
        }

        // Fix: Explicitly accessing typed profile properties.
        return { 
            permissions: myProfile?.permissions || defaultPermissions, 
            effectiveUserId: myProfile?.lawyer_id || user.id 
        };
    }, [user, data.profiles]);

    React.useEffect(() => {
        if (isAuthLoading) return;
        
        const loadFromIDB = async () => {
            try {
                const db = await getDb();
                const cacheKey = effectiveUserId ? `data_${effectiveUserId}` : APP_DATA_KEY;
                const cachedData = await db.get(DATA_STORE_NAME, cacheKey);
                if (cachedData) {
                    setData(validateAndFixData(cachedData));
                }
            } catch (e) {
                console.error("IDB Load Error:", e);
            } finally {
                setIsDataLoading(false);
            }
        };
        loadFromIDB();
    }, [isAuthLoading, effectiveUserId]);

    const updateLocalData = React.useCallback(async (updater: (prev: AppData) => AppData) => {
        if (!effectiveUserId) return;
        
        setData(prev => {
            const next = validateAndFixData(updater(prev));
            getDb().then(db => db.put(DATA_STORE_NAME, next, `data_${effectiveUserId}`)).catch(console.error);
            setIsDirty(true);
            return next;
        });
    }, [effectiveUserId]);

    const onDataSynced = React.useCallback((mergedData: AppData) => {
        const validated = validateAndFixData(mergedData);
        setData(validated);
        setIsDirty(false);
        setSyncStatus('synced');
        if (effectiveUserId) {
            getDb().then(db => db.put(DATA_STORE_NAME, validated, `data_${effectiveUserId}`)).catch(console.error);
        }
    }, [effectiveUserId]);

    const sync = useSync({
        user: user ? { ...user, id: effectiveUserId || user.id } as User : null,
        localData: data,
        deletedIds,
        onDataSynced,
        onDeletionsSynced: (syncedDeletions) => {
            setDeletedIds(prev => {
                const next = { ...prev };
                Object.keys(syncedDeletions).forEach(key => {
                    const k = key as keyof DeletedIds;
                    if (next[k]) next[k] = next[k].filter(id => !syncedDeletions[k]?.includes(id));
                });
                return next;
            });
        },
        onSyncStatusChange: (status, error) => { 
            setSyncStatus(status); 
            setLastSyncError(error); 
        },
        isOnline,
        isAuthLoading,
        syncStatus
    });

    return {
        ...data,
        setClients: (v: any) => updateLocalData(p => ({ ...p, clients: typeof v === 'function' ? v(p.clients) : v })),
        setAdminTasks: (v: any) => updateLocalData(p => ({ ...p, adminTasks: typeof v === 'function' ? v(p.adminTasks) : v })),
        setAppointments: (v: any) => updateLocalData(p => ({ ...p, appointments: typeof v === 'function' ? v(p.appointments) : v })),
        setAccountingEntries: (v: any) => updateLocalData(p => ({ ...p, accountingEntries: typeof v === 'function' ? v(p.accountingEntries) : v })),
        setInvoices: (v: any) => updateLocalData(p => ({ ...p, invoices: typeof v === 'function' ? v(p.invoices) : v })),
        setAssistants: (v: any) => updateLocalData(p => ({ ...p, assistants: typeof v === 'function' ? v(p.assistants) : v })),
        setProfiles: (v: any) => updateLocalData(p => ({ ...p, profiles: typeof v === 'function' ? v(p.profiles) : v })),
        setSiteFinances: (v: any) => updateLocalData(p => ({ ...p, siteFinances: typeof v === 'function' ? v(p.siteFinances) : v })),
        
        deleteClient: (id: string) => { setDeletedIds(p => ({...p, clients: [...p.clients, id]})); updateLocalData(p => ({...p, clients: p.clients.filter(c => c.id !== id)}))},
        deleteAccountingEntry: (id: string) => { setDeletedIds(p => ({...p, accountingEntries: [...p.accountingEntries, id]})); updateLocalData(p => ({...p, accountingEntries: p.accountingEntries.filter(e => e.id !== id)}))},
        
        // Fix: Added explicit generic types to safeArray calls and mapping logic to resolve property access errors on 'unknown' types.
        allSessions: React.useMemo(() => safeArray<Client>(data.clients).flatMap(cl => safeArray<Case>(cl.cases).flatMap(cs => safeArray<Stage>(cs.stages).flatMap(st => safeArray<Session>(st.sessions).map(s => ({ ...s, stageId: st.id, stageDecisionDate: st.decisionDate, user_id: cl.user_id }))))), [data.clients]),
        // Fix: Added explicit generic types to safeArray calls and filtering/mapping logic to resolve property access errors on 'unknown' types.
        unpostponedSessions: React.useMemo(() => {
            const today = new Date(); today.setHours(0,0,0,0);
            return safeArray<Client>(data.clients).flatMap(cl => safeArray<Case>(cl.cases).flatMap(cs => safeArray<Stage>(cs.stages).flatMap(st => safeArray<Session>(st.sessions).filter(s => !s.isPostponed && !st.decisionDate && new Date(s.date) < today).map(s => ({ ...s, stageId: st.id, stageDecisionDate: st.decisionDate })))));
        }, [data.clients]),

        syncStatus, manualSync: sync.manualSync, isDirty, isDataLoading, isOnline, userId: user?.id, effectiveUserId, permissions,
        isAutoSyncEnabled: true,
        exportData: () => { try { const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' }); const url = URL.createObjectURL(blob); const a = document.createElement('a'); a.href = url; a.download = `backup_${new Date().toISOString()}.json`; a.click(); return true; } catch (e) { return false; } },
        setFullData: (d: any) => { updateLocalData(() => validateAndFixData(d)); }
    };
};
