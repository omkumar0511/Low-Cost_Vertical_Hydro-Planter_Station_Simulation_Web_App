# 🌱 Low-Cost Vertical Hydro-Planter Station Simulation Web App
> **"Best Out of Waste" B.E. Sem V IT Micro-Project — Project Management**  
> **L. D. College of Engineering (LDCE), Ahmedabad**

An interactive, physics-grounded simulation dashboard modeling a low-cost vertical hydro-planter station fabricated from repurposed campus PET waste bottles, inverted drip irrigation feeders, lightweight coco-peat growing medium, and RO reject water.

---

## 🚀 Key Features

1. **Module 1: Drip Feeder Simulator (Main Module)**
   - Torricelli's orifice outflow equation: $Q = C_d \cdot A \cdot \sqrt{2gh}$ with dynamic soil backpressure, bio-clogging, and calibration factor.
   - 2D finite-difference moisture diffusion matrix ($20 \times 20$ grid) rendered as an interactive live heatmap.
   - Evaporation loss (temperature & sunlight driven) and diurnal plant root uptake.
   - Dynamic plant health and stress tracking (optimal band vs. wilting vs. waterlogged hypoxia).
   - Animated canvas visualization of bottle draining, falling droplets, and plant health state.
   - Speed selector: $1\times$, $10\times$, $100\times$, $1000\times$ with Play/Pause/Step/Reset controls.

2. **Module 2: Water Efficiency Comparison**
   - Side-by-side comparative simulation: Traditional Surface Can Watering vs. Inverted Bottle Subsurface Drip over 7–30 days.
   - Verifies the report's claim: *"Drip irrigation is up to 70% more water-efficient than surface watering"*.
   - Toggle source water: Municipal tap water vs. RO Plant Reject Water vs. Canteen Leftover Drinking Water.
   - Sensitivity testing with editable evaporation, runoff, and deep percolation loss sliders.

3. **Module 3: Hanging Planter Load & Safety Simulator**
   - Evaluates multi-tier vertical suspended planter stacks (1–10 bottles).
   - Computes dry load, water mass added upon wetting, total load, and cable tension.
   - Calculates structural Safety Factor ($SF = \min(SF_{\text{rope}}, SF_{\text{hook}})$).
   - Dynamic *"Pour Water"* button that raises saturation in real-time, displaying green (safe), orange (marginal), or red (failure alert).
   - Demonstrates why lightweight coco-peat ($0.12\text{ kg/L}$) is critical vs. heavy garden soil ($1.25\text{ kg/L}$).

4. **Module 4: 7-Day Testing & Monitoring Simulation**
   - Replicates the empirical 7-day testing phase with sinusoidal diurnal day/night temperature cycles.
   - Models solar radiation and photo-autotrophic algae colonization in clear PET bottles.
   - Mid-run human interventions: Refill bottle, adjust cap hole size, paint bottle black (UV/algae shield), add 50% shade net.
   - Generates an hourly telemetry table ($168$ hours) and a final report card with Letter Grade (A+ to F).

5. **Module 5: Project Management Simulator**
   - Critical Path Method (CPM): Forward/backward pass, Early/Late start and finish, Total Float (Slack), and interactive Canvas Gantt Chart with the critical path highlighted in red.
   - Monte Carlo Simulation ($1,000$ iterations) using Triangular distributions ($a, m, b$) to determine probability of on-time completion.
   - Parametric Cost Model: itemized BOM scaling with bottle count (20-bottle base station costs under Rs. 250).
   - ISO 31000 $5 \times 5$ Risk Matrix Heatmap with active engineering mitigation checklist.

6. **Module 6: Environmental Impact & Campus Greening**
   - Calculates plastic waste diverted from landfill (kg and volume), carbon emissions avoided (kg CO₂e), potable tap water conserved, and vertical wall green area created ($m^2$).

7. **Zero External Chart Libraries**
   - Built exclusively with plain HTML5, CSS3, and vanilla JavaScript using the native Canvas API.
   - Operates both via Node.js Express server (`http://localhost:3000`) and by directly opening `public/index.html` (`file://`).

---

## 📂 File Architecture

```
d:/Projects/PM/
├── package.json               # Node.js dependencies (express) and run scripts
├── server.js                  # Express static server & /api/presets endpoint
├── README.md                  # Comprehensive documentation and viva preparation guide
└── public/
    ├── index.html             # Main dashboard interface and layout
    ├── css/
    │   └── style.css          # Eco-palette (dark/light) styles & print stylesheet
    ├── data/
    │   └── presets.json       # Built-in scenarios (Baseline, Hot Summer, Clogged, Overloaded)
    └── js/
        ├── model.js           # Centralized physics, fluid flow, diffusion, CPM, and cost formulas
        ├── charts.js          # Custom HTML5 Canvas charting engine (lines, bars, Gantt, heatmaps)
        ├── storage.js         # localStorage manager, fallback presets, and CSV exporter
        ├── ui.js              # Tab navigation, theme toggle, modals, and toasts
        ├── module1.js         # Drip Feeder & 2D Soil Diffusion Simulator
        ├── module2.js         # Water Efficiency Comparison Simulator
        ├── module3.js         # Hanging Planter Load & Safety Simulator
        ├── module4.js         # 7-Day Testing & Monitoring Simulator
        ├── module5.js         # Project Management (CPM, Gantt, Monte Carlo, Cost, Risk)
        └── module6.js         # Environmental Impact Calculator
```

