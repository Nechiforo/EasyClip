/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useRef, useEffect } from 'react';
import { 
  Circle, 
  Square, 
  Scissors, 
  Settings, 
  Download, 
  Share2, 
  Plus, 
  Play, 
  Pause,
  RotateCcw,
  SkipBack,
  SkipForward,
  Volume2,
  Layers,
  Type,
  Maximize2,
  Trash2,
  Zap,
  Move,
  Palette,
  Minus,
  Undo,
  Redo,
  Diamond,
  Columns2,
  Library,
  FolderOpen,
  FileVideo,
  FileAudio,
  Upload,
  PlusCircle,
  Search,
  Sticker,
  Image as ImageIcon,
  Diamond as DiamondIcon,
  Music,
  Mic,
  VolumeX,
  ListMusic,
  Plus as PlusIcon
} from 'lucide-react';
import { motion, AnimatePresence, useDragControls } from 'motion/react';
import { useReplayBuffer } from './hooks/useReplayBuffer';
import { cn, formatTime } from './lib/utils';
import { VideoClip, TimelineState, AspectRatio, TransitionType, TextOverlay, TimelineAudioTrack, AudioClip, AnimationKeyframes, LibraryItem } from './types';
import { translations, LanguageCode, TranslationSet } from './translations';

const FONT_OPTIONS = [
  'Inter, sans-serif',
  'Montserrat, sans-serif',
  'Open Sans, sans-serif',
  'Lato, sans-serif',
  'Roboto, sans-serif',
  'Bebas Neue, sans-serif',
  'Impact, Charcoal, sans-serif',
  'Futura, "Trebuchet MS", sans-serif',
  'Verdana, Geneva, sans-serif',
  'Arial, Helvetica, sans-serif',
  'Helvetica, Arial, sans-serif',
  'Proxima Nova, sans-serif',
  'JetBrains Mono, monospace'
];

