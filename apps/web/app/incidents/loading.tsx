import { RouteLoadingShell } from "@/components/ui/RouteLoadingShell";

export default function IncidentsLoading() {
  return (
    <RouteLoadingShell
      testId="incidents-loading"
      titleWidthClass="w-72"
      subtitleWidthClass="w-full max-w-3xl"
      cardCount={2}
      bodyHeightClass="h-96"
    />
  );
}
