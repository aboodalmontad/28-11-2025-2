import React, { createContext, useContext, useState, useEffect } from 'react';
import {
  Client,
  Case,
  CourtSession,
  CaseTask,
  CaseDocument,
  Invoice,
  FinancialTransaction,
  Appointment,
  OfficeSettings,
  ActivityLog,
} from '../types';
import { loadInitialData, saveDataToStorage, DEFAULT_SETTINGS } from '../utils/db';
import { createAuditLog } from '../utils/auditLogger';
import { generateId } from '../utils/idUtils';
import { isToday, isTomorrow } from '../utils/dateUtils';

interface NotificationItem {
  id: string;
  title: string;
  message: string;
  type: 'session' | 'task' | 'invoice' | 'info';
  timestamp: string;
  isRead: boolean;
  linkTab?: string;
}

interface DataContextType {
  clients: Client[];
  cases: Case[];
  sessions: CourtSession[];
  tasks: CaseTask[];
  documents: CaseDocument[];
  invoices: Invoice[];
  transactions: FinancialTransaction[];
  appointments: Appointment[];
  settings: OfficeSettings;
  logs: ActivityLog[];
  activeTab: string;
  setActiveTab: (tab: string) => void;
  searchQuery: string;
  setSearchQuery: (query: string) => void;
  notifications: NotificationItem[];
  unreadNotificationsCount: number;
  markAllNotificationsAsRead: () => void;

  // Clients
  addClient: (client: Omit<Client, 'id' | 'createdAt'>) => string;
  updateClient: (id: string, updates: Partial<Client>) => void;
  deleteClient: (id: string) => void;

  // Cases
  addCase: (caseItem: Omit<Case, 'id' | 'createdAt'>) => string;
  updateCase: (id: string, updates: Partial<Case>) => void;
  deleteCase: (id: string) => void;

  // Sessions
  addSession: (session: Omit<CourtSession, 'id'>) => string;
  updateSession: (id: string, updates: Partial<CourtSession>) => void;
  deleteSession: (id: string) => void;
  postponeSession: (id: string, nextDate: string, reason: string) => void;

  // Tasks
  addTask: (task: Omit<CaseTask, 'id' | 'createdAt'>) => string;
  updateTask: (id: string, updates: Partial<CaseTask>) => void;
  deleteTask: (id: string) => void;
  toggleTaskStatus: (id: string) => void;

  // Documents
  addDocument: (doc: Omit<CaseDocument, 'id' | 'uploadDate'>) => string;
  deleteDocument: (id: string) => void;

  // Invoices
  addInvoice: (invoice: Omit<Invoice, 'id'>) => string;
  updateInvoice: (id: string, updates: Partial<Invoice>) => void;
  deleteInvoice: (id: string) => void;

  // Transactions
  addTransaction: (tx: Omit<FinancialTransaction, 'id'>) => string;
  deleteTransaction: (id: string) => void;

  // Appointments
  addAppointment: (apt: Omit<Appointment, 'id'>) => string;
  updateAppointment: (id: string, updates: Partial<Appointment>) => void;
  deleteAppointment: (id: string) => void;

  // Settings
  updateSettings: (newSettings: Partial<OfficeSettings>) => void;

  // Backup & Restore
  exportBackupJson: () => void;
  importBackupJson: (jsonData: string) => boolean;
  resetToDefaultData: () => void;
}

const DataContext = createContext<DataContextType | undefined>(undefined);

