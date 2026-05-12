'use client';
import { useState, useEffect } from 'react';
import Link from 'next/link';
import { getPractice, updatePractice, uploadPracticeLogo, regenerateApiKey } from '@/lib/practice';
import ConfirmModal from '@/components/ui/ConfirmModal';
import LoadingSpinner from '@/components/ui/LoadingSpinner';
import {
  ClipboardDocumentIcon, ArrowPathIcon, CheckIcon,
  PhotoIcon, BuildingOffice2Icon, SignalIcon,
} from '@heroicons/react/24/outline';

// ── API key display with copy ──────────────────────────────────────────────────

function ApiKeyField({ apiKey, onRegenerate }) {
  const [copied, setCopied]         = useState(false);
  const [confirmRegen, setConfirmRegen] = useState(false);

  const copy = async () => {
    await navigator.clipboard.writeText(apiKey);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="space-y-2">
      <label className="block text-sm font-medium text-gray-700">
        Website API Key
        <span className="ml-2 text-xs font-normal text-gray-400">(used in CrmApi.php)</span>
      </label>
      <div className="flex items-center gap-2">
        <code className="flex-1 px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm font-mono text-gray-700 truncate">
          {apiKey}
        </code>
        <button
          onClick={copy}
          title="Copy to clipboard"
          className="p-2 rounded-lg border border-gray-200 text-gray-500 hover:text-brand-600 hover:border-brand-300 transition-colors"
        >
          {copied ? <CheckIcon className="w-4 h-4 text-green-500" /> : <ClipboardDocumentIcon className="w-4 h-4" />}
        </button>
        <button
          onClick={() => setConfirmRegen(true)}
          title="Regenerate API key"
          className="p-2 rounded-lg border border-gray-200 text-gray-500 hover:text-red-600 hover:border-red-300 transition-colors"
        >
          <ArrowPathIcon className="w-4 h-4" />
        </button>
      </div>
      <p className="text-xs text-gray-400">
        After regenerating, update <code className="bg-gray-100 px-1 rounded">CRM_API_KEY</code> in
        your website's <code className="bg-gray-100 px-1 rounded">includes/CrmApi.php</code> immediately.
        The old key stops working right away.
      </p>

      <ConfirmModal
        open={confirmRegen}
        onClose={() => setConfirmRegen(false)}
        onConfirm={async () => { setConfirmRegen(false); await onRegenerate(); }}
        title="Regenerate API Key"
        message="Your current API key will stop working immediately. You must update CrmApi.php on your website before regenerating. Continue?"
        confirmLabel="Regenerate"
        danger
      />
    </div>
  );
}

// ── Logo uploader ─────────────────────────────────────────────────────────────

