# SullyOS Android 发布与更新

## 固定身份与数据

- App ID：`com.khuooo.sullyos`
- App 名称：`SullyOS`
- WebView Origin：Capacitor 默认的 `https://localhost`
- Web 数据：继续使用现有 localStorage、IndexedDB 和 Blob 存储，没有另建第二套数据库

覆盖安装保留数据的前提是：App ID 不变、签名 keystore 不变，并且 `versionCode` 递增。不要卸载旧版，
不要执行“清除数据”。以后数据库结构变化必须通过现有 IndexedDB migration 升级，不能删除数据库重建。

## 本地 Debug APK

```bash
pnpm install
pnpm run android:sync
cd android
./gradlew assembleDebug
```

输出：`android/app/build/outputs/apk/debug/app-debug.apk`。

## 首次创建正式签名

在自己的离线安全目录运行（文件和密码不要放进仓库）：

```bash
keytool -genkeypair -v -keystore sullyos-release.keystore -alias sullyos \
  -keyalg RSA -keysize 4096 -validity 10000
```

妥善保存 keystore、alias、store password、key password。丢失 keystore 后，Android 将无法用新 APK 覆盖
旧安装，用户只能卸载并丢失 App 本地数据后重装。

把 keystore 转为单行 Base64：

```bash
base64 -w 0 sullyos-release.keystore
```

macOS 可用：`base64 < sullyos-release.keystore | tr -d '\n'`。

在 GitHub 仓库 `Settings → Secrets and variables → Actions` 新建：

| Secret | 内容 |
| --- | --- |
| `ANDROID_KEYSTORE` | 上一步的单行 Base64 |
| `ANDROID_KEYSTORE_PASSWORD` | keystore 密码 |
| `ANDROID_KEY_ALIAS` | 例如 `sullyos` |
| `ANDROID_KEY_PASSWORD` | key 密码 |

## 发布新版

1. 修改 `package.json` 的版本，例如 `1.0.1`，提交并合并到 `master`。
2. 创建同名 Tag：`git tag v1.0.1 && git push origin v1.0.1`。
3. GitHub Actions 会用 Tag 计算 Android `versionName=1.0.1`、`versionCode=10001`。
4. Workflow 构建签名 Release APK、验证签名，并创建或更新对应 GitHub Release。
5. Android App 启动时后台检查一次；也可在“系统设置 → App 更新”手动检查。

版本编码规则为 `major * 10000 + minor * 100 + patch`，minor/patch 范围为 0–99。正式发布后不要回退
versionCode。

## 更新安装流程

App 读取 `KHUOoo/SullyOS` 最新稳定 GitHub Release，选择其中的 `.apk` 资产。用户点击“立即更新”后，
APK 下载到 App 专属更新目录，再打开 Android 系统安装确认页；不会静默安装。Android 8+ 首次使用时，
系统可能要求允许 SullyOS 安装未知来源应用，允许后返回 App 再点一次更新即可。

## 原生能力

- `RECORD_AUDIO`：首次录音时才申请，拒绝不会影响文字聊天。
- 图片保存：Android 10+ 使用 MediaStore 写入 `Pictures/SullyOS`，不申请旧式存储权限。
- Android 9 及以下：仅为保存图片声明 `WRITE_EXTERNAL_STORAGE`，并限制 `maxSdkVersion=28`。
- 网络：声明 `INTERNET`；HTTPS API 正常使用，同时保留自建局域网 HTTP API 的兼容性。
