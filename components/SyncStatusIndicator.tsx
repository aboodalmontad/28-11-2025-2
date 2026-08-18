import * as React from "react";
import {
  ArrowPathIcon,
  NoSymbolIcon,
  CheckCircleIcon,
  ExclamationCircleIcon,
  ListBulletIcon,
  WifiSlashIcon,
} from "./icons";
import { SyncStatus, SyncLogEntry } from "../hooks/useSync";
import SyncLogModal from "./SyncLogModal";

interface SyncStatusIndicatorProps {
  status: SyncStatus;
  last_error: string | null;
  is_dirty: boolean;
  is_online: boolean;
  on_manual_sync: () => void;
  is_auto_sync_enabled: boolean;
  className?: string;
  sync_log?: SyncLogEntry[];
  on_clear_log?: () => void;
}

const SyncStatusIndicator: React.FC<SyncStatusIndicatorProps> = ({
  status,
  last_error,
  is_dirty,
  is_online,
  on_manual_sync,
  is_auto_sync_enabled,
  className = "",
  sync_log = [],
  on_clear_log = () => {},
}) => {
  const [isLogOpen, setIsLogOpen] = React.useState(false);
  const [isManualSyncing, setIsManualSyncing] = React.useState(false);

  React.useEffect(() => {
    if (status !== "syncing") {
      const timer = setTimeout(() => {
        setIsManualSyncing(false);
      }, 500);
      return () => clearTimeout(timer);
    }
  }, [status]);

  const handleManualSyncClick = () => {
    setIsManualSyncing(true);
    on_manual_sync();
  };

  let displayStatus;
  if (!is_online) {
    displayStatus = {
      icon: <WifiSlashIcon className="w-5 h-5 text-red-500 stroke-2 animate-pulse" />,
      text: "منقطع الاتصال",
      className: "text-red-500 font-bold",
      title: "انقطع الاتصال بالإنترنت. التغييرات محفوظة محلياً وسيتم مزامنتها عند عودة الشبكة.",
    };
  } else if (!is_auto_sync_enabled && is_dirty) {
    displayStatus = {
      icon: <ArrowPathIcon className="w-5 h-5 text-yellow-600 animate-pulse" />,
      text: "مزامنة يدوية مطلوبة",
      className: "text-yellow-600",
      title: "المزامنة التلقائية متوقفة. اضغط للمزامنة الآن.",
    };
  } else if (status === "unconfigured" || status === "uninitialized") {
    displayStatus = {
      icon: <ExclamationCircleIcon className="w-5 h-5 text-red-500" />,
      text: "الإعداد مطلوب",
      className: "text-red-500",
      title: "قاعدة البيانات غير مهيأة.",
    };
  } else if (status === "loading") {
    displayStatus = {
      icon: <ArrowPathIcon className="w-5 h-5 text-gray-500 animate-spin" />,
      text: "جاري التحميل...",
      className: "text-gray-500",
      title: "جاري تحميل البيانات...",
    };
  } else if (status === "syncing" || isManualSyncing) {
    if (isManualSyncing) {
      displayStatus = {
        icon: <ArrowPathIcon className="w-5 h-5 text-blue-500 animate-spin" />,
        text: "جاري المزامنة...",
        className: "text-blue-500 font-medium",
        title: "جاري مزامنة بياناتك مع السحابة...",
      };
    } else {
      displayStatus = {
        icon: <CheckCircleIcon className="w-5 h-5 text-green-500" />,
        text: "متزامن",
        className: "text-green-500",
        title: "مزامنة سريعة في الخلفية...",
      };
    }
  } else if (status === "error") {
    displayStatus = {
      icon: <ExclamationCircleIcon className="w-5 h-5 text-red-500" />,
      text: "فشل المزامنة",
      className: "text-red-500",
      title: `فشل المزامنة: ${last_error}`,
    };
  } else if (is_dirty && !is_auto_sync_enabled) {
    displayStatus = {
      icon: <ArrowPathIcon className="w-5 h-5 text-yellow-600" />,
      text: "تغييرات غير محفوظة",
      className: "text-yellow-600",
      title: "لديك تغييرات لم تتم مزامنتها بعد.",
    };
  } else {
    displayStatus = {
      icon: <CheckCircleIcon className="w-5 h-5 text-green-500" />,
      text: "متزامن",
      className: "text-green-500",
      title: "جميع بياناتك محدثة.",
    };
  }

  const canSyncManually =
    is_online &&
    status !== "syncing" &&
    status !== "loading" &&
    status !== "unconfigured" &&
    status !== "uninitialized" &&
    !isManualSyncing;

  return (
    <div className="flex items-center gap-1">
      <button
        onClick={canSyncManually ? handleManualSyncClick : undefined}
        disabled={!canSyncManually}
        className={`flex items-center gap-2 text-sm font-semibold p-2 rounded-lg ${canSyncManually ? "cursor-pointer hover:bg-gray-100" : "cursor-default"} ${className}`}
        title={displayStatus.title}
      >
        {displayStatus.icon}
        <span className={`${displayStatus.className} hidden sm:inline`}>
          {displayStatus.text}
        </span>
      </button>

      {sync_log.length > 0 && (
        <button
          onClick={() => setIsLogOpen(true)}
          className="p-2 text-gray-500 hover:bg-gray-100 rounded-lg transition-colors"
          title="عرض سجل المزامنة"
        >
          <ListBulletIcon className="w-5 h-5" />
        </button>
      )}

      <SyncLogModal
        isOpen={isLogOpen}
        onClose={() => setIsLogOpen(false)}
        logs={sync_log}
        onClear={on_clear_log}
      />
    </div>
  );
};

export default SyncStatusIndicator;
