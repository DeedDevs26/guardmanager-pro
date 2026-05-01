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
    } catch (error) {
      // BUG-08 fix: surface save errors instead of silently swallowing them
      setMessage(error instanceof Error ? error.message : 'Failed to save settings.');
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
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-bold text-slate-800">Storage & Recovery</h3>
            <button
              onClick={async () => {
                const api = (window as any).pywebview?.api;
                if (api) {
                  const path = await api.pick_file();
                  if (path && window.confirm("Restore from external database file? Current data will be replaced.")) {
                    setBusy(true);
                    try {
                      await postJson('/api/backup/import', { path });
                      alert("Data imported! Application will reload.");
                      window.location.reload();
                    } catch (e) { alert("Import failed: " + (e instanceof Error ? e.message : String(e))); }
                    finally { setBusy(false); }
                  }
                } else { alert("File picker only available in desktop app."); }
              }}
              className="text-xs font-bold text-primary hover:underline flex items-center gap-1"
            >
              <span className="material-icons text-[14px]">upload_file</span>
              Import .db
            </button>
          </div>
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
            <button onClick={connectDrive} disabled={busy} className="bg-primary text-white px-4 py-2 rounded-lg font-bold hover:bg-blue-700 disabled:opacity-50 text-sm">Connect</button>
            <button onClick={disconnectDrive} disabled={busy} className="bg-white border border-slate-300 px-4 py-2 rounded-lg font-bold text-slate-700 disabled:opacity-50 text-sm">Disconnect</button>
          </div>
        </section>

        <section className="bg-white rounded-xl border border-slate-200 shadow-sm p-6 space-y-4">
          <h3 className="text-lg font-bold text-slate-800">Backup Options</h3>
          <div className="space-y-2">
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
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-slate-500 mb-1">Frequency</label>
              <select className="w-full border border-slate-200 rounded-lg p-2.5 bg-slate-50 text-sm" value={form.backupFrequency} onChange={e => setForm({ ...form, backupFrequency: e.target.value })}>
                <option value="daily">Daily</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-500 mb-1">Backup Time</label>
              <input type="time" className="w-full border border-slate-200 rounded-lg p-2.5 bg-slate-50 text-sm" value={form.backupTime} onChange={e => setForm({ ...form, backupTime: e.target.value })} />
            </div>
          </div>

          <div className="space-y-4">
            <div className="space-y-1 relative group">
              <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Documents Location</label>
              <div className="flex gap-2">
                <input
                  type="text"
                  readOnly
                  value={settings.storage.documentsPath}
                  className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-lg text-slate-600 font-medium"
                />
                <button
                  onClick={() => (window as any).pywebview?.api?.open_folder(settings.storage.documentsPath)}
                  className="px-3 py-2 bg-white border border-slate-200 text-slate-600 rounded-lg hover:bg-slate-50 transition-colors flex items-center gap-2 font-medium text-sm"
                  title="Open folder in Explorer"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
                  </svg>
                  <span>Open</span>
                </button>
              </div>
            </div>

            <div className="space-y-1 relative group">
              <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Backups Location</label>
              <div className="flex gap-2">
                <input
                  type="text"
                  readOnly
                  value={settings.storage.backupsPath}
                  className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-lg text-slate-600 font-medium"
                />
                <button
                  onClick={() => (window as any).pywebview?.api?.open_folder(settings.storage.backupsPath)}
                  className="px-3 py-2 bg-white border border-slate-200 text-slate-600 rounded-lg hover:bg-slate-50 transition-colors flex items-center gap-2 font-medium text-sm"
                  title="Open folder in Explorer"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
                  </svg>
                  <span>Open</span>
                </button>
              </div>
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-500 mb-1">PDF Export Path</label>
            <div className="flex gap-2">
              <input
                className="flex-1 border border-slate-200 rounded-lg p-2.5 bg-slate-50 text-sm"
                value={form.pdfExportPath}
                onChange={e => setForm({ ...form, pdfExportPath: e.target.value })}
              />
              <button
                type="button"
                onClick={async () => {
                  const api = (window as any).pywebview?.api;
                  if (api) {
                    const path = await api.pick_folder();
                    if (path) setForm({ ...form, pdfExportPath: path });
                  }
                }}
                className="bg-slate-100 border border-slate-300 px-3 py-2 rounded-lg text-xs font-bold text-slate-700"
              >
                Browse
              </button>
            </div>
          </div>

          <button onClick={save} disabled={busy} className="bg-primary text-white px-4 py-2 rounded-lg font-bold hover:bg-blue-700 text-sm disabled:opacity-50">
            Save Settings
          </button>
        </section>

        <section className="bg-white rounded-xl border border-slate-200 shadow-sm p-6 overflow-hidden flex flex-col min-h-[400px]">
          <h3 className="text-lg font-bold text-slate-800 mb-4">Backup History & Restore</h3>
          <div className="space-y-3 overflow-auto flex-1 pr-2 custom-scrollbar">
            {settings.history.length === 0 && <div className="text-sm text-slate-400">No backups yet.</div>}
            {settings.history.map(run => (
              <div key={run.id} className="rounded-lg border border-slate-200 p-3 hover:border-primary transition group relative">
                <div className="flex items-center justify-between mb-1">
                  <div className="flex items-center gap-2">
                    <span className={`text-[10px] uppercase font-bold px-1.5 py-0.5 rounded ${run.status === 'success' ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700'}`}>
                      {run.status}
                    </span>
                    <span className={`text-[10px] uppercase font-bold px-1.5 py-0.5 rounded ${run.isAutomatic ? 'bg-purple-100 text-purple-700' : 'bg-blue-100 text-blue-700'}`}>
                      {run.isAutomatic ? 'Automatic' : 'Manual'}
                    </span>
                    <span className="text-xs font-bold text-slate-700">{new Date(run.startedAt).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' })}</span>
                  </div>
                  {run.status === 'success' && (
                    <button
                      disabled={busy}
                      onClick={async () => {
                        const d = new Date(run.startedAt);
                        const pad = (n: number) => String(n).padStart(2, '0');
                        const stamp = `${d.getFullYear()}${pad(d.getMonth()+1)}${pad(d.getDate())}-${pad(d.getHours())}${pad(d.getMinutes())}${pad(d.getSeconds())}`;
                        if (window.confirm(`Restore data from ${new Date(run.startedAt).toLocaleString()}?\n\nThis will replace all current data.`)) {
                          setBusy(true);
                          try {
                            await postJson(`/api/backup/restore/${stamp}`);
                            alert("Restore successful! Restarting...");
                            window.location.reload();
                          } catch (e) { alert("Restore failed"); }
                          finally { setBusy(false); }
                        }
                      }}
                      className="opacity-0 group-hover:opacity-100 bg-emerald-600 text-white text-[10px] font-bold px-2 py-1 rounded hover:bg-emerald-700 transition"
                    >
                      RESTORE
                    </button>
                  )}
                </div>
                <div className="text-xs text-slate-500">
                  {run.filesUploaded} files • {(run.bytesUploaded / 1024).toFixed(1)} KB • {run.destination}
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
