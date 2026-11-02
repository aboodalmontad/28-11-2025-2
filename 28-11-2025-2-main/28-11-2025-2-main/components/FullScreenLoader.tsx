import * as React from "react";
import { ExclamationCircleIcon, ArrowPathIcon } from "./icons.tsx";

interface FullScreenLoaderProps {
  text?: string;
  subtext?: string;
  children?: React.ReactNode;
  isError?: boolean;
}

const FullScreenLoader: React.FC<FullScreenLoaderProps> = ({
  text = "جاري التحميل...",
  subtext,
  children,
  isError,
}) => (
  <div className="fixed inset-0 bg-white flex flex-col items-center justify-center z-[100] p-6 text-center">
    {isError ? (
      <ExclamationCircleIcon className="w-12 h-12 text-red-500 mb-4" />
    ) : (
      <ArrowPathIcon className="w-12 h-12 text-blue-600 animate-spin mb-4" />
    )}
    <h2
      className={`text-xl font-bold ${isError ? "text-red-700" : "text-gray-800"}`}
    >
      {text}
    </h2>
    {subtext && (
      <p className="mt-2 text-gray-500 text-sm max-w-xs mx-auto">{subtext}</p>
    )}
    <div className="mt-8">{children}</div>
  </div>
);

export default FullScreenLoader;
