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
  Image as ImageIcon
} from 'lucide-react';
import { motion, AnimatePresence, useDragControls } from 'motion/react';
import { useReplayBuffer } from './hooks/useReplayBuffer';
import { cn, formatTime } from './lib/utils';
import { VideoClip, TimelineState, AspectRatio, TransitionType, TextOverlay, TimelineAudioTrack, AudioClip, AnimationKeyframes, LibraryItem } from './types';
import { Music, Mic, VolumeX, ListMusic } from 'lucide-react';
import { translations, LanguageCode, TranslationSet } from './translations';

export default function App() {
  const { isRecording, startCapture, stopCapture, getBufferBlob, stream } = useReplayBuffer();
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
    opacity: 100
  });
  const [activeTool, setActiveTool] = useState<string>("Trim");
  const [isRecordingVoice, setIsRecordingVoice] = useState(false);
  const [voiceRecordingTime, setVoiceRecordingTime] = useState(0);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const voiceChunksRef = useRef<Blob[]>([]);
  const voiceTimerRef = useRef<NodeJS.Timeout | null>(null);
  const [recordKey, setRecordKey] = useState<string>('r');
  const [voiceKey, setVoiceKey] = useState<string>('v');
  const [rebindingKey, setRebindingKey] = useState<'record' | 'voice' | null>(null);
  const [interfaceColor, setInterfaceColor] = useState<string>('#00FF00');

  // Update interface color
  useEffect(() => {
    document.documentElement.style.setProperty('--brand-primary-hex', interfaceColor);
  }, [interfaceColor]);

  const startVoiceRecording = async () => {
    try {
      const audioStream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(audioStream);
      mediaRecorderRef.current = mediaRecorder;
      voiceChunksRef.current = [];

      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) voiceChunksRef.current.push(e.data);
      };

      mediaRecorder.onstop = () => {
        const voiceBlob = new Blob(voiceChunksRef.current, { type: 'audio/webm' });
        const voiceUrl = URL.createObjectURL(voiceBlob);
        
        // Add to library
        addToLibrary('audio', {
          url: voiceUrl,
          name: `VOICE_OVER_${new Date().toLocaleTimeString()}`,
          duration: voiceRecordingTime,
          thumbnail: undefined
        });

        // Clean up stream
        audioStream.getTracks().forEach(track => track.stop());
        setVoiceRecordingTime(0);
      };

      mediaRecorder.start();
      setIsRecordingVoice(true);
      
      voiceTimerRef.current = setInterval(() => {
        setVoiceRecordingTime(prev => prev + 100);
      }, 100);

    } catch (err) {
      console.error("Error accessing microphone:", err);
      alert("Could not access microphone.");
    }
  };

  const stopVoiceRecording = () => {
    if (mediaRecorderRef.current && isRecordingVoice) {
      mediaRecorderRef.current.stop();
      setIsRecordingVoice(false);
      if (voiceTimerRef.current) clearInterval(voiceTimerRef.current);
    }
  };

  const [globalTransition, setGlobalTransition] = useState<TransitionType>('fade');
  const [transitionDuration, setTransitionDuration] = useState(0.5);
  const [previewKey, setPreviewKey] = useState(0);
  const [language, setLanguage] = useState<LanguageCode>('en');
  const [searchQuery, setSearchQuery] = useState('');

  const t = (key: keyof typeof translations['en']) => {
    return translations[language][key] || translations['en'][key];
  };

  // Calculate total duration based on clips
  useEffect(() => {
    const maxClipEnd = clips.reduce((max, clip) => Math.max(max, clip.startTime + clip.duration), 0);
    const maxAudioEnd = audioTracks.reduce((max, track) => {
      const trackMax = track.clips.reduce((tm, clip) => Math.max(tm, clip.startTime + (clip.duration / 1000)), 0);
      return Math.max(max, trackMax);
    }, 0);
    setTotalDuration(Math.max(10, maxClipEnd, maxAudioEnd));
  }, [clips, audioTracks]);

  // Global playback timer
  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (isPlaying) {
      interval = setInterval(() => {
        setCurrentTime(prev => {
          if (prev >= totalDuration) {
            setIsPlaying(false);
            return 0; // Loop or stop at end
          }
          return prev + 0.033; // Increment by ~30fps for smoother motion
        });
      }, 33);
    }
    return () => clearInterval(interval);
  }, [isPlaying, totalDuration]);

  // Sync video elements with global currentTime and isPlaying
  const videoRefs = useRef<Record<string, HTMLVideoElement>>({});
  
  useEffect(() => {
    // Collect all active clip IDs first to clean up old refs
    const activeClipIds = new Set(clips.map(c => c.id));
    if (selectedLibraryItemId) activeClipIds.add(`lib-${selectedLibraryItemId}`);
    
    // Clean up refs for removed clips
    Object.keys(videoRefs.current).forEach(id => {
      if (!activeClipIds.has(id)) delete videoRefs.current[id];
    });

    Object.entries(videoRefs.current).forEach(([id, unknownVideo]) => {
      const video = unknownVideo as HTMLVideoElement;
      if (!video) return;
      
      // Determine what time this specific video should be at
      let targetTime = currentTime;
      
      if (id.startsWith('lib-')) {
        targetTime = currentTime;
      } else {
        const clip = clips.find(c => c.id === id);
        if (clip) {
          // Time relative to clip start
          targetTime = currentTime - clip.startTime;
          
          // Handle bounds
          if (targetTime < 0 || targetTime > clip.duration) {
            if (!video.paused) video.pause();
            video.style.opacity = '0';
            return;
          } else {
            video.style.opacity = '1';
          }
        }
      }

      if (isPlaying) {
        if (video.paused) video.play().catch(() => {});
      } else {
        if (!video.paused) video.pause();
      }
      
      // Sync if more than 50ms off
      if (Math.abs(video.currentTime - targetTime) > 0.05) {
        video.currentTime = targetTime;
      }
    });
  }, [currentTime, isPlaying, clips, selectedLibraryItemId]);

  // Global Drag and Drop
  useEffect(() => {
    const handleGlobalDragOver = (e: DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
    };

    const handleGlobalDrop = async (e: DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      
      const files = Array.from(e.dataTransfer?.files || []);
      if (files.length > 0) {
        // Reuse handleDrop logic
        const dropEvent = {
          preventDefault: () => {},
          dataTransfer: { files }
        } as unknown as React.DragEvent;
        handleDrop(dropEvent);
      }
    };

    window.addEventListener('dragover', handleGlobalDragOver);
    window.addEventListener('drop', handleGlobalDrop);

    return () => {
      window.removeEventListener('dragover', handleGlobalDragOver);
      window.removeEventListener('drop', handleGlobalDrop);
    };
  }, [currentTime]); // currentTime dependency to ensure handleDrop has access to current state if needed

  const seekTo = (time: number) => {
    const newTime = Math.max(0, Math.min(time, totalDuration));
    setCurrentTime(newTime);
  };

  // History management
  const [history, setHistory] = useState<{
    past: any[];
    future: any[];
  }>({ past: [], future: [] });

  // Persistence for Library
  useEffect(() => {
    const savedLibrary = localStorage.getItem('vlog_editor_library');
    if (savedLibrary) {
      try {
        setLibraryItems(JSON.parse(savedLibrary));
      } catch (e) {
        console.error('Failed to load library:', e);
      }
    }
  }, []);

  useEffect(() => {
    localStorage.setItem('vlog_editor_library', JSON.stringify(libraryItems));
  }, [libraryItems]);

  const saveToHistory = () => {
    const currentState = {
      clips: JSON.parse(JSON.stringify(clips)),
      audioTracks: JSON.parse(JSON.stringify(audioTracks)),
      filters: { ...filters },
      exportRatio,
      globalTransition,
      transitionDuration
    };

    setHistory(prev => ({
      past: [...prev.past.slice(-19), currentState], // Keep last 20 actions
      future: []
    }));
  };

  const undo = () => {
    if (history.past.length === 0) return;

    const prevState = history.past[history.past.length - 1];
    const newPast = history.past.slice(0, -1);

    const currentState = {
      clips: JSON.parse(JSON.stringify(clips)),
      audioTracks: JSON.parse(JSON.stringify(audioTracks)),
      filters: { ...filters },
      exportRatio,
      globalTransition,
      transitionDuration
    };

    setHistory({
      past: newPast,
      future: [currentState, ...history.future]
    });

    // Apply previous state
    setClips(prevState.clips);
    setAudioTracks(prevState.audioTracks);
    setFilters(prevState.filters);
    setExportRatio(prevState.exportRatio);
    setGlobalTransition(prevState.globalTransition);
    setTransitionDuration(prevState.transitionDuration);
  };

  const redo = () => {
    if (history.future.length === 0) return;

    const nextState = history.future[0];
    const newFuture = history.future.slice(1);

    const currentState = {
      clips: JSON.parse(JSON.stringify(clips)),
      audioTracks: JSON.parse(JSON.stringify(audioTracks)),
      filters: { ...filters },
      exportRatio,
      globalTransition,
      transitionDuration
    };

    setHistory({
      past: [...history.past, currentState],
      future: newFuture
    });

    // Apply next state
    setClips(nextState.clips);
    setAudioTracks(nextState.audioTracks);
    setFilters(nextState.filters);
    setExportRatio(nextState.exportRatio);
    setGlobalTransition(nextState.globalTransition);
    setTransitionDuration(nextState.transitionDuration);
  };

  // --- Keyframing Logic ---
  const getInterpolatedValue = (keyframes: any[] | undefined, time: number, defaultValue: number) => {
    if (!keyframes || keyframes.length === 0) return defaultValue;
    const sorted = [...keyframes].sort((a, b) => a.time - b.time);
    if (time <= sorted[0].time) return sorted[0].value;
    if (time >= sorted[sorted.length - 1].time) return sorted[sorted.length - 1].value;
    for (let i = 0; i < sorted.length - 1; i++) {
      const start = sorted[i];
      const end = sorted[i + 1];
      if (time >= start.time && time <= end.time) {
        const range = end.time - start.time;
        const progress = (time - start.time) / range;
        return start.value + (end.value - start.value) * progress;
      }
    }
    return defaultValue;
  };

  const activeClip = clips.find(c => c.id === selectedClipId);

  const getEffectiveFilters = (clip: VideoClip | undefined, time: number) => {
    if (!clip || !clip.keyframes) return filters;
    const relativeTime = Math.max(0, (time - clip.startTime) * 1000); // ms
    return {
      ...filters,
      brightness: getInterpolatedValue(clip.keyframes.brightness, relativeTime, filters.brightness),
      contrast: getInterpolatedValue(clip.keyframes.contrast, relativeTime, filters.contrast),
      saturation: getInterpolatedValue(clip.keyframes.saturation, relativeTime, filters.saturation),
      hue: getInterpolatedValue(clip.keyframes.hue, relativeTime, filters.hue),
      sepia: getInterpolatedValue(clip.keyframes.sepia, relativeTime, filters.sepia),
      grayscale: getInterpolatedValue(clip.keyframes.grayscale, relativeTime, filters.grayscale),
      zoom: getInterpolatedValue(clip.keyframes.zoom, relativeTime, filters.zoom),
      offsetX: getInterpolatedValue(clip.keyframes.offsetX, relativeTime, filters.offsetX),
      offsetY: getInterpolatedValue(clip.keyframes.offsetY, relativeTime, filters.offsetY),
      smooth: getInterpolatedValue(clip.keyframes.smooth, relativeTime, filters.smooth),
      blur: getInterpolatedValue(clip.keyframes.blur, relativeTime, filters.blur),
      opacity: getInterpolatedValue(clip.keyframes.opacity, relativeTime, filters.opacity),
    };
  };

  const effectiveFilters = getEffectiveFilters(activeClip, currentTime);

  const toggleKeyframe = (property: keyof AnimationKeyframes, value: number) => {
    if (!selectedClipId || !activeClip) return;
    saveToHistory();
    const relativeTime = Math.max(0, (currentTime - activeClip.startTime) * 1000);
    
    setClips(prevClips => prevClips.map(clip => {
      if (clip.id !== selectedClipId) return clip;
      
      const keyframes = clip.keyframes || {};
      const propKeyframes = keyframes[property] || [];
      
      const existingIdx = propKeyframes.findIndex(kf => Math.abs(kf.time - relativeTime) < 50); // 50ms tolerance
      
      let newPropKeyframes;
      if (existingIdx >= 0) {
        newPropKeyframes = propKeyframes.filter((_, i) => i !== existingIdx);
      } else {
        newPropKeyframes = [...propKeyframes, { time: relativeTime, value }].sort((a, b) => a.time - b.time);
      }
      
      return {
        ...clip,
        keyframes: { ...keyframes, [property]: newPropKeyframes }
      };
    }));
  };

  const hasKeyframeAtCurrentTime = (property: keyof AnimationKeyframes) => {
    if (!activeClip || !activeClip.keyframes) return false;
    const relativeTime = Math.max(0, (currentTime - activeClip.startTime) * 1000);
    const propKeyframes = activeClip.keyframes[property] || [];
    return propKeyframes.some(kf => Math.abs(kf.time - relativeTime) < 50);
  };

  const updateClipLayout = (id: string, layout: 'full' | 'left' | 'right') => {
    saveToHistory();
    setClips(clips.map(c => c.id === id ? { ...c, layout } : c));
  };

  const addToLibrary = (type: 'video' | 'audio', item: any) => {
    saveToHistory();
    const newItem: LibraryItem = {
      id: `lib-${Date.now()}`,
      type,
      url: item.url,
      name: item.name || (type === 'video' ? `SAVED_${item.id.slice(0,4)}` : 'Library Audio'),
      duration: item.duration || 0,
      thumbnail: item.thumbnail,
      filters: item.filters,
      keyframes: item.keyframes,
      createdAt: Date.now()
    };
    setLibraryItems(prev => [newItem, ...prev]);
  };

  const addFromLibrary = (item: LibraryItem) => {
    saveToHistory();
    if (item.type === 'video') {
       const newClip: VideoClip = {
          id: `clip-${Date.now()}`,
          url: item.url,
          blob: new Blob(),
          duration: item.duration,
          startTime: currentTime,
          filters: item.filters || filters,
          keyframes: item.keyframes,
          name: item.name
       };
       setClips(prev => [...prev, newClip]);
    } else {
       const newAudio: AudioClip = {
          id: `audio-${Date.now()}`,
          url: item.url,
          blob: new Blob(),
          duration: item.duration,
          startTime: currentTime,
          name: item.name,
          volume: 100
       };
       setAudioTracks(prev => prev.map((t, i) => i === 0 ? { ...t, clips: [...t.clips, newAudio] } : t));
    }
  };

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    const files = Array.from(e.dataTransfer.files);
    for (const file of files as File[]) {
      if (file.type.startsWith('video/') || file.type.startsWith('audio/')) {
        const type = file.type.startsWith('video/') ? 'video' : 'audio';
        const url = URL.createObjectURL(file);
        
        // Add to library
        addToLibrary(type, { url, name: file.name, duration: 5, thumbnail: undefined });
        
        // Add directly to timeline at current position
        if (type === 'video') {
          const newClip: VideoClip = {
            id: `clip-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
            url,
            blob: file as Blob,
            duration: 5, // Defaulting to 5s if we can't get metadata easily synchronously
            startTime: currentTime,
            filters: { ...filters },
            name: file.name
          };
          setClips(prev => [...prev, newClip]);
        } else {
          const newAudio: AudioClip = {
            id: `audio-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
            url,
            blob: file as Blob,
            duration: 5000,
            startTime: currentTime,
            name: file.name,
            volume: 100
          };
          setAudioTracks(prev => prev.map((t, i) => i === 0 ? { ...t, clips: [...t.clips, newAudio] } : t));
        }
      }
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  const handleLibraryUpload = (e: React.ChangeEvent<HTMLInputElement>, type: 'video' | 'audio') => {
    const file = e.target.files?.[0];
    if (!file) return;
    saveToHistory();
    const url = URL.createObjectURL(file);
    addToLibrary(type, { url, name: file.name, duration: 5, thumbnail: undefined }); // default 5s for now if duration unknown
  };

  const selectLibraryItem = (id: string | null) => {
    saveToHistory();
    setSelectedLibraryItemId(id);
    if (id) {
       setSelectedClipId(null);
       const item = libraryItems.find(i => i.id === id);
       if (item && item.filters) {
          setFilters(item.filters);
       }
    }
  };

  const splitClip = () => {
    if (!selectedClipId || !activeClip) return;
    saveToHistory();

    const relativeSplitPoint = currentTime - activeClip.startTime;
    if (relativeSplitPoint <= 0 || relativeSplitPoint >= activeClip.duration) return;

    const firstHalf: VideoClip = {
      ...activeClip,
      id: `clip-${Date.now()}-1`,
      duration: relativeSplitPoint,
    };

    const secondHalf: VideoClip = {
      ...activeClip,
      id: `clip-${Date.now()}-2`,
      startTime: currentTime,
      duration: activeClip.duration - relativeSplitPoint,
    };

    setClips(prev => {
      const index = prev.findIndex(c => c.id === selectedClipId);
      if (index === -1) return prev;
      const newClips = [...prev];
      newClips.splice(index, 1, firstHalf, secondHalf);
      return newClips;
    });

    setSelectedClipId(secondHalf.id);
  };

  // --- Keyboard Shortcuts ---
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Handle rebinding
      if (rebindingKey) {
        e.preventDefault();
        const key = e.key.toLowerCase();
        if (key === 'escape') {
          setRebindingKey(null);
          return;
        }
        if (rebindingKey === 'record') setRecordKey(key);
        else if (rebindingKey === 'voice') setVoiceKey(key);
        setRebindingKey(null);
        return;
      }

      // Don't trigger shortcuts if user is typing in an input or textarea
      if (
        document.activeElement?.tagName === 'INPUT' ||
        document.activeElement?.tagName === 'TEXTAREA' ||
        document.activeElement?.hasAttribute('contenteditable')
      ) {
        return;
      }

      const isMod = e.ctrlKey || e.metaKey;

      if (e.code === 'Space') {
        e.preventDefault();
        setIsPlaying(prev => !prev);
      } else if (e.key.toLowerCase() === 's' && !isMod) {
        e.preventDefault();
        splitClip();
      } else if (e.key.toLowerCase() === 'i' && !isMod) {
        e.preventDefault();
        handleInstantClip();
      } else if (e.key.toLowerCase() === recordKey.toLowerCase() && !isMod) {
        e.preventDefault();
        if (isRecording) stopCapture(); else startCapture();
      } else if (e.key.toLowerCase() === voiceKey.toLowerCase() && !isMod) {
        e.preventDefault();
        if (isRecordingVoice) stopVoiceRecording(); else startVoiceRecording();
      } else if (isMod && e.key.toLowerCase() === 'z') {
        e.preventDefault();
        if (e.shiftKey) {
          redo();
        } else {
          undo();
        }
      } else if (isMod && e.key.toLowerCase() === 'y') {
        e.preventDefault();
        redo();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectedClipId, activeClip, currentTime, isRecording, clips, history, recordKey, voiceKey, rebindingKey, isRecordingVoice]); // Dependencies for actions

  // Trigger preview when transition settings change
  useEffect(() => {
    setPreviewKey(prev => prev + 1);
  }, [globalTransition, transitionDuration]);
  
  const timelineRef = useRef<HTMLDivElement>(null);
  const previewContainerRef = useRef<HTMLDivElement>(null);

  // Handle instant clip
  const handleInstantClip = () => {
    const blob = getBufferBlob();
    if (blob) {
      saveToHistory();
      const url = URL.createObjectURL(blob);
      const newClip: VideoClip = {
        id: Math.random().toString(36).substr(2, 9),
        url,
        blob,
        duration: 0,
        startTime: clips.reduce((acc, c) => acc + c.duration, 0),
        textOverlays: [],
      };
      setClips([...clips, newClip]);
      setSelectedClipId(newClip.id);
    }
  };

  const addTextOverlay = () => {
    if (!selectedClipId) return;
    saveToHistory();
    const newText: TextOverlay = {
      id: Math.random().toString(36).substr(2, 9),
      text: "Double click to edit",
      x: 0,
      y: 0,
      fontSize: 32,
      color: "#FFFFFF",
      fontFamily: 'sans',
      type: 'text'
    };
    
    setClips(clips.map(c => 
      c.id === selectedClipId 
        ? { ...c, textOverlays: [...(c.textOverlays || []), newText] } 
        : c
    ));
    setSelectedTextId(newText.id);
  };

  const addStickerOverlay = (url: string) => {
    if (!selectedClipId) return;
    saveToHistory();
    const newId = `sticker-${Date.now()}`;
    const newSticker: TextOverlay = {
      id: newId,
      text: '',
      x: 0,
      y: 0,
      fontSize: 100,
      color: '#FFFFFF',
      fontFamily: 'sans',
      type: 'sticker',
      assetUrl: url
    };
    
    setClips(clips.map(c => 
      c.id === selectedClipId 
        ? { ...c, textOverlays: [...(c.textOverlays || []), newSticker] } 
        : c
    ));
    setSelectedTextId(newId);
    setSearchQuery('');
    setActiveTool('Text');
  };

  const updateTextOverlay = (id: string, updates: Partial<TextOverlay>) => {
    setClips(clips.map(c => 
      c.id === selectedClipId 
        ? { 
            ...c, 
            textOverlays: c.textOverlays?.map(t => t.id === id ? { ...t, ...updates } : t) 
          } 
        : c
    ));
  };

  const removeTextOverlay = (id: string) => {
    saveToHistory();
    setClips(clips.map(c => 
      c.id === selectedClipId 
        ? { ...c, textOverlays: c.textOverlays?.filter(t => t.id !== id) } 
        : c
    ));
    if (selectedTextId === id) setSelectedTextId(null);
  };

  const activeText = activeClip?.textOverlays?.find(t => t.id === selectedTextId);

  const addAudioTrack = () => {
    saveToHistory();
    const newTrack: TimelineAudioTrack = {
      id: `at-${audioTracks.length + 1}`,
      name: `Audio ${audioTracks.length + 1}`,
      clips: [],
      volume: 100
    };
    setAudioTracks([...audioTracks, newTrack]);
  };

  const updateTrackVolume = (trackId: string, volume: number) => {
    setAudioTracks(audioTracks.map(t => t.id === trackId ? { ...t, volume } : t));
  };

  const addPlaceholderAudio = (trackId: string) => {
    saveToHistory();
    const newAudio: AudioClip = {
      id: Math.random().toString(36).substr(2, 9),
      name: "Background Music",
      url: "",
      blob: new Blob(),
      duration: 5000,
      startTime: 0,
      volume: 100
    };
    
    setAudioTracks(audioTracks.map(t => 
      t.id === trackId 
        ? { ...t, clips: [...t.clips, newAudio] } 
        : t
    ));
    setSelectedAudioId(newAudio.id);
  };

  const removeAudioClip = (trackId: string, clipId: string) => {
    saveToHistory();
    setAudioTracks(audioTracks.map(t => 
      t.id === trackId 
        ? { ...t, clips: t.clips.filter(c => c.id !== clipId) } 
        : t
    ));
    if (selectedAudioId === clipId) setSelectedAudioId(null);
  };

  const removeAudioTrack = (trackId: string) => {
    saveToHistory();
    setAudioTracks(audioTracks.filter(t => t.id !== trackId));
  };

  const deleteClip = (id: string) => {
    saveToHistory();
    setClips(clips.filter(c => c.id !== id));
    if (selectedClipId === id) setSelectedClipId(null);
  };

  const getTransitionVariants = () => {
    const fadeInDur = filters.fadeIn > 0 ? filters.fadeIn : transitionDuration;
    const fadeOutDur = filters.fadeOut > 0 ? filters.fadeOut : transitionDuration;

    switch (globalTransition) {
      case 'fade':
        return {
          initial: { opacity: 0 },
          animate: { opacity: 1 },
          exit: { opacity: 0 },
          transition: { 
            duration: transitionDuration,
            opacity: { duration: fadeInDur } // Entrance
          },
          exitTransition: { duration: fadeOutDur }
        };
      case 'zoom':
        return {
          initial: { scale: 0.8, opacity: 0 },
          animate: { scale: 1, opacity: 1 },
          exit: { scale: 1.2, opacity: 0 },
          transition: { duration: fadeInDur, ease: "easeOut" },
          exitTransition: { duration: fadeOutDur, ease: "easeIn" }
        };
      case 'slide':
        return {
          initial: { x: '100%', opacity: 0 },
          animate: { x: 0, opacity: 1 },
          exit: { x: '-100%', opacity: 0 },
          transition: { duration: fadeInDur, ease: "easeInOut" },
          exitTransition: { duration: fadeOutDur, ease: "easeInOut" }
        };
      case 'wipe':
        return {
          initial: { clipPath: 'inset(0 100% 0 0)' },
          animate: { clipPath: 'inset(0 0% 0 0)' },
          exit: { clipPath: 'inset(0 0 0 100%)' },
          transition: { duration: fadeInDur, ease: "linear" },
          exitTransition: { duration: fadeOutDur, ease: "linear" }
        };
      case 'circleOpen':
        return {
          initial: { clipPath: 'circle(0% at 50% 50%)' },
          animate: { clipPath: 'circle(150% at 50% 50%)' },
          exit: { clipPath: 'circle(0% at 50% 50%)' },
          transition: { duration: fadeInDur, ease: "easeIn" },
          exitTransition: { duration: fadeOutDur, ease: "easeOut" }
        };
      case 'dissolve':
        return {
          initial: { opacity: 0, filter: 'blur(20px)' },
          animate: { opacity: 1, filter: 'blur(0px)' },
          exit: { opacity: 0, filter: 'blur(20px)' },
          transition: { duration: fadeInDur, ease: "easeInOut" },
          exitTransition: { duration: fadeOutDur, ease: "easeInOut" }
        };
      case 'cut':
      default:
        return {
          initial: { opacity: 1 },
          animate: { opacity: 1 },
          exit: { opacity: 1 },
          transition: { duration: 0 }
        };
    }
  };

  const variants = getTransitionVariants();

  return (
    <div className="flex flex-col h-screen bg-bg-dark text-white select-none overflow-hidden font-sans">
      {/* Top Header Bar */}
      <header className="h-14 border-b border-border-subtle flex items-center justify-between px-6 bg-bg-panel/50 backdrop-blur-md z-50">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 bg-brand-primary rounded flex items-center justify-center">
            <Layers className="text-black w-5 h-5" />
          </div>
          <span className="font-bold tracking-tight text-lg">
            {t('title').split(' ')[0]} 
            {t('title').split(' ')[1] && (
              <span className="text-brand-primary text-xs uppercase font-mono px-1 border border-brand-primary/30 rounded ml-1">
                {t('title').split(' ')[1]}
              </span>
            )}
          </span>
        </div>

        <div className="flex items-center gap-4">
          <div className="flex items-center bg-black/40 rounded-full px-1 py-1 border border-border-subtle">
            {(['16:9', '9:16', '1:1'] as AspectRatio[]).map((ratio) => (
              <button
                key={ratio}
                onClick={() => {
                  saveToHistory();
                  setExportRatio(ratio);
                }}
                className={cn(
                  "px-3 py-1 text-[10px] font-bold rounded-full transition-all uppercase",
                  exportRatio === ratio ? "bg-white text-black" : "text-white/40 hover:text-white"
                )}
              >
                {ratio}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-1 mx-2">
            <button 
              onClick={undo}
              disabled={history.past.length === 0}
              className="p-2 text-white/40 hover:text-white disabled:opacity-20 transition-all"
              title="Undo"
            >
              <Undo className="w-4 h-4" />
            </button>
            <button 
              onClick={redo}
              disabled={history.future.length === 0}
              className="p-2 text-white/40 hover:text-white disabled:opacity-20 transition-all"
              title="Redo"
            >
              <Redo className="w-4 h-4" />
            </button>
          </div>
          
          <button 
            onClick={isRecording ? stopCapture : startCapture}
            className={cn(
              "flex items-center gap-2 px-4 py-1.5 rounded-full font-bold text-xs transition-all border",
              isRecording 
                ? "bg-brand-error/10 border-brand-error text-brand-error recording-glow" 
                : "bg-white/5 border-white/20 hover:bg-white/10"
            )}
          >
            {isRecording ? <Square className="w-3 h-3 fill-current" /> : <Circle className="w-3 h-3 fill-brand-error" />}
            {isRecording ? t('stopCapture') : t('startCapture')}
          </button>

          <button 
            onClick={handleInstantClip}
            disabled={!isRecording}
            className="flex items-center gap-2 px-4 py-1.5 bg-brand-primary text-black rounded-full font-bold text-xs hover:bg-brand-primary/90 transition-all disabled:opacity-30 disabled:cursor-not-allowed"
          >
            <RotateCcw className="w-3 h-3" />
            {t('instantClip')}
          </button>
          
          <div className="h-6 w-px bg-border-subtle mx-2" />
          
          <button className="flex items-center gap-2 px-4 py-1.5 bg-white text-black rounded-full font-bold text-xs hover:bg-white/90 transition-all">
            <Download className="w-3 h-3" />
            {t('export')}
          </button>
        </div>
      </header>

      {/* Main Container */}
      <main className="flex-1 flex overflow-hidden">
        {/* Left Toolbar */}
        <aside className="w-16 border-r border-border-subtle flex flex-col items-center py-6 gap-6 bg-bg-panel/20">
          <ToolIcon icon={<Scissors />} label={t('trim')} active={activeTool === 'Trim'} onClick={() => setActiveTool('Trim')} />
          <ToolIcon icon={<Type />} label={t('text')} active={activeTool === 'Text'} onClick={() => setActiveTool('Text')} />
          <ToolIcon icon={<Palette />} label={t('color')} active={activeTool === 'Color'} onClick={() => setActiveTool('Color')} />
          <ToolIcon icon={<Columns2 />} label={t('layout')} active={activeTool === 'Layout'} onClick={() => setActiveTool('Layout')} />
          <ToolIcon icon={<Zap />} label={t('transitions')} active={activeTool === 'Transitions'} onClick={() => setActiveTool('Transitions')} />
          <ToolIcon icon={<Volume2 />} label={t('audio')} active={activeTool === 'Audio'} onClick={() => setActiveTool('Audio')} />
          <ToolIcon icon={<RotateCcw />} label={t('speed')} active={activeTool === 'Speed'} onClick={() => setActiveTool('Speed')} />
          <ToolIcon icon={<Library />} label={t('library')} active={activeTool === 'Library'} onClick={() => setActiveTool('Library')} />
          <div className="mt-auto">
            <ToolIcon icon={<Settings />} label={t('config')} active={activeTool === 'Config'} onClick={() => setActiveTool('Config')} />
          </div>
        </aside>

        {/* Central Work Area */}
        <section 
          className="flex-1 flex flex-col bg-black/20"
          onDragOver={handleDragOver}
          onDrop={handleDrop}
        >
          {/* Preview Area */}
          <div className="flex-1 relative flex items-center justify-center p-8 bg-black">
            <div 
              ref={previewContainerRef}
              className={cn(
                "relative bg-bg-card hardware-surface shadow-[0_0_100px_rgba(0,0,0,0.5)] flex items-center justify-center overflow-hidden transition-all duration-500",
                exportRatio === '16:9' ? "aspect-video h-[60vh]" : 
                exportRatio === '9:16' ? "aspect-[9/16] h-[75vh]" : 
                "aspect-square h-[65vh]"
              )}
            >
              <AnimatePresence>
                {(!selectedClipId && selectedLibraryItemId) && (
                   <motion.video
                      key={`lib-preview-${selectedLibraryItemId}`}
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      src={libraryItems.find(i => i.id === selectedLibraryItemId)?.url}
                      ref={(el) => { if (el) videoRefs.current[`lib-${selectedLibraryItemId}`] = el; }}
                      className="absolute inset-0 w-full h-full object-cover"
                      style={{ 
                        filter: `brightness(${filters.brightness}%) contrast(${filters.contrast}%) saturate(${filters.saturation}%) hue-rotate(${filters.hue}deg) sepia(${filters.sepia}%) grayscale(${filters.grayscale}%) blur(${(filters.blur + filters.smooth * 0.3) / 5}px)`,
                       opacity: filters.opacity / 100
                      }}
                      autoPlay={isPlaying}
                      onTimeUpdate={(e) => {
                         if (isPlaying) {
                            const video = e.currentTarget;
                            setCurrentTime(video.currentTime);
                         }
                      }}
                      loop
                   />
                )}
                {selectedLibraryItemId && (
                   <div className="absolute top-4 left-4 z-50 flex items-center gap-2 px-2 py-1 bg-brand-primary rounded text-[8px] font-bold text-black uppercase tracking-widest animate-pulse">
                      <Library className="w-3 h-3" />
                      Previewing Library Item
                   </div>
                )}
                {clips.map(clip => {
                   const isActive = clip.id === selectedClipId;
                   const clipFilters = isActive ? effectiveFilters : clip.filters || filters;
                   const layout = clip.layout || 'full';
                   
                   // Render if:
                   // 1. It's the selected clip
                   // 2. OR it's a 'left' or 'right' clip overlapping with the selected clip's time range
                   // (Simplified: if selected is split, also render other split components)
                   
                   const shouldRender = isActive || (
                     activeClip && 
                     (activeClip.layout === 'left' || activeClip.layout === 'right') && 
                     (clip.layout === 'left' || clip.layout === 'right') &&
                     clip.layout !== activeClip.layout &&
                     // Overlap check (rough for preview)
                     Math.abs(clip.startTime - activeClip.startTime) < 0.1
                   );

                   if (!shouldRender) return null;

                   return (
                    <motion.video
                      key={`${clip.id}-${previewKey}`}
                      initial={isActive ? variants.initial : { opacity: 0 }}
                      animate={isActive ? variants.animate : { opacity: 1 }}
                      exit={isActive ? variants.exit : { opacity: 0 }}
                      transition={variants.transition}
                      {...(variants as any).exitTransition ? { exit: { ...variants.exit, transition: (variants as any).exitTransition } } : {}}
                      src={clip.url}
                      ref={(el) => { if (el) videoRefs.current[clip.id] = el; }}
                      drag
                      dragConstraints={previewContainerRef}
                      onDragStart={() => saveToHistory()}
                      onDrag={(_, info) => {
                        const rect = previewContainerRef.current?.getBoundingClientRect();
                        if (rect && isActive) {
                          const deltaX = (info.delta.x / rect.width) * 100;
                          const deltaY = (info.delta.y / rect.height) * 100;
                          setFilters(prev => ({ 
                            ...prev, 
                            offsetX: prev.offsetX + deltaX, 
                            offsetY: prev.offsetY + deltaY 
                          }));
                        }
                      }}
                      className={cn(
                        "absolute transition-all object-cover",
                        layout === 'full' ? "w-full h-full inset-0" : 
                        layout === 'left' ? "w-1/2 h-full left-0 top-0 border-r border-white/20" : 
                        "w-1/2 h-full right-0 top-0 border-l border-white/20"
                      )}
                      style={{ 
                        filter: `brightness(${clipFilters.brightness}%) contrast(${clipFilters.contrast}%) saturate(${clipFilters.saturation}%) hue-rotate(${clipFilters.hue}deg) sepia(${clipFilters.sepia}%) grayscale(${clipFilters.grayscale}%) blur(${(clipFilters.blur + clipFilters.smooth * 0.3) / 5}px)`,
                       transform: `scale(${clipFilters.zoom / 100}) translate(${clipFilters.offsetX}%, ${clipFilters.offsetY}%)`,
                       opacity: clipFilters.opacity / 100
                      }}
                      autoPlay={isPlaying}
                      loop
                    />
                   );
                })}
                {clips.length === 0 && (
                  <div className="flex flex-col items-center gap-4 text-white/20">
                    <Layers className="w-16 h-16 opacity-10" />
                    <p className="text-sm font-mono tracking-widest uppercase italic">Ready for input</p>
                  </div>
                )}
              </AnimatePresence>

              {/* Text Overlays */}
              <div className="absolute inset-0 pointer-events-none">
                {activeClip?.textOverlays?.map((t) => (
                  <motion.div
                    key={t.id}
                    drag
                    dragConstraints={previewContainerRef}
                    dragMomentum={false}
                    onDragEnd={(_, info) => {
                      updateTextOverlay(t.id, { x: t.x + info.offset.x, y: t.y + info.offset.y });
                    }}
                    onTap={() => {
                      setSelectedTextId(t.id);
                      setActiveTool('Text');
                    }}
                    style={{
                      position: 'absolute',
                      left: '50%',
                      top: '50%',
                      x: t.x,
                      y: t.y,
                      color: t.color,
                      fontSize: `${t.fontSize}px`,
                      fontFamily: t.fontFamily === 'mono' ? 'JetBrains Mono, monospace' : t.fontFamily === 'serif' ? 'serif' : 'Inter, sans-serif',
                      cursor: 'move',
                      pointerEvents: 'auto',
                      whiteSpace: 'pre-wrap',
                      textAlign: 'center',
                      lineHeight: 1.2,
                    }}
                    className={cn(
                      "p-2 rounded-lg transition-shadow select-none",
                      selectedTextId === t.id ? "ring-2 ring-brand-primary" : "hover:ring-1 hover:ring-white/20"
                    )}
                  >
                    {t.type === 'sticker' ? (
                      <img 
                        src={t.assetUrl} 
                        alt="sticker" 
                        className="pointer-events-none select-none drop-shadow-xl"
                        style={{ width: `${t.fontSize}px`, height: 'auto' }}
                        referrerPolicy="no-referrer"
                      />
                    ) : (
                      t.text
                    )}
                  </motion.div>
                ))}
              </div>

              {/* Status HUD Overlays */}
              <div className="absolute top-4 left-4 flex flex-col gap-1">
                 <HUDLabel label="REC" value={isRecording ? "ACTIVE" : "IDLE"} dot={isRecording} />
                 <HUDLabel label="CLIP" value={selectedClipId ? selectedClipId.slice(0, 6) : "NONE"} />
              </div>

              <div className="absolute bottom-6 left-1/2 -translate-x-1/2 flex items-center gap-6 bg-black/60 backdrop-blur px-6 py-3 rounded-full border border-white/10">
                <button 
                  onClick={() => {
                    seekTo(0);
                  }}
                  className="text-white/60 hover:text-white transition-colors"
                  title="Reset"
                >
                  <RotateCcw className="w-4 h-4 translate-y-[2px]" />
                </button>
                <div className="flex items-center gap-3">
                  <button 
                    onClick={() => seekTo(currentTime - 5)}
                    className="text-white/60 hover:text-white transition-colors p-1"
                    title="Skip Backward 5s"
                  >
                    <motion.div whileTap={{ scale: 0.9 }}>
                      <SkipBack className="w-4 h-4" />
                    </motion.div>
                  </button>
                  <button 
                    onClick={() => setIsPlaying(!isPlaying)}
                    className="w-10 h-10 bg-white rounded-full flex items-center justify-center text-black hover:scale-110 active:scale-95 transition-all shadow-[0_0_20px_rgba(255,255,255,0.2)]"
                  >
                    {isPlaying ? <Pause className="w-5 h-5 fill-current" /> : <Play className="w-5 h-5 fill-current ml-0.5" />}
                  </button>
                  <button 
                    onClick={() => seekTo(currentTime + 5)}
                    className="text-white/60 hover:text-white transition-colors p-1"
                    title="Skip Forward 5s"
                  >
                    <motion.div whileTap={{ scale: 0.9 }}>
                      <SkipForward className="w-4 h-4" />
                    </motion.div>
                  </button>
                </div>
                <p className="font-mono text-xs tracking-widest text-brand-primary w-20 text-center">{formatTime(currentTime)}</p>
                <button className="text-white/60 hover:text-white transition-colors"><Maximize2 className="w-4 h-4" /></button>
              </div>
            </div>
          </div>

          {/* Timeline Section */}
          <div 
            className="h-64 border-t border-border-subtle bg-bg-panel/40 flex flex-col relative"
            onDragOver={handleDragOver}
            onDrop={handleDrop}
          >
             <div className="h-8 border-b border-border-subtle flex items-center px-4 justify-between bg-black/20">
                <div className="flex items-center gap-4">
                  <span className="text-[10px] font-bold font-mono text-white/40 uppercase tracking-widest">{t('timeline')}</span>
                  <div className="flex items-center gap-2 ml-4">
                    <button 
                      onClick={() => seekTo(0)} 
                      className="p-1 hover:bg-white/10 rounded transition-colors text-white/40 hover:text-white"
                    >
                      <RotateCcw className="w-3.5 h-3.5" />
                    </button>
                    <button 
                      onClick={() => setIsPlaying(!isPlaying)} 
                      className="p-1 hover:bg-white/10 rounded transition-colors text-white/40 hover:text-white"
                    >
                      {isPlaying ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
                    </button>
                    <span className="text-[9px] font-mono text-brand-primary tracking-tighter">
                      {formatTime(currentTime)} / {formatTime(totalDuration)}
                    </span>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                   <button className="p-1 hover:bg-white/10 rounded"><Plus className="w-4 h-4 text-white/60" /></button>
                </div>
             </div>
             
             {/* Timeline Tracks */}
             <div 
               ref={timelineRef}
               className="flex-1 overflow-x-auto overflow-y-hidden custom-scrollbar relative"
               onMouseDown={(e) => {
                 const rect = e.currentTarget.getBoundingClientRect();
                 const x = e.clientX - rect.left - 96;
                 if (x >= 0) {
                   setIsPlaying(false);
                   const timelineWidth = e.currentTarget.offsetWidth - 96;
                   seekTo((x / timelineWidth) * totalDuration);
                   
                   const handleMouseMove = (moveEvent: MouseEvent) => {
                     const moveX = moveEvent.clientX - rect.left - 96;
                     seekTo((Math.max(0, moveX) / timelineWidth) * totalDuration);
                   };
                   
                   const handleMouseUp = () => {
                     window.removeEventListener('mousemove', handleMouseMove);
                     window.removeEventListener('mouseup', handleMouseUp);
                   };
                   
                   window.addEventListener('mousemove', handleMouseMove);
                   window.addEventListener('mouseup', handleMouseUp);
                 }
               }}
             >
                {/* Playhead */}
                <div 
                  className="absolute top-0 bottom-0 w-px bg-brand-primary z-50 timeline-marker cursor-ew-resize group" 
                  style={{ left: `${(currentTime / totalDuration) * 100}%`, marginLeft: '96px' }}
                >
                   <div className="w-3 h-3 bg-brand-primary rotate-45 -translate-x-[6px] -translate-y-[6px] shadow-[0_0_10px_rgba(0,255,0,0.5)] group-hover:scale-125 transition-transform" />
                   <div className="absolute top-0 bottom-0 -left-2 -right-2" />
                </div>

                <div className="flex flex-col h-full py-4 gap-2">
                   <TimelineTrack 
                      label={t('library')} 
                      clips={clips} 
                      onSelect={(id) => setSelectedClipId(id)} 
                      selectedId={selectedClipId} 
                      onDelete={deleteClip}
                      totalDuration={totalDuration}
                   />
                   
                   {audioTracks.map((track) => (
                      <TimelineTrack 
                        key={track.id}
                        label={track.name}
                        clips={track.clips}
                        type="audio"
                        selectedId={selectedAudioId}
                        onSelect={(id) => setSelectedAudioId(id)}
                        onDelete={(clipId) => removeAudioClip(track.id, clipId)}
                        onAdd={() => addPlaceholderAudio(track.id)}
                        onRemoveTrack={() => removeAudioTrack(track.id)}
                        totalDuration={totalDuration}
                      />
                   ))}

                   <button 
                    onClick={addAudioTrack}
                    className="ml-24 mt-2 mb-4 w-32 flex items-center justify-center gap-2 py-1.5 bg-white/5 border border-white/10 rounded text-[9px] font-bold uppercase tracking-widest hover:bg-white/10 transition-all text-white/40 hover:text-white"
                   >
                     <Plus className="w-3 h-3" />
                     {t('addTrack')}
                   </button>
                </div>
             </div>
          </div>
        </section>

        {/* Right Properties Panel */}
        <aside className="w-72 border-l border-border-subtle bg-bg-panel/10 flex flex-col">
           <div className="p-6">
              <h3 className="text-xs font-bold uppercase tracking-[0.2em] text-white/40 mb-6">
                {(translations[language][activeTool.toLowerCase() as keyof TranslationSet] || activeTool)} {t('details')}
              </h3>
              
              <div className="space-y-8">
                 {activeTool === 'Trim' && (
                    <>
                       <div className="flex items-center justify-between mb-4">
                          <label className="text-[10px] font-bold uppercase tracking-widest text-white/40">{t('clipAdjustments')}</label>
                       </div>
                       <PropertySlider 
                         label={t('fadeIn')} 
                         value={filters.fadeIn * 20} 
                         onChange={(val) => {
                            if (filters.fadeIn !== val / 20) saveToHistory();
                            setFilters({...filters, fadeIn: val / 20});
                         }}
                       />
                       <PropertySlider 
                         label={t('fadeOut')} 
                         value={filters.fadeOut * 20} 
                         onChange={(val) => {
                            if (filters.fadeOut !== val / 20) saveToHistory();
                            setFilters({...filters, fadeOut: val / 20});
                         }}
                       />
                       <div className="h-px bg-border-subtle !my-4" />
                       <PropertySlider 
                         label={t('zoom')} 
                         value={(filters.zoom - 100) / 3} 
                         onChange={(val) => {
                            if (filters.zoom !== 100 + val * 3) saveToHistory();
                            setFilters({...filters, zoom: 100 + val * 3});
                         }}
                         isKeyframed={hasKeyframeAtCurrentTime('zoom')}
                         onKeyframeToggle={() => toggleKeyframe('zoom', filters.zoom)}
                       />
                       <div className="grid grid-cols-2 gap-4">
                         <PropertySlider 
                           label="Focus X" 
                           value={filters.offsetX + 50} 
                           onChange={(val) => {
                              if (filters.offsetX !== val - 50) saveToHistory();
                              setFilters({...filters, offsetX: val - 50});
                           }}
                           isKeyframed={hasKeyframeAtCurrentTime('offsetX')}
                           onKeyframeToggle={() => toggleKeyframe('offsetX', filters.offsetX)}
                         />
                         <PropertySlider 
                           label="Focus Y" 
                           value={filters.offsetY + 50} 
                           onChange={(val) => {
                              if (filters.offsetY !== val - 50) saveToHistory();
                              setFilters({...filters, offsetY: val - 50});
                           }}
                           isKeyframed={hasKeyframeAtCurrentTime('offsetY')}
                           onKeyframeToggle={() => toggleKeyframe('offsetY', filters.offsetY)}
                         />
                       </div>

                       <div className="h-px bg-border-subtle !my-4" />
                       
                       <div className="space-y-4">
                         <PropertySlider 
                           label={t('smooth')} 
                           value={filters.smooth} 
                           onChange={(val) => {
                              if (filters.smooth !== val) saveToHistory();
                              setFilters({...filters, smooth: val});
                           }}
                           isKeyframed={hasKeyframeAtCurrentTime('smooth')}
                           onKeyframeToggle={() => toggleKeyframe('smooth', filters.smooth)}
                         />
                         <PropertySlider 
                           label={t('blur')} 
                           value={filters.blur} 
                           onChange={(val) => {
                              if (filters.blur !== val) saveToHistory();
                              setFilters({...filters, blur: val});
                           }}
                           isKeyframed={hasKeyframeAtCurrentTime('blur')}
                           onKeyframeToggle={() => toggleKeyframe('blur', filters.blur)}
                         />
                         <PropertySlider 
                           label={t('opacity')} 
                           value={filters.opacity} 
                           onChange={(val) => {
                              if (filters.opacity !== val) saveToHistory();
                              setFilters({...filters, opacity: val});
                           }}
                           isKeyframed={hasKeyframeAtCurrentTime('opacity')}
                           onKeyframeToggle={() => toggleKeyframe('opacity', filters.opacity)}
                         />
                       </div>
                    </>
                 )}

                 {activeTool === 'Color' && (
                    <div className="space-y-6">
                       <div className="flex items-center justify-between">
                          <label className="text-[10px] font-bold uppercase tracking-widest text-white/40">{t('colorGrading')}</label>
                          <button 
                            onClick={() => {
                              saveToHistory();
                              setFilters({
                                ...filters, 
                                brightness: 100, contrast: 100, saturation: 100, 
                                hue: 0, sepia: 0, grayscale: 0, lut: undefined
                              });
                            }}
                            className="text-[8px] uppercase tracking-tighter text-brand-primary/60 hover:text-brand-primary"
                          >{t('reset')}</button>
                       </div>

                       <div className="space-y-4">
                          <div className="space-y-2">
                            <label className="text-[10px] font-bold uppercase tracking-widest text-white/20">{t('lutPresets')}</label>
                            <div className="grid grid-cols-3 gap-2">
                               {[
                                 { id: 'cinematic', label: t('presetCinematic'), lut: { contrast: 125, saturation: 115, hue: 0, sepia: 15, grayscale: 0 } },
                                 { id: 'noir', label: t('presetNoir'), lut: { contrast: 150, saturation: 0, hue: 0, sepia: 0, grayscale: 100 } },
                                 { id: 'vintage', label: t('presetVintage'), lut: { contrast: 85, saturation: 75, hue: 0, sepia: 45, grayscale: 0 } },
                                 { id: 'punchy', label: t('presetPunchy'), lut: { contrast: 135, saturation: 125, hue: 0, sepia: 0, grayscale: 0 } },
                                 { id: 'cold', label: t('presetCold'), lut: { contrast: 110, saturation: 85, hue: 200, sepia: 0, grayscale: 0 } },
                                 { id: 'vibrant', label: t('presetVibrant'), lut: { contrast: 105, saturation: 145, hue: 0, sepia: 0, grayscale: 0 } }
                               ].map(preset => (
                                 <button 
                                   key={preset.id}
                                   onClick={() => {
                                     saveToHistory();
                                     setFilters({ ...filters, ...preset.lut, lut: preset.id });
                                   }}
                                   className={cn(
                                      "aspect-square rounded-xl border flex flex-col items-center justify-center gap-1.5 p-2 transition-all group",
                                      filters.lut === preset.id 
                                       ? "bg-brand-primary/10 border-brand-primary text-brand-primary" 
                                       : "bg-black/40 border-white/5 text-white/40 hover:border-white/20"
                                   )}
                                 >
                                   <div className={cn(
                                     "w-full flex-1 rounded-lg bg-gradient-to-br transition-all",
                                     preset.id === 'cinematic' && "from-amber-900/40 to-blue-900/40",
                                     preset.id === 'noir' && "from-gray-900 to-gray-500",
                                     preset.id === 'vintage' && "from-orange-900/40 to-yellow-900/40",
                                     preset.id === 'punchy' && "from-red-900/40 to-black",
                                     preset.id === 'cold' && "from-blue-900/40 to-cyan-900/40",
                                     preset.id === 'vibrant' && "from-purple-900/40 to-pink-900/40",
                                     "group-hover:scale-110",
                                     filters.lut === preset.id && "scale-110"
                                   )} />
                                   <span className="text-[7px] font-bold uppercase tracking-widest truncate w-full text-center">{preset.label}</span>
                                 </button>
                               ))}
                            </div>
                          </div>

                          <div className="h-px bg-border-subtle my-2" />

                          <PropertySlider 
                            label={t('brightness')} 
                            value={filters.brightness} 
                            onChange={(val) => {
                               if (filters.brightness !== val) saveToHistory();
                               setFilters({...filters, brightness: val});
                            }}
                            isKeyframed={hasKeyframeAtCurrentTime('brightness')}
                            onKeyframeToggle={() => toggleKeyframe('brightness', filters.brightness)}
                          />
                          <PropertySlider 
                            label={t('contrast')} 
                            value={filters.contrast} 
                            onChange={(val) => {
                               if (filters.contrast !== val) saveToHistory();
                               setFilters({...filters, contrast: val});
                            }}
                            isKeyframed={hasKeyframeAtCurrentTime('contrast')}
                            onKeyframeToggle={() => toggleKeyframe('contrast', filters.contrast)}
                          />
                          <PropertySlider 
                            label={t('saturation')} 
                            value={filters.saturation} 
                            onChange={(val) => {
                               if (filters.saturation !== val) saveToHistory();
                               setFilters({...filters, saturation: val});
                            }}
                            isKeyframed={hasKeyframeAtCurrentTime('saturation')}
                            onKeyframeToggle={() => toggleKeyframe('saturation', filters.saturation)}
                          />
                          <PropertySlider 
                            label={t('hue')} 
                            value={filters.hue / 3.6} 
                            onChange={(val) => {
                               if (filters.hue !== val * 3.6) saveToHistory();
                               setFilters({...filters, hue: val * 3.6});
                            }}
                            isKeyframed={hasKeyframeAtCurrentTime('hue')}
                            onKeyframeToggle={() => toggleKeyframe('hue', filters.hue)}
                          />
                          <PropertySlider 
                            label={t('sepia')} 
                            value={filters.sepia} 
                            onChange={(val) => {
                               if (filters.sepia !== val) saveToHistory();
                               setFilters({...filters, sepia: val});
                            }}
                            isKeyframed={hasKeyframeAtCurrentTime('sepia')}
                            onKeyframeToggle={() => toggleKeyframe('sepia', filters.sepia)}
                          />
                          <PropertySlider 
                            label={t('grayscale')} 
                            value={filters.grayscale} 
                            onChange={(val) => {
                               if (filters.grayscale !== val) saveToHistory();
                               setFilters({...filters, grayscale: val});
                            }}
                            isKeyframed={hasKeyframeAtCurrentTime('grayscale')}
                            onKeyframeToggle={() => toggleKeyframe('grayscale', filters.grayscale)}
                          />
                       </div>
                    </div>
                 )}

                  {activeTool === 'Config' && (
                    <div className="space-y-6">
                       <label className="text-[10px] font-bold uppercase tracking-widest text-white/40">{t('language')}</label>
                       <div className="grid grid-cols-2 gap-2">
                          {[
                            { code: 'en', name: 'English' },
                            { code: 'zh', name: 'Chinese' },
                            { code: 'hi', name: 'Hindi' },
                            { code: 'es', name: 'Spanish' },
                            { code: 'ar', name: 'Arabic' },
                            { code: 'fr', name: 'French' },
                            { code: 'bn', name: 'Bengali' },
                            { code: 'pt', name: 'Portuguese' },
                            { code: 'ru', name: 'Russian' },
                            { code: 'id', name: 'Indonesian' }
                          ].map(lang => (
                            <button
                              key={lang.code}
                              onClick={() => setLanguage(lang.code as LanguageCode)}
                              className={cn(
                                "py-2 px-3 rounded-lg border text-[10px] font-bold transition-all text-left",
                                language === lang.code 
                                  ? "bg-brand-primary border-brand-primary text-black" 
                                  : "bg-black/40 border-white/5 text-white/40 hover:border-white/20"
                              )}
                            >
                              {lang.name}
                            </button>
                          ))}
                       </div>

                       <div className="h-px bg-border-subtle my-4" />
                       <label className="text-[10px] font-bold uppercase tracking-widest text-white/40">{t('aspectRatio')}</label>
                       <div className="flex bg-black/40 p-1 rounded-xl border border-white/5">
                          {(['16:9', '9:16', '1:1'] as AspectRatio[]).map((ratio) => (
                             <button
                                key={ratio}
                                onClick={() => setExportRatio(ratio)}
                                className={cn(
                                   "flex-1 py-2 rounded-lg text-[10px] font-bold uppercase tracking-widest transition-all",
                                   exportRatio === ratio ? "bg-white text-black" : "text-white/40 hover:text-white"
                                )}
                             >
                                {ratio}
                             </button>
                          ))}
                       </div>

                       <div className="h-px bg-border-subtle my-4" />
                       <label className="text-[10px] font-bold uppercase tracking-widest text-white/40">{t('interfaceColor')}</label>
                       <div className="flex items-center gap-4 bg-black/40 p-3 rounded-xl border border-white/5 mt-2">
                          <div 
                             className="w-10 h-10 rounded-lg border border-white/10 shrink-0" 
                             style={{ backgroundColor: interfaceColor }} 
                          />
                          <input 
                             type="color" 
                             value={interfaceColor}
                             onChange={(e) => setInterfaceColor(e.target.value)}
                             className="flex-1 h-10 bg-transparent border-none cursor-pointer p-0"
                          />
                          <button 
                             onClick={() => setInterfaceColor('#00FF00')}
                             className="text-[10px] font-bold uppercase tracking-widest text-white/40 hover:text-white transition-colors"
                          >
                             {t('reset')}
                          </button>
                       </div>

                       <div className="h-px bg-border-subtle my-4" />
                       <label className="text-[10px] font-bold uppercase tracking-widest text-white/40">{t('shortcuts')}</label>
                       <div className="space-y-3 mt-2">
                          {[
                            { id: 'play', key: 'Space', desc: t('playPause') },
                            { id: 'split', key: 'S', desc: t('split') },
                            { id: 'instant', key: 'I', desc: t('instant') },
                            { id: 'record', key: recordKey.toUpperCase(), desc: t('shortcutRecord'), custom: true },
                            { id: 'voice', key: voiceKey.toUpperCase(), desc: t('shortcutVoice'), custom: true },
                            { id: 'undo', key: 'Ctrl+Z', desc: t('undo') },
                            { id: 'redo', key: 'Ctrl+Y', desc: t('redo') },
                          ].map(shortcut => (
                            <div key={shortcut.id} className="flex items-center justify-between text-[10px]">
                               <span className="text-white/40">{shortcut.desc}</span>
                               <div className="flex items-center gap-2">
                                 {shortcut.custom && (
                                   <button 
                                     onClick={() => setRebindingKey(shortcut.id as 'record' | 'voice')}
                                     className="text-brand-primary/60 hover:text-brand-primary"
                                   >
                                     {t('customizeShortcut')}
                                   </button>
                                 )}
                                 <span className={cn(
                                   "px-1.5 py-0.5 border rounded font-mono",
                                   rebindingKey === shortcut.id 
                                     ? "bg-brand-primary/20 border-brand-primary text-brand-primary animate-pulse" 
                                     : "bg-white/5 border-white/10 text-white/60"
                                 )}>
                                   {rebindingKey === shortcut.id ? t('pressAnyKey') : (shortcut.id === 'undo' || shortcut.id === 'redo' ? (shortcut.id === 'undo' ? 'Ctrl+Z' : 'Ctrl+Y') : (shortcut.id === 'record' ? recordKey.toUpperCase() : (shortcut.id === 'voice' ? voiceKey.toUpperCase() : shortcut.key)))}
                                 </span>
                               </div>
                            </div>
                          ))}
                       </div>
                    </div>
                 )}

                 {activeTool === 'Text' && (
                    <div className="space-y-6">
                       <button 
                         onClick={addTextOverlay}
                         className="w-full py-3 bg-brand-primary text-black rounded-lg font-bold text-xs uppercase tracking-widest hover:bg-brand-primary/90 flex items-center justify-center gap-2"
                       >
                         <Plus className="w-4 h-4" />
                         New Text Layer
                       </button>

                       {activeText ? (
                         <div className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-300">
                           <div className="space-y-2">
                             <label className="text-[10px] font-bold uppercase tracking-widest text-white/40">Edit Text</label>
                             <textarea 
                                value={activeText.text}
                                onChange={(e) => updateTextOverlay(activeText.id, { text: e.target.value })}
                                className="w-full bg-black/40 border border-white/10 rounded-lg p-3 text-sm focus:border-brand-primary outline-none min-h-[100px] resize-none"
                             />
                           </div>

                           <div className="grid grid-cols-2 gap-4">
                              <div className="space-y-2">
                                <label className="text-[10px] font-bold uppercase tracking-widest text-white/40">Size</label>
                                <div className="flex items-center gap-2">
                                  <button onClick={() => updateTextOverlay(activeText.id, { fontSize: Math.max(8, activeText.fontSize - 2) })} className="p-1 hover:bg-white/10 rounded"><Minus className="w-3 h-3" /></button>
                                  <span className="text-xs font-mono w-8 text-center">{activeText.fontSize}</span>
                                  <button onClick={() => updateTextOverlay(activeText.id, { fontSize: Math.min(200, activeText.fontSize + 2) })} className="p-1 hover:bg-white/10 rounded"><Plus className="w-3 h-3" /></button>
                                </div>
                              </div>
                              <div className="space-y-2">
                                <label className="text-[10px] font-bold uppercase tracking-widest text-white/40">Font</label>
                                <select 
                                  value={activeText.fontFamily}
                                  onChange={(e) => updateTextOverlay(activeText.id, { fontFamily: e.target.value as any })}
                                  className="w-full bg-black/40 border border-white/10 rounded px-2 py-1 text-xs"
                                >
                                  <option value="sans">Sans</option>
                                  <option value="mono">Mono</option>
                                  <option value="serif">Serif</option>
                                </select>
                              </div>
                           </div>

                           <div className="space-y-2">
                             <label className="text-[10px] font-bold uppercase tracking-widest text-white/40">Color</label>
                             <div className="flex flex-wrap gap-2">
                                {['#FFFFFF', '#00FF00', '#FF0000', '#0000FF', '#FFFF00', '#FF00FF', '#00FFFF'].map(c => (
                                  <button 
                                    key={c}
                                    onClick={() => updateTextOverlay(activeText.id, { color: c })}
                                    className={cn(
                                      "w-6 h-6 rounded-full border-2",
                                      activeText.color === c ? "border-brand-primary" : "border-transparent"
                                    )}
                                    style={{ backgroundColor: c }}
                                  />
                                ))}
                             </div>
                           </div>

                           <button 
                            onClick={() => removeTextOverlay(activeText.id)}
                            className="w-full py-2 bg-brand-error/10 border border-brand-error/30 text-brand-error rounded text-[10px] font-bold uppercase tracking-widest hover:bg-brand-error/20 flex items-center justify-center gap-2"
                           >
                             <Trash2 className="w-3 h-3" />
                             Delete Layer
                           </button>
                         </div>
                       ) : (
                         <div className="flex flex-col items-center gap-4 py-12 text-white/10 border border-dashed border-white/5 rounded-xl">
                            <Type className="w-8 h-8" />
                            <p className="text-[10px] uppercase font-bold tracking-widest">Select a layer to edit</p>
                         </div>
                       )}
                    </div>
                 )}

                 {activeTool === 'Layout' && (
                    <div className="space-y-6">
                       <label className="text-[10px] font-bold uppercase tracking-widest text-white/40">{t('layout')}</label>
                       {activeClip ? (
                         <div className="grid grid-cols-1 gap-3">
                           {[
                             { id: 'full', label: t('fullScreen'), icon: <Maximize2 className="w-4 h-4" /> },
                             { id: 'left', label: t('leftHalf'), icon: <Columns2 className="w-4 h-4 rotate-0" /> },
                             { id: 'right', label: t('rightHalf'), icon: <Columns2 className="w-4 h-4 rotate-180" /> },
                           ].map((option) => (
                             <button
                               key={option.id}
                               onClick={() => updateClipLayout(activeClip.id, option.id as any)}
                               className={cn(
                                 "w-full py-4 px-4 rounded-xl border flex items-center gap-4 transition-all",
                                 (activeClip.layout || 'full') === option.id 
                                   ? "bg-brand-primary/10 border-brand-primary text-brand-primary shadow-[0_0_20px_rgba(var(--brand-primary-rgb),0.1)]" 
                                   : "bg-black/40 border-white/5 text-white/40 hover:border-white/20"
                               )}
                             >
                                <div className={cn(
                                  "w-10 h-10 rounded-lg flex items-center justify-center transition-colors",
                                  (activeClip.layout || 'full') === option.id ? "bg-brand-primary text-black" : "bg-white/5"
                                )}>
                                  {option.icon}
                                </div>
                                <div className="text-left">
                                  <p className="text-xs font-bold uppercase tracking-widest">{option.label}</p>
                                  <p className="text-[10px] opacity-60">
                                    {option.id === 'full' ? 'Standard 100% width' : `Occupies ${option.id} side`}
                                  </p>
                                </div>
                             </button>
                           ))}

                           <div className="mt-8 p-4 bg-brand-primary/5 rounded-xl border border-brand-primary/10">
                              <p className="text-[10px] text-brand-primary/60 italic leading-relaxed">
                                Tip: Use "Left Half" on one clip and "Right Half" on another at the same timeline position to create a split-screen effect.
                              </p>
                           </div>
                         </div>
                       ) : (
                         <div className="flex flex-col items-center gap-4 py-12 text-white/10 border border-dashed border-white/5 rounded-xl">
                            <Columns2 className="w-8 h-8" />
                            <p className="text-[10px] uppercase font-bold tracking-widest">Select a clip to adjust layout</p>
                         </div>
                       )}
                    </div>
                  )}

                  {activeTool === 'Transitions' && (
                    <div className="space-y-4">
                       <label className="text-[10px] font-bold uppercase tracking-widest text-white/40">{t('activeTransition')}</label>
                       <div className="grid grid-cols-1 gap-2">
                          {(['cut', 'fade', 'zoom', 'slide', 'wipe', 'circleOpen', 'dissolve'] as TransitionType[]).map((tType) => (
                             <button 
                                key={tType}
                                onClick={() => {
                                  saveToHistory();
                                  setGlobalTransition(tType);
                                }}
                                className={cn(
                                  "w-full py-3 px-4 rounded-lg border text-left flex items-center justify-between transition-all",
                                  globalTransition === tType ? "bg-brand-primary/10 border-brand-primary text-brand-primary" : "bg-black/40 border-white/5 text-white/40 hover:border-white/20"
                                )}
                             >
                                <span className="text-xs font-bold uppercase tracking-widest">
                                  {tType.replace(/([A-Z])/g, ' $1')}
                                </span>
                                {globalTransition === tType && <Zap className="w-3 h-3" />}
                             </button>
                          ))}
                       </div>
                       
                       <div className="pt-4">
                          <PropertySlider 
                            label={`${t('duration')} (sec)`} 
                            value={Math.round(transitionDuration * 100)} 
                            onChange={(val) => {
                              if (transitionDuration !== val / 100) saveToHistory();
                              setTransitionDuration(val / 100);
                            }}
                          />
                       </div>
                    </div>
                 )}

                 {activeTool === 'Library' && (
                    <div className="space-y-6">
                      <div className="flex items-center justify-between">
                         <label className="text-[10px] font-bold uppercase tracking-widest text-white/40">{t('library')}</label>
                         {selectedLibraryItemId && (
                            <button 
                              onClick={() => {
                                saveToHistory();
                                setLibraryItems(prev => prev.map(item => item.id === selectedLibraryItemId ? { ...item, filters } : item));
                              }}
                              className="text-[8px] font-bold uppercase tracking-widest text-brand-primary hover:text-brand-primary/80 flex items-center gap-1"
                            >
                               <RotateCcw className="w-2 h-2" />
                               {t('saveChanges')}
                            </button>
                         )}
                         {!selectedLibraryItemId && libraryItems.length > 0 && (
                            <button 
                              onClick={() => {
                                if (confirm('Clear entire library?')) {
                                   saveToHistory();
                                   setLibraryItems([]);
                                }
                              }}
                              className="text-[8px] font-bold uppercase tracking-widest text-white/20 hover:text-brand-error flex items-center gap-1 transition-colors"
                            >
                               <Trash2 className="w-2 h-2" />
                               {t('clearLibrary')}
                            </button>
                         )}
                      </div>
                      <div className="flex bg-black/40 p-1 rounded-xl border border-white/5">
                         <button 
                           onClick={() => setLibraryTab('clips')}
                           className={cn(
                             "flex-1 py-2 rounded-lg text-[10px] font-bold uppercase tracking-widest transition-all",
                             libraryTab === 'clips' ? "bg-brand-primary text-black" : "text-white/40 hover:text-white/60"
                           )}
                         >{t('library')}</button>
                         <button 
                           onClick={() => setLibraryTab('sounds')}
                           className={cn(
                             "flex-1 py-2 rounded-lg text-[10px] font-bold uppercase tracking-widest transition-all",
                             libraryTab === 'sounds' ? "bg-brand-primary text-black" : "text-white/40 hover:text-white/60"
                           )}
                         >{t('audio')}</button>
                      </div>

                      <div className="relative">
                         <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-white/30" />
                         <input 
                           type="text"
                           placeholder={t('search')}
                           value={searchQuery}
                           onChange={(e) => setSearchQuery(e.target.value)}
                           className="w-full bg-black/40 border border-white/5 rounded-lg py-2 pl-9 pr-4 text-[10px] text-white placeholder:text-white/20 focus:border-brand-primary/50 outline-none transition-all"
                         />
                         {searchQuery && (
                           <button 
                             onClick={() => setSearchQuery('')}
                             className="absolute right-3 top-1/2 -translate-y-1/2 text-white/20 hover:text-white"
                           >
                             <Plus className="w-3 h-3 rotate-45" />
                           </button>
                         )}
                      </div>

                      <div className="space-y-4">
                         <div className="flex gap-2">
                            {activeClip && libraryTab === 'clips' && (
                               <button 
                                 onClick={() => addToLibrary('video', activeClip)}
                                 className="flex-1 py-3 bg-white/5 border border-white/10 rounded-lg text-[10px] font-bold uppercase tracking-widest hover:bg-white/10 flex items-center justify-center gap-2"
                               >
                                 <PlusCircle className="w-3 h-3" />
                                 {t('saveActive')}
                               </button>
                            )}
                            <label className="flex-1 py-3 bg-brand-primary/10 border border-brand-primary/30 text-brand-primary rounded-lg text-[10px] font-bold uppercase tracking-widest hover:bg-brand-primary/20 cursor-pointer flex items-center justify-center gap-2">
                               <Upload className="w-3 h-3" />
                               {t('upload')}
                               <input 
                                 type="file" 
                                 className="hidden" 
                                 accept={libraryTab === 'clips' ? "video/*" : "audio/*"}
                                 onChange={(e) => handleLibraryUpload(e, libraryTab === 'clips' ? 'video' : 'audio')} 
                               />
                            </label>
                         </div>

                         <div className="grid grid-cols-1 gap-3">
                            {libraryItems.filter(item => {
                              const matchesTab = libraryTab === 'clips' ? item.type === 'video' : item.type === 'audio';
                              const matchesSearch = item.name?.toLowerCase().includes(searchQuery.toLowerCase());
                              return matchesTab && matchesSearch;
                            }).length === 0 ? (
                               <div className="py-20 flex flex-col items-center gap-4 text-white/10 border border-dashed border-white/5 rounded-xl">
                                  <FolderOpen className="w-10 h-10 opacity-20" />
                                  <p className="text-[10px] uppercase font-bold tracking-widest">
                                    {searchQuery ? t('noResults') || 'No results found' : t('libraryEmpty')}
                                  </p>
                               </div>
                            ) : (
                               libraryItems.filter(item => {
                                  const matchesTab = libraryTab === 'clips' ? item.type === 'video' : item.type === 'audio';
                                  const matchesSearch = item.name?.toLowerCase().includes(searchQuery.toLowerCase());
                                  return matchesTab && matchesSearch;
                               }).map(item => (
                                 <div 
                                   key={item.id} 
                                   onClick={() => selectLibraryItem(item.id)}
                                   className={cn(
                                     "group relative bg-black/40 border rounded-xl overflow-hidden transition-all p-3 flex gap-4 cursor-pointer",
                                     selectedLibraryItemId === item.id ? "border-brand-primary bg-brand-primary/5" : "border-white/5 hover:border-white/20"
                                   )}
                                 >
                                    <div className="w-16 h-12 bg-white/5 rounded-lg flex items-center justify-center overflow-hidden flex-shrink-0">
                                       {item.thumbnail ? (
                                          <img src={item.thumbnail} className="w-full h-full object-cover" />
                                       ) : (
                                          item.type === 'video' ? <FileVideo className="w-5 h-5 text-white/20" /> : <FileAudio className="w-5 h-5 text-white/20" />
                                       )}
                                    </div>
                                    <div className="flex-1 min-w-0">
                                       <p className="text-[10px] font-bold text-white truncate">{item.name}</p>
                                       <p className="text-[8px] text-white/40 mt-1 uppercase tracking-tighter">
                                          {formatTime(item.duration)} • {new Date(item.createdAt).toLocaleDateString()}
                                       </p>
                                    </div>
                                    <div className="absolute inset-0 bg-brand-primary items-center justify-center gap-2 hidden group-hover:flex">
                                       <button 
                                         onClick={() => addFromLibrary(item)}
                                         className="p-2 bg-black rounded-lg text-brand-primary text-[10px] font-bold uppercase tracking-widest hover:scale-105 transition-transform"
                                       >
                                          {t('addToTimeline')}
                                       </button>
                                       <button 
                                         onClick={() => setLibraryItems(prev => prev.filter(i => i.id !== item.id))}
                                         className="p-2 bg-black/20 rounded-lg text-white hover:text-white/60"
                                       >
                                          <Trash2 className="w-3 h-3" />
                                       </button>
                                    </div>
                                 </div>
                               ))
                            )}
                         </div>
                      </div>
                    </div>
                 )}

                 {activeTool === 'Audio' && (
                    <div className="space-y-8">
                      <div className="p-4 bg-brand-primary/5 rounded-xl border border-brand-primary/20 space-y-4">
                        <div className="flex items-center justify-between">
                           <div className="flex items-center gap-2">
                             <div className={cn("w-2 h-2 rounded-full", isRecordingVoice ? "bg-brand-error animate-pulse" : "bg-white/20")} />
                             <label className="text-[10px] font-bold uppercase tracking-widest text-white/60">{t('voiceOver')}</label>
                           </div>
                           <span className="font-mono text-[10px] text-brand-primary">{formatTime(voiceRecordingTime)}</span>
                        </div>
                        
                        <button 
                          onClick={isRecordingVoice ? stopVoiceRecording : startVoiceRecording}
                          className={cn(
                            "w-full py-3 rounded-lg flex items-center justify-center gap-2 font-bold uppercase tracking-widest text-[10px] transition-all",
                            isRecordingVoice 
                              ? "bg-brand-error text-white recording-glow" 
                              : "bg-brand-primary text-black hover:bg-brand-primary/90"
                          )}
                        >
                          {isRecordingVoice ? (
                            <>
                              <Square className="w-3 h-3 fill-current" />
                              {t('stop')}
                            </>
                          ) : (
                            <>
                              <Mic className="w-3 h-3" />
                              {t('record')}
                            </>
                          )}
                        </button>
                      </div>

                      <PropertySlider 
                        label="Master Volume" 
                        value={filters.volume} 
                        onChange={(val) => {
                          if (filters.volume !== val) saveToHistory();
                          setFilters({...filters, volume: val});
                        }}
                      />
                      
                      <div className="h-px bg-border-subtle !my-4" />
                      
                      <div className="space-y-6">
                        <label className="text-[10px] font-bold uppercase tracking-widest text-white/40">Track Volumes</label>
                        {audioTracks.map((track) => (
                          <div key={track.id} className="space-y-3">
                            <PropertySlider 
                              label={track.name} 
                              value={track.volume} 
                              onChange={(val) => {
                                if (track.volume !== val) saveToHistory();
                                updateTrackVolume(track.id, val);
                              }}
                            />
                          </div>
                        ))}
                      </div>
                    </div>
                 )}

                 {activeTool === 'Speed' && (
                    <div className="space-y-4">
                        <label className="text-[10px] font-bold uppercase tracking-widest text-white/40">Playback Speed</label>
                        <div className="grid grid-cols-3 gap-2">
                            {[0.5, 1, 2].map(speed => (
                                <button 
                                    key={speed}
                                    className="py-2 bg-black/40 border border-white/10 rounded text-xs font-mono"
                                >
                                    {speed}x
                                </button>
                            ))}
                        </div>
                    </div>
                 )}
                 
                 <div className="h-px bg-border-subtle !my-8" />
                 
                 <div className="space-y-4">
                    <p className="text-[10px] font-bold uppercase text-white/20">Export Presets</p>
                    <div className="grid grid-cols-2 gap-2">
                       <PresetBtn label="TikTok / Reel" />
                       <PresetBtn label="YouTube" />
                       <PresetBtn label="Discord" />
                       <PresetBtn label="Highest" active />
                    </div>
                 </div>
              </div>
           </div>
        </aside>
      </main>
    </div>
  );
}

// Subcomponents
function ToolIcon({ icon, label, active = false, onClick }: { icon: React.ReactNode, label: string, active?: boolean, onClick?: () => void }) {
  return (
    <button 
      onClick={onClick}
      className={cn(
        "group relative flex flex-col items-center gap-1 p-3 rounded-xl transition-all",
        active ? "bg-white text-black" : "text-white/40 hover:bg-white/5 hover:text-white"
      )}
    >
      {React.cloneElement(icon as React.ReactElement, { className: "w-5 h-5 transition-transform group-hover:scale-110" })}
      <span className="text-[8px] font-bold uppercase tracking-widest absolute -right-12 bg-black px-2 py-1 rounded opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity z-50">{label}</span>
    </button>
  );
}

function HUDLabel({ label, value, dot = false }: { label: string, value: string, dot?: boolean }) {
  return (
    <div className="flex items-center gap-2 bg-black/40 px-2 py-1 rounded border border-white/5 whitespace-nowrap">
      {dot && <div className="w-1.5 h-1.5 bg-brand-error rounded-full animate-pulse" />}
      <span className="text-[8px] font-mono text-white/40">{label}</span>
      <span className="text-[9px] font-mono font-bold tracking-tight">{value}</span>
    </div>
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
  type?: 'video' | 'audio';
}

const TimelineTrack: React.FC<TimelineTrackProps & { totalDuration: number }> = ({ label, clips = [], selectedId, onSelect, onDelete, onAdd, onRemoveTrack, type = 'video', totalDuration }) => {
  return (
    <div className="flex items-center group h-16 min-w-full relative">
      <div className="w-24 flex-shrink-0 flex items-center justify-between px-2 border-r border-border-subtle bg-black/20 h-full z-10">
        <span className="text-[9px] font-bold uppercase text-white/30 vertical-text">{label}</span>
        <div className="flex flex-col gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
          {onAdd && (
            <button onClick={onAdd} className="p-1 hover:bg-white/10 rounded">
              <Plus className="w-3 h-3 text-white/40" />
            </button>
          )}
          {onRemoveTrack && (
            <button onClick={onRemoveTrack} className="p-1 hover:bg-white/10 rounded">
              <Trash2 className="w-3 h-3 text-brand-error/40" />
            </button>
          )}
        </div>
      </div>
      <div className="flex-1 h-full items-center relative overflow-x-hidden min-w-0 bg-white/[0.02]">
        {clips.map((clip) => {
          const duration = type === 'video' ? clip.duration : (clip.duration / 1000);
          const width = (duration / totalDuration) * 100;
          const left = (clip.startTime / totalDuration) * 100;

          return (
            <motion.div
              layoutId={clip.id}
              key={clip.id}
              onClick={(e) => { e.stopPropagation(); onSelect?.(clip.id); }}
              style={{ 
                left: `${left}%`, 
                width: `${width}%`,
                position: 'absolute'
              }}
              className={cn(
                "h-[80%] top-[10%] rounded border cursor-pointer group/clip overflow-hidden transition-all",
                selectedId === clip.id 
                  ? (type === 'video' ? "bg-brand-primary/20 border-brand-primary z-20" : "bg-blue-500/20 border-blue-500 z-20") 
                  : "bg-white/5 border-white/10 hover:border-white/30 z-10",
              )}
            >
               <div className="absolute top-1 right-1 opacity-0 group-hover/clip:opacity-100 transition-opacity">
                  <button 
                    onClick={(e) => { e.stopPropagation(); onDelete?.(clip.id); }}
                    className="p-1 bg-black/60 rounded hover:text-brand-error"
                  >
                    <Trash2 className="w-3 h-3" />
                  </button>
               </div>
               {clip.keyframes && Object.values(clip.keyframes).some(arr => (arr as any[]).length > 0) && (
                  <div className="absolute top-1 left-2 pointer-events-none">
                    <Diamond className="w-2 h-2 text-brand-primary fill-brand-primary" />
                  </div>
               )}
               <div className="absolute inset-x-2 bottom-1 flex justify-between items-end">
                  <span className="text-[8px] font-mono text-white/40 truncate mr-2">{clip.name ? clip.name : `CLIP_${clip.id.slice(0, 4)}`}</span>
                  <span className={cn("text-[8px] font-mono whitespace-nowrap", type === 'video' ? "text-brand-primary" : "text-blue-400")}>
                    {formatTime(duration)}
                  </span>
               </div>
               {type === 'audio' && (
                  <div className="absolute inset-0 flex items-center justify-center opacity-10">
                    <Music className="w-8 h-8" />
                  </div>
               )}
            </motion.div>
          );
        })}
        {clips.length === 0 && (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none opacity-5">
            <span className="text-[10px] font-mono uppercase tracking-[0.5em]">{type === 'video' ? 'Empty Video Track' : 'Empty Audio Track'}</span>
          </div>
        )}
      </div>
    </div>
  );
};

function PropertySlider({ 
  label, 
  value, 
  onChange, 
  onKeyframeToggle, 
  isKeyframed 
}: { 
  label: string, 
  value: number, 
  onChange: (val: number) => void,
  onKeyframeToggle?: () => void,
  isKeyframed?: boolean
}) {
  return (
    <div className="space-y-3">
      <div className="flex justify-between items-center">
        <div className="flex items-center gap-2">
          {onKeyframeToggle && (
            <button 
              onClick={(e) => { e.stopPropagation(); onKeyframeToggle(); }}
              className={cn(
                "p-1 rounded transition-colors",
                isKeyframed ? "text-brand-primary bg-brand-primary/10" : "text-white/20 hover:text-white/40"
              )}
              title="Toggle Keyframe"
            >
              <Diamond className="w-3 h-3" />
            </button>
          )}
          <label className="text-[10px] font-bold uppercase tracking-widest text-white/60">{label}</label>
        </div>
        <span className="text-[10px] font-mono text-brand-primary">{Math.round(value)}%</span>
      </div>
      <div className="h-1 bg-white/5 rounded-full relative overflow-hidden group">
        <div className="absolute top-0 left-0 bottom-0 bg-white/20 group-hover:bg-brand-primary transition-colors" style={{ width: `${Math.min(100, Math.max(0, value))}%` }} />
        <input 
          type="range" 
          min="0"
          max="200"
          value={value}
          onChange={(e) => onChange(parseInt(e.target.value))}
          className="absolute inset-0 opacity-0 cursor-pointer" 
        />
      </div>
    </div>
  );
}

function PresetBtn({ label, active = false }: { label: string, active?: boolean }) {
  return (
    <button className={cn(
      "px-3 py-2 text-[8px] font-bold uppercase tracking-widest rounded border transition-all",
      active ? "bg-brand-primary text-black border-brand-primary" : "border-white/10 text-white/40 hover:border-white/30 hover:text-white"
    )}>
      {label}
    </button>
  );
}