export const DataProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [initialData] = useState(() => loadInitialData());

  const [clients, setClients] = useState<Client[]>(initialData.clients);
  const [cases, setCases] = useState<Case[]>(initialData.cases);
  const [sessions, setSessions] = useState<CourtSession[]>(initialData.sessions);
  const [tasks, setTasks] = useState<CaseTask[]>(initialData.tasks);
  const [documents, setDocuments] = useState<CaseDocument[]>(initialData.documents);
  const [invoices, setInvoices] = useState<Invoice[]>(initialData.invoices);
  const [transactions, setTransactions] = useState<FinancialTransaction[]>(initialData.transactions);
  const [appointments, setAppointments] = useState<Appointment[]>(initialData.appointments);
  const [settings, setSettings] = useState<OfficeSettings>(initialData.settings);
  const [logs, setLogs] = useState<ActivityLog[]>(initialData.logs);

  const [activeTab, setActiveTab] = useState<string>('dashboard');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);

  // Sync to storage
  useEffect(() => {
    saveDataToStorage('lawyer_clients', clients);
  }, [clients]);

  useEffect(() => {
    saveDataToStorage('lawyer_cases', cases);
  }, [cases]);

  useEffect(() => {
    saveDataToStorage('lawyer_sessions', sessions);
  }, [sessions]);

  useEffect(() => {
    saveDataToStorage('lawyer_tasks', tasks);
  }, [tasks]);

  useEffect(() => {
    saveDataToStorage('lawyer_documents', documents);
  }, [documents]);

  useEffect(() => {
    saveDataToStorage('lawyer_invoices', invoices);
  }, [invoices]);

  useEffect(() => {
    saveDataToStorage('lawyer_transactions', transactions);
  }, [transactions]);

  useEffect(() => {
    saveDataToStorage('lawyer_appointments', appointments);
  }, [appointments]);

  useEffect(() => {
    saveDataToStorage('lawyer_settings', settings);
  }, [settings]);

  useEffect(() => {
    saveDataToStorage('lawyer_logs', logs);
  }, [logs]);

  // Compute smart notifications
  useEffect(() => {
    const list: NotificationItem[] = [];

    // Session reminders (today & tomorrow)
    sessions.forEach(sess => {
      if (sess.status === 'upcoming') {
        if (isToday(sess.sessionDate)) {
          list.push({
            id: `notif-sess-${sess.id}`,
            title: 'جلسة اليوم!',
            message: `جلسة القضية رقم ${sess.caseNumber} بالمحكمة (${sess.court}) محددة اليوم في تمام ${sess.sessionTime || 'الصباح'}.`,
            type: 'session',
            timestamp: new Date().toISOString(),
            isRead: false,
            linkTab: 'sessions',
          });
        } else if (isTomorrow(sess.sessionDate)) {
          list.push({
            id: `notif-sess-tom-${sess.id}`,
            title: 'جلسة غداً',
            message: `تذكير: جلسة القضية رقم ${sess.caseNumber} للموكل ${sess.clientName} محددة غداً.`,
            type: 'session',
            timestamp: new Date().toISOString(),
            isRead: false,
            linkTab: 'sessions',
          });
        }
      }
    });

    // Urgent pending tasks
    tasks.forEach(task => {
      if (task.status !== 'completed' && (task.priority === 'urgent' || isToday(task.dueDate))) {
        list.push({
          id: `notif-task-${task.id}`,
          title: 'مهمة عاجلة مستحقة',
          message: `المهمة: "${task.title}" للموكل/القضية ${task.caseNumber || ''} تستحق اليوم.`,
          type: 'task',
          timestamp: new Date().toISOString(),
          isRead: false,
          linkTab: 'tasks',
        });
      }
    });

    setNotifications(list);
  }, [sessions, tasks]);

  const addLog = (action: string, details: string, entityType: ActivityLog['entityType'], entityId?: string) => {
    const newLog = createAuditLog(action, details, entityType, settings.lawyerName || 'المحامي', entityId);
    setLogs(prev => [newLog, ...prev.slice(0, 200)]);
  };

  // CLIENTS
  const addClient = (clientData: Omit<Client, 'id' | 'createdAt'>) => {
    const id = generateId();
    const newClient: Client = {
      ...clientData,
      id,
      createdAt: new Date().toISOString(),
    };
    setClients(prev => [newClient, ...prev]);
    addLog('إضافة موكل', `تم تسجيل موكل جديد: ${newClient.name}`, 'client', id);
    return id;
  };

  const updateClient = (id: string, updates: Partial<Client>) => {
    setClients(prev => prev.map(c => (c.id === id ? { ...c, ...updates } : c)));
    addLog('تعديل موكل', `تم تعديل بيانات الموكل: ${updates.name || id}`, 'client', id);
  };

  const deleteClient = (id: string) => {
    const target = clients.find(c => c.id === id);
    setClients(prev => prev.filter(c => c.id !== id));
    addLog('حذف موكل', `تم حذف الموكل: ${target?.name || id}`, 'client', id);
  };

  // CASES
  const addCase = (caseData: Omit<Case, 'id' | 'createdAt'>) => {
    const id = generateId();
    const newCase: Case = {
      ...caseData,
      id,
      createdAt: new Date().toISOString(),
    };
    setCases(prev => [newCase, ...prev]);
    addLog('إضافة قضية', `تم قيد القضية رقم ${newCase.caseNumber} للموكل ${newCase.clientName}`, 'case', id);
    return id;
  };

  const updateCase = (id: string, updates: Partial<Case>) => {
    setCases(prev => prev.map(c => (c.id === id ? { ...c, ...updates } : c)));
    addLog('تعديل قضية', `تم تعديل بيانات القضية رقم: ${updates.caseNumber || id}`, 'case', id);
  };

  const deleteCase = (id: string) => {
    const target = cases.find(c => c.id === id);
    setCases(prev => prev.filter(c => c.id !== id));
    addLog('حذف قضية', `تم حذف القضية رقم: ${target?.caseNumber || id}`, 'case', id);
  };

  // SESSIONS
  const addSession = (sessionData: Omit<CourtSession, 'id'>) => {
    const id = generateId();
    const newSession: CourtSession = {
      ...sessionData,
      id,
    };
    setSessions(prev => [newSession, ...prev]);
    addLog('جدولة جلسة', `تم تسجيل جلسة قضية رقم ${newSession.caseNumber} بتاريخ ${newSession.sessionDate}`, 'session', id);
    return id;
  };

  const updateSession = (id: string, updates: Partial<CourtSession>) => {
    setSessions(prev => prev.map(s => (s.id === id ? { ...s, ...updates } : s)));
    addLog('تحديث جلسة', `تم تحديث الجلسة رقم ${id}`, 'session', id);
  };

  const deleteSession = (id: string) => {
    setSessions(prev => prev.filter(s => s.id !== id));
    addLog('حذف جلسة', `تم حذف الجلسة رقم ${id}`, 'session', id);
  };

  const postponeSession = (id: string, nextDate: string, reason: string) => {
    const current = sessions.find(s => s.id === id);
    if (!current) return;

    // Update current session
    updateSession(id, {
      status: 'postponed',
      isPostponed: true,
      nextSessionDate: nextDate,
      postponementReason: reason,
      decision: `تأجلت إلى ${nextDate} - السبب: ${reason}`,
    });

    // Create next session automatically
    addSession({
      caseId: current.caseId,
      caseNumber: current.caseNumber,
      caseYear: current.caseYear,
      court: current.court,
      circuit: current.circuit,
      clientName: current.clientName,
      sessionDate: nextDate,
      sessionTime: current.sessionTime,
      hall: current.hall,
      sessionType: 'جلسة مؤجلة لمتابعة السير في الدعوى',
      requirements: `متابعة ما تم تأجيل الجلسة السابقة لأجله: ${reason}`,
      status: 'upcoming',
      attendedLawyer: current.attendedLawyer,
    });
  };

  // TASKS
  const addTask = (taskData: Omit<CaseTask, 'id' | 'createdAt'>) => {
    const id = generateId();
    const newTask: CaseTask = {
      ...taskData,
      id,
      createdAt: new Date().toISOString(),
    };
    setTasks(prev => [newTask, ...prev]);
    addLog('إضافة مهمة', `تم إنشاء مهمة عمل جديدة: ${newTask.title}`, 'task', id);
    return id;
  };

  const updateTask = (id: string, updates: Partial<CaseTask>) => {
    setTasks(prev => prev.map(t => (t.id === id ? { ...t, ...updates } : t)));
    addLog('تحديث مهمة', `تم تعديل بيانات المهمة: ${updates.title || id}`, 'task', id);
  };

  const deleteTask = (id: string) => {
    setTasks(prev => prev.filter(t => t.id !== id));
    addLog('حذف مهمة', `تم حذف المهمة رقم: ${id}`, 'task', id);
  };

  const toggleTaskStatus = (id: string) => {
    setTasks(prev =>
      prev.map(t => {
        if (t.id === id) {
          const newStatus = t.status === 'completed' ? 'pending' : 'completed';
          return {
            ...t,
            status: newStatus,
            completedAt: newStatus === 'completed' ? new Date().toISOString() : undefined,
          };
        }
        return t;
      })
    );
  };

  // DOCUMENTS
  const addDocument = (docData: Omit<CaseDocument, 'id' | 'uploadDate'>) => {
    const id = generateId();
    const newDoc: CaseDocument = {
      ...docData,
      id,
      uploadDate: new Date().toISOString().split('T')[0],
    };
    setDocuments(prev => [newDoc, ...prev]);
    addLog('إضافة مستند', `تم أرشفة مستند جديد: ${newDoc.title}`, 'document', id);
    return id;
  };

  const deleteDocument = (id: string) => {
    setDocuments(prev => prev.filter(d => d.id !== id));
    addLog('حذف مستند', `تم حذف المستند: ${id}`, 'document', id);
  };

  // INVOICES
  const addInvoice = (invData: Omit<Invoice, 'id'>) => {
    const id = generateId();
    const newInv: Invoice = {
      ...invData,
      id,
    };
    setInvoices(prev => [newInv, ...prev]);
    addLog('إصدار فاتورة', `تم إصدار فاتورة أتعاب رقم ${newInv.invoiceNumber} للموكل ${newInv.clientName}`, 'invoice', id);
    return id;
  };

  const updateInvoice = (id: string, updates: Partial<Invoice>) => {
    setInvoices(prev => prev.map(i => (i.id === id ? { ...i, ...updates } : i)));
    addLog('تحديث فاتورة', `تم تحديث بيانات الفاتورة: ${id}`, 'invoice', id);
  };

  const deleteInvoice = (id: string) => {
    setInvoices(prev => prev.filter(i => i.id !== id));
    addLog('حذف فاتورة', `تم حذف الفاتورة: ${id}`, 'invoice', id);
  };

  // TRANSACTIONS
  const addTransaction = (txData: Omit<FinancialTransaction, 'id'>) => {
    const id = generateId();
    const newTx: FinancialTransaction = {
      ...txData,
      id,
    };
    setTransactions(prev => [newTx, ...prev]);

    // If linked to an invoice, auto-update invoice paid amount & case paid amount
    if (newTx.invoiceId && newTx.type === 'income') {
      setInvoices(prev =>
        prev.map(inv => {
          if (inv.id === newTx.invoiceId) {
            const updatedPaid = (inv.paidAmount || 0) + newTx.amount;
            const newStatus = updatedPaid >= inv.totalAmount ? 'paid' : 'partial';
            return {
              ...inv,
              paidAmount: updatedPaid,
              status: newStatus,
            };
          }
          return inv;
        })
      );
    }

    if (newTx.caseId && newTx.type === 'income') {
      setCases(prev =>
        prev.map(c => {
          if (c.id === newTx.caseId) {
            return {
              ...c,
              feesPaid: (c.feesPaid || 0) + newTx.amount,
            };
          }
          return c;
        })
      );
    }

    addLog('تسجيل سند مالي', `تم إصدار سند ${newTx.type === 'income' ? 'قبض' : 'صرف'} بقيمة ${newTx.amount} ${settings.currency}`, 'payment', id);
    return id;
  };

  const deleteTransaction = (id: string) => {
    setTransactions(prev => prev.filter(t => t.id !== id));
    addLog('حذف سند مالي', `تم حذف السند المالي: ${id}`, 'payment', id);
  };

  // APPOINTMENTS
  const addAppointment = (aptData: Omit<Appointment, 'id'>) => {
    const id = generateId();
    const newApt: Appointment = {
      ...aptData,
      id,
    };
    setAppointments(prev => [newApt, ...prev]);
    addLog('حجز موعد', `تم حجز موعد جديد: ${newApt.title} بتاريخ ${newApt.date}`, 'system', id);
    return id;
  };

  const updateAppointment = (id: string, updates: Partial<Appointment>) => {
    setAppointments(prev => prev.map(a => (a.id === id ? { ...a, ...updates } : a)));
  };

  const deleteAppointment = (id: string) => {
    setAppointments(prev => prev.filter(a => a.id !== id));
  };

  // SETTINGS
  const updateSettings = (newSettings: Partial<OfficeSettings>) => {
    setSettings(prev => ({ ...prev, ...newSettings }));
    addLog('تحديث الإعدادات', 'تم تعديل بيانات وهوية مكتب المحامي', 'system');
  };

  // NOTIFICATIONS
  const markAllNotificationsAsRead = () => {
    setNotifications(prev => prev.map(n => ({ ...n, isRead: true })));
  };

  const unreadNotificationsCount = notifications.filter(n => !n.isRead).length;

  // EXPORT / IMPORT
  const exportBackupJson = () => {
    const backupData = {
      version: '1.0.0',
      exportedAt: new Date().toISOString(),
      clients,
      cases,
      sessions,
      tasks,
      documents,
      invoices,
      transactions,
      appointments,
      settings,
      logs,
    };
    const jsonStr = JSON.stringify(backupData, null, 2);
    const blob = new Blob([jsonStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `lawyer_office_backup_${new Date().toISOString().split('T')[0]}.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    addLog('تصدير نسخة احتياطية', 'تم تصدير نسخة احتياطية كاملة من بيانات المكتب', 'system');
  };

  const importBackupJson = (jsonData: string): boolean => {
    try {
      const data = JSON.parse(jsonData);
      if (data.clients) setClients(data.clients);
      if (data.cases) setCases(data.cases);
      if (data.sessions) setSessions(data.sessions);
      if (data.tasks) setTasks(data.tasks);
      if (data.documents) setDocuments(data.documents);
      if (data.invoices) setInvoices(data.invoices);
      if (data.transactions) setTransactions(data.transactions);
      if (data.appointments) setAppointments(data.appointments);
      if (data.settings) setSettings(data.settings);
      if (data.logs) setLogs(data.logs);
      addLog('استيراد نسخة احتياطية', 'تم استيراد نسخة احتياطية بنجاح وتحديث كافة السجلات', 'system');
      return true;
    } catch (err) {
      console.error('Import error:', err);
      return false;
    }
  };

  const resetToDefaultData = () => {
    const initial = loadInitialData();
    setClients(initial.clients);
    setCases(initial.cases);
    setSessions(initial.sessions);
    setTasks(initial.tasks);
    setDocuments(initial.documents);
    setInvoices(initial.invoices);
    setTransactions(initial.transactions);
    setAppointments(initial.appointments);
    setSettings(initial.settings);
    setLogs(initial.logs);
    addLog('إعادة ضبط المصنع', 'تمت استعادة البيانات النموذجية الأولية للنظام', 'system');
  };

  return (
    <DataContext.Provider
      value={{
        clients,
        cases,
        sessions,
        tasks,
        documents,
        invoices,
        transactions,
        appointments,
        settings,
        logs,
        activeTab,
        setActiveTab,
        searchQuery,
        setSearchQuery,
        notifications,
        unreadNotificationsCount,
        markAllNotificationsAsRead,
        addClient,
        updateClient,
        deleteClient,
        addCase,
        updateCase,
        deleteCase,
        addSession,
        updateSession,
        deleteSession,
        postponeSession,
        addTask,
        updateTask,
        deleteTask,
        toggleTaskStatus,
        addDocument,
        deleteDocument,
        addInvoice,
        updateInvoice,
        deleteInvoice,
        addTransaction,
        deleteTransaction,
        addAppointment,
        updateAppointment,
        deleteAppointment,
        updateSettings,
        exportBackupJson,
        importBackupJson,
        resetToDefaultData,
      }}
    >
      {children}
    </DataContext.Provider>
  );
};

export const useData = () => {
  const context = useContext(DataContext);
  if (!context) {
    throw new Error('useData must be used within a DataProvider');
  }
  return context;
};
