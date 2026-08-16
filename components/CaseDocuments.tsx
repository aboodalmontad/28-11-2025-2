import * as React from "react";
import { useData } from "../context/DataContext";
import { useFeedback } from "../context/FeedbackContext";
import { CaseDocument } from "../types";
import { format_date, safe_revive_date } from "../utils/dateUtils";
import {
  DocumentArrowUpIcon,
  TrashIcon,
  DocumentTextIcon,
  XMarkIcon,
  ExclamationTriangleIcon,
  ArrowPathIcon,
  CameraIcon,
  CloudArrowUpIcon,
  CloudArrowDownIcon,
  CheckCircleIcon,
  ExclamationCircleIcon,
  ArrowDownTrayIcon,
  MagnifyingGlassPlusIcon,
  MagnifyingGlassMinusIcon,
  ArrowsPointingOutIcon,
  ArrowTopRightOnSquareIcon,
} from "./icons";
import { renderAsync } from "docx-preview";

interface CaseDocumentsProps {
  caseId: string;
}

const SyncStatusIcon: React.FC<{ state: CaseDocument["local_state"] }> = ({
  state,
}) => {
  switch (state) {
    case "synced":
      return (
        <CheckCircleIcon
          className="w-5 h-5 text-green-500"
          title="تمت المزامنة"
        />
      );
    case "pending_upload":
      return (
        <CloudArrowUpIcon
          className="w-5 h-5 text-blue-500 animate-pulse"
          title="بانتظار الرفع"
        />
      );
    case "pending_download":
      return (
        <CloudArrowDownIcon
          className="w-5 h-5 text-gray-400"
          title="جاهز للتنزيل"
        />
      );
    case "downloading":
      return (
        <CloudArrowDownIcon
          className="w-5 h-5 text-blue-500 animate-spin"
          title="جاري التنزيل..."
        />
      );
    case "error":
      return (
        <ExclamationCircleIcon
          className="w-5 h-5 text-red-500"
          title="فشل المزامنة"
        />
      );
    default:
      return null;
  }
};

const FilePreview: React.FC<{
  doc: CaseDocument;
  onPreview: (doc: CaseDocument) => void;
  onDelete: (doc: CaseDocument) => void;
}> = ({ doc, onPreview, onDelete }) => {
  const [thumbnailUrl, setThumbnailUrl] = React.useState<string | null>(null);
  const [isLoadingThumbnail, setIsLoadingThumbnail] = React.useState(false);
  const { get_document_file } = useData();

  React.useEffect(() => {
    let objectUrl: string | null = null;
    let isMounted = true;
    const generateThumbnail = async () => {
      if (
        doc.local_state === "pending_download" ||
        !doc.type.startsWith("image/")
      ) {
        setIsLoadingThumbnail(false);
        return;
      }

      setIsLoadingThumbnail(true);
      const file = await get_document_file(doc.id);
      if (!file || !isMounted) {
        setIsLoadingThumbnail(false);
        return;
      }

      if (doc.type.startsWith("image/")) {
        objectUrl = URL.createObjectURL(file);
        setThumbnailUrl(objectUrl);
      }
      setIsLoadingThumbnail(false);
    };

    generateThumbnail();

    return () => {
      isMounted = false;
      if (objectUrl) {
        URL.revokeObjectURL(objectUrl);
      }
    };
  }, [doc.id, doc.type, doc.local_state, get_document_file]);

  return (
    <div className="relative group border rounded-lg overflow-hidden bg-gray-50 flex flex-col aspect-w-1 aspect-h-1">
      <div className="absolute top-2 right-2 z-10 opacity-0 group-hover:opacity-100 transition-opacity">
        <button
          onClick={(e) => {
            e.stopPropagation();
            onDelete(doc);
          }}
          className="p-1.5 bg-red-500 text-white rounded-full hover:bg-red-600 shadow-md"
        >
          <TrashIcon className="w-4 h-4" />
        </button>
      </div>
      <div className="absolute top-2 left-2 z-10">
        <SyncStatusIcon state={doc.local_state} />
      </div>
      <div
        className="flex-grow flex items-center justify-center cursor-pointer overflow-hidden"
        onClick={() => onPreview(doc)}
      >
        {isLoadingThumbnail ? (
          <div className="flex-grow flex items-center justify-center bg-gray-200 w-full h-full">
            <ArrowPathIcon className="w-8 h-8 text-gray-400 animate-spin" />
          </div>
        ) : thumbnailUrl ? (
          <img
            src={thumbnailUrl}
            alt={doc.name}
            className="object-cover w-full h-full"
          />
        ) : (
          <div className="flex-grow flex items-center justify-center bg-gray-200 w-full h-full">
            <DocumentTextIcon className="w-12 h-12 text-gray-400" />
          </div>
        )}
      </div>
      <div className="p-2 bg-white/80 backdrop-blur-sm border-t">
        <p
          className="text-xs font-medium text-gray-800 truncate"
          title={doc.name}
        >
          {doc.name}
        </p>
        <p className="text-xs text-gray-500">
          {(doc.size / 1024).toFixed(1)} KB
        </p>
      </div>
    </div>
  );
};

const TextPreview: React.FC<{ file: File; name: string }> = ({
  file,
  name,
}) => {
  const [content, setContent] = React.useState<string | null>(null);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    const reader = new FileReader();
    reader.onload = (e) => setContent(e.target?.result as string);
    reader.onerror = () => setError("خطأ في قراءة الملف.");
    reader.readAsText(file);
  }, [file]);

  return (
    <div className="w-full h-full bg-white p-4 overflow-auto rounded text-right">
      {content === null && !error && (
        <div className="text-center p-8 text-gray-600">
          جاري تحميل المحتوى...
        </div>
      )}
      {error && <div className="text-center p-8 text-red-600">{error}</div>}
      {content && (
        <pre className="text-sm whitespace-pre-wrap text-gray-800 font-mono">
          {content}
        </pre>
      )}
    </div>
  );
};

const DocxPreview: React.FC<{ file: File; name: string }> = ({
  file,
  name,
}) => {
  const previewerRef = React.useRef<HTMLDivElement>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [isLoading, setIsLoading] = React.useState(true);

  React.useEffect(() => {
    if (!previewerRef.current) {
      setIsLoading(false);
      return;
    }

    renderAsync(file, previewerRef.current)
      .then(() => {
        setIsLoading(false);
      })
      .catch((e) => {
        console.error("Docx-preview error:", e);
        setError("حدث خطأ أثناء عرض المستند. قد يكون الملف تالفاً.");
        setIsLoading(false);
      });
  }, [file]);

  return (
    <div className="w-full h-full bg-white p-8 overflow-auto rounded relative">
      {isLoading && (
        <div className="absolute inset-0 flex items-center justify-center bg-white/70 z-10">
          <ArrowPathIcon className="w-8 h-8 text-blue-600 animate-spin" />
        </div>
      )}
      {error ? (
        <div className="flex flex-col items-center justify-center h-full text-center p-8">
          <ExclamationCircleIcon className="w-12 h-12 text-red-500 mb-4" />
          <h4 className="text-lg font-bold text-red-800">فشل العرض</h4>
          <p className="text-gray-600 mt-2 mb-6">{error}</p>
          <a
            href={URL.createObjectURL(file)}
            download={name}
            className="flex items-center gap-2 px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            <ArrowDownTrayIcon className="w-5 h-5" />
            <span>تنزيل الملف لفتحه يدوياً</span>
          </a>
        </div>
      ) : (
        <div
          ref={previewerRef}
          className="docx-container bg-white shadow-sm p-4 min-h-[500px]"
        />
      )}
    </div>
  );
};

