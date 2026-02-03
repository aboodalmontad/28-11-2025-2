import { getSupabaseClient } from '../supabaseClient';
import { Client, AdminTask, Appointment, AccountingEntry, Invoice, InvoiceItem, CaseDocument, Profile, SiteFinancialEntry, SyncDeletion } from '../types';
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

/**
 * Robust wrapper for Supabase queries with retries and proper timeout management.
 */
export async function safeQuery<T>(queryFn: () => Promise<{ data: T | null; error: any }>, retries = 3): Promise<T | null> {
    let lastError: any;
    const REQUEST_TIMEOUT = 60000; // Increased to 60 seconds for potentially larger files or slow mobile networks

    for (let i = 0; i <= retries; i++) {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT);

        try {
            const result = await Promise.race([
                queryFn(),
                new Promise<never>((_, reject) => 
                    setTimeout(() => reject(new Error('TIMEOUT_EXCEEDED')), REQUEST_TIMEOUT)
                )
            ]);

            clearTimeout(timeoutId);

            const { data, error } = result as { data: T | null; error: any };
            
            if (error) {
                // Supabase error objects often have 'message' or 'error_description'
                const errorStr = (error.message || error.error_description || JSON.stringify(error) || '').toLowerCase();
                const status = error.status || 0;
                
                const isTransient = errorStr.includes('failed to fetch') || 
                                   errorStr.includes('network') || 
                                   errorStr.includes('abort') || 
                                   errorStr.includes('load failed') ||
                                   errorStr.includes('timeout') ||
                                   errorStr.includes('connection') ||
                                   status === 429 || // Rate limit
                                   status === 0 ||   // Browser generic network error (CORS or offline)
                                   [502, 503, 504].includes(status);
                
                if (isTransient && i < retries) {
                    const delay = 2000 * Math.pow(2, i); 
                    await new Promise(r => setTimeout(r, delay));
                    continue;
                }
                throw error;
            }
            return data;
        } catch (err: any) {
            clearTimeout(timeoutId);
            lastError = err;
            
            const errStr = (err instanceof Error ? err.message : (err?.message || String(err))).toLowerCase();
            const isTransient = errStr.includes('failed to fetch') || 
                                   errStr.includes('network') || 
                                   errStr.includes('timeout') ||
                                   errStr.includes('abort') ||
                                   err?.name === 'AbortError' ||
                                   err?.message === 'TIMEOUT_EXCEEDED' ||
                                   err?.status === 0;
            
            if (isTransient && i < retries) {
                await new Promise(r => setTimeout(r, 2000 * Math.pow(2, i)));
                continue;
            }
            throw err;
        }
    }
    throw lastError;
}

export const checkSupabaseSchema = async () => {
    const supabase = getSupabaseClient();
    if (!supabase) {
        return { success: false, error: 'unconfigured', message: 'عميل Supabase غير مهيأ.' };
    }

    const criticalTables: { [key: string]: string } = {
        'profiles': 'id', 
        'clients': 'id', 
        'assistants': 'name'
    };
    
    try {
        for (const [table, query] of Object.entries(criticalTables)) {
            await safeQuery(() => supabase.from(table).select(query, { head: true }).limit(1));
        }
        return { success: true, error: null, message: '' };
    } catch (err: any) {
        const message = String(err.message || '').toLowerCase();
        const code = String(err.code || '');
        if (code === '42P01' || message.includes('does not exist')) {
            return { success: false, error: 'uninitialized', message: 'جداول قاعدة البيانات غير موجودة. يرجى التثبيت.' };
        }
        return { success: false, error: 'network', message: 'فشل الاتصال: يرجى التحقق من جودة الإنترنت.' };
    }
};

export const fetchDataFromSupabase = async (): Promise<Partial<FlatData>> => {
    const supabase = getSupabaseClient();
    if (!supabase) throw new Error('Supabase client not available.');

    const fetchTable = (table: string, select = '*') => 
        safeQuery<any[]>(() => supabase.from(table).select(select) as any);

    const profiles = await fetchTable('profiles') || [];
    const assistants = await fetchTable('assistants', 'name') || [];
    const clients = await fetchTable('clients') || [];
    const cases = await fetchTable('cases') || [];
    const stages = await fetchTable('stages') || [];
    const sessions = await fetchTable('sessions') || [];
    const invoices = await fetchTable('invoices') || [];
    const invoice_items = await fetchTable('invoice_items') || [];
    const accounting_entries = await fetchTable('accounting_entries') || [];
    const admin_tasks = await fetchTable('admin_tasks') || [];
    const appointments = await fetchTable('appointments') || [];
    const case_documents = await fetchTable('case_documents') || [];
    const site_finances = await fetchTable('site_finances') || [];

    // Fix: Removed duplicate 'clients' property from the return object to resolve the error "An object literal cannot have multiple properties with the same name."
    return {
        clients, admin_tasks, appointments, accounting_entries,
        assistants, invoices, cases, stages, sessions, invoice_items,
        case_documents, profiles, site_finances
    };
};

