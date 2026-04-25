import { useState, useRef, useCallback } from 'react';

interface BufferChunk {
  blob: Blob;
  timestamp: number;
}

export function useReplayBuffer(maxDurationMs: number = 60000) { // maxDurationMs passed from component state
  const [isRecording, setIsRecording] = useState(false);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const chunksRef = useRef<BufferChunk[]>([]);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const maxDurationRef = useRef(maxDurationMs);

  // Keep ref in sync for the callback
  maxDurationRef.current = maxDurationMs;

  const startCapture = useCallback(async () => {
    try {
      const displayStream = await navigator.mediaDevices.getDisplayMedia({
        video: { frameRate: 60, width: { ideal: 1920 }, height: { ideal: 1080 } },
        audio: { 
          echoCancellation: false,
          noiseSuppression: false,
          autoGainControl: false
        },
      });

      setStream(displayStream);
      setIsRecording(true);
      chunksRef.current = []; // Clear previous buffer on new start

      const recorder = new MediaRecorder(displayStream, {
        mimeType: 'video/webm; codecs=vp9',
      });

      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          const now = Date.now();
          chunksRef.current.push({ blob: event.data, timestamp: now });

          // Prune old chunks using the latest duration setting
          const cutoff = now - maxDurationRef.current;
          while (chunksRef.current.length > 0 && chunksRef.current[0].timestamp < cutoff) {
            chunksRef.current.shift();
          }
        }
      };

      // Request data every 1 second
      recorder.start(1000);
      mediaRecorderRef.current = recorder;

      displayStream.getVideoTracks()[0].onended = () => {
        stopCapture();
      };

    } catch (err) {
      console.error("Error starting capture:", err);
    }
  }, []);

  const stopCapture = useCallback(() => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop();
    }
    if (stream) {
      stream.getTracks().forEach(track => track.stop());
    }
    setStream(null);
    setIsRecording(false);
    chunksRef.current = [];
  }, [stream]);

  const getBufferBlob = useCallback(() => {
    if (chunksRef.current.length === 0) return null;
    
    // Combine all chunks in the current buffer
    return new Blob(chunksRef.current.map(c => c.blob), { type: 'video/webm' });
  }, []);

  return {
    isRecording,
    stream,
    startCapture,
    stopCapture,
    getBufferBlob,
  };
}
