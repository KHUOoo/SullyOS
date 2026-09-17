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

export type MomentPhotoType =
  | '自拍'
  | '风景'
  | '食物'
  | '桌面 / 学习台 / 工作台'
  | '房间一角'
  | '穿搭'
  | '出门随拍'
  | '天气 / 窗景'
  | '宠物 / 玩偶 / 小物件'
  | '当前生活场景记录';

export const MOMENT_PHOTO_TYPES: MomentPhotoType[] = [
  '自拍',
  '风景',
  '食物',
  '桌面 / 学习台 / 工作台',
  '房间一角',
  '穿搭',
  '出门随拍',
  '天气 / 窗景',
  '宠物 / 玩偶 / 小物件',
  '当前生活场景记录',
];

/** 朋友圈与聊天必须保留两套独立前缀，不能合并成一段通用“生活照”提示词。 */
export const MOMENT_IMAGE_PROMPT_PREFIX = `生成一张适合发布在朋友圈中的生活化照片。
整体风格自然、真实、轻松，具有普通手机随手拍的日常记录感和公开分享感，而不是专业影棚写真或商业宣传图。画面要像角色在真实生活中拍下并愿意发到朋友圈的内容。
优先表现生活痕迹、即时感、轻微随意感、真实环境与自然氛围。允许轻微构图不完美、普通手机成像感，但整体仍需清晰、可辨认。
不要海报感、广告感、影楼写真感、过度精修、超现实、夸张构图或明显 AI 感；不要脱离角色人设与朋友圈正文语境。`;

export const CHAT_IMAGE_PROMPT_PREFIX = `生成一张适合角色在私聊中发送给用户的图片。
图片必须服务于当前聊天语境，像角色为了回应用户、分享当下、展示某件事或表达情绪而此刻主动发来的内容。整体真实自然，具有即时交流感、私人分享感和“专门发给你看”的感觉。
画面可以贴近聊天对象视角，但不要像朋友圈营业图、公开展示照、海报、广告、艺术大片或模板化精修图；不要与当前聊天内容、角色状态和双方关系脱节。`;

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

export const normalizeMomentPhotoType = (value: unknown): MomentPhotoType => {
  const clean = typeof value === 'string' ? value.trim() : '';
  return MOMENT_PHOTO_TYPES.find(type => clean === type || clean.includes(type))
    || '当前生活场景记录';
};

/** 长期统计为 70% 纯文字、30% 单图；传入 random 便于稳定测试。 */
export const shouldGenerateMomentImage = (random: () => number = Math.random): boolean => random() < 0.3;

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
  const chatPreview = recent.slice(-8).map(message => messagePreview(message, char.name, user.name)).join('\n') || '（暂无）';
  return `${CHAT_IMAGE_PROMPT_PREFIX}

发送者：${char.name}
角色人设与双方关系：严格依照角色设定、记忆和近期聊天，不混淆角色与用户身份
当前聊天内容：
${chatPreview}
发图目的：${input.note?.trim() || modeInstruction(mode)}
图片类型：${modeInstruction(mode)}
场景与氛围：${prompt}
补充约束：这张图必须像 ${char.name} 此刻在私聊中主动发给用户看的内容；只生成单张图片，使用 ${ratio} 构图。`;
}

/**
 * 朋友圈图片导演。正文先由朋友圈模型生成；这里再结合单个角色完整设定、
 * 当前状态与近期私聊，把公开动态改写成适合图片模型的具体场景。
 */
