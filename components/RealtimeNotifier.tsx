import * as React from "react";
import {
  XMarkIcon,
  ClockIcon,
  ArrowPathIcon,
  UserPlusIcon,
  ExclamationTriangleIcon,
} from "./icons";
import { Appointment } from "../types";

// Export RealtimeAlert for use in App.tsx
export interface RealtimeAlert {
  id: number;
  message: string;
  type?: "sync" | "userApproval" | "unpostponed";
}

// Generate clean, audible WAV audio base64 for fallback HTML audio player
function generateChimeWavBase64(): string {
  if (typeof window === "undefined") return "";
  try {
    const sampleRate = 22050;
    const duration = 0.5;
    const numSamples = Math.floor(sampleRate * duration);
    const buffer = new Uint8Array(44 + numSamples * 2);
    const view = new DataView(buffer.buffer);

    const writeString = (offset: number, str: string) => {
      for (let i = 0; i < str.length; i++) buffer[offset + i] = str.charCodeAt(i);
    };

    writeString(0, "RIFF");
    view.setUint32(4, 36 + numSamples * 2, true);
    writeString(8, "WAVE");
    writeString(12, "fmt ");
    view.setUint32(16, 16, true);
    view.setUint16(20, 1, true); // PCM
    view.setUint16(22, 1, true); // Mono
    view.setUint32(24, sampleRate, true);
    view.setUint32(28, sampleRate * 2, true);
    view.setUint16(32, 2, true);
    view.setUint16(34, 16, true);
    writeString(36, "data");
    view.setUint32(40, numSamples * 2, true);

    for (let i = 0; i < numSamples; i++) {
      const t = i / sampleRate;
      const env = Math.exp(-t * 5); // decay
      const s1 = Math.sin(2 * Math.PI * 880 * t); // 880 Hz
      const s2 = Math.sin(2 * Math.PI * 1318.5 * t); // 1318.5 Hz
      const sample = (s1 * 0.6 + s2 * 0.4) * env;
      const intSample = Math.max(-32768, Math.min(32767, Math.floor(sample * 32767)));
      view.setInt16(44 + i * 2, intSample, true);
    }

    let binary = "";
    const bytes = new Uint8Array(buffer);
    const len = bytes.byteLength;
    for (let i = 0; i < len; i++) {
      binary += String.fromCharCode(bytes[i]);
    }
    return "data:audio/wav;base64," + btoa(binary);
  } catch (e) {
    return "";
  }
}

export const appointmentSoundBase64 = generateChimeWavBase64();

// Sound for user approval notifications
export const defaultUserApprovalSoundBase64 = appointmentSoundBase64;

let sharedAudioCtx: AudioContext | null = null;

export function getSharedAudioContext(): AudioContext | null {
  if (typeof window === "undefined") return null;
  if (!sharedAudioCtx) {
    const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
    if (AudioCtx) {
      sharedAudioCtx = new AudioCtx();
    }
  }
  if (sharedAudioCtx && sharedAudioCtx.state === "suspended") {
    sharedAudioCtx.resume().catch(() => {});
  }
  return sharedAudioCtx;
}

export function playNotificationChime(
  type: "appointment" | "unpostponed" | "sync" | "userApproval" = "appointment"
) {
  // 1. Web Audio API synthesized chime
  try {
    const ctx = getSharedAudioContext();
    if (ctx) {
      if (ctx.state === "suspended") {
        ctx.resume();
      }
      const now = ctx.currentTime;

      if (type === "appointment" || type === "unpostponed") {
        // High attention 3-note ascending chime (G5 -> C6 -> E6)
        const notes = [
          { freq: 783.99, time: now, duration: 0.3, gain: 0.5 },
          { freq: 1046.5, time: now + 0.12, duration: 0.35, gain: 0.6 },
          { freq: 1318.5, time: now + 0.25, duration: 0.5, gain: 0.7 },
        ];

        notes.forEach((n) => {
          const osc = ctx.createOscillator();
          const gain = ctx.createGain();
          osc.type = "sine";
          osc.frequency.setValueAtTime(n.freq, n.time);
          gain.gain.setValueAtTime(n.gain, n.time);
          gain.gain.exponentialRampToValueAtTime(0.001, n.time + n.duration);
          osc.connect(gain);
          gain.connect(ctx.destination);
          osc.start(n.time);
          osc.stop(n.time + n.duration);
        });
      } else {
        // Standard double ping
        const osc1 = ctx.createOscillator();
        const gain1 = ctx.createGain();
        osc1.type = "sine";
        osc1.frequency.setValueAtTime(659.25, now);
        gain1.gain.setValueAtTime(0.4, now);
        gain1.gain.exponentialRampToValueAtTime(0.001, now + 0.25);
        osc1.connect(gain1);
        gain1.connect(ctx.destination);
        osc1.start(now);
        osc1.stop(now + 0.25);

        const osc2 = ctx.createOscillator();
        const gain2 = ctx.createGain();
        osc2.type = "sine";
        osc2.frequency.setValueAtTime(880, now + 0.12);
        gain2.gain.setValueAtTime(0.5, now + 0.12);
        gain2.gain.exponentialRampToValueAtTime(0.001, now + 0.4);
        osc2.connect(gain2);
        gain2.connect(ctx.destination);
        osc2.start(now + 0.12);
        osc2.stop(now + 0.4);
      }
    }
  } catch (e) {
    console.warn("Chime synthesis error:", e);
  }

  // 2. Vibration (250ms vibrate, 100ms pause, 250ms vibrate, 100ms pause, 500ms vibrate)
  if (typeof navigator !== "undefined" && "vibrate" in navigator) {
    try {
      navigator.vibrate([250, 100, 250, 100, 500]);
    } catch (e) {
      console.warn("Vibration failed:", e);
    }
  }
}