---

## ⚡ How to Run

### Method 1: Node.js Express Server (Recommended)
```bash
# 1. Install dependencies (Express)
npm install

# 2. Start the web server
npm start
```
Open your web browser and navigate to:
**`http://localhost:3000`**

### Method 2: Direct File Execution (No Server Required!)
Simply double-click or open:
**`d:/Projects/PM/public/index.html`** in Chrome, Edge, Firefox, or Safari.
*The application includes embedded fallback presets so it runs seamlessly over `file://` without CORS restrictions.*

---

## 🎓 Viva-Voce Examination Guide & Formula Explanations

### 1. Torricelli's Law for Bottle Drip Outflow
* **Formula:**
  $$v = \sqrt{2gh}$$
  $$Q = C_d \cdot A_{\text{hole}} \cdot \sqrt{2gh} \cdot (1 - \text{Clogging}) \cdot F_{\text{back}} \cdot K_{\text{calib}}$$
* **Why used:** Derived from Bernoulli's energy conservation theorem. Water exits the 2 mm cap orifice under hydrostatic head height $h$. $C_d \approx 0.60$ accounts for orifice vena contracta contraction.
* **Real-World Rationale & Limitations:** In ideal atmospheric discharge, a 2 mm hole empties 2 L in minutes. However, when buried in soil, capillary boundary resistance and soil counter-pressure ($F_{\text{back}}$) restrict the discharge into a steady micro-drip ($15\text{–}60\text{ ml/hr}$). The calibration factor $K_{\text{calib}}$ matches empirical observations.

### 2. 2D Capillary Soil Moisture Diffusion
* **Formula:**
  $$\frac{\partial \theta}{\partial t} = D \nabla^2 \theta - \text{Evaporation} - \text{RootUptake}$$
* **Why used:** Discretizes the root zone into a $20 \times 20$ finite-difference matrix.
* **Why Coco-Peat:** Coco-peat possesses a high capillary diffusion coefficient ($D = 0.18$) and high field capacity ($85\%$), distributing moisture laterally to fibrous roots. Mineral garden soil channels water straight down into runoff ($D = 0.07$, field capacity $50\%$).

### 3. Hanging Planter Structural Mechanics & Factor of Safety
* **Formula:**
  $$\text{Wet Load} = \sum_{k=1}^N \left[ M_{\text{PET}} + (V_{\text{soil}} \cdot \rho_{\text{dry}}) + M_{\text{plant}} + (V_{\text{soil}} \cdot \phi \cdot S \cdot \rho_w) \right]$$
  $$SF = \min\left( \frac{F_{\text{rope}} \cdot n_{\text{strands}}}{\text{Total Load}}, \frac{F_{\text{hook}}}{\text{Total Load}} \right)$$
* **Why used:** Evaluates tension in suspended vertical planters. Structural engineering requires $SF \ge 2.0$.
* **Viva Insight:** Why coco-peat instead of garden soil? Garden soil is nearly $10\times$ heavier ($1.25\text{ kg/L}$ vs $0.12\text{ kg/L}$). When saturated, a 5-bottle garden soil stack weighs over $14\text{ kgf}$, snapping natural twine and pulling wall plugs from masonry. Coco-peat keeps wet stack weight under $4.5\text{ kgf}$.

### 4. Critical Path Method (CPM)
* **Formulas:**
  $$\text{ES} = \max(\text{EF}_{\text{preds}}), \quad \text{EF} = \text{ES} + \text{Duration}$$
  $$\text{LF} = \min(\text{LS}_{\text{succs}}), \quad \text{LS} = \text{LF} - \text{Duration}$$
  $$\text{Total Float (Slack)} = \text{LS} - \text{ES} = \text{LF} - \text{EF}$$
* **Critical Path:** Tasks where $\text{Slack} = 0$. In this micro-project, Activity 5 (7-day Testing & Monitoring) constitutes the primary time bottleneck.

### 5. Monte Carlo Simulation (Triangular Distribution)
* **Formulas:**
  $$X = a + \sqrt{U(b-a)(m-a)} \quad \text{for } U < \frac{m-a}{b-a}$$
  $$X = b - \sqrt{(1-U)(b-a)(b-m)} \quad \text{for } U \ge \frac{m-a}{b-a}$$
* **Why used:** Accounts for stochastic uncertainty (procuring canteen bottles, rainy days, fabrication mishaps) across 1,000 iterations to predict probability of meeting target deadlines.

### 6. Environmental Upcycling Metrics
* **Formulas:**
  $$\text{Plastic Diverted (kg)} = N_{\text{bottles}} \times 0.045\text{ kg}$$
  $$\text{Carbon Offset} = \text{Plastic Diverted} \times 2.15\text{ kg CO}_2\text{e/kg}$$
* Diverting 60 bottles saves $2.7\text{ kg}$ of landfill plastic, avoids $5.81\text{ kg CO}_2\text{e}$ of virgin polymer production, and saves over Rs. 6,400 compared to commercial ceramic/plastic planter walls.