const ImageViewer: React.FC<{ src: string; name: string }> = ({
  src,
  name,
}) => {
  const [scale, setScale] = React.useState(1);
  const [rotation, setRotation] = React.useState(0);
  const [isDragging, setIsDragging] = React.useState(false);
  const [position, setPosition] = React.useState({ x: 0, y: 0 });
  const dragStart = React.useRef({ x: 0, y: 0 });

  const handleZoomIn = () => setScale((prev) => Math.min(prev + 0.25, 4));
  const handleZoomOut = () => setScale((prev) => Math.max(prev - 0.25, 0.5));
  const handleRotate = () => setRotation((prev) => (prev + 90) % 360);
  const handleReset = () => {
    setScale(1);
    setRotation(0);
    setPosition({ x: 0, y: 0 });
  };

  return (
    <div className="relative w-full h-full bg-black/90 flex items-center justify-center overflow-hidden rounded-md">
      {/* Image Container with Transforms */}
      <div
        className="transition-transform duration-200 ease-out"
        style={{
          transform: `scale(${scale}) rotate(${rotation}deg) translate(${position.x}px, ${position.y}px)`,
          cursor: scale > 1 ? (isDragging ? "grabbing" : "grab") : "default",
        }}
      >
        <img
          src={src}
          alt={name}
          className="max-h-[85vh] max-w-[85vw] object-contain select-none"
          draggable={false}
        />
      </div>

      {/* Floating Toolbar */}
      <div className="absolute bottom-6 left-1/2 transform -translate-x-1/2 flex items-center gap-4 bg-black/60 backdrop-blur-md px-6 py-3 rounded-full shadow-2xl border border-white/10 z-20">
        <button
          onClick={handleZoomOut}
          className="text-white hover:text-blue-400 transition-colors p-1"
          title="تصغير"
        >
          <MagnifyingGlassMinusIcon className="w-6 h-6" />
        </button>
        <span className="text-white text-xs font-mono min-w-[3rem] text-center">
          {Math.round(scale * 100)}%
        </span>
        <button
          onClick={handleZoomIn}
          className="text-white hover:text-blue-400 transition-colors p-1"
          title="تكبير"
        >
          <MagnifyingGlassPlusIcon className="w-6 h-6" />
        </button>
        <div className="w-px h-6 bg-white/20 mx-2"></div>
        <button
          onClick={handleRotate}
          className="text-white hover:text-green-400 transition-colors p-1"
          title="تدوير"
        >
          <ArrowPathIcon className="w-5 h-5" />
        </button>
        <button
          onClick={handleReset}
          className="text-white hover:text-red-400 transition-colors p-1"
          title="إعادة تعيين"
        >
          <ArrowsPointingOutIcon className="w-5 h-5" />
        </button>
      </div>
    </div>
  );
};

const PreviewModal: React.FC<{ doc: CaseDocument; onClose: () => void }> = ({
  doc,
  onClose,
}) => {
  const { get_document_file, download_document_file, documents } = useData();
  const [file, setFile] = React.useState<File | null>(null);
  const [objectUrl, setObjectUrl] = React.useState<string | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [isLoading, setIsLoading] = React.useState(true);

  const currentDoc = documents.find((d) => d.id === doc.id) || doc;

  React.useEffect(() => {
    let url: string | null = null;
    const loadFile = async () => {
      setIsLoading(true);
      setError(null);
      try {
        let retrievedFile = await get_document_file(doc.id);

        // If not found locally or is corrupted (0 bytes), try to download
        if (
          !retrievedFile ||
          retrievedFile.size === 0 ||
          (retrievedFile && doc.local_state === "pending_download")
        ) {
          retrievedFile = await download_document_file(doc);
        }

        if (retrievedFile && retrievedFile.size > 0) {
          setFile(retrievedFile);
          url = URL.createObjectURL(retrievedFile);
          setObjectUrl(url);
        } else {
          const latestDocState = documents.find(
            (d) => d.id === doc.id,
          )?.local_state;
          if (latestDocState === "error") {
            setError("فشل تنزيل الملف. تحقق من الاتصال.");
          } else if (latestDocState === "downloading") {
            // Wait for download to finish (handled by state change)
          } else {
            setError("الملف غير متوفر محلياً وجاري محاولة التنزيل...");
          }
        }
      } catch (e: any) {
        setError("خطأ غير متوقع: " + e.message);
      } finally {
        setIsLoading(false);
      }
    };

    loadFile();

    return () => {
      if (url) URL.revokeObjectURL(url);
    };
  }, [doc.id, get_document_file, download_document_file]);

  const handleDownload = () => {
    if (objectUrl) {
      const a = document.createElement("a");
      a.href = objectUrl;
      a.download = doc.name;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
    }
  };

  const handleOpenExternal = () => {
    if (objectUrl) {
      window.open(objectUrl, "_blank");
    }
  };

  const renderContent = () => {
    if (isLoading) {
      return (
        <div className="flex flex-col items-center justify-center h-full text-white">
          <ArrowPathIcon className="w-10 h-10 animate-spin mb-4 text-blue-500" />
          <p>جاري تحميل المستند...</p>
        </div>
      );
    }

    if (error || !file || !objectUrl) {
      return (
        <div className="flex flex-col items-center justify-center h-full text-white p-8">
          <ExclamationTriangleIcon className="w-12 h-12 text-red-500 mb-4" />
          <p className="text-center text-lg">{error || "حدث خطأ غير معروف"}</p>
        </div>
      );
    }

    if (currentDoc.local_state === "downloading") {
      return (
        <div className="flex flex-col items-center justify-center h-full text-white">
          <CloudArrowDownIcon className="w-12 h-12 text-blue-500 animate-spin mb-4" />
          <p>جاري تنزيل الملف...</p>
        </div>
      );
    }

    if (file.type.startsWith("image/")) {
      return <ImageViewer src={objectUrl} name={doc.name} />;
    }

    if (file.type === "application/pdf") {
      return (
        <div className="w-full h-full bg-gray-800 flex flex-col">
          <iframe
            src={`${objectUrl}#toolbar=0`}
            className="w-full h-full border-none bg-white"
            title={doc.name}
          />
        </div>
      );
    }

    if (file.type.startsWith("text/")) {
      return <TextPreview file={file} name={doc.name} />;
    }

    if (
      doc.name.toLowerCase().endsWith(".docx") ||
      doc.name.toLowerCase().endsWith(".doc")
    ) {
      return <DocxPreview file={file} name={doc.name} />;
    }

    return (
      <div className="text-center p-8 flex flex-col items-center justify-center h-full text-white">
        <DocumentTextIcon className="w-16 h-16 text-gray-500 mb-4" />
        <h3 className="font-bold text-lg mb-2">لا توجد معاينة مباشرة</h3>
        <p className="text-gray-400 mb-6">
          نوع الملف ({doc.type}) غير مدعوم للمعاينة داخل التطبيق.
        </p>
        <button
          onClick={handleDownload}
          className="flex items-center gap-2 px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
        >
          <ArrowDownTrayIcon className="w-5 h-5" />
          <span>تنزيل الملف</span>
        </button>
      </div>
    );
  };

  return (
    <div
      className="fixed inset-0 bg-black/90 backdrop-blur-sm flex items-center justify-center z-[100] p-4 animate-fade-in"
      onClick={onClose}
    >
      <div
        className="relative w-full h-full max-w-6xl max-h-[95vh] flex flex-col bg-gray-900 rounded-xl overflow-hidden shadow-2xl border border-gray-800"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex justify-between items-center p-4 bg-gray-800 border-b border-gray-700 select-none">
          <div className="flex items-center gap-3 overflow-hidden">
            <div className="p-2 bg-blue-600/20 rounded-lg">
              <DocumentTextIcon className="w-5 h-5 text-blue-400" />
            </div>
            <div className="flex flex-col">
              <h3 className="text-white font-bold truncate max-w-xs sm:max-w-md text-sm sm:text-base">
                {doc.name}
              </h3>
              <span className="text-xs text-gray-400">
                {(doc.size / 1024).toFixed(1)} KB &bull;{" "}
                {file?.type || doc.type}
              </span>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {!isLoading && !error && file && (
              <>
                <button
                  onClick={handleOpenExternal}
                  className="flex items-center gap-2 px-3 py-1.5 bg-gray-700 hover:bg-gray-600 text-white text-xs sm:text-sm rounded-lg transition-colors"
                  title="فتح في نافذة جديدة"
                >
                  <ArrowTopRightOnSquareIcon className="w-4 h-4" />
                  <span className="hidden sm:inline">فتح</span>
                </button>
                <button
                  onClick={handleDownload}
                  className="flex items-center gap-2 px-3 py-1.5 bg-gray-700 hover:bg-gray-600 text-white text-xs sm:text-sm rounded-lg transition-colors"
                >
                  <ArrowDownTrayIcon className="w-4 h-4" />
                  <span className="hidden sm:inline">تنزيل</span>
                </button>
              </>
            )}
            <button
              onClick={onClose}
              className="p-2 text-gray-400 hover:text-white hover:bg-gray-700 rounded-full transition-colors"
            >
              <XMarkIcon className="w-6 h-6" />
            </button>
          </div>
        </div>

        {/* Content Area */}
        <div className="flex-grow overflow-hidden bg-gray-950 relative">
          {renderContent()}
        </div>
      </div>
    </div>
  );
};

