import * as React from "react";
// Fix: Use `import type` for User as it is used as a type, not a value. This resolves module resolution errors in some environments.
import type { User } from "@supabase/supabase-js";
import {
  check_supabase_schema,
  fetch_data_from_supabase,
  upsert_data_to_supabase,
  FlatData,
  delete_data_from_supabase,
  transform_remote_to_local,
  fetch_deletions_from_supabase,
} from "./useOnlineData";
import { get_supabase_client } from "../supabaseClient";
import {
  Client,
  Case,
  Stage,
  Session,
  CaseDocument,
  AppData,
  DeletedIds,
  get_initial_deleted_ids,
  SyncDeletion,
} from "../types";
import { get_db, DOCS_FILES_STORE_NAME } from "../utils/db";
import { safe_revive_date } from "../utils/dateUtils";

export type SyncStatus =
  | "loading"
  | "syncing"
  | "synced"
  | "error"
  | "unconfigured"
  | "uninitialized";

export interface SyncLogEntry {
  id: string;
  timestamp: Date;
  type: "info" | "success" | "error" | "warning";
  message: string;
  details?: string;
}

interface UseSyncProps {
  user: User | null;
  effective_user_id: string | null;
  local_data: AppData;
  deleted_ids: DeletedIds;
  on_data_synced: (merged_data: AppData) => void;
  on_deletions_synced: (synced_deletions: Partial<DeletedIds>) => void;
  on_sync_status_change: (status: SyncStatus, error: string | null) => void;
  on_documents_uploaded?: (uploaded_doc_ids: string[]) => void;
  on_log?: (log: Omit<SyncLogEntry, "id" | "timestamp">) => void;
  excluded_doc_ids?: Set<string>;
  is_online: boolean;
  is_auth_loading: boolean;
  sync_status: SyncStatus;
  is_dirty: boolean;
}

const construct_data = (flat_data: Partial<FlatData>): AppData => {
  const session_map = new Map<string, Session[]>();
  (flat_data.sessions || []).forEach((s) => {
    const stage_id = s.stage_id;
    if (stage_id) {
      if (!session_map.has(stage_id)) session_map.set(stage_id, []);
      session_map.get(stage_id)!.push(s as Session);
    }
  });

  const stage_map = new Map<string, Stage[]>();
  (flat_data.stages || []).forEach((st) => {
    const stage = { ...st, sessions: session_map.get(st.id) || [] } as Stage;
    const case_id = st.case_id;
    if (case_id) {
      if (!stage_map.has(case_id)) stage_map.set(case_id, []);
      stage_map.get(case_id)!.push(stage);
    }
  });

  const case_map = new Map<string, Case[]>();
  (flat_data.cases || []).forEach((cs) => {
    const case_admin_tasks = (flat_data.admin_tasks || [])
      .filter((t: any) => t.case_id === cs.id)
      .map((t: any) => ({
        id: t.id,
        task: t.task,
        due_date: t.due_date,
        completed: Boolean(t.completed),
        importance: t.importance || "normal",
        assignee: t.assignee,
        image_url: t.image_url,
        updated_at: t.updated_at,
      }));

    const task_map = new Map<string, any>();
    (cs.tasks || []).forEach((t: any) => task_map.set(t.id, t));
    case_admin_tasks.forEach((t: any) => {
      const existing = task_map.get(t.id);
      task_map.set(
        t.id,
        existing
          ? { ...existing, ...t, image_url: t.image_url || existing.image_url }
          : t,
      );
    });

    const case_item = {
      ...cs,
      stages: stage_map.get(cs.id) || [],
      tasks: Array.from(task_map.values()),
    } as Case;
    const client_id = cs.client_id;
    if (client_id) {
      if (!case_map.has(client_id)) case_map.set(client_id, []);
      case_map.get(client_id)!.push(case_item);
    }
  });

  const invoice_item_map = new Map<string, any[]>();
  (flat_data.invoice_items || []).forEach((item) => {
    const invoice_id = item.invoice_id;
    if (invoice_id) {
      if (!invoice_item_map.has(invoice_id))
        invoice_item_map.set(invoice_id, []);
      invoice_item_map.get(invoice_id)!.push(item);
    }
  });

  return {
    clients: (flat_data.clients || []).map(
      (c) => ({ ...c, cases: case_map.get(c.id) || [] }) as Client,
    ),
    admin_tasks: (flat_data.admin_tasks || []) as any,
    appointments: (flat_data.appointments || []) as any,
    accounting_entries: (flat_data.accounting_entries || []) as any,
    assistants: (flat_data.assistants || []).map((a) => {
      if (typeof a === "string") return a;
      if (typeof a === "object" && a !== null) {
        // Return the object as is (it will have name and user_id)
        return a;
      }
      return "بدون اسم";
    }) as any,
    invoices: (flat_data.invoices || []).map((inv) => ({
      ...inv,
      items: invoice_item_map.get(inv.id) || [],
    })) as any,
    documents: (flat_data.case_documents || []) as any,
    profiles: (flat_data.profiles || []) as any,
    site_finances: (flat_data.site_finances || []) as any,
  };
};

