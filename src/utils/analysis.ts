/* ============================================================
 * VoxForensics — Deepfake Audio Detector
 * Acoustic Heuristic Engine v6.0
 *
 * IMPORTANT:
 * - Browser-only heuristic analysis
 * - No AI / ML / external API
 * - Designed for project/demo use
 * - NOT forensic-grade authentication
 *
 * v6.0:
 * - Robust active-frame analysis
 * - Robust voiced-frame analysis
 * - Improved pitch regularity
 * - Pitch outlier resistance
 * - Energy regularity on active frames
 * - Spectral regularity on active frames
 * - Harmonic consistency on voiced frames
 * - Formant proxy stability on active frames
 * - Micro-variation recalibration
 * - Temporal repetition
 * - Segment consistency
 * - Cross-feature synthetic evidence
 * - Natural evidence conflict handling
 * - Evidence disagreement penalty
 * - Conservative confidence handling
 *
 * APP COMPATIBILITY:
 * - analyzeAudio(AudioBuffer | null, filename, forceResult)
 * - getScanHistory()
 * - saveScanToHistory()
 * - saveScanRecord()
 * - clearHistory()
 * - clearScanHistory()
 * - AudioFeatures
 * - AnalysisResult
 * - ScanRecord
 * ============================================================ */


/* ============================================================
 * PUBLIC TYPES
 * ============================================================ */

export interface AudioFeatures {
  zeroCrossingRate: number;
  rmsEnergy: number;
  spectralCentroid: number;
  spectralRolloff: number;
  spectralFlatness: number;
  harmonicRatio: number;
  pitchMean: number;
  pitchVariation: number;
  temporalModulation: number;
  chromaStability: number;
  formantStability: number;
}


export interface AnalysisDiagnostics {
  pitchRegularity: number;
  energyRegularity: number;
  spectralRegularity: number;
  harmonicConsistency: number;
  microVariation: number;
  temporalRepetition: number;
  voicingConsistency: number;
  segmentConsistency: number;

  aiEvidence: number;
  realEvidence: number;
  manipulationEvidence: number;

  sampleReliability: number;
  testAgreement: number;

  syntheticTests: number;
  naturalTests: number;
  manipulationTests: number;

  totalFrames: number;
  activeFrames: number;
  voicedFrames: number;
}


export interface AnalysisResult {
  id: string;

  isDeepfake: boolean;

  verdict:
    | "AI-Generated"
    | "Real Voice"
    | "Possibly Manipulated"
    | "Inconclusive";

  confidence: number;

  features: AudioFeatures;

  explanation: string;

  timestamp: number;

  diagnostics?: AnalysisDiagnostics;
}


export interface ScanRecord {
  id: string;
  filename: string;
  timestamp: string;
  duration: number;
  result: AnalysisResult;
}


/* ============================================================
 * CONSTANTS
 * ============================================================ */

const SAMPLE_RATE_FALLBACK = 44100;

const FRAME_SIZE = 1024;
const HOP_SIZE = 256;

const MAX_FRAMES = 160;

const MIN_ANALYSIS_FRAMES = 12;
const MIN_ACTIVE_FRAMES = 8;
const MIN_VOICED_FRAMES = 6;

const EPSILON = 1e-10;

const MIN_PITCH = 70;
const MAX_PITCH = 500;


/* ============================================================
 * GENERIC HELPERS
 * ============================================================ */

function clamp(
  value: number,
  min = 0,
  max = 1
): number {
  if (!Number.isFinite(value)) {
    return min;
  }

  return Math.max(
    min,
    Math.min(max, value)
  );
}


function safeNumber(
  value: number,
  fallback = 0
): number {
  return Number.isFinite(value)
    ? value
    : fallback;
}


function mean(values: number[]): number {
  if (!values.length) {
    return 0;
  }

  let total = 0;

  for (const value of values) {
    total += value;
  }

  return total / values.length;
}


function variance(values: number[]): number {
  if (values.length < 2) {
    return 0;
  }

  const m = mean(values);

  let total = 0;

  for (const value of values) {
    const difference =
      value - m;

    total +=
      difference *
      difference;
  }

  return total / values.length;
}


function standardDeviation(
  values: number[]
): number {
  return Math.sqrt(
    Math.max(
      0,
      variance(values)
    )
  );
}


function median(
  values: number[]
): number {
  if (!values.length) {
    return 0;
  }

  const sorted =
    [...values].sort(
      (a, b) => a - b
    );

  const middle =
    Math.floor(
      sorted.length / 2
    );

  if (
    sorted.length % 2 === 0
  ) {
    return (
      (
        sorted[middle - 1] +
        sorted[middle]
      ) / 2
    );
  }

  return sorted[middle];
}


function percentile(
  values: number[],
  p: number
): number {
  if (!values.length) {
    return 0;
  }

  const sorted =
    [...values].sort(
      (a, b) => a - b
    );

  const position =
    clamp(p, 0, 1) *
    (sorted.length - 1);

  const lower =
    Math.floor(position);

  const upper =
    Math.ceil(position);

  if (
    lower === upper
  ) {
    return sorted[lower];
  }

  const weight =
    position - lower;

  return (
    sorted[lower] *
      (1 - weight) +
    sorted[upper] *
      weight
  );
}


function coefficientOfVariation(
  values: number[]
): number {
  if (values.length < 2) {
    return 0;
  }

  const m =
    Math.abs(mean(values));

  if (m < EPSILON) {
    return 0;
  }

  return (
    standardDeviation(values) /
    m
  );
}


function normalizeArray(
  values: number[]
): number[] {
  if (!values.length) {
    return [];
  }

  const min =
    Math.min(...values);

  const max =
    Math.max(...values);

  if (
    Math.abs(max - min) <
    EPSILON
  ) {
    return values.map(
      () => 0.5
    );
  }

  return values.map(
    value =>
      (value - min) /
      (max - min)
  );
}


function correlation(
  a: number[],
  b: number[]
): number {
  const length =
    Math.min(
      a.length,
      b.length
    );

  if (length < 2) {
    return 0;
  }

  const aSlice =
    a.slice(0, length);

  const bSlice =
    b.slice(0, length);

  const meanA =
    mean(aSlice);

  const meanB =
    mean(bSlice);

  let numerator = 0;
  let denominatorA = 0;
  let denominatorB = 0;

  for (
    let i = 0;
    i < length;
    i++
  ) {
    const da =
      aSlice[i] - meanA;

    const db =
      bSlice[i] - meanB;

    numerator +=
      da * db;

    denominatorA +=
      da * da;

    denominatorB +=
      db * db;
  }

  const denominator =
    Math.sqrt(
      denominatorA *
      denominatorB
    );

  if (
    denominator <
    EPSILON
  ) {
    return 0;
  }

  return clamp(
    numerator / denominator,
    -1,
    1
  );
}


function averageAbsoluteDifference(
  values: number[]
): number {
  if (values.length < 2) {
    return 0;
  }

  let total = 0;

  for (
    let i = 1;
    i < values.length;
    i++
  ) {
    total += Math.abs(
      values[i] -
      values[i - 1]
    );
  }

  return (
    total /
    (values.length - 1)
  );
}


function relativeDifferences(
  values: number[]
): number[] {
  if (values.length < 2) {
    return [];
  }

  const differences: number[] =
    [];

  for (
    let i = 1;
    i < values.length;
    i++
  ) {
    const denominator =
      Math.abs(
        values[i - 1]
      ) + EPSILON;

    differences.push(
      Math.abs(
        values[i] -
        values[i - 1]
      ) / denominator
    );
  }

  return differences;
}


function entropyFromHistogram(
  values: number[],
  bins = 10
): number {
  if (!values.length) {
    return 0;
  }

  const min =
    Math.min(...values);

  const max =
    Math.max(...values);

  if (
    Math.abs(max - min) <
    EPSILON
  ) {
    return 0;
  }

  const histogram =
    new Array(bins).fill(0);

  for (
    const value of values
  ) {
    const normalized =
      (value - min) /
      (max - min);

    const index =
      Math.min(
        bins - 1,
        Math.floor(
          normalized * bins
        )
      );

    histogram[index]++;
  }

  let entropy = 0;

  for (
    const count of histogram
  ) {
    if (!count) {
      continue;
    }

    const probability =
      count /
      values.length;

    entropy -=
      probability *
      Math.log2(
        probability
      );
  }

  const maximumEntropy =
    Math.log2(bins);

  if (
    maximumEntropy <= 0
  ) {
    return 0;
  }

  return clamp(
    entropy /
    maximumEntropy
  );
}


function autocorrelationAtLag(
  values: number[],
  lag: number
): number {
  if (
    lag <= 0 ||
    values.length <= lag
  ) {
    return 0;
  }

  const a =
    values.slice(
      0,
      values.length - lag
    );

  const b =
    values.slice(lag);

  return correlation(
    a,
    b
  );
}


/* ============================================================
 * ROBUST STATISTICS
 * ============================================================ */

/*
 * Uses the interquartile range to reduce the influence
 * of occasional pitch-tracking errors.
 */
