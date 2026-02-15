
import { getSupabaseClient } from '../supabaseClient';
import { Client, AdminTask, Appointment, AccountingEntry, Invoice, InvoiceItem, CaseDocument, Profile, SiteFinancialEntry, SyncDeletion } from '../types';
// Fix: Use `import type` for User as it is used as a type, not a value. This resolves module resolution errors in some environments.
import type { User } from '@supabase/supabase-js';

// This file defines the shape of data when flattened for sync operations.
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

// Helper to ensure dates are strings for Supabase
const toDateString = (date: any): string | null => {
    if (!date) return null;
    if (typeof date === 'string') return date;
    if (date instanceof Date) return date.toISOString();
    return null;
};

/**
 * Checks if all required tables exist in the Supabase database schema.
 */
export const checkSupabaseSchema = async () => {
    const supabase = getSupabaseClient();
    if (!supabase) {
        return { success: false, error: 'unconfigured', message: 'تكوين Supabase غير مكتمل.' };
    }

    const tableChecks: { [key: string]: string } = {
        'profiles': 'id', 'clients': 'id', 'cases': 'id',
        'stages': 'id', 'sessions': 'id', 'admin_tasks': 'id',
        'appointments': 'id', 'accounting_entries': 'id', 'assistants': 'name',
        'invoices': 'id', 'invoice_items': 'id', 'case_documents': 'id',
        'site_finances': 'id',
        'sync_deletions': 'id', 
    };
    
    const tableCheckPromises = Object.entries(tableChecks).map(([table, query]) =>
        supabase.from(table).select(query, { head: true, count: 'exact' }).limit(0).then(res => ({ ...res, table }))
    );

    try {
        const results = await Promise.all(tableCheckPromises);
        for (const result of results) {
            if (result.error) {
                const message = String(result.error.message || '').toLowerCase();
                const code = String(result.error.code || '');
                
                // Detection for Auth Errors
                if (code === 'PGRST301' || result.error.status === 401 || message.includes('invalid refresh token') || message.includes('refresh token not found')) {
                    return { success: false, error: 'auth_error', message: 'انتهت صلاحية الجلسة، يرجى تسجيل الدخول مرة أخرى.' };
                }

                // 42P01 is "relation does not exist"
                if (code === '42P01' || message.includes('does not exist') || message.includes('could not find the table')) {
                    return { success: false, error: 'uninitialized', message: `قاعدة البيانات غير مهيأة. الجدول مفقود: ${result.table}.` };
                } else if (code === 'PGRST116' || code === '42501') {
                    // Success but empty or restricted access which is fine for existence check
                    continue;
                } else {
                    console.warn(`Non-critical schema check error on ${result.table}:`, result.error);
                }
            }
        }
        return { success: true, error: null, message: '' };
    } catch (err: any) {
        const message = String(err?.message || '').toLowerCase();
        const code = String(err?.code || '');

        if (message.includes('refresh token') || message.includes('not found') || err?.status === 401) {
            return { success: false, error: 'auth_error', message: 'انتهت صلاحية الجلسة.' };
        }

        if (message.includes('failed to fetch')) {
            return { success: false, error: 'network', message: 'فشل الاتصال بالخادم. يرجى التحقق من الإنترنت.' };
        }
        
        return { success: false, error: 'unknown', message: `خطأ في فحص المخطط: ${err.message}` };
    }
};


/**
 * Fetches the entire dataset for the current user from Supabase.
 */
