"""
Static MITRE ATT&CK and Lantern detection coverage mappings.

Maps sourcetype name patterns to estimated coverage percentages.
These are heuristic values used when a full MITRE correlation table
is not available. Replace with your Splunk Security Content mapping
for production accuracy.
"""
from __future__ import annotations

# Pattern → (mitre_coverage_pct, lantern_coverage_pct)
# Listed from most specific to least specific
_COVERAGE_MAP: list[tuple[str, float, float]] = [
    # Endpoint / Windows — High security value
    ("wineventlog", 85.0, 75.0),
    ("windows", 80.0, 70.0),
    ("sysmon", 90.0, 85.0),
    ("crowdstrike", 88.0, 80.0),
    ("defender", 82.0, 72.0),
    ("carbonblack", 85.0, 78.0),
    # Network security — High value
    ("fortigate", 60.0, 55.0),
    ("paloalto", 65.0, 60.0),
    ("cisco:asa", 58.0, 50.0),
    ("cisco:ios", 55.0, 48.0),
    ("cisco", 50.0, 44.0),
    ("juniper", 48.0, 42.0),
    ("meraki", 45.0, 40.0),
    ("firewall", 55.0, 50.0),
    ("f5:bigip", 40.0, 35.0),
    # Cloud / O365 — Medium-high value
    ("o365:management", 79.2, 65.0),
    ("o365", 72.0, 60.0),
    ("azure", 70.0, 58.0),
    ("aws", 68.0, 55.0),
    ("gcp", 65.0, 52.0),
    # Authentication / Identity — High value
    ("auditd", 75.0, 65.0),
    ("linux_secure", 70.0, 60.0),
    ("linux_audit", 72.0, 62.0),
    ("auth", 68.0, 58.0),
    # Vulnerability / Threat Intel — High value
    ("wazuh", 80.0, 72.0),
    ("qualys", 55.0, 48.0),
    ("nessus", 52.0, 45.0),
    ("darktrace", 70.0, 65.0),
    # Application / Performance — Low security value
    ("tomcat", 5.0, 8.0),
    ("apache", 12.0, 10.0),
    ("nginx", 15.0, 12.0),
    ("iis", 18.0, 14.0),
    ("app:", 8.0, 6.0),
    # VMware / Perf — Minimal security value
    ("vmware", 5.0, 4.0),
    ("vmstat", 2.0, 2.0),
    ("cpu", 2.0, 2.0),
    ("perfmon", 3.0, 3.0),
    # DNS / DHCP — Some value
    ("dns", 35.0, 30.0),
    ("dhcp", 28.0, 22.0),
    # Proxy / Web — Medium value
    ("proxy", 42.0, 38.0),
    ("squid", 38.0, 32.0),
    # Database / Oracle — Low security value
    ("oracle", 15.0, 12.0),
    ("mssql", 18.0, 15.0),
    ("mysql", 14.0, 11.0),
    # JSON / generic — Unknown
    ("json", 0.0, 0.0),
]

_DEFAULT_MITRE = 5.0
_DEFAULT_LANTERN = 4.0


def get_coverage(sourcetype: str) -> tuple[float, float]:
    """Return (mitre_coverage_pct, lantern_coverage_pct) for a sourcetype name."""
    lower = sourcetype.lower()
    for pattern, mitre, lantern in _COVERAGE_MAP:
        if pattern in lower:
            return mitre, lantern
    return _DEFAULT_MITRE, _DEFAULT_LANTERN
