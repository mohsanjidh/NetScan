const API_BASE_URL = (typeof window !== "undefined" && window.location.origin && window.location.origin.startsWith("http"))
  ? window.location.origin
  : "http://127.0.0.1:8000";
let isBackendOnline = false;

const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const esc = s => String(s).replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));

// ---- Health Check & API Status ----
async function checkBackendHealth() {
  const badgeEl = $("#apiStatusBadge");
  const dotEl = $("#apiStatusDot");
  const noticeEl = $("#noticeBannerText");

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 3000);
    
    const res = await fetch(`${API_BASE_URL}/api/health`, { signal: controller.signal });
    clearTimeout(timeoutId);

    if (res.ok) {
      isBackendOnline = true;
      if (badgeEl) badgeEl.textContent = "Python API: Online (8000)";
      if (dotEl) {
        dotEl.style.background = "var(--ok)";
        dotEl.style.boxShadow = "0 0 10px var(--ok)";
      }
      if (noticeEl) noticeEl.innerHTML = `<strong>Live Engine Connected:</strong> Real network probes and ML Explainability Engine active at <code>${API_BASE_URL}</code>.`;
      
      renderCards();
      $$('[data-mount="sessions"]').forEach(renderSessions);
      $$('[data-mount="diag"]').forEach(renderDiag);
      $$('[data-mount="rca"]').forEach(el => renderRca(el, !!el.dataset.picker));
      return;
    }
  } catch (err) {
    // API offline or connection refused
  }

  isBackendOnline = false;
  if (badgeEl) badgeEl.textContent = "Python API: Offline (Demo Mode)";
  if (dotEl) {
    dotEl.style.background = "var(--warn)";
    dotEl.style.boxShadow = "0 0 10px var(--warn)";
  }
  if (noticeEl) noticeEl.innerHTML = `<strong>Demo Fallback Mode:</strong> Python backend API server is offline. To start live probes, run: <code>py -m uvicorn backend.main:app --port 8000</code>.`;

  renderCards();
  $$('[data-mount="sessions"]').forEach(renderSessions);
  $$('[data-mount="diag"]').forEach(renderDiag);
  $$('[data-mount="rca"]').forEach(el => renderRca(el, !!el.dataset.picker));
}



// ---- Renderers ----
function renderCards() {
  const cardsEl = $("#cards");
  if (!cardsEl) return;
  cardsEl.innerHTML = SAMPLE.cards.map(c => `
    <div class="card" style="--c:var(--${c.cls})">
      <h3>${esc(c.label)}<span class="tag">${isBackendOnline ? "Live Engine" : "Sample"}</span></h3>
      <div class="val">${esc(c.value)}</div>
      <div class="sub">${esc(c.sub)}</div>
    </div>`).join("");
}

async function fetchLiveSessions() {
  if (!isBackendOnline) return null;
  try {
    const res = await fetch(`${API_BASE_URL}/api/sessions`);
    if (res.ok) {
      const data = await res.json();
      return data.map(s => ({
        id: s.session_id,
        type: s.test_type.toUpperCase() + " test",
        target: s.target,
        status: s.status,
        cls: s.status === "Passed" ? "ok" : (s.status === "Warning" ? "warn" : "bad"),
        time: s.timestamp
      }));
    }
  } catch (e) {}
  return null;
}

