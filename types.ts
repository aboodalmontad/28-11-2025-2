export interface Permissions {
  // General (عام)
  can_view_agenda: boolean; // عرض المفكرة والصفحة الرئيسية

  // Clients (الموكلين)
  can_view_clients: boolean;
  can_add_client: boolean;
  can_edit_client: boolean;
  can_delete_client: boolean;

  // Cases (القضايا)
  can_view_cases: boolean;
  can_add_case: boolean;
  can_edit_case: boolean;
  can_delete_case: boolean;

  // Sessions (الجلسات)
  can_view_sessions: boolean;
  can_add_session: boolean;
  can_edit_session: boolean;
  can_delete_session: boolean;
  can_postpone_session: boolean; // ترحيل الجلسات
  can_decide_session: boolean; // حسم الجلسات/المراحل

  // Documents (الوثائق)
  can_view_documents: boolean;
  can_add_document: boolean;
  can_delete_document: boolean;

  // Finance (المالية)
  can_view_finance: boolean;
  can_add_financial_entry: boolean; // إضافة قيود
  can_delete_financial_entry: boolean; // حذف قيود
  can_manage_invoices: boolean; // إدارة الفواتير كاملة

  // Admin Tasks (المهام الإدارية)
  can_view_admin_tasks: boolean;
  can_add_admin_task: boolean;
  can_edit_admin_task: boolean;
  can_delete_admin_task: boolean;

  // Reports (التقارير)
  can_view_reports: boolean;
}

export const default_permissions: Permissions = {
  // Default restricted permissions for a new assistant
  can_view_agenda: true,

  can_view_clients: true,
  can_add_client: false,
  can_edit_client: false,
  can_delete_client: false,

  can_view_cases: true,
  can_add_case: false,
  can_edit_case: false,
  can_delete_case: false,

  can_view_sessions: true,
  can_add_session: true,
  can_edit_session: false,
  can_delete_session: false,
  can_postpone_session: true,
  can_decide_session: false,

  can_view_documents: true,
  can_add_document: true,
  can_delete_document: false,

  can_view_finance: false,
  can_add_financial_entry: false,
  can_delete_financial_entry: false,
  can_manage_invoices: false,

  can_view_admin_tasks: true,
  can_add_admin_task: true,
  can_edit_admin_task: true,
  can_delete_admin_task: false,

  can_view_reports: false,
};

export interface Profile {
  id: string;
  full_name: string;
  mobile_number: string;
  is_approved: boolean;
  is_active: boolean;
  mobile_verified?: boolean;
  trial_used?: boolean;
  subscription_start_date: string | null;
  subscription_end_date: string | null;
  role: "user" | "admin";
  permissions?: Permissions | null;
  role_id?: string | null;
  lawyer_id?: string | null;
  verification_code?: string | null;
  otp_code?: string | null;
  otp_expires_at?: string | null;
  parent_id?: string | null;
  created_at?: string;
  updated_at?: string;
  admin_tasks_layout?: "vertical" | "horizontal";
}

export interface Session {
  id: string;
  court: string;
  case_number: string;
  date: string;
  client_name: string;
  opponent_name: string;
  postponement_reason?: string;
  next_postponement_reason?: string;
  is_postponed: boolean;
  next_session_date?: string;
  assignee?: string;
  // For contextual rendering in flat lists
  stage_id?: string;
  stage_decision_date?: string;
  updated_at?: string;
  user_id?: string;
}

export interface Stage {
  id: string;
  court: string;
  case_number: string;
  first_session_date?: string;
  sessions: Session[];
  decision_date?: string;
  decision_number?: string;
  decision_summary?: string;
  decision_notes?: string;
  updated_at?: string;
  user_id?: string;
  case_id?: string;
}

export interface CaseTask {
  id: string;
  task: string;
  due_date: string;
  completed: boolean;
  importance: "normal" | "important" | "urgent";
  assignee?: string;
  image_url?: string;
  updated_at?: string;
}

