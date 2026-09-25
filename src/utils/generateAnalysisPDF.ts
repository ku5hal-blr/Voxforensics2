import { jsPDF } from 'jspdf';
import type { AnalysisResult } from './analysis';

/* ============================================================
 * INTERFACES
 * ============================================================ */

export interface ExtendedAnalysisResult extends AnalysisResult {
  realProbability?: number;
  fakeProbability?: number;
}

/* ============================================================
 * FILENAME SANITIZATION
 * ============================================================ */

export function sanitizeFilename(originalFilename?: string): string {
  if (!originalFilename || typeof originalFilename !== 'string' || !originalFilename.trim()) {
    return 'audio_sample';
  }
  // Strip directory paths if any
  const base = originalFilename.split(/[/\\]/).pop() || originalFilename;
  // Strip common audio extensions
  const nameWithoutExt = base.replace(
    /\.(wav|mp3|m4a|webm|ogg|flac|aac|wma|aiff|alac|opus)$/i,
    ''
  );
  // Replace invalid filesystem characters with underscores
  const sanitized = nameWithoutExt
    .replace(/[^a-zA-Z0-9_\-\.]/g, '_')
    .replace(/_+/g, '_');
  return sanitized.replace(/^_+|_+$/g, '') || 'audio_sample';
}

/* ============================================================
 * MAIN PDF GENERATOR
 * ============================================================ */

/**
 * Generates and triggers download of a professional PDF report
 * representing an audio analysis result.
 *
 * @param result The AnalysisResult data object currently displayed
 * @param filename The original audio filename
 * @param waveformData Optional audio waveform amplitude data
 */
