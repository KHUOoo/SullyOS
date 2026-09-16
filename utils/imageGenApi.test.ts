import { afterEach, describe, expect, it, vi } from 'vitest';
import { generateCharacterPhotos, imageSizeForAspectRatio, isCharacterPhotoRequestText, resolveImageGenConfig } from './imageGenApi';

afterEach(() => vi.unstubAllGlobals());

describe('imageGenApi', () => {
  it('maps portrait and landscape ratios onto image API sizes', () => {
    expect(imageSizeForAspectRatio('auto', '2:3')).toBe('1024x1536');
    expect(imageSizeForAspectRatio('auto', '9:16')).toBe('1024x1536');
    expect(imageSizeForAspectRatio('auto', '3:2')).toBe('1536x1024');
    expect(imageSizeForAspectRatio('auto', '1:1')).toBe('1024x1024');
    expect(imageSizeForAspectRatio('1024x1024', '2:3')).toBe('1024x1024');
  });

  it('recognizes explicit short photo requests without hijacking ordinary photo talk', () => {
    expect(isCharacterPhotoRequestText('拍给我看！')).toBe(true);
    expect(isCharacterPhotoRequestText('现在发张自拍给我看看')).toBe(true);
    expect(isCharacterPhotoRequestText('来一张照片')).toBe(true);
    expect(isCharacterPhotoRequestText('昨天我们聊到的那张照片让我想到很多事情')).toBe(false);
    expect(isCharacterPhotoRequestText('拍照这个功能到底是怎么实现的？')).toBe(false);
  });

  it('fills backward-compatible defaults for old API configs', () => {
    const result = resolveImageGenConfig({});
    expect(result.enabled).toBe(false);
    expect(result.model).toBe('gpt-image-1');
    expect(result.aspectRatio).toBe('2:3');
    expect(result.referenceMode).toBe('avatar');
  });

  it('calls the OpenAI-compatible generations endpoint and accepts b64_json', async () => {
    const fetchMock = vi.fn(async () => new Response(JSON.stringify({
      data: [{ b64_json: 'QUJD' }],
    }), { status: 200, headers: { 'content-type': 'application/json' } }));
    vi.stubGlobal('fetch', fetchMock);

    const images = await generateCharacterPhotos({
      prompt: '生活自拍',
      char: { id: 'char-1', name: '角色', avatar: '🙂' } as any,
      messages: [],
      apiConfig: {
        baseUrl: 'https://image.example/v1/', apiKey: 'secret', model: 'chat-model',
        imageGenApi: {
          enabled: true, baseUrl: 'https://image.example/v1/', apiKey: 'image-key', model: 'image-model',
          size: 'auto', aspectRatio: '2:3', count: 1, timeoutMs: 120000,
          referenceMode: 'off', similarity: 0.8,
        },
      },
    });

    expect(images).toEqual(['data:image/png;base64,QUJD']);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock.mock.calls[0][0]).toBe('https://image.example/v1/images/generations');
    const request = fetchMock.mock.calls[0][1] as RequestInit;
    expect(JSON.parse(String(request.body))).toMatchObject({ model: 'image-model', n: 1, size: '1024x1536' });
  });
});
