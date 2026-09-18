import { afterEach, describe, expect, it, vi } from 'vitest';
import { isSpeechToTextReady, resolveSpeechToTextConfig, transcribeSpeechBlob } from './speechTranscriptionApi';

afterEach(() => vi.unstubAllGlobals());

describe('speechTranscriptionApi', () => {
  it('keeps STT independent and requires a complete enabled config', () => {
    expect(isSpeechToTextReady({ sttApi: { enabled: true, baseUrl: '', apiKey: '', model: 'whisper-1' } })).toBe(false);
    expect(resolveSpeechToTextConfig({ sttApi: { enabled: true, baseUrl: 'https://stt.example/v1/', apiKey: ' key ', model: 'whisper-1' } }).baseUrl)
      .toBe('https://stt.example/v1');
  });

  it('posts audio to the OpenAI-compatible transcription endpoint', async () => {
    const fetchMock = vi.fn(async () => new Response(JSON.stringify({ text: '你在干嘛？' }), {
      status: 200,
      headers: { 'content-type': 'application/json' },
    }));
    vi.stubGlobal('fetch', fetchMock);
    const text = await transcribeSpeechBlob(new Blob(['voice'], { type: 'audio/webm' }), {
      sttApi: { enabled: true, baseUrl: 'https://stt.example/v1', apiKey: 'key', model: 'whisper-1', language: 'zh' },
    });
    expect(text).toBe('你在干嘛？');
    expect(fetchMock.mock.calls[0][0]).toBe('https://stt.example/v1/audio/transcriptions');
    expect(fetchMock.mock.calls[0][1]?.body).toBeInstanceOf(FormData);
  });
});
