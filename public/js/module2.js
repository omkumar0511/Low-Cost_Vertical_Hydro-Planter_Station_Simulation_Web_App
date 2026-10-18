/**
 * ============================================================================
 * MODULE 2: WATER EFFICIENCY COMPARISON SIMULATOR
 * ============================================================================
 * Evaluates the report's claim: "Drip irrigation is up to 70% more
 * water-efficient than surface watering."
 *
 * Side-by-side comparative simulation:
 *   - Traditional Surface Watering (high evaporation, runoff, splash losses)
 *   - Inverted Bottle Drip Feeder (subsurface root-targeted delivery)
 *   - Source water toggle (potable tap water vs RO plant reject / canteen waste)
 *   - Editable loss coefficients for sensitivity analysis
 * ============================================================================
 */

(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory(require('./model'), require('./charts'), require('./storage'));
  } else {
    root.Module2WaterComparison = factory(root.PlanterModel, root.PlanterCharts, root.PlanterStorage);
  }
})(typeof self !== 'undefined' ? self : this, function (Model, Charts, Storage) {
  'use strict';

  let dom = {};
  let currentResults = null;

  function init() {
    cacheDom();
    bindEvents();
    runComparison();
  }

  function cacheDom() {
    dom = {
      // Inputs
      daysSlider: document.getElementById('m2-days'),
      daysVal: document.getElementById('m2-days-val'),
      plantType: document.getElementById('m2-plant-type'),
      waterSource: document.getElementById('m2-water-source'),

      // Surface Loss Sliders
      surfEvap: document.getElementById('m2-surf-evap'),
      surfEvapVal: document.getElementById('m2-surf-evap-val'),
      surfRunoff: document.getElementById('m2-surf-runoff'),
      surfRunoffVal: document.getElementById('m2-surf-runoff-val'),
      surfPerc: document.getElementById('m2-surf-perc'),
      surfPercVal: document.getElementById('m2-surf-perc-val'),

      // Drip Loss Sliders
      dripEvap: document.getElementById('m2-drip-evap'),
      dripEvapVal: document.getElementById('m2-drip-evap-val'),
      dripRunoff: document.getElementById('m2-drip-runoff'),
      dripRunoffVal: document.getElementById('m2-drip-runoff-val'),
      dripPerc: document.getElementById('m2-drip-perc'),
      dripPercVal: document.getElementById('m2-drip-perc-val'),

      // Action Buttons
      btnRecalculate: document.getElementById('m2-btn-recalculate'),
      btnExportCsv: document.getElementById('m2-btn-export-csv'),
      btnSaveRun: document.getElementById('m2-btn-save-run'),

      // Canvases
      canvasLine: document.getElementById('m2-canvas-line'),
      canvasBar: document.getElementById('m2-canvas-bar'),

      // Readouts
      metricSurfaceTotal: document.getElementById('m2-metric-surface-total'),
      metricDripTotal: document.getElementById('m2-metric-drip-total'),
      metricLitresSaved: document.getElementById('m2-metric-litres-saved'),
      metricPercentSaved: document.getElementById('m2-metric-percent-saved'),
      reportClaimBadge: document.getElementById('m2-report-claim-badge'),
      sourceImpactNote: document.getElementById('m2-source-impact-note')
    };
  }

  function bindEvents() {
    const bindSlider = (slider, valEl, suffix = '%') => {
      if (!slider) return;
      slider.addEventListener('input', () => {
        if (valEl) valEl.textContent = `${slider.value}${suffix}`;
        runComparison();
      });
    };

    bindSlider(dom.daysSlider, dom.daysVal, ' days');
    bindSlider(dom.surfEvap, dom.surfEvapVal);
    bindSlider(dom.surfRunoff, dom.surfRunoffVal);
    bindSlider(dom.surfPerc, dom.surfPercVal);
    bindSlider(dom.dripEvap, dom.dripEvapVal);
    bindSlider(dom.dripRunoff, dom.dripRunoffVal);
    bindSlider(dom.dripPerc, dom.dripPercVal);

    if (dom.plantType) dom.plantType.addEventListener('change', runComparison);
    if (dom.waterSource) dom.waterSource.addEventListener('change', runComparison);
    if (dom.btnRecalculate) dom.btnRecalculate.addEventListener('click', runComparison);
    if (dom.btnExportCsv) dom.btnExportCsv.addEventListener('click', exportComparisonCsv);
    if (dom.btnSaveRun) dom.btnSaveRun.addEventListener('click', saveRun);
  }

  function getInputs() {
    return {
      days: parseInt(dom.daysSlider?.value, 10) || 7,
      plantTypeKey: dom.plantType?.value || 'mint',
      waterSource: dom.waterSource?.value || 'ro_reject',
      surfaceEvapLoss: parseFloat(dom.surfEvap?.value) || 35,
      surfaceRunoffLoss: parseFloat(dom.surfRunoff?.value) || 20,
      surfacePercolationLoss: parseFloat(dom.surfPerc?.value) || 15,
      dripEvapLoss: parseFloat(dom.dripEvap?.value) || 4,
      dripRunoffLoss: parseFloat(dom.dripRunoff?.value) || 0,
      dripPercolationLoss: parseFloat(dom.dripPerc?.value) || 6
    };
  }

  function setInputs(p) {
    if (!p) return;
    if (dom.daysSlider && p.days !== undefined) {
      dom.daysSlider.value = p.days;
      if (dom.daysVal) dom.daysVal.textContent = `${p.days} days`;
    }
    if (dom.waterSource && p.waterSource) dom.waterSource.value = p.waterSource;
    if (dom.surfEvap && p.surfaceEvapLoss !== undefined) {
      dom.surfEvap.value = p.surfaceEvapLoss;
      if (dom.surfEvapVal) dom.surfEvapVal.textContent = `${p.surfaceEvapLoss}%`;
    }
    if (dom.surfRunoff && p.surfaceRunoffLoss !== undefined) {
      dom.surfRunoff.value = p.surfaceRunoffLoss;
      if (dom.surfRunoffVal) dom.surfRunoffVal.textContent = `${p.surfaceRunoffLoss}%`;
    }
    if (dom.surfPerc && p.surfacePercolationLoss !== undefined) {
      dom.surfPerc.value = p.surfacePercolationLoss;
      if (dom.surfPercVal) dom.surfPercVal.textContent = `${p.surfacePercolationLoss}%`;
    }
    if (dom.dripEvap && p.dripEvapLoss !== undefined) {
      dom.dripEvap.value = p.dripEvapLoss;
      if (dom.dripEvapVal) dom.dripEvapVal.textContent = `${p.dripEvapLoss}%`;
    }
    if (dom.dripRunoff && p.dripRunoffLoss !== undefined) {
      dom.dripRunoff.value = p.dripRunoffLoss;
      if (dom.dripRunoffVal) dom.dripRunoffVal.textContent = `${p.dripRunoffLoss}%`;
    }
    if (dom.dripPerc && p.dripPercolationLoss !== undefined) {
      dom.dripPerc.value = p.dripPercolationLoss;
      if (dom.dripPercVal) dom.dripPercVal.textContent = `${p.dripPercolationLoss}%`;
    }
    runComparison();
  }

  function runComparison() {
    const inputs = getInputs();
    currentResults = Model.simulateWaterEfficiencyComparison(inputs);

    renderReadouts(currentResults);
    renderCharts(currentResults);
  }

  function renderReadouts(res) {
    if (dom.metricSurfaceTotal) dom.metricSurfaceTotal.textContent = `${res.totalSurfaceL.toFixed(1)} L`;
    if (dom.metricDripTotal) dom.metricDripTotal.textContent = `${res.totalDripL.toFixed(1)} L`;
    if (dom.metricLitresSaved) dom.metricLitresSaved.textContent = `${res.totalSavedL.toFixed(1)} L`;
    if (dom.metricPercentSaved) dom.metricPercentSaved.textContent = `${res.overallPercentSaved}%`;

    // Report Claim Verification Badge
    if (dom.reportClaimBadge) {
      if (res.overallPercentSaved >= 60 && res.overallPercentSaved <= 75) {
        dom.reportClaimBadge.className = 'badge badge-success';
        dom.reportClaimBadge.innerHTML = `✓ Matches Report Claim (${res.overallPercentSaved}% ≈ 70% savings)`;
      } else if (res.overallPercentSaved > 75) {
        dom.reportClaimBadge.className = 'badge badge-info';
        dom.reportClaimBadge.innerHTML = `🌟 Exceeds Baseline Claim (${res.overallPercentSaved}% savings under high loss assumptions)`;
      } else {
        dom.reportClaimBadge.className = 'badge badge-warning';
        dom.reportClaimBadge.innerHTML = `ℹ️ Moderate Savings (${res.overallPercentSaved}% savings; lower than report's 70% maximum)`;
      }
    }

    // Source Water Impact Note
    if (dom.sourceImpactNote) {
      if (res.waterSource === 'ro_reject') {
        dom.sourceImpactNote.innerHTML = `<strong>RO Reject Water Utilized:</strong> ${res.roRejectUtilizedL} L of concentrated RO brine repurposed, saving <strong>${res.potableSavedL} L</strong> of potable tap water from municipal lines.`;
      } else if (res.waterSource === 'canteen_leftover') {
        dom.sourceImpactNote.innerHTML = `<strong>Canteen Graywater Utilized:</strong> ${res.roRejectUtilizedL} L of discarded drinking water repurposed from cafeteria basins.`;
      } else {
        dom.sourceImpactNote.innerHTML = `<strong>Municipal Fresh Water:</strong> Drip saves <strong>${res.totalSavedL} L</strong> directly from fresh tap lines.`;
      }
    }
  }

  function renderCharts(res) {
    // 1. Line Chart: Cumulative Water vs Time (Surface vs Drip)
    if (dom.canvasLine) {
      const surfaceData = res.timeSeries.map(pt => ({ x: pt.day, y: pt.cumSurface }));
      const dripData = res.timeSeries.map(pt => ({ x: pt.day, y: pt.cumDrip }));
      const savedData = res.timeSeries.map(pt => ({ x: pt.day, y: pt.cumSaved }));

      Charts.drawLineChart(dom.canvasLine, {
        title: `Water Use (${getInputs().days}d)`,
        xLabel: 'Time (Days)',
        yLabel: 'Cumulative Water (Litres)',
        yMin: 0,
        series: [
          { name: 'Surface Watering', color: Charts.PALETTE.redDanger, data: surfaceData },
          { name: 'Inverted Drip', color: Charts.PALETTE.waterBlue, data: dripData },
          { name: 'Net Savings', color: Charts.PALETTE.greenPrimary, data: savedData, dash: [4, 4] }
        ]
      });
    }

    // 2. Bar Chart: Breakdown of Water Losses vs Useful Uptake
    if (dom.canvasBar) {
      const b = res.lossBreakdown;
      Charts.drawBarChart(dom.canvasBar, {
        title: 'Water Allocation',
        categories: ['Surface Watering', 'Inverted Drip'],
        groups: [
          { name: 'Useful Root Uptake', color: Charts.PALETTE.greenPrimary, values: [b.surface.useful, b.drip.useful] },
          { name: 'Deep Percolation', color: '#ffb74d', values: [b.surface.percolation, b.drip.percolation] },
          { name: 'Surface Runoff', color: '#ff8a65', values: [b.surface.runoff, b.drip.runoff] },
          { name: 'Evaporation Loss', color: '#e57373', values: [b.surface.evaporation, b.drip.evaporation] }
        ]
      });
    }
  }

  function exportComparisonCsv() {
    if (!currentResults) return;
    const rows = currentResults.timeSeries.map(pt => ({
      day: pt.day,
      surfaceDailyL: Math.round(pt.surfaceDaily * 100) / 100,
      dripDailyL: Math.round(pt.dripDaily * 100) / 100,
      cumSurfaceL: pt.cumSurface,
      cumDripL: pt.cumDrip,
      cumSavedL: pt.cumSaved,
      percentSaved: pt.percentSaved
    }));
    Storage.exportToCsv(`water_comparison_${currentResults.waterSource}_${Date.now()}.csv`, rows);
  }

  function saveRun() {
    if (!currentResults) return;
    const inputs = getInputs();
    Storage.saveRun({
      module: 'module2',
      name: `Water Comparison (${inputs.days}d, ${inputs.waterSource}, ${currentResults.overallPercentSaved}% saved)`,
      parameters: inputs,
      results: {
        totalSurfaceL: currentResults.totalSurfaceL,
        totalDripL: currentResults.totalDripL,
        totalSavedL: currentResults.totalSavedL,
        overallPercentSaved: currentResults.overallPercentSaved
      }
    });
    if (window.PlanterUI && window.PlanterUI.showToast) {
      window.PlanterUI.showToast('Water efficiency comparison run saved!');
    }
  }

  return {
    init,
    runComparison,
    setInputs,
    getInputs,
    exportComparisonCsv,
    saveRun
  };
});
