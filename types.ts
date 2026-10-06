export type ClientType = 'individual' | 'company';
export type ClientStatus = 'active' | 'inactive';

export interface Client {
  id: string;
  name: string;
  nationalId: string;
  phone: string;
  whatsapp?: string;
  email?: string;
  address?: string;
  clientType: ClientType;
  companyName?: string;
  representativeName?: string;
  status: ClientStatus;
  notes?: string;
  createdAt: string;
}

export type CaseStage = 'preliminary' | 'appeal' | 'supreme' | 'execution' | 'arbitration' | 'other';
export type CaseStatus = 'active' | 'judged' | 'postponed' | 'closed' | 'archived';
export type ClientRole = 'plaintiff' | 'defendant' | 'petitioner' | 'respondent' | 'appellant' | 'appellee' | 'other';

export interface Case {
  id: string;
  clientId: string;
  clientName: string;
  caseNumber: string;
  caseYear: string;
  court: string;
  circuit?: string;
  caseType: string;
  subject: string;
  description?: string;
  stage: CaseStage;
  status: CaseStatus;
  clientRole: ClientRole;
  opponentName: string;
  opponentLawyer?: string;
  opponentPhone?: string;
  filingDate: string;
  judgmentDate?: string;
  judgmentText?: string;
  assignedLawyer?: string;
  feesTotal: number;
  feesPaid: number;
  createdAt: string;
}

export type SessionStatus = 'upcoming' | 'completed' | 'postponed' | 'judged' | 'cancelled';

export interface CourtSession {
  id: string;
  caseId: string;
  caseNumber: string;
  caseYear?: string;
  court: string;
  circuit?: string;
  clientName: string;
  sessionDate: string; // YYYY-MM-DD
  sessionTime?: string; // HH:mm
  hall?: string;
  sessionType: string; // e.g. مرافعة، تقديم مستندات، خبير، نطق بالحكم، تحقيق
  requirements?: string; // المطلوب للجلسة
  decision?: string; // قرار الجلسة
  nextSessionDate?: string; // تاريخ الجلسة القادمة
  postponementReason?: string;
  status: SessionStatus;
  attendedLawyer?: string;
  notes?: string;
  isPostponed?: boolean;
  whatsappSent?: boolean;
}

export type TaskPriority = 'low' | 'medium' | 'high' | 'urgent';
export type TaskStatus = 'pending' | 'in_progress' | 'completed' | 'cancelled';

export interface CaseTask {
  id: string;
  caseId?: string;
  caseNumber?: string;
  title: string;
  description?: string;
  assignedTo?: string;
  dueDate: string;
  priority: TaskPriority;
  status: TaskStatus;
  completedAt?: string;
  createdAt: string;
}

export type DocumentCategory = 
  | 'power_of_attorney' // وكالة
  | 'petition' // صحيفة دعوى
  | 'memo' // مذكرة دفاع
  | 'judgment' // حكم
  | 'evidence' // حافظة مستندات
  | 'contract' // عقد
  | 'other';

export interface CaseDocument {
  id: string;
  caseId?: string;
  clientId?: string;
  title: string;
  category: DocumentCategory;
  fileName: string;
  fileSize?: string;
  fileType?: string;
  fileData?: string; // Base64 for local attachment storage
  uploadDate: string;
  notes?: string;
}

export type InvoiceStatus = 'draft' | 'unpaid' | 'partial' | 'paid' | 'overdue';

export interface InvoiceItem {
  id: string;
  description: string;
  amount: number;
}

export interface Invoice {
  id: string;
  invoiceNumber: string;
  caseId?: string;
  clientId: string;
  clientName: string;
  issueDate: string;
  dueDate: string;
  items: InvoiceItem[];
  subtotal: number;
  taxRate: number; // e.g., 15 for 15% VAT
  taxAmount: number;
  totalAmount: number;
  paidAmount: number;
  status: InvoiceStatus;
  notes?: string;
}

export type TransactionType = 'income' | 'expense';
export type PaymentMethod = 'cash' | 'bank_transfer' | 'check' | 'card' | 'online';

export interface FinancialTransaction {
  id: string;
  type: TransactionType;
  invoiceId?: string;
  caseId?: string;
  clientId?: string;
  clientName?: string;
  receiptNumber: string;
  date: string;
  amount: number;
  paymentMethod: PaymentMethod;
  category: string; // e.g. أتعاب محاماة، رسوم قضائية، مصاريف انتقال، طباعة وخبرة
  referenceNumber?: string;
  notes?: string;
}

export interface Appointment {
  id: string;
  title: string;
  clientId?: string;
  clientName?: string;
  caseId?: string;
  date: string; // YYYY-MM-DD
  time: string; // HH:mm
  durationMinutes: number;
  location: string;
  type: 'consultation' | 'meeting' | 'court' | 'police' | 'notary' | 'other';
  status: 'scheduled' | 'completed' | 'cancelled';
  notes?: string;
}

export interface ActivityLog {
  id: string;
  action: string;
  details: string;
  timestamp: string;
  userName: string;
  entityType: 'client' | 'case' | 'session' | 'invoice' | 'payment' | 'task' | 'document' | 'system';
  entityId?: string;
}

export interface OfficeSettings {
  officeName: string;
  lawyerName: string;
  lawyerTitle: string;
  barNumber: string;
  phone: string;
  whatsapp: string;
  email: string;
  address: string;
  taxNumber: string;
  currency: string;
  headerText: string;
  footerText: string;
  logoUrl?: string;
  reminderDaysBeforeSession: number;
  enableWhatsAppNotifications: boolean;
}
