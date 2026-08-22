import { get_supabase_client } from "../supabaseClient";
import {
  Client,
  AdminTask,
  Appointment,
  AccountingEntry,
  Invoice,
  InvoiceItem,
  CaseDocument,
  Profile,
  SiteFinancialEntry,
  SyncDeletion,
  AuditLogEntry,
} from "../types";
import type { User } from "@supabase/supabase-js";
import { safe_revive_date, to_input_date_string } from "../utils/dateUtils";

export type FlatData = {
  clients: Omit<Client, "cases">[];
  cases: any[];
  stages: any[];
  sessions: any[];
  admin_tasks: AdminTask[];
  appointments: Appointment[];
  accounting_entries: AccountingEntry[];
  assistants: { name: string }[];
  invoices: Omit<Invoice, "items">[];
  invoice_items: InvoiceItem[];
  case_documents: CaseDocument[];
  profiles: Profile[];
  site_finances: SiteFinancialEntry[];
  audit_logs: AuditLogEntry[];
  sync_deletions: SyncDeletion[];
};

export const check_supabase_schema = async () => {
  const supabase = get_supabase_client();
  if (!supabase) {
    return {
      success: false,
      error: "unconfigured",
      message: "Supabase client is not configured.",
    };
  }

  const max_retries = 3;
  let attempt = 0;

  while (attempt < max_retries) {
    try {
      // Test a simple query to verify connection and credentials
      const { error } = await supabase
        .from("profiles")
        .select("id", { head: true, count: "exact" })
        .limit(1);

      if (error) {
        console.error("Supabase schema check error:", error);
        const message = String(error.message || "").toLowerCase();
        if (
          message.includes("failed to fetch") ||
          message.includes("abort") ||
          message.includes("lock") ||
          message.includes("network")
        ) {
          if (attempt < max_retries - 1) {
            attempt++;
            console.warn(
              `check_supabase_schema attempt ${attempt} failed: ${message}. Retrying...`,
            );
            await new Promise((resolve) =>
              setTimeout(resolve, 1000 * attempt + Math.random() * 500),
            );
            continue;
          }
          return {
            success: false,
            error: "network",
            message:
              "تعذر الاتصال بالخادم. يرجى التحقق من اتصال الإنترنت أو إعدادات CORS.",
          };
        }
        if (error.code === "42P01") {
          return {
            success: false,
            error: "uninitialized",
            message: "قاعدة البيانات غير مهيأة بشكل كامل.",
          };
        }
        throw error;
      }
      return { success: true, error: null, message: "" };
    } catch (err: any) {
      console.error("CRITICAL: check_supabase_schema exception:", err);
      const message = String(err.message || "").toLowerCase();
      if (
        (message.includes("failed to fetch") ||
          message.includes("abort") ||
          message.includes("lock") ||
          message.includes("network")) &&
        attempt < max_retries - 1
      ) {
        attempt++;
        await new Promise((resolve) =>
          setTimeout(resolve, 1000 * attempt + Math.random() * 500),
        );
        continue;
      }
      return {
        success: false,
        error: "unknown",
        message: `حدث خطأ غير متوقع أثناء فحص الاتصال: ${err.message || "خطأ غير معروف"}`,
      };
    }
  }
  return {
    success: false,
    error: "unknown",
    message: "فشل الاتصال بعد عدة محاولات.",
  };
};

