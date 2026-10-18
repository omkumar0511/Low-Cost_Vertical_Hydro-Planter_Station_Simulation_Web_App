/**
 * ============================================================================
 * MODULE 3: HANGING PLANTER LOAD & STRUCTURAL SAFETY SIMULATOR
 * ============================================================================
 * Evaluates structural mechanics of multi-tier vertical suspended planters:
 *   - Dry load vs saturated wet load (water mass addition).
 *   - Tension load distribution per rope strand.
 *   - Safety Factor (SF) against cord tensile failure and wall hook pullout.
 *   - Interactive "Pour Water" real-time saturation experiment.
 *   - Engineering rationale: Why lightweight coco-peat is vital for safety.
 * ============================================================================
 */

(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory(require('./model'), require('./charts'), require('./storage'));
  } else {
    root.Module3LoadSafety = factory(root.PlanterModel, root.PlanterCharts, root.PlanterStorage);
  }
})(typeof self !== 'undefined' ? self : this, function (Model, Charts, Storage) {
  'use strict';

  let dom = {};
  let currentResults = null;
  let pourIntervalId = null;

  function init() {
    cacheDom();
    bindEvents();
    calculateLoad();
  }

  function cacheDom() {
    dom = {
      // Inputs
      bottleCount: document.getElementById('m3-bottle-count'),
      bottleCountVal: document.getElementById('m3-bottle-count-val'),
      soilVolume: document.getElementById('m3-soil-volume'),
      soilVolumeVal: document.getElementById('m3-soil-volume-val'),
      soilType: document.getElementById('m3-soil-type'),
      saturation: document.getElementById('m3-saturation'),
      saturationVal: document.getElementById('m3-saturation-val'),
      plantMass: document.getElementById('m3-plant-mass'),
      plantMassVal: document.getElementById('m3-plant-mass-val'),
      ropeType: document.getElementById('m3-rope-type'),
      breakingStrength: document.getElementById('m3-breaking-strength'),
      ropeStrands: document.getElementById('m3-rope-strands'),
      hookRating: document.getElementById('m3-hook-rating'),

      // Controls
      btnCalculate: document.getElementById('m3-btn-calculate'),
      btnPourWater: document.getElementById('m3-btn-pour-water'),
      btnDryOut: document.getElementById('m3-btn-dry-out'),
      btnSaveRun: document.getElementById('m3-btn-save-run'),

      // Visual Canvas
      canvasStack: document.getElementById('m3-canvas-stack'),

      // Readouts
      metricDryLoad: document.getElementById('m3-metric-dry-load'),
      metricWetLoad: document.getElementById('m3-metric-wet-load'),
      metricWaterAdded: document.getElementById('m3-metric-water-added'),
      metricTension: document.getElementById('m3-metric-tension'),
      metricSafetyFactor: document.getElementById('m3-metric-safety-factor'),
      metricVerdict: document.getElementById('m3-metric-verdict'),
      alertBanner: document.getElementById('m3-alert-banner'),
      cocoPeatNote: document.getElementById('m3-cocopeat-note')
    };
  }

  function bindEvents() {
    const bindSlider = (slider, valEl, suffix = '') => {
      if (!slider) return;
      slider.addEventListener('input', () => {
        if (valEl) valEl.textContent = `${slider.value}${suffix}`;
        calculateLoad();
      });
    };

    bindSlider(dom.bottleCount, dom.bottleCountVal);
    bindSlider(dom.soilVolume, dom.soilVolumeVal, ' L');
    bindSlider(dom.saturation, dom.saturationVal, '%');
    bindSlider(dom.plantMass, dom.plantMassVal, ' kg');

    if (dom.soilType) dom.soilType.addEventListener('change', calculateLoad);
    if (dom.ropeType) {
      dom.ropeType.addEventListener('change', () => {
        const type = dom.ropeType.value;
        const defaultStr = Model.ROPE_TYPES[type] ? Model.ROPE_TYPES[type].breakingStrengthKg : 95;
        if (dom.breakingStrength) dom.breakingStrength.value = defaultStr;
        calculateLoad();
      });
    }
    if (dom.breakingStrength) dom.breakingStrength.addEventListener('input', calculateLoad);
    if (dom.ropeStrands) dom.ropeStrands.addEventListener('change', calculateLoad);
    if (dom.hookRating) dom.hookRating.addEventListener('input', calculateLoad);

    if (dom.btnCalculate) dom.btnCalculate.addEventListener('click', calculateLoad);
    if (dom.btnPourWater) dom.btnPourWater.addEventListener('click', togglePourWaterAnimation);
    if (dom.btnDryOut) dom.btnDryOut.addEventListener('click', resetSaturationToDry);
    if (dom.btnSaveRun) dom.btnSaveRun.addEventListener('click', saveRun);
  }

  function getInputs() {
    return {
      bottleCount: parseInt(dom.bottleCount?.value, 10) || 4,
      soilVolumeL: parseFloat(dom.soilVolume?.value) || 1.5,
      soilTypeKey: dom.soilType?.value || 'cocopeat',
      saturationPercent: parseFloat(dom.saturation?.value) || 60,
      plantMassKg: parseFloat(dom.plantMass?.value) || 0.10,
      ropeTypeKey: dom.ropeType?.value || 'nylon',
      customBreakingStrength: parseFloat(dom.breakingStrength?.value),
      ropeStrands: parseInt(dom.ropeStrands?.value, 10) || 2,
      hookRatingKg: parseFloat(dom.hookRating?.value) || 50
    };
  }

  function setInputs(p) {
    if (!p) return;
    if (dom.bottleCount && p.bottleCount !== undefined) {
      dom.bottleCount.value = p.bottleCount;
      if (dom.bottleCountVal) dom.bottleCountVal.textContent = p.bottleCount;
    }
    if (dom.soilVolume && p.soilVolume !== undefined) {
      dom.soilVolume.value = p.soilVolume;
      if (dom.soilVolumeVal) dom.soilVolumeVal.textContent = `${p.soilVolume} L`;
    }
    if (dom.soilType && p.soilType) dom.soilType.value = p.soilType;
    if (dom.saturation && p.saturation !== undefined) {
      dom.saturation.value = p.saturation;
      if (dom.saturationVal) dom.saturationVal.textContent = `${p.saturation}%`;
    }
    if (dom.plantMass && p.plantMass !== undefined) {
      dom.plantMass.value = p.plantMass;
      if (dom.plantMassVal) dom.plantMassVal.textContent = `${p.plantMass} kg`;
    }
    if (dom.ropeType && p.ropeType) dom.ropeType.value = p.ropeType;
    if (dom.ropeStrands && p.ropeStrands !== undefined) dom.ropeStrands.value = p.ropeStrands;
    if (dom.hookRating && p.hookRating !== undefined) dom.hookRating.value = p.hookRating;

    calculateLoad();
  }

  function calculateLoad() {
    const inputs = getInputs();
    currentResults = Model.calculatePlanterLoadAndSafety(inputs);

    // If user provided custom breaking strength, override safety factor calculation
    if (!isNaN(inputs.customBreakingStrength) && inputs.customBreakingStrength > 0) {
      const totalCapacity = inputs.customBreakingStrength * inputs.ropeStrands;
      const sfRope = currentResults.totalWetLoadKg > 0 ? (totalCapacity / currentResults.totalWetLoadKg) : 999;
      currentResults.safetyFactorRope = Math.round(sfRope * 100) / 100;
      currentResults.safetyFactor = Math.min(currentResults.safetyFactorRope, currentResults.safetyFactorHook);

      if (currentResults.safetyFactor < 1.0) {
        currentResults.verdict = 'Will Fail (Catastrophic Collapse)';
        currentResults.statusClass = 'danger';
      } else if (currentResults.safetyFactor < 2.0) {
        currentResults.verdict = 'Risky (Marginal Safety Margin)';
        currentResults.statusClass = 'warning';
      } else {
        currentResults.verdict = 'Safe';
        currentResults.statusClass = 'safe';
      }
    }

    renderReadouts(currentResults);
    renderVisualStack(currentResults);
  }

  function renderReadouts(res) {
    if (dom.metricDryLoad) dom.metricDryLoad.textContent = `${res.totalDryLoadKg.toFixed(2)} kgf`;
    if (dom.metricWetLoad) dom.metricWetLoad.textContent = `${res.totalWetLoadKg.toFixed(2)} kgf`;
    if (dom.metricWaterAdded) dom.metricWaterAdded.textContent = `+${res.totalWaterOnlyKg.toFixed(2)} kg`;
    if (dom.metricTension) dom.metricTension.textContent = `${res.tensionPerStrandKg.toFixed(2)} kgf/strand`;

    if (dom.metricSafetyFactor) {
      dom.metricSafetyFactor.textContent = `${res.safetyFactor.toFixed(2)}`;
      dom.metricSafetyFactor.className = `metric-value text-${res.statusClass}`;
    }

    if (dom.metricVerdict) {
      dom.metricVerdict.textContent = res.verdict;
      dom.metricVerdict.className = `badge badge-${res.statusClass === 'safe' ? 'success' : (res.statusClass === 'warning' ? 'warning' : 'danger')}`;
    }

    if (dom.alertBanner) {
      dom.alertBanner.className = `alert alert-${res.statusClass === 'safe' ? 'success' : (res.statusClass === 'warning' ? 'warning' : 'danger')}`;
      dom.alertBanner.innerHTML = `<strong>Structural Verdict: ${res.verdict}</strong> — ${res.message}`;
    }

    if (dom.cocoPeatNote) {
      const isCoco = getInputs().soilTypeKey === 'cocopeat';
      dom.cocoPeatNote.innerHTML = isCoco
        ? `🌟 <strong>Coco-Peat Advantage:</strong> Coco-peat has a dry bulk density of only 0.12 kg/L compared to 1.25 kg/L for garden soil. This keeps total stack weight light even when fully watered, preventing wall anchor tear-out.`
        : `⚠️ <strong>High Weight Warning:</strong> Garden soil is ~10× heavier than coco-peat. When saturated with water, the structural load increases dramatically, multiplying stress on ropes and wall anchors.`;
    }
  }

  function renderVisualStack(res) {
    if (!dom.canvasStack) return;
    const inputs = getInputs();
    Charts.drawHangingPlanterStack(dom.canvasStack, {
      bottleCount: res.bottleCount,
      totalWetLoadKg: res.totalWetLoadKg,
      safetyFactor: res.safetyFactor,
      ropeType: inputs.ropeTypeKey,
      ropeStrands: inputs.ropeStrands,
      hookRatingKg: inputs.hookRatingKg,
      saturationPercent: inputs.saturationPercent,
      verdict: res.verdict,
      statusClass: res.statusClass
    });
  }

  /**
   * "Pour Water" interactive experiment:
   * Smoothly raises saturation from current value up to 100% in real-time,
   * letting user see the load climb dynamically and trigger warnings if overloaded.
   */
  function togglePourWaterAnimation() {
    if (pourIntervalId) {
      clearInterval(pourIntervalId);
      pourIntervalId = null;
      if (dom.btnPourWater) dom.btnPourWater.textContent = '💧 Pour Water (Raise Saturation)';
      return;
    }

    if (dom.btnPourWater) dom.btnPourWater.textContent = '⏸ Stop Pouring';

    pourIntervalId = setInterval(() => {
      let currentSat = parseFloat(dom.saturation.value) || 0;
      if (currentSat >= 100) {
        clearInterval(pourIntervalId);
        pourIntervalId = null;
        if (dom.btnPourWater) dom.btnPourWater.textContent = '💧 Pour Water (Fully Saturated)';
        return;
      }
      currentSat = Math.min(100, currentSat + 4);
      dom.saturation.value = currentSat;
      if (dom.saturationVal) dom.saturationVal.textContent = `${currentSat}%`;
      calculateLoad();
    }, 150);
  }

  function resetSaturationToDry() {
    if (pourIntervalId) {
      clearInterval(pourIntervalId);
      pourIntervalId = null;
      if (dom.btnPourWater) dom.btnPourWater.textContent = '💧 Pour Water (Raise Saturation)';
    }
    if (dom.saturation) {
      dom.saturation.value = 10;
      if (dom.saturationVal) dom.saturationVal.textContent = '10%';
    }
    calculateLoad();
  }

  function saveRun() {
    if (!currentResults) return;
    const inputs = getInputs();
    Storage.saveRun({
      module: 'module3',
      name: `Load Test (${inputs.bottleCount} bottles, ${inputs.soilTypeKey}, SF ${currentResults.safetyFactor})`,
      parameters: inputs,
      results: {
        totalWetLoadKg: currentResults.totalWetLoadKg,
        safetyFactor: currentResults.safetyFactor,
        verdict: currentResults.verdict
      }
    });
    if (window.PlanterUI && window.PlanterUI.showToast) {
      window.PlanterUI.showToast('Structural load test run saved!');
    }
  }

  return {
    init,
    calculateLoad,
    setInputs,
    getInputs,
    saveRun
  };
});
