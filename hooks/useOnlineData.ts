
import { get_supabase_client } from '../supabaseClient';
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

export const check_supabase_schema = async () => {
    const supabase = get_supabase_client();
    if (!supabase) {
        return { success: false, error: 'unconfigured', message: 'Supabase client is not configured.' };
    }

    const max_retries = 3;
    let attempt = 0;

    while (attempt < max_retries) {
        try {
            // Test a simple query to verify connection and credentials
            const { error } = await supabase.from('profiles').select('id', { head: true, count: 'exact' }).limit(1);
            
            if (error) {
                console.error("Supabase schema check error:", error);
                const message = String(error.message || '').toLowerCase();
                if (message.includes('failed to fetch') || message.includes('abort') || message.includes('lock') || message.includes('network')) {
                    if (attempt < max_retries - 1) {
                        attempt++;
                        console.warn(`check_supabase_schema attempt ${attempt} failed: ${message}. Retrying...`);
                        await new Promise(resolve => setTimeout(resolve, 1000 * attempt + Math.random() * 500));
                        continue;
                    }
                    return { success: false, error: 'network', message: 'تعذر الاتصال بالخادم. يرجى التحقق من اتصال الإنترنت أو إعدادات CORS.' };
                }
                if (error.code === '42P01') {
                    return { success: false, error: 'uninitialized', message: 'قاعدة البيانات غير مهيأة بشكل كامل.' };
                }
                throw error;
            }
            return { success: true, error: null, message: '' };
        } catch (err: any) {
            console.error("CRITICAL: check_supabase_schema exception:", err);
            const message = String(err.message || '').toLowerCase();
            if ((message.includes('failed to fetch') || message.includes('abort') || message.includes('lock') || message.includes('network')) && attempt < max_retries - 1) {
                attempt++;
                await new Promise(resolve => setTimeout(resolve, 1000 * attempt + Math.random() * 500));
                continue;
            }
            return { success: false, error: 'unknown', message: `حدث خطأ غير متوقع أثناء فحص الاتصال: ${err.message || 'خطأ غير معروف'}` };
        }
    }
    return { success: false, error: 'unknown', message: 'فشل الاتصال بعد عدة محاولات.' };
};

export const fetch_data_from_supabase = async (user_id?: string): Promise<Partial<FlatData>> => {
    const supabase = get_supabase_client();
    if (!supabase) throw new Error('Supabase client not available.');

    const query = (table: string) => {
        let q = supabase.from(table).select('*');
        if (user_id && table !== 'profiles' && table !== 'assistants') {
            q = q.eq('user_id', user_id);
        }
        if (user_id && table === 'assistants') {
            q = q.eq('user_id', user_id);
        }
        return q;
    };

    const max_retries = 3;
    let attempt = 0;

    while (attempt < max_retries) {
        try {
            // Ensure session is fresh before parallel calls to avoid lock stealing
            // We await this sequentially first.
            await supabase.auth.getSession();

            // Sequentialize these calls to avoid concurrent auth token refresh attempts and network congestion
            // which often leads to "Failed to fetch" errors in unstable environments.
            const clients_res = await query('clients');
            if (clients_res.error) throw clients_res.error;

            const admin_tasks_res = await query('admin_tasks');
            if (admin_tasks_res.error) throw admin_tasks_res.error;

            const appointments_res = await query('appointments');
            if (appointments_res.error) throw appointments_res.error;

            const accounting_entries_res = await query('accounting_entries');
            if (accounting_entries_res.error) throw accounting_entries_res.error;

            const assistants_res = await query('assistants');
            if (assistants_res.error) throw assistants_res.error;

            const invoices_res = await query('invoices');
            if (invoices_res.error) throw invoices_res.error;

            const cases_res = await query('cases');
            if (cases_res.error) throw cases_res.error;

            const stages_res = await query('stages');
            if (stages_res.error) throw stages_res.error;

            const sessions_res = await query('sessions');
            if (sessions_res.error) throw sessions_res.error;

            const invoice_items_res = await query('invoice_items');
            if (invoice_items_res.error) throw invoice_items_res.error;

            const case_documents_res = await query('case_documents');
            if (case_documents_res.error) throw case_documents_res.error;

            const profiles_res = await (user_id ? supabase.from('profiles').select('*').eq('id', user_id) : supabase.from('profiles').select('*'));
            if (profiles_res.error) throw profiles_res.error;

            const site_finances_res = await query('site_finances');
            if (site_finances_res.error) throw site_finances_res.error;

            return {
                clients: clients_res.data || [],
                cases: cases_res.data || [],
                stages: stages_res.data || [],
                sessions: sessions_res.data || [],
                admin_tasks: admin_tasks_res.data || [],
                appointments: appointments_res.data || [],
                accounting_entries: accounting_entries_res.data || [],
                assistants: assistants_res.data || [],
                invoices: invoices_res.data || [],
                invoice_items: invoice_items_res.data || [],
                case_documents: case_documents_res.data || [],
                profiles: profiles_res.data || [],
                site_finances: site_finances_res.data || [],
            };
        } catch (err: any) {
            attempt++;
            const message = String(err.message || '').toLowerCase();
            const is_abort = message.includes('abort') || message.includes('lock') || message.includes('failed to fetch') || message.includes('network');
            
            if (is_abort && attempt < max_retries) {
                console.warn(`Fetch attempt ${attempt} failed: ${message}. Retrying...`);
                // Wait a bit before retrying, with some randomness
                await new Promise(resolve => setTimeout(resolve, 500 * attempt + Math.random() * 500));
                continue;
            }
            console.error("CRITICAL: fetch_data_from_supabase failed after retries:", err);
            throw err;
        }
    }
    throw new Error('Failed to fetch data after multiple attempts.');
};