export const fetch_data_from_supabase = async (
  user_id?: string,
): Promise<Partial<FlatData>> => {
  const supabase = get_supabase_client();
  if (!supabase) throw new Error("Supabase client not available.");

  // 1. Determine if the REQUESTER is an admin
  const {
    data: { session },
  } = await supabase.auth.getSession();
  const currentUser = session?.user;
  let is_admin_user = false;
  let lawyer_id: string | null = null;

  if (currentUser) {
    const { data: profile } = await supabase
      .from("profiles")
      .select("role, lawyer_id")
      .eq("id", currentUser.id)
      .maybeSingle();
    is_admin_user = profile?.role === "admin";
    lawyer_id = profile?.lawyer_id;

    const adminEmails = [
      "nahwiabdo@gmail.com",
      "avocat.nahwi@gmail.com",
      "sy963958932922@email.com",
    ];
    if (
      !is_admin_user &&
      currentUser.email &&
      adminEmails.includes(currentUser.email)
    ) {
      is_admin_user = true;
    }
  }

  // If a user_id is provided AND it's different from the requester,
  // it's likely a specific backup request (e.g. from AdminPage).
  // If it's the same as the requester or missing, it's a normal sync.
  const is_specific_user_request = !!(user_id && user_id !== currentUser?.id);

  // We should fetch everything IF the requester is admin AND it's NOT a specific user backup request.
  const should_fetch_everything = is_admin_user && !is_specific_user_request;

  // For the query logic below, we'll use is_admin_user to mean "should fetch everything"
  const effective_is_admin = should_fetch_everything;

  const query = (table: string, all_user_ids?: string[]) => {
    let q = supabase.from(table).select("*");

    if (table === "profiles" && is_admin_user) {
      return q;
    }

    if (all_user_ids && all_user_ids.length > 0) {
      // Specific user backup (including assistants if applicable)
      if (table !== "profiles" && table !== "assistants") {
        q = q.in("user_id", all_user_ids);
      }
      if (table === "assistants") {
        q = q.in("user_id", all_user_ids);
      }
      if (table === "profiles") {
        q = q.in("id", all_user_ids);
      }
    } else if (!effective_is_admin) {
      // Not admin and no user_id? Use passed user_id, or lawyer_id if available (for assistants), otherwise currentUser.id
      const user_id_to_query = user_id || lawyer_id || currentUser?.id;
      if (user_id_to_query) {
        if (table !== "profiles" && table !== "assistants") {
          q = q.eq("user_id", user_id_to_query);
        }
        if (table === "assistants") {
          q = q.eq("user_id", user_id_to_query);
        }
        if (table === "profiles") {
          q = q.or(
            `id.eq.${user_id_to_query},lawyer_id.eq.${user_id_to_query}`,
          );
        }
      }
    }
    return q;
  };

  const fetch_table = async (table: string, all_user_ids?: string[]) => {
    let all_data: any[] = [];
    let from = 0;
    const PAGE_SIZE = 1000;
    let has_more = true;

    console.log(`Starting fetch for table: ${table}...`);

    while (has_more) {
      let table_attempt = 0;
      const table_max_retries = 3;
      let chunk: any[] = [];

      while (table_attempt < table_max_retries) {
        try {
          const res = await query(table, all_user_ids).range(
            from,
            from + PAGE_SIZE - 1,
          );
          if (res.error) throw res.error;
          chunk = res.data || [];
          break;
        } catch (err: any) {
          table_attempt++;
          const message = String(err.message || "").toLowerCase();
          const is_network_error =
            message.includes("failed to fetch") ||
            message.includes("abort") ||
            message.includes("lock") ||
            message.includes("network");

          if (is_network_error && table_attempt < table_max_retries) {
            console.warn(
              `Fetch table ${table} attempt ${table_attempt} failed: ${message}. Retrying...`,
            );
            await new Promise((resolve) =>
              setTimeout(resolve, 300 * table_attempt + Math.random() * 300),
            );
            continue;
          }
          throw err;
        }
      }

      all_data = [...all_data, ...chunk];
      console.log(
        `Fetched ${chunk.length} records from ${table} (Total: ${all_data.length})`,
      );

      if (chunk.length < PAGE_SIZE) {
        has_more = false;
      } else {
        from += PAGE_SIZE;
      }
    }

    if (all_data.length === 0 && from > 0) {
      // This case should be handled by the throw inside the loop,
      // but as a safety check:
      throw new Error(
        `Failed to fetch data from ${table} after multiple attempts.`,
      );
    }

    return all_data;
  };

  const max_retries = 2;
  let attempt = 0;

  while (attempt < max_retries) {
    try {
      // Ensure session is fresh before parallel calls to avoid lock stealing
      await supabase.auth.getSession();

      // Determine all relevant user IDs if a specific user_id is provided
      let all_user_ids: string[] | undefined = undefined;
      let all_profile_ids: string[] | undefined = undefined;
      if (user_id && !should_fetch_everything) {
        const { data: assistants } = await supabase
          .from("profiles")
          .select("id")
          .eq("lawyer_id", user_id);
        all_user_ids = [user_id, ...(assistants?.map((a) => a.id) || [])];
        all_profile_ids = [...all_user_ids];
        if (currentUser?.id && !all_profile_ids.includes(currentUser.id)) {
          all_profile_ids.push(currentUser.id);
        }
      }

      // Helper to fetch tables in small controlled batches (2 at a time) to prevent mobile/Android socket exhaustion
      const run_in_batches = async <T>(tasks: (() => Promise<T>)[], batch_size = 2): Promise<T[]> => {
        const results: T[] = [];
        for (let i = 0; i < tasks.length; i += batch_size) {
          const batch = tasks.slice(i, i + batch_size);
          const batch_results = await Promise.all(batch.map((fn) => fn()));
          results.push(...batch_results);
        }
        return results;
      };

      // Fetch tables in batches to maximize reliability on Android mobile devices
      const [
        clients,
        admin_tasks,
        appointments,
        accounting_entries,
        assistants,
        invoices,
        cases,
        stages,
        sessions,
        invoice_items,
        case_documents,
        site_finances,
        sync_deletions
      ] = await run_in_batches([
        () => fetch_table("clients", all_user_ids),
        () => fetch_table("admin_tasks", all_user_ids),
        () => fetch_table("appointments", all_user_ids),
        () => fetch_table("accounting_entries", all_user_ids),
        () => fetch_table("assistants", all_user_ids),
        () => fetch_table("invoices", all_user_ids),
        () => fetch_table("cases", all_user_ids),
        () => fetch_table("stages", all_user_ids),
        () => fetch_table("sessions", all_user_ids),
        () => fetch_table("invoice_items", all_user_ids),
        () => fetch_table("case_documents", all_user_ids),
        () => fetch_table("site_finances", all_user_ids),
        () => fetch_table("sync_deletions", all_user_ids)
      ], 2);

      // Profiles logic: If admin and no specific user request, fetch all.
      let profiles;
      if (all_profile_ids) {
        profiles = await fetch_table("profiles", all_profile_ids);
      } else if (should_fetch_everything) {
        profiles = await fetch_table("profiles");
      } else if (currentUser?.id) {
        let p_attempt = 0;
        const target_id = user_id || currentUser.id;
        while (p_attempt < 3) {
          try {
            const res = await supabase
              .from("profiles")
              .select("*")
              .or(`id.eq.${target_id},lawyer_id.eq.${target_id}`);
            if (res.error) {
              const fallbackRes = await supabase
                .from("profiles")
                .select("*")
                .eq("id", target_id);
              if (fallbackRes.error) throw fallbackRes.error;
              profiles = fallbackRes.data || [];
            } else {
              profiles = res.data || [];
            }
            break;
          } catch (err: any) {
            p_attempt++;
            if (p_attempt < 3) {
              await new Promise((resolve) =>
                setTimeout(resolve, 300 * p_attempt),
              );
              continue;
            }
            throw err;
          }
        }
      } else {
        profiles = await fetch_table("profiles");
      }

      return {
        clients,
        cases,
        stages,
        sessions,
        admin_tasks,
        appointments,
        accounting_entries,
        assistants,
        invoices,
        invoice_items,
        case_documents,
        profiles: profiles || [],
        site_finances,
        sync_deletions,
      };
    } catch (err: any) {
      attempt++;
      const message = String(err.message || "").toLowerCase();
      const is_abort =
        message.includes("abort") ||
        message.includes("lock") ||
        message.includes("failed to fetch") ||
        message.includes("network");

      if (is_abort && attempt < max_retries) {
        console.warn(
          `Global fetch attempt ${attempt} failed: ${message}. Retrying...`,
        );
        await new Promise((resolve) =>
          setTimeout(resolve, 1000 * attempt + Math.random() * 500),
        );
        continue;
      }
      console.error(
        "CRITICAL: fetch_data_from_supabase failed after retries:",
        err,
      );
      throw err;
    }
  }
  throw new Error("Failed to fetch data after multiple attempts.");
};

