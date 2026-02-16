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


/**
 * Checks if all required tables exist in the Supabase database schema.
 */
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
        'site_finances': 'id',
        'sync_deletions': 'id', 
    };
    
    const tableCheckPromises = Object.entries(tableChecks).map(([table, query]) =>
        supabase.from(table).select(query, { head: true }).then(res => ({ ...res, table }))
    );

    try {
        const results = await Promise.all(tableCheckPromises);
        for (const result of results) {
            if (result.error) {
                const message = String(result.error.message || '').toLowerCase();
                const code = String(result.error.code || '');
                
                if (code === '42P01' || message.includes('does not exist') || message.includes('could not find the table') || message.includes('schema cache') || message.includes('relation') ) {
                    return { success: false, error: 'uninitialized', message: `Database uninitialized. Missing table or relation: ${result.table}.` };
                } else {
                    throw result.error;
                }
            }
        }
        return { success: true, error: null, message: '' };
    } catch (err: any) {
        const message = String(err?.message || '').toLowerCase();
        const code = String(err?.code || '');

        if (message.includes('failed to fetch')) {
            return { success: false, error: 'network', message: 'Failed to connect to the server. Check internet connection and CORS settings.' };
        }
        
        if (message.includes('does not exist') || code === '42P01' || message.includes('could not find the table') || message.includes('schema cache')) {
            return { success: false, error: 'uninitialized', message: 'Database is not fully initialized.' };
        }

        return { success: false, error: 'unknown', message: `Database schema check failed: ${err.message}` };
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
            throw new Error(`Failed to fetch ${name}: ${res.error.message}`);
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
            const errorMsg = error.message || JSON.stringify(error) || 'Unknown Supabase error';
            throw new Error(errorMsg);
        }
        return data || [];
    } catch (err: any) {
        let msg = 'Unknown error fetching deletions';
        if (err instanceof Error) {
            msg = err.message;
        } else if (typeof err === 'object' && err !== null) {
            msg = (err as any).message || JSON.stringify(err);
        } else {
            msg = String(err);
        }
        console.warn("Fetch deletions failed (non-critical, continuing sync):", msg);
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
                
                const { error: logError } = await supabase.from('sync_deletions').insert(deletionsLog).select();
                
                if (logError) {
                    console.warn("Could not log deletion (safe to ignore if DB not updated):", logError.message || JSON.stringify(logError));
                }
            }

            const { error } = await supabase.from(table).delete().in(primaryKeyColumn, ids);
            if (error) {
                console.error(`Error deleting from ${table}:`, error);
                const msg = error.message || JSON.stringify(error);
                const newError = new Error(msg);
                (newError as any).table = table;
                throw newError;
            }
        }
    }
};

