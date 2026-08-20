import React, { useRef, useState, useEffect, useCallback } from 'react';
import {
  Upload,
  PenTool,
  RotateCcw,
  AlignLeft,
  AlignCenter,
  AlignRight,
  Trash2,
} from 'lucide-react';
import { DEFAULT_SIGNATURE } from '../utils/storage';
import { Modal, Button, Field, TextInput, SegmentedControl } from './ui';
import { resolveSignatureTokens } from './LetterDocument';

const TOKENS = [
  '{{signature_image}}',
  '{{clinician_name}}',
  '{{clinician_credentials}}',
  '{{license_title}}',
  '{{practice_name}}',
  '{{practice_phone}}',
  '{{practice_email}}',
  '{{practice_website}}',
];

const CLINICIAN_FIELDS = [
  ['name', 'Name'],
  ['credentials', 'Credentials'],
  ['title', 'License title & number'],
  ['practiceName', 'Practice name'],
  ['phone', 'Phone'],
  ['email', 'Email'],
];

const ALIGN_ICONS = {
  left: AlignLeft,
  center: AlignCenter,
  right: AlignRight,
};

/** Drawing pad with device-pixel-ratio correction. */
function SignaturePad({ onCommit }) {
  const canvasRef = useRef(null);
  const drawing = useRef(false);
  const last = useRef({ x: 0, y: 0 });
  const dirty = useRef(false);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const dpr = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();
    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;
    const ctx = canvas.getContext('2d');
    ctx.scale(dpr, dpr);
    ctx.strokeStyle = '#0f172a';
    ctx.lineWidth = 2.2;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
  }, []);

  const pos = (e) => {
    const rect = canvasRef.current.getBoundingClientRect();
    const src = e.touches?.[0] || e;
    return { x: src.clientX - rect.left, y: src.clientY - rect.top };
  };

  const start = (e) => {
    e.preventDefault();
    drawing.current = true;
    last.current = pos(e);
  };

  const move = (e) => {
    if (!drawing.current) return;
    e.preventDefault();
    const ctx = canvasRef.current.getContext('2d');
    const p = pos(e);
    ctx.beginPath();
    ctx.moveTo(last.current.x, last.current.y);
    ctx.lineTo(p.x, p.y);
    ctx.stroke();
    last.current = p;
    dirty.current = true;
  };

  const end = () => {
    if (!drawing.current) return;
    drawing.current = false;
    if (dirty.current) onCommit(canvasRef.current.toDataURL('image/png'));
  };

  const clear = () => {
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    dirty.current = false;
  };

  return (
    <div className="space-y-2">
      <canvas
        ref={canvasRef}
        className="w-full h-40 rounded-xl border cursor-crosshair touch-none bg-paper border-line-strong"
        onMouseDown={start}
        onMouseMove={move}
        onMouseUp={end}
        onMouseLeave={end}
        onTouchStart={start}
        onTouchMove={move}
        onTouchEnd={end}
      />
      <div className="flex items-center justify-between">
        <p className="text-[11px] text-ink-faint">
          Draw with a trackpad, mouse or stylus.
        </p>
        <Button variant="ghost" onClick={clear}>
          <Trash2 className="w-3.5 h-3.5" />
          Clear
        </Button>
      </div>
    </div>
  );
}

