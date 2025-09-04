import API_BASE_URL from "../apiConfig";
import { useAuthHeader } from "react-auth-kit";
import { useLocation, useNavigate } from "react-router-dom";

export function useAuthedFetcher() {
  const getAuthHeader = useAuthHeader();
  const location = useLocation();
  const navigate = useNavigate();

  return async (url) => {
    const token = getAuthHeader();
    const res = await fetch(
      url.startsWith("http") ? url : `${API_BASE_URL}${url}`,
      {
        headers: token ? { Authorization: token } : {},
        credentials: "include",
      }
    );
    if (res.status === 401) {
      navigate("/login", { state: { from: location } });
      return;
    }
    if (!res.ok) {
      const text = await res.text().catch(() => "");
      throw new Error(text || `HTTP ${res.status}`);
    }
    const ct = res.headers.get("content-type") || "";
    return ct.includes("application/json") ? res.json() : res.text();
  };
}

export function useAuthedFetch() {
  const getAuthHeader = useAuthHeader();
  const location = useLocation();
  const navigate = useNavigate();

  return async (path, init = {}) => {
    const token = getAuthHeader();
    const res = await fetch(
      path.startsWith("http") ? path : `${API_BASE_URL}${path}`,
      {
        ...init,
        headers: {
          ...(init.headers || {}),
          ...(token ? { Authorization: token } : {}),
        },
        credentials: "include",
      }
    );
    if (res.status === 401) {
      navigate("/login", { state: { from: location } });
      return;
    }
    return res;
  };
}
