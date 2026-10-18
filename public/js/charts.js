/**
 * ============================================================================
 * CHARTS.JS - CUSTOM HTML5 CANVAS DATA VISUALIZATION ENGINE
 * ============================================================================
 * Pure vanilla JavaScript Canvas charting engine built from scratch.
 * ZERO third-party libraries (no Chart.js, no D3, no external CDN dependencies).
 *
 * Supported Visualizations:
 *   1. Multi-Line Time Series Chart (Auto-scaling, multi-row wrapped legends, thresholds)
 *   2. Grouped / Stacked Bar Chart (Water loss breakdowns, comparison metrics)
 *   3. Monte Carlo Histogram Chart (Frequency distribution, mean & target markers)
 *   4. Interactive CPM Gantt Chart (Activities, float/slack bars, intelligent day steps)
 *   5. 2D Soil Moisture Heatmap Grid (20x20 capillary diffusion with root zone boundary)
 *   6. Structural Planter Stack Visualizer (Multi-tier hanging bottles, hook, tension vectors)
 *   7. 5x5 Risk Matrix Heatmap (ISO 31000 probability vs impact grid with risk tokens)
 * ============================================================================
 */

(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory();
  } else {
    root.PlanterCharts = factory();
  }
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  // Common color palette (Eco theme)
  const PALETTE = {
    greenPrimary: '#2e7d32',
    greenLight: '#81c784',
    waterBlue: '#0288d1',
    waterLight: '#81d4fa',
    earthBrown: '#795548',
    earthWarm: '#d7ccc8',
    amberWarning: '#ffa000',
    redDanger: '#d32f2f',
    purpleAccent: '#7b1fa2',
    grayGrid: '#e0e0e0',
    grayText: '#616161',
    darkText: '#212121',
    darkGrid: '#333333'
  };

  /**
   * Helper to set up high-DPI (Retina) sharp canvas rendering.
   * If the canvas is hidden (e.g. inside an inactive tab pane), rect.width is 0.
   * Returns null so we don't render into a dummy/stretched 300x150 buffer.
   */
  function setupCanvas(canvas) {
    if (!canvas) return null;
    const ctx = canvas.getContext('2d');
    const dpr = typeof window !== 'undefined' ? (window.devicePixelRatio || 1) : 1;
    const rect = canvas.getBoundingClientRect();

    if (rect.width === 0 || rect.height === 0) {
      return null;
    }

    const width = Math.round(rect.width);
    const height = Math.round(rect.height);

    if (canvas.width !== width * dpr || canvas.height !== height * dpr) {
      canvas.width = width * dpr;
      canvas.height = height * dpr;
    }
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    return { ctx, width, height, dpr };
  }

  /**
   * Truncates text cleanly with an ellipsis only if it exceeds maxWidth.
   */
  function truncateText(ctx, text, maxWidth) {
    if (!text) return '';
    const str = String(text).trim();
    if (!maxWidth || maxWidth <= 0 || ctx.measureText(str).width <= maxWidth) {
      return str;
    }
    const ellipsis = '…';
    const ellW = ctx.measureText(ellipsis).width;
    if (ellW >= maxWidth) return '';

    let low = 0;
    let high = str.length;
    let best = '';
    while (low <= high) {
      const mid = Math.floor((low + high) / 2);
      const sub = str.substring(0, mid).trimEnd() + ellipsis;
      if (ctx.measureText(sub).width <= maxWidth) {
        best = sub;
        low = mid + 1;
      } else {
        high = mid - 1;
      }
    }
    return best;
  }

  // Alias for backward compatibility
  function clampCanvasTitle(ctx, text, maxWidth) {
    return truncateText(ctx, text, maxWidth);
  }

  /**
   * 1. MULTI-LINE TIME SERIES CHART
   * Clean 2-tier layout:
   *   Row 1: Title
   *   Row 2+: Series Legends (wrapped if needed)
   *   Plot Area: Dynamic top padding so lines/thresholds never overlap headers
   */
  function drawLineChart(canvas, options = {}) {
    const setup = setupCanvas(canvas);
    if (!setup) return;
    const { ctx, width, height } = setup;

    const {
      title = '',
      series = [], // Array of { name, color, data: [{x, y}], dash: [] }
      xLabel = 'Time',
      yLabel = 'Value',
      yMin = null,
      yMax = null,
      thresholdBand = null, // { min, max, label, color }
      overlaySeries = null  // Comparison run series
    } = options;

    ctx.clearRect(0, 0, width, height);

    const hasTitle = Boolean(title);
    const hasLegend = series.length > 0;
    const titleY = 18;
    let legendStartY = hasTitle ? 36 : 18;

    // Measure legend wrapping to reserve proper top padding
    let legendRows = 1;
    if (hasLegend) {
      ctx.font = '11px sans-serif';
      let testX = 55;
      series.forEach(s => {
        if (!s.name) return;
        const itemW = 16 + ctx.measureText(s.name).width + 16;
        if (testX + itemW > width - 15 && testX > 55) {
          testX = 55;
          legendRows++;
        }
        testX += itemW;
      });
    }

    const topPad = (hasTitle ? 20 : 6) + (hasLegend ? (legendRows * 18) : 0) + 12;
    const padding = {
      top: Math.max(52, topPad),
      right: 25,
      bottom: 40,
      left: 55
    };

    const chartW = width - padding.left - padding.right;
    const chartH = height - padding.top - padding.bottom;

    if (series.length === 0 || series[0].data.length === 0) {
      ctx.fillStyle = PALETTE.grayText;
      ctx.font = '13px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('Awaiting simulation data...', width / 2, height / 2);
      return;
    }

    // Determine data bounds
    let allPoints = [];
    series.forEach(s => { allPoints = allPoints.concat(s.data); });
    if (overlaySeries) {
      overlaySeries.forEach(s => { allPoints = allPoints.concat(s.data); });
    }

    const minX = Math.min(...allPoints.map(p => p.x));
    const maxX = Math.max(...allPoints.map(p => p.x)) || 1;
    let computedMinY = yMin !== null ? yMin : Math.min(...allPoints.map(p => p.y));
    let computedMaxY = yMax !== null ? yMax : Math.max(...allPoints.map(p => p.y));

    if (computedMaxY === computedMinY) {
      computedMaxY += 1;
      computedMinY = Math.max(0, computedMinY - 1);
    }
    const yRange = computedMaxY - computedMinY;
    const effMaxY = yMax !== null ? yMax : computedMaxY + (yRange * 0.05);
    const effMinY = yMin !== null ? yMin : Math.max(0, computedMinY - (yRange * 0.05));

    function mapX(x) {
      return padding.left + ((x - minX) / (maxX - minX || 1)) * chartW;
    }
    function mapY(y) {
      return padding.top + chartH - ((y - effMinY) / (effMaxY - effMinY || 1)) * chartH;
    }

    // Draw Threshold Band (e.g. optimal plant moisture band)
    if (thresholdBand) {
      const bandTopY = Math.max(padding.top, mapY(thresholdBand.max));
      const bandBottomY = Math.min(padding.top + chartH, mapY(thresholdBand.min));
      const bandH = Math.max(0, bandBottomY - bandTopY);

      if (bandH > 0) {
        ctx.fillStyle = thresholdBand.color || 'rgba(76, 175, 80, 0.12)';
        ctx.fillRect(padding.left, bandTopY, chartW, bandH);

        // Position label cleanly inside or beside band without hitting x-axis
        if (bandH >= 12 && thresholdBand.label) {
          ctx.fillStyle = PALETTE.greenPrimary;
          ctx.font = '10px sans-serif';
          ctx.textAlign = 'right';
          const labelY = Math.min(bandBottomY - 4, bandTopY + 12);
          ctx.fillText(thresholdBand.label, padding.left + chartW - 6, labelY);
        }
      }
    }

    // Gridlines & Y-Axis ticks (dynamically spaced)
    ctx.strokeStyle = PALETTE.grayGrid;
    ctx.lineWidth = 1;
    ctx.beginPath();

    const yTicks = Math.max(2, Math.min(5, Math.floor(chartH / 32)));
    ctx.fillStyle = PALETTE.grayText;
    ctx.font = '11px sans-serif';
    ctx.textAlign = 'right';
    for (let i = 0; i <= yTicks; i++) {
      const val = effMinY + (i / yTicks) * (effMaxY - effMinY);
      const yPos = mapY(val);
      ctx.moveTo(padding.left, yPos);
      ctx.lineTo(padding.left + chartW, yPos);
      const str = val >= 10 ? val.toFixed(0) : val.toFixed(1);
      ctx.fillText(str, padding.left - 8, yPos + 4);
    }

    // X-Axis ticks (spaced to avoid collision)
    const xTicks = Math.max(2, Math.min(6, Math.floor(chartW / 65)));
    ctx.textAlign = 'center';
    for (let i = 0; i <= xTicks; i++) {
      const val = minX + (i / xTicks) * (maxX - minX);
      const xPos = mapX(val);
      ctx.moveTo(xPos, padding.top);
      ctx.lineTo(xPos, padding.top + chartH);
      ctx.fillText(val.toFixed(0), xPos, padding.top + chartH + 16);
    }
    ctx.stroke();

    // Chart Title (Row 1)
    if (title) {
      ctx.fillStyle = PALETTE.darkText;
      ctx.font = 'bold 12px sans-serif';
      ctx.textAlign = 'left';
      const maxTitleW = width - padding.left - padding.right;
      ctx.fillText(truncateText(ctx, title, maxTitleW), padding.left, titleY);
    }

    // Legend (Row 2+, wrapped if tight)
    if (hasLegend) {
      let curX = padding.left;
      let curY = legendStartY;
      ctx.font = '11px sans-serif';
      ctx.textAlign = 'left';

      series.forEach(s => {
        if (!s.name) return;
        const textW = ctx.measureText(s.name).width;
        const itemW = 16 + textW + 16;
        if (curX + itemW > width - 15 && curX > padding.left) {
          curX = padding.left;
          curY += 18;
        }

        ctx.fillStyle = s.color || PALETTE.greenPrimary;
        ctx.fillRect(curX, curY - 8, 12, 8);
        if (s.dash) {
          ctx.strokeStyle = '#ffffff';
          ctx.lineWidth = 1;
          ctx.beginPath();
          ctx.moveTo(curX + 6, curY - 8);
          ctx.lineTo(curX + 6, curY);
          ctx.stroke();
        }

        ctx.fillStyle = PALETTE.darkText;
        ctx.fillText(s.name, curX + 16, curY);
        curX += itemW;
      });
    }

    // Axis Labels
    ctx.fillStyle = PALETTE.grayText;
    ctx.font = '11px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(xLabel, padding.left + chartW / 2, height - 6);

    ctx.save();
    ctx.translate(14, padding.top + chartH / 2);
    ctx.rotate(-Math.PI / 2);
    ctx.fillText(yLabel, 0, 0);
    ctx.restore();

    // Draw Overlay Series (comparison baseline)
    if (overlaySeries) {
      overlaySeries.forEach(s => {
        if (!s.data || s.data.length === 0) return;
        ctx.save();
        ctx.strokeStyle = s.color || '#999999';
        ctx.setLineDash([5, 5]);
        ctx.lineWidth = 2;
        ctx.beginPath();
        s.data.forEach((pt, idx) => {
          const px = mapX(pt.x);
          const py = mapY(pt.y);
          if (idx === 0) ctx.moveTo(px, py);
          else ctx.lineTo(px, py);
        });
        ctx.stroke();
        ctx.restore();
      });
    }

    // Draw Main Series Lines
    series.forEach((s) => {
      if (!s.data || s.data.length === 0) return;
      ctx.save();
      ctx.strokeStyle = s.color || PALETTE.greenPrimary;
      ctx.lineWidth = 2.5;
      if (s.dash) ctx.setLineDash(s.dash);

      ctx.beginPath();
      s.data.forEach((pt, idx) => {
        const px = mapX(pt.x);
        const py = mapY(pt.y);
        if (idx === 0) ctx.moveTo(px, py);
        else ctx.lineTo(px, py);
      });
      ctx.stroke();

      const lastPt = s.data[s.data.length - 1];
      if (lastPt) {
        ctx.fillStyle = s.color || PALETTE.greenPrimary;
        ctx.beginPath();
        ctx.arc(mapX(lastPt.x), mapY(lastPt.y), 4, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();
    });
  }

  /**
   * 2. GROUPED / STACKED BAR CHART
   */
  function drawBarChart(canvas, options = {}) {
    const setup = setupCanvas(canvas);
    if (!setup) return;
    const { ctx, width, height } = setup;

    const {
      title = '',
      categories = ['Traditional Surface', 'Inverted Drip Feeder'],
      groups = [],
      yLabel = 'Litres (L)',
      maxValue = null
    } = options;

    ctx.clearRect(0, 0, width, height);

    const hasTitle = Boolean(title);
    const hasLegend = groups.length > 0;
    const titleY = 18;
    let legendStartY = hasTitle ? 36 : 18;

    let legendRows = 1;
    if (hasLegend) {
      ctx.font = '10px sans-serif';
      let testX = 55;
      groups.forEach(g => {
        if (!g.name) return;
        const itemW = 14 + ctx.measureText(g.name).width + 12;
        if (testX + itemW > width - 15 && testX > 55) {
          testX = 55;
          legendRows++;
        }
        testX += itemW;
      });
    }

    const topPad = (hasTitle ? 20 : 6) + (hasLegend ? (legendRows * 18) : 0) + 12;
    const padding = { top: Math.max(54, topPad), right: 25, bottom: 45, left: 55 };
    const chartW = width - padding.left - padding.right;
    const chartH = height - padding.top - padding.bottom;

    // Calculate maximum bar sum
    let maxVal = maxValue;
    if (maxVal === null) {
      maxVal = 0;
      categories.forEach((cat, cIdx) => {
        let sum = 0;
        groups.forEach(g => { sum += (g.values[cIdx] || 0); });
        if (sum > maxVal) maxVal = sum;
      });
      maxVal = Math.ceil(maxVal * 1.15) || 10;
    }

    // Gridlines
    ctx.strokeStyle = PALETTE.grayGrid;
    ctx.lineWidth = 1;
    ctx.beginPath();
    const ticks = Math.max(2, Math.min(5, Math.floor(chartH / 32)));
    ctx.fillStyle = PALETTE.grayText;
    ctx.font = '11px sans-serif';
    ctx.textAlign = 'right';
    for (let i = 0; i <= ticks; i++) {
      const val = (i / ticks) * maxVal;
      const yPos = padding.top + chartH - (i / ticks) * chartH;
      ctx.moveTo(padding.left, yPos);
      ctx.lineTo(padding.left + chartW, yPos);
      ctx.fillText(val.toFixed(1), padding.left - 8, yPos + 4);
    }
    ctx.stroke();

    // Title (Row 1)
    if (title) {
      ctx.fillStyle = PALETTE.darkText;
      ctx.font = 'bold 12px sans-serif';
      ctx.textAlign = 'left';
      ctx.fillText(truncateText(ctx, title, width - padding.left - padding.right), padding.left, titleY);
    }

    // Legend (Row 2+, wrapped)
    if (hasLegend) {
      let curX = padding.left;
      let curY = legendStartY;
      ctx.font = '10px sans-serif';
      ctx.textAlign = 'left';

      groups.forEach(g => {
        if (!g.name) return;
        const textW = ctx.measureText(g.name).width;
        const itemW = 14 + textW + 12;
        if (curX + itemW > width - 15 && curX > padding.left) {
          curX = padding.left;
          curY += 18;
        }

        ctx.fillStyle = g.color;
        ctx.fillRect(curX, curY - 8, 10, 8);
        ctx.fillStyle = PALETTE.darkText;
        ctx.fillText(g.name, curX + 14, curY);
        curX += itemW;
      });
    }

    // Draw stacked bars
    const catWidth = chartW / categories.length;
    const barWidth = Math.min(65, Math.max(26, catWidth * 0.42));

    categories.forEach((cat, cIdx) => {
      const catCenterX = padding.left + (cIdx * catWidth) + (catWidth / 2);
      const barX = catCenterX - (barWidth / 2);

      let currentBottomY = padding.top + chartH;
      let totalBarVal = 0;

      groups.forEach(g => {
        const val = g.values[cIdx] || 0;
        totalBarVal += val;
        const barH = (val / maxVal) * chartH;
        const barY = currentBottomY - barH;

        ctx.fillStyle = g.color;
        ctx.fillRect(barX, barY, barWidth, barH);
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 0.5;
        ctx.strokeRect(barX, barY, barWidth, barH);

        currentBottomY = barY;
      });

      // Total label on top of bar
      ctx.fillStyle = PALETTE.darkText;
      ctx.font = 'bold 11px sans-serif';
      ctx.textAlign = 'center';
      const labelY = Math.max(padding.top + 12, currentBottomY - 6);
      ctx.fillText(`${totalBarVal.toFixed(1)} L`, catCenterX, labelY);

      // Category label under bar
      ctx.font = '11px sans-serif';
      ctx.fillText(cat, catCenterX, padding.top + chartH + 18);
    });
  }

  /**
   * 3. HISTOGRAM CHART (Monte Carlo Project Duration)
   */
  function drawHistogram(canvas, options = {}) {
    const setup = setupCanvas(canvas);
    if (!setup) return;
    const { ctx, width, height } = setup;

    const {
      bins = [],
      mean = 16,
      targetDeadlineDays = 18,
      probWithinDeadline = 85,
      title = 'Project Completion Duration Distribution (1,000 Monte Carlo Runs)'
    } = options;

    ctx.clearRect(0, 0, width, height);
    const padding = { top: 58, right: 25, bottom: 42, left: 55 };
    const chartW = width - padding.left - padding.right;
    const chartH = height - padding.top - padding.bottom;

    if (bins.length === 0) return;

    const maxCount = Math.max(...bins.map(b => b.count)) || 1;
    const minDay = bins[0].binStart;
    const maxDay = bins[bins.length - 1].binEnd;

    function mapX(val) {
      return padding.left + ((val - minDay) / (maxDay - minDay)) * chartW;
    }
    function mapY(cnt) {
      return padding.top + chartH - (cnt / maxCount) * chartH;
    }

    // Gridlines
    ctx.strokeStyle = PALETTE.grayGrid;
    ctx.lineWidth = 1;
    ctx.beginPath();
    const ticks = Math.max(2, Math.min(5, Math.floor(chartH / 32)));
    for (let i = 0; i <= ticks; i++) {
      const yVal = (i / ticks) * maxCount;
      const yPos = padding.top + chartH - (i / ticks) * chartH;
      ctx.moveTo(padding.left, yPos);
      ctx.lineTo(padding.left + chartW, yPos);
      ctx.fillStyle = PALETTE.grayText;
      ctx.font = '10px sans-serif';
      ctx.textAlign = 'right';
      ctx.fillText(Math.round(yVal), padding.left - 6, yPos + 4);
    }
    ctx.stroke();

    // Bars
    bins.forEach(bin => {
      const bx1 = mapX(bin.binStart);
      const bx2 = mapX(bin.binEnd);
      const bw = Math.max(2, bx2 - bx1 - 2);
      const bh = (bin.count / maxCount) * chartH;
      const by = padding.top + chartH - bh;

      const isUnderDeadline = bin.binEnd <= targetDeadlineDays;
      ctx.fillStyle = isUnderDeadline ? 'rgba(46, 125, 50, 0.75)' : 'rgba(211, 47, 47, 0.75)';
      ctx.fillRect(bx1 + 1, by, bw, bh);

      ctx.strokeStyle = isUnderDeadline ? PALETTE.greenPrimary : PALETTE.redDanger;
      ctx.lineWidth = 1;
      ctx.strokeRect(bx1 + 1, by, bw, bh);
    });

    const meanX = mapX(mean);
    const deadlineX = mapX(targetDeadlineDays);
    const collision = Math.abs(meanX - deadlineX) < 110;

    // Mean Line (Dashed Blue)
    ctx.save();
    ctx.setLineDash([4, 4]);
    ctx.strokeStyle = PALETTE.waterBlue;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(meanX, padding.top);
    ctx.lineTo(meanX, padding.top + chartH);
    ctx.stroke();

    ctx.fillStyle = PALETTE.waterBlue;
    ctx.font = 'bold 11px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(`Mean: ${mean}d`, meanX, padding.top - 6);
    ctx.restore();

    // Target Deadline Line (Solid Red)
    if (deadlineX >= padding.left && deadlineX <= padding.left + chartW) {
      ctx.strokeStyle = PALETTE.redDanger;
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.moveTo(deadlineX, padding.top);
      ctx.lineTo(deadlineX, padding.top + chartH);
      ctx.stroke();

      ctx.fillStyle = PALETTE.redDanger;
      ctx.font = 'bold 11px sans-serif';
      ctx.textAlign = 'center';
      const targetLabelY = collision ? padding.top - 20 : padding.top - 6;
      ctx.fillText(`Target: ${targetDeadlineDays}d (${probWithinDeadline}%)`, deadlineX, targetLabelY);
    }

    // X-Axis ticks
    ctx.fillStyle = PALETTE.darkText;
    ctx.font = '10px sans-serif';
    ctx.textAlign = 'center';
    const binStep = Math.max(1, Math.ceil(bins.length / Math.max(2, Math.floor(chartW / 45))));
    bins.forEach((b, idx) => {
      if (idx % binStep === 0 || idx === bins.length - 1) {
        ctx.fillText(`${b.binStart}d`, mapX(b.binStart), padding.top + chartH + 16);
      }
    });

    // Title (Row 1)
    if (title) {
      ctx.fillStyle = PALETTE.darkText;
      ctx.font = 'bold 12px sans-serif';
      ctx.textAlign = 'left';
      ctx.fillText(truncateText(ctx, title, width - padding.left - padding.right), padding.left, 18);
    }
  }

  /**
   * 4. GANTT CHART (Critical Path Method & Project Activities)
   * Intelligent day step prevents day labels from clumping.
   * Multi-row legend prevents overlap with title.
   */
  function drawGanttChart(canvas, options = {}) {
    const setup = setupCanvas(canvas);
    if (!setup) return;
    const { ctx, width, height } = setup;

    const {
      activities = [],
      totalDuration = 18,
      title = 'Project Schedule Gantt Chart & Critical Path'
    } = options;

    ctx.clearRect(0, 0, width, height);

    const hasTitle = Boolean(title);
    const titleY = 18;
    const legendStartY = 36;
    let legendRows = 1;

    ctx.font = '10px sans-serif';
    const legItems = [
      { text: 'Critical Path (Zero Slack)', color: PALETTE.redDanger },
      { text: 'Non-Critical', color: PALETTE.greenPrimary },
      { text: 'Float / Slack', color: PALETTE.amberWarning, dash: true }
    ];
    let testX = 14;
    legItems.forEach(item => {
      const w = 16 + ctx.measureText(item.text).width + 16;
      if (testX + w > width - 15 && testX > 14) {
        testX = 14;
        legendRows++;
      }
      testX += w;
    });

    const topPad = (hasTitle ? 20 : 6) + (legendRows * 18) + 12;
    const leftPad = Math.min(185, Math.max(135, Math.floor(width * 0.26)));
    const padding = { top: Math.max(54, topPad), right: 25, bottom: 25, left: leftPad };
    const chartW = width - padding.left - padding.right;
    const chartH = height - padding.top - padding.bottom;

    if (activities.length === 0) return;

    const maxDays = Math.max(totalDuration, ...activities.map(a => a.EF)) + 1;
    const rowHeight = chartH / activities.length;

    function dayToX(day) {
      return padding.left + (day / maxDays) * chartW;
    }

    // Title (Row 1)
    if (title) {
      ctx.fillStyle = PALETTE.darkText;
      ctx.font = 'bold 12px sans-serif';
      ctx.textAlign = 'left';
      ctx.fillText(truncateText(ctx, title, width - 28), 14, titleY);
    }

    // Legend (Row 2+, wrapped)
    let curLegX = 14;
    let curLegY = legendStartY;
    legItems.forEach(item => {
      const itemW = 16 + ctx.measureText(item.text).width + 16;
      if (curLegX + itemW > width - 15 && curLegX > 14) {
        curLegX = 14;
        curLegY += 18;
      }

      ctx.fillStyle = item.color;
      ctx.fillRect(curLegX, curLegY - 8, 12, 8);
      if (item.dash) {
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 1;
        ctx.strokeRect(curLegX, curLegY - 8, 12, 8);
      }

      ctx.fillStyle = PALETTE.darkText;
      ctx.fillText(item.text, curLegX + 16, curLegY);
      curLegX += itemW;
    });

    // Intelligent Day step so numbers like D0, D1, D2 NEVER clump
    const daySpanPx = chartW / maxDays;
    let dayStep = 1;
    if (daySpanPx < 18) dayStep = 5;
    else if (daySpanPx < 32) dayStep = 2;

    // Draw Day Gridlines & Header
    ctx.lineWidth = 1;
    ctx.fillStyle = PALETTE.grayText;
    ctx.font = '10px sans-serif';
    ctx.textAlign = 'center';

    for (let d = 0; d <= maxDays; d++) {
      const xPos = dayToX(d);
      const isMajor = (d % dayStep === 0) || (d === maxDays);

      ctx.strokeStyle = isMajor ? PALETTE.grayGrid : '#f5f5f5';
      ctx.beginPath();
      ctx.moveTo(xPos, padding.top);
      ctx.lineTo(xPos, padding.top + chartH);
      ctx.stroke();

      if (isMajor) {
        ctx.fillText(`D${d}`, xPos, padding.top - 6);
      }
    }

    // Draw Task Bars
    activities.forEach((act, idx) => {
      const y = padding.top + (idx * rowHeight);
      const barH = Math.max(14, Math.min(22, rowHeight * 0.55));
      const barY = y + (rowHeight - barH) / 2;

      // Activity Name Label on the Left
      ctx.fillStyle = act.isCritical ? PALETTE.redDanger : PALETTE.darkText;
      ctx.font = act.isCritical ? 'bold 11px sans-serif' : '11px sans-serif';
      ctx.textAlign = 'right';

      const rawLabel = `${act.id}: ${act.name}`;
      const safeLabel = truncateText(ctx, rawLabel, padding.left - 12);
      ctx.fillText(safeLabel, padding.left - 8, barY + (barH / 2) + 4);

      // Early Start & Early Finish bar
      const barX1 = dayToX(act.ES);
      const barX2 = dayToX(act.EF);
      const barW = Math.max(4, barX2 - barX1);

      // Draw Slack (Float) Extension if present
      if (act.slack > 0) {
        const slackX2 = dayToX(act.LF);
        const slackW = slackX2 - barX2;
        ctx.fillStyle = 'rgba(255, 160, 0, 0.25)';
        ctx.fillRect(barX2, barY, slackW, barH);
        ctx.strokeStyle = PALETTE.amberWarning;
        ctx.setLineDash([2, 2]);
        ctx.strokeRect(barX2, barY, slackW, barH);
        ctx.setLineDash([]);
      }

      // Main Task Bar
      ctx.fillStyle = act.isCritical ? PALETTE.redDanger : PALETTE.greenPrimary;
      ctx.fillRect(barX1, barY, barW, barH);
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 1;
      ctx.strokeRect(barX1, barY, barW, barH);

      // Duration text inside or beside bar
      if (barW > 26) {
        ctx.fillStyle = '#ffffff';
        ctx.font = 'bold 10px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText(`${act.duration}d`, barX1 + (barW / 2), barY + (barH / 2) + 3);
      } else {
        ctx.fillStyle = PALETTE.darkText;
        ctx.font = '10px sans-serif';
        ctx.textAlign = 'left';
        ctx.fillText(`${act.duration}d`, barX2 + 4, barY + (barH / 2) + 3);
      }
    });
  }

  /**
   * 5. 2D SOIL MOISTURE HEATMAP GRID (20x20 Capillary Diffusion)
   */
  function drawHeatmapGrid(canvas, grid, options = {}) {
    const setup = setupCanvas(canvas);
    if (!setup) return;
    const { ctx, width, height } = setup;

    const {
      plantType = 'mint',
      soilType = 'cocopeat',
      showRootZone = true
    } = options;

    ctx.clearRect(0, 0, width, height);

    const size = grid ? grid.length : 20;
    const cellSize = Math.min((width - 40) / size, (height - 65) / size);
    const startX = (width - (size * cellSize)) / 2;
    const startY = 28;

    function getMoistureColor(val) {
      if (val < 0.25) {
        const t = val / 0.25;
        const r = Math.round(215 + t * (200 - 215));
        const g = Math.round(180 + t * (190 - 180));
        const b = Math.round(150 + t * (140 - 150));
        return `rgb(${r}, ${g}, ${b})`;
      } else if (val < 0.50) {
        const t = (val - 0.25) / 0.25;
        const r = Math.round(200 + t * (129 - 200));
        const g = Math.round(190 + t * (199 - 190));
        const b = Math.round(140 + t * (132 - 140));
        return `rgb(${r}, ${g}, ${b})`;
      } else if (val < 0.75) {
        const t = (val - 0.50) / 0.25;
        const r = Math.round(129 + t * (46 - 129));
        const g = Math.round(199 + t * (125 - 199));
        const b = Math.round(132 + t * (50 - 132));
        return `rgb(${r}, ${g}, ${b})`;
      } else {
        const t = (val - 0.75) / 0.25;
        const r = Math.round(46 + t * (2 - 46));
        const g = Math.round(125 + t * (136 - 125));
        const b = Math.round(50 + t * (209 - 50));
        return `rgb(${r}, ${g}, ${b})`;
      }
    }

    // Title
    ctx.fillStyle = PALETTE.darkText;
    ctx.font = 'bold 12px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('2D Soil Moisture Diffusion Heatmap (20×20 Matrix)', width / 2, 18);

    // Draw grid cells
    for (let r = 0; r < size; r++) {
      for (let c = 0; c < size; c++) {
        const val = grid && grid[r] ? grid[r][c] : 0.4;
        ctx.fillStyle = getMoistureColor(val);
        ctx.fillRect(startX + c * cellSize, startY + r * cellSize, cellSize, cellSize);
      }
    }

    // Drip Inflow Point marker at top center
    const emitterX = startX + 9.5 * cellSize;
    const emitterY = startY + 2.5 * cellSize;
    ctx.fillStyle = PALETTE.waterBlue;
    ctx.beginPath();
    ctx.arc(emitterX, emitterY, cellSize * 0.8, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 1.5;
    ctx.stroke();

    // Root Zone Dashed Boundary Box
    if (showRootZone) {
      const rRowStart = 6;
      const rRowEnd = 14;
      const rColStart = 6;
      const rColEnd = 13;

      const rX = startX + rColStart * cellSize;
      const rY = startY + rRowStart * cellSize;
      const rW = (rColEnd - rColStart + 1) * cellSize;
      const rH = (rRowEnd - rRowStart + 1) * cellSize;

      ctx.save();
      ctx.strokeStyle = '#ffff00';
      ctx.lineWidth = 2;
      ctx.setLineDash([3, 3]);
      ctx.strokeRect(rX, rY, rW, rH);
      ctx.restore();

      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 10px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('Plant Root Zone', rX + rW / 2, rY + rH - 4);
    }

    // Heatmap Colorbar Legend at Bottom (Cleanly centered underneath)
    const barW = Math.min(180, Math.max(120, width * 0.5));
    const barH = 8;
    const barX = (width - barW) / 2;
    const barY = startY + size * cellSize + 8;

    const grad = ctx.createLinearGradient(barX, 0, barX + barW, 0);
    grad.addColorStop(0, getMoistureColor(0.1));
    grad.addColorStop(0.35, getMoistureColor(0.35));
    grad.addColorStop(0.65, getMoistureColor(0.65));
    grad.addColorStop(1, getMoistureColor(0.95));

    ctx.fillStyle = grad;
    ctx.fillRect(barX, barY, barW, barH);
    ctx.strokeStyle = '#888888';
    ctx.strokeRect(barX, barY, barW, barH);

    ctx.fillStyle = PALETTE.grayText;
    ctx.font = '10px sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText('Dry (10%)', barX, barY + 18);
    ctx.textAlign = 'right';
    ctx.fillText('Saturated (100%)', barX + barW, barY + 18);
  }

  /**
   * 6. STRUCTURAL PLANTER STACK VISUALIZER (Hanging bottles, hook, tension vectors)
   */
  function drawHangingPlanterStack(canvas, options = {}) {
    const setup = setupCanvas(canvas);
    if (!setup) return;
    const { ctx, width, height } = setup;

    const {
      bottleCount = 4,
      totalWetLoadKg = 4.8,
      safetyFactor = 2.5,
      ropeType = 'nylon',
      ropeStrands = 2,
      hookRatingKg = 50,
      saturationPercent = 60,
      verdict = 'Safe',
      statusClass = 'safe'
    } = options;

    ctx.clearRect(0, 0, width, height);

    // Wall & Hook at top
    const boxW = Math.min(160, Math.max(120, width * 0.28));
    const boxH = 75;
    const boxX = width - boxW - 12;
    const boxY = 38;

    // Center stack nicely in left/middle region so it never overlaps the verdict box
    const centerX = (width < 450) ? (boxX / 2) : (width / 2);
    const topY = 35;

    let tensionColor = PALETTE.greenPrimary;
    if (statusClass === 'warning') tensionColor = PALETTE.amberWarning;
    if (statusClass === 'danger') tensionColor = PALETTE.redDanger;

    // Draw Masonry Wall Surface
    ctx.fillStyle = '#cfd8dc';
    ctx.fillRect(centerX - 80, 8, 160, 16);
    ctx.strokeStyle = '#90a4ae';
    ctx.strokeRect(centerX - 80, 8, 160, 16);

    ctx.fillStyle = PALETTE.darkText;
    ctx.font = 'bold 10px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(`Wall Anchor (${hookRatingKg} kgf)`, centerX, 20);

    // Wall Hook
    ctx.strokeStyle = '#37474f';
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.arc(centerX, topY + 4, 7, Math.PI, 0, false);
    ctx.lineTo(centerX, topY + 14);
    ctx.stroke();

    // Vertical spacing for bottles
    const count = Math.min(10, Math.max(1, bottleCount));
    const availH = height - topY - 45;
    const bottleH = Math.min(34, availH / (count * 1.3));
    const bottleW = Math.min(75, Math.max(45, (width < 450 ? boxX - 20 : 75)));
    const spacing = availH / count;

    // Draw Hanging Ropes (2 strands)
    const ropeLeftX = centerX - (bottleW / 2) - 4;
    const ropeRightX = centerX + (bottleW / 2) + 4;
    const bottomRopeY = topY + (count * spacing);

    ctx.strokeStyle = tensionColor;
    ctx.lineWidth = ropeStrands >= 2 ? 3 : 1.5;
    ctx.beginPath();
    ctx.moveTo(centerX, topY + 14);
    ctx.lineTo(ropeLeftX, topY + 25);
    ctx.lineTo(ropeLeftX, bottomRopeY);
    ctx.moveTo(centerX, topY + 14);
    ctx.lineTo(ropeRightX, topY + 25);
    ctx.lineTo(ropeRightX, bottomRopeY);
    ctx.stroke();

    // Draw Each Repurposed PET Bottle
    for (let i = 0; i < count; i++) {
      const bY = topY + 25 + (i * spacing);

      // Bottle Outline
      ctx.fillStyle = 'rgba(255, 255, 255, 0.85)';
      ctx.strokeStyle = '#455a64';
      ctx.lineWidth = 1.5;

      ctx.beginPath();
      ctx.roundRect(centerX - (bottleW / 2), bY, bottleW, bottleH, 6);
      ctx.fill();
      ctx.stroke();

      // Soil fill level inside bottle
      const soilH = bottleH * 0.7;
      const soilY = bY + bottleH - soilH;
      const sat = saturationPercent / 100;
      const soilColor = sat > 0.7 ? '#4e342e' : '#795548';

      ctx.fillStyle = soilColor;
      ctx.beginPath();
      ctx.roundRect(centerX - (bottleW / 2) + 3, soilY, bottleW - 6, soilH - 2, [0, 0, 4, 4]);
      ctx.fill();

      if (sat > 0.4) {
        ctx.fillStyle = 'rgba(2, 136, 209, 0.4)';
        ctx.fillRect(centerX - (bottleW / 2) + 3, soilY, bottleW - 6, 2);
      }

      // Small plant green sprig
      ctx.fillStyle = PALETTE.greenPrimary;
      ctx.beginPath();
      ctx.ellipse(centerX - 6, soilY - 4, 6, 3, -0.3, 0, Math.PI * 2);
      ctx.ellipse(centerX + 6, soilY - 4, 6, 3, 0.3, 0, Math.PI * 2);
      ctx.fill();

      // Tier label
      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 9px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(`T${i + 1}`, centerX, soilY + (soilH / 2) + 3);
    }

    // Safety Verdict Box on Right Side
    ctx.fillStyle = statusClass === 'danger' ? '#ffebee' : (statusClass === 'warning' ? '#fff8e1' : '#e8f5e9');
    ctx.fillRect(boxX, boxY, boxW, boxH);
    ctx.strokeStyle = tensionColor;
    ctx.lineWidth = 2;
    ctx.strokeRect(boxX, boxY, boxW, boxH);

    ctx.fillStyle = tensionColor;
    ctx.font = 'bold 11px sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText(truncateText(ctx, `Verdict: ${verdict}`, boxW - 12), boxX + 8, boxY + 18);

    ctx.fillStyle = PALETTE.darkText;
    ctx.font = '10px sans-serif';
    ctx.fillText(`Load: ${totalWetLoadKg} kgf`, boxX + 8, boxY + 36);
    ctx.fillText(`SF: ${safetyFactor}`, boxX + 8, boxY + 52);
    ctx.font = '9px sans-serif';
    ctx.fillText(`Rope: ${ropeType.toUpperCase()}`, boxX + 8, boxY + 67);
  }

  /**
   * 7. 5x5 RISK MATRIX HEATMAP (ISO 31000 Probability vs Impact)
   */
  function drawRiskMatrix5x5(canvas, evaluatedRisks = [], options = {}) {
    const setup = setupCanvas(canvas);
    if (!setup) return;
    const { ctx, width, height } = setup;

    ctx.clearRect(0, 0, width, height);

    const padding = { top: 35, right: 25, bottom: 45, left: 55 };
    const chartW = width - padding.left - padding.right;
    const chartH = height - padding.top - padding.bottom;
    const cellW = chartW / 5;
    const cellH = chartH / 5;

    function getCellColor(p, i) {
      const score = p * i;
      if (score <= 4) return '#c8e6c9'; // Low: Green
      if (score <= 9) return '#fff59d'; // Moderate: Yellow
      if (score <= 15) return '#ffe082'; // High: Amber
      return '#ffcdd2';                 // Critical: Red
    }

    for (let p = 1; p <= 5; p++) {
      for (let i = 1; i <= 5; i++) {
        const cellX = padding.left + (i - 1) * cellW;
        const cellY = padding.top + (5 - p) * cellH;

        ctx.fillStyle = getCellColor(p, i);
        ctx.fillRect(cellX, cellY, cellW, cellH);
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 1.5;
        ctx.strokeRect(cellX, cellY, cellW, cellH);

        ctx.fillStyle = 'rgba(0,0,0,0.18)';
        ctx.font = 'bold 11px sans-serif';
        ctx.textAlign = 'right';
        ctx.fillText(p * i, cellX + cellW - 4, cellY + cellH - 4);
      }
    }

    // Axis Labels
    ctx.fillStyle = PALETTE.darkText;
    ctx.font = 'bold 11px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('Impact Severity (1 = Negligible, 5 = Catastrophic) →', padding.left + chartW / 2, height - 12);

    ctx.save();
    ctx.translate(16, padding.top + chartH / 2);
    ctx.rotate(-Math.PI / 2);
    ctx.fillText('← Probability (1 = Rare, 5 = High)', 0, 0);
    ctx.restore();

    // Plot Risk Tokens
    evaluatedRisks.forEach((risk, rIdx) => {
      const p = risk.activeP;
      const i = risk.activeI;

      const cellCenterX = padding.left + (i - 1) * cellW + (cellW / 2);
      const cellCenterY = padding.top + (5 - p) * cellH + (cellH / 2);

      const jitterOffset = (rIdx % 3 - 1) * 8;

      ctx.fillStyle = risk.severity.color;
      ctx.beginPath();
      ctx.arc(cellCenterX + jitterOffset, cellCenterY + jitterOffset, 12, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 2;
      ctx.stroke();

      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 10px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(risk.id, cellCenterX + jitterOffset, cellCenterY + jitterOffset + 3.5);
    });

    // Title
    ctx.fillStyle = PALETTE.darkText;
    ctx.font = 'bold 12px sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText('5×5 Risk Assessment Matrix (ISO 31000 Standards)', padding.left, 20);
  }

  // ==========================================================================
  // EXPORT PUBLIC CHARTS API
  // ==========================================================================
  return {
    PALETTE,
    truncateText,
    clampCanvasTitle,
    drawLineChart,
    drawBarChart,
    drawHistogram,
    drawGanttChart,
    drawHeatmapGrid,
    drawHangingPlanterStack,
    drawRiskMatrix5x5
  };
});
