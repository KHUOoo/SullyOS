import { App } from '@capacitor/app';
import { isNativeAndroid } from './sullyNative';

export interface AppRelease {
  version: string;
  tag: string;
  notes: string;
  publishedAt: string;
  apkUrl: string;
  apkName: string;
  htmlUrl: string;
}

const RELEASES_API = 'https://api.github.com/repos/KHUOoo/SullyOS/releases/latest';
export const APP_UPDATE_CHECK_EVENT = 'sully:check-app-update';

export const compareVersions = (left: string, right: string): number => {
  const parse = (value: string) => value.replace(/^v/i, '').split(/[.+-]/).slice(0, 3).map(part => Number.parseInt(part, 10) || 0);
  const a = parse(left);
  const b = parse(right);
  for (let index = 0; index < 3; index += 1) {
    if ((a[index] || 0) !== (b[index] || 0)) return (a[index] || 0) > (b[index] || 0) ? 1 : -1;
  }
  return 0;
};

export const getCurrentAppVersion = async (): Promise<string> => {
  if (isNativeAndroid()) {
    try {
      return (await App.getInfo()).version;
    } catch { /* fall through to build version */ }
  }
  return __APP_SEMVER__;
};

export const fetchLatestAppRelease = async (): Promise<AppRelease> => {
  const response = await fetch(RELEASES_API, {
    headers: { Accept: 'application/vnd.github+json' },
    cache: 'no-store',
  });
  if (!response.ok) throw new Error(`检查更新失败（GitHub ${response.status}）`);
  const release = await response.json();
  const assets = Array.isArray(release.assets) ? release.assets : [];
  const isApk = (item: any) => typeof item?.browser_download_url === 'string' && /\.apk$/i.test(item.name || '');
  const asset = assets.find((item: any) => isApk(item) && /^SullyOS-v?\d+\.\d+\.\d+\.apk$/i.test(item.name || ''))
    || assets.find(isApk);
  if (!asset) throw new Error('最新 Release 中没有找到 APK');
  const tag = String(release.tag_name || '');
  return {
    version: tag.replace(/^v/i, ''),
    tag,
    notes: String(release.body || '本次版本暂无更新说明。'),
    publishedAt: String(release.published_at || ''),
    apkUrl: asset.browser_download_url,
    apkName: asset.name || `SullyOS-${tag}.apk`,
    htmlUrl: String(release.html_url || 'https://github.com/KHUOoo/SullyOS/releases'),
  };
};

export const checkForAppUpdate = async () => {
  const [currentVersion, release] = await Promise.all([getCurrentAppVersion(), fetchLatestAppRelease()]);
  return { currentVersion, release, updateAvailable: compareVersions(release.version, currentVersion) > 0 };
};
