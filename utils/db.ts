import { openDB, IDBPDatabase } from "idb";

export const DB_NAME = "LawyerAppData";
export const DB_VERSION = 13;
export const DATA_STORE_NAME = "app_data";
export const DELETED_IDS_STORE_NAME = "deleted_ids";
export const DOCS_FILES_STORE_NAME = "case_document_files";
export const DOCS_METADATA_STORE_NAME = "case_document_metadata";
export const LOCAL_EXCLUDED_DOCS_STORE_NAME = "local_excluded_documents";

export async function get_db(): Promise<IDBPDatabase> {
  return openDB(DB_NAME, DB_VERSION, {
    upgrade(db, old_version, new_version, tx) {
      if (old_version < 11) {
        if (db.objectStoreNames.contains(DOCS_METADATA_STORE_NAME))
          db.deleteObjectStore(DOCS_METADATA_STORE_NAME);
        db.createObjectStore(DOCS_METADATA_STORE_NAME);
      }
      if (old_version < 12) {
        if (!db.objectStoreNames.contains(LOCAL_EXCLUDED_DOCS_STORE_NAME))
          db.createObjectStore(LOCAL_EXCLUDED_DOCS_STORE_NAME);
      }
      if (!db.objectStoreNames.contains(DATA_STORE_NAME))
        db.createObjectStore(DATA_STORE_NAME);
      if (!db.objectStoreNames.contains(DELETED_IDS_STORE_NAME))
        db.createObjectStore(DELETED_IDS_STORE_NAME);
      if (!db.objectStoreNames.contains(DOCS_FILES_STORE_NAME))
        db.createObjectStore(DOCS_FILES_STORE_NAME);
    },
  });
}

export const DEFAULT_SETTINGS = {
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

export const loadInitialData = () => {
  try {
    const getStored = (key: string, fallback: any) => {
      const item = localStorage.getItem(key);
      return item ? JSON.parse(item) : fallback;
    };

    return {
      clients: getStored('lawyer_clients', []),
      cases: getStored('lawyer_cases', []),
      sessions: getStored('lawyer_sessions', []),
      tasks: getStored('lawyer_tasks', []),
      documents: getStored('lawyer_documents', []),
      invoices: getStored('lawyer_invoices', []),
      transactions: getStored('lawyer_transactions', []),
      appointments: getStored('lawyer_appointments', []),
      settings: getStored('lawyer_settings', DEFAULT_SETTINGS),
      logs: getStored('lawyer_logs', []),
    };
  } catch (e) {
    return {
      clients: [],
      cases: [],
      sessions: [],
      tasks: [],
      documents: [],
      invoices: [],
      transactions: [],
      appointments: [],
      settings: DEFAULT_SETTINGS,
      logs: [],
    };
  }
};

export const saveDataToStorage = async (key: string, data: any) => {
  try {
    localStorage.setItem(key, JSON.stringify(data));
    const db = await get_db();
    await db.put(DATA_STORE_NAME, data, key);
  } catch (e) {
    console.error("Failed to save to storage:", e);
  }
};
