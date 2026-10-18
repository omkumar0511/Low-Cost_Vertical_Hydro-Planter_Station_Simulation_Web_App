/**
 * ============================================================================
 * STORAGE.JS - LOCALSTORAGE, PRESET LOADER, CSV EXPORT & RUN COMPARATOR
 * ============================================================================
 * Provides state persistence, run history management, CSV report generation,
 * and seamless fallback presets for offline/file:// direct browser usage.
 * ============================================================================
 */

(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory();
  } else {
    root.PlanterStorage = factory();
  }
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  const STORAGE_KEY_RUNS = 'pet_planter_saved_runs_v1';
  const STORAGE_KEY_THEME = 'pet_planter_theme_v1';

  // ==========================================================================
  // EMBEDDED PRESETS FALLBACK
  // Guarantees immediate functionality even when opening index.html via file://
  // without encountering browser CORS fetch restrictions.
  // ==========================================================================
  const FALLBACK_PRESETS = [
    {
      id: 'report_baseline',
      name: 'Report Baseline (2 mm hole, coco-peat, mint)',
      description: 'The exact baseline setup tested at L. D. College of Engineering: 2L PET bottle, 2mm cap orifice, lightweight coco-peat, mint plant at moderate campus temperature.',
      module1: {
        bottleCapacity: 2.0,
        fillLevel: 100,
        holeDiameter: 2.0,
        soilType: 'cocopeat',
        plantType: 'mint',
        temperature: 28,
        sunlight: 'partial',
        refillInterval: 72,
        clogging: 5,
        calibrationFactor: 0.002
      },
      module2: {
        days: 7,
        waterSource: 'ro_reject',
        surfaceEvapLoss: 35,
        surfaceRunoffLoss: 20,
        surfacePercolationLoss: 15,
        dripEvapLoss: 4,
        dripRunoffLoss: 0,
        dripPercolationLoss: 6
      },
      module3: {
        bottleCount: 4,
        soilVolume: 1.5,
        soilType: 'cocopeat',
        saturation: 60,
        plantMass: 0.1,
        ropeType: 'nylon',
        ropeStrands: 2,
        hookRating: 50
      },
      module4: {
        weatherPattern: 'typical',
        initialHole: 2.0,
        hasBlackPaint: false,
        hasShadeNet: false
      },
      module5: {
        bottleCount: 20,
        deadlineDays: 14,
        includePaint: true,
        includeHooks: true
      },
      module6: {
        bottleCount: 20,
        stationCount: 3,
        bottleWeightGrams: 45
      }
    },
    {
      id: 'hot_summer_ahmedabad',
      name: 'Hot Summer Day (38°C, Full Sun, High Evaporation)',
      description: 'Simulates harsh Gujarat summer conditions with elevated ambient heat (38°C) and full solar irradiation, accelerating evapotranspiration.',
      module1: {
        bottleCapacity: 2.0,
        fillLevel: 100,
        holeDiameter: 2.5,
        soilType: 'mix',
        plantType: 'tomato',
        temperature: 38,
        sunlight: 'full',
        refillInterval: 48,
        clogging: 10,
        calibrationFactor: 0.002
      },
      module2: {
        days: 14,
        waterSource: 'canteen_leftover',
        surfaceEvapLoss: 45,
        surfaceRunoffLoss: 20,
        surfacePercolationLoss: 10,
        dripEvapLoss: 6,
        dripRunoffLoss: 0,
        dripPercolationLoss: 5
      },
      module3: {
        bottleCount: 4,
        soilVolume: 1.5,
        soilType: 'mix',
        saturation: 75,
        plantMass: 0.2,
        ropeType: 'nylon',
        ropeStrands: 2,
        hookRating: 50
      },
      module4: {
        weatherPattern: 'heatwave',
        initialHole: 2.5,
        hasBlackPaint: true,
        hasShadeNet: true
      },
      module5: {
        bottleCount: 20,
        deadlineDays: 14,
        includePaint: true,
        includeHooks: true
      },
      module6: {
        bottleCount: 20,
        stationCount: 5,
        bottleWeightGrams: 45
      }
    },
    {
      id: 'clogged_cap_alert',
      name: 'Clogged Cap (80% Clog, Garden Soil)',
      description: 'Severe orifice blockage caused by fine sediment or algae accumulation without protective mesh. Drip rate plummets and plant undergoes water stress.',
      module1: {
        bottleCapacity: 1.5,
        fillLevel: 80,
        holeDiameter: 1.5,
        soilType: 'garden_soil',
        plantType: 'coriander',
        temperature: 32,
        sunlight: 'partial',
        refillInterval: 72,
        clogging: 80,
        calibrationFactor: 0.002
      },
      module2: {
        days: 7,
        waterSource: 'ro_reject',
        surfaceEvapLoss: 35,
        surfaceRunoffLoss: 20,
        surfacePercolationLoss: 15,
        dripEvapLoss: 4,
        dripRunoffLoss: 0,
        dripPercolationLoss: 6
      },
      module3: {
        bottleCount: 3,
        soilVolume: 1.5,
        soilType: 'garden_soil',
        saturation: 50,
        plantMass: 0.1,
        ropeType: 'twine',
        ropeStrands: 1,
        hookRating: 25
      },
      module4: {
        weatherPattern: 'typical',
        initialHole: 1.5,
        hasBlackPaint: false,
        hasShadeNet: false
      },
      module5: {
        bottleCount: 15,
        deadlineDays: 14,
        includePaint: false,
        includeHooks: true
      },
      module6: {
        bottleCount: 15,
        stationCount: 2,
        bottleWeightGrams: 45
      }
    },
    {
      id: 'overloaded_wall_stack',
      name: 'Overloaded Wall Stack (10 Bottles, Garden Soil, Wet)',
      description: 'Dangerous structural scenario: 10 heavy garden soil bottles on a single jute twine string. Tests structural safety calculation and triggers structural failure alert.',
      module1: {
        bottleCapacity: 2.0,
        fillLevel: 100,
        holeDiameter: 2.0,
        soilType: 'garden_soil',
        plantType: 'pothos',
        temperature: 27,
        sunlight: 'shade',
        refillInterval: 72,
        clogging: 0,
        calibrationFactor: 0.002
      },
      module2: {
        days: 10,
        waterSource: 'fresh_water',
        surfaceEvapLoss: 30,
        surfaceRunoffLoss: 20,
        surfacePercolationLoss: 15,
        dripEvapLoss: 4,
        dripRunoffLoss: 0,
        dripPercolationLoss: 5
      },
      module3: {
        bottleCount: 10,
        soilVolume: 1.8,
        soilType: 'garden_soil',
        saturation: 95,
        plantMass: 0.2,
        ropeType: 'twine',
        ropeStrands: 1,
        hookRating: 25
      },
      module4: {
        weatherPattern: 'typical',
        initialHole: 2.0,
        hasBlackPaint: false,
        hasShadeNet: false
      },
      module5: {
        bottleCount: 30,
        deadlineDays: 12,
        includePaint: false,
        includeHooks: false
      },
      module6: {
        bottleCount: 30,
        stationCount: 3,
        bottleWeightGrams: 45
      }
    },
    {
      id: 'best_case_system',
      name: 'Best Case (Coco-Peat, Nylon Rope, RO Reject, 20-Bottle Station)',
      description: 'Optimized campus deployment: lightweight coco-peat prevents load issues, double-strand braided nylon guarantees SF > 3.0, RO reject water minimizes municipal draw, and black paint stops algae.',
      module1: {
        bottleCapacity: 2.0,
        fillLevel: 100,
        holeDiameter: 2.0,
        soilType: 'cocopeat',
        plantType: 'chives',
        temperature: 26,
        sunlight: 'partial',
        refillInterval: 96,
        clogging: 0,
        calibrationFactor: 0.002
      },
      module2: {
        days: 30,
        waterSource: 'ro_reject',
        surfaceEvapLoss: 35,
        surfaceRunoffLoss: 25,
        surfacePercolationLoss: 15,
        dripEvapLoss: 3,
        dripRunoffLoss: 0,
        dripPercolationLoss: 4
      },
      module3: {
        bottleCount: 5,
        soilVolume: 1.5,
        soilType: 'cocopeat',
        saturation: 55,
        plantMass: 0.1,
        ropeType: 'nylon',
        ropeStrands: 2,
        hookRating: 60
      },
      module4: {
        weatherPattern: 'typical',
        initialHole: 2.0,
        hasBlackPaint: true,
        hasShadeNet: true
      },
      module5: {
        bottleCount: 20,
        deadlineDays: 14,
        includePaint: true,
        includeHooks: true
      },
      module6: {
        bottleCount: 20,
        stationCount: 5,
        bottleWeightGrams: 45
      }
    }
  ];

  /**
   * Loads presets via fetch() when available on HTTP/HTTPS;
   * automatically falls back to embedded array if running via file://
   */
  async function loadPresets() {
    try {
      if (window.location.protocol.startsWith('http')) {
        const response = await fetch('/api/presets');
        if (response.ok) {
          const data = await response.json();
          if (data && data.presets) return data.presets;
        }
      }
    } catch (err) {
      console.warn('HTTP presets fetch failed, using built-in presets fallback:', err);
    }
    return FALLBACK_PRESETS;
  }

  // ==========================================================================
  // LOCALSTORAGE MANAGEMENT FOR SAVED RUNS
  // ==========================================================================
  function getSavedRuns() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY_RUNS);
      return raw ? JSON.parse(raw) : [];
    } catch (e) {
      console.error('Error reading saved runs from localStorage:', e);
      return [];
    }
  }

  function saveRun(runData) {
    try {
      const runs = getSavedRuns();
      const newEntry = {
        id: 'run_' + Date.now(),
        timestamp: new Date().toISOString(),
        formattedDate: new Date().toLocaleString(),
        ...runData
      };
      runs.unshift(newEntry);
      // Keep up to 25 recent runs
      if (runs.length > 25) runs.length = 25;
      localStorage.setItem(STORAGE_KEY_RUNS, JSON.stringify(runs));
      return newEntry;
    } catch (e) {
      console.error('Error saving run to localStorage:', e);
      return null;
    }
  }

  function deleteRun(runId) {
    try {
      let runs = getSavedRuns();
      runs = runs.filter(r => r.id !== runId);
      localStorage.setItem(STORAGE_KEY_RUNS, JSON.stringify(runs));
      return runs;
    } catch (e) {
      console.error('Error deleting run from localStorage:', e);
      return [];
    }
  }

  function getRunById(runId) {
    const runs = getSavedRuns();
    return runs.find(r => r.id === runId) || null;
  }

  // Theme Management
  function getTheme() {
    return localStorage.getItem(STORAGE_KEY_THEME) || 'light';
  }

  function setTheme(theme) {
    localStorage.setItem(STORAGE_KEY_THEME, theme);
    document.documentElement.setAttribute('data-theme', theme);
  }

  // ==========================================================================
  // CSV EXPORT GENERATOR
  // ==========================================================================
  /**
   * Converts tabular or time-series data to RFC 4180 compliant CSV and triggers
   * client-side file download without server involvement.
   *
   * @param {string} filename - e.g. "pet_planter_module1_timeseries.csv"
   * @param {Array<Object>} rows - Array of key-value objects
   * @param {Array<string>} headers - Optional specific column keys
   */
  function exportToCsv(filename, rows, headers = null) {
    if (!rows || rows.length === 0) {
      alert('No simulation data available to export.');
      return;
    }

    const cols = headers || Object.keys(rows[0]);
    const csvLines = [];

    // Header line
    csvLines.push(cols.map(c => `"${String(c).replace(/"/g, '""')}"`).join(','));

    // Data lines
    rows.forEach(row => {
      const line = cols.map(col => {
        let val = row[col];
        if (val === undefined || val === null) val = '';
        val = String(val).replace(/"/g, '""');
        return `"${val}"`;
      }).join(',');
      csvLines.push(line);
    });

    const csvContent = csvLines.join('\r\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', filename);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }

  // ==========================================================================
  // PRINT SUMMARY REPORT
  // ==========================================================================
  function triggerPrintReport() {
    window.print();
  }

  return {
    loadPresets,
    getSavedRuns,
    saveRun,
    deleteRun,
    getRunById,
    getTheme,
    setTheme,
    exportToCsv,
    triggerPrintReport,
    FALLBACK_PRESETS
  };
});