function robustCoefficientOfVariation(
  values: number[]
): number {
  if (values.length < 3) {
    return 0;
  }

  const m =
    Math.abs(
      median(values)
    );

  if (
    m < EPSILON
  ) {
    return 0;
  }

  const q1 =
    percentile(
      values,
      0.25
    );

  const q3 =
    percentile(
      values,
      0.75
    );

  const iqr =
    Math.max(
      0,
      q3 - q1
    );

  return (
    (iqr / 1.349) /
    m
  );
}


/*
 * Removes extreme pitch outliers while retaining
 * the natural contour.
 */
function filterPitchOutliers(
  pitches: number[]
): number[] {
  if (
    pitches.length < 5
  ) {
    return [...pitches];
  }

  const medianPitch =
    median(pitches);

  if (
    medianPitch <= 0
  ) {
    return [];
  }

  const deviations =
    pitches.map(
      pitch =>
        Math.abs(
          pitch -
          medianPitch
        )
    );

  const medianDeviation =
    median(deviations);

  const threshold =
    Math.max(
      medianPitch * 0.35,
      medianDeviation * 4
    );

  return pitches.filter(
    pitch =>
      Math.abs(
        pitch -
        medianPitch
      ) <= threshold
  );
}


/* ============================================================
 * WINDOW
 * ============================================================ */

function createHannWindow(
  size: number
): Float64Array {
  const window =
    new Float64Array(size);

  for (
    let i = 0;
    i < size;
    i++
  ) {
    window[i] =
      0.5 *
      (
        1 -
        Math.cos(
          (
            2 *
            Math.PI *
            i
          ) /
          (size - 1)
        )
      );
  }

  return window;
}


const HANN_WINDOW =
  createHannWindow(
    FRAME_SIZE
  );


/* ============================================================
 * FFT
 * ============================================================ */

function fft(
  input: Float64Array
): {
  real: Float64Array;
  imag: Float64Array;
} {
  const n =
    input.length;

  const real =
    new Float64Array(
      input
    );

  const imag =
    new Float64Array(n);

  let j = 0;

  for (
    let i = 1;
    i < n;
    i++
  ) {
    let bit =
      n >> 1;

    while (j & bit) {
      j ^= bit;
      bit >>= 1;
    }

    j ^= bit;

    if (i < j) {
      const temp =
        real[i];

      real[i] =
        real[j];

      real[j] =
        temp;
    }
  }

  for (
    let length = 2;
    length <= n;
    length <<= 1
  ) {
    const angle =
      (-2 * Math.PI) /
      length;

    const wReal =
      Math.cos(angle);

    const wImag =
      Math.sin(angle);

    for (
      let i = 0;
      i < n;
      i += length
    ) {
      let currentReal = 1;
      let currentImag = 0;

      const half =
        length >> 1;

      for (
        let k = 0;
        k < half;
        k++
      ) {
        const evenIndex =
          i + k;

        const oddIndex =
          evenIndex + half;

        const oddReal =
          real[oddIndex];

        const oddImag =
          imag[oddIndex];

        const transformedReal =
          currentReal *
            oddReal -
          currentImag *
            oddImag;

        const transformedImag =
          currentReal *
            oddImag +
          currentImag *
            oddReal;

        real[oddIndex] =
          real[evenIndex] -
          transformedReal;

        imag[oddIndex] =
          imag[evenIndex] -
          transformedImag;

        real[evenIndex] +=
          transformedReal;

        imag[evenIndex] +=
          transformedImag;

        const nextReal =
          currentReal *
            wReal -
          currentImag *
            wImag;

        currentImag =
          currentReal *
            wImag +
          currentImag *
            wReal;

        currentReal =
          nextReal;
      }
    }
  }

  return {
    real,
    imag,
  };
}


/* ============================================================
 * FRAME TYPE
 * ============================================================ */

interface FrameAnalysis {
  rms: number;
  zcr: number;

  centroid: number;
  rolloff: number;

  flatness: number;
  entropy: number;
  peakiness: number;

  pitch: number;
  pitchConfidence: number;

  harmonicRatio: number;

  chroma: number[];

  spectralFlux: number;
}


/* ============================================================
 * PITCH DETECTION
 * ============================================================ */

function detectPitch(
  frame: Float64Array,
  sampleRate: number
): {
  pitch: number;
  confidence: number;
} {
  const minLag =
    Math.floor(
      sampleRate /
      MAX_PITCH
    );

  const maxLag =
    Math.min(
      Math.floor(
        sampleRate /
        MIN_PITCH
      ),
      frame.length - 2
    );

  if (
    maxLag <= minLag
  ) {
    return {
      pitch: 0,
      confidence: 0,
    };
  }

  let energy = 0;

  for (
    const sample of frame
  ) {
    energy +=
      sample * sample;
  }

  if (
    energy <
    frame.length *
    0.000001
  ) {
    return {
      pitch: 0,
      confidence: 0,
    };
  }

  let bestLag = -1;
  let bestCorrelation = 0;

  for (
    let lag = minLag;
    lag <= maxLag;
    lag++
  ) {
    let numerator = 0;
    let energyA = 0;
    let energyB = 0;

    const limit =
      frame.length - lag;

    for (
      let i = 0;
      i < limit;
      i++
    ) {
      const a =
        frame[i];

      const b =
        frame[i + lag];

      numerator +=
        a * b;

      energyA +=
        a * a;

      energyB +=
        b * b;
    }

    const denominator =
      Math.sqrt(
        energyA *
        energyB
      );

    if (
      denominator <
      EPSILON
    ) {
      continue;
    }

    const value =
      numerator /
      denominator;

    if (
      value >
      bestCorrelation
    ) {
      bestCorrelation =
        value;

      bestLag =
        lag;
    }
  }

  if (
    bestLag < 0 ||
    bestCorrelation <
      0.22
  ) {
    return {
      pitch: 0,
      confidence: 0,
    };
  }

  /*
   * Parabolic interpolation.
   */
  let refinedLag =
    bestLag;

  if (
    bestLag > minLag &&
    bestLag < maxLag
  ) {
    const correlationAtLag =
      (
        lag: number
      ): number => {
        let numerator = 0;
        let energyA = 0;
        let energyB = 0;

        const limit =
          frame.length -
          lag;

        for (
          let i = 0;
          i < limit;
          i++
        ) {
          const a =
            frame[i];

          const b =
            frame[i + lag];

          numerator +=
            a * b;

          energyA +=
            a * a;

          energyB +=
            b * b;
        }

        const denominator =
          Math.sqrt(
            energyA *
            energyB
          );

        if (
          denominator <
          EPSILON
        ) {
          return 0;
        }

        return (
          numerator /
          denominator
        );
      };

    const left =
      correlationAtLag(
        bestLag - 1
      );

    const center =
      correlationAtLag(
        bestLag
      );

    const right =
      correlationAtLag(
        bestLag + 1
      );

    const denominator =
      left -
      2 * center +
      right;

    if (
      Math.abs(
        denominator
      ) > EPSILON
    ) {
      const shift =
        0.5 *
        (
          left -
          right
        ) /
        denominator;

      if (
        Math.abs(shift) <= 1
      ) {
        refinedLag +=
          shift;
      }
    }
  }

  if (
    refinedLag <= 0
  ) {
    return {
      pitch: 0,
      confidence: 0,
    };
  }

  const pitch =
    sampleRate /
    refinedLag;

  if (
    pitch < MIN_PITCH ||
    pitch > MAX_PITCH
  ) {
    return {
      pitch: 0,
      confidence: 0,
    };
  }

  return {
    pitch,

    confidence:
      clamp(
        (
          bestCorrelation -
          0.15
        ) /
        0.75
      ),
  };
}


/* ============================================================
 * HARMONIC RATIO
 * ============================================================ */

function calculateHarmonicRatio(
  magnitudes: number[],
  pitch: number,
  sampleRate: number
): number {
  if (
    pitch <= 0 ||
    !magnitudes.length
  ) {
    return 0;
  }

  const binWidth =
    sampleRate /
    FRAME_SIZE;

  let harmonicEnergy = 0;
  let totalEnergy = 0;

  for (
    const magnitude
    of magnitudes
  ) {
    totalEnergy +=
      magnitude *
      magnitude;
  }

  if (
    totalEnergy <
    EPSILON
  ) {
    return 0;
  }

  for (
    let harmonic = 1;
    harmonic <= 8;
    harmonic++
  ) {
    const frequency =
      pitch *
      harmonic;

    if (
      frequency >=
      sampleRate / 2
    ) {
      break;
    }

    const centerBin =
      Math.round(
        frequency /
        binWidth
      );

    for (
      let offset = -1;
      offset <= 1;
      offset++
    ) {
      const index =
        centerBin +
        offset;

      if (
        index >= 0 &&
        index <
          magnitudes.length
      ) {
        harmonicEnergy +=
          magnitudes[index] *
          magnitudes[index];
      }
    }
  }

  return clamp(
    harmonicEnergy /
    totalEnergy
  );
}


/* ============================================================
 * CHROMA
 * ============================================================ */

