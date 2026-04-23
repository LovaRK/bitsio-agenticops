type RouteLoadingShellProps = {
  testId: string;
  titleWidthClass?: string;
  subtitleWidthClass?: string;
  cardCount?: number;
  bodyHeightClass?: string;
};

export function RouteLoadingShell({
  testId,
  titleWidthClass = "w-72",
  subtitleWidthClass = "w-full max-w-3xl",
  cardCount = 4,
  bodyHeightClass = "h-64",
}: RouteLoadingShellProps) {
  return (
    <section className="pt-4 pb-10 px-4 sm:px-6 lg:px-8 sm:pt-6 lg:pb-12" data-testid={testId}>
      <div className="animate-pulse space-y-4">
        <div className={`h-9 rounded bg-surface-container-high ${titleWidthClass}`} />
        <div className={`h-4 rounded bg-surface-container-high ${subtitleWidthClass}`} />
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4 mt-4">
          {Array.from({ length: cardCount }).map((_, idx) => (
            <div key={idx} className="h-32 rounded-xl border border-outline-variant/15 bg-surface-container-low" />
          ))}
        </div>
        <div className={`${bodyHeightClass} rounded-xl border border-outline-variant/15 bg-surface-container-low`} />
      </div>
    </section>
  );
}