export const upsertDataToSupabase = async (data: Partial<FlatData>, user: User) => {
    const supabase = getSupabaseClient();
    if (!supabase) throw new Error('Supabase client not available.');

    const userId = user.id;

    const dataToUpsert = {
        clients: data.clients?.map((c: any) => ({ 
            id: c.id, 
            user_id: userId, 
            name: c.name, 
            contact_info: c.contactInfo || c.contact_info,
            updated_at: c.updated_at
        })),
        cases: data.cases?.map((c: any) => ({ 
            id: c.id, 
            user_id: userId, 
            client_id: c.clientId || c.client_id, 
            subject: c.subject,
            client_name: c.clientName || c.client_name, 
            opponent_name: c.opponentName || c.opponent_name, 
            fee_agreement: c.feeAgreement || c.fee_agreement,
            status: c.status,
            updated_at: c.updated_at
        })),
        stages: data.stages?.map((s: any) => ({ 
            id: s.id, 
            user_id: userId, 
            case_id: s.caseId || s.case_id,
            court: s.court,
            case_number: s.caseNumber || s.case_number, 
            first_session_date: s.firstSessionDate || s.first_session_date, 
            decision_date: s.decisionDate || s.decision_date, 
            decision_number: s.decisionNumber !== undefined ? s.decisionNumber : s.decision_number, 
            decision_summary: s.decisionSummary !== undefined ? s.decisionSummary : s.decision_summary, 
            decision_notes: s.decisionNotes !== undefined ? s.decisionNotes : s.decision_notes,
            updated_at: s.updated_at
        })),
        sessions: data.sessions?.map((s: any) => ({
            id: s.id,
            user_id: userId,
            stage_id: s.stageId || s.stage_id,
            court: s.court,
            case_number: s.caseNumber || s.case_number,
            date: s.date,
            client_name: s.clientName || s.client_name,
            opponent_name: s.opponentName || s.opponent_name,
            postponement_reason: s.postponementReason || s.postponement_reason,
            next_postponement_reason: s.nextPostponementReason || s.next_postponement_reason,
            is_postponed: s.isPostponed !== undefined ? s.isPostponed : s.is_postponed,
            next_session_date: s.nextSessionDate || s.next_session_date,
            assignee: s.assignee,
            updated_at: s.updated_at
        })),
        admin_tasks: data.admin_tasks?.map((t: any) => ({ 
            id: t.id, 
            user_id: userId, 
            task: t.task,
            due_date: t.dueDate || t.due_date, 
            completed: t.completed,
            importance: t.importance,
            assignee: t.assignee,
            location: t.location,
            order_index: t.orderIndex !== undefined ? t.orderIndex : t.order_index,
            updated_at: t.updated_at
        })),
        appointments: data.appointments?.map((a: any) => ({ 
            id: a.id, 
            user_id: userId, 
            title: a.title,
            time: a.time,
            date: a.date,
            importance: a.importance,
            completed: a.completed,
            notified: a.notified,
            reminder_time_in_minutes: a.reminderTimeInMinutes || a.reminder_time_in_minutes,
            assignee: a.assignee,
            updated_at: a.updated_at
        })),
        accounting_entries: data.accounting_entries?.map((e: any) => ({ 
            id: e.id, 
            user_id: userId, 
            type: e.type,
            amount: e.amount,
            date: e.date,
            description: e.description,
            client_id: e.clientId || e.client_id, 
            case_id: e.caseId || e.case_id, 
            client_name: e.clientName || e.client_name,
            updated_at: e.updated_at
        })),
        assistants: data.assistants?.map(item => ({ name: item.name, user_id: userId })),
        invoices: data.invoices?.map((i: any) => ({ 
            id: i.id, 
            user_id: userId, 
            client_id: i.clientId || i.client_id, 
            client_name: i.clientName || i.client_name, 
            case_id: i.caseId || i.case_id, 
            case_subject: i.caseSubject || i.case_subject, 
            issue_date: i.issueDate || i.issue_date, 
            due_date: i.dueDate || i.due_date, 
            tax_rate: i.taxRate !== undefined ? i.taxRate : i.tax_rate,
            discount: i.discount,
            status: i.status,
            notes: i.notes,
            updated_at: i.updated_at
        })),
        invoice_items: data.invoice_items?.map((item: any) => ({ 
            id: item.id, 
            user_id: userId, 
            invoice_id: item.invoiceId || item.invoice_id,
            description: item.description,
            amount: item.amount,
            updated_at: item.updated_at
        })),
        case_documents: data.case_documents?.map((d: any) => ({ 
            id: d.id, 
            user_id: userId, 
            case_id: d.caseId || d.case_id, 
            name: d.name,
            type: d.type,
            size: d.size,
            added_at: d.addedAt || d.added_at, 
            storage_path: d.storagePath || d.storage_path,
            updated_at: d.updated_at
        })),
        profiles: data.profiles?.filter((p: any) => p.id === userId).map((p: any) => ({
            id: p.id,
            full_name: p.full_name,
            mobile_number: p.mobile_number,
            is_approved: p.is_approved,
            is_active: p.is_active,
            mobile_verified: p.mobile_verified,
            subscription_start_date: p.subscription_start_date,
            subscription_end_date: p.subscription_end_date,
            role: p.role,
            lawyer_id: p.lawyer_id,
            permissions: p.permissions,
            updated_at: p.updated_at
        })),
        site_finances: data.site_finances?.map((sf: any) => ({ 
            id: sf.id,
            user_id: sf.user_id, 
            type: sf.type,
            payment_date: sf.payment_date,
            amount: sf.amount,
            description: sf.description,
            payment_method: sf.payment_method,
            category: sf.category,
            profile_full_name: sf.profile_full_name,
            updated_at: sf.updated_at
        })),
    };
    
    const upsertTable = async (table: string, records: any[] | undefined, options: { onConflict?: string } = {}) => {
        if (!records || records.length === 0) return [];
        const { data: responseData, error } = await supabase.from(table).upsert(records, options).select();
        if (error) {
            console.error(`Error upserting to ${table}:`, error);
            const errorDetails = error.message || JSON.stringify(error);
            const msg = `Error upserting to ${table}: ${errorDetails}`;
            const newError = new Error(msg);
            (newError as any).table = table;
            throw newError;
        }
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
    
    const [adminTasks, appointments, accountingEntries, site_finances] = await Promise.all([
        upsertTable('admin_tasks', dataToUpsert.admin_tasks),
        upsertTable('appointments', dataToUpsert.appointments),
        upsertTable('accounting_entries', dataToUpsert.accounting_entries),
        upsertTable('site_finances', dataToUpsert.site_finances),
    ]);
    results.admin_tasks = adminTasks;
    results.appointments = appointments;
    results.accounting_entries = accountingEntries;
    results.site_finances = site_finances;
    
    return results;
};

export const transformRemoteToLocal = (remote: any): Partial<FlatData> => {
    if (!remote) return {};
    return {
        clients: remote.clients?.map(({ contact_info, ...r }: any) => ({ ...r, contactInfo: contact_info, contact_info })),
        cases: remote.cases?.map(({ client_id, client_name, opponent_name, fee_agreement, ...r }: any) => ({ 
            ...r, 
            clientId: client_id, 
            clientName: client_name, 
            opponentName: opponent_name, 
            feeAgreement: fee_agreement,
            client_id, client_name, opponent_name, fee_agreement
        })),
        stages: remote.stages?.map(({ case_id, case_number, first_session_date, decision_date, decision_number, decision_summary, decision_notes, ...r }: any) => ({ 
            ...r, 
            caseId: case_id,
            caseNumber: case_number, 
            firstSessionDate: first_session_date, 
            decisionDate: decision_date, 
            decisionNumber: decision_number, 
            decisionSummary: decision_summary, 
            decisionNotes: decision_notes,
            case_id, case_number, first_session_date, decision_date, decision_number, decision_summary, decision_notes
        })),
        sessions: remote.sessions?.map(({ stage_id, case_number, client_name, opponent_name, postponement_reason, next_postponement_reason, is_postponed, next_session_date, ...r }: any) => ({ 
            ...r, 
            stageId: stage_id,
            caseNumber: case_number, 
            clientName: client_name, 
            opponentName: opponent_name, 
            postponementReason: postponement_reason, 
            nextPostponementReason: next_postponement_reason, 
            isPostponed: is_postponed, 
            nextSessionDate: next_session_date,
            stage_id, case_number, client_name, opponent_name, postponement_reason, next_postponement_reason, is_postponed, next_session_date
        })),
        admin_tasks: remote.admin_tasks?.map(({ due_date, order_index, ...r }: any) => ({ ...r, dueDate: due_date, orderIndex: order_index, due_date, order_index })),
        appointments: remote.appointments?.map(({ reminder_time_in_minutes, ...r }: any) => ({ ...r, reminderTimeInMinutes: reminder_time_in_minutes, reminder_time_in_minutes })),
        accounting_entries: remote.accounting_entries?.map(({ client_id, case_id, client_name, ...r }: any) => ({ ...r, clientId: client_id, caseId: case_id, clientName: client_name, client_id, case_id, client_name })),
        assistants: remote.assistants?.map((a: any) => ({ name: a.name })),
        invoices: remote.invoices?.map(({ client_id, client_name, case_id, case_subject, issue_date, due_date, tax_rate, ...r }: any) => ({ ...r, clientId: client_id, clientName: client_name, caseId: case_id, caseSubject: case_subject, issueDate: issue_date, dueDate: due_date, taxRate: tax_rate, client_id, client_name, case_id, case_subject, issue_date, due_date, tax_rate })),
        invoice_items: remote.invoice_items?.map(({ invoice_id, ...r }: any) => ({ ...r, invoiceId: invoice_id, invoice_id })),
        case_documents: remote.case_documents?.map(({ user_id, case_id, added_at, storage_path, ...r }: any) => ({...r, userId: user_id, caseId: case_id, addedAt: added_at, storagePath: storage_path, user_id, case_id, added_at, storage_path })),
        profiles: remote.profiles?.map(({ full_name, mobile_number, is_approved, is_active, subscription_start_date, subscription_end_date, lawyer_id, permissions, ...r }: any) => ({ ...r, full_name, mobile_number, is_approved, is_active, subscription_start_date, subscription_end_date, lawyer_id, permissions })),
        site_finances: remote.site_finances,
    };
};