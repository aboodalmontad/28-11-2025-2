import * as React from "react";
import DatePicker from "./DatePicker";
import { Session, Stage } from "../types";
import {
  format_date,
  is_before_today,
  is_today,
  is_weekend,
  get_public_holiday,
  parse_input_date_string,
  safe_revive_date,
} from "../utils/dateUtils";
import { PencilIcon, TrashIcon, ScaleIcon, GavelIcon } from "./icons";
import { useFeedback } from "../context/FeedbackContext";

interface SessionsTableProps {
  sessions: Session[];
  onPostpone?: (sessionId: string, newDate: Date, reason: string) => void;
  onEdit?: (session: Session) => void;
  onDelete?: (sessionId: string) => void;
  onDecide?: (session: Session) => void;
  showSessionDate?: boolean;
  onUpdate?: (sessionId: string, updatedFields: Partial<Session>) => void;
  assistants?: string[];
  allowPostponingPastSessions?: boolean;
  stage?: Stage;
  onContextMenu?: (event: React.MouseEvent, session: Session) => void;
}

const SessionsTable: React.FC<SessionsTableProps> = ({
  sessions,
  onPostpone,
  onEdit,
  onDelete,
  onDecide,
  showSessionDate = false,
  onUpdate,
  assistants,
  allowPostponingPastSessions = false,
  stage,
  onContextMenu,
}) => {
  const { confirm } = useFeedback();
  const [postponeData, setPostponeData] = React.useState<
    Record<string, { date: string; reason: string }>
  >({});
  const [errors, setErrors] = React.useState<Record<string, string>>({});
  const [editingCell, setEditingCell] = React.useState<{
    sessionId: string;
    field: keyof Session;
  } | null>(null);
  const [edit_value, set_edit_value] = React.useState<
    string | number | undefined
  >("");
  const longPressTimer = React.useRef<number | null>(null);

  const handleTouchStart = (e: React.TouchEvent, session: Session) => {
    if (!onContextMenu) return;
    longPressTimer.current = window.setTimeout(() => {
      const touch = e.touches[0];
      const mockEvent = {
        preventDefault: () => e.preventDefault(),
        clientX: touch.clientX,
        clientY: touch.clientY,
      };
      onContextMenu(mockEvent as any, session);
    }, 500);
  };

  const handleTouchEnd = () => {
    if (longPressTimer.current !== null) {
      window.clearTimeout(longPressTimer.current);
      longPressTimer.current = null;
    }
  };

  const handleInputChange = (
    sessionId: string,
    field: "date" | "reason",
    value: string,
  ) => {
    setPostponeData((prev) => ({
      ...prev,
      [sessionId]: {
        ...(prev[sessionId] || { date: "", reason: "" }),
        [field]: value,
      },
    }));
    // Clear error when user edits fields
    if (errors[sessionId]) {
      setErrors((prev) => {
        const newErrors = { ...prev };
        delete newErrors[sessionId];
        return newErrors;
      });
    }
  };

  const handlePostponeClick = (sessionId: string) => {
    if (!onPostpone) return;

    const data = postponeData[sessionId];
    const session = sessions.find((s) => s.id === sessionId);

    if (!session) {
      console.error("Could not find session to postpone");
      return;
    }

    if (data && data.date && data.reason) {
      const newDate = parse_input_date_string(data.date);

      if (!newDate) {
        setErrors((prev) => ({
          ...prev,
          [sessionId]: "التاريخ المحدد غير صالح.",
        }));
        return;
      }

      const newDateStart = new Date(
        newDate.getFullYear(),
        newDate.getMonth(),
        newDate.getDate(),
      );
      const sessionDate = safe_revive_date(session.date);
      const sessionDateStart = new Date(
        sessionDate.getFullYear(),
        sessionDate.getMonth(),
        sessionDate.getDate(),
      );

      if (newDateStart <= sessionDateStart) {
        setErrors((prev) => ({
          ...prev,
          [sessionId]:
            "تاريخ الجلسة القادمة يجب أن يكون بعد تاريخ الجلسة الحالية.",
        }));
        return;
      }

      const holidayName = get_public_holiday(newDate);
      const isWknd = is_weekend(newDate);

      const performPostpone = () => {
        setErrors((prev) => {
          const newErrors = { ...prev };
          delete newErrors[sessionId];
          return newErrors;
        });

        onPostpone(sessionId, newDate, data.reason);
        setPostponeData((prev) => {
          const newState = { ...prev };
          delete newState[sessionId];
          return newState;
        });
      };

      if (holidayName || isWknd) {
        let warningMessage = `تنبيه: التاريخ الذي اخترته هو يوم عطلة`;
        if (holidayName) {
          warningMessage += ` (${holidayName}).`;
        } else if (isWknd) {
          const dayName = new Intl.DateTimeFormat("ar-SY", {
            weekday: "long",
          }).format(newDate);
          warningMessage += ` (${dayName}).`;
        }
        warningMessage += `\nهل أنت متأكد من ترحيل الجلسة إلى هذا اليوم؟`;

        confirm({
          title: "تنبيه عطلة",
          message: warningMessage,
          confirmText: "نعم، ترحيل",
          cancelText: "إلغاء",
          onConfirm: performPostpone,
        });
      } else {
        performPostpone();
      }
    } else {
      setErrors((prev) => ({
        ...prev,
        [sessionId]: "يرجى إدخال تاريخ وسبب التأجيل.",
      }));
    }
  };

  const handleCellClick = (session: Session, field: keyof Session) => {
    if (!onUpdate) return;
    const value = session[field];
    if (typeof value === "boolean") {
      return;
    }
    setEditingCell({ sessionId: session.id, field });
    set_edit_value(value);
  };

  const handleSaveEdit = () => {
    if (!editingCell || !onUpdate) return;

    const currentSession = sessions.find((s) => s.id === editingCell.sessionId);
    if (currentSession && currentSession[editingCell.field] !== edit_value) {
      onUpdate(editingCell.sessionId, { [editingCell.field]: edit_value });
    }

    setEditingCell(null);
  };

  const handleCancelEdit = () => {
    setEditingCell(null);
  };

  const handleInputKeyDown = (
    e: React.KeyboardEvent<HTMLInputElement | HTMLSelectElement>,
  ) => {
    if (e.key === "Enter") {
      e.preventDefault();
      handleSaveEdit();
    } else if (e.key === "Escape") {
      handleCancelEdit();
    }
  };

  if (sessions.length === 0) {
    return (
      <p className="p-4 text-gray-500 text-center">لا توجد جلسات لعرضها.</p>
    );
  }

  return (
    <div className="overflow-x-auto print:overflow-visible">
      <table className="w-full text-sm text-right text-gray-600">
        <thead className="text-xs text-gray-700 uppercase bg-gray-100">
          <tr>
            <th className="px-2 sm:px-6 py-3">المحكمة</th>
            <th className="px-2 sm:px-6 py-3">رقم الأساس</th>
            {showSessionDate && (
              <th className="px-2 sm:px-6 py-3">تاريخ الجلسة</th>
            )}
            <th className="px-2 sm:px-6 py-3">الموكل</th>
            <th className="px-2 sm:px-6 py-3">الخصم</th>
            <th className="px-2 sm:px-6 py-3">المكلف بالحضور</th>
            <th className="px-2 sm:px-6 py-3">سبب التأجيل</th>
            {/* Only show these headers if postponement is allowed/possible in general */}
            <th className="px-2 sm:px-6 py-3 min-w-[170px] no-print">
              تاريخ الجلسة القادمة
            </th>
            <th className="px-2 sm:px-6 py-3 min-w-[200px] no-print">
              سبب التأجيل القادم
            </th>
            <th className="px-2 sm:px-6 py-3 no-print">إجراءات</th>
          </tr>
        </thead>
        <tbody>
          {sessions.map((s) => {
            const isStageDecided = stage
              ? !!stage.decision_date
              : !!s.stage_decision_date;
            const isEffectivelyPostponed =
              s.is_postponed || !!s.next_session_date;
            const isOverdue =
              is_before_today(s.date) &&
              !isEffectivelyPostponed &&
              !isStageDecided;
            const isUpcoming =
              !is_before_today(s.date) &&
              !is_today(s.date) &&
              !isEffectivelyPostponed &&
              !isStageDecided;
            const isTodaySession =
              is_today(s.date) && !isEffectivelyPostponed && !isStageDecided;

            // IMPORTANT: Only show postponement fields if onPostpone is provided AND other conditions met
            const showPostponeFields =
              !!onPostpone &&
              !isEffectivelyPostponed &&
              !isStageDecided &&
              (!is_before_today(s.date) || allowPostponingPastSessions);
            const isEditing = (field: keyof Session) =>
              onUpdate &&
              editingCell?.sessionId === s.id &&
              editingCell?.field === field;
            const cellClasses = onUpdate
              ? "cursor-pointer hover:bg-blue-50 transition-colors duration-150"
              : "";
            const nextReasonCellClasses =
              onUpdate && isEffectivelyPostponed
                ? "cursor-pointer hover:bg-blue-50 transition-colors duration-150"
                : "";

            return (
              <tr
                key={s.id}
                onContextMenu={(e) => onContextMenu && onContextMenu(e, s)}
                onTouchStart={(e) => handleTouchStart(e, s)}
                onTouchEnd={handleTouchEnd}
                onTouchMove={handleTouchEnd}
                className={`bg-white border-b hover:bg-gray-50 ${editingCell?.sessionId === s.id ? "bg-blue-50" : ""} ${isOverdue ? "bg-red-50/50" : ""}`}
              >
                <td
                  className={`px-2 sm:px-6 py-4 ${cellClasses}`}
                  onClick={() =>
                    !isEditing("court") && handleCellClick(s, "court")
                  }
                >
                  <div className="flex flex-col gap-1">
                    {isEditing("court") ? (
                      <input
                        type="text"
                        value={edit_value || ""}
                        onChange={(e) => set_edit_value(e.target.value)}
                        onBlur={handleSaveEdit}
                        onKeyDown={handleInputKeyDown}
                        className="p-1 border rounded bg-white w-full"
                        autoFocus
                      />
                    ) : (
                      s.court
                    )}
                    <div className="flex flex-wrap gap-1">
                      {isStageDecided && (
                        <span className="px-1.5 py-0.5 bg-gray-100 text-gray-700 text-[10px] rounded-md font-bold border border-gray-300">
                          حسمت
                        </span>
                      )}
                      {isEffectivelyPostponed && (
                        <span className="px-1.5 py-0.5 bg-orange-100 text-orange-700 text-[10px] rounded-md font-bold">
                          مؤجلة
                        </span>
                      )}
                      {isOverdue && (
                        <span className="px-1.5 py-0.5 bg-red-100 text-red-700 text-[10px] rounded-md font-bold">
                          غير مرحلة
                        </span>
                      )}
                      {isUpcoming && (
                        <span className="px-1.5 py-0.5 bg-blue-100 text-blue-700 text-[10px] rounded-md font-bold">
                          جلسة قادمة
                        </span>
                      )}
                      {isTodaySession && (
                        <span className="px-1.5 py-0.5 bg-green-100 text-green-700 text-[10px] rounded-md font-bold">
                          جلسة اليوم
                        </span>
                      )}
                    </div>
                  </div>
                </td>
                <td
                  className={`px-2 sm:px-6 py-4 ${cellClasses}`}
                  onClick={() =>
                    !isEditing("case_number") &&
                    handleCellClick(s, "case_number")
                  }
                >
                  {isEditing("case_number") ? (
                    <input
                      type="text"
                      value={edit_value || ""}
                      onChange={(e) => set_edit_value(e.target.value)}
                      onBlur={handleSaveEdit}
                      onKeyDown={handleInputKeyDown}
                      className="p-1 border rounded bg-white w-full"
                      autoFocus
                    />
                  ) : (
                    s.case_number
                  )}
                </td>
                {showSessionDate && (
                  <td className="px-2 sm:px-6 py-4">{format_date(s.date)}</td>
                )}
                <td
                  className={`px-2 sm:px-6 py-4 ${cellClasses}`}
                  onClick={() =>
                    !isEditing("client_name") &&
                    handleCellClick(s, "client_name")
                  }
                >
                  {isEditing("client_name") ? (
                    <input
                      type="text"
                      value={edit_value || ""}
                      onChange={(e) => set_edit_value(e.target.value)}
                      onBlur={handleSaveEdit}
                      onKeyDown={handleInputKeyDown}
                      className="p-1 border rounded bg-white w-full"
                      autoFocus
                    />
                  ) : (
                    s.client_name
                  )}
                </td>
                <td
                  className={`px-2 sm:px-6 py-4 ${cellClasses}`}
                  onClick={() =>
                    !isEditing("opponent_name") &&
                    handleCellClick(s, "opponent_name")
                  }
                >
                  {isEditing("opponent_name") ? (
                    <input
                      type="text"
                      value={edit_value || ""}
                      onChange={(e) => set_edit_value(e.target.value)}
                      onBlur={handleSaveEdit}
                      onKeyDown={handleInputKeyDown}
                      className="p-1 border rounded bg-white w-full"
                      autoFocus
                    />
                  ) : (
                    s.opponent_name
                  )}
                </td>
                <td
                  className={`px-2 sm:px-6 py-4 ${cellClasses}`}
                  onClick={() =>
                    !isEditing("assignee") && handleCellClick(s, "assignee")
                  }
                >
                  {isEditing("assignee") ? (
                    <select
                      value={edit_value || "بدون تخصيص"}
                      onChange={(e) => set_edit_value(e.target.value)}
                      onBlur={handleSaveEdit}
                      onKeyDown={handleInputKeyDown}
                      className="p-1 border rounded bg-white w-full"
                      autoFocus
                    >
                      {assistants?.map((a, index) => (
                        <option key={`${a}-${index}`} value={a}>
                          {a}
                        </option>
                      ))}
                    </select>
                  ) : (
                    s.assignee || "-"
                  )}
                </td>
                <td
                  className={`px-2 sm:px-6 py-4 ${isStageDecided ? "" : cellClasses}`}
                  onClick={() =>
                    !isEditing("postponement_reason") &&
                    !isStageDecided &&
                    handleCellClick(s, "postponement_reason")
                  }
                >
                  {isEditing("postponement_reason") && !isStageDecided ? (
                    <input
                      type="text"
                      value={edit_value || ""}
                      onChange={(e) => set_edit_value(e.target.value)}
                      onBlur={handleSaveEdit}
                      onKeyDown={handleInputKeyDown}
                      className="p-1 border rounded bg-white w-full"
                      autoFocus
                    />
                  ) : (
                    s.postponement_reason || "لا يوجد"
                  )}
                </td>

                {showPostponeFields ? (
                  <>
                    <td className="px-2 sm:px-6 py-4 no-print">
                      <DatePicker
                        value={postponeData[s.id]?.date || ""}
                        onChange={(date) =>
                          handleInputChange(s.id, "date", date)
                        }
                        aria-label="تاريخ الجلسة القادمة"
                        className={
                          errors[s.id]
                            ? "border-red-500 focus:ring-red-500"
                            : ""
                        }
                      />
                    </td>
                    <td className="px-2 sm:px-6 py-4 no-print">
                      <input
                        type="text"
                        placeholder="سبب التأجيل..."
                        className={`p-2 border rounded-md w-full focus:outline-none focus:ring-2 ${errors[s.id] ? "border-red-500 focus:ring-red-500" : "focus:ring-blue-500"}`}
                        value={postponeData[s.id]?.reason || ""}
                        onChange={(e) =>
                          handleInputChange(s.id, "reason", e.target.value)
                        }
                        aria-label="سبب التأجيل القادم"
                      />
                    </td>
                    <td className="px-2 sm:px-6 py-4 no-print">
                      <div className="flex flex-col items-start gap-1">
                        <div className="flex items-center gap-1">
                          <button
                            onClick={() => handlePostponeClick(s.id)}
                            className="px-3 py-2 bg-blue-600 text-white font-semibold rounded-lg hover:bg-blue-700 transition-colors disabled:bg-gray-300"
                            disabled={
                              !postponeData[s.id]?.date ||
                              !postponeData[s.id]?.reason
                            }
                            title="ترحيل"
                          >
                            ترحيل
                          </button>
                          {onDecide && (
                            <button
                              onClick={() => onDecide(s)}
                              className="p-2 text-gray-500 hover:text-green-600"
                              title="تسجيل قرار الحسم"
                            >
                              <ScaleIcon className="w-4 h-4" />
                            </button>
                          )}
                          {onEdit && (
                            <button
                              onClick={() => onEdit(s)}
                              className="p-2 text-gray-500 hover:text-blue-600"
                              aria-label="تعديل"
                            >
                              <PencilIcon className="w-4 h-4" />
                            </button>
                          )}
                          {onDelete && (
                            <button
                              onClick={() => onDelete(s.id)}
                              className="p-2 text-gray-500 hover:text-red-600"
                              aria-label="حذف"
                            >
                              <TrashIcon className="w-4 h-4" />
                            </button>
                          )}
                        </div>
                        {errors[s.id] && (
                          <p className="text-red-600 text-xs mt-1">
                            {errors[s.id]}
                          </p>
                        )}
                      </div>
                    </td>
                  </>
                ) : (
                  <>
                    <td className="px-2 sm:px-6 py-4 text-center no-print">
                      {s.next_session_date
                        ? format_date(s.next_session_date)
                        : "-"}
                    </td>
                    <td
                      className={`px-2 sm:px-6 py-4 no-print ${nextReasonCellClasses}`}
                      onClick={() =>
                        !isEditing("next_postponement_reason") &&
                        isEffectivelyPostponed &&
                        handleCellClick(s, "next_postponement_reason")
                      }
                    >
                      {isEditing("next_postponement_reason") ? (
                        <input
                          type="text"
                          value={edit_value || ""}
                          onChange={(e) => set_edit_value(e.target.value)}
                          onBlur={handleSaveEdit}
                          onKeyDown={handleInputKeyDown}
                          className="p-1 border rounded bg-white w-full"
                          autoFocus
                        />
                      ) : (
                        s.next_postponement_reason || "-"
                      )}
                    </td>
                    <td className="px-2 sm:px-6 py-4 text-center no-print">
                      {onEdit || onDelete ? (
                        <div className="flex items-center justify-center gap-2">
                          {onEdit && (
                            <button
                              onClick={() => onEdit(s)}
                              className="p-2 text-gray-500 hover:text-blue-600"
                              aria-label="تعديل"
                            >
                              <PencilIcon className="w-4 h-4" />
                            </button>
                          )}
                          {onDelete && (
                            <button
                              onClick={() => onDelete(s.id)}
                              className="p-2 text-gray-500 hover:text-red-600"
                              aria-label="حذف"
                            >
                              <TrashIcon className="w-4 h-4" />
                            </button>
                          )}
                        </div>
                      ) : isStageDecided ? (
                        <GavelIcon
                          className="w-5 h-5 text-green-600 mx-auto"
                          title="تم حسم المرحلة"
                        />
                      ) : (
                        "-"
                      )}
                    </td>
                  </>
                )}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
};

export default SessionsTable;
