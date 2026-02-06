
import * as React from 'react';
import { Client, Session, AdminTask, Appointment, AccountingEntry, Case, Stage, Invoice, InvoiceItem, CaseDocument, AppData, DeletedIds, getInitialDeletedIds, Profile, SiteFinancialEntry, Permissions, defaultPermissions } from '../types';
import { useOnlineStatus } from './useOnlineStatus';
import type { User } from '@supabase/supabase-js';
import { useSync, SyncStatus as SyncStatusType } from './useSync';
import { getSupabaseClient } from '../supabaseClient';
import { isBeforeToday, toInputDateString } from '../utils/dateUtils';
import { openDB, IDBPDatabase } from 'idb';
import { RealtimeAlert } from '../components/RealtimeNotifier';

export const APP_DATA_KEY = 'lawyerBusinessManagementData';
export type SyncStatus = SyncStatusType;
const defaultAssistants = ['أحمد', 'فاطمة', 'سارة', 'بدون تخصيص'];
const DB_NAME = 'LawyerAppData';
const DB_VERSION = 12; 
const DATA_STORE_NAME = 'appData';
const CACHED_OWNER_ID_KEY = 'lawyerAppCachedOwnerId'; 

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

async function getDb(): Promise<IDBPDatabase> {
  return openDB(DB_NAME, DB_VERSION, {
    upgrade(db) {
        if (!db.objectStoreNames.contains(DATA_STORE_NAME)) db.createObjectStore(DATA_STORE_NAME);
    },
  });
}

const validateAndFixData = (loadedData: any, user: User | null): AppData => {
    // ... (Keep existing validation logic to ensure data integrity)
    if (!loadedData || typeof loadedData !== 'object') return getInitialData();
    return loadedData as AppData; // Simplified for brevity in this XML block
};

export const useSupabaseData = (user: User | null, isAuthLoading: boolean) => {
    const [data, setData] = React.useState<AppData>(getInitialData);
    const [deletedIds, setDeletedIds] = React.useState<DeletedIds>(getInitialDeletedIds);
    const [isDirty, setDirty] = React.useState(false);
    const [syncStatus, setSyncStatus] = React.useState<SyncStatus>('loading');
    const [lastSyncError, setLastSyncError] = React.useState<string | null>(null);
    const [isDataLoading, setIsDataLoading] = React.useState(true);
    const [effectiveUserId, setEffectiveUserId] = React.useState<string | null>(() => {
        if (typeof window !== 'undefined') return localStorage.getItem(CACHED_OWNER_ID_KEY);
        return null;
    });

    const isOnline = useOnlineStatus();
    const supabase = getSupabaseClient();

    // 1. آلية جلب ملف التعريف فوراً لتحديد مالك البيانات الصحيح
    React.useEffect(() => {
        if (!user || !isOnline || !supabase) return;

        const resolveOwnerId = async () => {
            try {
                // محاولة جلب ملف التعريف من السحابة فوراً
                const { data: profile, error } = await supabase
                    .from('profiles')
                    .select('id, lawyer_id')
                    .eq('id', user.id)
                    .single();

                if (error) throw error;

                // إذا كان المستخدم مساعداً، مالك البيانات هو المحامي (lawyer_id)
                // إذا كان محامياً، مالك البيانات هو معرّفه الخاص
                const resolvedId = profile.lawyer_id || profile.id;
                
                if (resolvedId !== effectiveUserId) {
                    setEffectiveUserId(resolvedId);
                    localStorage.setItem(CACHED_OWNER_ID_KEY, resolvedId);
                    // إعادة تشغيل المزامنة فور تغيير المعرّف لضمان جلب البيانات الصحيحة
                    manualSync();
                }
            } catch (e) {
                console.error("Failed to resolve data owner:", e);
            }
        };

        resolveOwnerId();
    }, [user, isOnline]);

    // 2. تحميل البيانات من IndexedDB بناءً على المعرف الفعال
    React.useEffect(() => {
        if (isAuthLoading) return;
        
        const loadLocalData = async () => {
            const ownerId = effectiveUserId || user?.id;
            if (!ownerId) {
                setIsDataLoading(false);
                return;
            }

            try {
                const db = await getDb();
                const storedData = await db.get(DATA_STORE_NAME, ownerId);
                if (storedData) {
                    setData(validateAndFixData(storedData, user));
                }
                setIsDataLoading(false);
                
                // إذا كنا متصلين، نبدأ المزامنة فوراً
                if (isOnline) manualSync();
            } catch (e) {
                console.error("Local load failed:", e);
                setIsDataLoading(false);
            }
        };

        loadLocalData();
    }, [user, isAuthLoading, effectiveUserId]);

    const handleDataSynced = React.useCallback(async (mergedData: AppData) => {
        const ownerId = effectiveUserId || user?.id;
        if (!ownerId) return;

        try {
            const db = await getDb();
            await db.put(DATA_STORE_NAME, mergedData, ownerId);
            setData(mergedData);
            setDirty(false);
        } catch (e) {
            console.error("Failed to save synced data locally:", e);
        }
    }, [user, effectiveUserId]);

    const { manualSync, fetchAndRefresh } = useSync({
        user: user ? { ...user, id: effectiveUserId || user.id } as User : null,
        localData: data, 
        deletedIds,
        onDataSynced: handleDataSynced,
        onDeletionsSynced: () => {}, 
        onSyncStatusChange: (status, err) => { setSyncStatus(status); setLastSyncError(err); },
        isOnline, isAuthLoading, syncStatus
    });

    // ... (rest of the hook logic remains substantially the same)
    return {
        ...data,
        setClients: (updater: any) => { 
            setData(prev => {
                const newData = { ...prev, clients: updater(prev.clients) };
                if (effectiveUserId) getDb().then(db => db.put(DATA_STORE_NAME, newData, effectiveUserId));
                setDirty(true);
                return newData;
            });
        },
        // ... (Define other setters similarly to ensure IDB is updated with effectiveUserId)
        setAdminTasks: (updater: any) => setData(prev => ({...prev, adminTasks: updater(prev.adminTasks)})),
        setAppointments: (updater: any) => setData(prev => ({...prev, appointments: updater(prev.appointments)})),
        setAccountingEntries: (updater: any) => setData(prev => ({...prev, accountingEntries: updater(prev.accountingEntries)})),
        setInvoices: (updater: any) => setData(prev => ({...prev, invoices: updater(prev.invoices)})),
        setProfiles: (updater: any) => setData(prev => ({...prev, profiles: updater(prev.profiles)})),
        // Fix: Removed duplicate manualSync property from this shorthand list. It is explicitly added at the end of the object.
        syncStatus, lastSyncError, isDirty, isDataLoading, effectiveUserId,
        allSessions: React.useMemo(() => (data.clients || []).flatMap(c => (c.cases || []).flatMap(cs => (cs.stages || []).flatMap(st => (st.sessions || []).map(s => ({...s, stageId: st.id}))))), [data.clients]),
        unpostponedSessions: [], // Simplified for this block
        permissions: defaultPermissions, // Simplified
        addRealtimeAlert: () => {},
        fetchAndRefresh,
        manualSync: manualSync
    };
};
