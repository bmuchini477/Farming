// Quick test script for the farming assistant
// Usage: node test-assistant.js

async function testAssistant() {
  console.log('🧪 Testing Farming Assistant...\n');
  
  // Test 1: Health Check
  console.log('1️⃣ Testing health endpoint...');
  try {
    const healthResponse = await fetch('http://localhost:8793/api/health');
    const healthData = await healthResponse.json();
    console.log('✅ Health Check:', JSON.stringify(healthData, null, 2));
  } catch (error) {
    console.log('❌ Health check failed:', error.message);
    return;
  }
  
  console.log('\n');
  
  // Test 2: Simple Question
  console.log('2️⃣ Testing assistant with a farming question...');
  try {
    const assistantResponse = await fetch('http://localhost:8793/api/assistant', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        prompt: 'What are the best practices for maize farming?',
        context: {
          farmCount: 1,
          cropCount: 1,
          activeCropCount: 1,
          farms: [
            {
              name: 'Green Valley Farm',
              location: 'Eastern Province',
            }
          ],
          crops: [
            {
              name: 'Maize',
              farmName: 'Green Valley Farm',
              status: 'active',
              plantingDate: '2024-03-15',
              expectedHarvestDate: '2024-08-15',
            }
          ],
          monitoring: [],
          generatedAt: new Date().toISOString(),
        }
      }),
    });
    
    if (!assistantResponse.ok) {
      const errorText = await assistantResponse.text();
      console.log('❌ Assistant request failed:', assistantResponse.status, errorText);
      return;
    }
    
    const assistantData = await assistantResponse.json();
    console.log('✅ Assistant Response:');
    console.log('\n📝 Reply:', assistantData.reply);
    console.log('\n📊 Metadata:', JSON.stringify(assistantData.contextMeta, null, 2));
    
  } catch (error) {
    console.log('❌ Assistant test failed:', error.message);
  }
}

testAssistant();
