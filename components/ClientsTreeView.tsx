import * as React from "react";
import { useData } from "../context/DataContext";
import {
  Client,
  Case,
  Stage,
  Session,
  AccountingEntry,
  CaseDocument,
  Permissions,
} from "../types";
import {
  PlusIcon,
  PencilIcon,
  TrashIcon,
  PrintIcon,
  ChevronLeftIcon,
  UserIcon,
  FolderIcon,
  ClipboardDocumentIcon,
  CalendarDaysIcon,
  GavelIcon,
  BuildingLibraryIcon,
  ShareIcon,
  DocumentTextIcon,
  DocumentDuplicateIcon,
} from "./icons";
import SessionsTable from "./SessionsTable";
import CaseAccounting from "./CaseAccounting";
import { format_date, safe_revive_date } from "../utils/dateUtils";
import { MenuItem } from "./ContextMenu";
import CaseDocuments from "./CaseDocuments";
import CaseTasks from "./CaseTasks";

type ExpandedState = { [key: string]: boolean };

interface ClientsTreeViewProps {
  clients: Client[];
  set_clients: (updater: (prevClients: Client[]) => Client[]) => void;
  accounting_entries: AccountingEntry[];
  set_accounting_entries: (
    updater: (prev: AccountingEntry[]) => AccountingEntry[],
  ) => void;
  on_add_case: (clientId: string) => void;
  on_edit_case: (caseItem: Case, client: Client) => void;
  on_delete_case: (caseId: string, clientId: string) => void;
  on_add_stage: (clientId: string, caseId: string) => void;
  on_edit_stage: (stage: Stage, caseItem: Case, client: Client) => void;
  on_delete_stage: (stageId: string, caseId: string, clientId: string) => void;
  on_add_session: (clientId: string, caseId: string, stageId: string) => void;
  on_edit_session: (
    session: Session,
    stage: Stage,
    caseItem: Case,
    client: Client,
  ) => void;
  on_delete_session: (
    sessionId: string,
    stageId: string,
    caseId: string,
    clientId: string,
  ) => void;
  on_postpone_session?: (
    sessionId: string,
    newDate: Date,
    reason: string,
  ) => void;
  on_edit_client: (client: Client) => void;
  on_delete_client: (clientId: string) => void;
  on_print_client_statement: (clientId: string) => void;
  assistants: string[];
  on_update_session?: (
    sessionId: string,
    updatedFields: Partial<Session>,
  ) => void;
  on_decide?: (session: Session) => void;
  show_context_menu: (event: React.MouseEvent, menuItems: MenuItem[]) => void;
  on_open_admin_task_modal: (initialData?: any) => void;
  on_create_invoice: (clientId: string, caseId?: string) => void;
  permissions?: Permissions;
}

