import { useState, useEffect, useRef } from 'react';
import {
  Play,
  Pause,
  RotateCcw,
  Volume2,
  VolumeX,
  Maximize2,
  Sparkles,
  Layers,
  Wrench,
  AlertTriangle,
  Clock,
  Gauge,
  Thermometer,
  ShieldCheck,
  CheckCircle2,
  RefreshCw,
  Eye,
  Sliders,
  Award,
} from 'lucide-react';
import { RepairGuide, AIVideoTutorial, VideoChapter } from '../types';

interface GuideVideoTutorialTabProps {
  guide: RepairGuide;
}

export default function GuideVideoTutorialTab({ guide }: GuideVideoTutorialTabProps) {
  const [tutorial, setTutorial] = useState<AIVideoTutorial | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [source, setSource] = useState<string>('');

  // Video playback states
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [currentTime, setCurrentTime] = useState<number>(0);
  const [duration, setDuration] = useState<number>(0);
  const [isMuted, setIsMuted] = useState<boolean>(false);
  const [activeChapterIndex, setActiveChapterIndex] = useState<number>(0);
  const [playbackSpeed, setPlaybackSpeed] = useState<number>(1);
  const [showOverlays, setShowOverlays] = useState<boolean>(true);

  // Fetch AI generated video tutorial on mount or when guide changes
  useEffect(() => {
    let isMounted = true;
    const fetchTutorial = async () => {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch('/api/repair/video-tutorial', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            guideId: guide.id,
            title: guide.title,
            deviceModel: guide.deviceModel,
            deviceCategory: guide.deviceCategory,
            issueType: guide.issueType,
            steps: guide.steps,
            toolsRequired: guide.toolsRequired,
          }),
        });

        if (!res.ok) {
          throw new Error(`HTTP error ${res.status}`);
        }

        const data = await res.json();
        if (isMounted && data.success && data.tutorial) {
          setTutorial(data.tutorial);
          setSource(data.source || 'ai-bench-director');
        }
      } catch (err: any) {
        console.error('Failed to load video tutorial:', err);
        if (isMounted) {
          setError('Could not load AI Video Tutorial. Using default bench video.');
        }
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    };

    fetchTutorial();

    return () => {
      isMounted = false;
    };
  }, [guide.id, guide.title, guide.deviceModel, guide.deviceCategory, guide.issueType]);

  // Video time update listener
  const handleTimeUpdate = () => {
    if (!videoRef.current) return;
    const cur = videoRef.current.currentTime;
    setCurrentTime(cur);

    if (tutorial?.chapters && tutorial.chapters.length > 0) {
      // Find current chapter
      let idx = 0;
      for (let i = 0; i < tutorial.chapters.length; i++) {
        if (cur >= tutorial.chapters[i].seconds) {
          idx = i;
        }
      }
      setActiveChapterIndex(idx);
    }
  };

  const handleLoadedMetadata = () => {
    if (videoRef.current) {
      setDuration(videoRef.current.duration || tutorial?.totalDurationSeconds || 0);
    }
  };

  const togglePlay = () => {
    if (!videoRef.current) return;
    if (isPlaying) {
      videoRef.current.pause();
      setIsPlaying(false);
    } else {
      videoRef.current.play();
      setIsPlaying(true);
    }
  };

  const toggleMute = () => {
    if (!videoRef.current) return;
    videoRef.current.muted = !isMuted;
    setIsMuted(!isMuted);
  };

  const seekTo = (seconds: number) => {
    if (!videoRef.current) return;
    videoRef.current.currentTime = seconds;
    setCurrentTime(seconds);
    if (!isPlaying) {
      videoRef.current.play();
      setIsPlaying(true);
    }
  };

  const changeSpeed = (speed: number) => {
    if (!videoRef.current) return;
    videoRef.current.playbackRate = speed;
    setPlaybackSpeed(speed);
  };

  const formatTime = (secs: number) => {
    const m = Math.floor(secs / 60);
    const s = Math.floor(secs % 60);
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  const currentChapter = tutorial?.chapters?.[activeChapterIndex];

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="p-4 sm:p-5 rounded-2xl bg-stone-900 text-stone-100 border border-stone-800 shadow-md flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-amber-400/20 text-amber-300 border border-amber-400/30 text-xs font-bold">
              <Sparkles className="w-3.5 h-3.5 text-amber-400" />
              AI Synthesized Video Masterclass
            </span>
            {source.includes('gemini') && (
              <span className="text-[11px] font-mono text-stone-400">
                • Powered by Gemini AI
              </span>
            )}
          </div>
          <h2 className="text-lg sm:text-xl font-black text-white">
            {tutorial ? tutorial.title : `AI Video Guide: ${guide.title}`}
          </h2>
          <p className="text-xs text-stone-300">
            Microscope video stream synchronized with real-time test point overlays, tool specs, and chapter jumping.
          </p>
        </div>

        {tutorial && (
          <div className="flex items-center gap-3 shrink-0">
            <div className="text-right">
              <span className="block text-[11px] text-stone-400 font-semibold">Lead Instructor</span>
              <span className="block text-xs font-bold text-amber-400">{tutorial.instructorName}</span>
              <span className="block text-[10px] text-stone-400">{tutorial.instructorRole}</span>
            </div>
            <div className="w-10 h-10 rounded-xl bg-amber-400/20 border border-amber-400/40 text-amber-400 flex items-center justify-center font-black text-sm shadow-xs">
              <Award className="w-5 h-5" />
            </div>
          </div>
        )}
      </div>

      {loading ? (
        <div className="py-20 flex flex-col items-center justify-center space-y-4 rounded-3xl bg-stone-900/40 border border-stone-800 text-center">
          <RefreshCw className="w-8 h-8 text-amber-400 animate-spin" />
          <div className="space-y-1">
            <p className="text-sm font-bold text-stone-200">Synthesizing AI Video Tutorial...</p>
            <p className="text-xs text-stone-400 max-w-sm">
              Analyzing guide steps for {guide.deviceModel}, calibrating microscope chapters, and assembling bench overlay telemetry.
            </p>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          
          {/* Main Video & Media Stage */}
          <div className="lg:col-span-8 space-y-4">
            {/* Video Viewport Container */}
            <div className="relative aspect-video w-full rounded-2xl overflow-hidden bg-stone-950 border border-stone-800 shadow-xl group">
              <video
                ref={videoRef}
                src={tutorial?.videoUrl || guide.videoUrl || 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerBlazes.mp4'}
                poster={guide.thumbnailUrl}
                onTimeUpdate={handleTimeUpdate}
                onLoadedMetadata={handleLoadedMetadata}
                onEnded={() => setIsPlaying(false)}
                className="w-full h-full object-cover"
                playsInline
              />

              {/* HUD / Telemetry Watermark in Upper Left */}
              <div className="absolute top-3 left-3 flex flex-wrap items-center gap-2 pointer-events-none z-10">
                <div className="px-2.5 py-1 rounded-md bg-stone-950/85 backdrop-blur-md border border-stone-800 text-[10px] font-mono font-bold text-amber-400 flex items-center gap-1.5 shadow-sm">
                  <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                  <span>MICROSCOPE FEED • {tutorial?.magnificationLevel || '20x Stereo'}</span>
                </div>
                {tutorial?.hotAirReworkTemp && (
                  <div className="px-2 py-1 rounded-md bg-stone-950/85 backdrop-blur-md border border-stone-800 text-[10px] font-mono text-stone-300 flex items-center gap-1">
                    <Thermometer className="w-3 h-3 text-red-400" />
                    <span>{tutorial.hotAirReworkTemp}</span>
                  </div>
                )}
              </div>

              {/* Real-time Dynamic Chapter Overlay (Lower Left) */}
              {showOverlays && currentChapter && (
                <div className="absolute bottom-16 left-3 right-3 sm:right-auto sm:max-w-md bg-stone-950/90 backdrop-blur-md border border-amber-400/40 rounded-xl p-3 shadow-lg z-10 space-y-1.5 transition-all">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-[10px] uppercase font-black tracking-wider text-amber-400 flex items-center gap-1">
                      <Sliders className="w-3 h-3" />
                      Active Phase: {currentChapter.timestamp}
                    </span>
                    {currentChapter.multimeterMode && (
                      <span className="text-[10px] font-mono bg-amber-400/20 text-amber-300 px-1.5 py-0.5 rounded border border-amber-400/30">
                        {currentChapter.multimeterMode}
                      </span>
                    )}
                  </div>
                  <h4 className="text-xs font-bold text-white leading-tight">
                    {currentChapter.title}
                  </h4>
                  <p className="text-[11px] text-stone-300 leading-snug line-clamp-2">
                    {currentChapter.actionSummary}
                  </p>
                  {currentChapter.cautionNotice && (
                    <div className="pt-1 text-[10px] text-amber-300 flex items-center gap-1 font-semibold">
                      <AlertTriangle className="w-3 h-3 text-amber-400 shrink-0" />
                      <span>{currentChapter.cautionNotice}</span>
                    </div>
                  )}
                </div>
              )}

              {/* Big Center Play Button when Paused */}
              {!isPlaying && (
                <button
                  onClick={togglePlay}
                  className="absolute inset-0 m-auto w-16 h-16 rounded-full bg-amber-400 text-stone-950 flex items-center justify-center shadow-2xl hover:scale-110 active:scale-95 transition-all z-10"
                  aria-label="Play Video"
                >
                  <Play className="w-8 h-8 fill-current ml-1" />
                </button>
              )}

              {/* Custom Bottom Video Control Bar */}
              <div className="absolute bottom-0 inset-x-0 bg-gradient-to-t from-stone-950 via-stone-950/80 to-transparent p-3 flex flex-col gap-2 z-10">
                {/* Timeline Scrubber */}
                <div className="relative w-full flex items-center">
                  <input
                    type="range"
                    min={0}
                    max={duration || tutorial?.totalDurationSeconds || 100}
                    value={currentTime}
                    onChange={(e) => seekTo(parseFloat(e.target.value))}
                    className="w-full h-1.5 bg-stone-700 rounded-lg appearance-none cursor-pointer accent-amber-400 hover:h-2 transition-all"
                  />
                </div>

                <div className="flex items-center justify-between text-stone-200 text-xs">
                  <div className="flex items-center gap-3">
                    <button
                      onClick={togglePlay}
                      className="p-1 rounded-md hover:text-amber-400 transition-colors"
                      title={isPlaying ? 'Pause' : 'Play'}
                    >
                      {isPlaying ? <Pause className="w-4 h-4 fill-current" /> : <Play className="w-4 h-4 fill-current" />}
                    </button>

                    <button
                      onClick={() => seekTo(0)}
                      className="p-1 rounded-md hover:text-amber-400 transition-colors"
                      title="Rewind to start"
                    >
                      <RotateCcw className="w-3.5 h-3.5" />
                    </button>

                    <button
                      onClick={toggleMute}
                      className="p-1 rounded-md hover:text-amber-400 transition-colors"
                      title={isMuted ? 'Unmute' : 'Mute'}
                    >
                      {isMuted ? <VolumeX className="w-4 h-4 text-red-400" /> : <Volume2 className="w-4 h-4" />}
                    </button>

                    <span className="font-mono text-[11px] text-stone-400">
                      {formatTime(currentTime)} / {formatTime(duration || tutorial?.totalDurationSeconds || 0)}
                    </span>
                  </div>

                  <div className="flex items-center gap-2">
                    {/* Toggle Overlay Badge */}
                    <button
                      onClick={() => setShowOverlays(!showOverlays)}
                      className={`px-2 py-0.5 rounded text-[10px] font-bold border transition-colors flex items-center gap-1 ${
                        showOverlays
                          ? 'bg-amber-400/20 text-amber-300 border-amber-400/40'
                          : 'bg-stone-800 text-stone-400 border-stone-700'
                      }`}
                      title="Toggle Bench HUD Overlay"
                    >
                      <Eye className="w-3 h-3" />
                      <span>HUD</span>
                    </button>

                    {/* Playback speed selector */}
                    <div className="flex items-center bg-stone-800/90 rounded-md border border-stone-700 p-0.5 text-[10px] font-mono">
                      {[1, 1.25, 1.5].map((speed) => (
                        <button
                          key={speed}
                          onClick={() => changeSpeed(speed)}
                          className={`px-1.5 py-0.5 rounded ${
                            playbackSpeed === speed
                              ? 'bg-amber-400 text-stone-950 font-bold'
                              : 'text-stone-300 hover:text-white'
                          }`}
                        >
                          {speed}x
                        </button>
                      ))}
                    </div>

                    <button
                      onClick={() => {
                        if (videoRef.current?.requestFullscreen) {
                          videoRef.current.requestFullscreen();
                        }
                      }}
                      className="p-1 rounded-md hover:text-amber-400 transition-colors"
                      title="Fullscreen"
                    >
                      <Maximize2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              </div>
            </div>

            {/* Bench Safety Protocol Banner */}
            {tutorial?.benchSafetyProtocol && (
              <div className="p-3.5 rounded-xl bg-amber-50 dark:bg-amber-950/20 border border-amber-300 dark:border-amber-800/40 text-stone-900 dark:text-amber-200 text-xs flex items-start gap-2.5">
                <ShieldCheck className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
                <div className="space-y-0.5">
                  <span className="font-bold text-amber-700 dark:text-amber-300 uppercase tracking-wider text-[10px] block">
                    Bench Safety Directive
                  </span>
                  <p className="text-xs text-stone-700 dark:text-stone-300">{tutorial.benchSafetyProtocol}</p>
                </div>
              </div>
            )}

            {/* Key Takeaways Card */}
            {tutorial?.keyTakeaways && tutorial.keyTakeaways.length > 0 && (
              <div className="p-4 rounded-2xl bg-stone-50 dark:bg-stone-800/40 border border-stone-200 dark:border-stone-800 space-y-2">
                <h4 className="text-xs font-black uppercase tracking-wider text-stone-800 dark:text-stone-200 flex items-center gap-1.5">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
                  <span>Masterclass Key Takeaways</span>
                </h4>
                <ul className="space-y-1.5 text-xs text-stone-600 dark:text-stone-400">
                  {tutorial.keyTakeaways.map((takeaway, i) => (
                    <li key={i} className="flex items-start gap-2">
                      <span className="w-1.5 h-1.5 rounded-full bg-amber-400 mt-1.5 shrink-0" />
                      <span>{takeaway}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>

          {/* Chapters & Interactive Jump List */}
          <div className="lg:col-span-4 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 font-black text-xs uppercase tracking-wider text-stone-900 dark:text-stone-100">
                <Layers className="w-4 h-4 text-amber-500" />
                <span>Video Chapters ({tutorial?.chapters?.length || 0})</span>
              </div>
              <span className="text-[11px] text-stone-400 font-mono">
                Click to jump
              </span>
            </div>

            <div className="space-y-2.5 max-h-[620px] overflow-y-auto pr-1">
              {tutorial?.chapters?.map((chapter, idx) => {
                const isActive = activeChapterIndex === idx;
                return (
                  <button
                    key={chapter.id}
                    onClick={() => seekTo(chapter.seconds)}
                    className={`w-full text-left p-3.5 rounded-xl border transition-all relative ${
                      isActive
                        ? 'bg-amber-400/10 dark:bg-amber-400/15 border-amber-400 shadow-xs'
                        : 'bg-white dark:bg-stone-800/50 border-stone-200 dark:border-stone-800 hover:border-amber-400/50'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2 mb-1">
                      <span className="text-[11px] font-mono font-bold px-2 py-0.5 rounded bg-stone-950 text-amber-400 dark:bg-stone-900">
                        {chapter.timestamp}
                      </span>
                      {isActive && (
                        <span className="text-[10px] font-bold text-amber-600 dark:text-amber-400 uppercase tracking-wider flex items-center gap-1">
                          <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-ping" />
                          Playing
                        </span>
                      )}
                    </div>

                    <h4 className="text-xs font-bold text-stone-900 dark:text-stone-100 leading-snug mb-1">
                      {chapter.title}
                    </h4>

                    <p className="text-[11px] text-stone-500 dark:text-stone-400 line-clamp-2 leading-relaxed mb-2">
                      {chapter.actionSummary}
                    </p>

                    <div className="pt-2 border-t border-stone-100 dark:border-stone-700/60 flex flex-wrap items-center justify-between gap-2 text-[10px]">
                      <span className="font-semibold text-stone-600 dark:text-stone-300 flex items-center gap-1">
                        <Wrench className="w-3 h-3 text-amber-500" />
                        {chapter.benchTool}
                      </span>
                      {chapter.multimeterMode && (
                        <span className="text-amber-600 dark:text-amber-400 font-mono">
                          {chapter.multimeterMode}
                        </span>
                      )}
                    </div>

                    {chapter.cautionNotice && (
                      <div className="mt-2 text-[10px] text-red-600 dark:text-red-400 font-medium flex items-center gap-1">
                        <AlertTriangle className="w-3 h-3 shrink-0" />
                        <span className="line-clamp-1">{chapter.cautionNotice}</span>
                      </div>
                    )}
                  </button>
                );
              })}
            </div>
          </div>

        </div>
      )}
    </div>
  );
}
