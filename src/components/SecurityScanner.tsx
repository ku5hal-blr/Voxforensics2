import { useEffect, useState } from 'react';

interface SecurityScanResult {
  filename: string;
  size: number;
  type: string;
  isValid: boolean;
  threats: string[];
  warnings: string[];
  scanTime: number;
}

interface SecurityScannerProps {
  file: File | null;
  onScanComplete: (result: SecurityScanResult) => void;
}

export default function SecurityScanner({
  file,
  onScanComplete,
}: SecurityScannerProps) {
  const [isScanning, setIsScanning] = useState(false);
  const [scanResult, setScanResult] =
    useState<SecurityScanResult | null>(null);

  const scanFile = async (fileToScan: File) => {
    setIsScanning(true);

    const startTime = Date.now();

    const threats: string[] = [];
    const warnings: string[] = [];

    // ---------------------------------------------------------
    // 1. File size check
    // Maximum allowed size: 50 MB
    // ---------------------------------------------------------

    const maxSize = 50 * 1024 * 1024;

    if (fileToScan.size > maxSize) {
      threats.push(
        'File exceeds maximum size limit (50MB)'
      );
    } else if (fileToScan.size > 25 * 1024 * 1024) {
      warnings.push(
        'Large file size (>25MB) - may affect processing speed'
      );
    }

    // ---------------------------------------------------------
    // 2. File type validation
    // ---------------------------------------------------------

    const allowedTypes = [
      'audio/wav',
      'audio/x-wav',
      'audio/mp3',
      'audio/mpeg',
      'audio/ogg',
      'audio/webm',
      'audio/m4a',
      'audio/mp4',
      'audio/aac',
      'audio/flac',
    ];

    const validAudioExtensions = [
      '.wav',
      '.mp3',
      '.ogg',
      '.webm',
      '.m4a',
      '.aac',
      '.flac',
    ];

    const filename = fileToScan.name.toLowerCase();

    const extension = filename.includes('.')
      ? `.${filename.split('.').pop()}`
      : '';

    const isValidMimeType = allowedTypes.includes(
      fileToScan.type.toLowerCase()
    );

    const isValidExtension =
      validAudioExtensions.includes(extension);

    const isValidType =
      isValidMimeType || isValidExtension;

    if (!isValidType) {
      threats.push(
        `Invalid file type: ${
          fileToScan.type || extension || 'unknown'
        }`
      );
    }

    // ---------------------------------------------------------
    // 3. Executable file check
    // ---------------------------------------------------------

    const executableExtensions = [
      '.exe',
      '.bat',
      '.cmd',
      '.sh',
      '.msi',
      '.com',
      '.scr',
      '.ps1',
      '.vbs',
      '.js',
    ];

    const hasExecutableExtension =
      executableExtensions.includes(extension);

    const hasExecutableMime =
      fileToScan.type
        .toLowerCase()
        .includes('executable');

    if (hasExecutableExtension || hasExecutableMime) {
      threats.push(
        'Executable file detected - potential security risk'
      );
    }

    // ---------------------------------------------------------
    // 4. Suspicious filename check
    // ---------------------------------------------------------

    const suspiciousPatterns = [
      'virus',
      'malware',
      'trojan',
      'hack',
      'exploit',
    ];

    if (
      suspiciousPatterns.some((pattern) =>
        filename.includes(pattern)
      )
    ) {
      warnings.push(
        'Suspicious filename pattern detected'
      );
    }

    // ---------------------------------------------------------
    // 5. File signature / integrity check
    // ---------------------------------------------------------

    try {
      const buffer = await fileToScan
        .slice(0, 1024)
        .arrayBuffer();

      const bytes = new Uint8Array(buffer);

      // WAV / RIFF
      const isWav =
        bytes.length >= 4 &&
        bytes[0] === 0x52 &&
        bytes[1] === 0x49 &&
        bytes[2] === 0x46 &&
        bytes[3] === 0x46;

      // MP3 frame sync
      const isMp3 =
        bytes.length >= 2 &&
        bytes[0] === 0xff &&
        (bytes[1] & 0xe0) === 0xe0;

      // OGG
      const isOgg =
        bytes.length >= 4 &&
        bytes[0] === 0x4f &&
        bytes[1] === 0x67 &&
        bytes[2] === 0x67 &&
        bytes[3] === 0x53;

      // WebM / Matroska EBML
      const isWebM =
        bytes.length >= 4 &&
        bytes[0] === 0x1a &&
        bytes[1] === 0x45 &&
        bytes[2] === 0xdf &&
        bytes[3] === 0xa3;

      const hasValidSignature =
        isWav ||
        isMp3 ||
        isOgg ||
        isWebM;

      if (
        !hasValidSignature &&
        !isValidMimeType &&
        threats.length === 0
      ) {
        warnings.push(
          'File signature does not match an expected audio format'
        );
      }
    } catch (error) {
      console.warn(
        'Unable to verify file signature:',
        error
      );

      warnings.push(
        'Unable to verify file integrity'
      );
    }

    // ---------------------------------------------------------
    // 6. Zero-byte file check
    // ---------------------------------------------------------

    if (fileToScan.size === 0) {
      threats.push('Empty file detected');
    }

    // ---------------------------------------------------------
    // 7. Very small file check
    // ---------------------------------------------------------

    if (
      fileToScan.size > 0 &&
      fileToScan.size < 100
    ) {
      warnings.push(
        'File appears to be corrupted or incomplete'
      );
    }

    // ---------------------------------------------------------
    // Final result
    // ---------------------------------------------------------

    const scanTime = Date.now() - startTime;

    const isValid = threats.length === 0;

    const result: SecurityScanResult = {
      filename: fileToScan.name,
      size: fileToScan.size,
      type: fileToScan.type,
      isValid,
      threats,
      warnings,
      scanTime,
    };

    setScanResult(result);
    setIsScanning(false);

    onScanComplete(result);
  };

  // ---------------------------------------------------------
  // Automatically scan whenever a new file is provided
  // ---------------------------------------------------------

  useEffect(() => {
    if (!file) {
      setScanResult(null);
      setIsScanning(false);
      return;
    }

    setScanResult(null);

    let cancelled = false;

    const runScan = async () => {
      if (cancelled) return;

      await scanFile(file);
    };

    runScan();

    return () => {
      cancelled = true;
    };
  }, [file]);

  // ---------------------------------------------------------
  // No file selected
  // ---------------------------------------------------------

  if (!file && !scanResult) {
    return null;
  }

  return (
    <div className="glass-card p-4 mb-4">

      {/* Header */}
      <div className="flex items-center justify-between mb-3">

        <h3 className="text-sm font-semibold text-white flex items-center gap-2">
          🛡️ Security Scan
        </h3>

        {isScanning && (
          <div className="spinner w-4 h-4"></div>
        )}

      </div>

      {/* Scanning */}
      {isScanning && (
        <div className="p-3 rounded-lg bg-[#00d4ff]/5 border border-[#00d4ff]/20">
          <p className="text-sm text-[#00d4ff]">
            Checking file structure and security properties...
          </p>
        </div>
      )}

      {/* Scan Result */}
      {scanResult && (
        <div className="space-y-2">

          {/* Status */}
          <div
            className={`p-3 rounded-lg border ${
              scanResult.isValid
                ? 'bg-green-500/10 border-green-500/30'
                : 'bg-red-500/10 border-red-500/30'
            }`}
          >
            <div className="flex items-center gap-2">

              <span className="text-lg">
                {scanResult.isValid
                  ? '✅'
                  : '❌'}
              </span>

              <div>

                <p
                  className={`text-sm font-medium ${
                    scanResult.isValid
                      ? 'text-green-400'
                      : 'text-red-400'
                  }`}
                >
                  {scanResult.isValid
                    ? 'File passed security checks'
                    : 'Security checks failed'}
                </p>

                <p className="text-xs text-gray-400">
                  Scanned in {scanResult.scanTime}ms
                </p>

              </div>

            </div>
          </div>

          {/* File Information */}
          <div className="text-xs text-gray-400 space-y-1">

            <p>
              <span className="text-gray-500">
                File:
              </span>{' '}
              {scanResult.filename}
            </p>

            <p>
              <span className="text-gray-500">
                Size:
              </span>{' '}
              {(scanResult.size / 1024).toFixed(2)} KB
            </p>

            <p>
              <span className="text-gray-500">
                Type:
              </span>{' '}
              {scanResult.type || 'Unknown'}
            </p>

          </div>

          {/* Threats */}
          {scanResult.threats.length > 0 && (
            <div className="p-3 rounded-lg bg-red-500/5 border border-red-500/20">

              <p className="text-xs font-semibold text-red-400 mb-2">
                ⚠️ Threats Detected:
              </p>

              <ul className="text-xs text-red-300 space-y-1">
                {scanResult.threats.map(
                  (threat, index) => (
                    <li key={index}>
                      • {threat}
                    </li>
                  )
                )}
              </ul>

            </div>
          )}

          {/* Warnings */}
          {scanResult.warnings.length > 0 && (
            <div className="p-3 rounded-lg bg-yellow-500/5 border border-yellow-500/20">

              <p className="text-xs font-semibold text-yellow-400 mb-2">
                ⚡ Warnings:
              </p>

              <ul className="text-xs text-yellow-300 space-y-1">
                {scanResult.warnings.map(
                  (warning, index) => (
                    <li key={index}>
                      • {warning}
                    </li>
                  )
                )}
              </ul>

            </div>
          )}

          {/* Prototype Notice */}
          <div className="pt-2">
            <p className="text-[10px] text-gray-500 leading-relaxed">
              This browser-side check validates basic file properties
              and audio signatures. It is not a full malware scanner
              or forensic security analysis.
            </p>
          </div>

        </div>
      )}
    </div>
  );
}

export type { SecurityScanResult };