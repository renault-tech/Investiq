"use client";

interface SkeletonProps {
  className?: string;
}

export function Skeleton({ className = "h-4 w-full" }: SkeletonProps) {
  return <div className={`rounded bg-slate-100 dark:bg-slate-800 animate-pulse ${className}`} />;
}
