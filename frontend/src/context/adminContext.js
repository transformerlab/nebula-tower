import { createContext, useContext, useCallback } from "react";

export const AdminContext = createContext();

export function useAdminPassword() {
  return useContext(AdminContext);
}

export function useAdminFetcher() {
  const { adminPassword } = useAdminPassword();
  return useCallback(
    async (url) => {
      const res = await fetch(url, {
        headers: {
          Authorization: adminPassword ? `Bearer ${adminPassword}` : "",
        },
      });
      if (!res.ok) throw new Error("Network response was not ok");
      return res.json();
    },
    [adminPassword]
  );
}
