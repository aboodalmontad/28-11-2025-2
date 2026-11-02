import { Client, Case, CourtSession, CaseTask, CaseDocument, Invoice, FinancialTransaction, Appointment, OfficeSettings, ActivityLog } from '../types';

export const DEFAULT_SETTINGS: OfficeSettings = {
  officeName: 'مكتب الأستاذ المحامي للاستشارات القانونية وأعمال المحاماة',
  lawyerName: 'أ. محمد بن عبد الله النحوي',
  lawyerTitle: 'محامٍ ومستشار قانوني مقيد لدى المحكمة العليا',
  barNumber: 'LAW-44921',
  phone: '+966 50 123 4567',
  whatsapp: '966501234567',
  email: 'avocat.nahwi@gmail.com',
  address: 'برج النخبة للمحاماة، الطابق الرابع، الرياض، المملكة العربية السعودية',
  taxNumber: '300987654300003',
  currency: 'ر.س',
  headerText: 'مكتب المحامي للاستشارات والتقاضي والتحكيم التجاري',
  footerText: 'سري للغاية - صادر عن النظام الإلكتروني لمكتب المحامي',
  reminderDaysBeforeSession: 2,
  enableWhatsAppNotifications: true,
};

const SEED_CLIENTS: Client[] = [
  {
    id: 'c1',
    name: 'شركة الأفق الدولية للتجارة والمقاولات',
    nationalId: '1010887642',
    phone: '0555112233',
    whatsapp: '966555112233',
    email: 'info@alofooq.com',
    address: 'الرياض - طريق الملك فهد',
    clientType: 'company',
    companyName: 'شركة الأفق الدولية',
    representativeName: 'م. فهد السبيعي',
    status: 'active',
    notes: 'عميل دائم بعقد سنوي - قضايا تجارية ومطالبات مالية',
    createdAt: '2026-01-10T10:00:00Z',
  },
  {
    id: 'c2',
    name: 'عبد الرحمن خالد المنصور',
    nationalId: '1088492019',
    phone: '0504499112',
    whatsapp: '966504499112',
    email: 'a.mansoor@gmail.com',
    address: 'جدة - حي الروضة',
    clientType: 'individual',
    status: 'active',
    notes: 'دعوى عمالية ومطالبة بمستحقات نهاية الخدمة والتعويض',
    createdAt: '2026-02-15T11:30:00Z',
  },
  {
    id: 'c3',
    name: 'سارة عبد العزيز التميمي',
    nationalId: '1092837461',
    phone: '0567788990',
    whatsapp: '966567788990',
    email: 'sara.tamimi@outlook.com',
    address: 'الدمام - حي الشاطئ',
    clientType: 'individual',
    status: 'active',
    notes: 'دعوى تركات وقسمة إجبارية لأموال عقارية',
    createdAt: '2026-03-01T09:15:00Z',
  }
];

const SEED_CASES: Case[] = [
  {
    id: 'case-1',
    clientId: 'c1',
    clientName: 'شركة الأفق الدولية للتجارة والمقاولات',
    caseNumber: '4491/1447',
    caseYear: '1447هـ',
    court: 'المحكمة التجارية بالرياض',
    circuit: 'الدائرة التجارية السابعة',
    caseType: 'دعوى تجارية ومطالبة مالية',
    subject: 'المطالبة بقيمة مستخلصات أعمال مقاولة وتنفيذ أبراج سكنية بمبلغ 1,850,000 ر.س',
    description: 'تم إرفاق العقد وجداول الكميات ومحاضر الاستلام الابتدائي',
    stage: 'preliminary',
    status: 'active',
    clientRole: 'plaintiff',
    opponentName: 'شركة إعمار المستقبل للتطوير',
    opponentLawyer: 'أ. سعود الدوسري',
    opponentPhone: '0509988776',
    filingDate: '2026-01-20',
    assignedLawyer: 'أ. محمد النحوي',
    feesTotal: 45000,
    feesPaid: 25000,
    createdAt: '2026-01-20T12:00:00Z',
  },
  {
    id: 'case-2',
    clientId: 'c2',
    clientName: 'عبد الرحمن خالد المنصور',
    caseNumber: '1120/1447',
    caseYear: '1447هـ',
    court: 'المحكمة العمالية بجدة',
    circuit: 'الدائرة العمالية الثالثة',
    caseType: 'منازعة عمالية',
    subject: 'فصل تعسفي ومطالبة بمكافأة نهاية الخدمة وبدل الإجازات',
    stage: 'preliminary',
    status: 'active',
    clientRole: 'plaintiff',
    opponentName: 'مؤسسة الحلول التقنية الحديثة',
    opponentLawyer: 'أ. طارق الشريف',
    filingDate: '2026-02-18',
    assignedLawyer: 'أ. ياسر الحربي',
    feesTotal: 12000,
    feesPaid: 12000,
    createdAt: '2026-02-18T10:00:00Z',
  },
  {
    id: 'case-3',
    clientId: 'c3',
    clientName: 'سارة عبد العزيز التميمي',
    caseNumber: '890/1447',
    caseYear: '1447هـ',
    court: 'محكمة الأحوال الشخصية بالدمام',
    circuit: 'دائرة التركات الثانية',
    caseType: 'قسمة تركة وتصفية عقارية',
    subject: 'حصر تركة المتوفى وتعيين حارس قضائي وقسمة العقارات',
    stage: 'preliminary',
    status: 'active',
    clientRole: 'plaintiff',
    opponentName: 'ورثة عبد العزيز التميمي',
    filingDate: '2026-03-05',
    assignedLawyer: 'أ. محمد النحوي',
    feesTotal: 30000,
    feesPaid: 15000,
    createdAt: '2026-03-05T08:30:00Z',
  }
];

