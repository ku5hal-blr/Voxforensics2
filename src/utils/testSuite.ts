interface TestResult {
  name: string;
  passed: boolean;
  expected: string;
  actual: string;
  confidence?: number;
}

const API_URL = 'http://127.0.0.1:8000';

interface HealthResponse {
  status: string;
  model_loaded: boolean;
}

interface PredictionResponse {
  success: boolean;
  filename: string;
  verdict: string;
  real_probability: number;
  fake_probability: number;
  features?: {
    rmsEnergy?: number;
    pitchMean?: number;
    spectralCentroid?: number;
    zeroCrossingRate?: number;
  };
}

async function checkHealth(): Promise<HealthResponse> {
  const response = await fetch(`${API_URL}/health`);

  if (!response.ok) {
    throw new Error(`Health check failed: HTTP ${response.status}`);
  }

  return response.json();
}

async function predictTestAudio(
  path: string,
  filename: string
): Promise<PredictionResponse> {
  const response = await fetch(path);

  if (!response.ok) {
    throw new Error(`Could not load test audio: HTTP ${response.status}`);
  }

  const blob = await response.blob();

  const file = new File([blob], filename, {
    type: 'audio/wav',
  });

  const formData = new FormData();
  formData.append('file', file);

  const predictionResponse = await fetch(`${API_URL}/predict`, {
    method: 'POST',
    body: formData,
  });

  if (!predictionResponse.ok) {
    const errorText = await predictionResponse.text();
    throw new Error(
      `Prediction API failed: HTTP ${predictionResponse.status} ${errorText}`
    );
  }

  return predictionResponse.json();
}

function getConfidence(result: PredictionResponse): number {
  return Math.max(
    result.real_probability,
    result.fake_probability
  );
}

function getActualLabel(result: PredictionResponse): string {
  return result.verdict;
}

