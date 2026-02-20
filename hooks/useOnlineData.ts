
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
    const combined = `${err.message || ''} ${err.error_description || ''} ${err.code || ''} ${err.status || ''} ${String(err)}`.toLowerCase();
    return (
        combined.includes('failed to fetch') || 
        combined.includes('network error') ||
        combined.includes('connection') ||
        combined.includes('aborted') ||
        combined.includes('load failed') || // Safari specific
        err instanceof TypeError || 
        String(err.status) === '0' ||
        String(err.code) === 'PGRST301' // Supabase timeout/JWT issues can sometimes manifest as fetch errors
    );
};

export const getFriendlyErrorMessage = (err: any, defaultMessage: string = 'حدث خطأ غير متوقع.'): string => {
    if (isNetworkError(err)) {
        return 'تعذر الاتصال بالخادم. يرجى التحقق من اتصال الإنترنت.';
    }
    return err?.message || defaultMessage;
};

export const fetchWithRetry = async <T>(fn: () => Promise<T>, retries = 3, delay = 1000): Promise<T> => {
    try {
        const result = await fn();
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
        if (retries > 0 && isNetworkError(err)) {
            await new Promise(resolve => setTimeout(resolve, delay));
            return fetchWithRetry<T>(fn, retries - 1, delay * 1.5);
        }
        throw err;
    }
};

export const checkSupabaseSchema = async () => {
    const supabase = getSupabaseClient();
    if (!supabase) return { success: false, message: 'Supabase غير مهيأ.' };
    try {
        const { error } = await supabase.from('profiles').select('id', { head: true });
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

export const fetchDataFromSupabase = async (): Promise<Partial<FlatData>> => {
    const supabase = getSupabaseClient();
    if (!supabase) throw new Error('Supabase client not available.');

    const tables = [
        'clients', 'admin_tasks', 'appointments', 'accounting_entries', 
        'assistants', 'invoices', 'cases', 'stages', 'sessions', 
        'invoice_items', 'case_documents', 'profiles', 'site_finances'
    ];

    const data: any = {};
    
    // We execute fetches in parallel but catch errors individually so one failing table doesn't block the app
    const fetchPromises = tables.map(async (table) => {
        try {
            const { data: tableData, error } = await supabase.from(table).select('*');
            if (error) {
                // Critical tables should throw, non-critical can just return empty
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

    const results = await Promise.all(fetchPromises);
    tables.forEach((t, i) => {
        data[t] = results[i];
    });
    
    return data;
};

export const fetchDeletionsFromSupabase = async (): Promise<SyncDeletion[]> => {
    const supabase = getSupabaseClient();
    if (!supabase) return [];
    try {
        const { data, error } = await supabase
            .from('sync_deletions')
            .select('*')
            .gte('deleted_at', new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString());
        if (error) return []; // Non-critical
        return data || [];
    } catch { return []; }
};

export const upsertDataToSupabase = async (data: Partial<FlatData>, realUser: User, ownerId: string) => {
    const supabase = getSupabaseClient();
    if (!supabase) throw new Error('Supabase client not available.');

    const promises = Object.entries(data).map(([table, items]) => {
        if (!items || items.length === 0) return Promise.resolve();
        
        const formatted = items.map(item => ({ 
            ...item, 
            user_id: ownerId, 
            updated_at: item.updated_at ? new Date(item.updated_at).toISOString() : new Date().toISOString() 
        }));
        
        return supabase.from(table).upsert(formatted);
    });

    const results = await Promise.all(promises);
    const firstError = results.find(r => r?.error)?.error;
    if (firstError && isNetworkError(firstError)) throw firstError;
};

export const deleteDataFromSupabase = async (deletions: Partial<FlatData>, user: User) => {
    const supabase = getSupabaseClient();
    if (!supabase) throw new Error('Supabase client not available.');
    
    for (const [table, items] of Object.entries(deletions)) {
        if (items && items.length > 0) {
            const ids = (items as any[]).map(i => i.id || i.name);
            const { error } = await supabase.from(table).delete().in(table === 'assistants' ? 'name' : 'id', ids);
            if (error && isNetworkError(error)) throw error;
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
                if (r.updated_at) transformed.updated_at = new Date(r.updated_at);
                return transformed;
            });
        }
    });
    return local;
};
