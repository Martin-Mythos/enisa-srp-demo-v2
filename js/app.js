/* ============================================================
   ENISA SRP READINESS — EVIDENCE CONSOLE
   Shared runtime: i18n · cross-page state machine · guards ·
   interactions · toast.  Loads on every page; feature-detects.
   ============================================================ */
(function () {
  'use strict';

  /* ---------- i18n ---------- */
  var LANG_KEY = 'srp.lang';
  function getLang() { return localStorage.getItem(LANG_KEY) || 'en'; }
  function setLang(l) {
    localStorage.setItem(LANG_KEY, l);
    document.documentElement.setAttribute('data-lang', l);
    document.querySelectorAll('[data-lang-target]').forEach(function (b) {
      b.classList.toggle('active', b.getAttribute('data-lang-target') === l);
    });
    document.dispatchEvent(new CustomEvent('langchange', { detail: l }));
  }
  function t(o) { return getLang() === 'cn' ? (o.cn || o.en) : o.en; }

  /* ---------- cross-page state ---------- */
  var STATE_KEY = 'srp.state';
  var DEFAULT = {
    outcome: 'reportable',      // reportable | not_reportable | need_more_evidence
    endorsement: 'pending',     // pending | endorsed
    packagePrepared: false,
    snapshot: false,
    receipt: false,
    audit: []                   // [{t, label_en, label_cn, by}]
  };
  var state = load();
  function load() {
    try {
      var s = JSON.parse(localStorage.getItem(STATE_KEY));
      return s ? Object.assign({}, DEFAULT, s) : Object.assign({}, DEFAULT);
    } catch (e) { return Object.assign({}, DEFAULT); }
  }
  function save() { localStorage.setItem(STATE_KEY, JSON.stringify(state)); }
  function setState(patch) { Object.assign(state, patch); save(); render(); }
  function resetState() {
    state = Object.assign({}, DEFAULT, { audit: [] });
    save(); render();
  }
  function pushAudit(label_en, label_cn, by) {
    var now = new Date();
    var ts = now.toISOString().slice(0, 16).replace('T', ' ') + 'Z';
    state.audit.unshift({ t: ts, label_en: label_en, label_cn: label_cn, by: by || 'system' });
    save();
  }

  /* ---------- outcome → pill mapping ---------- */
  var OUTCOME = {
    reportable:        { cls: 'ok',   en: 'Reportable',          cn: 'Reportable（应报送）' },
    not_reportable:    { cls: 'info', en: 'Not reportable',      cn: 'Not reportable（不应报送）' },
    need_more_evidence:{ cls: 'warn', en: 'Need more evidence',  cn: 'Need more evidence（需补充证据）' }
  };

  function setPill(el, cls, text) {
    el.className = 'pill ' + cls;
    el.textContent = text;
  }

  /* ---------- toast ---------- */
  var toastTimer;
  function toast(msg, kind) {
    var el = document.querySelector('[data-toast]');
    if (!el) return;
    el.className = 'toast' + (kind ? ' ' + kind : '');
    el.textContent = msg;
    requestAnimationFrame(function () { el.classList.add('show'); });
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { el.classList.remove('show'); }, 3200);
  }

  /* ---------- central render: reflect state into common hooks ---------- */
  function render() {
    var o = OUTCOME[state.outcome] || OUTCOME.reportable;

    document.querySelectorAll('[data-outcome-pill]').forEach(function (el) {
      setPill(el, o.cls, t(o));
    });
    document.querySelectorAll('[data-outcome-rationale]').forEach(function (el) {
      var map = {
        reportable: { en: 'reportable — relevance established and L2 severe impact met.', cn: 'reportable —— 相关性成立且 L2 严重影响满足。' },
        not_reportable: { en: 'not_reportable — no proof lane met; retained for audit.', cn: 'not_reportable —— 无 proof lane 满足；保留审计。' },
        need_more_evidence: { en: 'need_more_evidence — lane evidence insufficient; suspended.', cn: 'need_more_evidence —— lane 证据不足；挂起。' }
      };
      el.textContent = t(map[state.outcome]);
    });

    document.querySelectorAll('[data-endorsement-status]').forEach(function (el) {
      if (state.endorsement === 'endorsed') setPill(el, 'ok', getLang() === 'cn' ? '已背书' : 'endorsed');
      else setPill(el, 'warn', getLang() === 'cn' ? '待背书' : 'pending');
    });
    document.querySelectorAll('[data-endorsement-summary]').forEach(function (el) {
      el.textContent = state.endorsement === 'endorsed'
        ? t({ en: 'Endorsed by reviewer — audit event written.', cn: '审核人已背书 —— 审计事件已写入。' })
        : t({ en: 'No reviewer endorsement audit event yet.', cn: '尚无审核背书审计事件。' });
    });

    document.querySelectorAll('[data-package-status]').forEach(function (el) {
      if (state.packagePrepared) setPill(el, 'ok', getLang() === 'cn' ? '已准备' : 'prepared');
      else setPill(el, 'warn', getLang() === 'cn' ? '待准备' : 'pending');
    });
    document.querySelectorAll('[data-receipt-status]').forEach(function (el) {
      if (state.receipt) setPill(el, 'ok', 'received_registered');
      else setPill(el, 'warn', getLang() === 'cn' ? '回执待处理' : 'receipt pending');
    });
    document.querySelectorAll('[data-sla-risk]').forEach(function (el) {
      setPill(el, 'danger', getLang() === 'cn' ? '高' : 'high');
    });

    renderFooterGuards();
    renderAuditLists();
    document.dispatchEvent(new CustomEvent('staterender', { detail: state }));
  }

  /* ---------- footer journey guards ---------- */
  function guardMet(req) {
    if (req === 'endorsement') return state.endorsement === 'endorsed';
    if (req === 'package') return state.packagePrepared;
    if (req === 'receipt') return state.receipt;
    return true;
  }
  var GUARD_MSG = {
    endorsement: { en: 'Guard: reviewer_endorsement required (INV-2).', cn: '守卫：需要 reviewer_endorsement（INV-2）。' },
    package: { en: 'Guard: prepare the reporting package on P02 first.', cn: '守卫：先在 P02 准备报送包。' },
    receipt: { en: 'Guard: attach PortalReceiptEvidence on P04 first.', cn: '守卫：先在 P04 附加 PortalReceiptEvidence。' }
  };
  function renderFooterGuards() {
    document.querySelectorAll('[data-requires]').forEach(function (link) {
      var req = link.getAttribute('data-requires');
      var ok = guardMet(req);
      link.classList.toggle('is-locked', !ok);
      link.setAttribute('aria-disabled', ok ? 'false' : 'true');
    });
  }

  /* ---------- audit list rendering ---------- */
  function renderAuditLists() {
    document.querySelectorAll('[data-audit-event-list]').forEach(function (host) {
      host.classList.add('audit');
      if (!state.audit.length) {
        host.innerHTML = '<div class="event"><time>—</time><div><h3>' +
          t({ en: 'No state transitions yet', cn: '尚无状态迁移' }) + '</h3><p>' +
          t({ en: 'Endorse the decision or run the demo to populate the immutable audit.', cn: '背书判断或运行演示以填充不可变审计。' }) +
          '</p></div></div>';
        return;
      }
      host.innerHTML = state.audit.map(function (e) {
        return '<div class="event is-new"><time>' + e.t + '</time><div><h3>' +
          (getLang() === 'cn' ? e.label_cn : e.label_en) + '</h3><p>actor: ' + e.by + '</p></div></div>';
      }).join('');
    });
  }

  /* ============================================================
     PAGE WIRING
     ============================================================ */
  function init() {
    setLang(getLang());

    /* lang toggle */
    document.querySelectorAll('[data-lang-target]').forEach(function (b) {
      b.addEventListener('click', function () { setLang(b.getAttribute('data-lang-target')); });
    });
    document.addEventListener('langchange', function () { render(); });

    /* reset demo */
    document.querySelectorAll('[data-reset-demo]').forEach(function (b) {
      b.addEventListener('click', function () {
        resetState();
        toast(t({ en: 'Demo reset — workflow state cleared.', cn: '演示已重置 —— 工作流状态已清除。' }), 'warn');
      });
    });

    /* generic tabs */
    document.querySelectorAll('[data-tabs]').forEach(function (root) {
      var tabs = root.querySelectorAll('.tab');
      tabs.forEach(function (tab) {
        tab.addEventListener('click', function () {
          var name = tab.getAttribute('data-tab');
          tabs.forEach(function (x) { x.classList.toggle('active', x === tab); });
          root.querySelectorAll('[data-tab-panel]').forEach(function (p) {
            p.classList.toggle('active', p.getAttribute('data-tab-panel') === name);
          });
        });
      });
    });

    wireP00();
    wireP01();
    wireP02();
    wireP04();
    wireP05();
    wireP06();

    /* footer locked-link feedback */
    document.querySelectorAll('[data-requires]').forEach(function (link) {
      link.addEventListener('click', function (e) {
        var req = link.getAttribute('data-requires');
        if (!guardMet(req)) {
          e.preventDefault();
          link.classList.remove('guard-shake'); void link.offsetWidth; link.classList.add('guard-shake');
          toast(t(GUARD_MSG[req]), 'danger');
        }
      });
    });

    render();
  }

  /* ---------- P00 Decision Gate ---------- */
  function wireP00() {
    var laneData = {
      l1: { title: 'L1 · actively_exploited_vulnerability', state: 'unknown', stateCls: 'warn',
            note: { en: 'Forum chatter suggests exploitation but reliability is insufficient.', cn: '论坛迹象显示可能利用，但可靠性不足。' },
            refs: ['evidence://forum-capture-2026-08-31', 'evidence://ti-corr-low-confidence'] },
      l2: { title: 'L2 · severe_incident_security_impact', state: 'met', stateCls: 'ok',
            note: { en: 'Authenticated RCE weakens confidentiality and integrity (CIAA).', cn: '认证后 RCE 削弱机密性与完整性（CIAA）。' },
            refs: ['evidence://TI-001-threat-intel', 'evidence://LAB-042-repro-confirmed'] },
      l3: { title: 'L3 · severe_incident_malicious_code', state: 'not_met', stateCls: 'info',
            note: { en: 'No malicious-code execution in product or user networks on record.', cn: '记录中无产品或用户网络的恶意代码执行。' },
            refs: ['evidence://scan-clean-edge-2.8'] }
    };
    var drawer = document.querySelector('[data-evidence-drawer]');
    if (drawer) {
      document.querySelectorAll('[data-open-lane]').forEach(function (b) {
        b.addEventListener('click', function () {
          var d = laneData[b.getAttribute('data-open-lane')];
          drawer.querySelector('[data-drawer-title]').textContent = d.title;
          drawer.querySelector('[data-drawer-note]').textContent = t(d.note);
          var sp = drawer.querySelector('[data-drawer-state]');
          setPill(sp, d.stateCls, d.state);
          drawer.querySelector('[data-drawer-refs]').innerHTML = d.refs.map(function (r) { return '<li>' + r + '</li>'; }).join('');
          drawer.setAttribute('aria-hidden', 'false');
        });
      });
      drawer.addEventListener('click', function (e) {
        if (e.target === drawer || e.target.closest('[data-close-drawer]')) drawer.setAttribute('aria-hidden', 'true');
      });
    }

    /* outcome switch (decision_rule_trace) */
    var stateOptions = document.querySelectorAll('[data-state-option]');
    if (stateOptions.length) {
      function syncOptions() {
        stateOptions.forEach(function (b) { b.classList.toggle('active', b.getAttribute('data-state-option') === state.outcome); });
      }
      stateOptions.forEach(function (b) {
        b.addEventListener('click', function () {
          setState({ outcome: b.getAttribute('data-state-option') });
          syncOptions();
          updateTraceThen();
          toast(t({ en: 'Outcome set to ' + b.getAttribute('data-state-option') + ' — downstream guards rewired.', cn: 'Outcome 设为 ' + b.getAttribute('data-state-option') + ' —— 下游守卫已重写。' }));
        });
      });
      syncOptions();
      updateTraceThen();
    }
    function updateTraceThen() {
      var row = document.querySelector('.trace-row.then');
      if (!row) return;
      row.classList.toggle('then', true);
    }

    /* endorsement modal */
    var modal = document.querySelector('[data-endorsement-modal]');
    if (modal) {
      var open = document.querySelector('[data-open-endorsement-modal]');
      if (open) open.addEventListener('click', function () {
        if (state.outcome !== 'reportable') {
          toast(t({ en: 'Only a reportable decision can be endorsed for Case creation.', cn: '只有 reportable 判断才能背书以创建 Case。' }), 'warn');
        }
        if (typeof modal.showModal === 'function') modal.showModal(); else modal.setAttribute('open', '');
      });
      modal.querySelectorAll('[data-close-endorsement-modal]').forEach(function (b) {
        b.addEventListener('click', function () { modal.close ? modal.close() : modal.removeAttribute('open'); });
      });
      var submit = modal.querySelector('[data-submit-endorsement]');
      if (submit) submit.addEventListener('click', function () {
        var reviewer = (modal.querySelector('[data-reviewer]') || {}).value || 'Reviewer';
        setState({ endorsement: 'endorsed' });
        pushAudit('ReportabilityDecision DEC-001 endorsed', 'ReportabilityDecision DEC-001 已背书', reviewer);
        render();
        modal.close ? modal.close() : modal.removeAttribute('open');
        toast(t({ en: 'Endorsement recorded — Case creation unlocked.', cn: '背书已记录 —— Case 创建已解锁。' }), 'ok');
        var guard = document.querySelector('[data-case-guard]');
        if (guard) { guard.classList.add('callout', 'info'); guard.classList.remove('danger'); }
      });
    }

    /* guard text on this page */
    document.addEventListener('staterender', function () {
      document.querySelectorAll('[data-guard-reason]').forEach(function (el) {
        if (state.endorsement === 'endorsed') {
          el.className = 'guard-reason cleared';
          el.textContent = t({ en: 'Cleared: reviewer_endorsement recorded.', cn: '已清除：reviewer_endorsement 已记录。' });
        } else {
          el.className = 'guard-reason blocked';
          el.textContent = t({ en: 'Guard: reviewer_endorsement is required.', cn: '守卫：需要 reviewer_endorsement。' });
        }
      });
      var guard = document.querySelector('[data-case-guard]');
      if (guard) {
        if (state.endorsement === 'endorsed') {
          guard.className = 'callout info';
          guard.innerHTML = '<strong>' + t({ en: 'Case creation unlocked', cn: 'Case 创建已解锁' }) + '</strong><span>' + t({ en: 'Endorsed reportable decision DEC-001 can now create a formal Case.', cn: '已背书的 reportable 判断 DEC-001 现在可以创建正式 Case。' }) + '</span>';
        } else {
          guard.className = 'callout danger';
          guard.innerHTML = '<strong>' + t({ en: 'Case creation blocked', cn: 'Case 创建已阻断' }) + '</strong><span>' + t({ en: 'Only an endorsed reportable decision can create a formal Case.', cn: '只有已背书的 reportable 判断才能创建正式 Case。' }) + '</span>';
        }
      }
    });
  }

  /* ---------- P01 Workbench ---------- */
  function wireP01() {
    var rows = document.querySelectorAll('[data-row-id]');
    if (!rows.length) return;
    var detail = {
      'SIG-001': { type: 'Signal', id: 'SIG-001', owner: 'M. Chen / SecOps', sla: 'T0 + 14h 22m', next: { en: 'Reviewer endorse', cn: '审核人背书' }, title: 'CVE-2026-12345 / NetShield Edge', blocked: { en: 'Case creation waits for an endorsed reportable decision.', cn: 'Case 创建等待已背书的 reportable 判断。' }, copy: { en: 'L2 severe impact is met; L1 reliability still carries a source limitation.', cn: 'L2 严重影响满足；L1 可靠性仍有来源限制。' } },
      'DEC-001': { type: 'Decision', id: 'DEC-001', owner: 'A. Rossi / Compliance', sla: 'T0 + 15h', next: { en: 'Endorse on P00', cn: '在 P00 背书' }, title: 'Reportability decision — reportable', blocked: { en: 'Reviewer comment required before endorsement is written.', cn: '审核人需在写背书前提交评论。' }, copy: { en: 'Outcome reportable at high confidence; endorsement writes the audit event.', cn: 'outcome reportable，置信度 high；背书会写入审计事件。' } },
      'CASE-014': { type: 'Case', id: 'CASE-014', owner: 'L. Martin / Product Security', sla: '24h open', next: { en: 'Complete ShareTable', cn: '完成 ShareTable' }, title: 'CRA-FR-20260901-01', blocked: { en: 'Country path, UTC timestamp, and evidence refs still missing.', cn: '国家路径、UTC 时间戳与证据引用仍缺失。' }, copy: { en: 'Endorsed; ShareTable v2 validation has 3 open blockers.', cn: '已背书；ShareTable v2 校验有 3 个开放阻断项。' } },
      'GAP-007': { type: 'Gap', id: 'GAP-007', owner: 'J. Novak / Legal Ops', sla: '72h risk', next: { en: 'Add limitation note', cn: '添加限制说明' }, title: 'UTC receipt timestamp uncertainty', blocked: { en: 'Receipt local time visible only; UTC conversion evidence incomplete.', cn: '仅可见回执本地时间；UTC 转换证据不完整。' }, copy: { en: 'Timestamp uncertainty stays visible as an explicit compliance risk.', cn: '时间戳不确定性作为明确合规风险保持可见。' } },
      'DEC-003': { type: 'Decision', id: 'DEC-003', owner: 'S. Weber / Engineering', sla: 'SLA off', next: { en: 'Audit only', cn: '仅审计' }, title: 'Reportability decision — not_reportable', blocked: { en: 'Not in EEA market; no Case is created (INV-3).', cn: '不在 EEA 市场；不创建 Case（INV-3）。' }, copy: { en: 'not_reportable retained for audit; demonstrates precise non-reporting.', cn: 'not_reportable 留审计；证明精准不报送。' } }
    };
    function selectRow(row) {
      rows.forEach(function (r) { r.classList.toggle('selected', r === row); });
      var d = detail[row.getAttribute('data-row-id')];
      if (!d) return;
      var set = function (sel, v) { var el = document.querySelector(sel); if (el) { if ('value' in el) el.value = v; else el.textContent = v; } };
      set('[data-detail-type]', getLang() === 'cn' ? (d.type === 'Signal' ? '信号 (Signal)' : d.type === 'Decision' ? '判断 (Decision)' : d.type === 'Case' ? 'Case' : d.type === 'Gap' ? '缺口 (Gap)' : d.type) : d.type);
      set('[data-detail-id]', d.id); set('[data-detail-owner]', d.owner);
      set('[data-detail-sla]', d.sla); set('[data-detail-next]', t(d.next)); set('[data-detail-title]', d.title);
      set('[data-detail-blocked]', t(d.blocked));
      var copy = document.querySelector('[data-detail-copy]'); if (copy) copy.textContent = t(d.copy);
    }
    rows.forEach(function (r) { r.addEventListener('click', function () { selectRow(r); }); });

    /* re-select on lang change to update detail panel */
    document.addEventListener('langchange', function () {
      var sel = document.querySelector('[data-row-id].selected');
      if (sel) selectRow(sel);
    });

    document.querySelectorAll('[data-filter]').forEach(function (b) {
      b.addEventListener('click', function () {
        var f = b.getAttribute('data-filter');
        document.querySelectorAll('.workbench-filter-row .state-btn').forEach(function (x) { x.classList.toggle('active', x === b); });
        rows.forEach(function (r) {
          var tags = (r.getAttribute('data-tags') || '').split(' ');
          r.hidden = !(f === 'all' || tags.indexOf(f) !== -1);
        });
      });
    });
  }

  /* ---------- P02 Case & ShareTable ---------- */
  function wireP02() {
    var list = document.querySelector('[data-validation-list]');
    if (!list && !document.querySelector('[data-prepare-package]')) return;

    function blockers() {
      return [
        { id: 'endorse', hard: true, cleared: state.endorsement === 'endorsed',
          en: 'reviewer_endorsement (INV-2)', cn: 'reviewer_endorsement（INV-2）',
          en2: 'Case cannot leave draft until the bound decision is endorsed.', cn2: '绑定判断未背书前 Case 不能离开 draft。' },
        { id: 'utc', hard: false, cleared: state.utcAck, gap: true,
          en: 'UTC timestamp evidence gap', cn: 'UTC 时间戳证据缺口',
          en2: 'Portal local time only — acknowledge as a known, honest gap.', cn2: '仅有 portal 本地时间 —— 作为已知诚实缺口确认。' },
        { id: 'it', hard: false, cleared: state.itAck, gap: true,
          en: 'IT authority path metadata', cn: 'IT 机构路径元数据',
          en2: 'Country reviewer must confirm the route — counts as a known gap.', cn2: '需国家审核人确认路径 —— 计为已知缺口。' }
      ];
    }
    function renderValidation() {
      if (!list) return;
      var items = blockers();
      list.innerHTML = items.map(function (b) {
        var cls = b.cleared ? 'info' : (b.hard ? 'danger' : 'warning');
        var tag = b.cleared ? (getLang() === 'cn' ? '已清除' : 'cleared') : (b.hard ? (getLang() === 'cn' ? '阻断' : 'blocker') : (getLang() === 'cn' ? '已知缺口' : 'known gap'));
        var action = (!b.cleared && b.gap) ? '<button class="btn" type="button" data-ack="' + b.id + '" style="margin-top:8px;align-self:flex-start">' + (getLang() === 'cn' ? '确认缺口' : 'Acknowledge gap') + '</button>' : '';
        return '<div class="callout ' + cls + ' compact" style="margin-bottom:8px"><strong>' + tag + ' · ' + (getLang() === 'cn' ? b.cn : b.en) + '</strong><span>' + (getLang() === 'cn' ? b.cn2 : b.en2) + '</span>' + action + '</div>';
      }).join('');
      list.querySelectorAll('[data-ack]').forEach(function (btn) {
        btn.addEventListener('click', function () {
          var id = btn.getAttribute('data-ack');
          if (id === 'utc') state.utcAck = true; if (id === 'it') state.itAck = true;
          save(); renderValidation(); updateCount();
          toast(t({ en: 'Gap acknowledged and retained in audit.', cn: '缺口已确认并保留在审计中。' }));
        });
      });
      var ready = document.querySelector('[data-sharetable-ready]');
      var openHard = items.some(function (b) { return b.hard && !b.cleared; });
      if (ready) setPill(ready, openHard ? 'danger' : 'ok', openHard ? (getLang() === 'cn' ? '校验待决' : 'validation_pending') : (getLang() === 'cn' ? '校验通过' : 'validation_pass'));
    }
    function updateCount() {
      var open = blockers().filter(function (b) { return !b.cleared; }).length;
      document.querySelectorAll('[data-validation-count]').forEach(function (el) {
        setPill(el, open ? 'danger' : 'ok', open + (getLang() === 'cn' ? ' 项未决' : (open === 1 ? ' open' : ' open')));
      });
    }

    var prepare = document.querySelector('[data-prepare-package]');
    if (prepare) prepare.addEventListener('click', function () {
      if (state.endorsement !== 'endorsed') {
        var block = prepare.closest('[data-action-block]') || prepare;
        block.classList.remove('guard-shake'); void block.offsetWidth; block.classList.add('guard-shake');
        toast(t(GUARD_MSG.endorsement), 'danger');
        return;
      }
      setState({ packagePrepared: true });
      pushAudit('Reporting package prepared — payload validated', '报送包已准备 —— payload 已校验', 'L. Martin');
      prepare.classList.add('is-armed');
      toast(t({ en: 'Reporting package prepared — Evidence & Receipt unlocked.', cn: '报送包已准备 —— Evidence & Receipt 已解锁。' }), 'ok');
    });

    document.addEventListener('staterender', function () {
      renderValidation(); updateCount();
      document.querySelectorAll('[data-prepare-package]').forEach(function (el) {
        el.disabled = state.endorsement !== 'endorsed' || state.packagePrepared;
        if (state.packagePrepared) el.textContent = getLang() === 'cn' ? '报送包已准备 ✓' : 'Package prepared ✓';
      });
      document.querySelectorAll('[data-guard-reason]').forEach(function (el) {
        if (state.packagePrepared) { el.className = 'guard-reason cleared'; el.textContent = t({ en: 'Cleared: reporting package prepared.', cn: '已清除：报送包已准备。' }); }
        else if (state.endorsement === 'endorsed') { el.className = 'guard-reason'; el.textContent = t({ en: 'Ready: validation passed — prepare the package.', cn: '就绪：校验通过 —— 准备报送包。' }); }
        else { el.className = 'guard-reason blocked'; el.textContent = t({ en: 'Guard: reviewer_endorsement is required.', cn: '守卫：需要 reviewer_endorsement。' }); }
      });
      var cg = document.querySelector('[data-case-guard]');
      if (cg) cg.style.display = state.endorsement === 'endorsed' ? 'none' : '';
    });

    document.querySelectorAll('[data-add-product]').forEach(function (b) {
      b.addEventListener('click', function () { toast(t({ en: 'AffectedProductVersion rows confirmed (unique key validated).', cn: 'AffectedProductVersion 行已确认（唯一键已校验）。' }), 'ok'); });
    });
  }

  /* ---------- P04 Evidence & Receipt ---------- */
  function wireP04() {
    var gen = document.querySelector('[data-generate-snapshot]');
    var att = document.querySelector('[data-attach-receipt]');
    if (!gen && !att) return;

    function syncP04() {
      var snapEmpty = document.querySelector('[data-snapshot-empty]');
      var snapCard = document.querySelector('[data-snapshot-card]');
      if (snapEmpty) snapEmpty.hidden = state.snapshot;
      if (snapCard) { snapCard.hidden = !state.snapshot; if (state.snapshot) snapCard.classList.add('sealed'); }
      if (gen) { gen.disabled = !state.packagePrepared || state.snapshot; if (state.snapshot) gen.textContent = getLang() === 'cn' ? '快照已封存 ✓' : 'Snapshot sealed ✓'; }

      var rcptEmpty = document.querySelector('[data-receipt-empty]');
      var rcptCard = document.querySelector('[data-receipt-card]');
      if (rcptEmpty) rcptEmpty.hidden = state.receipt;
      if (rcptCard) rcptCard.hidden = !state.receipt;
      if (att) att.disabled = !state.snapshot || state.receipt;
      if (att && state.receipt) att.textContent = getLang() === 'cn' ? '回执已附加 ✓' : 'Receipt attached ✓';

      var pend = document.querySelector('[data-dashboard-pending]');
      var succ = document.querySelector('[data-dashboard-success]');
      if (pend) pend.hidden = state.receipt;
      if (succ) succ.hidden = !state.receipt;

      document.querySelectorAll('[data-snapshot-guard]').forEach(function (el) {
        if (state.snapshot) { el.className = 'guard-reason cleared'; el.textContent = t({ en: 'Cleared: immutable snapshot sealed.', cn: '已清除：不可变快照已封存。' }); }
        else if (state.packagePrepared) { el.className = 'guard-reason'; el.textContent = t({ en: 'Ready: ShareTable validation passed.', cn: '就绪：ShareTable 校验通过。' }); }
        else { el.className = 'guard-reason blocked'; el.textContent = t({ en: 'Guard: prepare the reporting package on P02 first.', cn: '守卫：先在 P02 准备报送包。' }); }
      });
      document.querySelectorAll('[data-receipt-guard]').forEach(function (el) {
        if (state.receipt) { el.className = 'guard-reason cleared'; el.textContent = t({ en: 'Cleared: receipt evidence attached (registration only).', cn: '已清除：回执证据已附加（仅登记）。' }); }
        else if (state.snapshot) { el.className = 'guard-reason'; el.textContent = t({ en: 'Ready: snapshot sealed — attach receipt evidence.', cn: '就绪：快照已封存 —— 附加回执证据。' }); }
        else { el.className = 'guard-reason blocked'; el.textContent = t({ en: 'Guard: submitted_payload_snapshot must be generated first.', cn: '守卫：必须先生成 submitted_payload_snapshot。' }); }
      });

      var rev = document.querySelector('[data-receipt-events]');
      if (rev) {
        var events = [];
        if (state.snapshot) events.push({ t: '2026-09-01 16:42Z', en: 'submitted_payload_snapshot SNAP-20260901-001 sealed', cn: '已封存 submitted_payload_snapshot SNAP-20260901-001' });
        if (state.receipt) events.push({ t: '2026-09-01 16:50 (local)', en: 'PortalReceiptEvidence — received_registered (NOT acceptance)', cn: 'PortalReceiptEvidence —— received_registered（非接受）' });
        rev.innerHTML = events.map(function (e) { return '<div class="event is-new"><time>' + e.t + '</time><div><h3>' + (getLang() === 'cn' ? e.cn : e.en) + '</h3></div></div>'; }).join('');
      }
    }

    if (gen) gen.addEventListener('click', function () {
      if (!state.packagePrepared) {
        var block = gen.closest('[data-action-block]') || gen;
        block.classList.remove('guard-shake'); void block.offsetWidth; block.classList.add('guard-shake');
        toast(t(GUARD_MSG.package), 'danger'); return;
      }
      setState({ snapshot: true });
      pushAudit('submitted_payload_snapshot sealed (immutable)', '已封存 submitted_payload_snapshot（不可变）', 'system');
      syncP04(); toast(t({ en: 'Immutable snapshot sealed.', cn: '不可变快照已封存。' }), 'ok');
    });
    if (att) att.addEventListener('click', function () {
      if (!state.snapshot) {
        var block = att.closest('[data-action-block]') || att;
        block.classList.remove('guard-shake'); void block.offsetWidth; block.classList.add('guard-shake');
        toast(t({ en: 'Generate the snapshot first.', cn: '先生成快照。' }), 'danger'); return;
      }
      setState({ receipt: true });
      pushAudit('PortalReceiptEvidence attached — received_registered', 'PortalReceiptEvidence 已附加 —— received_registered', 'J. Novak');
      syncP04(); toast(t({ en: 'Receipt attached — proves registration only, not acceptance.', cn: '回执已附加 —— 仅证明登记，非接受。' }), 'warn');
    });

    document.addEventListener('staterender', syncP04);
    document.addEventListener('langchange', syncP04);
  }

  /* ---------- P05 Dashboard ---------- */
  function wireP05() {
    var cards = document.querySelectorAll('[data-drill]');
    var panel = document.querySelector('[data-drill-panel]');
    if (!panel && !cards.length) return;

    var DRILL = {
      decision: { title: { en: 'Decision coverage', cn: '判断覆盖' }, copy: { en: 'Reviewer endorsement and rule-trace coverage. not_reportable decisions are retained for audit, never deleted.', cn: '审核背书与规则追踪覆盖。not_reportable 判断保留审计，不删除。' },
        items: [['info', { en: 'rule_trace present', cn: 'rule_trace 存在' }, { en: 'Every outcome carries an explainable lane→outcome snapshot.', cn: '每个 outcome 都带可解释的 lane→outcome 快照。' }], ['warning', { en: 'endorsement pending', cn: '背书待定' }, { en: 'Coverage rises once the reviewer endorses DEC-001.', cn: '审核人背书 DEC-001 后覆盖率上升。' }]] },
      evidence: { title: { en: 'Evidence gaps', cn: '证据缺口' }, copy: { en: 'Open gaps are kept explicit rather than hidden behind a vanity score.', cn: '开放缺口显式保留，而非藏在虚荣分数后面。' },
        items: [['warning', { en: 'L1 reliability', cn: 'L1 可靠性' }, { en: 'Source limitation remains visible in the decision audit.', cn: '来源限制在判断审计中保持可见。' }], ['warning', { en: 'UTC receipt timestamp', cn: 'UTC 回执时间戳' }, { en: 'Local portal time does not prove UTC receipt time.', cn: 'portal 本地时间不能证明 UTC 回执时间。' }], ['danger', { en: 'IT authority path', cn: 'IT 机构路径' }, { en: 'Metadata incomplete until the country reviewer confirms the route.', cn: '国家审核人确认路径前元数据不完整。' }]] },
      country: { title: { en: 'Country routing gaps', cn: '国家路径缺口' }, copy: { en: 'No official SRP integration is claimed; each route keeps an explicit rehearsal status.', cn: '不宣称官方 SRP 集成；每条路径保留明确演练状态。' },
        items: [['info', { en: 'FR portal rehearsal', cn: 'FR portal 演练' }, { en: 'ANSSI / Club-SSI style request reference, ready.', cn: 'ANSSI / Club-SSI 风格请求引用，ready。' }], ['warning', { en: 'DE testing-only', cn: 'DE 仅测试' }, { en: 'BSI test channel; no production integration claim.', cn: 'BSI 测试通道；不宣称生产集成。' }], ['danger', { en: 'IT metadata gap', cn: 'IT 元数据缺口' }, { en: 'Authority path owner missing.', cn: '机构路径负责人缺失。' }]] },
      sla: { title: { en: 'SLA risk', cn: 'SLA 风险' }, copy: { en: 'T0 anchors to significant_qualification_date / decided_at. Case creation and portal receipt never reset the clock.', cn: 'T0 锚定 significant_qualification_date / decided_at。Case 创建与 portal 回执不重置时钟。' },
        items: [['danger', { en: 'T0 honesty retained', cn: '保留 T0 诚实性' }, { en: '24h / 72h / Final measured from awareness, not Case creation.', cn: '24h / 72h / Final 从知晓时刻计，而非 Case 创建。' }], ['warning', { en: 'timestamp evidence gap', cn: '时间戳证据缺口' }, { en: 'Counted explicitly in the SLA Honesty panel.', cn: '在 SLA Honesty 盘中显式计入。' }]] }
    };
    function showDrill(key) {
      var d = DRILL[key]; if (!d || !panel) return;
      cards.forEach(function (c) { c.classList.toggle('active', c.getAttribute('data-drill') === key); });
      var titleEl = panel.querySelector('[data-drill-title]'); if (titleEl) titleEl.textContent = t(d.title);
      var copyEl = panel.querySelector('[data-drill-copy]'); if (copyEl) copyEl.textContent = t(d.copy);
      var listEl = panel.querySelector('[data-drill-list]');
      if (listEl) {
        listEl.classList.remove('drill-list'); void listEl.offsetWidth; listEl.classList.add('drill-list');
        listEl.innerHTML = d.items.map(function (it) {
          return '<div class="callout ' + it[0] + ' compact"><strong>' + (getLang() === 'cn' ? it[1].cn : it[1].en) + '</strong><span>' + (getLang() === 'cn' ? it[2].cn : it[2].en) + '</span></div>';
        }).join('');
      }
    }
    cards.forEach(function (c) { c.addEventListener('click', function () { showDrill(c.getAttribute('data-drill')); }); });
    if (panel) showDrill(panel.getAttribute('data-default-drill') || 'evidence');
    document.addEventListener('langchange', function () {
      var active = document.querySelector('[data-drill].active');
      showDrill(active ? active.getAttribute('data-drill') : (panel && panel.getAttribute('data-default-drill')) || 'evidence');
    });

    /* dashboard reflects live workflow state */
    document.addEventListener('staterender', function () {
      var dec = document.querySelector('[data-readiness-score]');
      if (dec) dec.textContent = state.endorsement === 'endorsed' ? '78%' : '42%';
      var ev = document.querySelector('[data-evidence-score]');
      if (ev) ev.textContent = state.receipt ? '74%' : '61%';
    });
  }

  /* ---------- P06 Observer ---------- */
  function wireP06() {
    var steps = document.querySelectorAll('[data-observer-step]');
    if (!steps.length && !document.querySelector('.redacted')) return;

    var STEP = {
      see: { title: { en: 'What observer can see', cn: '观察者可见' }, pill: 'disclosed', cls: 'info', copy: { en: 'Decision rationale, proof-lane outcomes, evidence counts, readiness state, receipt semantics, and explicit known gaps.', cn: '判断理由、proof-lane 结果、证据数量、准备度、回执语义和明确已知缺口。' } },
      redacted: { title: { en: 'What is redacted', cn: '被脱敏内容' }, pill: 'server-side', cls: 'redact', copy: { en: 'Customer names, PoC, raw attachments, private notes, internal contacts, and SCM detail are omitted at the serializer — never client-masked.', cn: '客户名、PoC、原始附件、私密备注、内部联系人和 SCM 细节在序列化层省略 —— 绝非前端遮罩。' } },
      limit: { title: { en: 'What cannot be claimed', cn: '不可声称内容' }, pill: 'limitation', cls: 'danger', copy: { en: 'received_registered proves registration only. Legal acceptance, payload completeness, and precise UTC time are NOT claimed.', cn: 'received_registered 仅证明登记。不声称法律接受、payload 完整性或精确 UTC 时间。' } },
      replay: { title: { en: 'Replay internal workflow', cn: '回放内部工作流' }, pill: 'safe replay', cls: 'info', copy: { en: 'The P00→P06 journey can be replayed for regulators using only observer-safe fields.', cn: '可仅用观察者安全字段为监管者回放 P00→P06 旅程。' } },
      export: { title: { en: 'Inspect export package', cn: '检查导出包' }, pill: 'regulator-safe', cls: 'ok', copy: { en: 'The regulator-safe package includes rationale and aggregates; it excludes all sensitive operational material.', cn: '监管安全包包含理由与聚合；排除所有敏感运行材料。' } }
    };
    function showStep(key) {
      var d = STEP[key]; if (!d) return;
      steps.forEach(function (s) { s.classList.toggle('active', s.getAttribute('data-observer-step') === key); });
      var ti = document.querySelector('[data-observer-detail-title]'); if (ti) ti.textContent = t(d.title);
      var pl = document.querySelector('[data-observer-detail-pill]'); if (pl) setPill(pl, d.cls, d.pill);
      var co = document.querySelector('[data-observer-detail-copy]'); if (co) co.textContent = t(d.copy);
      if (key === 'redacted') revealAll(); else hideAll();
    }
    steps.forEach(function (s) { s.addEventListener('click', function () { showStep(s.getAttribute('data-observer-step')); }); });

    /* redaction reveal — decrypt sweep on hover/click */
    var redacts = document.querySelectorAll('.redacted[data-reveal]');
    function revealAll() { redacts.forEach(function (r) { doReveal(r); }); }
    function hideAll() { redacts.forEach(function (r) { r.classList.remove('revealed'); r.removeAttribute('style'); }); }
    function doReveal(r) {
      if (r.classList.contains('revealed')) return;
      r.classList.add('revealing');
      setTimeout(function () {
        r.classList.add('revealed'); r.classList.remove('revealing');
        var v = r.getAttribute('data-reveal'); if (v) { r.style.setProperty('--none', '0'); r.textContent = v; }
      }, 240);
    }
    redacts.forEach(function (r) {
      r.addEventListener('click', function () {
        if (r.classList.contains('revealed')) { r.classList.remove('revealed'); r.textContent = ''; }
        else doReveal(r);
      });
    });

    /* export rows */
    var EXP = {
      'included-decision': { en: 'Included evidence summary', cn: '包含的证据摘要', body: { en: 'decision_rationale, proof_lane_states, evidence_count — safe to disclose.', cn: 'decision_rationale、proof_lane_states、evidence_count —— 可安全披露。' } },
      'included-readiness': { en: 'Included readiness aggregates', cn: '包含的准备度聚合', body: { en: 'affected_product_aggregation, readiness_state, receipt_semantics — no customer attribution.', cn: 'affected_product_aggregation、readiness_state、receipt_semantics —— 无客户归属。' } },
      'excluded-sensitive': { en: 'Excluded sensitive fields', cn: '排除的敏感字段', body: { en: 'customer names, raw attachments, PoC, private notes — omitted at serializer.', cn: '客户名、原始附件、PoC、私密备注 —— 在序列化层省略。' } },
      'excluded-internal': { en: 'Excluded internal material', cn: '排除的内部材料', body: { en: 'internal contacts, SCM detail, raw exploit material — never exported.', cn: '内部联系人、SCM 细节、原始利用材料 —— 绝不导出。' } }
    };
    document.querySelectorAll('[data-export-item]').forEach(function (b) {
      b.addEventListener('click', function () {
        document.querySelectorAll('[data-export-item]').forEach(function (x) { x.classList.toggle('active', x === b); });
        var d = EXP[b.getAttribute('data-export-item')]; if (!d) return;
        var ti = document.querySelector('[data-export-detail-title]'); if (ti) ti.textContent = t({ en: d.en, cn: d.cn });
        var co = document.querySelector('[data-export-detail-copy]'); if (co) co.textContent = t(d.body);
      });
    });

    if (steps.length) showStep('see');
    document.addEventListener('langchange', function () {
      var active = document.querySelector('[data-observer-step].active');
      if (active) showStep(active.getAttribute('data-observer-step'));
    });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();

  /* expose for inline use if needed */
  window.SRP = { toast: toast, state: function () { return state; }, reset: resetState };
})();