const StageItem: React.FC<{
  stage: Stage;
  caseItem: Case;
  client: Client;
  props: ClientsTreeViewProps;
  expanded: boolean;
  onToggle: () => void;
}> = ({ stage, caseItem, client, props, expanded, onToggle }) => {
  const long_press_timer = React.useRef<number | null>(null);
  const { permissions } = props;
  const { share_via_whatsapp } = useData();

  const handleContextMenu = (event: React.MouseEvent) => {
    const latestSession =
      stage.sessions.length > 0
        ? stage.sessions.reduce((latest, current) =>
            safe_revive_date(current.date) > safe_revive_date(latest.date)
              ? current
              : latest,
          )
        : null;

    const details = [
      `*الموكل:* ${client.name}`,
      `*الخصم:* ${caseItem.opponent_name}`,
      `*القضية:* ${caseItem.subject}`,
      `*المحكمة:* ${stage.court}`,
      `*رقم الأساس:* ${stage.case_number}`,
    ];

    if (latestSession) {
      details.push(`*تاريخ آخر جلسة:* ${format_date(latestSession.date)}`);
    }

    if (stage.decision_date) {
      details.push("---");
      details.push(`*تم حسم المرحلة:*`);
      details.push(`*تاريخ الحسم:* ${format_date(stage.decision_date)}`);
      if (stage.decision_number)
        details.push(`*رقم القرار:* ${stage.decision_number}`);
      if (stage.decision_summary)
        details.push(`*ملخص القرار:* ${stage.decision_summary}`);
    }

    const description = `متابعة مرحلة قضائية:\n- ${details.join("\n- ")}`;
    const message = `*ملخص مرحلة قضائية:*\n${details.join("\n")}`;

    const menuItems: MenuItem[] = [
      {
        label: "إرسال إلى المهام الإدارية",
        icon: <BuildingLibraryIcon className="w-4 h-4" />,
        onClick: () => {
          props.on_open_admin_task_modal({ task: description });
        },
      },
      {
        label: "مشاركة عبر واتساب",
        icon: <ShareIcon className="w-4 h-4" />,
        onClick: () => {
          share_via_whatsapp(message);
        },
      },
    ];
    props.show_context_menu(event, menuItems);
  };

  const handleTouchStart = (e: React.TouchEvent) => {
    long_press_timer.current = window.setTimeout(() => {
      const touch = e.touches[0];
      const mockEvent = {
        preventDefault: () => e.preventDefault(),
        clientX: touch.clientX,
        clientY: touch.clientY,
      };
      handleContextMenu(mockEvent as any);
    }, 500);
  };

  const handleTouchEnd = () => {
    if (long_press_timer.current !== null) {
      window.clearTimeout(long_press_timer.current);
      long_press_timer.current = null;
    }
  };

  const handleSessionContextMenu = (
    event: React.MouseEvent,
    session: Session,
  ) => {
    const details = [
      `*الموكل:* ${client.name}`,
      `*الخصم:* ${caseItem.opponent_name}`,
      `*القضية:* ${caseItem.subject}`,
      `*المحكمة:* ${stage.court}`,
      `*رقم الأساس:* ${stage.case_number}`,
      `*تاريخ الجلسة:* ${format_date(session.date)}`,
      `*المكلف بالحضور:* ${session.assignee || "غير محدد"}`,
      `*سبب التأجيل السابق:* ${session.postponement_reason || "لا يوجد"}`,
    ];

    if (stage.decision_date) {
      details.push("---");
      details.push(`*تم حسم المرحلة:*`);
      details.push(`*تاريخ الحسم:* ${format_date(stage.decision_date)}`);
      if (stage.decision_number)
        details.push(`*رقم القرار:* ${stage.decision_number}`);
      if (stage.decision_summary)
        details.push(`*ملخص القرار:* ${stage.decision_summary}`);
    }

    const description = `متابعة جلسة قضائية:\n- ${details.join("\n- ")}`;
    const message = `*ملخص جلسة قضائية:*\n${details.join("\n")}`;

    const menuItems: MenuItem[] = [
      {
        label: "إرسال إلى المهام الإدارية",
        icon: <BuildingLibraryIcon className="w-4 h-4" />,
        onClick: () => {
          props.on_open_admin_task_modal({
            task: description,
            assignee: session.assignee,
          });
        },
      },
      {
        label: "مشاركة عبر واتساب",
        icon: <ShareIcon className="w-4 h-4" />,
        onClick: () => {
          share_via_whatsapp(message);
        },
      },
    ];
    props.show_context_menu(event, menuItems);
  };

  return (
    <div className="border rounded-lg mb-2 overflow-hidden bg-yellow-50">
      <div
        className="flex justify-between items-start p-3 hover:bg-yellow-100 cursor-pointer"
        onClick={onToggle}
        onContextMenu={handleContextMenu}
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
        onTouchMove={handleTouchEnd}
      >
        <div className="flex-grow">
          <div className="flex items-center flex-wrap gap-x-3 gap-y-1 font-semibold text-yellow-800">
            <div className="flex items-center gap-3">
              <ClipboardDocumentIcon className="w-5 h-5 text-yellow-600" />
              <span>{stage.court}</span>
              <span className="text-gray-600 font-normal">
                ({stage.case_number})
              </span>
            </div>
          </div>
          {stage.decision_date && (
            <div className="mt-3 ps-8 animate-fade-in text-sm font-normal text-gray-700">
              <div className="p-3 bg-green-100 border border-green-200 rounded-lg">
                <div className="flex flex-wrap items-start gap-x-4 gap-y-2">
                  <div className="flex items-center">
                    <GavelIcon className="w-4 h-4 text-green-700 me-2 flex-shrink-0" />
                    <strong className="font-semibold">تاريخ الحسم:</strong>
                    <span className="ms-1">
                      {format_date(stage.decision_date)}
                    </span>
                  </div>
                  {stage.decision_number && (
                    <div className="flex items-center">
                      <strong className="font-semibold">رقم القرار:</strong>
                      <span className="ms-1">{stage.decision_number}</span>
                    </div>
                  )}
                  {stage.decision_summary && (
                    <div className="flex items-baseline">
                      <strong className="font-semibold flex-shrink-0">
                        ملخص القرار:
                      </strong>
                      <span className="ms-1 whitespace-pre-wrap">
                        {stage.decision_summary}
                      </span>
                    </div>
                  )}
                  {stage.decision_notes && (
                    <div className="flex items-baseline">
                      <strong className="font-semibold flex-shrink-0">
                        ملاحظات:
                      </strong>
                      <span className="ms-1 whitespace-pre-wrap">
                        {stage.decision_notes}
                      </span>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
        <div className="flex-shrink-0 flex items-center gap-2 ms-4">
          {permissions?.can_add_session && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                props.on_add_session(client.id, caseItem.id, stage.id);
              }}
              className="p-1 text-gray-500 hover:text-blue-600"
            >
              <PlusIcon className="w-4 h-4" />
            </button>
          )}
          {permissions?.can_edit_case && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                props.on_edit_stage(stage, caseItem, client);
              }}
              className="p-1 text-gray-500 hover:text-blue-600"
            >
              <PencilIcon className="w-4 h-4" />
            </button>
          )}
          {permissions?.can_delete_case && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                props.on_delete_stage(stage.id, caseItem.id, client.id);
              }}
              className="p-1 text-gray-500 hover:text-red-600"
            >
              <TrashIcon className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>
      {expanded && (
        <div className="p-3 bg-green-50 border-t border-green-200">
          <h5 className="flex items-center gap-2 text-md font-semibold text-gray-700 mb-2">
            <CalendarDaysIcon className="w-5 h-5 text-gray-500" />
            الجلسات
          </h5>
          <SessionsTable
            sessions={stage.sessions
              .map((s) => ({
                ...s,
                stage_id: stage.id,
                stage_decision_date: stage.decision_date,
              }))
              .sort(
                (a, b) =>
                  safe_revive_date(a.date).getTime() -
                  safe_revive_date(b.date).getTime(),
              )}
            onPostpone={props.on_postpone_session}
            onEdit={
              permissions?.can_edit_session
                ? (session) =>
                    props.on_edit_session(session, stage, caseItem, client)
                : undefined
            }
            onDelete={
              permissions?.can_delete_session
                ? (sessionId) =>
                    props.on_delete_session(
                      sessionId,
                      stage.id,
                      caseItem.id,
                      client.id,
                    )
                : undefined
            }
            onUpdate={props.on_update_session}
            assistants={props.assistants}
            onDecide={props.on_decide}
            stage={stage}
            showSessionDate={true}
            onContextMenu={handleSessionContextMenu}
          />
        </div>
      )}
    </div>
  );
};

