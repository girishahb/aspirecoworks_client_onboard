import { useEffect, useRef, useState } from 'react';

type Props = {
  value: string | null;
  onChange: (dataUrl: string | null) => void;
};

/**
 * XP-PEN active area is 101.6 × 76.2 mm (4:3). Drivers usually map that
 * whole surface to the *entire monitor*, so a small on-page canvas only
 * receives a tiny corner of the pad. Full-screen canvas = full pad travel.
 */
export const XP_PEN_AREA_MM = { width: 101.6, height: 76.2 } as const;

export default function SignaturePad({ value, onChange }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const drawing = useRef(false);
  const inkRef = useRef(false);
  const sizeRef = useRef({ w: 800, h: 600 });
  /** After Done, skip wiping parent signature when fullscreen exit refits the canvas. */
  const keepParentSignatureRef = useRef(false);
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;

  const [hasInk, setHasInk] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function paintBlank(w: number, h: number) {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ratio = window.devicePixelRatio || 1;
    canvas.width = Math.max(1, Math.floor(w * ratio));
    canvas.height = Math.max(1, Math.floor(h * ratio));
    canvas.style.width = `${w}px`;
    canvas.style.height = `${h}px`;
    sizeRef.current = { w, h };
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
    ctx.lineWidth = 2.4;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.strokeStyle = '#0f172a';
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, w, h);
    inkRef.current = false;
    setHasInk(false);
  }

  /** Resize drawing surface. Does not clear parent `value` after a successful Done. */
  function fitCanvasToStage() {
    const canvas = canvasRef.current;
    const host = canvas?.parentElement;
    if (!host) return;
    const w = Math.max(320, Math.floor(host.clientWidth));
    const h = Math.max(240, Math.floor(host.clientHeight));
    paintBlank(w, h);
    if (!keepParentSignatureRef.current) {
      onChangeRef.current(null);
    }
  }

  useEffect(() => {
    const onFsChange = () => {
      const active = document.fullscreenElement === stageRef.current;
      setIsFullscreen(active);
      requestAnimationFrame(() => {
        fitCanvasToStage();
        // Once we've exited after Done, parent already holds the PNG — stop protecting
        // after this one refit so Clear / Re-sign can wipe again.
        if (!active && keepParentSignatureRef.current) {
          // leave keepParentSignatureRef true while value is set; cleared on Re-sign/Clear
        }
      });
    };
    document.addEventListener('fullscreenchange', onFsChange);
    return () => document.removeEventListener('fullscreenchange', onFsChange);
  }, []);

  useEffect(() => {
    fitCanvasToStage();
    const stage = stageRef.current;
    if (!stage) return;
    const host = canvasRef.current?.parentElement ?? stage;
    const ro =
      typeof ResizeObserver !== 'undefined'
        ? new ResizeObserver(() => {
            // Don't wipe a captured signature when the on-page layout shifts
            if (keepParentSignatureRef.current) {
              const canvas = canvasRef.current;
              const h = canvas?.parentElement;
              if (!h) return;
              paintBlank(Math.max(320, Math.floor(h.clientWidth)), Math.max(240, Math.floor(h.clientHeight)));
              return;
            }
            fitCanvasToStage();
          })
        : null;
    ro?.observe(host);
    window.addEventListener('resize', fitCanvasToStage);
    return () => {
      ro?.disconnect();
      window.removeEventListener('resize', fitCanvasToStage);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function enterFullscreen() {
    setError(null);
    keepParentSignatureRef.current = false;
    onChangeRef.current(null);
    const stage = stageRef.current;
    if (!stage) return;
    try {
      if (stage.requestFullscreen) {
        await stage.requestFullscreen();
      } else {
        setError('Fullscreen is not available in this browser. Use Chrome/Edge.');
      }
    } catch {
      setError('Could not enter fullscreen. Allow it when the browser prompts, then try again.');
    }
  }

  async function exitFullscreen() {
    if (document.fullscreenElement) {
      try {
        await document.exitFullscreen();
      } catch {
        /* ignore */
      }
    }
  }

  function pointFromEvent(e: React.PointerEvent<HTMLCanvasElement>) {
    const canvas = canvasRef.current!;
    const rect = canvas.getBoundingClientRect();
    const { w, h } = sizeRef.current;
    return {
      x: ((e.clientX - rect.left) / rect.width) * w,
      y: ((e.clientY - rect.top) / rect.height) * h,
    };
  }

  function onPointerDown(e: React.PointerEvent<HTMLCanvasElement>) {
    e.preventDefault();
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx) return;
    canvas.setPointerCapture(e.pointerId);
    drawing.current = true;
    const p = pointFromEvent(e);
    ctx.beginPath();
    ctx.moveTo(p.x, p.y);
  }

  function onPointerMove(e: React.PointerEvent<HTMLCanvasElement>) {
    if (!drawing.current) return;
    e.preventDefault();
    const ctx = canvasRef.current?.getContext('2d');
    if (!ctx) return;
    if (typeof e.pressure === 'number' && e.pressure > 0) {
      ctx.lineWidth = 1.4 + e.pressure * 2.8;
    } else {
      ctx.lineWidth = 2.4;
    }
    const p = pointFromEvent(e);
    ctx.lineTo(p.x, p.y);
    ctx.stroke();
    inkRef.current = true;
    setHasInk(true);
  }

  function endStroke(e: React.PointerEvent<HTMLCanvasElement>) {
    if (!drawing.current) return;
    drawing.current = false;
    try {
      canvasRef.current?.releasePointerCapture(e.pointerId);
    } catch {
      /* ignore */
    }
  }

  function clear() {
    keepParentSignatureRef.current = false;
    const { w, h } = sizeRef.current;
    paintBlank(w, h);
    onChangeRef.current(null);
  }

  function snapshot(): string | null {
    const canvas = canvasRef.current;
    if (!canvas || !inkRef.current) return null;
    return canvas.toDataURL('image/png');
  }

  function commitAndExit() {
    const dataUrl = snapshot();
    if (!dataUrl) {
      setError('Please sign on the pad before tapping Done.');
      return;
    }
    // Preserve across fullscreen exit → fitCanvasToStage (which used to call onChange(null))
    keepParentSignatureRef.current = true;
    onChangeRef.current(dataUrl);
    void exitFullscreen();
  }

  function useSignatureFromPage() {
    const dataUrl = snapshot();
    if (!dataUrl) return;
    keepParentSignatureRef.current = true;
    onChangeRef.current(dataUrl);
  }

  return (
    <div className="space-y-3">
      <div className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-950">
        <p className="font-semibold">XP-PEN tip</p>
        <p className="mt-1">
          The tablet maps its full {XP_PEN_AREA_MM.width}&nbsp;×&nbsp;{XP_PEN_AREA_MM.height}&nbsp;mm
          area to the whole screen. Use <strong>Full-screen signature</strong>, sign, then tap{' '}
          <strong>Done</strong> — the signature preview appears here so you can continue.
        </p>
      </div>

      {error && (
        <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>
      )}

      {value && !isFullscreen ? (
        <div className="space-y-3">
          <p className="text-sm font-medium text-emerald-700">Signature captured. Continue when ready.</p>
          <img
            src={value}
            alt="Signature preview"
            className="max-h-48 w-full rounded-lg border border-slate-200 bg-white object-contain"
          />
          <button
            type="button"
            onClick={() => void enterFullscreen()}
            className="rounded-lg border border-slate-200 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
          >
            Re-sign full screen
          </button>
        </div>
      ) : (
        <>
          {!isFullscreen && (
            <button
              type="button"
              onClick={() => void enterFullscreen()}
              className="w-full rounded-lg px-4 py-3 text-sm font-semibold text-white sm:w-auto"
              style={{ background: '#134b7f' }}
            >
              Full-screen signature (recommended)
            </button>
          )}

          <div
            ref={stageRef}
            className={`relative overflow-hidden border border-slate-300 bg-slate-900 touch-none ${
              isFullscreen ? 'flex h-screen w-screen flex-col' : 'rounded-xl'
            }`}
            style={isFullscreen ? undefined : { height: 'min(70vh, 720px)' }}
          >
            {isFullscreen && (
              <div className="flex shrink-0 items-center justify-between gap-2 bg-slate-950/90 px-4 py-2 text-white">
                <p className="text-sm">Sign using the full XP-PEN pad · then tap Done</p>
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={clear}
                    className="rounded-md border border-white/30 px-3 py-1.5 text-xs font-medium hover:bg-white/10"
                  >
                    Clear
                  </button>
                  <button
                    type="button"
                    onClick={commitAndExit}
                    disabled={!hasInk}
                    className="rounded-md px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-40"
                    style={{ background: '#134b7f' }}
                  >
                    Done
                  </button>
                </div>
              </div>
            )}
            <div className="relative min-h-0 flex-1 h-full">
              <canvas
                ref={canvasRef}
                className="absolute inset-0 h-full w-full cursor-crosshair touch-none bg-white"
                style={{ touchAction: 'none' }}
                onPointerDown={onPointerDown}
                onPointerMove={onPointerMove}
                onPointerUp={endStroke}
                onPointerCancel={endStroke}
                onPointerLeave={(e) => {
                  if (drawing.current) endStroke(e);
                }}
              />
            </div>
          </div>

          {!isFullscreen && (
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={clear}
                className="rounded-lg border border-slate-200 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
              >
                Clear
              </button>
              <button
                type="button"
                onClick={useSignatureFromPage}
                disabled={!hasInk}
                className="rounded-lg px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
                style={{ background: '#134b7f' }}
              >
                Use signature
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
