import { RouteLoadingShell } from "@/components/ui/RouteLoadingShell";

export default function MonitoringLoading() {
  return (
    <RouteLoadingShell
      testId="monitoring-loading"
      titleWidthClass="w-72"
      subtitleWidthClass="w-full max-w-3xl"
      bodyHeightClass="h-96"
    />
  );
}