export const fetch_deletions_from_supabase = async (): Promise<
  SyncDeletion[]
> => {
  const supabase = get_supabase_client();
  if (!supabase) return [];
  const thirty_days_ago = safe_revive_date(new Date());
  thirty_days_ago.setDate(thirty_days_ago.getDate() - 30);
  const thirty_days_ago_str = to_input_date_string(thirty_days_ago);

  const max_retries = 3;
  let attempt = 0;

  while (attempt < max_retries) {
    try {
      const { data, error } = await supabase
        .from("sync_deletions")
        .select("*")
        .gte("deleted_at", thirty_days_ago_str);
      if (error) {
        const message = String(error.message || "").toLowerCase();
        if (
          message.includes("abort") ||
          message.includes("lock") ||
          message.includes("failed to fetch")
        ) {
          if (attempt < max_retries - 1) {
            attempt++;
            console.warn(
              `fetch_deletions_from_supabase attempt ${attempt} failed: ${message}. Retrying...`,
            );
            await new Promise((resolve) =>
              setTimeout(resolve, 500 * attempt + Math.random() * 500),
            );
            continue;
          }
        }
        throw error;
      }
      return data || [];
    } catch (err: any) {
      const message = String(err.message || "").toLowerCase();
      if (
        (message.includes("abort") ||
          message.includes("lock") ||
          message.includes("failed to fetch")) &&
        attempt < max_retries - 1
      ) {
        attempt++;
        await new Promise((resolve) =>
          setTimeout(resolve, 500 * attempt + Math.random() * 500),
        );
        continue;
      }
      console.warn("Fetch deletions failed:", err);
      return [];
    }
  }
  return [];
};

