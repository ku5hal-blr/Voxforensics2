import { useState, useRef, useCallback, useMemo } from 'react';
import type { AnalysisResult } from '../utils/analysis';
import { saveUserScanToHistory } from '../services/history';
import type { User } from './AuthSystem';

/* ============================================================
 * BATCH PROCESSING TYPES
 * ============================================================ */

export type BatchItemStatus = 'Waiting' | 'Analyzing' | 'Completed' | 'Failed';

export interface BatchItem {
  id: string;
  file: File;
  filename: string;
  size: number;
  status: BatchItemStatus;
  verdict?: 'AI-Generated' | 'Real Voice' | 'Possibly Manipulated' | 'Inconclusive';
  confidence?: number;
  realProbability?: number;
  fakeProbability?: number;
  errorMessage?: string;
  result?: AnalysisResult;
}

export interface BatchProcessingProps {
  user: User | null;
  requireAuthentication: () => boolean;
  predictWithML: (file: File) => Promise<any>;
  onHistoryRefresh?: () => Promise<void> | void;
}

/* ============================================================
 * CONSTANTS & VALIDATION
 * ============================================================ */

const MAX_FILE_SIZE = 50 * 1024 * 1024; // 50 MB limit

const SUPPORTED_AUDIO_EXTENSIONS = [
  '.wav',
  '.mp3',
  '.m4a',
  '.webm',
  '.ogg',
  '.flac',
];

const formatFileSize = (bytes: number): string => {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
};

const isSupportedExtension = (filename: string): boolean => {
  const lastDot = filename.lastIndexOf('.');
  if (lastDot === -1) return false;
  const ext = filename.slice(lastDot).toLowerCase();
  return SUPPORTED_AUDIO_EXTENSIONS.includes(ext);
};

/* ============================================================
 * COMPONENT
 * ============================================================ */