async function renderSessions(table) {
  const limit = +table.dataset.limit || SAMPLE.sessions.length;
  const isFullTable = table.id === "fullHistoryTable";
  
  let items = SAMPLE.sessions;

  const liveItems = await fetchLiveSessions();
  if (liveItems && liveItems.length > 0) {
    items = [...liveItems, ...SAMPLE.sessions];
  }

  if (isFullTable) {
    const searchVal = ($("#historySearch")?.value || "").toLowerCase().trim();
    const filterVal = $("#historyFilter")?.value || "all";

    items = items.filter(s => {
      const matchesSearch = !searchVal || 
        s.id.toLowerCase().includes(searchVal) || 
        s.target.toLowerCase().includes(searchVal) || 
        s.type.toLowerCase().includes(searchVal);
      const matchesFilter = filterVal === "all" || s.status === filterVal;
      return matchesSearch && matchesFilter;
    });
  }

  const rows = items.slice(0, limit);

  if (rows.length === 0) {
    table.innerHTML = `<thead><tr><th>ID</th><th>Test</th><th>Target</th><th>Status</th><th>Time</th></tr></thead>
      <tbody><tr><td colspan="5" style="text-align:center; color:var(--muted); padding:1.5rem;">No matching incident sessions found.</td></tr></tbody>`;
    return;
  }

  table.innerHTML = `<thead><tr><th>ID</th><th>Test</th><th>Target</th><th>Status</th><th>Time</th></tr></thead><tbody>` +
    rows.map(s => `<tr>
      <td class="mono" style="font-size:0.82rem; font-weight:600;">${esc(s.id)}</td>
      <td>${esc(s.type)}</td>
      <td class="mono" style="font-size:0.84rem;">${esc(s.target)}</td>
      <td><span class="status s-${s.cls}">${esc(s.status)}</span></td>
      <td style="color:var(--muted); font-size:0.82rem;">${esc(s.time)}</td>
    </tr>`).join("") + `</tbody>`;
}