export const delete_data_from_supabase = async (
  deletions: Partial<FlatData>,
  user: User,
  effective_user_id?: string,
) => {
  const supabase = get_supabase_client();
  if (!supabase) throw new Error("Supabase client not available.");

  const max_retries = 3;
  const deletion_order: (keyof FlatData)[] = [
    "case_documents",
    "invoice_items",
    "sessions",
    "stages",
    "cases",
    "invoices",
    "admin_tasks",
    "appointments",
    "accounting_entries",
    "assistants",
    "clients",
    "site_finances",
    "profiles",
  ];

  const user_id_to_use = effective_user_id || user.id;

  for (const table of deletion_order) {
    const items_to_delete = (deletions as any)[table];
    if (items_to_delete && items_to_delete.length > 0) {
      const primary_key_column = table === "assistants" ? "name" : "id";
      const ids = items_to_delete.map((i: any) => i[primary_key_column]);

      let attempt = 0;
      while (attempt < max_retries) {
        try {
          if (table !== "profiles") {
            const deletions_log = ids.map((id: string) => ({
              table_name: table,
              record_id: id,
              user_id: user_id_to_use,
            }));
            const { error: log_error } = await supabase
              .from("sync_deletions")
              .insert(deletions_log);
            if (log_error) throw log_error;
          }
          const { error } = await supabase
            .from(table)
            .delete()
            .in(primary_key_column, ids);
          if (error) throw error;
          break; // Success
        } catch (err: any) {
          const message = String(err.message || "").toLowerCase();
          if (
            (message.includes("abort") ||
              message.includes("lock") ||
              message.includes("failed to fetch")) &&
            attempt < max_retries - 1
          ) {
            attempt++;
            console.warn(
              `delete_data_from_supabase ${table} attempt ${attempt} failed: ${message}. Retrying...`,
            );
            await new Promise((resolve) =>
              setTimeout(resolve, 500 * attempt + Math.random() * 500),
            );
            continue;
          }
          throw err;
        }
      }
    }
  }
};

