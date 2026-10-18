/**
 * ============================================================================
 * UI.JS - GLOBAL UI ORCHESTRATION, TABS, THEMES, PRESETS & MODALS
 * ============================================================================
 * Coordinates the application shell:
 *   - Sidebar navigation and active module tab switching.
 *   - Theme switcher (Dark / Light Eco-palette) with localStorage persistence.
 *   - Preset dropdown selector (loads report baseline, summer heat, etc.).
 *   - Saved Runs Manager modal (view, load, delete, overlay comparison).
 *   - Viva-Prep engineering explanations modal & collapsible accordions.
 *   - Global CSV export and print summary trigger.
 *   - Lightweight toast notification system.
 * ============================================================================
 */

(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory(require('./storage'));
  } else {
    root.PlanterUI = factory(root.PlanterStorage);
  }
})(typeof self !== 'undefined' ? self : this, function (Storage) {
  'use strict';

  let currentActiveModule = 'module1';
  let cachedPresets = [];

  function init() {
    initTheme();
    initTabs();
    initPresets();
    initSavedRunsModal();
    initVivaModal();
    initGlobalActionButtons();
    initCollapsiblePanels();
    initResizeHandling();
    initHashRoute();
  }

  function refreshActiveModule(mod) {
    const active = mod || currentActiveModule;
    if (active === 'module1' && window.Module1DripFeeder?.renderAll) {
      window.Module1DripFeeder.renderAll();
    } else if (active === 'module2' && window.Module2WaterComparison?.runComparison) {
      window.Module2WaterComparison.runComparison();
    } else if (active === 'module3' && window.Module3LoadSafety?.calculateLoad) {
      window.Module3LoadSafety.calculateLoad();
    } else if (active === 'module4' && window.Module4TestingPhase?.renderChart) {
      window.Module4TestingPhase.renderChart();
    } else if (active === 'module5' && window.Module5ProjectManagement?.renderActiveView) {
      window.Module5ProjectManagement.renderActiveView();
    }
  }

  // ==========================================================================
  // 1. THEME SWITCHER (Eco Dark / Light Mode)
  // ==========================================================================
  function initTheme() {
    const theme = Storage.getTheme();
    Storage.setTheme(theme);

    const themeToggleBtn = document.getElementById('btn-toggle-theme');
    if (themeToggleBtn) {
      updateThemeButtonIcon(themeToggleBtn, theme);
      themeToggleBtn.addEventListener('click', () => {
        const nextTheme = document.documentElement.getAttribute('data-theme') === 'dark' ? 'light' : 'dark';
        Storage.setTheme(nextTheme);
        updateThemeButtonIcon(themeToggleBtn, nextTheme);
        showToast(`Switched to ${nextTheme === 'dark' ? 'Dark Eco' : 'Light Earth'} theme`);
      });
    }
  }

  function updateThemeButtonIcon(btn, theme) {
    btn.innerHTML = (theme === 'dark') ? '☀️ Light Mode' : '🌙 Dark Mode';
  }

  // ==========================================================================
  // 2. TAB SWITCHING (Sidebar Navigation)
  // ==========================================================================
  function initTabs() {
    const navItems = document.querySelectorAll('.sidebar-nav-item');
    const modulePanes = document.querySelectorAll('.module-pane');

    navItems.forEach(item => {
      item.addEventListener('click', (e) => {
        e.preventDefault();
        const targetModule = item.getAttribute('data-module');
        if (!targetModule) return;

        navItems.forEach(n => n.classList.remove('active'));
        modulePanes.forEach(p => p.classList.remove('active'));

        item.classList.add('active');
        const targetPane = document.getElementById(targetModule);
        if (targetPane) targetPane.classList.add('active');

        currentActiveModule = targetModule;

        if (window.history && window.history.replaceState) {
          window.history.replaceState(null, '', `#${targetModule}`);
        }

        // Re-render active module canvases with their sharp, visible dimensions
        requestAnimationFrame(() => {
          refreshActiveModule(targetModule);
        });
      });
    });
  }

  function initResizeHandling() {
    let resizeTimer = null;
    window.addEventListener('resize', () => {
      clearTimeout(resizeTimer);
      resizeTimer = setTimeout(() => {
        refreshActiveModule();
      }, 100);
    });

    if (typeof ResizeObserver !== 'undefined') {
      const canvases = document.querySelectorAll('.canvas-wrapper canvas');
      let roFrame = null;
      const ro = new ResizeObserver((entries) => {
        let hasVisible = false;
        for (const entry of entries) {
          if (entry.contentRect.width > 0 && entry.contentRect.height > 0) {
            hasVisible = true;
            break;
          }
        }
        if (hasVisible) {
          cancelAnimationFrame(roFrame);
          roFrame = requestAnimationFrame(() => {
            refreshActiveModule();
          });
        }
      });
      canvases.forEach(c => ro.observe(c));
    }
  }

  function initHashRoute() {
    const hash = (window.location.hash || '').replace('#', '');
    if (hash && document.getElementById(hash)) {
      activateTab(hash);
    }
    window.addEventListener('hashchange', () => {
      const nextHash = (window.location.hash || '').replace('#', '');
      if (nextHash && nextHash !== currentActiveModule && document.getElementById(nextHash)) {
        activateTab(nextHash);
      }
    });
  }

  // ==========================================================================
  // 3. PRESETS SELECTION
  // ==========================================================================
  async function initPresets() {
    const presetSelect = document.getElementById('global-preset-select');
    if (!presetSelect) return;

    cachedPresets = await Storage.loadPresets();
    presetSelect.innerHTML = '<option value="" disabled selected>-- Select a Preset Scenario --</option>' +
      cachedPresets.map(p => `<option value="${p.id}">${p.name}</option>`).join('');

    presetSelect.addEventListener('change', () => {
      const presetId = presetSelect.value;
      const preset = cachedPresets.find(p => p.id === presetId);
      if (preset) {
        applyPreset(preset);
        showToast(`Loaded scenario: "${preset.name}"`);
      }
    });
  }

  function applyPreset(preset) {
    if (preset.module1 && window.Module1DripFeeder) {
      window.Module1DripFeeder.setInputs(preset.module1);
    }
    if (preset.module2 && window.Module2WaterComparison) {
      window.Module2WaterComparison.setInputs(preset.module2);
    }
    if (preset.module3 && window.Module3LoadSafety) {
      window.Module3LoadSafety.setInputs(preset.module3);
    }
    if (preset.module4 && window.Module4TestingPhase) {
      window.Module4TestingPhase.setInputs(preset.module4);
    }
    if (preset.module5 && window.Module5ProjectManagement) {
      // module5 parameters
    }
    if (preset.module6 && window.Module6Environmental) {
      window.Module6Environmental.setInputs(preset.module6);
    }
  }

  // ==========================================================================
  // 4. SAVED RUNS & RUN COMPARISON MODAL
  // ==========================================================================
  function initSavedRunsModal() {
    const btnOpenRuns = document.getElementById('btn-open-saved-runs');
    const modal = document.getElementById('modal-saved-runs');
    const btnCloseModal = document.getElementById('btn-close-saved-runs');
    const runsListContainer = document.getElementById('saved-runs-list');
    const btnCompareSelected = document.getElementById('btn-compare-selected-runs');

    if (!modal) return;

    const openModal = () => {
      renderSavedRunsList();
      modal.classList.add('show');
    };

    const closeModal = () => {
      modal.classList.remove('show');
    };

    if (btnOpenRuns) btnOpenRuns.addEventListener('click', openModal);
    if (btnCloseModal) btnCloseModal.addEventListener('click', closeModal);

    // Close on backdrop click
    modal.addEventListener('click', (e) => {
      if (e.target === modal) closeModal();
    });

    function renderSavedRunsList() {
      if (!runsListContainer) return;
      const runs = Storage.getSavedRuns();

      if (runs.length === 0) {
        runsListContainer.innerHTML = `
          <div class="empty-state">
            <p>No saved simulation runs found in browser localStorage.</p>
            <p class="text-muted"><small>Click "Save Run" inside any simulation module to record and compare parameter runs.</small></p>
          </div>
        `;
        if (btnCompareSelected) btnCompareSelected.disabled = true;
        return;
      }

      runsListContainer.innerHTML = runs.map(run => `
        <div class="saved-run-card" data-run-id="${run.id}">
          <div class="saved-run-header">
            <div>
              <input type="checkbox" class="compare-checkbox" value="${run.id}">
              <strong>${run.name || 'Untitled Run'}</strong>
              <span class="badge badge-info" style="margin-left: 8px;">${run.module.toUpperCase()}</span>
            </div>
            <small class="text-muted">${run.formattedDate}</small>
          </div>
          <div class="saved-run-body">
            <pre class="saved-run-summary">${formatRunSummary(run)}</pre>
          </div>
          <div class="saved-run-actions">
            <button class="btn btn-sm btn-outline-success btn-load-run" data-id="${run.id}">Load Parameters</button>
            <button class="btn btn-sm btn-outline-danger btn-delete-run" data-id="${run.id}">Delete</button>
          </div>
        </div>
      `).join('');

      // Bind Load & Delete buttons
      runsListContainer.querySelectorAll('.btn-load-run').forEach(b => {
        b.addEventListener('click', () => {
          const id = b.getAttribute('data-id');
          const run = Storage.getRunById(id);
          if (run) {
            loadRunIntoActiveModule(run);
            closeModal();
            showToast(`Loaded run: ${run.name}`);
          }
        });
      });

      runsListContainer.querySelectorAll('.btn-delete-run').forEach(b => {
        b.addEventListener('click', () => {
          const id = b.getAttribute('data-id');
          Storage.deleteRun(id);
          renderSavedRunsList();
          showToast('Run deleted from localStorage');
        });
      });

      // Bind checkbox changes for Compare button
      const checkboxes = runsListContainer.querySelectorAll('.compare-checkbox');
      checkboxes.forEach(cb => {
        cb.addEventListener('change', () => {
          const selected = runsListContainer.querySelectorAll('.compare-checkbox:checked');
          if (btnCompareSelected) {
            btnCompareSelected.disabled = (selected.length !== 2);
            btnCompareSelected.textContent = selected.length === 2
              ? 'Compare Selected 2 Runs (Overlay)'
              : `Select 2 Runs to Compare (${selected.length}/2 selected)`;
          }
        });
      });
    }

    if (btnCompareSelected) {
      btnCompareSelected.addEventListener('click', () => {
        const selected = Array.from(runsListContainer.querySelectorAll('.compare-checkbox:checked')).map(cb => cb.value);
        if (selected.length === 2) {
          const runA = Storage.getRunById(selected[0]);
          const runB = Storage.getRunById(selected[1]);
          closeModal();
          triggerRunComparison(runA, runB);
        }
      });
    }
  }

  function formatRunSummary(run) {
    if (!run.results) return 'No results logged.';
    return Object.entries(run.results).map(([k, v]) => `${k}: ${v}`).join(' | ');
  }

  function loadRunIntoActiveModule(run) {
    if (run.module === 'module1' && window.Module1DripFeeder) {
      activateTab('module1');
      window.Module1DripFeeder.loadRun(run);
    } else if (run.module === 'module2' && window.Module2WaterComparison) {
      activateTab('module2');
      window.Module2WaterComparison.setInputs(run.parameters);
    } else if (run.module === 'module3' && window.Module3LoadSafety) {
      activateTab('module3');
      window.Module3LoadSafety.setInputs(run.parameters);
    } else if (run.module === 'module4' && window.Module4TestingPhase) {
      activateTab('module4');
      window.Module4TestingPhase.setInputs(run.parameters);
    }
  }

  function activateTab(moduleId) {
    const navItem = document.querySelector(`.sidebar-nav-item[data-module="${moduleId}"]`);
    if (navItem) navItem.click();
  }

  function triggerRunComparison(runA, runB) {
    if (runA.module === 'module1' && runB.module === 'module1') {
      activateTab('module1');
      if (window.Module1DripFeeder) {
        window.Module1DripFeeder.setOverlayRun(runB);
        showToast(`Overlaying "${runA.name}" with "${runB.name}"`);
      }
    } else {
      showToast(`Comparison: Run A (${runA.name}) vs Run B (${runB.name}) loaded.`);
    }
  }

  // ==========================================================================
  // 5. VIVA-PREP EXPLANATIONS MODAL
  // ==========================================================================
  function initVivaModal() {
    const btnOpenViva = document.getElementById('btn-open-viva-modal');
    const modal = document.getElementById('modal-viva-prep');
    const btnCloseViva = document.getElementById('btn-close-viva-modal');

    if (!modal) return;

    if (btnOpenViva) btnOpenViva.addEventListener('click', () => modal.classList.add('show'));
    if (btnCloseViva) btnCloseViva.addEventListener('click', () => modal.classList.remove('show'));

    modal.addEventListener('click', (e) => {
      if (e.target === modal) modal.classList.remove('show');
    });
  }

  // ==========================================================================
  // 6. GLOBAL BUTTONS (CSV Export & Print)
  // ==========================================================================
  function initGlobalActionButtons() {
    const btnExportGlobal = document.getElementById('btn-global-export-csv');
    const btnPrintGlobal = document.getElementById('btn-global-print-report');

    if (btnExportGlobal) {
      btnExportGlobal.addEventListener('click', () => {
        if (currentActiveModule === 'module1' && window.Module1DripFeeder) {
          window.Module1DripFeeder.exportTimeSeriesCsv();
        } else if (currentActiveModule === 'module2' && window.Module2WaterComparison) {
          window.Module2WaterComparison.exportComparisonCsv();
        } else if (currentActiveModule === 'module4' && window.Module4TestingPhase) {
          window.Module4TestingPhase.exportLogsCsv();
        } else {
          showToast('CSV export ready for Module 1, Module 2, and Module 4.');
        }
      });
    }

    if (btnPrintGlobal) {
      btnPrintGlobal.addEventListener('click', () => {
        Storage.triggerPrintReport();
      });
    }
  }

  // ==========================================================================
  // 7. COLLAPSIBLE "HOW THIS MODEL WORKS" ACCORDIONS
  // ==========================================================================
  function initCollapsiblePanels() {
    const headers = document.querySelectorAll('.accordion-header');
    headers.forEach(h => {
      h.addEventListener('click', () => {
        const body = h.nextElementSibling;
        const icon = h.querySelector('.accordion-icon');
        if (body) {
          const isExpanded = body.style.display === 'block';
          body.style.display = isExpanded ? 'none' : 'block';
          if (icon) icon.textContent = isExpanded ? '▼' : '▲';
        }
      });
    });
  }

  // ==========================================================================
  // 8. TOAST NOTIFICATIONS
  // ==========================================================================
  function showToast(message, duration = 3000) {
    let container = document.getElementById('toast-container');
    if (!container) {
      container = document.createElement('div');
      container.id = 'toast-container';
      document.body.appendChild(container);
    }

    const toast = document.createElement('div');
    toast.className = 'toast-message';
    toast.textContent = message;
    container.appendChild(toast);

    setTimeout(() => {
      toast.classList.add('show');
    }, 10);

    setTimeout(() => {
      toast.classList.remove('show');
      setTimeout(() => {
        if (toast.parentNode) toast.parentNode.removeChild(toast);
      }, 300);
    }, duration);
  }

  return {
    init,
    showToast,
    activateTab,
    applyPreset
  };
});
