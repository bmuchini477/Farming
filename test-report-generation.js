
const port = 8793; // Default port from server/index.js (matching .env)

const context = {
    farmCount: 1,
    farms: [{ name: 'Test Farm', location: 'Test Location' }],
    cropCount: 2,
    activeCropCount: 1,
    crops: [
        {
            name: 'Maize',
            variety: 'SC727',
            status: 'active',
            plantingDate: '2024-01-01',
            expectedHarvestDate: '2024-06-01'
        },
        {
            name: 'Wheat',
            variety: 'Winter',
            status: 'harvested',
            plantingDate: '2023-05-01',
            expectedHarvestDate: '2023-11-01'
        }
    ],
    monitoring: [
        { type: 'Soil', date: '2024-02-01', details: 'pH: 6.5 | Nitrogen: Low' },
        { type: 'Growth', date: '2024-02-15', details: 'Height: 120cm | Stage: Flowering' },
        { type: 'Pest', date: '2024-02-20', details: 'Type: Fall Armyworm | Severity: Low' }
    ]
};

const prompt = `Analyze the farming data for Test Farm. Identify trends in growth, irrigation, and pest control. Provide 3-5 specific, actionable high-level recommendations to improve yield and efficiency based on the provided records and crop stages.`;

async function testResult() {
    console.log('🧪 Testing AI Report Generation Logic (ESM)...\n');
    console.log('Sending request to backend...');
    try {
        const response = await fetch(`http://localhost:${port}/api/assistant`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ prompt, context }),
        });

        if (response.ok) {
            const data = await response.json();
            console.log('✅ Backend Response Received:');
            console.log('--- Analysis Start ---');
            console.log(data.reply);
            console.log('--- Analysis End ---');
        } else {
            const text = await response.text();
            console.error(`❌ Request failed with status ${response.status}: ${text}`);
        }
    } catch (error) {
        console.error('❌ Network error:', error.message);
        console.log('Is the server running on port ' + port + '?');
    }
}

testResult();
