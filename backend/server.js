const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = 3000;

// Middleware
app.use(cors()); // Allow requests from your frontend
app.use(express.json()); // Allow server to accept JSON in request body

// Load data from JSON file
const dataPath = path.join(__dirname, 'data.json');
const applicantsData = JSON.parse(fs.readFileSync(dataPath, 'utf-8'));

// --- API Endpoints ---

// GET /api/kpis - Dashboard KPIs
app.get('/api/kpis', (req, res) => {
    const totalApplicants = Object.keys(applicantsData).length;
    const highRiskAlerts = Object.values(applicantsData).filter(app => {
        const latestRecord = app.history.reduce((latest, current) => 
            (current.Month_Offset > latest.Month_Offset) ? current : latest, app.history[0]
        );
        return latestRecord.Risk_Category === 'High';
    }).length;

    res.json({
        applicationsToday: totalApplicants, // Simulating 'today'
        highRiskAlerts: highRiskAlerts,
        avgAssessmentTime: '2.8s', // Static for demo
        modelAccuracy: '93.4%' // Static for demo
    });
});

// GET /api/applicants - Get all applicants for the list
app.get('/api/applicants', (req, res) => {
    const summaryList = Object.entries(applicantsData).map(([id, data]) => {
        const latestRecord = data.history.reduce((latest, current) => 
            (current.Month_Offset > latest.Month_Offset) ? current : latest, data.history[0]
        );
        return {
            id,
            name: data.personal.name,
            riskCategory: latestRecord.Risk_Category,
            riskPercentage: (latestRecord.Predicted_Prob_Default * 100).toFixed(2)
        };
    });
    res.json(summaryList);
});

// GET /api/applicants/:id - Get full details for one applicant
app.get('/api/applicants/:id', (req, res) => {
    const { id } = req.params;
    if (applicantsData[id]) {
        res.json(applicantsData[id]);
    } else {
        res.status(404).json({ error: 'Applicant not found' });
    }
});

// POST /api/analyze/:id - Simulate a slow AI analysis
app.post('/api/analyze/:id', (req, res) => {
    const { id } = req.params;
    if (applicantsData[id]) {
        // Simulate a 2-second delay for analysis
        setTimeout(() => {
            res.json({
                summary: applicantsData[id].geminiSummary,
                drivers: applicantsData[id].riskDrivers || ["No specific drivers identified."]
            });
        }, 2000);
    } else {
        res.status(404).json({ error: 'Applicant not found' });
    }
});

// POST /api/simulate - Run a "What-If" scenario
app.post('/api/simulate', (req, res) => {
    const { id, income, loanAmount } = req.body;
    
    if (!applicantsData[id]) {
        return res.status(404).json({ error: 'Applicant not found' });
    }

    const baseApplicant = applicantsData[id];
    const baseProb = baseApplicant.history.reduce((latest, current) => 
        (current.Month_Offset > latest.Month_Offset) ? current : latest, baseApplicant.history[0]
    ).Predicted_Prob_Default;
    
    // IMPORTANT: This is a dummy formula for demonstration purposes ONLY.
    // It creates an interactive effect but has no real financial meaning.
    const incomeFactor = 50000 / (income || 50000); // Base income of 50k
    const loanFactor = (loanAmount || 20000) / 20000; // Base loan of 20k
    let simulatedProb = baseProb * incomeFactor * loanFactor;
    simulatedProb = Math.min(Math.max(simulatedProb, 0.05), 0.98); // Clamp between 5% and 98%

    let riskCategory;
    if (simulatedProb < 0.3) riskCategory = 'Low';
    else if (simulatedProb < 0.7) riskCategory = 'Medium';
    else riskCategory = 'High';

    res.json({
        simulatedProb,
        riskCategory
    });
});


// Start server
app.listen(PORT, () => {
    console.log(`RISKON backend server running on http://localhost:${PORT}`);
});