function calculateChroma(
  magnitudes: number[],
  sampleRate: number
): number[] {
  const chroma =
    new Array(12).fill(0);

  const binWidth =
    sampleRate /
    FRAME_SIZE;

  for (
    let i = 1;
    i < magnitudes.length;
    i++
  ) {
    const frequency =
      i * binWidth;

    if (
      frequency < 70 ||
      frequency > 4000
    ) {
      continue;
    }

    const midi =
      69 +
      12 *
      Math.log2(
        frequency /
        440
      );

    const pitchClass =
      (
        Math.round(midi) %
          12 +
        12
      ) % 12;

    chroma[pitchClass] +=
      magnitudes[i];
  }

  const total =
    chroma.reduce(
      (sum, value) =>
        sum + value,
      0
    );

  if (
    total <
    EPSILON
  ) {
    return chroma;
  }

  return chroma.map(
    value =>
      value / total
  );
}


/* ============================================================
 * FRAME ANALYSIS
 * ============================================================ */

function analyzeFrame(
  frameData: Float32Array,
  sampleRate: number,
  previousMagnitudes?: number[]
): FrameAnalysis {
  const frame =
    new Float64Array(
      FRAME_SIZE
    );

  let rmsEnergy = 0;

  let zeroCrossings = 0;

  for (
    let i = 0;
    i < FRAME_SIZE;
    i++
  ) {
    const value =
      i <
      frameData.length
        ? safeNumber(
            frameData[i]
          )
        : 0;

    const windowed =
      value *
      HANN_WINDOW[i];

    frame[i] =
      windowed;

    rmsEnergy +=
      value * value;

    if (
      i > 0 &&
      (
        (
          value >= 0 &&
          frameData[i - 1] < 0
        ) ||
        (
          value < 0 &&
          frameData[i - 1] >= 0
        )
      )
    ) {
      zeroCrossings++;
    }
  }

  const rms =
    Math.sqrt(
      rmsEnergy /
      FRAME_SIZE
    );

  const zcr =
    zeroCrossings /
    Math.max(
      1,
      FRAME_SIZE - 1
    );

  const {
    real,
    imag,
  } = fft(frame);

  const binCount =
    FRAME_SIZE / 2;

  const magnitudes =
    new Array(binCount);

  let totalMagnitude = 0;

  let weightedFrequency = 0;

  let totalEnergy = 0;

  let maximumMagnitude = 0;

  for (
    let i = 0;
    i < binCount;
    i++
  ) {
    const magnitude =
      Math.sqrt(
        real[i] *
          real[i] +
        imag[i] *
          imag[i]
      );

    magnitudes[i] =
      magnitude;

    if (
      magnitude >
      maximumMagnitude
    ) {
      maximumMagnitude =
        magnitude;
    }

    const frequency =
      i *
      sampleRate /
      FRAME_SIZE;

    totalMagnitude +=
      magnitude;

    weightedFrequency +=
      frequency *
      magnitude;

    totalEnergy +=
      magnitude *
      magnitude;
  }

  const centroid =
    totalMagnitude >
    EPSILON
      ? weightedFrequency /
        totalMagnitude
      : 0;

  let cumulative = 0;

  let rolloff = 0;

  const target =
    totalMagnitude *
    0.85;

  for (
    let i = 0;
    i < magnitudes.length;
    i++
  ) {
    cumulative +=
      magnitudes[i];

    if (
      cumulative >=
      target
    ) {
      rolloff =
        i *
        sampleRate /
        FRAME_SIZE;

      break;
    }
  }

  /*
   * Spectral flatness.
   */
  let logSum = 0;

  let arithmeticSum = 0;

  let validBins = 0;

  for (
    const magnitude
    of magnitudes
  ) {
    const safeMagnitude =
      Math.max(
        magnitude,
        EPSILON
      );

    logSum +=
      Math.log(
        safeMagnitude
      );

    arithmeticSum +=
      safeMagnitude;

    validBins++;
  }

  const geometricMean =
    validBins > 0
      ? Math.exp(
          logSum /
          validBins
        )
      : 0;

  const arithmeticMean =
    validBins > 0
      ? arithmeticSum /
        validBins
      : 0;

  const flatness =
    arithmeticMean >
    EPSILON
      ? geometricMean /
        arithmeticMean
      : 0;

  /*
   * Spectral entropy.
   */
  let entropy = 0;

  if (
    totalMagnitude >
    EPSILON
  ) {
    for (
      const magnitude
      of magnitudes
    ) {
      const probability =
        magnitude /
        totalMagnitude;

      if (
        probability >
        EPSILON
      ) {
        entropy -=
          probability *
          Math.log2(
            probability
          );
      }
    }

    entropy =
      clamp(
        entropy /
        Math.log2(
          magnitudes.length
        )
      );
  }

  /*
   * Spectral peakiness.
   */
  const peakiness =
    totalMagnitude >
    EPSILON
      ? maximumMagnitude /
        totalMagnitude
      : 0;

  const {
    pitch,
    confidence,
  } = detectPitch(
    frame,
    sampleRate
  );

  const harmonicRatio =
    calculateHarmonicRatio(
      magnitudes,
      pitch,
      sampleRate
    );

  const chroma =
    calculateChroma(
      magnitudes,
      sampleRate
    );

  /*
   * Spectral flux.
   */
  let spectralFlux = 0;

  if (
    previousMagnitudes &&
    previousMagnitudes.length ===
      magnitudes.length
  ) {
    let sum = 0;

    for (
      let i = 0;
      i < magnitudes.length;
      i++
    ) {
      const current =
        magnitudes[i];

      const previous =
        previousMagnitudes[i];

      const difference =
        Math.max(
          0,
          current -
            previous
        );

      sum +=
        difference *
        difference;
    }

    spectralFlux =
      Math.sqrt(
        sum /
        magnitudes.length
      );
  }

  return {
    rms,
    zcr,
    centroid,
    rolloff,
    flatness,
    entropy,
    peakiness,
    pitch,
    pitchConfidence:
      confidence,
    harmonicRatio,
    chroma,
    spectralFlux,
  };
}


/* ============================================================
 * FRAME EXTRACTION
 * ============================================================ */

function extractFrames(
  audioData: Float32Array,
  sampleRate: number
): FrameAnalysis[] {
  if (
    !audioData ||
    audioData.length <
      FRAME_SIZE
  ) {
    return [];
  }

  const possibleFrames =
    Math.floor(
      (
        audioData.length -
        FRAME_SIZE
      ) /
      HOP_SIZE
    ) + 1;

  const frameCount =
    Math.min(
      possibleFrames,
      MAX_FRAMES
    );

  if (
    frameCount <= 0
  ) {
    return [];
  }

  const frames:
    FrameAnalysis[] = [];

  const maximumStart =
    audioData.length -
    FRAME_SIZE;

  let previousMagnitudes:
    number[] | undefined;

  for (
    let frameIndex = 0;
    frameIndex < frameCount;
    frameIndex++
  ) {
    let start: number;

    if (
      possibleFrames <=
      MAX_FRAMES
    ) {
      start =
        frameIndex *
        HOP_SIZE;
    } else {
      const position =
        frameIndex /
        Math.max(
          1,
          frameCount - 1
        );

      start =
        Math.floor(
          position *
          maximumStart
        );
    }

    const frame =
      new Float32Array(
        FRAME_SIZE
      );

    for (
      let i = 0;
      i < FRAME_SIZE;
      i++
    ) {
      const index =
        start + i;

      frame[i] =
        index <
        audioData.length
          ? audioData[index]
          : 0;
    }

    const analysis =
      analyzeFrame(
        frame,
        sampleRate,
        previousMagnitudes
      );

    const windowed =
      new Float64Array(
        FRAME_SIZE
      );

    for (
      let i = 0;
      i < FRAME_SIZE;
      i++
    ) {
      windowed[i] =
        frame[i] *
        HANN_WINDOW[i];
    }

    const {
      real,
      imag,
    } = fft(windowed);

    const magnitudes =
      new Array(
        FRAME_SIZE / 2
      );

    for (
      let i = 0;
      i <
      FRAME_SIZE / 2;
      i++
    ) {
      magnitudes[i] =
        Math.sqrt(
          real[i] *
            real[i] +
          imag[i] *
            imag[i]
        );
    }

    previousMagnitudes =
      magnitudes;

    frames.push(
      analysis
    );
  }

  return frames;
}


/* ============================================================
 * ARRAY EXTRACTION
 * ============================================================ */

interface FeatureArrays {
  rms: number[];
  zcr: number[];
  centroid: number[];
  rolloff: number[];
  flatness: number[];
  entropy: number[];
  peakiness: number[];
  pitch: number[];
  pitchConfidence: number[];
  harmonic: number[];
  spectralFlux: number[];
  chroma: number[][];
}


function collectFeatureArrays(
  frames: FrameAnalysis[]
): FeatureArrays {
  return {
    rms:
      frames.map(
        frame =>
          frame.rms
      ),

    zcr:
      frames.map(
        frame =>
          frame.zcr
      ),

    centroid:
      frames.map(
        frame =>
          frame.centroid
      ),

    rolloff:
      frames.map(
        frame =>
          frame.rolloff
      ),

    flatness:
      frames.map(
        frame =>
          frame.flatness
      ),

    entropy:
      frames.map(
        frame =>
          frame.entropy
      ),

    peakiness:
      frames.map(
        frame =>
          frame.peakiness
      ),

    pitch:
      frames
        .map(
          frame =>
            frame.pitch
        )
        .filter(
          pitch =>
            pitch > 0
        ),

    pitchConfidence:
      frames.map(
        frame =>
          frame.pitchConfidence
      ),

    harmonic:
      frames.map(
        frame =>
          frame.harmonicRatio
      ),

    spectralFlux:
      frames.map(
        frame =>
          frame.spectralFlux
      ),

    chroma:
      frames.map(
        frame =>
          frame.chroma
      ),
  };
}


