/**
 * Route definitions and navigation configuration.
 * Single source of truth for all application routes and navigation items.
 */

export type RouteHref = "/" | "/incidents" | "/approvals" | "/monitoring" | "/settings" | "/support";

export interface NavItem {
  label: string;
  icon: string;
  href: RouteHref;
}

export const ROUTES = {
  HOME: "/" as const,
  INCIDENTS: "/incidents" as const,
  INCIDENT_DETAIL: (id: string) => `/incidents/${id}` as const,
  APPROVALS: "/approvals" as const,
  MONITORING: "/monitoring" as const,
  SETTINGS: "/settings" as const,
  SUPPORT: "/support" as const,
} as const;

export const NAV_ITEMS: NavItem[] = [
  { label: "Dashboard", icon: "dashboard", href: ROUTES.HOME },
  { label: "Incidents", icon: "error_med", href: ROUTES.INCIDENTS },
  { label: "Approvals", icon: "check_circle", href: ROUTES.APPROVALS },
  { label: "Monitoring", icon: "monitoring", href: ROUTES.MONITORING },
];

export const FOOTER_NAV_ITEMS: NavItem[] = [
  { label: "Settings", icon: "settings", href: ROUTES.SETTINGS },
  { label: "Support", icon: "support_agent", href: ROUTES.SUPPORT },
];

/**
 * Check if a pathname matches a route (for active link detection).
 */
export function isActiveRoute(pathname: string, href: RouteHref): boolean {
  if (href === ROUTES.HOME) return pathname === ROUTES.HOME;
  return pathname.startsWith(href);
}