const StageItemContainer: React.FC<{
  stage: Stage;
  caseItem: Case;
  client: Client;
  props: ClientsTreeViewProps;
}> = ({ stage, caseItem, client, props }) => {
  const [isExpanded, setIsExpanded] = React.useState(false);
  return (
    <StageItem
      stage={stage}
      caseItem={caseItem}
      client={client}
      props={props}
      expanded={isExpanded}
      onToggle={() => setIsExpanded(!isExpanded)}
    />
  );
};

const CaseItem: React.FC<{
  caseItem: Case;
  client: Client;
  props: ClientsTreeViewProps;
  expanded: boolean;
  onToggle: () => void;
}> = ({ caseItem, client, props, expanded, onToggle }) => {
  const [active_tab, set_active_tab] = React.useState<
    "stages" | "accounting" | "documents" | "tasks"
  >("stages");
  const case_accounting_entries = props.accounting_entries.filter(
    (e) => e.case_id === caseItem.id,
  );
  const long_press_timer = React.useRef<number | null>(null);
  const { permissions } = props;
  const { share_via_whatsapp } = useData();

  const handle_fee_change = (new_fee: string) => {
    props.set_clients((clients) =>
      clients.map((c) =>
        c.id === client.id
          ? {
              ...c,
              updated_at: new Date().toISOString(),
              cases: c.cases.map((cs) =>
                cs.id === caseItem.id
                  ? {
                      ...cs,
                      fee_agreement: new_fee,
                      updated_at: new Date().toISOString(),
                    }
                  : cs,
              ),
            }
          : c,
      ),
    );
  };

  const handleContextMenu = (event: React.MouseEvent) => {
    const statusMap: Record<Case["status"], string> = {
      active: "نشطة",
      closed: "مغلقة",
      on_hold: "معلقة",
    };

    const details = [
      `*الموكل:* ${client.name}`,
      `*الخصم:* ${caseItem.opponent_name}`,
      `*القضية:* ${caseItem.subject}`,
      `*الحالة:* ${statusMap[caseItem.status]}`,
    ];

    let latestStage: Stage | null = null;
    let latestSession: Session | null = null;
    if (caseItem.stages.length > 0) {
      const allSessions = caseItem.stages.flatMap((s) => s.sessions);
      if (allSessions.length > 0) {
        latestSession = allSessions.reduce((latest, current) =>
          safe_revive_date(current.date) > safe_revive_date(latest.date)
            ? current
            : latest,
        );
        latestStage =
          caseItem.stages.find((s) =>
            s.sessions.some((sess) => sess.id === latestSession!.id),
          ) || null;
      } else {
        latestStage = caseItem.stages[caseItem.stages.length - 1];
      }
    }

    if (latestStage) {
      details.push("---");
      details.push("*آخر مرحلة:*");
      details.push(`*المحكمة:* ${latestStage.court}`);
      details.push(`*رقم الأساس:* ${latestStage.case_number}`);

      if (latestSession) {
        details.push(`*تاريخ آخر جلسة:* ${format_date(latestSession.date)}`);
      }

      if (latestStage.decision_date) {
        details.push(`*تم حسم المرحلة:*`);
        details.push(
          `*تاريخ الحسم:* ${format_date(latestStage.decision_date)}`,
        );
        if (latestStage.decision_number)
          details.push(`*رقم القرار:* ${latestStage.decision_number}`);
        if (latestStage.decision_summary)
          details.push(`*ملخص القرار:* ${latestStage.decision_summary}`);
      }
    }

    const description = `متابعة قضية:\n- ${details.join("\n- ")}`;
    const message = `*ملخص قضية:*\n${details.join("\n")}`;

    const menuItems: MenuItem[] = [
      {
        label: "إنشاء فاتورة لهذه القضية",
        icon: <DocumentTextIcon className="w-4 h-4" />,
        onClick: () => props.on_create_invoice(client.id, caseItem.id),
      },
      {
        label: "إرسال إلى المهام الإدارية",
        icon: <BuildingLibraryIcon className="w-4 h-4" />,
        onClick: () => {
          props.on_open_admin_task_modal({ task: description });
        },
      },
      {
        label: "مشاركة عبر واتساب",
        icon: <ShareIcon className="w-4 h-4" />,
        onClick: () => {
          share_via_whatsapp(message);
        },
      },
    ];
    props.show_context_menu(event, menuItems);
  };

  const handleTouchStart = (e: React.TouchEvent) => {
    long_press_timer.current = window.setTimeout(() => {
      const touch = e.touches[0];
      const mockEvent = {
        preventDefault: () => e.preventDefault(),
        clientX: touch.clientX,
        clientY: touch.clientY,
      };
      handleContextMenu(mockEvent as any);
    }, 500);
  };

  const handleTouchEnd = () => {
    if (long_press_timer.current !== null) {
      window.clearTimeout(long_press_timer.current);
      long_press_timer.current = null;
    }
  };

  return (
    <div className="border rounded-lg mb-2 bg-indigo-50 overflow-hidden">
      <div
        className="flex justify-between items-center p-3 hover:bg-indigo-100 cursor-pointer"
        onClick={onToggle}
        onContextMenu={handleContextMenu}
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
        onTouchMove={handleTouchEnd}
      >
        <div className="flex items-center gap-3 font-semibold text-indigo-800">
          <FolderIcon className="w-5 h-5 text-indigo-600" />
          <span>{caseItem.subject}</span>
          <span className="text-gray-600 font-normal">
            (ضد: {caseItem.opponent_name})
          </span>
          <span
            className={`px-2 py-1 text-xs rounded-full ${caseItem.status === "active" ? "bg-green-200 text-green-800" : "bg-gray-200 text-gray-800"}`}
          >
            {caseItem.status === "active"
              ? "نشطة"
              : caseItem.status === "closed"
                ? "مغلقة"
                : "معلقة"}
          </span>
        </div>
        <div className="flex items-center gap-2">
          {permissions?.can_manage_invoices && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                props.on_create_invoice(client.id, caseItem.id);
              }}
              className="p-1 text-gray-500 hover:text-green-600"
              title="إنشاء فاتورة"
            >
              <DocumentTextIcon className="w-4 h-4" />
            </button>
          )}
          {permissions?.can_add_case && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                props.on_add_stage(client.id, caseItem.id);
              }}
              className="p-1 text-gray-500 hover:text-blue-600"
            >
              <PlusIcon className="w-4 h-4" />
            </button>
          )}
          {permissions?.can_edit_case && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                props.on_edit_case(caseItem, client);
              }}
              className="p-1 text-gray-500 hover:text-blue-600"
            >
              <PencilIcon className="w-4 h-4" />
            </button>
          )}
          {permissions?.can_delete_case && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                props.on_delete_case(caseItem.id, client.id);
              }}
              className="p-1 text-gray-500 hover:text-red-600"
            >
              <TrashIcon className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>
      {expanded && (
        <div className="p-3 bg-white">
          <div className="flex border-b mb-3">
            <button
              onClick={() => set_active_tab("stages")}
              className={`px-4 py-2 text-sm font-medium ${active_tab === "stages" ? "border-b-2 border-blue-500 text-blue-600" : "text-gray-500"}`}
            >
              المراحل والجلسات
            </button>
            <button
              onClick={() => set_active_tab("accounting")}
              className={`px-4 py-2 text-sm font-medium ${active_tab === "accounting" ? "border-b-2 border-blue-500 text-blue-600" : "text-gray-500"}`}
            >
              المحاسبة
            </button>
            <button
              onClick={() => set_active_tab("documents")}
              className={`px-4 py-2 text-sm font-medium ${active_tab === "documents" ? "border-b-2 border-blue-500 text-blue-600" : "text-gray-500"}`}
            >
              الوثائق
            </button>
            <button
              onClick={() => set_active_tab("tasks")}
              className={`px-4 py-2 text-sm font-medium ${active_tab === "tasks" ? "border-b-2 border-blue-500 text-blue-600" : "text-gray-500"}`}
            >
              مهام القضية
            </button>
          </div>
          {active_tab === "stages" && (
            <div>
              {caseItem.stages.map((stage) => (
                <StageItemContainer
                  key={stage.id}
                  stage={stage}
                  caseItem={caseItem}
                  client={client}
                  props={props}
                />
              ))}
            </div>
          )}
          {active_tab === "accounting" && (
            <CaseAccounting
              case_data={caseItem}
              client={client}
              case_accounting_entries={props.accounting_entries.filter(
                (e) => e.case_id === caseItem.id,
              )}
              set_accounting_entries={props.set_accounting_entries}
              on_fee_agreement_change={handle_fee_change}
            />
          )}
          {active_tab === "documents" && <CaseDocuments caseId={caseItem.id} />}
          {active_tab === "tasks" && (
            <CaseTasks
              caseItem={caseItem}
              clientName={client.name}
              onUpdateTasks={(newTasks) => {
                props.set_clients((clients) =>
                  clients.map((c) => {
                    if (c.id === client.id) {
                      return {
                        ...c,
                        cases: c.cases.map((ca) =>
                          ca.id === caseItem.id ? { ...ca, tasks: newTasks } : ca
                        ),
                      };
                    }
                    return c;
                  })
                );
              }}
            />
          )}
        </div>
      )}
    </div>
  );
};

