
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
    if (!supabase) return { success: false, error: 'unconfigured' };
    try {
        const { error } = await supabase.from('profiles').select('id', { head: true, count: 'exact' });
        if (error) throw error;
        return { success: true };
    } catch (err) {
        return { success: false, error: 'uninitialized' };
    }
};

export const fetchDataFromSupabase = async (): Promise<Partial<FlatData>> => {
    const supabase = getSupabaseClient();
    if (!supabase) throw new Error('Supabase client not available.');

    const tables = ['clients', 'admin_tasks', 'appointments', 'accounting_entries', 'assistants', 'invoices', 'cases', 'stages', 'sessions', 'invoice_items', 'case_documents', 'profiles', 'site_finances'];
    const results = await Promise.all(tables.map(t => supabase.from(t).select('*')));

    const data: any = {};
    tables.forEach((t, i) => {
        if (results[i].error) throw new Error(`فشل جلب ${t}: ${results[i].error?.message}`);
        data[t] = results[i].data || [];
    });

    return data;
};

export const fetchDeletionsFromSupabase = async (): Promise<SyncDeletion[]> => {
    const supabase = getSupabaseClient();
    if (!supabase) return [];
    const { data } = await supabase.from('sync_deletions').select('*').gte('deleted_at', new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString());
    return data || [];
};

export const deleteDataFromSupabase = async (deletions: Partial<FlatData>, user: User) => {
    const supabase = getSupabaseClient();
    if (!supabase) return;
    for (const table of Object.keys(deletions)) {
        const items = (deletions as any)[table];
        if (items && items.length > 0) {
            const ids = items.map((i: any) => i.id || i.name);
            await supabase.from('sync_deletions').insert(ids.map((id: any) => ({ table_name: table, record_id: id, user_id: user.id })));
            await supabase.from(table).delete().in(table === 'assistants' ? 'name' : 'id', ids).eq('user_id', user.id);
        }
    }
};

export const upsertDataToSupabase = async (data: Partial<FlatData>, user: User) => {
    const supabase = getSupabaseClient();
    if (!supabase) return;
    const userId = user.id;

    const mapping: any = {
        clients: data.clients?.map((c: any) => ({ ...c, user_id: userId, contact_info: c.contactInfo })),
        cases: data.cases?.map((c: any) => ({ ...c, user_id: userId, client_name: c.clientName, opponent_name: c.opponentName, fee_agreement: c.feeAgreement })),
        stages: data.stages?.map((s: any) => ({ ...s, user_id: userId, case_number: s.caseNumber, first_session_date: s.firstSessionDate, decision_date: s.decisionDate, decision_number: s.decisionNumber, decision_summary: s.decisionSummary, decision_notes: s.decisionNotes })),
        sessions: data.sessions?.map((s: any) => ({ ...s, user_id: userId, case_number: s.caseNumber, client_name: s.clientName, opponent_name: s.opponentName, postponement_reason: s.postponementReason, next_postponement_reason: s.nextPostponementReason, is_postponed: s.isPostponed, next_session_date: s.nextSessionDate })),
        admin_tasks: data.admin_tasks?.map((t: any) => ({ ...t, user_id: userId, due_date: t.dueDate, order_index: t.orderIndex })),
        appointments: data.appointments?.map((a: any) => ({ ...a, user_id: userId, reminder_time_in_minutes: a.reminderTimeInMinutes })),
        accounting_entries: data.accounting_entries?.map((e: any) => ({ ...e, user_id: userId, client_id: e.clientId, case_id: e.caseId, client_name: e.clientName })),
        assistants: data.assistants?.map((a: any) => ({ ...a, user_id: userId })),
        invoices: data.invoices?.map((i: any) => ({ ...i, user_id: userId, client_id: i.clientId, client_name: i.clientName, case_id: i.caseId, case_subject: i.caseSubject, issue_date: i.issueDate, due_date: i.dueDate, tax_rate: i.taxRate })),
        invoice_items: data.invoice_items?.map((i: any) => ({ ...i, user_id: userId })),
        case_documents: data.case_documents?.map((d: any) => ({ ...d, user_id: userId, case_id: d.caseId, added_at: d.addedAt, storage_path: d.storagePath })),
        profiles: data.profiles,
        site_finances: data.site_finances,
    };

    for (const table of Object.keys(mapping)) {
        if (mapping[table] && mapping[table].length > 0) {
            await supabase.from(table).upsert(mapping[table]);
        }
    }
};

export const transformRemoteToLocal = (remote: any): Partial<FlatData> => {
    if (!remote) return {};
    return {
        clients: remote.clients?.map((r: any) => ({ ...r, contactInfo: r.contact_info })),
        cases: remote.cases?.map((r: any) => ({ ...r, clientName: r.client_name, opponentName: r.opponent_name, feeAgreement: r.fee_agreement })),
        stages: remote.stages?.map((r: any) => ({ ...r, caseNumber: r.case_number, firstSessionDate: r.first_session_date, decisionDate: r.decision_date, decisionNumber: r.decision_number, decisionSummary: r.decision_summary, decisionNotes: r.decision_notes })),
        sessions: remote.sessions?.map((r: any) => ({ ...r, caseNumber: r.case_number, clientName: r.client_name, opponentName: r.opponent_name, postponementReason: r.postponement_reason, nextPostponementReason: r.next_postponement_reason, isPostponed: r.is_postponed, nextSessionDate: r.next_session_date })),
        admin_tasks: remote.admin_tasks?.map((r: any) => ({ ...r, dueDate: r.due_date, orderIndex: r.order_index })),
        appointments: remote.appointments?.map((r: any) => ({ ...r, reminderTimeInMinutes: r.reminder_time_in_minutes })),
        accounting_entries: remote.accounting_entries?.map((r: any) => ({ ...r, clientId: r.client_id, caseId: r.case_id, clientName: r.client_name })),
        assistants: remote.assistants,
        invoices: remote.invoices?.map((r: any) => ({ ...r, clientId: r.client_id, clientName: r.client_name, caseId: r.case_id, caseSubject: r.case_subject, issueDate: r.issue_date, dueDate: r.due_date, taxRate: r.tax_rate })),
        invoice_items: remote.invoice_items,
        case_documents: remote.case_documents?.map((r: any) => ({ ...r, userId: r.user_id, caseId: r.case_id, addedAt: r.added_at, storagePath: r.storage_path })),
        profiles: remote.profiles,
        site_finances: remote.site_finances,
    };
};
