export type TransitionType = 'cut' | 'fade' | 'zoom' | 'slide' | 'wipe' | 'circleOpen' | 'dissolve';

export interface TextOverlay {
  id: string;
  text: string;
  x: number;
  y: number;
  fontSize: number;
  color: string;
  fontFamily: 'sans' | 'mono' | 'serif';
  type?: 'text' | 'sticker';
  assetUrl?: string;
}

export interface AudioClip {
  id: string;
  name: string;
  url: string;
  blob: Blob;
  duration: number;
  startTime: number;
  volume: number;
}

export interface TimelineAudioTrack {
  id: string;
  name: string;
  clips: AudioClip[];
  volume: number;
}

export interface Keyframe {
  time: number; // millisecond timestamp relative to clip start
  value: number;
}

export interface AnimationKeyframes {
  brightness?: Keyframe[];
  contrast?: Keyframe[];
  saturation?: Keyframe[];
  hue?: Keyframe[];
  sepia?: Keyframe[];
  grayscale?: Keyframe[];
  zoom?: Keyframe[];
  offsetX?: Keyframe[];
  offsetY?: Keyframe[];
  smooth?: Keyframe[];
  blur?: Keyframe[];
  opacity?: Keyframe[];
}

export interface LibraryItem {
  id: string;
  type: 'video' | 'audio';
  url: string;
  name: string;
  duration: number;
  thumbnail?: string;
  filters?: FilterSettings;
  keyframes?: AnimationKeyframes;
  createdAt: number;
}

export interface VideoClip {
  id: string;
  name?: string;
  url: string;
  blob: Blob;
  duration: number;
  startTime: number; // Offset in timeline
  thumbnail?: string;
  filters?: FilterSettings;
  keyframes?: AnimationKeyframes;
  layout?: 'full' | 'left' | 'right';
  transition?: TransitionType;
  textOverlays?: TextOverlay[];
}

export interface FilterSettings {
  brightness: number;
  contrast: number;
  saturation: number;
  hue: number;      // 0 to 360
  sepia: number;    // 0 to 100
  grayscale: number; // 0 to 100
  lut?: string;     // Preset ID
  playbackRate: number;
  fadeIn: number;  // In seconds
  fadeOut: number; // In seconds
  zoom: number;    // 1 to 4 (e.g. 100% to 400%)
  offsetX: number; // -50 to 50
  offsetY: number; // -50 to 50
  smooth: number;  // 0 to 100
  blur: number;    // 0 to 100
  opacity: number; // 0 to 100
}

export type AspectRatio = '16:9' | '9:16' | '1:1';

export interface TimelineState {
  clips: VideoClip[];
  currentTime: number;
  zoomLevel: number;
}
