package com.khuooo.sullyos;

import android.Manifest;
import android.content.ContentResolver;
import android.content.ContentValues;
import android.content.Intent;
import android.media.MediaScannerConnection;
import android.net.Uri;
import android.os.Build;
import android.os.Environment;
import android.provider.MediaStore;
import android.provider.Settings;
import android.util.Base64;
import androidx.core.content.FileProvider;
import com.getcapacitor.JSObject;
import com.getcapacitor.PermissionState;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.getcapacitor.annotation.Permission;
import com.getcapacitor.annotation.PermissionCallback;
import java.io.File;
import java.io.FileOutputStream;
import java.io.InputStream;
import java.io.OutputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;

@CapacitorPlugin(
    name = "SullyNative",
    permissions = {
        @Permission(strings = { Manifest.permission.RECORD_AUDIO }, alias = "microphone"),
        @Permission(strings = { Manifest.permission.WRITE_EXTERNAL_STORAGE }, alias = "storage")
    }
)
public class SullyNativePlugin extends Plugin {
    private final ExecutorService executor = Executors.newSingleThreadExecutor();

    @PluginMethod
    public void requestMicrophonePermission(PluginCall call) {
        if (getPermissionState("microphone") == PermissionState.GRANTED) {
            resolvePermission(call, true);
        } else {
            requestPermissionForAlias("microphone", call, "microphonePermissionResult");
        }
    }

    @PermissionCallback
    private void microphonePermissionResult(PluginCall call) {
        resolvePermission(call, getPermissionState("microphone") == PermissionState.GRANTED);
    }

    private void resolvePermission(PluginCall call, boolean granted) {
        JSObject result = new JSObject();
        result.put("granted", granted);
        call.resolve(result);
    }

    @PluginMethod
    public void saveImage(PluginCall call) {
        if (Build.VERSION.SDK_INT <= Build.VERSION_CODES.P && getPermissionState("storage") != PermissionState.GRANTED) {
            requestPermissionForAlias("storage", call, "storagePermissionResult");
            return;
        }
        performSaveImage(call);
    }

    @PermissionCallback
    private void storagePermissionResult(PluginCall call) {
        if (getPermissionState("storage") != PermissionState.GRANTED) {
            call.reject("没有保存图片权限");
            return;
        }
        performSaveImage(call);
    }