export const fetchDeletionsFromSupabase = async (): Promise<SyncDeletion[]> => {
    const supabase = getSupabaseClient();
    if (!supabase) return [];
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();

    try {
        const data = await safeQuery<SyncDeletion[]>(() => 
            supabase!.from('sync_deletions').select('*').gte('deleted_at', thirtyDaysAgo) as any
        );
        return data || [];
    } catch (err) {
        return []; 
    }
};

export const deleteDataFromSupabase = async (deletions: Partial<FlatData>, user: User) => {
    const supabase = getSupabaseClient();
    if (!supabase) throw new Error('Supabase client not available.');

    const deletionOrder: (keyof FlatData)[] = [
        'case_documents', 'invoice_items', 'sessions', 'stages', 'cases', 'invoices', 
        'admin_tasks', 'appointments', 'accounting_entries', 'assistants', 'clients',
        'site_finances',
    ];

    for (const table of deletionOrder) {
        const items = (deletions as any)[table];
        if (items?.length) {
            const pk = table === 'assistants' ? 'name' : 'id';
            const ids = items.map((i: any) => i[pk]);
            
            const logs = ids.map((id: string) => ({ table_name: table, record_id: id, user_id: user.id }));
            await safeQuery(() => supabase.from('sync_deletions').insert(logs));
            await safeQuery(() => supabase.from(table).delete().in(pk, ids));
        }
    }
};

export const upsertDataToSupabase = async (data: Partial<FlatData>, user: User) => {
    const supabase = getSupabaseClient();
    if (!supabase) throw new Error('Supabase client not available.');
    const uid = user.id;

    const mapItem = (table: keyof FlatData, items: any[] | undefined) => {
        if (!items) return undefined;
        switch (table) {
            case 'clients': return items.map(({ contactInfo, ...r }) => ({ ...r, user_id: uid, contact_info: contactInfo }));
            case 'cases': return items.map(({ clientName, opponentName, feeAgreement, ...r }) => ({ ...r, user_id: uid, client_name: clientName, opponent_name: opponentName, fee_agreement: feeAgreement }));
            case 'stages': return items.map(({ caseNumber, firstSessionDate, decisionDate, decisionNumber, decisionSummary, decisionNotes, ...r }) => ({ ...r, user_id: uid, case_number: caseNumber, first_session_date: firstSessionDate, decision_date: decisionDate, decision_number: decisionNumber, decision_summary: decisionSummary, decision_notes: decisionNotes }));
            case 'sessions': return items.map((s: any) => ({ ...s, user_id: uid, case_number: s.caseNumber, client_name: s.clientName, opponent_name: s.opponentName, postponement_reason: s.postponementReason, next_postponement_reason: s.nextPostponementReason, next_session_date: s.nextSessionDate }));
            case 'admin_tasks': return items.map(({ dueDate, orderIndex, ...r }) => ({ ...r, user_id: uid, due_date: dueDate, order_index: orderIndex }));
            case 'appointments': return items.map(({ reminderTimeInMinutes, ...r }) => ({ ...r, user_id: uid, reminder_time_in_minutes: reminderTimeInMinutes }));
            case 'accounting_entries': return items.map(({ clientId, caseId, clientName, ...r }) => ({ ...r, user_id: uid, client_id: clientId, case_id: caseId, client_name: clientName }));
            case 'invoices': return items.map(({ clientId, clientName, caseId, caseSubject, issueDate, dueDate, taxRate, ...r }) => ({ ...r, user_id: uid, client_id: clientId, client_name: clientName, case_id: caseId, case_subject: caseSubject, issue_date: issueDate, due_date: dueDate, tax_rate: taxRate }));
            case 'case_documents': return items.map(({ caseId, userId, addedAt, storagePath, localState, ...r }) => ({ ...r, user_id: uid, case_id: caseId, added_at: addedAt, storage_path: storagePath }));
            // CRITICAL FIX: Profiles table does not have a user_id column (it uses 'id' as PK linked to auth.users)
            case 'profiles': return items;
            case 'site_finances': return items.map(i => ({ user_id: uid, ...i }));
            default: return items.map(i => ({ ...i, user_id: uid }));
        }
    };

    const upsertTable = async (table: string, records: any[] | undefined, options: { onConflict?: string } = {}) => {
        if (!records?.length) return [];
        const res = await safeQuery(() => supabase.from(table).upsert(records, options).select() as any);
        return res || [];
    };

    const results: any = {};
    const tables: { key: keyof FlatData, table: string, options?: any }[] = [
        { key: 'profiles', table: 'profiles' },
        { key: 'assistants', table: 'assistants', options: { onConflict: 'user_id,name' } },
        { key: 'clients', table: 'clients' },
        { key: 'cases', table: 'cases' },
        { key: 'stages', table: 'stages' },
        { key: 'sessions', table: 'sessions' },
        { key: 'invoices', table: 'invoices' },
        { key: 'invoice_items', table: 'invoice_items' },
        { key: 'case_documents', table: 'case_documents' },
        { key: 'admin_tasks', table: 'admin_tasks' },
        { key: 'appointments', table: 'appointments' },
        { key: 'accounting_entries', table: 'accounting_entries' },
        { key: 'site_finances', table: 'site_finances' },
    ];

    for (const { key, table, options } of tables) {
        results[key] = await upsertTable(table, mapItem(key, data[key]), options);
    }
    
    return results;
};