function renderDiag(el) {
  el.innerHTML = `<h2>Network diagnostics<span class="tag">${isBackendOnline ? "FastAPI Live" : "Demo Mode"}</span></h2>
    <div class="opts">${SAMPLE.tests.map((t, i) => `<button class="opt" data-test="${t.id}" aria-pressed="${i === 0}">${t.name}<small>${t.desc}</small></button>`).join("")}</div>
    <div class="row">
      <label>Target Address / Host<input class="f-target" value="google.com" placeholder="e.g. 8.8.8.8, 127.0.0.1, or google.com"></label>
      <label class="f-port-wrap" hidden>Port Number<input class="f-port" type="number" min="1" max="65535" value="443"></label>
      <button class="btn f-run">Run Single Test</button>
      <button class="btn f-batch-run" style="background: linear-gradient(135deg, #70101b 0%, #3a0407 100%); border: 1px solid var(--red-bright);">Run Full Path Workflow</button>
    </div>
    <div class="result" aria-live="polite">Select a diagnostic test above and click <strong>Run Single Test</strong> or <strong>Run Full Path Workflow</strong>.</div>`;

  let test = SAMPLE.tests[0].id;
  const out = $(".result", el), run = $(".f-run", el), batchRun = $(".f-batch-run", el), targetInput = $(".f-target", el);

  $$(".opt", el).forEach(b => b.onclick = () => {
    test = b.dataset.test;
    $$(".opt", el).forEach(x => x.setAttribute("aria-pressed", x === b));
    $(".f-port-wrap", el).hidden = test !== "tcp";
  });

  const executeSingleTest = async () => {
    const target = targetInput.value.trim();
    if (!target) {
      out.innerHTML = `<span style="color:var(--bad);">Please enter a target host or IP address first.</span>`;
      return;
    }
    const port = +$(".f-port", el).value;
    run.disabled = true;
    out.innerHTML = `<span style="color:var(--muted);"><span class="status-indicator live" style="display:inline-block; vertical-align:middle; margin-right:6px;"></span> Executing real network ${SAMPLE.tests.find(t => t.id === test).name} probes...</span>`;

    if (isBackendOnline) {
      try {
        const payload = { target: target, test_type: test, port: port, count: 4, timeout: 3.0 };
        const response = await fetch(`${API_BASE_URL}/api/diagnose`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload)
        });

        if (response.ok) {
          const res = await response.json();
          out.innerHTML = `
            <div style="display:flex; justify-content:space-between; align-items:center;">
              <strong>${esc(res.target)} &mdash; ${esc(res.test_type.toUpperCase())} Test</strong>
              <span class="status s-${res.status === "Passed" ? "ok" : (res.status === "Warning" ? "warn" : "bad")}">${esc(res.status)}</span>
            </div>
            <div class="mono" style="margin-top:4px;">${esc(res.message)}</div>
            <div style="margin-top:6px; font-size:0.82rem; color:var(--muted);">
              <strong>Evidence Collected:</strong>
              <ul style="margin:2px 0 0; padding-left:1.2rem; color:#e5e7eb;">
                ${res.evidence.map(e => `<li>${esc(e)}</li>`).join("")}
              </ul>
            </div>
            <small style="color:var(--muted); font-size:0.75rem; display:block; margin-top:6px;">Session ID: <code>${esc(res.session_id)}</code> &bull; RTT: ${res.response_time_ms} ms &bull; Error Type: <code>${esc(res.error_type)}</code></small>`;
          
          run.disabled = false;
          $$('[data-mount="sessions"]').forEach(renderSessions);
          return;
        }
      } catch (err) {}
    }

    setTimeout(() => {
      const testName = SAMPLE.tests.find(t => t.id === test).name;
      const resText = SAMPLE.results[test](target, port);
      out.innerHTML = `<strong>${esc(testName)}</strong><br><span class="mono">${esc(resText)}</span><br><small style="color:var(--muted); font-size:0.78rem;">Simulated probe execution completed successfully (Demo Mode).</small>`;
      run.disabled = false;
    }, 650);
  };

  const executeBatchWorkflow = async () => {
    const target = targetInput.value.trim();
    if (!target) {
      out.innerHTML = `<span style="color:var(--bad);">Please enter a target host or IP address first.</span>`;
      return;
    }
    const port = +$(".f-port", el).value;
    batchRun.disabled = true;
    out.innerHTML = `<span style="color:var(--muted);"><span class="status-indicator live" style="display:inline-block; vertical-align:middle; margin-right:6px;"></span> Executing 3-point diagnostic workflow (Gateway -> DNS -> Target)...</span>`;

    if (isBackendOnline) {
      try {
        const payload = { target: target, port: port };
        const response = await fetch(`${API_BASE_URL}/api/diagnose/batch`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload)
        });

        if (response.ok) {
          const res = await response.json();
          out.innerHTML = `
            <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:8px;">
              <strong>Full Diagnostic Path Workflow &mdash; ${esc(res.target)}</strong>
              <span class="status s-${res.overall_status === "Passed" ? "ok" : (res.overall_status === "Warning" ? "warn" : "bad")}">${esc(res.overall_status)}</span>
            </div>
            <div style="display:grid; grid-template-columns:1fr 1fr 1fr; gap:0.5rem; margin-top:8px;">
              <div style="background:var(--bg-card); border:1px solid var(--line-red); padding:0.6rem; border-radius:4px;">
                <div style="font-size:0.75rem; color:var(--muted);">1. Gateway Probe</div>
                <div style="font-weight:600; font-size:0.85rem;" class="status s-${res.gateway_result.status === "Passed" ? "ok" : "bad"}">${esc(res.gateway_result.status)}</div>
                <small style="font-size:0.72rem; color:var(--muted); display:block; margin-top:2px;">${res.gateway_result.response_time_ms} ms RTT</small>
              </div>
              <div style="background:var(--bg-card); border:1px solid var(--line-red); padding:0.6rem; border-radius:4px;">
                <div style="font-size:0.75rem; color:var(--muted);">2. DNS Lookup</div>
                <div style="font-weight:600; font-size:0.85rem;" class="status s-${res.dns_result.status === "Passed" ? "ok" : "bad"}">${esc(res.dns_result.status)}</div>
                <small style="font-size:0.72rem; color:var(--muted); display:block; margin-top:2px;">${res.dns_result.response_time_ms} ms</small>
              </div>
              <div style="background:var(--bg-card); border:1px solid var(--line-red); padding:0.6rem; border-radius:4px;">
                <div style="font-size:0.75rem; color:var(--muted);">3. Target Port Probe</div>
                <div style="font-weight:600; font-size:0.85rem;" class="status s-${res.target_result.status === "Passed" ? "ok" : "bad"}">${esc(res.target_result.status)}</div>
                <small style="font-size:0.72rem; color:var(--muted); display:block; margin-top:2px;">Port ${port} (${res.target_result.response_time_ms} ms)</small>
              </div>
            </div>
            <small style="color:var(--muted); font-size:0.75rem; display:block; margin-top:8px;">Multi-Point Probe Workflow completed at ${esc(res.timestamp)}</small>`;
          
          batchRun.disabled = false;
          $$('[data-mount="sessions"]').forEach(renderSessions);
          return;
        }
      } catch (err) {}
    }

    setTimeout(() => {
      out.innerHTML = `<strong>Full Diagnostic Path Workflow (Demo Mode)</strong><br><span class="mono">Gateway (8.8.8.8) OK &bull; DNS ${target} Resolved &bull; Port ${port} Open</span>`;
      batchRun.disabled = false;
    }, 700);
  };

  run.onclick = executeSingleTest;
  batchRun.onclick = executeBatchWorkflow;
  targetInput.onkeydown = (e) => {
    if (e.key === "Enter") executeSingleTest();
  };
}

