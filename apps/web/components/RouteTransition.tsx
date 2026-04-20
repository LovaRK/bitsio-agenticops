"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";

export function RouteTransition({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [isSwitching, setIsSwitching] = useState(false);

  useEffect(() => {
    setIsSwitching(true);
    const timer = window.setTimeout(() => setIsSwitching(false), 320);
    return () => window.clearTimeout(timer);
  }, [pathname]);

  return (
    <>
      {isSwitching ? (
        <div className="fixed top-16 left-64 right-0 h-0.5 z-[90] overflow-hidden bg-primary/20">
          <div className="route-progress-bar" />
        </div>
      ) : null}
      <div key={pathname} className="route-fade-in">
        {children}
      </div>
    </>
  );
}