/* ============================================================
 * SEGMENT CONSISTENCY
 * ============================================================ */

function calculateSegmentConsistency(
  frames: FrameAnalysis[]
): number {
  if (
    frames.length < 8
  ) {
    return 0.5;
  }

  const segmentCount =
    Math.min(
      4,
      Math.floor(
        frames.length / 4
      )
    );

  if (
    segmentCount < 2
  ) {
    return 0.5;
  }

  const segments:
    FrameAnalysis[][] = [];

  for (
    let s = 0;
    s < segmentCount;
    s++
  ) {
    const start =
      Math.floor(
        s *
        frames.length /
        segmentCount
      );

    const end =
      Math.floor(
        (s + 1) *
        frames.length /
        segmentCount
      );

    segments.push(
      frames.slice(
        start,
        Math.max(
          start + 1,
          end
        )
      )
    );
  }

  const segmentPitchMeans =
    segments.map(
      segment =>
        mean(
          segment
            .map(
              frame =>
                frame.pitch
            )
            .filter(
              pitch =>
                pitch > 0
            )
        )
    );

  const segmentEnergyMeans =
    segments.map(
      segment =>
        mean(
          segment.map(
            frame =>
              frame.rms
          )
        )
    );

  const validPitchMeans =
    segmentPitchMeans.filter(
      value =>
        value > 0
    );

  const pitchVariation =
    validPitchMeans.length >= 2
      ? robustCoefficientOfVariation(
          validPitchMeans
        )
      : 0;

  const energyVariation =
    coefficientOfVariation(
      segmentEnergyMeans
    );

  const pitchConsistency =
    validPitchMeans.length >= 2
      ? clamp(
          1 -
          pitchVariation /
          0.30
        )
      : 0.5;

  const energyConsistency =
    clamp(
      1 -
      energyVariation /
      0.60
    );

  return clamp(
    (
      pitchConsistency +
      energyConsistency
    ) / 2
  );
}


/* ============================================================
 * CHROMA STABILITY
 * ============================================================ */

function calculateChromaStability(
  chromaFrames: number[][]
): number {
  if (
    chromaFrames.length < 2
  ) {
    return 0.5;
  }

  const averageChroma =
    new Array(12).fill(0);

  for (
    const frame
    of chromaFrames
  ) {
    for (
      let i = 0;
      i < 12;
      i++
    ) {
      averageChroma[i] +=
        frame[i] || 0;
    }
  }

  for (
    let i = 0;
    i < 12;
    i++
  ) {
    averageChroma[i] /=
      chromaFrames.length;
  }

  let totalDistance = 0;

  for (
    const frame
    of chromaFrames
  ) {
    let distance = 0;

    for (
      let i = 0;
      i < 12;
      i++
    ) {
      const difference =
        (frame[i] || 0) -
        averageChroma[i];

      distance +=
        difference *
        difference;
    }

    totalDistance +=
      Math.sqrt(distance);
  }

  const averageDistance =
    totalDistance /
    chromaFrames.length;

  return clamp(
    1 -
    averageDistance /
    0.60
  );
}


/* ============================================================
 * FORMANT STABILITY PROXY
 * ============================================================ */

function calculateFormantStability(
  centroids: number[],
  rolloffs: number[]
): number {
  if (
    centroids.length < 3 ||
    rolloffs.length < 3
  ) {
    return 0.5;
  }

  const centroidCV =
    robustCoefficientOfVariation(
      centroids
    );

  const rolloffCV =
    robustCoefficientOfVariation(
      rolloffs
    );

  const centroidStability =
    clamp(
      1 -
      centroidCV /
      0.35
    );

  const rolloffStability =
    clamp(
      1 -
      rolloffCV /
      0.35
    );

  return clamp(
    (
      centroidStability +
      rolloffStability
    ) / 2
  );
}


/* ============================================================
 * PUBLIC FEATURE EXTRACTION
 * ============================================================ */

export function extractAudioFeatures(
  audioData: Float32Array,
  sampleRate =
    SAMPLE_RATE_FALLBACK
): AudioFeatures {
  const frames =
    extractFrames(
      audioData,
      sampleRate
    );

  if (
    frames.length === 0
  ) {
    return emptyFeatures();
  }

  const arrays =
    collectFeatureArrays(
      frames
    );

  const activeFrames =
    frames.filter(
      frame =>
        frame.rms >
        0.008
    );

  const activeCentroids =
    activeFrames
      .map(
        frame =>
          frame.centroid
      )
      .filter(
        value =>
          value > 0
      );

  const activeRolloffs =
    activeFrames
      .map(
        frame =>
          frame.rolloff
      )
      .filter(
        value =>
          value > 0
      );

  const voicedPitches =
    filterPitchOutliers(
      frames
        .filter(
          frame =>
            frame.pitch > 0 &&
            frame.pitchConfidence >=
              0.30 &&
            frame.rms >
              0.008
        )
        .map(
          frame =>
            frame.pitch
        )
    );

  const pitchMean =
    mean(
      voicedPitches
    );

  const pitchVariation =
    pitchMean > 0
      ? clamp(
          robustCoefficientOfVariation(
            voicedPitches
          )
        )
      : 0;

  const temporalModulation =
    activeFrames.length >= 2
      ? clamp(
          coefficientOfVariation(
            activeFrames.map(
              frame =>
                frame.rms
            )
          )
        )
      : 0;

  const chromaStability =
    calculateChromaStability(
      activeFrames.map(
        frame =>
          frame.chroma
      )
    );

  const formantStability =
    calculateFormantStability(
      activeCentroids.length >= 3
        ? activeCentroids
        : arrays.centroid,
      activeRolloffs.length >= 3
        ? activeRolloffs
        : arrays.rolloff
    );

  const activeRms =
    activeFrames.map(
      frame =>
        frame.rms
    );

  const activeHarmonic =
    activeFrames
      .filter(
        frame =>
          frame.pitch > 0 &&
          frame.pitchConfidence >=
            0.30
      )
      .map(
        frame =>
          frame.harmonicRatio
      );

  return {
    zeroCrossingRate:
      mean(
        activeFrames.length
          ? activeFrames.map(
              frame =>
                frame.zcr
            )
          : arrays.zcr
      ),

    rmsEnergy:
      mean(
        activeRms.length
          ? activeRms
          : arrays.rms
      ),

    spectralCentroid:
      mean(
        activeCentroids.length
          ? activeCentroids
          : arrays.centroid
      ),

    spectralRolloff:
      mean(
        activeRolloffs.length
          ? activeRolloffs
          : arrays.rolloff
      ),

    spectralFlatness:
      mean(
        activeFrames.length
          ? activeFrames.map(
              frame =>
                frame.flatness
            )
          : arrays.flatness
      ),

    harmonicRatio:
      mean(
        activeHarmonic.length
          ? activeHarmonic
          : arrays.harmonic
      ),

    pitchMean,

    pitchVariation,

    temporalModulation,

    chromaStability,

    formantStability,
  };
}


/* ============================================================
 * DIAGNOSTIC ANALYSIS
 * ============================================================ */

