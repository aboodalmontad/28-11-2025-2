import { get_supabase_client } from "../supabaseClient";

export interface AuditLogEntry {
  id?: string | number;
  office_id?: string;
  user_id: string;
  user_name?: string;
  action: string;
  entity_type: string;
  entity_id?: string;
  details?: string;
  created_at: string;
}

export async function logActivity(
  user_id: string,
  action: string,
  entity_type: string,
  entity_id: string,
  details: string,
  user_name?: string,
  office_id?: string
) {
  if (!user_id && !office_id) return;

  // Resolve office_id if not provided
  let effectiveOfficeId = office_id;
  let effectiveUserName = user_name;

  try {
    const cachedProfile = localStorage.getItem("lawyerAppLastUser");
    if (cachedProfile) {
      const parsed = JSON.parse(cachedProfile);
      if (!effectiveOfficeId) {
        effectiveOfficeId = parsed.lawyer_id || parsed.id || user_id;
      }
      if (!effectiveUserName) {
        effectiveUserName = parsed.user_metadata?.full_name || parsed.email || parsed.mobile_number || "";
      }
    }
  } catch (e) {
    // ignore
  }

  const newLog: AuditLogEntry = {
    id: "local_" + Math.random().toString(36).substring(2, 9) + "_" + Date.now(),
    office_id: effectiveOfficeId || user_id,
    user_id: user_id || "system",
    user_name: effectiveUserName || "",
    action,
    entity_type,
    entity_id: entity_id || "",
    details: details || "",
    created_at: new Date().toISOString(),
  };

  // 1. Save locally to localStorage so it's always available instantly and office-isolated
  try {
    const officeStorageKey = effectiveOfficeId ? `local_audit_logs_${effectiveOfficeId}` : "local_audit_logs";
    const existingStr = localStorage.getItem(officeStorageKey);
    const existingLogs: AuditLogEntry[] = existingStr ? JSON.parse(existingStr) : [];
    
    // Also update generic backup key
    const genericStr = localStorage.getItem("local_audit_logs");
    const genericLogs: AuditLogEntry[] = genericStr ? JSON.parse(genericStr) : [];

    const updatedOfficeLogs = [newLog, ...existingLogs.filter(l => l.id !== newLog.id)].slice(0, 500);
    localStorage.setItem(officeStorageKey, JSON.stringify(updatedOfficeLogs));

    const updatedGenericLogs = [newLog, ...genericLogs.filter(l => l.id !== newLog.id)].slice(0, 500);
    localStorage.setItem("local_audit_logs", JSON.stringify(updatedGenericLogs));
  } catch (e) {
    console.error("Failed to save local audit log:", e);
  }

  // 2. Try to insert into Supabase audit_logs table if configured
  const supabase = get_supabase_client();
  if (!supabase) return;

  try {
    await supabase.from("audit_logs").insert([{
      office_id: effectiveOfficeId || undefined,
      user_id: user_id || undefined,
      user_name: effectiveUserName || undefined,
      action,
      entity_type,
      entity_id: entity_id || undefined,
      details: details || undefined,
    }]);
  } catch (err) {
    // Supabase table might not exist or network is offline; local log is safely stored
  }
}
