import type {
  APIConfig,
  CharacterProfile,
  ImageGenApiConfig,
  ImageGenAspectRatio,
  Message,
  UserProfile,
} from '../types';
import { ContextBuilder } from './context';
import { getBlobForRef, isBlobRef, isImageValue } from './blobRef';
import { extractContent, safeFetchJson } from './safeApi';

export type CharacterPhotoMode = 'selfie' | 'outfit' | 'food' | 'pov' | 'room' | 'free';

export const CHARACTER_PHOTO_MODES: Array<{ id: CharacterPhotoMode; label: string; hint: string }> = [
  { id: 'selfie', label: '自拍', hint: '像角色刚拿手机随手拍下的自拍' },
  { id: 'outfit', label: '今日穿搭', hint: '展示角色今天真实会穿的衣服' },
  { id: 'food', label: '今天吃的', hint: '角色此刻的食物、餐桌和周围环境' },
  { id: 'pov', label: '此刻视角', hint: '从角色眼前看出去的第一人称照片' },
  { id: 'room', label: '房间环境', hint: '角色正在待着的地方与生活痕迹' },
  { id: 'free', label: '自由照片', hint: '按补充描述决定画面' },
];

/** 只拦截明确且较短的“要照片”话术，避免普通聊天里提到拍照时误触。 */
export const isCharacterPhotoRequestText = (text: string): boolean => {
  const clean = text.trim().replace(/[！!。.?？～~]+$/g, '');
  if (!clean || clean.length > 80) return false;
  return /(拍(?:一张|张)?(?:照|照片|自拍)?给我看|拍给我看看|发(?:一张|张|个)?(?:自拍|照片|相片)(?:给我|看看)?|来(?:一张|张|个)?(?:自拍|照片|相片)|给我看看你(?:现在|今天)?(?:的样子)?)/.test(clean);
};

const DEFAULT_IMAGE_CONFIG: ImageGenApiConfig = {
  enabled: false,
  baseUrl: '',
  apiKey: '',
  model: 'gpt-image-1',
  size: 'auto',
  aspectRatio: '2:3',
  count: 1,
  timeoutMs: 120_000,
  referenceMode: 'avatar',
  referenceImage: '',
  similarity: 0.85,
  useRecentChatImages: false,
};

export const resolveImageGenConfig = (apiConfig: Pick<APIConfig, 'imageGenApi'>): ImageGenApiConfig => ({
  ...DEFAULT_IMAGE_CONFIG,
  ...(apiConfig.imageGenApi || {}),
});

export const imageSizeForAspectRatio = (
  size: ImageGenApiConfig['size'],
  aspectRatio: ImageGenAspectRatio,
): Exclude<ImageGenApiConfig['size'], 'auto'> => {
  if (size !== 'auto') return size;
  if (['2:3', '3:4', '4:5', '9:16'].includes(aspectRatio)) return '1024x1536';
  if (['3:2', '4:3', '5:4', '16:9'].includes(aspectRatio)) return '1536x1024';
  return '1024x1024';
};

const endpoint = (baseUrl: string, kind: 'generations' | 'edits'): string => {
  const clean = baseUrl.replace(/\/+$/, '');
  if (/\/images\/(generations|edits)$/i.test(clean)) {
    return clean.replace(/\/images\/(generations|edits)$/i, `/images/${kind}`);
  }
  return `${clean}/images/${kind}`;
};

const modeInstruction = (mode: CharacterPhotoMode): string =>
  CHARACTER_PHOTO_MODES.find(item => item.id === mode)?.hint || CHARACTER_PHOTO_MODES[0].hint;

const messagePreview = (message: Message, charName: string, userName: string): string => {
  const sender = message.role === 'assistant' ? charName : message.role === 'user' ? userName : '系统';
  const body = message.type === 'image' || message.type === 'emoji'
    ? `[${message.type === 'image' ? '图片' : '表情'}]`
    : String(message.content || '').replace(/\s+/g, ' ').slice(0, 360);
  return `${sender}: ${body}`;
};

