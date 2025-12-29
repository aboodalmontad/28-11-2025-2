
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

export const checkSupabaseSchema = async () => {
    const supabase = getSupabaseClient();
    if (!supabase) {
        return { success: false, error: 'unconfigured', message: 'Supabase client is not configured.' };
    }

    const tableChecks: { [key: string]: string } = {
        'profiles': 'id', 'clients': 'id', 'cases': 'id',
        'stages': 'id', 'sessions': 'id', 'admin_tasks': 'id',
        'appointments': 'id', 'accounting_entries': 'id', 'assistants': 'name',
        'invoices': 'id', 'invoice_items': 'id', 'case_documents': 'id',
        'site_finances': 'id', 'sync_deletions': 'id'
    };
    
    try {
        // نتحقق من الجداول بشكل فردي للحصول على خطأ محدد لكل جدول
        for (const [table, column] of Object.entries(tableChecks)) {
            const { error } = await supabase.from(table).select(column).limit(1);
            if (error) {
                const message = error.message.toLowerCase();
                const code = error.code;
                if (code === '42P01' || message.includes('does not exist') || message.includes('relation')) {
                    return { success: false, error: 'uninitialized', message: `الجدول ${table} غير موجود في قاعدة البيانات.` };
                }
                if (code === '42501' || message.includes('permission denied')) {
                     // لا نعتبره خطأ في المخطط بل مشكلة صلاحيات RLS، سنستمر
                     continue;
                }
                throw error;
            }
        }
        return { success: true, error: null, message: '' };
    } catch (err: any) {
        if (String(err?.message).includes('failed to fetch')) {
            return { success: false, error: 'network', message: 'فشل الاتصال بالخادم، تحقق من الإنترنت.' };
        }
        return { success: false, error: 'unknown', message: `خطأ أثناء فحص القاعدة: ${err.message}` };
    }
};

export const fetchDataFromSupabase = async (): Promise<Partial<FlatData>> => {
    const supabase = getSupabaseClient();
    if (!supabase) throw new Error('Supabase client not available.');

    const fetchTable = async (table: string) => {
        const { data, error } = await supabase.from(table).select('*');
        if (error) throw new Error(`فشل جلب جدول ${table}: ${error.message}`);
        return data || [];
    };

    const [
        clients, admin_tasks, appointments, accounting_entries,
        assistants, invoices, cases, stages, sessions, invoice_items,
        case_documents, profiles, site_finances
    ] = await Promise.all([
        fetchTable('clients'), fetchTable('admin_tasks'), fetchTable('appointments'),
        fetchTable('accounting_entries'), fetchTable('assistants'), fetchTable('invoices'),
        fetchTable('cases'), fetchTable('stages'), fetchTable('sessions'),
        fetchTable('invoice_items'), fetchTable('case_documents'), fetchTable('profiles'),
        fetchTable('site_finances')
    ]);

    return {
        clients, admin_tasks, appointments, accounting_entries,
        assistants, invoices, cases, stages, sessions, invoice_items,
        case_documents, profiles, site_finances
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
        if (error) throw error;
        return data || [];
    } catch (err) {
        console.warn("Fetch deletions failed:", err);
        return []; 
    }
};

export const deleteDataFromSupabase = async (deletions: Partial<FlatData>, user: User) => {
    const supabase = getSupabaseClient();
    if (!supabase) throw new Error('Supabase client not available.');

    const deletionOrder: (keyof FlatData)[] = [
        'case_documents', 'invoice_items', 'sessions', 'stages', 'cases', 'invoices', 
        'admin_tasks', 'appointments', 'accounting_entries', 'assistants', 'clients',
        'site_finances', 'profiles'
    ];

    for (const table of deletionOrder) {
        const items = (deletions as any)[table];
        if (items && items.length > 0) {
            const pk = table === 'assistants' ? 'name' : 'id';
            const ids = items.map((i: any) => i[pk]);
            
            // تسجيل الحذف لمنع عودة البيانات
            if (table !== 'profiles') {
                const log = ids.map((id: string) => ({ table_name: table, record_id: id, user_id: user.id }));
                await supabase.from('sync_deletions').insert(log);
            }
            const { error } = await supabase.from(table).delete().in(pk, ids);
            if (error) throw error;
        }
    }
};