export async function runComprehensiveTests(): Promise<TestResult[]> {
  const results: TestResult[] = [];

  console.log('🧪 Starting VoxForensics ML pipeline tests...');

  // ---------------------------------------------------------
  // TEST 1 — API health
  // ---------------------------------------------------------
  try {
    const health = await checkHealth();

    const passed =
      health.status === 'healthy' &&
      health.model_loaded === true;

    results.push({
      name: 'Test 1: ML API Health Check',
      passed,
      expected: 'Healthy API with model loaded',
      actual: passed
        ? 'Healthy API with model loaded'
        : `status=${health.status}, model_loaded=${health.model_loaded}`,
    });
  } catch (error) {
    results.push({
      name: 'Test 1: ML API Health Check',
      passed: false,
      expected: 'Healthy API with model loaded',
      actual: error instanceof Error
        ? error.message
        : 'Unknown API error',
    });
  }

  // ---------------------------------------------------------
  // TEST 2 — Real voice prediction
  // ---------------------------------------------------------
  try {
    const result = await predictTestAudio(
      '/test_audio/test_real.wav',
      'test_real.wav'
    );

    const passed =
      result.success === true &&
      result.verdict === 'Real Voice';

    results.push({
      name: 'Test 2: Real Voice ML Prediction',
      passed,
      expected: 'Real Voice',
      actual: getActualLabel(result),
      confidence: getConfidence(result),
    });
  } catch (error) {
    results.push({
      name: 'Test 2: Real Voice ML Prediction',
      passed: false,
      expected: 'Real Voice',
      actual: error instanceof Error
        ? error.message
        : 'Unknown prediction error',
    });
  }

  // ---------------------------------------------------------
  // TEST 3 — Fake/AI voice prediction
  // ---------------------------------------------------------
  try {
    const result = await predictTestAudio(
      '/test_audio/test_fake.wav',
      'test_fake.wav'
    );

    const passed =
      result.success === true &&
      (result.verdict === 'AI-Generated' ||
        result.verdict === 'AI-Generated / Fake');

    results.push({
      name: 'Test 3: AI Voice ML Prediction',
      passed,
      expected: 'AI-Generated',
      actual: getActualLabel(result),
      confidence: getConfidence(result),
    });
  } catch (error) {
    results.push({
      name: 'Test 3: AI Voice ML Prediction',
      passed: false,
      expected: 'AI-Generated',
      actual: error instanceof Error
        ? error.message
        : 'Unknown prediction error',
    });
  }

  // ---------------------------------------------------------
  // TEST 4 — Probability validation
  // ---------------------------------------------------------
  try {
    const result = await predictTestAudio(
      '/test_audio/test_real.wav',
      'probability_test.wav'
    );

    const validProbabilities =
      Number.isFinite(result.real_probability) &&
      Number.isFinite(result.fake_probability) &&
      result.real_probability >= 0 &&
      result.real_probability <= 1 &&
      result.fake_probability >= 0 &&
      result.fake_probability <= 1;

    results.push({
      name: 'Test 4: Prediction Probability Validation',
      passed: validProbabilities,
      expected: 'Probabilities between 0 and 1',
      actual: validProbabilities
        ? 'Valid probability values'
        : `real=${result.real_probability}, fake=${result.fake_probability}`,
      confidence: validProbabilities
        ? getConfidence(result)
        : undefined,
    });
  } catch (error) {
    results.push({
      name: 'Test 4: Prediction Probability Validation',
      passed: false,
      expected: 'Probabilities between 0 and 1',
      actual: error instanceof Error
        ? error.message
        : 'Unknown prediction error',
    });
  }

  // ---------------------------------------------------------
  // TEST 5 — Required response fields
  // ---------------------------------------------------------
  try {
    const result = await predictTestAudio(
      '/test_audio/test_real.wav',
      'response_fields_test.wav'
    );

    const requiredFieldsPresent =
      result.success === true &&
      typeof result.filename === 'string' &&
      typeof result.verdict === 'string' &&
      typeof result.real_probability === 'number' &&
      typeof result.fake_probability === 'number';

    results.push({
      name: 'Test 5: Prediction Response Structure',
      passed: requiredFieldsPresent,
      expected: 'All required prediction fields present',
      actual: requiredFieldsPresent
        ? 'All required fields present'
        : 'One or more required fields are missing',
      confidence: requiredFieldsPresent
        ? getConfidence(result)
        : undefined,
    });
  } catch (error) {
    results.push({
      name: 'Test 5: Prediction Response Structure',
      passed: false,
      expected: 'All required prediction fields present',
      actual: error instanceof Error
        ? error.message
        : 'Unknown prediction error',
    });
  }

  // ---------------------------------------------------------
  // TEST 6 — Feature extraction response
  // ---------------------------------------------------------
  try {
    const result = await predictTestAudio(
      '/test_audio/test_real.wav',
      'feature_test.wav'
    );

    const featuresPresent =
      result.features !== undefined &&
      typeof result.features === 'object';

    results.push({
      name: 'Test 6: ML Feature Extraction',
      passed: featuresPresent,
      expected: 'Feature data returned by ML pipeline',
      actual: featuresPresent
        ? 'Feature data returned successfully'
        : 'Feature data missing from response',
      confidence: featuresPresent
        ? getConfidence(result)
        : undefined,
    });
  } catch (error) {
    results.push({
      name: 'Test 6: ML Feature Extraction',
      passed: false,
      expected: 'Feature data returned by ML pipeline',
      actual: error instanceof Error
        ? error.message
        : 'Unknown feature extraction error',
    });
  }

  // ---------------------------------------------------------
  // TEST 7 — Real audio can be processed repeatedly
  // ---------------------------------------------------------
  try {
    const result = await predictTestAudio(
      '/test_audio/test_real.wav',
      'repeat_test.wav'
    );

    const passed = result.success === true;

    results.push({
      name: 'Test 7: Repeat Real Audio Processing',
      passed,
      expected: 'Successful repeated prediction',
      actual: passed
        ? 'Prediction completed successfully'
        : result.verdict,
      confidence: passed
        ? getConfidence(result)
        : undefined,
    });
  } catch (error) {
    results.push({
      name: 'Test 7: Repeat Real Audio Processing',
      passed: false,
      expected: 'Successful repeated prediction',
      actual: error instanceof Error
        ? error.message
        : 'Unknown processing error',
    });
  }

  // ---------------------------------------------------------
  // TEST 8 — Fake audio can be processed repeatedly
  // ---------------------------------------------------------
  try {
    const result = await predictTestAudio(
      '/test_audio/test_fake.wav',
      'repeat_fake_test.wav'
    );

    const passed = result.success === true;

    results.push({
      name: 'Test 8: Repeat AI Audio Processing',
      passed,
      expected: 'Successful repeated prediction',
      actual: passed
        ? 'Prediction completed successfully'
        : result.verdict,
      confidence: passed
        ? getConfidence(result)
        : undefined,
    });
  } catch (error) {
    results.push({
      name: 'Test 8: Repeat AI Audio Processing',
      passed: false,
      expected: 'Successful repeated prediction',
      actual: error instanceof Error
        ? error.message
        : 'Unknown processing error',
    });
  }

  // ---------------------------------------------------------
  // TEST 9 — Frontend to API connectivity
  // ---------------------------------------------------------
  try {
    const health = await checkHealth();

    const passed = health.status === 'healthy';

    results.push({
      name: 'Test 9: Frontend → ML API Connection',
      passed,
      expected: 'Frontend can reach FastAPI backend',
      actual: passed
        ? 'Connection successful'
        : `API returned status: ${health.status}`,
    });
  } catch (error) {
    results.push({
      name: 'Test 9: Frontend → ML API Connection',
      passed: false,
      expected: 'Frontend can reach FastAPI backend',
      actual: error instanceof Error
        ? error.message
        : 'Connection failed',
    });
  }

  // ---------------------------------------------------------
  // TEST 10 — Complete ML pipeline
  // ---------------------------------------------------------
  try {
    const result = await predictTestAudio(
      '/test_audio/test_fake.wav',
      'end_to_end_test.wav'
    );

    const passed =
      result.success === true &&
      typeof result.verdict === 'string' &&
      Number.isFinite(result.real_probability) &&
      Number.isFinite(result.fake_probability);

    results.push({
      name: 'Test 10: Complete ML Detection Pipeline',
      passed,
      expected: 'Audio → API → Features → Random Forest → Result',
      actual: passed
        ? `Complete pipeline successful: ${result.verdict}`
        : 'Complete pipeline failed',
      confidence: passed
        ? getConfidence(result)
        : undefined,
    });
  } catch (error) {
    results.push({
      name: 'Test 10: Complete ML Detection Pipeline',
      passed: false,
      expected: 'Audio → API → Features → Random Forest → Result',
      actual: error instanceof Error
        ? error.message
        : 'End-to-end pipeline failed',
    });
  }

  console.log('🧪 VoxForensics ML pipeline tests completed.');

  return results;
}

