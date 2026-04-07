
import * as React from 'react';
import Calendar from '../components/Calendar';
import DatePicker from '../components/DatePicker';
import { Session, AdminTask, Appointment, Stage, Client } from '../types';
import { format_date, is_same_day, is_before_today, to_input_date_string, safe_revive_date } from '../utils/dateUtils';
import { PrintIcon, PlusIcon, PencilIcon, TrashIcon, SearchIcon, ExclamationTriangleIcon, CalendarIcon, ChevronLeftIcon, ScaleIcon, BuildingLibraryIcon, ShareIcon, UserIcon, ClipboardDocumentIcon, ClipboardDocumentCheckIcon, HomeIcon, ListBulletIcon, ViewColumnsIcon } from '../components/icons';
import SessionsTable from '../components/SessionsTable';
import PrintableReport from '../components/PrintableReport';
import { printElement } from '../utils/printUtils';
import { MenuItem } from '../components/ContextMenu';
import { useDebounce } from '../hooks/useDebounce';
import { useData } from '../context/DataContext';

// ... (Constants importanceMap, importanceMapAdminTasks, formatTime, and AppointmentsTable remain the same)
const importance_map: { [key: string]: { text: string, className: string } } = {
    normal: { text: 'عادي', className: 'bg-gray-100 text-gray-800' },
    important: { text: 'مهم', className: 'bg-yellow-100 text-yellow-800' },
    urgent: { text: 'عاجل', className: 'bg-red-100 text-red-800' },
};

const importance_map_admin_tasks: { [key: string]: { text: string, className: string } } = {
    normal: { text: 'عادي', className: 'bg-gray-200 text-gray-800' },
    important: { text: 'مهم', className: 'bg-yellow-200 text-yellow-800' },
    urgent: { text: 'عاجل', className: 'bg-red-200 text-red-800' },
};

const format_time = (time: string) => {
    if (!time) return '';
    let [hours, minutes] = time.split(':');
    let hh = parseInt(hours, 10);
    const ampm = hh >= 12 ? 'مساءً' : 'صباحًا';
    hh = hh % 12;
    hh = hh ? hh : 12; 
    const finalHours = hh.toString().padStart(2, '0');
    return `${finalHours}:${minutes} ${ampm}`;
};

