import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { REF_SOURCE_STORES } from './blobGc';

// 「朋友圈」自己的两张图（assets 表的 spark_user_bg 与 spark_social_profile.avatar）
// 走 blobref 令牌：二进制在 IndexedDB，行里只留令牌。
//
// 这组用例是源码锚——写端一旦退回 processImage（吐 data URL）、或读端退回裸 <img src=...>，
// 都会在这里挂掉。写端和读端必须同进同退：只改一边就是「存了令牌但渲染不出来」或
// 「界面认令牌但库里还在攒 base64」。
const MOMENTS_APP = readFileSync(path.resolve(__dirname, '../apps/MomentsApp.tsx'), 'utf8');

describe('朋友圈封面、头像与动态图片存 blobref 令牌', () => {
    it('写端产出令牌，不再往 assets 行里塞 data URL', () => {
        expect(MOMENTS_APP).toContain("import { processImageToBlob } from '../utils/file'");
        expect(MOMENTS_APP).toContain('putImageBlob');

        // 背景图：blob → 令牌 → 存 assets 行
        expect(MOMENTS_APP).toContain('putImageBlob(await processImageToBlob(file, { maxWidth: 1800, quality: 0.9 }))');
        expect(MOMENTS_APP).toContain('await DB.saveAsset(COVER_ASSET_KEY, ref)');

        // 头像与动态图：blob → 令牌 → socialProfile / social_posts
        expect(MOMENTS_APP).toContain('const next = { ...socialProfile, avatar: ref }');
        expect(MOMENTS_APP).toContain('return putImageBlob(blob)');

        // 吐 data URL 的那个 processImage 不该再出现在这个文件里
        expect(MOMENTS_APP).not.toMatch(/\bprocessImage\s*\(/);
    });

    it('读端认令牌：封面、头像和动态图片统一走 TokenImg / Avatar', () => {
        expect(MOMENTS_APP).toContain('<TokenImg value={coverImage}');
        expect(MOMENTS_APP).not.toMatch(/<img\s+src=\{coverImage\}/);
        expect(MOMENTS_APP).toContain('<Avatar value={socialProfile.avatar}');
        expect(MOMENTS_APP).toContain('<Avatar value={post.authorAvatar}');
        expect(MOMENTS_APP).toContain('<TokenImg value={image}');
    });

    it('spark_* 所在的 assets 表在孤儿 GC 的引用面清单里（否则转出的图会被当垃圾删）', () => {
        expect(REF_SOURCE_STORES).toContain('assets');
    });
});
