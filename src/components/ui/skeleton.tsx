import { cn } from "@/lib/utils";

interface SkeletonProps extends React.HTMLAttributes<HTMLDivElement> {
  shimmer?: boolean;
}

function Skeleton({ className, shimmer = true, ...props }: SkeletonProps) {
  return (
    <div
      className={cn(
        "rounded-md bg-secondary",
        shimmer && "shimmer",
        className
      )}
      {...props}
    />
  );
}

function SkeletonText({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <Skeleton className={cn("h-4 w-full", className)} {...props} />;
}

function SkeletonCircle({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <Skeleton className={cn("h-10 w-10 rounded-full", className)} {...props} />;
}

function SkeletonCard({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={cn("rounded-xl border bg-card p-6 space-y-4", className)} {...props}>
      <div className="flex items-center justify-between">
        <Skeleton className="h-4 w-24" />
        <SkeletonCircle className="h-8 w-8" />
      </div>
      <Skeleton className="h-8 w-32" />
      <Skeleton className="h-3 w-20" />
    </div>
  );
}

function SkeletonRow({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={cn("flex items-center gap-3 p-3", className)} {...props}>
      <SkeletonCircle />
      <div className="flex-1 space-y-2">
        <Skeleton className="h-4 w-20" />
        <Skeleton className="h-3 w-28" />
      </div>
      <div className="text-right space-y-2">
        <Skeleton className="h-4 w-16 ml-auto" />
        <Skeleton className="h-3 w-12 ml-auto" />
      </div>
    </div>
  );
}

export { Skeleton, SkeletonText, SkeletonCircle, SkeletonCard, SkeletonRow };
