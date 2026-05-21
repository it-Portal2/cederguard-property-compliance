import { clsx } from 'clsx';

type ShimmerSkeletonProps = {
  className?: string;
};

export function ShimmerSkeleton({ className }: ShimmerSkeletonProps) {
  return (
    <div
      className={clsx('rounded-md bg-slate-100 animate-shimmer', className)}
      aria-hidden="true"
    />
  );
}