function renderRca(el, picker) {
  const draw = i => {
    const r = SAMPLE.rca[i];
    $(".rca", el).innerHTML = `<dl>
      <dt>Detected Problem</dt><dd><strong>${esc(r.problem)}</strong></dd>
      <dt>Probable Root Cause</dt><dd style="color:var(--red-bright); font-weight:600;">${esc(r.cause)}</dd>
      <dt>Supporting Evidence</dt><dd><ul>${r.evidence.map(e => `<li>${esc(e)}</li>`).join("")}</ul></dd>
      <dt>Recommended Fix</dt><dd style="color:#6ee7b7;">${esc(r.fix)}</dd>
      <dt>Confidence Score</dt><dd>${r.confidence == null ?
        `<span style="color:var(--muted); font-size:0.85rem;">Insufficient evidence for automated numerical scoring.</span>` :
        `<div class="conf"><div class="bar"><i style="width:${r.confidence}%"></i></div><strong>${r.confidence}%</strong> <small style="color:var(--muted);">(Rule-based confidence)</small></div>`}</dd>
    </dl>`;
  };

  el.innerHTML = `<h2>Root-cause analysis engine<span class="tag">${isBackendOnline ? "Live Python Engine" : "Pattern Matching"}</span></h2>` +
    (picker ? `
      <div class="row" style="margin-bottom:1rem;">
        <label>Target Domain / Host for Live RCA<input class="rca-target-input" value="google.com" placeholder="e.g. google.com, invalid.local"></label>
        <button class="btn rca-run-btn">Run Live RCA Diagnosis</button>
      </div>
      <label class="picker">Or Select Sample Pattern<select class="select-sm">${SAMPLE.rca.map((r, i) => `<option value="${i}">${esc(r.name)}</option>`).join("")}</select></label>` : "") +
    `<div class="rca"></div>`;

  draw(0);
  
  if (picker) {
    $("select", el).onchange = e => draw(+e.target.value);
    
    const rcaBtn = $(".rca-run-btn", el);
    const targetInput = $(".rca-target-input", el);
    
    if (rcaBtn && targetInput) {
      rcaBtn.onclick = async () => {
        const target = targetInput.value.trim();
        if (!target) return;
        
        rcaBtn.disabled = true;
        $(".rca", el).innerHTML = `<div style="padding:1rem; color:var(--muted);"><span class="status-indicator live" style="display:inline-block; vertical-align:middle; margin-right:6px;"></span> Running multi-point diagnostic probes and evaluating RCA & Explainability rules for ${esc(target)}...</div>`;
        
        if (isBackendOnline) {
          try {
            // 1. Run batch diagnostic probe
            const batchRes = await fetch(`${API_BASE_URL}/api/diagnose/batch`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ target: target, port: 443 })
            });

            if (batchRes.ok) {
              const batchData = await batchRes.json();
              const testResults = [batchData.gateway_result, batchData.dns_result, batchData.target_result];
              
              // 2. Fetch RCA diagnosis and Explainability data
              const [rcaRes, expRes] = await Promise.all([
                fetch(`${API_BASE_URL}/api/rca/analyze`, {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({ target: target, test_results: testResults })
                }),
                fetch(`${API_BASE_URL}/api/explain`, {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({ target: target, test_results: testResults })
                })
              ]);

              if (rcaRes.ok) {
                const rcaData = await rcaRes.json();
                let expHTML = "";
                
                if (expRes.ok) {
                  const expData = await expRes.json();
                  expHTML = `
                    <dt>CLI Verification</dt>
                    <dd>
                      <div class="mono" style="background:#0d0c12; border:1px solid var(--line-red); padding:0.5rem 0.75rem; border-radius:4px; margin-top:2px;">
                        ${expData.cli_troubleshooting_commands.map(cmd => `<div>$ ${esc(cmd)}</div>`).join("")}
                      </div>
                    </dd>
                    <dt>Top Feature Drivers</dt>
                    <dd>
                      <div style="display:flex; gap:0.4rem; flex-wrap:wrap; margin-top:2px;">
                        ${expData.top_contributing_features.map(f => `<span class="tag" style="margin:0; background:rgba(230,18,27,0.18); border-color:var(--red-bright); color:#ffffff;">${esc(f)}</span>`).join("")}
                      </div>
                    </dd>
                    <dt>Knowledge Base</dt>
                    <dd>
                      <ul style="margin:0; padding-left:1.2rem; font-size:0.82rem; color:var(--muted);">
                        ${expData.knowledge_base_references.map(ref => `<li>${esc(ref)}</li>`).join("")}
                      </ul>
                    </dd>`;
                }

                $(".rca", el).innerHTML = `<dl>
                  <dt>Target Analyzed</dt><dd><strong>${esc(target)}</strong> <small style="color:var(--muted);">(Live Engine)</small></dd>
                  <dt>Scenario Classified</dt><dd><span class="tag" style="font-size:0.8rem; margin:0;">${esc(rcaData.scenario_name)}</span></dd>
                  <dt>Detected Problem</dt><dd><strong>${esc(rcaData.detected_problem)}</strong></dd>
                  <dt>Probable Root Cause</dt><dd style="color:var(--red-bright); font-weight:600;">${esc(rcaData.probable_cause)}</dd>
                  <dt>Supporting Evidence</dt><dd><ul>${rcaData.supporting_evidence.map(e => `<li>${esc(e)}</li>`).join("")}</ul></dd>
                  <dt>Recommended Fix</dt><dd style="color:#6ee7b7;">${esc(rcaData.recommended_fix)}</dd>
                  <dt>Confidence Score</dt><dd>${rcaData.confidence_score == null ?
                    `<span style="color:var(--muted); font-size:0.85rem;">Insufficient evidence for automated numerical scoring.</span>` :
                    `<div class="conf"><div class="bar"><i style="width:${rcaData.confidence_score}%"></i></div><strong>${rcaData.confidence_score}%</strong> <small style="color:var(--muted);">(Calibrated Rule Confidence)</small></div>`}</dd>
                  ${expHTML}
                </dl>`;
                rcaBtn.disabled = false;
                return;
              }
            }
          } catch (err) {}
        }

        // Demo fallback
        setTimeout(() => {
          draw(0);
          rcaBtn.disabled = false;
        }, 650);
      };
    }
  }
}

