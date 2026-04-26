import * as React from "react";
import { useSupabaseData } from "../hooks/useSupabaseData.ts";

// This is the return type of the useSupabaseData hook.
export type IDataContext = ReturnType<typeof useSupabaseData>;

// Create the context with a placeholder/null value.
export const DataContext = React.createContext<IDataContext | null>(null);

// Custom hook to use the data context
export const useData = () => {
  const context = React.useContext(DataContext);
  if (!context) {
    throw new Error("useData must be used within a DataProvider");
  }
  return context;
};
