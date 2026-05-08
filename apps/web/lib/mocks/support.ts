/**
 * Mock support resources for development and fallback.
 */

import type { SupportResourcesResponse } from "@/types/api";

export function mockSupportResources(): SupportResourcesResponse {
  return {
    categories: [
      {
        title: "Runbooks",
        icon: "rocket_launch",
        links: [{ label: "Live Monitoring View", href: "/monitoring" }],
      },
    ],
    contact: {
      email: "support@bitsio.example",
      chat: "Slack #bitsio-agenticops",
    },
  };
}
