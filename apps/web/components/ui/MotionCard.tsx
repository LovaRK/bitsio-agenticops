"use client";

export function MotionCard({
  children,
  className,
  title,
}: {
  children: React.ReactNode;
  className?: string;
  title?: string;
}) {
  return (
    <article
      className={className}
      title={title}
    >
      {children}
    </article>
  );
}