export function SignatureModal({
  isOpen,
  onClose,
  signature,
  onSaveSignature,
  clinician,
  onSaveClinician,
}) {
  const [tab, setTab] = useState('block');
  const [sig, setSig] = useState(signature);
  const [clin, setClin] = useState(clinician);
  const blockRef = useRef(null);

  useEffect(() => {
    if (!isOpen) return;
    setSig(signature);
    setClin(clinician);
  }, [signature, clinician, isOpen]);

  const setSigField = (patch) => setSig((prev) => ({ ...prev, ...patch }));

  /** Insert at the caret rather than always appending to the end. */
  const insertToken = useCallback((token) => {
    const el = blockRef.current;
    setSig((prev) => {
      const text = prev.customBlockText || '';
      if (!el) return { ...prev, customBlockText: `${text}\n${token}` };
      const start = el.selectionStart ?? text.length;
      const end = el.selectionEnd ?? text.length;
      const next = text.slice(0, start) + token + text.slice(end);
      requestAnimationFrame(() => {
        el.focus();
        el.setSelectionRange(start + token.length, start + token.length);
      });
      return { ...prev, customBlockText: next };
    });
  }, []);

  const previewLines = (sig.customBlockText || '').split('\n');

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Signature block"
      subtitle="What appears at the foot of every letter."
      icon={PenTool}
      width="max-w-3xl"
      footer={
        <>
          <Button
            variant="ghost"
            className="mr-auto"
            onClick={() =>
              setSigField({
                customBlockText: DEFAULT_SIGNATURE.customBlockText,
                width: DEFAULT_SIGNATURE.width,
                alignment: DEFAULT_SIGNATURE.alignment,
                showSignature: true,
                showCredentials: true,
              })
            }
          >
            <RotateCcw className="w-3.5 h-3.5" />
            Reset block
          </Button>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button
            variant="primary"
            onClick={() => {
              onSaveSignature(sig);
              onSaveClinician(clin);
              onClose();
            }}
          >
            Save signature
          </Button>
        </>
      }
    >
      <div className="px-6 pt-5">
        <SegmentedControl
          value={tab}
          onChange={setTab}
          options={[
            { value: 'block', label: 'Block' },
            { value: 'image', label: 'Signature image' },
            { value: 'credentials', label: 'Credentials' },
          ]}
        />
      </div>

      <div className="p-6 space-y-5">
        {tab === 'block' && (
          <div className="grid grid-cols-2 gap-5">
            <div className="space-y-3">
              <Field
                label="Sign-off text"
                hint="Tokens resolve from your credentials when the letter renders."
              >
                <TextInput
                  as="textarea"
                  ref={blockRef}
                  rows={10}
                  value={sig.customBlockText || ''}
                  onChange={(e) => setSigField({ customBlockText: e.target.value })}
                  className="font-mono !text-[12px] leading-relaxed"
                />
              </Field>

              <div className="flex flex-wrap gap-1.5">
                {TOKENS.map((t) => (
                  <button
                    key={t}
                    onClick={() => insertToken(t)}
                    className="px-2 py-1 rounded-md text-[10px] cursor-pointer font-mono transition-colors
                               bg-surface-sunken text-ink-muted hover:text-ink hover:bg-surface-hover"
                  >
                    {t.replace(/[{}]/g, '')}
                  </button>
                ))}
              </div>
            </div>

            {/* Live preview on paper */}
            <div className="space-y-2">
              <span className="text-[12px] font-semibold text-ink-secondary">
                Preview
              </span>
              <div
                className="rounded-xl border p-5 min-h-[220px] font-serif text-[12px] leading-snug
                           bg-paper border-line-strong text-paper-ink"
                style={{ textAlign: sig.alignment || 'left' }}
              >
                {previewLines.map((line, i) => {
                  if (line.includes('{{signature_image}}') || line.includes('[SIGNATURE_IMAGE]')) {
                    if (!sig.showSignature || !sig.url) return <div key={i} style={{ height: 8 }} />;
                    return (
                      <div
                        key={i}
                        style={{
                          display: 'flex',
                          margin: '4px 0',
                          justifyContent:
                            sig.alignment === 'center'
                              ? 'center'
                              : sig.alignment === 'right'
                              ? 'flex-end'
                              : 'flex-start',
                        }}
                      >
                        <img
                          src={sig.url}
                          alt=""
                          style={{
                            width: sig.width || 180,
                            maxHeight: 70,
                            objectFit: 'contain',
                          }}
                        />
                      </div>
                    );
                  }
                  return (
                    <div key={i} style={{ minHeight: '1.2em' }}>
                      {resolveSignatureTokens(line, clin)}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}

        {tab === 'image' && (
          <div className="grid grid-cols-2 gap-5">
            <div className="space-y-4">
              <Field label="Upload an image" hint="PNG with a transparent background works best.">
                <label className="block">
                  <span
                    className="flex items-center justify-center gap-2 h-24 rounded-xl border border-dashed
                               cursor-pointer text-[13px] font-medium border-line-strong text-ink-muted bg-surface-sunken"
                  >
                    <Upload className="w-4 h-4" />
                    Choose file
                  </span>
                  <input
                    type="file"
                    accept="image/png,image/jpeg,image/svg+xml"
                    className="hidden"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (!file) return;
                      const reader = new FileReader();
                      reader.onload = (ev) =>
                        ev.target?.result && setSigField({ url: ev.target.result });
                      reader.readAsDataURL(file);
                      e.target.value = '';
                    }}
                  />
                </label>
              </Field>

              <Field label="Or draw it">
                <SignaturePad onCommit={(url) => setSigField({ url })} />
              </Field>
            </div>

            <div className="space-y-4">
              <Field label={`Width — ${sig.width || 180}px`}>
                <input
                  type="range"
                  min="100"
                  max="320"
                  value={sig.width || 180}
                  onChange={(e) => setSigField({ width: parseInt(e.target.value, 10) })}
                  className="w-full cursor-pointer accent-accent"
                />
              </Field>

              <Field label="Alignment">
                <div className="flex gap-1">
                  {['left', 'center', 'right'].map((a) => {
                    const Icon = ALIGN_ICONS[a];
                    const isActive = (sig.alignment || 'left') === a;
                    return (
                      <button
                        key={a}
                        onClick={() => setSigField({ alignment: a })}
                        aria-label={a}
                        className={`grid place-items-center flex-1 h-9 rounded-lg border cursor-pointer transition-colors ${
                          isActive
                            ? 'bg-accent-soft border-accent text-accent-ink'
                            : 'bg-surface-raised border-line text-ink-muted hover:bg-surface-hover'
                        }`}
                      >
                        <Icon className="w-4 h-4" />
                      </button>
                    );
                  })}
                </div>
              </Field>

              <label className="flex items-center gap-2.5 cursor-pointer">
                <input
                  type="checkbox"
                  checked={sig.showSignature}
                  onChange={(e) => setSigField({ showSignature: e.target.checked })}
                  className="w-4 h-4 cursor-pointer accent-accent"
                />
                <span className="text-[13px] text-ink-secondary">
                  Show the signature image on letters
                </span>
              </label>

              {sig.url && (
                <div
                  className="rounded-xl border p-3 grid place-items-center bg-paper border-line-strong"
                >
                  <img
                    src={sig.url}
                    alt="Current signature"
                    style={{ width: sig.width || 180, maxHeight: 75, objectFit: 'contain' }}
                  />
                </div>
              )}
            </div>
          </div>
        )}

        {tab === 'credentials' && (
          <div className="grid grid-cols-2 gap-4">
            {CLINICIAN_FIELDS.map(([key, label]) => (
              <Field key={key} label={label}>
                <TextInput
                  value={clin[key] || ''}
                  onChange={(e) => setClin((prev) => ({ ...prev, [key]: e.target.value }))}
                />
              </Field>
            ))}
          </div>
        )}
      </div>
    </Modal>
  );
}