function calculateDiagnostics(
  frames: FrameAnalysis[]
): AnalysisDiagnostics {
  if (
    frames.length === 0
  ) {
    return emptyDiagnostics();
  }

  const arrays =
    collectFeatureArrays(
      frames
    );

  /*
   * Only active frames should participate
   * in energy/spectral regularity.
   */
  const activeFrames =
    frames.filter(
      frame =>
        frame.rms >
        0.008
    );

  /*
   * Only confident voiced frames should
   * participate in pitch/harmonic analysis.
   */
  const voicedFrames =
    frames.filter(
      frame =>
        frame.pitch > 0 &&
        frame.pitchConfidence >=
          0.30 &&
        frame.rms >
          0.008
    );

  const voicedPitches =
    filterPitchOutliers(
      voicedFrames.map(
        frame =>
          frame.pitch
      )
    );

  /*
   * ----------------------------------------------------------
   * PITCH DIAGNOSTICS
   * ----------------------------------------------------------
   */

  const pitchMean =
    mean(
      voicedPitches
    );

  const pitchCV =
    robustCoefficientOfVariation(
      voicedPitches
    );

  const pitchDifferences =
    relativeDifferences(
      voicedPitches
    );

  const pitchStepVariation =
    pitchDifferences.length
      ? median(
          pitchDifferences
        )
      : 0;

  const pitchRegularity =
    voicedPitches.length >= 4
      ? clamp(
          1 -
          pitchCV /
          0.30
        )
      : 0.5;

  const pitchStepEntropy =
    entropyFromHistogram(
      pitchDifferences,
      8
    );

  const pitchRepetition =
    voicedPitches.length >= 8
      ? clamp(
          (
            autocorrelationAtLag(
              voicedPitches,
              Math.max(
                1,
                Math.floor(
                  voicedPitches.length /
                  5
                )
              )
            ) + 1
          ) /
          2
        )
      : 0.5;

  const pitchSmoothness =
    pitchStepVariation >
    EPSILON
      ? clamp(
          1 -
          pitchStepVariation /
          0.20
        )
      : 1;

  /*
   * ----------------------------------------------------------
   * ENERGY DIAGNOSTICS
   * ----------------------------------------------------------
   */

  const activeEnergy =
    activeFrames.map(
      frame =>
        frame.rms
    );

  const energyCV =
    coefficientOfVariation(
      activeEnergy
    );

  const energyDifferences =
    relativeDifferences(
      activeEnergy
    );

  const energyStepVariation =
    energyDifferences.length
      ? median(
          energyDifferences
        )
      : 0;

  const energyRegularity =
    activeEnergy.length >= 4
      ? clamp(
          1 -
          energyCV /
          0.70
        )
      : 0.5;

  const energySmoothness =
    clamp(
      1 -
      energyStepVariation /
      0.60
    );

  /*
   * ----------------------------------------------------------
   * SPECTRAL DIAGNOSTICS
   * ----------------------------------------------------------
   */

  const activeCentroids =
    activeFrames
      .map(
        frame =>
          frame.centroid
      )
      .filter(
        value =>
          value > 0
      );

  const activeRolloffs =
    activeFrames
      .map(
        frame =>
          frame.rolloff
      )
      .filter(
        value =>
          value > 0
      );

  const spectralCV =
    robustCoefficientOfVariation(
      activeCentroids
    );

  const rolloffCV =
    robustCoefficientOfVariation(
      activeRolloffs
    );

  const activeFlux =
    activeFrames.map(
      frame =>
        frame.spectralFlux
    );

  const fluxMean =
    mean(
      activeFlux
    );

  const fluxVariation =
    coefficientOfVariation(
      activeFlux
    );

  const spectralRegularity =
    activeCentroids.length >= 4
      ? clamp(
          1 -
          (
            spectralCV +
            rolloffCV
          ) /
          0.70
        )
      : 0.5;

  const spectralStability =
    activeFlux.length
      ? clamp(
          1 -
          fluxMean /
          2500
        )
      : 0.5;

  /*
   * ----------------------------------------------------------
   * HARMONIC DIAGNOSTICS
   * ----------------------------------------------------------
   *
   * IMPORTANT:
   * Previous version calculated harmonic CV over ALL frames,
   * including unvoiced frames where harmonicRatio = 0.
   *
   * That could make harmonicConsistency collapse to zero.
   */

  const voicedHarmonics =
    voicedFrames
      .map(
        frame =>
          frame.harmonicRatio
      )
      .filter(
        value =>
          Number.isFinite(
            value
          ) &&
          value > 0
      );

  const harmonicMean =
    mean(
      voicedHarmonics
    );

  const harmonicCV =
    coefficientOfVariation(
      voicedHarmonics
    );

  const harmonicConsistency =
    voicedHarmonics.length >= 4
      ? clamp(
          1 -
          harmonicCV /
          0.70
        )
      : 0.5;

  /*
   * ----------------------------------------------------------
   * VOICING
   * ----------------------------------------------------------
   */

  const voicedFrameRatio =
    frames.length > 0
      ? voicedFrames.length /
        frames.length
      : 0;

  const pitchConfidenceMean =
    voicedFrames.length
      ? mean(
          voicedFrames.map(
            frame =>
              frame.pitchConfidence
          )
        )
      : 0;

  const voicingConsistency =
    clamp(
      (
        voicedFrameRatio +
        pitchConfidenceMean
      ) / 2
    );

  /*
   * ----------------------------------------------------------
   * MICRO VARIATION
   * ----------------------------------------------------------
   */

  const pitchMicroVariation =
    voicedPitches.length >= 3
      ? clamp(
          median(
            relativeDifferences(
              voicedPitches
            )
          ) /
          0.20
        )
      : 0.5;

  const energyMicroVariation =
    activeEnergy.length >= 3
      ? clamp(
          median(
            relativeDifferences(
              activeEnergy
            )
          ) /
          0.50
        )
      : 0.5;

  const spectralMicroVariation =
    activeCentroids.length >= 3
      ? clamp(
          median(
            relativeDifferences(
              activeCentroids
            )
          ) /
          0.35
        )
      : 0.5;

  const microVariation =
    clamp(
      (
        pitchMicroVariation +
        energyMicroVariation +
        spectralMicroVariation
      ) / 3
    );

  /*
   * ----------------------------------------------------------
   * TEMPORAL REPETITION
   * ----------------------------------------------------------
   */

  const rmsRepetition =
    activeEnergy.length >= 8
      ? Math.abs(
          autocorrelationAtLag(
            activeEnergy,
            Math.max(
              1,
              Math.floor(
                activeEnergy.length /
                5
              )
            )
          )
        )
      : 0;

  const spectralRepetition =
    activeCentroids.length >= 8
      ? Math.abs(
          autocorrelationAtLag(
            activeCentroids,
            Math.max(
              1,
              Math.floor(
                activeCentroids.length /
                5
              )
            )
          )
        )
      : 0;

  const temporalRepetition =
    clamp(
      (
        rmsRepetition +
        spectralRepetition
      ) / 2
    );

  /*
   * ----------------------------------------------------------
   * SEGMENT CONSISTENCY
   * ----------------------------------------------------------
   */

  const segmentConsistency =
    calculateSegmentConsistency(
      frames
    );

  /*
   * ----------------------------------------------------------
   * CHROMA
   * ----------------------------------------------------------
   */

  const chromaStability =
    calculateChromaStability(
      activeFrames.map(
        frame =>
          frame.chroma
      )
    );

  /*
   * ----------------------------------------------------------
   * FORMANT PROXY
   * ----------------------------------------------------------
   */

  const formantStability =
    calculateFormantStability(
      activeCentroids,
      activeRolloffs
    );

  /*
   * ----------------------------------------------------------
   * TESTS
   * ----------------------------------------------------------
   */

  let syntheticTests = 0;

  let naturalTests = 0;

  let manipulationTests = 0;

  /*
   * ----------------------------------------------------------
   * SYNTHETIC TEST 1
   * Robustly low pitch variation.
   * ----------------------------------------------------------
   */

  if (
    voicedPitches.length >= 8 &&
    pitchCV < 0.055
  ) {
    syntheticTests++;
  }

  /*
   * SYNTHETIC TEST 2
   * Strong pitch repetition.
   * ----------------------------------------------------------
   */

  if (
    voicedPitches.length >= 10 &&
    pitchRepetition > 0.76
  ) {
    syntheticTests++;
  }

  /*
   * SYNTHETIC TEST 3
   * Very smooth pitch contour.
   * ----------------------------------------------------------
   */

  if (
    voicedPitches.length >= 10 &&
    pitchSmoothness > 0.90 &&
    pitchStepEntropy < 0.45
  ) {
    syntheticTests++;
  }

  /*
   * SYNTHETIC TEST 4
   * Very stable active energy.
   * ----------------------------------------------------------
   */

  if (
    activeEnergy.length >= 10 &&
    energyRegularity > 0.88 &&
    energyStepVariation < 0.12
  ) {
    syntheticTests++;
  }

  /*
   * SYNTHETIC TEST 5
   * Stable active spectrum.
   * ----------------------------------------------------------
   */

  if (
    activeCentroids.length >= 10 &&
    spectralRegularity > 0.88 &&
    spectralStability > 0.90
  ) {
    syntheticTests++;
  }

  /*
   * SYNTHETIC TEST 6
   * Consistent harmonics.
   * ----------------------------------------------------------
   */

  if (
    voicedHarmonics.length >= 8 &&
    harmonicMean > 0.48 &&
    harmonicConsistency > 0.88
  ) {
    syntheticTests++;
  }

  /*
   * SYNTHETIC TEST 7
   * Low frame diversity.
   * ----------------------------------------------------------
   */

  if (
    microVariation < 0.20 &&
    segmentConsistency > 0.88
  ) {
    syntheticTests++;
  }

  /*
   * SYNTHETIC TEST 8
   * Strong temporal repetition.
   * ----------------------------------------------------------
   */

  if (
    temporalRepetition > 0.78
  ) {
    syntheticTests++;
  }

  /*
   * SYNTHETIC TEST 9
   * Highly regular voiced speech.
   * ----------------------------------------------------------
   */

  if (
    voicedFrameRatio > 0.70 &&
    pitchRegularity > 0.90 &&
    pitchStepEntropy < 0.50
  ) {
    syntheticTests++;
  }

  /*
   * SYNTHETIC TEST 10
   *
   * Cross-feature mismatch:
   * stable harmonic/chroma structure while
   * temporal variation remains unusually constrained.
   *
   * This is deliberately only one supporting signal.
   */

  if (
    harmonicConsistency > 0.82 &&
    chromaStability > 0.68 &&
    temporalRepetition > 0.55 &&
    microVariation < 0.38
  ) {
    syntheticTests++;
  }

  /*
   * SYNTHETIC TEST 11
   *
   * Strong segment consistency combined with
   * spectral/formant stability.
   */

  if (
    segmentConsistency > 0.82 &&
    formantStability > 0.80 &&
    spectralRegularity > 0.78
  ) {
    syntheticTests++;
  }


  /*
   * ----------------------------------------------------------
   * NATURAL TESTS
   * ----------------------------------------------------------
   */

  /*
   * NATURAL TEST 1
   * Broad pitch movement.
   * ----------------------------------------------------------
   */

  if (
    voicedPitches.length >= 8 &&
    pitchCV > 0.10
  ) {
    naturalTests++;
  }

  /*
   * NATURAL TEST 2
   * Diverse pitch steps.
   * ----------------------------------------------------------
   */

  if (
    voicedPitches.length >= 8 &&
    pitchStepEntropy > 0.55 &&
    pitchStepVariation > 0.035
  ) {
    naturalTests++;
  }

  /*
   * NATURAL TEST 3
   * Energy dynamics.
   * ----------------------------------------------------------
   */

  if (
    activeEnergy.length >= 8 &&
    energyCV > 0.16 &&
    energyStepVariation > 0.08
  ) {
    naturalTests++;
  }

  /*
   * NATURAL TEST 4
   * Spectral movement.
   * ----------------------------------------------------------
   */

  if (
    fluxMean > 250 &&
    spectralCV > 0.08
  ) {
    naturalTests++;
  }

  /*
   * NATURAL TEST 5
   * Spectral variation.
   * ----------------------------------------------------------
   */

  if (
    spectralCV > 0.12 ||
    rolloffCV > 0.12
  ) {
    naturalTests++;
  }

  /*
   * NATURAL TEST 6
   * Voiced/unvoiced variation.
   * ----------------------------------------------------------
   */

  if (
    voicedFrameRatio > 0.15 &&
    voicedFrameRatio < 0.82
  ) {
    naturalTests++;
  }

  /*
   * NATURAL TEST 7
   * Micro variation.
   * ----------------------------------------------------------
   */

  if (
    microVariation > 0.35
  ) {
    naturalTests++;
  }

  /*
   * NATURAL TEST 8
   * Low temporal repetition.
   * ----------------------------------------------------------
   */

  if (
    temporalRepetition < 0.45
  ) {
    naturalTests++;
  }


  /*
   * ----------------------------------------------------------
   * MANIPULATION TESTS
   * ----------------------------------------------------------
   */

  /*
   * MANIPULATION TEST 1
   * Spectral instability.
   */

  if (
    spectralCV > 0.45 ||
    fluxVariation > 1.25
  ) {
    manipulationTests++;
  }

  /*
   * MANIPULATION TEST 2
   * Abrupt energy changes.
   */

  if (
    energyStepVariation > 0.70
  ) {
    manipulationTests++;
  }

  /*
   * MANIPULATION TEST 3
   * Chroma instability.
   */

  if (
    chromaStability < 0.20
  ) {
    manipulationTests++;
  }

  /*
   * MANIPULATION TEST 4
   * Contradictory behaviour.
   */

  if (
    spectralStability < 0.25 &&
    pitchRegularity > 0.80
  ) {
    manipulationTests++;
  }


  /*
   * ----------------------------------------------------------
   * EVIDENCE SCORES
   * ----------------------------------------------------------
   */

  /*
   * Synthetic evidence.
   *
   * The test count is deliberately weighted, but
   * individual acoustic characteristics contribute too.
   */

  const syntheticEvidence =
    clamp(
      (
        clamp(
          syntheticTests / 11
        ) * 0.38 +

        pitchRegularity *
          0.10 +

        energyRegularity *
          0.08 +

        spectralRegularity *
          0.08 +

        harmonicConsistency *
          0.08 +

        temporalRepetition *
          0.10 +

        segmentConsistency *
          0.07 +

        (1 - microVariation) *
          0.05 +

        formantStability *
          0.04
      )
    );


  /*
   * Natural evidence.
   */

  const naturalEvidence =
    clamp(
      (
        clamp(
          naturalTests / 8
        ) * 0.32 +

        clamp(
          pitchCV /
          0.30
        ) * 0.12 +

        clamp(
          energyCV /
          0.70
        ) * 0.10 +

        clamp(
          spectralCV /
          0.35
        ) * 0.10 +

        clamp(
          fluxMean /
          2500
        ) * 0.08 +

        microVariation *
          0.08 +

        (1 - temporalRepetition) *
          0.08 +

        (1 - segmentConsistency) *
          0.07 +

        (1 - formantStability) *
          0.05
      )
    );


  /*
   * Manipulation evidence.
   */

  const manipulationEvidence =
    clamp(
      (
        clamp(
          manipulationTests / 4
        ) * 0.45 +

        clamp(
          spectralCV /
          0.60
        ) * 0.15 +

        clamp(
          energyStepVariation /
          1.0
        ) * 0.15 +

        (1 - chromaStability) *
          0.10 +

        (
          spectralStability <
          0.25
            ? 0.15
            : 0
        )
      )
    );


  /*
   * ----------------------------------------------------------
   * SAMPLE RELIABILITY
   * ----------------------------------------------------------
   */

  const frameReliability =
    clamp(
      frames.length /
      50
    );

  const activeReliability =
    clamp(
      activeFrames.length /
      30
    );

  const voicedReliability =
    clamp(
      voicedFrames.length /
      25
    );

  const confidenceReliability =
    voicedFrames.length
      ? clamp(
          mean(
            voicedFrames.map(
              frame =>
                frame.pitchConfidence
            )
          )
        )
      : 0;

  const sampleReliability =
    clamp(
      (
        frameReliability *
          0.30 +

        activeReliability *
          0.30 +

        voicedReliability *
          0.25 +

        confidenceReliability *
          0.15
      )
    );


  /*
   * ----------------------------------------------------------
   * TEST AGREEMENT
   * ----------------------------------------------------------
   *
   * A major change from v5.1:
   *
   * Evidence disagreement now has a much stronger
   * influence on confidence.
   */

  const evidenceValues = [
    syntheticEvidence,
    naturalEvidence,
    manipulationEvidence,
  ];

  const evidenceMean =
    mean(
      evidenceValues
    );

  const evidenceSpread =
    standardDeviation(
      evidenceValues
    );

  const testAgreement =
    clamp(
      1 -
      evidenceSpread /
      0.35
    );


  /*
   * ----------------------------------------------------------
   * FINAL DIAGNOSTICS
   * ----------------------------------------------------------
   */

  return {
    pitchRegularity,

    energyRegularity,

    spectralRegularity,

    harmonicConsistency,

    microVariation,

    temporalRepetition,

    voicingConsistency,

    segmentConsistency,

    aiEvidence:
      syntheticEvidence,

    realEvidence:
      naturalEvidence,

    manipulationEvidence,

    sampleReliability,

    testAgreement,

    syntheticTests,

    naturalTests,

    manipulationTests,

    totalFrames:
      frames.length,

    activeFrames:
      activeFrames.length,

    voicedFrames:
      voicedFrames.length,
  };
}


