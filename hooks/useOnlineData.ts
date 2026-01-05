
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

export const mapFetchError = (err: any): string => {
    const message = String(err?.message || err || '').toLowerCase();
    if (message.includes('fetch') || message.includes('network')) {
        return 'offline';
    }
    return err?.message || String(err);
};

export const checkSupabaseSchema = async () => {
    const supabase = getSupabaseClient();
    if (!supabase) return { success: false, error: 'unconfigured', message: 'عميل Supabase غير مكوّن.' };
    try {
        const { error } = await supabase.from('profiles').select('id').limit(1);
        if (error) throw error;
        return { success: true, error: null, message: '' };
    } catch (err: any) { 
        const mapped = mapFetchError(err);
        return { success: false, error: mapped === 'offline' ? 'network' : 'unknown', message: mapped }; 
    }
};

export const fetchDataFromSupabase = async (): Promise<Partial<FlatData>> => {
    const supabase = getSupabaseClient();
    if (!supabase) throw new Error('offline');
    try {
        const responses = await Promise.all([
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
        for (const res of responses) { if (res.error) throw res.error; }
        return {
            clients: responses[0].data || [], admin_tasks: responses[1].data || [], appointments: responses[2].data || [],
            accounting_entries: responses[3].data || [], assistants: responses[4].data || [], invoices: responses[5].data || [],
            cases: responses[6].data || [], stages: responses[7].data || [], sessions: responses[8].data || [],
            invoice_items: responses[9].data || [], case_documents: responses[10].data || [], profiles: responses[11].data || [],
            site_finances: responses[12].data || [],
        };
    } catch (err: any) { throw new Error(mapFetchError(err)); }
};

export const fetchDeletionsFromSupabase = async (): Promise<SyncDeletion[]> => {
    const supabase = getSupabaseClient();
    if (!supabase) return [];
    try {
        const { data, error } = await supabase.from('sync_deletions').select('*').limit(500);
        if (error) return [];
        return data || [];
    } catch (err: any) { return []; }
};

export const deleteRecordsFromSupabase = async (tableName: string, recordIds: string[], userId: string) => {
    const supabase = getSupabaseClient();
    if (!supabase || recordIds.length === 0) return;
    
    try {
        // 1. تنفيذ الحذف من الجدول الأصلي
        const { error: delError } = await supabase.from(tableName).delete().in('id', recordIds);
        if (delError) throw delError;

        // 2. تسجيل الحذف في جدول sync_deletions ليراه الآخرون
        const deletionLogs = recordIds.map(id => ({
            table_name: tableName,
            record_id: id,
            user_id: userId,
            deleted_at: new Date().toISOString()
        }));
        
        await supabase.from('sync_deletions').insert(deletionLogs);
    } catch (err) {
        console.error(`Failed to delete from ${tableName} on cloud:`, err);
    }
};

export const upsertDataToSupabase = async (data: Partial<FlatData>, user: User) => {
    const supabase = getSupabaseClient();
    if (!supabase) return;
    
    const safeISO = (val: any) => {
        if (!val) return null;
        const d = val instanceof Date ? val : new Date(val);
        return isNaN(d.getTime()) ? null : d.toISOString();
    };

    const userId = user.id;
    const dataToUpsert = {
        clients: data.clients?.map(({ contactInfo, updated_at, ...rest }: any) => ({ ...rest, user_id: userId, contact_info: contactInfo, updated_at: safeISO(updated_at) })),
        cases: data.cases?.map(({ clientName, opponentName, feeAgreement, updated_at, ...rest }: any) => ({ ...rest, user_id: userId, client_name: clientName, opponent_name: opponentName, fee_agreement: feeAgreement, updated_at: safeISO(updated_at) })),
        stages: data.stages?.map(({ caseNumber, firstSessionDate, decisionDate, decisionNumber, decisionSummary, decisionNotes, updated_at, ...rest }: any) => ({ ...rest, user_id: userId, case_number: caseNumber, first_session_date: safeISO(firstSessionDate), decision_date: safeISO(decisionDate), decision_number: decisionNumber, decision_summary: decisionSummary, decision_notes: decisionNotes, updated_at: safeISO(updated_at) })),
        sessions: data.sessions?.map((s: any) => ({
            id: s.id, user_id: userId, stage_id: s.stage_id, court: s.court, case_number: s.caseNumber,
            date: safeISO(s.date), client_name: s.clientName, opponent_name: s.opponentName,
            postponement_reason: s.postponementReason, next_postponement_reason: s.nextPostponementReason,
            is_postponed: s.isPostponed, next_session_date: safeISO(s.nextSessionDate),
            assignee: s.assignee, updated_at: safeISO(s.updated_at)
        })),
        admin_tasks: data.admin_tasks?.map(({ dueDate, orderIndex, updated_at, ...rest }: any) => ({ ...rest, user_id: userId, due_date: safeISO(dueDate), order_index: orderIndex, updated_at: safeISO(updated_at) })),
        appointments: data.appointments?.map(({ reminderTimeInMinutes, date, updated_at, ...rest }: any) => ({ ...rest, user_id: userId, reminder_time_in_minutes: reminderTimeInMinutes, date: safeISO(date), updated_at: safeISO(updated_at) })),
        accounting_entries: data.accounting_entries?.map(({ clientId, caseId, clientName, date, updated_at, ...rest }: any) => ({ ...rest, user_id: userId, client_id: clientId, case_id: caseId, client_name: clientName, date: safeISO(date), updated_at: safeISO(updated_at) })),
        assistants: data.assistants?.map((item: any) => ({ ...item, user_id: userId })),
        invoices: data.invoices?.map(({ clientId, clientName, caseId, caseSubject, issueDate, dueDate, taxRate, updated_at, ...rest }: any) => ({ ...rest, user_id: userId, client_id: clientId, client_name: clientName, case_id: caseId, case_subject: caseSubject, issue_date: safeISO(issueDate), due_date: safeISO(dueDate), tax_rate: taxRate, updated_at: safeISO(updated_at) })),
        invoice_items: data.invoice_items?.map(({ updated_at, ...item }: any) => ({ ...item, user_id: userId, updated_at: safeISO(updated_at) })),
        case_documents: data.case_documents?.map(({ caseId, updated_at, ...rest }: any) => ({ ...rest, user_id: userId, case_id: caseId, updated_at: safeISO(updated_at) })),
        profiles: data.profiles?.map(({ updated_at, ...rest }: any) => ({ ...rest, updated_at: safeISO(updated_at) })),
        site_finances: data.site_finances?.map(({ updated_at, ...rest }: any) => ({ ...rest, updated_at: safeISO(updated_at) })),
    };
    
    try {
        const tableKeys = Object.keys(dataToUpsert) as (keyof typeof dataToUpsert)[];
        for (const table of tableKeys) {
            const records = dataToUpsert[table];
            if (records && records.length > 0) {
                const onConflict = table === 'assistants' ? 'user_id,name' : 'id';
                await supabase.from(table).upsert(records, { onConflict });
            }
        }
    } catch (err) { console.warn("Background upsert failed:", err); }
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
        invoices: remote.invoices?.map(({ client_id, client_name, case_id, case_subject, issue_date, due_date, tax_rate, ...r }: any) => ({ ...r, clientId: client_id, clientName: client_name, caseId: case_id, case_subject: case_subject, issue_date: issue_date, due_date: due_date, tax_rate: tax_rate })),
        invoice_items: remote.invoice_items,
        case_documents: remote.case_documents?.map(({ user_id, case_id, added_at, storage_path, ...r }: any) => ({...r, userId: user_id, caseId: case_id, addedAt: added_at, storagePath: storage_path })),
        profiles: remote.profiles?.map(({ full_name, mobile_number, is_approved, is_active, subscription_start_date, subscription_end_date, lawyer_id, permissions, ...r }: any) => ({ ...r, full_name, mobile_number, is_approved, is_active, subscription_start_date, subscription_end_date, lawyer_id, permissions })),
        site_finances: remote.site_finances,
    };
};
