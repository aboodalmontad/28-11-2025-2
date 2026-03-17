
import { getSupabaseClient } from '../supabaseClient.ts';
import { Client, AdminTask, Appointment, AccountingEntry, Invoice, InvoiceItem, CaseDocument, Profile, SiteFinancialEntry, SyncDeletion } from '../types.ts';
import type { User } from '@supabase/supabase-js';

export type FlatData = {
    clients: Omit<Client, 'cases'>[];
    cases: any[];
    stages: any[];
    sessions: any[];
    admin_tasks: AdminTask[];
    appointments: Appointment[];
    accounting_entries: AccountingEntry[];
    assistants: { name: string }[];
    invoices: Omit<Invoice, 'items'>[];
    invoice_items: InvoiceItem[];
    documents: CaseDocument[]; // Changed from case_documents
    profiles: Profile[];
    site_finances: SiteFinancialEntry[];
};

export const isNetworkError = (err: any): boolean => {
    if (!err) return false;
    
    let combined = '';
    try {
        if (typeof err === 'string') {
            combined = err.toLowerCase();
        } else if (err instanceof Error) {
            combined = `${err.name} ${err.message}`.toLowerCase();
        } else {
            combined = JSON.stringify(err, Object.getOwnPropertyNames(err)).toLowerCase();
        }
    } catch {
        combined = String(err).toLowerCase();
    }

    const networkPatterns = [
        'failed to fetch',
        'network error',
        'connection',
        'aborted',
        'load failed',
        'dns',
        'timeout',
        'socket',
        'offline',
        'status 0',
        'net::err',
        'request failed',
        'cors',
        'preflight',
    ];

    const isMatch = networkPatterns.some(pattern => combined.includes(pattern)) || 
           err instanceof TypeError || 
           String(err.status) === '0' ||
           String(err.code) === 'ECONNREFUSED';

    if (isMatch) {
        console.warn('Network error detected:', combined);
    }
    
    return isMatch;
};

export const getFriendlyErrorMessage = (err: any, defaultMessage: string = 'حدث خطأ غير متوقع.'): string => {
    if (isNetworkError(err)) {
        return 'تعذر الاتصال بخادم قاعدة البيانات. يرجى التحقق من اتصال الإنترنت أو المحاولة مرة أخرى لاحقاً.';
    }
    
    // Handle specific Supabase errors if possible
    if (err?.code === 'PGRST301' || (typeof err === 'string' && err.includes('PGRST301'))) 
        return 'انتهت صلاحية الجلسة، يرجى إعادة تسجيل الدخول.';
    if (err?.code === '42P01') return 'قاعدة البيانات بحاجة إلى إعداد (Table not found). يرجى تشغيل سكربت SQL.';
    
    return err?.message || (typeof err === 'string' ? err : defaultMessage);
};

export const fetchWithRetry = async <T>(fn: () => Promise<T>, retries = 3, delay = 1000): Promise<T> => {
    const timeout = (ms: number) => new Promise((_, reject) => setTimeout(() => reject(new Error('TIMEOUT')), ms));
    
    try {
        // Increased initial timeout to 45s for better handling of large tables
        const currentTimeout = retries === 3 ? 45000 : 75000;
        const result = await Promise.race([fn(), timeout(currentTimeout)]) as T;
        
        if (result && typeof result === 'object' && (result as any).error) {
            const err = (result as any).error;
            if (isNetworkError(err)) {
                if (retries > 0) {
                    await new Promise(resolve => setTimeout(resolve, delay));
                    return fetchWithRetry<T>(fn, retries - 1, delay * 1.5);
                }
            }
            throw err;
        }
        return result;
    } catch (err: any) {
        const isTimeout = err.message === 'TIMEOUT';
        if (retries > 0 && (isNetworkError(err) || isTimeout)) {
            console.warn(`Retrying fetch (${retries} left) due to: ${err.message || err}`);
            await new Promise(resolve => setTimeout(resolve, delay));
            return fetchWithRetry<T>(fn, retries - 1, delay * 2);
        }
        
        // Log diagnostic info for "Failed to fetch"
        if (String(err).includes('fetch')) {
            console.error("CRITICAL: Supabase Fetch Failed. Possible reasons: CORS, Network Block, or Paused Project.");
        }
        
        throw err;
    }
};

