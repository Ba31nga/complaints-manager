import { isRole } from "@/app/lib/utils";
import type { Complaint } from "@/app/lib/types";

export type SessionUser =
  | { id?: string; department?: string; role?: string }
  | undefined;

export function canReadComplaint(
  user: SessionUser,
  complaint: Complaint
): boolean {
  const role = user?.role;
  if (isRole(role, "PRINCIPAL") || isRole(role, "ADMIN")) return true;
  if (isRole(role, "MANAGER")) {
    return !!user?.department && complaint.departmentId === user.department;
  }
  if (isRole(role, "EMPLOYEE")) {
    return !!user?.id && complaint.assigneeUserId === user.id;
  }
  return false;
}

export function canMutateComplaint(
  user: SessionUser,
  complaint: Complaint
): boolean {
  const role = user?.role;
  if (isRole(role, "PRINCIPAL") || isRole(role, "ADMIN")) return true;
  if (isRole(role, "MANAGER")) {
    return !!user?.department && complaint.departmentId === user.department;
  }
  if (isRole(role, "EMPLOYEE")) {
    return !!user?.id && complaint.assigneeUserId === user.id;
  }
  return false;
}
