export type Period = {
  id: number;
  name: string;
  start_date: string;
  end_date: string;
};
export type PeriodInput = Omit<Period, "id">;
export type Section = {
  id: number;
  name: string;
  color: string;
  employment_count: number;
};
export type SectionInput = Pick<Section, "name" | "color">;
export type StaffGroup = { id: number; name: string; employment_count: number };
export type User = {
  id: number;
  name: string;
  email: string;
  is_admin: boolean;
  is_staff: boolean;
  employment_count: number;
};
export type UserInput = Omit<User, "id" | "employment_count"> & {
  password?: string;
};
export type SessionUser = Omit<User, "employment_count">;
export type LoginSession = { user: SessionUser; token: string };
export type EmploymentInput = {
  user_id: number;
  section_id: number;
  staff_group_id: number;
  hours_per_week: number;
  start_date: string;
  end_date: string;
};
export type Employment = EmploymentInput & {
  id: number;
  name: string;
  section_name: string;
  section_color: string;
  staff_group_name: string;
};
