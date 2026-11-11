import { useRef, useState } from 'react';
import WebcamCapture from './WebcamCapture';

type Props = {
  consentText: string;
  consentVersion: string;
  consented: boolean;
  onConsentChange: (v: boolean) => void;
  last4: string;
  onLast4Change: (v: string) => void;
  cardPhoto: string | null;
  onCardPhoto: (dataUrl: string | null) => void;
};

export default function AadhaarOptional({
  consentText,
  consentVersion,
  consented,
  onConsentChange,
  last4,
  onLast4Change,
  cardPhoto,
  onCardPhoto,
}: Props) {
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<'none' | 'webcam' | 'file'>('none');
  const fileRef = useRef<HTMLInputElement>(null);

  function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') onCardPhoto(reader.result);
    };
    reader.readAsDataURL(file);
  }

  return (
    <div className="rounded-xl border border-slate-200 bg-white">
      <button
        type="button"
        className="flex w-full items-center justify-between px-4 py-3 text-left"
        onClick={() => setOpen((v) => !v)}
      >
        <div>
          <p className="text-sm font-semibold text-slate-900">Optional Aadhaar</p>
          <p className="text-xs text-slate-500">Consent + last 4 digits only (never full number)</p>
        </div>
        <span className="text-sm text-slate-500">{open ? 'Hide' : 'Show'}</span>
      </button>

      {open && (
        <div className="space-y-4 border-t border-slate-100 px-4 py-4">
          <label className="flex gap-3 text-sm text-slate-700">
            <input
              type="checkbox"
              className="mt-1"
              checked={consented}
              onChange={(e) => {
                const next = e.target.checked;
                onConsentChange(next);
                if (!next) {
                  onLast4Change('');
                  onCardPhoto(null);
                  setMode('none');
                }
              }}
            />
            <span>
              {consentText}
              <span className="mt-1 block text-xs text-slate-400">Consent version: {consentVersion}</span>
            </span>
          </label>

          {consented && (
            <div className="space-y-4">
              <div>
                <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Last 4 digits of Aadhaar
                </label>
                <input
                  type="text"
                  inputMode="numeric"
                  maxLength={4}
                  value={last4}
                  onChange={(e) => onLast4Change(e.target.value.replace(/\D/g, '').slice(0, 4))}
                  className="w-40 rounded-lg border border-slate-200 px-3 py-2 text-sm"
                  placeholder="••••"
                />
              </div>

              <div className="space-y-2">
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Card photo (optional)
                </p>
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => setMode('webcam')}
                    className="rounded-lg border border-slate-200 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
                  >
                    Use webcam
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setMode('file');
                      fileRef.current?.click();
                    }}
                    className="rounded-lg border border-slate-200 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
                  >
                    Upload image
                  </button>
                  {cardPhoto && (
                    <button
                      type="button"
                      onClick={() => {
                        onCardPhoto(null);
                        setMode('none');
                      }}
                      className="rounded-lg border border-slate-200 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
                    >
                      Remove card photo
                    </button>
                  )}
                </div>
                <input
                  ref={fileRef}
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  className="hidden"
                  onChange={onFile}
                />
                {mode === 'webcam' && !cardPhoto && (
                  <WebcamCapture
                    value={null}
                    onCapture={(url) => onCardPhoto(url)}
                    onClear={() => onCardPhoto(null)}
                  />
                )}
                {cardPhoto && (
                  <img
                    src={cardPhoto}
                    alt="Aadhaar card"
                    className="max-h-56 rounded-xl border border-slate-200 object-contain bg-slate-50"
                  />
                )}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
