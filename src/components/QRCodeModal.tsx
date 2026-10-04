import React, { useEffect, useState } from 'react';
import { X, QrCode, Download, ExternalLink, Copy, Check } from 'lucide-react';

interface QRCodeModalProps {
  queueId: string;
  queueName: string;
  onClose: () => void;
}

export const QRCodeModal: React.FC<QRCodeModalProps> = ({ queueId, queueName, onClose }) => {
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);
  const [targetUrl, setTargetUrl] = useState<string>('');
  const [copied, setCopied] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchQR = async () => {
      try {
        const res = await fetch(`/api/queues/${queueId}/qr`);
        if (res.ok) {
          const data = await res.json();
          setQrDataUrl(data.qrDataUrl);
          setTargetUrl(data.targetUrl);
        }
      } catch {
        // ignore
      } finally {
        setLoading(false);
      }
    };
    fetchQR();
  }, [queueId]);

  const copyUrl = () => {
    navigator.clipboard.writeText(targetUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 max-w-sm w-full p-6 relative">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors"
          aria-label="Close"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="flex items-center gap-2 mb-3">
          <div className="p-2 bg-teal-50 text-teal-700 rounded-lg">
            <QrCode className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-base font-bold text-slate-900 leading-tight">Digital Queue Pass</h3>
            <p className="text-xs text-slate-500">{queueName}</p>
          </div>
        </div>

        <p className="text-xs text-slate-600 mb-4 leading-relaxed">
          Display or print this QR code at physical service desks. Visitors scan it to securely join this queue from their phones.
        </p>

        <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 flex flex-col items-center justify-center mb-4 min-h-[220px]">
          {loading ? (
            <div className="flex flex-col items-center gap-2 text-xs text-slate-500">
              <div className="w-6 h-6 border-2 border-slate-300 border-t-teal-600 rounded-full animate-spin" />
              <span>Generating crisp QR matrix...</span>
            </div>
          ) : qrDataUrl ? (
            <img
              src={qrDataUrl}
              alt={`QR Code for ${queueName}`}
              className="w-48 h-48 rounded-lg shadow-sm bg-white p-2"
            />
          ) : (
            <div className="text-xs text-red-500">Failed to render QR Code</div>
          )}
        </div>

        <div className="space-y-2">
          <div className="flex items-center gap-1.5 p-2 bg-slate-100 rounded-lg text-xs font-mono text-slate-700 truncate">
            <span className="truncate flex-1">{targetUrl}</span>
            <button
              onClick={copyUrl}
              className="p-1 hover:text-teal-600 focus:outline-none"
              title="Copy link"
            >
              {copied ? <Check className="w-3.5 h-3.5 text-teal-600" /> : <Copy className="w-3.5 h-3.5" />}
            </button>
          </div>

          {qrDataUrl && (
            <a
              href={qrDataUrl}
              download={`QueueLess_${queueId}.png`}
              className="w-full flex items-center justify-center gap-2 py-2 text-xs font-semibold text-slate-900 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors"
            >
              <Download className="w-3.5 h-3.5" />
              Download Printable PNG
            </a>
          )}
        </div>
      </div>
    </div>
  );
};
