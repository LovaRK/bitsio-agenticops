import { RouteLoadingShell } from "@/components/ui/RouteLoadingShell";

export default function SupportLoading() {
  return (
    <RouteLoadingShell
      testId="support-loading"
      titleWidthClass="w-72"
      subtitleWidthClass="w-full max-w-2xl"
      cardCount={3}
      bodyHeightClass="h-96"
    />
  );
}