export const transformRemoteToLocal = (remote: any): Partial<FlatData> => {
    if (!remote) return {};
    const map = (arr: any[] | undefined | null, fn: (item: any) => any): any[] => (arr ? arr.map(fn) : []);
    return {
        clients: map(remote.clients, ({ contact_info, ...r }: any) => ({ ...r, contactInfo: contact_info })),
        cases: map(remote.cases, ({ client_name, opponent_name, fee_agreement, ...r }: any) => ({ ...r, clientName: client_name, opponentName: opponent_name, feeAgreement: fee_agreement })),
        stages: map(remote.stages, ({ case_number, first_session_date, decision_date, decision_number, decision_summary, decision_notes, ...r }: any) => ({ ...r, caseNumber: case_number, firstSessionDate: first_session_date, decisionDate: decision_date, decisionNumber: decision_number, decisionSummary: decision_summary, decisionNotes: decision_notes })),
        sessions: map(remote.sessions, ({ case_number, client_name, opponent_name, postponement_reason, next_postponement_reason, is_postponed, next_session_date, ...r }: any) => ({ ...r, caseNumber: case_number, clientName: client_name, opponentName: opponent_name, postponementReason: postponement_reason, nextPostponementReason: next_postponement_reason, is_postponed: is_postponed, nextSessionDate: next_session_date })),
        admin_tasks: map(remote.admin_tasks, ({ due_date, order_index, ...r }: any) => ({ ...r, dueDate: due_date, orderIndex: order_index })),
        appointments: map(remote.appointments, ({ reminder_time_in_minutes, ...r }: any) => ({ ...r, reminderTimeInMinutes: reminder_time_in_minutes })),
        accounting_entries: map(remote.accounting_entries, ({ client_id, case_id, client_name, ...r }: any) => ({ ...r, clientId: client_id, caseId: case_id, clientName: client_name })),
        assistants: (remote.assistants || []) as any,
        invoices: map(remote.invoices, ({ client_id, client_name, case_id, case_subject, issue_date, due_date, tax_rate, ...r }: any) => ({ ...r, clientId: client_id, clientName: client_name, caseId: case_id, caseSubject: case_subject, issueDate: issue_date, dueDate: due_date, taxRate: tax_rate })),
        invoice_items: (remote.invoice_items || []) as any,
        case_documents: map(remote.case_documents, ({ user_id, case_id, added_at, storage_path, ...r }: any) => ({...r, userId: user_id, caseId: case_id, addedAt: added_at, storagePath: storage_path })),
        profiles: map(remote.profiles, ({ full_name, mobile_number, is_approved, is_active, subscription_start_date, subscription_end_date, lawyer_id, permissions, ...r }: any) => ({ ...r, full_name, mobile_number, is_approved, is_active, subscription_start_date, subscription_end_date, lawyer_id, permissions })),
        site_finances: (remote.site_finances || []) as any,
    };
};