export async function buildMomentPhotoPrompt(input: {
  char: CharacterProfile;
  user: UserProfile;
  messages: Message[];
  content: string;
  currentState?: string;
  imageType: MomentPhotoType;
  scene?: string;
  atmosphere?: string;
  apiConfig: APIConfig;
}): Promise<string> {
  const { char, user, messages, apiConfig } = input;
  if (!apiConfig.baseUrl || !apiConfig.apiKey || !apiConfig.model) {
    throw new Error('请先配置主聊天 API；它负责根据角色设定写朋友圈生图提示词');
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
  const system = `${core}\n\n### 临时任务：朋友圈生活照片导演\n你不回复聊天内容，只为图片模型写一条完整摄影提示词。`
    + `画面必须像 ${char.name} 在当前时间与生活情境中真实拍下并发布在朋友圈的单张照片。`
    + `它是公开动态，但仍然日常、自然、不过度营业。若出现角色本人，要写清稳定外貌、动作、表情和服装；不得把用户与角色混成同一张脸。`
    + `不要写“根据设定”“参考图”等元话语，不要解释，不要输出标题或 Markdown。`
    + `输出单段中文提示词，包含主体、环境、生活痕迹、自然光线、手机镜头感与 ${ratio} 构图，控制在 1200 字内。`;
  const request = [
    `发布者：${char.name}`,
    `当前状态：${input.currentState?.trim() || '按角色此刻的生活与情绪自然判断'}`,
    `朋友圈正文：${input.content.trim()}`,
    `图片类型：${input.imageType}`,
    `场景要求：${input.scene?.trim() || '与正文和当前状态一致的真实生活场景'}`,
    `氛围要求：${input.atmosphere?.trim() || '自然、松弛、真实的日常分享'}`,
    '近期私聊只用于判断角色状态和与用户的关系，不能把私聊原文直接展示在公开画面中：',
    recent.slice(-8).map(message => messagePreview(message, char.name, user.name)).join('\n') || '（暂无）',
  ].join('\n');
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
    { appId: 'social', appName: '朋友圈', charId: char.id, charName: char.name, purpose: '朋友圈生图提示词' },
  );
  const prompt = extractContent(data).trim();
  if (!prompt) throw new Error('主聊天模型没有返回有效的朋友圈生图提示词');

  return `${MOMENT_IMAGE_PROMPT_PREFIX}

发布者：${char.name}
角色人设：严格依照角色设定、记忆与当前生活，不混用其他角色资料
当前状态：${input.currentState?.trim() || '符合角色此刻状态'}
朋友圈正文：${input.content.trim()}
图片类型：${input.imageType}
场景要求：${input.scene?.trim() || prompt}
氛围要求：${input.atmosphere?.trim() || '自然、松弛、真实的日常分享'}
完整画面描述：${prompt}
补充约束：只生成单张图片，符合朋友圈语境，生活化、自然真实，使用 ${ratio} 构图。`;
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
  /** 朋友圈强制传 count: 1；聊天未传时继续尊重设置里的张数。 */
  count?: number;
  surface?: 'chat' | 'moments';
}): Promise<string[]> {
  const config = resolveImageGenConfig(input.apiConfig);
  if (!config.enabled) throw new Error('请先在设置里开启“生图 API”');
  if (!config.baseUrl || !config.apiKey || !config.model) throw new Error('生图 API 的 URL、Key 和模型还没有填完整');

  const refs = config.referenceMode === 'off' ? [] : collectReferences({ config, char: input.char, messages: input.messages });
  const count = Math.max(1, Math.min(4, Math.round(input.count ?? config.count)));
  const commonMeta = {
    appId: input.surface === 'moments' ? 'social' : 'chat',
    appName: input.surface === 'moments' ? '朋友圈' : '聊天',
    charId: input.char.id,
    charName: input.char.name,
    purpose: input.surface === 'moments' ? '角色朋友圈图片生成' : '角色照片生成',
  } as const;
  let data: any;
  if (refs.length > 0) {
    const form = new FormData();
    form.append('model', config.model);
    form.append('prompt', `${input.prompt}\n身份一致性要求：严格保持参考图人物身份与五官；相似度优先级 ${Math.round(config.similarity * 100)}%。`);
    form.append('n', String(count));
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
          n: count,
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
