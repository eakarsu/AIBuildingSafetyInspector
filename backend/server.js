const express = require('express');
const cors = require('cors');
require('dotenv').config({ path: '../.env' });

const app = express();
const PORT = process.env.BACKEND_PORT || 3001;

app.use(cors());
app.use(express.json());

// Routes
app.use('/api/auth', require('./routes/auth'));
app.use('/api/inspections', require('./routes/inspections'));
app.use('/api/violations', require('./routes/violations'));
app.use('/api/checklists', require('./routes/checklists'));
app.use('/api/incidents', require('./routes/incidents'));
app.use('/api/equipment', require('./routes/equipment'));
app.use('/api/certifications', require('./routes/certifications'));
app.use('/api/training', require('./routes/training'));
app.use('/api/hazards', require('./routes/hazards'));
app.use('/api/documents', require('./routes/documents'));
app.use('/api/emergency', require('./routes/emergency'));
app.use('/api/ppe', require('./routes/ppe'));
app.use('/api/corrections', require('./routes/corrections'));
app.use('/api/ai', require('./routes/ai'));
app.use('/api/reports', require('./routes/reports'));
app.use('/api/dashboard', require('./routes/dashboard'));

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

app.listen(PORT, () => {
  console.log(`Backend server running on port ${PORT}`);
});
