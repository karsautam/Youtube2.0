import { cn } from "@/lib/utils";

export function Skeleton({ className }: { className?: string }) {
  return <div className={cn("animate-pulse rounded-md bg-muted", className)} />;
}

export function VideoCardSkeleton() {
  return (
    <div className="animate-pulse">
      <div className="aspect-video rounded-lg bg-muted" />
      <div className="mt-3 flex gap-3">
        <div className="h-9 w-9 shrink-0 rounded-full bg-muted" />
        <div className="flex-1 min-w-0 space-y-2">
          <div className="h-6 w-full rounded bg-muted" />
          <div className="h-6 w-2/3 rounded bg-muted" />
          <div className="mt-1 h-5 w-1/2 rounded bg-muted/70" />
          <div className="h-5 w-1/3 rounded bg-muted/70" />
        </div>
      </div>
    </div>
  );
}

export function VideoSkeletonGrid({ count = 9 }: { count?: number }) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-x-6 gap-y-8">
      {Array.from({ length: count }).map((_, i) => (
        <VideoCardSkeleton key={i} />
      ))}
    </div>
  );
}

export function ListRowSkeleton({ count = 6 }: { count?: number }) {
  return (
    <div className="space-y-4">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="animate-pulse flex gap-4">
          <div className="aspect-video w-40 shrink-0 rounded-lg bg-muted" />
          <div className="flex-1 space-y-2 py-1">
            <div className="h-5 w-3/4 rounded bg-muted" />
            <div className="h-4 w-1/3 rounded bg-muted/70" />
            <div className="h-4 w-1/2 rounded bg-muted/70" />
          </div>
        </div>
      ))}
    </div>
  );
}

export function RowSkeleton({ height = "h-6", width = "w-full" }: { height?: string; width?: string }) {
  return <Skeleton className={cn(height, width)} />;
}

export function PlayerSkeleton() {
  return (
    <div className="w-full animate-pulse">
      <div className="aspect-video w-full rounded-xl bg-muted" />
      <div className="mt-4 space-y-3">
        <div className="h-7 w-4/5 rounded bg-muted" />
        <div className="h-5 w-1/3 rounded bg-muted/70" />
        <div className="mt-4 flex gap-3">
          <div className="h-10 w-10 rounded-full bg-muted" />
          <div className="flex-1 space-y-2">
            <div className="h-5 w-1/4 rounded bg-muted" />
            <div className="h-5 w-1/3 rounded bg-muted/70" />
          </div>
        </div>
      </div>
    </div>
  );
}

export function PlansSkeleton() {
  return (
    <div className="grid gap-6 md:grid-cols-3">
      {Array.from({ length: 3 }).map((_, i) => (
        <div key={i} className="animate-pulse space-y-4 rounded-2xl border p-6">
          <div className="h-6 w-1/2 rounded bg-muted" />
          <div className="h-5 w-2/3 rounded bg-muted/70" />
          <div className="h-16 w-3/4 rounded-lg bg-muted" />
          <div className="h-5 w-full rounded bg-muted/70" />
          <div className="h-5 w-5/6 rounded bg-muted/70" />
          <div className="h-9 w-full rounded-lg bg-muted" />
        </div>
      ))}
    </div>
  );
}

export function CommentSkeleton({ count = 4 }: { count?: number }) {
  return (
    <div className="space-y-5">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="animate-pulse flex gap-3">
          <div className="h-9 w-9 shrink-0 rounded-full bg-muted" />
          <div className="flex-1 space-y-2">
            <div className="h-4 w-1/4 rounded bg-muted" />
            <div className="h-4 w-2/3 rounded bg-muted/70" />
          </div>
        </div>
      ))}
    </div>
  );
}