const CaseItemContainer: React.FC<{
  caseItem: Case;
  client: Client;
  props: ClientsTreeViewProps;
}> = ({ caseItem, client, props }) => {
  const [isExpanded, setIsExpanded] = React.useState(false);
  return (
    <CaseItem
      caseItem={caseItem}
      client={client}
      props={props}
      expanded={isExpanded}
      onToggle={() => setIsExpanded(!isExpanded)}
    />
  );
};

const ClientItem: React.FC<{
  client: Client;
  props: ClientsTreeViewProps;
  expanded: boolean;
  onToggle: () => void;
}> = ({ client, props, expanded, onToggle }) => {
  const long_press_timer = React.useRef<number | null>(null);
  const { permissions } = props;
  const { share_via_whatsapp } = useData();

  const handleContextMenu = (event: React.MouseEvent) => {
    const menuItems: MenuItem[] = [
      {
        label: "إرسال إلى المهام الإدارية",
        icon: <BuildingLibraryIcon className="w-4 h-4" />,
        onClick: () => {
          const description = `متابعة ملف الموكل: ${client.name}.\nمعلومات الاتصال: ${client.contact_info || "لا يوجد"}.`;
          props.on_open_admin_task_modal({ task: description });
        },
      },
      {
        label: "مشاركة عبر واتساب",
        icon: <ShareIcon className="w-4 h-4" />,
        onClick: () => {
          const message = [
            `*ملف موكل:*`,
            `*الاسم:* ${client.name}`,
            `*معلومات الاتصال:* ${client.contact_info || "لا يوجد"}`,
            `*عدد القضايا:* ${client.cases.length}`,
          ].join("\n");
          share_via_whatsapp(message);
        },
      },
    ];
    props.show_context_menu(event, menuItems);
  };

  const handleTouchStart = (e: React.TouchEvent) => {
    long_press_timer.current = window.setTimeout(() => {
      const touch = e.touches[0];
      const mockEvent = {
        preventDefault: () => e.preventDefault(),
        clientX: touch.clientX,
        clientY: touch.clientY,
      };
      handleContextMenu(mockEvent as any);
    }, 500);
  };

  const handleTouchEnd = () => {
    if (long_press_timer.current !== null) {
      window.clearTimeout(long_press_timer.current);
      long_press_timer.current = null;
    }
  };

  return (
    <div className="bg-sky-50 border rounded-lg shadow-sm">
      <header
        className="flex justify-between items-center p-4 cursor-pointer bg-sky-100 hover:bg-sky-200"
        onClick={onToggle}
        onContextMenu={handleContextMenu}
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
        onTouchMove={handleTouchEnd}
      >
        <div className="flex items-center gap-3">
          <UserIcon className="w-6 h-6 text-sky-700" />
          <div>
            <h3 className="font-bold text-lg text-sky-900">{client.name}</h3>
            <p className="text-sm text-gray-500">{client.contact_info}</p>
          </div>
        </div>
        <div className="flex items-center gap-1">
          <span className="text-sm font-medium text-gray-600 bg-gray-200 px-2 py-1 rounded-full">
            {client.cases.length} قضايا
          </span>
          <button
            onClick={(e) => {
              e.stopPropagation();
              props.on_print_client_statement(client.id);
            }}
            className="p-2 text-gray-500 hover:text-green-600"
            title="طباعة كشف حساب"
          >
            <PrintIcon className="w-4 h-4" />
          </button>
          {permissions?.can_add_case && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                props.on_add_case(client.id);
              }}
              className="p-2 text-gray-500 hover:text-blue-600"
              title="إضافة قضية"
            >
              <PlusIcon className="w-4 h-4" />
            </button>
          )}
          {permissions?.can_edit_client && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                props.on_edit_client(client);
              }}
              className="p-2 text-gray-500 hover:text-blue-600"
              title="تعديل الموكل"
            >
              <PencilIcon className="w-4 h-4" />
            </button>
          )}
          {permissions?.can_delete_client && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                props.on_delete_client(client.id);
              }}
              className="p-2 text-gray-500 hover:text-red-600"
              title="حذف الموكل"
            >
              <TrashIcon className="w-4 h-4" />
            </button>
          )}
          <ChevronLeftIcon
            className={`w-5 h-5 transition-transform text-gray-500 ${expanded ? "-rotate-90" : ""}`}
          />
        </div>
      </header>
      {expanded && (
        <div className="border-t border-sky-200 p-4 space-y-3 bg-white">
          {client.cases.length > 0 ? (
            client.cases.map((caseItem) => (
              <CaseItemContainer
                key={caseItem.id}
                caseItem={caseItem}
                client={client}
                props={props}
              />
            ))
          ) : (
            <p className="text-center text-gray-500 py-3">
              لا توجد قضايا لهذا الموكل.
            </p>
          )}
        </div>
      )}
    </div>
  );
};

const ClientsTreeView: React.FC<ClientsTreeViewProps> = (props) => {
  const [expandedId, setExpandedId] = React.useState<string | null>(null);

  const toggle = (id: string) => {
    setExpandedId((prevId) => (prevId === id ? null : id));
  };

  if (props.clients.length === 0) {
    return (
      <p className="p-6 text-center text-gray-500">
        لا يوجد موكلون لعرضهم. ابدأ بإضافة موكل جديد.
      </p>
    );
  }

  return (
    <div className="p-4 space-y-4">
      {props.clients.map((client) => (
        <ClientItem
          key={client.id}
          client={client}
          props={props}
          expanded={expandedId === client.id}
          onToggle={() => toggle(client.id)}
        />
      ))}
    </div>
  );
};

export default ClientsTreeView;
