"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function TelemetryValueRedirectPage() {
  const router = useRouter();

  useEffect(() => {
    router.replace("/agent-control-plane");
  }, [router]);

  return (
    <div className="min-h-screen flex items-center justify-center text-on-surface-variant">
      Redirecting to Agent Control Plane...
    </div>
  );
}