function LogoUploader({ currentLogo, onUploaded }) {
  const [uploading, setUploading] = useState(false);
  const [error, setError]         = useState('');

  const handleFile = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 2 * 1024 * 1024) {
      setError('Image must be under 2 MB');
      return;
    }
    setUploading(true);
    setError('');
    try {
      await uploadPracticeLogo(file);
      onUploaded();
    } catch (e) {
      setError(e.response?.data?.message || 'Upload failed');
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="space-y-2">
      <label className="block text-sm font-medium text-gray-700">Practice Logo</label>
      <div className="flex items-center gap-4">
        {currentLogo ? (
          <img src={currentLogo} alt="Practice logo" className="w-16 h-16 rounded-lg object-cover border border-gray-200" />
        ) : (
          <div className="w-16 h-16 rounded-lg bg-gray-100 flex items-center justify-center border border-gray-200">
            <PhotoIcon className="w-8 h-8 text-gray-300" />
          </div>
        )}
        <div>
          <label className="btn-secondary cursor-pointer text-sm flex items-center gap-2">
            {uploading ? (
              <><LoadingSpinner size="sm" /> Uploading…</>
            ) : (
              <><PhotoIcon className="w-4 h-4" /> Change Logo</>
            )}
            <input type="file" accept="image/*" onChange={handleFile} className="hidden" disabled={uploading} />
          </label>
          <p className="text-xs text-gray-400 mt-1">JPG, PNG, WebP — max 2 MB</p>
        </div>
      </div>
      {error && <p className="text-sm text-red-600">{error}</p>}
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function PracticePage() {
  const [practice, setPractice] = useState(null);
  const [loading, setLoading]   = useState(true);
  const [saving, setSaving]     = useState(false);
  const [error, setError]       = useState('');
  const [success, setSuccess]   = useState('');

  const [form, setForm] = useState({
    name: '', specialty: '', phone: '', address: '',
  });

  const load = async () => {
    setLoading(true);
    try {
      const data = await getPractice();
      setPractice(data);
      setForm({
        name:      data.name      || '',
        specialty: data.specialty || '',
        phone:     data.phone     || '',
        address:   data.address   || '',
      });
    } catch {
      setError('Failed to load practice profile');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const save = async (e) => {
    e.preventDefault();
    setSaving(true);
    setError('');
    setSuccess('');
    try {
      const updated = await updatePractice(form);
      setPractice(updated);
      setSuccess('Practice profile updated successfully');
      setTimeout(() => setSuccess(''), 3000);
    } catch (e) {
      setError(e.response?.data?.message || 'Failed to save changes');
    } finally {
      setSaving(false);
    }
  };

  const handleRegenKey = async () => {
    try {
      const updated = await regenerateApiKey();
      setPractice(updated);
      setSuccess('API key regenerated. Update your website immediately.');
    } catch (e) {
      setError(e.response?.data?.message || 'Failed to regenerate key');
    }
  };

  if (loading) {
    return <div className="flex justify-center py-20"><LoadingSpinner /></div>;
  }

  return (
    <div className="max-w-2xl space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
          <BuildingOffice2Icon className="w-7 h-7 text-brand-600" />
          My Practice
        </h1>
        <p className="text-sm text-gray-500 mt-1">
          Manage your clinic profile and website integration settings.
        </p>
      </div>

      {/* Alerts */}
      {error && (
        <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">{error}</div>
      )}
      {success && (
        <div className="p-3 bg-green-50 border border-green-200 rounded-lg text-sm text-green-700">{success}</div>
      )}

      {/* Practice details form */}
      <div className="bg-white rounded-xl border border-gray-200 p-6 space-y-5">
        <h2 className="text-base font-semibold text-gray-900">Clinic Information</h2>

        <form onSubmit={save} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Practice / Doctor Name</label>
              <input
                value={form.name}
                onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))}
                required
                className="input"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Specialty</label>
              <input
                value={form.specialty}
                onChange={(e) => setForm((p) => ({ ...p, specialty: e.target.value }))}
                className="input"
                placeholder="e.g. Urology, Cardiology"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Phone</label>
              <input
                value={form.phone}
                onChange={(e) => setForm((p) => ({ ...p, phone: e.target.value }))}
                className="input"
                placeholder="+91 98765 43210"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Website Domain</label>
              <input
                value={practice?.domain || ''}
                readOnly
                className="input bg-gray-50 text-gray-400 cursor-not-allowed"
                title="Contact MashHealth to change your domain"
              />
              <p className="mt-1 text-xs text-gray-400">Domain changes require MashHealth support.</p>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Address</label>
            <textarea
              value={form.address}
              onChange={(e) => setForm((p) => ({ ...p, address: e.target.value }))}
              rows={2}
              className="input resize-none"
              placeholder="Clinic address"
            />
          </div>

          <div className="flex justify-end pt-2">
            <button type="submit" disabled={saving} className="btn-primary">
              {saving ? 'Saving…' : 'Save Changes'}
            </button>
          </div>
        </form>
      </div>

      {/* Logo */}
      <div className="bg-white rounded-xl border border-gray-200 p-6">
        <h2 className="text-base font-semibold text-gray-900 mb-4">Practice Logo</h2>
        <LogoUploader
          currentLogo={practice?.logoUrl}
          onUploaded={load}
        />
      </div>

      {/* Plan */}
      <div className="bg-white rounded-xl border border-gray-200 p-6">
        <h2 className="text-base font-semibold text-gray-900 mb-1">Current Plan</h2>
        <div className="flex items-center gap-3">
          <span className={`px-3 py-1 rounded-full text-sm font-medium ${
            practice?.plan === 'ENTERPRISE' ? 'bg-purple-100 text-purple-700' :
            practice?.plan === 'PROFESSIONAL' ? 'bg-blue-100 text-blue-700' :
            'bg-gray-100 text-gray-600'
          }`}>
            {practice?.plan || 'BASIC'}
          </span>
          <span className="text-sm text-gray-500">
            Contact MashHealth to upgrade your plan.
          </span>
        </div>
      </div>

      {/* API Key */}
      <div className="bg-white rounded-xl border border-gray-200 p-6">
        <h2 className="text-base font-semibold text-gray-900 mb-4">Website Integration</h2>
        {practice?.apiKey && (
          <ApiKeyField apiKey={practice.apiKey} onRegenerate={handleRegenKey} />
        )}
      </div>

      {/* Lead Ingestion */}
      <div className="bg-white rounded-xl border border-gray-200 p-6 space-y-5">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-base font-semibold text-gray-900">Lead Ingestion Endpoints</h2>
            <p className="text-sm text-gray-500 mt-0.5">
              Use these URLs in Make.com, website forms, or any automation.
            </p>
          </div>
          <Link
            href="/dashboard/leads/ingestion-logs"
            className="flex items-center gap-1.5 text-sm text-brand-600 hover:text-brand-700 font-medium"
          >
            <SignalIcon className="w-4 h-4" />
            View Logs
          </Link>
        </div>

        <div className="space-y-3">
          <EndpointRow
            label="Website Form (PHP / HTML)"
            method="POST"
            path="/api/public/leads"
            auth="X-Api-Key: <your-api-key>"
            note="Use your API key above. doctorId is resolved server-side — never put it in the form."
          />
          <EndpointRow
            label="Meta / Facebook Lead Ads (Make.com)"
            method="POST"
            path="/api/public/meta-webhook"
            auth="X-Webhook-Secret: <shared-secret>"
            note="Set doctorId in the Make.com HTTP body. UTM defaults to facebook/paid_social."
          />
          <EndpointRow
            label="Google Lead Form (Make.com)"
            method="POST"
            path="/api/public/google-webhook"
            auth="X-Webhook-Secret: <shared-secret>"
            note="Set doctorId in the Make.com HTTP body. UTM defaults to google/cpc."
          />
          <EndpointRow
            label="Generic / Other Sources (Make.com)"
            method="POST"
            path="/api/public/generic-webhook"
            auth="X-Webhook-Secret: <shared-secret>"
            note="Pass source field to identify the channel (justdial, practo, whatsapp, etc.)"
          />
        </div>

        <div className="rounded-lg bg-blue-50 border border-blue-100 p-4 text-sm text-blue-800 space-y-1">
          <p className="font-medium">Required body fields for all endpoints:</p>
          <p className="font-mono text-xs bg-white/70 rounded px-2 py-1 border border-blue-100">
            {`{ "patientName": "...", "phone": "9876543210" }`}
          </p>
          <p className="text-blue-600 text-xs mt-1">
            Optional: email, city, campaignName, utmSource, utmMedium, utmCampaign,
            utmContent, utmTerm, adSet, adName, landingPage, externalId
          </p>
        </div>
      </div>
    </div>
  );
}