const SEED_SESSIONS: CourtSession[] = [
  {
    id: 'sess-1',
    caseId: 'case-1',
    caseNumber: '4491/1447',
    court: 'المحكمة التجارية بالرياض',
    circuit: 'الدائرة التجارية السابعة',
    clientName: 'شركة الأفق الدولية للتجارة والمقاولات',
    sessionDate: '2026-10-06',
    sessionTime: '09:30',
    hall: 'القاعة 4 - الدور الثاني',
    sessionType: 'جلسة مرافعة وتقديم تقرير الخبير الهندسي',
    requirements: 'تقديم المذكرة الجوابية مع إرفاق ملحق فحص الأعمال المنفذة',
    decision: 'مؤجلة لورود تقرير الخبرة النهائي وتبادل المذكرات الختامية',
    nextSessionDate: '2026-10-20',
    postponementReason: 'استمهال الخصم للرد على المستندات الجديدة',
    status: 'upcoming',
    attendedLawyer: 'أ. محمد النحوي',
    notes: 'الجلسة هامة جداً لإثبات إنجاز كامل المرحلة الثانية',
    isPostponed: false,
    whatsappSent: true,
  },
  {
    id: 'sess-2',
    caseId: 'case-2',
    caseNumber: '1120/1447',
    court: 'المحكمة العمالية بجدة',
    circuit: 'الدائرة العمالية الثالثة',
    clientName: 'عبد الرحمن خالد المنصور',
    sessionDate: '2026-10-08',
    sessionTime: '10:00',
    hall: 'القاعة الإلكترونية (عن بعد)',
    sessionType: 'جلسة نطق بالحكم',
    requirements: 'حضور الجلسة المرئية عبر منصة ناجز',
    status: 'upcoming',
    attendedLawyer: 'أ. ياسر الحربي',
    notes: 'تم قفل باب المرافعة وحجز الدعوى للحكم',
    isPostponed: false,
    whatsappSent: false,
  },
  {
    id: 'sess-3',
    caseId: 'case-3',
    caseNumber: '890/1447',
    court: 'محكمة الأحوال الشخصية بالدمام',
    circuit: 'دائرة التركات الثانية',
    clientName: 'سارة عبد العزيز التميمي',
    sessionDate: '2026-10-15',
    sessionTime: '11:15',
    hall: 'القاعة 2',
    sessionType: 'جلسة تحضيرية وحصر الورثة والمستندات',
    requirements: 'إحضار صكوك ملكية العقارات وصك حصر الورثة المحدث',
    status: 'upcoming',
    attendedLawyer: 'أ. محمد النحوي',
    notes: 'تأكيد حضور الوكلاء الشرعيين لجميع الورثة',
    isPostponed: false,
    whatsappSent: false,
  }
];

