import { RouteLoadingShell } from "@/components/ui/RouteLoadingShell";

export default function ApprovalsLoading() {
  return (
    <RouteLoadingShell
      testId="approvals-loading"
      titleWidthClass="w-64"
      subtitleWidthClass="w-full max-w-2xl"
      cardCount={3}
      bodyHeightClass="h-80"
    />
  );
}
