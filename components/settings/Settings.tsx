import React, { useEffect, useState } from 'react';
import { BackupSettings, SettingsResponse } from '../../types';
import { getJson, postJson, putJson } from '../../services/api';

export const Settings: React.FC = () => {
  const [settings, setSettings] = useState<SettingsResponse | null>(null);
  const [form, setForm] = useState<BackupSettings | null>(null);
  const [message, setMessage] = useState<string>('');
  const [busy, setBusy] = useState(false);

  const load = async () => {
    const next = await getJson<SettingsResponse>('/api/settings');
    setSettings(next);
    setForm(next.backup);
  };

  useEffect(() => {
    void load();
  }, []);

  const save = async () => {
    if (!form) return;
    setBusy(true);
    try {
      await putJson('/api/settings/backup', form);
      setMessage('Backup settings saved');
      await load();
    } finally {
      setBusy(false);
    }
  };

  const connectDrive = async () => {
    setBusy(true);
    try {
      await putJson('/api/settings/backup', form);
      await postJson('/api/drive/connect');
      setMessage('Google Drive connected successfully!');
      setTimeout(() => setMessage(''), 5000);
      await load();
    } catch (error) {
      console.error(error);
      setMessage(error instanceof Error ? error.message : 'Failed to connect Google Drive. Please check your credentials file.');
    } finally {
      setBusy(false);
    }
  };

  const disconnectDrive = async () => {
    setBusy(true);
    try {
      await postJson('/api/drive/disconnect');
      setMessage('Google Drive disconnected');
      setTimeout(() => setMessage(''), 5000);
      await load();
    } catch (error) {
      setMessage('Failed to disconnect');
    } finally {
      setBusy(false);
    }
  };

  const runBackup = async () => {
    if (!form) return;
    setBusy(true);
    try {
      // Save settings first to ensure driveEnabled is updated
      await putJson('/api/settings/backup', form);
      
      await postJson('/api/backup/run');
      setMessage('Backup completed successfully!');
      setTimeout(() => setMessage(''), 5000);
      await load();
    } catch (error) {
      console.error(error);
      setMessage(error instanceof Error ? error.message : 'Backup failed. Check logs in history for details.');
    } finally {
      setBusy(false);
    }
  };

  if (!settings || !form) {
    return <div className="p-8 text-slate-500">Loading settings...</div>;
  }

  return (
    <div className="p-8 h-full overflow-auto">
      <div className="flex items-start justify-between mb-6 gap-4">
        <div>
          <h2 className="text-2xl font-bold text-slate-800">Settings</h2>
          <p className="text-sm text-slate-500">Configure storage, Google Drive backup, and scheduled backups.</p>
        </div>
        <button
          onClick={runBackup}
          disabled={busy}
          className="bg-primary text-white px-4 py-2 rounded-lg font-bold hover:bg-blue-700 disabled:opacity-50"
        >
          Backup Now
        </button>
      </div>

      {message && <div className="mb-4 rounded-lg border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-700">{message}</div>}

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        <section className="bg-white rounded-xl border border-slate-200 shadow-sm p-6 space-y-4">
          <h3 className="text-lg font-bold text-slate-800">Storage</h3>
          <InfoRow label="App Data" value={settings.storage.appDataPath} />
          <InfoRow label="Database" value={settings.storage.databasePath} />
          <InfoRow label="Documents" value={settings.storage.documentsPath} />
          <InfoRow label="Backups" value={settings.storage.backupsPath} />
        </section>

        <section className="bg-white rounded-xl border border-slate-200 shadow-sm p-6 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-bold text-slate-800">Google Drive</h3>
            <span className={`text-xs font-bold px-2 py-1 rounded-full ${settings.drive.connected ? 'bg-green-100 text-green-700' : 'bg-slate-100 text-slate-600'}`}>
              {settings.drive.connected ? 'Connected' : 'Disconnected'}
            </span>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-500 mb-1">Drive Folder Name</label>
            <input
              className="w-full border border-slate-200 rounded-lg p-2.5 bg-slate-50"
              value={form.googleDriveFolderName}
              onChange={e => setForm({ ...form, googleDriveFolderName: e.target.value })}
            />
          </div>

          <div className="flex gap-3">
            <button onClick={connectDrive} disabled={busy} className="bg-primary text-white px-4 py-2 rounded-lg font-bold hover:bg-blue-700 disabled:opacity-50">Connect</button>
            <button onClick={disconnectDrive} disabled={busy} className="bg-white border border-slate-300 px-4 py-2 rounded-lg font-bold text-slate-700 disabled:opacity-50">Disconnect</button>
          </div>
        </section>

        <section className="bg-white rounded-xl border border-slate-200 shadow-sm p-6 space-y-4">
          <h3 className="text-lg font-bold text-slate-800">Backup Options</h3>
          <label className="flex items-center gap-3">
            <input type="checkbox" checked={form.driveEnabled} onChange={e => setForm({ ...form, driveEnabled: e.target.checked })} />
            <span className="text-sm text-slate-700">Back up to Google Drive</span>
          </label>
          <label className="flex items-center gap-3">
            <input type="checkbox" checked={form.autoBackupEnabled} onChange={e => setForm({ ...form, autoBackupEnabled: e.target.checked })} />
            <span className="text-sm text-slate-700">Enable automatic backup</span>
          </label>
          <label className="flex items-center gap-3">
            <input type="checkbox" checked={form.includeDatabase} onChange={e => setForm({ ...form, includeDatabase: e.target.checked })} />
            <span className="text-sm text-slate-700">Include database snapshot</span>
          </label>
          <label className="flex items-center gap-3">
            <input type="checkbox" checked={form.includeDocuments} onChange={e => setForm({ ...form, includeDocuments: e.target.checked })} />
            <span className="text-sm text-slate-700">Include documents</span>
          </label>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-slate-500 mb-1">Frequency</label>
              <select className="w-full border border-slate-200 rounded-lg p-2.5 bg-slate-50" value={form.backupFrequency} onChange={e => setForm({ ...form, backupFrequency: e.target.value })}>
                <option value="daily">Daily</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-500 mb-1">Backup Time</label>
              <input type="time" className="w-full border border-slate-200 rounded-lg p-2.5 bg-slate-50" value={form.backupTime} onChange={e => setForm({ ...form, backupTime: e.target.value })} />
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-500 mb-1">PDF Export Path (fixed folder)</label>
            <div className="flex gap-2">
              <input
                className="flex-1 border border-slate-200 rounded-lg p-2.5 bg-slate-50"
                value={form.pdfExportPath}
                placeholder="e.g. C:\Users\Name\Documents\Exports"
                onChange={e => setForm({ ...form, pdfExportPath: e.target.value })}
              />
              <button
                type="button"
                onClick={async () => {
                  if ((window as any).pywebview?.api) {
                    const path = await (window as any).pywebview.api.pick_folder();
                    if (path) setForm({ ...form, pdfExportPath: path });
                  } else {
                    alert('Folder picker is only available in the desktop application.');
                  }
                }}
                className="bg-slate-100 border border-slate-300 px-3 py-2 rounded-lg text-xs font-bold text-slate-700 hover:bg-slate-200 transition whitespace-nowrap"
              >
                Browse...
              </button>
            </div>
          </div>

          <button onClick={save} disabled={busy} className="bg-primary text-white px-4 py-2 rounded-lg font-bold hover:bg-blue-700 disabled:opacity-50">
            Save Settings
          </button>
        </section>

        <section className="bg-white rounded-xl border border-slate-200 shadow-sm p-6">
          <h3 className="text-lg font-bold text-slate-800 mb-4">Backup History</h3>
          <div className="space-y-3">
            {settings.history.length === 0 && <div className="text-sm text-slate-400">No backups yet.</div>}
            {settings.history.map(run => (
              <div key={run.id} className="rounded-lg border border-slate-200 p-3">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-sm font-bold text-slate-700">{run.status.toUpperCase()}</span>
                  <span className="text-xs text-slate-400">{new Date(run.startedAt).toLocaleString()}</span>
                </div>
                <div className="text-xs text-slate-500">
                  {run.filesUploaded} files, {(run.bytesUploaded / 1024).toFixed(1)} KB, destination: {run.destination}
                </div>
                {run.errorMessage && <div className="text-xs text-red-500 mt-1">{run.errorMessage}</div>}
              </div>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
};

const InfoRow: React.FC<{ label: string; value: string }> = ({ label, value }) => (
  <div>
    <div className="text-xs font-bold uppercase tracking-wider text-slate-400">{label}</div>
    <div className="mt-1 rounded-lg bg-slate-50 border border-slate-200 px-3 py-2 text-sm text-slate-700 break-all">{value}</div>
  </div>
);