export const checkSupabaseSchema = async () => {
    const supabase = await getSupabaseClient();
    if (!supabase) return { success: false, message: 'Supabase غير مهيأ.' };
    try {
        const { error }: any = await supabase.from('profiles').select('id', { head: true });
        if (error) {
            if (isNetworkError(error)) throw error;
            
            // 42P01 is the Postgres error code for "undefined_table"
            // PGRST116 is often returned by PostgREST when a resource is not found or table missing
            const isTableMissing = error.code === '42P01' || error.code === 'PGRST116' || String(error.status) === '404';
            
            if (isTableMissing) {
                return { success: false, message: 'قاعدة البيانات بحاجة إلى إعداد (Script).' };
            }
            
            // If it's another error (like 403), it might be RLS or something else, 
            // but we shouldn't necessarily prompt for a full script setup if the table exists.
            console.error("Schema check failed with non-network error:", error);
            return { success: true, message: '' }; // Assume schema is okay but access is restricted
        }
        return { success: true, message: '' };
    } catch (err: any) {
        return { success: false, message: isNetworkError(err) ? 'تعذر الاتصال بالخادم. يرجى التحقق من اتصال الإنترنت.' : 'قاعدة البيانات غير مستجيبة.' };
    }
};

export const fetchDataFromSupabase = async (ownerId: string): Promise<Partial<FlatData>> => {
    const supabase = await getSupabaseClient();
    if (!supabase) throw new Error('Supabase client not available.');

    const tables = [
        'profiles', 'clients', 'cases', 'stages', 'sessions',
        'admin_tasks', 'appointments', 'accounting_entries', 
        'assistants', 'invoices', 'invoice_items', 'documents', 'site_finances'
    ];

    const data: any = {};
    
    // Fetch in smaller batches to avoid overwhelming the connection and causing timeouts
    const batchSize = 3;
    for (let i = 0; i < tables.length; i += batchSize) {
        const batch = tables.slice(i, i + batchSize);
        const batchPromises = batch.map(async (table) => {
            try {
                const fetchFn = async () => {
                    let query = supabase.from(table).select('*');
                    
                    if (table === 'profiles') {
                        query = query.or(`id.eq.${ownerId},lawyer_id.eq.${ownerId}`);
                    } else {
                        query = query.eq('user_id', ownerId);
                    }
                    return query;
                };

                const { data: tableData, error } = await fetchWithRetry(fetchFn);
                if (error) {
                    if (['profiles', 'clients', 'cases'].includes(table)) throw error;
                    console.warn(`Non-critical table fetch failed: ${table}`, error);
                    return [];
                }
                return tableData || [];
            } catch (e) {
                if (['profiles', 'clients', 'cases'].includes(table)) throw e;
                return [];
            }
        });

        const results = await Promise.all(batchPromises);
        batch.forEach((t, j) => {
            data[t] = results[j];
        });
    }
    
    return data;
};

export const fetchDeletionsFromSupabase = async (): Promise<SyncDeletion[]> => {
    const supabase = await getSupabaseClient();
    if (!supabase) return [];
    try {
        const { data, error }: any = await fetchWithRetry(async () => await supabase!
            .from('sync_deletions')
            .select('*')
            .gte('deleted_at', new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()));
        if (error) return []; // Non-critical
        return data || [];
    } catch { return []; }
};

