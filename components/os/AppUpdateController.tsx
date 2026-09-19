import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useOS } from '../../context/OSContext';
import { APP_UPDATE_CHECK_EVENT, checkForAppUpdate, type AppRelease } from '../../utils/appUpdate';
import {
  downloadAndInstallAndroidApk,
  isNativeAndroid,
  listenAndroidApkProgress,
} from '../../utils/sullyNative';

interface UpdateState {
  currentVersion: string;
  release: AppRelease;
}

const AppUpdateController: React.FC = () => {
  const { addToast, registerBackHandler } = useOS();
  const [update, setUpdate] = useState<UpdateState | null>(null);
  const [downloading, setDownloading] = useState(false);
  const [progress, setProgress] = useState(0);
  const autoCheckedRef = useRef(false);

  const close = useCallback(() => {
    if (!downloading) setUpdate(null);
  }, [downloading]);

  const check = useCallback(async (manual: boolean) => {
    if (!isNativeAndroid()) {
      if (manual) addToast('检查更新仅在 Android App 内可用', 'info');
      return;
    }
    if (manual) addToast('正在检查更新…', 'info');
    try {
      const result = await checkForAppUpdate();
      if (result.updateAvailable) {
        setUpdate({ currentVersion: result.currentVersion, release: result.release });
      } else if (manual) {
        addToast(`当前已是最新版本（${result.currentVersion}）`, 'success');
      }
    } catch (error: any) {
      if (manual) addToast(error?.message || '检查更新失败，请稍后重试', 'error');
      else console.warn('[AppUpdate] background check failed', error);
    }
  }, [addToast]);

  useEffect(() => {
    const onManualCheck = () => void check(true);
    window.addEventListener(APP_UPDATE_CHECK_EVENT, onManualCheck);
    return () => window.removeEventListener(APP_UPDATE_CHECK_EVENT, onManualCheck);
  }, [check]);

  useEffect(() => {
    if (autoCheckedRef.current || !isNativeAndroid()) return;
    autoCheckedRef.current = true;
    const timer = window.setTimeout(() => void check(false), 2500);
    return () => window.clearTimeout(timer);
  }, [check]);

  useEffect(() => registerBackHandler(() => {
    if (!update || downloading) return false;
    close();
    return true;
  }), [close, downloading, registerBackHandler, update]);

  const install = async () => {
    if (!update || downloading) return;
    setDownloading(true);
    setProgress(0);
    let listener: Awaited<ReturnType<typeof listenAndroidApkProgress>> | null = null;
    try {
      listener = await listenAndroidApkProgress(event => setProgress(Math.max(0, Math.min(100, event.progress))));
      await downloadAndInstallAndroidApk(update.release.apkUrl, update.release.apkName);
      addToast('下载完成，请在系统安装页确认覆盖安装', 'success');
    } catch (error: any) {
      const message = error?.message || '更新下载失败，请重试';
      addToast(message, 'error');
    } finally {
      await listener?.remove().catch(() => {});
      setDownloading(false);
    }
  };

  if (!update) return null;

  return (
    <div className="fixed inset-0 z-[390] grid place-items-center bg-black/55 p-5 backdrop-blur-sm" onClick={close}>
      <section className="w-full max-w-sm rounded-[28px] bg-white p-5 text-slate-800 shadow-2xl" role="dialog" aria-modal="true" aria-label="发现新版本" onClick={event => event.stopPropagation()}>
        <div className="mb-4 flex items-start justify-between gap-3">
          <div>
            <p className="text-xs font-bold tracking-[.2em] text-primary">SULLYOS UPDATE</p>
            <h2 className="mt-1 text-xl font-black">发现新版本 {update.release.tag}</h2>
          </div>
          {!downloading && <button type="button" className="grid h-9 w-9 place-items-center rounded-full bg-slate-100 text-xl" onClick={close}>×</button>}
        </div>
        <div className="mb-4 grid grid-cols-2 gap-2 text-xs">
          <div className="rounded-2xl bg-slate-50 p-3"><span className="block text-slate-400">当前版本</span><b>{update.currentVersion}</b></div>
          <div className="rounded-2xl bg-primary/10 p-3"><span className="block text-slate-400">最新版本</span><b>{update.release.version}</b></div>
        </div>
        <div className="max-h-40 overflow-y-auto whitespace-pre-wrap rounded-2xl bg-slate-50 p-3 text-xs leading-5 text-slate-600">{update.release.notes}</div>
        {downloading && (
          <div className="mt-4">
            <div className="mb-1 flex justify-between text-xs font-bold"><span>正在下载 APK</span><span>{Math.round(progress)}%</span></div>
            <div className="h-2 overflow-hidden rounded-full bg-slate-100"><div className="h-full bg-primary transition-[width]" style={{ width: `${progress}%` }} /></div>
          </div>
        )}
        <div className="mt-5 flex gap-2">
          <button type="button" disabled={downloading} onClick={close} className="flex-1 rounded-2xl bg-slate-100 py-3 text-sm font-bold disabled:opacity-50">稍后</button>
          <button type="button" disabled={downloading} onClick={() => void install()} className="flex-1 rounded-2xl bg-primary py-3 text-sm font-bold text-white disabled:opacity-60">{downloading ? '下载中…' : '立即更新'}</button>
        </div>
        <p className="mt-3 text-center text-[10px] leading-4 text-slate-400">下载完成后会打开 Android 安装确认页，不会静默安装。</p>
      </section>
    </div>
  );
};

export default AppUpdateController;