/* ============================================================
 * EMPTY VALUES
 * ============================================================ */

function emptyFeatures(): AudioFeatures {
  return {
    zeroCrossingRate: 0,
    rmsEnergy: 0,
    spectralCentroid: 0,
    spectralRolloff: 0,
    spectralFlatness: 0,
    harmonicRatio: 0,
    pitchMean: 0,
    pitchVariation: 0,
    temporalModulation: 0,
    chromaStability: 0,
    formantStability: 0,
  };
}


function emptyDiagnostics(): AnalysisDiagnostics {
  return {
    pitchRegularity: 0,
    energyRegularity: 0,
    spectralRegularity: 0,
    harmonicConsistency: 0,
    microVariation: 0,
    temporalRepetition: 0,
    voicingConsistency: 0,
    segmentConsistency: 0,

    aiEvidence: 0,
    realEvidence: 0,
    manipulationEvidence: 0,

    sampleReliability: 0,
    testAgreement: 0,

    syntheticTests: 0,
    naturalTests: 0,
    manipulationTests: 0,

    totalFrames: 0,
    activeFrames: 0,
    voicedFrames: 0,
  };
}


/* ============================================================
 * CLASSIFICATION
 * ============================================================ */

function classifyFromDiagnostics(
  diagnostics: AnalysisDiagnostics
): {
  verdict:
    | "AI-Generated"
    | "Real Voice"
    | "Possibly Manipulated"
    | "Inconclusive";

  confidence: number;

  explanation: string;
} {
  const {
    aiEvidence,
    realEvidence,
    manipulationEvidence,

    syntheticTests,
    naturalTests,
    manipulationTests,

    sampleReliability,
    testAgreement,
  } = diagnostics;


  /*
   * ----------------------------------------------------------
   * WEAK SAMPLE
   * ----------------------------------------------------------
   */

  if (
    sampleReliability <
    0.30
  ) {
    return {
      verdict:
        "Inconclusive",

      confidence:
        Math.round(
          45 +
          sampleReliability *
          20
        ),

      explanation:
        "The audio sample contains insufficient reliable speech information for a confident acoustic classification.",
    };
  }


  /*
   * ----------------------------------------------------------
   * MANIPULATION
   * ----------------------------------------------------------
   */

  if (
    manipulationTests >= 2 &&
    manipulationEvidence >= 0.58 &&
    manipulationEvidence >
      aiEvidence + 0.04 &&
    manipulationEvidence >
      realEvidence + 0.04
  ) {
    let confidence =
      55 +
      manipulationEvidence *
        28 +
      sampleReliability *
        8 +
      testAgreement *
        6;

    /*
     * Evidence disagreement caps certainty.
     */
    if (
      testAgreement < 0.45
    ) {
      confidence =
        Math.min(
          confidence,
          72
        );
    }

    confidence =
      clamp(
        confidence,
        50,
        88
      );

    return {
      verdict:
        "Possibly Manipulated",

      confidence:
        Math.round(
          confidence
        ),

      explanation:
        "Several acoustic measurements show inconsistent or abrupt behaviour that can be associated with editing, processing, or manipulation. This is not proof of deliberate tampering.",
    };
  }


  /*
   * ----------------------------------------------------------
   * AI-GENERATED
   * ----------------------------------------------------------
   *
   * We require multiple independent signals.
   */

  const aiMargin =
    aiEvidence -
    realEvidence;

  const strongAI =
    syntheticTests >= 5 &&
    aiEvidence >= 0.52 &&
    aiMargin >= 0.06 &&
    testAgreement >= 0.25;

  const veryStrongAI =
    syntheticTests >= 4 &&
    aiEvidence >= 0.66 &&
    aiMargin >= 0.12 &&
    testAgreement >= 0.34;

  if (
    strongAI ||
    veryStrongAI
  ) {
    let confidence =
      53 +
      aiEvidence * 32 +
      testAgreement * 8 +
      sampleReliability * 7;

    /*
     * Strong disagreement prevents excessive certainty.
     */
    if (
      testAgreement < 0.45
    ) {
      confidence =
        Math.min(
          confidence,
          78
        );
    }

    confidence =
      clamp(
        confidence,
        52,
        94
      );

    return {
      verdict:
        "AI-Generated",

      confidence:
        Math.round(
          confidence
        ),

      explanation:
        "Multiple independent acoustic patterns are consistent with synthetic speech, including pitch regularity, temporal consistency, spectral behaviour, harmonic structure, and frame-level repetition. This is a heuristic result rather than forensic authentication.",
    };
  }


  /*
   * ----------------------------------------------------------
   * REAL VOICE
   * ----------------------------------------------------------
   *
   * IMPORTANT:
   *
   * v5.1 allowed a large natural-test count to produce
   * high confidence even when the three evidence groups
   * disagreed.
   *
   * v6.0 requires stronger agreement before calling a sample
   * Real Voice with high confidence.
   */

  const realMargin =
    realEvidence -
    aiEvidence;

  const strongReal =
    naturalTests >= 4 &&
    realEvidence >= 0.55 &&
    realMargin >= 0.08 &&
    testAgreement >= 0.42;

  const veryStrongReal =
    naturalTests >= 5 &&
    realEvidence >= 0.65 &&
    realMargin >= 0.12 &&
    testAgreement >= 0.50;

  if (
    strongReal ||
    veryStrongReal
  ) {
    let confidence =
      52 +
      realEvidence * 30 +
      testAgreement * 10 +
      sampleReliability * 8;

    /*
     * Do not allow disagreement to masquerade
     * as strong real-voice certainty.
     */

    if (
      testAgreement < 0.55
    ) {
      confidence =
        Math.min(
          confidence,
          76
        );
    }

    confidence =
      clamp(
        confidence,
        50,
        88
      );

    return {
      verdict:
        "Real Voice",

      confidence:
        Math.round(
          confidence
        ),

      explanation:
        "The recording contains several acoustic variations that are more consistent with naturally produced speech under this heuristic analysis. The result is based on acoustic evidence rather than machine learning or forensic authentication.",
    };
  }


  /*
   * ----------------------------------------------------------
   * INCONCLUSIVE
   * ----------------------------------------------------------
   *
   * Mixed evidence should remain mixed.
   */

  const strongestEvidence =
    Math.max(
      aiEvidence,
      realEvidence,
      manipulationEvidence
    );

  let confidence =
    45 +
    strongestEvidence * 22 +
    sampleReliability * 8 +
    testAgreement * 10;

  /*
   * If agreement is poor, the result should
   * visibly communicate uncertainty.
   */

  if (
    testAgreement < 0.40
  ) {
    confidence =
      Math.min(
        confidence,
        62
      );
  }

  confidence =
    clamp(
      confidence,
      45,
      68
    );

  return {
    verdict:
      "Inconclusive",

    confidence:
      Math.round(
        confidence
      ),

    explanation:
      "The acoustic measurements contain mixed or insufficient evidence. The current browser-based heuristic engine cannot confidently classify this sample.",
  };
}


