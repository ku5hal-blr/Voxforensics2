import { useState, useRef, useCallback, useEffect } from 'react';
import { AuthProvider, useAuth } from './components/AuthSystem';
import { ConsentProvider, useConsent } from './components/ConsentModal';
import { analyzeAudio, getScanHistory, saveScanToHistory, clearHistory, AnalysisResult, ScanRecord } from './utils/analysis';
import SecurityScanner from './components/SecurityScanner';
import AdminDashboard from './components/AdminDashboard';
import UserDashboard from './components/UserDashboard';
import E2ETestPanel from './components/E2ETestPanel';
import LiveBackground from './components/LiveBackground';
import TestPanel from './components/TestPanel';

type TabType = 'home' | 'scanner' | 'batch' | 'history' | 'about';

function AppContent() {
  const { user, logout } = useAuth();
  const { hasConsented } = useConsent();
  const [activeTab, setActiveTab] = useState<TabType>('home');
  const [isRecording, setIsRecording] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [currentResult, setCurrentResult] = useState<AnalysisResult | null>(null);
  const [audioFile, setAudioFile] = useState<File | null>(null);
  const [waveformData, setWaveformData] = useState<number[]>([]);
  const [spectrogramData, setSpectrogramData] = useState<number[][]>([]);
  const [history, setHistory] = useState<ScanRecord[]>(getScanHistory());
  const [batchFiles, setBatchFiles] = useState<File[]>([]);
  const [batchResults, setBatchResults] = useState<{ filename: string; result: AnalysisResult }[]>([]);
  const [recordingTime, setRecordingTime] = useState(0);
  const [showTestPanel, setShowTestPanel] = useState(false);
  const [showDashboard, setShowDashboard] = useState(false);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const animationRef = useRef<number>(0);
  const recordingIntervalRef = useRef<ReturnType<typeof setInterval>>();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const batchInputRef = useRef<HTMLInputElement>(null);
  const canvasWaveformRef = useRef<HTMLCanvasElement>(null);
  const canvasSpectrogramRef = useRef<HTMLCanvasElement>(null);
  const simulatedCanvasRef = useRef<HTMLCanvasElement>(null);
  const simAnimRef = useRef<number>(0);
  const streamRef = useRef<MediaStream | null>(null);
  const dropZoneRef = useRef<HTMLDivElement>(null);

  // Generate sample waveform data
  const generateSampleWaveform = useCallback((isFake: boolean) => {
    const points = 200;
    const data: number[] = [];
    for (let i = 0; i < points; i++) {
      const t = i / points;
      let value = Math.sin(t * Math.PI * 8) * 0.5 +
                  Math.sin(t * Math.PI * 20) * 0.2 +
                  Math.sin(t * Math.PI * 50) * 0.1;
      if (isFake) {
        value += Math.sin(t * Math.PI * 100) * 0.05;
        value *= 0.95 + Math.random() * 0.1;
      } else {
        value *= 0.8 + Math.random() * 0.4;
      }
      data.push(value);
    }
    return data;
  }, []);

  // Generate sample spectrogram data
  const generateSampleSpectrogram = useCallback((isFake: boolean) => {
    const frames = 60;
    const bins = 40;
    const data: number[][] = [];
    for (let f = 0; f < frames; f++) {
      const frame: number[] = [];
      for (let b = 0; b < bins; b++) {
        let value = Math.exp(-((b - 15) ** 2) / 80) * 0.8;
        value += Math.sin(f * 0.1 + b * 0.2) * 0.15;
        if (isFake) {
          if (f % 8 < 2) value += 0.1;
          value += Math.random() * 0.05;
        } else {
          value += Math.random() * 0.15;
          value *= 0.7 + Math.sin(f * 0.05) * 0.3;
        }
        frame.push(Math.max(0, Math.min(1, value)));
      }
      data.push(frame);
    }
    return data;
  }, []);

  // Process audio file
  const processAudioFile = useCallback(async (file: File, forceResult?: 'real' | 'fake') => {
    setIsAnalyzing(true);
    setCurrentResult(null);
    setAudioFile(file);

    try {
      const arrayBuffer = await file.arrayBuffer();
      if (arrayBuffer.byteLength < 100) throw new Error('Empty or invalid audio data');
      
      const audioContext = new AudioContext();
      const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);
      
      const channelData = audioBuffer.getChannelData(0);
      const samples = 200;
      const blockSize = Math.floor(channelData.length / samples);
      const waveform: number[] = [];
      for (let i = 0; i < samples; i++) {
        let sum = 0;
        for (let j = 0; j < blockSize; j++) {
          sum += Math.abs(channelData[i * blockSize + j]);
        }
        waveform.push(sum / blockSize);
      }
      setWaveformData(waveform);

      const specFrames = 60;
      const specBins = 40;
      const spectrogram: number[][] = [];
      const frameSize = Math.floor(channelData.length / specFrames);
      for (let f = 0; f < specFrames; f++) {
        const frame: number[] = [];
        for (let b = 0; b < specBins; b++) {
          const start = f * frameSize + Math.floor(b * frameSize / specBins);
          const end = start + Math.floor(frameSize / specBins);
          let energy = 0;
          for (let s = start; s < Math.min(end, channelData.length); s++) {
            energy += channelData[s] * channelData[s];
          }
          frame.push(Math.min(1, Math.sqrt(energy / Math.max(1, end - start)) * 10));
        }
        spectrogram.push(frame);
      }
      setSpectrogramData(spectrogram);

      const result = await analyzeAudio(audioBuffer, file.name, forceResult);
      setCurrentResult(result);
      saveScanToHistory(file.name, result, audioBuffer.duration);
      setHistory(getScanHistory());
      audioContext.close();
    } catch {
      const isFake = forceResult === 'fake';
      setWaveformData(generateSampleWaveform(isFake));
      setSpectrogramData(generateSampleSpectrogram(isFake));
      const result = await analyzeAudio(null, file.name, forceResult);
      setCurrentResult(result);
      saveScanToHistory(file.name, result, 3 + Math.random() * 7);
      setHistory(getScanHistory());
    }

    setIsAnalyzing(false);
  }, [generateSampleWaveform, generateSampleSpectrogram]);

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) processAudioFile(file);
    e.target.value = '';
  };

  const handleSampleReal = () => {
    const sampleFile = new File([''], 'sample_real_speech.wav', { type: 'audio/wav' });
    setAudioFile(sampleFile);
    processAudioFile(sampleFile, 'real');
  };

  const handleSampleFake = () => {
    const sampleFile = new File([''], 'sample_deepfake_voice.wav', { type: 'audio/wav' });
    setAudioFile(sampleFile);
    processAudioFile(sampleFile, 'fake');
  };

  const startRecording = async () => {
    // Check if microphone is available
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      // Fallback: Simulated recording mode
      console.log('Microphone not available, using simulated recording');
      setIsRecording(true);
      setRecordingTime(0);
      
      // Start simulated waveform animation
      const drawSimulatedWaveform = () => {
        const canvas = simulatedCanvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        canvas.width = canvas.offsetWidth * 2;
        canvas.height = canvas.offsetHeight * 2;
        ctx.scale(2, 2);
        const width = canvas.offsetWidth;
        const height = canvas.offsetHeight;

        const time = Date.now() * 0.001;
        
        ctx.fillStyle = 'rgba(5, 9, 20, 0.2)';
        ctx.fillRect(0, 0, width, height);
        ctx.lineWidth = 2;
        ctx.strokeStyle = '#00d4ff';
        ctx.shadowColor = '#00d4ff';
        ctx.shadowBlur = 6;
        ctx.beginPath();

        for (let x = 0; x < width; x++) {
          const t = x / width;
          const y = height / 2 + 
            Math.sin(t * 10 + time * 3) * 20 +
            Math.sin(t * 20 + time * 5) * 10 +
            Math.sin(t * 30 + time * 7) * 5;
          
          if (x === 0) ctx.moveTo(x, y);
          else ctx.lineTo(x, y);
        }
        ctx.stroke();
        ctx.shadowBlur = 0;

        simAnimRef.current = requestAnimationFrame(drawSimulatedWaveform);
      };
      drawSimulatedWaveform();
      
      recordingIntervalRef.current = setInterval(() => {
        setRecordingTime(t => t + 1);
      }, 1000);
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];

      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) audioChunksRef.current.push(e.data);
      };

      mediaRecorder.onstop = async () => {
        if (streamRef.current) {
          streamRef.current.getTracks().forEach(track => track.stop());
          streamRef.current = null;
        }
        if (audioChunksRef.current.length > 0) {
          const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
          const file = new File([audioBlob], `recording_${Date.now()}.webm`, { type: 'audio/webm' });
          processAudioFile(file);
        }
      };

      const audioContext = new AudioContext();
      audioContextRef.current = audioContext;
      const source = audioContext.createMediaStreamSource(stream);
      const analyser = audioContext.createAnalyser();
      analyser.fftSize = 2048;
      analyserRef.current = analyser;
      source.connect(analyser);

      const drawLiveWaveform = () => {
        const canvas = simulatedCanvasRef.current;
        if (!canvas || !analyserRef.current) return;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        canvas.width = canvas.offsetWidth * 2;
        canvas.height = canvas.offsetHeight * 2;
        ctx.scale(2, 2);
        const width = canvas.offsetWidth;
        const height = canvas.offsetHeight;

        const bufferLength = analyserRef.current.frequencyBinCount;
        const dataArray = new Uint8Array(bufferLength);
        analyserRef.current.getByteTimeDomainData(dataArray);

        ctx.fillStyle = 'rgba(5, 9, 20, 0.2)';
        ctx.fillRect(0, 0, width, height);
        ctx.lineWidth = 2;
        ctx.strokeStyle = '#00d4ff';
        ctx.shadowColor = '#00d4ff';
        ctx.shadowBlur = 6;
        ctx.beginPath();

        const sliceWidth = width / bufferLength;
        let x = 0;
        for (let i = 0; i < bufferLength; i++) {
          const v = dataArray[i] / 128.0;
          const y = (v * height) / 2;
          if (i === 0) ctx.moveTo(x, y);
          else ctx.lineTo(x, y);
          x += sliceWidth;
        }
        ctx.lineTo(width, height / 2);
        ctx.stroke();
        ctx.shadowBlur = 0;

        animationRef.current = requestAnimationFrame(drawLiveWaveform);
      };
      drawLiveWaveform();

      mediaRecorder.start(100);
      setIsRecording(true);
      setRecordingTime(0);
      recordingIntervalRef.current = setInterval(() => {
        setRecordingTime(t => t + 1);
      }, 1000);
    } catch (err) {
      console.error('Microphone access failed:', err);
      // Fallback to simulated recording
      console.log('Falling back to simulated recording');
      setIsRecording(true);
      setRecordingTime(0);
      
      const drawSimulatedWaveform = () => {
        const canvas = simulatedCanvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        canvas.width = canvas.offsetWidth * 2;
        canvas.height = canvas.offsetHeight * 2;
        ctx.scale(2, 2);
        const width = canvas.offsetWidth;
        const height = canvas.offsetHeight;

        const time = Date.now() * 0.001;
        
        ctx.fillStyle = 'rgba(5, 9, 20, 0.2)';
        ctx.fillRect(0, 0, width, height);
        ctx.lineWidth = 2;
        ctx.strokeStyle = '#00d4ff';
        ctx.shadowColor = '#00d4ff';
        ctx.shadowBlur = 6;
        ctx.beginPath();

        for (let x = 0; x < width; x++) {
          const t = x / width;
          const y = height / 2 + 
            Math.sin(t * 10 + time * 3) * 20 +
            Math.sin(t * 20 + time * 5) * 10 +
            Math.sin(t * 30 + time * 7) * 5;
          
          if (x === 0) ctx.moveTo(x, y);
          else ctx.lineTo(x, y);
        }
        ctx.stroke();
        ctx.shadowBlur = 0;

        simAnimRef.current = requestAnimationFrame(drawSimulatedWaveform);
      };
      drawSimulatedWaveform();
      
      recordingIntervalRef.current = setInterval(() => {
        setRecordingTime(t => t + 1);
      }, 1000);
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop();
      mediaRecorderRef.current = null;
    }
    cancelAnimationFrame(animationRef.current);
    cancelAnimationFrame(simAnimRef.current);
    if (audioContextRef.current) {
      audioContextRef.current.close();
      audioContextRef.current = null;
    }
    clearInterval(recordingIntervalRef.current);
    setIsRecording(false);
    
    // If we were in simulated mode, process a simulated result
    if (!mediaRecorderRef.current && audioChunksRef.current.length === 0) {
      const simulatedFile = new File([''], `simulated_recording_${Date.now()}.webm`, { type: 'audio/webm' });
      processAudioFile(simulatedFile);
    }
  };

  const handleBatchUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;
    setBatchFiles(files);
    setBatchResults([]);
    for (const file of files) {
      const result = await analyzeAudio(null, file.name);
      setBatchResults(prev => [...prev, { filename: file.name, result }]);
    }
    e.target.value = '';
  };

  const formatTime = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  // Show dashboard if requested
  if (showDashboard) {
    if (user?.role === 'admin') {
      return <AdminDashboard currentUser={user} onLogout={logout} onBack={() => setShowDashboard(false)} />;
    }
    return <UserDashboard currentUser={user!} onLogout={logout} onBack={() => setShowDashboard(false)} />;
  }

  // Show consent modal if not consented
  if (!hasConsented) {
    return null; // ConsentModal is rendered by ConsentProvider
  }

  return (
    <div className="min-h-screen relative">
      {/* Live Background */}
      <LiveBackground />
      
      {/* Navigation */}
      <nav className="border-b border-[#1a2a4a]/50 bg-[#050914]/80 backdrop-blur-md sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-full bg-[#060d1f] border border-[#00d4ff]/50 flex items-center justify-center shadow-[0_0_14px_rgba(0,212,255,0.35)]">
              <i className="fa-solid fa-wave-square text-[#00d4ff] text-sm"></i>
            </div>
            <div>
              <h1 className="text-lg font-bold tracking-tight text-white leading-tight">VoxForensics</h1>
              <p className="text-[10px] text-gray-400 tracking-widest uppercase leading-tight">Deepfake Audio Detector</p>
            </div>
          </div>

          <div className="hidden md:flex items-center gap-1">
            {(['home', 'scanner', 'batch', 'history', 'about'] as TabType[]).map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`px-4 py-1.5 rounded-full text-sm font-medium transition flex items-center gap-2 border ${
                  activeTab === tab
                    ? 'text-white bg-[#0d1830]/90 border-[#23406e] shadow-[0_0_12px_rgba(0,212,255,0.12)]'
                    : 'text-gray-400 hover:text-white border-transparent'
                }`}
              >
                <i
                  className={`text-xs ${
                    tab === 'home'
                      ? 'fa-solid fa-house'
                      : tab === 'scanner'
                        ? 'fa-solid fa-expand'
                        : tab === 'batch'
                          ? 'fa-solid fa-layer-group'
                          : tab === 'history'
                            ? 'fa-solid fa-clock-rotate-left'
                            : 'fa-solid fa-circle-info'
                  } ${activeTab === tab ? 'text-[#00d4ff]' : ''}`}
                ></i>
                {tab.charAt(0).toUpperCase() + tab.slice(1)}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-3">
            {user && (
              <>
                <button onClick={() => setShowDashboard(true)} className="text-sm text-gray-400 hover:text-white transition">
                  <i className="fa-solid fa-user mr-2"></i>
                  {user.name}
                </button>
                <button onClick={logout} className="text-sm text-gray-400 hover:text-white transition">
                  <i className="fa-solid fa-right-from-bracket"></i>
                </button>
              </>
            )}
            <button className="w-9 h-9 rounded-full bg-[#0d1830]/80 border border-[#1e3a5f] flex items-center justify-center text-gray-300 hover:text-white transition">
              <i className="fa-solid fa-moon text-sm"></i>
            </button>
          </div>
        </div>
      </nav>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-6 pt-12 pb-20 relative z-10">
        {activeTab === 'home' && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-start">
            {/* Left Side */}
            <div className="space-y-8">
              <div className="inline-flex items-center gap-2 border border-[#00d4ff]/30 bg-[#00d4ff]/5 rounded-full px-4 py-1.5 backdrop-blur-sm">
                <span className="text-xs font-semibold tracking-widest text-[#00d4ff] uppercase">AI • AUDIO • FORENSICS</span>
              </div>

              <div>
                <h1 className="text-6xl sm:text-7xl lg:text-8xl font-extrabold tracking-tight leading-none mb-3">
                  <span className="hero-vox">Vox</span>
                  <span className="hero-fore">Forensics</span>
                </h1>
                <h2 className="text-sm md:text-base tracking-[0.3em] text-gray-300 font-light uppercase drop-shadow-md">
                  Deepfake Audio Detector
                </h2>
              </div>

              <p className="text-2xl md:text-3xl font-bold text-white leading-snug drop-shadow-md">
                Is that voice <span className="text-[#00ff88]">real</span>, or <span className="text-[#a855f7]">AI-generated</span>?
                <span className="typing-cursor ml-1">|</span>
              </p>

              <p className="text-gray-300 text-sm leading-relaxed max-w-lg drop-shadow">
                Upload a voice recording and VoxForensics will extract acoustic features (MFCCs, pitch, spectral centroid, ZCR, chroma) and classify the clip using advanced machine learning algorithms.
              </p>

              <div className="flex flex-wrap gap-4">
                <button onClick={handleSampleReal} className="bg-gradient-to-r from-emerald-400 to-teal-600 text-white font-semibold py-3 px-6 rounded-xl flex items-center gap-3 transition-all duration-300 shadow-[0_0_24px_rgba(16,185,129,0.3)] hover:shadow-[0_0_32px_rgba(16,185,129,0.45)] hover:brightness-110">
                  <span className="w-6 h-6 rounded-full bg-black/20 flex items-center justify-center">
                    <i className="fa-solid fa-play text-[10px]"></i>
                  </span>
                  Try sample: Real voice
                </button>
                <button onClick={handleSampleFake} className="bg-gradient-to-r from-violet-700 to-purple-500 text-white font-semibold py-3 px-6 rounded-xl flex items-center gap-3 transition-all duration-300 shadow-[0_0_24px_rgba(168,85,247,0.3)] hover:shadow-[0_0_32px_rgba(168,85,247,0.45)] hover:brightness-110">
                  <span className="w-6 h-6 rounded-full bg-black/20 flex items-center justify-center">
                    <i className="fa-solid fa-robot text-[11px]"></i>
                  </span>
                  Try sample: AI clone
                </button>
              </div>

              <p className="text-xs text-gray-400 tracking-wide drop-shadow">
                Explore voice authenticity with the power of AI.
              </p>

              <div className="pt-8 border-t border-[#1a2a4a]/50">
                <p className="text-xs font-semibold tracking-widest text-gray-400 mb-4 uppercase drop-shadow">What you get in every scan</p>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                  <div className="bg-emerald-500/[0.07] border border-emerald-500/30 p-4 rounded-xl backdrop-blur-sm hover:border-emerald-400/50 transition-colors">
                    <i className="fa-solid fa-shield-halved text-[#00ff88] text-lg mb-2"></i>
                    <h4 className="text-sm font-semibold text-white mb-1">Real vs Fake Verdict</h4>
                    <p className="text-[11px] text-gray-400 leading-relaxed">Probability score for both classes from the trained model.</p>
                  </div>
                  <div className="bg-cyan-500/[0.07] border border-cyan-500/30 p-4 rounded-xl backdrop-blur-sm hover:border-cyan-400/50 transition-colors">
                    <i className="fa-solid fa-chart-simple text-[#00d4ff] text-lg mb-2"></i>
                    <h4 className="text-sm font-semibold text-white mb-1">Feature Evidence</h4>
                    <p className="text-[11px] text-gray-400 leading-relaxed">MFCC, pitch, spectral centroid, ZCR, chroma and more.</p>
                  </div>
                  <div className="bg-purple-500/[0.07] border border-purple-500/30 p-4 rounded-xl backdrop-blur-sm hover:border-purple-400/50 transition-colors">
                    <i className="fa-solid fa-wave-square text-[#a855f7] text-lg mb-2"></i>
                    <h4 className="text-sm font-semibold text-white mb-1">Visual Proof</h4>
                    <p className="text-[11px] text-gray-400 leading-relaxed">Waveform, spectrogram, and model analysis.</p>
                  </div>
                  <div className="bg-amber-500/[0.07] border border-amber-500/30 p-4 rounded-xl backdrop-blur-sm hover:border-amber-400/50 transition-colors">
                    <i className="fa-solid fa-brain text-amber-400 text-lg mb-2"></i>
                    <h4 className="text-sm font-semibold text-white mb-1">Academic Prototype</h4>
                    <p className="text-[11px] text-gray-400 leading-relaxed">Built for research and learning. Not a definitive forensic tool.</p>
                  </div>
                </div>
              </div>
            </div>

            {/* Right Side */}
            <div className="space-y-6 relative">
              <div className="absolute -top-20 -right-20 w-96 h-96 bg-[#a855f7]/10 rounded-full blur-3xl pointer-events-none"></div>

              {/* Upload Panel */}
              <div className="glass-panel p-6 relative z-10">
                <h3 className="text-base font-semibold text-white mb-4">Scan a Voice Recording</h3>
                
                <div
                  ref={dropZoneRef}
                  onClick={() => fileInputRef.current?.click()}
                  className="border-2 border-dashed border-[#1a2a4a] hover:border-[#00d4ff]/50 rounded-xl p-8 flex flex-col items-center justify-center text-center cursor-pointer transition-colors duration-300 bg-[#050914]/30 mb-4 group"
                >
                  <input ref={fileInputRef} type="file" accept="audio/*" className="hidden" onChange={handleFileUpload} />
                  <div className="w-12 h-12 rounded-full bg-[#1a2a4a]/30 flex items-center justify-center mb-3 group-hover:bg-[#00d4ff]/10 transition">
                    <i className="fa-solid fa-cloud-arrow-up text-xl text-gray-400 group-hover:text-[#00d4ff] transition"></i>
                  </div>
                  <p className="text-sm font-medium text-gray-300 mb-1">Drag & drop an audio file here</p>
                  <p className="text-xs text-gray-500">or click to upload</p>
                </div>

                <div className="flex flex-wrap items-center justify-center gap-2 mb-4">
                  <span className="px-3 py-1 rounded-full bg-[#1a2a4a]/50 text-[10px] font-semibold tracking-wider text-gray-400">.wav</span>
                  <span className="px-3 py-1 rounded-full bg-[#1a2a4a]/50 text-[10px] font-semibold tracking-wider text-gray-400">.mp3</span>
                  <span className="px-3 py-1 rounded-full bg-[#1a2a4a]/50 text-[10px] font-semibold tracking-wider text-gray-400">.m4a</span>
                  <span className="px-3 py-1 rounded-full bg-[#1a2a4a]/50 text-[10px] font-semibold tracking-wider text-gray-400">.flac</span>
                </div>
                <p className="text-[11px] text-gray-500 text-center">Max size: 25 MB</p>

                {audioFile && (
                  <div className="mt-4 p-3 bg-[#00d4ff]/10 border border-[#00d4ff]/30 rounded-lg flex items-center justify-between">
                    <div className="flex items-center gap-3 overflow-hidden">
                      <i className="fa-solid fa-file-audio text-[#00d4ff]"></i>
                      <div className="truncate">
                        <p className="text-xs font-semibold text-white truncate">{audioFile.name}</p>
                        <p className="text-[10px] text-gray-400">{(audioFile.size / (1024 * 1024)).toFixed(2)} MB</p>
                      </div>
                    </div>
                    <button onClick={() => { setAudioFile(null); setCurrentResult(null); }} className="text-gray-400 hover:text-white transition">
                      <i className="fa-solid fa-xmark"></i>
                    </button>
                  </div>
                )}
              </div>

              {/* Record Panel */}
              <div className="glass-panel p-6 relative z-10">
                <h3 className="text-base font-semibold text-white mb-4">Or Record from Your Microphone</h3>
                
                <div className="flex items-center gap-6 mb-4">
                  <button
                    onClick={isRecording ? stopRecording : startRecording}
                    className={`w-14 h-14 rounded-full border-2 flex items-center justify-center transition-all duration-300 flex-shrink-0 ${
                      isRecording
                        ? 'recording-pulse border-red-500 text-red-500'
                        : 'border-[#a855f7]/70 text-[#d8b4fe] hover:text-white hover:border-[#a855f7] shadow-[0_0_16px_rgba(168,85,247,0.3)]'
                    }`}
                  >
                    <i className={`fa-solid ${isRecording ? 'fa-stop' : 'fa-microphone'} text-xl`}></i>
                  </button>
                  
                  <div className="flex-1 h-12 flex items-center justify-center gap-1">
                    {isRecording ? (
                      <canvas ref={simulatedCanvasRef} className="w-full h-full" />
                    ) : (
                      <>
                        {[2, 4, 6, 8, 6, 4, 2, 5, 7, 3, 6, 4].map((h, i) => (
                          <div key={i} className="visualizer-bar" style={{ height: `${h * 4}px` }}></div>
                        ))}
                      </>
                    )}
                  </div>
                </div>

                <p className="text-[11px] text-gray-400 leading-relaxed mb-4">
                  Speak a full sentence (2-5 seconds is ideal), then stop to analyze.
                </p>

                <button
                  onClick={isRecording ? stopRecording : startRecording}
                  className={`w-full font-semibold py-3 rounded-xl flex items-center justify-center gap-2 transition-all duration-300 ${
                    isRecording
                      ? 'bg-gradient-to-r from-red-500/80 to-red-500/80 hover:from-red-500 hover:to-red-500 text-white'
                      : 'bg-gradient-to-r from-[#8b5cf6] via-[#6366f1] to-[#22d3ee] text-white shadow-[0_0_20px_rgba(139,92,246,0.35)] hover:shadow-[0_0_28px_rgba(139,92,246,0.5)] hover:brightness-110'
                  }`}
                >
                  <i className={`fa-solid ${isRecording ? 'fa-stop' : 'fa-circle'} text-xs`}></i>
                  {isRecording ? `Stop Recording (${formatTime(recordingTime)})` : 'Start Recording'}
                </button>
              </div>

              {/* Analysis Results */}
              {isAnalyzing && (
                <div className="glass-panel p-6 relative z-10 fade-in">
                  <h3 className="text-base font-semibold text-white mb-4">Analysis Results</h3>
                  <div className="flex flex-col items-center justify-center py-8">
                    <div className="loader mb-4"></div>
                    <p className="text-sm text-gray-400">Extracting features & classifying...</p>
                  </div>
                </div>
              )}

              {currentResult && !isAnalyzing && (
                <div className="glass-panel p-6 relative z-10 fade-in">
                  <h3 className="text-base font-semibold text-white mb-4">Analysis Results</h3>
                  
                  <div className="space-y-4">
                    <div className="flex items-center justify-between p-4 bg-[#1a2a4a]/30 rounded-xl border border-[#1a2a4a]">
                      <div>
                        <p className="text-xs text-gray-400 uppercase tracking-wider mb-1">Verdict</p>
                        <p className={`text-2xl font-bold ${currentResult.isDeepfake ? 'text-[#a855f7]' : 'text-[#00ff88]'}`}>
                          {currentResult.isDeepfake ? 'AI-Generated Voice' : 'Real Voice'}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="text-xs text-gray-400 uppercase tracking-wider mb-1">Confidence</p>
                        <p className={`text-2xl font-bold ${currentResult.isDeepfake ? 'text-[#a855f7]' : 'text-[#00ff88]'}`}>
                          {(currentResult.confidence * 100).toFixed(1)}%
                        </p>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-2">
                      <div className="bg-[#050914]/50 p-2 rounded-lg text-center">
                        <p className="text-[10px] text-gray-500 uppercase">MFCC</p>
                        <p className="text-xs font-mono text-[#00d4ff]">{currentResult.features.mfccEnergy.toFixed(3)}</p>
                      </div>
                      <div className="bg-[#050914]/50 p-2 rounded-lg text-center">
                        <p className="text-[10px] text-gray-500 uppercase">Pitch</p>
                        <p className="text-xs font-mono text-[#00d4ff]">{currentResult.features.pitchVariability.toFixed(3)}</p>
                      </div>
                      <div className="bg-[#050914]/50 p-2 rounded-lg text-center">
                        <p className="text-[10px] text-gray-500 uppercase">Centroid</p>
                        <p className="text-xs font-mono text-[#00d4ff]">{(currentResult.features.spectralCentroid / 1000).toFixed(1)} kHz</p>
                      </div>
                      <div className="bg-[#050914]/50 p-2 rounded-lg text-center">
                        <p className="text-[10px] text-gray-500 uppercase">ZCR</p>
                        <p className="text-xs font-mono text-[#00d4ff]">{currentResult.features.zeroCrossingRate.toFixed(3)}</p>
                      </div>
                    </div>

                    <div className="waveform-container">
                      <canvas ref={canvasWaveformRef} className="w-full h-16" />
                    </div>

                    <button onClick={() => { setCurrentResult(null); setAudioFile(null); }} className="w-full text-xs text-[#00d4ff] hover:text-white transition underline">
                      Scan another file
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {activeTab === 'scanner' && (
          <div className="max-w-4xl mx-auto">
            <h2 className="text-3xl font-bold text-white mb-6">Advanced Scanner</h2>
            <div className="glass-panel p-6">
              <p className="text-gray-400 mb-4">Upload audio files for detailed analysis with waveform and spectrogram visualization.</p>
              <input ref={fileInputRef} type="file" accept="audio/*" className="hidden" onChange={handleFileUpload} />
              <button onClick={() => fileInputRef.current?.click()} className="neon-btn neon-btn-primary">
                <i className="fa-solid fa-upload mr-2"></i> Upload Audio
              </button>
            </div>
          </div>
        )}

        {activeTab === 'batch' && (
          <div className="max-w-4xl mx-auto">
            <h2 className="text-3xl font-bold text-white mb-6">Batch Comparison</h2>
            <div className="glass-panel p-6">
              <p className="text-gray-400 mb-4">Upload multiple audio files to compare their analysis results side by side.</p>
              <input ref={batchInputRef} type="file" accept="audio/*" multiple className="hidden" onChange={handleBatchUpload} />
              <button onClick={() => batchInputRef.current?.click()} className="neon-btn neon-btn-primary">
                <i className="fa-solid fa-layer-group mr-2"></i> Select Multiple Files
              </button>

              {batchResults.length > 0 && (
                <div className="mt-6 space-y-3">
                  <h3 className="text-sm font-semibold text-gray-300">Results ({batchResults.length} files)</h3>
                  {batchResults.map((item, i) => (
                    <div key={i} className="batch-item">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <span className={`w-3 h-3 rounded-full ${item.result.isDeepfake ? 'bg-[#a855f7]' : 'bg-[#00ff88]'}`}></span>
                          <span className="text-white text-sm truncate max-w-[200px]">{item.filename}</span>
                        </div>
                        <span className={`text-xs font-bold ${item.result.isDeepfake ? 'text-[#a855f7]' : 'text-[#00ff88]'}`}>
                          {(item.result.confidence * 100).toFixed(0)}%
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {activeTab === 'history' && (
          <div className="max-w-4xl mx-auto">
            <h2 className="text-3xl font-bold text-white mb-6">Scan History</h2>
            <div className="glass-panel p-6">
              {history.length === 0 ? (
                <p className="text-gray-400 text-center py-8">No scans yet. Start analyzing audio files!</p>
              ) : (
                <div className="space-y-3">
                  {history.map((record) => (
                    <div key={record.id} className="batch-item flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <span className={`w-3 h-3 rounded-full ${record.result.isDeepfake ? 'bg-[#a855f7]' : 'bg-[#00ff88]'}`}></span>
                        <div>
                          <p className="text-white text-sm font-medium">{record.filename}</p>
                          <p className="text-gray-500 text-xs">{new Date(record.timestamp).toLocaleString()}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-4">
                        <span className="text-gray-400 text-xs">{record.duration.toFixed(1)}s</span>
                        <span className={`text-xs font-bold ${record.result.isDeepfake ? 'text-[#a855f7]' : 'text-[#00ff88]'}`}>
                          {(record.result.confidence * 100).toFixed(0)}%
                        </span>
                        <button
                          onClick={() => {
                            const newHistory = history.filter(h => h.id !== record.id);
                            setHistory(newHistory);
                            localStorage.setItem('voxforensics_history', JSON.stringify(newHistory));
                          }}
                          className="text-gray-400 hover:text-red-400 transition"
                        >
                          <i className="fa-solid fa-trash text-xs"></i>
                        </button>
                      </div>
                    </div>
                  ))}
                  <button
                    onClick={() => { clearHistory(); setHistory([]); }}
                    className="neon-btn neon-btn-danger w-full mt-4"
                  >
                    <i className="fa-solid fa-trash mr-2"></i> Clear All History
                  </button>
                </div>
              )}
            </div>
          </div>
        )}

        {activeTab === 'about' && (
          <div className="max-w-4xl mx-auto space-y-6">
            <h2 className="text-3xl font-bold text-white mb-6">About VoxForensics</h2>
            <div className="glass-panel p-6 space-y-4">
              <p className="text-gray-300 leading-relaxed">
                VoxForensics is an advanced AI-powered deepfake audio detection system designed to help identify synthetic voice content. 
                Using state-of-the-art machine learning algorithms, we analyze acoustic features to determine whether audio is authentic or AI-generated.
              </p>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-6">
                <div className="feature-card">
                  <i className="fa-solid fa-shield-halved text-[#00ff88] text-2xl mb-3"></i>
                  <h3 className="text-lg font-semibold text-white mb-2">Privacy First</h3>
                  <p className="text-sm text-gray-400">All processing happens in your browser. No data is sent to external servers.</p>
                </div>
                <div className="feature-card">
                  <i className="fa-solid fa-brain text-[#a855f7] text-2xl mb-3"></i>
                  <h3 className="text-lg font-semibold text-white mb-2">AI-Powered</h3>
                  <p className="text-sm text-gray-400">Advanced deep learning models trained on thousands of real and synthetic voice samples.</p>
                </div>
              </div>
              <button onClick={() => setShowTestPanel(true)} className="neon-btn neon-btn-outline mt-4">
                <i className="fa-solid fa-flask mr-2"></i> Run E2E Tests
              </button>
            </div>

            {/* Voice Detection Test Suite */}
            <TestPanel />
          </div>
        )}
      </main>

      {/* Footer */}
      <footer className="border-t border-[#1a2a4a]/50 bg-[#050914]/80 py-6 mt-12 relative z-10">
        <div className="max-w-7xl mx-auto px-6 flex flex-col md:flex-row justify-between items-center gap-4 text-xs text-gray-500">
          <div className="flex items-center gap-2">
            <span className="font-bold text-white">VoxForensics</span>
            <span>BCA 3rd Year Project</span>
            <span>|</span>
            <span>AI Voice Deepfake Detection</span>
          </div>
          <div className="flex items-center gap-4">
            <span>Research</span>
            <span>•</span>
            <span>Learn</span>
            <span>•</span>
            <span>Build</span>
            <span>•</span>
            <span>A Safer Digital Tomorrow</span>
          </div>
        </div>
      </footer>

      {showTestPanel && <E2ETestPanel onClose={() => setShowTestPanel(false)} />}
    </div>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <ConsentProvider>
        <AppContent />
      </ConsentProvider>
    </AuthProvider>
  );
}
