import type {
  Employment,
  EmploymentInput,
  Period,
  PeriodInput,
  Section,
  SectionInput,
  StaffGroup,
  User,
  UserInput,
  LoginSession,
  SessionUser,
} from "@/types/app";
import { readToken } from "./browserSession";

export function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : "Noget gik galt. Prøv igen.";
}

// Siderne bruger de navngivne funktioner nedenfor. Denne funktion samler HTTP og fejl.
async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const token = readToken();
  const response = await fetch(`/api${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...options.headers,
    },
    cache: "no-store",
    credentials: "omit",
  });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || "Noget gik galt.");
  return data as T;
}

export function getSession() {
  return request<{ user: SessionUser }>("/auth/me");
}
export function login(email: string, password: string) {
  return request<LoginSession>("/auth/login", {
    method: "POST",
    body: JSON.stringify({ email, password }),
  });
}
export function logout() {
  return request("/auth/logout", { method: "POST" });
}

export function getPeriods() {
  return request<Period[]>("/periods");
}

export function createPeriod(data: PeriodInput) {
  return request<Period>("/periods", {
    method: "POST",
    body: JSON.stringify(data),
  });
}

export function updatePeriod(id: number, data: PeriodInput) {
  return request<Period>(`/periods/${id}`, {
    method: "PUT",
    body: JSON.stringify(data),
  });
}

export function deletePeriod(id: number) {
  return request<{ message: string }>(`/periods/${id}`, { method: "DELETE" });
}

export function getSections() {
  return request<Section[]>("/sections");
}

export function createSection(data: SectionInput) {
  return request<Section>("/sections", {
    method: "POST",
    body: JSON.stringify(data),
  });
}

export function updateSection(id: number, data: SectionInput) {
  return request<Section>(`/sections/${id}`, {
    method: "PUT",
    body: JSON.stringify(data),
  });
}

export function deleteSection(id: number) {
  return request<{ message: string }>(`/sections/${id}`, { method: "DELETE" });
}

export function getStaffGroups() {
  return request<StaffGroup[]>("/staff-groups");
}

export function createStaffGroup(data: { name: string }) {
  return request<StaffGroup>("/staff-groups", {
    method: "POST",
    body: JSON.stringify(data),
  });
}

export function updateStaffGroup(id: number, data: { name: string }) {
  return request<StaffGroup>(`/staff-groups/${id}`, {
    method: "PUT",
    body: JSON.stringify(data),
  });
}

export function deleteStaffGroup(id: number) {
  return request<{ message: string }>(`/staff-groups/${id}`, {
    method: "DELETE",
  });
}

export function getUsers() {
  return request<User[]>("/users");
}

export function createUser(data: UserInput) {
  return request<User>("/users", {
    method: "POST",
    body: JSON.stringify(data),
  });
}

export function updateUser(id: number, data: UserInput) {
  return request<User>(`/users/${id}`, {
    method: "PUT",
    body: JSON.stringify(data),
  });
}

export function deleteUser(id: number) {
  return request<{ message: string }>(`/users/${id}`, { method: "DELETE" });
}

export function getEmployments() {
  return request<Employment[]>("/employments");
}

export function createEmployment(data: EmploymentInput) {
  return request<Employment>("/employments", {
    method: "POST",
    body: JSON.stringify(data),
  });
}

export function updateEmployment(id: number, data: EmploymentInput) {
  return request<Employment>(`/employments/${id}`, {
    method: "PUT",
    body: JSON.stringify(data),
  });
}

export function deleteEmployment(id: number) {
  return request<{ message: string }>(`/employments/${id}`, {
    method: "DELETE",
  });
}

export function getPersonnel(periodId: number) {
  return request<Employment[]>(`/personnel?period_id=${periodId}`);
}
