import React from "react";
import { useFeedback } from "../context/FeedbackContext";
import { motion, AnimatePresence } from "framer-motion";
import { CheckCircle, XCircle, AlertTriangle, Info } from "lucide-react";

export const GlobalFeedback: React.FC = () => {
  const { feedback, confirmation, closeFeedback, closeConfirmation } =
    useFeedback();

  return (
    <>
      {/* Toasts */}
      <div className="fixed top-4 left-1/2 -translate-x-1/2 z-[100] w-full max-w-sm px-4 pointer-events-none">
        <AnimatePresence>
          {feedback && (
            <motion.div
              initial={{ opacity: 0, y: -20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className={`pointer-events-auto p-4 rounded-xl shadow-2xl flex items-start gap-3 border ${
                feedback.type === "success"
                  ? "bg-green-50 border-green-200 text-green-800"
                  : feedback.type === "error"
                    ? "bg-red-50 border-red-200 text-red-800"
                    : feedback.type === "warning"
                      ? "bg-amber-50 border-amber-200 text-amber-800"
                      : "bg-blue-50 border-blue-200 text-blue-800"
              }`}
            >
              <div className="shrink-0 mt-0.5">
                {feedback.type === "success" && (
                  <CheckCircle className="w-5 h-5" />
                )}
                {feedback.type === "error" && <XCircle className="w-5 h-5" />}
                {feedback.type === "warning" && (
                  <AlertTriangle className="w-5 h-5" />
                )}
                {feedback.type === "info" && <Info className="w-5 h-5" />}
              </div>
              <div
                className="flex-1 text-sm font-medium leading-relaxed"
                dir="rtl"
              >
                {feedback.message}
              </div>
              <button
                onClick={closeFeedback}
                className="shrink-0 opacity-50 hover:opacity-100 transition-opacity"
              >
                <XCircle className="w-5 h-5 opacity-50" />
              </button>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Confirmation Modal */}
      <AnimatePresence>
        {confirmation && (
          <div className="fixed inset-0 z-[110] flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden"
              dir="rtl"
            >
              <div className="p-6">
                <h3 className="text-xl font-bold text-gray-900 mb-2">
                  {confirmation.title}
                </h3>
                <p className="text-gray-600 leading-relaxed">
                  {confirmation.message}
                </p>
              </div>
              <div className="bg-gray-50 px-6 py-4 flex flex-row-reverse gap-3">
                <button
                  onClick={() => {
                    confirmation.onConfirm();
                    closeConfirmation();
                  }}
                  className={`px-6 py-2.5 text-white font-bold rounded-xl transition-colors shadow-lg ${
                    confirmation.variant === "danger"
                      ? "bg-red-600 hover:bg-red-700 shadow-red-200"
                      : "bg-blue-600 hover:bg-blue-700 shadow-blue-200"
                  }`}
                >
                  {confirmation.confirmText || "تأكيد"}
                </button>
                <button
                  onClick={() => {
                    if (confirmation.onCancel) confirmation.onCancel();
                    closeConfirmation();
                  }}
                  className="px-6 py-2.5 bg-white text-gray-700 font-bold rounded-xl border border-gray-200 hover:bg-gray-100 transition-colors"
                >
                  {confirmation.cancelText || "إلغاء"}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </>
  );
};
