# CN Localization QA — enisa-srp-demo-v2

**Date**: 2026-06-02
**Scope**: Chinese-only copy / i18n optimization. No structural, layout, CSS, guard-chain, or interaction changes.
**Approach**: Added or updated `<span class="cn">` counterparts and `t()` dynamic values. English strings and key technical terms preserved.

---

## 1. Pages Modified

| Page | Changes |
|---|---|
| `js/app.js` | OUTCOME pills → CN labels (e.g. "Reportable（应报送）"); endorsement/pending → "已背书/待背书"; package status → "已准备/待准备"; receipt pending → "回执待处理"; SLA "high" → "高"; validation_pending/pass → CN; P01 detail `next`/`blocked`/`type` → CN; langchange re-render for P01 detail panel |
| `index.html` | Already fully bilingualized — no changes needed |
| `p00-decision-gate.html` | Breadcrumb → CN; status-strip card headers (1–4) → CN; VulnerabilitySignal panel title → CN; endorsement modal field labels (reviewer/timestamp/comment) → CN |
| `workbench.html` | Breadcrumb → CN; metric labels (Signals/Decisions/Gaps) → CN; detail panel field labels (owner/SLA clock/next action/title/blocked reason) → CN |
| `case-sharetable.html` | Breadcrumb → CN; AffectedProductVersion table headers → CN; country routing callout titles + descriptions → CN |
| `evidence-receipt.html` | Breadcrumb → CN; compliance risk titles (source limitation/timestamp uncertainty) → CN; static timeline event titles + descriptions → CN |
| `readiness-dashboard.html` | Breadcrumb → CN; impact scope table headers → CN; redaction check-list items → CN; country route descriptions + pills → CN |
| `demo-observer.html` | Already fully bilingualized — no changes needed |
| `design-system.html` | Already fully bilingualized — no changes needed |

---

## 2. Preserved English Terms (by design)

The following terms are **deliberately kept in English** (or "中文 + English" format) because they are PRD-defined identifiers, protocol tokens, or spec field names:

| Term | Reason |
|---|---|
| ENISA SRP | Organization / program name |
| EU CRA | Regulation acronym |
| VulnerabilitySignal | Domain entity name |
| ReportabilityDecision | Domain entity name |
| ShareTable v2 | Spec version identifier |
| received_registered | Protocol status token (must be exact) |
| demo_observer | Role identifier |
| RBAC | Industry standard acronym |
| CSIRT | Industry standard acronym |
| CVSS | Scoring system acronym |
| CIAA | Security model acronym |
| SLA | Industry standard acronym |
| PoC | Industry standard acronym |
| SCM | Industry standard acronym |
| EEA | Geographic scope acronym |
| ANSSI / BSI / CCN-CERT | National authority names |
| INV-1 / INV-2 / INV-3 / INV-4 | Internal invariant IDs |
| L1 / L2 / L3 | Proof lane identifiers |
| CVE-2026-12345 | CVE identifier |
| DEC-001 / SIG-001 / CASE-014 / GAP-007 | Entity IDs |
| CRA-FR-20260901-01 | Case identifier |
| SNAP-20260901-001 | Snapshot identifier |
| TI-001 / LAB-042 / PROD-17 etc. | Evidence reference IDs |
| Proof lane field names (actively_exploited_vulnerability, severe_incident_security_impact, severe_incident_malicious_code) | Spec-defined lane identifiers |
| ShareTable A–F / BB / BC / BG / BL / AY / AZ / BI field names | Spec-defined field codes |
| product_model, affected_version, fixed_version, market, installed_base, evidence_ref | ShareTable column names |
| decision_rule_trace, product_relevance, eea_relevance | Decision rule field names |
| Club-SSI | Proper noun |

---

## 3. How to Verify Manually

### Step 1: Open the app
```sh
cd /Users/martin/Code/enisa-srp-demo/enisa-srp-demo-v2
python3 -m http.server 8080
# or: npx serve .
```
Open `http://localhost:8080/index.html`.

### Step 2: Switch to Chinese
Click the **中文** button in the top-right lang toggle on any page. The page should switch immediately via `data-lang="cn"`.