export function printTestResults(results: TestResult[]) {
  console.log('\n' + '='.repeat(80));
  console.log('🎯 VOXFORENSICS ML PIPELINE TEST RESULTS');
  console.log('='.repeat(80) + '\n');

  let passed = 0;
  let failed = 0;

  results.forEach((result, index) => {
    const status = result.passed ? '✅ PASS' : '❌ FAIL';

    const confidence =
      result.confidence !== undefined
        ? ` (${(result.confidence * 100).toFixed(1)}% confidence)`
        : '';

    console.log(`${status} Test ${index + 1}: ${result.name}`);
    console.log(`   Expected: ${result.expected}`);
    console.log(`   Actual:   ${result.actual}${confidence}`);
    console.log('');

    if (result.passed) {
      passed++;
    } else {
      failed++;
    }
  });

  console.log('='.repeat(80));
  console.log(
    `📊 SUMMARY: ${passed} passed, ${failed} failed out of ${results.length} tests`
  );

  console.log(
    `🎯 Pipeline Test Pass Rate: ${((passed / results.length) * 100).toFixed(1)}%`
  );

  console.log('='.repeat(80) + '\n');

  if (failed === 0) {
    console.log(
      '🎉 ALL PIPELINE TESTS PASSED! The current ML pipeline is functioning correctly.\n'
    );
  } else {
    console.log(
      `⚠️ ${failed} pipeline test(s) failed. Review the corresponding component.\n`
    );
  }

  return {
    passed,
    failed,
    total: results.length,
  };
}