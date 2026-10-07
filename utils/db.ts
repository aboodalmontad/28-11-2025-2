import { openDB, IDBPDatabase } from "idb";

export const DB_NAME = "LawyerAppData";
export const DB_VERSION = 13; // Incremented version
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
