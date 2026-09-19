import { Capacitor, registerPlugin, type PluginListenerHandle } from '@capacitor/core';

interface SullyNativePlugin {
  saveImage(options: { data: string; mimeType: string; fileName: string }): Promise<{ uri: string }>;
  requestMicrophonePermission(): Promise<{ granted: boolean }>;
  downloadAndInstallApk(options: { url: string; fileName: string }): Promise<{ started: boolean }>;
  addListener(
    eventName: 'apkDownloadProgress',
    listener: (event: { progress: number; downloaded: number; total: number }) => void,
  ): Promise<PluginListenerHandle>;
}

const SullyNative = registerPlugin<SullyNativePlugin>('SullyNative');

export const isNativeAndroid = () => Capacitor.getPlatform() === 'android';

const blobToBase64 = (blob: Blob): Promise<string> => new Promise((resolve, reject) => {
  const reader = new FileReader();
  reader.onerror = () => reject(reader.error || new Error('读取图片失败'));
  reader.onload = () => {
    const value = String(reader.result || '');
    resolve(value.includes(',') ? value.slice(value.indexOf(',') + 1) : value);
  };
  reader.readAsDataURL(blob);
});

export const saveImageToAndroidGallery = async (blob: Blob, fileName: string): Promise<string> => {
  if (!isNativeAndroid()) throw new Error('当前不是 Android App');
  const result = await SullyNative.saveImage({
    data: await blobToBase64(blob),
    mimeType: blob.type || 'image/jpeg',
    fileName,
  });
  return result.uri;
};

export const requestAndroidMicrophonePermission = async (): Promise<boolean> => {
  if (!isNativeAndroid()) return true;
  const result = await SullyNative.requestMicrophonePermission();
  return result.granted;
};

export const downloadAndInstallAndroidApk = async (url: string, fileName: string): Promise<void> => {
  if (!isNativeAndroid()) throw new Error('请在 Android App 中安装更新');
  await SullyNative.downloadAndInstallApk({ url, fileName });
};

export const listenAndroidApkProgress = (
  listener: (event: { progress: number; downloaded: number; total: number }) => void,
) => SullyNative.addListener('apkDownloadProgress', listener);
