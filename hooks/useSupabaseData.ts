import * as React from "react";
import {
  Client,
  Session,
  AdminTask,
  Appointment,
  AccountingEntry,
  Case,
  Stage,
  Invoice,
  InvoiceItem,
  CaseDocument,
  AppData,
  DeletedIds,
  get_initial_deleted_ids,
  Profile,
  SiteFinancialEntry,
  Permissions,
  default_permissions,
} from "../types";
import { useOnlineStatus } from "./useOnlineStatus";
import type { User } from "@supabase/supabase-js";
import {
  use_sync,
  SyncStatus as SyncStatusType,
  SyncLogEntry,
} from "./useSync";
import { get_supabase_client } from "../supabaseClient";
import {
  is_before_today,
  to_input_date_string,
  is_holiday,
  safe_revive_date,
  is_today,
} from "../utils/dateUtils";
import { generateId } from "../utils/idUtils";
import { RealtimeAlert } from "../components/RealtimeNotifier";
import {
  get_db,
  DATA_STORE_NAME,
  DELETED_IDS_STORE_NAME,
  DOCS_FILES_STORE_NAME,
} from "../utils/db";

export const APP_DATA_KEY_PREFIX = "lawyerBusinessManagementData";
export const APP_VERSION = "30-04-2026";
export const get_app_data_key = (user_id: string | null) =>
  user_id ? `${APP_DATA_KEY_PREFIX}_${user_id}` : APP_DATA_KEY_PREFIX;

export type SyncStatus = SyncStatusType;
const default_assistants = ["بدون تخصيص"];

const get_initial_data = (): AppData => ({
  clients: [],
  admin_tasks: [],
  appointments: [],
  accounting_entries: [],
  invoices: [],
  assistants: [...default_assistants],
  documents: [],
  profiles: [],
  site_finances: [],
});

const migrate_data = (old_data: any): AppData => {
  if (!old_data) return get_initial_data();

  const migrate_session = (s: any): Session => ({
    id: s.id,
    court: s.court || "",
    case_number: s.case_number || s.caseNumber || "",
    date: s.date || "",
    client_name: s.client_name || s.clientName || "",
    opponent_name: s.opponent_name || s.opponentName || "",
    postponement_reason: s.postponement_reason || s.postponementReason,
    next_postponement_reason:
      s.next_postponement_reason || s.nextPostponementReason,
    is_postponed: Boolean(s.is_postponed ?? s.isPostponed),
    next_session_date: s.next_session_date || s.nextSessionDate,
    assignee: s.assignee,
    stage_id: s.stage_id || s.stageId,
    updated_at: s.updated_at || s.updatedAt,
    user_id: s.user_id || s.userId,
  });

  const migrate_stage = (st: any): Stage => ({
    id: st.id,
    court: st.court || "",
    case_number: st.case_number || st.caseNumber || "",
    first_session_date: st.first_session_date || st.firstSessionDate,
    sessions: (st.sessions || []).map(migrate_session),
    decision_date: st.decision_date || st.decisionDate,
    decision_number: st.decision_number || st.decisionNumber,
    decision_summary: st.decision_summary || st.decisionSummary,
    decision_notes: st.decision_notes || st.decisionNotes,
    updated_at: st.updated_at || st.updatedAt,
    user_id: st.user_id || st.userId,
    case_id: st.case_id || st.caseId,
  });

  const migrate_case = (c: any): Case => ({
    id: c.id,
    subject: c.subject || "",
    client_name: c.client_name || c.clientName || "",
    opponent_name: c.opponent_name || c.opponentName || "",
    stages: (c.stages || []).map(migrate_stage),
    tasks: (c.tasks || []).map((t: any) => {
      let img = t.image_url || t.imageUrl;
      let cleanTask = t.task || "";
      if (!img && cleanTask.includes("<!--IMG:")) {
        const match = cleanTask.match(/<!--IMG:([\s\S]*?)-->/);
        if (match) img = match[1];
      }
      if (cleanTask.includes("<!--IMG:")) {
        cleanTask = cleanTask.replace(/<!--IMG:[\s\S]*?-->/g, "").trim();
      }
      return {
        id: t.id,
        task: cleanTask,
        due_date: t.due_date || t.dueDate || "",
        completed: Boolean(t.completed),
        importance: t.importance || "normal",
        assignee: t.assignee,
        image_url: img,
        updated_at: t.updated_at || t.updatedAt,
      };
    }),
    fee_agreement: c.fee_agreement || c.feeAgreement || "",
    status: c.status || "active",
    updated_at: c.updated_at || c.updatedAt,
    user_id: c.user_id || c.userId,
    client_id: c.client_id || c.clientId || "",
  });

  const migrate_client = (c: any): Client => ({
    id: c.id,
    name: c.name || "",
    contact_info: c.contact_info || "",
    cases: (c.cases || []).map(migrate_case),
    updated_at: c.updated_at || c.updatedAt,
    user_id: c.user_id || c.userId,
  });

  const migrate_task = (t: any): AdminTask => {
    let img = t.image_url || t.imageUrl;
    let cleanTask = t.task || "";
    if (!img && cleanTask.includes("<!--IMG:")) {
      const match = cleanTask.match(/<!--IMG:([\s\S]*?)-->/);
      if (match) img = match[1];
    }
    if (cleanTask.includes("<!--IMG:")) {
      cleanTask = cleanTask.replace(/<!--IMG:[\s\S]*?-->/g, "").trim();
    }
    return {
      id: t.id,
      user_id: t.user_id || t.userId,
      task: cleanTask,
      due_date: t.due_date || t.dueDate || "",
      completed: Boolean(t.completed),
      importance: t.importance || "normal",
      assignee: t.assignee,
      location: t.location,
      image_url: img,
      case_id: t.case_id || t.caseId,
      updated_at: t.updated_at || t.updatedAt,
      order_index: t.order_index ?? t.orderIndex,
    };
  };

  const migrate_appointment = (a: any): Appointment => ({
    id: a.id,
    title: a.title || "",
    time: a.time || "",
    date: a.date || "",
    importance: a.importance || "normal",
    completed: Boolean(a.completed),
    notified: Boolean(a.notified),
    reminder_time_in_minutes:
      a.reminder_time_in_minutes ?? a.reminderTimeInMinutes,
    assignee: a.assignee,
    updated_at: a.updated_at || a.updatedAt,
    user_id: a.user_id || a.userId,
  });

  const migrate_accounting = (e: any): AccountingEntry => ({
    id: e.id,
    type: e.type || "income",
    amount: Number(e.amount || 0),
    date: e.date || "",
    description: e.description || "",
    client_id: e.client_id || e.clientId || "",
    case_id: e.case_id || e.caseId || "",
    client_name: e.client_name || e.clientName || "",
    updated_at: e.updated_at || e.updatedAt,
    user_id: e.user_id || e.userId,
  });

  const migrate_document = (d: any): CaseDocument => ({
    id: d.id,
    case_id: d.case_id || d.caseId || "",
    user_id: d.user_id || d.userId || "",
    name: d.name || "",
    type: d.type || "",
    size: Number(d.size || 0),
    added_at: d.added_at || d.addedAt || "",
    storage_path: d.storage_path || d.storagePath || "",
    local_state: d.local_state || d.localState || "synced",
    updated_at: d.updated_at || d.updatedAt,
  });

  const migrate_invoice_item = (i: any): InvoiceItem => ({
    id: i.id,
    invoice_id: i.invoice_id || i.invoiceId,
    description: i.description || "",
    amount: Number(i.amount || 0),
    updated_at: i.updated_at || i.updatedAt,
    user_id: i.user_id || i.userId,
  });

  const migrate_invoice = (i: any): Invoice => ({
    id: i.id,
    client_id: i.client_id || i.clientId || "",
    client_name: i.client_name || i.clientName || "",
    case_id: i.case_id || i.caseId,
    case_subject: i.case_subject || i.caseSubject,
    issue_date: i.issue_date || i.issueDate || "",
    due_date: i.due_date || i.dueDate || "",
    items: (i.items || []).map(migrate_invoice_item),
    tax_rate: Number(i.tax_rate || i.taxRate || 0),
    discount: Number(i.discount || 0),
    status: i.status || "draft",
    notes: i.notes,
    updated_at: i.updated_at || i.updatedAt,
    user_id: i.user_id || i.userId,
  });

  const migrate_profile = (p: any): Profile => ({
    id: p.id,
    full_name: p.full_name || p.fullName || "",
    mobile_number: p.mobile_number || p.mobileNumber || "",
    is_approved: Boolean(p.is_approved ?? p.isApproved),
    is_active: Boolean(p.is_active ?? p.isActive),
    mobile_verified: Boolean(p.mobile_verified ?? p.mobileVerified),
    trial_used: Boolean(p.trial_used ?? p.trialUsed),
    subscription_start_date:
      p.subscription_start_date || p.subscriptionStartDate,
    subscription_end_date: p.subscription_end_date || p.subscriptionEndDate,
    role: p.role || "user",
    permissions: p.permissions,
    lawyer_id: p.lawyer_id || p.lawyerId,
    admin_tasks_layout:
      p.admin_tasks_layout || p.adminTasksLayout || "vertical",
    created_at: p.created_at || p.createdAt,
    updated_at: p.updated_at || p.updatedAt,
  });

  const migrate_site_finance = (f: any): SiteFinancialEntry => ({
    id: f.id,
    user_id: f.user_id || f.userId,
    type: f.type || "income",
    payment_date: f.payment_date || f.paymentDate || "",
    amount: Number(f.amount || 0),
    description: f.description,
    payment_method: f.payment_method || f.paymentMethod,
    category: f.category,
    updated_at: f.updated_at || f.updatedAt,
  });

  return {
    clients: (old_data.clients || []).map(migrate_client),
    admin_tasks: (old_data.admin_tasks || old_data.adminTasks || []).map(
      migrate_task,
    ),
    appointments: (old_data.appointments || []).map(migrate_appointment),
    accounting_entries: (
      old_data.accounting_entries ||
      old_data.accountingEntries ||
      []
    ).map(migrate_accounting),
    invoices: (old_data.invoices || []).map(migrate_invoice),
    assistants: (old_data.assistants || [...default_assistants]).map(
      (a: any) => {
        if (typeof a === "string") return a;
        if (typeof a === "object" && a !== null) {
          // If it's an object from Supabase, keep it as is (it will have name and user_id)
          return a;
        }
        return "بدون اسم";
      },
    ),
    documents: (old_data.documents || []).map(migrate_document),
    profiles: (old_data.profiles || []).map(migrate_profile),
    site_finances: (old_data.site_finances || []).map(migrate_site_finance),
  };
};