const AppointmentsTable: React.FC<{ appointments: Appointment[], on_add_appointment: () => void, on_edit: (appointment: Appointment) => void, on_delete: (appointment: Appointment) => void, on_context_menu: (event: React.MouseEvent, appointment: Appointment) => void, on_toggle_complete: (id: string) => void }> = React.memo(({ appointments, on_add_appointment, on_edit, on_delete, on_context_menu, on_toggle_complete }) => {
    const long_press_timer = React.useRef<number | null>(null);

    const handle_touch_start = (e: React.TouchEvent, appointment: Appointment) => {
        long_press_timer.current = window.setTimeout(() => {
            const touch = e.touches[0];
            const mock_event = { preventDefault: () => e.preventDefault(), clientX: touch.clientX, clientY: touch.clientY };
            on_context_menu(mock_event as any, appointment);
        }, 500);
    };

    const handle_touch_end = () => {
        if (long_press_timer.current !== null) {
            window.clearTimeout(long_press_timer.current);
            long_press_timer.current = null;
        }
    };

    return (
        <div className="bg-white rounded-lg shadow overflow-hidden print:overflow-visible">
            <div className="flex justify-between items-center p-4 bg-gray-50 border-b">
                <h3 className="text-lg font-bold">سجل المواعيد</h3>
                <button onClick={on_add_appointment} className="no-print flex items-center gap-2 px-4 py-2 bg-blue-600 text-white font-semibold rounded-lg hover:bg-blue-700 transition-colors text-sm">
                    <PlusIcon className="w-5 h-5" />
                    <span>موعد جديد</span>
                </button>
            </div>
            {appointments.length > 0 ? (
                 <div className="overflow-x-auto print:overflow-visible">
                    <table className="w-full text-sm text-right text-gray-600">
                        <thead className="text-xs text-gray-700 uppercase bg-gray-100">
                            <tr>
                                <th className="px-6 py-3 no-print">تم</th>
                                <th className="px-6 py-3">الموعد</th>
                                <th className="px-6 py-3">الوقت</th>
                                <th className="px-6 py-3">الشخص المسؤول</th>
                                <th className="px-6 py-3">الأهمية</th>
                                <th className="px-6 py-3 no-print">إجراءات</th>
                            </tr>
                        </thead>
                        <tbody>
                            {appointments.map(a => (
                                <tr 
                                    key={a.id} 
                                    onContextMenu={(e) => on_context_menu(e, a)}
                                    onTouchStart={(e) => handle_touch_start(e, a)}
                                    onTouchEnd={handle_touch_end}
                                    onTouchMove={handle_touch_end}
                                    className={`border-b transition-colors ${a.completed ? 'bg-green-50 text-gray-500 hover:bg-green-100' : 'bg-white hover:bg-gray-50'}`}>
                                    <td className="px-6 py-4 no-print">
                                        <input
                                            type="checkbox"
                                            checked={a.completed}
                                            onChange={() => on_toggle_complete(a.id)}
                                            className="w-5 h-5 text-blue-600 bg-gray-100 border-gray-300 rounded focus:ring-blue-500"
                                            aria-label={`Mark appointment ${a.title} as ${a.completed ? 'incomplete' : 'complete'}`}
                                        />
                                    </td>
                                    <td className={`px-6 py-4 ${a.completed ? 'line-through' : ''}`}>{a.title}</td>
                                    <td className={`px-6 py-4 ${a.completed ? 'line-through' : ''}`}>{format_time(a.time)}</td>
                                    <td className={`px-6 py-4 ${a.completed ? 'line-through' : ''}`}>{a.assignee}</td>
                                    <td className="px-6 py-4">
                                         <span className={`px-2 py-1 text-xs font-medium rounded-full ${importance_map[a.importance]?.className}`}>
                                            {importance_map[a.importance]?.text}
                                        </span>
                                    </td>
                                    <td className="px-6 py-4 flex items-center gap-2 no-print">
                                        <button onClick={() => on_edit(a)} className="p-2 text-gray-500 hover:text-blue-600" aria-label="تعديل"><PencilIcon className="w-4 h-4" /></button>
                                        <button onClick={() => on_delete(a)} className="p-2 text-gray-500 hover:text-red-600" aria-label="حذف"><TrashIcon className="w-4 h-4" /></button>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            ) : <p className="p-4 text-gray-500">لا توجد مواعيد لهذا اليوم.</p>}
        </div>
    );
});

interface HomePageProps {
    on_open_admin_task_modal: (initialData?: any) => void;
    show_context_menu: (event: React.MouseEvent, menuItems: MenuItem[]) => void;
    main_view: 'agenda' | 'admin_tasks';
    selected_date: Date;
    set_selected_date: (date: Date) => void;
}

const HomePage: React.FC<HomePageProps> = ({ 
    on_open_admin_task_modal, 
    show_context_menu,
    main_view,
    selected_date,
    set_selected_date 
}) => {
    const { 
        appointments, 
        all_sessions, 
        set_appointments, 
        admin_tasks, 
        set_admin_tasks, 
        assistants, 
        delete_admin_task, 
        delete_appointment,
        unpostponed_sessions,
        postpone_session,
        set_clients,
        clients,
        admin_tasks_layout,
        set_admin_tasks_layout,
        location_order: saved_location_order,
        set_location_order: set_saved_location_order,
        permissions, // Destructure permissions
        effective_user_id, // Use effective_user_id
    } = useData();

    // ... (State variables and effects remain the same)
    const [calendar_view_date, set_calendar_view_date] = React.useState(selected_date);
    type ViewMode = 'daily' | 'unpostponed' | 'upcoming';
    const [view_mode, set_view_mode] = React.useState<ViewMode>('daily');
    const [is_appointment_modal_open, set_is_appointment_modal_open] = React.useState(false);
    const [editing_appointment, set_editing_appointment] = React.useState<Appointment | null>(null);
    const [new_appointment, set_new_appointment] = React.useState<{ title: string; date: string; time: string; importance: 'normal' | 'important' | 'urgent'; reminder_time_in_minutes: number; assignee: string; }>({ title: '', date: '', time: '', importance: 'normal', reminder_time_in_minutes: 15, assignee: 'بدون تخصيص' });
    const [date_warning, set_date_warning] = React.useState<string | null>(null);

    const [active_task_tab, set_active_task_tab] = React.useState<'pending' | 'completed'>('pending');
    const [admin_task_search, set_admin_task_search] = React.useState('');
    const debounced_admin_task_search = useDebounce(admin_task_search, 300);
    const [is_delete_appointment_modal_open, set_is_delete_appointment_modal_open] = React.useState(false);
    const [appointment_to_delete, set_appointment_to_delete] = React.useState<Appointment | null>(null);
    const [is_delete_task_modal_open, set_is_delete_task_modal_open] = React.useState(false);
    const [task_to_delete, set_task_to_delete] = React.useState<AdminTask | null>(null);
    
    const dragged_task_id = React.useRef<string | null>(null);
    const [is_dragging, set_is_dragging] = React.useState(false);
    const [drag_over_task_id, set_drag_over_task_id] = React.useState<string | null>(null);
    const [drop_position, set_drop_position] = React.useState<'before' | 'after' | null>(null);
    
    const [location_order, set_location_order] = React.useState<string[]>([]);
    const [dragged_group_location, set_dragged_group_location] = React.useState<string | null>(null);
    const [active_location_tab, set_active_location_tab] = React.useState<string>('');
    const [drag_over_location, set_drag_over_location] = React.useState<string | null>(null);

    const [editing_assignee_task_id, set_editing_assignee_task_id] = React.useState<string | null>(null);
    
    const [decide_modal, set_decide_modal] = React.useState<{ is_open: boolean; session?: Session, stage?: Stage }>({ is_open: false });
    const [decide_form_data, set_decide_form_data] = React.useState({ decision_number: '', decision_summary: '', decision_notes: '' });
    
    React.useEffect(() => {
        set_calendar_view_date(selected_date);
    }, [selected_date]);

    // ... (Appointment and Task Handlers remain same)
    const handle_open_add_appointment_modal = () => {
        set_editing_appointment(null);
        set_new_appointment({ title: '', date: to_input_date_string(selected_date), time: '', importance: 'normal', reminder_time_in_minutes: 15, assignee: 'بدون تخصيص' });
        set_is_appointment_modal_open(true);
        set_date_warning(null);
    };

    const handle_open_edit_appointment_modal = (apt: Appointment) => {
        set_editing_appointment(apt);
        set_new_appointment({
            title: apt.title,
            date: to_input_date_string(apt.date),
            time: apt.time,
            importance: apt.importance,
            reminder_time_in_minutes: apt.reminder_time_in_minutes ?? 15,
            assignee: apt.assignee ?? 'بدون تخصيص',
        });
        set_is_appointment_modal_open(true);
    }

    const handle_close_appointment_modal = () => {
        set_is_appointment_modal_open(false);
        set_editing_appointment(null);
        set_date_warning(null);
    }
    
    const handle_toggle_appointment_complete = (id: string) => {
        set_appointments(prev => 
            prev.map(apt => 
                apt.id === id ? { ...apt, completed: !apt.completed, updated_at: new Date().toISOString() } : apt
            )
        );
    };

    const handle_appointment_form_change = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
        const { name, value } = e.target;
        
        if (name === 'date' && !editing_appointment) {
            const selectedInputDate = safe_revive_date(value);
            if (is_before_today(selectedInputDate)) {
                set_date_warning('تنبيه: التاريخ المحدد في الماضي.');
            } else {
                set_date_warning(null);
            }
        }
        
        const processedValue = name === 'reminder_time_in_minutes' ? Number(value) : value;
        set_new_appointment(prev => ({ ...prev, [name]: processedValue }));
    };

    const handle_save_appointment = (e: React.FormEvent) => {
        e.preventDefault();
        if (!new_appointment.title || !new_appointment.time || !new_appointment.date) return;
        
        const appointmentDate = safe_revive_date(new_appointment.date);

        if (editing_appointment) {
            set_appointments(prev => prev.map(apt => apt.id === editing_appointment.id ? {
                ...apt,
                title: new_appointment.title,
                date: to_input_date_string(appointmentDate),
                time: new_appointment.time,
                importance: new_appointment.importance,
                reminder_time_in_minutes: new_appointment.reminder_time_in_minutes,
                assignee: new_appointment.assignee,
                notified: false,
                updated_at: new Date().toISOString(),
            } : apt));
        } else {
            const newAppointmentObject: Appointment = {
                id: `apt-${Date.now()}`,
                title: new_appointment.title,
                time: new_appointment.time,
                date: to_input_date_string(appointmentDate),
                importance: new_appointment.importance,
                completed: false,
                reminder_time_in_minutes: new_appointment.reminder_time_in_minutes,
                assignee: new_appointment.assignee,
                notified: false,
                updated_at: new Date().toISOString(),
                user_id: effective_user_id,
            };
            set_appointments(prevAppointments => [...prevAppointments, newAppointmentObject]);
        }
        handle_close_appointment_modal();
    };
    
    const open_delete_appointment_modal = (appointment: Appointment) => {
        set_appointment_to_delete(appointment);
        set_is_delete_appointment_modal_open(true);
    };

    const close_delete_appointment_modal = () => {
        set_appointment_to_delete(null);
        set_is_delete_appointment_modal_open(false);
    };

    const handle_confirm_delete_appointment = () => {
        if (appointment_to_delete) {
            delete_appointment(appointment_to_delete.id);
            close_delete_appointment_modal();
        }
    };

    const open_delete_task_modal = (task: AdminTask) => {
        set_task_to_delete(task);
        set_is_delete_task_modal_open(true);
    };

    const close_delete_task_modal = () => {
        set_task_to_delete(null);
        set_is_delete_task_modal_open(false);
    };

    const handle_confirm_delete_task = () => {
        if (task_to_delete) {
            delete_admin_task(task_to_delete.id);
            close_delete_task_modal();
        }
    };

    const handle_toggle_task_complete = (id: string) => {
        set_admin_tasks(prev => prev.map(t => t.id === id ? { ...t, completed: !t.completed, updated_at: new Date().toISOString() } : t));
    };

    const handle_assignee_change = (taskId: string, newAssignee: string) => {
        set_admin_tasks(prevTasks =>
            prevTasks.map(t =>
                t.id === taskId ? { ...t, assignee: newAssignee, updated_at: new Date().toISOString() } : t
            )
        );
        set_editing_assignee_task_id(null);
    };

    const handle_share_task = (task: AdminTask) => {
        const message = [
            `*مهمة إدارية:*`,
            `*المهمة:* ${task.task}`,
            `*المكان:* ${task.location || 'غير محدد'}`,
            `*تاريخ الاستحقاق:* ${format_date(task.due_date)}`,
            `*الأهمية:* ${importance_map_admin_tasks[task.importance]?.text}`,
            `*المسؤول:* ${task.assignee || 'غير محدد'}`
        ].join('\n');

        const whatsappUrl = `https://wa.me/?text=${encodeURIComponent(message)}`;
        window.open(whatsappUrl, '_blank');
    };

    // ... (Drag and Drop Handlers remain the same)
    const handle_drag_start = (e: React.DragEvent, type: 'task' | 'group', id: string) => { e.stopPropagation(); document.body.classList.add('grabbing'); if (type === 'task') { e.dataTransfer.setData('application/lawyer-app-task-id', id); e.dataTransfer.effectAllowed = 'move'; dragged_task_id.current = id; } else { e.dataTransfer.setData('application/lawyer-app-group-location', id); e.dataTransfer.effectAllowed = 'move'; set_dragged_group_location(id); } set_is_dragging(true); };
    const handle_drag_end = () => { document.body.classList.remove('grabbing'); dragged_task_id.current = null; set_dragged_group_location(null); set_is_dragging(false); set_drag_over_task_id(null); set_drop_position(null); set_drag_over_location(null); };

    const handle_task_drop = (targetTaskId: string | null, targetLocation: string, position: 'before' | 'after') => {
        const currentDraggedId = dragged_task_id.current;
        if (!currentDraggedId) return;
    
        set_admin_tasks(currentTasks => {
            const updatedTasks = currentTasks.map(t => ({...t}));
    
            const draggedTask = updatedTasks.find(t => t.id === currentDraggedId);
            if (!draggedTask) return currentTasks;
    
            const sourceLocation = draggedTask.location || 'غير محدد';
            const isChangingGroup = sourceLocation !== targetLocation;
            
            draggedTask.location = targetLocation;
            draggedTask.updated_at = new Date().toISOString();
    
            let targetGroup = updatedTasks
                .filter(t => (t.location || 'غير محدد') === targetLocation)
                .sort((a, b) => (a.order_index || 0) - (b.order_index || 0));
    
            const draggedTaskIndexInTarget = targetGroup.findIndex(t => t.id === currentDraggedId);
            if(draggedTaskIndexInTarget > -1) {
                targetGroup.splice(draggedTaskIndexInTarget, 1);
            }
    
            let insertIndex = targetGroup.length;
            if(targetTaskId) {
                const targetTaskIndexInTarget = targetGroup.findIndex(t => t.id === targetTaskId);
                if(targetTaskIndexInTarget > -1) {
                    insertIndex = position === 'before' ? targetTaskIndexInTarget : targetTaskIndexInTarget + 1;
                }
            }
            
            targetGroup.splice(insertIndex, 0, draggedTask);
    
            targetGroup.forEach((task, index) => {
                const originalTask = updatedTasks.find(t => t.id === task.id);
                if(originalTask && originalTask.order_index !== index) {
                    originalTask.order_index = index;
                    originalTask.updated_at = new Date().toISOString();
                }
            });
    
            if (isChangingGroup) {
                const sourceGroup = updatedTasks
                    .filter(t => (t.location || 'غير محدد') === sourceLocation && t.id !== currentDraggedId)
                    .sort((a, b) => (a.order_index || 0) - (b.order_index || 0));
    
                sourceGroup.forEach((task, index) => {
                    const originalTask = updatedTasks.find(t => t.id === task.id);
                    if(originalTask && originalTask.order_index !== index) {
                        originalTask.order_index = index;
                        originalTask.updated_at = new Date().toISOString();
                    }
                });
            }
            
            return updatedTasks;
        });
    };
    
    const handle_group_drag_over = (e: React.DragEvent) => { e.preventDefault(); };
    const handle_group_drop = (e: React.DragEvent, targetLocation: string) => { e.preventDefault(); const taskId = e.dataTransfer.getData('application/lawyer-app-task-id'); if (taskId) { handle_task_drop(null, targetLocation, 'after'); } };

    // Session Handlers
    const handle_postpone_session = (sessionId: string, newDate: Date, newReason: string) => { postpone_session(sessionId, to_input_date_string(newDate), newReason); };
    const handle_update_session = (sessionId: string, updatedFields: Partial<Session>) => { set_clients(currentClients => { return currentClients.map(client => ({ ...client, updated_at: new Date().toISOString(), cases: client.cases.map(caseItem => ({ ...caseItem, updated_at: new Date().toISOString(), stages: caseItem.stages.map(stage => { const sessionIndex = stage.sessions.findIndex(s => s.id === sessionId); if (sessionIndex === -1) { return stage; } const updatedSessions = [...stage.sessions]; updatedSessions[sessionIndex] = { ...updatedSessions[sessionIndex], ...updatedFields, updated_at: new Date().toISOString(), }; return { ...stage, sessions: updatedSessions, updated_at: new Date().toISOString(), }; }), })), })); }); };
    const handle_open_decide_modal = (session: Session) => { if (!session.stage_id) { console.error("Cannot decide session: stage_id is missing.", session); return; } let foundStage: Stage | null = null; for (const client of clients) { for (const caseItem of client.cases) { const stage = caseItem.stages.find(st => st.id === session.stage_id); if (stage) { foundStage = stage; break; } } if (foundStage) break; } if (!foundStage) { console.error("Cannot decide session: Corresponding stage not found for stage_id:", session.stage_id); return; } set_decide_form_data({ decision_number: '', decision_summary: '', decision_notes: '' }); set_decide_modal({ is_open: true, session, stage: foundStage }); };
    const handle_close_decide_modal = () => { set_decide_modal({ is_open: false }); };
    const handle_decide_submit = (e: React.FormEvent) => { e.preventDefault(); const { session, stage } = decide_modal; if (!session || !stage) return; set_clients(currentClients => currentClients.map(client => ({ ...client, updated_at: new Date().toISOString(), cases: client.cases.map(c => ({ ...c, updated_at: new Date().toISOString(), stages: c.stages.map(st => { if (st.id === stage.id) { return { ...st, decision_date: session.date, decision_number: decide_form_data.decision_number, decision_summary: decide_form_data.decision_summary, decision_notes: decide_form_data.decision_notes, updated_at: new Date().toISOString(), }; } return st; }) })) }))); handle_close_decide_modal(); };

    const handle_date_select = (date: Date) => { set_selected_date(date); set_view_mode('daily'); };
    const handle_show_todays_agenda = () => { const today = new Date(); set_selected_date(today); set_calendar_view_date(today); set_view_mode('daily'); };
    const get_title = () => { switch(view_mode) { case 'unpostponed': return "الجلسات غير المرحلة"; case 'upcoming': return `الجلسات القادمة (بعد ${format_date(selected_date)})`; case 'daily': default: return `جدول أعمال يوم: ${format_date(selected_date)}`; } };
    
    const handle_appointment_context_menu = (event: React.MouseEvent, appointment: Appointment) => { const menuItems: MenuItem[] = [ { label: 'إرسال إلى المهام الإدارية', icon: <BuildingLibraryIcon className="w-4 h-4" />, onClick: () => { const description = `متابعة موعد "${appointment.title}" يوم ${format_date(appointment.date)} الساعة ${format_time(appointment.time)}.\nالمكلف: ${appointment.assignee || 'غير محدد'}.\nالأهمية: ${importance_map[appointment.importance]?.text}.`; on_open_admin_task_modal({ task: description, assignee: appointment.assignee, importance: appointment.importance, }); } }, { label: 'مشاركة عبر واتساب', icon: <ShareIcon className="w-4 h-4" />, onClick: () => { const message = [ `*موعد:* ${appointment.title}`, `*التاريخ:* ${format_date(appointment.date)}`, `*الوقت:* ${format_time(appointment.time)}`, `*المسؤول:* ${appointment.assignee || 'غير محدد'}`, `*الأهمية:* ${importance_map[appointment.importance]?.text}` ].join('\n'); const whatsappUrl = `https://wa.me/?text=${encodeURIComponent(message)}`; window.open(whatsappUrl, '_blank'); } } ]; show_context_menu(event, menuItems); }
    const handle_session_context_menu = (event: React.MouseEvent, session: Session) => { let client, caseItem, stage; for (const c of clients) { for (const cs of c.cases) { const s = cs.stages.find(st => st.id === session.stage_id); if (s) { client = c; caseItem = cs; stage = s; break; } } if (stage) break; } let description = ''; let message = ''; if (client && caseItem && stage) { const details = [ `*الموكل:* ${client.name}`, `*الخصم:* ${caseItem.opponent_name}`, `*القضية:* ${caseItem.subject}`, `*المحكمة:* ${stage.court}`, `*رقم الأساس:* ${stage.case_number}`, `*تاريخ الجلسة:* ${format_date(session.date)}`, `*المكلف بالحضور:* ${session.assignee || 'غير محدد'}`, `*سبب التأجيل السابق:* ${session.postponement_reason || 'لا يوجد'}` ]; if (session.stage_decision_date) { details.push('---'); details.push(`*تم حسم المرحلة:*`); details.push(`*تاريخ الحسم:* ${format_date(session.stage_decision_date)}`); if (stage.decision_number) details.push(`*رقم القرار:* ${stage.decision_number}`); if (stage.decision_summary) details.push(`*ملخص القرار:* ${stage.decision_summary}`); } description = `متابعة جلسة قضائية:\n- ${details.join('\n- ')}`; message = `*ملخص جلسة قضائية:*\n${details.join('\n')}`; } else { description = `متابعة جلسة قضية (${session.client_name} ضد ${session.opponent_name}) يوم ${format_date(session.date)} في محكمة ${session.court} (أساس: ${session.case_number}).\nسبب التأجيل السابق: ${session.postponement_reason || 'لا يوجد'}.\nالمكلف بالحضور: ${session.assignee}.`; message = [ `*جلسة قضائية:*`, `*القضية:* ${session.client_name} ضد ${session.opponent_name}`, `*المحكمة:* ${session.court} (أساس: ${session.case_number})`, `*التاريخ:* ${format_date(session.date)}`, `*المسؤول:* ${session.assignee || 'غير محدد'}`, `*سبب التأجيل السابق:* ${session.postponement_reason || 'لا يوجد'}` ].join('\n'); } const menuItems: MenuItem[] = [ { label: 'إرسال إلى المهام الإدارية', icon: <BuildingLibraryIcon className="w-4 h-4" />, onClick: () => { on_open_admin_task_modal({ task: description, assignee: session.assignee, }); } }, { label: 'مشاركة عبر واتساب', icon: <ShareIcon className="w-4 h-4" />, onClick: () => { const whatsappUrl = `https://wa.me/?text=${encodeURIComponent(message)}`; window.open(whatsappUrl, '_blank'); } } ]; show_context_menu(event, menuItems); }

    // Memos
    const overdue_sessions = React.useMemo(() => {
        return unpostponed_sessions.filter(s => is_before_today(s.date));
    }, [unpostponed_sessions]);

    const daily_data = React.useMemo(() => ({ daily_sessions: all_sessions.filter(s => is_same_day(s.date, selected_date)), daily_appointments: appointments.filter(a => is_same_day(a.date, selected_date)) }), [selected_date, all_sessions, appointments]);
    const upcoming_sessions = React.useMemo(() => { 
        const tomorrow = new Date(selected_date); 
        tomorrow.setDate(tomorrow.getDate() + 1); 
        tomorrow.setHours(0, 0, 0, 0); 
        return unpostponed_sessions.filter(s => safe_revive_date(s.date) >= tomorrow).sort((a, b) => safe_revive_date(a.date).getTime() - safe_revive_date(b.date).getTime()); 
    }, [unpostponed_sessions, selected_date]);
    const grouped_tasks: Record<string, AdminTask[]> = React.useMemo(() => {
        const isCompleted = active_task_tab === 'completed';
        const filtered = admin_tasks.filter(task => {
            const searchLower = debounced_admin_task_search.toLowerCase();
            const matchesSearch = searchLower === '' || task.task.toLowerCase().includes(searchLower) || (task.assignee && task.assignee.toLowerCase().includes(searchLower)) || (task.location && task.location.toLowerCase().includes(searchLower));
            return task.completed === isCompleted && matchesSearch;
        });
        
        filtered.sort((a, b) => (a.order_index ?? Infinity) - (b.order_index ?? Infinity));

        return filtered.reduce((acc, task) => {
            const location = task.location || 'غير محدد';
            if (!acc[location]) {
                acc[location] = [];
            }
            acc[location].push(task);
            return acc;
        }, {} as Record<string, AdminTask[]>);
    }, [admin_tasks, active_task_tab, debounced_admin_task_search]);
    
    React.useEffect(() => { const allKnownLocations = new Set(Object.keys(grouped_tasks)); const currentSavedOrder = saved_location_order || []; const ordered = currentSavedOrder.filter(loc => allKnownLocations.has(loc)); const orderedSet = new Set(ordered); let changed = false; allKnownLocations.forEach(loc => { if (!orderedSet.has(loc)) { ordered.push(loc); changed = true; } }); if (changed || ordered.length !== currentSavedOrder.length) { set_saved_location_order(ordered); } set_location_order(ordered); }, [grouped_tasks, saved_location_order, set_saved_location_order]);
    React.useEffect(() => { if (active_location_tab && location_order.includes(active_location_tab)) { return; } if (location_order.length > 0) { set_active_location_tab(location_order[0]); } else { set_active_location_tab(''); } }, [location_order, active_location_tab]);


    const handle_admin_task_context_menu = (event: React.MouseEvent, task: AdminTask) => { const menuItems: MenuItem[] = [ { label: 'مشاركة عبر واتساب', icon: <ShareIcon className="w-4 h-4" />, onClick: () => handle_share_task(task), }, ]; show_context_menu(event, menuItems); };

    const admin_task_long_press_timer = React.useRef<number | null>(null);
    const handle_admin_task_touch_start = (e: React.TouchEvent, task: AdminTask) => { admin_task_long_press_timer.current = window.setTimeout(() => { const touch = e.touches[0]; const mockEvent = { preventDefault: () => e.preventDefault(), clientX: touch.clientX, clientY: touch.clientY }; handle_admin_task_context_menu(mockEvent as any, task); }, 500); };
    const handle_admin_task_touch_end = () => { if (admin_task_long_press_timer.current !== null) { window.clearTimeout(admin_task_long_press_timer.current); admin_task_long_press_timer.current = null; } };

    const render_task_item = (task: AdminTask, location: string) => ( <div key={task.id} draggable={active_task_tab === 'pending'} onDragStart={e => handle_drag_start(e, 'task', task.id)} onDragEnd={handle_drag_end} onDragOver={e => { if (active_task_tab !== 'pending' || !dragged_task_id.current || dragged_task_id.current === task.id) return; e.preventDefault(); set_drag_over_task_id(task.id); const rect = e.currentTarget.getBoundingClientRect(); const midpoint = rect.top + rect.height / 2; set_drop_position(e.clientY < midpoint ? 'before' : 'after'); }} onDragLeave={() => { set_drag_over_task_id(null); set_drop_position(null); }} onDrop={e => { if (active_task_tab !== 'pending' || !drop_position) return; e.preventDefault(); e.stopPropagation(); handle_task_drop(task.id, location, drop_position); set_drag_over_task_id(null); set_drop_position(null); }} onContextMenu={(e) => handle_admin_task_context_menu(e, task)} onTouchStart={(e) => handle_admin_task_touch_start(e, task)} onTouchEnd={handle_admin_task_touch_end} onTouchMove={handle_admin_task_touch_end} className={`relative p-3 border rounded-lg transition-all duration-150 ${dragged_task_id.current === task.id ? 'opacity-40 scale-95' : 'opacity-100 scale-100'} ${task.completed ? 'bg-green-50/70 border-green-200' : 'bg-white border-gray-200 hover:bg-gray-50 hover:shadow-sm'} ${active_task_tab === 'pending' ? 'cursor-move' : ''}`} > {drag_over_task_id === task.id && drop_position === 'before' && <div className="absolute top-0 left-0 right-0 h-1 bg-blue-500 rounded-full z-10"></div>} <div className="flex items-start gap-3"> <div className="flex-shrink-0 pt-1"> <input type="checkbox" checked={task.completed} onChange={() => handle_toggle_task_complete(task.id)} className="w-5 h-5 text-blue-600 bg-gray-100 border-gray-300 rounded focus:ring-blue-500" /> </div> <div className="flex-grow min-w-0"> <p className={`font-medium text-base whitespace-pre-wrap ${task.completed ? 'line-through text-gray-500' : 'text-gray-900'}`}>{task.task}</p> <div className="mt-2 flex items-center gap-x-4 gap-y-2 text-sm text-gray-600"> <div className="flex items-center gap-1.5" onClick={() => active_task_tab === 'pending' && set_editing_assignee_task_id(task.id)}> <UserIcon className="w-4 h-4 text-gray-400" /> {editing_assignee_task_id === task.id ? ( <select value={task.assignee} onChange={(e) => handle_assignee_change(task.id, e.target.value)} onBlur={() => set_editing_assignee_task_id(null)} className="p-1 border rounded bg-white text-sm focus:ring-blue-500 focus:border-blue-500" autoFocus> {assistants.map(name => ( <option key={name} value={name}> {name} </option> ))} </select> ) : ( <span className={active_task_tab === 'pending' ? 'cursor-pointer hover:text-blue-600' : ''}> {task.assignee || '-'} </span> )} </div> <div className="flex items-center gap-1.5"> <CalendarIcon className="w-4 h-4 text-gray-400" /> <span>{format_date(task.due_date)}</span> </div> <div className="flex items-center gap-1.5"> <span className={`px-2 py-1 text-xs font-semibold rounded-full ${importance_map_admin_tasks[task.importance]?.className}`}> {importance_map_admin_tasks[task.importance]?.text} </span> </div> </div> </div> <div className="flex flex-col sm:flex-row items-center gap-0 sm:gap-1 flex-shrink-0"> <button onClick={() => handle_share_task(task)} className="p-2 text-gray-500 hover:bg-gray-100 hover:text-green-600 rounded-full" title="مشاركة عبر واتساب"><ShareIcon className="w-4 h-4" /></button> 
        {permissions.can_edit_admin_task && <button onClick={() => on_open_admin_task_modal(task)} className="p-2 text-gray-500 hover:bg-gray-100 hover:text-blue-600 rounded-full"><PencilIcon className="w-4 h-4" /></button>} 
        {permissions.can_delete_admin_task && <button onClick={() => open_delete_task_modal(task)} className="p-2 text-gray-500 hover:bg-gray-100 hover:text-red-600 rounded-full"><TrashIcon className="w-4 h-4" /></button>} 
    </div> </div> {drag_over_task_id === task.id && drop_position === 'after' && <div className="absolute bottom-0 left-0 right-0 h-1 bg-blue-500 rounded-full z-10"></div>} </div> );

    return (
        <div className="space-y-6">
            
            {main_view === 'agenda' && (
                <div className="grid grid-cols-1 lg:grid-cols-3 print:block gap-6 animate-fade-in">
                    <div className="lg:col-span-1 bg-white p-4 rounded-lg shadow space-y-4 no-print overflow-visible">
                        <Calendar 
                            onDateSelect={handle_date_select} 
                            selectedDate={selected_date} 
                            sessions={all_sessions} 
                            appointments={appointments}
                            currentDate={calendar_view_date}
                            setCurrentDate={set_calendar_view_date}
                        />
                         <div className="grid grid-cols-3 gap-1 sm:gap-2">
                            <div className="relative">
                                <button
                                    onClick={() => set_view_mode('unpostponed')}
                                    className={`w-full flex flex-col sm:flex-row items-center justify-center gap-1 sm:gap-2 px-1 sm:px-4 py-1.5 sm:py-2 text-white rounded-lg transition-colors focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-opacity-50 font-semibold ${view_mode === 'unpostponed' ? 'bg-red-700' : 'bg-red-600 hover:bg-red-700'}`}
                                >
                                    <ExclamationTriangleIcon className="w-4 h-4 sm:w-5 sm:h-5" />
                                    <span className="text-[10px] sm:text-sm text-center leading-tight">غير مرحلة</span>
                                </button>
                                {overdue_sessions.length > 0 && (
                                     <span className="absolute -top-2 -start-2 flex h-4 w-4 sm:h-5 sm:w-5 items-center justify-center rounded-full bg-yellow-400 text-black text-[9px] sm:text-xs font-bold ring-1 sm:ring-2 ring-white animate-pulse" title={`${overdue_sessions.length} جلسات غير مرحلة`}>
                                        {overdue_sessions.length}
                                    </span>
                                )}
                            </div>
                            <button
                                onClick={handle_show_todays_agenda}
                                className={`w-full flex flex-col sm:flex-row items-center justify-center gap-1 sm:gap-2 px-1 sm:px-4 py-1.5 sm:py-2 text-white rounded-lg transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-opacity-50 font-semibold ${view_mode === 'daily' ? 'bg-blue-700' : 'bg-blue-600 hover:bg-blue-700'}`}
                            >
                                <CalendarIcon className="w-4 h-4 sm:w-5 sm:h-5" />
                                <span className="text-[10px] sm:text-sm text-center leading-tight">أجندة اليوم</span>
                            </button>
                            <button
                                onClick={() => set_view_mode('upcoming')}
                                className={`w-full flex flex-col sm:flex-row items-center justify-center gap-1 sm:gap-2 px-1 sm:px-4 py-1.5 sm:py-2 text-white rounded-lg transition-colors focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-opacity-50 font-semibold ${view_mode === 'upcoming' ? 'bg-green-700' : 'bg-green-600 hover:bg-green-700'}`}
                            >
                                <ChevronLeftIcon className="w-4 h-4 sm:w-5 sm:h-5" />
                                <span className="text-[10px] sm:text-sm text-center leading-tight">القادمة</span>
                            </button>
                        </div>
                    </div>

                    <div className="lg:col-span-2 space-y-6">
                         <div id="print-section">
                            <div className="mb-4">
                                <h2 className="text-2xl font-semibold">{get_title()}</h2>
                            </div>
                            <div className="space-y-6">
                                {view_mode === 'daily' && (
                                    <>
                                        <div className="bg-white rounded-lg shadow overflow-hidden print:overflow-visible">
                                            <h3 className="text-lg font-bold p-4 bg-gray-50 border-b">جدول الجلسات</h3>
                                            <SessionsTable 
                                                sessions={daily_data.daily_sessions} 
                                                onPostpone={permissions.can_postpone_session ? handle_postpone_session : undefined} 
                                                onUpdate={permissions.can_edit_session ? handle_update_session : undefined} 
                                                onDecide={permissions.can_decide_session ? handle_open_decide_modal : undefined} 
                                                assistants={assistants} 
                                                allowPostponingPastSessions={true} 
                                                onContextMenu={handle_session_context_menu} 
                                            />
                                        </div>
                                        <AppointmentsTable 
                                            appointments={daily_data.daily_appointments} 
                                            on_add_appointment={permissions.can_add_admin_task ? handle_open_add_appointment_modal : () => {}} // Using general task permission or add a new one for appointments
                                            // Note: Appointments currently don't have distinct permissions in the interface, using Admin Task ones as proxy or keep basic
                                            on_edit={permissions.can_edit_admin_task ? handle_open_edit_appointment_modal : () => {}}
                                            on_delete={permissions.can_delete_admin_task ? open_delete_appointment_modal : () => {}}
                                            on_context_menu={handle_appointment_context_menu} 
                                            on_toggle_complete={handle_toggle_appointment_complete} 
                                        />
                                    </>
                                )}
                                {view_mode === 'unpostponed' && (
                                    <div className="bg-white rounded-lg shadow overflow-hidden print:overflow-visible">
                                        <SessionsTable 
                                            sessions={overdue_sessions} 
                                            onPostpone={permissions.can_postpone_session ? handle_postpone_session : undefined} 
                                            onUpdate={permissions.can_edit_session ? handle_update_session : undefined} 
                                            onDecide={permissions.can_decide_session ? handle_open_decide_modal : undefined} 
                                            assistants={assistants} 
                                            allowPostponingPastSessions={true} 
                                            showSessionDate={true} 
                                            onContextMenu={handle_session_context_menu} 
                                        />
                                    </div>
                                )}
                                {view_mode === 'upcoming' && (
                                    <div className="bg-white rounded-lg shadow overflow-hidden print:overflow-visible">
                                        <SessionsTable 
                                            sessions={upcoming_sessions} 
                                            onPostpone={permissions.can_postpone_session ? handle_postpone_session : undefined} 
                                            onUpdate={permissions.can_edit_session ? handle_update_session : undefined} 
                                            onDecide={permissions.can_decide_session ? handle_open_decide_modal : undefined} 
                                            assistants={assistants} 
                                            showSessionDate={true} 
                                            onContextMenu={handle_session_context_menu} 
                                        />
                                    </div>
                                )}
                            </div>
                         </div>
                    </div>
                </div>
            )}
            
            {main_view === 'admin_tasks' && (
                <div className="bg-white p-4 sm:p-6 rounded-lg shadow space-y-4 no-print animate-fade-in">
                    <div className="flex justify-between items-center flex-wrap gap-4 border-b pb-3">
                        <div className="flex items-center gap-4">
                            <h2 className="text-2xl font-semibold">المهام الإدارية</h2>
                            {permissions.can_add_admin_task && (
                                <button onClick={() => on_open_admin_task_modal()} className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white font-semibold rounded-lg hover:bg-blue-700 transition-colors text-sm">
                                    <PlusIcon className="w-5 h-5" />
                                    <span>مهمة جديدة</span>
                                </button>
                            )}
                        </div>
                        <div className="flex items-center gap-4">
                            <div className="flex items-center gap-1 p-1 bg-gray-200 rounded-lg">
                                <button onClick={() => set_admin_tasks_layout('horizontal')} className={`p-2 rounded-md transition-colors ${admin_tasks_layout === 'horizontal' ? 'bg-white shadow-sm' : 'hover:bg-gray-300'}`} title="عرض أفقي (قائمة)">
                                    <ListBulletIcon className="w-5 h-5 text-gray-700" />
                                </button>
                                <button onClick={() => set_admin_tasks_layout('vertical')} className={`p-2 rounded-md transition-colors ${admin_tasks_layout === 'vertical' ? 'bg-white shadow-sm' : 'hover:bg-gray-300'}`} title="عرض عمودي (أعمدة)">
                                    <ViewColumnsIcon className="w-5 h-5 text-gray-700" />
                                </button>
                            </div>
                            <div className="relative">
                                <input 
                                    type="search" 
                                    placeholder="ابحث عن مهمة..." 
                                    value={admin_task_search}
                                    onChange={(e) => set_admin_task_search(e.target.value)}
                                    className="w-full sm:w-64 p-2 ps-10 text-sm border border-gray-300 rounded-lg bg-gray-50 focus:ring-blue-500 focus:border-blue-500" 
                                />
                                <div className="absolute inset-y-0 start-0 flex items-center ps-3 pointer-events-none">
                                    <SearchIcon className="w-4 h-4 text-gray-500" />
                                </div>
                            </div>
                        </div>
                    </div>
                    {/* ... (rest of admin tasks view) */}
                    <div className="border-b border-gray-200">
                        <nav className="-mb-px flex space-x-4" aria-label="Tabs">
                            <button
                                onClick={() => set_active_task_tab('pending')}
                                className={`whitespace-nowrap py-3 px-4 border-b-2 font-medium text-sm ${active_task_tab === 'pending' ? 'border-blue-500 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'}`}
                            >
                                المهام المعلقة
                            </button>
                            <button
                                onClick={() => set_active_task_tab('completed')}
                                className={`whitespace-nowrap py-3 px-4 border-b-2 font-medium text-sm ${active_task_tab === 'completed' ? 'border-blue-500 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'}`}
                            >
                                المهام المنجزة
                            </button>
                        </nav>
                    </div>

                    {admin_tasks_layout === 'vertical' ? (
                        <div className="flex flex-row gap-4 pt-4">
                            {location_order.length > 0 && (
                                <nav className="flex flex-col gap-2 w-28 flex-shrink-0" aria-label="Location Tabs">
                                    {location_order.map(location => (
                                        <button
                                            key={location}
                                            onClick={() => set_active_location_tab(location)}
                                            draggable={active_task_tab === 'pending'}
                                            onDragStart={e => handle_drag_start(e, 'group', location)}
                                            onDragEnd={handle_drag_end}
                                            onDragOver={(e) => {
                                                if (dragged_task_id.current) {
                                                    e.preventDefault();
                                                    set_drag_over_location(location);
                                                } else if (dragged_group_location) {
                                                    e.preventDefault();
                                                }
                                            }}
                                            onDragLeave={() => set_drag_over_location(null)}
                                            onDrop={e => {
                                                set_drag_over_location(null);
                                                if (dragged_task_id.current) {
                                                    e.preventDefault();
                                                    e.stopPropagation();
                                                    handle_task_drop(null, location, 'after');
                                                } else { 
                                                    if (active_task_tab !== 'pending') return;
                                                    e.preventDefault();
                                                    e.stopPropagation();
                                                    if (!dragged_group_location || dragged_group_location === location) return;
                                                    const newOrder = [...location_order];
                                                    const sourceIndex = newOrder.indexOf(dragged_group_location);
                                                    const targetIndex = newOrder.indexOf(location);
                                                    if (sourceIndex === -1 || targetIndex === -1) return;
                                                    const [movedItem] = newOrder.splice(sourceIndex, 1);
                                                    newOrder.splice(targetIndex, 0, movedItem);
                                                    set_location_order(newOrder);
                                                    set_saved_location_order(newOrder);
                                                }
                                            }}
                                            className={`whitespace-normal break-words w-full text-right px-2 py-2 border-r-4 font-medium text-sm transition-colors duration-150 focus:outline-none ${active_task_tab === 'pending' ? 'cursor-grab' : ''} ${
                                                active_location_tab === location
                                                    ? 'border-blue-500 bg-blue-50 text-blue-600 font-semibold'
                                                    : 'border-transparent text-gray-600 hover:bg-gray-100'
                                            } ${
                                                dragged_group_location === location ? 'opacity-30' : 'opacity-100'
                                            } ${drag_over_location === location ? 'bg-blue-200 border-blue-500' : ''}`}
                                        >
                                            {location}
                                        </button>
                                    ))}
                                </nav>
                            )}
                            <div className="flex-grow min-w-0">
                                 {location_order.length > 0 && active_location_tab ? (
                                    <div 
                                        onDragOver={handle_group_drag_over}
                                        onDrop={e => handle_group_drop(e, active_location_tab)}
                                        className={`p-2 rounded-lg min-h-[200px] transition-colors duration-200 ${is_dragging ? 'border-dashed border-blue-500 bg-blue-50' : 'bg-gray-50 border border-gray-200'}`}
                                    >
                                        {(grouped_tasks[active_location_tab] || []).length > 0 ? (
                                            <div className="space-y-3">
                                                {(grouped_tasks[active_location_tab] || []).map(task => render_task_item(task, active_location_tab))}
                                            </div>
                                        ) : (
                                            <p className="text-center text-gray-500 py-8">لا توجد مهام في هذا المكان.</p>
                                        )}
                                    </div>
                                ) : (
                                    <div className="flex items-center justify-center bg-gray-50 border border-dashed rounded-lg min-h-[200px]">
                                        <p className="text-center text-gray-500 py-8">
                                            {location_order.length > 0 ? "اختر مجموعة لعرض المهام" : "لا توجد مهام لعرضها."}
                                        </p>
                                    </div>
                                )}
                            </div>
                        </div>
                    ) : (
                        <div className="pt-4">
                            {location_order.length > 0 ? (
                                <div>
                                    <nav className="-mb-px flex space-x-2 overflow-x-auto" aria-label="Location Tabs">
                                        {location_order.map(location => (
                                            <button
                                                key={location}
                                                onClick={() => set_active_location_tab(location)}
                                                draggable={active_task_tab === 'pending'}
                                                onDragStart={e => handle_drag_start(e, 'group', location)}
                                                onDragEnd={handle_drag_end}
                                                onDragOver={(e) => {
                                                    if (dragged_task_id.current) {
                                                        e.preventDefault();
                                                        set_drag_over_location(location);
                                                    } else if (dragged_group_location) {
                                                        e.preventDefault();
                                                    }
                                                }}
                                                onDragLeave={() => set_drag_over_location(null)}
                                                onDrop={e => {
                                                    set_drag_over_location(null);
                                                    if (dragged_task_id.current) {
                                                        e.preventDefault();
                                                        e.stopPropagation();
                                                        handle_task_drop(null, location, 'after');
                                                    } else { // Existing group drop logic
                                                        if (active_task_tab !== 'pending') return;
                                                        e.preventDefault();
                                                        e.stopPropagation();
                                                        if (!dragged_group_location || dragged_group_location === location) return;
                                                        const newOrder = [...location_order];
                                                        const sourceIndex = newOrder.indexOf(dragged_group_location);
                                                        const targetIndex = newOrder.indexOf(location);
                                                        if (sourceIndex === -1 || targetIndex === -1) return;
                                                        const [movedItem] = newOrder.splice(sourceIndex, 1);
                                                        newOrder.splice(targetIndex, 0, movedItem);
                                                        set_location_order(newOrder);
                                                        set_saved_location_order(newOrder);
                                                    }
                                                }}
                                                className={`whitespace-nowrap py-3 px-4 border font-medium text-sm rounded-t-lg transition-colors duration-150 focus:outline-none ${active_task_tab === 'pending' ? 'cursor-grab' : ''} ${
                                                    active_location_tab === location
                                                        ? 'bg-gray-50 border-gray-200 border-b-gray-50 text-blue-600 font-semibold'
                                                        : 'bg-white border-transparent border-b-gray-200 text-gray-500 hover:text-gray-700'
                                                } ${
                                                    dragged_group_location === location ? 'opacity-30' : ''
                                                } ${drag_over_location === location ? 'bg-blue-200' : ''}`}
                                            >
                                                {location}
                                            </button>
                                        ))}
                                    </nav>
                                    <div 
                                        onDragOver={handle_group_drag_over}
                                        onDrop={e => handle_group_drop(e, active_location_tab)}
                                        className={`p-2 sm:p-4 space-y-3 rounded-b-lg min-h-[100px] transition-colors duration-200 ${is_dragging ? 'border-dashed border-blue-500 bg-blue-50' : 'bg-gray-50 border border-gray-200'}`}
                                    >
                                        {(grouped_tasks[active_location_tab] || []).length > 0 ? (
                                            (grouped_tasks[active_location_tab] || []).map(task => render_task_item(task, active_location_tab))
                                        ) : (
                                            <p className="text-center text-gray-500 py-8">لا توجد مهام في هذا المكان.</p>
                                        )}
                                    </div>
                                </div>
                            ) : (
                                <div className="flex items-center justify-center border border-dashed rounded-lg min-h-[200px]">
                                    <p className="text-center text-gray-500 py-8">لا توجد مهام لعرضها.</p>
                                </div>
                            )}
                        </div>
                    )}
                </div>
            )}
           
            {is_appointment_modal_open && (
                <div className="fixed inset-0 bg-black bg-opacity-50 flex items-start justify-center z-50 no-print p-4 overflow-y-auto" onClick={handle_close_appointment_modal}>
                    <div className="bg-white p-6 rounded-lg shadow-xl w-full max-w-md" onClick={e => e.stopPropagation()}>
                        <h2 className="text-xl font-bold mb-4">{editing_appointment ? 'تعديل موعد' : 'إضافة موعد جديد'}</h2>
                        <form onSubmit={handle_save_appointment}>
                            {/* ... (Appointment form inputs) ... */}
                            <div className="space-y-4">
                                <div>
                                    <label htmlFor="title" className="block text-sm font-medium text-gray-700">الموعد</label>
                                    <input type="text" id="title" name="title" value={new_appointment.title} onChange={handle_appointment_form_change} className="mt-1 w-full p-2 border rounded" required />
                                </div>
                                <div>
                                    <label htmlFor="date" className="block text-sm font-medium text-gray-700">التاريخ</label>
                                    <DatePicker name="date" value={new_appointment.date} onChange={(date, name) => handle_appointment_form_change({ target: { name, value: date } } as any)} required />
                                    {date_warning && (
                                        <p className="mt-1 text-xs text-yellow-600 flex items-center gap-1">
                                            <ExclamationTriangleIcon className="w-4 h-4" />
                                            {date_warning}
                                        </p>
                                    )}
                                </div>
                                <div>
                                    <label htmlFor="time" className="block text-sm font-medium text-gray-700">الوقت</label>
                                    <input type="time" id="time" name="time" value={new_appointment.time} onChange={handle_appointment_form_change} className="mt-1 w-full p-2 border rounded" required />
                                </div>
                                <div>
                                    <label htmlFor="assignee" className="block text-sm font-medium text-gray-700">الشخص المسؤول</label>
                                    <select id="assignee" name="assignee" value={new_appointment.assignee} onChange={handle_appointment_form_change} className="mt-1 w-full p-2 border rounded">
                                        {assistants.map(name => <option key={name} value={name}>{name}</option>)}
                                    </select>
                                </div>
                                <div>
                                    <label htmlFor="importance" className="block text-sm font-medium text-gray-700">الأهمية</label>
                                    <select id="importance" name="importance" value={new_appointment.importance} onChange={handle_appointment_form_change} className="mt-1 w-full p-2 border rounded" required>
                                        <option value="normal">عادي</option>
                                        <option value="important">مهم</option>
                                        <option value="urgent">عاجل</option>
                                    </select>
                                </div>
                                <div>
                                    <label htmlFor="reminder_time_in_minutes" className="block text-sm font-medium text-gray-700">تذكير قبل</label>
                                    <select id="reminder_time_in_minutes" name="reminder_time_in_minutes" value={new_appointment.reminder_time_in_minutes} onChange={handle_appointment_form_change} className="mt-1 w-full p-2 border rounded" required>
                                        <option value="5">5 دقائق</option>
                                        <option value="10">10 دقائق</option>
                                        <option value="15">15 دقيقة</option>
                                        <option value="30">30 دقيقة</option>
                                        <option value="60">ساعة واحدة</option>
                                    </select>
                                </div>
                            </div>
                            <div className="mt-6 flex justify-end gap-4">
                                <button type="button" onClick={handle_close_appointment_modal} className="px-4 py-2 bg-gray-200 rounded-lg hover:bg-gray-300">إلغاء</button>
                                <button type="submit" className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700">{editing_appointment ? 'حفظ التعديلات' : 'إضافة'}</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {is_delete_appointment_modal_open && appointment_to_delete && (
                <div className="fixed inset-0 bg-black bg-opacity-50 flex items-start justify-center z-50 no-print p-4 overflow-y-auto" onClick={close_delete_appointment_modal}>
                    <div className="bg-white p-8 rounded-lg shadow-xl w-full max-w-md" onClick={e => e.stopPropagation()}>
                        <div className="text-center">
                            <div className="mx-auto flex items-center justify-center h-16 w-16 rounded-full bg-red-100 mb-4">
                                <ExclamationTriangleIcon className="h-8 w-8 text-red-600" aria-hidden="true" />
                            </div>
                            <h3 className="text-2xl font-bold text-gray-900">
                                تأكيد حذف الموعد
                            </h3>
                            <p className="text-gray-600 my-4">
                                هل أنت متأكد من حذف موعد "{appointment_to_delete.title}"؟<br />
                                هذا الإجراء لا يمكن التراجع عنه.
                            </p>
                        </div>
                        <div className="mt-6 flex justify-center gap-4">
                            <button
                                type="button"
                                className="px-6 py-2 bg-gray-200 text-gray-800 font-semibold rounded-lg hover:bg-gray-300 transition-colors"
                                onClick={close_delete_appointment_modal}
                            >
                                إلغاء
                            </button>
                            <button
                                type="button"
                                className="px-6 py-2 bg-red-600 text-white font-semibold rounded-lg hover:bg-red-700 transition-colors"
                                onClick={handle_confirm_delete_appointment}
                            >
                                نعم، قم بالحذف
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {is_delete_task_modal_open && task_to_delete && (
                <div className="fixed inset-0 bg-black bg-opacity-50 flex items-start justify-center z-50 no-print p-4 overflow-y-auto" onClick={close_delete_task_modal}>
                    <div className="bg-white p-8 rounded-lg shadow-xl w-full max-w-md" onClick={e => e.stopPropagation()}>
                        <div className="text-center">
                            <div className="mx-auto flex items-center justify-center h-16 w-16 rounded-full bg-red-100 mb-4">
                                <ExclamationTriangleIcon className="h-8 w-8 text-red-600" aria-hidden="true" />
                            </div>
                            <h3 className="text-2xl font-bold text-gray-900">
                                تأكيد حذف المهمة
                            </h3>
                            <p className="text-gray-600 my-4">
                                هل أنت متأكد من حذف مهمة "{task_to_delete.task}"؟<br />
                                هذا الإجراء لا يمكن التراجع عنه.
                            </p>
                        </div>
                        <div className="mt-6 flex justify-center gap-4">
                            <button
                                type="button"
                                className="px-6 py-2 bg-gray-200 text-gray-800 font-semibold rounded-lg hover:bg-gray-300 transition-colors"
                                onClick={close_delete_task_modal}
                            >
                                إلغاء
                            </button>
                            <button
                                type="button"
                                className="px-6 py-2 bg-red-600 text-white font-semibold rounded-lg hover:bg-red-700 transition-colors"
                                onClick={handle_confirm_delete_task}
                            >
                                نعم، قم بالحذف
                            </button>
                        </div>
                    </div>
                </div>
            )}
            
            {decide_modal.is_open && decide_modal.session && (
                <div className="fixed inset-0 bg-black bg-opacity-50 flex items-start justify-center z-50 no-print p-4 overflow-y-auto" onClick={handle_close_decide_modal}>
                    <div className="bg-white p-6 rounded-lg shadow-xl w-full max-w-lg" onClick={e => e.stopPropagation()}>
                        <h2 className="text-xl font-bold mb-4">تسجيل قرار الحسم</h2>
                        <form onSubmit={handle_decide_submit} className="space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-gray-700">تاريخ الحسم</label>
                                <DatePicker value={to_input_date_string(decide_modal.session.date)} onChange={() => {}} disabled className="bg-gray-100" />
                            </div>
                             <div>
                                <label className="block text-sm font-medium text-gray-700">رقم القرار</label>
                                <input type="text" value={decide_form_data.decision_number} onChange={e => set_decide_form_data(p => ({...p, decision_number: e.target.value}))} className="w-full p-2 border rounded" />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700">ملخص القرار</label>
                                <textarea value={decide_form_data.decision_summary} onChange={e => set_decide_form_data(p => ({...p, decision_summary: e.target.value}))} className="w-full p-2 border rounded" rows={3}></textarea>
                            </div>
                             <div>
                                <label className="block text-sm font-medium text-gray-700">ملاحظات</label>
                                <textarea value={decide_form_data.decision_notes} onChange={e => set_decide_form_data(p => ({...p, decision_notes: e.target.value}))} className="w-full p-2 border rounded" rows={2}></textarea>
                            </div>
                            <div className="mt-6 flex justify-end gap-4">
                                <button type="button" onClick={handle_close_decide_modal} className="px-4 py-2 bg-gray-200 rounded-lg hover:bg-gray-300">إلغاء</button>
                                <button type="submit" className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700">حفظ القرار</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
};

export default HomePage;