export const fetch_deletions_from_supabase = async (): Promise<SyncDeletion[]> => {
    const supabase = get_supabase_client();
    if (!supabase) return [];
    const thirty_days_ago = new Date();
    thirty_days_ago.setDate(thirty_days_ago.getDate() - 30);
    
    const max_retries = 3;
    let attempt = 0;

    while (attempt < max_retries) {
        try {
            const { data, error } = await supabase.from('sync_deletions').select('*').gte('deleted_at', thirty_days_ago.toISOString());
            if (error) {
                const message = String(error.message || '').toLowerCase();
                if (message.includes('abort') || message.includes('lock') || message.includes('failed to fetch')) {
                    if (attempt < max_retries - 1) {
                        attempt++;
                        console.warn(`fetch_deletions_from_supabase attempt ${attempt} failed: ${message}. Retrying...`);
                        await new Promise(resolve => setTimeout(resolve, 500 * attempt + Math.random() * 500));
                        continue;
                    }
                }
                throw error;
            }
            return data || [];
        } catch (err: any) {
            const message = String(err.message || '').toLowerCase();
            if ((message.includes('abort') || message.includes('lock') || message.includes('failed to fetch')) && attempt < max_retries - 1) {
                attempt++;
                await new Promise(resolve => setTimeout(resolve, 500 * attempt + Math.random() * 500));
                continue;
            }
            console.warn("Fetch deletions failed:", err);
            return []; 
        }
    }
    return [];
};

export const delete_data_from_supabase = async (deletions: Partial<FlatData>, user: User) => {
    const supabase = get_supabase_client();
    if (!supabase) throw new Error('Supabase client not available.');
    
    const max_retries = 3;
    const deletion_order: (keyof FlatData)[] = [
        'case_documents', 'invoice_items', 'sessions', 'stages', 'cases', 'invoices', 
        'admin_tasks', 'appointments', 'accounting_entries', 'assistants', 'clients',
        'site_finances', 'profiles',
    ];

    for (const table of deletion_order) {
        const items_to_delete = (deletions as any)[table];
        if (items_to_delete && items_to_delete.length > 0) {
            const primary_key_column = table === 'assistants' ? 'name' : 'id';
            const ids = items_to_delete.map((i: any) => i[primary_key_column]);
            
            let attempt = 0;
            while (attempt < max_retries) {
                try {
                    if (table !== 'profiles') {
                        const deletions_log = ids.map((id: string) => ({ table_name: table, record_id: id, user_id: user.id }));
                        const { error: log_error } = await supabase.from('sync_deletions').insert(deletions_log);
                        if (log_error) throw log_error;
                    }
                    const { error } = await supabase.from(table).delete().in(primary_key_column, ids);
                    if (error) throw error;
                    break; // Success
                } catch (err: any) {
                    const message = String(err.message || '').toLowerCase();
                    if ((message.includes('abort') || message.includes('lock') || message.includes('failed to fetch')) && attempt < max_retries - 1) {
                        attempt++;
                        console.warn(`delete_data_from_supabase ${table} attempt ${attempt} failed: ${message}. Retrying...`);
                        await new Promise(resolve => setTimeout(resolve, 500 * attempt + Math.random() * 500));
                        continue;
                    }
                    throw err;
                }
            }
        }
    }
};

