import { RouteLoadingShell } from "@/components/ui/RouteLoadingShell";

export default function DashboardLoading() {
  return (
    <RouteLoadingShell
      testId="dashboard-loading"
      titleWidthClass="w-64"
      subtitleWidthClass="w-full max-w-2xl"
      bodyHeightClass="h-96"
    />
  );
}
