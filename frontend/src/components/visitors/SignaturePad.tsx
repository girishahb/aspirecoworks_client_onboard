import { useEffect, useRef, useState } from 'react';

type Props = {
  value: string | null;
  onChange: (dataUrl: string | null) => void;
};

/**
 * XP-PEN graphic pen tablet active area (common StarG430 / similar):
 * 101.6 mm × 76.2 mm → exactly 4:3. Canvas keeps this aspect so pen
 * travel matches the physical pad when the driver maps to the window.
 */
export const XP_PEN_AREA_MM = { width: 101.6, height: 76.2 } as const;
const PAD_ASPECT = XP_PEN_AREA_MM.width / XP_PEN_AREA_MM.height; // 4/3

/** ~2× physical size at 96 CSS px/inch for comfortable on-screen drawing. */
const MM_TO_CSS_PX = 96 / 25.4;
const TARGET_CSS_WIDTH = Math.round(XP_PEN_AREA_MM.width * MM_TO_CSS_PX * 2); // ~768

export default function SignaturePad({ value, onChange }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  const drawing = useRef(false);
  const inkRef = useRef(false);
  const [hasInk, setHasInk] = useState(false);
  const [boxCss, setBoxCss] = useState({ w: TARGET_CSS_WIDTH, h: Math.round(TARGET_CSS_WIDTH / PAD_ASPECT) });

  useEffect(() => {
    const canvas = canvasRef.current;
    const wrap = wrapRef.current;
    if (!canvas || !wrap) return;

    const resize = () => {
      const parentW = wrap.clientWidth || TARGET_CSS_WIDTH;
      const w = Math.min(TARGET_CSS_WIDTH, parentW);
      const h = Math.round(w / PAD_ASPECT);
      setBoxCss({ w, h });

      const ratio = window.devicePixelRatio || 1;
      canvas.width = Math.floor(w * ratio);
      canvas.height = Math.floor(h * ratio);
      canvas.style.width = `${w}px`;
      canvas.style.height = `${h}px`;

      const ctx = canvas.getContext('2d');
      if (!ctx) return;
      ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
      ctx.lineWidth = 2.2;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.strokeStyle = '#0f172a';
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, w, h);
      inkRef.current = false;
      setHasInk(false);
      onChange(null);
    };

    resize();
    const ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(resize) : null;
    ro?.observe(wrap);
    window.addEventListener('resize', resize);
    return () => {
      ro?.disconnect();
      window.removeEventListener('resize', resize);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- mount resize only
  }, []);

  function pointFromEvent(e: React.PointerEvent<HTMLCanvasElement>) {
    const canvas = canvasRef.current!;
    const rect = canvas.getBoundingClientRect();
    // Normalize to CSS pixel space used by the 2d context transform
    const scaleX = boxCss.w / rect.width;
    const scaleY = boxCss.h / rect.height;
    return {
      x: (e.clientX - rect.left) * scaleX,
      y: (e.clientY - rect.top) * scaleY,
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
    // Optional pressure from XP-Pen / Windows Ink
    if (typeof e.pressure === 'number' && e.pressure > 0) {
      ctx.lineWidth = 1.2 + e.pressure * 2.4;
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
    const canvas = canvasRef.current;
    if (!canvas || !inkRef.current) return;
    onChange(canvas.toDataURL('image/png'));
  }

  function clear() {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx) return;
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, boxCss.w, boxCss.h);
    inkRef.current = false;
    setHasInk(false);
    onChange(null);
  }

  function commit() {
    const canvas = canvasRef.current;
    if (!canvas || !inkRef.current) return;
    onChange(canvas.toDataURL('image/png'));
  }

  return (
    <div className="space-y-3">
      <p className="text-sm text-slate-600">
        Sign on the XP-PEN pad (active area {XP_PEN_AREA_MM.width}&nbsp;×&nbsp;{XP_PEN_AREA_MM.height}&nbsp;mm,
        4:3) or draw with mouse / trackpad.
      </p>
      <div
        ref={wrapRef}
        className="mx-auto max-w-full rounded-xl border-2 border-slate-300 bg-slate-100 p-2 touch-none"
        style={{ maxWidth: TARGET_CSS_WIDTH + 16 }}
      >
        <div
          className="relative mx-auto overflow-hidden rounded-lg border border-slate-200 bg-white touch-none"
          style={{
            width: boxCss.w,
            height: boxCss.h,
            aspectRatio: `${XP_PEN_AREA_MM.width} / ${XP_PEN_AREA_MM.height}`,
          }}
        >
          <canvas
            ref={canvasRef}
            className="block cursor-crosshair touch-none"
            style={{ width: boxCss.w, height: boxCss.h, touchAction: 'none' }}
            onPointerDown={onPointerDown}
            onPointerMove={onPointerMove}
            onPointerUp={endStroke}
            onPointerCancel={endStroke}
            onPointerLeave={(e) => {
              if (drawing.current) endStroke(e);
            }}
          />
          <span className="pointer-events-none absolute bottom-1 right-2 text-[10px] font-medium text-slate-400">
            {XP_PEN_AREA_MM.width} × {XP_PEN_AREA_MM.height} mm
          </span>
        </div>
      </div>
      <p className="text-xs text-slate-500">
        Tip: In XP-PEN driver, map the tablet to this browser window (or the signature box) so the
        full {XP_PEN_AREA_MM.width}&nbsp;×&nbsp;{XP_PEN_AREA_MM.height}&nbsp;mm area matches the pad above.
      </p>
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
          onClick={commit}
          disabled={!hasInk}
          className="rounded-lg px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
          style={{ background: '#134b7f' }}
        >
          Use signature
        </button>
      </div>
      {value && (
        <p className="text-xs text-emerald-700">Signature captured. Continue when ready.</p>
      )}
    </div>
  );
}
