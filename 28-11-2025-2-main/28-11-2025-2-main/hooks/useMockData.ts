import {
  Client,
  AdminTask,
  Appointment,
  AccountingEntry,
  Invoice,
  Case,
  Stage,
  Session,
  InvoiceItem,
} from "../types";
import { to_input_date_string, safe_revive_date } from "../utils/dateUtils";

// Default list of assistants for assignment dropdowns
export const mockAssistants: string[] = ["أحمد", "فاطمة", "سارة", "بدون تخصيص"];

const today = safe_revive_date(new Date());
const createDate = (
  daysOffset: number = 0,
  hours: number = 0,
  minutes: number = 0,
): string => {
  const date = safe_revive_date(today);
  date.setDate(date.getDate() + daysOffset);
  date.setHours(hours, minutes, 0, 0);
  return to_input_date_string(date);
};

// --- Mock Sessions ---
const session1_1_1: Session = {
  id: "session-1",
  court: "محكمة البداية المدنية الأولى",
  case_number: "123/2023",
  date: createDate(-10),
  client_name: "عبد الرحمن قضماني",
  opponent_name: "شركة الإسكان الحديثة",
  is_postponed: true,
  postponement_reason: "لتقديم المستندات",
  next_session_date: createDate(5),
  next_postponement_reason: "لإبراز الوكالة",
  assignee: "أحمد",
  updated_at: new Date().toISOString(),
  user_id: "u1",
  stage_id: "stage-1",
};

const session1_1_2: Session = {
  id: "session-2",
  court: "محكمة البداية المدنية الأولى",
  case_number: "123/2023",
  date: createDate(5),
  client_name: "عبد الرحمن قضماني",
  opponent_name: "شركة الإسكان الحديثة",
  is_postponed: false,
  postponement_reason: "لإبراز الوكالة",
  assignee: "أحمد",
  updated_at: new Date().toISOString(),
  user_id: "u1",
  stage_id: "stage-1",
};

const session2_1_1: Session = {
  id: "session-3",
  court: "محكمة العمل",
  case_number: "45/2024",
  date: createDate(2),
  client_name: "فاطمة الزهراء",
  opponent_name: "المؤسسة التجارية المتحدة",
  is_postponed: false,
  assignee: "فاطمة",
  updated_at: new Date().toISOString(),
  user_id: "u1",
  stage_id: "stage-2",
};

// --- Mock Stages ---
const stage1_1: Stage = {
  id: "stage-1",
  court: "محكمة البداية المدنية الأولى",
  case_number: "123/2023",
  first_session_date: createDate(-10),
  sessions: [],
  updated_at: new Date().toISOString(),
  user_id: "u1",
  case_id: "case-1",
};

const stage2_1: Stage = {
  id: "stage-2",
  court: "محكمة العمل",
  case_number: "45/2024",
  first_session_date: createDate(2),
  sessions: [],
  updated_at: new Date().toISOString(),
  user_id: "u1",
  case_id: "case-2",
};

// --- Mock Cases ---
const case1: Case = {
  id: "case-1",
  client_id: "client-1",
  subject: "نزاع عقاري على ملكية",
  client_name: "عبد الرحمن قضماني",
  opponent_name: "شركة الإسكان الحديثة",
  fee_agreement: "10% من قيمة العقار عند الحكم النهائي",
  status: "active",
  stages: [],
  updated_at: new Date().toISOString(),
  user_id: "u1",
};

const case2: Case = {
  id: "case-2",
  client_id: "client-2",
  subject: "قضية عمالية - فصل تعسفي",
  client_name: "فاطمة الزهراء",
  opponent_name: "المؤسسة التجارية المتحدة",
  fee_agreement: "500,000 ل.س مقدماً و 1,000,000 ل.س عند صدور الحكم",
  status: "active",
  stages: [],
  updated_at: new Date().toISOString(),
  user_id: "u1",
};

const case3: Case = {
  id: "case-3",
  client_id: "client-1",
  subject: "قضية إيجارية مغلقة",
  client_name: "عبد الرحمن قضماني",
  opponent_name: "مستأجر سابق",
  fee_agreement: "مبلغ مقطوع 250,000 ل.س",
  status: "closed",
  stages: [],
  updated_at: new Date().toISOString(),
  user_id: "u1",
};

// --- Mock Clients ---
export const mockClients: Client[] = [
  {
    id: "client-1",
    name: "عبد الرحمن قضماني",
    contact_info: "0987654321 - a.kadmani@email.com",
    cases: [],
    updated_at: new Date().toISOString(),
    user_id: "u1",
  },
  {
    id: "client-2",
    name: "فاطمة الزهراء",
    contact_info: "0912345678 - fatima.z@email.com",
    cases: [],
    updated_at: new Date().toISOString(),
    user_id: "u1",
  },
  {
    id: "client-3",
    name: "محمد الشامي",
    contact_info: "0933445566",
    cases: [],
    updated_at: new Date().toISOString(),
    user_id: "u1",
  },
];

