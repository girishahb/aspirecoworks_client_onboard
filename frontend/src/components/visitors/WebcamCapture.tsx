import { useEffect, useRef, useState } from 'react';

type Props = {
  value: string | null;
  onCapture: (dataUrl: string) => void;
  onClear: () => void;
};

export default function WebcamCapture({ value, onCapture, onClear }: Props) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [starting, setStarting] = useState(false);
  const [live, setLive] = useState(false);

  async function startCamera() {
    setError(null);
    setStarting(true);
    try {
      stopCamera();
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'user', width: { ideal: 1280 }, height: { ideal: 720 } },
        audio: false,
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }
      setLive(true);
    } catch {
      setError('Could not access webcam. Allow camera permission in Chrome/Edge and try again.');
      setLive(false);
    } finally {
      setStarting(false);
    }
  }

  function stopCamera() {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    if (videoRef.current) videoRef.current.srcObject = null;
    setLive(false);
  }

  useEffect(() => {
    return () => stopCamera();
  }, []);

  function capture() {
    const video = videoRef.current;
    if (!video || !live) return;
    const canvas = document.createElement('canvas');
    canvas.width = video.videoWidth || 1280;
    canvas.height = video.videoHeight || 720;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    const dataUrl = canvas.toDataURL('image/jpeg', 0.88);
    onCapture(dataUrl);
    stopCamera();
  }

  return (
    <div className="space-y-3">
      {error && (
        <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </p>
      )}

      {value ? (
        <div className="space-y-3">
          <img
            src={value}
            alt="Captured visitor"
            className="max-h-72 w-full rounded-xl border border-slate-200 object-contain bg-slate-100"
          />
          <button
            type="button"
            onClick={() => {
              onClear();
              void startCamera();
            }}
            className="rounded-lg border border-slate-200 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
          >
            Retake photo
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          <div className="overflow-hidden rounded-xl border border-slate-200 bg-slate-900 aspect-video">
            <video ref={videoRef} playsInline muted className="h-full w-full object-cover" />
          </div>
          <div className="flex flex-wrap gap-2">
            {!live ? (
              <button
                type="button"
                disabled={starting}
                onClick={() => void startCamera()}
                className="rounded-lg px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
                style={{ background: '#134b7f' }}
              >
                {starting ? 'Starting camera…' : 'Start webcam'}
              </button>
            ) : (
              <>
                <button
                  type="button"
                  onClick={capture}
                  className="rounded-lg px-4 py-2 text-sm font-semibold text-white"
                  style={{ background: '#134b7f' }}
                >
                  Capture frame
                </button>
                <button
                  type="button"
                  onClick={stopCamera}
                  className="rounded-lg border border-slate-200 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
                >
                  Stop camera
                </button>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