const merge_for_refresh = <T extends { id: any; updated_at?: Date | string }>(
  local: T[],
  remote: T[],
  key?: string,
): T[] => {
  const final_items = new Map<any, T>();
  for (const local_item of local) {
    final_items.set(local_item.id ?? (local_item as any).name, local_item);
  }
  for (const remote_item of remote) {
    const id = remote_item.id ?? (remote_item as any).name;
    const existing_item = final_items.get(id);
    if (existing_item) {
      const remote_date = safe_revive_date(remote_item.updated_at || 0);
      const local_date = safe_revive_date(existing_item.updated_at || 0);
      if (remote_date > local_date) {
        const merged = {
          ...existing_item,
          ...remote_item,
          image_url: (remote_item as any).image_url || (existing_item as any).image_url,
          tasks: (remote_item as any).tasks || (existing_item as any).tasks,
        };
        if (key === "case_documents") {
          // If remote is newer, it might need download if it's a new version
          // But usually we want to preserve local_state if it was already synced
          // For now, let's assume if it's newer on remote, it's a new file version
          (merged as any).local_state = "pending_download";
        }
        final_items.set(id, merged);
      } else {
        // Keep local to preserve local_state and image_url
        const merged = {
          ...remote_item,
          ...existing_item,
          image_url: (existing_item as any).image_url || (remote_item as any).image_url,
          tasks: (existing_item as any).tasks || (remote_item as any).tasks,
        };
        final_items.set(id, merged);
      }
    } else {
      const merged = { ...remote_item };
      if (key === "case_documents") {
        (merged as any).local_state = "pending_download";
      }
      final_items.set(id, merged);
    }
  }
  return Array.from(final_items.values());
};

const apply_deletions_to_local = (
  local_flat_data: FlatData,
  deletions: SyncDeletion[],
): FlatData => {
  if (!deletions || deletions.length === 0) return local_flat_data;

  const deletion_map = new Map<string, string>(); // RecordID -> DeletedAt ISO
  deletions.forEach((d) => {
    deletion_map.set(`${d.table_name}:${d.record_id}`, d.deleted_at);
  });

  const filter_items = (items: any[], table_name: string) => {
    return items.filter((item) => {
      const id = item.id ?? item.name;
      const key = `${table_name}:${id}`;
      const deleted_at_str = deletion_map.get(key);

      if (deleted_at_str) {
        const deleted_at = safe_revive_date(deleted_at_str).getTime();
        const updated_at = safe_revive_date(item.updated_at || 0).getTime();
        if (updated_at < deleted_at + 2000) {
          return false;
        }
      }
      return true;
    });
  };

  const filtered_clients = filter_items(local_flat_data.clients, "clients");
  const client_ids = new Set(filtered_clients.map((c) => c.id));

  const filtered_cases = filter_items(local_flat_data.cases, "cases");
  const case_ids = new Set(filtered_cases.map((c) => c.id));

  const filtered_stages = filter_items(local_flat_data.stages, "stages").filter(
    (s) => case_ids.has(s.case_id),
  );
  const stage_ids = new Set(filtered_stages.map((s) => s.id));

  const filtered_sessions = filter_items(
    local_flat_data.sessions,
    "sessions",
  ).filter((s) => stage_ids.has(s.stage_id));

  const filtered_invoices = filter_items(
    local_flat_data.invoices,
    "invoices",
  ).filter((i) => client_ids.has(i.client_id));
  const invoice_ids = new Set(filtered_invoices.map((i) => i.id));

  const filtered_invoice_items = filter_items(
    local_flat_data.invoice_items,
    "invoice_items",
  ).filter((i) => invoice_ids.has(i.invoice_id));

  const filtered_docs = filter_items(
    local_flat_data.case_documents,
    "case_documents",
  ).filter((d) => case_ids.has(d.case_id));

  const filtered_entries = filter_items(
    local_flat_data.accounting_entries,
    "accounting_entries",
  ).filter((e) => !e.client_id || client_ids.has(e.client_id));

  return {
    ...local_flat_data,
    clients: filtered_clients,
    cases: filtered_cases,
    stages: filtered_stages,
    sessions: filtered_sessions,
    invoices: filtered_invoices,
    invoice_items: filtered_invoice_items,
    case_documents: filtered_docs,
    accounting_entries: filtered_entries,
    admin_tasks: filter_items(local_flat_data.admin_tasks, "admin_tasks"),
    appointments: filter_items(local_flat_data.appointments, "appointments"),
    assistants: filter_items(local_flat_data.assistants, "assistants"),
    site_finances: filter_items(local_flat_data.site_finances, "site_finances"),
    profiles: local_flat_data.profiles,
  };
};

const cleanup_local_files = async (deletions: SyncDeletion[]) => {
  if (!deletions || deletions.length === 0) return;
  const doc_deletions = deletions.filter(
    (d) => d.table_name === "case_documents",
  );
  if (doc_deletions.length === 0) return;

  try {
    const db = await get_db();
    for (const del of doc_deletions) {
      await db.delete(DOCS_FILES_STORE_NAME, del.record_id);
    }
    console.log(
      `Cleaned up ${doc_deletions.length} local files based on remote deletions.`,
    );
  } catch (e) {
    console.error("Failed to cleanup local files:", e);
  }
};

