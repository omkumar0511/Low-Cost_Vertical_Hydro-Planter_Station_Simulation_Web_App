/**
 * ============================================================================
 * MODULE 1: INVERTED-BOTTLE DRIP FEEDER & SOIL MOISTURE SIMULATOR
 * ============================================================================
 * Primary simulation engine:
 *   - Torricelli orifice discharge with soil back-pressure and bio-clogging.
 *   - Discretized 2D finite-difference moisture diffusion through porous soil.
 *   - Dynamic evapotranspiration and diurnal root uptake.
 *   - Plant health evaluation (optimal band vs wilting/waterlogging).
 *   - Real-time animated canvas bottle draining and 2D heatmap updates.
 * ============================================================================
 */

(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory(require('./model'), require('./charts'), require('./storage'));
  } else {
    root.Module1DripFeeder = factory(root.PlanterModel, root.PlanterCharts, root.PlanterStorage);
  }
})(typeof self !== 'undefined' ? self : this, function (Model, Charts, Storage) {
  'use strict';

  let isRunning = false;
  let animFrameId = null;
  let lastTimestamp = 0;
  let speedMultiplier = 10; // 1x, 10x, 100x, 1000x

  // Simulation State
  let state = {
    simMinutes: 0,
    currentWaterL: 2.0,
    cumWaterUsedMl: 0,
    soilGrid: null,
    avgRootMoisture: 0.55,
    plantHealth: 100,
    plantStatus: 'healthy',
    dripRateMlHr: 30,
    timeToEmptyHrs: 66,
    history: {
      timeHours: [],
      waterLevel: [],
      rootMoisture: [],
      plantHealth: [],
      cumWaterUsed: []
    },
    overlayRun: null // for run comparison
  };

  // Cached DOM elements
  let dom = {};

  function init() {
    cacheDom();
    bindEvents();
    resetSimulation();
  }

  function cacheDom() {
    dom = {
      // Inputs
      bottleCapacity: document.getElementById('m1-capacity'),
      fillLevel: document.getElementById('m1-fill-level'),
      fillLevelVal: document.getElementById('m1-fill-level-val'),
      holeDiameter: document.getElementById('m1-hole-diameter'),
      holeDiameterVal: document.getElementById('m1-hole-diameter-val'),
      soilType: document.getElementById('m1-soil-type'),
      plantType: document.getElementById('m1-plant-type'),
      temperature: document.getElementById('m1-temp'),
      temperatureVal: document.getElementById('m1-temp-val'),
      sunlight: document.getElementById('m1-sunlight'),
      refillInterval: document.getElementById('m1-refill-interval'),
      refillIntervalVal: document.getElementById('m1-refill-interval-val'),
      clogging: document.getElementById('m1-clogging'),
      cloggingVal: document.getElementById('m1-clogging-val'),
      calibrationFactor: document.getElementById('m1-calibration'),

      // Controls
      btnPlay: document.getElementById('m1-btn-play'),
      btnPause: document.getElementById('m1-btn-pause'),
      btnStep: document.getElementById('m1-btn-step'),
      btnReset: document.getElementById('m1-btn-reset'),
      btnRefillNow: document.getElementById('m1-btn-refill-now'),
      speedSelect: document.getElementById('m1-speed-select'),

      // Canvas surfaces
      canvasAnim: document.getElementById('m1-canvas-anim'),
      canvasHeatmap: document.getElementById('m1-canvas-heatmap'),
      canvasChart: document.getElementById('m1-canvas-chart'),
      chartSelect: document.getElementById('m1-chart-select'),

      // Readouts
      metricTime: document.getElementById('m1-metric-time'),
      metricWater: document.getElementById('m1-metric-water'),
      metricDripRate: document.getElementById('m1-metric-drip-rate'),
      metricMoisture: document.getElementById('m1-metric-moisture'),
      metricHealth: document.getElementById('m1-metric-health'),
      metricTimeToEmpty: document.getElementById('m1-metric-time-to-empty'),
      warningBox: document.getElementById('m1-warning-box')
    };
  }

  function bindEvents() {
    // Slider value synchronization
    if (dom.fillLevel) {
      dom.fillLevel.addEventListener('input', () => {
        if (dom.fillLevelVal) dom.fillLevelVal.textContent = `${dom.fillLevel.value}%`;
      });
    }
    if (dom.holeDiameter) {
      dom.holeDiameter.addEventListener('input', () => {
        if (dom.holeDiameterVal) dom.holeDiameterVal.textContent = `${Number(dom.holeDiameter.value).toFixed(1)} mm`;
      });
    }
    if (dom.temperature) {
      dom.temperature.addEventListener('input', () => {
        if (dom.temperatureVal) dom.temperatureVal.textContent = `${dom.temperature.value} °C`;
      });
    }
    if (dom.refillInterval) {
      dom.refillInterval.addEventListener('input', () => {
        if (dom.refillIntervalVal) dom.refillIntervalVal.textContent = `${dom.refillInterval.value} hrs`;
      });
    }
    if (dom.clogging) {
      dom.clogging.addEventListener('input', () => {
        if (dom.cloggingVal) dom.cloggingVal.textContent = `${dom.clogging.value}%`;
      });
    }

    if (dom.btnPlay) dom.btnPlay.addEventListener('click', startSimulation);
    if (dom.btnPause) dom.btnPause.addEventListener('click', pauseSimulation);
    if (dom.btnStep) dom.btnStep.addEventListener('click', () => stepMinutes(15));
    if (dom.btnReset) dom.btnReset.addEventListener('click', resetSimulation);
    if (dom.btnRefillNow) dom.btnRefillNow.addEventListener('click', refillBottle);

    if (dom.speedSelect) {
      dom.speedSelect.addEventListener('change', () => {
        speedMultiplier = Number(dom.speedSelect.value) || 10;
      });
    }

    if (dom.chartSelect) {
      dom.chartSelect.addEventListener('change', renderChart);
    }
  }

  function getInputs() {
    return {
      capacityL: parseFloat(dom.bottleCapacity?.value) || 2.0,
      fillLevelPercent: parseFloat(dom.fillLevel?.value) || 100,
      holeDiameterMm: parseFloat(dom.holeDiameter?.value) || 2.0,
      soilType: dom.soilType?.value || 'cocopeat',
      plantType: dom.plantType?.value || 'mint',
      temperatureC: parseFloat(dom.temperature?.value) || 28,
      sunlight: dom.sunlight?.value || 'partial',
      refillIntervalHrs: parseFloat(dom.refillInterval?.value) || 72,
      cloggingPercent: parseFloat(dom.clogging?.value) || 0,
      calibrationFactor: parseFloat(dom.calibrationFactor?.value) || 0.002
    };
  }

  function setInputs(p) {
    if (!p) return;
    if (dom.bottleCapacity && p.bottleCapacity !== undefined) dom.bottleCapacity.value = p.bottleCapacity;
    if (dom.fillLevel && p.fillLevel !== undefined) {
      dom.fillLevel.value = p.fillLevel;
      if (dom.fillLevelVal) dom.fillLevelVal.textContent = `${p.fillLevel}%`;
    }
    if (dom.holeDiameter && p.holeDiameter !== undefined) {
      dom.holeDiameter.value = p.holeDiameter;
      if (dom.holeDiameterVal) dom.holeDiameterVal.textContent = `${Number(p.holeDiameter).toFixed(1)} mm`;
    }
    if (dom.soilType && p.soilType) dom.soilType.value = p.soilType;
    if (dom.plantType && p.plantType) dom.plantType.value = p.plantType;
    if (dom.temperature && p.temperature !== undefined) {
      dom.temperature.value = p.temperature;
      if (dom.temperatureVal) dom.temperatureVal.textContent = `${p.temperature} °C`;
    }
    if (dom.sunlight && p.sunlight) dom.sunlight.value = p.sunlight;
    if (dom.refillInterval && p.refillInterval !== undefined) {
      dom.refillInterval.value = p.refillInterval;
      if (dom.refillIntervalVal) dom.refillIntervalVal.textContent = `${p.refillInterval} hrs`;
    }
    if (dom.clogging !== undefined && p.clogging !== undefined) {
      dom.clogging.value = p.clogging;
      if (dom.cloggingVal) dom.cloggingVal.textContent = `${p.clogging}%`;
    }
    if (dom.calibrationFactor && p.calibrationFactor !== undefined) {
      dom.calibrationFactor.value = p.calibrationFactor;
    }
    resetSimulation();
  }

  function resetSimulation() {
    pauseSimulation();
    const inputs = getInputs();
    const initVol = (inputs.capacityL * inputs.fillLevelPercent) / 100;

    state = {
      simMinutes: 0,
      currentWaterL: initVol,
      cumWaterUsedMl: 0,
      soilGrid: Model.createSoilGrid(0.35),
      avgRootMoisture: 0.35,
      plantHealth: 100,
      plantStatus: 'healthy',
      dripRateMlHr: 0,
      timeToEmptyHrs: 0,
      history: {
        timeHours: [0],
        waterLevel: [{ x: 0, y: initVol }],
        rootMoisture: [{ x: 0, y: 35 }],
        plantHealth: [{ x: 0, y: 100 }],
        cumWaterUsed: [{ x: 0, y: 0 }]
      },
      overlayRun: null
    };

    updateCalculations(0);
    renderAll();
  }

  function startSimulation() {
    if (isRunning) return;
    isRunning = true;
    if (dom.btnPlay) dom.btnPlay.disabled = true;
    if (dom.btnPause) dom.btnPause.disabled = false;
    lastTimestamp = performance.now();
    animFrameId = requestAnimationFrame(animationLoop);
  }

  function pauseSimulation() {
    isRunning = false;
    if (dom.btnPlay) dom.btnPlay.disabled = false;
    if (dom.btnPause) dom.btnPause.disabled = true;
    if (animFrameId) cancelAnimationFrame(animFrameId);
  }

  function refillBottle() {
    const inputs = getInputs();
    state.currentWaterL = inputs.capacityL;
    showNotification('Bottle refilled to capacity!');
    renderAll();
  }

  function animationLoop(timestamp) {
    if (!isRunning) return;
    const elapsedRealMs = timestamp - lastTimestamp;
    lastTimestamp = timestamp;

    // Convert real elapsed time to simulated minutes
    // At 1x: 1 real second = 1 sim minute
    // At 10x: 1 real second = 10 sim minutes
    // At 100x: 1 real second = 100 sim minutes
    // At 1000x: 1 real second = 1000 sim minutes
    const simMinutesToAdvance = (elapsedRealMs / 1000) * speedMultiplier;

    if (simMinutesToAdvance > 0) {
      stepMinutes(simMinutesToAdvance);
    }

    animFrameId = requestAnimationFrame(animationLoop);
  }

  function stepMinutes(deltaMinutes) {
    // Process in sub-steps of at most 5 minutes for mathematical stability
    const subStep = 5;
    let remaining = deltaMinutes;

    while (remaining > 0) {
      const step = Math.min(remaining, subStep);
      executeOneStep(step);
      remaining -= step;
    }

    renderAll();
  }

  function executeOneStep(dtMinutes) {
    const inputs = getInputs();
    state.simMinutes += dtMinutes;
    const currentSimHours = state.simMinutes / 60;
    const timeOfDayHours = (currentSimHours % 24);

    // 1. Calculate Torricelli Drip Outflow
    const drip = Model.calculateTorricelliDripRate({
      currentVolumeL: state.currentWaterL,
      totalCapacityL: inputs.capacityL,
      holeDiameterMm: inputs.holeDiameterMm,
      cloggingPercent: inputs.cloggingPercent,
      rootZoneSaturation: state.avgRootMoisture,
      calibrationFactor: inputs.calibrationFactor
    });

    const flowMlThisStep = drip.dripRateMlMin * dtMinutes;
    const flowLThisStep = flowMlThisStep / 1000;

    state.currentWaterL = Math.max(0, state.currentWaterL - flowLThisStep);
    state.cumWaterUsedMl += flowMlThisStep;
    state.dripRateMlHr = drip.dripRateMlHr;

    // Time to Empty (hours)
    if (state.dripRateMlHr > 0.1 && state.currentWaterL > 0) {
      state.timeToEmptyHrs = Math.round((state.currentWaterL / (state.dripRateMlHr / 1000)) * 10) / 10;
    } else {
      state.timeToEmptyHrs = 0;
    }

    // 2. 2D Soil Moisture Finite Difference Update
    const soilUpdate = Model.updateSoilGridStep({
      grid: state.soilGrid,
      soilTypeKey: inputs.soilType,
      plantTypeKey: inputs.plantType,
      dripRateMlMin: drip.dripRateMlMin,
      temperatureC: inputs.temperatureC,
      sunlight: inputs.sunlight,
      timeOfDayHours: timeOfDayHours,
      dtMinutes: dtMinutes
    });

    state.soilGrid = soilUpdate.grid;
    state.avgRootMoisture = soilUpdate.avgRootMoisture;

    // 3. Plant Health Evaluation
    const healthEval = Model.evaluatePlantHealth({
      currentHealth: state.plantHealth,
      rootMoisture: state.avgRootMoisture,
      plantTypeKey: inputs.plantType,
      dtMinutes: dtMinutes
    });

    state.plantHealth = healthEval.healthScore;
    state.plantStatus = healthEval.status;

    // 4. Automatic Refill check
    if (inputs.refillIntervalHrs > 0) {
      const hoursSinceLastRefill = currentSimHours % inputs.refillIntervalHrs;
      if (hoursSinceLastRefill < (dtMinutes / 60) && currentSimHours > 1) {
        state.currentWaterL = inputs.capacityL;
      }
    }

    // 5. Record History (every simulated hour or at key intervals)
    const lastRecHour = state.history.timeHours[state.history.timeHours.length - 1] || 0;
    if (currentSimHours - lastRecHour >= 0.5) {
      const roundedH = Math.round(currentSimHours * 10) / 10;
      state.history.timeHours.push(roundedH);
      state.history.waterLevel.push({ x: roundedH, y: Math.round(state.currentWaterL * 100) / 100 });
      state.history.rootMoisture.push({ x: roundedH, y: Math.round(state.avgRootMoisture * 100) });
      state.history.plantHealth.push({ x: roundedH, y: Math.round(state.plantHealth * 10) / 10 });
      state.history.cumWaterUsed.push({ x: roundedH, y: Math.round(state.cumWaterUsedMl) });

      // Cap history buffer
      if (state.history.timeHours.length > 250) {
        Object.keys(state.history).forEach(k => {
          if (Array.isArray(state.history[k])) {
            state.history[k].shift();
          }
        });
      }
    }
  }

  function updateCalculations(dt) {
    // Helper to refresh static metrics
    const inputs = getInputs();
    const drip = Model.calculateTorricelliDripRate({
      currentVolumeL: state.currentWaterL,
      totalCapacityL: inputs.capacityL,
      holeDiameterMm: inputs.holeDiameterMm,
      cloggingPercent: inputs.cloggingPercent,
      rootZoneSaturation: state.avgRootMoisture,
      calibrationFactor: inputs.calibrationFactor
    });
    state.dripRateMlHr = drip.dripRateMlHr;
  }

  // ==========================================================================
  // RENDERING ENGINE
  // ==========================================================================
  function renderAll() {
    renderReadouts();
    renderBottleAnimation();
    renderSoilHeatmap();
    renderChart();
  }

  function renderReadouts() {
    const totalHours = state.simMinutes / 60;
    const days = Math.floor(totalHours / 24);
    const hrs = Math.floor(totalHours % 24);
    const mins = Math.floor(state.simMinutes % 60);

    if (dom.metricTime) {
      dom.metricTime.textContent = `${days}d ${hrs}h ${mins}m`;
    }
    if (dom.metricWater) {
      dom.metricWater.textContent = `${state.currentWaterL.toFixed(2)} L`;
    }
    if (dom.metricDripRate) {
      dom.metricDripRate.textContent = `${state.dripRateMlHr.toFixed(1)} ml/h`;
    }
    if (dom.metricMoisture) {
      dom.metricMoisture.textContent = `${Math.round(state.avgRootMoisture * 100)}%`;
    }
    if (dom.metricHealth) {
      dom.metricHealth.textContent = `${state.plantHealth.toFixed(0)}% (${capitalize(state.plantStatus)})`;
      dom.metricHealth.className = `metric-value ${state.plantStatus === 'healthy' ? 'text-success' : 'text-danger'}`;
    }
    if (dom.metricTimeToEmpty) {
      dom.metricTimeToEmpty.textContent = state.currentWaterL <= 0.02 ? 'Empty' : `${state.timeToEmptyHrs} hrs`;
    }

    // System Warnings
    if (dom.warningBox) {
      const warnings = [];
      if (state.currentWaterL <= 0.05) {
        warnings.push({ text: '⚠️ Water bottle is empty! Refill required immediately.', level: 'danger' });
      }
      if (state.plantStatus === 'wilting') {
        warnings.push({ text: '🥀 Plant is wilting due to insufficient root moisture!', level: 'danger' });
      } else if (state.plantStatus === 'overwatered') {
        warnings.push({ text: '🌊 Soil is waterlogged! Risk of root rot and oxygen starvation.', level: 'warning' });
      }
      if (getInputs().cloggingPercent > 60) {
        warnings.push({ text: '🚫 Cap orifice is heavily clogged! Clean or enlarge hole.', level: 'warning' });
      }

      if (warnings.length > 0) {
        dom.warningBox.innerHTML = warnings.map(w => `<div class="alert alert-${w.level}">${w.text}</div>`).join('');
        dom.warningBox.style.display = 'block';
      } else {
        dom.warningBox.innerHTML = '<div class="alert alert-success">✓ Drip system operating within optimal agronomic parameters.</div>';
        dom.warningBox.style.display = 'block';
      }
    }
  }

  /**
   * Renders the Inverted 2L Bottle with falling drips and Plant state on Canvas
   */
  function renderBottleAnimation() {
    if (!dom.canvasAnim) return;
    const ctx = dom.canvasAnim.getContext('2d');
    const width = dom.canvasAnim.width = dom.canvasAnim.clientWidth || 360;
    const height = dom.canvasAnim.height = dom.canvasAnim.clientHeight || 340;

    ctx.clearRect(0, 0, width, height);

    const inputs = getInputs();
    const capacity = inputs.capacityL;
    const waterFrac = Math.max(0, Math.min(1.0, state.currentWaterL / capacity));

    // Layout
    const bottleCenterX = 90;
    const bottleTopY = 25;
    const bottleW = 70;
    const bottleBodyH = 140;
    const neckH = 35;
    const capH = 15;
    const capW = 26;

    // 1. Draw Inverted Bottle Outline (Cut Base at Top, Cap at Bottom)
    ctx.strokeStyle = '#455a64';
    ctx.lineWidth = 2;
    ctx.fillStyle = 'rgba(236, 239, 241, 0.5)';

    // Open cut base at top
    ctx.beginPath();
    ctx.ellipse(bottleCenterX, bottleTopY, bottleW / 2, 8, 0, 0, Math.PI * 2);
    ctx.stroke();

    // Cylindrical walls
    ctx.beginPath();
    ctx.moveTo(bottleCenterX - bottleW / 2, bottleTopY);
    ctx.lineTo(bottleCenterX - bottleW / 2, bottleTopY + bottleBodyH);
    // Tapering funnel shoulder towards cap
    ctx.lineTo(bottleCenterX - capW / 2, bottleTopY + bottleBodyH + neckH);
    // Cap
    ctx.lineTo(bottleCenterX - capW / 2, bottleTopY + bottleBodyH + neckH + capH);
    ctx.lineTo(bottleCenterX + capW / 2, bottleTopY + bottleBodyH + neckH + capH);
    ctx.lineTo(bottleCenterX + capW / 2, bottleTopY + bottleBodyH + neckH);
    // Right shoulder
    ctx.lineTo(bottleCenterX + bottleW / 2, bottleTopY + bottleBodyH);
    ctx.lineTo(bottleCenterX + bottleW / 2, bottleTopY);
    ctx.stroke();

    // 2. Draw Water inside Bottle
    if (waterFrac > 0) {
      const totalWaterH = (bottleBodyH + neckH) * waterFrac;
      const waterTopY = (bottleTopY + bottleBodyH + neckH) - totalWaterH;

      ctx.save();
      // Clip to bottle interior
      ctx.beginPath();
      ctx.moveTo(bottleCenterX - bottleW / 2 + 1, bottleTopY + 1);
      ctx.lineTo(bottleCenterX - bottleW / 2 + 1, bottleTopY + bottleBodyH);
      ctx.lineTo(bottleCenterX - capW / 2 + 1, bottleTopY + bottleBodyH + neckH);
      ctx.lineTo(bottleCenterX - capW / 2 + 1, bottleTopY + bottleBodyH + neckH + capH);
      ctx.lineTo(bottleCenterX + capW / 2 - 1, bottleTopY + bottleBodyH + neckH + capH);
      ctx.lineTo(bottleCenterX + capW / 2 - 1, bottleTopY + bottleBodyH + neckH);
      ctx.lineTo(bottleCenterX + bottleW / 2 - 1, bottleTopY + bottleBodyH);
      ctx.lineTo(bottleCenterX + bottleW / 2 - 1, bottleTopY + 1);
      ctx.closePath();
      ctx.clip();

      // Water fill
      ctx.fillStyle = 'rgba(2, 136, 209, 0.65)';
      ctx.fillRect(bottleCenterX - bottleW, waterTopY, bottleW * 2, totalWaterH + capH + 10);

      // Water surface meniscus
      ctx.fillStyle = 'rgba(129, 212, 250, 0.9)';
      ctx.beginPath();
      ctx.ellipse(bottleCenterX, waterTopY, bottleW / 2 - 2, 5, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }

    // Plastic Cap (Red/Blue PET bottle cap)
    ctx.fillStyle = '#1565c0';
    ctx.fillRect(bottleCenterX - capW / 2, bottleTopY + bottleBodyH + neckH, capW, capH);
    ctx.strokeStyle = '#0d47a1';
    ctx.strokeRect(bottleCenterX - capW / 2, bottleTopY + bottleBodyH + neckH, capW, capH);

    // 2mm Cap Orifice
    ctx.fillStyle = '#212121';
    ctx.beginPath();
    ctx.arc(bottleCenterX, bottleTopY + bottleBodyH + neckH + capH, 2.5, 0, Math.PI * 2);
    ctx.fill();

    // Drip Drop falling animation
    if (state.dripRateMlHr > 0.5 && state.currentWaterL > 0) {
      const dropCycle = (Date.now() % 1200) / 1200; // 0 to 1
      const dropY = (bottleTopY + bottleBodyH + neckH + capH + 4) + (dropCycle * 65);
      ctx.fillStyle = '#0288d1';
      ctx.beginPath();
      ctx.arc(bottleCenterX, dropY, 3, 0, Math.PI * 2);
      ctx.fill();
    }

    // 3. Planter Soil Pot on the Right
    const potX = 175;
    const potY = 160;
    const potW = 150;
    const potH = 135;

    // Soil container
    ctx.fillStyle = '#795548';
    ctx.beginPath();
    ctx.roundRect(potX, potY, potW, potH, [4, 4, 12, 12]);
    ctx.fill();
    ctx.strokeStyle = '#4e342e';
    ctx.lineWidth = 2;
    ctx.stroke();

    // Soil top layer
    ctx.fillStyle = '#5d4037';
    ctx.beginPath();
    ctx.ellipse(potX + potW / 2, potY, potW / 2, 10, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    // Buried cap tube indicator extending into soil
    ctx.strokeStyle = 'rgba(2, 136, 209, 0.5)';
    ctx.setLineDash([3, 3]);
    ctx.beginPath();
    ctx.moveTo(bottleCenterX, bottleTopY + bottleBodyH + neckH + capH);
    ctx.lineTo(bottleCenterX, potY + 45);
    ctx.lineTo(potX + 25, potY + 45);
    ctx.stroke();
    ctx.setLineDash([]);

    // 4. Plant Drawing (Changes appearance based on health)
    drawPlantFoliage(ctx, potX + potW / 2, potY - 5, state.plantHealth, state.plantStatus, inputs.plantType);

    // Labels
    ctx.fillStyle = '#37474f';
    ctx.font = 'bold 11px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('Inverted 2L Bottle', bottleCenterX, bottleTopY - 10);
    ctx.fillText(`${inputs.plantType.toUpperCase()} in ${inputs.soilType.toUpperCase()}`, potX + potW / 2, potY + potH + 18);
  }

  function drawPlantFoliage(ctx, stemBaseX, stemBaseY, health, status, plantType) {
    ctx.save();

    // Leaf color shifts: healthy green -> wilting yellowish brown -> waterlogged yellow
    let leafColor = '#2e7d32'; // Healthy emerald
    let droopAngle = 0;

    if (status === 'wilting') {
      leafColor = '#827717'; // Yellow-brown wilt
      droopAngle = 0.45;     // Leaves hang downward
    } else if (status === 'overwatered') {
      leafColor = '#9e9d24'; // Pale yellow waterlog
      droopAngle = 0.2;
    }

    // Stem
    ctx.strokeStyle = '#33691e';
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.moveTo(stemBaseX, stemBaseY);
    ctx.quadraticCurveTo(stemBaseX + (status === 'wilting' ? 15 : 0), stemBaseY - 45, stemBaseX, stemBaseY - 75);
    ctx.stroke();

    // Leaves
    const leafCount = 6;
    for (let i = 0; i < leafCount; i++) {
      const leafY = stemBaseY - 20 - (i * 10);
      const isRight = i % 2 === 0;
      const angle = (isRight ? 0.5 : -0.5) + (isRight ? droopAngle : -droopAngle);

      ctx.save();
      ctx.translate(stemBaseX, leafY);
      ctx.rotate(angle);

      ctx.fillStyle = leafColor;
      ctx.beginPath();
      ctx.ellipse(20, 0, 16, 7, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#1b5e20';
      ctx.lineWidth = 1;
      ctx.stroke();

      ctx.restore();
    }

    // Flower or head
    if (plantType === 'tomato') {
      ctx.fillStyle = status === 'healthy' ? '#e53935' : '#ff8a80';
      ctx.beginPath();
      ctx.arc(stemBaseX + 12, stemBaseY - 50, 7, 0, Math.PI * 2);
      ctx.fill();
    }

    ctx.restore();
  }

  function renderSoilHeatmap() {
    if (!dom.canvasHeatmap || !state.soilGrid) return;
    Charts.drawHeatmapGrid(dom.canvasHeatmap, state.soilGrid, {
      plantType: getInputs().plantType,
      soilType: getInputs().soilType,
      showRootZone: true
    });
  }

  function renderChart() {
    if (!dom.canvasChart) return;
    const metricType = dom.chartSelect?.value || 'water_and_moisture';

    if (metricType === 'water_and_moisture') {
      Charts.drawLineChart(dom.canvasChart, {
        title: 'Bottle Water Volume (L) & Root Moisture (%) vs Time',
        xLabel: 'Simulation Time (Hours)',
        yLabel: 'Level / Saturation',
        yMin: 0,
        yMax: 2.2,
        series: [
          { name: 'Water (L)', color: Charts.PALETTE.waterBlue, data: state.history.waterLevel },
          { name: 'Moisture (frac)', color: Charts.PALETTE.greenPrimary, data: state.history.rootMoisture.map(p => ({ x: p.x, y: p.y / 100 })) }
        ],
        thresholdBand: { min: 0.45, max: 0.75, label: 'Optimal Moisture Band', color: 'rgba(76, 175, 80, 0.15)' }
      });
    } else if (metricType === 'plant_health') {
      Charts.drawLineChart(dom.canvasChart, {
        title: 'Plant Health Score (0 - 100) vs Time',
        xLabel: 'Simulation Time (Hours)',
        yLabel: 'Health (%)',
        yMin: 0,
        yMax: 105,
        series: [
          { name: 'Health Score', color: Charts.PALETTE.greenPrimary, data: state.history.plantHealth }
        ]
      });
    } else if (metricType === 'cum_water') {
      Charts.drawLineChart(dom.canvasChart, {
        title: 'Cumulative Water Consumed (ml)',
        xLabel: 'Simulation Time (Hours)',
        yLabel: 'Cumulative Volume (ml)',
        yMin: 0,
        series: [
          { name: 'Cumulative Water (ml)', color: Charts.PALETTE.waterBlue, data: state.history.cumWaterUsed }
        ]
      });
    }
  }

  function exportTimeSeriesCsv() {
    const rows = state.history.timeHours.map((h, i) => ({
      hour: h,
      waterVolumeLitres: state.history.waterLevel[i]?.y || 0,
      rootMoisturePercent: state.history.rootMoisture[i]?.y || 0,
      plantHealthScore: state.history.plantHealth[i]?.y || 0,
      cumWaterMl: state.history.cumWaterUsed[i]?.y || 0
    }));
    Storage.exportToCsv(`drip_simulation_${Date.now()}.csv`, rows);
  }

  function saveCurrentRun() {
    const inputs = getInputs();
    const run = Storage.saveRun({
      module: 'module1',
      name: `Drip Feeder Run (${inputs.plantType}, ${inputs.soilType})`,
      parameters: inputs,
      results: {
        simHours: Math.round((state.simMinutes / 60) * 10) / 10,
        finalWaterL: Math.round(state.currentWaterL * 100) / 100,
        finalHealth: state.plantHealth,
        avgDripRateMlHr: state.dripRateMlHr,
        cumWaterUsedMl: Math.round(state.cumWaterUsedMl)
      },
      timeSeries: state.history
    });
    if (run) showNotification('Run saved successfully to localStorage!');
  }

  function loadRun(runData) {
    if (!runData || !runData.parameters) return;
    setInputs(runData.parameters);
  }

  function setOverlayRun(savedRun) {
    state.overlayRun = savedRun;
    renderChart();
  }

  function showNotification(msg) {
    if (window.PlanterUI && window.PlanterUI.showToast) {
      window.PlanterUI.showToast(msg);
    } else {
      console.log(msg);
    }
  }

  function capitalize(str) {
    return str ? str.charAt(0).toUpperCase() + str.slice(1) : '';
  }

  return {
    init,
    renderAll,
    startSimulation,
    pauseSimulation,
    resetSimulation,
    refillBottle,
    setInputs,
    getInputs,
    saveCurrentRun,
    loadRun,
    setOverlayRun,
    exportTimeSeriesCsv,
    getState: () => state
  };
});