// --- Mock Admin Tasks ---
export const mockAdminTasks: AdminTask[] = [
  {
    id: "task-1",
    task: "مراجعة السجل العقاري بخصوص القضية رقم 123/2023",
    due_date: createDate(1),
    completed: false,
    importance: "important",
    assignee: "أحمد",
    location: "السجل العقاري",
    updated_at: new Date().toISOString(),
    user_id: "u1",
    order_index: 0,
  },
  {
    id: "task-2",
    task: "تحضير لائحة الرد على قضية الفصل التعسفي",
    due_date: createDate(3),
    completed: false,
    importance: "urgent",
    assignee: "فاطمة",
    location: "المكتب",
    updated_at: new Date().toISOString(),
    user_id: "u1",
    order_index: 1,
  },
  {
    id: "task-3",
    task: "شراء مستلزمات مكتبية",
    due_date: createDate(-2),
    completed: true,
    importance: "normal",
    assignee: "سارة",
    location: "خارج المكتب",
    updated_at: new Date().toISOString(),
    user_id: "u1",
    order_index: 2,
  },
];

// --- Mock Appointments ---
export const mockAppointments: Appointment[] = [
  {
    id: "apt-1",
    title: "اجتماع مع الموكل عبد الرحمن قضماني",
    time: "11:00",
    date: createDate(0),
    importance: "important",
    assignee: "أحمد",
    completed: false,
    reminder_time_in_minutes: 15,
    notified: false,
    updated_at: new Date().toISOString(),
    user_id: "u1",
  },
  {
    id: "apt-2",
    title: "مقابلة شاهد في قضية عمالية",
    time: "14:30",
    date: createDate(1),
    importance: "normal",
    assignee: "فاطمة",
    completed: true,
    reminder_time_in_minutes: 30,
    notified: true,
    updated_at: new Date().toISOString(),
    user_id: "u1",
  },
];

// --- Mock Accounting Entries ---
export const mockAccountingEntries: AccountingEntry[] = [
  {
    id: "acc-1",
    type: "income",
    amount: 500000,
    date: createDate(-20),
    description: "دفعة مقدمة - قضية فصل تعسفي",
    client_id: "client-2",
    case_id: "case-2",
    client_name: "فاطمة الزهراء",
    updated_at: new Date().toISOString(),
    user_id: "u1",
  },
  {
    id: "acc-2",
    type: "expense",
    amount: 25000,
    date: createDate(-15),
    description: "رسوم قضائية - قضية نزاع عقاري",
    client_id: "client-1",
    case_id: "case-1",
    client_name: "عبد الرحمن قضماني",
    updated_at: new Date().toISOString(),
    user_id: "u1",
  },
  {
    id: "acc-3",
    type: "expense",
    amount: 15000,
    date: createDate(-5),
    description: "مصاريف تنقلات للمحكمة",
    client_id: "",
    case_id: "",
    client_name: "مصاريف عامة",
    updated_at: new Date().toISOString(),
    user_id: "u1",
  },
];

// --- Mock Invoices ---
const invoice1Items: InvoiceItem[] = [
  {
    id: "invitem-1",
    description: "أتعاب محاماة - الدفعة الأولى",
    amount: 250000,
    updated_at: new Date().toISOString(),
    user_id: "u1",
    invoice_id: "INV-2024-001",
  },
  {
    id: "invitem-2",
    description: "رسوم ومصاريف قضائية",
    amount: 35000,
    updated_at: new Date().toISOString(),
    user_id: "u1",
    invoice_id: "INV-2024-001",
  },
];

export const mockInvoices: Invoice[] = [
  {
    id: "INV-2024-001",
    client_id: "client-1",
    client_name: "عبد الرحمن قضماني",
    case_id: "case-1",
    case_subject: "نزاع عقاري على ملكية",
    issue_date: createDate(-5),
    due_date: createDate(10),
    items: invoice1Items,
    tax_rate: 0,
    discount: 10000,
    status: "sent",
    notes: "يرجى سداد المبلغ قبل تاريخ الاستحقاق.",
    updated_at: new Date().toISOString(),
    user_id: "u1",
  },
];

// --- Main mock data getter ---
export const getMockData = () => ({
  clients: mockClients,
  adminTasks: mockAdminTasks,
  appointments: mockAppointments,
  accountingEntries: mockAccountingEntries,
  invoices: mockInvoices,
  assistants: mockAssistants,
});