const cleanup_expired_documents = async (remote_docs: any[], supabase: any) => {
  try {
    const hours_72_ago = safe_revive_date(Date.now() - 72 * 60 * 60 * 1000);
    const expired_docs = remote_docs.filter(
      (d: any) => safe_revive_date(d.added_at) < hours_72_ago,
    );

    if (expired_docs.length > 0) {
      console.log(
        `Cleaning up ${expired_docs.length} expired documents from cloud...`,
      );
      const expired_ids = expired_docs.map((d: any) => d.id);
      const expired_paths = expired_docs
        .map((d: any) => d.storage_path)
        .filter((p: any) => !!p);

      // Delete from DB first
      const { error: db_error } = await supabase
        .from("case_documents")
        .delete()
        .in("id", expired_ids);
      if (db_error) {
        console.warn("Failed to delete expired docs metadata (non-fatal, ignored in background cleanup):", db_error);
      } else {
        // If DB delete success, delete from storage
        // Note: We do NOT log these deletions to 'sync_deletions' because we WANT local clients to keep their copies (Archive behavior).
        // Normal delete triggers might log them, but clients should be smart enough not to delete local files if they are 'synced'.
        if (expired_paths.length > 0) {
          const { error: storage_error } = await supabase.storage
            .from("documents")
            .remove(expired_paths);
          if (storage_error) {
            console.warn("Failed to delete expired docs files (non-fatal, ignored in background cleanup):", storage_error);
          }
        }
      }
    }
  } catch (err) {
    console.warn("Exception during background cleanup of expired documents:", err);
  }
};

