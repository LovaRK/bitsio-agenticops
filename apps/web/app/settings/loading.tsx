import { RouteLoadingShell } from "@/components/ui/RouteLoadingShell";

export default function SettingsLoading() {
  return (
    <RouteLoadingShell
      testId="settings-loading"
      titleWidthClass="w-64"
      subtitleWidthClass="w-full max-w-3xl"
      cardCount={2}
      bodyHeightClass="h-[30rem]"
    />
  );
}
