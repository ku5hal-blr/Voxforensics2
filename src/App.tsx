import {
  useState,
  useRef,
  useCallback,
  useEffect,
} from 'react';

import {
  AuthProvider,
  useAuth,
} from './components/AuthSystem';

import AuthSystem from './components/AuthSystem';

import {
  ConsentProvider,
  useConsent,
} from './components/ConsentModal';

import {
  analyzeAudio,
  getScanHistory,
  saveScanToHistory,
  clearHistory,
  AnalysisResult,
  ScanRecord,
} from './utils/analysis';

import AdminDashboard from './components/AdminDashboard';
import UserDashboard from './components/UserDashboard';
import E2ETestPanel from './components/E2ETestPanel';
import LiveBackground from './components/LiveBackground';

/*
 * ============================================================
 * VOXFORENSICS — MACHINE LEARNING API
 * ============================================================
 *
 * Real uploaded/recorded audio is sent to the Python FastAPI
 * backend running locally at:
 *
 * http://127.0.0.1:8000/predict
 *
 * The backend loads the trained Random Forest model and returns:
 *
 * - verdict
 * - real_probability
 * - fake_probability
 *
 * The existing frontend result format is then populated from
 * that API response.
 * ============================================================
 */

const predictWithML = async (file: File) => {
  const formData = new FormData();

  formData.append(
    'file',
    file
  );

  const response =
    await fetch(
      'http://127.0.0.1:8000/predict',
      {
        method: 'POST',
        body: formData,
      }
    );

  if (!response.ok) {
    const errorText =
      await response.text();

    throw new Error(
      `ML API error: ${errorText}`
    );
  }

  return response.json();
};

type TabType =
  | 'home'
  | 'scanner'
  | 'refer'
  | 'history'
  | 'about';

