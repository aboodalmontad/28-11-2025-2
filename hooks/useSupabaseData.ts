import * as React from 'react';
import { Client, Session, AdminTask, Appointment, AccountingEntry, Case, Stage, Invoice, InvoiceItem, CaseDocument, AppData, DeletedIds, get_initial_deleted_ids, Profile, SiteFinancialEntry, Permissions, default_permissions } from '../types';
import { useOnlineStatus } from './useOnlineStatus';
import type { User } from '@supabase/supabase-js';
import { use_sync, SyncStatus as SyncStatusType, SyncLogEntry } from './useSync';
import { get_supabase_client } from '../supabaseClient';
import { is_before_today, to_input_date_string, is_holiday, safe_revive_date } from '../utils/dateUtils';
import { RealtimeAlert } from '../components/RealtimeNotifier';
import { get_db, DATA_STORE_NAME, DELETED_IDS_STORE_NAME, DOCS_FILES_STORE_NAME } from '../utils/db';

export const APP_DATA_KEY_PREFIX = 'lawyerBusinessManagementData';
export const get_app_data_key = (user_id: string | null) => user_id ? `${APP_DATA_KEY_PREFIX}_${user_id}` : APP_DATA_KEY_PREFIX;

export type SyncStatus = SyncStatusType;
const default_assistants = ['أحمد', 'فاطمة', 'سارة', 'بدون تخصيص'];

const get_initial_data = (): AppData => ({
    clients: [], admin_tasks: [], appointments: [], accounting_entries: [],
    invoices: [], assistants: [...default_assistants], documents: [],
    profiles: [], site_finances: [],
});