/* ============================================================
 * AUDIO BUFFER → MONO PCM
 * ============================================================ */

function audioBufferToMono(
  audioBuffer: AudioBuffer
): Float32Array {
  const channels =
    audioBuffer.numberOfChannels;

  const length =
    audioBuffer.length;

  if (
    channels <= 0 ||
    length <= 0
  ) {
    return new Float32Array(0);
  }

  if (
    channels === 1
  ) {
    return audioBuffer.getChannelData(
      0
    );
  }

  const mono =
    new Float32Array(
      length
    );

  for (
    let channel = 0;
    channel < channels;
    channel++
  ) {
    const data =
      audioBuffer.getChannelData(
        channel
      );

    for (
      let i = 0;
      i < length;
      i++
    ) {
      mono[i] +=
        data[i] /
        channels;
    }
  }

  return mono;
}


/* ============================================================
 * RESULT BUILDER
 * ============================================================ */

function createResult(
  verdict:
    | "AI-Generated"
    | "Real Voice"
    | "Possibly Manipulated"
    | "Inconclusive",

  confidence: number,

  features: AudioFeatures,

  explanation: string,

  diagnostics?: AnalysisDiagnostics
): AnalysisResult {
  return {
    id:
      `${Date.now()}-${Math.random()
        .toString(36)
        .slice(2, 9)}`,

    isDeepfake:
      verdict ===
      "AI-Generated",

    verdict,

    confidence:
      Math.round(
        clamp(
          confidence,
          0,
          100
        )
      ),

    features,

    explanation,

    timestamp:
      Date.now(),

    diagnostics,
  };
}


/* ============================================================
 * INTERNAL FLOAT32 ANALYSIS
 * ============================================================ */

function analyzeFloat32Data(
  audioData: Float32Array,
  sampleRate: number
): AnalysisResult {
  if (
    !audioData ||
    audioData.length <
      FRAME_SIZE
  ) {
    return createResult(
      "Inconclusive",
      45,
      emptyFeatures(),
      "The audio sample is too short for reliable acoustic analysis."
    );
  }

  const frames =
    extractFrames(
      audioData,
      sampleRate
    );

  if (
    frames.length <
    MIN_ANALYSIS_FRAMES
  ) {
    return createResult(
      "Inconclusive",
      45,
      extractAudioFeatures(
        audioData,
        sampleRate
      ),
      "The audio sample does not contain enough analysis frames for a reliable result."
    );
  }

  const features =
    extractAudioFeatures(
      audioData,
      sampleRate
    );

  const diagnostics =
    calculateDiagnostics(
      frames
    );

  if (
    diagnostics.activeFrames <
    MIN_ACTIVE_FRAMES
  ) {
    return createResult(
      "Inconclusive",
      48,
      features,
      "The recording contains too little active speech/audio energy for reliable classification.",
      diagnostics
    );
  }

  const classification =
    classifyFromDiagnostics(
      diagnostics
    );

  let finalConfidence =
    classification.confidence;

  /*
   * Very low voiced-frame count reduces confidence.
   */

  if (
    diagnostics.voicedFrames <
    MIN_VOICED_FRAMES
  ) {
    finalConfidence =
      Math.min(
        finalConfidence,
        70
      );
  }

  /*
   * Short recordings should not produce
   * very high confidence.
   */

  if (
    diagnostics.totalFrames <
    25
  ) {
    finalConfidence =
      Math.min(
        finalConfidence,
        76
      );
  }

  /*
   * Poor agreement is now explicitly
   * reflected in final confidence.
   */

  if (
    diagnostics.testAgreement <
    0.35
  ) {
    finalConfidence =
      Math.min(
        finalConfidence,
        68
      );
  }

  return createResult(
    classification.verdict,
    finalConfidence,
    features,
    classification.explanation,
    diagnostics
  );
}


/* ============================================================
 * PUBLIC analyzeAudio
 *
 * App.tsx calls:
 *
 * analyzeAudio(
 *   audioBuffer,
 *   file.name,
 *   forceResult
 * )
 * ============================================================ */

