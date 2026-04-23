import { RouteLoadingShell } from "@/components/ui/RouteLoadingShell";

export default function AgentPortfolioLoading() {
  return (
    <RouteLoadingShell
      testId="agent-portfolio-loading"
      titleWidthClass="w-72"
      subtitleWidthClass="w-full max-w-3xl"
      cardCount={3}
      bodyHeightClass="h-[32rem]"
    />
  );
}