    private void performSaveImage(PluginCall call) {
        final String encoded = call.getString("data");
        final String mimeType = call.getString("mimeType", "image/jpeg");
        final String fileName = safeFileName(call.getString("fileName", "SullyOS-image.jpg"));
        if (encoded == null || encoded.isEmpty()) {
            call.reject("图片数据为空");
            return;
        }
        executor.execute(() -> {
            try {
                byte[] bytes = Base64.decode(encoded, Base64.DEFAULT);
                Uri savedUri;
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
                    ContentResolver resolver = getContext().getContentResolver();
                    ContentValues values = new ContentValues();
                    values.put(MediaStore.Images.Media.DISPLAY_NAME, fileName);
                    values.put(MediaStore.Images.Media.MIME_TYPE, mimeType);
                    values.put(MediaStore.Images.Media.RELATIVE_PATH, Environment.DIRECTORY_PICTURES + "/SullyOS");
                    values.put(MediaStore.Images.Media.IS_PENDING, 1);
                    savedUri = resolver.insert(MediaStore.Images.Media.EXTERNAL_CONTENT_URI, values);
                    if (savedUri == null) throw new IllegalStateException("无法创建相册文件");
                    try (OutputStream output = resolver.openOutputStream(savedUri)) {
                        if (output == null) throw new IllegalStateException("无法写入相册文件");
                        output.write(bytes);
                    }
                    values.clear();
                    values.put(MediaStore.Images.Media.IS_PENDING, 0);
                    resolver.update(savedUri, values, null, null);
                } else {
                    File directory = new File(Environment.getExternalStoragePublicDirectory(Environment.DIRECTORY_PICTURES), "SullyOS");
                    if (!directory.exists() && !directory.mkdirs()) throw new IllegalStateException("无法创建相册目录");
                    File outputFile = new File(directory, fileName);
                    try (OutputStream output = new FileOutputStream(outputFile)) { output.write(bytes); }
                    MediaScannerConnection.scanFile(getContext(), new String[] { outputFile.getAbsolutePath() }, new String[] { mimeType }, null);
                    savedUri = Uri.fromFile(outputFile);
                }
                JSObject result = new JSObject();
                result.put("uri", savedUri.toString());
                call.resolve(result);
            } catch (Exception error) {
                call.reject("图片保存失败：" + error.getMessage(), error);
            }
        });
    }

    @PluginMethod
    public void downloadAndInstallApk(PluginCall call) {
        final String sourceUrl = call.getString("url");
        final String fileName = safeFileName(call.getString("fileName", "SullyOS-update.apk"));
        if (sourceUrl == null || !sourceUrl.startsWith("https://")) {
            call.reject("更新地址无效，只允许 HTTPS 下载");
            return;
        }
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O && !getContext().getPackageManager().canRequestPackageInstalls()) {
            Intent settingsIntent = new Intent(Settings.ACTION_MANAGE_UNKNOWN_APP_SOURCES, Uri.parse("package:" + getContext().getPackageName()));
            getActivity().startActivity(settingsIntent);
            call.reject("请先允许 SullyOS 安装未知来源应用，然后返回重试");
            return;
        }
        executor.execute(() -> downloadApk(call, sourceUrl, fileName));
    }

    private void downloadApk(PluginCall call, String sourceUrl, String fileName) {
        HttpURLConnection connection = null;
        try {
            URL current = new URL(sourceUrl);
            boolean connected = false;
            for (int redirects = 0; redirects < 6; redirects++) {
                connection = (HttpURLConnection) current.openConnection();
                connection.setInstanceFollowRedirects(false);
                connection.setConnectTimeout(20000);
                connection.setReadTimeout(60000);
                connection.setRequestProperty("Accept", "application/octet-stream");
                connection.setRequestProperty("User-Agent", "SullyOS-Android");
                int status = connection.getResponseCode();
                if (status >= 300 && status < 400) {
                    String location = connection.getHeaderField("Location");
                    connection.disconnect();
                    if (location == null) throw new IllegalStateException("更新下载重定向无效");
                    current = new URL(current, location);
                    continue;
                }
                if (status < 200 || status >= 300) throw new IllegalStateException("下载失败（HTTP " + status + "）");
                connected = true;
                break;
            }
            if (connection == null || !connected) throw new IllegalStateException("更新下载重定向次数过多");
            long total = connection.getContentLengthLong();
            File downloadsDirectory = getContext().getExternalFilesDir(Environment.DIRECTORY_DOWNLOADS);
            if (downloadsDirectory == null) throw new IllegalStateException("系统下载目录不可用");
            File updateDirectory = new File(downloadsDirectory, "updates");
            if (!updateDirectory.exists() && !updateDirectory.mkdirs()) throw new IllegalStateException("无法创建更新目录");
            File apk = new File(updateDirectory, fileName);
            try (InputStream input = connection.getInputStream(); OutputStream output = new FileOutputStream(apk)) {
                byte[] buffer = new byte[64 * 1024];
                long downloaded = 0;
                int read;
                while ((read = input.read(buffer)) != -1) {
                    output.write(buffer, 0, read);
                    downloaded += read;
                    JSObject event = new JSObject();
                    event.put("downloaded", downloaded);
                    event.put("total", total);
                    event.put("progress", total > 0 ? Math.min(100, (downloaded * 100.0) / total) : 0);
                    notifyListeners("apkDownloadProgress", event);
                }
            }
            Uri apkUri = FileProvider.getUriForFile(getContext(), getContext().getPackageName() + ".fileprovider", apk);
            Intent installIntent = new Intent(Intent.ACTION_VIEW);
            installIntent.setDataAndType(apkUri, "application/vnd.android.package-archive");
            installIntent.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION | Intent.FLAG_ACTIVITY_NEW_TASK);
            getActivity().runOnUiThread(() -> getContext().startActivity(installIntent));
            JSObject result = new JSObject();
            result.put("started", true);
            call.resolve(result);
        } catch (Exception error) {
            call.reject("APK 下载失败：" + error.getMessage(), error);
        } finally {
            if (connection != null) connection.disconnect();
        }
    }

    private String safeFileName(String value) {
        return value.replaceAll("[^a-zA-Z0-9._-]", "_");
    }

    @Override
    protected void handleOnDestroy() {
        executor.shutdownNow();
        super.handleOnDestroy();
    }
}