export const upsertDataToSupabase = async (data: Partial<FlatData>, user: User) => {
    const supabase = getSupabaseClient();
    if (!supabase) throw new Error('Supabase client not available.');
    const userId = user.id;

    const dataToUpsert = {
        clients: data.clients?.map(({ contactInfo, ...rest }) => ({ ...rest, user_id: userId, contact_info: contactInfo })),
        cases: data.cases?.map(({ clientName, opponentName, feeAgreement, ...rest }) => ({ ...rest, user_id: userId, client_name: clientName, opponent_name: opponentName, fee_agreement: feeAgreement })),
        stages: data.stages?.map(({ caseNumber, firstSessionDate, decisionDate, decisionNumber, decisionSummary, decisionNotes, ...rest }) => ({ ...rest, user_id: userId, case_number: caseNumber, first_session_date: firstSessionDate, decision_date: decisionDate, decision_number: decisionNumber, decision_summary: decisionSummary, decision_notes: decisionNotes })),
        sessions: data.sessions?.map((s: any) => ({
            id: s.id, user_id: userId, stage_id: s.stage_id, court: s.court, case_number: s.caseNumber,
            date: s.date, client_name: s.clientName, opponent_name: s.opponentName, postponement_reason: s.postponementReason,
            next_postponement_reason: s.nextPostponementReason, is_postponed: s.isPostponed, next_session_date: s.nextSessionDate,
            assignee: s.assignee, updated_at: s.updated_at
        })),
        admin_tasks: data.admin_tasks?.map(({ dueDate, orderIndex, ...rest }) => ({ ...rest, user_id: userId, due_date: dueDate, order_index: orderIndex })),
        appointments: data.appointments?.map(({ reminderTimeInMinutes, ...rest }) => ({ ...rest, user_id: userId, reminder_time_in_minutes: reminderTimeInMinutes })),
        accounting_entries: data.accounting_entries?.map(({ clientId, caseId, clientName, ...rest }) => ({ ...rest, user_id: userId, client_id: clientId, case_id: caseId, client_name: clientName })),
        assistants: data.assistants?.map(item => ({ ...item, user_id: userId })),
        invoices: data.invoices?.map(({ clientId, clientName, caseId, caseSubject, issueDate, dueDate, taxRate, ...rest }) => ({ ...rest, user_id: userId, client_id: clientId, client_name: clientName, case_id: caseId, case_subject: caseSubject, issue_date: issueDate, due_date: dueDate, tax_rate: taxRate })),
        invoice_items: data.invoice_items?.map(({ ...item }) => ({ ...item, user_id: userId })),
        case_documents: data.case_documents?.map(({ caseId, userId: localUserId, addedAt, storagePath, ...rest }) => ({ ...rest, user_id: userId, case_id: caseId, added_at: addedAt, storage_path: storagePath })),
        profiles: data.profiles?.map(({ full_name, mobile_number, is_approved, is_active, subscription_start_date, subscription_end_date, lawyer_id, permissions, ...rest }) => ({ ...rest, full_name, mobile_number, is_approved, is_active, subscription_start_date, subscription_end_date, lawyer_id, permissions })),
        site_finances: data.site_finances?.map(({ user_id, payment_date, ...rest }) => ({ ...rest, user_id, payment_date })),
    };
    
    const upsertTable = async (table: string, records: any[] | undefined, options: { onConflict?: string } = {}) => {
        if (!records || records.length === 0) return [];
        const { data: responseData, error } = await supabase.from(table).upsert(records, options).select();
        if (error) throw new Error(`فشل رفع ${table}: ${error.message}`);
        return responseData || [];
    };
    
    const results: Partial<Record<keyof FlatData, any[]>> = {};
    results.profiles = await upsertTable('profiles', dataToUpsert.profiles);
    results.assistants = await upsertTable('assistants', dataToUpsert.assistants, { onConflict: 'user_id,name' });
    results.clients = await upsertTable('clients', dataToUpsert.clients);
    results.cases = await upsertTable('cases', dataToUpsert.cases);
    results.stages = await upsertTable('stages', dataToUpsert.stages);
    results.sessions = await upsertTable('sessions', dataToUpsert.sessions);
    results.invoices = await upsertTable('invoices', dataToUpsert.invoices);
    results.invoice_items = await upsertTable('invoice_items', dataToUpsert.invoice_items);
    results.case_documents = await upsertTable('case_documents', dataToUpsert.case_documents);
    results.admin_tasks = await upsertTable('admin_tasks', dataToUpsert.admin_tasks);
    results.appointments = await upsertTable('appointments', dataToUpsert.appointments);
    results.accounting_entries = await upsertTable('accounting_entries', dataToUpsert.accounting_entries);
    results.site_finances = await upsertTable('site_finances', dataToUpsert.site_finances);
    
    return results;
};

