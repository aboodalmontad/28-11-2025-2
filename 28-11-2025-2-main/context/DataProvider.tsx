import * as React from "react";
import { DataContext, IDataContext } from "./DataContextCore.tsx";

// Export the provider component
export const DataProvider: React.FC<{
  children: React.ReactNode;
  value: IDataContext;
}> = ({ children, value }) => {
  return <DataContext.Provider value={value}>{children}</DataContext.Provider>;
};
