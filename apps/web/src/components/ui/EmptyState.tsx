"use client";

import { LucideIcon } from "lucide-react";
import { ReactNode } from "react";

interface EmptyStateProps {
  icon: LucideIcon;
  title: string;
  description?: string;
  action?: ReactNode;
}

export function EmptyState({ icon: Icon, title, description, action }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 py-12 text-center text-[var(--text-muted)]">
      <Icon size={28} />
      <div>
        <p className="font-medium text-[var(--text-secondary)]">{title}</p>
        {description && <p className="text-sm mt-1">{description}</p>}
      </div>
      {action}
    </div>
  );
}
