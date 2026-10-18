/**
 * server.js
 * Lightweight Node.js + Express server for the PET Hydro-Planter Simulation App.
 *
 * NOTE: As per project requirements, the server is used ONLY to serve static
 * assets from /public and serve presets from public/data/presets.json.
 * The application can also run standalone by directly opening public/index.html in a browser.
 */

const express = require('express');
const path = require('path');
const fs = require('fs');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware for logging requests
app.use((req, res, next) => {
  const now = new Date().toISOString();
  console.log(`[${now}] ${req.method} ${req.url}`);
  next();
});

// Serve static files from the 'public' directory
app.use(express.static(path.join(__dirname, 'public')));

// Optional API route to serve presets from JSON file
app.get('/api/presets', (req, res) => {
  const presetsPath = path.join(__dirname, 'public', 'data', 'presets.json');
  fs.readFile(presetsPath, 'utf8', (err, data) => {
    if (err) {
      console.error('Error reading presets.json:', err);
      return res.status(500).json({ error: 'Failed to read presets configuration file' });
    }
    try {
      const presets = JSON.parse(data);
      res.setHeader('Content-Type', 'application/json');
      res.json(presets);
    } catch (parseErr) {
      console.error('Error parsing presets JSON:', parseErr);
      res.status(500).json({ error: 'Invalid JSON format in presets.json' });
    }
  });
});

// Server info route
app.get('/api/info', (req, res) => {
  res.json({
    project: 'Low-Cost Vertical Hydro-Planter Station Simulation',
    institution: 'L. D. College of Engineering, Ahmedabad',
    course: 'B.E. Sem V Information Technology - Project Management',
    status: 'online',
    version: '1.0.0'
  });
});

// Fallback for SPA routing to index.html
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Start listening
app.listen(PORT, () => {
  console.log('================================================================');
  console.log(' 🌱 PET Hydro-Planter Simulation Server Running');
  console.log(` 🚀 URL: http://localhost:${PORT}`);
  console.log(` 📂 Serving static files from: ${path.join(__dirname, 'public')}`);
  console.log(' 💡 Direct file access supported: public/index.html');
  console.log('================================================================');
});
