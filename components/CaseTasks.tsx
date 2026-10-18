import * as React from "react";
import { Case, CaseTask, AdminTask } from "../types";
import { PlusIcon, TrashIcon, CheckCircleIcon, PencilIcon, ExclamationCircleIcon } from "./icons";
import AdminTaskModal from "./AdminTaskModal";
import { useData } from "../context/DataContext";
import { useFeedback } from "../context/FeedbackContext";

interface CaseTasksProps {
  caseItem: Case;
  clientName?: string;
  onUpdateTasks: (tasks: CaseTask[]) => void;
}

const CaseTasks: React.FC<CaseTasksProps> = ({ caseItem, clientName, onUpdateTasks }) => {
  const {
    assistants,
    set_admin_tasks,
    delete_admin_task,
    effective_user_id,
    permissions,
    current_user_profile,
    user,
  } = useData();
  const { showFeedback } = useFeedback();
  const [isModalOpen, setIsModalOpen] = React.useState(false);
  const [editingTask, setEditingTask] = React.useState<CaseTask | null>(null);
  const [selectedTaskImageUrl, setSelectedTaskImageUrl] = React.useState<string | null>(null);

  if (permissions && !permissions.can_view_admin_tasks) {
    return (
      <div className="p-8 text-center text-gray-500 flex flex-col items-center">
        <ExclamationCircleIcon className="w-12 h-12 text-gray-300 mb-2" />
        <p>ليس لديك صلاحية للاطلاع على مهام هذه القضية من قبل المحامي المدير.</p>
      </div>
    );
  }

  const userFullName = (
    current_user_profile?.full_name ||
    user?.user_metadata?.full_name ||
    ""
  ).trim();

  const allTasks = caseItem.tasks || [];
  const tasks = React.useMemo(() => {
    if (permissions?.can_view_only_assigned_tasks && userFullName) {
      return allTasks.filter((t) => {
        const assignee = (t.assignee || "").trim();
        return (
          assignee === userFullName ||
          assignee === user?.email ||
          assignee === "بدون تخصيص"
        );
      });
    }
    return allTasks;
  }, [allTasks, permissions?.can_view_only_assigned_tasks, userFullName, user?.email]);

  const effectiveClientName = clientName || caseItem.client_name || "";
  const opponentName = caseItem.opponent_name || "";
  const caseSubject = caseItem.subject || "";

  const defaultTaskParts = [];
  if (effectiveClientName) defaultTaskParts.push(`الموكل: ${effectiveClientName}`);
  if (opponentName) defaultTaskParts.push(`الخصم: ${opponentName}`);
  if (caseSubject) defaultTaskParts.push(`موضوع القضية: ${caseSubject}`);
  const defaultTaskPrefix = defaultTaskParts.length > 0 ? `${defaultTaskParts.join(" - ")} - ` : "";

  const formatTaskText = (rawText: string) => {
    const trimmed = rawText.trim();
    if (!trimmed) return "";

    // Check if task text already contains client name, opponent name, or case subject
    const hasClient = effectiveClientName && trimmed.includes(effectiveClientName);
    const hasOpponent = opponentName && trimmed.includes(opponentName);
    const hasSubject = caseSubject && trimmed.includes(caseSubject);

    if (hasClient || hasOpponent || hasSubject) {
      return trimmed;
    }

    if (defaultTaskPrefix) {
      return `${defaultTaskPrefix}${trimmed}`;
    }
    return trimmed;
  };

  const handleTaskSubmit = (taskData: any) => {
    const formattedTaskText = formatTaskText(taskData.task || "");

    if (editingTask) {
      if (!permissions.can_edit_admin_task) {
        showFeedback("ليس لديك صلاحية لتعديل المهام.", "error");
        return;
      }
      const updatedTaskData = {
        ...taskData,
        task: formattedTaskText,
      };

      // Update existing task
      const updatedTasks = allTasks.map(t => 
        t.id === editingTask.id ? { ...t, ...updatedTaskData } : t
      );
      onUpdateTasks(updatedTasks);
      
      // Update global admin tasks
      set_admin_tasks((prev) => prev.map(t => 
        t.id === editingTask.id ? {
          ...t,
          ...updatedTaskData,
          location: taskData.location || "غير محدد",
          case_id: caseItem.id
        } : t
      ));
    } else {
      if (!permissions.can_add_admin_task) {
        showFeedback("ليس لديك صلاحية لإضافة مهام جديدة.", "error");
        return;
      }
      // Create new task
      const newTask: CaseTask = {
        id: Date.now().toString(),
        task: formattedTaskText,
        due_date: taskData.due_date,
        completed: false,
        importance: taskData.importance,
        assignee: taskData.assignee,
        image_url: taskData.image_url,
      };
      onUpdateTasks([...allTasks, newTask]);

      // Add to global admin tasks
      const globalTask: AdminTask = {
        ...newTask,
        user_id: effective_user_id || undefined,
        location: taskData.location || "غير محدد",
        case_id: caseItem.id,
        image_url: taskData.image_url,
      };
      set_admin_tasks((prev) => [...prev, globalTask]);
    }

    setIsModalOpen(false);
    setEditingTask(null);
  };

  const toggleTask = (taskId: string) => {
    if (!permissions.can_edit_admin_task) {
      showFeedback("ليس لديك صلاحية لتعديل حالة المهمة.", "error");
      return;
    }
    const newTasks = allTasks.map(t => t.id === taskId ? {...t, completed: !t.completed} : t);
    onUpdateTasks(newTasks);
    
    // Also update global admin tasks
    set_admin_tasks((prev) => prev.map(t => t.id === taskId ? {...t, completed: !t.completed} : t));
  };

  const deleteTask = (taskId: string) => {
    if (!permissions.can_delete_admin_task) {
      showFeedback("ليس لديك صلاحية لحذف المهام.", "error");
      return;
    }
    onUpdateTasks(allTasks.filter(t => t.id !== taskId));
    delete_admin_task(taskId);
  };

  const openEditModal = (task: CaseTask) => {
    if (!permissions.can_edit_admin_task) {
      showFeedback("ليس لديك صلاحية لتعديل المهام.", "error");
      return;
    }
    setEditingTask(task);
    setIsModalOpen(true);
  };

  return (
    <div className="p-4 bg-gray-50 rounded-lg">
      <div className="flex justify-between items-center mb-4">
        <h3 className="text-lg font-semibold">مهام القضية</h3>
        {permissions.can_add_admin_task && (
          <button onClick={() => { setEditingTask(null); setIsModalOpen(true); }} className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white font-semibold rounded-lg hover:bg-blue-700 transition-colors text-sm">
            <PlusIcon className="w-5 h-5" />
            <span>مهمة جديدة</span>
          </button>
        )}
      </div>
      {tasks.length === 0 ? (
        <p className="text-sm text-gray-500 text-center py-4">لا توجد مهام حالياً</p>
      ) : (
        tasks.map(task => (
          <div key={task.id} className={`flex flex-col gap-2 p-2 border-b last:border-none ${task.completed ? "opacity-50" : ""}`}>
            <div className="flex items-center gap-2">
              <button
                onClick={() => toggleTask(task.id)}
                disabled={!permissions.can_edit_admin_task}
                title={permissions.can_edit_admin_task ? "تغيير حالة الإنجاز" : "لا تملك صلاحية التعديل"}
              >
                <CheckCircleIcon className={`w-5 h-5 ${task.completed ? "text-green-500" : "text-gray-300"}`} />
              </button>
              <span className={`flex-grow ${task.completed ? "line-through text-gray-500" : ""}`}>{task.task}</span>
              {task.assignee && (
                <span className="text-xs px-2 py-0.5 bg-blue-50 text-blue-700 rounded border border-blue-200">
                  {task.assignee}
                </span>
              )}
              {permissions.can_edit_admin_task && (
                <button onClick={() => openEditModal(task)} className="p-1 hover:bg-gray-200 rounded" title="تعديل">
                  <PencilIcon className="w-5 h-5 text-gray-500" />
                </button>
              )}
              {permissions.can_delete_admin_task && (
                <button onClick={() => deleteTask(task.id)} className="p-1 hover:bg-gray-200 rounded" title="حذف">
                  <TrashIcon className="w-5 h-5 text-red-500" />
                </button>
              )}
            </div>
            {task.image_url && (
              <div className="mr-7">
                <img
                  src={task.image_url}
                  alt="صورة المهمة"
                  onClick={() => setSelectedTaskImageUrl(task.image_url!)}
                  className="w-20 h-20 object-cover rounded-lg border border-gray-200 cursor-pointer hover:opacity-90 hover:shadow-md transition-all"
                />
              </div>
            )}
          </div>
        ))
      )}
      <AdminTaskModal
        isOpen={isModalOpen}
        onClose={() => { setIsModalOpen(false); setEditingTask(null); }}
        onSubmit={handleTaskSubmit}
        initialData={
          editingTask
            ? { ...editingTask, case_id: caseItem.id }
            : {
                task: defaultTaskPrefix,
                location: "",
              }
        }
        assistants={assistants}
      />

      {/* Lightbox Modal */}
      {selectedTaskImageUrl && (
        <div
          className="fixed inset-0 bg-black bg-opacity-80 flex items-center justify-center z-50 p-4"
          onClick={() => setSelectedTaskImageUrl(null)}
        >
          <div className="relative max-w-4xl max-h-[90vh]" onClick={(e) => e.stopPropagation()}>
            <button
              onClick={() => setSelectedTaskImageUrl(null)}
              className="absolute -top-10 left-0 text-white bg-gray-800 bg-opacity-70 px-3 py-1 rounded-lg text-sm hover:bg-gray-700"
            >
              إغلاق ✕
            </button>
            <img
              src={selectedTaskImageUrl}
              alt="صورة مكبرة للمهمة"
              className="max-w-full max-h-[85vh] object-contain rounded-lg shadow-2xl"
            />
          </div>
        </div>
      )}
    </div>
  );
};

export default CaseTasks;