const migrate_data = (old_data: any): AppData => {
    if (!old_data) return get_initial_data();
    
    const migrate_session = (s: any): Session => ({
        id: s.id,
        court: s.court || '',
        case_number: s.case_number || s.caseNumber || '',
        date: s.date || '',
        client_name: s.client_name || s.clientName || '',
        opponent_name: s.opponent_name || s.opponentName || '',
        postponement_reason: s.postponement_reason || s.postponementReason,
        next_postponement_reason: s.next_postponement_reason || s.nextPostponementReason,
        is_postponed: Boolean(s.is_postponed ?? s.isPostponed),
        next_session_date: s.next_session_date || s.nextSessionDate,
        assignee: s.assignee,
        stage_id: s.stage_id || s.stageId,
        updated_at: s.updated_at || s.updatedAt,
        user_id: s.user_id || s.userId
    });

    const migrate_stage = (st: any): Stage => ({
        id: st.id,
        court: st.court || '',
        case_number: st.case_number || st.caseNumber || '',
        first_session_date: st.first_session_date || st.firstSessionDate,
        sessions: (st.sessions || []).map(migrate_session),
        decision_date: st.decision_date || st.decisionDate,
        decision_number: st.decision_number || st.decisionNumber,
        decision_summary: st.decision_summary || st.decisionSummary,
        decision_notes: st.decision_notes || st.decisionNotes,
        updated_at: st.updated_at || st.updatedAt,
        user_id: st.user_id || st.userId,
        case_id: st.case_id || st.caseId
    });

    const migrate_case = (c: any): Case => ({
        id: c.id,
        subject: c.subject || '',
        client_name: c.client_name || c.clientName || '',
        opponent_name: c.opponent_name || c.opponentName || '',
        stages: (c.stages || []).map(migrate_stage),
        fee_agreement: c.fee_agreement || c.feeAgreement || '',
        status: c.status || 'active',
        updated_at: c.updated_at || c.updatedAt,
        user_id: c.user_id || c.userId,
        client_id: c.client_id || c.clientId || ''
    });

    const migrate_client = (c: any): Client => ({
        id: c.id,
        name: c.name || '',
        contact_info: c.contact_info || '',
        cases: (c.cases || []).map(migrate_case),
        updated_at: c.updated_at || c.updatedAt,
        user_id: c.user_id || c.userId
    });

    const migrate_task = (t: any): AdminTask => ({
        id: t.id,
        user_id: t.user_id || t.userId,
        task: t.task || '',
        due_date: t.due_date || t.dueDate || '',
        completed: Boolean(t.completed),
        importance: t.importance || 'normal',
        assignee: t.assignee,
        location: t.location,
        updated_at: t.updated_at || t.updatedAt,
        order_index: t.order_index ?? t.orderIndex
    });

    const migrate_appointment = (a: any): Appointment => ({
        id: a.id,
        title: a.title || '',
        time: a.time || '',
        date: a.date || '',
        importance: a.importance || 'normal',
        completed: Boolean(a.completed),
        notified: Boolean(a.notified),
        reminder_time_in_minutes: a.reminder_time_in_minutes ?? a.reminderTimeInMinutes,
        assignee: a.assignee,
        updated_at: a.updated_at || a.updatedAt,
        user_id: a.user_id || a.userId
    });

    const migrate_accounting = (e: any): AccountingEntry => ({
        id: e.id,
        type: e.type || 'income',
        amount: Number(e.amount || 0),
        date: e.date || '',
        description: e.description || '',
        client_id: e.client_id || e.clientId || '',
        case_id: e.case_id || e.caseId || '',
        client_name: e.client_name || e.clientName || '',
        updated_at: e.updated_at || e.updatedAt,
        user_id: e.user_id || e.userId
    });

    const migrate_document = (d: any): CaseDocument => ({
        id: d.id,
        case_id: d.case_id || d.caseId || '',
        user_id: d.user_id || d.userId || '',
        name: d.name || '',
        type: d.type || '',
        size: Number(d.size || 0),
        added_at: d.added_at || d.addedAt || '',
        storage_path: d.storage_path || d.storagePath || '',
        local_state: d.local_state || d.localState || 'synced',
        updated_at: d.updated_at || d.updatedAt
    });

    const migrate_invoice_item = (i: any): InvoiceItem => ({
        id: i.id,
        invoice_id: i.invoice_id || i.invoiceId,
        description: i.description || '',
        amount: Number(i.amount || 0),
        updated_at: i.updated_at || i.updatedAt,
        user_id: i.user_id || i.userId
    });

    const migrate_invoice = (i: any): Invoice => ({
        id: i.id,
        client_id: i.client_id || i.clientId || '',
        client_name: i.client_name || i.clientName || '',
        case_id: i.case_id || i.caseId,
        case_subject: i.case_subject || i.caseSubject,
        issue_date: i.issue_date || i.issueDate || '',
        due_date: i.due_date || i.dueDate || '',
        items: (i.items || []).map(migrate_invoice_item),
        tax_rate: Number(i.tax_rate || i.taxRate || 0),
        discount: Number(i.discount || 0),
        status: i.status || 'draft',
        notes: i.notes,
        updated_at: i.updated_at || i.updatedAt,
        user_id: i.user_id || i.userId
    });

    const migrate_profile = (p: any): Profile => ({
        id: p.id,
        full_name: p.full_name || p.fullName || '',
        mobile_number: p.mobile_number || p.mobileNumber || '',
        is_approved: Boolean(p.is_approved ?? p.isApproved),
        is_active: Boolean(p.is_active ?? p.isActive),
        mobile_verified: Boolean(p.mobile_verified ?? p.mobileVerified),
        subscription_start_date: p.subscription_start_date || p.subscriptionStartDate,
        subscription_end_date: p.subscription_end_date || p.subscriptionEndDate,
        role: p.role || 'user',
        permissions: p.permissions,
        lawyer_id: p.lawyer_id || p.lawyerId,
        admin_tasks_layout: p.admin_tasks_layout || p.adminTasksLayout || 'vertical',
        created_at: p.created_at || p.createdAt,
        updated_at: p.updated_at || p.updatedAt
    });

    const migrate_site_finance = (f: any): SiteFinancialEntry => ({
        id: f.id,
        user_id: f.user_id || f.userId,
        type: f.type || 'income',
        payment_date: f.payment_date || f.paymentDate || '',
        amount: Number(f.amount || 0),
        description: f.description,
        payment_method: f.payment_method || f.paymentMethod,
        category: f.category,
        updated_at: f.updated_at || f.updatedAt
    });

    return {
        clients: (old_data.clients || []).map(migrate_client),
        admin_tasks: (old_data.admin_tasks || old_data.adminTasks || []).map(migrate_task),
        appointments: (old_data.appointments || []).map(migrate_appointment),
        accounting_entries: (old_data.accounting_entries || old_data.accountingEntries || []).map(migrate_accounting),
        invoices: (old_data.invoices || []).map(migrate_invoice),
        assistants: (old_data.assistants || [...default_assistants]).map((a: any) => typeof a === 'string' ? a : (a.name || 'بدون اسم')),
        documents: (old_data.documents || []).map(migrate_document),
        profiles: (old_data.profiles || []).map(migrate_profile),
        site_finances: (old_data.site_finances || []).map(migrate_site_finance),
    };
};