export const fetchDataFromSupabase = async (): Promise<Partial<FlatData>> => {
    const supabase = getSupabaseClient();
    if (!supabase) throw new Error('Supabase client not available.');

    const [
        clientsRes, adminTasksRes, appointmentsRes, accountingEntriesRes,
        assistantsRes, invoicesRes, casesRes, stagesRes, sessionsRes, invoiceItemsRes,
        caseDocumentsRes, profilesRes, siteFinancesRes
    ] = await Promise.all([
        supabase.from('clients').select('*'),
        supabase.from('admin_tasks').select('*'),
        supabase.from('appointments').select('*'),
        supabase.from('accounting_entries').select('*'),
        supabase.from('assistants').select('name'),
        supabase.from('invoices').select('*'),
        supabase.from('cases').select('*'),
        supabase.from('stages').select('*'),
        supabase.from('sessions').select('*'),
        supabase.from('invoice_items').select('*'),
        supabase.from('case_documents').select('*'),
        supabase.from('profiles').select('*'),
        supabase.from('site_finances').select('*'),
    ]);

    const results = [
        { res: clientsRes, name: 'clients' },
        { res: adminTasksRes, name: 'admin_tasks' },
        { res: appointmentsRes, name: 'appointments' },
        { res: accountingEntriesRes, name: 'accounting_entries' },
        { res: assistantsRes, name: 'assistants' },
        { res: invoicesRes, name: 'invoices' },
        { res: casesRes, name: 'cases' },
        { res: stagesRes, name: 'stages' },
        { res: sessionsRes, name: 'sessions' },
        { res: invoiceItemsRes, name: 'invoice_items' },
        { res: caseDocumentsRes, name: 'case_documents' },
        { res: profilesRes, name: 'profiles' },
        { res: siteFinancesRes, name: 'site_finances' },
    ];

    for (const { res, name } of results) {
        if (res.error) {
            throw new Error(`فشل جلب ${name}: ${res.error.message}`);
        }
    }

    return {
        clients: clientsRes.data || [],
        cases: casesRes.data || [],
        stages: stagesRes.data || [],
        sessions: sessionsRes.data || [],
        admin_tasks: adminTasksRes.data || [],
        appointments: appointmentsRes.data || [],
        accounting_entries: accountingEntriesRes.data || [],
        assistants: assistantsRes.data || [],
        invoices: invoicesRes.data || [],
        invoice_items: invoiceItemsRes.data || [],
        case_documents: caseDocumentsRes.data || [],
        profiles: profilesRes.data || [],
        site_finances: siteFinancesRes.data || [],
    };
};

export const fetchDeletionsFromSupabase = async (): Promise<SyncDeletion[]> => {
    const supabase = getSupabaseClient();
    if (!supabase) return [];
    
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    try {
        const { data, error } = await supabase
            .from('sync_deletions')
            .select('*')
            .gte('deleted_at', thirtyDaysAgo.toISOString());

        if (error) {
            throw new Error(error.message);
        }
        return data || [];
    } catch (err: any) {
        console.warn("Fetch deletions failed:", err.message);
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
        'profiles',
    ];

    for (const table of deletionOrder) {
        const itemsToDelete = (deletions as any)[table];
        if (itemsToDelete && itemsToDelete.length > 0) {
            const primaryKeyColumn = table === 'assistants' ? 'name' : 'id';
            const ids = itemsToDelete.map((i: any) => i[primaryKeyColumn]);
            
            if (table !== 'profiles') {
                const deletionsLog = ids.map((id: string) => ({
                    table_name: table,
                    record_id: id,
                    user_id: user.id
                }));
                
                // Fire and forget logging to avoid blocking sync if RLS for log is strict
                supabase.from('sync_deletions').insert(deletionsLog).then(res => {
                    if (res.error) console.warn("Could not log deletion:", res.error.message);
                });
            }

            const { error } = await supabase.from(table).delete().in(primaryKeyColumn, ids);
            if (error) {
                console.error(`Error deleting from ${table}:`, error);
                throw error;
            }
        }
    }
};

