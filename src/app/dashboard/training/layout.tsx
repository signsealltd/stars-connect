import type { ReactNode } from "react";
import { requireRole } from "@/lib/security";

export default async function TrainingLayout({ children }: { children: ReactNode }) {
  await requireRole("MANAGER");
  return children;
}
