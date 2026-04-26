import * as React from "react";
import { createRoot } from "react-dom/client";
import App from "./App";
import { FeedbackProvider } from "./context/FeedbackContext";
import { GlobalFeedback } from "./components/GlobalFeedback";

// Explicit interfaces for Props and State
interface ErrorBoundaryProps {
  children?: React.ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: any;
}

// Error Boundary Component to prevent white screen
class ErrorBoundary extends React.Component<
  ErrorBoundaryProps,
  ErrorBoundaryState
> {
  state: ErrorBoundaryState;
  props: ErrorBoundaryProps;

  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: any): ErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: any, errorInfo: any) {
    console.error("Uncaught React Error:", error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      const isFetchError = this.state.error
        ?.toString()
        .includes("Failed to fetch");
      return (
        <div
          className="min-h-screen bg-gray-100 flex flex-col items-center justify-center p-6 text-center"
          dir="rtl"
        >
          <div className="bg-white p-8 rounded-xl shadow-lg max-w-md w-full">
            <h2 className="text-2xl font-bold text-red-600 mb-4">
              {isFetchError
                ? "عذراً، فشل في تحميل البيانات"
                : "عذراً، حدث خطأ غير متوقع"}
            </h2>
            <p className="text-gray-600 mb-6">
              {isFetchError
                ? "يبدو أن هناك مشكلة في الاتصال بالإنترنت أو أن بعض ملفات النظام تعذر تحميلها."
                : "واجه التطبيق مشكلة تقنية تمنعه من العمل بشكل طبيعي."}
            </p>
            <button
              onClick={() => window.location.reload()}
              className="w-full bg-blue-600 text-white font-bold py-2 rounded-lg hover:bg-blue-700 transition-colors"
            >
              إعادة تحميل التطبيق
            </button>
            <details className="mt-4 text-xs text-gray-400 text-right cursor-pointer">
              <summary>تفاصيل الخطأ التقني</summary>
              <pre
                className="mt-2 p-2 bg-gray-50 rounded overflow-auto text-left"
                dir="ltr"
              >
                {this.state.error?.toString()}
              </pre>
            </details>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

// Global script to hide initial loader when React is ready
const hideInitialLoader = () => {
  const loader = document.getElementById("initial-loader");
  if (loader) {
    loader.style.opacity = "0";
    setTimeout(() => {
      loader.style.display = "none";
    }, 500);
  }
};

window.addEventListener("storage", (event) => {
  if (event.key === "lawyerAppLoggedOut" && event.newValue === "true") {
    window.location.reload();
  }
});

// Resilient Service Worker Registration
if ("serviceWorker" in navigator) {
  // Listen for messages from the service worker
  navigator.serviceWorker.addEventListener("message", (event) => {
    if (event.data && event.data.type === "RELOAD_PAGE_NOW") {
      console.log("Service Worker requested a reload.");
      window.location.reload();
    }
  });

  const registerSW = async () => {
    try {
      // Check if we are in a secure context
      if (
        window.location.protocol !== "https:" &&
        window.location.hostname !== "localhost"
      ) {
        return;
      }

      const registration = await navigator.serviceWorker.register("./sw.js", {
        scope: "./",
      });
      console.log("ServiceWorker registered");

      registration.update();
    } catch (error: any) {
      console.debug("ServiceWorker registration skipped:", error.message);
    }
  };

  window.addEventListener("load", registerSW);
}

const AppWrapper: React.FC = () => {
  const [appKey, setAppKey] = React.useState(0);

  React.useLayoutEffect(() => {
    hideInitialLoader();
  }, []);

  const handleRefresh = () => {
    setAppKey((prevKey) => prevKey + 1);
  };

  return (
    <FeedbackProvider>
      <ErrorBoundary>
        <App key={appKey} onRefresh={handleRefresh} />
        <GlobalFeedback />
      </ErrorBoundary>
    </FeedbackProvider>
  );
};

const container = document.getElementById("root");
if (container) {
  let root = (container as any).__reactRoot;
  if (!root) {
    root = createRoot(container);
    (container as any).__reactRoot = root;
  }
  root.render(
    <React.StrictMode>
      <AppWrapper />
    </React.StrictMode>,
  );
}
