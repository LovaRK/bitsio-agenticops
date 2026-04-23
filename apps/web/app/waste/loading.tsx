import { TelemetryValueLoadingStage } from "@/components/TelemetryValueLoadingStage";
import { RouteLoadingShell } from "@/components/ui/RouteLoadingShell";

export default function WasteLoading() {
  return (
    <section className="pt-4 pb-10 px-4 sm:px-6 lg:px-8 sm:pt-6 lg:pb-12" data-testid="waste-loading">
      <div className="space-y-4">
        <TelemetryValueLoadingStage />
        <RouteLoadingShell
          testId="waste-loading-shell"
          titleWidthClass="w-80"
          subtitleWidthClass="w-full max-w-4xl"
          bodyHeightClass="h-80"
        />
      </div>
    </section>
  );
}
