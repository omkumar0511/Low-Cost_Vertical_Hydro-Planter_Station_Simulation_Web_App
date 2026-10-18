/**
 * ============================================================================
 * MODULE 6: ENVIRONMENTAL IMPACT & CAMPUS GREENING CALCULATOR
 * ============================================================================
 * Quantifies circular economy and institutional sustainability benefits:
 *   - Plastic PET waste diverted from municipal dumping yards.
 *   - Embodied carbon emissions avoided (virgin PET lifecycle footprint).
 *   - Potable tap water conserved monthly (linked to Module 2 savings rate).
 *   - Campus vertical wall area greened (microclimate cooling & bio-diversity).
 *   - Animated counters and transparent assumption disclosure for vivas.
 * ============================================================================
 */

(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory(require('./model'), require('./charts'), require('./storage'));
  } else {
    root.Module6Environmental = factory(root.PlanterModel, root.PlanterCharts, root.PlanterStorage);
  }
})(typeof self !== 'undefined' ? self : this, function (Model, Charts, Storage) {
  'use strict';

  let dom = {};

  function init() {
    cacheDom();
    bindEvents();
    calculateImpact();
  }

  function cacheDom() {
    dom = {
      // Inputs
      bottleCount: document.getElementById('m6-bottle-count'),
      bottleCountVal: document.getElementById('m6-bottle-count-val'),
      stationCount: document.getElementById('m6-station-count'),
      stationCountVal: document.getElementById('m6-station-count-val'),
      bottleWeight: document.getElementById('m6-bottle-weight'),
      bottleWeightVal: document.getElementById('m6-bottle-weight-val'),

      // Animated Metric Cards
      counterTotalBottles: document.getElementById('m6-counter-total-bottles'),
      counterPlasticKg: document.getElementById('m6-counter-plastic-kg'),
      counterCarbonKg: document.getElementById('m6-counter-carbon-kg'),
      counterWaterL: document.getElementById('m6-counter-water-l'),
      counterWallArea: document.getElementById('m6-counter-wall-area'),
      counterLandfillVol: document.getElementById('m6-counter-landfill-vol'),
      counterCostSaved: document.getElementById('m6-counter-cost-saved'),

      btnRecalculate: document.getElementById('m6-btn-recalculate'),
      btnSaveRun: document.getElementById('m6-btn-save-run')
    };
  }

  function bindEvents() {
    const bindSlider = (slider, valEl, suffix = '') => {
      if (!slider) return;
      slider.addEventListener('input', () => {
        if (valEl) valEl.textContent = `${slider.value}${suffix}`;
        calculateImpact();
      });
    };

    bindSlider(dom.bottleCount, dom.bottleCountVal);
    bindSlider(dom.stationCount, dom.stationCountVal);
    bindSlider(dom.bottleWeight, dom.bottleWeightVal, ' g');

    if (dom.btnRecalculate) dom.btnRecalculate.addEventListener('click', calculateImpact);
    if (dom.btnSaveRun) dom.btnSaveRun.addEventListener('click', saveRun);
  }

  function getInputs() {
    return {
      bottleCount: parseInt(dom.bottleCount?.value, 10) || 20,
      stationCount: parseInt(dom.stationCount?.value, 10) || 3,
      bottleWeightGrams: parseFloat(dom.bottleWeight?.value) || 45
    };
  }

  function setInputs(p) {
    if (!p) return;
    if (dom.bottleCount && p.bottleCount !== undefined) {
      dom.bottleCount.value = p.bottleCount;
      if (dom.bottleCountVal) dom.bottleCountVal.textContent = p.bottleCount;
    }
    if (dom.stationCount && p.stationCount !== undefined) {
      dom.stationCount.value = p.stationCount;
      if (dom.stationCountVal) dom.stationCountVal.textContent = p.stationCount;
    }
    if (dom.bottleWeight && p.bottleWeightGrams !== undefined) {
      dom.bottleWeight.value = p.bottleWeightGrams;
      if (dom.bottleWeightVal) dom.bottleWeightVal.textContent = `${p.bottleWeightGrams} g`;
    }
    calculateImpact();
  }

  function calculateImpact() {
    const inputs = getInputs();

    // Link water saved per bottle from Module 2 if available
    let waterSavedPerBottleDayL = 0.55;
    if (window.Module2WaterComparison && window.Module2WaterComparison.getInputs) {
      const m2Inputs = window.Module2WaterComparison.getInputs();
      const m2Res = Model.simulateWaterEfficiencyComparison(m2Inputs);
      if (m2Res && m2Res.timeSeries.length > 0) {
        waterSavedPerBottleDayL = m2Res.totalSavedL / (m2Inputs.days || 7);
      }
    }

    const impact = Model.calculateEnvironmentalImpact({
      bottleCount: inputs.bottleCount,
      stationCount: inputs.stationCount,
      bottleWeightGrams: inputs.bottleWeightGrams,
      waterSavedPerBottleDayL
    });

    // Update with animation
    animateValue(dom.counterTotalBottles, impact.totalBottles, 0, '');
    animateValue(dom.counterPlasticKg, impact.plasticDivertedKg, 2, ' kg');
    animateValue(dom.counterCarbonKg, impact.carbonOffsetKgCo2e, 2, ' kg CO₂e');
    animateValue(dom.counterWaterL, impact.monthlyWaterSavedLitres, 0, ' L / mo');
    animateValue(dom.counterWallArea, impact.wallAreaGreenM2, 2, ' m²');
    animateValue(dom.counterLandfillVol, impact.landfillVolumeSavedM3, 3, ' m³');
    animateValue(dom.counterCostSaved, impact.costSavingsRs, 0, 'Rs. ');
  }

  function animateValue(el, targetVal, decimals = 0, suffix = '') {
    if (!el) return;
    const startVal = parseFloat(el.getAttribute('data-val') || '0');
    el.setAttribute('data-val', targetVal);

    const durationMs = 400;
    const startTime = performance.now();

    function update(now) {
      const elapsed = now - startTime;
      const progress = Math.min(1.0, elapsed / durationMs);
      const current = startVal + (targetVal - startVal) * easeOutQuad(progress);
      el.textContent = `${suffix.startsWith('Rs') ? suffix : ''}${current.toFixed(decimals)}${!suffix.startsWith('Rs') ? suffix : ''}`;

      if (progress < 1.0) {
        requestAnimationFrame(update);
      } else {
        el.textContent = `${suffix.startsWith('Rs') ? suffix : ''}${targetVal.toFixed(decimals)}${!suffix.startsWith('Rs') ? suffix : ''}`;
      }
    }
    requestAnimationFrame(update);
  }

  function easeOutQuad(t) {
    return t * (2 - t);
  }

  function saveRun() {
    const inputs = getInputs();
    const impact = Model.calculateEnvironmentalImpact({
      bottleCount: inputs.bottleCount,
      stationCount: inputs.stationCount,
      bottleWeightGrams: inputs.bottleWeightGrams
    });
    Storage.saveRun({
      module: 'module6',
      name: `Impact Assessment (${impact.totalBottles} bottles, ${impact.plasticDivertedKg}kg plastic diverted)`,
      parameters: inputs,
      results: impact
    });
    if (window.PlanterUI && window.PlanterUI.showToast) {
      window.PlanterUI.showToast('Environmental impact assessment saved!');
    }
  }

  return {
    init,
    calculateImpact,
    setInputs,
    getInputs,
    saveRun
  };
});