export const transformRemoteToLocal = (remote: any): Partial<FlatData> => {
    if (!remote) return {};
    return {
        clients: remote.clients?.map(({ contact_info, ...r }: any) => ({ ...r, contactInfo: contact_info })),
        cases: remote.cases?.map(({ client_name, opponent_name, fee_agreement, ...r }: any) => ({ ...r, clientName: client_name, opponentName: opponent_name, feeAgreement: fee_agreement })),
        stages: remote.stages?.map(({ case_number, first_session_date, decision_date, decision_number, decision_summary, decision_notes, ...r }: any) => ({ ...r, caseNumber: case_number, firstSessionDate: first_session_date, decisionDate: decision_date, decisionNumber: decision_number, decisionSummary: decision_summary, decisionNotes: decision_notes })),
        sessions: remote.sessions?.map(({ case_number, client_name, opponent_name, postponement_reason, next_postponement_reason, is_postponed, next_session_date, ...r }: any) => ({ ...r, caseNumber: case_number, clientName: client_name, opponentName: opponent_name, postponementReason: postponement_reason, nextPostponementReason: next_postponement_reason, isPostponed: is_postponed, nextSessionDate: next_session_date })),
        admin_tasks: remote.admin_tasks?.map(({ due_date, order_index, ...r }: any) => ({ ...r, dueDate: due_date, orderIndex: order_index })),
        appointments: remote.appointments?.map(({ reminder_time_in_minutes, ...r }: any) => ({ ...r, reminderTimeInMinutes: reminder_time_in_minutes })),
        accounting_entries: remote.accounting_entries?.map(({ client_id, case_id, client_name, ...r }: any) => ({ ...r, clientId: client_id, caseId: case_id, clientName: client_name })),
        assistants: remote.assistants?.map((a: any) => ({ name: a.name })),
        invoices: remote.invoices?.map(({ client_id, client_name, case_id, case_subject, issue_date, due_date, tax_rate, ...r }: any) => ({ ...r, clientId: client_id, clientName: client_name, caseId: case_id, caseSubject: case_subject, issueDate: issue_date, dueDate: due_date, taxRate: tax_rate })),
        invoice_items: remote.invoice_items,
        case_documents: remote.case_documents?.map(({ user_id, case_id, added_at, storage_path, ...r }: any) => ({...r, userId: user_id, caseId: case_id, addedAt: added_at, storagePath: storage_path })),
        profiles: remote.profiles?.map(({ full_name, mobile_number, is_approved, is_active, subscription_start_date, subscription_end_date, lawyer_id, permissions, ...r }: any) => ({ ...r, full_name, mobile_number, is_approved, is_active, subscription_start_date, subscription_end_date, lawyer_id, permissions })),
        site_finances: remote.site_finances,
    };
};
