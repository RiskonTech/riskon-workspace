document.addEventListener('DOMContentLoaded', () => {

    // --- CONFIG & STATE ---
    const API_BASE_URL = 'https://riskon.onrender.com/api';
    let currentApplicantData = {};
    let riskChartInstance = null;
    let applicantsCache = [];

    // --- ELEMENT SELECTORS ---
    const heroContainer = document.getElementById('hero-container');
    const heroContent = document.getElementById('hero-content');
    const launchBtn = document.getElementById('launch-btn');
    const workspaceContainer = document.getElementById('workspace-container');
    const logoContainer = document.getElementById('logo-container');
    const dashboardView = document.getElementById('dashboard-view');
    const reportView = document.getElementById('report-view');
    const kpiGrid = document.querySelector('.kpi-grid');
    const applicantList = document.getElementById('applicant-list');
    const searchBar = document.getElementById('search-bar');

    // --- SVG FOR ANIMATION ---
    const riskonSVG = `
    <svg viewBox="0 0 400 60" xmlns="http://www.w3.org/2000/svg">
      <text x="10" y="45" font-family="Inter, sans-serif" font-size="50" font-weight="800">
        RISKON
      </text>
    </svg>`;
    
    // --- INITIALIZATION ---
    function init() {
        setupHeroAnimation();
        setupEventListeners();
    }

    // --- HERO ANIMATION & TRANSITION ---
    function setupHeroAnimation() {
        heroContent.insertAdjacentHTML('afterbegin', riskonSVG);
        const heroSVGText = heroContent.querySelector('text');

        gsap.set('.hero-subtitle', { opacity: 0, y: 20 });
        gsap.set('#launch-btn', { scale: 0 });
        
        const tl = gsap.timeline();
        tl.to(heroSVGText, { strokeDashoffset: 0, duration: 2.5, ease: 'power2.inOut' })
          .to('.hero-subtitle', { opacity: 1, y: 0, duration: 0.8 }, "-=1")
          .to('#launch-btn', { scale: 1, duration: 0.8, ease: 'elastic.out(1, 0.5)' }, "-=0.5");
    }

    function launchWorkspace() {
        const heroSVG = heroContent.querySelector('svg');
        const finalLogoRect = logoContainer.getBoundingClientRect();
        const initialSVGRect = heroSVG.getBoundingClientRect();
        
        // Move the SVG to the body to escape its container for the transition
        document.body.appendChild(heroSVG);
        gsap.set(heroSVG, {
            position: 'absolute',
            top: initialSVGRect.top,
            left: initialSVGRect.left,
            width: initialSVGRect.width,
            height: initialSVGRect.height,
            margin: 0
        });

        const tl = gsap.timeline({ onComplete: loadDashboard });
        tl.to([launchBtn, '.hero-subtitle'], { opacity: 0, duration: 0.3 })
          .to(heroSVG, {
              top: finalLogoRect.top,
              left: finalLogoRect.left,
              width: finalLogoRect.width,
              height: finalLogoRect.height,
              duration: 1.2,
              ease: 'power2.inOut'
          }, "+=0.2")
          .to(heroSVG, { fill: 'white', stroke: 'transparent', duration: 0.5 }, "-=0.5")
          .to(heroContainer, { opacity: 0, duration: 0.5, onComplete: () => heroContainer.remove() }, "-=1.2")
          .fromTo(workspaceContainer, { opacity: 0 }, { opacity: 1, duration: 0.8, onStart: () => {
              workspaceContainer.classList.remove('hidden');
              logoContainer.appendChild(heroSVG); // Put SVG in its final home
              gsap.set(heroSVG, { position: 'static', width: 'auto', height: '100%' }); // Reset styles
          }}, "-=0.8");
    }

    // --- DASHBOARD ---
    async function loadDashboard() {
        try {
            // Fetch KPIs and Applicants in parallel
            const [kpiRes, applicantsRes] = await Promise.all([
                fetch(`${API_BASE_URL}/kpis`),
                fetch(`${API_BASE_URL}/applicants`)
            ]);
            if (!kpiRes.ok || !applicantsRes.ok) throw new Error('Network response was not ok.');
            
            const kpis = await kpiRes.json();
            applicantsCache = await applicantsRes.json();

            renderKPIs(kpis);
            renderApplicantList(applicantsCache);
        } catch (error) {
            console.error("Failed to load dashboard data:", error);
            applicantList.innerHTML = `<p style="color: var(--risk-high);">Failed to load data. Is the backend server running?</p>`;
        }
    }
    
    function renderKPIs(kpis) {
        kpiGrid.innerHTML = `
            <div class="kpi-card">
                <p class="label">Applications Today</p>
                <p class="value">${kpis.applicationsToday}</p>
            </div>
            <div class="kpi-card">
                <p class="label">High-Risk Alerts</p>
                <p class="value risk-high">${kpis.highRiskAlerts}</p>
            </div>
            <div class="kpi-card">
                <p class="label">Avg. Assessment Time</p>
                <p class="value">${kpis.avgAssessmentTime}</p>
            </div>
            <div class="kpi-card">
                <p class="label">Model Accuracy</p>
                <p class="value risk-low">${kpis.modelAccuracy}</p>
            </div>
        `;
    }

    function renderApplicantList(applicants) {
        applicantList.innerHTML = ''; // Clear list
        if (applicants.length === 0) {
            applicantList.innerHTML = `<p>No applicants found.</p>`;
            return;
        }
        applicants.forEach(app => {
            const riskColorClass = `risk-${app.riskCategory.toLowerCase()}`;
            const card = document.createElement('div');
            card.className = 'applicant-card';
            card.dataset.id = app.id;
            card.innerHTML = `
                <div>
                    <p class="name">${app.name}</p>
                    <p class="id">Applicant ID: ${app.id}</p>
                </div>
                <div class="risk-indicator">
                    <p class="value ${riskColorClass}">${app.riskPercentage}%</p>
                    <p class="category ${riskColorClass}">${app.riskCategory}</p>
                </div>
            `;
            card.addEventListener('click', () => showReport(app.id));
            applicantList.appendChild(card);
        });
    }

    function filterApplicants() {
        const query = searchBar.value.toLowerCase();
        const filtered = applicantsCache.filter(app => 
            app.name.toLowerCase().includes(query) ||
            app.id.includes(query)
        );
        renderApplicantList(filtered);
    }
    
    // --- REPORT ---
    async function showReport(id) {
        try {
            const res = await fetch(`${API_BASE_URL}/applicants/${id}`);
            if (!res.ok) throw new Error('Applicant not found.');

            currentApplicantData = await res.json();
            renderReport(id, currentApplicantData);

            dashboardView.classList.add('hidden');
            reportView.classList.remove('hidden');
            window.scrollTo(0, 0);
        } catch (error) {
            console.error(`Failed to load applicant ${id}:`, error);
        }
    }

    function renderReport(id, data) {
        const latestRecord = data.history.reduce((latest, current) => 
            (current.Month_Offset > latest.Month_Offset) ? current : latest, data.history[0]
        );
        const riskColorClass = `risk-${latestRecord.Risk_Category.toLowerCase()}`;
        const cibilEquivalent = calculateCibil(latestRecord.Predicted_Prob_Default);
        const currentDate = new Date('2025-09-17T14:14:41+05:30').toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' });

        reportView.innerHTML = `
            <button id="back-to-dashboard-btn" class="back-btn">&larr; Back to Dashboard</button>
            <div class="report-header" style="margin-bottom: 1.5rem; color: var(--text-secondary); font-size: 0.9rem;">
                Data Refreshed: ${currentDate} | Using Model v2.3-alpha
            </div>
            <div class="report-grid">
                <div id="details-section" class="report-section">
                    <h3 class="report-section-title">Applicant Details</h3>
                    <div class="report-section-content">
                        <div class="info-pair"><span class="label">Name:</span> <span>${data.personal.name}</span></div>
                        <div class="info-pair"><span class="label">Date of Birth:</span> <span>${data.personal.dob}</span></div>
                        <div class="info-pair"><span class="label">Gender:</span> <span>${data.personal.gender}</span></div>
                        <div class="info-pair"><span class="label">ID:</span> <span>${id}</span></div>
                    </div>
                </div>
                <div id="score-section" class="report-section">
                    <h3 class="report-section-title">RISKON Score</h3>
                    <div class="report-section-content score-box">
                        <div id="cibil-score" class="score-value ${riskColorClass}">${cibilEquivalent}</div>
                        <div class="score-label">CIBIL Equivalent</div>
                    </div>
                </div>
                <div id="chart-section" class="report-section">
                    <h3 class="report-section-title">Risk History</h3>
                    <div class="report-section-content">
                        <canvas id="risk-chart"></canvas>
                    </div>
                </div>
                <div id="simulation-section" class="report-section">
                    <h3 class="report-section-title">"What-If" Scenario</h3>
                    <div class="report-section-content">
                        <div class="slider-group">
                            <label for="income-slider">Annual Income: <span class="slider-value" id="income-value">$50,000</span></label>
                            <input type="range" id="income-slider" min="20000" max="200000" value="50000" step="1000">
                        </div>
                        <div class="slider-group">
                            <label for="loan-slider">Loan Amount: <span class="slider-value" id="loan-value">$20,000</span></label>
                            <input type="range" id="loan-slider" min="5000" max="100000" value="20000" step="500">
                        </div>
                    </div>
                </div>
                <div id="analysis-section" class="report-section">
                    <h3 class="report-section-title">AI-Powered Analysis</h3>
                    <div class="report-section-content">
                        <button id="analyze-btn" data-id="${id}">
                            Generate Quick Summary
                        </button>
                        <div id="analysis-result" class="hidden"></div>
                    </div>
                </div>
            </div>
        `;

        renderChart(data.history);
        setupReportEventListeners(id);
    }
    
    function renderChart(historyData) {
        const ctx = document.getElementById('risk-chart').getContext('2d');
        if (riskChartInstance) {
            riskChartInstance.destroy();
        }
        
        const sortedHistory = [...historyData].sort((a, b) => a.Month_Offset - b.Month_Offset);
        const labels = sortedHistory.map(h => `Month ${h.Month_Offset}`);
        const dataPoints = sortedHistory.map(h => h.Predicted_Prob_Default * 100);

        riskChartInstance = new Chart(ctx, {
            type: 'line',
            data: {
                labels: labels,
                datasets: [{
                    label: 'Probability of Default (%)',
                    data: dataPoints,
                    borderColor: 'rgba(59, 130, 246, 1)',
                    backgroundColor: 'rgba(59, 130, 246, 0.2)',
                    tension: 0.4,
                    fill: true
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                scales: { y: { beginAtZero: true, max: 100 } }
            }
        });
    }
    
    async function handleSimulation(id) {
        const income = document.getElementById('income-slider').value;
        const loanAmount = document.getElementById('loan-slider').value;

        // Update UI labels immediately
        document.getElementById('income-value').textContent = `$${Number(income).toLocaleString()}`;
        document.getElementById('loan-value').textContent = `$${Number(loanAmount).toLocaleString()}`;
        
        try {
            const res = await fetch(`${API_BASE_URL}/simulate`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ id, income, loanAmount })
            });
            const result = await res.json();
            
            // Update score based on simulation
            const newCibil = calculateCibil(result.simulatedProb);
            const scoreEl = document.getElementById('cibil-score');
            scoreEl.textContent = newCibil;
            scoreEl.className = `score-value risk-${result.riskCategory.toLowerCase()}`;

        } catch(error) {
            console.error("Simulation failed:", error);
        }
    }

    async function handleAnalysis(id) {
        const btn = document.getElementById('analyze-btn');
        const resultContainer = document.getElementById('analysis-result');
        
        btn.innerHTML = `<div class="spinner"></div>Analyzing...`;
        btn.disabled = true;
        btn.classList.add('loading');

        try {
            const res = await fetch(`${API_BASE_URL}/analyze/${id}`, { method: 'POST' });
            if (!res.ok) throw new Error('Analysis failed.');
            
            const result = await res.json();

            resultContainer.innerHTML = `
                <h4>Quick Summary</h4>
                <p id="summary-text"></p>
                <h4 style="margin-top: 1rem;">Key Risk Drivers</h4>
                <ul id="drivers-list">
                    ${result.drivers.map(d => `<li>${d}</li>`).join('')}
                </ul>
            `;
            btn.classList.add('hidden');
            resultContainer.classList.remove('hidden');
            typeWriter(result.summary, 'summary-text');
        } catch(error) {
            console.error("Analysis failed:", error);
            btn.innerHTML = 'Analysis Failed. Try Again.';
            btn.disabled = false;
            btn.classList.remove('loading');
        }
    }

    function hideReport() {
        reportView.classList.add('hidden');
        dashboardView.classList.remove('hidden');
        reportView.innerHTML = ''; // Clear content to prevent ID conflicts
        currentApplicantData = {};
    }

    // --- UTILITIES ---
    function calculateCibil(prob) {
        let cibilScore;
        if (prob <= 0.15) { cibilScore = 780 + (1 - prob/0.15) * 120; }
        else if (prob <= 0.70) { cibilScore = 650 + (1 - (prob - 0.15)/0.55) * 130; }
        else { cibilScore = 300 + (1 - (prob - 0.70)/0.30) * 350; }
        return Math.round(cibilScore);
    }
    
    function typeWriter(text, elementId, speed = 15) {
        const el = document.getElementById(elementId);
        if (!el) return;
        let i = 0;
        function type() {
            if (i < text.length) {
                el.innerHTML += text.charAt(i);
                i++;
                setTimeout(type, speed);
            }
        }
        type();
    }

    // --- EVENT LISTENERS ---
    function setupEventListeners() {
        launchBtn.addEventListener('click', launchWorkspace);
        searchBar.addEventListener('input', filterApplicants);
    }
    
    function setupReportEventListeners(id) {
        document.getElementById('back-to-dashboard-btn').addEventListener('click', hideReport);
        document.getElementById('income-slider').addEventListener('input', () => handleSimulation(id));
        document.getElementById('loan-slider').addEventListener('input', () => handleSimulation(id));
        document.getElementById('analyze-btn').addEventListener('click', () => handleAnalysis(id));
    }

    // --- START THE APP ---
    init();
});
