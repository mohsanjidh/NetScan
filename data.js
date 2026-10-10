// NetScan Phase 1 Sample Data System

const SAMPLE = {
  cards: [
    { label: "Network status", value: "Degraded", sub: "1 active warning logged", cls: "warn" },
    { label: "Latency", value: "48 ms", sub: "Sample 24-hr average", cls: "ok" },
    { label: "Packet loss", value: "2.1%", sub: "Slight elevation detected", cls: "warn" },
    { label: "Diagnostic sessions", value: "128", sub: "Phase 1 test total", cls: "info" }
  ],
  tests: [
    { id: "connectivity", name: "Connectivity test", desc: "Can the target host be reached via probe?", needs: ["target"] },
    { id: "dns", name: "DNS test", desc: "Does the domain resolve to a valid IP address?", needs: ["target"] },
    { id: "latency", name: "Latency test", desc: "Measure round-trip ping time and jitter", needs: ["target"] },
    { id: "tcp", name: "TCP port test", desc: "Is the service port accepting socket connections?", needs: ["target", "port"] }
  ],
  results: {
    connectivity: (t) => `Sample probe: ${t} responded to 4 of 4 probes (0% loss, 12ms RTT).`,
    dns: (t) => `Sample resolution: ${t} resolved to 203.0.113.10 via default resolver in 23 ms.`,
    latency: (t) => `Sample ping statistics: min 41 ms, avg 48 ms, max 63 ms to ${t} (jitter 4.2ms).`,
    tcp: (t, p) => `Sample port probe: ${t} port ${p} connection established successfully in 18ms.`
  },
  rca: [
    {
      name: "Slow web page loading (DNS Delay)",
      problem: "Web pages load with noticeable delay while direct IP ping is normal.",
      cause: "Primary DNS resolver is experiencing heavy response delays (900ms latency).",
      confidence: 84,
      evidence: [
        "DNS resolution for host took 900 ms (threshold < 100ms)",
        "ICMP Ping to 8.8.8.8 succeeded with 18 ms latency",
        "Issue consistently impacts all domain lookups across local subnet"
      ],
      fix: "Switch primary DNS resolver to 1.1.1.1 or 8.8.8.8 and repeat DNS lookup verification."
    },
    {
      name: "Service Unreachable (Port 443 Block)",
      problem: "Application server fails to establish secure HTTPS connection on port 443.",
      cause: "Local firewall or perimeter gateway security rule is refusing connection.",
      confidence: 92,
      evidence: [
        "Host ICMP echo request succeeded (host is online)",
        "TCP SYN packet to port 443 received RST (Connection refused)",
        "HTTP port 80 connects normally"
      ],
      fix: "Verify app service status on target and update firewall rule to allow inbound port 443."
    },
    {
      name: "High Packet Loss & Jitter",
      problem: "VoIP and video calls suffer from audio drops and lag spikes.",
      cause: "Wi-Fi channel congestion or degraded local router bufferqueue.",
      confidence: 68,
      evidence: [
        "Packet loss to local gateway averaged 5.4% over 50 probes",
        "Latency jitter spiked from 12ms to 180ms during traffic burst",
        "Wired interface connection shows 0% loss"
      ],
      fix: "Reboot local Wi-Fi router or switch device to 5GHz band / ethernet connection."
    },
    {
      name: "Default Gateway Unreachable",
      problem: "All external addresses and local intranet sites fail to open.",
      cause: "Network cable disconnected or local IP DHCP lease expired.",
      confidence: null,
      evidence: [
        "Local IP ping to 192.168.1.1 timed out (100% loss)",
        "Network interface status reports Limited Connectivity",
        "No default route found in local routing table"
      ],
      fix: "Check physical ethernet cable, verify Wi-Fi association, and renew DHCP lease."
    }
  ],
  sessions: [
    { id: "S-0128", type: "Connectivity test", target: "example.com", status: "Passed", cls: "ok", time: "2026-10-10 09:42" },
    { id: "S-0127", type: "DNS test", target: "intranet.local", status: "Failed", cls: "bad", time: "2026-10-10 09:15" },
    { id: "S-0126", type: "Latency test", target: "192.168.1.1", status: "Warning", cls: "warn", time: "2026-10-09 17:30" },
    { id: "S-0125", type: "TCP port test", target: "10.0.0.5:443", status: "Failed", cls: "bad", time: "2026-10-09 15:02" },
    { id: "S-0124", type: "Connectivity test", target: "dns.google", status: "Passed", cls: "ok", time: "2026-10-09 11:20" },
    { id: "S-0123", type: "Latency test", target: "api.github.com", status: "Passed", cls: "ok", time: "2026-10-08 16:48" },
    { id: "S-0122", type: "DNS test", target: "example.org", status: "Passed", cls: "ok", time: "2026-10-08 10:05" },
    { id: "S-0121", type: "TCP port test", target: "db.internal:5432", status: "Passed", cls: "ok", time: "2026-10-07 14:12" },
    { id: "S-0120", type: "Connectivity test", target: "10.0.0.1", status: "Warning", cls: "warn", time: "2026-10-07 11:05" }
  ]
};