export const transformRemoteToLocal = (remoteData: Partial<FlatData>): FlatData => {
    if (!remoteData) return {} as FlatData;
    
    return {
        clients: (remoteData.clients || []).map((c: any) => ({ 
            ...c, 
            contactInfo: c.contact_info,
            updated_at: c.updated_at 
        })),
        cases: (remoteData.cases || []).map((cs: any) => ({ 
            ...cs, 
            clientName: cs.client_name, 
            opponentName: cs.opponent_name, 
            feeAgreement: cs.fee_agreement,
            updated_at: cs.updated_at 
        })),
        stages: (remoteData.stages || []).map((st: any) => ({ 
            ...st, 
            caseNumber: st.case_number, 
            firstSessionDate: st.first_session_date, 
            decisionDate: st.decision_date, 
            decisionNumber: st.decision_number, 
            decisionSummary: st.decision_summary, 
            decisionNotes: st.decision_notes,
            updated_at: st.updated_at 
        })),
        sessions: (remoteData.sessions || []).map((s: any) => ({ 
            ...s, 
            caseNumber: s.case_number, 
            clientName: s.client_name, 
            opponentName: s.opponent_name, 
            postponementReason: s.postponement_reason, 
            nextPostponementReason: s.next_postponement_reason, 
            isPostponed: s.is_postponed, 
            nextSessionDate: s.next_session_date, 
            stageId: s.stage_id,
            updated_at: s.updated_at 
        })),
        admin_tasks: (remoteData.admin_tasks || []).map((t: any) => ({ 
            ...t, 
            dueDate: t.due_date, 
            orderIndex: t.order_index,
            updated_at: t.updated_at 
        })),
        appointments: (remoteData.appointments || []).map((a: any) => ({ 
            ...a, 
            reminderTimeInMinutes: a.reminder_time_in_minutes,
            updated_at: a.updated_at 
        })),
        accounting_entries: (remoteData.accounting_entries || []).map((e: any) => ({ 
            ...e, 
            clientId: e.client_id, 
            caseId: e.case_id, 
            clientName: e.client_name,
            updated_at: e.updated_at 
        })),
        assistants: (remoteData.assistants || []).map((a: any) => ({
            name: a.name,
            updated_at: a.updated_at
        })),
        invoices: (remoteData.invoices || []).map((inv: any) => ({ 
            ...inv, 
            clientId: inv.client_id, 
            clientName: inv.client_name, 
            caseId: inv.case_id, 
            caseSubject: inv.case_subject, 
            issueDate: inv.issue_date, 
            dueDate: inv.due_date, 
            taxRate: inv.tax_rate,
            updated_at: inv.updated_at 
        })),
        invoice_items: (remoteData.invoice_items || []).map((item: any) => ({ 
            ...item, 
            invoiceId: item.invoice_id,
            updated_at: item.updated_at 
        })),
        case_documents: (remoteData.case_documents || []).map((doc: any) => ({ 
            ...doc, 
            caseId: doc.case_id, 
            userId: doc.user_id, 
            addedAt: doc.added_at, 
            storagePath: doc.storage_path,
            updated_at: doc.updated_at 
        })),
        profiles: (remoteData.profiles || []).map((p: any) => ({ ...p, updated_at: p.updated_at })),
        site_finances: (remoteData.site_finances || []).map((sf: any) => ({ ...sf, updated_at: sf.updated_at })),
    } as FlatData;
};