const DocumentScannerModal: React.FC<{
  onClose: () => void;
  onCapture: (file: File) => void;
}> = ({ onClose, onCapture }) => {
  const videoRef = React.useRef<HTMLVideoElement>(null);
  const containerRef = React.useRef<HTMLDivElement>(null);
  const frameBoxRef = React.useRef<HTMLDivElement>(null);
  const canvasRef = React.useRef<HTMLCanvasElement>(null);
  const streamRef = React.useRef<MediaStream | null>(null);

  const [error, setError] = React.useState<string | null>(null);
  const [isLoading, setIsLoading] = React.useState(true);
  const [isPreview, setIsPreview] = React.useState(false);

  // Raw captured image stored on an offscreen canvas
  const [rawCanvas, setRawCanvas] = React.useState<HTMLCanvasElement | null>(null);

  // Settings & Enhancements
  const [autoCrop, setAutoCrop] = React.useState(true);
  const [filterMode, setFilterMode] = React.useState<"scanner" | "color" | "bw" | "grayscale" | "raw">("scanner");
  const [brightness, setBrightness] = React.useState(0); // -50 to 50
  const [contrast, setContrast] = React.useState(0); // -50 to 50
  const [rotation, setRotation] = React.useState(0); // 0, 90, 180, 270

  // Outer Edge Crop Insets (percentages 0 to 25%)
  const [cropInsets, setCropInsets] = React.useState({
    top: 0,
    bottom: 0,
    left: 0,
    right: 0,
  });

  // Active tab in preview mode (Enhancements vs Cropping)
  const [previewTab, setPreviewTab] = React.useState<"filter" | "crop">("crop");

  // Camera capabilities
  const [hasTorch, setHasTorch] = React.useState(false);
  const [torchOn, setTorchOn] = React.useState(false);
  const [facingMode, setFacingMode] = React.useState<"environment" | "user">("environment");

  // Shutter flash animation
  const [flashActive, setFlashActive] = React.useState(false);

  const startCamera = React.useCallback(async (facing: "environment" | "user") => {
    setIsLoading(true);
    setError(null);

    // Stop existing stream
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
    }

    try {
      const constraints: MediaStreamConstraints = {
        video: {
          facingMode: facing,
          width: { ideal: 3840, min: 1920 },
          height: { ideal: 2160, min: 1080 },
        },
      };

      let stream: MediaStream;
      try {
        stream = await navigator.mediaDevices.getUserMedia(constraints);
      } catch (err) {
        console.warn("High-res video request failed, trying default:", err);
        stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: facing },
        });
      }

      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play().catch(() => {});
      }

      // Check for flashlight capability
      const videoTrack = stream.getVideoTracks()[0];
      if (videoTrack) {
        const capabilities: any = videoTrack.getCapabilities ? videoTrack.getCapabilities() : {};
        if (capabilities.torch) {
          setHasTorch(true);
        } else {
          setHasTorch(false);
        }

        // Apply auto-focus if available
        try {
          if (capabilities.focusMode && capabilities.focusMode.includes("continuous")) {
            await videoTrack.applyConstraints({
              advanced: [{ focusMode: "continuous" } as any],
            });
          }
        } catch (e) {
          console.log("Focus mode constraint not applied:", e);
        }
      }
    } catch (err) {
      console.error("Error accessing camera:", err);
      setError("لم يتمكن من الوصول إلى الكاميرا. يرجى إعطاء الإذن أو التأكد من سلامة الكاميرا.");
    } finally {
      setIsLoading(false);
    }
  }, []);

  React.useEffect(() => {
    startCamera(facingMode);
    return () => {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((track) => track.stop());
      }
    };
  }, [facingMode, startCamera]);

  const toggleTorch = async () => {
    if (!streamRef.current) return;
    const track = streamRef.current.getVideoTracks()[0];
    if (track) {
      const newTorchState = !torchOn;
      try {
        await track.applyConstraints({
          advanced: [{ torch: newTorchState } as any],
        });
        setTorchOn(newTorchState);
      } catch (err) {
        console.warn("Failed to toggle flashlight:", err);
      }
    }
  };

  const toggleCamera = () => {
    setFacingMode((prev) => (prev === "environment" ? "user" : "environment"));
  };

  // Paper boundary auto-detection helper
  const detectAndAutoCropPaper = React.useCallback((srcCanvas: HTMLCanvasElement) => {
    try {
      const ctx = srcCanvas.getContext("2d", { willReadFrequently: true });
      if (!ctx) return;
      const w = srcCanvas.width;
      const h = srcCanvas.height;
      if (w < 100 || h < 100) return;

      const imgData = ctx.getImageData(0, 0, w, h);
      const data = imgData.data;

      const getLum = (x: number, y: number) => {
        const idx = (y * w + x) * 4;
        return data[idx] * 0.299 + data[idx + 1] * 0.587 + data[idx + 2] * 0.114;
      };

      // Scan top edge
      let topIdx = 0;
      for (let y = 0; y < Math.floor(h * 0.32); y += 3) {
        let avg = 0;
        const n = 8;
        for (let s = 1; s <= n; s++) {
          avg += getLum(Math.floor((w * s) / (n + 1)), y);
        }
        if (avg / n > 115) {
          topIdx = y;
          break;
        }
      }

      // Scan bottom edge
      let bottomIdx = h - 1;
      for (let y = h - 1; y > Math.floor(h * 0.68); y -= 3) {
        let avg = 0;
        const n = 8;
        for (let s = 1; s <= n; s++) {
          avg += getLum(Math.floor((w * s) / (n + 1)), y);
        }
        if (avg / n > 115) {
          bottomIdx = y;
          break;
        }
      }

      // Scan left edge
      let leftIdx = 0;
      for (let x = 0; x < Math.floor(w * 0.32); x += 3) {
        let avg = 0;
        const n = 8;
        for (let s = 1; s <= n; s++) {
          avg += getLum(x, Math.floor((h * s) / (n + 1)));
        }
        if (avg / n > 115) {
          leftIdx = x;
          break;
        }
      }

      // Scan right edge
      let rightIdx = w - 1;
      for (let x = w - 1; x > Math.floor(w * 0.68); x -= 3) {
        let avg = 0;
        const n = 8;
        for (let s = 1; s <= n; s++) {
          avg += getLum(x, Math.floor((h * s) / (n + 1)));
        }
        if (avg / n > 115) {
          rightIdx = x;
          break;
        }
      }

      const topPct = Math.min(22, Math.max(0, Math.round((topIdx / h) * 100)));
      const bottomPct = Math.min(22, Math.max(0, Math.round(((h - 1 - bottomIdx) / h) * 100)));
      const leftPct = Math.min(22, Math.max(0, Math.round((leftIdx / w) * 100)));
      const rightPct = Math.min(22, Math.max(0, Math.round(((w - 1 - rightIdx) / w) * 100)));

      setCropInsets({
        top: topPct || 2,
        bottom: bottomPct || 2,
        left: leftPct || 2,
        right: rightPct || 2,
      });
    } catch (e) {
      console.warn("Auto paper detection error:", e);
    }
  }, []);

  // Helper to crop & render captured video frame
  const handleCapture = () => {
    if (!videoRef.current || isLoading) return;

    // Trigger visual shutter flash
    setFlashActive(true);
    setTimeout(() => setFlashActive(false), 200);

    const video = videoRef.current;
    const vW = video.videoWidth;
    const vH = video.videoHeight;

    if (!vW || !vH) return;

    const capturedCanvas = document.createElement("canvas");

    if (autoCrop && containerRef.current && frameBoxRef.current) {
      const containerRect = containerRef.current.getBoundingClientRect();
      const frameRect = frameBoxRef.current.getBoundingClientRect();

      const cW = containerRect.width;
      const cH = containerRect.height;

      // Scale factor of object-cover video inside container
      const scale = Math.max(cW / vW, cH / vH);
      const renderedW = vW * scale;
      const renderedH = vH * scale;

      const videoLeft = (cW - renderedW) / 2;
      const videoTop = (cH - renderedH) / 2;

      const boxLeft = frameRect.left - containerRect.left;
      const boxTop = frameRect.top - containerRect.top;
      const boxWidth = frameRect.width;
      const boxHeight = frameRect.height;

      // Crop coordinates in video coordinate space
      let sx = (boxLeft - videoLeft) / scale;
      let sy = (boxTop - videoTop) / scale;
      let sWidth = boxWidth / scale;
      let sHeight = boxHeight / scale;

      // Clamp coordinates safely
      sx = Math.max(0, Math.min(vW - 10, sx));
      sy = Math.max(0, Math.min(vH - 10, sy));
      sWidth = Math.min(vW - sx, sWidth);
      sHeight = Math.min(vH - sy, sHeight);

      capturedCanvas.width = sWidth;
      capturedCanvas.height = sHeight;

      const ctx = capturedCanvas.getContext("2d");
      if (ctx) {
        ctx.drawImage(video, sx, sy, sWidth, sHeight, 0, 0, sWidth, sHeight);
      }
    } else {
      // Full frame capture
      capturedCanvas.width = vW;
      capturedCanvas.height = vH;
      const ctx = capturedCanvas.getContext("2d");
      if (ctx) {
        ctx.drawImage(video, 0, 0, vW, vH);
      }
    }

    setRawCanvas(capturedCanvas);
    detectAndAutoCropPaper(capturedCanvas);
    setIsPreview(true);
  };

  // Render processed preview canvas whenever settings change
  const updateProcessedCanvas = React.useCallback(() => {
    if (!rawCanvas || !canvasRef.current) return;

    const source = rawCanvas;
    const target = canvasRef.current;

    // Crop coordinates from raw canvas
    const cropX = Math.round(source.width * (cropInsets.left / 100));
    const cropY = Math.round(source.width * (cropInsets.top / 100));
    const cropW = Math.max(30, Math.round(source.width * (1 - (cropInsets.left + cropInsets.right) / 100)));
    const cropH = Math.max(30, Math.round(source.height * (1 - (cropInsets.top + cropInsets.bottom) / 100)));

    const isRotated90 = rotation === 90 || rotation === 270;
    target.width = isRotated90 ? cropH : cropW;
    target.height = isRotated90 ? cropW : cropH;

    const ctx = target.getContext("2d", { willReadFrequently: true });
    if (!ctx) return;

    ctx.save();
    ctx.clearRect(0, 0, target.width, target.height);

    // Apply rotation transformation
    if (rotation === 90) {
      ctx.translate(target.width, 0);
      ctx.rotate((90 * Math.PI) / 180);
    } else if (rotation === 180) {
      ctx.translate(target.width, target.height);
      ctx.rotate((180 * Math.PI) / 180);
    } else if (rotation === 270) {
      ctx.translate(0, target.height);
      ctx.rotate((270 * Math.PI) / 180);
    }

    // Build filter string
    let filterStr = "";
    switch (filterMode) {
      case "scanner":
        filterStr = "contrast(1.35) brightness(1.1) saturate(1.1)";
        break;
      case "bw":
        filterStr = "grayscale(100%) contrast(1.8) brightness(1.15)";
        break;
      case "grayscale":
        filterStr = "grayscale(100%) contrast(1.25) brightness(1.05)";
        break;
      case "color":
        filterStr = "contrast(1.15) brightness(1.05) saturate(1.2)";
        break;
      case "raw":
      default:
        filterStr = "none";
        break;
    }

    if (brightness !== 0) {
      filterStr += ` brightness(${1 + brightness / 100})`;
    }
    if (contrast !== 0) {
      filterStr += ` contrast(${1 + contrast / 100})`;
    }

    ctx.filter = filterStr.trim() || "none";
    ctx.drawImage(source, cropX, cropY, cropW, cropH, 0, 0, cropW, cropH);

    // Advanced pixel whitening for document paper background
    if (filterMode === "scanner" || filterMode === "bw") {
      const imgData = ctx.getImageData(0, 0, target.width, target.height);
      const data = imgData.data;
      const isBW = filterMode === "bw";

      for (let i = 0; i < data.length; i += 4) {
        let r = data[i];
        let g = data[i + 1];
        let b = data[i + 2];

        const avg = (r + g + b) / 3;
        if (avg > 175) {
          // Whiten off-white background paper and remove shadows
          const boost = (avg - 175) * 1.6;
          data[i] = Math.min(255, r + boost);
          data[i + 1] = Math.min(255, g + boost);
          data[i + 2] = Math.min(255, b + boost);
        } else if (avg < 95) {
          // Darken text for high legibility
          data[i] = Math.max(0, r * 0.82);
          data[i + 1] = Math.max(0, g * 0.82);
          data[i + 2] = Math.max(0, b * 0.82);
        }

        if (isBW) {
          const mono = (data[i] * 0.299 + data[i + 1] * 0.587 + data[i + 2] * 0.114) > 140 ? 255 : 0;
          data[i] = mono;
          data[i + 1] = mono;
          data[i + 2] = mono;
        }
      }
      ctx.putImageData(imgData, 0, 0);
    }

    ctx.restore();
  }, [rawCanvas, rotation, filterMode, brightness, contrast, cropInsets]);

  React.useEffect(() => {
    if (isPreview) {
      updateProcessedCanvas();
    }
  }, [isPreview, updateProcessedCanvas]);

  const handleRetake = () => {
    setRawCanvas(null);
    setIsPreview(false);
    setBrightness(0);
    setContrast(0);
    setRotation(0);
    setCropInsets({ top: 0, bottom: 0, left: 0, right: 0 });
  };

  const handleSave = () => {
    if (canvasRef.current) {
      canvasRef.current.toBlob(
        (blob) => {
          if (blob) {
            const fileName = ` وثيقة-${new Date().toISOString().slice(0, 10)}.jpeg`;
            const file = new File([blob], fileName, { type: "image/jpeg" });
            onCapture(file);
          }
        },
        "image/jpeg",
        0.93
      );
    }
  };

  return (
    <div
      className="fixed inset-0 bg-black/95 z-50 flex flex-col items-center justify-center overflow-hidden font-sans dir-rtl"
      onClick={onClose}
    >
      <div
        ref={containerRef}
        className="relative w-full h-full flex flex-col justify-between"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Top Header Bar */}
        <div className="absolute top-0 left-0 right-0 z-30 p-4 bg-gradient-to-b from-black/80 via-black/40 to-transparent flex items-center justify-between text-white">
          <div className="flex items-center gap-2">
            <button
              onClick={onClose}
              className="p-2.5 bg-black/50 hover:bg-black/80 backdrop-blur rounded-full text-white transition-colors"
              title="إغلاق"
            >
              <XMarkIcon className="w-6 h-6" />
            </button>

            {!isPreview && (
              <div className="flex items-center gap-1.5 bg-black/50 backdrop-blur px-3 py-1.5 rounded-full text-xs font-medium text-emerald-400 border border-emerald-500/30">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping"></span>
                <span>ماسح المستندات الضوئي</span>
              </div>
            )}
          </div>

          {!isPreview && (
            <div className="flex items-center gap-2">
              {/* Flashlight toggle */}
              {hasTorch && (
                <button
                  onClick={toggleTorch}
                  className={`p-2.5 rounded-full backdrop-blur transition-all ${
                    torchOn
                      ? "bg-amber-500 text-black shadow-lg shadow-amber-500/30"
                      : "bg-black/50 text-white hover:bg-black/80"
                  }`}
                  title={torchOn ? "إيقاف الكشاف" : "تشغيل الكشاف"}
                >
                  <span className="text-sm font-bold">💡</span>
                </button>
              )}

              {/* Auto Crop Toggle */}
              <button
                onClick={() => setAutoCrop(!autoCrop)}
                className={`px-3 py-1.5 rounded-full text-xs font-semibold backdrop-blur transition-all flex items-center gap-1.5 ${
                  autoCrop
                    ? "bg-emerald-500/20 text-emerald-300 border border-emerald-400/50"
                    : "bg-black/50 text-gray-300 border border-gray-600"
                }`}
                title="تحديد واقتطاع حدود الورقة تلقائياً"
              >
                <span>✂️</span>
                <span>{autoCrop ? "اقتصاص الحدود: مفعّل" : "تحديد كامل"}</span>
              </button>

              {/* Camera Switch */}
              <button
                onClick={toggleCamera}
                className="p-2.5 bg-black/50 hover:bg-black/80 backdrop-blur rounded-full text-white transition-colors"
                title="تبديل الكاميرا"
              >
                <ArrowPathIcon className="w-5 h-5" />
              </button>
            </div>
          )}
        </div>

        {/* Video feed & Frame Overlay View */}
        <div className="relative flex-grow w-full h-full flex items-center justify-center overflow-hidden bg-black">
          <video
            ref={videoRef}
            autoPlay
            playsInline
            className={`w-full h-full object-cover transition-opacity duration-300 ${
              isPreview ? "hidden" : "block"
            }`}
          ></video>

          {/* Processed canvas preview */}
          <canvas
            ref={canvasRef}
            className={`max-w-full max-h-[75vh] object-contain shadow-2xl rounded-lg border border-gray-800 ${
              isPreview ? "block" : "hidden"
            }`}
          ></canvas>

          {/* Shutter flash effect */}
          {flashActive && (
            <div className="absolute inset-0 bg-white animate-pulse z-40 pointer-events-none"></div>
          )}

          {/* Alignment Document Frame Overlay (Camera View) */}
          {!isPreview && !isLoading && !error && (
            <div className="absolute inset-0 pointer-events-none flex items-center justify-center p-4">
              {/* Outer dark overlay surrounding frame box */}
              <div
                ref={frameBoxRef}
                className="relative w-[88vw] max-w-sm aspect-[1/1.4] max-h-[68vh] rounded-2xl border-2 border-emerald-400/80 shadow-[0_0_0_9999px_rgba(0,0,0,0.6)] flex flex-col justify-between p-4 transition-all"
              >
                {/* Glowing Corner Guides */}
                <div className="absolute -top-1 -left-1 w-10 h-10 border-t-4 border-l-4 border-emerald-400 rounded-tl-xl shadow-[0_0_12px_rgba(52,211,153,0.8)]"></div>
                <div className="absolute -top-1 -right-1 w-10 h-10 border-t-4 border-r-4 border-emerald-400 rounded-tr-xl shadow-[0_0_12px_rgba(52,211,153,0.8)]"></div>
                <div className="absolute -bottom-1 -left-1 w-10 h-10 border-b-4 border-l-4 border-emerald-400 rounded-bl-xl shadow-[0_0_12px_rgba(52,211,153,0.8)]"></div>
                <div className="absolute -bottom-1 -right-1 w-10 h-10 border-b-4 border-r-4 border-emerald-400 rounded-br-xl shadow-[0_0_12px_rgba(52,211,153,0.8)]"></div>

                {/* Animated Green Laser Scan Line */}
                <div className="absolute inset-x-0 h-0.5 bg-gradient-to-r from-transparent via-emerald-400 to-transparent shadow-[0_0_15px_#10b981] animate-[pulse_2s_infinite]"></div>

                {/* Top status instruction */}
                <div className="self-center bg-black/75 backdrop-blur text-emerald-300 text-xs font-semibold px-3 py-1.5 rounded-full shadow border border-emerald-500/30 flex items-center gap-1.5 mt-2">
                  <span className="w-2 h-2 rounded-full bg-emerald-400"></span>
                  <span>حاذِ الورقة بالكامل داخل الإطار الأخضر</span>
                </div>

                {/* Bottom guidance */}
                <div className="self-center text-center text-white/90 text-xs bg-black/60 backdrop-blur px-3 py-1 rounded-full mb-2">
                  حافظ على إضاءة جيدة وثبات الكاميرا
                </div>
              </div>
            </div>
          )}

          {/* Loading or Error view */}
          {(isLoading || error) && (
            <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/85 z-20 text-white p-6">
              {isLoading && (
                <div className="flex flex-col items-center gap-3">
                  <ArrowPathIcon className="w-10 h-10 text-emerald-400 animate-spin" />
                  <p className="text-sm font-medium">جاري تشغيل الكاميرا والمستشعر...</p>
                </div>
              )}
              {error && (
                <div className="text-center space-y-4 max-w-sm">
                  <div className="p-3 bg-red-500/20 text-red-400 rounded-full w-14 h-14 mx-auto flex items-center justify-center">
                    <XMarkIcon className="w-8 h-8" />
                  </div>
                  <p className="text-sm leading-relaxed">{error}</p>
                  <button
                    onClick={() => startCamera(facingMode)}
                    className="px-5 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg font-medium text-sm transition-colors"
                  >
                    إعادة المحاولة
                  </button>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Bottom Control & Enhancement Bar */}
        <div className="z-30 bg-black/90 border-t border-gray-800 p-4 backdrop-blur flex flex-col gap-3">
          {isPreview ? (
            /* PREVIEW EDITING TOOLS */
            <div className="space-y-3">
              {/* Tab Selector: Cropping vs Filter Enhancements */}
              <div className="flex items-center gap-2 border-b border-gray-800 pb-2 text-xs">
                <button
                  onClick={() => setPreviewTab("crop")}
                  className={`flex-1 py-1.5 px-3 rounded-lg font-bold flex items-center justify-center gap-1.5 transition-all ${
                    previewTab === "crop"
                      ? "bg-emerald-600 text-white shadow-md shadow-emerald-600/30"
                      : "bg-gray-800/80 text-gray-300 hover:bg-gray-800"
                  }`}
                >
                  <span>✂️</span>
                  <span>قص وتقليم الحدود الخارجية</span>
                </button>
                <button
                  onClick={() => setPreviewTab("filter")}
                  className={`flex-1 py-1.5 px-3 rounded-lg font-bold flex items-center justify-center gap-1.5 transition-all ${
                    previewTab === "filter"
                      ? "bg-emerald-600 text-white shadow-md shadow-emerald-600/30"
                      : "bg-gray-800/80 text-gray-300 hover:bg-gray-800"
                  }`}
                >
                  <span>🎨</span>
                  <span>الفلاتر والإضاءة</span>
                </button>
              </div>

              {previewTab === "crop" ? (
                /* OUTER EDGE CROPPING PANEL */
                <div className="space-y-2.5 text-xs">
                  {/* Quick Action Presets */}
                  <div className="flex items-center justify-between gap-1.5 overflow-x-auto pb-1">
                    <button
                      onClick={() => rawCanvas && detectAndAutoCropPaper(rawCanvas)}
                      className="px-3 py-1.5 bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 hover:bg-emerald-500/30 font-bold rounded-lg whitespace-nowrap transition-all flex items-center gap-1"
                      title="التقاط تلقائي لحدود الورقة"
                    >
                      <span>🪄</span>
                      <span>قص تلقائي للحدود</span>
                    </button>

                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => setCropInsets({ top: 0, bottom: 0, left: 0, right: 0 })}
                        className={`px-2.5 py-1 rounded-md font-medium transition-all ${
                          cropInsets.top === 0 && cropInsets.bottom === 0 && cropInsets.left === 0 && cropInsets.right === 0
                            ? "bg-gray-200 text-black font-bold"
                            : "bg-gray-800 text-gray-300 hover:bg-gray-700"
                        }`}
                      >
                        بدون قص
                      </button>
                      <button
                        onClick={() => setCropInsets({ top: 3, bottom: 3, left: 3, right: 3 })}
                        className={`px-2.5 py-1 rounded-md font-medium transition-all ${
                          cropInsets.top === 3 && cropInsets.bottom === 3 && cropInsets.left === 3 && cropInsets.right === 3
                            ? "bg-gray-200 text-black font-bold"
                            : "bg-gray-800 text-gray-300 hover:bg-gray-700"
                        }`}
                      >
                        قص خفيف (3%)
                      </button>
                      <button
                        onClick={() => setCropInsets({ top: 6, bottom: 6, left: 6, right: 6 })}
                        className={`px-2.5 py-1 rounded-md font-medium transition-all ${
                          cropInsets.top === 6 && cropInsets.bottom === 6 && cropInsets.left === 6 && cropInsets.right === 6
                            ? "bg-gray-200 text-black font-bold"
                            : "bg-gray-800 text-gray-300 hover:bg-gray-700"
                        }`}
                      >
                        قص متوسط (6%)
                      </button>
                      <button
                        onClick={() => setCropInsets({ top: 10, bottom: 10, left: 10, right: 10 })}
                        className={`px-2.5 py-1 rounded-md font-medium transition-all ${
                          cropInsets.top === 10 && cropInsets.bottom === 10 && cropInsets.left === 10 && cropInsets.right === 10
                            ? "bg-gray-200 text-black font-bold"
                            : "bg-gray-800 text-gray-300 hover:bg-gray-700"
                        }`}
                      >
                        قص عميق (10%)
                      </button>
                    </div>
                  </div>

                  {/* Precise Individual Edge Sliders */}
                  <div className="grid grid-cols-2 gap-2.5 bg-gray-900/90 p-2.5 rounded-xl border border-gray-800">
                    <div className="flex items-center gap-2">
                      <span className="text-gray-400 whitespace-nowrap min-w-[3.5rem]">⬆️ أعلى:</span>
                      <input
                        type="range"
                        min="0"
                        max="25"
                        value={cropInsets.top}
                        onChange={(e) => setCropInsets((prev) => ({ ...prev, top: Number(e.target.value) }))}
                        className="w-full accent-emerald-500 h-1.5 bg-gray-700 rounded-lg cursor-pointer"
                      />
                      <span className="text-emerald-400 min-w-[2rem] text-left font-mono">{cropInsets.top}%</span>
                    </div>

                    <div className="flex items-center gap-2">
                      <span className="text-gray-400 whitespace-nowrap min-w-[3.5rem]">⬇️ أسفل:</span>
                      <input
                        type="range"
                        min="0"
                        max="25"
                        value={cropInsets.bottom}
                        onChange={(e) => setCropInsets((prev) => ({ ...prev, bottom: Number(e.target.value) }))}
                        className="w-full accent-emerald-500 h-1.5 bg-gray-700 rounded-lg cursor-pointer"
                      />
                      <span className="text-emerald-400 min-w-[2rem] text-left font-mono">{cropInsets.bottom}%</span>
                    </div>

                    <div className="flex items-center gap-2">
                      <span className="text-gray-400 whitespace-nowrap min-w-[3.5rem]">➡️ أيمن:</span>
                      <input
                        type="range"
                        min="0"
                        max="25"
                        value={cropInsets.right}
                        onChange={(e) => setCropInsets((prev) => ({ ...prev, right: Number(e.target.value) }))}
                        className="w-full accent-emerald-500 h-1.5 bg-gray-700 rounded-lg cursor-pointer"
                      />
                      <span className="text-emerald-400 min-w-[2rem] text-left font-mono">{cropInsets.right}%</span>
                    </div>

                    <div className="flex items-center gap-2">
                      <span className="text-gray-400 whitespace-nowrap min-w-[3.5rem]">⬅️ أيسر:</span>
                      <input
                        type="range"
                        min="0"
                        max="25"
                        value={cropInsets.left}
                        onChange={(e) => setCropInsets((prev) => ({ ...prev, left: Number(e.target.value) }))}
                        className="w-full accent-emerald-500 h-1.5 bg-gray-700 rounded-lg cursor-pointer"
                      />
                      <span className="text-emerald-400 min-w-[2rem] text-left font-mono">{cropInsets.left}%</span>
                    </div>
                  </div>
                </div>
              ) : (
                /* FILTERS & ADJUSTMENTS PANEL */
                <div className="space-y-3">
                  {/* Filter Selection Row */}
                  <div className="flex items-center justify-between gap-1 overflow-x-auto pb-1 text-xs">
                    <button
                      onClick={() => setFilterMode("scanner")}
                      className={`px-3 py-1.5 rounded-lg font-medium transition-all flex items-center gap-1.5 whitespace-nowrap ${
                        filterMode === "scanner"
                          ? "bg-emerald-600 text-white shadow-md shadow-emerald-600/30 font-bold"
                          : "bg-gray-800 text-gray-300 hover:bg-gray-700"
                      }`}
                    >
                      <span>✨</span>
                      <span>ماسح ضوئي</span>
                    </button>
                    <button
                      onClick={() => setFilterMode("color")}
                      className={`px-3 py-1.5 rounded-lg font-medium transition-all flex items-center gap-1.5 whitespace-nowrap ${
                        filterMode === "color"
                          ? "bg-blue-600 text-white shadow-md font-bold"
                          : "bg-gray-800 text-gray-300 hover:bg-gray-700"
                      }`}
                    >
                      <span>🎨</span>
                      <span>ألوان حقيقية</span>
                    </button>
                    <button
                      onClick={() => setFilterMode("bw")}
                      className={`px-3 py-1.5 rounded-lg font-medium transition-all flex items-center gap-1.5 whitespace-nowrap ${
                        filterMode === "bw"
                          ? "bg-gray-200 text-black shadow-md font-bold"
                          : "bg-gray-800 text-gray-300 hover:bg-gray-700"
                      }`}
                    >
                      <span>📄</span>
                      <span>أبيض وأسود</span>
                    </button>
                    <button
                      onClick={() => setFilterMode("grayscale")}
                      className={`px-3 py-1.5 rounded-lg font-medium transition-all flex items-center gap-1.5 whitespace-nowrap ${
                        filterMode === "grayscale"
                          ? "bg-purple-600 text-white shadow-md font-bold"
                          : "bg-gray-800 text-gray-300 hover:bg-gray-700"
                      }`}
                    >
                      <span>🌗</span>
                      <span>رمادي</span>
                    </button>
                    <button
                      onClick={() => setFilterMode("raw")}
                      className={`px-3 py-1.5 rounded-lg font-medium transition-all flex items-center gap-1.5 whitespace-nowrap ${
                        filterMode === "raw"
                          ? "bg-amber-600 text-white shadow-md font-bold"
                          : "bg-gray-800 text-gray-300 hover:bg-gray-700"
                      }`}
                    >
                      <span>📷</span>
                      <span>أصلية</span>
                    </button>
                  </div>

                  {/* Adjustments: Brightness, Contrast & Rotation */}
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 bg-gray-900/80 p-2.5 rounded-xl border border-gray-800 text-xs">
                    {/* Brightness slider */}
                    <div className="flex items-center gap-2">
                      <span className="text-gray-400 whitespace-nowrap">☀️ الإضاءة:</span>
                      <input
                        type="range"
                        min="-40"
                        max="40"
                        value={brightness}
                        onChange={(e) => setBrightness(Number(e.target.value))}
                        className="w-full accent-emerald-500 h-1.5 bg-gray-700 rounded-lg cursor-pointer"
                      />
                      <span className="text-gray-300 min-w-[2rem] text-left">{brightness > 0 ? `+${brightness}` : brightness}</span>
                    </div>

                    {/* Contrast slider */}
                    <div className="flex items-center gap-2">
                      <span className="text-gray-400 whitespace-nowrap">☯️ التباين:</span>
                      <input
                        type="range"
                        min="-40"
                        max="40"
                        value={contrast}
                        onChange={(e) => setContrast(Number(e.target.value))}
                        className="w-full accent-emerald-500 h-1.5 bg-gray-700 rounded-lg cursor-pointer"
                      />
                      <span className="text-gray-300 min-w-[2rem] text-left">{contrast > 0 ? `+${contrast}` : contrast}</span>
                    </div>

                    {/* Rotation Button */}
                    <div className="flex items-center justify-end gap-2">
                      <button
                        onClick={() => setRotation((prev) => (prev + 90) % 360)}
                        className="w-full py-1.5 px-3 bg-gray-800 hover:bg-gray-700 text-white rounded-lg flex items-center justify-center gap-1.5 font-medium border border-gray-700 transition-colors"
                      >
                        <ArrowPathIcon className="w-4 h-4" />
                        <span>تدوير ({rotation}°)</span>
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {/* Action Buttons: Retake vs Save */}
              <div className="flex items-center justify-between gap-4 pt-1">
                <button
                  onClick={handleRetake}
                  className="flex-1 py-3 px-4 bg-gray-800 hover:bg-gray-700 text-white font-semibold rounded-xl flex items-center justify-center gap-2 transition-colors border border-gray-700"
                >
                  <ArrowPathIcon className="w-5 h-5" />
                  <span>إعادة التقاط</span>
                </button>

                <button
                  onClick={handleSave}
                  className="flex-1 py-3 px-4 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-xl flex items-center justify-center gap-2 shadow-lg shadow-emerald-600/30 transition-all transform active:scale-98"
                >
                  <CheckCircleIcon className="w-6 h-6" />
                  <span>حفظ المستند</span>
                </button>
              </div>
            </div>
          ) : (
            /* CAMERA SHUTTER BUTTON BAR */
            <div className="flex items-center justify-center py-1">
              <button
                onClick={handleCapture}
                disabled={isLoading || !!error}
                className="group relative w-20 h-20 rounded-full bg-emerald-500 p-1 flex items-center justify-center shadow-xl shadow-emerald-500/30 hover:bg-emerald-400 active:scale-95 transition-all disabled:opacity-40"
                aria-label="التقاط صورة المستند"
              >
                <div className="w-full h-full rounded-full border-4 border-white flex items-center justify-center">
                  <div className="w-12 h-12 rounded-full bg-white group-hover:scale-105 transition-transform"></div>
                </div>
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

const CaseDocuments: React.FC<CaseDocumentsProps> = ({ caseId }) => {
  const { documents, add_documents, delete_document, get_document_file } =
    useData();
  const { showFeedback, confirm } = useFeedback();
  const [previewDoc, setPreviewDoc] = React.useState<CaseDocument | null>(null);
  const [isDragging, setIsDragging] = React.useState(false);
  const [isCameraOpen, setIsCameraOpen] = React.useState(false);
  const fileInputRef = React.useRef<HTMLInputElement>(null);

  const caseDocuments = React.useMemo(
    () =>
      documents
        .filter((doc) => doc.case_id === caseId)
        .sort(
          (a, b) =>
            safe_revive_date(b.added_at).getTime() -
            safe_revive_date(a.added_at).getTime(),
        ),
    [documents, caseId],
  );

  const handleFileChange = async (files: FileList | null) => {
    if (files && files.length > 0) {
      try {
        await add_documents(caseId, files);
        if (fileInputRef.current) {
          fileInputRef.current.value = "";
        }
      } catch (err: any) {
        showFeedback(`فشل في إضافة الوثائق: ${err.message}`, "error");
      }
    }
  };

  const handleDragEvents = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setIsDragging(true);
    } else if (e.type === "dragleave") {
      setIsDragging(false);
    }
  };

  const handleDrop = async (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      await handleFileChange(e.dataTransfer.files);
    }
  };

  const openDeleteModal = (doc: CaseDocument) => {
    confirm({
      title: "تأكيد حذف الوثيقة",
      message: `هل أنت متأكد من حذف وثيقة "${doc.name}"؟`,
      confirmText: "نعم، قم بالحذف",
      cancelText: "إلغاء",
      variant: "danger",
      onConfirm: async () => {
        try {
          await delete_document(doc);
        } catch (err: any) {
          showFeedback(`فشل في حذف الوثيقة: ${err.message}`, "error");
        }
      },
    });
  };

  const handlePhotoCapture = async (file: File) => {
    const fileList = new DataTransfer();
    fileList.items.add(file);
    try {
      await add_documents(caseId, fileList.files);
    } catch (err: any) {
      showFeedback(`فشل في إضافة الوثيقة الملتقطة: ${err.message}`, "error");
    }
    setIsCameraOpen(false);
  };

  const handlePreview = async (doc: CaseDocument) => {
    setPreviewDoc(doc);
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row gap-4">
        <input
          type="file"
          id={`file-upload-${caseId}`}
          multiple
          className="hidden"
          onChange={(e) => handleFileChange(e.target.files)}
          ref={fileInputRef}
        />
        <div
          onDragEnter={handleDragEvents}
          onDragLeave={handleDragEvents}
          onDragOver={handleDragEvents}
          onDrop={handleDrop}
          className="flex-grow"
        >
          <label
            htmlFor={`file-upload-${caseId}`}
            className={`flex flex-col items-center justify-center p-6 border-2 border-dashed rounded-lg cursor-pointer hover:bg-gray-100 transition-colors h-full ${isDragging ? "border-blue-500 bg-blue-50" : "border-gray-300"}`}
          >
            <DocumentArrowUpIcon className="w-10 h-10 text-gray-400 mb-2" />
            <span className="font-semibold text-gray-700">
              اسحب وأفلت الملفات هنا، أو اضغط للاختيار
            </span>
            <p className="text-xs text-gray-500">
              يمكنك إضافة الصور، ملفات PDF، ومستندات Word
            </p>
          </label>
        </div>
        <button
          onClick={() => setIsCameraOpen(true)}
          className="flex flex-col items-center justify-center p-6 border-2 border-dashed border-gray-300 rounded-lg cursor-pointer hover:bg-gray-100 transition-colors"
        >
          <CameraIcon className="w-10 h-10 text-gray-400 mb-2" />
          <span className="font-semibold text-gray-700">التقاط وثيقة</span>
          <p className="text-xs text-gray-500">استخدم كاميرا جهازك</p>
        </button>
      </div>

      {caseDocuments.length > 0 ? (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
          {caseDocuments.map((doc) => (
            <FilePreview
              key={doc.id}
              doc={doc}
              onPreview={handlePreview}
              onDelete={openDeleteModal}
            />
          ))}
        </div>
      ) : (
        <div className="text-center py-8 text-gray-500">
          <p>لا توجد وثائق لهذه القضية بعد.</p>
        </div>
      )}

      {previewDoc && (
        <PreviewModal doc={previewDoc} onClose={() => setPreviewDoc(null)} />
      )}
      {isCameraOpen && (
        <DocumentScannerModal
          onClose={() => setIsCameraOpen(false)}
          onCapture={handlePhotoCapture}
        />
      )}
    </div>
  );
};

export default CaseDocuments;