// ---- Navigation & Router ----
const titles = {
  dashboard: "Dashboard",
  diagnostics: "Network Diagnostics",
  rca: "Root-Cause Analysis",
  history: "Incident History",
  reports: "Diagnostic Reports",
  settings: "System Settings"
};

function show() {
  const hash = location.hash.slice(1);
  const v = titles[hash] ? hash : "dashboard";
  $$(".view").forEach(s => s.hidden = s.id !== "view-" + v);
  $$("nav a").forEach(a => a.classList.toggle("active", a.dataset.view === v));
  const titleEl = $("#viewTitle");
  if (titleEl) titleEl.textContent = titles[v];
  const sidebar = $("#sidebar");
  if (sidebar) sidebar.classList.remove("open");
}

// Initial Mount
renderCards();
$$('[data-mount="diag"]').forEach(renderDiag);
$$('[data-mount="rca"]').forEach(el => renderRca(el, !!el.dataset.picker));
$$('[data-mount="sessions"]').forEach(renderSessions);

// Check FastAPI Server Connection
checkBackendHealth();

// Event Listeners for History Search & Filter
const searchInput = $("#historySearch");
const filterSelect = $("#historyFilter");
const fullTable = $("#fullHistoryTable");

if (searchInput && fullTable) {
  searchInput.oninput = () => renderSessions(fullTable);
}
if (filterSelect && fullTable) {
  filterSelect.onchange = () => renderSessions(fullTable);
}

// Sidebar Drawer Control
const menuBtn = $("#menuBtn");
if (menuBtn) {
  menuBtn.onclick = () => {
    const sidebar = $("#sidebar");
    if (sidebar) sidebar.classList.toggle("open");
  };
}

// Close drawer when clicking nav links on mobile
$$("nav a").forEach(link => {
  link.addEventListener("click", () => {
    const sidebar = $("#sidebar");
    if (sidebar) sidebar.classList.remove("open");
  });
});