/**
 * 让主聊天模型先决定“角色此刻真的会拍什么”。它只写摄影提示词，不直接生成图片。
 * ContextBuilder 负责角色时区、记忆和世界书；近期聊天另外放在末尾保持新鲜度。
 */
export async function buildCharacterPhotoPrompt(input: {
  char: CharacterProfile;
  user: UserProfile;
  messages: Message[];
  mode: CharacterPhotoMode;
  note?: string;
  apiConfig: APIConfig;
}): Promise<string> {
  const { char, user, messages, mode, apiConfig } = input;
  if (!apiConfig.baseUrl || !apiConfig.apiKey || !apiConfig.model) {
    throw new Error('请先配置主聊天 API；它负责根据角色设定写生图提示词');
  }

  const recent = messages.slice(-30);
  const core = ContextBuilder.buildCoreContext(
    char,
    user,
    true,
    undefined,
    undefined,
    { conversational: true, worldbookMessages: recent.map(message => ({ role: message.role, content: message.content })) },
  );
  const ratio = resolveImageGenConfig(apiConfig).aspectRatio;
  const system = `${core}\n\n### 临时任务：角色生活照片导演\n你不回复聊天内容，只为图片模型写一条完整摄影提示词。`
    + `画面必须像 ${char.name} 在当前时间与生活情境中真实拍下的照片，延续人设、世界观、近期聊天、关系与情绪。`
    + `若画面出现角色本人，明确写出稳定的外貌身份特征；不得把用户和角色混成同一张脸。`
    + `不要写“根据设定”“参考图”等元话语，不要解释，不要输出标题或 Markdown。`
    + `输出单段中文提示词，包含主体、动作、表情、服装、环境、光线、镜头、摄影质感与 ${ratio} 构图，控制在 1200 字内。`;
  const request = [
    `照片类型：${modeInstruction(mode)}`,
    input.note?.trim() ? `用户补充：${input.note.trim()}` : '',
    '近期聊天：',
    recent.map(message => messagePreview(message, char.name, user.name)).join('\n') || '（暂无）',
  ].filter(Boolean).join('\n');
  const data = await safeFetchJson(
    `${apiConfig.baseUrl.replace(/\/+$/, '')}/chat/completions`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiConfig.apiKey}` },
      body: JSON.stringify({
        model: apiConfig.model,
        messages: [{ role: 'system', content: system }, { role: 'user', content: request }],
        stream: false,
        temperature: Math.min(1, Math.max(0.2, apiConfig.temperature ?? 0.75)),
      }),
    },
    0,
    90_000,
    { appId: 'chat', appName: '聊天', charId: char.id, charName: char.name, purpose: '角色生图提示词' },
  );
  const prompt = extractContent(data).trim();
  if (!prompt) throw new Error('主聊天模型没有返回有效的生图提示词');
  return prompt;
}

const dataUrlToBlob = async (value: string): Promise<Blob> => {
  const response = await fetch(value);
  if (!response.ok) throw new Error(`读取参考图失败 (HTTP ${response.status})`);
  return response.blob();
};

const referenceToBlob = async (value: string): Promise<Blob> => {
  if (isBlobRef(value)) {
    const blob = await getBlobForRef(value);
    if (!blob) throw new Error('锁脸参考图已丢失，请重新上传');
    return blob;
  }
  return dataUrlToBlob(value);
};

const collectReferences = (input: {
  config: ImageGenApiConfig;
  char: CharacterProfile;
  messages: Message[];
}): string[] => {
  const { config, char, messages } = input;
  const refs: string[] = [];
  if (config.referenceMode === 'avatar' || config.referenceMode === 'hybrid') {
    if (isImageValue(char.avatar) && !char.avatar.startsWith('data:image/svg')) refs.push(char.avatar);
  }
  if (config.referenceMode === 'global' || config.referenceMode === 'hybrid') {
    if (config.referenceImage) refs.push(config.referenceImage);
  }
  if (config.referenceMode === 'character') refs.push(...(char.imageGenReferenceImages || []));
  if (config.useRecentChatImages) {
    refs.push(...messages.filter(message => message.type === 'image' && !!message.content).slice(-3).map(message => message.content));
  }
  return [...new Set(refs.filter(Boolean))].slice(0, 5);
};

const extractGeneratedImages = (data: any): string[] => {
  const candidates = Array.isArray(data?.data) ? data.data
    : Array.isArray(data?.images) ? data.images
      : Array.isArray(data?.output) ? data.output : [];
  return candidates.map((item: any) => {
    if (typeof item === 'string') return item;
    const b64 = item?.b64_json || item?.base64 || item?.image_base64;
    if (typeof b64 === 'string' && b64) {
      return b64.startsWith('data:') ? b64 : `data:image/png;base64,${b64}`;
    }
    return item?.url || item?.image_url || '';
  }).filter((value: unknown): value is string => typeof value === 'string' && value.length > 0);
};

export async function generateCharacterPhotos(input: {
  prompt: string;
  char: CharacterProfile;
  messages: Message[];
  apiConfig: APIConfig;
}): Promise<string[]> {
  const config = resolveImageGenConfig(input.apiConfig);
  if (!config.enabled) throw new Error('请先在设置里开启“生图 API”');
  if (!config.baseUrl || !config.apiKey || !config.model) throw new Error('生图 API 的 URL、Key 和模型还没有填完整');

  const refs = config.referenceMode === 'off' ? [] : collectReferences({ config, char: input.char, messages: input.messages });
  const commonMeta = {
    appId: 'chat', appName: '聊天', charId: input.char.id, charName: input.char.name, purpose: '角色照片生成',
  } as const;
  let data: any;
  if (refs.length > 0) {
    const form = new FormData();
    form.append('model', config.model);
    form.append('prompt', `${input.prompt}\n身份一致性要求：严格保持参考图人物身份与五官；相似度优先级 ${Math.round(config.similarity * 100)}%。`);
    form.append('n', String(config.count));
    form.append('size', imageSizeForAspectRatio(config.size, config.aspectRatio));
    if (config.similarity >= 0.65) form.append('input_fidelity', 'high');
    for (let index = 0; index < refs.length; index += 1) {
      const blob = await referenceToBlob(refs[index]);
      form.append('image[]', blob, `reference-${index + 1}.${blob.type.includes('jpeg') ? 'jpg' : 'png'}`);
    }
    data = await safeFetchJson(
      endpoint(config.baseUrl, 'edits'),
      { method: 'POST', headers: { Authorization: `Bearer ${config.apiKey}` }, body: form },
      0,
      config.timeoutMs,
      commonMeta,
    );
  } else {
    data = await safeFetchJson(
      endpoint(config.baseUrl, 'generations'),
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${config.apiKey}` },
        body: JSON.stringify({
          model: config.model,
          prompt: `${input.prompt}\n画幅比例：${config.aspectRatio}。`,
          n: config.count,
          size: imageSizeForAspectRatio(config.size, config.aspectRatio),
        }),
      },
      0,
      config.timeoutMs,
      commonMeta,
    );
  }
  const images = extractGeneratedImages(data);
  if (images.length === 0) throw new Error('生图接口返回成功，但响应里没有找到图片（需兼容 OpenAI Images API 的 data[].b64_json 或 data[].url）');
  return images;
}

export async function testImageGenApi(config: ImageGenApiConfig): Promise<void> {
  if (!config.baseUrl || !config.apiKey || !config.model) throw new Error('请先填写完整的 URL、Key 和模型');
  const data = await safeFetchJson(
    endpoint(config.baseUrl, 'generations'),
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${config.apiKey}` },
      body: JSON.stringify({
        model: config.model,
        prompt: 'A tiny lavender circle centered on a clean white background, simple API connection test.',
        n: 1,
        size: '1024x1024',
      }),
    },
    0,
    config.timeoutMs,
    { appId: 'settings', appName: '设置', purpose: '测试生图 API' },
  );
  if (extractGeneratedImages(data).length === 0) throw new Error('接口已响应，但没有返回可识别的图片字段');
}
