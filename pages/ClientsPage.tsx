
import * as React from 'react';
import ClientsTreeView from '../components/ClientsTreeView';
import ClientsListView from '../components/ClientsListView';
import DatePicker from '../components/DatePicker';
import { PlusIcon, SearchIcon, ListBulletIcon, ViewColumnsIcon, ExclamationTriangleIcon, PrintIcon, ScaleIcon, FolderOpenIcon, GavelIcon, AddressBookIcon } from '../components/icons';
import { Client, Case, Stage, Session, AccountingEntry } from '../types';
import { format_date, to_input_date_string, parse_input_date_string } from '../utils/dateUtils';
import PrintableClientReport from '../components/PrintableClientReport';
import { printElement } from '../utils/printUtils';
import { MenuItem } from '../components/ContextMenu';
import { useDebounce } from '../hooks/useDebounce';
import { useData } from '../context/DataContext';
import { useFeedback } from '../context/FeedbackContext';

interface ClientsPageProps {
    on_open_admin_task_modal: (initialData?: any) => void;
    show_context_menu: (event: React.MouseEvent, menuItems: MenuItem[]) => void;
    on_create_invoice: (clientId: string, caseId?: string) => void;
}

const ClientsPage: React.FC<ClientsPageProps> = ({ show_context_menu, on_open_admin_task_modal, on_create_invoice }) => {
    const { 
        clients, 
        set_clients, 
        accounting_entries, 
        set_accounting_entries, 
        assistants, 
        set_full_data, 
        delete_client, 
        delete_case, 
        delete_stage, 
        delete_session,
        postpone_session,
        permissions, // Destructure permissions
        effective_user_id // Use effective_user_id instead of user_id
    } = useData();
    const { showFeedback } = useFeedback();
    const [modal, set_modal] = React.useState<{ type: 'client' | 'case' | 'stage' | 'session' | null, context?: any, is_editing: boolean }>({ type: null, is_editing: false });
    const [form_data, set_form_data] = React.useState<any>({});
    const [search_query, set_search_query] = React.useState('');
    const debounced_search_query = useDebounce(search_query, 300);
    const [view_mode, set_view_mode] = React.useState<'tree' | 'list'>('tree');
    const [is_delete_session_modal_open, set_is_delete_session_modal_open] = React.useState(false);
    const [session_to_delete, set_session_to_delete] = React.useState<{ session_id: string, stage_id: string, case_id: string, client_id: string, message: string } | null>(null);
    const [is_delete_case_modal_open, set_is_delete_case_modal_open] = React.useState(false);
    const [case_to_delete, set_case_to_delete] = React.useState<{ case_id: string, client_id: string, case_subject: string } | null>(null);
    const [is_delete_client_modal_open, set_is_delete_client_modal_open] = React.useState(false);
    const [client_to_delete, set_client_to_delete] = React.useState<Client | null>(null);
    const [is_delete_stage_modal_open, set_is_delete_stage_modal_open] = React.useState(false);
    const [stage_to_delete, set_stage_to_delete] = React.useState<{ stage_id: string; case_id: string; client_id: string; stage_info: string } | null>(null);
    
    // State for contact picker support
    const [is_contact_picker_supported, set_is_contact_picker_supported] = React.useState(false);

    React.useEffect(() => {
        // Check if Contact Picker API is supported
        set_is_contact_picker_supported('contacts' in navigator && 'ContactsManager' in window);
    }, []);

    // State for printing logic
    const [is_print_choice_modal_open, set_is_print_choice_modal_open] = React.useState(false);
    const [client_for_print_choice, set_client_for_print_choice] = React.useState<Client | null>(null);
    const [is_print_modal_open, set_is_print_modal_open] = React.useState(false);
    const [print_data, set_print_data] = React.useState<{ client: Client; caseData?: Case; entries: AccountingEntry[]; totals: any } | null>(null);
    const print_client_report_ref = React.useRef<HTMLDivElement>(null);

    // State for Decide Session Modal
    const [decide_modal, set_decide_modal] = React.useState<{ is_open: boolean; session?: Session, stage?: Stage }>({ is_open: false });
    const [decide_form_data, set_decide_form_data] = React.useState({ decision_number: '', decision_summary: '', decision_notes: '' });


    const filtered_clients = React.useMemo(() => {
        if (!debounced_search_query) return clients;
        const lowercased_query = debounced_search_query.toLowerCase();

        return clients.map(client => {
            const matching_cases = client.cases.filter(c => 
                c.subject.toLowerCase().includes(lowercased_query) ||
                c.opponent_name.toLowerCase().includes(lowercased_query) ||
                c.stages.some(s => 
                    s.court.toLowerCase().includes(lowercased_query) ||
                    s.case_number.toLowerCase().includes(lowercased_query) ||
                    s.sessions.some(session => 
                        (session.postponement_reason && session.postponement_reason.toLowerCase().includes(lowercased_query)) ||
                        (session.next_postponement_reason && session.next_postponement_reason.toLowerCase().includes(lowercased_query)) ||
                        (session.assignee && session.assignee.toLowerCase().includes(lowercased_query))
                    )
                )
            );

            if (client.name.toLowerCase().includes(lowercased_query) || client.contact_info.toLowerCase().includes(lowercased_query)) {
                return client;
            }
            
            if (matching_cases.length > 0) {
                return { ...client, cases: matching_cases };
            }

            return null;
        }).filter((client): client is Client => client !== null);
    }, [clients, debounced_search_query]);


    const handle_open_modal = (type: 'client' | 'case' | 'stage' | 'session', is_editing = false, context: any = {}) => {
        set_modal({ type, context, is_editing });
        if (is_editing && context.item) {
            const item = context.item;
            if (type === 'session') {
                 set_form_data({ ...item, date: to_input_date_string(item.date), next_session_date: to_input_date_string(item.next_session_date) });
            } else if (type === 'stage') {
                const { first_session_date, decision_date, ...restOfStage } = item;
                set_form_data({ 
                    ...restOfStage, 
                    first_session_date: to_input_date_string(first_session_date),
                    decision_date: to_input_date_string(decision_date)
                });
            } else {
                set_form_data(item);
            }
        } else {
            set_form_data(context.id ? { id: context.id } : {});
        }
    };

    const handle_close_modal = () => {
        set_modal({ type: null, is_editing: false });
        set_form_data({});
    };

    const handle_form_change = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
        const { name, value, type } = e.target;
        const is_checkbox = type === 'checkbox';
        // @ts-ignore
        const val = is_checkbox ? e.target.checked : value;
        set_form_data(prev => ({ ...prev, [name]: val }));
    };
    
    const handle_import_contact = async () => {
        try {
            const props = ['name', 'tel'];
            const opts = { multiple: false };
            // @ts-ignore - Typescript might not know about contacts API
            const contacts = await navigator.contacts.select(props, opts);

            if (contacts.length > 0) {
                const contact = contacts[0];
                const name = contact.name ? contact.name[0] : '';
                const phone = contact.tel ? contact.tel[0] : '';

                set_form_data((prev: any) => ({
                    ...prev,
                    name: name || prev.name,
                    contact_info: phone || prev.contact_info
                }));
            }
        } catch (ex) {
            console.error("Contact import failed or cancelled", ex);
        }
    };
    
    const on_update_session = (session_id: string, updated_fields: Partial<Session>) => {
        set_clients(current_clients => {
            return current_clients.map(client => ({
                ...client,
                updated_at: new Date().toISOString(),
                cases: client.cases.map(case_item => ({
                    ...case_item,
                    updated_at: new Date().toISOString(),
                    stages: case_item.stages.map(stage => {
                        const session_index = stage.sessions.findIndex(s => s.id === session_id);
                        if (session_index === -1) {
                            return stage;
                        }

                        const updated_sessions = [...stage.sessions];
                        updated_sessions[session_index] = {
                            ...updated_sessions[session_index],
                            ...updated_fields,
                            updated_at: new Date().toISOString(),
                        };

                        return {
                            ...stage,
                            sessions: updated_sessions,
                            updated_at: new Date().toISOString(),
                        };
                    }),
                })),
            }));
        });
    };

    const handle_postpone_session = (session_id: string, new_date: Date, reason: string) => {
        const warning = postpone_session(session_id, to_input_date_string(new_date), reason);
        if (warning) {
            showFeedback(warning, "warning");
        }
    };

    const handle_submit = (e: React.FormEvent) => {
        e.preventDefault();
        const { type, context, is_editing } = modal;

        if (type === 'client') {
            const client_name = form_data.name?.trim();
            if (!client_name) {
                showFeedback("اسم الموكل مطلوب.", "error");
                return;
            }
            
            const normalized_client_name = client_name.toLowerCase();
            const found_client = clients.find(c => c.name.trim().toLowerCase() === normalized_client_name);

            if (found_client) {
                if (!is_editing) {
                    showFeedback(`تنبيه: الموكل "${client_name}" موجود بالفعل.`, "warning");
                    return;
                }
                if (is_editing && context?.item?.id !== found_client.id) {
                     showFeedback(`تنبيه: الموكل "${client_name}" موجود بالفعل.`, "warning");
                     return;
                }
            }
            
            if (is_editing) {
                 if (context?.item?.id) {
                    set_clients(prev => prev.map(c => c.id === context.item.id ? { ...c, ...form_data, name: client_name, user_id: effective_user_id, updated_at: new Date().toISOString() } : c));
                }
            } else {
                const new_client: Client = { 
                    id: `client-${Date.now()}`, 
                    name: client_name, 
                    contact_info: form_data.contact_info || '', 
                    cases: [],
                    user_id: effective_user_id,
                    updated_at: new Date().toISOString(),
                };
                set_clients(prev => [...prev, new_client]);
            }
        } else if (type === 'case') {
            if (is_editing) {
                set_clients(prev => prev.map(c => c.id === context.client.id ? {
                    ...c,
                    updated_at: new Date().toISOString(),
                    cases: c.cases.map(cs => cs.id === context.item.id ? { ...cs, ...form_data, updated_at: new Date().toISOString() } : cs)
                } : c));
            } else {
                const client_for_case = clients.find(c => c.id === context.client_id);
                if (client_for_case) {
                    const new_case: Case = {
                        id: `case-${Date.now()}`,
                        subject: form_data.subject || 'قضية بدون موضوع',
                        opponent_name: form_data.opponent_name || '',
                        fee_agreement: form_data.fee_agreement || '',
                        status: form_data.status || 'active',
                        client_name: client_for_case.name,
                        client_id: client_for_case.id,
                        stages: [],
                        updated_at: new Date().toISOString(),
                        user_id: effective_user_id
                    };
        
                    const { court, case_number, first_session_date, first_session_reason } = form_data;
                    if (court || case_number || first_session_date) {
                        const parsed_first_session_date = parse_input_date_string(first_session_date);
                        const new_stage: Stage = {
                            id: `stage-${Date.now()}`,
                            court: court || 'غير محدد',
                            case_number: case_number || '',
                            first_session_date: parsed_first_session_date ? to_input_date_string(parsed_first_session_date) : undefined,
                            sessions: [],
                            updated_at: new Date().toISOString(),
                            user_id: effective_user_id,
                            case_id: new_case.id
                        };
        
                        if (parsed_first_session_date) {
                            const new_session: Session = {
                                id: `session-${Date.now()}-first`,
                                court: new_stage.court,
                                case_number: new_stage.case_number,
                                date: to_input_date_string(parsed_first_session_date),
                                client_name: client_for_case.name,
                                opponent_name: new_case.opponent_name,
                                is_postponed: false,
                                postponement_reason: first_session_reason || undefined,
                                assignee: 'بدون تخصيص',
                                updated_at: new Date().toISOString(),
                                user_id: effective_user_id,
                                stage_id: new_stage.id
                            };
                            new_stage.sessions.push(new_session);
                        }
        
                        new_case.stages.push(new_stage);
                    }
        
                    set_clients(prev => prev.map(c => c.id === context.client_id ? { ...c, updated_at: new Date().toISOString(), cases: [...c.cases, new_case] } : c));
                }
            }
        } else if (type === 'stage') {
            if (is_editing) {
                const stage_data = { ...form_data };
                const parsed_first = parse_input_date_string(stage_data.first_session_date);
                const parsed_decision = parse_input_date_string(stage_data.decision_date);
                stage_data.first_session_date = parsed_first ? to_input_date_string(parsed_first) : undefined;
                stage_data.decision_date = parsed_decision ? to_input_date_string(parsed_decision) : undefined;
                
                set_clients(prev => prev.map(c => c.id === context.client.id ? {
                    ...c,
                    updated_at: new Date().toISOString(),
                    cases: c.cases.map(cs => cs.id === context.case.id ? {
                        ...cs,
                        updated_at: new Date().toISOString(),
                        stages: cs.stages.map(st => st.id === context.item.id ? { ...st, ...stage_data, updated_at: new Date().toISOString() } : st)
                    } : cs)
                } : c));
            } else {
                const stage_data = { ...form_data };
                const parsed_first_session_date = parse_input_date_string(stage_data.first_session_date);
                const new_stage: Stage = {
                    id: `stage-${Date.now()}`,
                    court: stage_data.court || 'غير محدد',
                    case_number: stage_data.case_number || '',
                    first_session_date: parsed_first_session_date ? to_input_date_string(parsed_first_session_date) : undefined,
                    sessions: [],
                    user_id: effective_user_id,
                    updated_at: new Date().toISOString(),
                };
                 if (parsed_first_session_date) {
                    const client = clients.find(c => c.id === context.client_id);
                    const case_item = client?.cases.find(c => c.id === context.case_id);
                    if (client && case_item) {
                        new_stage.sessions.push({
                            id: `session-${Date.now()}-first`,
                            court: new_stage.court,
                            case_number: new_stage.case_number,
                            date: to_input_date_string(parsed_first_session_date),
                            client_name: client.name,
                            opponent_name: case_item.opponent_name,
                            is_postponed: false,
                            postponement_reason: stage_data.first_session_reason || undefined,
                            assignee: 'بدون تخصيص',
                            user_id: effective_user_id,
                            updated_at: new Date().toISOString(),
                        });
                    }
                }
                set_clients(prev => prev.map(c => c.id === context.client_id ? {
                    ...c,
                    updated_at: new Date().toISOString(),
                    cases: c.cases.map(cs => cs.id === context.case_id ? { ...cs, updated_at: new Date().toISOString(), stages: [...cs.stages, new_stage] } : cs)
                } : c));
            }
        } else if (type === 'session') {
            if (is_editing) {
                 const session_data = { ...form_data };
                 const parsed_date = parse_input_date_string(session_data.date);
                 if (!parsed_date) {
                     showFeedback("تاريخ الجلسة غير صالح.", "error");
                     return;
                 }
                 session_data.date = to_input_date_string(parsed_date);
                 const parsed_next = parse_input_date_string(session_data.next_session_date);
                 session_data.next_session_date = parsed_next ? to_input_date_string(parsed_next) : undefined;

                 set_clients(prev => prev.map(c => c.id === context.client.id ? {
                    ...c,
                    updated_at: new Date().toISOString(),
                    cases: c.cases.map(cs => cs.id === context.case.id ? {
                        ...cs,
                        updated_at: new Date().toISOString(),
                        stages: cs.stages.map(st => st.id === context.stage.id ? {
                            ...st,
                            updated_at: new Date().toISOString(),
                            sessions: st.sessions.map(s => s.id === context.item.id ? { ...s, ...session_data, updated_at: new Date().toISOString() } : s)
                        } : st)
                    } : cs)
                } : c));
            } else {
                const parsed_date = parse_input_date_string(form_data.date);
                if (!parsed_date) {
                    showFeedback("تاريخ الجلسة غير صالح.", "error");
                    return;
                }
                const client = clients.find(c => c.id === context.client_id);
                const case_item = client?.cases.find(c => c.id === context.case_id);
                const stage = case_item?.stages.find(st => st.id === context.stage_id);
                if (client && case_item && stage) {
                    const new_session: Session = {
                        id: `session-${Date.now()}`,
                        date: to_input_date_string(parsed_date),
                        court: stage.court,
                        case_number: stage.case_number,
                        client_name: client.name,
                        opponent_name: case_item.opponent_name,
                        is_postponed: false,
                        assignee: form_data.assignee || 'بدون تخصيص',
                        updated_at: new Date().toISOString(),
                        user_id: effective_user_id,
                        stage_id: stage.id
                    };
                    set_clients(prev => prev.map(c => c.id === context.client_id ? {
                        ...c,
                        updated_at: new Date().toISOString(),
                        cases: c.cases.map(cs => cs.id === context.case_id ? { 
                            ...cs, 
                            updated_at: new Date().toISOString(), 
                            stages: cs.stages.map(st => st.id === context.stage_id ? {
                                ...st,
                                sessions: [...st.sessions, new_session],
                                updated_at: new Date().toISOString(),
                            } : st)
                        } : cs)
                    } : c));
                }
            }
        }
        handle_close_modal();
    };
    
    // Deletion Handlers
    const handle_delete_client = (client: Client) => {
        set_client_to_delete(client);
        set_is_delete_client_modal_open(true);
    };

    const handle_confirm_delete_client = () => {
        if (client_to_delete) {
            delete_client(client_to_delete.id);
        }
        set_is_delete_client_modal_open(false);
        set_client_to_delete(null);
    };

    const handle_delete_case = (case_id: string, client_id: string, case_subject: string) => {
        set_case_to_delete({ case_id, client_id, case_subject });
        set_is_delete_case_modal_open(true);
    };

    const handle_confirm_delete_case = () => {
        if (case_to_delete) {
            delete_case(case_to_delete.client_id, case_to_delete.case_id);
        }
        set_is_delete_case_modal_open(false);
        set_case_to_delete(null);
    };
    
    const handle_delete_stage = (stage_id: string, case_id: string, client_id: string) => {
        const client = clients.find(c => c.id === client_id);
        const caseItem = client?.cases.find(c => c.id === case_id);
        const stage = caseItem?.stages.find(s => s.id === stage_id);
        const stage_info = stage ? `${stage.court} (${stage.case_number})` : 'هذه المرحلة';
        set_stage_to_delete({ stage_id: stage_id, case_id: case_id, client_id: client_id, stage_info: stage_info });
        set_is_delete_stage_modal_open(true);
    };
    
    const handle_confirm_delete_stage = () => {
        if (stage_to_delete) {
            delete_stage(stage_to_delete.client_id, stage_to_delete.case_id, stage_to_delete.stage_id);
        }
        set_is_delete_stage_modal_open(false);
        set_stage_to_delete(null);
    };

    const handle_delete_session = (session_id: string, stage_id: string, case_id: string, client_id: string) => {
        const client = clients.find(c => c.id === client_id);
        const caseItem = client?.cases.find(c => c.id === case_id);
        const stage = caseItem?.stages.find(s => s.id === stage_id);
        const session = stage?.sessions.find(s => s.id === session_id);
        const message = session ? `جلسة يوم ${format_date(session.date)} الخاصة بقضية ${caseItem?.subject}` : 'هذه الجلسة';
        set_session_to_delete({ session_id, stage_id, case_id, client_id, message });
        set_is_delete_session_modal_open(true);
    };

    const handle_confirm_delete_session = () => {
        if (session_to_delete) {
            delete_session(session_to_delete.client_id, session_to_delete.case_id, session_to_delete.stage_id, session_to_delete.session_id);
        }
        set_is_delete_session_modal_open(false);
        set_session_to_delete(null);
    };
    
    // Printing
    const handlePrintClientStatement = (client_id: string) => {
        const client = clients.find(c => c.id === client_id);
        if (client) {
            set_client_for_print_choice(client);
            set_is_print_choice_modal_open(true);
        }
    };

    const handleGeneratePrintData = (client: Client, caseData?: Case) => {
        const entries = caseData 
            ? accounting_entries.filter(e => e.case_id === caseData.id)
            : accounting_entries.filter(e => e.client_id === client.id);
        
        const income = entries.filter(e => e.type === 'income').reduce((sum, e) => sum + e.amount, 0);
        const expense = entries.filter(e => e.type === 'expense').reduce((sum, e) => sum + e.amount, 0);
        
        set_print_data({ client, caseData, entries, totals: { income, expense, balance: income - expense } });
        set_is_print_choice_modal_open(false);
        set_is_print_modal_open(true);
    };
    
    // Decide Session
    const handle_open_decide_modal = (session: Session) => {
        if (!session.stage_id) return;

        let foundStage: Stage | null = null;
        for (const client of clients) {
            for (const caseItem of client.cases) {
                const stage = caseItem.stages.find(st => st.id === session.stage_id);
                if (stage) {
                    foundStage = stage;
                    break;
                }
            }
            if (foundStage) break;
        }

        if (!foundStage) return;

        set_decide_form_data({ decision_number: foundStage.decision_number || '', decision_summary: foundStage.decision_summary || '', decision_notes: foundStage.decision_notes || '' });
        set_decide_modal({ is_open: true, session, stage: foundStage });
    };

    const handle_close_decide_modal = () => set_decide_modal({ is_open: false });

    const handle_decide_submit = (e: React.FormEvent) => {
        e.preventDefault();
        const { session, stage } = decide_modal;
        if (!session || !stage) return;

        set_clients(currentClients => currentClients.map(client => ({
            ...client,
            updated_at: new Date().toISOString(),
            cases: client.cases.map(c => ({
                ...c,
                updated_at: new Date().toISOString(),
                stages: c.stages.map(st => {
                    if (st.id === stage.id) {
                        return {
                            ...st,
                            decision_date: session.date,
                            decision_number: decide_form_data.decision_number,
                            decision_summary: decide_form_data.decision_summary,
                            decision_notes: decide_form_data.decision_notes,
                            updated_at: new Date().toISOString(),
                        };
                    }
                    return st;
                })
            }))
        })));
        
        handle_close_decide_modal();
    };
    
    const getModalTitle = () => {
        const { type, is_editing } = modal;
        if (!type) return '';
        const action = is_editing ? 'تعديل' : 'إضافة';
        switch (type) {
            case 'client': return `${action} موكل`;
            case 'case': return `${action} قضية`;
            case 'stage': return `${action} مرحلة تقاضي`;
            case 'session': return `${action} جلسة`;
            default: return '';
        }
    };

    return (
        <div className="space-y-6">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                 <h1 className="text-3xl font-bold text-gray-800">الموكلين والقضايا</h1>
                 <div className="flex items-center gap-2">
                    {permissions.can_add_client && (
                        <button onClick={() => handle_open_modal('client')} className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white font-semibold rounded-lg hover:bg-blue-700 transition-colors">
                            <PlusIcon className="w-5 h-5" />
                            <span>إضافة موكل</span>
                        </button>
                    )}
                 </div>
            </div>
            
            <div className="bg-white p-4 rounded-lg shadow space-y-4">
                 <div className="flex justify-between items-center flex-wrap gap-4">
                    <div className="relative flex-grow">
                        <input type="search" placeholder="ابحث عن موكل، قضية، محكمة..." value={search_query} onChange={(e) => set_search_query(e.target.value)} className="w-full sm:w-80 p-2 ps-10 text-sm border border-gray-300 rounded-lg bg-gray-50 focus:ring-blue-500 focus:border-blue-500" />
                        <div className="absolute inset-y-0 start-0 flex items-center ps-3 pointer-events-none">
                            <SearchIcon className="w-4 h-4 text-gray-500" />
                        </div>
                    </div>
                    <div className="flex items-center gap-2 p-1 bg-gray-100 rounded-lg">
                        <button onClick={() => set_view_mode('tree')} className={`p-2 rounded-md ${view_mode === 'tree' ? 'bg-white shadow' : ''}`} title="عرض شجري"><ViewColumnsIcon className="w-5 h-5" /></button>
                        <button onClick={() => set_view_mode('list')} className={`p-2 rounded-md ${view_mode === 'list' ? 'bg-white shadow' : ''}`} title="عرض قائمة"><ListBulletIcon className="w-5 h-5" /></button>
                    </div>
                </div>
            </div>

            <div>
                {view_mode === 'tree' ? (
                    <ClientsTreeView 
                        clients={filtered_clients} 
                        set_clients={set_clients} 
                        accounting_entries={accounting_entries} 
                        set_accounting_entries={set_accounting_entries} 
                        on_add_case={permissions.can_add_case ? (client_id) => handle_open_modal('case', false, { client_id }) : () => {}} 
                        on_edit_case={permissions.can_edit_case ? (caseItem, client) => handle_open_modal('case', true, { item: caseItem, client }) : () => {}} 
                        on_delete_case={permissions.can_delete_case ? (case_id, client_id) => handle_delete_case(case_id, client_id, clients.find(c=>c.id===client_id)?.cases.find(cs=>cs.id===case_id)?.subject || 'هذه القضية') : () => {}} 
                        on_add_stage={permissions.can_add_case ? (client_id, case_id) => handle_open_modal('stage', false, { client_id, case_id }) : () => {}}
                        on_edit_stage={permissions.can_edit_case ? (stage, caseItem, client) => handle_open_modal('stage', true, { item: stage, case: caseItem, client }) : () => {}} 
                        on_delete_stage={permissions.can_delete_case ? handle_delete_stage : () => {}} 
                        on_add_session={permissions.can_add_session ? (client_id, case_id, stage_id) => handle_open_modal('session', false, { client_id, case_id, stage_id }) : () => {}} 
                        on_edit_session={permissions.can_edit_session ? (session, stage, caseItem, client) => handle_open_modal('session', true, { item: session, stage, case: caseItem, client }) : () => {}} 
                        on_delete_session={permissions.can_delete_session ? handle_delete_session : () => {}} 
                        on_edit_client={permissions.can_edit_client ? (client) => handle_open_modal('client', true, { item: client }) : () => {}} 
                        on_delete_client={permissions.can_delete_client ? (client_id) => handle_delete_client(clients.find(c=>c.id===client_id)!) : () => {}} 
                        on_print_client_statement={handlePrintClientStatement} 
                        assistants={assistants.map(a => typeof a === 'string' ? a : a.name)} 
                        on_postpone_session={permissions.can_postpone_session ? handle_postpone_session : undefined} 
                        on_update_session={permissions.can_edit_session ? on_update_session : undefined} 
                        on_decide={permissions.can_decide_session ? handle_open_decide_modal : undefined} 
                        show_context_menu={show_context_menu} 
                        on_open_admin_task_modal={on_open_admin_task_modal} 
                        on_create_invoice={on_create_invoice}
                        permissions={permissions} 
                    />
                ) : (
                    <ClientsListView 
                        clients={filtered_clients} 
                        set_clients={set_clients} 
                        accounting_entries={accounting_entries} 
                        set_accounting_entries={set_accounting_entries} 
                        on_add_case={permissions.can_add_case ? (client_id) => handle_open_modal('case', false, { client_id }) : () => {}} 
                        on_edit_case={permissions.can_edit_case ? (caseItem, client) => handle_open_modal('case', true, { item: caseItem, client }) : () => {}} 
                        on_delete_case={permissions.can_delete_case ? (case_id, client_id) => handle_delete_case(case_id, client_id, clients.find(c=>c.id===client_id)?.cases.find(cs=>cs.id===case_id)?.subject || 'هذه القضية') : () => {}} 
                        on_add_stage={permissions.can_add_case ? (client_id, case_id) => handle_open_modal('stage', false, { client_id, case_id }) : () => {}} 
                        on_edit_stage={permissions.can_edit_case ? (stage, caseItem, client) => handle_open_modal('stage', true, { item: stage, case: caseItem, client }) : () => {}} 
                        on_delete_stage={permissions.can_delete_case ? handle_delete_stage : () => {}} 
                        on_add_session={permissions.can_add_session ? (client_id, case_id, stage_id) => handle_open_modal('session', false, { client_id, case_id, stage_id }) : () => {}} 
                        on_edit_session={permissions.can_edit_session ? (session, stage, caseItem, client) => handle_open_modal('session', true, { item: session, stage, case: caseItem, client }) : () => {}} 
                        on_delete_session={permissions.can_delete_session ? handle_delete_session : () => {}} 
                        on_edit_client={permissions.can_edit_client ? (client) => handle_open_modal('client', true, { item: client }) : () => {}} 
                        on_delete_client={permissions.can_delete_client ? (client_id) => handle_delete_client(clients.find(c=>c.id===client_id)!) : () => {}} 
                        on_print_client_statement={handlePrintClientStatement} 
                        assistants={assistants.map(a => typeof a === 'string' ? a : a.name)} 
                        on_postpone_session={permissions.can_postpone_session ? handle_postpone_session : undefined} 
                        on_update_session={permissions.can_edit_session ? on_update_session : undefined} 
                        on_decide={permissions.can_decide_session ? handle_open_decide_modal : undefined} 
                        show_context_menu={show_context_menu} 
                        on_open_admin_task_modal={on_open_admin_task_modal} 
                        on_create_invoice={on_create_invoice}
                        permissions={permissions}
                    />
                )}
            </div>

            {modal.type && (
                <div className="fixed inset-0 bg-black bg-opacity-50 flex items-start justify-center z-50 no-print p-4 overflow-y-auto" onClick={handle_close_modal}>
                    <div className="bg-white p-6 rounded-lg shadow-xl w-full max-w-lg" onClick={e => e.stopPropagation()}>
                        <h2 className="text-xl font-bold mb-4">{getModalTitle()}</h2>
                        <form onSubmit={handle_submit} className="space-y-4">
                            {/* ... (Client, Case, Stage forms remain same) ... */}
                            {modal.type === 'client' && (
                                <>
                                <div>
                                    <div className="flex justify-between items-center">
                                        <label className="block text-sm font-medium">اسم الموكل</label>
                                        {is_contact_picker_supported && (
                                            <button 
                                                type="button" 
                                                onClick={handle_import_contact}
                                                className="text-xs flex items-center gap-1 text-blue-600 hover:text-blue-800 transition-colors"
                                            >
                                                <AddressBookIcon className="w-4 h-4" />
                                                استيراد من جهات الاتصال
                                            </button>
                                        )}
                                    </div>
                                    <input type="text" name="name" value={form_data.name || ''} onChange={handle_form_change} className="w-full p-2 border rounded mt-1" required />
                                </div>
                                <div><label className="block text-sm font-medium">معلومات الاتصال</label><input type="text" name="contact_info" value={form_data.contact_info || ''} onChange={handle_form_change} className="w-full p-2 border rounded" /></div>
                                </>
                            )}
                            {modal.type === 'case' && (
                                <>
                                <div><label className="block text-sm font-medium">موضوع القضية</label><input type="text" name="subject" value={form_data.subject || ''} onChange={handle_form_change} className="w-full p-2 border rounded" required /></div>
                                <div><label className="block text-sm font-medium">اسم الخصم</label><input type="text" name="opponent_name" value={form_data.opponent_name || ''} onChange={handle_form_change} className="w-full p-2 border rounded" /></div>
                                <div><label className="block text-sm font-medium">اتفاقية الأتعاب</label><textarea name="fee_agreement" value={form_data.fee_agreement || ''} onChange={handle_form_change} className="w-full p-2 border rounded" rows={3}></textarea></div>
                                <div><label className="block text-sm font-medium">حالة القضية</label><select name="status" value={form_data.status || 'active'} onChange={handle_form_change} className="w-full p-2 border rounded"><option value="active">نشطة</option><option value="closed">مغلقة</option><option value="on_hold">معلقة</option></select></div>
                                {!modal.is_editing && <div className="p-4 bg-gray-50 border rounded-lg space-y-4"><h3 className="font-semibold text-gray-700">إضافة المرحلة الأولى (اختياري)</h3><div><label className="block text-xs font-medium">المحكمة</label><input type="text" name="court" value={form_data.court || ''} onChange={handle_form_change} className="w-full p-2 border rounded" /></div><div className="grid grid-cols-2 gap-4"><div><label className="block text-xs font-medium">رقم الأساس</label><input type="text" name="case_number" value={form_data.case_number || ''} onChange={handle_form_change} className="w-full p-2 border rounded" /></div><div><label className="block text-xs font-medium">تاريخ أول جلسة</label><DatePicker name="first_session_date" value={form_data.first_session_date || ''} onChange={(date, name) => handle_form_change({ target: { name, value: date } } as any)} /></div></div><div><label className="block text-xs font-medium">سبب التأجيل (إن وجد)</label><input type="text" name="first_session_reason" value={form_data.first_session_reason || ''} onChange={handle_form_change} className="w-full p-2 border rounded" /></div></div>}
                                </>
                            )}
                            {modal.type === 'stage' && (
                                <>
                                <div><label className="block text-sm font-medium">المحكمة</label><input type="text" name="court" value={form_data.court || ''} onChange={handle_form_change} className="w-full p-2 border rounded" required/></div>
                                <div><label className="block text-sm font-medium">رقم الأساس</label><input type="text" name="case_number" value={form_data.case_number || ''} onChange={handle_form_change} className="w-full p-2 border rounded" /></div>
                                {!modal.is_editing && <div><label className="block text-sm font-medium">تاريخ أول جلسة (اختياري)</label><DatePicker name="first_session_date" value={form_data.first_session_date || ''} onChange={(date, name) => handle_form_change({ target: { name, value: date } } as any)} /></div>}
                                {!modal.is_editing && <div><label className="block text-sm font-medium">سبب التأجيل الأول (إن وجد)</label><input type="text" name="first_session_reason" value={form_data.first_session_reason || ''} onChange={handle_form_change} className="w-full p-2 border rounded" /></div>}
                                {modal.is_editing && <div className="p-4 bg-gray-50 border rounded-lg space-y-4"><h3 className="font-semibold">قرار الحسم (إن وجد)</h3><div className="grid grid-cols-2 gap-4"><div><label className="block text-xs font-medium">تاريخ الحسم</label><DatePicker name="decision_date" value={form_data.decision_date || ''} onChange={(date, name) => handle_form_change({ target: { name, value: date } } as any)} /></div><div><label className="block text-xs font-medium">رقم القرار</label><input type="text" name="decision_number" value={form_data.decision_number || ''} onChange={handle_form_change} className="w-full p-2 border rounded" /></div></div><div><label className="block text-xs font-medium">ملخص القرار</label><textarea name="decision_summary" value={form_data.decision_summary || ''} onChange={handle_form_change} className="w-full p-2 border rounded" rows={2}></textarea></div><div><label className="block text-xs font-medium">ملاحظات</label><textarea name="decision_notes" value={form_data.decision_notes || ''} onChange={handle_form_change} className="w-full p-2 border rounded" rows={2}></textarea></div></div>}
                                </>
                            )}
                            {modal.type === 'session' && (
                                <>
                                <div><label className="block text-sm font-medium">تاريخ الجلسة</label><DatePicker name="date" value={form_data.date || ''} onChange={(date, name) => handle_form_change({ target: { name, value: date } } as any)} required /></div>
                                {modal.is_editing && <div><label className="block text-sm font-medium">سبب التأجيل (السابق)</label><input type="text" name="postponement_reason" value={form_data.postponement_reason || ''} onChange={handle_form_change} className="w-full p-2 border rounded" /></div>}
                                <div><label className="block text-sm font-medium">المكلف بالحضور</label><select name="assignee" value={form_data.assignee || 'بدون تخصيص'} onChange={handle_form_change} className="w-full p-2 border rounded">{assistants.map(a => {
                                    const name = typeof a === 'string' ? a : a.name;
                                    return <option key={name} value={name}>{name}</option>;
                                })}</select></div>
                                </>
                            )}
                            <div className="mt-6 flex justify-end gap-4"><button type="button" onClick={handle_close_modal} className="px-4 py-2 bg-gray-200 rounded-lg">إلغاء</button><button type="submit" className="px-4 py-2 bg-blue-600 text-white rounded-lg">حفظ</button></div>
                        </form>
                    </div>
                </div>
            )}
            
            {/* ... (Delete modals remain same) ... */}
            {is_delete_client_modal_open && client_to_delete && (<div className="fixed inset-0 bg-black bg-opacity-50 flex items-start justify-center z-50 no-print p-4 overflow-y-auto" onClick={() => set_is_delete_client_modal_open(false)}><div className="bg-white p-8 rounded-lg shadow-xl w-full max-w-md" onClick={e => e.stopPropagation()}><div className="text-center"><div className="mx-auto flex items-center justify-center h-16 w-16 rounded-full bg-red-100 mb-4"><ExclamationTriangleIcon className="h-8 w-8 text-red-600" /></div><h3 className="text-2xl font-bold">تأكيد حذف الموكل</h3><p className="my-4">هل أنت متأكد من حذف الموكل "{client_to_delete.name}"؟ سيتم حذف جميع القضايا والبيانات المرتبطة به بشكل نهائي.</p></div><div className="mt-6 flex justify-center gap-4"><button className="px-6 py-2 bg-gray-200 rounded-lg" onClick={() => set_is_delete_client_modal_open(false)}>إلغاء</button><button className="px-6 py-2 bg-red-600 text-white rounded-lg" onClick={handle_confirm_delete_client}>نعم، قم بالحذف</button></div></div></div>)}
            {is_delete_case_modal_open && case_to_delete && (<div className="fixed inset-0 bg-black bg-opacity-50 flex items-start justify-center z-50 no-print p-4 overflow-y-auto" onClick={() => set_is_delete_case_modal_open(false)}><div className="bg-white p-8 rounded-lg shadow-xl w-full max-w-md" onClick={e => e.stopPropagation()}><div className="text-center"><div className="mx-auto flex items-center justify-center h-16 w-16 rounded-full bg-red-100 mb-4"><ExclamationTriangleIcon className="h-8 w-8 text-red-600" /></div><h3 className="text-2xl font-bold">تأكيد حذف القضية</h3><p className="my-4">هل أنت متأكد من حذف قضية "{case_to_delete.case_subject}"؟</p></div><div className="mt-6 flex justify-center gap-4"><button className="px-6 py-2 bg-gray-200 rounded-lg" onClick={() => set_is_delete_case_modal_open(false)}>إلغاء</button><button className="px-6 py-2 bg-red-600 text-white rounded-lg" onClick={handle_confirm_delete_case}>نعم، قم بالحذف</button></div></div></div>)}
            {is_delete_stage_modal_open && stage_to_delete && (<div className="fixed inset-0 bg-black bg-opacity-50 flex items-start justify-center z-50 no-print p-4 overflow-y-auto" onClick={() => set_is_delete_stage_modal_open(false)}><div className="bg-white p-8 rounded-lg shadow-xl w-full max-w-md" onClick={e => e.stopPropagation()}><div className="text-center"><div className="mx-auto flex items-center justify-center h-16 w-16 rounded-full bg-red-100 mb-4"><ExclamationTriangleIcon className="h-8 w-8 text-red-600" /></div><h3 className="text-2xl font-bold">تأكيد حذف المرحلة</h3><p className="my-4">هل أنت متأكد من حذف مرحلة "{stage_to_delete.stage_info}"؟</p></div><div className="mt-6 flex justify-center gap-4"><button className="px-6 py-2 bg-gray-200 rounded-lg" onClick={() => set_is_delete_stage_modal_open(false)}>إلغاء</button><button className="px-6 py-2 bg-red-600 text-white rounded-lg" onClick={handle_confirm_delete_stage}>نعم، قم بالحذف</button></div></div></div>)}
            {is_delete_session_modal_open && session_to_delete && (<div className="fixed inset-0 bg-black bg-opacity-50 flex items-start justify-center z-50 no-print p-4 overflow-y-auto" onClick={() => set_is_delete_session_modal_open(false)}><div className="bg-white p-8 rounded-lg shadow-xl w-full max-w-md" onClick={e => e.stopPropagation()}><div className="text-center"><div className="mx-auto flex items-center justify-center h-16 w-16 rounded-full bg-red-100 mb-4"><ExclamationTriangleIcon className="h-8 w-8 text-red-600" /></div><h3 className="text-2xl font-bold">تأكيد حذف الجلسة</h3><p className="my-4">هل أنت متأكد من حذف "{session_to_delete.message}"؟</p></div><div className="mt-6 flex justify-center gap-4"><button className="px-6 py-2 bg-gray-200 rounded-lg" onClick={() => set_is_delete_session_modal_open(false)}>إلغاء</button><button className="px-6 py-2 bg-red-600 text-white rounded-lg" onClick={handle_confirm_delete_session}>نعم، قم بالحذف</button></div></div></div>)}
            {is_print_choice_modal_open && client_for_print_choice && (
                <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 no-print" onClick={() => set_is_print_choice_modal_open(false)}>
                    <div className="bg-white p-6 rounded-lg shadow-xl w-full max-w-lg" onClick={e => e.stopPropagation()}>
                        <h2 className="text-xl font-bold mb-4 border-b pb-3">اختر كشف الحساب للطباعة</h2>
                        <div className="space-y-3 max-h-80 overflow-y-auto">
                            <button onClick={() => handleGeneratePrintData(client_for_print_choice)} className="w-full text-right px-4 py-3 bg-blue-50 text-blue-800 font-semibold rounded-lg hover:bg-blue-100">كشف حساب شامل للموكل</button>
                            {client_for_print_choice.cases.map(c => <button key={c.id} onClick={() => handleGeneratePrintData(client_for_print_choice, c)} className="w-full text-right block px-4 py-2 bg-gray-50 text-gray-800 rounded-md hover:bg-gray-100">كشف حساب قضية: {c.subject}</button>)}
                        </div>
                    </div>
                </div>
            )}
            {is_print_modal_open && print_data && (
                <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[100] no-print" onClick={() => set_is_print_modal_open(false)}>
                    <div className="bg-white p-2 rounded-lg shadow-xl w-full max-w-4xl max-h-[90vh] flex flex-col" onClick={e => e.stopPropagation()}>
                        <div className="overflow-y-auto" ref={print_client_report_ref}><PrintableClientReport client={print_data.client} caseData={print_data.caseData} entries={print_data.entries} totals={print_data.totals} /></div>
                        <div className="mt-4 flex justify-end gap-4 border-t p-4"><button onClick={() => set_is_print_modal_open(false)} className="px-6 py-2 bg-gray-200 rounded-lg">إغلاق</button><button onClick={() => printElement(print_client_report_ref.current, showFeedback)} className="flex items-center gap-2 px-6 py-2 bg-blue-600 text-white rounded-lg"><PrintIcon className="w-5 h-5"/>طباعة</button></div>
                    </div>
                </div>
            )}
            {decide_modal.is_open && decide_modal.session && (
                <div className="fixed inset-0 bg-black bg-opacity-50 flex items-start justify-center z-50 no-print p-4 overflow-y-auto" onClick={handle_close_decide_modal}>
                    <div className="bg-white p-6 rounded-lg shadow-xl w-full max-w-lg" onClick={e => e.stopPropagation()}>
                        <h2 className="text-xl font-bold mb-4 flex items-center gap-2"><GavelIcon className="w-6 h-6"/> تسجيل قرار الحسم</h2>
                        <form onSubmit={handle_decide_submit} className="space-y-4">
                            <div><label className="block text-sm font-medium">تاريخ الحسم</label><DatePicker value={to_input_date_string(decide_modal.session.date)} onChange={() => {}} disabled className="bg-gray-100" /></div>
                            <div><label className="block text-sm font-medium">رقم القرار</label><input type="text" value={decide_form_data.decision_number} onChange={e => set_decide_form_data(p => ({...p, decision_number: e.target.value}))} className="w-full p-2 border rounded" /></div>
                            <div><label className="block text-sm font-medium">ملخص القرار</label><textarea value={decide_form_data.decision_summary} onChange={e => set_decide_form_data(p => ({...p, decision_summary: e.target.value}))} className="w-full p-2 border rounded" rows={3}></textarea></div>
                            <div><label className="block text-sm font-medium">ملاحظات</label><textarea value={decide_form_data.decision_notes} onChange={e => set_decide_form_data(p => ({...p, decision_notes: e.target.value}))} className="w-full p-2 border rounded" rows={2}></textarea></div>
                            <div className="mt-6 flex justify-end gap-4"><button type="button" onClick={handle_close_decide_modal} className="px-4 py-2 bg-gray-200 rounded-lg hover:bg-gray-300">إلغاء</button><button type="submit" className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700">حفظ القرار</button></div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
};
export default ClientsPage;