window.addEventListener("hashchange", show);
show();

// ---- Phase 9 Report Export & Incident Resolution Verification ----
const exportReportBtn = $("#exportReportBtn");
const verifyResolutionBtn = $("#verifyResolutionBtn");
const reportTargetInput = $("#reportTargetInput");
const reportFormatSelect = $("#reportFormatSelect");
const reportOutputArea = $("#reportOutputArea");
const verificationContainer = $("#verificationContainer");

if (exportReportBtn && reportOutputArea) {
  exportReportBtn.onclick = async () => {
    const target = (reportTargetInput?.value || "google.com").trim();
    const fmt = reportFormatSelect?.value || "markdown";

    exportReportBtn.disabled = true;
    reportOutputArea.value = `Generating audit report for ${target}...`;

    try {
      let testResults = [];
      if (isBackendOnline) {
        // Run batch probes to gather current evidence
        const batchRes = await fetch(`${API_BASE_URL}/api/diagnose/batch`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ target: target, port: 443 })
        });
        if (batchRes.ok) {
          const batchData = await batchRes.json();
          testResults = [batchData.gateway_result, batchData.dns_result, batchData.target_result];
        }
      }

      const payload = { target: target, test_results: testResults, format: fmt };
      if (isBackendOnline) {
        const repRes = await fetch(`${API_BASE_URL}/api/report/export`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload)
        });

        if (repRes.ok) {
          const data = await repRes.json();
          reportOutputArea.value = data.report_content;
          
          // Trigger file download
          const blob = new Blob([data.report_content], { type: fmt === "html" ? "text/html" : "text/markdown" });
          const url = URL.createObjectURL(blob);
          const a = document.createElement("a");
          a.href = url;
          a.download = data.filename;
          a.click();
          URL.revokeObjectURL(url);
          
          exportReportBtn.disabled = false;
          return;
        }
      }
    } catch (e) {}

    // Fallback Report Output
    reportOutputArea.value = `# NetRCA-X Audit Report - ${target}\nDate: ${new Date().toLocaleString()}\nMode: Demo Mode Exporter\n\nExecutive Summary: Target ${target} network diagnostics passed.`;
    exportReportBtn.disabled = false;
  };
}

if (verifyResolutionBtn && verificationContainer) {
  verifyResolutionBtn.onclick = async () => {
    const target = (reportTargetInput?.value || "google.com").trim();
    
    verifyResolutionBtn.disabled = true;
    verificationContainer.style.display = "block";
    verificationContainer.innerHTML = `<span style="color:var(--muted);"><span class="status-indicator live" style="display:inline-block; vertical-align:middle; margin-right:6px;"></span> Re-testing diagnostic probes for ${esc(target)} and comparing pre/post states...</span>`;

    try {
      if (isBackendOnline) {
        // Gather pre test results
        const batchRes = await fetch(`${API_BASE_URL}/api/diagnose/batch`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ target: target, port: 443 })
        });

        if (batchRes.ok) {
          const batchData = await batchRes.json();
          const preResults = [batchData.gateway_result, batchData.dns_result, batchData.target_result];

          const verifyRes = await fetch(`${API_BASE_URL}/api/verify`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ target: target, pre_test_results: preResults })
          });

          if (verifyRes.ok) {
            const vData = await verifyRes.json();
            const badgeCls = vData.is_resolved ? "ok" : "bad";

            verificationContainer.innerHTML = `
              <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:8px;">
                <strong>Incident Recovery Verification &mdash; ${esc(vData.target)}</strong>
                <span class="status s-${badgeCls}">${esc(vData.resolution_status)}</span>
              </div>
              <p style="margin:0 0 8px; font-size:0.88rem; color:#e2e8f0;">${esc(vData.comparison_summary)}</p>
              <div style="font-size:0.8rem; color:var(--muted); display:flex; gap:15px;">
                <span>Pre-Fault: <code>${esc(vData.pre_fault_category)}</code> (${vData.pre_failed_count} failures)</span>
                <span>Post-Fault: <code>${esc(vData.post_fault_category)}</code> (${vData.post_failed_count} failures)</span>
                <span>Latency Delta: <code>${vData.latency_delta_ms > 0 ? '+' : ''}${vData.latency_delta_ms} ms</code></span>

              </div>`;

            verifyResolutionBtn.disabled = false;
            return;
          }
        }
      }
    } catch (e) {}

    // Fallback Verification Display
    verificationContainer.innerHTML = `
      <div style="display:flex; justify-content:space-between; align-items:center;">
        <strong>Incident Recovery Verification (Demo)</strong>
        <span class="status s-ok">FULLY RESOLVED</span>
      </div>
      <p style="margin:6px 0 0; font-size:0.85rem; color:var(--muted);">Probes re-tested for ${esc(target)}. All 3 path tests returned PASSED status.</p>`;
    verifyResolutionBtn.disabled = false;
  };
}