export const use_sync = ({
  user,
  effective_user_id,
  local_data,
  deleted_ids,
  on_data_synced,
  on_deletions_synced,
  on_sync_status_change,
  on_documents_uploaded,
  on_log,
  excluded_doc_ids,
  is_online,
  is_auth_loading,
  sync_status,
  is_dirty,
}: UseSyncProps) => {
  // Refs to store the latest values of data without triggering re-creation of manual_sync
  const user_ref = React.useRef(user);
  const effective_user_id_ref = React.useRef(effective_user_id);
  const local_data_ref = React.useRef(local_data);
  const deleted_ids_ref = React.useRef(deleted_ids);
  const excluded_doc_ids_ref = React.useRef(excluded_doc_ids);
  // Track sync_status via ref to break dependency loop in useCallback
  const sync_status_ref = React.useRef(sync_status);
  const is_dirty_ref = React.useRef(is_dirty);

  // Callbacks refs
  const on_data_synced_ref = React.useRef(on_data_synced);
  const on_deletions_synced_ref = React.useRef(on_deletions_synced);
  const on_sync_status_change_ref = React.useRef(on_sync_status_change);
  const on_documents_uploaded_ref = React.useRef(on_documents_uploaded);
  const on_log_ref = React.useRef(on_log);

  // Update refs on every render
  user_ref.current = user;
  effective_user_id_ref.current = effective_user_id;
  local_data_ref.current = local_data;
  deleted_ids_ref.current = deleted_ids;
  excluded_doc_ids_ref.current = excluded_doc_ids;
  sync_status_ref.current = sync_status;
  is_dirty_ref.current = is_dirty;
  on_data_synced_ref.current = on_data_synced;
  on_deletions_synced_ref.current = on_deletions_synced;
  on_sync_status_change_ref.current = on_sync_status_change;
  on_documents_uploaded_ref.current = on_documents_uploaded;
  on_log_ref.current = on_log;

  const flatten_data = (data: AppData): FlatData => {
    const cases = data.clients.flatMap((c) =>
      c.cases.map((cs) => ({ ...cs, client_id: c.id })),
    );
    const stages = cases.flatMap((cs) =>
      cs.stages.map((st) => ({ ...st, case_id: cs.id })),
    );
    const sessions = stages.flatMap((st) =>
      st.sessions.map((s) => ({ ...s, stage_id: st.id })),
    );
    const invoice_items = data.invoices.flatMap((inv) =>
      inv.items.map((item) => ({ ...item, invoice_id: inv.id })),
    );

    const assistants_with_user_id = data.assistants.map((a) => {
      const user_id_to_use =
        effective_user_id_ref.current || user_ref.current?.id;
      if (typeof a === "string")
        return { name: a, user_id: user_id_to_use || undefined };
      const assistant_obj =
        typeof a === "object" && a !== null ? a : { name: String(a) };
      return {
        ...assistant_obj,
        user_id: (assistant_obj as any).user_id || user_id_to_use || undefined,
      };
    });

    return {
      clients: data.clients.map(({ cases, ...client }) => client),
      cases: cases.map(({ stages, ...caseItem }) => caseItem),
      stages: stages.map(({ sessions, ...stage }) => stage),
      sessions,
      admin_tasks: data.admin_tasks,
      appointments: data.appointments,
      accounting_entries: data.accounting_entries,
      assistants: assistants_with_user_id,
      invoices: data.invoices.map(({ items, ...inv }) => inv),
      invoice_items,
      case_documents: data.documents,
      profiles: data.profiles,
      site_finances: data.site_finances,
      sync_deletions: [], // Local data doesn't track deletions this way
    };
  };

  const set_status = (status: SyncStatus, error: string | null = null) => {
    on_sync_status_change_ref.current(status, error);
  };

  const log = (
    type: SyncLogEntry["type"],
    message: string,
    details?: string,
  ) => {
    if (on_log_ref.current) on_log_ref.current({ type, message, details });
  };

  const manual_sync = React.useCallback(
    async (options?: { force?: boolean }) => {
      if (sync_status_ref.current === "syncing") return;
      if (is_auth_loading) return;

      const has_pending_deletions = Object.values(
        deleted_ids_ref.current || {},
      ).some((arr: any) => Array.isArray(arr) && arr.length > 0);
      const has_pending_docs = (
        local_data_ref.current?.documents || []
      ).some((d) => d.local_state === "pending_upload");

      // Optimization: Skip sync only if no local changes, no pending deletions, no pending docs, and already synced, unless forced
      if (
        !is_dirty_ref.current &&
        !has_pending_deletions &&
        !has_pending_docs &&
        sync_status_ref.current === "synced" &&
        !options?.force
      ) {
        console.log("Skipping sync: no local changes and already synced.");
        return;
      }

      const current_user = user_ref.current;
      if (!is_online || !current_user) {
        set_status(
          "error",
          is_online
            ? "يجب تسجيل الدخول للمزامنة."
            : "يجب أن تكون متصلاً بالإنترنت للمزامنة.",
        );
        return;
      }

      log("info", "بدء المزامنة... التحقق من الاتصال.");
      set_status("syncing", "التحقق من الخادم...");
      const schema_check = await check_supabase_schema();
      if (!schema_check.success) {
        if (schema_check.error === "unconfigured") {
          set_status("unconfigured");
          log("error", "Supabase غير مهيأ.");
        } else if (schema_check.error === "uninitialized") {
          set_status(
            "uninitialized",
            `قاعدة البيانات غير مهيأة: ${schema_check.message}`,
          );
          log("error", "قاعدة البيانات غير مهيأة.", schema_check.message);
        } else {
          set_status("error", `فشل الاتصال: ${schema_check.message}`);
          log("error", "فشل الاتصال بالخادم.", schema_check.message);
        }
        return;
      }

      try {
        log("info", "جاري فحص الملفات المحلية قبل الرفع...");
        // 0. Upload Pending Files FIRST
        const pending_docs = local_data_ref.current.documents.filter(
          (d) => d.local_state === "pending_upload",
        );
        const uploaded_doc_ids: string[] = [];

        if (pending_docs.length > 0) {
          log("info", `جاري رفع ${pending_docs.length} وثائق...`);
          set_status("syncing", `جاري رفع ${pending_docs.length} وثائق...`);
          const supabase = get_supabase_client();
          const db = await get_db();

          for (const doc of pending_docs) {
            try {
              // Check file size limit before upload attempt (Supabase default bucket limit is ~5MB)
              if (doc.size && doc.size > 5 * 1024 * 1024) {
                doc.local_state = "error";
                doc.updated_at = new Date().toISOString();
                console.warn(`[File Size Limit] Document ${doc.name} (${(doc.size / (1024 * 1024)).toFixed(1)}MB) exceeds max upload size limit (5MB). Kept locally.`);
                log(
                  "warning",
                  `فشل رفع الوثيقة: ${doc.name}`,
                  "حجم الملف يتجاوز الحد الأقصى للمزامنة السحابية (5 ميغابايت)، وتم حفظه محلياً على جهازك بنجاح.",
                );
                continue;
              }

              const file = await db.get(DOCS_FILES_STORE_NAME, doc.id);
              if (file) {
                let storage_path = doc.storage_path;
                // Sanitize storage_path to avoid "Invalid key" errors (Supabase/S3)
                // We use doc.id + extension for maximum safety as raw filenames often cause issues
                const parts = storage_path.split("/");
                const filename = parts.pop() || "";

                // Check if filename contains problematic characters or doesn't follow the safe format
                if (
                  /[^a-zA-Z0-9._-]/.test(filename) ||
                  !filename.startsWith(doc.id)
                ) {
                  const extension = filename.includes(".")
                    ? filename.split(".").pop()
                    : "";
                  const safe_filename = `${doc.id}${extension ? "." + extension : ""}`;

                  storage_path = [...parts, safe_filename].join("/");
                  doc.storage_path = storage_path; // Mutate the object so it gets saved with the new path
                  doc.updated_at = new Date().toISOString(); // Ensure it gets upserted to DB
                }

                const { error: upload_error } = await supabase!.storage
                  .from("documents")
                  .upload(storage_path, file, {
                    upsert: true,
                  });

                if (upload_error) {
                  doc.local_state = "error";
                  doc.updated_at = new Date().toISOString();

                  const is_size_error =
                    upload_error.message?.includes("exceeded the maximum allowed size") ||
                    upload_error.message?.includes("maximum allowed size") ||
                    upload_error.message?.includes("413") ||
                    (upload_error as any).statusCode === "413";

                  if (is_size_error) {
                    console.warn(`[File Size Limit] Document ${doc.name} exceeds cloud storage limit:`, upload_error.message);
                  } else {
                    console.error(`Failed to upload ${doc.name}:`, upload_error);
                  }

                  const reason = is_size_error
                    ? "تجاوز الملف الحد الأقصى المسموح به للمزامنة السحابية (5 ميغابايت)، ويبقى محفوظاً محلياً على جهازك."
                    : upload_error.message;

                  log(
                    "warning",
                    `فشل رفع الوثيقة: ${doc.name}`,
                    reason,
                  );
                } else {
                  doc.local_state = "synced";
                  doc.updated_at = new Date().toISOString();
                  uploaded_doc_ids.push(doc.id);
                }
              } else {
                console.warn(`File for doc ${doc.id} missing in IndexedDB`);
                doc.local_state = "error";
                doc.updated_at = new Date().toISOString();
                log("warning", `ملف الوثيقة مفقود محلياً: ${doc.name}`);
              }
            } catch (e: any) {
              console.error(`Error uploading doc ${doc.id}:`, e);
              doc.local_state = "error";
              doc.updated_at = new Date().toISOString();
              log("error", `خطأ أثناء رفع الوثيقة: ${doc.name}`, e.message);
            }
          }

          if (uploaded_doc_ids.length > 0 && on_documents_uploaded) {
            on_documents_uploaded(uploaded_doc_ids);
            log("success", `تم رفع ${uploaded_doc_ids.length} وثائق بنجاح.`);
          }
        }

        // 1. Fetch Remote Data AND Deletions Log
        log("info", "جاري تحميل قاعدة البيانات بالكامل للعمل دون اتصال...");
        set_status("syncing", "جاري جلب البيانات من السحابة...");

        // FETCH IN PARALLEL for speed
        const [remote_data_raw, remote_deletions] = await Promise.all([
          fetch_data_from_supabase(effective_user_id_ref.current || current_user.id),
          fetch_deletions_from_supabase()
        ]);
        
        log("info", "تم جلب البيانات، جاري الدمج والمزامنة المحلية...");
        const remote_flat_data = transform_remote_to_local(remote_data_raw);

        // 1.5 Cloud Cleanup (72h Rule)
        const supabase = get_supabase_client();
        if (supabase && remote_data_raw.case_documents) {
          await cleanup_expired_documents(
            remote_data_raw.case_documents,
            supabase,
          );
        }

        // 2. Prepare Local Data
        let local_flat_data = flatten_data(local_data_ref.current);

        // 3. Apply Remote Deletions
        local_flat_data = apply_deletions_to_local(
          local_flat_data,
          remote_deletions,
        );
        await cleanup_local_files(remote_deletions);

        const is_local_effectively_empty =
          local_flat_data.clients.length === 0 &&
          local_flat_data.admin_tasks.length === 0 &&
          local_flat_data.appointments.length === 0 &&
          local_flat_data.accounting_entries.length === 0 &&
          local_flat_data.invoices.length === 0 &&
          local_flat_data.case_documents.length === 0;
        const has_pending_deletions = Object.values(
          deleted_ids_ref.current,
        ).some((arr: any) => arr.length > 0);
        const is_remote_effectively_empty =
          !remote_data_raw ||
          Object.values(remote_data_raw).every((arr: any) => arr?.length === 0);

        if (
          is_local_effectively_empty &&
          !is_remote_effectively_empty &&
          !has_pending_deletions
        ) {
          log(
            "info",
            "البيانات المحلية فارغة، جاري استعادة البيانات من السحابة...",
          );
          const fresh_data = construct_data(remote_flat_data);
          on_data_synced(fresh_data);
          set_status("synced");
          log("success", "تمت استعادة البيانات بنجاح.");
          return;
        }

        const flat_upserts: Partial<FlatData> = {};
        const merged_flat_data: Partial<FlatData> = {};
        let total_upserts = 0;

        const deleted_ids_sets = {
          clients: new Set(deleted_ids_ref.current.clients),
          cases: new Set(deleted_ids_ref.current.cases),
          stages: new Set(deleted_ids_ref.current.stages),
          sessions: new Set(deleted_ids_ref.current.sessions),
          admin_tasks: new Set(deleted_ids_ref.current.admin_tasks),
          appointments: new Set(deleted_ids_ref.current.appointments),
          accounting_entries: new Set(
            deleted_ids_ref.current.accounting_entries,
          ),
          invoices: new Set(deleted_ids_ref.current.invoices),
          invoice_items: new Set(deleted_ids_ref.current.invoice_items),
          assistants: new Set(deleted_ids_ref.current.assistants),
          documents: new Set(deleted_ids_ref.current.documents),
          profiles: new Set(deleted_ids_ref.current.profiles),
          site_finances: new Set(deleted_ids_ref.current.site_finances),
        };

        for (const key of Object.keys(local_flat_data) as (keyof FlatData)[]) {
          const local_items = (local_flat_data as any)[key] as any[];
          const remote_items = ((remote_flat_data as any)[key] as any[]) || [];
          const local_map = new Map(
            local_items.map((i) => [i.id ?? i.name, i]),
          );
          const remote_map = new Map(
            remote_items.map((i) => [i.id ?? i.name, i]),
          );
          const final_merged_items = new Map<string, any>();
          const items_to_upsert: any[] = [];

          for (const local_item of local_items) {
            const id = local_item.id ?? local_item.name;

            if (key === "case_documents") {
              const doc = local_item as CaseDocument;
              if (
                doc.local_state === "pending_upload" &&
                !uploaded_doc_ids.includes(doc.id)
              ) {
                final_merged_items.set(doc.id, local_item);
                continue;
              }
            }

            let is_parent_deleted = false;
            if (
              key === "cases" &&
              deleted_ids_sets.clients.has(local_item.client_id)
            )
              is_parent_deleted = true;
            if (
              key === "stages" &&
              deleted_ids_sets.cases.has(local_item.case_id)
            )
              is_parent_deleted = true;
            if (
              key === "sessions" &&
              deleted_ids_sets.stages.has(local_item.stage_id)
            )
              is_parent_deleted = true;
            if (
              key === "invoice_items" &&
              deleted_ids_sets.invoices.has(local_item.invoice_id)
            )
              is_parent_deleted = true;
            if (
              key === "case_documents" &&
              deleted_ids_sets.cases.has(local_item.case_id)
            )
              is_parent_deleted = true;
            if (is_parent_deleted) continue;

            const remote_item = remote_map.get(id);
            if (remote_item) {
              const local_date = safe_revive_date(
                local_item.updated_at || 0,
              ).getTime();
              const remote_date = safe_revive_date(
                remote_item.updated_at || 0,
              ).getTime();

              if (local_date > remote_date) {
                items_to_upsert.push(local_item);
                final_merged_items.set(id, local_item);
              } else if (remote_date > local_date) {
                // Remote is newer, take it but preserve local image_url & tasks if missing on remote
                const merged = {
                  ...local_item,
                  ...remote_item,
                  image_url: remote_item.image_url || local_item.image_url,
                  tasks: remote_item.tasks || local_item.tasks,
                };
                if (key === "case_documents") {
                  merged.local_state = "pending_download";
                }
                final_merged_items.set(id, merged);
              } else {
                // Dates are equal, keep local to preserve local_state & image_url
                const merged = {
                  ...remote_item,
                  ...local_item,
                  image_url: local_item.image_url || remote_item.image_url,
                  tasks: local_item.tasks || remote_item.tasks,
                };
                final_merged_items.set(id, merged);
              }
            } else {
              items_to_upsert.push(local_item);
              final_merged_items.set(id, local_item);
            }
          }

          for (const remote_item of remote_items) {
            const id = remote_item.id ?? remote_item.name;
            if (!local_map.has(id)) {
              let is_deleted = false;
              const deleted_set = (deleted_ids_sets as any)[key];
              if (deleted_set) is_deleted = deleted_set.has(id);
              if (
                key === "case_documents" &&
                excluded_doc_ids_ref.current &&
                excluded_doc_ids_ref.current.has(id)
              )
                is_deleted = true;
              if (!is_deleted) {
                const merged = { ...remote_item };
                if (key === "case_documents") {
                  merged.local_state = "pending_download";
                }
                final_merged_items.set(id, merged);
              }
            }
          }
          (flat_upserts as any)[key] = items_to_upsert;
          (merged_flat_data as any)[key] = Array.from(
            final_merged_items.values(),
          );
          total_upserts += items_to_upsert.length;
        }

        const valid_client_ids = new Set([
          ...(remote_flat_data.clients || []).map((c) => c.id),
          ...(flat_upserts.clients || []).map((c) => c.id),
        ]);

        if (flat_upserts.cases)
          flat_upserts.cases = flat_upserts.cases.filter((c) =>
            valid_client_ids.has(c.client_id),
          );
        const valid_case_ids = new Set([
          ...(remote_flat_data.cases || []).map((c) => c.id),
          ...(flat_upserts.cases || []).map((c) => c.id),
        ]);
        if (flat_upserts.stages)
          flat_upserts.stages = flat_upserts.stages.filter((s) =>
            valid_case_ids.has(s.case_id),
          );
        const valid_stage_ids = new Set([
          ...(remote_flat_data.stages || []).map((s) => s.id),
          ...(flat_upserts.stages || []).map((s) => s.id),
        ]);
        if (flat_upserts.sessions)
          flat_upserts.sessions = flat_upserts.sessions.filter((s) =>
            valid_stage_ids.has(s.stage_id),
          );
        if (merged_flat_data.cases)
          merged_flat_data.cases = merged_flat_data.cases.filter((c) =>
            valid_client_ids.has(c.client_id),
          );
        if (merged_flat_data.stages)
          merged_flat_data.stages = merged_flat_data.stages.filter((s) =>
            valid_case_ids.has(s.case_id),
          );
        if (merged_flat_data.sessions)
          merged_flat_data.sessions = merged_flat_data.sessions.filter((s) =>
            valid_stage_ids.has(s.stage_id),
          );
        if (merged_flat_data.case_documents)
          merged_flat_data.case_documents =
            merged_flat_data.case_documents.filter((doc) =>
              valid_case_ids.has(doc.case_id),
            );
        if (flat_upserts.case_documents)
          flat_upserts.case_documents = flat_upserts.case_documents.filter(
            (doc) => valid_case_ids.has(doc.case_id),
          );

        let successful_deletions = get_initial_deleted_ids();

        if (
          deleted_ids_ref.current.document_paths &&
          deleted_ids_ref.current.document_paths.length > 0
        ) {
          log("info", "جاري حذف الملفات من السحابة...");
          set_status("syncing", "جاري حذف الملفات من السحابة...");
          const supabase = get_supabase_client();
          if (supabase) {
            const { error: storage_error } = await supabase.storage
              .from("documents")
              .remove(deleted_ids_ref.current.document_paths);
            if (!storage_error) {
              successful_deletions.document_paths =
                deleted_ids_ref.current.document_paths;
              log(
                "success",
                `تم حذف ${deleted_ids_ref.current.document_paths.length} ملفات بنجاح.`,
              );
            } else {
              log(
                "error",
                "فشل حذف الملفات من السحابة.",
                storage_error.message,
              );
            }
          }
        }

        const flat_deletes: Partial<FlatData> = {
          clients: deleted_ids_ref.current.clients.map((id) => ({ id })) as any,
          cases: deleted_ids_ref.current.cases.map((id) => ({ id })) as any,
          stages: deleted_ids_ref.current.stages.map((id) => ({ id })) as any,
          sessions: deleted_ids_ref.current.sessions.map((id) => ({
            id,
          })) as any,
          admin_tasks: deleted_ids_ref.current.admin_tasks.map((id) => ({
            id,
          })) as any,
          appointments: deleted_ids_ref.current.appointments.map((id) => ({
            id,
          })) as any,
          accounting_entries: deleted_ids_ref.current.accounting_entries.map(
            (id) => ({ id }),
          ) as any,
          assistants: deleted_ids_ref.current.assistants.map((name) => ({
            name,
          })),
          invoices: deleted_ids_ref.current.invoices.map((id) => ({
            id,
          })) as any,
          invoice_items: deleted_ids_ref.current.invoice_items.map((id) => ({
            id,
          })) as any,
          case_documents: deleted_ids_ref.current.documents.map((id) => ({
            id,
          })) as any,
          site_finances: deleted_ids_ref.current.site_finances.map((id) => ({
            id,
          })) as any,
        };

        const total_deletes = Object.values(flat_deletes).reduce(
          (acc, arr) => acc + (arr?.length || 0),
          0,
        );
        if (total_deletes > 0) {
          log("info", `جاري حذف ${total_deletes} سجلات من السحابة...`);
          set_status("syncing", "جاري حذف البيانات من السحابة...");
          await delete_data_from_supabase(
            flat_deletes,
            current_user,
            effective_user_id_ref.current || current_user.id,
          );
          successful_deletions = {
            ...successful_deletions,
            ...deleted_ids_ref.current,
          };
          log("success", `تم حذف ${total_deletes} سجلات بنجاح.`);
        }

        if (total_upserts > 0) {
          log("info", `جاري رفع ${total_upserts} سجلات إلى السحابة...`);
          set_status("syncing", "جاري رفع البيانات إلى السحابة...");
          const upserted_data_raw = await upsert_data_to_supabase(
            flat_upserts as FlatData,
            current_user,
            effective_user_id_ref.current || current_user.id,
          );
          const upserted_flat_data =
            transform_remote_to_local(upserted_data_raw);
          const upserted_data_map = new Map();
          Object.values(upserted_flat_data).forEach((arr) =>
            (arr as any[])?.forEach((item) =>
              upserted_data_map.set(item.id ?? item.name, item),
            ),
          );

          for (const key of Object.keys(
            merged_flat_data,
          ) as (keyof FlatData)[]) {
            const merged_items = (merged_flat_data as any)[key];
            if (Array.isArray(merged_items))
              (merged_flat_data as any)[key] = merged_items.map(
                (item: any) => {
                  const returned = upserted_data_map.get(item.id ?? item.name);
                  if (!returned) return item;
                  return {
                    ...item,
                    ...returned,
                    image_url: returned.image_url || item.image_url,
                    tasks: returned.tasks || item.tasks,
                  };
                },
              );
          }
          log("success", `تم رفع ${total_upserts} سجلات بنجاح.`);
        }

        const final_merged_data = construct_data(merged_flat_data as FlatData);
        on_data_synced_ref.current(final_merged_data);
        on_deletions_synced_ref.current(successful_deletions);
        set_status("synced");
        log("success", "تمت المزامنة بنجاح.");
      } catch (err: any) {
        const error_message_raw = String(err.message || "").toLowerCase();
        let error_message = err.message || "حدث خطأ غير متوقع.";
        console.error("CRITICAL: Sync failed with error:", err);
        log("error", "فشل المزامنة.", error_message);

        if (
          error_message_raw.includes("failed to fetch") ||
          error_message_raw.includes("abort") ||
          error_message_raw.includes("lock") ||
          error_message_raw.includes("network")
        ) {
          error_message =
            "تعذر الاتصال بالخادم. يرجى التحقق من اتصالك بالإنترنت، أو التأكد من أن مشروع Supabase الخاص بك يعمل (غير متوقف).";
        }

        if (
          (error_message_raw.includes("column") &&
            error_message_raw.includes("does not exist")) ||
          error_message_raw.includes("relation")
        ) {
          set_status(
            "uninitialized",
            `هناك عدم تطابق في مخطط قاعدة البيانات: ${error_message}`,
          );
          return;
        }
        if (err.table) error_message = `[جدول: ${err.table}] ${error_message}`;
        set_status("error", `فشل المزامنة: ${error_message}`);
      }
    },
    [is_online, is_auth_loading],
  );

  const fetch_timeout_ref = React.useRef<NodeJS.Timeout | null>(null);

  const fetch_and_refresh = React.useCallback(async () => {
    if (fetch_timeout_ref.current) {
      clearTimeout(fetch_timeout_ref.current);
    }

    fetch_timeout_ref.current = setTimeout(async () => {
      if (sync_status_ref.current === "syncing" || is_auth_loading) return;
      const current_user = user_ref.current;
      if (!is_online || !current_user) return;

      set_status("syncing", "جاري تحديث البيانات...");

      try {
        // Fetch in parallel for better performance
        const [remote_data_raw, remote_deletions] = await Promise.all([
          fetch_data_from_supabase(
            effective_user_id_ref.current || current_user.id,
          ),
          fetch_deletions_from_supabase(),
        ]);

        const remote_flat_data_untyped =
          transform_remote_to_local(remote_data_raw);

        const deleted_ids_sets = {
          clients: new Set(deleted_ids_ref.current.clients),
          cases: new Set(deleted_ids_ref.current.cases),
          stages: new Set(deleted_ids_ref.current.stages),
          sessions: new Set(deleted_ids_ref.current.sessions),
          admin_tasks: new Set(deleted_ids_ref.current.admin_tasks),
          appointments: new Set(deleted_ids_ref.current.appointments),
          accounting_entries: new Set(deleted_ids_ref.current.accounting_entries),
          invoices: new Set(deleted_ids_ref.current.invoices),
          invoice_items: new Set(deleted_ids_ref.current.invoice_items),
          assistants: new Set(deleted_ids_ref.current.assistants),
          documents: new Set(deleted_ids_ref.current.documents),
          profiles: new Set(deleted_ids_ref.current.profiles),
          site_finances: new Set(deleted_ids_ref.current.site_finances),
        };

        const remote_flat_data: Partial<FlatData> = {};
        for (const key of Object.keys(
          remote_flat_data_untyped,
        ) as (keyof FlatData)[]) {
          const deleted_set = (deleted_ids_sets as any)[key];
          if (deleted_set && deleted_set.size > 0) {
            (remote_flat_data as any)[key] = (
              (remote_flat_data_untyped as any)[key] || []
            ).filter((item: any) => !deleted_set.has(item.id ?? item.name));
          } else {
            (remote_flat_data as any)[key] = (remote_flat_data_untyped as any)[
              key
            ];
          }
        }

        let local_flat_data = flatten_data(local_data_ref.current);
        local_flat_data = apply_deletions_to_local(
          local_flat_data,
          remote_deletions,
        );
        await cleanup_local_files(remote_deletions);

        const merged_flat_data: Partial<FlatData> = {};

        for (const key of Object.keys(remote_flat_data) as (keyof FlatData)[]) {
          const remote_items = (remote_flat_data as any)[key] || [];
          const local_items = (local_flat_data as any)[key] || [];

          const merged_items = merge_for_refresh(local_items, remote_items, key);
          (merged_flat_data as any)[key] = merged_items;
        }

        const final_merged_data = construct_data(merged_flat_data as FlatData);
        on_data_synced_ref.current(final_merged_data);
        set_status("synced");
      } catch (err: any) {
        const error_message_raw = String(err.message || "").toLowerCase();
        let error_message = err.message || "حدث خطأ غير متوقع.";
        if (
          error_message_raw.includes("failed to fetch") ||
          error_message_raw.includes("abort") ||
          error_message_raw.includes("lock") ||
          error_message_raw.includes("network")
        ) {
          error_message =
            "تعذر الاتصال بالخادم. يرجى التحقق من اتصالك بالإنترنت، أو التأكد من أن مشروع Supabase الخاص بك يعمل (غير متوقف).";
        } else {
          console.error("Fetch error:", err);
        }
        set_status("error", `فشل التحديث: ${error_message}`);
      }
    }, 500);
  }, [is_online, is_auth_loading]);


  return { manual_sync, fetch_and_refresh };
};