export default function App() {
  const [replayBufferDuration, setReplayBufferDuration] = useState(60000); // 1 min default
  const { isRecording, startCapture, stopCapture, getBufferBlob, stream } = useReplayBuffer(replayBufferDuration);
  const [clips, setClips] = useState<VideoClip[]>([]);
  const [audioTracks, setAudioTracks] = useState<TimelineAudioTrack[]>([
    { id: 'at-1', name: 'Ambient', clips: [], volume: 100 },
    { id: 'at-2', name: 'Music', clips: [], volume: 100 }
  ]);
  const [libraryItems, setLibraryItems] = useState<LibraryItem[]>([]);
  const [libraryTab, setLibraryTab] = useState<'clips' | 'sounds'>('clips');
  const [selectedClipId, setSelectedClipId] = useState<string | null>(null);
  const [selectedLibraryItemId, setSelectedLibraryItemId] = useState<string | null>(null);
  const [selectedAudioId, setSelectedAudioId] = useState<string | null>(null);
  const [selectedTextId, setSelectedTextId] = useState<string | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [totalDuration, setTotalDuration] = useState(10); // Default 10s
  const [exportRatio, setExportRatio] = useState<AspectRatio>('16:9');
  const [filters, setFilters] = useState({
    brightness: 100,
    contrast: 100,
    saturation: 100,
    hue: 0,
    sepia: 0,
    grayscale: 0,
    lut: undefined as string | undefined,
    volume: 80,
    fadeIn: 0,
    fadeOut: 0,
    zoom: 100,
    offsetX: 0,
    offsetY: 0,
    smooth: 0,
    blur: 0,
    opacity: 100,
    playbackRate: 1.0
  });

  const [activeTool, setActiveTool] = useState<string>('Library');
  const [recordingTime, setRecordingTime] = useState(0);
  const recordingTimerRef = useRef<NodeJS.Timeout | null>(null);
  const [isRecordingVoice, setIsRecordingVoice] = useState(false);
  const [voiceRecordingTime, setVoiceRecordingTime] = useState(0);
  const voiceTimerRef = useRef<NodeJS.Timeout | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const timelineRef = useRef<HTMLDivElement>(null);
  const [isLooping, setIsLooping] = useState(false);
  const [loopStart, setLoopStart] = useState(0);
  const [loopEnd, setLoopEnd] = useState(5);
  const [showOverlay, setShowOverlay] = useState(true);
  const [showOverlayTimer, setShowOverlayTimer] = useState(true);
  const [interfaceColor, setInterfaceColor] = useState('#00FF00');
  const [keyboardShortcuts, setKeyboardShortcuts] = useState(true);
  const [recordKey, setRecordKey] = useState<string>('r');
  const [voiceKey, setVoiceKey] = useState<string>('v');
  const [rebindingKey, setRebindingKey] = useState<string | null>(null);

  const [instantClipKey, setInstantClipKey] = useState<string>('i');
  const [useMouseWheelZoom, setUseMouseWheelZoom] = useState(false);
  const [contextMenu, setContextMenu] = useState<{ x: number, y: number, visible: boolean, type: 'clip' | 'track', id: string, trackId?: string } | null>(null);

  // Auto-save filters to selected clip
  useEffect(() => {
    if (selectedClipId) {
      setClips(prev => prev.map(c => c.id === selectedClipId ? { ...c, filters: { ...filters } } : c));
    }
  }, [filters]);

  // Load filters when clip is selected
  useEffect(() => {
    if (selectedClipId) {
      const clip = clips.find(c => c.id === selectedClipId);
      if (clip && clip.filters) {
        setFilters(clip.filters);
      }
    }
  }, [selectedClipId]);

  const handleContextMenu = (e: React.MouseEvent, type: 'clip' | 'track', id: string, trackId?: string) => {
    e.preventDefault();
    setContextMenu({ x: e.clientX, y: e.clientY, visible: true, type, id, trackId });
  };

  const closeContextMenu = () => setContextMenu(null);

  useEffect(() => {
    window.addEventListener('click', closeContextMenu);
    return () => window.removeEventListener('click', closeContextMenu);
  }, []);

  // Use state for translations
  const [language, setLanguage] = useState<LanguageCode>('en');
  const t = (key: keyof TranslationSet) => {
    return translations[language][key] || translations['en'][key];
  };

  // Helper for history
  const [history, setHistory] = useState<{ past: any[], future: any[] }>({ past: [], future: [] });

  const saveToHistory = () => {
    const currentState = {
      clips: JSON.parse(JSON.stringify(clips)),
      audioTracks: JSON.parse(JSON.stringify(audioTracks)),
      filters: { ...filters },
      exportRatio,
      interfaceColor
    };
    setHistory(prev => ({
      past: [...prev.past.slice(-19), currentState],
      future: []
    }));
  };

  const undo = () => {
    if (history.past.length === 0) return;
    const prevState = history.past[history.past.length - 1];
    const newPast = history.past.slice(0, -1);
    setHistory({ past: newPast, future: [{ clips, audioTracks, filters, exportRatio, interfaceColor }, ...history.future] });
    setClips(prevState.clips);
    setAudioTracks(prevState.audioTracks);
    setFilters(prevState.filters);
    setExportRatio(prevState.exportRatio);
    setInterfaceColor(prevState.interfaceColor);
  };

  const redo = () => {
    if (history.future.length === 0) return;
    const nextState = history.future[0];
    const newFuture = history.future.slice(1);
    setHistory({ past: [...history.past, { clips, audioTracks, filters, exportRatio, interfaceColor }], future: newFuture });
    setClips(nextState.clips);
    setAudioTracks(nextState.audioTracks);
    setFilters(nextState.filters);
    setExportRatio(nextState.exportRatio);
    setInterfaceColor(nextState.interfaceColor);
  };

  const addAudioTrack = () => {
    saveToHistory();
    const newTrack: TimelineAudioTrack = {
      id: `at-${Date.now()}`,
      name: `Track ${audioTracks.length + 1}`,
      clips: [],
      volume: 100
    };
    setAudioTracks([...audioTracks, newTrack]);
  };

  const removeAudioTrack = (id: string) => {
    saveToHistory();
    setAudioTracks(prev => prev.filter(t => t.id !== id));
  };

  const updateTrackVolume = (trackId: string, volume: number) => {
     setAudioTracks(prev => prev.map(t => t.id === trackId ? { ...t, volume } : t));
  };

  const removeAudioClip = (trackId: string, clipId: string) => {
    saveToHistory();
    setAudioTracks(prev => prev.map(t => t.id === trackId ? { ...t, clips: t.clips.filter(c => c.id !== clipId) } : t));
  };

  const deleteClip = (id: string) => {
    saveToHistory();
    setClips(prev => prev.filter(c => c.id !== id));
    if (selectedClipId === id) setSelectedClipId(null);
  };

  const startVoiceRecording = async () => {
    try {
      const audioStream = await navigator.mediaDevices.getUserMedia({ audio: true });
      audioChunksRef.current = [];
      const mediaRecorder = new MediaRecorder(audioStream);
      mediaRecorderRef.current = mediaRecorder;

      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) audioChunksRef.current.push(e.data);
      };

      mediaRecorder.onstop = () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
        const url = URL.createObjectURL(audioBlob);
        
        // Add to library or first track
        const newAudio: AudioClip = {
          id: `voice-${Date.now()}`,
          name: 'Voice Over',
          url,
          blob: audioBlob,
          duration: voiceRecordingTime,
          startTime: currentTime,
          volume: 100
        };
        
        setAudioTracks(prev => prev.map((t, i) => i === 0 ? { ...t, clips: [...t.clips, newAudio] } : t));
        audioStream.getTracks().forEach(t => t.stop());
      };

      mediaRecorder.start();
      setIsRecordingVoice(true);
      setVoiceRecordingTime(0);
      voiceTimerRef.current = setInterval(() => setVoiceRecordingTime(p => p + 100), 100);
    } catch (err) {
      console.error(err);
    }
  };

  const stopVoiceRecording = () => {
    if (mediaRecorderRef.current) mediaRecorderRef.current.stop();
    setIsRecordingVoice(false);
    if (voiceTimerRef.current) clearInterval(voiceTimerRef.current);
  };

  const seekTo = (time: number) => {
    setCurrentTime(Math.max(0, Math.min(time, totalDuration)));
  };

  const splitClip = () => {
    if (!selectedClipId) return;
    const clip = clips.find(c => c.id === selectedClipId);
    if (!clip) return;
    saveToHistory();

    const relativeSplit = currentTime - clip.startTime;
    if (relativeSplit <= 0 || relativeSplit >= clip.duration) return;

    const firstHalf = { ...clip, id: `${clip.id}-1`, duration: relativeSplit };
    const secondHalf = { ...clip, id: `${clip.id}-2`, duration: clip.duration - relativeSplit, startTime: currentTime };

    setClips(prev => prev.flatMap(c => c.id === selectedClipId ? [firstHalf, secondHalf] : [c]));
    setSelectedClipId(secondHalf.id);
  };

  const handleInstantClip = async () => {
    const blob = await getBufferBlob();
    if (!blob) return;
    const url = URL.createObjectURL(blob);
    const newClip: LibraryItem = {
      id: `clip-${Date.now()}`,
      type: 'video',
      url,
      name: 'Instant Clip',
      duration: 10, // Assuming 10s for demo
      createdAt: Date.now()
    };
    setLibraryItems([newClip, ...libraryItems]);
  };

  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (isPlaying) {
      interval = setInterval(() => {
        setCurrentTime(prev => {
          const next = prev + 0.033;
          if (isLooping && next >= loopEnd) return loopStart;
          if (next >= totalDuration) {
            setIsPlaying(false);
            return 0;
          }
          return next;
        });
      }, 33);
    }
    return () => clearInterval(interval);
  }, [isPlaying, isLooping, loopStart, loopEnd, totalDuration]);

  // View logic
  const activeClip = clips.find(c => c.id === selectedClipId);

  return (
    <div className="flex h-screen bg-black text-white font-sans overflow-hidden select-none" style={{ '--brand-primary': interfaceColor } as any}>
      {/* Tool Sidebar */}
      <aside className="w-16 border-r border-white/5 bg-black/40 flex flex-col items-center py-4 gap-4 z-50">
        <div className="w-10 h-10 rounded-2xl bg-brand-primary flex items-center justify-center mb-6 shadow-[0_0_20px_rgba(var(--brand-primary-rgb),0.3)]">
          <Circle className="w-6 h-6 text-black fill-current" />
        </div>
        <ToolIcon icon={<Library className="w-5 h-5" />} label={t('library')} active={activeTool === 'Library'} onClick={() => setActiveTool('Library')} />
        <ToolIcon icon={<Scissors className="w-5 h-5" />} label={t('trim')} active={activeTool === 'Trim'} onClick={() => setActiveTool('Trim')} />
        <ToolIcon icon={<Type className="w-5 h-5" />} label={t('text')} active={activeTool === 'Text'} onClick={() => setActiveTool('Text')} />
        <ToolIcon icon={<Music className="w-5 h-5" />} label={t('audio')} active={activeTool === 'Audio'} onClick={() => setActiveTool('Audio')} />
        <ToolIcon icon={<Palette className="w-5 h-5" />} label={t('color')} active={activeTool === 'Color'} onClick={() => setActiveTool('Color')} />
        <ToolIcon icon={<Zap className="w-5 h-5" />} label={t('speed')} active={activeTool === 'Speed'} onClick={() => setActiveTool('Speed')} />
        <div className="mt-auto flex flex-col gap-4">
          <ToolIcon icon={<Settings className="w-5 h-5" />} label={t('config')} active={activeTool === 'Config'} onClick={() => setActiveTool('Config')} />
          <button className="flex flex-col items-center gap-1 p-2.5 rounded-xl bg-brand-primary text-black font-bold uppercase tracking-widest text-[8px] hover:scale-110 transition-transform">
             <Download className="w-5 h-5" />
             {t('export')}
          </button>
        </div>
      </aside>

      {/* Primary Workspace */}
      <div className="flex-1 flex flex-col relative h-full">
        {/* Main Content Area */}
        <section className="flex-1 flex min-h-0 bg-[#050505]">
          {/* Active Tool Panel */}
          <aside className="w-72 border-r border-white/5 bg-black/10 flex flex-col shrink-0">
             <div className="h-14 border-b border-white/5 flex items-center px-6 justify-between bg-black/20">
                <span className="text-[10px] font-bold uppercase tracking-[0.3em] text-white/40">{t(activeTool.toLowerCase() as any) || activeTool}</span>
                <div className="flex gap-1">
                   <button onClick={undo} className="p-1.5 text-white/20 hover:text-white transition-colors"><Undo className="w-3.5 h-3.5" /></button>
                   <button onClick={redo} className="p-1.5 text-white/20 hover:text-white transition-colors"><Redo className="w-3.5 h-3.5" /></button>
                </div>
             </div>
             
             <div className="flex-1 overflow-y-auto custom-scrollbar p-6">
                <AnimatePresence mode="wait">
                  {activeTool === 'Library' && (
                    <motion.div key="library" initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 10 }}>
                       <div className="flex gap-2 mb-6">
                         <button 
                            onClick={() => setLibraryTab('clips')}
                            className={cn("flex-1 py-2 text-[8px] font-bold uppercase tracking-widest rounded-lg border transition-all", 
                            libraryTab === 'clips' ? "bg-white text-black border-white" : "border-white/10 text-white/40 hover:border-white/20")}
                         >
                            {t('assets')}
                         </button>
                         <button 
                            onClick={() => setLibraryTab('sounds')}
                            className={cn("flex-1 py-2 text-[8px] font-bold uppercase tracking-widest rounded-lg border transition-all", 
                            libraryTab === 'sounds' ? "bg-white text-black border-white" : "border-white/10 text-white/40 hover:border-white/20")}
                         >
                            AUDIO
                         </button>
                       </div>
                       
                       <div className="grid grid-cols-2 gap-3">
                          {libraryItems.length === 0 ? (
                             <div className="col-span-2 py-12 text-center border-2 border-dashed border-white/5 rounded-2xl">
                                <Search className="w-8 h-8 text-white/10 mx-auto mb-3" />
                                <p className="text-[10px] uppercase font-bold text-white/20 tracking-widest">{t('libraryEmpty')}</p>
                             </div>
                          ) : (
                               libraryItems.map(item => (
                                 <div key={item.id} className="group relative aspect-video bg-white/5 rounded-xl overflow-hidden border border-white/5 hover:border-brand-primary/50 transition-all">
                                    {item.thumbnail ? <img src={item.thumbnail} className="w-full h-full object-cover" /> : <div className="w-full h-full flex items-center justify-center bg-brand-primary/10"><FileVideo className="w-4 h-4 text-brand-primary" /></div>}
                                    <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                                       <button onClick={() => {
                                          const newClip: VideoClip = { id: `clip-${Date.now()}`, url: item.url, blob: new Blob(), duration: item.duration, startTime: currentTime, filters: item.filters || filters, name: item.name };
                                          setClips([...clips, newClip]);
                                       }} className="p-2 bg-brand-primary text-black rounded-lg hover:scale-110 transition-transform"><Plus className="w-4 h-4" /></button>
                                       <button onClick={() => setLibraryItems(prev => prev.filter(i => i.id !== item.id))} className="p-2 bg-black/40 text-white rounded-lg hover:text-brand-error"><Trash2 className="w-4 h-4" /></button>
                                    </div>
                                 </div>
                               ))
                          )}
                       </div>
                    </motion.div>
                  )}

                  {activeTool === 'Audio' && (
                    <motion.div key="audio" initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 10 }} className="space-y-8">
                       <div className="p-5 bg-brand-primary/5 rounded-2xl border border-brand-primary/10 space-y-4">
                          <div className="flex items-center justify-between">
                             <div className="flex items-center gap-2">
                                <div className={cn("w-2 h-2 rounded-full", isRecordingVoice ? "bg-brand-error animate-pulse" : "bg-white/20")} />
                                <label className="text-[10px] font-bold uppercase tracking-widest text-white/60">{t('voiceOver')}</label>
                             </div>
                             <span className="font-mono text-[10px] text-brand-primary">{formatTime(voiceRecordingTime / 1000)}</span>
                          </div>
                          <button 
                            onClick={isRecordingVoice ? stopVoiceRecording : startVoiceRecording}
                            className={cn("w-full py-4 rounded-xl flex items-center justify-center gap-2 font-bold uppercase tracking-widest text-[10px] transition-all", isRecordingVoice ? "bg-brand-error text-white" : "bg-brand-primary text-black hover:bg-brand-primary/90")}
                          >
                             {isRecordingVoice ? <Square className="w-4 h-4 fill-current" /> : <Mic className="w-4 h-4" />}
                             {isRecordingVoice ? t('stop') : t('record')}
                          </button>
                       </div>

                       <div className="space-y-6">
                          <PropertySlider label={t('masterVolume')} value={filters.volume} onChange={(val) => setFilters(f => ({ ...f, volume: val }))} />
                          <div className="h-px bg-white/5" />
                          <div className="space-y-4">
                             <p className="text-[10px] font-bold uppercase tracking-widest text-white/30">Track Mixer</p>
                             {audioTracks.map(track => (
                               <div key={track.id}>
                                 <PropertySlider label={track.name} value={track.volume} onChange={(val) => updateTrackVolume(track.id, val)} />
                               </div>
                             ))}
                          </div>
                       </div>
                    </motion.div>
                  )}
                  
                  {/* Other tool panels can be added similarly */}
                  {activeTool === 'Color' && (
                    <motion.div key="color" initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 10 }} className="space-y-6">
                       <PropertySlider label={t('brightness')} value={filters.brightness} onChange={(val) => setFilters(f => ({ ...f, brightness: val }))} />
                       <PropertySlider label={t('contrast')} value={filters.contrast} onChange={(val) => setFilters(f => ({ ...f, contrast: val }))} />
                       <PropertySlider label={t('saturation')} value={filters.saturation} onChange={(val) => setFilters(f => ({ ...f, saturation: val }))} />
                       <PropertySlider label={t('hue')} value={filters.hue} onChange={(val) => setFilters(f => ({ ...f, hue: val }))} />
                       <PropertySlider label={t('sepia')} value={filters.sepia} onChange={(val) => setFilters(f => ({ ...f, sepia: val }))} />
                       <PropertySlider label={t('grayscale')} value={filters.grayscale} onChange={(val) => setFilters(f => ({ ...f, grayscale: val }))} />
                    </motion.div>
                  )}
                </AnimatePresence>
             </div>
          </aside>

          {/* Preview Section */}
          <div className="flex-1 flex flex-col p-8 items-center justify-center relative bg-[#020202]">
            <div className={cn("relative shadow-[0_0_100px_rgba(0,0,0,0.8)] bg-black overflow-hidden border border-white/5", exportRatio === '16:9' ? 'aspect-video w-full' : exportRatio === '9:16' ? 'aspect-[9/16] h-full' : 'aspect-square h-full')}>
               <div className="w-full h-full flex items-center justify-center bg-[#111]">
                  <Circle className="w-24 h-24 text-white/5" />
                  <div className="absolute inset-0 flex items-center justify-center">
                     <p className="text-[10px] font-bold uppercase tracking-[0.5em] text-white/10">{t('readyForInput')}</p>
                  </div>
               </div>
               
               {/* Player HUD Overlay */}
               <div className="absolute bottom-6 left-1/2 -translate-x-1/2 w-fit bg-black/60 backdrop-blur-xl border border-white/10 rounded-2xl p-3 flex items-center gap-6 shadow-2xl z-50">
                  <div className="flex items-center gap-4 px-2">
                     <div className="flex items-center gap-3">
                        <Volume2 className="w-3.5 h-3.5 text-white/40" />
                        <input 
                           type="range" min="0" max="200" value={filters.volume} 
                           onChange={(e) => setFilters(f => ({ ...f, volume: parseInt(e.target.value) }))}
                           className="w-16 h-1 bg-white/20 rounded-full appearance-none cursor-pointer accent-brand-primary"
                        />
                     </div>
                     <div className="w-px h-3 bg-white/10" />
                     <button onClick={() => seekTo(0)} className="text-white/40 hover:text-white transition-colors"><RotateCcw className="w-3.5 h-3.5" /></button>
                  </div>
                  
                  <div className="flex items-center gap-3">
                     <button onClick={() => seekTo(currentTime - 5)} className="text-white/40 hover:text-brand-primary"><SkipBack className="w-4 h-4" /></button>
                     <button onClick={() => setIsPlaying(!isPlaying)} className="w-10 h-10 bg-white text-black rounded-full flex items-center justify-center hover:scale-110 active:scale-95 transition-all">
                        {isPlaying ? <Pause className="w-5 h-5 fill-current" /> : <Play className="w-5 h-5 fill-current ml-1" />}
                     </button>
                     <button onClick={() => seekTo(currentTime + 5)} className="text-white/40 hover:text-brand-primary"><SkipForward className="w-4 h-4" /></button>
                  </div>
                  
                  <div className="pr-4 min-w-[80px] text-center font-mono text-[10px] text-brand-primary font-bold">
                     {formatTime(currentTime)} / {formatTime(totalDuration)}
                  </div>
               </div>
            </div>

            {/* Floating Control Overlay */}
            <AnimatePresence>
              {showOverlay && (
                <motion.div 
                  drag dragMomentum={false} dragConstraints={{ top: 0, left: 0, right: 1000, bottom: 800 }}
                  initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 20 }}
                  className="fixed bottom-10 right-10 bg-black/80 backdrop-blur-2xl border border-white/10 rounded-2xl p-4 flex items-center gap-4 shadow-[0_40px_80px_rgba(0,0,0,0.6)] z-[1000] cursor-grab active:cursor-grabbing"
                >
                   <div className="flex items-center gap-2 pr-2 border-r border-white/10">
                      <button onClick={isRecording ? stopCapture : startCapture} className={cn("w-8 h-8 rounded-full flex items-center justify-center transition-all", isRecording ? "bg-brand-error text-white animate-pulse" : "bg-white/10 text-white hover:bg-brand-error")}>
                         {isRecording ? <Square className="w-3 h-3 fill-current" /> : <Circle className="w-3 h-3 fill-brand-error" />}
                      </button>
                      <button onClick={handleInstantClip} disabled={!isRecording} className="w-8 h-8 rounded-full bg-brand-primary text-black flex items-center justify-center disabled:opacity-30"><RotateCcw className="w-3 h-3" /></button>
                   </div>
                   {showOverlayTimer && isRecording && (
                     <div className="font-mono text-[11px] font-bold text-white/80 bg-white/5 px-2 py-1 rounded border border-white/5">{formatTime(recordingTime / 1000)}</div>
                   )}
                   <div className="flex items-center gap-1">
                      <button onClick={() => setIsPlaying(!isPlaying)} className="w-8 h-8 flex items-center justify-center text-white/60 hover:text-white">{isPlaying ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}</button>
                      <button onClick={splitClip} className="w-8 h-8 flex items-center justify-center text-white/60 hover:text-white"><Scissors className="w-4 h-4" /></button>
                   </div>
                   <div className="group relative ml-2">
                      <div className="w-1.5 h-6 bg-white/10 rounded-full cursor-help group-hover:bg-brand-primary" />
                      <div className="absolute bottom-full mb-3 left-1/2 -translate-x-1/2 opacity-0 group-hover:opacity-100 transition-opacity bg-black px-2 py-1 rounded text-[8px] font-bold border border-white/10 pointer-events-none whitespace-nowrap">ARRASTRAR PARA REUBICAR</div>
                   </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </section>

        {/* Timeline Section */}
        <div 
          className="h-56 border-t border-white/5 bg-black/40 flex flex-col relative shrink-0 overflow-hidden" 
          onDragOver={(e) => e.preventDefault()} 
          onDrop={(e) => { e.preventDefault(); console.log('Drop on timeline stub'); }}
        >
           <div className="h-8 border-b border-white/5 flex items-center px-4 justify-between bg-black/20 shrink-0">
              <div className="flex items-center gap-4">
                 <span className="text-[10px] font-bold font-mono text-white/40 uppercase tracking-widest">{t('timeline')}</span>
                 <div className="flex gap-2">
                    <button onClick={() => seekTo(0)} className="text-white/30 hover:text-white"><RotateCcw className="w-3 h-3" /></button>
                    <button onClick={() => setIsPlaying(!isPlaying)} className="text-white/30 hover:text-white">{isPlaying ? <Pause className="w-3 h-3" /> : <Play className="w-3 h-3" />}</button>
                 </div>
              </div>
              <div className="flex items-center gap-3">
                 <button onClick={addAudioTrack} className="text-[9px] uppercase tracking-widest font-bold text-white/40 hover:text-brand-primary flex items-center gap-1">
                    <Music className="w-3 h-3" /> {t('addAudioTrack')}
                 </button>
              </div>
           </div>

           <div className="flex-1 overflow-auto custom-scrollbar relative">
              <div className="min-w-[1500px] h-full relative" ref={timelineRef} onMouseDown={(e) => {
                 const rect = e.currentTarget.getBoundingClientRect();
                 const x = e.clientX - rect.left - 96;
                 if (x >= 0) seekTo((x / (rect.width - 96)) * totalDuration);
              }}>
                 {/* Playhead */}
                 <div className="absolute top-0 bottom-0 w-px bg-brand-primary z-50 pointer-events-none" style={{ left: `${(currentTime / totalDuration) * 100}%`, marginLeft: '96px' }}>
                    <div className="w-3 h-3 bg-brand-primary rotate-45 -translate-x-[6px] -translate-y-[6px]" />
                 </div>

                 <div className="flex flex-col h-full py-4 gap-2">
                    <TimelineTrack label="VIDEO" clips={clips} selectedId={selectedClipId} onSelect={setSelectedClipId} onDelete={deleteClip} totalDuration={totalDuration} onContextMenu={(e, id) => handleContextMenu(e, 'clip', id || '')} />
                    {audioTracks.map(track => (
                       <TimelineTrack 
                          key={track.id} label={track.name} clips={track.clips} type="audio" 
                          selectedId={selectedAudioId} onSelect={setSelectedAudioId} 
                          onDelete={(clipId) => removeAudioClip(track.id, clipId)} 
                          onRemoveTrack={() => removeAudioTrack(track.id)}
                          totalDuration={totalDuration}
                          onContextMenu={(e, id) => handleContextMenu(e, id ? 'clip' : 'track', id || track.id, track.id)}
                       />
                    ))}
                 </div>
              </div>
           </div>
        </div>
      </div>

      {/* Context Menu Component */}
      <AnimatePresence>
        {contextMenu && contextMenu.visible && (
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }}
            style={{ top: contextMenu.y, left: contextMenu.x }}
            className="fixed z-[9999] min-w-[160px] bg-[#121212] backdrop-blur-xl border border-white/10 rounded-xl shadow-2xl p-1 overflow-hidden"
          >
             <div className="px-3 py-1.5 border-b border-white/5 mb-1 text-[8px] font-bold uppercase tracking-widest text-white/30">
                {contextMenu.type === 'clip' ? 'Clip Options' : 'Track Options'}
             </div>
             {contextMenu.type === 'clip' && (
               <>
                 <button onClick={() => { if (contextMenu.trackId) removeAudioClip(contextMenu.trackId, contextMenu.id); else deleteClip(contextMenu.id); closeContextMenu(); }} className="w-full text-left px-3 py-2 rounded-lg text-[10px] font-bold uppercase tracking-widest text-brand-error hover:bg-brand-error/10 transition-colors flex items-center justify-between">
                    {t('deleteClip')} <Trash2 className="w-3 h-3" />
                 </button>
                 <div className="h-px bg-white/5 my-1" />
                 <button onClick={() => { setFilters(f => ({ ...f, playbackRate: 0.5 })); closeContextMenu(); }} className="w-full text-left px-3 py-2 rounded-lg text-[10px] font-bold uppercase tracking-widest text-white/60 hover:bg-white/5 transition-colors flex items-center justify-between">
                    {t('slowMotion')} <RotateCcw className="w-3 h-3 text-blue-400" />
                 </button>
                 <button onClick={() => { setFilters(f => ({ ...f, playbackRate: 1.0 })); closeContextMenu(); }} className="w-full text-left px-3 py-2 rounded-lg text-[10px] font-bold uppercase tracking-widest text-white/60 hover:bg-white/5 transition-colors flex items-center justify-between">
                    {t('normalSpeed')} <Zap className="w-3 h-3 text-yellow-400" />
                 </button>
               </>
             )}
             {contextMenu.type === 'track' && (
               <>
                 <button onClick={() => { addAudioTrack(); closeContextMenu(); }} className="w-full text-left px-3 py-2 rounded-lg text-[10px] font-bold uppercase tracking-widest text-brand-primary hover:bg-brand-primary/10 transition-colors flex items-center justify-between">
                    {t('addAudioTrack')} <PlusCircle className="w-3 h-3" />
                 </button>
                 <button onClick={() => { if (contextMenu.trackId) removeAudioTrack(contextMenu.trackId); closeContextMenu(); }} className="w-full text-left px-3 py-2 rounded-lg text-[10px] font-bold uppercase tracking-widest text-brand-error/60 hover:bg-brand-error/10 transition-colors flex items-center justify-between">
                    {t('removeTrack')} <Trash2 className="w-3 h-3" />
                 </button>
               </>
             )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// Subcomponents
function ToolIcon({ icon, label, active = false, onClick }: { icon: React.ReactNode, label: string, active?: boolean, onClick?: () => void }) {
  return (
    <button onClick={onClick} className={cn("group relative flex flex-col items-center gap-1 p-2.5 rounded-xl transition-all", active ? "bg-white text-black" : "text-white/40 hover:bg-white/5 hover:text-white")}>
       {icon}
       <span className="text-[7px] font-bold uppercase tracking-[0.2em]">{label}</span>
    </button>
  );
}

interface TimelineTrackProps {
  label: string;
  clips?: any[];
  selectedId?: string | null;
  onSelect?: (id: string) => void;
  onDelete?: (id: string) => void;
  onAdd?: () => void;
  onRemoveTrack?: () => void;
  onContextMenu?: (e: React.MouseEvent, id?: string) => void;
  type?: 'video' | 'audio';
}

const TimelineTrack: React.FC<TimelineTrackProps & { totalDuration: number }> = ({ label, clips = [], selectedId, onSelect, onDelete, onAdd, onRemoveTrack, onContextMenu, type = 'video', totalDuration }) => {
  return (
    <div className="flex items-center group h-16 min-w-full relative" onContextMenu={(e) => onContextMenu?.(e)}>
      <div className="w-24 flex-shrink-0 flex items-center justify-between px-2 border-r border-white/10 bg-black/20 h-full z-10">
        <span className="text-[9px] font-bold uppercase text-white/30 vertical-text">{label}</span>
        <div className="flex flex-col gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
           {onAdd && <button onClick={onAdd} className="p-1 hover:bg-white/10 rounded"><Plus className="w-3 h-3 text-white/40" /></button>}
           {onRemoveTrack && <button onClick={onRemoveTrack} className="p-1 hover:bg-white/10 rounded"><Trash2 className="w-3 h-3 text-brand-error/40" /></button>}
        </div>
      </div>
      <div className="flex-1 h-full items-center relative overflow-x-hidden min-w-0 bg-white/[0.02]">
        {clips.map((clip: any) => {
          const duration = type === 'video' ? clip.duration : (clip.duration / 1000);
          const width = (duration / totalDuration) * 100;
          const left = (clip.startTime / totalDuration) * 100;
          return (
            <motion.div
              layoutId={clip.id} key={clip.id}
              onClick={(e) => { e.stopPropagation(); onSelect?.(clip.id); }}
              onContextMenu={(e) => { e.stopPropagation(); onContextMenu?.(e, clip.id); }}
              style={{ left: `${left}%`, width: `${width}%`, position: 'absolute' }}
              className={cn("h-[80%] top-[10%] rounded border cursor-pointer group/clip overflow-hidden transition-all", selectedId === clip.id ? (type === 'video' ? "bg-brand-primary/20 border-brand-primary z-20" : "bg-blue-500/20 border-blue-500 z-20") : "bg-white/5 border-white/10 hover:border-white/30 z-10")}
            >
               <div className="absolute inset-x-2 bottom-1 flex justify-between items-end">
                  <span className="text-[7px] font-mono text-white/40 truncate">{clip.name || `CLIP_${clip.id.slice(0, 4)}`}</span>
                  <span className="text-[7px] font-mono text-white/60">{formatTime(duration)}</span>
               </div>
               {type === 'audio' && <div className="absolute inset-0 flex items-center justify-center opacity-10"><Music className="w-8 h-8" /></div>}
            </motion.div>
          );
        })}
      </div>
    </div>
  );
};

function PropertySlider({ label, value, onChange }: { label: string, value: number, onChange: (v: number) => void }) {
  return (
    <div className="space-y-3">
      <div className="flex justify-between items-center text-[9px] font-bold uppercase tracking-widest text-white/40">
         <label>{label}</label>
         <span className="text-brand-primary">{Math.round(value)}%</span>
      </div>
      <div className="h-1.5 bg-white/5 rounded-full relative overflow-hidden group">
         <div className="absolute inset-y-0 left-0 bg-brand-primary transition-all shadow-[0_0_10px_rgba(var(--brand-primary-rgb),0.5)]" style={{ width: `${Math.min(100, (value / 200) * 100)}%` }} />
         <input type="range" min="0" max="200" value={value} onChange={e => onChange(parseInt(e.target.value))} className="absolute inset-0 opacity-0 cursor-pointer" />
      </div>
    </div>
  );
}

function PresetBtn({ label, active = false }: { label: string, active?: boolean }) {
  return (
    <button className={cn("px-3 py-2 text-[8px] font-bold uppercase tracking-widest rounded-lg border transition-all", active ? "bg-brand-primary text-black border-brand-primary" : "border-white/10 text-white/40 hover:border-white/30 hover:text-white")}>
      {label}
    </button>
  );
}