export async function analyzeAudio(
  audioBuffer: AudioBuffer | null,
  filename = "audio",
  forceResult?:
    | "real"
    | "fake"
    | null
): Promise<AnalysisResult> {

  /*
   * ----------------------------------------------------------
   * FORCED REAL DEMO
   * ----------------------------------------------------------
   */

  if (
    forceResult === "real"
  ) {
    const features =
      audioBuffer
        ? extractAudioFeatures(
            audioBufferToMono(
              audioBuffer
            ),
            audioBuffer.sampleRate
          )
        : emptyFeatures();

    return createResult(
      "Real Voice",
      95,
      features,
      `Demo result: "${filename}" was explicitly configured as a Real Voice sample.`
    );
  }


  /*
   * ----------------------------------------------------------
   * FORCED AI DEMO
   * ----------------------------------------------------------
   */

  if (
    forceResult === "fake"
  ) {
    const features =
      audioBuffer
        ? extractAudioFeatures(
            audioBufferToMono(
              audioBuffer
            ),
            audioBuffer.sampleRate
          )
        : emptyFeatures();

    return createResult(
      "AI-Generated",
      95,
      features,
      `Demo result: "${filename}" was explicitly configured as an AI-Generated sample.`
    );
  }


  /*
   * ----------------------------------------------------------
   * NO AUDIO BUFFER
   * ----------------------------------------------------------
   */

  if (!audioBuffer) {
    return createResult(
      "Inconclusive",
      45,
      emptyFeatures(),
      `No decoded audio buffer was available for "${filename}", so acoustic classification could not be performed.`
    );
  }


  /*
   * ----------------------------------------------------------
   * REAL AUDIO ANALYSIS
   * ----------------------------------------------------------
   */

  try {
    const mono =
      audioBufferToMono(
        audioBuffer
      );

    if (
      mono.length === 0
    ) {
      return createResult(
        "Inconclusive",
        45,
        emptyFeatures(),
        `The decoded audio for "${filename}" contained no usable samples.`
      );
    }

    return analyzeFloat32Data(
      mono,
      audioBuffer.sampleRate ||
        SAMPLE_RATE_FALLBACK
    );
  } catch (error) {
    console.error(
      "VoxForensics analysis error:",
      error
    );

    return createResult(
      "Inconclusive",
      45,
      emptyFeatures(),
      `The audio "${filename}" could not be analyzed safely.`
    );
  }
}


/* ============================================================
 * SYNCHRONOUS COMPATIBILITY API
 * ============================================================ */

export function analyzeAudioSync(
  audioData: Float32Array,
  sampleRate =
    SAMPLE_RATE_FALLBACK
): AnalysisResult {
  return analyzeFloat32Data(
    audioData,
    sampleRate
  );
}


/* ============================================================
 * HISTORY
 * ============================================================ */

const HISTORY_KEY =
  "voxforensics_scan_history_v5";


/* ============================================================
 * NORMALIZE HISTORY
 * ============================================================ */

function normalizeHistoryRecord(
  item: any
): ScanRecord | null {
  if (
    !item ||
    typeof item !== "object"
  ) {
    return null;
  }

  /*
   * Current format.
   */

  if (
    item.result &&
    item.filename
  ) {
    const result =
      item.result;

    return {
      id:
        String(
          item.id ||
          `${Date.now()}-${Math.random()
            .toString(36)
            .slice(2, 9)}`
        ),

      filename:
        String(
          item.filename
        ),

      timestamp:
        typeof item.timestamp ===
        "string"
          ? item.timestamp
          : new Date(
              Number(
                item.timestamp ||
                Date.now()
              )
            ).toISOString(),

      duration:
        Number(
          item.duration || 0
        ),

      result: {
        ...result,

        isDeepfake:
          result.isDeepfake ??
          result.verdict ===
            "AI-Generated",
      },
    };
  }


  /*
   * Legacy format.
   */

  if (
    item.verdict &&
    item.features
  ) {
    const result:
      AnalysisResult = {
      id:
        String(
          item.id ||
          `${Date.now()}-${Math.random()
            .toString(36)
            .slice(2, 9)}`
        ),

      isDeepfake:
        item.verdict ===
        "AI-Generated",

      verdict:
        item.verdict,

      confidence:
        Number(
          item.confidence || 0
        ),

      features:
        item.features,

      explanation:
        String(
          item.explanation ||
          "Legacy analysis result."
        ),

      timestamp:
        Number(
          item.timestamp ||
          Date.now()
        ),

      diagnostics:
        item.diagnostics,
    };

    return {
      id:
        String(
          item.id ||
          `${Date.now()}-${Math.random()
            .toString(36)
            .slice(2, 9)}`
        ),

      filename:
        String(
          item.fileName ||
          item.filename ||
          "Unknown audio"
        ),

      timestamp:
        new Date(
          Number(
            item.timestamp ||
            Date.now()
          )
        ).toISOString(),

      duration:
        Number(
          item.duration || 0
        ),

      result,
    };
  }

  return null;
}


/* ============================================================
 * GET HISTORY
 * ============================================================ */

export function getScanHistory():
  ScanRecord[] {
  try {
    const stored =
      localStorage.getItem(
        HISTORY_KEY
      );

    if (!stored) {
      return [];
    }

    const parsed =
      JSON.parse(
        stored
      );

    if (
      !Array.isArray(parsed)
    ) {
      return [];
    }

    const normalized =
      parsed
        .map(
          item =>
            normalizeHistoryRecord(
              item
            )
        )
        .filter(
          (
            item
          ): item is ScanRecord =>
            item !== null
        );

    return normalized;
  } catch (error) {
    console.warn(
      "Failed to load VoxForensics history:",
      error
    );

    return [];
  }
}


/* ============================================================
 * SAVE HISTORY — CURRENT APP API
 * ============================================================ */

export function saveScanToHistory(
  filename: string,
  result: AnalysisResult,
  duration: number
): void {
  try {
    const history =
      getScanHistory();

    const record:
      ScanRecord = {
      id:
        `${Date.now()}-${Math.random()
          .toString(36)
          .slice(2, 9)}`,

      filename,

      timestamp:
        new Date().toISOString(),

      duration:
        Number.isFinite(
          duration
        )
          ? duration
          : 0,

      result: {
        ...result,

        isDeepfake:
          result.isDeepfake ??
          result.verdict ===
            "AI-Generated",
      },
    };

    const updatedHistory = [
      record,
      ...history,
    ].slice(0, 100);

    localStorage.setItem(
      HISTORY_KEY,
      JSON.stringify(
        updatedHistory
      )
    );
  } catch (error) {
    console.warn(
      "Failed to save VoxForensics history:",
      error
    );
  }
}


/* ============================================================
 * SAVE HISTORY — LEGACY COMPATIBILITY
 * ============================================================ */

export function saveScanRecord(
  record: ScanRecord
): void {
  try {
    const history =
      getScanHistory();

    const normalized:
      ScanRecord = {
      ...record,

      result: {
        ...record.result,

        isDeepfake:
          record.result.isDeepfake ??
          record.result.verdict ===
            "AI-Generated",
      },
    };

    const updatedHistory = [
      normalized,
      ...history.filter(
        item =>
          item.id !==
          normalized.id
      ),
    ].slice(0, 100);

    localStorage.setItem(
      HISTORY_KEY,
      JSON.stringify(
        updatedHistory
      )
    );
  } catch (error) {
    console.warn(
      "Failed to save VoxForensics scan record:",
      error
    );
  }
}


/* ============================================================
 * CLEAR HISTORY — CURRENT APP API
 * ============================================================ */

export function clearHistory(): void {
  try {
    localStorage.removeItem(
      HISTORY_KEY
    );
  } catch (error) {
    console.warn(
      "Failed to clear VoxForensics history:",
      error
    );
  }
}


/* ============================================================
 * CLEAR HISTORY — LEGACY COMPATIBILITY
 * ============================================================ */

export function clearScanHistory(): void {
  clearHistory();
}


/* ============================================================
 * DIAGNOSTIC FORMATTER
 * ============================================================ */

export function formatDiagnostics(
  diagnostics?: AnalysisDiagnostics
): string {
  if (!diagnostics) {
    return "No diagnostic information available.";
  }

  return [
    `Frames: ${diagnostics.totalFrames}`,

    `Active frames: ${diagnostics.activeFrames}`,

    `Voiced frames: ${diagnostics.voicedFrames}`,

    `Synthetic tests: ${diagnostics.syntheticTests}/11`,

    `Natural tests: ${diagnostics.naturalTests}/8`,

    `Manipulation tests: ${diagnostics.manipulationTests}/4`,

    `AI evidence: ${(
      diagnostics.aiEvidence *
      100
    ).toFixed(1)}%`,

    `Real evidence: ${(
      diagnostics.realEvidence *
      100
    ).toFixed(1)}%`,

    `Manipulation evidence: ${(
      diagnostics.manipulationEvidence *
      100
    ).toFixed(1)}%`,

    `Sample reliability: ${(
      diagnostics.sampleReliability *
      100
    ).toFixed(1)}%`,

    `Test agreement: ${(
      diagnostics.testAgreement *
      100
    ).toFixed(1)}%`,
  ].join(
    " | "
  );
}


/* ============================================================
 * DEFAULT EXPORT
 * ============================================================ */

const analysis = {
  analyzeAudio,

  analyzeAudioSync,

  extractAudioFeatures,

  getScanHistory,

  saveScanToHistory,

  saveScanRecord,

  clearHistory,

  clearScanHistory,

  formatDiagnostics,
};

export default analysis;