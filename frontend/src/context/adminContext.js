import { createContext, useContext } from "react";

export const AdminContext = createContext();

export function useAdminPassword() {
  return useContext(AdminContext);
}