// ---- System Settings Controls & LocalStorage Manager ----
const saveSettingsBtn = $("#saveSettingsBtn");
const resetSettingsBtn = $("#resetSettingsBtn");
const settingsFeedback = $("#settingsFeedback");

const defaultSettings = {
  target: "google.com",
  packetCount: 4,
  timeout: 3.0,
  port: 443,
  latencyWarn: 100,
  latencyCrit: 250,
  confidenceThresh: 80
};

function loadSystemSettings() {
  try {
    const saved = localStorage.getItem("netrca_settings");
    const cfg = saved ? JSON.parse(saved) : defaultSettings;
    
    if ($("#settingDefaultTarget")) $("#settingDefaultTarget").value = cfg.target || defaultSettings.target;
    if ($("#settingPacketCount")) $("#settingPacketCount").value = cfg.packetCount || defaultSettings.packetCount;
    if ($("#settingTimeout")) $("#settingTimeout").value = cfg.timeout || defaultSettings.timeout;
    if ($("#settingDefaultPort")) $("#settingDefaultPort").value = cfg.port || defaultSettings.port;
    if ($("#settingLatencyWarn")) $("#settingLatencyWarn").value = cfg.latencyWarn || defaultSettings.latencyWarn;
    if ($("#settingLatencyCrit")) $("#settingLatencyCrit").value = cfg.latencyCrit || defaultSettings.latencyCrit;
    if ($("#settingConfidenceThresh")) $("#settingConfidenceThresh").value = cfg.confidenceThresh || defaultSettings.confidenceThresh;
  } catch (e) {}
}

if (saveSettingsBtn && settingsFeedback) {
  saveSettingsBtn.onclick = () => {
    const newCfg = {
      target: $("#settingDefaultTarget")?.value || defaultSettings.target,
      packetCount: +$("#settingPacketCount")?.value || defaultSettings.packetCount,
      timeout: +$("#settingTimeout")?.value || defaultSettings.timeout,
      port: +$("#settingDefaultPort")?.value || defaultSettings.port,
      latencyWarn: +$("#settingLatencyWarn")?.value || defaultSettings.latencyWarn,
      latencyCrit: +$("#settingLatencyCrit")?.value || defaultSettings.latencyCrit,
      confidenceThresh: +$("#settingConfidenceThresh")?.value || defaultSettings.confidenceThresh
    };

    try {
      localStorage.setItem("netrca_settings", JSON.stringify(newCfg));
    } catch (e) {}

    settingsFeedback.style.display = "block";
    settingsFeedback.style.background = "rgba(16, 185, 129, 0.15)";
    settingsFeedback.style.borderColor = "var(--ok)";
    settingsFeedback.style.color = "#6ee7b7";
    settingsFeedback.innerHTML = `<strong>System Settings Saved Successfully!</strong> Probe packet parameters and SLA thresholds updated.`;

    setTimeout(() => {
      settingsFeedback.style.display = "none";
    }, 4000);
  };
}

if (resetSettingsBtn && settingsFeedback) {
  resetSettingsBtn.onclick = () => {
    try {
      localStorage.removeItem("netrca_settings");
    } catch (e) {}

    loadSystemSettings();

    settingsFeedback.style.display = "block";
    settingsFeedback.style.background = "rgba(59, 130, 246, 0.15)";
    settingsFeedback.style.borderColor = "#3b82f6";
    settingsFeedback.style.color = "#93c5fd";
    settingsFeedback.innerHTML = `<strong>Settings Reset to Defaults.</strong> Probe parameters restored to baseline configuration.`;

    setTimeout(() => {
      settingsFeedback.style.display = "none";
    }, 4000);
  };
}

loadSystemSettings();


