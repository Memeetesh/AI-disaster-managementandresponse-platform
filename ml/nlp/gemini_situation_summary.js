// app_backend_server.js
const http = require('http');

// ... (Keep the existing fetchWeather, fetchFlood, fetchSeismic functions here) ...

async function runAIAgent(lat, lon, weather, flood, seismic) {
    const apiKey = process.env.GEMINI_API_KEY;
    
    // Upgraded prompt: Force the AI to return structured JSON for the mobile app
    const prompt = `You are a localized environmental early warning AI for Lat:${lat} Lon:${lon}.
    Data:
    - Weather: ${weather}
    - Floods: ${flood}
    - Seismic: ${seismic}

    Output STRICTLY in JSON format using this exact schema:
    {
      "risk_level": "LOW" | "MODERATE" | "HIGH" | "SEVERE",
      "headline": "A short, 5-word summary of the current status",
      "actionable_warnings": ["bullet 1", "bullet 2", "bullet 3"]
    }`;

    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ 
            contents: [{ parts: [{ text: prompt }] }],
            // Force JSON response mode
            generationConfig: { responseMimeType: "application/json" }
        })
    });
    
    const data = await response.json();
    // Parse the AI's JSON string into an actual JavaScript object
    return JSON.parse(data.candidates[0].content.parts[0].text);
}

const server = http.createServer((req, res) => {
    // Standard app headers
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Access-Control-Allow-Origin', '*'); 

    if (req.method === 'POST' && req.url === '/api/v1/analyze-location') {
        let body = '';
        
        req.on('data', chunk => {
            body += chunk.toString();
        });
        
        req.on('end', async () => {
            try {
                // 1. Receive Input from the App
                const appInput = JSON.parse(body);
                const lat = appInput.latitude;
                const lon = appInput.longitude;

                if (!lat || !lon) {
                    res.writeHead(400);
                    return res.end(JSON.stringify({ error: "Missing latitude or longitude in payload" }));
                }

                // 2. Fetch all telemetry in parallel
                const [weather, flood, seismic] = await Promise.all([
                    fetchWeather(lat, lon), 
                    fetchFlood(lat, lon), 
                    fetchSeismic(lat, lon)
                ]);

                // 3. Get structured AI Assessment
                const aiAssessment = await runAIAgent(lat, lon, weather, flood, seismic);
                
                // 4. Send Output back to the App
                res.writeHead(200);
                res.end(JSON.stringify({ 
                    success: true,
                    timestamp: new Date().toISOString(),
                    coordinates: { lat, lon },
                    ai_assessment: aiAssessment,
                    raw_telemetry: { weather, flood, seismic }
                }));

            } catch (err) {
                res.writeHead(500);
                res.end(JSON.stringify({ success: false, error: err.message }));
            }
        });
    } else {
        res.writeHead(404);
        res.end(JSON.stringify({ error: "Endpoint not found" }));
    }
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log(`Mobile App Backend running on port ${PORT}`));