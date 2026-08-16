import * as React from "react";
import { Case, CaseTask, AdminTask } from "../types";
import { PlusIcon, TrashIcon, CheckCircleIcon, PencilIcon } from "./icons";
import AdminTaskModal from "./AdminTaskModal";
import { useData } from "../context/DataContext";

interface CaseTasksProps {
  caseItem: Case;
  clientName?: string;
  onUpdateTasks: (tasks: CaseTask[]) => void;
}

const CaseTasks: React.FC<CaseTasksProps> = ({ caseItem, clientName, onUpdateTasks }) => {
  const { assistants, set_admin_tasks, user_id } = useData();
  const [isModalOpen, setIsModalOpen] = React.useState(false);
  const [editingTask, setEditingTask] = React.useState<CaseTask | null>(null);
  const [selectedTaskImageUrl, setSelectedTaskImageUrl] = React.useState<string | null>(null);
  const tasks = caseItem.tasks || [];

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
      const updatedTaskData = {
        ...taskData,
        task: formattedTaskText,
      };

      // Update existing task
      const updatedTasks = tasks.map(t => 
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
      onUpdateTasks([...tasks, newTask]);

      // Add to global admin tasks
      const globalTask: AdminTask = {
        ...newTask,
        user_id: user_id,
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
    const newTasks = tasks.map(t => t.id === taskId ? {...t, completed: !t.completed} : t);
    onUpdateTasks(newTasks);
    
    // Also update global admin tasks
    set_admin_tasks((prev) => prev.map(t => t.id === taskId ? {...t, completed: !t.completed} : t));
  };

  const deleteTask = (taskId: string) => {
    onUpdateTasks(tasks.filter(t => t.id !== taskId));
    set_admin_tasks((prev) => prev.filter(t => t.id !== taskId));
  };

  const openEditModal = (task: CaseTask) => {
    setEditingTask(task);
    setIsModalOpen(true);
  };

  return (
    <div className="p-4 bg-gray-50 rounded-lg">
      <div className="flex justify-between items-center mb-4">
        <h3 className="text-lg font-semibold">مهام القضية</h3>
        <button onClick={() => { setEditingTask(null); setIsModalOpen(true); }} className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white font-semibold rounded-lg hover:bg-blue-700 transition-colors text-sm">
          <PlusIcon className="w-5 h-5" />
          <span>مهمة جديدة</span>
        </button>
      </div>
      {tasks.length === 0 ? (
        <p className="text-sm text-gray-500 text-center py-4">لا توجد مهام حالياً</p>
      ) : (
        tasks.map(task => (
          <div key={task.id} className={`flex flex-col gap-2 p-2 border-b last:border-none ${task.completed ? "opacity-50" : ""}`}>
            <div className="flex items-center gap-2">
              <button onClick={() => toggleTask(task.id)}>
                <CheckCircleIcon className={`w-5 h-5 ${task.completed ? "text-green-500" : "text-gray-300"}`} />
              </button>
              <span className={`flex-grow ${task.completed ? "line-through text-gray-500" : ""}`}>{task.task}</span>
              <button onClick={() => openEditModal(task)} className="p-1 hover:bg-gray-200 rounded">
                <PencilIcon className="w-5 h-5 text-gray-500" />
              </button>
              <button onClick={() => deleteTask(task.id)}>
                <TrashIcon className="w-5 h-5 text-red-500" />
              </button>
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