export default function BatchProcessing({
  user,
  requireAuthentication,
  predictWithML,
  onHistoryRefresh,
}: BatchProcessingProps) {
  const [queue, setQueue] = useState<BatchItem[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [currentProcessingIndex, setCurrentProcessingIndex] = useState<number | null>(null);
  const [isDragging, setIsDragging] = useState(false);

  const fileInputRef = useRef<HTMLInputElement | null>(null);

  /* ----------------------------------------------------------
   * FILE SELECTION HANDLER
   * ---------------------------------------------------------- */

  const addFilesToQueue = useCallback((selectedFiles: FileList | File[]) => {
    const newItems: BatchItem[] = [];

    Array.from(selectedFiles).forEach((file) => {
      // Validate format and size immediately for clear status
      let initialStatus: BatchItemStatus = 'Waiting';
      let errorMsg: string | undefined = undefined;

      if (!isSupportedExtension(file.name)) {
        initialStatus = 'Failed';
        errorMsg = 'Unsupported format. Supported: WAV, MP3, M4A, WebM, OGG, FLAC';
      } else if (file.size > MAX_FILE_SIZE) {
        initialStatus = 'Failed';
        errorMsg = `File exceeds maximum size limit (50 MB). Size: ${formatFileSize(file.size)}`;
      }

      newItems.push({
        id: 'batch_' + Date.now() + '_' + Math.random().toString(36).slice(2, 9),
        file,
        filename: file.name,
        size: file.size,
        status: initialStatus,
        errorMessage: errorMsg,
      });
    });

    setQueue((prev) => [...prev, ...newItems]);
  }, []);

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      addFilesToQueue(e.target.files);
      // Reset input value to allow selecting same file again if desired
      e.target.value = '';
    }
  };

  /* ----------------------------------------------------------
   * DRAG & DROP HANDLERS
   * ---------------------------------------------------------- */

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);

    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      addFilesToQueue(e.dataTransfer.files);
    }
  };

  /* ----------------------------------------------------------
   * REMOVE & CLEAR HANDLERS
   * ---------------------------------------------------------- */

  const removeItem = (id: string) => {
    if (isProcessing) return;
    setQueue((prev) => prev.filter((item) => item.id !== id));
  };

  const clearBatch = () => {
    if (isProcessing) return;
    setQueue([]);
    setCurrentProcessingIndex(null);
  };

  /* ----------------------------------------------------------
   * BATCH ANALYSIS PROCESSOR
   * ---------------------------------------------------------- */

  const processBatch = async () => {
    // 1. Enforce authentication
    if (!requireAuthentication()) {
      return;
    }

    if (isProcessing || queue.length === 0) {
      return;
    }

    setIsProcessing(true);

    const itemsToProcess = [...queue];

    for (let i = 0; i < itemsToProcess.length; i++) {
      const item = itemsToProcess[i];

      // Skip already completed items
      if (item.status === 'Completed') {
        continue;
      }

      // If already pre-failed (size or format), skip ML call and continue
      if (item.status === 'Failed' && item.errorMessage) {
        continue;
      }

      setCurrentProcessingIndex(i);

      // Update status to Analyzing
      setQueue((prev) =>
        prev.map((qItem, idx) =>
          idx === i ? { ...qItem, status: 'Analyzing', errorMessage: undefined } : qItem
        )
      );

      // Verify file size limit before upload
      if (item.file.size > MAX_FILE_SIZE) {
        setQueue((prev) =>
          prev.map((qItem, idx) =>
            idx === i
              ? {
                  ...qItem,
                  status: 'Failed',
                  errorMessage: 'File exceeds maximum size limit (50 MB).',
                }
              : qItem
          )
        );
        continue;
      }

      // Verify audio extension
      if (!isSupportedExtension(item.filename)) {
        setQueue((prev) =>
          prev.map((qItem, idx) =>
            idx === i
              ? {
                  ...qItem,
                  status: 'Failed',
                  errorMessage: 'Unsupported audio format. Supported: WAV, MP3, M4A, WebM, OGG, FLAC.',
                }
              : qItem
          )
        );
        continue;
      }

      try {
        // Send file to existing FastAPI Random Forest endpoint
        const mlResult = await predictWithML(item.file);

        const realProb = Number(mlResult.real_probability) || 0;
        const fakeProb = Number(mlResult.fake_probability) || 0;
        const isFake = fakeProb >= realProb;
        const verdict = isFake ? 'AI-Generated' : 'Real Voice';
        const confidence = Math.max(realProb, fakeProb) * 100;

        const analysisResult: AnalysisResult = {
          id: 'scan_' + Date.now() + '_' + Math.random().toString(36).slice(2, 7),
          isDeepfake: isFake,
          timestamp: Date.now(),
          verdict,
          confidence,
          features: {
            rmsEnergy: mlResult.features?.rmsEnergy ?? 0,
            pitchVariation: mlResult.features?.pitchMean ?? 0,
            spectralCentroid: mlResult.features?.spectralCentroid ?? 0,
            zeroCrossingRate: mlResult.features?.zeroCrossingRate ?? 0,
          } as any,
          explanation: isFake
            ? `The Random Forest machine learning model classified this recording as AI-generated with ${(fakeProb * 100).toFixed(1)}% probability.`
            : `The Random Forest machine learning model classified this recording as a real voice with ${(realProb * 100).toFixed(1)}% probability.`,
        };

        // Save scan to user Firestore history if authenticated
        if (user?.id) {
          try {
            await saveUserScanToHistory(user.id, item.filename, analysisResult, 0);
          } catch (historyErr) {
            console.warn('Failed to save batch scan to history:', historyErr);
          }
        }

        // Update item state to Completed
        setQueue((prev) =>
          prev.map((qItem, idx) =>
            idx === i
              ? {
                  ...qItem,
                  status: 'Completed',
                  verdict,
                  confidence,
                  realProbability: realProb,
                  fakeProbability: fakeProb,
                  result: analysisResult,
                }
              : qItem
          )
        );
      } catch (err: any) {
        console.error(`Batch processing failed for file ${item.filename}:`, err);

        // Individual file error: update status to Failed and proceed with remaining files
        setQueue((prev) =>
          prev.map((qItem, idx) =>
            idx === i
              ? {
                  ...qItem,
                  status: 'Failed',
                  errorMessage: err?.message || 'Audio analysis failed. Could not reach ML API.',
                }
              : qItem
          )
        );
      }
    }

    setIsProcessing(false);
    setCurrentProcessingIndex(null);

    // Refresh history in parent if available
    if (onHistoryRefresh) {
      try {
        await onHistoryRefresh();
      } catch (refreshErr) {
        console.warn('History refresh error:', refreshErr);
      }
    }
  };

  /* ----------------------------------------------------------
   * SUMMARY METRICS
   * ---------------------------------------------------------- */

  const summary = useMemo(() => {
    const total = queue.length;
    const completed = queue.filter((item) => item.status === 'Completed').length;
    const failed = queue.filter((item) => item.status === 'Failed').length;
    const analyzing = queue.filter((item) => item.status === 'Analyzing').length;
    const waiting = queue.filter((item) => item.status === 'Waiting').length;

    const aiGenerated = queue.filter(
      (item) => item.status === 'Completed' && item.verdict === 'AI-Generated'
    ).length;

    const realVoice = queue.filter(
      (item) => item.status === 'Completed' && item.verdict === 'Real Voice'
    ).length;

    return {
      total,
      completed,
      failed,
      analyzing,
      waiting,
      aiGenerated,
      realVoice,
      percentDone: total > 0 ? Math.round(((completed + failed) / total) * 100) : 0,
    };
  }, [queue]);

  const hasWaitingItems = queue.some(
    (item) => item.status === 'Waiting' || (item.status === 'Failed' && !item.errorMessage)
  );

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      {/* HEADER */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-[#00d4ff]/10 border border-[#00d4ff]/30 flex items-center justify-center text-[#00d4ff]">
              <i className="fa-solid fa-layer-group text-lg"></i>
            </div>
            <h2 className="text-3xl font-bold text-white tracking-tight">
              Batch Processing
            </h2>
          </div>
          <p className="text-gray-400 text-sm mt-2">
            Upload and analyze multiple voice recordings in sequence using the Random Forest ML backend.
          </p>
        </div>

        {queue.length > 0 && (
          <div className="flex items-center gap-3">
            <button
              onClick={() => fileInputRef.current?.click()}
              disabled={isProcessing}
              className="neon-btn neon-btn-outline text-xs py-2 px-4 flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <i className="fa-solid fa-plus"></i>
              Add More
            </button>
            <button
              onClick={clearBatch}
              disabled={isProcessing}
              className="neon-btn neon-btn-danger text-xs py-2 px-4 flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <i className="fa-solid fa-trash-can"></i>
              Clear Batch
            </button>
          </div>
        )}
      </div>

      {/* UPLOAD DROP ZONE */}
      <div className="glass-panel p-6">
        <input
          ref={fileInputRef}
          type="file"
          multiple
          accept=".wav,.mp3,.m4a,.webm,.ogg,.flac,audio/*"
          className="hidden"
          onChange={handleFileInputChange}
        />

        <div
          onClick={() => {
            if (!requireAuthentication()) return;
            fileInputRef.current?.click();
          }}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          className={`border-2 border-dashed rounded-xl p-8 flex flex-col items-center justify-center text-center cursor-pointer transition-all duration-300 group ${
            isDragging
              ? 'border-[#00d4ff] bg-[#00d4ff]/10 scale-[1.01]'
              : 'border-[#1a2a4a] hover:border-[#00d4ff]/50 bg-[#050914]/30'
          }`}
        >
          <div className="w-16 h-16 rounded-2xl bg-[#1a2a4a]/40 border border-white/5 flex items-center justify-center mb-4 group-hover:scale-110 group-hover:border-[#00d4ff]/30 transition duration-300">
            <i className="fa-solid fa-cloud-arrow-up text-2xl text-gray-400 group-hover:text-[#00d4ff] transition"></i>
          </div>

          <p className="text-base font-semibold text-white mb-1">
            Choose or drop multiple audio files
          </p>

          <p className="text-xs text-gray-400 max-w-md">
            Select several recordings at once to queue them for automated classification.
          </p>

          <div className="flex flex-wrap items-center justify-center gap-2 mt-4">
            {SUPPORTED_AUDIO_EXTENSIONS.map((ext) => (
              <span
                key={ext}
                className="px-3 py-1 rounded-full bg-[#1a2a4a]/50 text-[11px] font-semibold text-gray-300 border border-white/5"
              >
                {ext}
              </span>
            ))}
          </div>

          <p className="text-[11px] text-gray-500 mt-3">
            Maximum file size: 50 MB per file &bull; Real-time ML prediction
          </p>
        </div>
      </div>

      {/* SUMMARY DASHBOARD (VISIBLE WHEN QUEUE HAS ITEMS) */}
      {queue.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
          <div className="glass-panel p-4 rounded-xl border border-white/10 text-center">
            <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider">
              Total Files
            </p>
            <p className="text-2xl font-bold text-white mt-1">{summary.total}</p>
          </div>

          <div className="glass-panel p-4 rounded-xl border border-white/10 text-center">
            <p className="text-[11px] font-semibold text-emerald-400 uppercase tracking-wider">
              Completed
            </p>
            <p className="text-2xl font-bold text-emerald-400 mt-1">{summary.completed}</p>
          </div>

          <div className="glass-panel p-4 rounded-xl border border-white/10 text-center">
            <p className="text-[11px] font-semibold text-rose-400 uppercase tracking-wider">
              Failed
            </p>
            <p className="text-2xl font-bold text-rose-400 mt-1">{summary.failed}</p>
          </div>

          <div className="glass-panel p-4 rounded-xl border border-white/10 text-center">
            <p className="text-[11px] font-semibold text-purple-400 uppercase tracking-wider">
              AI-Generated
            </p>
            <p className="text-2xl font-bold text-purple-400 mt-1">{summary.aiGenerated}</p>
          </div>

          <div className="glass-panel p-4 rounded-xl border border-white/10 text-center col-span-2 sm:col-span-1">
            <p className="text-[11px] font-semibold text-cyan-400 uppercase tracking-wider">
              Real Voice
            </p>
            <p className="text-2xl font-bold text-cyan-400 mt-1">{summary.realVoice}</p>
          </div>
        </div>
      )}

      {/* PROCESSING PROGRESS BAR */}
      {isProcessing && (
        <div className="glass-panel p-5 rounded-xl border border-[#00d4ff]/30 bg-[#00d4ff]/5 space-y-3">
          <div className="flex items-center justify-between text-xs text-gray-300">
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-[#00d4ff] animate-ping"></span>
              <span className="font-semibold text-white">
                {currentProcessingIndex !== null
                  ? `Analyzing ${currentProcessingIndex + 1} of ${queue.length}: ${
                      queue[currentProcessingIndex]?.filename
                    }`
                  : 'Processing batch queue...'}
              </span>
            </div>
            <span className="font-mono text-[#00d4ff] font-bold">
              {summary.percentDone}%
            </span>
          </div>

          <div className="w-full bg-[#1a2a4a] h-2.5 rounded-full overflow-hidden">
            <div
              className="bg-gradient-to-r from-[#00d4ff] via-[#6366f1] to-[#a855f7] h-full transition-all duration-300 rounded-full"
              style={{ width: `${summary.percentDone}%` }}
            ></div>
          </div>
        </div>
      )}

      {/* QUEUE TABLE & CONTROLS */}
      {queue.length > 0 ? (
        <div className="glass-panel p-6 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-2 border-b border-white/10">
            <div className="flex items-center gap-3">
              <h3 className="text-lg font-bold text-white">Batch Queue</h3>
              <span className="px-2.5 py-0.5 rounded-full bg-[#00d4ff]/10 border border-[#00d4ff]/30 text-xs font-semibold text-[#00d4ff]">
                {queue.length} {queue.length === 1 ? 'file' : 'files'}
              </span>
            </div>

            <button
              onClick={processBatch}
              disabled={isProcessing || !hasWaitingItems}
              className="neon-btn neon-btn-primary py-2.5 px-6 text-sm flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed shadow-[0_0_20px_rgba(0,212,255,0.2)]"
            >
              {isProcessing ? (
                <>
                  <div className="loader w-4 h-4 border-2 border-white/20 border-t-white"></div>
                  <span>Analyzing Batch...</span>
                </>
              ) : (
                <>
                  <i className="fa-solid fa-play text-xs"></i>
                  <span>Analyze Batch ({summary.waiting} waiting)</span>
                </>
              )}
            </button>
          </div>

          {/* TABLE CONTAINER */}
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm border-collapse">
              <thead>
                <tr className="border-b border-white/10 text-xs text-gray-400 uppercase tracking-wider font-semibold">
                  <th className="py-3 px-3">#</th>
                  <th className="py-3 px-3">File</th>
                  <th className="py-3 px-3">Size</th>
                  <th className="py-3 px-3">Status</th>
                  <th className="py-3 px-3">Verdict</th>
                  <th className="py-3 px-3">Confidence / Details</th>
                  <th className="py-3 px-3 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {queue.map((item, index) => {
                  const isCurrent = currentProcessingIndex === index;

                  return (
                    <tr
                      key={item.id}
                      className={`hover:bg-white/[0.02] transition ${
                        isCurrent ? 'bg-[#00d4ff]/5' : ''
                      }`}
                    >
                      {/* INDEX */}
                      <td className="py-3.5 px-3 text-xs text-gray-500 font-mono">
                        {index + 1}
                      </td>

                      {/* FILENAME */}
                      <td className="py-3.5 px-3">
                        <div className="flex items-center gap-2.5 max-w-xs sm:max-w-sm truncate">
                          <i className="fa-solid fa-file-audio text-[#00d4ff]/80 text-sm flex-shrink-0"></i>
                          <span
                            className="font-medium text-white truncate text-xs sm:text-sm"
                            title={item.filename}
                          >
                            {item.filename}
                          </span>
                        </div>
                      </td>

                      {/* SIZE */}
                      <td className="py-3.5 px-3 text-xs text-gray-400 whitespace-nowrap">
                        {formatFileSize(item.size)}
                      </td>

                      {/* STATUS BADGE */}
                      <td className="py-3.5 px-3 whitespace-nowrap">
                        {item.status === 'Waiting' && (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-gray-500/10 text-gray-300 border border-gray-500/20">
                            <i className="fa-regular fa-clock text-[10px]"></i>
                            Waiting
                          </span>
                        )}
                        {item.status === 'Analyzing' && (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-[#00d4ff]/20 text-[#00d4ff] border border-[#00d4ff]/40 animate-pulse">
                            <div className="loader w-3 h-3 border-2 border-[#00d4ff]/20 border-t-[#00d4ff]"></div>
                            Analyzing
                          </span>
                        )}
                        {item.status === 'Completed' && (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
                            <i className="fa-solid fa-check text-[10px]"></i>
                            Completed
                          </span>
                        )}
                        {item.status === 'Failed' && (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-rose-500/15 text-rose-400 border border-rose-500/30">
                            <i className="fa-solid fa-triangle-exclamation text-[10px]"></i>
                            Failed
                          </span>
                        )}
                      </td>

                      {/* VERDICT BADGE */}
                      <td className="py-3.5 px-3 whitespace-nowrap">
                        {item.verdict ? (
                          <span
                            className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold ${
                              item.verdict === 'AI-Generated'
                                ? 'bg-purple-500/20 text-purple-300 border border-purple-500/40 shadow-[0_0_10px_rgba(168,85,247,0.2)]'
                                : item.verdict === 'Real Voice'
                                ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 shadow-[0_0_10px_rgba(16,185,129,0.2)]'
                                : 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
                            }`}
                          >
                            <span
                              className={`w-1.5 h-1.5 rounded-full ${
                                item.verdict === 'AI-Generated'
                                  ? 'bg-purple-400'
                                  : item.verdict === 'Real Voice'
                                  ? 'bg-emerald-400'
                                  : 'bg-amber-400'
                              }`}
                            ></span>
                            {item.verdict}
                          </span>
                        ) : (
                          <span className="text-gray-500 text-xs">&mdash;</span>
                        )}
                      </td>

                      {/* CONFIDENCE / ERROR */}
                      <td className="py-3.5 px-3 text-xs">
                        {item.status === 'Completed' && item.confidence !== undefined ? (
                          <div className="space-y-1">
                            <div className="flex items-center gap-2">
                              <span className="font-bold text-white font-mono">
                                {item.confidence.toFixed(1)}%
                              </span>
                              <span className="text-[10px] text-gray-400">
                                {item.verdict === 'AI-Generated'
                                  ? `(Fake: ${(item.fakeProbability! * 100).toFixed(1)}%)`
                                  : `(Real: ${(item.realProbability! * 100).toFixed(1)}%)`}
                              </span>
                            </div>
                            <div className="w-24 bg-white/10 h-1 rounded-full overflow-hidden">
                              <div
                                className={`h-full ${
                                  item.verdict === 'AI-Generated'
                                    ? 'bg-purple-400'
                                    : 'bg-emerald-400'
                                }`}
                                style={{ width: `${Math.min(100, item.confidence)}%` }}
                              ></div>
                            </div>
                          </div>
                        ) : item.status === 'Failed' ? (
                          <span className="text-rose-400 text-xs font-medium">
                            {item.errorMessage || 'Analysis failed'}
                          </span>
                        ) : item.status === 'Analyzing' ? (
                          <span className="text-cyan-400 text-xs animate-pulse">
                            Extracting 45 acoustic features...
                          </span>
                        ) : (
                          <span className="text-gray-500 text-xs">Queued</span>
                        )}
                      </td>

                      {/* ACTION */}
                      <td className="py-3.5 px-3 text-right">
                        <button
                          onClick={() => removeItem(item.id)}
                          disabled={isProcessing}
                          className="w-7 h-7 rounded-lg hover:bg-rose-500/20 text-gray-500 hover:text-rose-400 transition flex items-center justify-center disabled:opacity-30 disabled:cursor-not-allowed ml-auto"
                          title="Remove from batch"
                        >
                          <i className="fa-solid fa-xmark text-xs"></i>
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        /* EMPTY QUEUE HINT */
        <div className="glass-panel p-8 text-center rounded-xl border border-white/5 space-y-2">
          <p className="text-sm text-gray-400">
            No files in queue. Click or drag audio files above to start.
          </p>
          <p className="text-xs text-gray-500">
            Supported formats: WAV, MP3, M4A, WebM, OGG, FLAC &bull; Max 50 MB per file
          </p>
        </div>
      )}
    </div>
  );
}