export const upsert_data_to_supabase = async (data: Partial<FlatData>, user: User) => {
    const supabase = get_supabase_client();
    if (!supabase) throw new Error('Supabase client not available.');

    // Fetch profile to determine the correct user_id (lawyer_id if assistant)
    const { data: profile, error: profile_error } = await supabase
        .from('profiles')
        .select('lawyer_id')
        .eq('id', user.id)
        .maybeSingle();
    if (profile_error) throw profile_error;
    
    const user_id_to_use = profile?.lawyer_id || user.id; // Use lawyer_id if assistant, else user.id

    const data_to_upsert = {
        clients: data.clients?.map(client => ({ 
            id: client.id,
            name: client.name,
            contact_info: client.contact_info,
            updated_at: client.updated_at,
            user_id: user_id_to_use
        })),
        cases: data.cases?.map(case_item => ({ 
            id: case_item.id,
            subject: case_item.subject,
            client_name: case_item.client_name,
            opponent_name: case_item.opponent_name,
            fee_agreement: case_item.fee_agreement,
            status: case_item.status,
            updated_at: case_item.updated_at,
            client_id: case_item.client_id,
            user_id: user_id_to_use
        })),
        stages: data.stages?.map(stage => ({ 
            id: stage.id,
            court: stage.court,
            case_number: stage.case_number,
            first_session_date: stage.first_session_date,
            decision_date: stage.decision_date,
            decision_number: stage.decision_number,
            decision_summary: stage.decision_summary,
            decision_notes: stage.decision_notes,
            updated_at: stage.updated_at,
            case_id: stage.case_id,
            user_id: user_id_to_use
        })),
        sessions: data.sessions?.map((s: any) => ({ 
            id: s.id,
            court: s.court,
            case_number: s.case_number,
            date: s.date,
            client_name: s.client_name,
            opponent_name: s.opponent_name,
            postponement_reason: s.postponement_reason,
            next_postponement_reason: s.next_postponement_reason,
            is_postponed: s.is_postponed,
            next_session_date: s.next_session_date,
            assignee: s.assignee,
            stage_id: s.stage_id,
            stage_decision_date: s.stage_decision_date,
            updated_at: s.updated_at,
            user_id: user_id_to_use
        })),
        admin_tasks: data.admin_tasks?.map((task: any) => ({ 
            id: task.id,
            task: task.task,
            due_date: task.due_date,
            completed: task.completed,
            importance: task.importance,
            assignee: task.assignee,
            location: task.location,
            updated_at: task.updated_at,
            order_index: task.order_index,
            user_id: user_id_to_use
        })),
        appointments: data.appointments?.map((apt: any) => ({ 
            id: apt.id,
            title: apt.title,
            time: apt.time,
            date: apt.date,
            importance: apt.importance,
            completed: apt.completed,
            notified: apt.notified,
            reminder_time_in_minutes: apt.reminder_time_in_minutes,
            assignee: apt.assignee,
            updated_at: apt.updated_at,
            user_id: user_id_to_use
        })),
        accounting_entries: data.accounting_entries?.map((entry: any) => ({ 
            id: entry.id,
            type: entry.type,
            amount: entry.amount,
            date: entry.date,
            description: entry.description,
            client_id: entry.client_id,
            case_id: entry.case_id,
            client_name: entry.client_name,
            updated_at: entry.updated_at,
            user_id: user_id_to_use
        })),
        assistants: data.assistants?.map(item => ({ name: item.name, user_id: user_id_to_use })),
        invoices: data.invoices?.map(inv => ({ 
            id: inv.id,
            client_id: inv.client_id,
            client_name: inv.client_name,
            case_id: inv.case_id,
            case_subject: inv.case_subject,
            issue_date: inv.issue_date,
            due_date: inv.due_date,
            tax_rate: inv.tax_rate,
            discount: inv.discount,
            status: inv.status,
            notes: inv.notes,
            updated_at: inv.updated_at,
            user_id: user_id_to_use
        })),
        invoice_items: data.invoice_items?.map((item: any) => ({ 
            id: item.id,
            invoice_id: item.invoice_id,
            description: item.description,
            amount: item.amount,
            updated_at: item.updated_at,
            user_id: user_id_to_use
        })),
        case_documents: data.case_documents?.map((doc: any) => ({ 
            id: doc.id,
            case_id: doc.case_id,
            name: doc.name,
            type: doc.type,
            size: doc.size,
            added_at: doc.added_at,
            storage_path: doc.storage_path,
            updated_at: doc.updated_at,
            user_id: user_id_to_use
        })),
        profiles: data.profiles?.map((profile: any) => ({ 
            id: profile.id,
            full_name: profile.full_name,
            mobile_number: profile.mobile_number,
            is_approved: profile.is_approved,
            is_active: profile.is_active,
            mobile_verified: profile.mobile_verified,
            subscription_start_date: profile.subscription_start_date,
            subscription_end_date: profile.subscription_end_date,
            role: profile.role,
            permissions: profile.permissions,
            lawyer_id: profile.lawyer_id,
            admin_tasks_layout: profile.admin_tasks_layout,
            created_at: profile.created_at,
            updated_at: profile.updated_at
        })),
        site_finances: data.site_finances?.map((finance: any) => ({ 
            id: finance.id,
            type: finance.type,
            payment_date: finance.payment_date,
            amount: finance.amount,
            description: finance.description,
            payment_method: finance.payment_method,
            category: finance.category,
            user_id: finance.user_id,
            updated_at: finance.updated_at
        })),
    };
    
    const upsert_table = async (table: string, records: any[] | undefined, on_conflict?: string) => {
        if (!records || records.length === 0) return [];
        
        const max_retries = 3;
        let attempt = 0;

        while (attempt < max_retries) {
            try {
                const { data: response_data, error } = await supabase.from(table).upsert(records, { onConflict: on_conflict }).select();
                if (error) {
                    const message = String(error.message || '').toLowerCase();
                    if (message.includes('abort') || message.includes('lock') || message.includes('failed to fetch')) {
                        if (attempt < max_retries - 1) {
                            attempt++;
                            console.warn(`upsert_table ${table} attempt ${attempt} failed: ${message}. Retrying...`);
                            await new Promise(resolve => setTimeout(resolve, 500 * attempt + Math.random() * 500));
                            continue;
                        }
                    }
                    throw error;
                }
                return response_data || [];
            } catch (err: any) {
                const message = String(err.message || '').toLowerCase();
                if ((message.includes('abort') || message.includes('lock') || message.includes('failed to fetch')) && attempt < max_retries - 1) {
                    attempt++;
                    await new Promise(resolve => setTimeout(resolve, 500 * attempt + Math.random() * 500));
                    continue;
                }
                throw err;
            }
        }
        throw new Error(`Failed to upsert to ${table} after multiple attempts.`);
    };
    
    const results: Partial<Record<keyof FlatData, any[]>> = {};
    results.profiles = await upsert_table('profiles', data_to_upsert.profiles);
    results.assistants = await upsert_table('assistants', data_to_upsert.assistants, 'user_id,name');
    results.clients = await upsert_table('clients', data_to_upsert.clients);
    results.cases = await upsert_table('cases', data_to_upsert.cases);
    results.stages = await upsert_table('stages', data_to_upsert.stages);
    results.sessions = await upsert_table('sessions', data_to_upsert.sessions);
    results.invoices = await upsert_table('invoices', data_to_upsert.invoices);
    results.invoice_items = await upsert_table('invoice_items', data_to_upsert.invoice_items);
    results.case_documents = await upsert_table('case_documents', data_to_upsert.case_documents);
    
    // Sequentialize the rest to avoid lock stealing
    results.admin_tasks = await upsert_table('admin_tasks', data_to_upsert.admin_tasks);
    results.appointments = await upsert_table('appointments', data_to_upsert.appointments);
    results.accounting_entries = await upsert_table('accounting_entries', data_to_upsert.accounting_entries);
    results.site_finances = await upsert_table('site_finances', data_to_upsert.site_finances);
    
    return results;
};

export const transform_remote_to_local = (remote: any): Partial<FlatData> => {
    if (!remote) return {};
    return {
        clients: remote.clients || [],
        cases: remote.cases || [],
        stages: remote.stages || [],
        sessions: (remote.sessions || []).map((s: any) => ({ ...s, is_postponed: Boolean(s.is_postponed) })),
        admin_tasks: remote.admin_tasks || [],
        appointments: remote.appointments || [],
        accounting_entries: remote.accounting_entries || [],
        assistants: (remote.assistants || []).map((a: any) => ({ name: a.name })),
        invoices: remote.invoices || [],
        invoice_items: remote.invoice_items || [],
        case_documents: remote.case_documents || [],
        profiles: remote.profiles || [],
        site_finances: remote.site_finances || [],
    };
};