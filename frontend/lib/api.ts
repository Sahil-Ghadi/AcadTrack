const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000";

export interface User {
  id: number;
  email: string;
  role: "college_admin" | "dept_admin" | "faculty" | "student";
  collegeId: number;
  departmentId: number | null;
}

export function getStoredToken(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem("acadtrack_token");
}

export function setStoredAuth(token: string, user: User): void {
  if (typeof window === "undefined") return;
  localStorage.setItem("acadtrack_token", token);
  localStorage.setItem("acadtrack_user", JSON.stringify(user));
}

export function getStoredUser(): User | null {
  if (typeof window === "undefined") return null;
  const user = localStorage.getItem("acadtrack_user");
  return user ? JSON.parse(user) : null;
}

export function clearStoredAuth(): void {
  if (typeof window === "undefined") return;
  localStorage.removeItem("acadtrack_token");
  localStorage.removeItem("acadtrack_user");
}

export async function apiFetch<T>(
  endpoint: string,
  options: RequestInit = {},
): Promise<T> {
  const token = getStoredToken();
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(options.headers as Record<string, string>),
  };

  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }

  const res = await fetch(`${API_BASE}${endpoint}`, {
    ...options,
    headers,
  });

  if (!res.ok) {
    let errorDetail = "An error occurred";
    try {
      const errorJson = await res.json();
      errorDetail = errorJson.message || errorJson.detail || JSON.stringify(errorJson);
    } catch {
      errorDetail = await res.text();
    }
    const err = new Error(errorDetail);
    (err as any).status = res.status;
    throw err;
  }

  // Handle empty or blob/text responses
  const contentType = res.headers.get("Content-Type");
  if (contentType && contentType.includes("text/csv")) {
    return (await res.text()) as unknown as T;
  }

  return (await res.json()) as T;
}