type NotificationType = {
  id: string | number;
  title: string;
  message: string;
  type: "appointment" | "sync" | "userApproval" | "unpostponed";
  duration?: number;
};

const NotificationToast: React.FC<{
  notification: NotificationType;
  onDismiss: () => void;
}> = ({ notification, onDismiss }) => {
  const [isVisible, setIsVisible] = React.useState(false);
  const timerRef = React.useRef<number | null>(null);

  React.useEffect(() => {
    // Enter animation
    requestAnimationFrame(() => setIsVisible(true));

    // Auto-dismiss logic
    const duration = notification.duration || 7000;
    const timeoutId = window.setTimeout(() => {
      setIsVisible(false);
      setTimeout(onDismiss, 300); // Wait for exit animation
    }, duration);

    timerRef.current = timeoutId;

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [notification, onDismiss]);

  const handleManualDismiss = () => {
    if (timerRef.current) clearTimeout(timerRef.current);
    setIsVisible(false);
    setTimeout(onDismiss, 300);
  };

  const getIcon = () => {
    switch (notification.type) {
      case "appointment":
        return <ClockIcon className="w-6 h-6 text-blue-500" />;
      case "sync":
        return <ArrowPathIcon className="w-6 h-6 text-green-500" />;
      case "userApproval":
        return <UserPlusIcon className="w-6 h-6 text-yellow-600" />;
      case "unpostponed":
        return <ExclamationTriangleIcon className="w-6 h-6 text-orange-500" />;
      default:
        return null;
    }
  };

  const getBorderColor = () => {
    switch (notification.type) {
      case "appointment":
        return "border-s-4 border-blue-600 bg-blue-50/95";
      case "unpostponed":
        return "border-s-4 border-amber-500 bg-amber-50/95";
      case "userApproval":
        return "border-s-4 border-yellow-500 bg-yellow-50/95";
      case "sync":
        return "border-s-4 border-green-500 bg-green-50/95";
      default:
        return "bg-white";
    }
  };

  return (
    <div
      className={`w-full max-w-md shadow-xl rounded-lg pointer-events-auto ring-1 ring-black ring-opacity-10 overflow-hidden transition-all duration-300 ease-in-out transform ${getBorderColor()} ${isVisible ? "translate-x-0 opacity-100" : "translate-x-full opacity-0"}`}
    >
      <div className="p-4">
        <div className="flex items-start">
          <div className="flex-shrink-0 pt-0.5">{getIcon()}</div>
          <div className="ms-3 w-0 flex-1">
            <p className="text-sm font-medium text-gray-900">
              {notification.title}
            </p>
            <p className="mt-1 text-sm text-gray-700">{notification.message}</p>
          </div>
          <div className="ms-4 flex-shrink-0 flex items-center gap-1.5">
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                playNotificationChime(notification.type);
              }}
              className="inline-flex items-center gap-1 text-xs text-blue-700 bg-blue-100 hover:bg-blue-200 px-2 py-1 rounded transition-colors font-medium"
              title="اختبار أو إعادة تشغيل الصوت والاهتزاز"
            >
              <span className="text-sm">🔔</span>
              <span className="hidden sm:inline">صوت</span>
            </button>
            <button
              onClick={handleManualDismiss}
              className="inline-flex text-gray-400 bg-white rounded-md hover:text-gray-500 p-1 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
            >
              <span className="sr-only">Close</span>
              <XMarkIcon className="w-5 h-5" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

interface NotificationCenterProps {
  appointmentAlerts: Appointment[];
  realtimeAlerts: RealtimeAlert[];
  userApprovalAlerts: RealtimeAlert[];
  dismissAppointmentAlert: (appointmentId: string) => void;
  dismissRealtimeAlert: (alertId: number) => void;
  dismissUserApprovalAlert: (alertId: number) => void;
}

const NotificationCenter: React.FC<NotificationCenterProps> = ({
  appointmentAlerts,
  realtimeAlerts,
  userApprovalAlerts,
  dismissAppointmentAlert,
  dismissRealtimeAlert,
  dismissUserApprovalAlert,
}) => {
  const appointmentAudioRef = React.useRef<HTMLAudioElement | null>(null);

  React.useEffect(() => {
    if (typeof window !== "undefined" && "Notification" in window) {
      if (Notification.permission === "default") {
        Notification.requestPermission().catch(() => {});
      }
    }

    const unlockAudio = () => {
      const ctx = getSharedAudioContext();
      if (ctx && ctx.state === "suspended") {
        ctx.resume().catch(() => {});
      }
    };

    window.addEventListener("click", unlockAudio, { passive: true });
    window.addEventListener("touchstart", unlockAudio, { passive: true });
    window.addEventListener("keydown", unlockAudio, { passive: true });

    return () => {
      window.removeEventListener("click", unlockAudio);
      window.removeEventListener("touchstart", unlockAudio);
      window.removeEventListener("keydown", unlockAudio);
    };
  }, []);

  const prevAlertCountRef = React.useRef({
    appointments: 0,
    realtime: 0,
    userApproval: 0,
  });

  React.useEffect(() => {
    const prev = prevAlertCountRef.current;
    if (
      appointmentAlerts.length > prev.appointments ||
      realtimeAlerts.length > prev.realtime
    ) {
      playNotificationChime("appointment");
      if (appointmentAudioRef.current) {
        appointmentAudioRef.current.currentTime = 0;
        appointmentAudioRef.current.play().catch(() => {});
      }
    }
    prevAlertCountRef.current.appointments = appointmentAlerts.length;
    prevAlertCountRef.current.realtime = realtimeAlerts.length;
  }, [appointmentAlerts.length, realtimeAlerts.length]);

  React.useEffect(() => {
    const prev = prevAlertCountRef.current;
    if (userApprovalAlerts.length > prev.userApproval) {
      playNotificationChime("userApproval");
    }
    prevAlertCountRef.current.userApproval = userApprovalAlerts.length;
  }, [userApprovalAlerts.length]);

  const formatTime = (time: string) => {
    if (!time) return "";
    let [hours, minutes] = time.split(":");
    let hh = parseInt(hours, 10);
    const ampm = hh >= 12 ? "مساءً" : "صباحًا";
    hh = hh % 12;
    hh = hh ? hh : 12;
    const finalHours = hh.toString().padStart(2, "0");
    return `${finalHours}:${minutes} ${ampm}`;
  };

  const allNotifications: NotificationType[] = React.useMemo(() => {
    const appointments: NotificationType[] = appointmentAlerts.map((alert) => {
      const timeFormatted = formatTime(alert.time);
      const assigneeText = alert.assignee ? ` | المسؤول: ${alert.assignee}` : "";
      const reminderText =
        alert.reminder_time_in_minutes !== undefined
          ? alert.reminder_time_in_minutes === 0
            ? " (الان)"
            : ` (تذكير قبل ${alert.reminder_time_in_minutes} دقيقة)`
          : "";
      return {
        id: alert.id,
        type: "appointment",
        title: "⏰ تذكير بالموعد",
        message: `${alert.title} - الساعة ${timeFormatted}${assigneeText}${reminderText}`,
        duration: 15000,
      };
    });
    const realtime: NotificationType[] = realtimeAlerts.map((alert) => ({
      id: alert.id,
      type: alert.type === "unpostponed" ? "unpostponed" : "sync",
      title:
        alert.type === "unpostponed"
          ? "تنبيه جلسات اليوم غير المرحّلة"
          : "تحديث مباشر",
      message: alert.message,
      duration: alert.type === "unpostponed" ? 12000 : 5000,
    }));
    const userApprovals: NotificationType[] = userApprovalAlerts.map(
      (alert) => ({
        id: alert.id,
        type: "userApproval",
        title: "طلب انضمام جديد",
        message: alert.message,
        duration: 15000,
      }),
    );

    return [...appointments, ...realtime, ...userApprovals].sort((a, b) => {
      const idA =
        typeof a.id === "string"
          ? parseInt(a.id.replace(/\D/g, "")) || 0
          : a.id;
      const idB =
        typeof b.id === "string"
          ? parseInt(b.id.replace(/\D/g, "")) || 0
          : b.id;
      return idB - idA;
    });
  }, [appointmentAlerts, realtimeAlerts, userApprovalAlerts]);

  const handleDismiss = (
    id: string | number,
    type: "appointment" | "sync" | "userApproval" | "unpostponed",
  ) => {
    if (type === "appointment") {
      dismissAppointmentAlert(id as string);
    } else if (type === "userApproval") {
      dismissUserApprovalAlert(id as number);
    } else {
      dismissRealtimeAlert(id as number);
    }
  };

  return (
    <div
      aria-live="assertive"
      className="fixed inset-0 flex items-start px-4 py-6 pointer-events-none sm:p-6 sm:items-start z-[100]"
    >
      <div className="w-full flex flex-col items-center space-y-3 sm:items-end">
        <audio
          ref={appointmentAudioRef}
          src={appointmentSoundBase64}
          preload="auto"
        />
        {allNotifications.map((notification) => (
          <NotificationToast
            key={notification.id}
            notification={notification}
            onDismiss={() => handleDismiss(notification.id, notification.type)}
          />
        ))}
      </div>
    </div>
  );
};

export default NotificationCenter;