function AppContent() {
  const { user, logout } =
    useAuth();

  const { hasConsented } =
    useConsent();

  const [activeTab, setActiveTab] =
    useState<TabType>('home');

  const [isRecording, setIsRecording] =
    useState(false);

  const [isAnalyzing, setIsAnalyzing] =
    useState(false);

  const [currentResult, setCurrentResult] =
    useState<AnalysisResult | null>(null);

  const [audioFile, setAudioFile] =
    useState<File | null>(null);

  /*
   * ------------------------------------------------------------
   * AUDIO PLAYBACK
   * ------------------------------------------------------------
   */

  const [isPlaying, setIsPlaying] =
    useState(false);

  const [recordedAudioFile, setRecordedAudioFile] =
    useState<File | null>(null);

  const audioPreviewRef =
    useRef<HTMLAudioElement | null>(null);

  const audioObjectUrlRef =
    useRef<string | null>(null);

  const [audioPreviewUrl, setAudioPreviewUrl] =
    useState<string | null>(null);

  const [waveformData, setWaveformData] =
    useState<number[]>([]);

  const [spectrogramData, setSpectrogramData] =
    useState<number[][]>([]);

  const [history, setHistory] =
    useState<ScanRecord[]>(
      getScanHistory()
    );

  const [recordingTime, setRecordingTime] =
    useState(0);

  const [showTestPanel, setShowTestPanel] =
    useState(false);

  const [showDashboard, setShowDashboard] =
    useState(false);

  /*
   * When true, opening the dashboard from the Refer tab
   * will automatically scroll to the Referral Program card.
   */

  const [openReferralCard, setOpenReferralCard] =
    useState(false);

  /*
   * Authentication modal
   */

  const [showAuthModal, setShowAuthModal] =
    useState(false);

  /*
   * Login-required modal
   */

  const [showLoginRequiredModal, setShowLoginRequiredModal] =
    useState(false);

  const mediaRecorderRef =
    useRef<MediaRecorder | null>(null);

  const audioChunksRef =
    useRef<Blob[]>([]);

  const audioContextRef =
    useRef<AudioContext | null>(null);

  const analyserRef =
    useRef<AnalyserNode | null>(null);

  const animationRef =
    useRef<number>(0);

  const recordingIntervalRef =
    useRef<
      ReturnType<typeof setInterval> | undefined
    >(undefined);

  const homeFileInputRef =
    useRef<HTMLInputElement>(null);

  const scannerFileInputRef =
    useRef<HTMLInputElement>(null);

  const canvasWaveformRef =
    useRef<HTMLCanvasElement>(null);

  const canvasSpectrogramRef =
    useRef<HTMLCanvasElement>(null);

  const simulatedCanvasRef =
    useRef<HTMLCanvasElement>(null);

  const simAnimRef =
    useRef<number>(0);

  const streamRef =
    useRef<MediaStream | null>(null);

  const dropZoneRef =
    useRef<HTMLDivElement>(null);

  /*
   * ------------------------------------------------------------
   * AUDIO PREVIEW URL
   * ------------------------------------------------------------
   */

  useEffect(() => {
    if (!audioFile) {
      setAudioPreviewUrl(null);

      if (
        audioObjectUrlRef.current
      ) {
        URL.revokeObjectURL(
          audioObjectUrlRef.current
        );

        audioObjectUrlRef.current =
          null;
      }

      return;
    }

    const objectUrl =
      URL.createObjectURL(
        audioFile
      );

    audioObjectUrlRef.current =
      objectUrl;

    setAudioPreviewUrl(
      objectUrl
    );

    return () => {
      if (
        audioObjectUrlRef.current ===
        objectUrl
      ) {
        URL.revokeObjectURL(
          objectUrl
        );

        audioObjectUrlRef.current =
          null;
      }
    };
  }, [audioFile]);

  /*
   * ------------------------------------------------------------
   * AUDIO PLAYBACK
   * ------------------------------------------------------------
   */

  const stopAudioPlayback =
    useCallback(() => {
      const audio =
        audioPreviewRef.current;

      if (audio) {
        audio.pause();
        audio.currentTime = 0;
      }

      setIsPlaying(false);
    }, []);

  const toggleAudioPlayback =
    useCallback(
      async () => {
        const audio =
          audioPreviewRef.current;

        if (
          !audio ||
          !audioPreviewUrl
        ) {
          return;
        }

        try {
          if (audio.paused) {
            await audio.play();
            setIsPlaying(true);
          } else {
            audio.pause();
            setIsPlaying(false);
          }
        } catch (error) {
          console.warn(
            'Audio playback failed:',
            error
          );

          setIsPlaying(false);
        }
      },
      [audioPreviewUrl]
    );

  useEffect(() => {
    const audio =
      audioPreviewRef.current;

    if (!audio) {
      return;
    }

    const handleEnded = () => {
      setIsPlaying(false);
      audio.currentTime = 0;
    };

    const handlePause = () => {
      setIsPlaying(false);
    };

    audio.addEventListener(
      'ended',
      handleEnded
    );

    audio.addEventListener(
      'pause',
      handlePause
    );

    return () => {
      audio.removeEventListener(
        'ended',
        handleEnded
      );

      audio.removeEventListener(
        'pause',
        handlePause
      );
    };
  }, [audioPreviewUrl]);

  /*
   * ------------------------------------------------------------
   * CLOSE AUTH MODAL AFTER SUCCESSFUL LOGIN / REGISTRATION
   * ------------------------------------------------------------
   */

  useEffect(() => {
    if (
      user &&
      showAuthModal
    ) {
      setShowAuthModal(false);
    }
  }, [
    user,
    showAuthModal,
  ]);

  /*
   * ------------------------------------------------------------
   * CLOSE DASHBOARD AFTER LOGOUT
   * ------------------------------------------------------------
   */

  useEffect(() => {
    if (
      !user &&
      showDashboard
    ) {
      setShowDashboard(false);
      setOpenReferralCard(false);
    }
  }, [
    user,
    showDashboard,
  ]);

  /*
   * ------------------------------------------------------------
   * OPEN REFERRAL CARD AFTER DASHBOARD LOADS
   * ------------------------------------------------------------
   */

  useEffect(() => {
    if (
      showDashboard &&
      openReferralCard &&
      user
    ) {
      const timer =
        window.setTimeout(
          () => {
            document
              .getElementById(
                'referral-program'
              )
              ?.scrollIntoView({
                behavior: 'smooth',
                block: 'center',
              });

            setOpenReferralCard(
              false
            );
          },
          0
        );

      return () =>
        window.clearTimeout(
          timer
        );
    }
  }, [
    showDashboard,
    openReferralCard,
    user,
  ]);

  /*
   * ------------------------------------------------------------
   * AUTHENTICATION PROTECTION
   * ------------------------------------------------------------
   */

  const requireAuthentication =
    useCallback(() => {
      if (!user) {
        setShowLoginRequiredModal(
          true
        );

        return false;
      }

      return true;
    }, [user]);

  const openLogin = () => {
    setShowLoginRequiredModal(
      false
    );

    setShowAuthModal(true);
  };

  /*
   * ------------------------------------------------------------
   * SAMPLE DATA
   * ------------------------------------------------------------
   *
   * These are still used for the two built-in demo buttons.
   * They intentionally do NOT go to the ML API because their
   * File objects contain placeholder data rather than real audio.
   * ------------------------------------------------------------
   */

  const generateSampleWaveform =
    useCallback(
      (isFake: boolean) => {
        const points = 200;

        const data: number[] =
          [];

        for (
          let i = 0;
          i < points;
          i++
        ) {
          const t =
            i / points;

          let value =
            Math.sin(
              t *
                Math.PI *
                8
            ) *
              0.5 +
            Math.sin(
              t *
                Math.PI *
                20
            ) *
              0.2 +
            Math.sin(
              t *
                Math.PI *
                50
            ) *
              0.1;

          if (isFake) {
            value +=
              Math.sin(
                t *
                  Math.PI *
                  100
              ) *
              0.05;

            value *=
              0.95 +
              Math.random() *
                0.1;
          } else {
            value *=
              0.8 +
              Math.random() *
                0.4;
          }

          data.push(value);
        }

        return data;
      },
      []
    );

  const generateSampleSpectrogram =
    useCallback(
      (isFake: boolean) => {
        const frames = 60;
        const bins = 40;

        const data: number[][] =
          [];

        for (
          let f = 0;
          f < frames;
          f++
        ) {
          const frame: number[] =
            [];

          for (
            let b = 0;
            b < bins;
            b++
          ) {
            let value =
              Math.exp(
                -(
                  (b - 15) **
                  2
                ) /
                  80
              ) *
              0.8;

            value +=
              Math.sin(
                f * 0.1 +
                  b * 0.2
              ) *
              0.15;

            if (isFake) {
              if (
                f % 8 <
                2
              ) {
                value += 0.1;
              }

              value +=
                Math.random() *
                0.05;
            } else {
              value +=
                Math.random() *
                0.15;

              value *=
                0.7 +
                Math.sin(
                  f * 0.05
                ) *
                  0.3;
            }

            frame.push(
              Math.max(
                0,
                Math.min(
                  1,
                  value
                )
              )
            );
          }

          data.push(frame);
        }

        return data;
      },
      []
    );

  /*
   * ------------------------------------------------------------
   * VERDICT PRESENTATION
   * ------------------------------------------------------------
   */

  const getVerdictPresentation =
    useCallback(
      (
        result: AnalysisResult
      ) => {
        switch (
          result.verdict
        ) {
          case 'AI-Generated':
            return {
              label:
                'AI-Generated Voice',
              textClass:
                'text-[#a855f7]',
              dotClass:
                'bg-[#a855f7]',
            };

          case 'Possibly Manipulated':
            return {
              label:
                'Possibly Manipulated',
              textClass:
                'text-amber-400',
              dotClass:
                'bg-amber-400',
            };

          case 'Inconclusive':
            return {
              label:
                'Inconclusive',
              textClass:
                'text-gray-300',
              dotClass:
                'bg-gray-400',
            };

          case 'Real Voice':
          default:
            return {
              label:
                'Real Voice',
              textClass:
                'text-[#00ff88]',
              dotClass:
                'bg-[#00ff88]',
            };
        }
      },
      []
    );

  /*
   * ------------------------------------------------------------
   * AUDIO PROCESSING
   * ------------------------------------------------------------
   *
   * IMPORTANT:
   *
   * 1. Real uploaded audio:
   *      React -> FastAPI -> Random Forest
   *
   * 2. Recorded audio:
   *      React -> FastAPI -> Random Forest
   *
   * 3. Built-in demo samples:
   *      Existing forced demo result
   *
   * Browser audio decoding is used only for the waveform,
   * spectrogram and duration. The ML prediction does NOT depend
   * on successful browser decoding.
   * ------------------------------------------------------------
   */

  const processAudioFile =
    useCallback(
      async (
        file: File,
        forceResult?: 'real' | 'fake'
      ) => {
        /*
         * Require login.
         */

        if (!user) {
          setShowLoginRequiredModal(
            true
          );

          return;
        }

        /*
         * Stop currently playing audio.
         */

        stopAudioPlayback();

        /*
         * Reset current scan state.
         */

        setIsAnalyzing(true);

        setCurrentResult(
          null
        );

        setAudioFile(file);

        /*
         * These variables are used only for the browser
         * visualization and scan history duration.
         */

        let audioContext:
          AudioContext | null =
          null;

        let audioBuffer:
          AudioBuffer | null =
          null;

        let audioDuration = 0;

        try {
          /*
           * ======================================================
           * STEP 1 — BROWSER AUDIO VISUALIZATION
           * ======================================================
           *
           * This section is intentionally independent from the
           * ML prediction.
           *
           * If browser decoding fails for M4A, WebM, FLAC, etc.,
           * we still continue to the ML API below.
           * ======================================================
           */

          try {
            const arrayBuffer =
              await file.arrayBuffer();

            if (
              arrayBuffer.byteLength <
              100
            ) {
              throw new Error(
                'Audio data is empty or invalid.'
              );
            }

            audioContext =
              new AudioContext();

            audioBuffer =
              await audioContext.decodeAudioData(
                arrayBuffer
              );

            audioDuration =
              audioBuffer.duration;

            const channelData =
              audioBuffer.getChannelData(
                0
              );

            /*
             * ====================================================
             * WAVEFORM
             * ====================================================
             */

            const samples = 200;

            const blockSize =
              Math.max(
                1,
                Math.floor(
                  channelData.length /
                    samples
                )
              );

            const waveform: number[] =
              [];

            for (
              let i = 0;
              i < samples;
              i++
            ) {
              let sum = 0;

              for (
                let j = 0;
                j < blockSize;
                j++
              ) {
                const index =
                  i *
                    blockSize +
                  j;

                if (
                  index <
                  channelData.length
                ) {
                  sum += Math.abs(
                    channelData[
                      index
                    ]
                  );
                }
              }

              waveform.push(
                sum /
                  blockSize
              );
            }

            setWaveformData(
              waveform
            );

            /*
             * ====================================================
             * SPECTROGRAM
             * ====================================================
             */

            const specFrames =
              60;

            const specBins =
              40;

            const spectrogram: number[][] =
              [];

            const frameSize =
              Math.max(
                1,
                Math.floor(
                  channelData.length /
                    specFrames
                )
              );

            for (
              let f = 0;
              f <
              specFrames;
              f++
            ) {
              const frame: number[] =
                [];

              for (
                let b = 0;
                b <
                specBins;
                b++
              ) {
                const start =
                  f *
                    frameSize +
                  Math.floor(
                    (b *
                      frameSize) /
                      specBins
                  );

                const end =
                  start +
                  Math.max(
                    1,
                    Math.floor(
                      frameSize /
                        specBins
                    )
                  );

                let energy = 0;

                let count = 0;

                for (
                  let s = start;
                  s <
                  Math.min(
                    end,
                    channelData.length
                  );
                  s++
                ) {
                  energy +=
                    channelData[
                      s
                    ] *
                    channelData[
                      s
                    ];

                  count++;
                }

                const rms =
                  count >
                  0
                    ? Math.sqrt(
                        energy /
                          count
                      )
                    : 0;

                frame.push(
                  Math.min(
                    1,
                    rms * 10
                  )
                );
              }

              spectrogram.push(
                frame
              );
            }

            setSpectrogramData(
              spectrogram
            );

          } catch (
            browserAudioError
          ) {
            /*
             * Browser decoding failed.
             *
             * This does NOT mean ML analysis failed.
             *
             * The original File is still available and will be
             * sent directly to FastAPI.
             */

            console.warn(
              'Browser audio visualization could not decode this file. Continuing with ML API:',
              browserAudioError
            );

            const isFake =
              forceResult ===
              'fake';

            setWaveformData(
              generateSampleWaveform(
                isFake
              )
            );

            setSpectrogramData(
              generateSampleSpectrogram(
                isFake
              )
            );
          }

          /*
           * ======================================================
           * STEP 2 — RESULT GENERATION
           * ======================================================
           */

          let result:
            AnalysisResult;

          /*
           * ------------------------------------------------------
           * BUILT-IN SAMPLE BUTTONS
           * ------------------------------------------------------
           *
           * Preserve existing demo behaviour.
           */

          if (forceResult) {
            /*
             * If the sample was forced as real/fake,
             * use the existing analysis engine.
             */

            if (audioBuffer) {
              result =
                await analyzeAudio(
                  audioBuffer,
                  file.name,
                  forceResult
                );
            } else {
              result =
                await analyzeAudio(
                  null,
                  file.name,
                  forceResult
                );
            }

            console.log(
              '=== VOXFORENSICS DEMO SAMPLE ==='
            );

            console.log(
              'Filename:',
              file.name
            );

            console.log(
              'Verdict:',
              result.verdict
            );

            console.log(
              'Confidence:',
              result.confidence
            );

            console.log(
              'Features:',
              result.features
            );

            console.log(
              '================================'
            );

          } else {
            /*
             * ----------------------------------------------------
             * REAL AUDIO
             * ----------------------------------------------------
             *
             * Send the ORIGINAL File to the FastAPI backend.
             *
             * The browser does not perform the actual ML
             * prediction.
             * ----------------------------------------------------
             */

            console.log(
              '========================================'
            );

            console.log(
              'VOXFORENSICS — ML ANALYSIS STARTED'
            );

            console.log(
              'Filename:',
              file.name
            );

            console.log(
              'File type:',
              file.type
            );

            console.log(
              'File size:',
              file.size
            );

            console.log(
              'Sending to:',
              'http://127.0.0.1:8000/predict'
            );

            console.log(
              '========================================'
            );

            /*
             * Call FastAPI.
             */

            const mlResult =
              await predictWithML(
                file
              );

            console.log(
              '=== VOXFORENSICS ML API RESPONSE ==='
            );

            console.log(
              mlResult
            );

            console.log(
              'Real probability:',
              mlResult.real_probability
            );

            console.log(
              'Fake probability:',
              mlResult.fake_probability
            );

            console.log(
              'API verdict:',
              mlResult.verdict
            );

            console.log(
              '====================================='
            );

            /*
             * ----------------------------------------------------
             * DETERMINE VERDICT
             * ----------------------------------------------------
             *
             * The API returns probabilities as percentages:
             *
             * real_probability = 63.2
             * fake_probability = 36.8
             *
             * Therefore we do NOT multiply these values by 100.
             */

            const isFake =
              Number(
                mlResult.fake_probability
              ) >=
              Number(
                mlResult.real_probability
              );

            /*
             * ----------------------------------------------------
             * BROWSER FEATURE VALUES
             * ----------------------------------------------------
             *
             * These are used only for the existing feature cards
             * in the frontend.
             *
             * The Random Forest prediction itself is performed
             * entirely by Python using the 45 trained features.
             */

            let rmsEnergy = 0;

            let pitchVariation = 0;

            let spectralCentroid = 0;

            let zeroCrossingRate = 0;

            if (audioBuffer) {
              try {
                const channelData =
                  audioBuffer.getChannelData(
                    0
                  );

                /*
                 * ----------------------------------------------
                 * RMS ENERGY
                 * ----------------------------------------------
                 */

                let rmsSum = 0;

                let rmsCount = 0;

                for (
                  let i = 0;
                  i <
                  channelData.length;
                  i++
                ) {
                  rmsSum +=
                    channelData[
                      i
                    ] *
                    channelData[
                      i
                    ];

                  rmsCount++;
                }

                if (
                  rmsCount >
                  0
                ) {
                  rmsEnergy =
                    Math.sqrt(
                      rmsSum /
                        rmsCount
                    );
                }

                /*
                 * ----------------------------------------------
                 * ZERO CROSSING RATE
                 * ----------------------------------------------
                 */

                let crossings = 0;

                for (
                  let i = 1;
                  i <
                  channelData.length;
                  i++
                ) {
                  if (
                    (
                      channelData[
                        i
                      ] >= 0 &&
                      channelData[
                        i - 1
                      ] < 0
                    ) ||
                    (
                      channelData[
                        i
                      ] < 0 &&
                      channelData[
                        i - 1
                      ] >= 0
                    )
                  ) {
                    crossings++;
                  }
                }

                if (
                  channelData.length >
                  1
                ) {
                  zeroCrossingRate =
                    crossings /
                    (
                      channelData.length -
                      1
                    );
                }

                /*
                 * ----------------------------------------------
                 * SIMPLE SPECTRAL CENTROID DISPLAY VALUE
                 * ----------------------------------------------
                 *
                 * This is only for the existing UI.
                 */

                const fftSize =
                  1024;

                const usableLength =
                  Math.min(
                    channelData.length,
                    fftSize
                  );

                if (
                  usableLength >
                  1
                ) {
                  let weightedFrequency =
                    0;

                  let totalMagnitude =
                    0;

                  for (
                    let k = 1;
                    k <
                    usableLength /
                      2;
                    k++
                  ) {
                    const frequency =
                      (
                        k /
                        usableLength
                      ) *
                      audioBuffer.sampleRate;

                    const magnitude =
                      Math.abs(
                        channelData[
                          k
                        ]
                      );

                    weightedFrequency +=
                      frequency *
                      magnitude;

                    totalMagnitude +=
                      magnitude;
                  }

                  if (
                    totalMagnitude >
                    0
                  ) {
                    spectralCentroid =
                      weightedFrequency /
                      totalMagnitude;
                  }
                }

                /*
                 * ----------------------------------------------
                 * PITCH DISPLAY
                 * ----------------------------------------------
                 *
                 * The Python ML model performs its own pitch
                 * extraction. For the existing frontend card,
                 * we retain a lightweight browser-side indicator.
                 */

                pitchVariation =
                  zeroCrossingRate;

              } catch (
                featureError
              ) {
                console.warn(
                  'Frontend feature display calculation failed:',
                  featureError
                );
              }
            }

            /*
             * ----------------------------------------------------
             * CONVERT ML RESPONSE TO EXISTING RESULT FORMAT
             * ----------------------------------------------------
             */

            result = {
              verdict:
                isFake
                  ? 'AI-Generated'
                  : 'Real Voice',

              confidence:
                Math.max(
                  Number(
                    mlResult.real_probability
                  ),
                  Number(
                    mlResult.fake_probability
                  )
                ),

              features: {
                rmsEnergy: mlResult.features.rmsEnergy,
                pitchVariation: mlResult.features.pitchMean,
                spectralCentroid: mlResult.features.spectralCentroid,
                zeroCrossingRate: mlResult.features.zeroCrossingRate,
              },

              explanation:
                isFake
                  ? `The Random Forest machine learning model classified this recording as AI-generated with ${Number(
                      mlResult.fake_probability
                    ).toFixed(
                      1
                    )}% model probability.`
                  : `The Random Forest machine learning model classified this recording as a real voice with ${Number(
                      mlResult.real_probability
                    ).toFixed(
                      1
                    )}% model probability.`,
            };

            /*
             * ----------------------------------------------------
             * FINAL ML DIAGNOSTICS
             * ----------------------------------------------------
             */

            console.log(
              '=== VOXFORENSICS ML DIAGNOSTICS ==='
            );

            console.log(
              'Filename:',
              file.name
            );

            console.log(
              'Verdict:',
              result.verdict
            );

            console.log(
              'Confidence:',
              result.confidence
            );

            console.log(
              'Real probability:',
              mlResult.real_probability
            );

            console.log(
              'Fake probability:',
              mlResult.fake_probability
            );

            console.log(
              'Browser feature display values:',
              result.features
            );

            console.log(
              '==================================='
            );
          }

          /*
           * ======================================================
           * STEP 3 — UPDATE UI
           * ======================================================
           */

          setCurrentResult(
            result
          );

          /*
           * ======================================================
           * STEP 4 — SAVE TO HISTORY
           * ======================================================
           */

          saveScanToHistory(
            file.name,
            result,
            audioDuration ||
              0
          );

          setHistory(
            getScanHistory()
          );

          /*
           * Close AudioContext if browser decoding succeeded.
           */

          if (audioContext) {
            try {
              await audioContext.close();
            } catch {
              // Ignore AudioContext close errors.
            }

            audioContext =
              null;
          }

        } catch (error) {
          /*
           * ======================================================
           * ML / PROCESSING ERROR
           * ======================================================
           */

          console.error(
            'VoxForensics analysis failed:',
            error
          );

          /*
           * Built-in demo samples can still use their original
           * fallback behaviour.
           */

          if (forceResult) {
            const isFake =
              forceResult ===
              'fake';

            setWaveformData(
              generateSampleWaveform(
                isFake
              )
            );

            setSpectrogramData(
              generateSampleSpectrogram(
                isFake
              )
            );

            const result =
              await analyzeAudio(
                null,
                file.name,
                forceResult
              );

            setCurrentResult(
              result
            );

            saveScanToHistory(
              file.name,
              result,
              3 +
                Math.random() *
                  7
            );

            setHistory(
              getScanHistory()
            );

          } else {
            /*
             * REAL AUDIO ERROR
             *
             * Do NOT use the old heuristic detector as a silent
             * replacement for the ML model.
             *
             * Instead show an Inconclusive result so the user
             * knows the ML analysis did not complete.
             */

            setWaveformData(
              generateSampleWaveform(
                false
              )
            );

            setSpectrogramData(
              generateSampleSpectrogram(
                false
              )
            );

            const errorResult:
              AnalysisResult = {
              verdict:
                'Inconclusive',

              confidence: 0,

              features: {
                rmsEnergy: 0,
                pitchVariation: 0,
                spectralCentroid: 0,
                zeroCrossingRate: 0,
              },

              explanation:
                'The machine learning analysis could not be completed. Please make sure the VoxForensics ML backend is running and the audio file is supported.',
            };

            setCurrentResult(
              errorResult
            );

            /*
             * Print the actual error in the browser console.
             */

            console.error(
              'ML backend analysis failed:',
              error
            );
          }

        } finally {
          /*
           * Always stop the loading indicator.
           */

          setIsAnalyzing(false);

          /*
           * Safety cleanup for AudioContext.
           */

          if (audioContext) {
            try {
              await audioContext.close();
            } catch {
              // Ignore close errors.
            }

            audioContext =
              null;
          }
        }
      },
      [
        user,
        generateSampleWaveform,
        generateSampleSpectrogram,
        stopAudioPlayback,
      ]
    );

  /*
   * ------------------------------------------------------------
   * FILE UPLOAD
   * ------------------------------------------------------------
   */

  const handleFileUpload = (
    e: React.ChangeEvent<HTMLInputElement>
  ) => {
    if (
      !requireAuthentication()
    ) {
      e.target.value =
        '';

      return;
    }

    const file =
      e.target.files?.[0];

    if (file) {
      /*
       * Basic frontend size protection.
       */

      const maxSize =
        25 *
        1024 *
        1024;

      if (
        file.size >
        maxSize
      ) {
        alert(
          'The selected audio file is larger than 25 MB.'
        );

        e.target.value =
          '';

        return;
      }

      setRecordedAudioFile(
        null
      );

      processAudioFile(
        file
      );
    }

    e.target.value =
      '';
  };

  /*
   * ------------------------------------------------------------
   * SAMPLE REAL
   * ------------------------------------------------------------
   */

  const handleSampleReal =
    () => {
      if (
        !requireAuthentication()
      ) {
        return;
      }

      const sampleFile =
        new File(
          ['sample'],
          'sample_real_speech.wav',
          {
            type: 'audio/wav',
          }
        );

      setRecordedAudioFile(
        null
      );

      processAudioFile(
        sampleFile,
        'real'
      );
    };

  /*
   * ------------------------------------------------------------
   * SAMPLE FAKE
   * ------------------------------------------------------------
   */

  const handleSampleFake =
    () => {
      if (
        !requireAuthentication()
      ) {
        return;
      }

      const sampleFile =
        new File(
          ['sample'],
          'sample_deepfake_voice.wav',
          {
            type: 'audio/wav',
          }
        );

      setRecordedAudioFile(
        null
      );

      processAudioFile(
        sampleFile,
        'fake'
      );
    };

  /*
   * ------------------------------------------------------------
   * RECORDING — SIMULATED WAVEFORM
   * ------------------------------------------------------------
   */

  const drawSimulatedWaveform =
    useCallback(() => {
      const canvas =
        simulatedCanvasRef.current;

      if (!canvas) {
        return;
      }

      const ctx =
        canvas.getContext(
          '2d'
        );

      if (!ctx) {
        return;
      }

      const width =
        canvas.clientWidth ||
        300;

      const height =
        canvas.clientHeight ||
        40;

      const pixelRatio =
        window.devicePixelRatio ||
        1;

      canvas.width =
        width *
        pixelRatio;

      canvas.height =
        height *
        pixelRatio;

      ctx.setTransform(
        pixelRatio,
        0,
        0,
        pixelRatio,
        0,
        0
      );

      ctx.clearRect(
        0,
        0,
        width,
        height
      );

      const time =
        Date.now() *
        0.001;

      ctx.lineWidth = 2;

      ctx.strokeStyle =
        '#00d4ff';

      ctx.shadowColor =
        '#00d4ff';

      ctx.shadowBlur = 6;

      ctx.beginPath();

      for (
        let x = 0;
        x < width;
        x++
      ) {
        const t =
          x / width;

        const y =
          height / 2 +
          Math.sin(
            t * 10 +
              time * 3
          ) *
            12 +
          Math.sin(
            t * 22 +
              time * 5
          ) *
            7 +
          Math.sin(
            t * 38 +
              time * 7
          ) *
            3;

        if (x === 0) {
          ctx.moveTo(
            x,
            y
          );
        } else {
          ctx.lineTo(
            x,
            y
          );
        }
      }

      ctx.stroke();

      ctx.shadowBlur = 0;

      simAnimRef.current =
        requestAnimationFrame(
          drawSimulatedWaveform
        );
    }, []);

  /*
   * ------------------------------------------------------------
   * RECORDING — LIVE WAVEFORM
   * ------------------------------------------------------------
   */

  const drawLiveWaveform =
    useCallback(() => {
      const canvas =
        simulatedCanvasRef.current;

      const analyser =
        analyserRef.current;

      if (
        !canvas ||
        !analyser
      ) {
        return;
      }

      const ctx =
        canvas.getContext(
          '2d'
        );

      if (!ctx) {
        return;
      }

      const width =
        canvas.clientWidth ||
        300;

      const height =
        canvas.clientHeight ||
        40;

      const pixelRatio =
        window.devicePixelRatio ||
        1;

      canvas.width =
        width *
        pixelRatio;

      canvas.height =
        height *
        pixelRatio;

      ctx.setTransform(
        pixelRatio,
        0,
        0,
        pixelRatio,
        0,
        0
      );

      const bufferLength =
        analyser.frequencyBinCount;

      const dataArray =
        new Uint8Array(
          bufferLength
        );

      analyser.getByteTimeDomainData(
        dataArray
      );

      ctx.clearRect(
        0,
        0,
        width,
        height
      );

      ctx.lineWidth = 2;

      ctx.strokeStyle =
        '#00d4ff';

      ctx.shadowColor =
        '#00d4ff';

      ctx.shadowBlur = 6;

      ctx.beginPath();

      const sliceWidth =
        width /
        bufferLength;

      let x = 0;

      for (
        let i = 0;
        i < bufferLength;
        i++
      ) {
        const v =
          dataArray[i] /
          128;

        const y =
          (v * height) /
          2;

        if (i === 0) {
          ctx.moveTo(
            x,
            y
          );
        } else {
          ctx.lineTo(
            x,
            y
          );
        }

        x += sliceWidth;
      }

      ctx.lineTo(
        width,
        height / 2
      );

      ctx.stroke();

      ctx.shadowBlur = 0;

      animationRef.current =
        requestAnimationFrame(
          drawLiveWaveform
        );
    }, []);

  /*
   * ------------------------------------------------------------
   * START RECORDING
   * ------------------------------------------------------------
   */

  const startRecording =
    async () => {
      if (
        !requireAuthentication()
      ) {
        return;
      }

      /*
       * Stop any existing playback.
       */

      stopAudioPlayback();

      /*
       * Reset previous recording/result.
       */

      setRecordedAudioFile(
        null
      );

      setCurrentResult(
        null
      );

      setRecordingTime(
        0
      );

      /*
       * --------------------------------------------------------
       * BROWSER FALLBACK
       * --------------------------------------------------------
       */

      if (
        !navigator.mediaDevices ||
        !navigator.mediaDevices
          .getUserMedia
      ) {
        setIsRecording(
          true
        );

        drawSimulatedWaveform();

        recordingIntervalRef.current =
          setInterval(
            () => {
              setRecordingTime(
                (time) => {
                  const next =
                    time + 1;

                  if (
                    next >=
                    60
                  ) {
                    window.setTimeout(
                      () => {
                        stopRecording();
                      },
                      0
                    );
                  }

                  return next;
                }
              );
            },
            1000
          );

        return;
      }

      try {
        /*
         * Request microphone access.
         */

        const stream =
          await navigator.mediaDevices.getUserMedia(
            {
              audio: true,
            }
          );

        streamRef.current =
          stream;

        /*
         * Create MediaRecorder.
         */

        const mediaRecorder =
          new MediaRecorder(
            stream
          );

        mediaRecorderRef.current =
          mediaRecorder;

        audioChunksRef.current =
          [];

        /*
         * Receive audio chunks.
         */

        mediaRecorder.ondataavailable =
          (
            event: BlobEvent
          ) => {
            if (
              event.data.size >
              0
            ) {
              audioChunksRef.current.push(
                event.data
              );
            }
          };

        /*
         * Recording stopped.
         */

        mediaRecorder.onstop =
          async () => {
            /*
             * Stop microphone tracks.
             */

            if (
              streamRef.current
            ) {
              streamRef.current
                .getTracks()
                .forEach(
                  (
                    track
                  ) =>
                    track.stop()
                );

              streamRef.current =
                null;
            }

            /*
             * Create audio file.
             */

            if (
              audioChunksRef
                .current
                .length >
              0
            ) {
              const audioBlob =
                new Blob(
                  audioChunksRef.current,
                  {
                    type:
                      mediaRecorder.mimeType ||
                      'audio/webm',
                  }
                );

              const file =
                new File(
                  [audioBlob],
                  `recording_${Date.now()}.webm`,
                  {
                    type:
                      audioBlob.type ||
                      'audio/webm',
                  }
                );

              /*
               * Keep reference for playback UI.
               */

              setRecordedAudioFile(
                file
              );

              /*
               * Send recording to ML API.
               */

              await processAudioFile(
                file
              );
            }

            audioChunksRef.current =
              [];
          };

        /*
         * MediaRecorder error.
         */

        mediaRecorder.onerror =
          (
            event
          ) => {
            console.error(
              'MediaRecorder error:',
              event
            );

            if (
              recordingIntervalRef.current
            ) {
              clearInterval(
                recordingIntervalRef.current
              );

              recordingIntervalRef.current =
                undefined;
            }

            setIsRecording(
              false
            );
          };

        /*
         * Live microphone visualization.
         */

        const audioContext =
          new AudioContext();

        audioContextRef.current =
          audioContext;

        const source =
          audioContext.createMediaStreamSource(
            stream
          );

        const analyser =
          audioContext.createAnalyser();

        analyser.fftSize =
          2048;

        analyser.smoothingTimeConstant =
          0.8;

        analyserRef.current =
          analyser;

        source.connect(
          analyser
        );

        drawLiveWaveform();

        /*
         * Start recording.
         */

        mediaRecorder.start(
          100
        );

        setIsRecording(
          true
        );

        setRecordingTime(
          0
        );

        /*
         * Recording timer.
         */

        recordingIntervalRef.current =
          setInterval(
            () => {
              setRecordingTime(
                (time) => {
                  const next =
                    time + 1;

                  /*
                   * Automatically stop after 60 seconds.
                   */

                  if (
                    next >=
                    60
                  ) {
                    window.setTimeout(
                      () => {
                        if (
                          mediaRecorderRef.current &&
                          mediaRecorderRef
                            .current
                            .state !==
                            'inactive'
                        ) {
                          mediaRecorderRef.current.stop();
                        }

                        if (
                          recordingIntervalRef.current
                        ) {
                          clearInterval(
                            recordingIntervalRef.current
                          );

                          recordingIntervalRef.current =
                            undefined;
                        }

                        setIsRecording(
                          false
                        );
                      },
                      0
                    );
                  }

                  return next;
                }
              );
            },
            1000
          );

      } catch (error) {
        /*
         * Microphone permission or initialization failed.
         */

        console.error(
          'Microphone access failed:',
          error
        );

        /*
         * Use existing simulated recording UI.
         */

        setIsRecording(
          true
        );

        setRecordingTime(
          0
        );

        drawSimulatedWaveform();

        recordingIntervalRef.current =
          setInterval(
            () => {
              setRecordingTime(
                (time) => {
                  const next =
                    time + 1;

                  if (
                    next >=
                    60
                  ) {
                    window.setTimeout(
                      () => {
                        stopRecording();
                      },
                      0
                    );
                  }

                  return next;
                }
              );
            },
            1000
          );
      }
    };

  /*
   * ------------------------------------------------------------
   * STOP RECORDING
   * ------------------------------------------------------------
   */

  const stopRecording =
    () => {
      const hasRealRecorder =
        mediaRecorderRef.current !==
        null;

      /*
       * Stop actual MediaRecorder.
       */

      if (
        mediaRecorderRef.current &&
        mediaRecorderRef.current
          .state !==
          'inactive'
      ) {
        mediaRecorderRef.current.stop();
      }

      mediaRecorderRef.current =
        null;

      /*
       * Stop waveform animations.
       */

      cancelAnimationFrame(
        animationRef.current
      );

      cancelAnimationFrame(
        simAnimRef.current
      );

      /*
       * Stop timer.
       */

      if (
        recordingIntervalRef.current
      ) {
        clearInterval(
          recordingIntervalRef.current
        );

        recordingIntervalRef.current =
          undefined;
      }

      /*
       * Close microphone AudioContext.
       */

      if (
        audioContextRef.current
      ) {
        audioContextRef.current
          .close()
          .catch(() => {});

        audioContextRef.current =
          null;
      }

      analyserRef.current =
        null;

      /*
       * Stop microphone stream.
       */

      if (
        streamRef.current
      ) {
        streamRef.current
          .getTracks()
          .forEach(
            (
              track
            ) =>
              track.stop()
          );

        streamRef.current =
          null;
      }

      setIsRecording(
        false
      );

      /*
       * --------------------------------------------------------
       * SIMULATED RECORDING FALLBACK
       * --------------------------------------------------------
       *
       * This remains only for browsers where a real MediaRecorder
       * could not be created.
       *
       * It will not produce a real ML result because the file is
       * not actual audio.
       */

      if (
        !hasRealRecorder
      ) {
        const simulatedFile =
          new File(
            ['simulated recording'],
            `simulated_recording_${Date.now()}.webm`,
            {
              type: 'audio/webm',
            }
          );

        setRecordedAudioFile(
          simulatedFile
        );

        processAudioFile(
          simulatedFile
        );
      }
    };

  /*
   * ------------------------------------------------------------
   * FORMAT TIME
   * ------------------------------------------------------------
   */

  const formatTime =
    (
      seconds: number
    ) => {
      const minutes =
        Math.floor(
          seconds / 60
        );

      const remainingSeconds =
        seconds % 60;

      return `${minutes
        .toString()
        .padStart(
          2,
          '0'
        )}:${remainingSeconds
        .toString()
        .padStart(
          2,
          '0'
        )}`;
    };

  /*
   * ------------------------------------------------------------
   * DASHBOARD
   * ------------------------------------------------------------
   */

  /*
   * Do not allow dashboard access until the authenticated
   * user has accepted consent.
   */

  if (
    user &&
    !hasConsented
  ) {
    return null;
  }

  if (
    showDashboard &&
    user
  ) {
    if (
      user.role ===
      'admin'
    ) {
      return (
        <AdminDashboard
          currentUser={user}
          onLogout={() => {
            logout();
            setShowDashboard(
              false
            );
          }}
          onBack={() =>
            setShowDashboard(
              false
            )
          }
        />
      );
    }

    return (
      <UserDashboard
        currentUser={user}
        onLogout={() => {
          logout();
          setShowDashboard(
            false
          );
        }}
        onBack={() =>
          setShowDashboard(
            false
          )
        }
      />
    );
  }

  /*
   * ------------------------------------------------------------
   * UI
   * ------------------------------------------------------------
   */

  return (
    <div className="min-h-screen relative">

      <LiveBackground />

      {/* ================================================== */}
      {/* NAVIGATION */}
      {/* ================================================== */}

      <nav className="border-b border-[#1a2a4a]/50 bg-[#050914]/80 backdrop-blur-md sticky top-0 z-50">

        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">

          <div className="flex items-center gap-3">

            <div className="w-9 h-9 rounded-full bg-[#060d1f] border border-[#00d4ff]/50 flex items-center justify-center shadow-[0_0_14px_rgba(0,212,255,0.35)]">

              <i className="fa-solid fa-wave-square text-[#00d4ff] text-sm"></i>

            </div>

            <div>

              <h2 className="text-lg font-bold tracking-tight text-white leading-tight">
                VoxForensics
              </h2>

              <p className="text-[10px] text-gray-400 tracking-widest uppercase leading-tight">
                Deepfake Audio Detector
              </p>

            </div>

          </div>

          <div className="hidden md:flex items-center gap-1">

            {(
              [
                'home',
                'scanner',
                'refer',
                'history',
                'about',
              ] as TabType[]
            ).map(
              (
                tab
              ) => (
                <button
                  key={tab}
                  onClick={() => {

                    /*
                     * REFER
                     */

                    if (
                      tab ===
                      'refer'
                    ) {
                      if (
                        !requireAuthentication()
                      ) {
                        return;
                      }

                      setOpenReferralCard(
                        true
                      );

                      setShowDashboard(
                        true
                      );

                      return;
                    }

                    /*
                     * HISTORY
                     */

                    if (
                      tab ===
                      'history'
                    ) {
                      if (
                        !requireAuthentication()
                      ) {
                        return;
                      }

                      setActiveTab(
                        'history'
                      );

                      return;
                    }

                    setActiveTab(
                      tab
                    );
                  }}
                  className={`px-4 py-1.5 rounded-full text-sm font-medium transition flex items-center gap-2 border ${
                    activeTab ===
                    tab
                      ? 'text-white bg-[#0d1830]/90 border-[#23406e] shadow-[0_0_12px_rgba(0,212,255,0.12)]'
                      : 'text-gray-400 hover:text-white border-transparent'
                  }`}
                >

                  <i
                    className={`text-xs ${
                      tab ===
                      'home'
                        ? 'fa-solid fa-house'
                        : tab ===
                          'scanner'
                        ? 'fa-solid fa-expand'
                        : tab ===
                          'refer'
                        ? 'fa-solid fa-gift'
                        : tab ===
                          'history'
                        ? 'fa-solid fa-clock-rotate-left'
                        : 'fa-solid fa-circle-info'
                    } ${
                      activeTab ===
                      tab
                        ? 'text-[#00d4ff]'
                        : ''
                    }`}
                  ></i>

                  {tab
                    .charAt(
                      0
                    )
                    .toUpperCase() +
                    tab.slice(
                      1
                    )}

                </button>
              )
            )}

          </div>

          {/* AUTH NAVIGATION */}

          <div className="flex items-center gap-3">

            {user ? (
              <>

                <button
                  onClick={() =>
                    setShowDashboard(
                      true
                    )
                  }
                  className="text-sm text-gray-400 hover:text-white transition"
                >

                  <i className="fa-solid fa-user mr-2"></i>

                  {user.name}

                </button>

                <button
                  onClick={() => {
                    logout();

                    setShowDashboard(
                      false
                    );
                  }}
                  className="text-sm text-gray-400 hover:text-white transition"
                >
                  <i className="fa-solid fa-right-from-bracket"></i>
                </button>

              </>
            ) : (

              <button
                onClick={() =>
                  setShowAuthModal(
                    true
                  )
                }
                className="px-4 py-2 rounded-lg text-sm font-semibold text-white bg-gradient-to-r from-[#8b5cf6]/70 via-[#6366f1]/70 to-[#22d3ee]/70 border border-[#8b5cf6]/30 shadow-[0_0_16px_rgba(139,92,246,0.2)] hover:brightness-110 hover:shadow-[0_0_22px_rgba(139,92,246,0.35)] transition-all duration-300"
              >

                <i className="fa-solid fa-right-to-bracket mr-2"></i>

                Login / Sign Up

              </button>

            )}

          </div>

        </div>

      </nav>

      {/* ================================================== */}
      {/* MAIN */}
      {/* ================================================== */}

      <main className="max-w-7xl mx-auto px-6 pt-12 pb-20 relative z-10">

        {/* ================================================== */}
        {/* HOME */}
        {/* ================================================== */}

        {activeTab ===
          'home' && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-start">

            {/* LEFT */}

            <div className="space-y-8">

              <div className="relative inline-flex rounded-full p-[1px] bg-gradient-to-r from-[#00d4ff] via-[#a855f7] to-[#00ff88] shadow-[0_0_22px_rgba(0,212,255,0.3)]">

                <div className="inline-flex items-center gap-2 rounded-full bg-[#050914]/75 px-4 py-1.5 backdrop-blur-sm">

                  <span className="text-xs font-semibold tracking-widest text-[#00d4ff] uppercase">
                    AI • AUDIO • FORENSICS
                  </span>

                </div>

              </div>

              <div>

                <h2 className="text-5xl sm:text-6xl lg:text-7xl font-extrabold tracking-tight leading-none mb-3">

                  <span className="hero-vox">
                    Vox
                  </span>

                  <span className="hero-fore">
                    Forensics
                  </span>

                </h2>

                <h3 className="text-sm md:text-base tracking-[0.3em] text-gray-300 font-light uppercase drop-shadow-md">
                  Deepfake Audio Detector
                </h3>

              </div>

              <p className="text-2xl md:text-3xl font-bold text-white leading-snug drop-shadow-md">

                Is that voice{' '}

                <span className="text-[#00c66a]">
                  Real
                </span>

                , or{' '}

                <span className="text-[#8b45cd]">
                  AI-generated
                </span>{' '}

                ?

              </p>

              <p className="text-gray-300 text-sm leading-relaxed max-w-lg drop-shadow">
                Upload a voice recording and VoxForensics will extract acoustic features and evaluate the clip using a trained machine learning model.
              </p>

              <div className="flex flex-wrap gap-4">

                <button
                  onClick={
                    handleSampleReal
                  }
                  className="bg-gradient-to-r from-emerald-600 to-emerald-200 to-teal-400 text-white font-semibold py-3 px-6 rounded-xl flex items-center gap-3 transition-all duration-300 shadow-[0_0_24px_rgba(16,185,129,0.3)] hover:shadow-[0_0_32px_rgba(16,185,129,0.45)] hover:brightness-110"
                >

                  <span className="w-6 h-6 rounded-full bg-black/20 flex items-center justify-center">

                    <i className="fa-solid fa-play text-[10px]"></i>

                  </span>

                  Try sample: Real voice

                </button>

                <button
                  onClick={
                    handleSampleFake
                  }
                  className="bg-gradient-to-r from-violet-700 to-purple-200 to-purple-500 text-white font-semibold py-3 px-6 rounded-xl flex items-center gap-3 transition-all duration-300 shadow-[0_0_24px_rgba(168,85,247,0.3)] hover:shadow-[0_0_32px_rgba(168,85,247,0.45)] hover:brightness-110"
                >

                  <span className="w-6 h-6 rounded-full bg-black/20 flex items-center justify-center">

                    <i className="fa-solid fa-robot text-[11px]"></i>

                  </span>

                  Try sample: AI clone

                </button>

              </div>

              <p className="text-xs text-gray-400 tracking-wide drop-shadow">
                Explore voice authenticity through acoustic analysis and machine learning.
              </p>

              <div className="pt-8 border-t border-[#1a2a4a]/50">

                <p className="text-xs font-semibold tracking-widest text-gray-400 mb-4 uppercase drop-shadow">
                  What you get in every scan
                </p>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">

                  <div className="bg-emerald-500/[0.07] border border-emerald-500/30 p-4 rounded-xl backdrop-blur-sm">

                    <i className="fa-solid fa-shield-halved text-[#00ff88] text-lg mb-2"></i>

                    <h4 className="text-sm font-semibold text-white mb-1">
                      Real vs Fake Verdict
                    </h4>

                    <p className="text-[11px] text-gray-400 leading-relaxed">
                      Machine learning classification based on extracted audio characteristics.
                    </p>

                  </div>

                  <div className="bg-cyan-500/[0.07] border border-cyan-500/30 p-4 rounded-xl backdrop-blur-sm">

                    <i className="fa-solid fa-chart-simple text-[#00d4ff] text-lg mb-2"></i>

                    <h4 className="text-sm font-semibold text-white mb-1">
                      Feature Evidence
                    </h4>

                    <p className="text-[11px] text-gray-400 leading-relaxed">
                      RMS energy, pitch, spectral centroid, ZCR and chroma-based analysis.
                    </p>

                  </div>

                  <div className="bg-purple-500/[0.07] border border-purple-500/30 p-4 rounded-xl backdrop-blur-sm">

                    <i className="fa-solid fa-wave-square text-[#a855f7] text-lg mb-2"></i>

                    <h4 className="text-sm font-semibold text-white mb-1">
                      Visual Proof
                    </h4>

                    <p className="text-[11px] text-gray-400 leading-relaxed">
                      Waveform and spectrogram visualization of the recording.
                    </p>

                  </div>

                  <div className="bg-amber-500/[0.07] border border-amber-500/30 p-4 rounded-xl backdrop-blur-sm">

                    <i className="fa-solid fa-brain text-amber-400 text-lg mb-2"></i>

                    <h4 className="text-sm font-semibold text-white mb-1">
                      Academic Prototype
                    </h4>

                    <p className="text-[11px] text-gray-400 leading-relaxed">
                      Built for research, demonstration and academic learning.
                    </p>

                  </div>

                </div>

              </div>

            </div>

            {/* RIGHT */}

            <div className="space-y-4 relative">

              <div className="absolute -top-20 -right-20 w-96 h-96 bg-[#a855f7]/10 rounded-full blur-3xl pointer-events-none"></div>

              {/* UPLOAD CARD */}

              <div className="glass-panel p-4 relative z-10 bg-[#050914]/35 backdrop-blur-sm">

                <h3 className="text-sm font-semibold text-white mb-3">
                  Scan a Voice Recording
                </h3>

                <div
                  ref={dropZoneRef}
                  onClick={() => {
                    if (
                      !requireAuthentication()
                    ) {
                      return;
                    }

                    homeFileInputRef.current?.click();
                  }}
                  className="border-2 border-dashed border-[#1a2a4a] hover:border-[#00d4ff]/50 rounded-xl p-5 flex flex-col items-center justify-center text-center cursor-pointer transition-colors duration-300 bg-[#050914]/30 mb-3 group"
                >

                  <input
                    ref={
                      homeFileInputRef
                    }
                    type="file"
                    accept="audio/*"
                    className="hidden"
                    onChange={
                      handleFileUpload
                    }
                  />

                  <div className="w-10 h-10 rounded-full bg-[#1a2a4a]/30 flex items-center justify-center mb-2 group-hover:bg-[#00d4ff]/10 transition">

                    <i className="fa-solid fa-cloud-arrow-up text-lg text-gray-400 group-hover:text-[#00d4ff] transition"></i>

                  </div>

                  <p className="text-xs font-medium text-gray-300 mb-1">
                    Drag & drop an audio file here
                  </p>

                  <p className="text-[11px] text-gray-500">
                    or click to upload
                  </p>

                </div>

                <div className="flex flex-wrap items-center justify-center gap-1.5 mb-2">

                  <span className="px-2.5 py-1 rounded-full bg-[#1a2a4a]/50 text-[9px] font-semibold tracking-wider text-gray-400">
                    .wav
                  </span>

                  <span className="px-2.5 py-1 rounded-full bg-[#1a2a4a]/50 text-[9px] font-semibold tracking-wider text-gray-400">
                    .mp3
                  </span>

                  <span className="px-2.5 py-1 rounded-full bg-[#1a2a4a]/50 text-[9px] font-semibold tracking-wider text-gray-400">
                    .m4a
                  </span>

                  <span className="px-2.5 py-1 rounded-full bg-[#1a2a4a]/50 text-[9px] font-semibold tracking-wider text-gray-400">
                    .flac
                  </span>

                </div>

                <p className="text-[10px] text-gray-500 text-center">
                  Max size: 25 MB
                </p>

                {audioFile && (

                  <div className="mt-3 p-2.5 bg-[#00d4ff]/10 border border-[#00d4ff]/30 rounded-lg">

                    <div className="flex items-center justify-between">

                      <div className="flex items-center gap-2 overflow-hidden">

                        <i className="fa-solid fa-file-audio text-[#00d4ff] text-sm"></i>

                        <div className="truncate">

                          <p className="text-[11px] font-semibold text-white truncate">
                            {audioFile.name}
                          </p>

                          <p className="text-[9px] text-gray-400">
                            {(
                              audioFile.size /
                              (1024 *
                                1024)
                            ).toFixed(
                              2
                            )}{' '}
                            MB
                          </p>

                        </div>

                      </div>

                      <button
                        onClick={(e) => {
                          e.stopPropagation();

                          stopAudioPlayback();

                          setAudioFile(
                            null
                          );

                          setRecordedAudioFile(
                            null
                          );

                          setCurrentResult(
                            null
                          );

                          setWaveformData(
                            []
                          );

                          setSpectrogramData(
                            []
                          );
                        }}
                        className="text-gray-400 hover:text-white transition ml-2"
                        aria-label="Remove audio"
                      >

                        <i className="fa-solid fa-xmark text-sm"></i>

                      </button>

                    </div>

                    {/* UPLOADED / CURRENT AUDIO PLAYBACK */}

                    {audioPreviewUrl && (

                      <div className="mt-2 pt-2 border-t border-[#00d4ff]/20 flex items-center gap-2">

                        <button
                          onClick={(e) => {
                            e.stopPropagation();

                            toggleAudioPlayback();
                          }}
                          className="w-8 h-8 rounded-full bg-[#00d4ff]/15 border border-[#00d4ff]/40 flex items-center justify-center text-[#00d4ff] hover:text-white hover:bg-[#00d4ff]/25 transition"
                          aria-label={
                            isPlaying
                              ? 'Pause audio'
                              : 'Play audio'
                          }
                        >

                          <i
                            className={`fa-solid ${
                              isPlaying
                                ? 'fa-pause'
                                : 'fa-play'
                            } text-[10px]`}
                          ></i>

                        </button>

                        <div className="flex-1">

                          <p className="text-[10px] text-gray-300">
                            {recordedAudioFile
                              ? 'Recorded audio'
                              : 'Uploaded audio'}
                          </p>

                          <p className="text-[9px] text-gray-500">
                            {isPlaying
                              ? 'Playing...'
                              : 'Click play to preview'}
                          </p>

                        </div>

                        <audio
                          ref={
                            audioPreviewRef
                          }
                          src={
                            audioPreviewUrl
                          }
                          preload="metadata"
                          className="hidden"
                        />

                      </div>

                    )}

                  </div>

                )}

              </div>

              {/* MICROPHONE CARD */}

              <div className="glass-panel p-4 relative z-10 bg-[#050914]/35 backdrop-blur-sm">

                <h3 className="text-sm font-semibold text-white mb-3">
                  Or Record from Your Microphone
                </h3>

                <div className="flex items-center gap-4 mb-3">

                  <button
                    onClick={
                      isRecording
                        ? stopRecording
                        : startRecording
                    }
                    className={`w-12 h-12 rounded-full border-2 flex items-center justify-center transition-all duration-300 flex-shrink-0 ${
                      isRecording
                        ? 'recording-pulse border-red-500 text-red-500'
                        : 'border-[#a855f7]/70 text-[#d8b4fe] hover:text-white hover:border-[#a855f7] shadow-[0_0_16px_rgba(168,85,247,0.3)]'
                    }`}
                  >

                    <i
                      className={`fa-solid ${
                        isRecording
                          ? 'fa-stop'
                          : 'fa-microphone'
                      } text-lg`}
                    ></i>

                  </button>

                  <div className="flex-1 h-10 flex items-center justify-center gap-1">

                    {isRecording ? (

                      <canvas
                        ref={
                          simulatedCanvasRef
                        }
                        className="w-full h-full"
                      />

                    ) : (

                      <>

                        {[
                          2, 4, 6, 8, 6,
                          4, 2, 5, 7, 3,
                          6, 4,
                        ].map(
                          (
                            h,
                            i
                          ) => (

                            <div
                              key={i}
                              className="visualizer-bar"
                              style={{
                                height: `${h * 3}px`,
                              }}
                            ></div>

                          )
                        )}

                      </>

                    )}

                  </div>

                </div>

                <p className="text-[10px] text-gray-400 leading-relaxed mb-3">
                  Speak a full sentence (2-5 seconds is ideal), then stop to analyze.
                </p>

                <button
                  onClick={
                    isRecording
                      ? stopRecording
                      : startRecording
                  }
                  className={`w-full font-semibold py-2.5 rounded-lg text-sm flex items-center justify-center gap-2 transition-all duration-300 ${
                    isRecording
                      ? 'bg-gradient-to-r from-red-500/80 to-red-500/80 hover:from-red-500 hover:to-red-500 text-white'
                      : 'bg-gradient-to-r from-[#8b5cf6]/50 via-[#6366f1]/50 to-[#22d3ee]/50 text-white shadow-[0_0_20px_rgba(139,92,246,0.35)] hover:shadow-[0_0_28px_rgba(139,92,246,0.5)] hover:brightness-125'
                  }`}
                >

                  <i
                    className={`fa-solid ${
                      isRecording
                        ? 'fa-stop'
                        : 'fa-circle'
                    } text-[10px]`}
                  ></i>

                  {isRecording
                    ? `Stop Recording (${formatTime(
                        recordingTime
                      )})`
                    : 'Start Recording'}

                </button>

                {/* RECORDED AUDIO PLAYBACK */}

                {recordedAudioFile &&
                  !isRecording &&
                  audioPreviewUrl && (

                    <div className="mt-3 p-3 rounded-lg bg-[#a855f7]/10 border border-[#a855f7]/30">

                      <div className="flex items-center gap-3">

                        <button
                          onClick={
                            toggleAudioPlayback
                          }
                          className="w-9 h-9 rounded-full bg-[#a855f7]/20 border border-[#a855f7]/50 flex items-center justify-center text-[#d8b4fe] hover:text-white hover:bg-[#a855f7]/30 transition flex-shrink-0"
                          aria-label={
                            isPlaying
                              ? 'Pause recorded audio'
                              : 'Play recorded audio'
                          }
                        >

                          <i
                            className={`fa-solid ${
                              isPlaying
                                ? 'fa-pause'
                                : 'fa-play'
                            } text-[10px]`}
                          ></i>

                        </button>

                        <div className="min-w-0 flex-1">

                          <p className="text-[11px] font-semibold text-white">
                            Recording complete
                          </p>

                          <p className="text-[9px] text-gray-400 truncate">
                            {
                              recordedAudioFile.name
                            }
                          </p>

                        </div>

                        <span className="text-[9px] text-[#a855f7] font-semibold uppercase tracking-wider">
                          {isPlaying
                            ? 'Playing'
                            : 'Ready'}
                        </span>

                      </div>

                    </div>

                  )}

              </div>

              {/* ANALYZING */}

              {isAnalyzing && (

                <div className="glass-panel p-6 relative z-10 fade-in">

                  <h3 className="text-base font-semibold text-white mb-4">
                    Analysis Results
                  </h3>

                  <div className="flex flex-col items-center justify-center py-8">

                    <div className="loader mb-4"></div>

                    <p className="text-sm text-gray-400">
                      Extracting features & classifying...
                    </p>

                  </div>

                </div>

              )}

              {/* RESULTS */}

              {currentResult &&
                !isAnalyzing && (

                  <div className="glass-panel p-6 relative z-10 fade-in">

                    <h3 className="text-base font-semibold text-white mb-4">
                      Analysis Results
                    </h3>

                    <div className="space-y-4">

                      {(() => {

                        const verdictPresentation =
                          getVerdictPresentation(
                            currentResult
                          );

                        return (

                          <div className="flex items-center justify-between p-4 bg-[#1a2a4a]/30 rounded-xl border border-[#1a2a4a]">

                            <div>

                              <p className="text-xs text-gray-400 uppercase tracking-wider mb-1">
                                Verdict
                              </p>

                              <p
                                className={`text-2xl font-bold ${verdictPresentation.textClass}`}
                              >
                                {
                                  verdictPresentation.label
                                }
                              </p>

                            </div>

                            <div className="text-right">

                              <p className="text-xs text-gray-400 uppercase tracking-wider mb-1">
                                Confidence
                              </p>

                              <p
                                className={`text-2xl font-bold ${verdictPresentation.textClass}`}
                              >
                                {currentResult.confidence.toFixed(
                                  1
                                )}
                                %
                              </p>

                            </div>

                          </div>

                        );

                      })()}

                      <div className="flex items-center justify-between">

                        <p className="text-[10px] text-gray-500 uppercase tracking-widest">
                          Acoustic Features
                        </p>

                        <span className="px-2 py-0.5 rounded-full bg-[#00d4ff]/10 border border-[#00d4ff]/30 text-[9px] font-semibold tracking-wider text-[#00d4ff]">
                          45 FEATURES ANALYZED
                        </span>

                      </div>

                      <div className="grid grid-cols-2 gap-2">

                        <div className="bg-[#050914]/50 p-2 rounded-lg text-center">

                          <p className="text-[10px] text-gray-500 uppercase">
                            RMS Energy
                          </p>

                          <p className="text-xs font-mono text-[#00d4ff]">
                            {currentResult.features.rmsEnergy.toFixed(
                              3
                            )}
                          </p>

                        </div>

                        <div className="bg-[#050914]/50 p-2 rounded-lg text-center">

                          <p className="text-[10px] text-gray-500 uppercase">
                            Pitch
                          </p>

                          <p className="text-xs font-mono text-[#00d4ff]">
                            {currentResult.features.pitchVariation.toFixed(
                              1
                            )}{' '}
                            Hz
                          </p>

                        </div>

                        <div className="bg-[#050914]/50 p-2 rounded-lg text-center">

                          <p className="text-[10px] text-gray-500 uppercase">
                            Centroid
                          </p>

                          <p className="text-xs font-mono text-[#00d4ff]">
                            {(
                              currentResult
                                .features
                                .spectralCentroid /
                              1000
                            ).toFixed(
                              1
                            )}{' '}
                            kHz
                          </p>

                        </div>

                        <div className="bg-[#050914]/50 p-2 rounded-lg text-center">

                          <p className="text-[10px] text-gray-500 uppercase">
                            ZCR
                          </p>

                          <p className="text-xs font-mono text-[#00d4ff]">
                            {currentResult.features.zeroCrossingRate.toFixed(
                              3
                            )}
                          </p>

                        </div>

                      </div>

                      {currentResult.explanation && (

                        <div className="p-3 rounded-lg bg-[#050914]/50 border border-[#1a2a4a]">

                          <p className="text-[10px] text-gray-500 uppercase tracking-wider mb-1">
                            Analysis Summary
                          </p>

                          <p className="text-xs text-gray-400 leading-relaxed">
                            {
                              currentResult.explanation
                            }
                          </p>

                        </div>

                      )}

                      <div className="waveform-container">

                        <canvas
                          ref={
                            canvasWaveformRef
                          }
                          className="w-full h-16"
                        />

                      </div>

                      <button
                        onClick={() => {
                          stopAudioPlayback();

                          setCurrentResult(
                            null
                          );

                          setAudioFile(
                            null
                          );

                          setRecordedAudioFile(
                            null
                          );

                          setWaveformData(
                            []
                          );

                          setSpectrogramData(
                            []
                          );
                        }}
                        className="w-full text-xs text-[#00d4ff] hover:text-white transition underline"
                      >
                        Scan another file
                      </button>

                    </div>

                  </div>

                )}

            </div>

          </div>
        )}

        {/* ================================================== */}
        {/* SCANNER */}
        {/* ================================================== */}

        {activeTab ===
          'scanner' && (

          <div className="max-w-4xl mx-auto space-y-6">

            {/* HEADER */}

            <div>

              <h2 className="text-3xl font-bold text-white">
                Advanced Scanner
              </h2>

              <p className="text-gray-400 text-sm mt-2">
                Upload an audio file for detailed machine learning analysis.
              </p>

            </div>

            {/* UPLOAD CARD */}

            <div className="glass-panel p-6">

              <input
                ref={
                  scannerFileInputRef
                }
                type="file"
                accept="audio/*"
                className="hidden"
                onChange={
                  handleFileUpload
                }
              />

              <div
                onClick={() => {
                  if (
                    !requireAuthentication()
                  ) {
                    return;
                  }

                  scannerFileInputRef.current?.click();
                }}
                className="border-2 border-dashed border-[#1a2a4a] hover:border-[#00d4ff]/50 rounded-xl p-8 flex flex-col items-center justify-center text-center cursor-pointer transition-colors duration-300 bg-[#050914]/30 group"
              >

                <div className="w-14 h-14 rounded-full bg-[#1a2a4a]/30 flex items-center justify-center mb-4 group-hover:bg-[#00d4ff]/10 transition">

                  <i className="fa-solid fa-cloud-arrow-up text-2xl text-gray-400 group-hover:text-[#00d4ff] transition"></i>

                </div>

                <p className="text-sm font-medium text-gray-300 mb-1">
                  Upload an audio file
                </p>

                <p className="text-xs text-gray-500">
                  Click here to select a recording
                </p>

                <div className="flex flex-wrap items-center justify-center gap-2 mt-4">

                  <span className="px-3 py-1 rounded-full bg-[#1a2a4a]/50 text-[10px] font-semibold tracking-wider text-gray-400">
                    .wav
                  </span>

                  <span className="px-3 py-1 rounded-full bg-[#1a2a4a]/50 text-[10px] font-semibold tracking-wider text-gray-400">
                    .mp3
                  </span>

                  <span className="px-3 py-1 rounded-full bg-[#1a2a4a]/50 text-[10px] font-semibold tracking-wider text-gray-400">
                    .m4a
                  </span>

                  <span className="px-3 py-1 rounded-full bg-[#1a2a4a]/50 text-[10px] font-semibold tracking-wider text-gray-400">
                    .flac
                  </span>

                </div>

                <p className="text-[10px] text-gray-500 mt-3">
                  Maximum file size: 25 MB
                </p>

              </div>

              {/* SELECTED FILE */}

              {audioFile && (

                <div className="mt-4 p-3 bg-[#00d4ff]/10 border border-[#00d4ff]/30 rounded-lg">

                  <div className="flex items-center justify-between">

                    <div className="flex items-center gap-3 overflow-hidden">

                      <div className="w-9 h-9 rounded-lg bg-[#00d4ff]/10 flex items-center justify-center flex-shrink-0">

                        <i className="fa-solid fa-file-audio text-[#00d4ff]"></i>

                      </div>

                      <div className="truncate">

                        <p className="text-sm font-semibold text-white truncate">
                          {
                            audioFile.name
                          }
                        </p>

                        <p className="text-[10px] text-gray-400">
                          {(
                            audioFile.size /
                            (1024 *
                              1024)
                          ).toFixed(
                            2
                          )}{' '}
                          MB
                        </p>

                      </div>

                    </div>

                    <button
                      onClick={(e) => {
                        e.stopPropagation();

                        stopAudioPlayback();

                        setAudioFile(
                          null
                        );

                        setRecordedAudioFile(
                          null
                        );

                        setCurrentResult(
                          null
                        );

                        setWaveformData(
                          []
                        );

                        setSpectrogramData(
                          []
                        );
                      }}
                      className="w-8 h-8 rounded-full flex items-center justify-center text-gray-400 hover:text-white hover:bg-white/5 transition ml-3"
                      aria-label="Remove audio"
                    >

                      <i className="fa-solid fa-xmark"></i>

                    </button>

                  </div>

                  {/* AUDIO PREVIEW */}

                  {audioPreviewUrl && (

                    <div className="mt-3 pt-3 border-t border-[#00d4ff]/20 flex items-center gap-3">

                      <button
                        onClick={(e) => {
                          e.stopPropagation();

                          toggleAudioPlayback();
                        }}
                        className="w-9 h-9 rounded-full bg-[#00d4ff]/15 border border-[#00d4ff]/40 flex items-center justify-center text-[#00d4ff] hover:text-white hover:bg-[#00d4ff]/25 transition flex-shrink-0"
                        aria-label={
                          isPlaying
                            ? 'Pause audio'
                            : 'Play audio'
                        }
                      >

                        <i
                          className={`fa-solid ${
                            isPlaying
                              ? 'fa-pause'
                              : 'fa-play'
                          } text-[10px]`}
                        ></i>

                      </button>

                      <div className="flex-1 min-w-0">

                        <p className="text-[11px] text-gray-300">
                          {recordedAudioFile
                            ? 'Recorded audio'
                            : 'Uploaded audio'}
                        </p>

                        <p className="text-[9px] text-gray-500">
                          {isPlaying
                            ? 'Playing...'
                            : 'Click play to preview'}
                        </p>

                      </div>

                      <audio
                        ref={
                          audioPreviewRef
                        }
                        src={
                          audioPreviewUrl
                        }
                        preload="metadata"
                        className="hidden"
                      />

                    </div>

                  )}

                </div>

              )}

            </div>

            {/* ANALYZING */}

            {isAnalyzing && (

              <div className="glass-panel p-6 fade-in">

                <div className="flex items-center justify-between mb-6">

                  <div>

                    <h3 className="text-base font-semibold text-white">
                      Analysis in Progress
                    </h3>

                    <p className="text-xs text-gray-500 mt-1">
                      Processing the selected audio file...
                    </p>

                  </div>

                  <div className="w-9 h-9 rounded-full bg-[#00d4ff]/10 border border-[#00d4ff]/30 flex items-center justify-center">

                    <i className="fa-solid fa-wave-square text-[#00d4ff]"></i>

                  </div>

                </div>

                <div className="flex flex-col items-center justify-center py-8">

                  <div className="loader mb-5"></div>

                  <p className="text-sm text-gray-300">
                    Extracting features & classifying...
                  </p>

                  <p className="text-xs text-gray-500 mt-2">
                    Please wait while VoxForensics analyzes the recording.
                  </p>

                </div>

              </div>

            )}

            {/* RESULTS */}

            {currentResult &&
              !isAnalyzing && (

              <div className="glass-panel p-6 fade-in">

                <div className="flex items-center justify-between mb-5">

                  <div>

                    <h3 className="text-lg font-semibold text-white">
                      Analysis Results
                    </h3>

                    <p className="text-xs text-gray-500 mt-1">
                      Machine learning analysis of the selected recording
                    </p>

                  </div>

                  <div className="w-10 h-10 rounded-full bg-[#00d4ff]/10 border border-[#00d4ff]/30 flex items-center justify-center">

                    <i className="fa-solid fa-chart-line text-[#00d4ff]"></i>

                  </div>

                </div>

                <div className="space-y-5">

                  {/* VERDICT */}

                  {(() => {

                    const verdictPresentation =
                      getVerdictPresentation(
                        currentResult
                      );

                    return (

                      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 p-5 bg-[#1a2a4a]/30 rounded-xl border border-[#1a2a4a]">

                        <div>

                          <p className="text-[10px] text-gray-400 uppercase tracking-widest mb-1">
                            Verdict
                          </p>

                          <p
                            className={`text-2xl sm:text-3xl font-bold ${verdictPresentation.textClass}`}
                          >
                            {
                              verdictPresentation.label
                            }
                          </p>

                        </div>

                        <div className="sm:text-right">

                          <p className="text-[10px] text-gray-400 uppercase tracking-widest mb-1">
                            Confidence
                          </p>

                          <p
                            className={`text-2xl sm:text-3xl font-bold ${verdictPresentation.textClass}`}
                          >
                            {currentResult.confidence.toFixed(
                              1
                            )}
                            %
                          </p>

                        </div>

                      </div>

                    );

                  })()}

                  {/* FEATURES */}

                  <div>

                    <div className="flex items-center justify-between mb-3">

                      <p className="text-[10px] text-gray-500 uppercase tracking-widest">
                        Acoustic Features
                      </p>

                      <span className="px-2.5 py-0.5 rounded-full bg-[#00d4ff]/10 border border-[#00d4ff]/30 text-[9px] font-semibold tracking-wider text-[#00d4ff]">
                        45 FEATURES ANALYZED
                      </span>

                    </div>

                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">

                      <div className="bg-[#050914]/50 p-3 rounded-lg border border-[#1a2a4a] text-center">

                        <p className="text-[10px] text-gray-500 uppercase">
                          RMS Energy
                        </p>

                        <p className="text-sm font-mono text-[#00d4ff] mt-1">
                          {currentResult.features.rmsEnergy.toFixed(
                            3
                          )}
                        </p>

                      </div>

                      <div className="bg-[#050914]/50 p-3 rounded-lg border border-[#1a2a4a] text-center">

                        <p className="text-[10px] text-gray-500 uppercase">
                          Pitch
                        </p>

                        <p className="text-sm font-mono text-[#00d4ff] mt-1">
                          {currentResult.features.pitchVariation.toFixed(
                            1
                          )}{' '}
                          Hz
                        </p>

                      </div>

                      <div className="bg-[#050914]/50 p-3 rounded-lg border border-[#1a2a4a] text-center">

                        <p className="text-[10px] text-gray-500 uppercase">
                          Centroid
                        </p>

                        <p className="text-sm font-mono text-[#00d4ff] mt-1">
                          {(
                            currentResult
                              .features
                              .spectralCentroid /
                            1000
                          ).toFixed(
                            1
                          )}{' '}
                          kHz
                        </p>

                      </div>

                      <div className="bg-[#050914]/50 p-3 rounded-lg border border-[#1a2a4a] text-center">

                        <p className="text-[10px] text-gray-500 uppercase">
                          ZCR
                        </p>

                        <p className="text-sm font-mono text-[#00d4ff] mt-1">
                          {currentResult.features.zeroCrossingRate.toFixed(
                            3
                          )}
                        </p>

                      </div>

                    </div>

                  </div>

                  {/* EXPLANATION */}

                  {currentResult.explanation && (

                    <div className="p-4 rounded-lg bg-[#050914]/50 border border-[#1a2a4a]">

                      <p className="text-[10px] text-gray-500 uppercase tracking-widest mb-2">
                        Analysis Summary
                      </p>

                      <p className="text-sm text-gray-400 leading-relaxed">
                        {
                          currentResult.explanation
                        }
                      </p>

                    </div>

                  )}

                  {/* WAVEFORM */}

                  <div>

                    <p className="text-[10px] text-gray-500 uppercase tracking-widest mb-2">
                      Audio Waveform
                    </p>

                    <div className="waveform-container">

                      <canvas
                        ref={
                          canvasWaveformRef
                        }
                        className="w-full h-20"
                      />

                    </div>

                  </div>

                  {/* ACTION */}

                  <button
                    onClick={() => {
                      stopAudioPlayback();

                      setCurrentResult(
                        null
                      );

                      setAudioFile(
                        null
                      );

                      setRecordedAudioFile(
                        null
                      );

                      setWaveformData(
                        []
                      );

                      setSpectrogramData(
                        []
                      );
                    }}
                    className="w-full py-3 text-sm font-medium text-[#00d4ff] border border-[#00d4ff]/20 rounded-lg hover:bg-[#00d4ff]/5 hover:text-white transition"
                  >

                    <i className="fa-solid fa-rotate-right mr-2"></i>

                    Scan Another File

                  </button>

                </div>

              </div>

            )}

          </div>

        )}

        {/* ================================================== */}
        {/* HISTORY */}
        {/* ================================================== */}

        {activeTab ===
          'history' && (

          <div className="max-w-4xl mx-auto">

            <div className="flex items-center justify-between mb-6">

              <h2 className="text-3xl font-bold text-white">
                Scan History
              </h2>

              {history.length >
                0 && (

                <button
                  onClick={() => {
                    clearHistory();

                    setHistory(
                      []
                    );
                  }}
                  className="text-xs text-red-400 hover:text-red-300 transition"
                >

                  <i className="fa-solid fa-trash mr-1"></i>

                  Clear History

                </button>

              )}

            </div>

            <div className="glass-panel p-6">

              {history.length ===
              0 ? (

                <p className="text-gray-400 text-center py-8">
                  No scans yet. Start analyzing audio files!
                </p>

              ) : (

                <div className="space-y-3">

                  {history.map(
                    (
                      record
                    ) => {

                      const verdictPresentation =
                        getVerdictPresentation(
                          record.result
                        );

                      return (

                        <div
                          key={
                            record.id
                          }
                          className="batch-item flex items-center justify-between"
                        >

                          <div className="flex items-center gap-3">

                            <span
                              className={`w-3 h-3 rounded-full ${verdictPresentation.dotClass}`}
                            ></span>

                            <div>

                              <p className="text-white text-sm font-medium">
                                {
                                  record.filename
                                }
                              </p>

                              <p className="text-gray-500 text-xs">
                                {new Date(
                                  record.timestamp
                                ).toLocaleString()}
                              </p>

                              <p
                                className={`text-[10px] ${verdictPresentation.textClass}`}
                              >
                                {
                                  verdictPresentation.label
                                }
                              </p>

                            </div>

                          </div>

                          <div className="flex items-center gap-4">

                            <span className="text-gray-400 text-xs">

                              {record.duration.toFixed(
                                1
                              )}

                              s

                            </span>

                            <span
                              className={`text-xs font-bold ${verdictPresentation.textClass}`}
                            >

                              {record.result.confidence.toFixed(
                                0
                              )}

                              %

                            </span>

                          </div>

                        </div>

                      );

                    }
                  )}

                </div>

              )}

            </div>

          </div>

        )}

        {/* ================================================== */}
        {/* ABOUT */}
        {/* ================================================== */}

        {activeTab ===
          'about' && (

          <div className="max-w-4xl mx-auto space-y-6">

            <h2 className="text-3xl font-bold text-white">
              About VoxForensics
            </h2>

            <div className="glass-panel p-6 space-y-4">

              <p className="text-gray-300 leading-relaxed">
                VoxForensics is an academic prototype for detecting potentially synthetic or manipulated audio using acoustic features and a trained machine learning classification model.
              </p>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">

                <div className="feature-card">

                  <i className="fa-solid fa-shield-halved text-[#00ff88] text-2xl mb-3"></i>

                  <h3 className="text-lg font-semibold text-white mb-2">
                    Audio Analysis
                  </h3>

                  <p className="text-sm text-gray-400">
                    Audio recordings are sent to the VoxForensics machine learning API, where acoustic and spectral features are extracted for classification.
                  </p>

                </div>

                <div className="feature-card">

                  <i className="fa-solid fa-wave-square text-[#a855f7] text-2xl mb-3"></i>

                  <h3 className="text-lg font-semibold text-white mb-2">
                    Machine Learning
                  </h3>

                  <p className="text-sm text-gray-400">
                    A trained Random Forest model evaluates extracted audio features and returns real and AI-generated probability values.
                  </p>

                </div>

              </div>

              <button
                onClick={() =>
                  setShowTestPanel(
                    true
                  )
                }
                className="neon-btn neon-btn-outline mt-4"
              >

                <i className="fa-solid fa-flask mr-2"></i>

                Run E2E Tests

              </button>

            </div>

          </div>

        )}

      </main>

      {/* ================================================== */}
      {/* FOOTER */}
      {/* ================================================== */}

      <footer className="border-t border-[#1a2a4a]/50 bg-[#050914]/80 py-6 mt-12 relative z-10">

        <div className="max-w-7xl mx-auto px-6 flex flex-col md:flex-row justify-between items-center gap-4 text-xs text-gray-500">

          <div className="flex items-center gap-2">

            <span className="font-bold text-white">
              VoxForensics
            </span>

            <span>
              BCA 3rd Year Project
            </span>

            <span>
              |
            </span>

            <span>
              AI Voice Deepfake Detection
            </span>

          </div>

          <div className="flex items-center gap-4">

            <span>
              Research
            </span>

            <span>
              •
            </span>

            <span>
              Learn
            </span>

            <span>
              •
            </span>

            <span>
              Build
            </span>

          </div>

        </div>

      </footer>

      {/* ================================================== */}
      {/* E2E TEST PANEL */}
      {/* ================================================== */}

      {showTestPanel && (

        <E2ETestPanel
          onClose={() =>
            setShowTestPanel(
              false
            )
          }
        />

      )}

      {/* ================================================== */}
      {/* LOGIN / SIGN UP MODAL */}
      {/* ================================================== */}

      {showAuthModal &&
        !user && (

          <div
            className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm"
            onClick={() =>
              setShowAuthModal(
                false
              )
            }
          >

            <div
              className="relative w-full max-w-md max-h-[90vh] overflow-y-auto"
              onClick={(e) =>
                e.stopPropagation()
              }
            >

              {/* CLOSE BUTTON */}

              <button
                onClick={() =>
                  setShowAuthModal(
                    false
                  )
                }
                className="absolute top-3 right-3 z-20 w-9 h-9 rounded-full bg-[#0d1830]/90 border border-[#1e3a5f] flex items-center justify-center text-gray-400 hover:text-white hover:border-[#00d4ff]/50 transition"
                aria-label="Close"
              >

                <i className="fa-solid fa-xmark text-sm"></i>

              </button>

              <AuthSystem />

            </div>

          </div>

        )}

      {/* ================================================== */}
      {/* LOGIN REQUIRED MODAL */}
      {/* ================================================== */}

      {showLoginRequiredModal &&
        !user && (

          <div
            className="fixed inset-0 z-[110] flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm"
            onClick={() =>
              setShowLoginRequiredModal(
                false
              )
            }
          >

            <div
              className="glass-panel w-full max-w-sm p-6 relative"
              onClick={(e) =>
                e.stopPropagation()
              }
            >

              <button
                onClick={() =>
                  setShowLoginRequiredModal(
                    false
                  )
                }
                className="absolute top-3 right-3 w-8 h-8 rounded-full bg-[#0d1830]/90 border border-[#1e3a5f] flex items-center justify-center text-gray-400 hover:text-white transition"
                aria-label="Close"
              >

                <i className="fa-solid fa-xmark text-sm"></i>

              </button>

              <div className="text-center pt-2">

                <div className="w-14 h-14 mx-auto mb-4 rounded-full bg-gradient-to-br from-[#8b5cf6] to-[#22d3ee] flex items-center justify-center shadow-[0_0_24px_rgba(139,92,246,0.3)]">

                  <i className="fa-solid fa-lock text-white text-xl"></i>

                </div>

                <h3 className="text-xl font-bold text-white mb-2">
                  Login / Register Required
                </h3>

                <p className="text-sm text-gray-400 leading-relaxed mb-6">
                  Please login or create an account to use this feature.
                </p>

                <button
                  onClick={
                    openLogin
                  }
                  className="w-full px-4 py-3 rounded-lg text-sm font-semibold text-white bg-gradient-to-r from-[#8b5cf6]/80 via-[#6366f1]/80 to-[#22d3ee]/80 border border-[#8b5cf6]/30 shadow-[0_0_18px_rgba(139,92,246,0.25)] hover:brightness-110 hover:shadow-[0_0_24px_rgba(139,92,246,0.4)] transition-all duration-300"
                >

                  <i className="fa-solid fa-right-to-bracket mr-2"></i>

                  Login / Sign Up

                </button>

              </div>

            </div>

          </div>

        )}

    </div>
  );
}

/*
 * ============================================================
 * APP ROOT
 * ============================================================
 */

export default function App() {
  return (
    <AuthProvider>

      <ConsentProvider>

        <AppContent />

      </ConsentProvider>

    </AuthProvider>
  );
}