const SEED_TASKS: CaseTask[] = [
  {
    id: 'task-1',
    caseId: 'case-1',
    caseNumber: '4491/1447',
    title: 'إعداد مذكرة الرد على تقرير الخبير الهندسي',
    description: 'مراجعة الملاحظات الحسابية وإرفاق إشعارات التحويل البنكي',
    assignedTo: 'أ. محمد النحوي',
    dueDate: '2026-10-05',
    priority: 'urgent',
    status: 'in_progress',
    createdAt: '2026-09-30T10:00:00Z',
  },
  {
    id: 'task-2',
    caseId: 'case-2',
    caseNumber: '1120/1447',
    title: 'استخراج منطوق الحكم العمالي وطلب الصيغة التنفيذية',
    description: 'متابعة بوابة ناجز فور صدور الحكم وإبلاغ الموكل',
    assignedTo: 'أ. ياسر الحربي',
    dueDate: '2026-10-09',
    priority: 'high',
    status: 'pending',
    createdAt: '2026-10-01T12:00:00Z',
  },
  {
    id: 'task-3',
    caseId: 'case-3',
    caseNumber: '890/1447',
    title: 'تحديث صكوك الملكية من البورصة العقارية',
    description: 'استخراج بيانات الصكوك الإلكترونية وتقديمها للمحكمة',
    assignedTo: 'أ. أحمد باحث قانوني',
    dueDate: '2026-10-12',
    priority: 'medium',
    status: 'pending',
    createdAt: '2026-10-02T14:00:00Z',
  }
];

const SEED_INVOICES: Invoice[] = [
  {
    id: 'inv-1',
    invoiceNumber: 'INV-2026-0001',
    caseId: 'case-1',
    clientId: 'c1',
    clientName: 'شركة الأفق الدولية للتجارة والمقاولات',
    issueDate: '2026-01-20',
    dueDate: '2026-02-20',
    items: [
      { id: '1', description: 'أتعاب دراسة القضية وصياغة صحيفة الدعوى وقيدها', amount: 20000 },
      { id: '2', description: 'أتعاب حضور جلسات الترافع والخبرة الهندسية (المرحلة الأولى)', amount: 25000 },
    ],
    subtotal: 45000,
    taxRate: 15,
    taxAmount: 6750,
    totalAmount: 51750,
    paidAmount: 28750,
    status: 'partial',
    notes: 'تم سداد الدفعة الأولى بموجب سند قبض رقم REC-2026-0001',
  },
  {
    id: 'inv-2',
    invoiceNumber: 'INV-2026-0002',
    caseId: 'case-2',
    clientId: 'c2',
    clientName: 'عبد الرحمن خالد المنصور',
    issueDate: '2026-02-18',
    dueDate: '2026-03-18',
    items: [
      { id: '1', description: 'أتعاب الترافع في الدعوى العمالية حتى صدور الحكم الابتدائي', amount: 12000 },
    ],
    subtotal: 12000,
    taxRate: 15,
    taxAmount: 1800,
    totalAmount: 13800,
    paidAmount: 13800,
    status: 'paid',
    notes: 'تم سداد كامل الأتعاب مع الضريبة',
  }
];

const SEED_TRANSACTIONS: FinancialTransaction[] = [
  {
    id: 'tx-1',
    type: 'income',
    invoiceId: 'inv-1',
    caseId: 'case-1',
    clientId: 'c1',
    clientName: 'شركة الأفق الدولية للتجارة والمقاولات',
    receiptNumber: 'REC-2026-0001',
    date: '2026-01-22',
    amount: 28750,
    paymentMethod: 'bank_transfer',
    category: 'أتعاب محاماة',
    referenceNumber: 'TRX-99882211',
    notes: 'سداد الدفعة المقدمة لعقد الأتعاب',
  },
  {
    id: 'tx-2',
    type: 'income',
    invoiceId: 'inv-2',
    caseId: 'case-2',
    clientId: 'c2',
    clientName: 'عبد الرحمن خالد المنصور',
    receiptNumber: 'REC-2026-0002',
    date: '2026-02-20',
    amount: 13800,
    paymentMethod: 'card',
    category: 'أتعاب محاماة',
    referenceNumber: 'POS-110293',
    notes: 'سداد كامل المبلغ عبر نقطة البيع',
  },
  {
    id: 'tx-3',
    type: 'expense',
    caseId: 'case-1',
    receiptNumber: 'EXP-2026-0001',
    date: '2026-02-05',
    amount: 1500,
    paymentMethod: 'bank_transfer',
    category: 'رسوم قضائية وتوثيق',
    referenceNumber: 'MOJ-PAY-4411',
    notes: 'رسوم طلب ندب خبير هندسي ودفع أمانة الخبرة',
  }
];

