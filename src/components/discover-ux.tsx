/**
 * FEAT-125 (MEM-63): shared empty / loading / error patterns for Discover (aligned with feed list UX).
 */

import type { ReactNode } from "react";
import { Button } from "@/components/ui/button";

export function DiscoverMutedPanel({
  children,
  className = ""
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={`rounded-lg border border-dashed border-gray-200 bg-gray-50 px-4 py-6 text-center text-sm text-gray-600 ${className}`}
    >
      {children}
    </div>
  );
}

export function DiscoverErrorPanel({
  message,
  onRetry,
  className = ""
}: {
  message: string;
  onRetry: () => void;
  className?: string;
}) {
  return (
    <div
      className={`rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-800 ${className}`}
    >
      <p>{message}</p>
      <Button
        className="mt-3"
        onClick={onRetry}
        type="button"
        variant="outline"
      >
        Retry
      </Button>
    </div>
  );
}

function DiscoverUserRowSkeleton() {
  return (
    <li className="list-none">
      <div
        aria-hidden
        className="flex items-center gap-3 rounded-lg border border-gray-200 bg-white px-4 py-3"
      >
        <div className="h-10 w-10 shrink-0 animate-pulse rounded-full bg-gray-200" />
        <div className="min-w-0 flex-1 space-y-2">
          <div className="h-4 max-w-[11rem] animate-pulse rounded bg-gray-200" />
          <div className="h-3 max-w-[14rem] animate-pulse rounded bg-gray-100" />
        </div>
        <div className="h-8 w-[4.5rem] shrink-0 animate-pulse rounded-md bg-gray-200" />
      </div>
    </li>
  );
}

export function DiscoverUserRowSkeletonList({
  count,
  ariaLabel,
  className = ""
}: {
  count: number;
  ariaLabel: string;
  className?: string;
}) {
  return (
    <ul
      aria-busy="true"
      aria-label={ariaLabel}
      className={`list-none space-y-2 p-0 ${className}`}
      role="status"
    >
      {Array.from({ length: count }).map((_, i) => (
        <DiscoverUserRowSkeleton key={`discover-sk-${i}`} />
      ))}
    </ul>
  );
}
