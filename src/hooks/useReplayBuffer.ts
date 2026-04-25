import { useState, useRef, useCallback } from 'react';

interface BufferChunk {
  blob: Blob;
  timestamp: number;
}

export function useReplayBuffer(maxDurationMs: number = 60000) { // Default 60s buffer
  const [isRecording, setIsRecording] = useState(false);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const chunksRef = useRef<BufferChunk[]>([]);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);

  const startCapture = useCallback(async () => {
    try {
      const displayStream = await navigator.mediaDevices.getDisplayMedia({
        video: { frameRate: 60 },
        audio: true,
      });

      setStream(displayStream);
      setIsRecording(true);

      const recorder = new MediaRecorder(displayStream, {
        mimeType: 'video/webm; codecs=vp9',
      });

      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          const now = Date.now();
          chunksRef.current.push({ blob: event.data, timestamp: now });

          // Prune old chunks
          const cutoff = now - maxDurationMs;
          while (chunksRef.current.length > 0 && chunksRef.current[0].timestamp < cutoff) {
            chunksRef.current.shift();
          }
        }
      };

      // We request data every 1 second to keep the buffer resolution high
      recorder.start(1000);
      mediaRecorderRef.current = recorder;

      displayStream.getVideoTracks()[0].onended = () => {
        stopCapture();
      };

    } catch (err) {
      console.error("Error starting capture:", err);
    }
  }, [maxDurationMs]);

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