export const useSupabaseData = (
  user: User | null,
  is_auth_loading: boolean,
) => {
  const [data, set_data] = React.useState<AppData>(get_initial_data);
  const [deleted_ids, set_deleted_ids] = React.useState<DeletedIds>(
    get_initial_deleted_ids,
  );
  const [is_dirty, set_dirty] = React.useState(false);
  const [sync_status, set_sync_status] = React.useState<SyncStatus>("loading");
  const [last_sync_error, set_last_sync_error] = React.useState<string | null>(
    null,
  );
  const [sync_log, set_sync_log] = React.useState<SyncLogEntry[]>([]);
  const [is_data_loading, set_is_data_loading] = React.useState(true);
  const [triggered_alerts, set_triggered_alerts] = React.useState<
    Appointment[]
  >([]);
  const [realtime_alerts, set_realtime_alerts] = React.useState<
    RealtimeAlert[]
  >([]);
  const [user_approval_alerts, set_user_approval_alerts] = React.useState<
    RealtimeAlert[]
  >([]);
  const [is_update_available, set_is_update_available] = React.useState(false);
  const [whatsapp_share_data, set_whatsapp_share_data] = React.useState<{
    text: string;
    phone?: string;
  } | null>(null);

  const share_via_whatsapp = React.useCallback((text: string, phone?: string) => {
    set_whatsapp_share_data({ text, phone });
  }, []);
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

  const [admin_viewing_user_id, set_admin_viewing_user_id] = React.useState<
    string | null
  >(null);

  // Reset admin viewing mode when user changes (e.g. logout)
  React.useEffect(() => {
    set_admin_viewing_user_id(null);
  }, [user?.id]);

  // Check for updates by fetching version.json from server
  React.useEffect(() => {
    const check_for_updates = async () => {
      try {
        // Fetch version.json with a timestamp to bypass browser cache
        const response = await fetch(`/version.json?t=${Date.now()}`);
        if (!response.ok) return;
        
        const contentType = response.headers.get("content-type");
        if (contentType && contentType.includes("text/html")) {
          return; // Avoid parsing HTML fallback
        }

        const text = await response.text();
        let server_data;
        try {
          server_data = JSON.parse(text);
        } catch (e) {
          // If the response is not valid JSON, silently return
          return;
        }

        const stored_version = localStorage.getItem("app_version");

        // Update is available if:
        // 1. Current hardcoded APP_VERSION is not equal to server version
        // 2. OR stored local version is not equal to server version
        if (
          server_data.version !== APP_VERSION ||
          (stored_version && stored_version !== server_data.version)
        ) {
          console.log(
            `Update available: Server(${server_data.version}) vs App(${APP_VERSION})`,
          );
          set_is_update_available(true);
          
          // Auto Update Logic with infinite loop prevention
          const lastAutoUpdateStr = sessionStorage.getItem('last_auto_update_time');
          const lastAutoUpdate = lastAutoUpdateStr ? parseInt(lastAutoUpdateStr, 10) : 0;
          const timeSinceLastUpdate = Date.now() - lastAutoUpdate;
          
          // Only auto-reload if we haven't tried in the last 60 seconds
          if (timeSinceLastUpdate > 60000) {
            sessionStorage.setItem('last_auto_update_time', Date.now().toString());
            console.log("Automatically applying update...");
            
            try {
              if ('serviceWorker' in navigator) {
                const registrations = await navigator.serviceWorker.getRegistrations();
                for (const registration of registrations) {
                  await registration.unregister();
                }
              }
              if ('caches' in window) {
                  const cacheNames = await caches.keys();
                  for (let name of cacheNames) {
                      if (name !== 'lawyer-app-cache-v2026-04-30') { // Keep specific versions if needed, or clear all
                          await caches.delete(name);
                      }
                  }
              }
            } catch(e) {
                console.error("Cache clear failed during auto-update:", e);
            }
            
            localStorage.setItem("app_version", server_data.version || APP_VERSION);
            window.location.reload();
            return;
          }
        } else {
          set_is_update_available(false);
        }
      } catch (error) {
        // Silently fallback to basic local check if fetch fails (common in dev mode or offline)
        const stored_version = localStorage.getItem("app_version");
        if (stored_version && stored_version !== APP_VERSION) {
          set_is_update_available(true);
        }
      }
    };

    check_for_updates();

    // Optionally check every 30 minutes
    const interval = setInterval(check_for_updates, 30 * 60 * 1000);
    return () => clearInterval(interval);
  }, []);

  const effective_user_id = React.useMemo(() => {
    if (admin_viewing_user_id) return admin_viewing_user_id;
    if (!user) return null;
    const current_user_profile = data.profiles.find((p) => p.id === user.id);
    return current_user_profile?.lawyer_id || user.id;
  }, [user, data.profiles, admin_viewing_user_id]);

  const is_admin = React.useMemo(() => {
    if (!user) return false;
    const current_user_profile = data.profiles.find((p) => p.id === user.id);
    return current_user_profile?.role === "admin";
  }, [user, data.profiles]);

  const filtered_data = React.useMemo(() => {
    // If not admin, we always use the full data (which is already filtered by user_id in useSync/useOnlineData)
    if (!is_admin) return data;

    // If admin but NOT viewing a specific user, default to viewing ONLY their own data
    // This prevents admins from seeing everyone's data mixed together by default.
    const target_user_id = admin_viewing_user_id || user?.id;

    if (!target_user_id) return data;

    return {
      ...data,
      clients: data.clients.filter((c) => c.user_id === target_user_id),
      admin_tasks: data.admin_tasks.filter((t) => t.user_id === target_user_id),
      appointments: data.appointments.filter(
        (a) => a.user_id === target_user_id,
      ),
      accounting_entries: data.accounting_entries.filter(
        (e) => e.user_id === target_user_id,
      ),
      invoices: data.invoices.filter((i) => i.user_id === target_user_id),
      documents: data.documents.filter((d) => d.user_id === target_user_id),
      site_finances: data.site_finances.filter(
        (f) => f.user_id === target_user_id,
      ),
      assistants: data.assistants.filter((a: any) => {
        // If they are strings, assume they are the default system dropdown items
        if (typeof a === "string") {
          return true; // default_assistants
        }
        // If assistants are objects with user_id, explicitly filter them.
        if (typeof a === "object" && a !== null && "user_id" in a) {
          if (is_admin && !admin_viewing_user_id) {
            // If admin is NOT viewing a specific user, they should only see their own assistants or system ones
            // Otherwise the dropdown becomes a massive mess of all assistants across the app
            return a.user_id === user?.id; 
          }
          return a.user_id === target_user_id;
        }
        // If it's some other weird object without user_id, keep it just in case
        return true;
      }),
    };
  }, [data, is_admin, admin_viewing_user_id, user?.id]);

  const current_user_profile: Profile | null = React.useMemo(() => {
    if (!user) return null;
    return data.profiles.find((p) => p.id === user.id) || null;
  }, [user, data.profiles]);

  const current_user_permissions: Permissions = React.useMemo(() => {
    if (!user) return default_permissions;
    if (current_user_profile?.lawyer_id) {
      const perms = current_user_profile.permissions;
      if (perms && typeof perms === "object") {
        // If it's the assistant object from the database, the actual flags are in the 'permissions' field
        const actual_perms = (perms as any).permissions || perms;
        return { ...default_permissions, ...actual_perms };
      }
      return { ...default_permissions, ...(perms || {}) };
    }
    return {
      can_view_agenda: true,
      can_view_clients: true,
      can_add_client: true,
      can_edit_client: true,
      can_delete_client: true,
      can_view_cases: true,
      can_add_case: true,
      can_edit_case: true,
      can_delete_case: true,
      can_view_sessions: true,
      can_add_session: true,
      can_edit_session: true,
      can_delete_session: true,
      can_postpone_session: true,
      can_decide_session: true,
      can_view_documents: true,
      can_add_document: true,
      can_delete_document: true,
      can_view_finance: true,
      can_add_financial_entry: true,
      can_delete_financial_entry: true,
      can_manage_invoices: true,
      can_view_admin_tasks: true,
      can_add_admin_task: true,
      can_edit_admin_task: true,
      can_delete_admin_task: true,
      can_view_reports: true,
    };
  }, [user, data.profiles]);

  const filtered_clients = React.useMemo(() => {
    return filtered_data.clients;
  }, [filtered_data.clients]);

  // Load initial data from IndexedDB on mount or when user changes
  React.useEffect(() => {
    const load_local_data = async () => {
      if (is_auth_loading) return;

      // If admin is viewing a specific user, we don't load local data for the admin.
      // Instead, we let the sync fetch the remote data for that user.
      if (admin_viewing_user_id) {
        console.log(
          "Admin is viewing user:",
          admin_viewing_user_id,
          " - skipping local load.",
        );
        set_data(get_initial_data());
        set_deleted_ids(get_initial_deleted_ids());
        set_is_data_loading(true); // Ensure sync is triggered
        return;
      }

      const storage_key = get_app_data_key(user?.id || null);
      console.log(`Loading local data for key: ${storage_key}`);

      try {
        const db = await get_db();
        const cached_data = await db.get(DATA_STORE_NAME, storage_key);
        let has_local_data = false;
        if (cached_data) {
          console.log(
            "Loaded data from IndexedDB for user:",
            user?.id || "guest",
          );

          // Migration: Rename camelCase to snake_case and handle old structures
          const migrated = migrate_data(cached_data);
          set_data(migrated);
          has_local_data = 
            migrated.clients.length > 0 || 
            migrated.admin_tasks.length > 0 || 
            migrated.appointments.length > 0 || 
            migrated.accounting_entries.length > 0;
        } else {
          // Reset to initial data if no cache for this specific user
          set_data(get_initial_data());
        }

        const cached_deleted_ids = await db.get(
          DELETED_IDS_STORE_NAME,
          storage_key,
        );
        if (cached_deleted_ids) {
          console.log(
            "Loaded deleted_ids from IndexedDB for user:",
            user?.id || "guest",
          );
          set_deleted_ids(cached_deleted_ids);
        } else {
          set_deleted_ids(get_initial_deleted_ids());
        }
        
        if (cached_data) {
          set_is_data_loading(false);
          set_sync_status("synced");
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
  }, [user?.id, is_online, is_auth_loading, admin_viewing_user_id]);

  const [is_auto_sync_enabled, set_auto_sync_enabled_state] = React.useState<boolean>(() => {
    try {
      const saved = localStorage.getItem("is_auto_sync_enabled");
      if (saved !== null) return JSON.parse(saved);
    } catch (e) {}
    return true;
  });

  const [is_auto_backup_enabled, set_auto_backup_enabled_state] = React.useState<boolean>(() => {
    try {
      const saved = localStorage.getItem("is_auto_backup_enabled");
      if (saved !== null) return JSON.parse(saved);
    } catch (e) {}
    return false;
  });

  const [admin_tasks_layout, set_admin_tasks_layout_state] = React.useState<
    "horizontal" | "vertical"
  >(() => {
    try {
      const saved = localStorage.getItem("admin_tasks_layout");
      if (saved === "horizontal" || saved === "vertical") return saved;
    } catch (e) {}
    return "vertical";
  });

  // Load user specific settings when user changes
  React.useEffect(() => {
    if (!user?.id) return;
    try {
      const syncKey = `is_auto_sync_enabled_${user.id}`;
      const syncSaved = localStorage.getItem(syncKey);
      if (syncSaved !== null) set_auto_sync_enabled_state(JSON.parse(syncSaved));

      const backupKey = `is_auto_backup_enabled_${user.id}`;
      const backupSaved = localStorage.getItem(backupKey);
      if (backupSaved !== null) set_auto_backup_enabled_state(JSON.parse(backupSaved));

      const layoutKey = `admin_tasks_layout_${user.id}`;
      const layoutSaved = localStorage.getItem(layoutKey);
      if (layoutSaved === "horizontal" || layoutSaved === "vertical") {
        set_admin_tasks_layout_state(layoutSaved as "horizontal" | "vertical");
      }
    } catch (e) {
      console.error("Error loading user settings from localStorage:", e);
    }
  }, [user?.id]);

  const { manual_sync: manual_sync, fetch_and_refresh: fetch_and_refresh } =
    use_sync({
      user: user,
      effective_user_id: effective_user_id,
      local_data: data,
      deleted_ids: deleted_ids,
      on_data_synced: async (merged) => {
        set_data(merged);
        set_dirty(false);
        set_is_data_loading(false);

        // CRITICAL: Only save to local IndexedDB if we are NOT viewing another user
        if (!admin_viewing_user_id) {
          try {
            const db = await get_db();
            const storage_key = get_app_data_key(user_ref.current?.id || null);
            await db.put(DATA_STORE_NAME, merged, storage_key);
            console.log("Saved synced data to IndexedDB for key:", storage_key);
          } catch (err) {
            console.error("Failed to save synced data to IndexedDB:", err);
          }
        }
      },
      on_deletions_synced: (synced) => {
        set_deleted_ids((prev) => {
          const next = { ...prev };
          (Object.keys(synced) as (keyof DeletedIds)[]).forEach((key) => {
            if (Array.isArray(next[key]) && Array.isArray(synced[key])) {
              next[key] = (next[key] as string[]).filter(
                (id) => !(synced[key] as string[]).includes(id),
              ) as any;
            }
          });
          return next;
        });
      },
      on_documents_uploaded: (uploaded_doc_ids) => {
        set_data((prev) => {
          const next = { ...prev };
          if (next.documents) {
            next.documents = next.documents.map((doc) =>
              uploaded_doc_ids.includes(doc.id)
                ? { ...doc, local_state: "synced" }
                : doc,
            );
          }
          return next;
        });
        set_dirty(true); // Trigger a save to IndexedDB
      },
      on_sync_status_change: (status, err) => {
        set_sync_status(status);
        set_last_sync_error(err);
        if (status === "synced" || status === "error")
          set_is_data_loading(false);
      },
      on_log: (log) => {
        set_sync_log((prev) =>
          [
            {
              ...log,
              id: Math.random().toString(36).substring(2, 9),
              timestamp: new Date(),
            },
            ...prev,
          ].slice(0, 50),
        );
      },
      is_online: is_online,
      is_auth_loading: is_auth_loading,
      sync_status: sync_status,
      is_dirty: is_dirty,
    });

  // Auto-sync on mount/login
  React.useEffect(() => {
    if (user && is_online && !is_auth_loading) {
      // Run a quiet background sync once to pull any remote updates and push pending offline work
      console.log("Triggering background auto-sync on startup in 500ms...");
      const timer = setTimeout(() => {
        manual_sync({ force: true });
      }, 500);
      return () => clearTimeout(timer);
    }
  }, [user?.id, is_online, is_auth_loading]);

  // Auto-sync when coming back online or internet becomes available
  const prev_is_online = React.useRef(is_online);
  React.useEffect(() => {
    if (
      user &&
      is_online &&
      !prev_is_online.current &&
      !is_auth_loading &&
      sync_status !== "syncing"
    ) {
      console.log("🌐 Internet restored, triggering full background auto-sync...");
      manual_sync({ force: true });
    }
    prev_is_online.current = is_online;
  }, [is_online, manual_sync, user, is_auth_loading, sync_status]);

  // Listen to custom online_restored event, window focus, tab visibility and Service Worker sync messages
  React.useEffect(() => {
    if (!user || is_auth_loading) return;

    const handleOnlineRestored = () => {
      console.log("⚡ app:online_restored event received. Executing background sync...");
      if (sync_status !== "syncing") {
        manual_sync({ force: true });
      }
    };

    const handleVisibilityOrFocus = () => {
      if (
        document.visibilityState === "visible" &&
        is_online &&
        sync_status !== "syncing"
      ) {
        fetch_and_refresh();
      }
    };

    const handleSWMessage = (event: MessageEvent) => {
      if (
        event.data &&
        (event.data.type === "TRIGGER_BACKGROUND_SYNC" ||
          event.data.type === "ONLINE_RESTORED")
      ) {
        console.log("Service Worker requested background sync:", event.data);
        if (is_online && sync_status !== "syncing") {
          manual_sync({ force: true });
        }
      }
    };

    window.addEventListener("app:online_restored", handleOnlineRestored);
    document.addEventListener("visibilitychange", handleVisibilityOrFocus);
    window.addEventListener("focus", handleVisibilityOrFocus);

    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.addEventListener("message", handleSWMessage);
    }

    return () => {
      window.removeEventListener("app:online_restored", handleOnlineRestored);
      document.removeEventListener("visibilitychange", handleVisibilityOrFocus);
      window.removeEventListener("focus", handleVisibilityOrFocus);
      if ("serviceWorker" in navigator) {
        navigator.serviceWorker.removeEventListener("message", handleSWMessage);
      }
    };
  }, [user?.id, is_online, is_auth_loading, sync_status, manual_sync, fetch_and_refresh]);

  // Periodic background sync every 60 seconds while online
  React.useEffect(() => {
    if (!user || !is_online || is_auth_loading || !is_auto_sync_enabled) return;

    const interval = setInterval(() => {
      if (sync_status !== "syncing" && document.visibilityState === "visible") {
        console.log("Running periodic background sync...");
        fetch_and_refresh();
      }
    }, 60000);

    return () => clearInterval(interval);
  }, [
    user?.id,
    is_online,
    is_auth_loading,
    is_auto_sync_enabled,
    sync_status,
    fetch_and_refresh,
  ]);

  // Realtime Subscription for all data tables (Immediate sync across users)
  React.useEffect(() => {
    if (!user || !is_online || is_auth_loading || !effective_user_id) return;

    const supabase = get_supabase_client();
    if (!supabase) return;

    const tables_with_user_id = [
      "clients",
      "cases",
      "stages",
      "sessions",
      "admin_tasks",
      "appointments",
      "accounting_entries",
      "assistants",
      "invoices",
      "invoice_items",
      "case_documents",
      "sync_deletions",
      "site_finances",
    ];

    console.log(
      `Setting up realtime subscription for lawyer context: ${effective_user_id}`,
    );

    const channel = supabase.channel(`office-sync-${effective_user_id}`);

    // Subscribe to all standard tables filtered by user_id (lawyer_id)
    tables_with_user_id.forEach((table) => {
      channel.on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: table,
          filter: `user_id=eq.${effective_user_id}`,
        },
        (payload) => {
          console.log(`Realtime change in ${table}:`, payload);
          // Debounce/Throttle: use_sync already prevents overlapping syncs
          fetch_and_refresh();
        },
      );
    });

    // Special case for profiles (filtered by lawyer_id or id)
    channel.on(
      "postgres_changes",
      {
        event: "*",
        schema: "public",
        table: "profiles",
      },
      (payload) => {
        const new_data = payload.new as any;
        const old_data = payload.old as any;
        const lawyer_id = new_data?.lawyer_id || old_data?.lawyer_id;
        const profile_id = new_data?.id || old_data?.id;

        if (
          lawyer_id === effective_user_id ||
          profile_id === user.id ||
          profile_id === effective_user_id
        ) {
          console.log("Realtime change in profiles:", payload);
          fetch_and_refresh();
        }
      },
    );

    channel.subscribe((status) => {
      console.log(`Office Realtime subscription status: ${status}`);
    });

    return () => {
      console.log("Cleaning up office realtime subscription...");
      supabase.removeChannel(channel);
    };
  }, [
    user?.id,
    is_online,
    is_auth_loading,
    effective_user_id,
    fetch_and_refresh,
  ]);

  const set_auto_sync_enabled = React.useCallback(
    (enabled: boolean) => {
      set_auto_sync_enabled_state(enabled);
      try {
        localStorage.setItem("is_auto_sync_enabled", JSON.stringify(enabled));
        if (user?.id) {
          localStorage.setItem(`is_auto_sync_enabled_${user.id}`, JSON.stringify(enabled));
        }
      } catch (e) {
        console.error("Error persisting auto sync setting:", e);
      }
    },
    [user?.id],
  );

  const set_auto_backup_enabled = React.useCallback(
    (enabled: boolean) => {
      set_auto_backup_enabled_state(enabled);
      try {
        localStorage.setItem("is_auto_backup_enabled", JSON.stringify(enabled));
        if (user?.id) {
          localStorage.setItem(`is_auto_backup_enabled_${user.id}`, JSON.stringify(enabled));
        }
      } catch (e) {
        console.error("Error persisting auto backup setting:", e);
      }
    },
    [user?.id],
  );

  const set_admin_tasks_layout = React.useCallback(
    (layout: "horizontal" | "vertical") => {
      set_admin_tasks_layout_state(layout);
      try {
        localStorage.setItem("admin_tasks_layout", layout);
        if (user?.id) {
          localStorage.setItem(`admin_tasks_layout_${user.id}`, layout);
        }
      } catch (e) {
        console.error("Error persisting admin tasks layout setting:", e);
      }
    },
    [user?.id],
  );

  // Perform daily auto-backup and download backup on actual user login if enabled
  React.useEffect(() => {
    if (!user?.id || !is_auto_backup_enabled || is_data_loading || !data) return;

    const loginFlagKey = `just_logged_in_user_${user.id}`;
    const isJustLoggedIn = sessionStorage.getItem(loginFlagKey) === "true";

    const todayStr = new Date().toISOString().split("T")[0];
    const userKey = user.id;

    try {
      const dataStr = JSON.stringify(data, null, 2);
      localStorage.setItem(`auto_backup_data_${userKey}`, dataStr);
      localStorage.setItem(`last_auto_backup_date_${userKey}`, todayStr);
      localStorage.setItem(`last_auto_backup_time_${userKey}`, new Date().toISOString());

      // Only trigger file download if user performed an explicit login action in this session
      if (isJustLoggedIn) {
        sessionStorage.removeItem(loginFlagKey); // Remove flag so page refreshes will NOT download

        const blob = new Blob([dataStr], { type: "application/json" });
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.href = url;
        link.download = `lawyer_backup_${todayStr}.json`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
        console.log("Backup file downloaded on explicit user login for:", userKey);
      }
    } catch (e) {
      console.error("Failed to process auto backup on login:", e);
    }
  }, [is_auto_backup_enabled, is_data_loading, data, user?.id]);

  const [location_order, set_location_order] = React.useState<string[]>([]);

  const set_full_data = React.useCallback(
    (new_data: Partial<AppData> | ((prev: AppData) => Partial<AppData>)) => {
      set_data((prev) => {
        const updates =
          typeof new_data === "function" ? new_data(prev) : new_data;
        const merged = { ...prev, ...updates };
        // Apply migration to ensure consistency even on manual imports
        return migrate_data(merged);
      });
      set_dirty(true);
    },
    [],
  );

  // Persist data to IndexedDB whenever it changes
  React.useEffect(() => {
    const save_to_db = async () => {
      if (is_data_loading || admin_viewing_user_id) return; // Don't save while initial loading is in progress or viewing another user
      try {
        const db = await get_db();
        const storage_key = get_app_data_key(user?.id || null);
        await db.put(DATA_STORE_NAME, data, storage_key);
      } catch (err) {
        console.error("Failed to save data to IndexedDB:", err);
      }
    };
    save_to_db();
  }, [data, user?.id, is_data_loading, admin_viewing_user_id]);

  // Persist deleted_ids to IndexedDB whenever it changes
  React.useEffect(() => {
    const save_deleted_ids_to_db = async () => {
      if (is_data_loading || admin_viewing_user_id) return; // Don't save while viewing another user
      try {
        const db = await get_db();
        const storage_key = get_app_data_key(user?.id || null);
        await db.put(DELETED_IDS_STORE_NAME, deleted_ids, storage_key);
      } catch (err) {
        console.error("Failed to save deleted_ids to IndexedDB:", err);
      }
    };
    save_deleted_ids_to_db();
  }, [deleted_ids, user?.id, is_data_loading, admin_viewing_user_id]);

  // Auto-sync local changes to cloud
  React.useEffect(() => {
    const has_deleted_ids = Object.values(deleted_ids).some(
      (arr) => arr.length > 0,
    );
    if (
      (is_dirty || has_deleted_ids) &&
      is_auto_sync_enabled &&
      is_online &&
      user &&
      sync_status !== "syncing"
    ) {
      const timer = setTimeout(() => {
        console.log("Auto-syncing local changes to cloud in background...");
        manual_sync();
      }, 300); // Fast background sync upon any modification (300ms debounce)
      return () => clearTimeout(timer);
    }
  }, [
    is_dirty,
    deleted_ids,
    is_auto_sync_enabled,
    is_online,
    user?.id,
    sync_status,
    manual_sync,
  ]);

  const is_local_empty = React.useMemo(() => {
    return (
      data.clients.length === 0 &&
      data.admin_tasks.length === 0 &&
      data.appointments.length === 0 &&
      data.accounting_entries.length === 0 &&
      data.invoices.length === 0 &&
      data.documents.length === 0
    );
  }, [data]);

  const all_sessions = React.useMemo(() => {
    return filtered_data.clients.flatMap((c) =>
      c.cases.flatMap((cs) =>
        cs.stages.flatMap((st) =>
          st.sessions.map((s) => ({
            ...s,
            client_name: s.client_name || c.name,
            opponent_name: s.opponent_name || cs.opponent_name,
            case_number: s.case_number || st.case_number || cs.subject || cs.id,
            court: s.court || st.court || "غير محدد",
            stage_id: s.stage_id || st.id,
            stage_decision_date: st.decision_date,
            is_postponed: Boolean(s.is_postponed),
          })),
        ),
      ),
    );
  }, [filtered_data.clients]);

  const unpostponed_sessions = React.useMemo(() => {
    return all_sessions.filter(
      (s) => !s.is_postponed && !s.stage_decision_date && !s.next_session_date,
    );
  }, [all_sessions]);

  // Alert for unpostponed today's sessions after 12:00 PM
  const unpostponed_alert_tracker = React.useRef<{
    date: string;
    count: number;
  }>({ date: "", count: 0 });

  React.useEffect(() => {
    const check_unpostponed_today_sessions = () => {
      const now = new Date();
      // Only check if time is past 12:00 PM (noon)
      if (now.getHours() < 12) return;

      const today_str = to_input_date_string(now);
      const todays_unpostponed = unpostponed_sessions.filter((s) =>
        is_today(s.date),
      );
      const count = todays_unpostponed.length;

      if (count === 0) {
        // If all today's sessions have been postponed/decided, clear any active alert
        set_realtime_alerts((prev) =>
          prev.filter((a) => a.type !== "unpostponed"),
        );
        return;
      }

      // If we haven't already alerted for today's date and count
      if (
        unpostponed_alert_tracker.current.date !== today_str ||
        unpostponed_alert_tracker.current.count !== count
      ) {
        unpostponed_alert_tracker.current = { date: today_str, count };

        const session_text =
          count === 1
            ? "جلسة واحدة اليوم لم ترحّل"
            : count === 2
            ? "جلسان اليوم لم ترحّلا"
            : count >= 3 && count <= 10
            ? `${count} جلسات اليوم لم ترحّل`
            : `${count} جلسة اليوم لم ترحّل`;

        set_realtime_alerts((prev) => [
          ...prev.filter((a) => a.type !== "unpostponed"),
          {
            id: Date.now(),
            message: `تنبيه بعد 12:00 ظهراً: يوجد ${session_text} بعد إلى جلسة قادمة.`,
            type: "unpostponed",
          },
        ]);
      }
    };

    check_unpostponed_today_sessions();

    // Check periodically every minute
    const intervalId = setInterval(check_unpostponed_today_sessions, 60000);
    return () => clearInterval(intervalId);
  }, [unpostponed_sessions]);

  // Check for appointment reminders and trigger alerts
  React.useEffect(() => {
    const check_appointment_reminders = () => {
      const appointmentsList = data.appointments;
      if (!appointmentsList || appointmentsList.length === 0) return;

      const now = new Date();
      const nowMs = now.getTime();
      const newAlerts: Appointment[] = [];
      const notifiedApptIds: string[] = [];

      appointmentsList.forEach((apt) => {
        if (apt.completed || apt.notified) return;
        if (!apt.date || !apt.time) return;

        const datePart = apt.date.includes("T")
          ? apt.date.split("T")[0]
          : apt.date;
        const dateTokens = datePart.split("-");
        const timeTokens = apt.time.split(":");

        if (dateTokens.length < 3 || timeTokens.length < 2) return;

        const year = parseInt(dateTokens[0], 10);
        const month = parseInt(dateTokens[1], 10);
        const day = parseInt(dateTokens[2], 10);
        const hour = parseInt(timeTokens[0], 10);
        const minute = parseInt(timeTokens[1], 10);

        if (
          isNaN(year) ||
          isNaN(month) ||
          isNaN(day) ||
          isNaN(hour) ||
          isNaN(minute)
        )
          return;

        const aptDate = new Date(year, month - 1, day, hour, minute, 0, 0);
        const aptMs = aptDate.getTime();

        const reminderMins =
          typeof apt.reminder_time_in_minutes === "number"
            ? apt.reminder_time_in_minutes
            : 15;
        const reminderMs = aptMs - reminderMins * 60 * 1000;

        // Trigger if current time has reached/passed the reminder time,
        // AND not passed appointment time by more than 3 hours.
        if (nowMs >= reminderMs && nowMs <= aptMs + 3 * 60 * 60 * 1000) {
          newAlerts.push(apt);
          notifiedApptIds.push(apt.id);
        }
      });

      if (newAlerts.length > 0) {
        set_triggered_alerts((prev) => {
          const existingIds = new Set(prev.map((a) => a.id));
          const filteredNew = newAlerts.filter((a) => !existingIds.has(a.id));
          if (filteredNew.length === 0) return prev;
          return [...prev, ...filteredNew];
        });

        set_data((prev) => {
          const updatedApps = prev.appointments.map((a) =>
            notifiedApptIds.includes(a.id)
              ? {
                  ...a,
                  notified: true,
                  updated_at: new Date().toISOString(),
                }
              : a,
          );
          return { ...prev, appointments: updatedApps };
        });

        // Browser Native Push Notification fallback
        if (typeof window !== "undefined" && "Notification" in window) {
          if (Notification.permission === "granted") {
            newAlerts.forEach((a) => {
              try {
                new Notification("⏰ تذكير بموعد: " + a.title, {
                  body: `الموعد الساعة ${a.time} - المسند إليه: ${
                    a.assignee || "غير محدد"
                  }`,
                  icon: "/favicon.ico",
                  dir: "rtl",
                  lang: "ar",
                });
              } catch (e) {
                console.error("Browser notification error:", e);
              }
            });
          }
        }
      }
    };

    check_appointment_reminders();
    const intervalId = setInterval(check_appointment_reminders, 10000); // Check every 10 seconds
    return () => clearInterval(intervalId);
  }, [data.appointments]);

  const download_document_file = React.useCallback(
    async (doc: CaseDocument) => {
      if (!doc.storage_path) return null;
      const supabase = get_supabase_client();
      if (!supabase) return null;

      try {
        // Set state to downloading
        set_full_data((prev) => ({
          ...prev,
          documents: prev.documents.map((d) =>
            d.id === doc.id ? { ...d, local_state: "downloading" } : d,
          ),
        }));

        const { data, error } = await supabase.storage
          .from("documents")
          .download(doc.storage_path);
        if (error) throw error;
        if (data) {
          if (data.size === 0) {
            throw new Error("تنزيل الملف تفريغ (0-byte)");
          }
          if (data.type === "application/json" || data.type === "text/plain") {
            const text = await data.text();
            if (text.includes("error") || text.includes("not found")) {
              throw new Error(text);
            }
          }
          const db = await get_db();
          // Convert Blob to File if needed or just store Blob
          const file = new File([data], doc.name, { type: doc.type });
          await db.put(DOCS_FILES_STORE_NAME, file, doc.id);

          // Update local state to synced
          set_full_data((prev) => ({
            ...prev,
            documents: prev.documents.map((d) =>
              d.id === doc.id ? { ...d, local_state: "synced" } : d,
            ),
          }));
          return file;
        }
      } catch (e: any) {
        const errStr = String(e?.message || e?.error || e).toLowerCase();
        const isNotFound =
          errStr.includes("object not found") ||
          errStr.includes("storageapierror") ||
          e?.statusCode === "404";
        if (!isNotFound) {
          console.error("Error downloading document:", e);
        }
        set_full_data((prev) => ({
          ...prev,
          documents: prev.documents.map((d) =>
            d.id === doc.id ? { ...d, local_state: "error" } : d,
          ),
        }));
      }
      return null;
    },
    [set_full_data],
  );

  // Background downloader for remote documents
  React.useEffect(() => {
    if (!is_online || is_data_loading) return;

    // Find documents that are pending download
    const pending_docs = data.documents.filter(
      (d) => d.local_state === "pending_download",
    );

    if (pending_docs.length > 0) {
      const next_doc = pending_docs[0];

      // Short delay to not interfere with main sync
      const timer = setTimeout(() => {
        download_document_file(next_doc);
      }, 3000);

      return () => clearTimeout(timer);
    }
  }, [data.documents, is_online, is_data_loading, download_document_file]);

  const get_document_file = React.useCallback(async (id: string) => {
    const db = await get_db();
    return await db.get(DOCS_FILES_STORE_NAME, id);
  }, []);

  const delete_document = React.useCallback(
    async (doc: CaseDocument | string) => {
      const id = typeof doc === "string" ? doc : doc.id;

      // Delete from local IndexedDB immediately
      try {
        const db = await get_db();
        await db.delete(DOCS_FILES_STORE_NAME, id);
      } catch (e) {
        console.error("Failed to delete local document file:", e);
      }

      set_full_data((prev) => {
        const document = prev.documents.find((d) => d.id === id);
        if (document) {
          set_deleted_ids((p) => ({
            ...p,
            documents: [...p.documents, id],
            document_paths: [...p.document_paths, document.storage_path],
          }));
        }
        return {
          ...prev,
          documents: prev.documents.filter((d) => d.id !== id),
        };
      });
    },
    [set_full_data],
  );

  const add_documents = React.useCallback(
    async (case_id: string, files: FileList | CaseDocument[]) => {
      if (files instanceof FileList) {
        const new_docs: CaseDocument[] = [];
        for (let i = 0; i < files.length; i++) {
          const file = files[i];
          const id = generateId("doc");
          const extension = file.name.includes(".")
            ? file.name.split(".").pop()
            : "";
          const storage_path = `${effective_user_id}/${case_id}/${id}${extension ? "." + extension : ""}`;

          // If file is larger than 5MB, mark as local-only error state to avoid cloud storage limits
          const is_oversized = file.size > 5 * 1024 * 1024;

          const new_doc: CaseDocument = {
            id,
            case_id,
            user_id: effective_user_id || "",
            name: file.name,
            type: file.type,
            size: file.size,
            added_at: new Date().toISOString(),
            storage_path,
            local_state: is_oversized ? "error" : "pending_upload",
            updated_at: new Date().toISOString(),
          };

          // Save file to IndexedDB for later upload
          const db = await get_db();
          await db.put(DOCS_FILES_STORE_NAME, file, id);

          new_docs.push(new_doc);
        }
        set_full_data((prev) => ({
          ...prev,
          documents: [...prev.documents, ...new_docs],
        }));
      } else {
        set_full_data((prev) => ({
          ...prev,
          documents: [...prev.documents, ...files],
        }));
      }
    },
    [effective_user_id, set_full_data],
  );

  const postpone_session = React.useCallback(
    (session_id: string, next_date: string, reason: string): string | null => {
      if (is_holiday(safe_revive_date(next_date))) {
        return "تحذير: التاريخ المختار يصادف عطلة رسمية أو نهاية أسبوع.";
      }

      // Ensure next_date is just YYYY-MM-DD to avoid timezone shifts
      const normalized_next_date = to_input_date_string(next_date);

      set_full_data((prev) => {
        // Find the session and its context
        let found_client_id = "";
        let found_case_id = "";
        let found_stage_id = "";
        let found_session: Session | null = null;

        for (const client of prev.clients) {
          for (const case_item of client.cases) {
            for (const stage of case_item.stages) {
              const session = stage.sessions.find((s) => s.id === session_id);
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
          clients: prev.clients.map((c) =>
            c.id === found_client_id
              ? {
                  ...c,
                  updated_at: now,
                  cases: c.cases.map((cs) =>
                    cs.id === found_case_id
                      ? {
                          ...cs,
                          updated_at: now,
                          stages: cs.stages.map((st) =>
                            st.id === found_stage_id
                              ? {
                                  ...st,
                                  updated_at: now,
                                  sessions: [
                                    ...st.sessions.map((s) =>
                                      s.id === session_id
                                        ? {
                                            ...s,
                                            is_postponed: true,
                                            next_session_date:
                                              normalized_next_date,
                                            next_postponement_reason: reason,
                                            updated_at: now,
                                          }
                                        : s,
                                    ),
                                    {
                                      ...found_session!,
                                      id: generateId("session"),
                                      date: normalized_next_date,
                                      is_postponed: false,
                                      postponement_reason: reason,
                                      next_session_date: undefined,
                                      next_postponement_reason: undefined,
                                      updated_at: now,
                                    } as Session,
                                  ],
                                }
                              : st,
                          ),
                        }
                      : cs,
                  ),
                }
              : c,
          ),
        };
      });
      return null;
    },
    [set_full_data],
  );

  return {
    ...filtered_data,
    clients: filtered_clients,
    sync_status: sync_status,
    manual_sync: manual_sync,
    last_sync_error: last_sync_error,
    is_dirty: is_dirty,
    is_data_loading: is_data_loading,
    is_update_available,
    sync_log: sync_log,
    clear_sync_log: () => set_sync_log([]),
    is_local_empty: is_local_empty,
    effective_user_id: effective_user_id,
    permissions: current_user_permissions,
    user_id: user?.id || "",
    is_online: is_online,
    is_auto_sync_enabled: is_auto_sync_enabled,
    set_auto_sync_enabled: set_auto_sync_enabled,
    is_auto_backup_enabled: is_auto_backup_enabled,
    set_auto_backup_enabled: set_auto_backup_enabled,
    admin_tasks_layout: admin_tasks_layout,
    set_admin_tasks_layout: set_admin_tasks_layout,
    location_order: location_order,
    set_location_order: set_location_order,
    current_user_profile: current_user_profile,
    set_full_data: set_full_data,
    fetch_and_refresh: fetch_and_refresh,
    triggered_alerts: triggered_alerts,
    dismiss_alert: (id: string) =>
      set_triggered_alerts((p) => p.filter((a) => a.id !== id)),
    realtime_alerts: realtime_alerts,
    dismiss_realtime_alert: (id: number) =>
      set_realtime_alerts((p) => p.filter((a) => a.id !== id)),
    user_approval_alerts: user_approval_alerts,
    dismiss_user_approval_alert: (id: number) =>
      set_user_approval_alerts((p) => p.filter((a) => a.id !== id)),
    admin_viewing_user_id,
    set_admin_viewing_user_id,
    set_clients: (clients: any) => {
      const now = new Date().toISOString();
      set_full_data((prev) => {
        const next_clients =
          typeof clients === "function" ? clients(prev.clients) : clients;
        // Ensure updated_at is set for new/modified items
        const updated_clients = next_clients.map((c: any) => {
          const prev_c = prev.clients.find((pc) => pc.id === c.id);
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
      set_full_data((prev) => {
        const next_tasks =
          typeof tasks === "function" ? tasks(prev.admin_tasks) : tasks;
        const updated_tasks = next_tasks.map((t: any) => {
          const prev_t = prev.admin_tasks.find((pt) => pt.id === t.id);
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
      set_full_data((prev) => {
        const next_apps =
          typeof appointments === "function"
            ? appointments(prev.appointments)
            : appointments;
        const updated_apps = next_apps.map((a: any) => {
          const prev_a = prev.appointments.find((pa) => pa.id === a.id);
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
      set_full_data((prev) => {
        const next_entries =
          typeof entries === "function"
            ? entries(prev.accounting_entries)
            : entries;
        const updated_entries = next_entries.map((e: any) => {
          const prev_e = prev.accounting_entries.find((pe) => pe.id === e.id);
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
      set_full_data((prev) => {
        const next_invoices =
          typeof invoices === "function" ? invoices(prev.invoices) : invoices;
        const updated_invoices = next_invoices.map((i: any) => {
          const prev_i = prev.invoices.find((pi) => pi.id === i.id);
          if (!prev_i || JSON.stringify(prev_i) !== JSON.stringify(i)) {
            return { ...i, updated_at: now };
          }
          return i;
        });
        return { ...prev, invoices: updated_invoices };
      });
    },
    set_assistants: (assistants: any) => {
      set_full_data((prev) => {
        const next_assistants =
          typeof assistants === "function"
            ? assistants(prev.assistants)
            : assistants;
        // If we are adding a string, convert it to an object with user_id
        const updated_assistants = next_assistants.map((a: any) => {
          if (typeof a === "string") {
            return { name: a, user_id: effective_user_id || "" };
          }
          return a;
        });
        return { ...prev, assistants: updated_assistants };
      });
    },
    set_profiles: (profiles: any) => {
      set_full_data((prev) => ({
        ...prev,
        profiles:
          typeof profiles === "function" ? profiles(prev.profiles) : profiles,
      }));
    },
    set_site_finances: (finances: any) => {
      set_full_data((prev) => ({
        ...prev,
        site_finances:
          typeof finances === "function"
            ? finances(prev.site_finances)
            : finances,
      }));
    },
    unfiltered_data: data,
    all_sessions,
    unpostponed_sessions,
    export_data: () => {
      try {
        const data_str = JSON.stringify(data, null, 2);
        const blob = new Blob([data_str], { type: "application/json" });
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.href = url;
        link.download = `lawyer_backup_${new Date().toISOString().split("T")[0]}.json`;
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
      set_deleted_ids((prev) => ({ ...prev, clients: [...prev.clients, id] }));
      set_full_data((prev) => ({
        ...prev,
        clients: prev.clients.filter((c) => c.id !== id),
      }));
    },
    delete_case: (client_id: string, case_id: string) => {
      set_deleted_ids((prev) => ({ ...prev, cases: [...prev.cases, case_id] }));
      set_full_data((prev) => ({
        ...prev,
        clients: prev.clients.map((c) =>
          c.id === client_id
            ? {
                ...c,
                cases: c.cases.filter((cs) => cs.id !== case_id),
              }
            : c,
        ),
      }));
    },
    delete_stage: (client_id: string, case_id: string, stage_id: string) => {
      set_deleted_ids((prev) => ({
        ...prev,
        stages: [...prev.stages, stage_id],
      }));
      set_full_data((prev) => ({
        ...prev,
        clients: prev.clients.map((c) =>
          c.id === client_id
            ? {
                ...c,
                cases: c.cases.map((cs) =>
                  cs.id === case_id
                    ? {
                        ...cs,
                        stages: cs.stages.filter((st) => st.id !== stage_id),
                      }
                    : cs,
                ),
              }
            : c,
        ),
      }));
    },
    delete_session: (
      client_id: string,
      case_id: string,
      stage_id: string,
      session_id: string,
    ) => {
      set_deleted_ids((prev) => ({
        ...prev,
        sessions: [...prev.sessions, session_id],
      }));
      set_full_data((prev) => ({
        ...prev,
        clients: prev.clients.map((c) =>
          c.id === client_id
            ? {
                ...c,
                cases: c.cases.map((cs) =>
                  cs.id === case_id
                    ? {
                        ...cs,
                        stages: cs.stages.map((st) =>
                          st.id === stage_id
                            ? {
                                ...st,
                                sessions: st.sessions.filter(
                                  (s) => s.id !== session_id,
                                ),
                              }
                            : st,
                        ),
                      }
                    : cs,
                ),
              }
            : c,
        ),
      }));
    },
    delete_admin_task: (id: string) => {
      set_deleted_ids((prev) => ({
        ...prev,
        admin_tasks: [...prev.admin_tasks, id],
      }));
      set_full_data((prev) => ({
        ...prev,
        admin_tasks: prev.admin_tasks.filter((t) => t.id !== id),
      }));
    },
    delete_appointment: (id: string) => {
      set_deleted_ids((prev) => ({
        ...prev,
        appointments: [...prev.appointments, id],
      }));
      set_full_data((prev) => ({
        ...prev,
        appointments: prev.appointments.filter((a) => a.id !== id),
      }));
    },
    delete_accounting_entry: (id: string) => {
      set_deleted_ids((prev) => ({
        ...prev,
        accounting_entries: [...prev.accounting_entries, id],
      }));
      set_full_data((prev) => ({
        ...prev,
        accounting_entries: prev.accounting_entries.filter((e) => e.id !== id),
      }));
    },
    delete_invoice: (id: string) => {
      set_deleted_ids((prev) => ({
        ...prev,
        invoices: [...prev.invoices, id],
      }));
      set_full_data((prev) => ({
        ...prev,
        invoices: prev.invoices.filter((i) => i.id !== id),
      }));
    },
    delete_assistant: (name: string) => {
      set_deleted_ids((prev) => ({
        ...prev,
        assistants: [...prev.assistants, name],
      }));
      set_full_data((prev) => ({
        ...prev,
        assistants: prev.assistants.filter((a) => {
          if (typeof a === "string") return a !== name;
          return a.name !== name;
        }),
      }));
    },
    delete_site_finance_entry: (id: number) => {
      set_deleted_ids((prev) => ({
        ...prev,
        site_finances: [...prev.site_finances, id.toString()],
      }));
      set_full_data((prev) => ({
        ...prev,
        site_finances: prev.site_finances.filter((f) => f.id !== id),
      }));
    },
    delete_document,
    whatsapp_share_data,
    set_whatsapp_share_data,
    share_via_whatsapp,
    add_documents,
    download_document_file,
    get_document_file,
    postpone_session,
  };
};