const SEED_APPOINTMENTS: Appointment[] = [
  {
    id: 'apt-1',
    title: 'استشارة قانونية في عقد شراكة تجارية',
    clientId: 'c1',
    clientName: 'شركة الأفق الدولية',
    date: '2026-10-06',
    time: '16:00',
    durationMinutes: 60,
    location: 'مقر مكتب المحاماة - قاعة الاجتماعات',
    type: 'consultation',
    status: 'scheduled',
    notes: 'مناقشة بنود شرط التحكيم والجزاءات التعاقدية',
  },
  {
    id: 'apt-2',
    title: 'اجتماع مع ورثة التميمي لبحث التسوية الودية',
    clientId: 'c3',
    clientName: 'سارة عبد العزيز التميمي',
    date: '2026-10-09',
    time: '17:30',
    durationMinutes: 90,
    location: 'مقر مكتب المحاماة',
    type: 'meeting',
    status: 'scheduled',
    notes: 'عرض مسودة القسمة الرضائية قبل الجلسة',
  }
];

const SEED_DOCUMENTS: CaseDocument[] = [
  {
    id: 'doc-1',
    caseId: 'case-1',
    clientId: 'c1',
    title: 'صك الوكالة الشرعية الإلكترونية',
    category: 'power_of_attorney',
    fileName: 'وكالة_شركة_الأفق_4491.pdf',
    fileSize: '450 KB',
    fileType: 'application/pdf',
    uploadDate: '2026-01-20',
    notes: 'وكالة إلكترونية سارية تخول الترافع والمطالبة والصلح والإقرار',
  },
  {
    id: 'doc-2',
    caseId: 'case-1',
    clientId: 'c1',
    title: 'عقد المقاولة وجداول الكميات المعتمدة',
    category: 'contract',
    fileName: 'عقد_المقاولة_الموقع_2025.pdf',
    fileSize: '3.2 MB',
    fileType: 'application/pdf',
    uploadDate: '2026-01-21',
    notes: 'العقد الأصلي المبرم بين الطرفين متضمناً مواعيد التسليم',
  },
  {
    id: 'doc-3',
    caseId: 'case-2',
    clientId: 'c2',
    title: 'صحيفة الدعوى العمالية ومحضر التسوية الودية',
    category: 'petition',
    fileName: 'صحيفة_الدعوى_العمالية_1120.pdf',
    fileSize: '780 KB',
    fileType: 'application/pdf',
    uploadDate: '2026-02-18',
    notes: 'محضر تعذر الصلح من مكتب العمل وصحيفة قيد الدعوى',
  }
];

const SEED_LOGS: ActivityLog[] = [
  {
    id: 'log-1',
    action: 'تهيئة النظام',
    details: 'تم تشغيل نظام إدارة مكتب المحامي وتجهيز قواعد البيانات',
    timestamp: '2026-10-05T12:00:00Z',
    userName: 'النظام',
    entityType: 'system',
  },
  {
    id: 'log-2',
    action: 'تسجيل جلسة',
    details: 'تمت جدولة جلسة جديدة للدعوى التجارية رقم 4491/1447',
    timestamp: '2026-10-05T12:10:00Z',
    userName: 'أ. محمد النحوي',
    entityType: 'session',
    entityId: 'sess-1',
  }
];

export const loadInitialData = () => {
  const get = <T>(key: string, fallback: T): T => {
    try {
      const item = localStorage.getItem(key);
      return item ? JSON.parse(item) : fallback;
    } catch {
      return fallback;
    }
  };

  return {
    clients: get<Client[]>('lawyer_clients', SEED_CLIENTS),
    cases: get<Case[]>('lawyer_cases', SEED_CASES),
    sessions: get<CourtSession[]>('lawyer_sessions', SEED_SESSIONS),
    tasks: get<CaseTask[]>('lawyer_tasks', SEED_TASKS),
    documents: get<CaseDocument[]>('lawyer_documents', SEED_DOCUMENTS),
    invoices: get<Invoice[]>('lawyer_invoices', SEED_INVOICES),
    transactions: get<FinancialTransaction[]>('lawyer_transactions', SEED_TRANSACTIONS),
    appointments: get<Appointment[]>('lawyer_appointments', SEED_APPOINTMENTS),
    settings: get<OfficeSettings>('lawyer_settings', DEFAULT_SETTINGS),
    logs: get<ActivityLog[]>('lawyer_logs', SEED_LOGS),
  };
};

export const saveDataToStorage = (key: string, data: any) => {
  try {
    localStorage.setItem(key, JSON.stringify(data));
  } catch (err) {
    console.error(`Failed to save ${key} to localStorage:`, err);
  }
};
