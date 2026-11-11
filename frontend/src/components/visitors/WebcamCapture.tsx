import { useEffect, useRef, useState } from 'react';

type Props = {
  value: string | null;
  onCapture: (dataUrl: string) => void;
  onClear: () => void;
};

type CameraOption = {
  deviceId: string;
  label: string;
  preferred: boolean;
};

const STORAGE_KEY = 'aspire.visitor.cameraDeviceId';

/** Labels that usually mean the laptop’s built-in / IR cam — deprioritize these. */
const BUILTIN_LABEL_RE =
  /integrated|built[-\s]?in|internal|facetime|ird\b|infrared|privacy|laptop|surface|thinkpad|hp truevision|dell|lenovo|webcam hd camera|default/i;

function isLikelyBuiltin(label: string): boolean {
  const t = (label || '').trim();
  if (!t || /^camera\s*\d*$/i.test(t) || t.toLowerCase() === 'video input device') {
    // Generic unlabeled devices: treat as unknown (not preferred, but not blocked)
    return false;
  }
  return BUILTIN_LABEL_RE.test(t);
}

function isLikelyExternal(label: string): boolean {
  const t = (label || '').toLowerCase();
  if (!t) return false;
  if (isLikelyBuiltin(t)) return false;
  return /usb|logitech|c9\d{2}|c92|c920|c922|c930|hd pro|external|elgato|razer|microsoft life|webcam/i.test(
    t,
  );
}

function pickPreferredDeviceId(cams: CameraOption[], savedId: string | null): string {
  if (savedId && cams.some((c) => c.deviceId === savedId)) return savedId;
  const external = cams.find((c) => c.preferred);
  if (external) return external.deviceId;
  // Prefer any non-builtin label over the first device (often the laptop cam)
  const nonBuiltin = cams.find((c) => !isLikelyBuiltin(c.label));
  if (nonBuiltin) return nonBuiltin.deviceId;
  return cams[0]?.deviceId || '';
}

async function listCameras(): Promise<CameraOption[]> {
  // Need a permission prompt once so labels are not empty "Camera 1"
  const permissionStream = await navigator.mediaDevices.getUserMedia({
    video: true,
    audio: false,
  });
  permissionStream.getTracks().forEach((t) => t.stop());

  const devices = await navigator.mediaDevices.enumerateDevices();
  return devices
    .filter((d) => d.kind === 'videoinput' && d.deviceId)
    .map((d, i) => {
      const label = d.label?.trim() || `Camera ${i + 1}`;
      return {
        deviceId: d.deviceId,
        label,
        preferred: isLikelyExternal(label),
      };
    });
}

export default function WebcamCapture({ value, onCapture, onClear }: Props) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [starting, setStarting] = useState(false);
  const [live, setLive] = useState(false);
  const [cameras, setCameras] = useState<CameraOption[]>([]);
  const [deviceId, setDeviceId] = useState<string>(() => {
    try {
      return localStorage.getItem(STORAGE_KEY) || '';
    } catch {
      return '';
    }
  });

  function stopCamera() {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    if (videoRef.current) videoRef.current.srcObject = null;
    setLive(false);
  }

  useEffect(() => {
    return () => stopCamera();
  }, []);

  async function refreshCameras(): Promise<CameraOption[]> {
    const cams = await listCameras();
    setCameras(cams);
    const nextId = pickPreferredDeviceId(cams, deviceId || localStorage.getItem(STORAGE_KEY));
    if (nextId && nextId !== deviceId) {
      setDeviceId(nextId);
      try {
        localStorage.setItem(STORAGE_KEY, nextId);
      } catch {
        /* ignore */
      }
    }
    return cams;
  }

  async function startCamera(overrideDeviceId?: string) {
    setError(null);
    setStarting(true);
    try {
      stopCamera();

      let cams = cameras;
      if (!cams.length) {
        cams = await refreshCameras();
      }

      const chosen =
        overrideDeviceId ||
        deviceId ||
        pickPreferredDeviceId(cams, localStorage.getItem(STORAGE_KEY));

      if (!chosen) {
        throw new Error('No camera found');
      }

      // Exact deviceId forces the selected USB cam — avoid facingMode:'user'
      // which browsers usually map to the laptop front camera.
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          deviceId: { exact: chosen },
          width: { ideal: 1280 },
          height: { ideal: 720 },
        },
        audio: false,
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }
      setDeviceId(chosen);
      try {
        localStorage.setItem(STORAGE_KEY, chosen);
      } catch {
        /* ignore */
      }
      setLive(true);
    } catch (err) {
      const msg =
        err instanceof Error && /Overconstrained|could not start/i.test(err.message)
          ? 'Could not open the selected camera. Pick another camera below and try again.'
          : 'Could not access webcam. Allow camera permission in Chrome/Edge, select the USB camera, and try again.';
      setError(msg);
      setLive(false);
    } finally {
      setStarting(false);
    }
  }

  async function onSelectCamera(nextId: string) {
    setDeviceId(nextId);
    try {
      localStorage.setItem(STORAGE_KEY, nextId);
    } catch {
      /* ignore */
    }
    if (live || !value) {
      await startCamera(nextId);
    }
  }

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

      <div className="space-y-1">
        <label className="block text-xs font-semibold uppercase tracking-wide text-slate-500">
          Camera
        </label>
        <div className="flex flex-wrap gap-2">
          <select
            value={deviceId}
            onChange={(e) => void onSelectCamera(e.target.value)}
            className="min-w-[14rem] flex-1 rounded-lg border border-slate-200 px-3 py-2 text-sm"
            disabled={starting}
          >
            {!cameras.length && !deviceId && <option value="">Detect cameras…</option>}
            {cameras.map((c) => (
              <option key={c.deviceId} value={c.deviceId}>
                {c.preferred ? `★ ${c.label}` : c.label}
                {isLikelyBuiltin(c.label) ? ' (laptop)' : ''}
              </option>
            ))}
          </select>
          <button
            type="button"
            onClick={() => void refreshCameras().catch(() => setError('Could not list cameras'))}
            className="rounded-lg border border-slate-200 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
          >
            Refresh list
          </button>
        </div>
        <p className="text-xs text-slate-500">
          Prefer the USB / Logitech camera (★). Choice is remembered on this PC.
        </p>
      </div>

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