### Step 3: Verify index.html (Launcher)
- [ ] Hero heading: "从漏洞信号到可证明、监管安全的报送包。"
- [ ] Journey steps: "信号录入" "风险判断" "报送触发判断" etc.
- [ ] Screen cards: all have CN titles and descriptions
- [ ] Footer guard: Chinese boundary text visible
- [ ] No horizontal overflow at any viewport width

### Step 4: Verify P00 (Decision Gate)
- [ ] Breadcrumb: "P00 / VulnerabilitySignal → ReportabilityDecision（报送触发判断）"
- [ ] Status strip: "1 · VulnerabilitySignal（漏洞信号）" "2 · ReportabilityDecision（报送触发判断）" "3 · 审核人背书" "4 · Case 创建"
- [ ] VulnerabilitySignal panel title: "VulnerabilitySignal（漏洞信号）· SIG-001"
- [ ] Endorsement modal: field labels show CN
- [ ] Outcome pill shows "Reportable（应报送）" / "Not reportable（不应报送）" / "Need more evidence（需补充证据）"
- [ ] Endorsement pill shows "已背书" or "待背书"

### Step 5: Verify P01 (Workbench)
- [ ] Breadcrumb: "P01 / 可选运营上下文 / 队列总览"
- [ ] Metric labels show CN: "信号 (Signals)" "判断 (Decisions)" "缺口 (Gaps)"
- [ ] Detail panel field labels show CN
- [ ] Click a row → detail panel updates with Chinese `next` and `blocked` text
- [ ] Switch EN→CN with a row selected → detail panel re-renders

### Step 6: Verify P02 (Case & ShareTable)
- [ ] Breadcrumb: "P02 / Case 与 ShareTable v2 数据完成"
- [ ] AffectedProductVersion table headers show CN
- [ ] Country routing callouts: "FR · 就绪 (ready)" "DE · 测试中 (testing)" "ES · 降级通道 (fallback)" "IT · 缺口 (gap)"
- [ ] Validation pill shows "校验待决" or "校验通过"

### Step 7: Verify P04 (Evidence & Receipt)
- [ ] Breadcrumb: "P04 / submitted_payload_snapshot（已提交 payload 快照）→ PortalReceiptEvidence（门户回执证据）"
- [ ] Compliance risks: "来源限制 (source limitation)" "时间戳不确定性 (timestamp uncertainty)"
- [ ] Timeline events show CN: "VulnerabilitySignal SIG-001 已创建" "ReportabilityDecision DEC-001 已判定"
- [ ] Receipt status pill: "received_registered" or "回执待处理"

### Step 8: Verify P05 (Readiness Dashboard)
- [ ] Breadcrumb: "P05 / 基于工作流状态的实时准备度"
- [ ] Impact scope table headers: "市场 (market)" "产品 (product)" etc.
- [ ] Redaction check-list items all show CN
- [ ] Country route pills: "就绪" "测试中" "降级" "缺口"
- [ ] Drilldown cards all show CN labels

### Step 9: Verify P06 (Observer View)
- [ ] Breadcrumb already bilingualized
- [ ] "What observer can see" → "观察者可见"
- [ ] "What is redacted" → "被脱敏内容" (click to see decrypt reveal)
- [ ] "What cannot be claimed" → "不可声称内容"
- [ ] Export row labels: "包含" / "排除"
- [ ] Replay timeline events show CN

### Step 10: Verify Design System
- [ ] All sections already bilingualized — toggle EN/CN, all labels switch

### Step 11: Cross-page consistency
- [ ] Side nav: all entries show CN on all pages
- [ ] Footer journey guards: CN text on all pages
- [ ] Language toggle persists across page navigations (localStorage)

### Step 12: No regressions
- [ ] Switch to EN — all English text matches original
- [ ] No horizontal overflow at any viewport (320px–1920px)
- [ ] All guard chains, modals, drawers, toasts work correctly in both languages
- [ ] All interactive elements (buttons, tabs, drilldowns, filter, decrypt reveal) function correctly in CN mode

---

## 4. Known Limitations (intentional)

- Filter buttons in P01 workbench ("all", "reportable", "case", "blocked", "not_reportable") remain in English — these are short technical filter tokens
- ShareTable field codes (A–F, BB, BC, etc.) and decision binding field labels remain in English — these are spec-defined identifiers
- Demo/story content in design-system.html examples remains English-forward since the page is a reference board, not a user-facing screen
- `data-screen-label` attributes remain English (not visible to users)