export const upsert_data_to_supabase = async (
  data: Partial<FlatData>,
  user: User,
  effective_user_id?: string,
) => {
  const supabase = get_supabase_client();
  if (!supabase) throw new Error("Supabase client not available.");

  // Fetch profile to determine the correct user_id (lawyer_id if assistant) and role
  const { data: profile, error: profile_error } = await supabase
    .from("profiles")
    .select("lawyer_id, role")
    .eq("id", user.id)
    .maybeSingle();
  if (profile_error) throw profile_error;

  // Priority: 1. effective_user_id (passed from context, e.g. admin viewing user), 2. lawyer_id (if assistant), 3. user.id
  const user_id_to_use = effective_user_id || profile?.lawyer_id || user.id;
  const is_admin_user = profile?.role === "admin";

  const DESIGNATED_ADMIN_EMAILS = [
    "nahwiabdo@gmail.com",
    "avocat.nahwi@gmail.com",
    "sy963958932922@email.com",
  ];
  const is_admin_frontend =
    DESIGNATED_ADMIN_EMAILS.includes(user.email || "") || is_admin_user;

  const data_to_upsert = {
    clients: data.clients?.map((client) => ({
      id: client.id,
      name: client.name,
      contact_info: client.contact_info,
      updated_at: client.updated_at,
      user_id: client.user_id || user_id_to_use,
    })),
    cases: data.cases?.map((case_item) => ({
      id: case_item.id,
      subject: case_item.subject,
      client_name: case_item.client_name,
      opponent_name: case_item.opponent_name,
      fee_agreement: case_item.fee_agreement,
      status: case_item.status,
      updated_at: case_item.updated_at,
      client_id: case_item.client_id,
      user_id: case_item.user_id || user_id_to_use,
    })),
    stages: data.stages?.map((stage) => ({
      id: stage.id,
      court: stage.court,
      case_number: stage.case_number,
      first_session_date: stage.first_session_date,
      decision_date: stage.decision_date,
      decision_number: stage.decision_number,
      decision_summary: stage.decision_summary,
      decision_notes: stage.decision_notes,
      updated_at: stage.updated_at,
      case_id: stage.case_id,
      user_id: stage.user_id || user_id_to_use,
    })),
    sessions: data.sessions?.map((s: any) => ({
      id: s.id,
      court: s.court,
      case_number: s.case_number,
      date: s.date,
      client_name: s.client_name,
      opponent_name: s.opponent_name,
      postponement_reason: s.postponement_reason,
      next_postponement_reason: s.next_postponement_reason,
      is_postponed: s.is_postponed,
      next_session_date: s.next_session_date,
      assignee: s.assignee,
      stage_id: s.stage_id,
      stage_decision_date: s.stage_decision_date,
      updated_at: s.updated_at,
      user_id: s.user_id || user_id_to_use,
    })),
    admin_tasks: data.admin_tasks?.map((task: any) => {
      let taskText = task.task || "";
      if (taskText.includes("<!--IMG:")) {
        taskText = taskText.replace(/<!--IMG:[\s\S]*?-->/g, "").trim();
      }
      return {
        id: task.id,
        task: taskText,
        due_date: task.due_date,
        completed: task.completed,
        importance: task.importance,
        assignee: task.assignee,
        location: task.location,
        image_url: task.image_url,
        updated_at: task.updated_at,
        order_index: task.order_index,
        user_id: task.user_id || user_id_to_use,
      };
    }),
    appointments: data.appointments?.map((apt: any) => ({
      id: apt.id,
      title: apt.title,
      time: apt.time,
      date: apt.date,
      importance: apt.importance,
      completed: apt.completed,
      notified: apt.notified,
      reminder_time_in_minutes: apt.reminder_time_in_minutes,
      assignee: apt.assignee,
      updated_at: apt.updated_at,
      user_id: apt.user_id || user_id_to_use,
    })),
    accounting_entries: data.accounting_entries?.map((entry: any) => ({
      id: entry.id,
      type: entry.type,
      amount: entry.amount,
      date: entry.date,
      description: entry.description,
      client_id: entry.client_id,
      case_id: entry.case_id,
      client_name: entry.client_name,
      updated_at: entry.updated_at,
      user_id: entry.user_id || user_id_to_use,
    })),
    assistants: data.assistants?.map((item: any) => ({
      name: item.name,
      user_id: item.user_id || user_id_to_use,
    })),
    invoices: data.invoices?.map((inv) => ({
      id: inv.id,
      client_id: inv.client_id,
      client_name: inv.client_name,
      case_id: inv.case_id,
      case_subject: inv.case_subject,
      issue_date: inv.issue_date,
      due_date: inv.due_date,
      tax_rate: inv.tax_rate,
      discount: inv.discount,
      status: inv.status,
      notes: inv.notes,
      updated_at: inv.updated_at,
      user_id: inv.user_id || user_id_to_use,
    })),
    invoice_items: data.invoice_items?.map((item: any) => ({
      id: item.id,
      invoice_id: item.invoice_id,
      description: item.description,
      amount: item.amount,
      updated_at: item.updated_at,
      user_id: item.user_id || user_id_to_use,
    })),
    case_documents: data.case_documents?.map((doc: any) => ({
      id: doc.id,
      case_id: doc.case_id,
      name: doc.name,
      type: doc.type,
      size: doc.size,
      added_at: doc.added_at,
      storage_path: doc.storage_path,
      updated_at: doc.updated_at,
      user_id: doc.user_id || user_id_to_use,
    })),
    profiles: data.profiles?.map((profile: any) => ({
      id: profile.id,
      full_name: profile.full_name,
      mobile_number: profile.mobile_number,
      is_approved: profile.is_approved,
      is_active: profile.is_active,
      mobile_verified: profile.mobile_verified,
      trial_used: profile.trial_used,
      subscription_start_date: profile.subscription_start_date,
      subscription_end_date: profile.subscription_end_date,
      role:
        DESIGNATED_ADMIN_EMAILS.includes(user.email || "") &&
        profile.id === user.id
          ? "admin"
          : profile.role,
      permissions: profile.permissions,
      lawyer_id: profile.lawyer_id,
      admin_tasks_layout: profile.admin_tasks_layout,
      created_at: profile.created_at,
      updated_at: profile.updated_at,
    })),
    site_finances: data.site_finances?.map((finance: any) => ({
      id: finance.id,
      type: finance.type,
      payment_date: finance.payment_date,
      amount: finance.amount,
      description: finance.description,
      payment_method: finance.payment_method,
      category: finance.category,
      user_id: finance.user_id || user_id_to_use,
      updated_at: finance.updated_at,
    })),
  };

  const cleanRecordForSchemaMismatch = (rec: any, errorMessage: string) => {
    const cleaned = { ...rec };
    const lowerMsg = errorMessage.toLowerCase();

    // Extract field names from quotes in error messages like "could not find the 'case_id' column"
    const extractedFields = new Set<string>();
    const matches = errorMessage.match(/['"`]([a-zA-Z0-9_]+)['"`]/g);
    if (matches) {
      matches.forEach((m) => {
        const fieldName = m.replace(/['"`]/g, "").trim();
        if (fieldName && fieldName !== "admin_tasks" && fieldName !== "public") {
          extractedFields.add(fieldName.toLowerCase());
        }
      });
    }

    if (
      (extractedFields.has("image_url") || lowerMsg.includes("image_url")) &&
      cleaned.image_url
    ) {
      let taskText = cleaned.task || "";
      if (!taskText.includes("<!--IMG:")) {
        cleaned.task = `${taskText}\n<!--IMG:${cleaned.image_url}-->`;
      }
    }

    for (const key of Object.keys(cleaned)) {
      const keyLower = key.toLowerCase();
      const isMissingField =
        extractedFields.has(keyLower) ||
        lowerMsg.includes(`'${keyLower}'`) ||
        lowerMsg.includes(`"${keyLower}"`) ||
        lowerMsg.includes(`\`${keyLower}\``) ||
        lowerMsg.includes(`column ${keyLower} `) ||
        lowerMsg.includes(`.${keyLower} `);

      if (isMissingField) {
        delete cleaned[key];
      }
    }
    return cleaned;
  };

  const upsert_table = async (
    table: string,
    records: any[] | undefined,
    on_conflict?: string,
  ) => {
    if (!records || records.length === 0) return [];

    const max_retries = 3;
    let attempt = 0;

    while (attempt < max_retries) {
      try {
        const { data: response_data, error } = await supabase
          .from(table)
          .upsert(records, { onConflict: on_conflict })
          .select();
        if (error) {
          const message = String(error.message || "").toLowerCase();

          // Fallback to one-by-one if any error occurs in a batch upsert
          if (records.length > 1) {
            console.warn(
              `Error in batch upsert for ${table}: ${error.message}. Attempting one-by-one fallback...`,
            );
            const successful_records: any[] = [];
            for (const rec of records) {
              try {
                const { data: single_data, error: single_error } = await supabase
                  .from(table)
                  .upsert([rec], { onConflict: on_conflict })
                  .select();
                if (single_error) {
                  const single_msg = String(single_error.message || "").toLowerCase();
                  if (
                    single_msg.includes("column") ||
                    single_msg.includes("schema") ||
                    single_msg.includes("does not exist") ||
                    single_error.code === "42703" ||
                    single_error.code === "PGRST204"
                  ) {
                    const cleaned_rec = cleanRecordForSchemaMismatch(rec, single_msg);
                    const { data: retry_data, error: retry_error } = await supabase
                      .from(table)
                      .upsert([cleaned_rec], { onConflict: on_conflict })
                      .select();
                    if (!retry_error && retry_data) {
                      successful_records.push(...retry_data);
                      continue;
                    }
                  }
                  console.warn(
                    `Skipping invalid record in ${table} due to error:`,
                    single_error,
                  );
                } else if (single_data) {
                  successful_records.push(...single_data);
                }
              } catch (single_e) {
                console.warn(`Error upserting record in ${table}:`, single_e);
              }
            }
            return successful_records;
          }

          // If single record batch had a missing column or schema error
          if (
            message.includes("column") ||
            message.includes("schema") ||
            message.includes("does not exist") ||
            error.code === "42703" ||
            error.code === "PGRST204"
          ) {
            const cleaned_records = records.map((r) =>
              cleanRecordForSchemaMismatch(r, message),
            );
            const { data: retry_data, error: retry_error } = await supabase
              .from(table)
              .upsert(cleaned_records, { onConflict: on_conflict })
              .select();
            if (!retry_error) {
              return retry_data || [];
            }
          }

          if (
            message.includes("abort") ||
            message.includes("lock") ||
            message.includes("failed to fetch")
          ) {
            if (attempt < max_retries - 1) {
              attempt++;
              console.warn(
                `upsert_table ${table} attempt ${attempt} failed: ${message}. Retrying...`,
              );
              await new Promise((resolve) =>
                setTimeout(resolve, 500 * attempt + Math.random() * 500),
              );
              continue;
            }
          }
          throw error;
        }
        return response_data || [];
      } catch (err: any) {
        const message = String(err.message || "").toLowerCase();
        if (
          (message.includes("abort") ||
            message.includes("lock") ||
            message.includes("failed to fetch")) &&
          attempt < max_retries - 1
        ) {
          attempt++;
          await new Promise((resolve) =>
            setTimeout(resolve, 500 * attempt + Math.random() * 500),
          );
          continue;
        }
        throw err;
      }
    }
    throw new Error(`Failed to upsert to ${table} after multiple attempts.`);
  };

  const results: Partial<Record<keyof FlatData, any[]>> = {};
  const profiles_to_upsert = (data_to_upsert.profiles || []).filter(
    (p) => p.id === user.id || is_admin_user,
  );
  results.profiles = await upsert_table("profiles", profiles_to_upsert);
  results.assistants = await upsert_table(
    "assistants",
    data_to_upsert.assistants,
    "name,user_id",
  );
  results.clients = await upsert_table("clients", data_to_upsert.clients);
  results.cases = await upsert_table("cases", data_to_upsert.cases);
  results.stages = await upsert_table("stages", data_to_upsert.stages);
  results.sessions = await upsert_table("sessions", data_to_upsert.sessions);
  results.invoices = await upsert_table("invoices", data_to_upsert.invoices);
  results.invoice_items = await upsert_table(
    "invoice_items",
    data_to_upsert.invoice_items,
  );
  results.case_documents = await upsert_table(
    "case_documents",
    data_to_upsert.case_documents,
  );

  // Sequentialize the rest to avoid lock stealing
  results.admin_tasks = await upsert_table(
    "admin_tasks",
    data_to_upsert.admin_tasks,
  );
  results.appointments = await upsert_table(
    "appointments",
    data_to_upsert.appointments,
  );
  results.accounting_entries = await upsert_table(
    "accounting_entries",
    data_to_upsert.accounting_entries,
  );
  if (is_admin_frontend) {
    results.site_finances = await upsert_table(
      "site_finances",
      data_to_upsert.site_finances,
    );
  } else {
    results.site_finances = [];
  }

  return results;
};

export const transform_remote_to_local = (remote: any): Partial<FlatData> => {
  if (!remote) return {};
  return {
    clients: remote.clients || [],
    cases: remote.cases || [],
    stages: remote.stages || [],
    sessions: (remote.sessions || []).map((s: any) => ({
      ...s,
      is_postponed: Boolean(s.is_postponed),
    })),
    admin_tasks: (remote.admin_tasks || []).map((task: any) => {
      let img = task.image_url;
      let cleanTask = task.task || "";
      if (!img && cleanTask.includes("<!--IMG:")) {
        const match = cleanTask.match(/<!--IMG:([\s\S]*?)-->/);
        if (match) img = match[1];
      }
      if (cleanTask.includes("<!--IMG:")) {
        cleanTask = cleanTask.replace(/<!--IMG:[\s\S]*?-->/g, "").trim();
      }
      return {
        ...task,
        task: cleanTask,
        image_url: img,
      };
    }),
    appointments: remote.appointments || [],
    accounting_entries: remote.accounting_entries || [],
    assistants: (remote.assistants || []).map((a: any) => ({ name: a.name })),
    invoices: remote.invoices || [],
    invoice_items: remote.invoice_items || [],
    case_documents: remote.case_documents || [],
    profiles: remote.profiles || [],
    site_finances: remote.site_finances || [],
    sync_deletions: remote.sync_deletions || [],
  };
};