// ── Endpoint row ──────────────────────────────────────────────────────────────

function EndpointRow({ label, method, path, auth, note }) {
  const [copied, setCopied] = useState(false);
  const fullUrl = `https://api.yourdomain.com${path}`;

  const copy = async () => {
    await navigator.clipboard.writeText(fullUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="border border-gray-200 rounded-lg p-3 space-y-2">
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium text-gray-700">{label}</span>
        <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full font-mono">
          {method}
        </span>
      </div>
      <div className="flex items-center gap-2">
        <code className="flex-1 text-xs font-mono bg-gray-50 border border-gray-200 px-2 py-1.5 rounded text-gray-600 truncate">
          {path}
        </code>
        <button
          onClick={copy}
          title="Copy full URL"
          className="p-1.5 rounded border border-gray-200 text-gray-400 hover:text-gray-600 transition-colors flex-shrink-0"
        >
          {copied
            ? <CheckIcon className="w-3.5 h-3.5 text-green-500" />
            : <ClipboardDocumentIcon className="w-3.5 h-3.5" />}
        </button>
      </div>
      <p className="text-xs text-gray-500">
        <span className="font-medium">Auth:</span>{' '}
        <code className="bg-gray-100 px-1 rounded">{auth}</code>
      </p>
      {note && <p className="text-xs text-gray-400">{note}</p>}
    </div>
  );
}
