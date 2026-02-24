
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
    case_documents: CaseDocument[];
    profiles: Profile[];
    site_finances: SiteFinancialEntry[];
};

export const isNetworkError = (err: any): boolean => {
    if (!err) return false;
    
    // Convert error to string representation for broad matching
    let combined = '';
    if (typeof err === 'string') {
        combined = err.toLowerCase();
    } else if (err instanceof Error) {
        combined = `${err.name} ${err.message}`.toLowerCase();
    } else {
        try {
            combined = JSON.stringify(err).toLowerCase();
        } catch {
            combined = String(err).toLowerCase();
        }
    }

    const networkPatterns = [
        'failed to fetch',
        'network error',
        'connection',
        'aborted',
        'load failed',
        'pgrst301', // JWT expired (often results in network-like failure)
        '401', '403', '502', '503', '504',
        'dns',
        'timeout',
        'cors',
        'preflight',
        'socket',
        'offline',
        'status 0',
        'status: 0',
        'typeerror', // fetch() throws TypeError on network failure
    ];

    return networkPatterns.some(pattern => combined.includes(pattern)) || 
           err instanceof TypeError || 
           String(err.status) === '0';
};

export const getFriendlyErrorMessage = (err: any, defaultMessage: string = 'حدث خطأ غير متوقع.'): string => {
    if (isNetworkError(err)) {
        return 'تعذر الاتصال بالخادم. يرجى التحقق من اتصال الإنترنت.';
    }
    return err?.message || defaultMessage;
};

export const fetchWithRetry = async <T>(fn: () => Promise<T>, retries = 5, delay = 1000): Promise<T> => {
    const timeout = (ms: number) => new Promise((_, reject) => setTimeout(() => reject(new Error('TIMEOUT')), ms));
    
    try {
        // Increase timeout to 150 seconds for slower connections
        const result = await Promise.race([fn(), timeout(150000)]) as T;
        
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
            await new Promise(resolve => setTimeout(resolve, delay));
            return fetchWithRetry<T>(fn, retries - 1, delay * 1.5);
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
            // If it's a "table doesn't exist" or similar error, the schema needs setup
            return { success: false, message: 'قاعدة البيانات بحاجة إلى إعداد (Script).' };
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
        'assistants', 'invoices', 'invoice_items', 'case_documents', 'site_finances'
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
                    if (['profiles', 'clients', 'cases', 'admin_tasks'].includes(table)) throw error;
                    console.warn(`Non-critical table fetch failed: ${table}`, error);
                    return [];
                }
                return tableData || [];
            } catch (e) {
                if (['profiles', 'clients', 'cases', 'admin_tasks'].includes(table)) throw e;
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

    const results = await Promise.allSettled(Object.entries(data).map(async ([table, items]) => {
        if (!items || items.length === 0) return;
        
        const formatted = items.map(item => {
            const { feeAgreement, ...rest } = item as any;
            const newItem: any = {
                ...rest,
                updated_at: item.updated_at ? new Date(item.updated_at).toISOString() : new Date().toISOString(),
            };

            if (table !== 'profiles') {
                newItem.user_id = ownerId;
            }

            if (feeAgreement !== undefined) {
                newItem.fee_agreement = feeAgreement;
            }
            delete newItem.feeAgreement; // Ensure camelCase version is removed
            return newItem;
        });
        
        const { error }: any = await fetchWithRetry(async () => await supabase.from(table).upsert(formatted));
        if (error) {
            console.error(`Upsert failed for table ${table}:`, error);
            if (['profiles', 'clients', 'cases', 'admin_tasks'].includes(table)) throw error;
        }
    }));

    const failures = results.filter(r => r.status === 'rejected');
    if (failures.length > 0) {
        // If any critical table failed, the promise would have rejected and we'd be in the catch block
        // If we are here, it means only non-critical tables might have failed
        console.warn(`${failures.length} non-critical tables failed to upsert.`);
    }
};

export const deleteDataFromSupabase = async (deletions: Partial<FlatData>, user: User) => {
    const supabase = await getSupabaseClient();
    if (!supabase) throw new Error('Supabase client not available.');
    
    for (const [table, items] of Object.entries(deletions)) {
        if (items && items.length > 0) {
            const ids = (items as any[]).map(i => i.id || i.name);
            await fetchWithRetry(async () => await supabase.from(table).delete().in(table === 'assistants' ? 'name' : 'id', ids));
        }
    }
};

export const transformRemoteToLocal = (remote: any): Partial<FlatData> => {
    if (!remote) return {};
    const local: any = {};
    Object.keys(remote).forEach(key => {
        if (Array.isArray(remote[key])) {
            local[key] = remote[key].map((r: any) => {
                const transformed = { ...r };
                if (r.client_id) transformed.clientId = r.client_id;
                if (r.case_id) transformed.caseId = r.case_id;
                if (r.fee_agreement) transformed.feeAgreement = r.fee_agreement;
                if (r.updated_at) transformed.updated_at = new Date(r.updated_at);
                return transformed;
            });
        }
    });
    return local;
};
