/**
 * ============================================================================
 * MODULE 4: 7-DAY TESTING & MONITORING SIMULATION
 * ============================================================================
 * Reproduces the micro-project's empirical 7-day (168-hour) testing phase:
 *   - Diurnal sinusoidal temperature and solar irradiance cycles.
 *   - Hourly telemetry logging (bottle volume, soil moisture, health, algae).
 *   - Mid-run human interventions (refill, hole adjustment, black paint, shade net).
 *   - Comprehensive 7-Day Performance Report Card with Letter Grade (A+ to F).
 *   - Full 168-row tabular export to CSV.
 * ============================================================================
 */

(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory(require('./model'), require('./charts'), require('./storage'));
  } else {
    root.Module4TestingPhase = factory(root.PlanterModel, root.PlanterCharts, root.PlanterStorage);
  }
})(typeof self !== 'undefined' ? self : this, function (Model, Charts, Storage) {
  'use strict';

  let dom = {};
  let currentSimData = null;
  let activeInterventions = []; // Array of { hour, type, value, label }

  function init() {
    cacheDom();
    bindEvents();
    run7DaySimulation();
  }

  function cacheDom() {
    dom = {
      // Configuration
      weatherPattern: document.getElementById('m4-weather-pattern'),
      plantType: document.getElementById('m4-plant-type'),
      soilType: document.getElementById('m4-soil-type'),
      initialHole: document.getElementById('m4-initial-hole'),
      initialHoleVal: document.getElementById('m4-initial-hole-val'),

      // Interventions Controls
      invType: document.getElementById('m4-inv-type'),
      invHour: document.getElementById('m4-inv-hour'),
      invHourVal: document.getElementById('m4-inv-hour-val'),
      invHoleSizeGroup: document.getElementById('m4-inv-holesize-group'),
      invHoleSize: document.getElementById('m4-inv-holesize'),
      btnAddIntervention: document.getElementById('m4-btn-add-intervention'),
      btnClearInterventions: document.getElementById('m4-btn-clear-interventions'),
      interventionList: document.getElementById('m4-intervention-list'),

      // Action Buttons
      btnRun7Day: document.getElementById('m4-btn-run-7day'),
      btnExportCsv: document.getElementById('m4-btn-export-csv'),
      btnSaveReport: document.getElementById('m4-btn-save-report'),

      // Visualization
      canvasChart: document.getElementById('m4-canvas-chart'),
      chartMetricSelect: document.getElementById('m4-chart-metric'),

      // Report Card Readouts
      gradeBadge: document.getElementById('m4-grade-badge'),
      cardAvgHealth: document.getElementById('m4-card-avg-health'),
      cardFinalHealth: document.getElementById('m4-card-final-health'),
      cardTotalWater: document.getElementById('m4-card-total-water'),
      cardPeakAlgae: document.getElementById('m4-card-peak-algae'),
      cardStability: document.getElementById('m4-card-stability'),
      cardInterventionsCount: document.getElementById('m4-card-interventions-count'),

      // Telemetry Table
      logTableBody: document.getElementById('m4-log-table-body'),
      dayFilter: document.getElementById('m4-day-filter')
    };
  }

  function bindEvents() {
    if (dom.initialHole) {
      dom.initialHole.addEventListener('input', () => {
        if (dom.initialHoleVal) dom.initialHoleVal.textContent = `${Number(dom.initialHole.value).toFixed(1)} mm`;
      });
    }
    if (dom.invHour) {
      dom.invHour.addEventListener('input', () => {
        if (dom.invHourVal) dom.invHourVal.textContent = `Hour ${dom.invHour.value} (Day ${Math.floor(dom.invHour.value / 24) + 1})`;
      });
    }
    if (dom.invType) {
      dom.invType.addEventListener('change', () => {
        if (dom.invHoleSizeGroup) {
          dom.invHoleSizeGroup.style.display = (dom.invType.value === 'adjust_hole') ? 'block' : 'none';
        }
      });
    }

    if (dom.btnAddIntervention) dom.btnAddIntervention.addEventListener('click', addIntervention);
    if (dom.btnClearInterventions) dom.btnClearInterventions.addEventListener('click', clearInterventions);
    if (dom.btnRun7Day) dom.btnRun7Day.addEventListener('click', run7DaySimulation);
    if (dom.btnExportCsv) dom.btnExportCsv.addEventListener('click', exportLogsCsv);
    if (dom.btnSaveReport) dom.btnSaveReport.addEventListener('click', saveRun);
    if (dom.chartMetricSelect) dom.chartMetricSelect.addEventListener('change', renderChart);
    if (dom.dayFilter) dom.dayFilter.addEventListener('change', renderTable);
  }

  function addIntervention() {
    const type = dom.invType?.value || 'refill';
    const hour = parseInt(dom.invHour?.value, 10) || 48;
    let value = null;
    let label = '';

    if (type === 'refill') {
      label = `Refill Bottle to 2.0 L`;
    } else if (type === 'adjust_hole') {
      value = parseFloat(dom.invHoleSize?.value) || 2.5;
      label = `Adjust Hole to ${value} mm`;
    } else if (type === 'paint_black') {
      label = `Paint Bottle Black (UV & Algae Shield)`;
    } else if (type === 'add_shade') {
      label = `Install 50% Green Shade Net`;
    }

    activeInterventions.push({ hour, type, value, label });
    activeInterventions.sort((a, b) => a.hour - b.hour);
    renderInterventionList();
    run7DaySimulation();
  }

  function clearInterventions() {
    activeInterventions = [];
    renderInterventionList();
    run7DaySimulation();
  }

  function renderInterventionList() {
    if (!dom.interventionList) return;
    if (activeInterventions.length === 0) {
      dom.interventionList.innerHTML = '<span class="text-muted">No interventions added. Add one above to test mid-run response.</span>';
      return;
    }
    dom.interventionList.innerHTML = activeInterventions.map((inv, idx) => `
      <span class="badge badge-info" style="margin-right: 6px; margin-bottom: 6px;">
        H${inv.hour}: ${inv.label}
        <button type="button" class="btn-remove-inv" data-idx="${idx}" style="background:none; border:none; color:white; font-weight:bold; cursor:pointer; margin-left:4px;">&times;</button>
      </span>
    `).join('');

    // Bind remove buttons
    const removeBtns = dom.interventionList.querySelectorAll('.btn-remove-inv');
    removeBtns.forEach(btn => {
      btn.addEventListener('click', (e) => {
        const idx = parseInt(e.target.getAttribute('data-idx'), 10);
        activeInterventions.splice(idx, 1);
        renderInterventionList();
        run7DaySimulation();
      });
    });
  }

  function getInputs() {
    return {
      weatherPattern: dom.weatherPattern?.value || 'typical',
      plantTypeKey: dom.plantType?.value || 'mint',
      soilTypeKey: dom.soilType?.value || 'cocopeat',
      initialHoleDiameterMm: parseFloat(dom.initialHole?.value) || 2.0
    };
  }

  function setInputs(p) {
    if (!p) return;
    if (dom.weatherPattern && p.weatherPattern) dom.weatherPattern.value = p.weatherPattern;
    if (dom.initialHole && p.initialHole !== undefined) {
      dom.initialHole.value = p.initialHole;
      if (dom.initialHoleVal) dom.initialHoleVal.textContent = `${Number(p.initialHole).toFixed(1)} mm`;
    }
    run7DaySimulation();
  }

  function run7DaySimulation() {
    const inputs = getInputs();
    currentSimData = Model.simulate7DayLifecycle({
      weatherPattern: inputs.weatherPattern,
      initialHoleDiameterMm: inputs.initialHoleDiameterMm,
      initialBottleCapacityL: 2.0,
      soilTypeKey: inputs.soilTypeKey,
      plantTypeKey: inputs.plantTypeKey,
      interventions: activeInterventions
    });

    renderSummaryReport(currentSimData.summary);
    renderChart();
    renderTable();
  }

  function renderSummaryReport(sum) {
    if (dom.gradeBadge) {
      dom.gradeBadge.textContent = sum.letterGrade;
      dom.gradeBadge.className = `grade-badge grade-${sum.letterGrade.replace('+', 'plus')}`;
    }
    if (dom.cardAvgHealth) dom.cardAvgHealth.textContent = `${sum.averageHealthScore}%`;
    if (dom.cardFinalHealth) dom.cardFinalHealth.textContent = `${sum.finalHealthScore}%`;
    if (dom.cardTotalWater) dom.cardTotalWater.textContent = `${sum.cumulativeWaterUsedL} L`;
    if (dom.cardPeakAlgae) {
      dom.cardPeakAlgae.textContent = `${sum.peakAlgaePercent}%`;
      dom.cardPeakAlgae.className = `report-value ${sum.peakAlgaePercent > 40 ? 'text-danger' : 'text-success'}`;
    }
    if (dom.cardStability) dom.cardStability.textContent = `${sum.moistureStabilityIndex}/100`;
    if (dom.cardInterventionsCount) dom.cardInterventionsCount.textContent = sum.interventionsCount;
  }

  function renderChart() {
    if (!dom.canvasChart || !currentSimData) return;
    const metric = dom.chartMetricSelect?.value || 'overview';
    const logs = currentSimData.hourlyLogs;

    if (metric === 'overview') {
      Charts.drawLineChart(dom.canvasChart, {
        title: '7-Day Overview',
        xLabel: 'Timeline (Hours)',
        yLabel: 'Normalized Value',
        yMin: 0,
        yMax: 2.2,
        series: [
          { name: 'Water (L)', color: Charts.PALETTE.waterBlue, data: logs.map(l => ({ x: l.hour, y: l.bottleWaterL })) },
          { name: 'Moisture (frac)', color: Charts.PALETTE.greenPrimary, data: logs.map(l => ({ x: l.hour, y: l.rootMoisture / 100 })) },
          { name: 'Health (x100)', color: Charts.PALETTE.purpleAccent, data: logs.map(l => ({ x: l.hour, y: l.plantHealth / 50 })) }
        ],
        thresholdBand: { min: 0.45, max: 0.75, label: 'Optimal Moisture Band', color: 'rgba(76, 175, 80, 0.12)' }
      });
    } else if (metric === 'temperature_algae') {
      Charts.drawLineChart(dom.canvasChart, {
        title: 'Temp & Algae',
        xLabel: 'Timeline (Hours)',
        yLabel: 'Temp / Algae',
        yMin: 0,
        yMax: 100,
        series: [
          { name: 'Ambient Temp (°C)', color: '#ff7043', data: logs.map(l => ({ x: l.hour, y: l.ambientTemp })) },
          { name: 'Algae Colonization (%)', color: '#388e3c', data: logs.map(l => ({ x: l.hour, y: l.algaeLevelPercent })) }
        ]
      });
    } else if (metric === 'drip_rate') {
      Charts.drawLineChart(dom.canvasChart, {
        title: 'Drip Rate',
        xLabel: 'Timeline (Hours)',
        yLabel: 'Drip Rate',
        yMin: 0,
        series: [
          { name: 'Drip Rate (ml/hr)', color: Charts.PALETTE.waterBlue, data: logs.map(l => ({ x: l.hour, y: l.dripRateMlHr })) }
        ]
      });
    }
  }

  function renderTable() {
    if (!dom.logTableBody || !currentSimData) return;
    const filter = dom.dayFilter?.value || 'all';

    let filtered = currentSimData.hourlyLogs;
    if (filter !== 'all') {
      const targetDay = parseInt(filter, 10);
      filtered = filtered.filter(l => l.dayNum === targetDay);
    }

    // Render rows (shows sample or filtered subset)
    dom.logTableBody.innerHTML = filtered.map(l => `
      <tr class="${l.interventionNote ? 'table-warning' : (l.statusWarning ? 'table-danger' : '')}">
        <td><strong>${l.formattedTime}</strong></td>
        <td>${l.ambientTemp} °C</td>
        <td>${l.bottleWaterL.toFixed(2)} L</td>
        <td>${l.dripRateMlHr.toFixed(1)}</td>
        <td>${l.rootMoisture}%</td>
        <td><span class="${l.plantHealth >= 75 ? 'text-success' : 'text-danger'} font-weight-bold">${l.plantHealth}%</span></td>
        <td>${l.algaeLevelPercent}%</td>
        <td>
          ${l.interventionNote ? `<span class="badge badge-info">${l.interventionNote}</span> ` : ''}
          ${l.statusWarning ? `<span class="badge badge-danger">${l.statusWarning}</span>` : (!l.interventionNote ? '<span class="text-success">Normal</span>' : '')}
        </td>
      </tr>
    `).join('');
  }

  function exportLogsCsv() {
    if (!currentSimData) return;
    const rows = currentSimData.hourlyLogs.map(l => ({
      hour: l.hour,
      day: l.dayNum,
      time: l.formattedTime,
      temperatureC: l.ambientTemp,
      solarIntensity: l.solarIntensity,
      bottleWaterL: l.bottleWaterL,
      dripRateMlHr: l.dripRateMlHr,
      rootMoisturePercent: l.rootMoisture,
      plantHealthScore: l.plantHealth,
      algaeLevelPercent: l.algaeLevelPercent,
      intervention: l.interventionNote || 'None',
      warning: l.statusWarning || 'Normal'
    }));
    Storage.exportToCsv(`7day_testing_telemetry_${Date.now()}.csv`, rows);
  }

  function saveRun() {
    if (!currentSimData) return;
    const inputs = getInputs();
    Storage.saveRun({
      module: 'module4',
      name: `7-Day Testing Run (Grade ${currentSimData.summary.letterGrade}, ${inputs.weatherPattern})`,
      parameters: { ...inputs, interventions: activeInterventions },
      results: currentSimData.summary
    });
    if (window.PlanterUI && window.PlanterUI.showToast) {
      window.PlanterUI.showToast('7-Day testing summary report saved!');
    }
  }

  return {
    init,
    run7DaySimulation,
    renderChart,
    addIntervention,
    clearInterventions,
    setInputs,
    getInputs,
    exportLogsCsv,
    saveRun
  };
});