export function generateAnalysisPDF(
  result: AnalysisResult | ExtendedAnalysisResult,
  filename?: string,
  waveformData?: number[]
): boolean {
  if (!result) {
    throw new Error('Unable to generate the PDF report. Please try again.');
  }

  try {
    const doc = new jsPDF({
      orientation: 'portrait',
      unit: 'mm',
      format: 'a4',
    });

    const pageWidth = doc.internal.pageSize.getWidth(); // 210 mm
    const pageHeight = doc.internal.pageSize.getHeight(); // 297 mm
    const margin = 18;
    const contentWidth = pageWidth - margin * 2; // 174 mm
    let y = margin;

    // Helper: Page Break Check
    const ensureSpace = (neededHeight: number) => {
      if (y + neededHeight > pageHeight - 25) {
        doc.addPage();
        y = margin;
        // Draw header accent on continuation pages
        doc.setFillColor(0, 212, 255);
        doc.rect(0, 0, pageWidth, 3, 'F');

        doc.setFont('helvetica', 'normal');
        doc.setFontSize(7.5);
        doc.setTextColor(148, 163, 184);
        doc.text('VoxForensics • Audio Analysis Report (Continued)', margin, y + 2);

        doc.setDrawColor(226, 232, 240);
        doc.setLineWidth(0.3);
        doc.line(margin, y + 5, pageWidth - margin, y + 5);

        y += 10;
      }
    };

    /* --------------------------------------------------------
     * 1. TOP BRANDING & HEADER (PAGE 1)
     * -------------------------------------------------------- */

    // Cyan top accent banner
    doc.setFillColor(0, 212, 255);
    doc.rect(0, 0, pageWidth, 4, 'F');

    // Brand title
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(22);
    doc.setTextColor(10, 24, 48);
    doc.text('VOXFORENSICS', margin, y);

    // Subtitle
    doc.setFontSize(8.5);
    doc.setTextColor(0, 140, 180);
    doc.text('DEEPFAKE AUDIO DETECTION SYSTEM', margin, y + 5.5);

    // Report Type Badge on Right
    doc.setFillColor(10, 24, 48);
    doc.roundedRect(pageWidth - margin - 58, y - 5, 58, 8.5, 2, 2, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(8);
    doc.setFont('helvetica', 'bold');
    doc.text('AUDIO ANALYSIS REPORT', pageWidth - margin - 29, y + 0.8, { align: 'center' });

    y += 11;
    doc.setDrawColor(226, 232, 240);
    doc.setLineWidth(0.4);
    doc.line(margin, y, pageWidth - margin, y);

    y += 6;

    /* --------------------------------------------------------
     * 2. FILE INFORMATION CARD
     * -------------------------------------------------------- */

    const displayFilename = filename || (result.id ? `${result.id}.wav` : 'Audio Recording');
    const formattedDate = new Date(result.timestamp || Date.now()).toLocaleString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });

    const infoBoxHeight = 26;
    doc.setFillColor(248, 250, 252);
    doc.setDrawColor(226, 232, 240);
    doc.setLineWidth(0.3);
    doc.roundedRect(margin, y, contentWidth, infoBoxHeight, 2, 2, 'FD');

    // Card Header
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8);
    doc.setTextColor(100, 116, 139);
    doc.text('FILE INFORMATION', margin + 5, y + 5.5);

    // Left Column: Filename & Timestamp
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.5);
    doc.setTextColor(148, 163, 184);
    doc.text('File Name:', margin + 5, y + 11.5);
    doc.text('Analysis Date:', margin + 5, y + 16.5);
    doc.text('Report ID:', margin + 5, y + 21.5);

    doc.setFont('helvetica', 'bold');
    doc.setTextColor(15, 23, 42);
    doc.setFontSize(8);
    // Truncate filename if exceptionally long to prevent overlap
    const safeDisplayFilename =
      displayFilename.length > 38 ? displayFilename.slice(0, 35) + '...' : displayFilename;
    doc.text(safeDisplayFilename, margin + 28, y + 11.5);
    doc.text(formattedDate, margin + 28, y + 16.5);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.5);
    doc.text(result.id || 'N/A', margin + 28, y + 21.5);

    // Right Column: Detection Engine
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.5);
    doc.setTextColor(148, 163, 184);
    doc.text('Engine:', margin + 98, y + 11.5);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(15, 23, 42);
    doc.setFontSize(8);
    doc.text('Random Forest ML Classifier (v2.0)', margin + 112, y + 11.5);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.5);
    doc.setTextColor(148, 163, 184);
    doc.text('Status:', margin + 98, y + 16.5);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(16, 185, 129);
    doc.setFontSize(8);
    doc.text('Classification Complete', margin + 112, y + 16.5);

    y += infoBoxHeight + 6;

    /* --------------------------------------------------------
     * 2.5 AUDIO WAVEFORM (IF AVAILABLE)
     * -------------------------------------------------------- */

    if (waveformData && waveformData.length > 0) {
      const waveformBoxHeight = 22;
      ensureSpace(waveformBoxHeight + 12);

      // Section Title
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(8);
      doc.setTextColor(100, 116, 139);
      doc.text('AUDIO WAVEFORM', margin, y + 2.5);

      y += 4.5;

      // Waveform Card Container
      doc.setFillColor(248, 250, 252);
      doc.setDrawColor(226, 232, 240);
      doc.setLineWidth(0.3);
      doc.roundedRect(margin, y, contentWidth, waveformBoxHeight, 2, 2, 'FD');

      const waveInnerX = margin + 4;
      const waveInnerW = contentWidth - 8;
      const waveCenterY = y + waveformBoxHeight / 2;
      const waveMaxHalfH = waveformBoxHeight / 2 - 2.5;

      // Subtle center baseline
      doc.setDrawColor(226, 232, 240);
      doc.setLineWidth(0.2);
      doc.line(waveInnerX, waveCenterY, waveInnerX + waveInnerW, waveCenterY);

      // Amplitude normalization
      const maxAmp = Math.max(...waveformData.map(Math.abs), 0.01);
      const count = waveformData.length;

      // Top half (VoxForensics cyan accent)
      doc.setDrawColor(0, 163, 196);
      doc.setLineWidth(0.35);
      for (let i = 0; i < count - 1; i++) {
        const x1 = waveInnerX + (i / (count - 1)) * waveInnerW;
        const val1 = Math.abs(waveformData[i]);
        const y1 = waveCenterY - (val1 / maxAmp) * waveMaxHalfH;

        const x2 = waveInnerX + ((i + 1) / (count - 1)) * waveInnerW;
        const val2 = Math.abs(waveformData[i + 1]);
        const y2 = waveCenterY - (val2 / maxAmp) * waveMaxHalfH;

        doc.line(x1, y1, x2, y2);
      }

      // Mirrored bottom half
      doc.setDrawColor(125, 211, 252);
      doc.setLineWidth(0.25);
      for (let i = 0; i < count - 1; i++) {
        const x1 = waveInnerX + (i / (count - 1)) * waveInnerW;
        const val1 = Math.abs(waveformData[i]);
        const y1 = waveCenterY + (val1 / maxAmp) * waveMaxHalfH;

        const x2 = waveInnerX + ((i + 1) / (count - 1)) * waveInnerW;
        const val2 = Math.abs(waveformData[i + 1]);
        const y2 = waveCenterY + (val2 / maxAmp) * waveMaxHalfH;

        doc.line(x1, y1, x2, y2);
      }

      y += waveformBoxHeight + 6;
    }

    /* --------------------------------------------------------
     * 3. ANALYSIS RESULT (VERDICT & CONFIDENCE)
     * -------------------------------------------------------- */

    // Extract probabilities if available
    const ext = result as ExtendedAnalysisResult;
    const hasProbabilities = ext.realProbability !== undefined || ext.fakeProbability !== undefined;
    const realProb = ext.realProbability;
    const fakeProb = ext.fakeProbability;

    const isAi = result.verdict === 'AI-Generated';
    const isReal = result.verdict === 'Real Voice';

    // Theme colors by verdict
    const bgRGB = isAi ? [254, 242, 242] : isReal ? [236, 253, 245] : [255, 251, 235];
    const borderRGB = isAi ? [254, 205, 211] : isReal ? [167, 243, 208] : [253, 230, 138];
    const textRGB = isAi ? [225, 29, 72] : isReal ? [5, 150, 105] : [217, 119, 6];

    const verdictBoxHeight = hasProbabilities ? 34 : 30;

    doc.setFillColor(bgRGB[0], bgRGB[1], bgRGB[2]);
    doc.setDrawColor(borderRGB[0], borderRGB[1], borderRGB[2]);
    doc.setLineWidth(0.4);
    doc.roundedRect(margin, y, contentWidth, verdictBoxHeight, 2, 2, 'FD');

    // Left: Verdict
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8);
    doc.setTextColor(textRGB[0], textRGB[1], textRGB[2]);
    doc.text('FINAL VERDICT', margin + 6, y + 6.5);

    doc.setFontSize(18);
    doc.text(result.verdict, margin + 6, y + 15.5);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(100, 116, 139);
    const subVerdict = isAi
      ? 'Synthesized deepfake speech artifacts identified'
      : isReal
      ? 'Authentic human vocal characteristics verified'
      : 'Acoustic patterns warrant secondary manual review';
    doc.text(subVerdict, margin + 6, y + 21.5);

    // Right: Confidence
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8);
    doc.setTextColor(100, 116, 139);
    doc.text('CONFIDENCE SCORE', pageWidth - margin - 6, y + 6.5, { align: 'right' });

    doc.setFontSize(18);
    doc.setTextColor(textRGB[0], textRGB[1], textRGB[2]);
    doc.text(`${result.confidence.toFixed(1)}%`, pageWidth - margin - 6, y + 15.5, {
      align: 'right',
    });

    if (hasProbabilities && realProb !== undefined && fakeProb !== undefined) {
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(7.5);
      doc.setTextColor(100, 116, 139);
      doc.text(
        `Real Voice: ${realProb.toFixed(1)}%  |  AI-Generated: ${fakeProb.toFixed(1)}%`,
        pageWidth - margin - 6,
        y + 21.5,
        { align: 'right' }
      );

      // Mini probability visual bar
      const barW = 56;
      const barH = 3;
      const barX = pageWidth - margin - 6 - barW;
      const barY = y + 24.5;
      doc.setFillColor(226, 232, 240);
      doc.roundedRect(barX, barY, barW, barH, 1, 1, 'F');

      doc.setFillColor(textRGB[0], textRGB[1], textRGB[2]);
      const fillW = Math.max(2, (barW * Math.min(100, result.confidence)) / 100);
      doc.roundedRect(barX, barY, fillW, barH, 1, 1, 'F');
    }

    y += verdictBoxHeight + 7;

    /* --------------------------------------------------------
     * 4. ACOUSTIC FEATURES SECTION
     * -------------------------------------------------------- */

    ensureSpace(35);

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10.5);
    doc.setTextColor(15, 23, 42);
    doc.text('ACOUSTIC FEATURES', margin, y);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.5);
    doc.setTextColor(100, 116, 139);
    doc.text('Acoustic feature extraction for deepfake synthesis artifacts', margin, y + 4.5);

    y += 8;

    // Feature Cards Grid (4 columns)
    const colWidth = (contentWidth - 9) / 4;
    const cardHeight = 22;

    const f = result.features || {};
    const rmsVal = typeof f.rmsEnergy === 'number' ? f.rmsEnergy.toFixed(3) : 'N/A';
    const pitchVal =
      typeof f.pitchVariation === 'number'
        ? `${f.pitchVariation.toFixed(1)} Hz`
        : typeof f.pitchMean === 'number'
        ? `${f.pitchMean.toFixed(1)} Hz`
        : 'N/A';
    const centroidVal =
      typeof f.spectralCentroid === 'number'
        ? f.spectralCentroid >= 100
          ? `${(f.spectralCentroid / 1000).toFixed(1)} kHz`
          : `${f.spectralCentroid.toFixed(1)} Hz`
        : 'N/A';
    const zcrVal =
      typeof f.zeroCrossingRate === 'number' ? f.zeroCrossingRate.toFixed(3) : 'N/A';

    const primaryFeatures = [
      { label: 'RMS ENERGY', value: rmsVal, desc: 'Signal amplitude' },
      { label: 'PITCH', value: pitchVal, desc: 'Vocal frequency' },
      { label: 'CENTROID', value: centroidVal, desc: 'Spectral center' },
      { label: 'ZCR', value: zcrVal, desc: 'Zero-crossing rate' },
    ];

    primaryFeatures.forEach((feat, index) => {
      const cardX = margin + index * (colWidth + 3);

      doc.setFillColor(248, 250, 252);
      doc.setDrawColor(226, 232, 240);
      doc.setLineWidth(0.3);
      doc.roundedRect(cardX, y, colWidth, cardHeight, 2, 2, 'FD');

      doc.setFont('helvetica', 'bold');
      doc.setFontSize(7);
      doc.setTextColor(100, 116, 139);
      doc.text(feat.label, cardX + colWidth / 2, y + 5.5, { align: 'center' });

      doc.setFontSize(10);
      doc.setTextColor(0, 163, 196);
      doc.text(feat.value, cardX + colWidth / 2, y + 12, { align: 'center' });

      doc.setFont('helvetica', 'normal');
      doc.setFontSize(6.5);
      doc.setTextColor(148, 163, 184);
      doc.text(feat.desc, cardX + colWidth / 2, y + 17.5, { align: 'center' });
    });

    y += cardHeight + 6;

    // Optional Secondary Features if available
    const secondaryFeaturesList: { label: string; value: string }[] = [];
    if (typeof f.spectralRolloff === 'number' && f.spectralRolloff > 0) {
      secondaryFeaturesList.push({
        label: 'Spectral Rolloff',
        value: `${f.spectralRolloff.toFixed(1)} Hz`,
      });
    }
    if (typeof f.spectralFlatness === 'number' && f.spectralFlatness > 0) {
      secondaryFeaturesList.push({
        label: 'Spectral Flatness',
        value: f.spectralFlatness.toFixed(4),
      });
    }
    if (typeof f.harmonicRatio === 'number' && f.harmonicRatio > 0) {
      secondaryFeaturesList.push({
        label: 'Harmonic Ratio',
        value: `${(f.harmonicRatio * 100).toFixed(1)}%`,
      });
    }
    if (typeof f.temporalModulation === 'number' && f.temporalModulation > 0) {
      secondaryFeaturesList.push({
        label: 'Temporal Modulation',
        value: f.temporalModulation.toFixed(3),
      });
    }

    if (secondaryFeaturesList.length > 0) {
      ensureSpace(16);
      const secColW = (contentWidth - (secondaryFeaturesList.length - 1) * 3) / secondaryFeaturesList.length;
      secondaryFeaturesList.forEach((feat, index) => {
        const secX = margin + index * (secColW + 3);
        doc.setFillColor(248, 250, 252);
        doc.setDrawColor(226, 232, 240);
        doc.roundedRect(secX, y, secColW, 12, 1.5, 1.5, 'FD');

        doc.setFont('helvetica', 'normal');
        doc.setFontSize(6.5);
        doc.setTextColor(100, 116, 139);
        doc.text(feat.label, secX + secColW / 2, y + 4.5, { align: 'center' });

        doc.setFont('helvetica', 'bold');
        doc.setFontSize(8);
        doc.setTextColor(15, 23, 42);
        doc.text(feat.value, secX + secColW / 2, y + 9.5, { align: 'center' });
      });
      y += 16;
    }

    /* --------------------------------------------------------
     * 5. ANALYSIS SUMMARY / EXPLANATION
     * -------------------------------------------------------- */

    if (result.explanation && result.explanation.trim()) {
      ensureSpace(28);

      doc.setFont('helvetica', 'bold');
      doc.setFontSize(9.5);
      doc.setTextColor(15, 23, 42);
      doc.text('ANALYSIS SUMMARY', margin, y);

      y += 4;

      const explLines = doc.splitTextToSize(result.explanation, contentWidth - 14);
      const explHeight = Math.max(16, explLines.length * 4.5 + 8);

      doc.setFillColor(248, 250, 252);
      doc.setDrawColor(226, 232, 240);
      doc.setLineWidth(0.3);
      doc.roundedRect(margin, y, contentWidth, explHeight, 2, 2, 'FD');

      // Accent left border bar
      doc.setFillColor(0, 212, 255);
      doc.rect(margin, y, 2.5, explHeight, 'F');

      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8);
      doc.setTextColor(51, 65, 85);
      doc.text(explLines, margin + 7, y + 6);

      y += explHeight + 6;
    }

    /* --------------------------------------------------------
     * 6. DIAGNOSTICS & FORENSIC EVIDENCE (IF AVAILABLE)
     * -------------------------------------------------------- */

    if (result.diagnostics) {
      ensureSpace(32);

      const d = result.diagnostics;
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(9.5);
      doc.setTextColor(15, 23, 42);
      doc.text('FORENSIC EVIDENCE & DIAGNOSTICS', margin, y);

      y += 4;

      const diagBoxHeight = 22;
      doc.setFillColor(248, 250, 252);
      doc.setDrawColor(226, 232, 240);
      doc.roundedRect(margin, y, contentWidth, diagBoxHeight, 2, 2, 'FD');

      const diagItems = [
        { label: 'AI EVIDENCE', value: `${(d.aiEvidence || 0).toFixed(1)}%` },
        { label: 'REAL EVIDENCE', value: `${(d.realEvidence || 0).toFixed(1)}%` },
        { label: 'MANIPULATION', value: `${(d.manipulationEvidence || 0).toFixed(1)}%` },
        { label: 'RELIABILITY', value: `${((d.sampleReliability || 0) * 100).toFixed(1)}%` },
      ];

      const diagColW = contentWidth / 4;
      diagItems.forEach((diag, index) => {
        const dX = margin + index * diagColW;
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(6.5);
        doc.setTextColor(100, 116, 139);
        doc.text(diag.label, dX + diagColW / 2, y + 6, { align: 'center' });

        doc.setFont('helvetica', 'bold');
        doc.setFontSize(9.5);
        doc.setTextColor(15, 23, 42);
        doc.text(diag.value, dX + diagColW / 2, y + 13, { align: 'center' });
      });

      y += diagBoxHeight + 6;
    }

    /* --------------------------------------------------------
     * 7. PROJECT DISCLAIMER
     * -------------------------------------------------------- */

    ensureSpace(22);

    const disclaimerText =
      'This report is generated by the VoxForensics project for demonstration and educational purposes. Results should not be treated as forensic-grade authentication.';
    const disclaimerLines = doc.splitTextToSize(disclaimerText, contentWidth - 10);
    const disclaimerHeight = disclaimerLines.length * 3.8 + 7;

    doc.setFillColor(241, 245, 249);
    doc.setDrawColor(203, 213, 225);
    doc.setLineWidth(0.3);
    doc.roundedRect(margin, y, contentWidth, disclaimerHeight, 1.5, 1.5, 'FD');

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(6.8);
    doc.setTextColor(71, 85, 105);
    doc.text('DISCLAIMER', margin + 4, y + 4.5);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(6.8);
    doc.setTextColor(100, 116, 139);
    doc.text(disclaimerLines, margin + 4, y + 8.5);

    /* --------------------------------------------------------
     * 8. PAGE NUMBERING & FOOTER (ALL PAGES)
     * -------------------------------------------------------- */

    const totalPages = doc.getNumberOfPages();
    for (let i = 1; i <= totalPages; i++) {
      doc.setPage(i);

      doc.setDrawColor(226, 232, 240);
      doc.setLineWidth(0.3);
      doc.line(margin, pageHeight - 13, pageWidth - margin, pageHeight - 13);

      doc.setFont('helvetica', 'normal');
      doc.setFontSize(7);
      doc.setTextColor(148, 163, 184);
      doc.text(
        'VoxForensics • Deepfake Audio Detection • Automated Analysis Report',
        margin,
        pageHeight - 8.5
      );
      doc.text(
        `Page ${i} of ${totalPages}`,
        pageWidth - margin,
        pageHeight - 8.5,
        { align: 'right' }
      );
    }

    /* --------------------------------------------------------
     * 9. TRIGGER DOWNLOAD
     * -------------------------------------------------------- */

    const safeBase = sanitizeFilename(displayFilename);
    const pdfFilename = `VoxForensics_Analysis_Report_${safeBase}.pdf`;

    doc.save(pdfFilename);
    return true;
  } catch (error) {
    console.error('PDF generation error:', error);
    throw new Error('Unable to generate the PDF report. Please try again.');
  }
}
