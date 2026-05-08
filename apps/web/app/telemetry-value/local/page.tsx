import { redirect } from "next/navigation";

export default function TelemetryValueLocalRoute() {
  redirect("/telemetry-value?source=local");
}