export const useSupabaseData = (user: User | null, is_auth_loading: boolean) => {
    const [data, set_data] = React.useState<AppData>(get_initial_data);
    const [deleted_ids, set_deleted_ids] = React.useState<DeletedIds>(get_initial_deleted_ids);
    const [is_dirty, set_dirty] = React.useState(false);
    const [sync_status, set_sync_status] = React.useState<SyncStatus>('loading');
    const [last_sync_error, set_last_sync_error] = React.useState<string | null>(null);
    const [sync_log, set_sync_log] = React.useState<SyncLogEntry[]>([]);
    const [is_data_loading, set_is_data_loading] = React.useState(true);
    const [triggered_alerts, set_triggered_alerts] = React.useState<Appointment[]>([]);
    const [realtime_alerts, set_realtime_alerts] = React.useState<RealtimeAlert[]>([]);
    const [user_approval_alerts, set_user_approval_alerts] = React.useState<RealtimeAlert[]>([]);
    const is_online = useOnlineStatus();
    
    const user_ref = React.useRef(user);
    user_ref.current = user;

    // Safety Timeout: Force loading to false after 7 seconds if still stuck
    React.useEffect(() => {
        if (is_data_loading) {
            const timer = setTimeout(() => {
                console.warn("Initial data load timed out, forcing UI unlock.");
                set_is_data_loading(false);
            }, 7000);
            return () => clearTimeout(timer);
        }
    }, [is_data_loading]);

    const effective_user_id = React.useMemo(() => {
        if (!user) return null;
        const current_user_profile = data.profiles.find(p => p.id === user.id);
        return current_user_profile?.lawyer_id || user.id;
    }, [user, data.profiles]);

    const is_admin = React.useMemo(() => {
        if (!user) return false;
        const current_user_profile = data.profiles.find(p => p.id === user.id);
        return current_user_profile?.role === 'admin';
    }, [user, data.profiles]);

    const current_user_permissions: Permissions = React.useMemo(() => {
        if (!user) return default_permissions;
        const current_user_profile = data.profiles.find(p => p.id === user.id);
        if (current_user_profile?.lawyer_id) {
            const perms = current_user_profile.permissions;
            if (perms && typeof perms === 'object') {
                // If it's the assistant object from the database, the actual flags are in the 'permissions' field
                const actual_perms = (perms as any).permissions || perms;
                return { ...default_permissions, ...actual_perms };
            }
            return { ...default_permissions, ...(perms || {}) };
        }
        return {
            can_view_agenda: true, can_view_clients: true, can_add_client: true, can_edit_client: true, can_delete_client: true,
            can_view_cases: true, can_add_case: true, can_edit_case: true, can_delete_case: true, can_view_sessions: true,
            can_add_session: true, can_edit_session: true, can_delete_session: true, can_postpone_session: true,
            can_decide_session: true, can_view_documents: true, can_add_document: true, can_delete_document: true,
            can_view_finance: true, can_add_financial_entry: true, can_delete_financial_entry: true, can_manage_invoices: true,
            can_view_admin_tasks: true, can_add_admin_task: true, can_edit_admin_task: true, can_delete_admin_task: true, can_view_reports: true,
        };
    }, [user, data.profiles]);

    const filtered_clients = React.useMemo(() => {
        if (is_admin) return data.clients;
        return data.clients.filter(c => c.user_id === effective_user_id);
    }, [data.clients, is_admin, effective_user_id]);

    // Load initial data from IndexedDB on mount or when user changes
    React.useEffect(() => {
        const load_local_data = async () => {
            if (is_auth_loading) return;
            
            const storage_key = get_app_data_key(user?.id || null);
            console.log(`Loading local data for key: ${storage_key}`);
            
            try {
                const db = await get_db();
                const cached_data = await db.get(DATA_STORE_NAME, storage_key);
                if (cached_data) {
                    console.log("Loaded data from IndexedDB for user:", user?.id || 'guest');
                    
                    // Migration: Rename camelCase to snake_case and handle old structures
                    const migrated = migrate_data(cached_data);
                    set_data(migrated);
                } else {
                    // Reset to initial data if no cache for this specific user
                    set_data(get_initial_data());
                }

                const cached_deleted_ids = await db.get(DELETED_IDS_STORE_NAME, storage_key);
                if (cached_deleted_ids) {
                    console.log("Loaded deleted_ids from IndexedDB for user:", user?.id || 'guest');
                    set_deleted_ids(cached_deleted_ids);
                } else {
                    set_deleted_ids(get_initial_deleted_ids());
                }
            } catch (err) {
                console.error("Failed to load local data:", err);
                set_data(get_initial_data());
            } finally {
                // If we are offline or not logged in, we should stop loading here
                if (!user || !is_online) {
                    set_is_data_loading(false);
                }
            }
        };
        load_local_data();
    }, [user?.id, is_online, is_auth_loading]);

    const { manual_sync: manual_sync, fetch_and_refresh: fetch_and_refresh } = use_sync({
        user: user ? { ...user, id: effective_user_id || user.id } as User : null,
        local_data: data, 
        deleted_ids: deleted_ids,
        on_data_synced: async (merged) => { 
            set_data(merged); 
            set_dirty(false); 
            set_is_data_loading(false); 
            try {
                const db = await get_db();
                const storage_key = get_app_data_key(user_ref.current?.id || null);
                await db.put(DATA_STORE_NAME, merged, storage_key);
                console.log("Saved synced data to IndexedDB for key:", storage_key);
            } catch (err) {
                console.error("Failed to save synced data to IndexedDB:", err);
            }
        },
        on_deletions_synced: (synced) => {
            set_deleted_ids(prev => {
                const next = { ...prev };
                (Object.keys(synced) as (keyof DeletedIds)[]).forEach(key => {
                    if (Array.isArray(next[key]) && Array.isArray(synced[key])) {
                        next[key] = (next[key] as string[]).filter(id => !(synced[key] as string[]).includes(id)) as any;
                    }
                });
                return next;
            });
        },
        on_documents_uploaded: (uploaded_doc_ids) => {
            set_data(prev => {
                const next = { ...prev };
                if (next.documents) {
                    next.documents = next.documents.map(doc => 
                        uploaded_doc_ids.includes(doc.id) ? { ...doc, local_state: 'synced' } : doc
                    );
                }
                return next;
            });
            set_dirty(true); // Trigger a save to IndexedDB
        },
        on_sync_status_change: (status, err) => { set_sync_status(status); set_last_sync_error(err); if(status === 'synced' || status === 'error') set_is_data_loading(false); },
        on_log: (log) => {
            set_sync_log(prev => [{
                ...log,
                id: Math.random().toString(36).substring(2, 9),
                timestamp: new Date()
            }, ...prev].slice(0, 50)); // Keep last 50 logs
        },
        is_online: is_online, is_auth_loading: is_auth_loading, sync_status: sync_status
    });

    // Auto-sync on mount/login
    React.useEffect(() => {
        if (user && is_online && !is_auth_loading && sync_status === 'loading') {
            console.log("Triggering initial auto-sync in 500ms...");
            const timer = setTimeout(() => {
                manual_sync();
            }, 500);
            return () => clearTimeout(timer);
        }
    }, [user?.id, is_online, is_auth_loading, sync_status, manual_sync]);

    // Auto-sync when coming back online
    const prev_is_online = React.useRef(is_online);
    React.useEffect(() => {
        if (user && is_online && !prev_is_online.current && !is_auth_loading && sync_status !== 'syncing') {
            console.log("Came back online, triggering auto-sync...");
            manual_sync();
        }
        prev_is_online.current = is_online;
    }, [is_online, manual_sync, user, is_auth_loading, sync_status]); // Trigger when is_online changes from false to true


    const [is_auto_sync_enabled, set_auto_sync_enabled] = React.useState(() => localStorage.getItem('is_auto_sync_enabled') !== 'false');
    const [is_auto_backup_enabled, set_auto_backup_enabled] = React.useState(() => {
        const val = localStorage.getItem('is_auto_backup_enabled');
        return val === null ? true : val === 'true';
    });
    const [admin_tasks_layout, set_admin_tasks_layout] = React.useState<'horizontal' | 'vertical'>(() => (localStorage.getItem('admin_tasks_layout') as any) || 'vertical');
    const [location_order, set_location_order] = React.useState<string[]>(() => {
        try { return JSON.parse(localStorage.getItem('location_order') || '[]'); } catch (e) { return []; }
    });

    // Persist settings to localStorage when they change
    React.useEffect(() => { localStorage.setItem('is_auto_sync_enabled', String(is_auto_sync_enabled)); }, [is_auto_sync_enabled]);
    React.useEffect(() => { localStorage.setItem('is_auto_backup_enabled', String(is_auto_backup_enabled)); }, [is_auto_backup_enabled]);
    React.useEffect(() => { localStorage.setItem('admin_tasks_layout', admin_tasks_layout); }, [admin_tasks_layout]);
    React.useEffect(() => { localStorage.setItem('location_order', JSON.stringify(location_order)); }, [location_order]);
    
    // Keep a ref of the data for the auto-backup to use the latest version without triggering re-runs
    const data_ref = React.useRef(data);
    React.useEffect(() => { data_ref.current = data; }, [data]);

    // Automatic Backup on Entry/Login
    const has_auto_backed_up = React.useRef(false);
    React.useEffect(() => {
        // Trigger backup when:
        // 1. Auto-backup is enabled in settings
        // 2. Data is not currently loading
        // 3. We haven't already backed up in this specific component mount session
        // 4. We have a user (meaning we are logged in)
        if (is_auto_backup_enabled && !is_data_loading && !has_auto_backed_up.current && user) {
            const today = new Date().toISOString().split('T')[0];
            const session_backup_key = `auto_backup_done_${today}_${user.id}`;
            const already_done_this_session = sessionStorage.getItem(session_backup_key);

            if (!already_done_this_session) {
                console.log("Auto-backup condition met. Waiting 3 seconds to ensure data is stable...");
                const timer = setTimeout(() => {
                    try {
                        console.log("Attempting automatic backup on login/entry...");
                        const current_data = data_ref.current;
                        const data_str = JSON.stringify(current_data, null, 2);
                        const blob = new Blob([data_str], { type: 'application/json' });
                        const url = URL.createObjectURL(blob);
                        const link = document.createElement('a');
                        link.style.display = 'none';
                        link.href = url;
                        link.download = `lawyer_auto_backup_${today}.json`;
                        document.body.appendChild(link);
                        link.click();
                        
                        setTimeout(() => {
                            if (document.body.contains(link)) document.body.removeChild(link);
                            URL.revokeObjectURL(url);
                        }, 100);
                        
                        sessionStorage.setItem(session_backup_key, 'true');
                        localStorage.setItem('last_auto_backup_date', today);
                        has_auto_backed_up.current = true;
                        console.log("Automatic backup on login/entry performed successfully.");
                    } catch (e) {
                        console.error("Auto backup failed:", e);
                    }
                }, 3000);
                return () => clearTimeout(timer);
            } else {
                has_auto_backed_up.current = true;
            }
        }
    }, [is_auto_backup_enabled, is_data_loading, user?.id]);
    
    const set_full_data = React.useCallback((new_data: Partial<AppData> | ((prev: AppData) => Partial<AppData>)) => {
        set_data(prev => {
            const updates = typeof new_data === 'function' ? new_data(prev) : new_data;
            const merged = { ...prev, ...updates };
            // Apply migration to ensure consistency even on manual imports
            return migrate_data(merged);
        });
        set_dirty(true);
    }, []);

    // Persist data to IndexedDB whenever it changes
    React.useEffect(() => {
        const save_to_db = async () => {
            if (is_data_loading) return; // Don't save while initial loading is in progress
            try {
                const db = await get_db();
                const storage_key = get_app_data_key(user?.id || null);
                await db.put(DATA_STORE_NAME, data, storage_key);
            } catch (err) {
                console.error("Failed to save data to IndexedDB:", err);
            }
        };
        save_to_db();
    }, [data, user?.id, is_data_loading]);

    // Persist deleted_ids to IndexedDB whenever it changes
    React.useEffect(() => {
        const save_deleted_ids_to_db = async () => {
            if (is_data_loading) return;
            try {
                const db = await get_db();
                const storage_key = get_app_data_key(user?.id || null);
                await db.put(DELETED_IDS_STORE_NAME, deleted_ids, storage_key);
            } catch (err) {
                console.error("Failed to save deleted_ids to IndexedDB:", err);
            }
        };
        save_deleted_ids_to_db();
    }, [deleted_ids, user?.id, is_data_loading]);

    // Auto-sync local changes to cloud
    React.useEffect(() => {
        const has_deleted_ids = Object.values(deleted_ids).some(arr => arr.length > 0);
        if ((is_dirty || has_deleted_ids) && is_auto_sync_enabled && is_online && user && sync_status !== 'syncing') {
            const timer = setTimeout(() => {
                console.log("Auto-syncing local changes to cloud...");
                manual_sync();
            }, 2000); // Wait 2 seconds of inactivity before auto-syncing local changes
            return () => clearTimeout(timer);
        }
    }, [is_dirty, deleted_ids, is_auto_sync_enabled, is_online, user?.id, sync_status, manual_sync]);

    const is_local_empty = React.useMemo(() => {
        return data.clients.length === 0 && 
               data.admin_tasks.length === 0 && 
               data.appointments.length === 0 && 
               data.accounting_entries.length === 0 && 
               data.invoices.length === 0 && 
               data.documents.length === 0;
    }, [data]);

    const all_sessions = React.useMemo(() => {
        return data.clients.flatMap(c => 
            c.cases.flatMap(cs => 
                cs.stages.flatMap(st => 
                    st.sessions.map(s => ({
                        ...s,
                        client_name: s.client_name || c.name,
                        opponent_name: s.opponent_name || cs.opponent_name,
                        case_number: s.case_number || cs.subject || cs.id,
                        stage_id: s.stage_id || st.id,
                        is_postponed: Boolean(s.is_postponed)
                    }))
                )
            )
        );
    }, [data.clients]);

    const unpostponed_sessions = React.useMemo(() => {
        return all_sessions.filter(s => !s.is_postponed && !s.stage_decision_date);
    }, [all_sessions]);

    return {
        ...data,
        clients: filtered_clients,
        sync_status: sync_status, 
        manual_sync: manual_sync, 
        last_sync_error: last_sync_error, 
        is_dirty: is_dirty, 
        is_data_loading: is_data_loading,
        sync_log: sync_log, 
        clear_sync_log: () => set_sync_log([]),
        is_local_empty: is_local_empty,
        effective_user_id: effective_user_id, 
        permissions: current_user_permissions,
        user_id: user?.id || '',
        is_online: is_online,
        is_auto_sync_enabled: is_auto_sync_enabled, 
        set_auto_sync_enabled: set_auto_sync_enabled,
        is_auto_backup_enabled: is_auto_backup_enabled, 
        set_auto_backup_enabled: set_auto_backup_enabled,
        admin_tasks_layout: admin_tasks_layout, 
        set_admin_tasks_layout: set_admin_tasks_layout,
        location_order: location_order, 
        set_location_order: set_location_order,
        set_full_data: set_full_data,
        fetch_and_refresh: fetch_and_refresh,
        triggered_alerts: triggered_alerts, 
        dismiss_alert: (id: string) => set_triggered_alerts(p => p.filter(a => a.id !== id)),
        realtime_alerts: realtime_alerts, 
        dismiss_realtime_alert: (id: number) => set_realtime_alerts(p => p.filter(a => a.id !== id)),
        user_approval_alerts: user_approval_alerts, 
        dismiss_user_approval_alert: (id: number) => set_user_approval_alerts(p => p.filter(a => a.id !== id)),
        set_clients: (clients: any) => {
            const now = new Date().toISOString();
            set_full_data(prev => {
                const next_clients = typeof clients === 'function' ? clients(prev.clients) : clients;
                // Ensure updated_at is set for new/modified items
                const updated_clients = next_clients.map((c: any) => {
                    const prev_c = prev.clients.find(pc => pc.id === c.id);
                    if (!prev_c || JSON.stringify(prev_c) !== JSON.stringify(c)) {
                        return { ...c, updated_at: now };
                    }
                    return c;
                });
                return { ...prev, clients: updated_clients };
            });
        },
        set_admin_tasks: (tasks: any) => {
            const now = new Date().toISOString();
            set_full_data(prev => {
                const next_tasks = typeof tasks === 'function' ? tasks(prev.admin_tasks) : tasks;
                const updated_tasks = next_tasks.map((t: any) => {
                    const prev_t = prev.admin_tasks.find(pt => pt.id === t.id);
                    if (!prev_t || JSON.stringify(prev_t) !== JSON.stringify(t)) {
                        return { ...t, updated_at: now };
                    }
                    return t;
                });
                return { ...prev, admin_tasks: updated_tasks };
            });
        },
        set_appointments: (appointments: any) => {
            const now = new Date().toISOString();
            set_full_data(prev => {
                const next_apps = typeof appointments === 'function' ? appointments(prev.appointments) : appointments;
                const updated_apps = next_apps.map((a: any) => {
                    const prev_a = prev.appointments.find(pa => pa.id === a.id);
                    if (!prev_a || JSON.stringify(prev_a) !== JSON.stringify(a)) {
                        return { ...a, updated_at: now };
                    }
                    return a;
                });
                return { ...prev, appointments: updated_apps };
            });
        },
        set_accounting_entries: (entries: any) => {
            const now = new Date().toISOString();
            set_full_data(prev => {
                const next_entries = typeof entries === 'function' ? entries(prev.accounting_entries) : entries;
                const updated_entries = next_entries.map((e: any) => {
                    const prev_e = prev.accounting_entries.find(pe => pe.id === e.id);
                    if (!prev_e || JSON.stringify(prev_e) !== JSON.stringify(e)) {
                        return { ...e, updated_at: now };
                    }
                    return e;
                });
                return { ...prev, accounting_entries: updated_entries };
            });
        },
        set_invoices: (invoices: any) => {
            const now = new Date().toISOString();
            set_full_data(prev => {
                const next_invoices = typeof invoices === 'function' ? invoices(prev.invoices) : invoices;
                const updated_invoices = next_invoices.map((i: any) => {
                    const prev_i = prev.invoices.find(pi => pi.id === i.id);
                    if (!prev_i || JSON.stringify(prev_i) !== JSON.stringify(i)) {
                        return { ...i, updated_at: now };
                    }
                    return i;
                });
                return { ...prev, invoices: updated_invoices };
            });
        },
        set_assistants: (assistants: any) => {
            set_full_data(prev => ({ 
                ...prev,
                assistants: typeof assistants === 'function' ? assistants(prev.assistants) : assistants 
            }));
        },
        set_profiles: (profiles: any) => {
            set_full_data(prev => ({ 
                ...prev,
                profiles: typeof profiles === 'function' ? profiles(prev.profiles) : profiles 
            }));
        },
        set_site_finances: (finances: any) => {
            set_full_data(prev => ({ 
                ...prev,
                site_finances: typeof finances === 'function' ? finances(prev.site_finances) : finances 
            }));
        },
        all_sessions, 
        unpostponed_sessions, 
        export_data: () => {
            try {
                const data_str = JSON.stringify(data, null, 2);
                const blob = new Blob([data_str], { type: 'application/json' });
                const url = URL.createObjectURL(blob);
                const link = document.createElement('a');
                link.href = url;
                link.download = `lawyer_backup_${new Date().toISOString().split('T')[0]}.json`;
                document.body.appendChild(link);
                link.click();
                document.body.removeChild(link);
                URL.revokeObjectURL(url);
                return true;
            } catch (e) {
                console.error("Export failed:", e);
                return false;
            }
        },
        delete_client: (id: string) => {
            set_deleted_ids(prev => ({ ...prev, clients: [...prev.clients, id] }));
            set_full_data(prev => ({ ...prev, clients: prev.clients.filter(c => c.id !== id) }));
        },
        delete_case: (client_id: string, case_id: string) => {
            set_deleted_ids(prev => ({ ...prev, cases: [...prev.cases, case_id] }));
            set_full_data(prev => ({
                ...prev,
                clients: prev.clients.map(c => c.id === client_id ? {
                    ...c,
                    cases: c.cases.filter(cs => cs.id !== case_id)
                } : c)
            }));
        },
        delete_stage: (client_id: string, case_id: string, stage_id: string) => {
            set_deleted_ids(prev => ({ ...prev, stages: [...prev.stages, stage_id] }));
            set_full_data(prev => ({
                ...prev,
                clients: prev.clients.map(c => c.id === client_id ? {
                    ...c,
                    cases: c.cases.map(cs => cs.id === case_id ? {
                        ...cs,
                        stages: cs.stages.filter(st => st.id !== stage_id)
                    } : cs)
                } : c)
            }));
        },
        delete_session: (client_id: string, case_id: string, stage_id: string, session_id: string) => {
            set_deleted_ids(prev => ({ ...prev, sessions: [...prev.sessions, session_id] }));
            set_full_data(prev => ({
                ...prev,
                clients: prev.clients.map(c => c.id === client_id ? {
                    ...c,
                    cases: c.cases.map(cs => cs.id === case_id ? {
                        ...cs,
                        stages: cs.stages.map(st => st.id === stage_id ? {
                            ...st,
                            sessions: st.sessions.filter(s => s.id !== session_id)
                        } : st)
                    } : cs)
                } : c)
            }));
        },
        delete_admin_task: (id: string) => {
            set_deleted_ids(prev => ({ ...prev, admin_tasks: [...prev.admin_tasks, id] }));
            set_full_data(prev => ({ ...prev, admin_tasks: prev.admin_tasks.filter(t => t.id !== id) }));
        },
        delete_appointment: (id: string) => {
            set_deleted_ids(prev => ({ ...prev, appointments: [...prev.appointments, id] }));
            set_full_data(prev => ({ ...prev, appointments: prev.appointments.filter(a => a.id !== id) }));
        },
        delete_accounting_entry: (id: string) => {
            set_deleted_ids(prev => ({ ...prev, accounting_entries: [...prev.accounting_entries, id] }));
            set_full_data(prev => ({ ...prev, accounting_entries: prev.accounting_entries.filter(e => e.id !== id) }));
        },
        delete_invoice: (id: string) => {
            set_deleted_ids(prev => ({ ...prev, invoices: [...prev.invoices, id] }));
            set_full_data(prev => ({ ...prev, invoices: prev.invoices.filter(i => i.id !== id) }));
        },
        delete_assistant: (name: string) => {
            set_deleted_ids(prev => ({ ...prev, assistants: [...prev.assistants, name] }));
            set_full_data(prev => ({ ...prev, assistants: prev.assistants.filter(a => a !== name) }));
        },
        delete_document: (doc: CaseDocument | string) => {
            const id = typeof doc === 'string' ? doc : doc.id;
            
            set_full_data(prev => {
                const document = prev.documents.find(d => d.id === id);
                if (document) {
                    set_deleted_ids(p => ({ 
                        ...p, 
                        documents: [...p.documents, id],
                        document_paths: [...p.document_paths, document.storage_path]
                    }));
                }
                return { ...prev, documents: prev.documents.filter(d => d.id !== id) };
            });
        },
        add_documents: async (case_id: string, files: FileList | CaseDocument[]) => {
            if (files instanceof FileList) {
                const new_docs: CaseDocument[] = [];
                for (let i = 0; i < files.length; i++) {
                    const file = files[i];
                    const id = crypto.randomUUID();
                    const safe_filename = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
                    const storage_path = `${user?.id}/${case_id}/${id}-${safe_filename}`;
                    
                    const new_doc: CaseDocument = {
                        id,
                        case_id,
                        user_id: user?.id || '',
                        name: file.name,
                        type: file.type,
                        size: file.size,
                        added_at: new Date().toISOString(),
                        storage_path,
                        local_state: 'pending_upload',
                        updated_at: new Date().toISOString()
                    };
                    
                    // Save file to IndexedDB for later upload
                    const db = await get_db();
                    await db.put(DOCS_FILES_STORE_NAME, file, id);
                    
                    new_docs.push(new_doc);
                }
                set_full_data(prev => ({ ...prev, documents: [...prev.documents, ...new_docs] }));
            } else {
                set_full_data(prev => ({ ...prev, documents: [...prev.documents, ...files] }));
            }
        },
        get_document_file: async (id: string) => {
            const db = await get_db();
            return await db.get(DOCS_FILES_STORE_NAME, id);
        },
        postpone_session: (session_id: string, next_date: string, reason: string): string | null => {
            if (is_holiday(safe_revive_date(next_date))) {
                return 'تحذير: التاريخ المختار يصادف عطلة رسمية أو نهاية أسبوع.';
            }
            set_full_data(prev => {
                // Find the session and its context
                let found_client_id = '';
                let found_case_id = '';
                let found_stage_id = '';
                let found_session: Session | null = null;

                for (const client of prev.clients) {
                    for (const case_item of client.cases) {
                        for (const stage of case_item.stages) {
                            const session = stage.sessions.find(s => s.id === session_id);
                            if (session) {
                                found_client_id = client.id;
                                found_case_id = case_item.id;
                                found_stage_id = stage.id;
                                found_session = session;
                                break;
                            }
                        }
                        if (found_session) break;
                    }
                    if (found_session) break;
                }

                if (!found_session) return prev;

                const now = new Date().toISOString();

                return {
                    ...prev,
                    clients: prev.clients.map(c => c.id === found_client_id ? {
                        ...c,
                        cases: c.cases.map(cs => cs.id === found_case_id ? {
                            ...cs,
                            stages: cs.stages.map(st => st.id === found_stage_id ? {
                               ...st,
                                sessions: [
                                    ...st.sessions.map(s => s.id === session_id ? {
                                        ...s,
                                        is_postponed: true,
                                        next_session_date: next_date,
                                        next_postponement_reason: reason,
                                        updated_at: now
                                    } : s),
                                    {
                                        ...found_session!,
                                        id: crypto.randomUUID(),
                                        date: next_date,
                                        is_postponed: false,
                                        postponement_reason: reason,
                                        next_session_date: undefined,
                                        next_postponement_reason: undefined,
                                        updated_at: now
                                    } as Session
                                ]
                            } : st)
                        } : cs)
                    } : c)
                };
            });
            return null;
        }
    };
};