export interface Case {
  id: string;
  subject: string;
  client_name: string;
  opponent_name: string;
  stages: Stage[];
  tasks?: CaseTask[]; // Made tasks optional
  fee_agreement: string;
  status: "active" | "closed" | "on_hold";
  updated_at?: string;
  user_id?: string;
  client_id: string;
}

export interface Client {
  id: string;
  name: string;
  contact_info: string;
  cases: Case[];
  updated_at?: string;
  user_id?: string;
}

export interface AdminTask {
  id: string;
  user_id?: string;
  task: string;
  due_date: string;
  completed: boolean;
  importance: "normal" | "important" | "urgent";
  assignee?: string;
  location?: string;
  case_id?: string;
  image_url?: string;
  updated_at?: string;
  order_index?: number;
}

export interface Appointment {
  id: string;
  title: string;
  time: string;
  date: string;
  importance: "normal" | "important" | "urgent";
  completed: boolean;
  notified?: boolean;
  reminder_time_in_minutes?: number;
  assignee?: string;
  updated_at?: string;
  user_id?: string;
}

export interface AccountingEntry {
  id: string;
  type: "income" | "expense";
  amount: number;
  date: string;
  description: string;
  client_id: string;
  case_id: string;
  client_name: string;
  updated_at?: string;
  user_id?: string;
}

export interface InvoiceItem {
  id: string;
  invoice_id?: string;
  description: string;
  amount: number;
  updated_at?: string;
  user_id?: string;
}

export interface Invoice {
  id: string; // e.g., INV-2024-001
  client_id: string;
  client_name: string;
  case_id?: string;
  case_subject?: string;
  issue_date: string;
  due_date: string;
  items: InvoiceItem[];
  tax_rate: number; // Percentage, e.g., 14 for 14%
  discount: number; // Fixed amount
  status: "draft" | "sent" | "paid" | "overdue";
  notes?: string;
  updated_at?: string;
  user_id?: string;
}

export interface SiteFinancialEntry {
  id: number;
  user_id: string | null;
  type: "income" | "expense";
  payment_date: string;
  amount: number;
  description: string | null;
  payment_method: string | null;
  category?: string | null;
  profile_full_name?: string;
  updated_at?: string;
}

export interface CaseDocument {
  id: string;
  case_id: string;
  user_id: string;
  name: string;
  type: string;
  size: number;
  added_at: string;
  storage_path: string; // e.g., 'user-uuid/case-id/doc-id-filename.pdf'
  local_state:
    | "synced"
    | "pending_upload"
    | "pending_download"
    | "error"
    | "downloading";
  updated_at?: string;
}

export interface AppData {
  clients: Client[];
  admin_tasks: AdminTask[];
  appointments: Appointment[];
  accounting_entries: AccountingEntry[];
  invoices: Invoice[];
  assistants: (string | { name: string; user_id?: string })[];
  documents: CaseDocument[];
  profiles: Profile[];
  site_finances: SiteFinancialEntry[];
}

export interface DeletedIds {
  clients: string[];
  cases: string[];
  stages: string[];
  sessions: string[];
  admin_tasks: string[];
  appointments: string[];
  accounting_entries: string[];
  invoices: string[];
  invoice_items: string[];
  assistants: string[];
  documents: string[];
  document_paths: string[];
  profiles: string[];
  site_finances: string[];
}

export interface SyncDeletion {
  id: number;
  table_name: string;
  record_id: string;
  user_id: string;
  deleted_at: string;
}

export const get_initial_deleted_ids = (): DeletedIds => ({
  clients: [],
  cases: [],
  stages: [],
  sessions: [],
  admin_tasks: [],
  appointments: [],
  accounting_entries: [],
  invoices: [],
  invoice_items: [],
  assistants: [],
  documents: [],
  document_paths: [],
  profiles: [],
  site_finances: [],
});
