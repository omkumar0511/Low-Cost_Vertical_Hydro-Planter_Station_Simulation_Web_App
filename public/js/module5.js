/**
 * ============================================================================
 * MODULE 5: PROJECT MANAGEMENT SIMULATOR (CPM, GANTT, MONTE CARLO, COSTS, RISKS)
 * ============================================================================
 * Implements professional Project Management methodologies:
 *   - Critical Path Method (CPM): Forward/backward pass, Early/Late schedules, Slack.
 *   - Custom Canvas Gantt Chart with critical path highlighting.
 *   - 1,000-run Monte Carlo Simulation with Triangular distribution sampling.
 *   - Parametric Budget & Itemized Cost Scaler (< Rs. 250 for 20 bottles).
 *   - ISO 31000 5x5 Probability vs Impact Risk Heatmap with active mitigations.
 * ============================================================================
 */

(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory(require('./model'), require('./charts'), require('./storage'));
  } else {
    root.Module5ProjectManagement = factory(root.PlanterModel, root.PlanterCharts, root.PlanterStorage);
  }
})(typeof self !== 'undefined' ? self : this, function (Model, Charts, Storage) {
  'use strict';

  let dom = {};
  let currentActivities = JSON.parse(JSON.stringify(Model.BASELINE_ACTIVITIES));
  let currentRisks = JSON.parse(JSON.stringify(Model.BASELINE_RISKS));
  let currentCpm = null;
  let currentMonteCarlo = null;

  function init() {
    cacheDom();
    bindEvents();
    renderAllSubmodules();
  }

  function cacheDom() {
    dom = {
      // Sub-tabs within Module 5
      subtabs: document.querySelectorAll('.m5-subtab-btn'),
      subtabPanes: document.querySelectorAll('.m5-pane'),

      // CPM & Gantt
      taskTableBody: document.getElementById('m5-task-table-body'),
      canvasGantt: document.getElementById('m5-canvas-gantt'),
      cpmDuration: document.getElementById('m5-cpm-duration'),
      cpmPath: document.getElementById('m5-cpm-path'),
      btnRecalculateCpm: document.getElementById('m5-btn-recalc-cpm'),
      btnResetTasks: document.getElementById('m5-btn-reset-tasks'),

      // Monte Carlo
      canvasHistogram: document.getElementById('m5-canvas-histogram'),
      targetDeadline: document.getElementById('m5-target-deadline'),
      targetDeadlineVal: document.getElementById('m5-target-deadline-val'),
      mcIterations: document.getElementById('m5-mc-iterations'),
      btnRunMonteCarlo: document.getElementById('m5-btn-run-mc'),
      mcMean: document.getElementById('m5-mc-mean'),
      mcMedian: document.getElementById('m5-mc-median'),
      mcStdDev: document.getElementById('m5-mc-stddev'),
      mcP90: document.getElementById('m5-mc-p90'),
      mcProbability: document.getElementById('m5-mc-prob'),

      // Costing
      costBottleCount: document.getElementById('m5-cost-bottle-count'),
      costBottleCountVal: document.getElementById('m5-cost-bottle-count-val'),
      costIncPaint: document.getElementById('m5-cost-inc-paint'),
      costPaintPrice: document.getElementById('m5-cost-paint-price'),
      costIncHooks: document.getElementById('m5-cost-inc-hooks'),
      costHooksPrice: document.getElementById('m5-cost-hooks-price'),
      costTableBody: document.getElementById('m5-cost-table-body'),
      costTotal: document.getElementById('m5-cost-total'),
      costPerBottle: document.getElementById('m5-cost-per-bottle'),
      costSaved: document.getElementById('m5-cost-saved'),

      // Risk Matrix
      canvasRiskMatrix: document.getElementById('m5-canvas-risk-matrix'),
      riskTableBody: document.getElementById('m5-risk-table-body'),
      riskVerdictBadge: document.getElementById('m5-risk-verdict-badge')
    };
  }

  function bindEvents() {
    // Internal sub-tab switching
    if (dom.subtabs) {
      dom.subtabs.forEach(tab => {
        tab.addEventListener('click', () => {
          const target = tab.getAttribute('data-pane');
          dom.subtabs.forEach(t => t.classList.remove('active'));
          dom.subtabPanes.forEach(p => p.classList.remove('active'));
          tab.classList.add('active');
          const activePane = document.getElementById(target);
          if (activePane) activePane.classList.add('active');

          // Trigger redraw of canvases on view once DOM updates
          requestAnimationFrame(() => {
            if (target === 'm5-pane-gantt') renderGantt();
            if (target === 'm5-pane-montecarlo') renderHistogram();
            if (target === 'm5-pane-risks') renderRiskCanvas();
          });
        });
      });
    }

    if (dom.btnRecalculateCpm) dom.btnRecalculateCpm.addEventListener('click', updateCpmSchedule);
    if (dom.btnResetTasks) dom.btnResetTasks.addEventListener('click', resetTasksToDefault);

    if (dom.targetDeadline) {
      dom.targetDeadline.addEventListener('input', () => {
        if (dom.targetDeadlineVal) dom.targetDeadlineVal.textContent = `${dom.targetDeadline.value} days`;
        runMonteCarlo();
      });
    }
    if (dom.btnRunMonteCarlo) dom.btnRunMonteCarlo.addEventListener('click', runMonteCarlo);

    // Costing inputs
    if (dom.costBottleCount) {
      dom.costBottleCount.addEventListener('input', () => {
        if (dom.costBottleCountVal) dom.costBottleCountVal.textContent = dom.costBottleCount.value;
        renderCosting();
      });
    }
    if (dom.costIncPaint) dom.costIncPaint.addEventListener('change', renderCosting);
    if (dom.costPaintPrice) dom.costPaintPrice.addEventListener('input', renderCosting);
    if (dom.costIncHooks) dom.costIncHooks.addEventListener('change', renderCosting);
    if (dom.costHooksPrice) dom.costHooksPrice.addEventListener('input', renderCosting);
  }

  function renderAllSubmodules() {
    updateCpmSchedule();
    renderTaskTable();
    runMonteCarlo();
    renderCosting();
    renderRiskTable();
  }

  // ==========================================================================
  // 1. CPM & GANTT CHART
  // ==========================================================================
  function renderTaskTable() {
    if (!dom.taskTableBody) return;
    dom.taskTableBody.innerHTML = currentActivities.map((act, idx) => `
      <tr>
        <td><strong>${act.id}</strong></td>
        <td>${act.name}</td>
        <td>
          <input type="number" min="1" max="30" value="${act.duration}" class="form-control form-control-sm m5-dur-input" data-idx="${idx}" style="width: 70px;">
        </td>
        <td>
          <input type="text" value="${act.predecessors.join(',')}" class="form-control form-control-sm m5-pred-input" data-idx="${idx}" style="width: 90px;">
        </td>
        <td><small class="text-muted">${act.assignedTo}</small></td>
        <td><span class="badge ${act.isCritical ? 'badge-danger' : 'badge-success'}">${act.isCritical ? 'CRITICAL (Slack: 0)' : `Slack: ${act.slack !== undefined ? act.slack : 0}d`}</span></td>
      </tr>
    `).join('');

    // Bind inputs
    const durInputs = dom.taskTableBody.querySelectorAll('.m5-dur-input');
    durInputs.forEach(input => {
      input.addEventListener('change', (e) => {
        const idx = parseInt(e.target.getAttribute('data-idx'), 10);
        const val = parseFloat(e.target.value) || 1;
        currentActivities[idx].duration = val;
        currentActivities[idx].optimistic = Math.max(1, Math.round(val * 0.7));
        currentActivities[idx].pessimistic = Math.round(val * 1.5);
        updateCpmSchedule();
      });
    });

    const predInputs = dom.taskTableBody.querySelectorAll('.m5-pred-input');
    predInputs.forEach(input => {
      input.addEventListener('change', (e) => {
        const idx = parseInt(e.target.getAttribute('data-idx'), 10);
        const raw = e.target.value.trim();
        currentActivities[idx].predecessors = raw ? raw.split(',').map(s => s.trim()) : [];
        updateCpmSchedule();
      });
    });
  }

  function updateCpmSchedule() {
    currentCpm = Model.calculateCriticalPathMethod(currentActivities);

    // Sync back computed critical status and slack
    currentCpm.activities.forEach(calcAct => {
      const match = currentActivities.find(a => a.id === calcAct.id);
      if (match) {
        match.ES = calcAct.ES;
        match.EF = calcAct.EF;
        match.LS = calcAct.LS;
        match.LF = calcAct.LF;
        match.slack = calcAct.slack;
        match.isCritical = calcAct.isCritical;
      }
    });

    if (dom.cpmDuration) dom.cpmDuration.textContent = `${currentCpm.projectDuration} Days`;
    if (dom.cpmPath) dom.cpmPath.textContent = currentCpm.criticalPathString || 'None';

    // Update table badges directly in existing DOM rows without disrupting inputs
    if (dom.taskTableBody) {
      const rows = dom.taskTableBody.querySelectorAll('tr');
      currentActivities.forEach((act, idx) => {
        if (rows[idx]) {
          const badgeCell = rows[idx].querySelector('td:last-child');
          if (badgeCell) {
            badgeCell.innerHTML = `<span class="badge ${act.isCritical ? 'badge-danger' : 'badge-success'}">${act.isCritical ? 'CRITICAL (Slack: 0)' : `Slack: ${act.slack !== undefined ? act.slack : 0}d`}</span>`;
          }
        }
      });
    }

    renderGantt();
  }

  function renderGantt() {
    if (!dom.canvasGantt || !currentCpm) return;
    Charts.drawGanttChart(dom.canvasGantt, {
      activities: currentCpm.activities,
      totalDuration: currentCpm.projectDuration,
      title: 'Critical Path & Gantt Schedule'
    });
  }

  function resetTasksToDefault() {
    currentActivities = JSON.parse(JSON.stringify(Model.BASELINE_ACTIVITIES));
    renderTaskTable();
    updateCpmSchedule();
    runMonteCarlo();
  }

  // ==========================================================================
  // 2. MONTE CARLO SIMULATION
  // ==========================================================================
  function runMonteCarlo() {
    const deadline = parseFloat(dom.targetDeadline?.value) || 18;
    const iters = parseInt(dom.mcIterations?.value, 10) || 1000;

    currentMonteCarlo = Model.runMonteCarloSimulation(currentActivities, iters, deadline);

    if (dom.mcMean) dom.mcMean.textContent = `${currentMonteCarlo.mean} days`;
    if (dom.mcMedian) dom.mcMedian.textContent = `${currentMonteCarlo.median} days`;
    if (dom.mcStdDev) dom.mcStdDev.textContent = `±${currentMonteCarlo.stdDev} days`;
    if (dom.mcP90) dom.mcP90.textContent = `${currentMonteCarlo.percentiles.p90} days`;

    if (dom.mcProbability) {
      dom.mcProbability.textContent = `${currentMonteCarlo.probWithinDeadline}%`;
      dom.mcProbability.className = `metric-value ${currentMonteCarlo.probWithinDeadline >= 85 ? 'text-success' : (currentMonteCarlo.probWithinDeadline >= 65 ? 'text-warning' : 'text-danger')}`;
    }

    renderHistogram();
  }

  function renderHistogram() {
    if (!dom.canvasHistogram || !currentMonteCarlo) return;
    const deadline = parseFloat(dom.targetDeadline?.value) || 18;

    Charts.drawHistogram(dom.canvasHistogram, {
      bins: currentMonteCarlo.bins,
      mean: currentMonteCarlo.mean,
      targetDeadlineDays: deadline,
      probWithinDeadline: currentMonteCarlo.probWithinDeadline,
      title: `Monte Carlo Probability Density (${currentMonteCarlo.iterations} Triangular Runs)`
    });
  }

  // ==========================================================================
  // 3. BUDGET & COST ESTIMATION
  // ==========================================================================
  function renderCosting() {
    const bottleCount = parseInt(dom.costBottleCount?.value, 10) || 20;
    const incPaint = dom.costIncPaint?.checked ?? true;
    const paintPrice = parseFloat(dom.costPaintPrice?.value) || 80;
    const incHooks = dom.costIncHooks?.checked ?? true;
    const hooksPrice = parseFloat(dom.costHooksPrice?.value) || 40;

    const costing = Model.calculateStationCost({
      bottleCount,
      includeBlackPaint: incPaint,
      paintCostRs: paintPrice,
      includeWallHooks: incHooks,
      hooksCostRs: hooksPrice
    });

    if (dom.costTableBody) {
      dom.costTableBody.innerHTML = costing.breakdown.map(item => `
        <tr>
          <td><strong>${item.item}</strong></td>
          <td>${item.qty}</td>
          <td>${item.unitCost}</td>
          <td><strong>Rs. ${item.total}</strong></td>
        </tr>
      `).join('');
    }

    if (dom.costTotal) dom.costTotal.textContent = `Rs. ${costing.totalCost}`;
    if (dom.costPerBottle) dom.costPerBottle.textContent = `Rs. ${costing.costPerBottle} / planter`;
    if (dom.costSaved) {
      dom.costSaved.textContent = `Rs. ${costing.capitalSavedRs} (${costing.percentCostSaved}% saved vs commercial pots)`;
    }
  }

  // ==========================================================================
  // 4. RISK MATRIX & MITIGATION SCORING
  // ==========================================================================
  function renderRiskTable() {
    if (!dom.riskTableBody) return;
    const evaluated = Model.evaluateRiskMatrix(currentRisks);

    dom.riskTableBody.innerHTML = evaluated.risks.map((risk, idx) => `
      <tr>
        <td><strong>${risk.id}</strong></td>
        <td>
          <strong>${risk.name}</strong><br>
          <small class="text-muted">${risk.category}</small>
        </td>
        <td>
          <span class="badge ${risk.initialSeverity.rank >= 3 ? 'badge-danger' : 'badge-warning'}">
            P:${risk.probInitial} × I:${risk.impactInitial} = ${risk.initialScore}
          </span>
        </td>
        <td>
          <div class="custom-control custom-checkbox">
            <input type="checkbox" class="custom-control-input m5-risk-toggle" id="risk-mitig-${idx}" data-idx="${idx}" ${risk.applied ? 'checked' : ''}>
            <label class="custom-control-label" for="risk-mitig-${idx}">
              <small>${risk.mitigation}</small>
            </label>
          </div>
        </td>
        <td>
          <span class="badge" style="background-color: ${risk.severity.color}; color: #000; font-weight: bold;">
            ${risk.activeP} × ${risk.activeI} = ${risk.score} (${risk.severity.level})
          </span>
        </td>
      </tr>
    `).join('');

    // Bind checkboxes
    const toggles = dom.riskTableBody.querySelectorAll('.m5-risk-toggle');
    toggles.forEach(tog => {
      tog.addEventListener('change', (e) => {
        const idx = parseInt(e.target.getAttribute('data-idx'), 10);
        currentRisks[idx].applied = e.target.checked;
        renderRiskTable();
        renderRiskCanvas();
      });
    });

    if (dom.riskVerdictBadge) {
      dom.riskVerdictBadge.textContent = evaluated.overallRiskVerdict;
      dom.riskVerdictBadge.className = `badge ${evaluated.highCriticalCount === 0 ? 'badge-success' : 'badge-danger'}`;
    }

    renderRiskCanvas();
  }

  function renderRiskCanvas() {
    if (!dom.canvasRiskMatrix) return;
    const evaluated = Model.evaluateRiskMatrix(currentRisks);
    Charts.drawRiskMatrix5x5(dom.canvasRiskMatrix, evaluated.risks);
  }

  function renderActiveView() {
    const activeSubtab = document.querySelector('.m5-subtab-btn.active');
    const target = activeSubtab ? activeSubtab.getAttribute('data-pane') : 'm5-pane-gantt';
    if (target === 'm5-pane-gantt') renderGantt();
    else if (target === 'm5-pane-montecarlo') renderHistogram();
    else if (target === 'm5-pane-risks') renderRiskCanvas();
  }

  return {
    init,
    updateCpmSchedule,
    runMonteCarlo,
    renderCosting,
    renderRiskTable,
    renderActiveView,
    renderGantt,
    renderHistogram,
    renderRiskCanvas
  };
});