export const upsertDataToSupabase = async (data: Partial<FlatData>, realUser: User, ownerId: string) => {
    const supabase = await getSupabaseClient();
    if (!supabase) throw new Error('Supabase client not available.');

    const entries = Object.entries(data).filter(([_, items]) => items && items.length > 0);
    if (entries.length === 0) return;

    console.log(`Starting upsert for ${entries.length} tables:`, entries.map(([t]) => t));

    // Batch upserts to avoid hitting browser concurrent request limits
    const batchSize = 5; 
    for (let i = 0; i < entries.length; i += batchSize) {
        const batch = entries.slice(i, i + batchSize);
        console.log(`Upserting batch ${i / batchSize + 1} of ${Math.ceil(entries.length / batchSize)}:`, batch.map(([t]) => t));
        await Promise.all(batch.map(async ([table, items]) => {
            const formatted = items!.map(item => {
                const newItem: any = {};
                
                // Generic camelCase to snake_case conversion for all keys
                Object.keys(item).forEach(key => {
                    if (key === 'user_id' || key === 'updated_at') {
                        newItem[key] = (item as any)[key];
                        return;
                    }
                    // Convert camelCase to snake_case: decisionDate -> decision_date
                    const snakeKey = key.replace(/([A-Z])/g, "_$1").toLowerCase();
                    newItem[snakeKey] = (item as any)[key];
                    if (table === 'admin_tasks') {
                        console.log(`[Sync Debug] Mapping: ${key} -> ${snakeKey} =`, (item as any)[key]);
                    }
                });

                // Ensure user_id and updated_at are correct
                if (table !== 'profiles') {
                    newItem.user_id = ownerId;
                }
                
                if (newItem.updated_at) {
                    newItem.updated_at = new Date(newItem.updated_at).toISOString();
                } else {
                    newItem.updated_at = new Date().toISOString();
                }

                // Convert any Date objects to ISO strings
                Object.keys(newItem).forEach(key => {
                    if (newItem[key] instanceof Date) {
                        newItem[key] = newItem[key].toISOString();
                    }
                });

                return newItem;
            });
            
            try {
                console.log(`Upserting ${formatted.length} items to ${table}:`, formatted);
                if (table === 'admin_tasks') {
                    console.log(`[Sync Debug] Admin Tasks Data:`, formatted);
                }
                const result: any = await fetchWithRetry(async () => {
                    // For assistants table, we use (user_id, name) as conflict target because local state doesn't track IDs
                    const onConflict = table === 'assistants' ? 'user_id,name' : 'id';
                    return await supabase.from(table).upsert(formatted, { onConflict });
                });

                console.log(`Supabase upsert result for ${table}:`, result);

                if (result.error) {
                    const error = result.error;
                    console.error(`Upsert failed for table ${table}:`, error);
                    const isAuthError = error.code === '42501' || error.status === 403;
                    if (isAuthError) {
                        throw new Error(`صلاحيات غير كافية للجدول ${table}. يرجى التحقق من إعدادات RLS.`);
                    }
                    throw new Error(`فشل رفع البيانات لجدول ${table}: ${error.message || error.code}`);
                }
                console.log(`Successfully upserted ${formatted.length} items to ${table}`);
            } catch (err: any) {
                console.error(`Critical failure in upsert for ${table}:`, err);
                throw err;
            }
        }));
    }
};

export const deleteDataFromSupabase = async (deletions: Partial<FlatData>, user: User) => {
    const supabase = await getSupabaseClient();
    if (!supabase) throw new Error('Supabase client not available.');
    
    for (const [table, items] of Object.entries(deletions)) {
        if (items && items.length > 0) {
            const ids = (items as any[]).map(i => i.id || i.name);
            console.log(`Deleting ${ids.length} items from ${table}...`);
            
            const result: any = await fetchWithRetry(async () => 
                await supabase.from(table).delete().in(table === 'assistants' ? 'name' : 'id', ids)
            );

            if (result.error) {
                console.error(`Delete failed for table ${table}:`, result.error);
                const isAuthError = result.error.code === '42501' || result.error.status === 403;
                if (isAuthError) {
                    throw new Error(`صلاحيات غير كافية لحذف البيانات من جدول ${table}.`);
                }
                throw new Error(`فشل حذف البيانات من جدول ${table}: ${result.error.message}`);
            }
            console.log(`Successfully deleted items from ${table}`);
        }
    }
};

export const transformRemoteToLocal = (remote: any): Partial<FlatData> => {
    if (!remote) return {};
    const local: any = {};
    
    Object.keys(remote).forEach(key => {
        if (Array.isArray(remote[key])) {
            local[key] = remote[key].map((r: any) => {
                const transformed: any = {};
                
                // Generic snake_case to camelCase conversion
                Object.keys(r).forEach(snakeKey => {
                    if (snakeKey === 'user_id' || snakeKey === 'updated_at') {
                        transformed[snakeKey] = r[snakeKey];
                        return;
                    }
                    // Convert snake_case to camelCase: decision_date -> decisionDate
                    const camelKey = snakeKey.replace(/(_[a-z])/g, (group) => 
                        group.toUpperCase().replace('_', '')
                    );
                    transformed[camelKey] = r[snakeKey];
                });

                if (transformed.updated_at) {
                    transformed.updated_at = new Date(transformed.updated_at);
                }
                
                // Convert ISO strings back to Date objects where expected locally
                const dateFields = ['date', 'firstSessionDate', 'decisionDate', 'issueDate', 'dueDate', 'addedAt', 'nextSessionDate', 'stageDecisionDate'];
                dateFields.forEach(field => {
                    if (transformed[field] && typeof transformed[field] === 'string') {
                        transformed[field] = new Date(transformed[field]);
                    }
                });

                return transformed;
            });
        }
    });
    return local;
};
