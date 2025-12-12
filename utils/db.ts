
import { openDB, IDBPDatabase } from 'idb';

export const DB_NAME = 'LawyerAppData';
export const DB_VERSION = 11;
export const DATA_STORE_NAME = 'appData';
export const DOCS_FILES_STORE_NAME = 'caseDocumentFiles';
export const DOCS_METADATA_STORE_NAME = 'caseDocumentMetadata';

export async function getDb(): Promise<IDBPDatabase> {
  return openDB(DB_NAME, DB_VERSION, {
    upgrade(db, oldVersion, newVersion, tx) {
        if (oldVersion < 11) {
            if (db.objectStoreNames.contains(DOCS_METADATA_STORE_NAME)) db.deleteObjectStore(DOCS_METADATA_STORE_NAME);
            db.createObjectStore(DOCS_METADATA_STORE_NAME);
        }
        if (!db.objectStoreNames.contains(DATA_STORE_NAME)) db.createObjectStore(DATA_STORE_NAME);
        if (!db.objectStoreNames.contains(DOCS_FILES_STORE_NAME)) db.createObjectStore(DOCS_FILES_STORE_NAME);
    },
  });
}