export const upsertDataToSupabase = async (data: Partial<FlatData>, user: User) => {
    const supabase = getSupabaseClient();
    if (!supabase) throw new Error('Supabase client not available.');

    const userId = user.id;

    // Filter profiles to ONLY include the logged-in user to prevent RLS 42501 for assistants
    const filteredProfiles = data.profiles?.filter(p => p.id === userId) || [];

    const dataToUpsert = {
        profiles: filteredProfiles.map(p => ({ ...p, updated_at: toDateString(p.updated_at) })),
        assistants: data.assistants?.map(({ name }) => ({ name, user_id: userId })),
        clients: data.clients?.map(({ contactInfo, updated_at, ...rest }: any) => ({ ...rest, user_id: userId, contact_info: contactInfo, updated_at: toDateString(updated_at) })),
        cases: data.cases?.map(({ clientName, opponentName, feeAgreement, updated_at, ...rest }: any) => ({ ...rest, user_id: userId, client_name: clientName, opponent_name: opponentName, fee_agreement: feeAgreement, updated_at: toDateString(updated_at) })),
        stages: data.stages?.map(({ caseNumber, firstSessionDate, decisionDate, decisionNumber, decisionSummary, decisionNotes, updated_at, ...rest }: any) => ({ ...rest, user_id: userId, case_number: caseNumber, first_session_date: toDateString(firstSessionDate), decision_date: toDateString(decisionDate), decision_number: decisionNumber, decision_summary: decisionSummary, decision_notes: decisionNotes, updated_at: toDateString(updated_at) })),
        sessions: data.sessions?.map((s: any) => ({
            id: s.id, user_id: userId, stage_id: s.stage_id, court: s.court, case_number: s.caseNumber, date: toDateString(s.date),
            client_name: s.clientName, opponent_name: s.opponentName, postponement_reason: s.postponementReason,
            next_postponement_reason: s.nextPostponementReason, is_postponed: s.isPostponed, next_session_date: toDateString(s.nextSessionDate),
            assignee: s.assignee, updated_at: toDateString(s.updated_at)
        })),
        admin_tasks: data.admin_tasks?.map(({ dueDate, orderIndex, updated_at, ...rest }: any) => ({ ...rest, user_id: userId, due_date: toDateString(dueDate), order_index: orderIndex, updated_at: toDateString(updated_at) })),
        appointments: data.appointments?.map(({ reminderTimeInMinutes, updated_at, ...rest }: any) => ({ ...rest, user_id: userId, reminder_time_in_minutes: reminderTimeInMinutes, updated_at: toDateString(updated_at) })),
        accounting_entries: data.accounting_entries?.map(({ clientId, caseId, clientName, updated_at, ...rest }: any) => ({ ...rest, user_id: userId, client_id: clientId, case_id: caseId, client_name: clientName, updated_at: toDateString(updated_at) })),
        invoices: data.invoices?.map(({ clientId, clientName, caseId, caseSubject, issueDate, dueDate, taxRate, updated_at, ...rest }: any) => ({ ...rest, user_id: userId, client_id: clientId, client_name: clientName, case_id: caseId, case_subject: caseSubject, issue_date: toDateString(issueDate), due_date: toDateString(dueDate), tax_rate: taxRate, updated_at: toDateString(updated_at) })),
        invoice_items: data.invoice_items?.map(({ invoiceId, updated_at, ...rest }: any) => ({ ...rest, user_id: userId, invoice_id: invoiceId, updated_at: toDateString(updated_at) })),
        case_documents: data.case_documents?.map(({ caseId, userId: docUserId, addedAt, storagePath, updated_at, ...rest }: any) => ({ ...rest, user_id: userId, case_id: caseId, added_at: toDateString(addedAt), storage_path: storagePath, updated_at: toDateString(updated_at) })),
        site_finances: data.site_finances?.map(({ updated_at, ...rest }: any) => ({ ...rest, updated_at: toDateString(updated_at) }))
    };

    // Sequential upsert to respect foreign key constraints
    const tableOrder: (keyof typeof dataToUpsert)[] = [
        'profiles', 'assistants', 'clients', 'cases', 'stages', 'sessions', 
        'invoices', 'invoice_items', 'accounting_entries', 'admin_tasks', 
        'appointments', 'site_finances', 'case_documents'
    ];

    const finalResults: any = {};
    for (const table of tableOrder) {
        const records = (dataToUpsert as any)[table];
        if (records && records.length > 0) {
            const { data: upserted, error } = await supabase.from(table).upsert(records).select();
            if (error) {
                console.error(`Error upserting to ${table}:`, error);
                throw { ...error, table };
            }
            finalResults[table] = upserted;
        }
    }

    return finalResults;
};
