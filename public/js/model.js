/**
 * ============================================================================
 * MODEL.JS - CORE PHYSICS, BIOLOGICAL & MANAGEMENT MATHEMATICAL MODELS
 * ============================================================================
 * Project: "Design and Installation of a Low-Cost Vertical Hydro-Planter
 *          Station Using Repurposed Campus PET Waste"
 * Institution: L. D. College of Engineering (B.E. Sem V IT Micro-Project)
 *
 * NOTE FOR VIVA / EXAMINATION:
 * All simulation equations, conservation laws, soil physics, structural
 * mechanics, and project management algorithms are centralized in this file.
 * Every function includes beginner-friendly comments explaining:
 *   1. The physical or managerial principle behind the formula.
 *   2. The exact mathematical equation used.
 *   3. Real-world assumptions and boundary limitations.
 * ============================================================================
 */

(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory();
  } else {
    root.PlanterModel = factory();
  }
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  // ==========================================================================
  // 1. PHYSICAL CONSTANTS & SYSTEM PARAMETERS
  // ==========================================================================
  const CONSTANTS = {
    g: 9.80665,             // Acceleration due to gravity (m/s^2)
    rho_water: 1.0,         // Water density (kg/L or 1000 kg/m^3)
    pet_bottle_tare: 0.045, // Average mass of an empty 2L PET beverage bottle (kg)
    pet_bottle_diameter: 0.10, // Approximate internal diameter of 2L PET bottle (m)
    soil_grid_size: 20      // 20x20 cell 2D soil discretization grid
  };

  // ==========================================================================
  // 2. SOIL CHARACTERISTICS DATABASE
  // ==========================================================================
  // Field capacity: maximum moisture fraction soil can hold against gravity.
  // Porosity: volumetric fraction of void spaces capable of holding air or water.
  // Diffusion rate: speed at which water spreads horizontally and vertically via capillary action.
  // Dry bulk density: weight per unit volume when completely dry (kg/L).
  const SOIL_TYPES = {
    cocopeat: {
      name: 'Coco-Peat (Coir Fiber)',
      porosity: 0.85,           // Very high sponge-like porosity (85% pore volume)
      fieldCapacity: 0.85,      // Retains up to 85% volumetric moisture
      wiltingPoint: 0.15,       // Water unavailable below 15%
      diffusionCoeff: 0.18,     // Strong capillary wicking across fibers
      dryDensity: 0.12,         // Very lightweight: only 0.12 kg per liter!
      drainageCoeff: 0.05,      // Low downward gravity loss; high capillary retention
      description: 'Extremely lightweight, high water retention, neutral pH. Ideal for suspended wall planters.'
    },
    garden_soil: {
      name: 'Standard Garden Soil (Loam/Clay)',
      porosity: 0.45,
      fieldCapacity: 0.50,
      wiltingPoint: 0.20,
      diffusionCoeff: 0.07,     // Poor horizontal capillary spread; tends to channel
      dryDensity: 1.25,         // Heavy: 1.25 kg per liter (10x heavier than coco-peat!)
      drainageCoeff: 0.15,      // Rapid downward percolation loss
      description: 'Heavy mineral soil with compaction tendency and poor lateral capillary spread.'
    },
    mix: {
      name: '50:50 Coco-Peat & Garden Soil Mix',
      porosity: 0.65,
      fieldCapacity: 0.68,
      wiltingPoint: 0.18,
      diffusionCoeff: 0.13,
      dryDensity: 0.68,         // Moderate density: ~0.68 kg per liter
      drainageCoeff: 0.09,
      description: 'Balanced mix providing structural anchorage from soil and moisture retention from coir.'
    }
  };

  // ==========================================================================
  // 3. PLANT DATABASE & WATER DEMAND
  // ==========================================================================
  // Daily water demand (ml/day) calibrated for LDCE campus climate (Ahmedabad).
  // Optimal moisture band: range of soil saturation fraction where plant thrives.
  const PLANT_TYPES = {
    mint: {
      name: 'Mint (Pudina)',
      dailyDemandMl: 120,
      optMoistureMin: 0.45,
      optMoistureMax: 0.75,
      rootDepthFraction: 0.55,
      resilience: 0.8, // Recovers well from mild stress
      description: 'Fast-growing herb with fibrous shallow roots. High moisture preference.'
    },
    pothos: {
      name: 'Money Plant (Pothos)',
      dailyDemandMl: 80,
      optMoistureMin: 0.35,
      optMoistureMax: 0.65,
      rootDepthFraction: 0.65,
      resilience: 0.9, // Extremely hardy indoor/outdoor vine
      description: 'Resilient climbing vine; tolerates mild drought and fluctuating moisture.'
    },
    coriander: {
      name: 'Coriander (Dhaniya)',
      dailyDemandMl: 100,
      optMoistureMin: 0.40,
      optMoistureMax: 0.70,
      rootDepthFraction: 0.50,
      resilience: 0.6, // Sensitive to waterlogging
      description: 'Delicate herb prone to rapid wilting under dry heat; needs steady moisture.'
    },
    chives: {
      name: 'Garlic Chives',
      dailyDemandMl: 70,
      optMoistureMin: 0.35,
      optMoistureMax: 0.65,
      rootDepthFraction: 0.60,
      resilience: 0.85,
      description: 'Hardy perennial herb with low water demand and upright foliage.'
    },
    tomato: {
      name: 'Cherry Tomato',
      dailyDemandMl: 260,
      optMoistureMin: 0.50,
      optMoistureMax: 0.85,
      rootDepthFraction: 0.80,
      resilience: 0.7,
      description: 'Fruiting plant with vigorous root system and substantial transpiration demand.'
    },
    succulents: {
      name: 'Hardy Succulents (Sedum / Jade)',
      dailyDemandMl: 25,
      optMoistureMin: 0.15,
      optMoistureMax: 0.40,
      rootDepthFraction: 0.40,
      resilience: 0.95,
      description: 'Desert-adapted xerophyte storing water in fleshy leaves; hates wet feet.'
    }
  };

  // ==========================================================================
  // 4. ROPE & FASTENER STRUCTURAL RATINGS
  // ==========================================================================
  // Breaking strength in kilogram-force (kgf), where 1 kgf ≈ 9.80665 N.
  const ROPE_TYPES = {
    twine: {
      name: 'Natural Jute Twine / Coir Cord',
      breakingStrengthKg: 18.0,
      degradationRatePerMonth: 0.08, // Decays rapidly when exposed to water/fungus
      description: 'Traditional organic twine. Prone to microbial rot when wet.'
    },
    nylon: {
      name: 'Braided Nylon / Polypropylene Cord',
      breakingStrengthKg: 95.0,
      degradationRatePerMonth: 0.01, // Highly rot-resistant; gradual UV embrittlement
      description: 'Synthetic high-tensile braided cord. Excellent moisture and fungal resistance.'
    },
    wire: {
      name: 'Galvanized Steel Wire (1.5 mm)',
      breakingStrengthKg: 220.0,
      degradationRatePerMonth: 0.002,
      description: 'High tensile non-stretch steel wire. Impervious to wet rot.'
    }
  };

  // ==========================================================================
  // 5. MODULE 1: DRIP FEEDER & SOIL MOISTURE PHYSICS
  // ==========================================================================
  /**
   * Calculates water head height inside the inverted bottle.
   * Assumes cylindrical reservoir profile of diameter D = 0.10 m.
   *
   * @param {number} currentVolumeLitres - Water remaining in bottle (L)
   * @param {number} totalCapacityLitres - Total bottle volume (e.g. 2.0 L)
   * @returns {number} Water head height in meters (m)
   */
  function calculateWaterHead(currentVolumeLitres, totalCapacityLitres) {
    if (currentVolumeLitres <= 0) return 0;
    // Volume in m^3: 1 L = 0.001 m^3
    const volM3 = currentVolumeLitres * 0.001;
    const radiusM = CONSTANTS.pet_bottle_diameter / 2;
    const crossAreaM2 = Math.PI * radiusM * radiusM;
    // Maximum height of water column for 2L bottle ≈ 0.25 m (25 cm)
    const headHeightM = volM3 / crossAreaM2;
    return Math.max(0, headHeightM);
  }

  /**
   * Torricelli's Law with Soil Back-Pressure, Viscous Drag & Clogging
   *
   * Formula:
   *   Q_ideal = A_hole * sqrt(2 * g * h)
   *   Q_actual = Cd * A_hole * sqrt(2 * g * h) * (1 - Clogging) * F_backpressure * K_calib
   *
   * Where:
   *   Cd ≈ 0.60 (Discharge coefficient for sharp-edged circular orifice)
   *   A_hole = pi * (d / 2)^2
   *   h = Water head height (m)
   *   F_backpressure = Counter-pressure from wet compacted soil at the cap interface
   *   K_calib = Scaling constant to match capillary micro-drip rates in buried soil (default ~0.002)
   *
   * @param {Object} params
   * @returns {Object} Flow rates in ml/min and ml/hr, plus intermediate parameters
   */
  function calculateTorricelliDripRate(params) {
    const {
      currentVolumeL = 2.0,
      totalCapacityL = 2.0,
      holeDiameterMm = 2.0,
      cloggingPercent = 0,
      rootZoneSaturation = 0.5,
      calibrationFactor = 0.002,
      dischargeCoeff = 0.60
    } = params;

    if (currentVolumeL <= 0) {
      return {
        dripRateMlMin: 0,
        dripRateMlHr: 0,
        headHeightM: 0,
        backpressureFactor: 1.0,
        isDry: true
      };
    }

    const headM = calculateWaterHead(currentVolumeL, totalCapacityL);
    if (headM <= 0.0001) {
      return {
        dripRateMlMin: 0,
        dripRateMlHr: 0,
        headHeightM: 0,
        backpressureFactor: 1.0,
        isDry: true
      };
    }

    // Orifice area in m^2
    const dM = (holeDiameterMm / 1000); // mm to m
    const areaM2 = Math.PI * Math.pow(dM / 2, 2);

    // Torricelli ideal velocity: v = sqrt(2 * g * h)
    const vIdeal = Math.sqrt(2 * CONSTANTS.g * headM);

    // Clogging degradation factor (0 to 1)
    const clogFactor = Math.max(0, Math.min(1, 1 - (cloggingPercent / 100)));

    // Soil backpressure: as soil becomes saturated, hydraulic gradient drops,
    // resisting further gravity outflow.
    // At saturation = 0, backpressure factor = 1.0; at saturation = 1, drops to ~0.25.
    const backpressureFactor = Math.max(0.15, 1.0 - (0.75 * Math.min(1, rootZoneSaturation)));

    // Volumetric flow rate in m^3/s
    const qM3s = dischargeCoeff * areaM2 * vIdeal * clogFactor * backpressureFactor * calibrationFactor;

    // Convert m^3/s to ml/min (1 m^3 = 1,000,000 ml; 1 s = 1/60 min)
    const dripRateMlMin = qM3s * 1000000 * 60;
    const dripRateMlHr = dripRateMlMin * 60;

    return {
      dripRateMlMin: Math.max(0, dripRateMlMin),
      dripRateMlHr: Math.max(0, dripRateMlHr),
      headHeightM: headM,
      backpressureFactor,
      isDry: false
    };
  }

  /**
   * Initializes a 20x20 2D soil moisture grid.
   *
   * @param {number} initialMoistureFraction - e.g. 0.3 for moderately dry soil
   * @returns {Array<Array<number>>} 20x20 2D array of moisture values [0 to 1]
   */
  function createSoilGrid(initialMoistureFraction = 0.35) {
    const size = CONSTANTS.soil_grid_size;
    const grid = [];
    for (let r = 0; r < size; r++) {
      const row = [];
      for (let c = 0; c < size; c++) {
        // Slight natural variance across soil pack
        const variance = (Math.sin(r * 1.5) * Math.cos(c * 1.5)) * 0.03;
        const val = Math.max(0.05, Math.min(1.0, initialMoistureFraction + variance));
        row.push(val);
      }
      grid.push(row);
    }
    return grid;
  }

  /**
   * Updates 2D Soil Moisture Grid for one simulation minute using finite differences.
   *
   * Governing equation:
   *   dTheta/dt = D * (d^2Theta/dx^2 + d^2Theta/dy^2) + S_inflow - J_gravity - E_evap - U_root
   *
   * @param {Object} ctx - Simulation state context
   * @returns {Object} Updated grid, average root moisture, losses
   */
  function updateSoilGridStep(ctx) {
    const {
      grid,
      soilTypeKey = 'cocopeat',
      plantTypeKey = 'mint',
      dripRateMlMin = 0.5,
      temperatureC = 30,
      sunlight = 'partial', // 'shade', 'partial', 'full'
      timeOfDayHours = 12,
      dtMinutes = 1
    } = ctx;

    const soil = SOIL_TYPES[soilTypeKey] || SOIL_TYPES.cocopeat;
    const plant = PLANT_TYPES[plantTypeKey] || PLANT_TYPES.mint;
    const size = CONSTANTS.soil_grid_size;

    // Create copy for synchronous finite difference step
    const nextGrid = [];
    for (let r = 0; r < size; r++) {
      nextGrid.push([...grid[r]]);
    }

    // 1. Water Inflow at Drip Cap Emitter
    // Emitter is buried near the top center: r = 2..4, c = 9..10
    // Total soil volume in a 2L bottle planter is ~1500 ml.
    // 20x20 = 400 cells -> ~3.75 ml water per cell at 100% saturation.
    const mlPerCellSaturation = 3.75;
    const emitterCells = [
      { r: 2, c: 9 }, { r: 2, c: 10 },
      { r: 3, c: 9 }, { r: 3, c: 10 }
    ];
    const waterAddedPerCell = (dripRateMlMin * dtMinutes) / emitterCells.length;
    emitterCells.forEach(cell => {
      const deltaSat = waterAddedPerCell / mlPerCellSaturation;
      nextGrid[cell.r][cell.c] = Math.min(1.0, nextGrid[cell.r][cell.c] + deltaSat);
    });

    // 2. Diffusion across neighboring cells (Capillary wicking)
    const D = soil.diffusionCoeff * 0.15; // Scaled diffusion rate for 1-minute step
    const tempGrid = [];
    for (let r = 0; r < size; r++) {
      tempGrid.push([...nextGrid[r]]);
    }

    for (let r = 0; r < size; r++) {
      for (let c = 0; c < size; c++) {
        const center = tempGrid[r][c];
        const top = (r > 0) ? tempGrid[r - 1][c] : center;
        const bottom = (r < size - 1) ? tempGrid[r + 1][c] : center;
        const left = (c > 0) ? tempGrid[r][c - 1] : center;
        const right = (c < size - 1) ? tempGrid[r][c + 1] : center;

        // Laplacian operator: d^2Theta/dx^2 + d^2Theta/dy^2
        const laplacian = (top + bottom + left + right) - (4 * center);
        nextGrid[r][c] += D * laplacian;

        // Gravity drainage bias downwards
        if (r < size - 1 && center > soil.fieldCapacity) {
          const excess = (center - soil.fieldCapacity) * soil.drainageCoeff * 0.05;
          nextGrid[r][c] -= excess;
          nextGrid[r + 1][c] += excess * 0.8; // 20% lost as planter drainage
        }
      }
    }

    // 3. Evaporation Loss from Top Soil Surface (Row r = 0..1)
    // Evaporation scales with temperature and solar radiation
    let sunFactor = 0.5;
    if (sunlight === 'partial') sunFactor = 1.0;
    if (sunlight === 'full') sunFactor = 1.6;

    // Diurnal factor: higher during daytime (10:00 - 16:00)
    const diurnalFactor = Math.max(0.1, Math.sin((Math.PI * (timeOfDayHours - 6)) / 12));
    const evapLossRate = 0.0003 * Math.pow(temperatureC / 25, 1.4) * sunFactor * diurnalFactor * dtMinutes;

    for (let c = 0; c < size; c++) {
      nextGrid[0][c] = Math.max(0.02, nextGrid[0][c] - (evapLossRate * 1.5));
      nextGrid[1][c] = Math.max(0.02, nextGrid[1][c] - (evapLossRate * 0.6));
    }

    // 4. Plant Root Water Uptake
    // Root zone is distributed around middle-lower depth: rows 6 to 14, columns 6 to 13
    const rootRowStart = 6;
    const rootRowEnd = Math.min(size - 2, Math.floor(size * plant.rootDepthFraction));
    const rootColStart = 6;
    const rootColEnd = 13;

    // Daily demand split by minute, with daytime transpiration weighting
    const baseDemandPerMin = (plant.dailyDemandMl / 1440) * dtMinutes;
    // Transpiration peak at midday:
    const transFactor = (timeOfDayHours >= 6 && timeOfDayHours <= 18)
      ? 1.0 + Math.sin(Math.PI * (timeOfDayHours - 6) / 12)
      : 0.2;
    const currentDemandMl = baseDemandPerMin * transFactor;

    let rootCellsCount = 0;
    let totalRootMoisture = 0;

    for (let r = rootRowStart; r <= rootRowEnd; r++) {
      for (let c = rootColStart; c <= rootColEnd; c++) {
        rootCellsCount++;
        totalRootMoisture += nextGrid[r][c];
      }
    }

    const avgRootMoisture = rootCellsCount > 0 ? (totalRootMoisture / rootCellsCount) : 0.5;

    // Draw water from roots proportional to moisture availability
    const uptakePerCell = (currentDemandMl / (rootCellsCount || 1)) / mlPerCellSaturation;
    for (let r = rootRowStart; r <= rootRowEnd; r++) {
      for (let c = rootColStart; c <= rootColEnd; c++) {
        // If soil is above wilting point, root can absorb moisture
        if (nextGrid[r][c] > soil.wiltingPoint) {
          nextGrid[r][c] = Math.max(soil.wiltingPoint * 0.8, nextGrid[r][c] - uptakePerCell);
        }
      }
    }

    // Clamp all cells between 0.02 (residual hygroscopic) and 1.0 (saturation)
    for (let r = 0; r < size; r++) {
      for (let c = 0; c < size; c++) {
        nextGrid[r][c] = Math.max(0.02, Math.min(1.0, nextGrid[r][c]));
      }
    }

    return {
      grid: nextGrid,
      avgRootMoisture: Math.max(0.02, Math.min(1.0, avgRootMoisture)),
      evaporatedMlThisStep: evapLossRate * size * mlPerCellSaturation,
      plantAbsorbedMlThisStep: currentDemandMl
    };
  }

  /**
   * Evaluates Plant Health Score (0 - 100) and Stress based on root moisture.
   *
   * @param {Object} params
   * @returns {Object} Health score, stress factor, condition status ('healthy'|'wilting'|'overwatered')
   */
  function evaluatePlantHealth(params) {
    const {
      currentHealth = 100,
      rootMoisture = 0.55,
      plantTypeKey = 'mint',
      dtMinutes = 1
    } = params;

    const plant = PLANT_TYPES[plantTypeKey] || PLANT_TYPES.mint;
    let stress = 0;
    let status = 'healthy';

    if (rootMoisture < plant.optMoistureMin) {
      // Under-watering stress: parabolic penalty as it approaches wilting point
      const deficit = plant.optMoistureMin - rootMoisture;
      stress = Math.pow(deficit / plant.optMoistureMin, 1.8);
      status = 'wilting';
    } else if (rootMoisture > plant.optMoistureMax) {
      // Over-watering stress: roots lack aeration (hypoxia / root rot risk)
      const excess = rootMoisture - plant.optMoistureMax;
      stress = Math.pow(excess / (1.0 - plant.optMoistureMax), 1.8);
      status = 'overwatered';
    } else {
      // Within optimal band!
      stress = 0;
      status = 'healthy';
    }

    // Health evolution equation:
    // When stressed, health declines at a rate modulated by plant resilience.
    // When healthy, health slowly recovers towards 100.
    const decaySpeed = (1.0 - (plant.resilience * 0.5)) * 0.05 * (dtMinutes / 60);
    const recoverySpeed = 0.03 * (dtMinutes / 60);

    let nextHealth = currentHealth;
    if (stress > 0) {
      nextHealth -= stress * decaySpeed * 100;
    } else {
      nextHealth += recoverySpeed * (100 - currentHealth);
    }

    nextHealth = Math.max(0, Math.min(100, nextHealth));

    return {
      healthScore: Math.round(nextHealth * 10) / 10,
      stressFactor: Math.min(1.0, stress),
      status: status,
      isWilting: status === 'wilting',
      isOverwatered: status === 'overwatered',
      isOptimal: status === 'healthy'
    };
  }

  // ==========================================================================
  // 6. MODULE 2: WATER EFFICIENCY COMPARISON MODEL
  // ==========================================================================
  /**
   * Compares 7 to 30 days of Traditional Surface Watering vs Inverted Drip.
   *
   * Physical reasoning:
   * 1. Surface watering creates a wet surface layer exposed to direct solar heat
   *    and wind, causing 30-45% evaporation loss.
   * 2. Rapid dumping of water overflows the small bottle rim, causing 15-25% runoff.
   * 3. Gravity percolation drains 10-15% past shallow roots before uptake.
   * 4. Inverted bottle drip delivers water directly subsurface next to root zone,
   *    reducing evaporation to <5% and runoff to 0%.
   *
   * @param {Object} inputs
   * @returns {Object} Full daily comparison data and savings breakdown
   */
  function simulateWaterEfficiencyComparison(inputs) {
    const {
      days = 7,
      waterSource = 'ro_reject', // 'fresh_water', 'ro_reject', 'canteen_leftover'
      plantTypeKey = 'mint',
      surfaceEvapLoss = 35,      // %
      surfaceRunoffLoss = 20,    // %
      surfacePercolationLoss = 15,// %
      dripEvapLoss = 4,          // %
      dripRunoffLoss = 0,        // %
      dripPercolationLoss = 6    // %
    } = inputs;

    const plant = PLANT_TYPES[plantTypeKey] || PLANT_TYPES.mint;
    const dailyRootDemandLitres = plant.dailyDemandMl / 1000; // e.g. 0.12 L/day

    // Efficiency calculations:
    // Useful root delivery fraction:
    const surfaceUsefulFraction = Math.max(0.1, 1 - ((surfaceEvapLoss + surfaceRunoffLoss + surfacePercolationLoss) / 100));
    const dripUsefulFraction = Math.max(0.5, 1 - ((dripEvapLoss + dripRunoffLoss + dripPercolationLoss) / 100));

    // To satisfy daily root demand, how much total water must be poured?
    const surfaceDailyRequiredLitres = dailyRootDemandLitres / surfaceUsefulFraction;
    const dripDailyRequiredLitres = dailyRootDemandLitres / dripUsefulFraction;

    const timeSeries = [];
    let cumSurfaceLitres = 0;
    let cumDripLitres = 0;
    let cumLitresSaved = 0;

    for (let day = 1; day <= days; day++) {
      cumSurfaceLitres += surfaceDailyRequiredLitres;
      cumDripLitres += dripDailyRequiredLitres;
      cumLitresSaved = cumSurfaceLitres - cumDripLitres;

      timeSeries.push({
        day,
        surfaceDaily: surfaceDailyRequiredLitres,
        dripDaily: dripDailyRequiredLitres,
        cumSurface: Math.round(cumSurfaceLitres * 100) / 100,
        cumDrip: Math.round(cumDripLitres * 100) / 100,
        cumSaved: Math.round(cumLitresSaved * 100) / 100,
        percentSaved: Math.round(((cumSurfaceLitres - cumDripLitres) / cumSurfaceLitres) * 1000) / 10
      });
    }

    const totalSurfaceL = cumSurfaceLitres;
    const totalDripL = cumDripLitres;
    const totalSavedL = cumLitresSaved;
    const overallPercentSaved = Math.round((totalSavedL / totalSurfaceL) * 1000) / 10;

    // Compare with report's "Up to 70%" claim:
    const matchesReportClaim = overallPercentSaved >= 65 && overallPercentSaved <= 75;

    // Environmental metrics based on water source:
    let potableSavedL = 0;
    let roRejectUtilizedL = 0;
    if (waterSource === 'ro_reject' || waterSource === 'canteen_leftover') {
      // Inverted drip uses 100% reject/leftover water -> preserves 100% potable water!
      potableSavedL = totalSurfaceL;
      roRejectUtilizedL = totalDripL;
    } else {
      potableSavedL = totalSavedL;
    }

    return {
      timeSeries,
      totalSurfaceL: Math.round(totalSurfaceL * 100) / 100,
      totalDripL: Math.round(totalDripL * 100) / 100,
      totalSavedL: Math.round(totalSavedL * 100) / 100,
      overallPercentSaved,
      matchesReportClaim,
      waterSource,
      potableSavedL: Math.round(potableSavedL * 100) / 100,
      roRejectUtilizedL: Math.round(roRejectUtilizedL * 100) / 100,
      lossBreakdown: {
        surface: {
          evaporation: Math.round(surfaceDailyRequiredLitres * (surfaceEvapLoss / 100) * days * 100) / 100,
          runoff: Math.round(surfaceDailyRequiredLitres * (surfaceRunoffLoss / 100) * days * 100) / 100,
          percolation: Math.round(surfaceDailyRequiredLitres * (surfacePercolationLoss / 100) * days * 100) / 100,
          useful: Math.round(dailyRootDemandLitres * days * 100) / 100
        },
        drip: {
          evaporation: Math.round(dripDailyRequiredLitres * (dripEvapLoss / 100) * days * 100) / 100,
          runoff: Math.round(dripDailyRequiredLitres * (dripRunoffLoss / 100) * days * 100) / 100,
          percolation: Math.round(dripDailyRequiredLitres * (dripPercolationLoss / 100) * days * 100) / 100,
          useful: Math.round(dailyRootDemandLitres * days * 100) / 100
        }
      }
    };
  }

  // ==========================================================================
  // 7. MODULE 3: HANGING PLANTER LOAD AND STRUCTURAL SAFETY
  // ==========================================================================
  /**
   * Calculates structural loads, tension forces, and safety factors for
   * vertical multi-tier hanging bottle planters.
   *
   * Formulations:
   *   Dry Mass per bottle = M_PET + (V_soil * rho_soil_dry) + M_plant
   *   Water Mass per bottle = V_soil * Porosity * Saturation% * rho_water
   *   Total Mass per bottle = Dry Mass + Water Mass
   *   Total Weight on Hook (kgf) = sum(Total Mass of N bottles)
   *   Tension per rope strand = Total Weight / n_strands
   *   Safety Factor (SF_rope) = (Rope Breaking Strength * n_strands) / Total Weight
   *   Safety Factor (SF_hook) = Hook Rating / Total Weight
   *   Overall SF = min(SF_rope, SF_hook)
   *
   * Safety Criterion:
   *   SF >= 2.0  -> Safe (Green)
   *   1.0 <= SF < 2.0 -> Marginal / Risky (Orange)
   *   SF < 1.0   -> Structural Failure / Collapse (Red)
   *
   * @param {Object} inputs
   * @returns {Object} Structural load analysis and verdict
   */
  function calculatePlanterLoadAndSafety(inputs) {
    const {
      bottleCount = 4,
      soilVolumeL = 1.5,
      soilTypeKey = 'cocopeat',
      saturationPercent = 60,
      plantMassKg = 0.10,
      ropeTypeKey = 'nylon',
      ropeStrands = 2,
      hookRatingKg = 50.0
    } = inputs;

    const soil = SOIL_TYPES[soilTypeKey] || SOIL_TYPES.cocopeat;
    const rope = ROPE_TYPES[ropeTypeKey] || ROPE_TYPES.nylon;

    // 1. Mass per bottle:
    const petTareKg = CONSTANTS.pet_bottle_tare; // 0.045 kg
    const drySoilMassKg = soilVolumeL * soil.dryDensity;
    const dryBottleMassKg = petTareKg + drySoilMassKg + plantMassKg;

    // Water added: volume * porosity * saturation fraction * 1 kg/L
    const saturationFraction = Math.max(0, Math.min(1.0, saturationPercent / 100));
    const waterMassKg = soilVolumeL * soil.porosity * saturationFraction * CONSTANTS.rho_water;
    const wetBottleMassKg = dryBottleMassKg + waterMassKg;

    // 2. Total stack load on top anchor hook:
    const totalDryLoadKg = dryBottleMassKg * bottleCount;
    const totalWetLoadKg = wetBottleMassKg * bottleCount;
    const totalWaterOnlyKg = waterMassKg * bottleCount;

    // 3. Tension per rope strand:
    const strands = Math.max(1, ropeStrands);
    const tensionPerStrandKg = totalWetLoadKg / strands;

    // 4. Safety factors:
    const totalRopeCapacityKg = rope.breakingStrengthKg * strands;
    const safetyFactorRope = totalWetLoadKg > 0 ? (totalRopeCapacityKg / totalWetLoadKg) : 999;
    const safetyFactorHook = totalWetLoadKg > 0 ? (hookRatingKg / totalWetLoadKg) : 999;
    const safetyFactor = Math.min(safetyFactorRope, safetyFactorHook);

    // 5. Verdict & Visual Warning
    let verdict = 'Safe';
    let statusClass = 'safe'; // 'safe', 'warning', 'danger'
    let message = 'Stack is well within safe structural limits (Safety Factor > 2.0).';

    if (safetyFactor < 1.0) {
      verdict = 'Will Fail (Catastrophic Collapse)';
      statusClass = 'danger';
      message = (safetyFactorHook < 1.0)
        ? `Top wall hook capacity exceeded (${hookRatingKg} kgf rated vs ${Math.round(totalWetLoadKg * 10) / 10} kgf load)! Hook will tear out.`
        : `Rope tension (${Math.round(tensionPerStrandKg * 10) / 10} kgf/strand) exceeds breaking strength (${rope.breakingStrengthKg} kgf)! Cord will snap.`;
    } else if (safetyFactor < 2.0) {
      verdict = 'Risky (Marginal Safety Margin)';
      statusClass = 'warning';
      message = `Safety factor is ${Math.round(safetyFactor * 100) / 100} (below engineering standard of 2.0). Wet conditions or wind flutter may cause fatigue failure.`;
    }

    return {
      bottleCount,
      dryBottleMassKg: Math.round(dryBottleMassKg * 1000) / 1000,
      wetBottleMassKg: Math.round(wetBottleMassKg * 1000) / 1000,
      waterMassPerBottleKg: Math.round(waterMassKg * 1000) / 1000,
      totalDryLoadKg: Math.round(totalDryLoadKg * 100) / 100,
      totalWetLoadKg: Math.round(totalWetLoadKg * 100) / 100,
      totalWaterOnlyKg: Math.round(totalWaterOnlyKg * 100) / 100,
      tensionPerStrandKg: Math.round(tensionPerStrandKg * 100) / 100,
      ropeBreakingStrengthKg: rope.breakingStrengthKg,
      totalRopeCapacityKg,
      hookRatingKg,
      safetyFactorRope: Math.round(safetyFactorRope * 100) / 100,
      safetyFactorHook: Math.round(safetyFactorHook * 100) / 100,
      safetyFactor: Math.round(safetyFactor * 100) / 100,
      verdict,
      statusClass,
      message,
      cocoPeatAdvantageRatio: Math.round((SOIL_TYPES.garden_soil.dryDensity / SOIL_TYPES.cocopeat.dryDensity) * 10) / 10
    };
  }

  // ==========================================================================
  // 8. MODULE 4: 7-DAY TESTING & MONITORING SIMULATOR
  // ==========================================================================
  /**
   * Generates a 7-day (168-hour) environmental timeline simulating day/night cycles,
   * solar radiation, ambient temperature variations, algae accumulation,
   * and live intervention responses.
   *
   * @param {Object} options
   * @returns {Object} Hourly timeseries log, event log, summary score card
   */
  function simulate7DayLifecycle(options = {}) {
    const {
      weatherPattern = 'typical', // 'typical', 'heatwave', 'rainy'
      initialHoleDiameterMm = 2.0,
      initialBottleCapacityL = 2.0,
      soilTypeKey = 'cocopeat',
      plantTypeKey = 'mint',
      hasBlackPaint = false,
      hasShadeNet = false,
      interventions = [] // array of { hour, type: 'refill'|'adjust_hole'|'paint_black'|'add_shade', value }
    } = options;

    const plant = PLANT_TYPES[plantTypeKey] || PLANT_TYPES.mint;
    const soil = SOIL_TYPES[soilTypeKey] || SOIL_TYPES.cocopeat;

    const hourlyLogs = [];
    let bottleWaterL = initialBottleCapacityL;
    let currentHoleMm = initialHoleDiameterMm;
    let paintedBlack = hasBlackPaint;
    let shaded = hasShadeNet;
    let algaeLevelPercent = 0;
    let rootMoisture = 0.60;
    let plantHealth = 100;
    let cumWaterUsedMl = 0;

    const interventionMap = {};
    interventions.forEach(inv => {
      interventionMap[inv.hour] = inv;
    });

    for (let hour = 0; hour < 168; hour++) {
      const dayNum = Math.floor(hour / 24) + 1;
      const hourOfDay = hour % 24;

      // Check for interventions scheduled at this hour
      let interventionNote = '';
      if (interventionMap[hour]) {
        const inv = interventionMap[hour];
        if (inv.type === 'refill') {
          bottleWaterL = initialBottleCapacityL;
          interventionNote = 'Bottle refilled to capacity (2L).';
        } else if (inv.type === 'adjust_hole') {
          currentHoleMm = Number(inv.value) || 2.0;
          interventionNote = `Cap hole adjusted to ${currentHoleMm} mm.`;
        } else if (inv.type === 'paint_black') {
          paintedBlack = true;
          interventionNote = 'Painted bottle exterior black (UV & algae shield applied).';
        } else if (inv.type === 'add_shade') {
          shaded = true;
          interventionNote = 'Installed 50% green agro-shade net overhead.';
        }
      }

      // Diurnal temperature sinusoidal curve:
      // Minimum at 5:00 AM, maximum at 2:00 PM (hour 14)
      let baseTemp = 30;
      let tempSwing = 8;
      if (weatherPattern === 'heatwave') {
        baseTemp = 36;
        tempSwing = 9;
      } else if (weatherPattern === 'rainy') {
        baseTemp = 26;
        tempSwing = 4;
      }

      // Sinusoidal day/night swing:
      const diurnalPhase = (2 * Math.PI * (hourOfDay - 8)) / 24;
      let ambientTemp = baseTemp + (tempSwing * Math.sin(diurnalPhase));
      if (shaded) ambientTemp -= 3.5; // Shade net lowers ambient microclimate

      // Solar radiation (0 at night, peaks at 12:00 noon)
      let solarIntensity = 0;
      if (hourOfDay >= 6 && hourOfDay <= 18) {
        solarIntensity = Math.sin((Math.PI * (hourOfDay - 6)) / 12);
        if (shaded) solarIntensity *= 0.5;
      }

      // Algae Growth Calculation:
      // Clear PET bottles in sunlight allow photo-autotrophic algae colonization.
      // Painting bottle black reduces photosynthetically active radiation (PAR) to 0.
      if (!paintedBlack && solarIntensity > 0.1) {
        const growthIncrement = 0.35 * solarIntensity * (ambientTemp / 30);
        algaeLevelPercent = Math.min(100, algaeLevelPercent + growthIncrement);
      } else if (paintedBlack && algaeLevelPercent > 0) {
        // Algae slowly dies back without light
        algaeLevelPercent = Math.max(0, algaeLevelPercent - 0.2);
      }

      // Algae clogging effect:
      const bioClog = Math.min(90, algaeLevelPercent * 0.7);

      // Torricelli drip over this hour
      const drip = calculateTorricelliDripRate({
        currentVolumeL: bottleWaterL,
        totalCapacityL: initialBottleCapacityL,
        holeDiameterMm: currentHoleMm,
        cloggingPercent: bioClog,
        rootZoneSaturation: rootMoisture,
        calibrationFactor: 0.002
      });

      const dripMlThisHour = drip.dripRateMlHr;
      const dripLThisHour = dripMlThisHour / 1000;
      bottleWaterL = Math.max(0, bottleWaterL - dripLThisHour);
      cumWaterUsedMl += dripMlThisHour;

      // Soil moisture dynamics over this hour
      // Inflow increases moisture; evaporation & root uptake decrease it
      const inflowEffect = (dripMlThisHour / 1500) * 0.8;
      const evapEffect = 0.015 * Math.pow(ambientTemp / 28, 1.3) * (0.5 + solarIntensity * 0.8);
      const rootUptakeEffect = (plant.dailyDemandMl / 24) / 1500 * (solarIntensity > 0 ? 1.4 : 0.4);

      rootMoisture += (inflowEffect - evapEffect - rootUptakeEffect);
      rootMoisture = Math.max(0.08, Math.min(0.95, rootMoisture));

      // Plant Health Evaluation
      const healthEval = evaluatePlantHealth({
        currentHealth: plantHealth,
        rootMoisture: rootMoisture,
        plantTypeKey: plantTypeKey,
        dtMinutes: 60
      });
      plantHealth = healthEval.healthScore;

      // Status label
      let statusWarning = '';
      if (bottleWaterL <= 0.05) statusWarning = 'Bottle Empty! Refill needed.';
      else if (algaeLevelPercent > 50) statusWarning = 'High Algae detected inside clear bottle.';
      else if (healthEval.isWilting) statusWarning = 'Plant Wilting (under-watered).';
      else if (healthEval.isOverwatered) statusWarning = 'Soil Waterlogged (over-watered).';

      hourlyLogs.push({
        hour,
        dayNum,
        hourOfDay,
        formattedTime: `Day ${dayNum}, ${String(hourOfDay).padStart(2, '0')}:00`,
        ambientTemp: Math.round(ambientTemp * 10) / 10,
        solarIntensity: Math.round(solarIntensity * 100) / 100,
        bottleWaterL: Math.round(bottleWaterL * 100) / 100,
        dripRateMlHr: Math.round(dripMlThisHour * 10) / 10,
        rootMoisture: Math.round(rootMoisture * 100),
        plantHealth: Math.round(plantHealth * 10) / 10,
        algaeLevelPercent: Math.round(algaeLevelPercent * 10) / 10,
        statusWarning,
        interventionNote
      });
    }

    // 7-Day Performance Report Card:
    const avgHealth = hourlyLogs.reduce((sum, l) => sum + l.plantHealth, 0) / hourlyLogs.length;
    const finalHealth = plantHealth;
    const peakAlgae = Math.max(...hourlyLogs.map(l => l.algaeLevelPercent));
    const moistureVariance = calculateStandardDeviation(hourlyLogs.map(l => l.rootMoisture));

    let letterGrade = 'A';
    if (avgHealth >= 90) letterGrade = 'A+';
    else if (avgHealth >= 80) letterGrade = 'A';
    else if (avgHealth >= 70) letterGrade = 'B';
    else if (avgHealth >= 55) letterGrade = 'C';
    else letterGrade = 'D';

    return {
      hourlyLogs,
      summary: {
        letterGrade,
        averageHealthScore: Math.round(avgHealth * 10) / 10,
        finalHealthScore: Math.round(finalHealth * 10) / 10,
        cumulativeWaterUsedL: Math.round((cumWaterUsedMl / 1000) * 100) / 100,
        peakAlgaePercent: Math.round(peakAlgae * 10) / 10,
        moistureStabilityIndex: Math.round((100 - moistureVariance * 2) * 10) / 10,
        interventionsCount: Object.keys(interventionMap).length
      }
    };
  }

  function calculateStandardDeviation(arr) {
    if (!arr || arr.length === 0) return 0;
    const mean = arr.reduce((a, b) => a + b, 0) / arr.length;
    const variance = arr.reduce((a, b) => a + Math.pow(b - mean, 2), 0) / arr.length;
    return Math.sqrt(variance);
  }

  // ==========================================================================
  // 9. MODULE 5: PROJECT MANAGEMENT (CPM, GANTT, MONTE CARLO, COSTS, RISKS)
  // ==========================================================================
  /**
   * The 6 core activities from the B.E. Sem V IT Project Management micro-project:
   */
  const BASELINE_ACTIVITIES = [
    {
      id: 'A1',
      name: 'Initiation & Campus Survey',
      description: 'Identify sun-exposed campus wall space, survey canteen PET waste volume, and define planter requirements.',
      duration: 2, // Most likely duration (days)
      optimistic: 1,
      pessimistic: 3,
      predecessors: [],
      assignedTo: 'Project Lead & Surveyor',
      costRs: 0
    },
    {
      id: 'A2',
      name: 'Resource Collection (PET & Reject Water)',
      description: 'Collect 20-30 clean 2L PET bottles from canteen bins; establish RO plant reject water tapping point.',
      duration: 3,
      optimistic: 2,
      pessimistic: 5,
      predecessors: ['A1'],
      assignedTo: 'Logistics Team (2 members)',
      costRs: 0 // Campus waste is free!
    },
    {
      id: 'A3',
      name: 'Fabrication & Pre-Treatment',
      description: 'Cut side plant windows with utility knife; drill 2mm orifice in caps; deburr edges; wash inside with soap.',
      duration: 2,
      optimistic: 1,
      pessimistic: 4,
      predecessors: ['A2'],
      assignedTo: 'Fabrication Specialist',
      costRs: 30 // Drill bit & blades wear
    },
    {
      id: 'A4',
      name: 'Assembly & Station Installation',
      description: 'Drill masonry wall hooks; rig braided nylon cord; mount vertical stacks; hydrate & pack coco-peat; plant saplings.',
      duration: 2,
      optimistic: 1,
      pessimistic: 3,
      predecessors: ['A3'],
      assignedTo: 'Full Team (4 members)',
      costRs: 220 // Rope (Rs.50) + Coco-peat (Rs.100) + Saplings (Rs.70)
    },
    {
      id: 'A5',
      name: 'Testing & Continuous Monitoring',
      description: 'Conduct 7-day drip flow verification, calibrate cap orifice, monitor soil moisture, and check structural load stability.',
      duration: 7, // 7 days testing phase
      optimistic: 6,
      pessimistic: 9,
      predecessors: ['A4'],
      assignedTo: 'Quality & Testing Lead',
      costRs: 0
    },
    {
      id: 'A6',
      name: 'Documentation & Final Viva Defense',
      description: 'Compile water conservation data, safety calculations, cost-benefit analysis, and final viva report.',
      duration: 2,
      optimistic: 1,
      pessimistic: 3,
      predecessors: ['A5'],
      assignedTo: 'Documentation Specialist',
      costRs: 0
    }
  ];

  /**
   * Critical Path Method (CPM) Forward & Backward Pass Algorithm.
   *
   * Equations:
   *   Early Start (ES) = max(EF of all predecessors)
   *   Early Finish (EF) = ES + Duration
   *   Project Duration = max(EF of all terminal tasks)
   *   Late Finish (LF) = min(LS of all successors)
   *   Late Start (LS) = LF - Duration
   *   Total Float (TF) = LS - ES = LF - EF
   *   Critical Path: Set of tasks where TF == 0
   *
   * @param {Array<Object>} activities - Activity list with id, duration, predecessors
   * @returns {Object} CPM results with schedule table, critical path array, and total duration
   */
  function calculateCriticalPathMethod(activities = BASELINE_ACTIVITIES) {
    const actMap = {};
    activities.forEach(act => {
      actMap[act.id] = {
        ...act,
        duration: Number(act.duration),
        predecessors: [...(act.predecessors || [])],
        successors: [],
        ES: 0,
        EF: 0,
        LS: Infinity,
        LF: Infinity,
        slack: 0,
        isCritical: false
      };
    });

    // Populate successors:
    Object.keys(actMap).forEach(id => {
      actMap[id].predecessors.forEach(pId => {
        if (actMap[pId]) {
          actMap[pId].successors.push(id);
        }
      });
    });

    // 1. FORWARD PASS: Compute ES and EF
    // Topological order by dependency resolution
    const processedForward = new Set();
    let iteration = 0;
    const maxIters = activities.length * 3;

    while (processedForward.size < activities.length && iteration < maxIters) {
      iteration++;
      Object.keys(actMap).forEach(id => {
        if (processedForward.has(id)) return;
        const act = actMap[id];
        const predsReady = act.predecessors.every(pId => processedForward.has(pId));
        if (predsReady) {
          if (act.predecessors.length === 0) {
            act.ES = 0;
          } else {
            act.ES = Math.max(...act.predecessors.map(pId => actMap[pId].EF));
          }
          act.EF = act.ES + act.duration;
          processedForward.add(id);
        }
      });
    }

    // Project Total Duration
    const projectDuration = Math.max(...Object.values(actMap).map(a => a.EF), 0);

    // 2. BACKWARD PASS: Compute LF and LS
    const processedBackward = new Set();
    iteration = 0;

    // Terminal nodes have LF = projectDuration
    Object.keys(actMap).forEach(id => {
      if (actMap[id].successors.length === 0) {
        actMap[id].LF = projectDuration;
        actMap[id].LS = actMap[id].LF - actMap[id].duration;
      }
    });

    while (processedBackward.size < activities.length && iteration < maxIters) {
      iteration++;
      Object.keys(actMap).forEach(id => {
        if (processedBackward.has(id)) return;
        const act = actMap[id];
        // If all successors are processed
        const succsReady = act.successors.every(sId => processedBackward.has(sId) || actMap[sId].LF !== Infinity);
        if (succsReady) {
          if (act.successors.length > 0) {
            act.LF = Math.min(...act.successors.map(sId => actMap[sId].LS));
            act.LS = act.LF - act.duration;
          }
          act.slack = Math.max(0, act.LF - act.EF);
          act.isCritical = Math.abs(act.slack) < 0.001;
          processedBackward.add(id);
        }
      });
    }

    const scheduledActivities = Object.values(actMap);
    const criticalPath = scheduledActivities
      .filter(a => a.isCritical)
      .sort((a, b) => a.ES - b.ES)
      .map(a => a.id);

    return {
      activities: scheduledActivities,
      projectDuration,
      criticalPath,
      criticalPathString: criticalPath.join(' -> ')
    };
  }

  /**
   * Samples a random duration from a Triangular Distribution.
   *
   * Formulations:
   *   a = optimistic, m = most likely, b = pessimistic
   *   Using inverse transform sampling:
   *   U ~ Uniform(0, 1)
   *   If U < (m - a) / (b - a):
   *     X = a + sqrt(U * (b - a) * (m - a))
   *   Else:
   *     X = b - sqrt((1 - U) * (b - a) * (b - m))
   *
   * @param {number} a - Optimistic
   * @param {number} m - Most likely
   * @param {number} b - Pessimistic
   * @returns {number} Sampled duration
   */
  function sampleTriangular(a, m, b) {
    if (a === b) return a;
    if (a > m) m = a;
    if (m > b) b = m;

    const u = Math.random();
    const split = (m - a) / (b - a);

    if (u < split) {
      return a + Math.sqrt(u * (b - a) * (m - a));
    } else {
      return b - Math.sqrt((1 - u) * (b - a) * (b - m));
    }
  }

  /**
   * Monte Carlo Simulation of Project Duration (1000 iterations).
   *
   * Evaluates completion probability distribution against target deadline.
   *
   * @param {Array<Object>} activities - Base activity definitions with a, m, b
   * @param {number} iterations - Number of simulation runs (default 1000)
   * @param {number} targetDeadlineDays - Deadline to evaluate P(Duration <= Deadline)
   * @returns {Object} Histogram bins, mean, median, percentiles, probability
   */
  function runMonteCarloSimulation(activities = BASELINE_ACTIVITIES, iterations = 1000, targetDeadlineDays = 18) {
    const durations = [];

    for (let i = 0; i < iterations; i++) {
      // Sample duration for each activity
      const sampledActs = activities.map(act => {
        const a = Number(act.optimistic || act.duration * 0.8);
        const m = Number(act.duration);
        const b = Number(act.pessimistic || act.duration * 1.5);
        const randDur = sampleTriangular(a, m, b);
        return {
          id: act.id,
          duration: randDur,
          predecessors: act.predecessors
        };
      });

      const cpm = calculateCriticalPathMethod(sampledActs);
      durations.push(cpm.projectDuration);
    }

    durations.sort((a, b) => a - b);

    // Statistical summary
    const sum = durations.reduce((acc, d) => acc + d, 0);
    const mean = sum / iterations;
    const median = durations[Math.floor(iterations * 0.5)];
    const p10 = durations[Math.floor(iterations * 0.10)];
    const p50 = median;
    const p90 = durations[Math.floor(iterations * 0.90)];
    const p95 = durations[Math.floor(iterations * 0.95)];
    const min = durations[0];
    const max = durations[durations.length - 1];

    // Standard deviation
    const variance = durations.reduce((acc, d) => acc + Math.pow(d - mean, 2), 0) / iterations;
    const stdDev = Math.sqrt(variance);

    // Probability of finishing within target deadline
    const completedUnderDeadline = durations.filter(d => d <= targetDeadlineDays).length;
    const probWithinDeadline = Math.round((completedUnderDeadline / iterations) * 1000) / 10;

    // Histogram binning (e.g. 15 bins)
    const binCount = 15;
    const binWidth = (max - min) / binCount || 1;
    const bins = [];
    for (let b = 0; b < binCount; b++) {
      const binStart = min + (b * binWidth);
      const binEnd = binStart + binWidth;
      const count = durations.filter(d => d >= binStart && (b === binCount - 1 ? d <= binEnd : d < binEnd)).length;
      bins.push({
        binIndex: b,
        binStart: Math.round(binStart * 10) / 10,
        binEnd: Math.round(binEnd * 10) / 10,
        label: `${Math.round(binStart * 10) / 10} - ${Math.round(binEnd * 10) / 10}d`,
        count,
        freq: count / iterations
      });
    }

    return {
      iterations,
      targetDeadlineDays,
      mean: Math.round(mean * 10) / 10,
      median: Math.round(median * 10) / 10,
      stdDev: Math.round(stdDev * 10) / 10,
      min: Math.round(min * 10) / 10,
      max: Math.round(max * 10) / 10,
      percentiles: {
        p10: Math.round(p10 * 10) / 10,
        p50: Math.round(p50 * 10) / 10,
        p90: Math.round(p90 * 10) / 10,
        p95: Math.round(p95 * 10) / 10
      },
      probWithinDeadline,
      bins
    };
  }

  /**
   * Parametric Project Cost Estimation.
   *
   * Report Grounding:
   *   A 20-bottle station costs UNDER Rs. 250:
   *   - 20 Repurposed PET Bottles: Rs. 0 (Campus Canteen Waste)
   *   - Braided Nylon Rope / Twine: Rs. 50
   *   - Compressed Coco-Peat Block (650g): Rs. 100
   *   - Saplings / Seeds (Mint/Chives cuttings): Rs. 100
   *   Total Base = Rs. 250 (Rs. 12.50 per planter unit).
   *
   * @param {Object} inputs
   * @returns {Object} Itemized cost sheet and comparative savings
   */
  function calculateStationCost(inputs = {}) {
    const {
      bottleCount = 20,
      includeBlackPaint = true,
      paintCostRs = 80,
      includeWallHooks = true,
      hooksCostRs = 40,
      drillBitWearRs = 30
    } = inputs;

    // Scale proportional to bottle count:
    const scale = bottleCount / 20;

    const bottlesCost = 0; // 100% Repurposed Campus Waste
    const ropeCost = Math.round(50 * Math.max(0.5, scale));
    const cocopeatCost = Math.round(100 * scale);
    const saplingsCost = Math.round(100 * scale);

    const baseCost = bottlesCost + ropeCost + cocopeatCost + saplingsCost;

    let extrasCost = 0;
    if (includeBlackPaint) extrasCost += Number(paintCostRs) || 0;
    if (includeWallHooks) extrasCost += Number(hooksCostRs) || 0;
    extrasCost += Number(drillBitWearRs) || 0;

    const totalCost = baseCost + extrasCost;
    const costPerBottle = Math.round((totalCost / (bottleCount || 1)) * 100) / 100;

    // Comparison against commercial alternatives:
    // Commercial vertical hanging planter pocket or plastic pots = ~Rs. 120 each
    const commercialEquivalentCost = bottleCount * 120;
    const capitalSavedRs = commercialEquivalentCost - totalCost;
    const percentCostSaved = Math.round((capitalSavedRs / commercialEquivalentCost) * 1000) / 10;

    return {
      bottleCount,
      breakdown: [
        { item: 'Repurposed PET Bottles (2L)', qty: `${bottleCount} pcs`, unitCost: 'Rs. 0 (Campus Waste)', total: bottlesCost },
        { item: 'Braided Nylon Rope (15m)', qty: `${Math.round(15 * scale)} m`, unitCost: 'Rs. 3.3/m', total: ropeCost },
        { item: 'Compressed Coco-Peat Block', qty: `${Math.round(1 * scale * 10) / 10} brick`, unitCost: 'Rs. 100/brick', total: cocopeatCost },
        { item: 'Plant Saplings / Cuttings', qty: `${bottleCount} plants`, unitCost: 'Rs. 5/cutting', total: saplingsCost },
        ...(includeBlackPaint ? [{ item: 'Exterior Black Paint / Tape', qty: '1 can', unitCost: `Rs. ${paintCostRs}`, total: paintCostRs }] : []),
        ...(includeWallHooks ? [{ item: 'Heavy-Duty Wall Hooks & Plugs', qty: '4 sets', unitCost: `Rs. ${hooksCostRs}`, total: hooksCostRs }] : []),
        { item: 'Fabrication Tool Wear (Blades/Drill)', qty: '1 set', unitCost: `Rs. ${drillBitWearRs}`, total: drillBitWearRs }
      ],
      baseCost,
      extrasCost,
      totalCost,
      costPerBottle,
      commercialEquivalentCost,
      capitalSavedRs,
      percentCostSaved
    };
  }

  /**
   * 5x5 Project Management Risk Matrix & Mitigation Scoring.
   *
   * Standard ISO 31000 Risk Formulation:
   *   Risk Score = Probability (1-5) * Impact (1-5)
   *
   * Severity Categorization:
   *   1 - 4: Low Risk (Green)
   *   5 - 9: Moderate Risk (Yellow)
   *   10 - 15: High Risk (Amber)
   *   16 - 25: Critical Risk (Red)
   */
  const BASELINE_RISKS = [
    {
      id: 'R1',
      name: 'Cut / Puncture Injuries during PET Cutting',
      category: 'Health & Safety',
      probInitial: 4,
      impactInitial: 3,
      mitigation: 'Wear heavy-duty leather safety work gloves, use metal utility safety knife guides, and smooth cut PET edges with 120-grit sandpaper.',
      probMitigated: 1,
      impactMitigated: 2,
      applied: true
    },
    {
      id: 'R2',
      name: 'Structural Load Failure / Rope Snap',
      category: 'Structural Mechanics',
      probInitial: 3,
      impactInitial: 5,
      mitigation: 'Use lightweight coco-peat instead of heavy garden soil (8x lighter dry), rig dual-strand braided nylon rope (SF > 3.0), and test wall anchor hooks to 50 kgf.',
      probMitigated: 1,
      impactMitigated: 3,
      applied: true
    },
    {
      id: 'R3',
      name: 'Algae Colonization in Clear PET Bottles',
      category: 'Biological & Aesthetic',
      probInitial: 5,
      impactInitial: 3,
      mitigation: 'Coat the exterior of the clear PET bottles with opaque black paint or wrap with UV-resistant electrical tape to block photosynthetically active radiation.',
      probMitigated: 1,
      impactMitigated: 1,
      applied: true
    },
    {
      id: 'R4',
      name: 'Drip Hole Clogging by Soil Sediment',
      category: 'Hydraulic System',
      probInitial: 4,
      impactInitial: 3,
      mitigation: 'Place a small circular swatch of fine nylon insect mesh or non-woven fabric over the inside of the bottle cap before packing coco-peat.',
      probMitigated: 1,
      impactMitigated: 2,
      applied: true
    },
    {
      id: 'R5',
      name: 'Shortage of Uniform 2L PET Bottles on Campus',
      category: 'Resource Procurement',
      probInitial: 3,
      impactInitial: 3,
      mitigation: 'Partner with campus canteen and student hostel mess for dedicated PET bottle drop-off boxes over 5 consecutive days.',
      probMitigated: 1,
      impactMitigated: 2,
      applied: false
    },
    {
      id: 'R6',
      name: 'Weekend Plant Wilting / Water Exhaustion',
      category: 'Agronomic',
      probInitial: 4,
      impactInitial: 4,
      mitigation: 'Calibrate 2L reservoir for 72-hour autonomy (drip ~25 ml/hr) and institute a mandatory Friday afternoon refill schedule.',
      probMitigated: 1,
      impactMitigated: 2,
      applied: true
    }
  ];

  function evaluateRiskMatrix(risks = BASELINE_RISKS) {
    function getSeverity(score) {
      if (score <= 4) return { level: 'Low', color: '#4caf50', rank: 1 };
      if (score <= 9) return { level: 'Moderate', color: '#fbc02d', rank: 2 };
      if (score <= 15) return { level: 'High', color: '#fb8c00', rank: 3 };
      return { level: 'Critical', color: '#e53935', rank: 4 };
    }

    const evaluated = risks.map(r => {
      const p = r.applied ? r.probMitigated : r.probInitial;
      const i = r.applied ? r.impactMitigated : r.impactInitial;
      const score = p * i;
      const severity = getSeverity(score);
      const initialScore = r.probInitial * r.impactInitial;
      const initialSeverity = getSeverity(initialScore);

      return {
        ...r,
        activeP: p,
        activeI: i,
        score,
        severity,
        initialScore,
        initialSeverity
      };
    });

    const highCriticalCount = evaluated.filter(r => r.score >= 10).length;
    const overallRiskVerdict = highCriticalCount === 0 ? 'Acceptable / Managed' : `${highCriticalCount} Unmitigated High Risk(s) Remaining`;

    return {
      risks: evaluated,
      overallRiskVerdict,
      highCriticalCount
    };
  }

  // ==========================================================================
  // 10. MODULE 6: ENVIRONMENTAL IMPACT & CAMPUS GREENING
  // ==========================================================================
  /**
   * Calculates comprehensive ecological savings for campus sustainability:
   *   - Plastic waste diverted from municipal landfill (kg)
   *   - Embodied carbon footprint avoided (kg CO2e)
   *   - Potable tap water conserved monthly (liters)
   *   - Campus wall vertical green cover created (m^2)
   *
   * @param {Object} inputs
   * @returns {Object} Quantified ecological indicators
   */
  function calculateEnvironmentalImpact(inputs = {}) {
    const {
      bottleCount = 20,
      stationCount = 3,
      bottleWeightGrams = 45,
      waterSavedPerBottleDayL = 0.55 // From Module 2 comparative savings
    } = inputs;

    const totalBottles = bottleCount * stationCount;

    // 1. Plastic waste diversion
    const plasticDivertedKg = (totalBottles * bottleWeightGrams) / 1000;

    // 2. Carbon offset: Virgin PET production emits approx 2.15 kg CO2e per kg plastic
    const carbonOffsetKgCo2e = plasticDivertedKg * 2.15;

    // 3. Water conservation per month (30 days)
    const monthlyWaterSavedLitres = totalBottles * waterSavedPerBottleDayL * 30;

    // 4. Vertical wall greening area:
    // A standard 2L PET bottle planter wall footprint is ~0.12 m x 0.35 m ≈ 0.042 m^2 per unit
    const wallAreaGreenM2 = totalBottles * 0.045;

    // 5. Landfill volume diverted: compacted PET density in loose landfill ≈ 0.035 kg/L (35 kg/m^3)
    const landfillVolumeSavedM3 = plasticDivertedKg / 35;

    // 6. Cost reduction vs commercial green wall systems (Rs. 1500 per sq. meter)
    const commercialGreenWallCostRs = wallAreaGreenM2 * 1800;
    const projectTotalCostRs = stationCount * calculateStationCost({ bottleCount }).totalCost;
    const costSavingsRs = commercialGreenWallCostRs - projectTotalCostRs;

    return {
      totalBottles,
      stationCount,
      plasticDivertedKg: Math.round(plasticDivertedKg * 100) / 100,
      carbonOffsetKgCo2e: Math.round(carbonOffsetKgCo2e * 100) / 100,
      monthlyWaterSavedLitres: Math.round(monthlyWaterSavedLitres),
      annualWaterSavedLitres: Math.round(monthlyWaterSavedLitres * 12),
      wallAreaGreenM2: Math.round(wallAreaGreenM2 * 100) / 100,
      landfillVolumeSavedM3: Math.round(landfillVolumeSavedM3 * 1000) / 1000,
      commercialGreenWallCostRs: Math.round(commercialGreenWallCostRs),
      projectTotalCostRs: Math.round(projectTotalCostRs),
      costSavingsRs: Math.round(costSavingsRs)
    };
  }

  // ==========================================================================
  // EXPORT PUBLIC API
  // ==========================================================================
  return {
    CONSTANTS,
    SOIL_TYPES,
    PLANT_TYPES,
    ROPE_TYPES,
    BASELINE_ACTIVITIES,
    BASELINE_RISKS,
    // Model calculators
    calculateWaterHead,
    calculateTorricelliDripRate,
    createSoilGrid,
    updateSoilGridStep,
    evaluatePlantHealth,
    simulateWaterEfficiencyComparison,
    calculatePlanterLoadAndSafety,
    simulate7DayLifecycle,
    calculateCriticalPathMethod,
    sampleTriangular,
    runMonteCarloSimulation,
    calculateStationCost,
    evaluateRiskMatrix,
    calculateEnvironmentalImpact
  };
});
