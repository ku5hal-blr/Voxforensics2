import { useState } from 'react';
import {
  runComprehensiveTests,
  printTestResults,
} from '../utils/testSuite';

interface TestResult {
  name: string;
  passed: boolean;
  expected: string;
  actual: string;
  confidence?: number;
}

interface TestSummary {
  passed: number;
  failed: number;
  total: number;
}

export default function E2ETestPanel({
  onClose,
}: {
  onClose: () => void;
}) {
  const [results, setResults] = useState<TestResult[]>([]);
  const [isRunning, setIsRunning] = useState(false);
  const [summary, setSummary] = useState<TestSummary | null>(null);

  const runTests = async () => {
    setIsRunning(true);
    setResults([]);
    setSummary(null);

    console.log(
      '\n🚀 Starting VoxForensics Comprehensive Test Suite...\n'
    );

    try {
      const testResults = await runComprehensiveTests();

      setResults(testResults);

      const testSummary = printTestResults(testResults);

      setSummary(testSummary);
    } catch (error) {
      console.error('Test suite failed:', error);

      setSummary({
        passed: 0,
        failed: 1,
        total: 1,
      });

      setResults([
        {
          name: 'Test Suite Execution',
          passed: false,
          expected: 'Test suite to execute successfully',
          actual:
            error instanceof Error
              ? error.message
              : 'Unknown error occurred',
        },
      ]);
    } finally {
      setIsRunning(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
      <div className="glass-card p-6 w-full max-w-4xl max-h-[90vh] overflow-y-auto">

        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-2xl font-bold text-white">
            🧪 Comprehensive AI Detection Tests
          </h2>

          <button
            onClick={onClose}
            className="text-gray-400 hover:text-white text-2xl transition"
            aria-label="Close test panel"
          >
            ×
          </button>
        </div>

        {/* Description */}
        <div className="mb-6">
          <p className="text-gray-300 mb-4">
            Run 10 configured tests to evaluate the current audio
            detection pipeline across different scenarios:
          </p>

          <ul className="text-sm text-gray-400 space-y-1 mb-4">
            <li>• Clear AI voice detection</li>
            <li>• Clear real voice detection</li>
            <li>• AI voice via speaker playback</li>
            <li>• Mixed audio (real + AI background)</li>
            <li>• Borderline cases and edge scenarios</li>
            <li>• High-quality AI voices</li>
            <li>• Real voice with background noise/music</li>
            <li>• AI voice with audio effects</li>
            <li>• Quiet real voice</li>
            <li>• Advanced AI mimicking natural speech</li>
          </ul>

          <div className="p-3 rounded-lg bg-[#00d4ff]/5 border border-[#00d4ff]/20">
            <p className="text-xs text-gray-400 leading-relaxed">
              <span className="text-[#00d4ff] font-medium">
                Prototype testing:
              </span>{' '}
              These tests evaluate the current implementation and
              should not be interpreted as forensic validation or
              proof of real-world detection accuracy.
            </p>
          </div>
        </div>

        {/* Initial State */}
        {!isRunning && results.length === 0 && (
          <button
            onClick={runTests}
            className="neon-btn w-full py-4 text-lg font-semibold"
          >
            🚀 Run All 10 Tests
          </button>
        )}

        {/* Running State */}
        {isRunning && (
          <div className="text-center py-8">
            <div className="spinner w-12 h-12 mx-auto mb-4"></div>

            <p className="text-gray-300">
              Running comprehensive tests...
            </p>

            <p className="text-xs text-gray-500 mt-2">
              Please wait while the configured detection tests are
              evaluated.
            </p>
          </div>
        )}

        {/* Results */}
        {!isRunning && results.length > 0 && (
          <div className="space-y-3">

            {results.map((result, index) => (
              <div
                key={`${result.name}-${index}`}
                className={`p-4 rounded-xl border ${
                  result.passed
                    ? 'bg-green-500/5 border-green-500/30'
                    : 'bg-red-500/5 border-red-500/30'
                }`}
              >
                <div className="flex items-start justify-between gap-4 mb-2">

                  <h3 className="font-semibold text-white">
                    {result.passed ? '✅' : '❌'} Test {index + 1}:{' '}
                    {result.name}
                  </h3>

                  {typeof result.confidence === 'number' && (
                    <span className="text-xs text-gray-400 whitespace-nowrap">
                      {(result.confidence * 100).toFixed(1)}% confidence
                    </span>
                  )}

                </div>

                <div className="text-sm space-y-1">

                  <p className="text-gray-400">
                    <span className="text-gray-500">
                      Expected:
                    </span>{' '}
                    {result.expected}
                  </p>

                  <p
                    className={
                      result.passed
                        ? 'text-green-400'
                        : 'text-red-400'
                    }
                  >
                    <span className="text-gray-500">
                      Actual:
                    </span>{' '}
                    {result.actual}
                  </p>

                </div>
              </div>
            ))}

            {/* Summary */}
            {summary && (
              <div
                className={`mt-6 p-6 rounded-xl border ${
                  summary.failed === 0
                    ? 'bg-green-500/10 border-green-500/30'
                    : 'bg-red-500/10 border-red-500/30'
                }`}
              >
                <h3 className="text-xl font-bold text-white mb-3">
                  📊 Test Summary
                </h3>

                <div className="grid grid-cols-3 gap-4 text-center">

                  <div>
                    <p className="text-3xl font-bold text-white">
                      {summary.total}
                    </p>

                    <p className="text-sm text-gray-400">
                      Total Tests
                    </p>
                  </div>

                  <div>
                    <p className="text-3xl font-bold text-green-400">
                      {summary.passed}
                    </p>

                    <p className="text-sm text-gray-400">
                      Passed
                    </p>
                  </div>

                  <div>
                    <p className="text-3xl font-bold text-red-400">
                      {summary.failed}
                    </p>

                    <p className="text-sm text-gray-400">
                      Failed
                    </p>
                  </div>

                </div>

                {summary.total > 0 && (
                  <div className="mt-4 text-center">

                    <p className="text-lg font-semibold text-white">
                      Test Pass Rate:{' '}
                      {(
                        (summary.passed / summary.total) *
                        100
                      ).toFixed(1)}
                      %
                    </p>

                    {summary.failed === 0 ? (
                      <p className="text-green-400 mt-2">
                        🎉 All configured tests passed.
                      </p>
                    ) : (
                      <p className="text-red-400 mt-2">
                        ⚠️ {summary.failed} test
                        {summary.failed === 1 ? '' : 's'} failed.
                        Review the detection pipeline.
                      </p>
                    )}

                  </div>
                )}

                {/* Prototype Disclaimer */}
                <div className="mt-5 pt-4 border-t border-[#1a2a4a]">
                  <p className="text-xs text-gray-500 text-center leading-relaxed">
                    Passing these tests indicates that the current
                    implementation produced the expected outputs for
                    the configured test cases. It does not establish
                    forensic-grade accuracy or general real-world
                    deepfake detection performance.
                  </p>
                </div>
              </div>
            )}

            {/* Actions */}
            <div className="flex gap-3 mt-6">

              <button
                onClick={runTests}
                disabled={isRunning}
                className="neon-btn flex-1 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                🔄 Run Tests Again
              </button>

              <button
                onClick={onClose}
                className="neon-btn neon-btn-danger flex-1"
              >
                Close
              </button>

            </div>
          </div>
        )}

      </div>
    </div>
  );
}