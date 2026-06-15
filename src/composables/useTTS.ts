import { ref } from 'vue';
import { invoke } from '@tauri-apps/api/core';

export type AccentType = 'US' | 'UK';
export type AudioSourceType = 'local' | 'online';

// 全局保持对当前在线播放 Audio 对象的引用，方便精准切断
let currentAudio: HTMLAudioElement | null = null;

/**
 * Vue 3 组合式函数: 智能发音引擎 (支持系统本地 TTS 与在线真人原声双通道)
 * 所有的注释已严格遵循中文规则
 */
export function useTTS() {
  const isPlaying = ref(false);
  const isLoading = ref(false);
  const errorMessage = ref('');
  const currentAccent = ref<AccentType>('US');
  const playRate = ref(1.0); // 播放语速

  // 获取系统的发音包列表 (本地TTS用)
  const getVoices = (): SpeechSynthesisVoice[] => {
    if (typeof window === 'undefined' || !window.speechSynthesis) {
      return [];
    }
    return window.speechSynthesis.getVoices();
  };

  /**
   * 停止当前所有播放 (包含本地合成与在线原声)
   */
  const stop = () => {
    // 1. 停止本地 TTS 播放
    if (typeof window !== 'undefined' && window.speechSynthesis) {
      window.speechSynthesis.cancel();
    }

    // 2. 停止在线 Audio 播放
    if (currentAudio) {
      // 关键：清空事件监听器，避免在 src 清空时误触发 onerror 回调
      currentAudio.onended = null;
      currentAudio.onerror = null;
      currentAudio.pause();
      currentAudio.src = '';
      currentAudio = null;
    }

    isPlaying.value = false;
    isLoading.value = false;
    errorMessage.value = '';
  };

  /**
   * 播放给定的英语文本
   * @param text 要播放的英文句子或单词
   * @param accent 口音选择：'US' (美音) | 'UK' (英音)
   * @param rate 语速：0.5 (慢) 至 1.5 (快) (仅对本地TTS有效)
   * @param source 发音音频源：'local' (系统本地合成) | 'online' (在线真人原声)
   * @param provider 在线发音引擎：'auto' | 'youdao' | 'google' | 'baidu'
   */
  const play = (
    text: string, 
    accent: AccentType = 'US', 
    rate: number = playRate.value,
    source: AudioSourceType = 'local',
    provider: string = 'auto',
    timeoutMs: number = 5000
  ) => {
    if (isLoading.value) {
      // 在线加载中禁止重复发起请求，防刷与限频保护
      return;
    }

    // 先停止当前正在播放的声音，避免混音重叠
    stop();
    errorMessage.value = '';

    if (!text.trim()) return;

    if (source === 'online') {
      // 执行在线真人原声播放 (调用我们全新的后端 Base64 代理，并透传提供商偏好、语速及超时参数)
      playOnline(text, accent, rate, provider, timeoutMs);
    } else {
      // 执行本地 TTS 播放
      playLocal(text, accent, rate);
    }
  };

  /**
   * 在线真人原声播放核心逻辑 (调用 Rust 后端级联多引擎代理服务，规避 Webview 跨域和防盗链)
   */
  const playOnline = async (text: string, accent: AccentType, rate: number, provider: string = 'auto', timeoutMs: number = 5000) => {
    isLoading.value = true;
    isPlaying.value = false; // 加载期间不处于播放状态
    currentAccent.value = accent;
    playRate.value = rate; // 同步当前语速

    try {
      // 调用 Rust 端已注册的 get_online_audio_backend 命令下载音频，并传递偏好提供商与超时参数
      const base64Audio = await invoke<string>('get_online_audio_backend', {
        text: text.trim(),
        accent,
        provider,
        timeoutMs
      });

      currentAudio = new Audio(base64Audio);
      currentAudio.playbackRate = rate; // 关键修复：将语速设置应用到在线音频播放上
      
      currentAudio.onended = () => {
        isPlaying.value = false;
        currentAudio = null;
      };

      currentAudio.onerror = (e) => {
        console.error('在线真人原声播放失败:', e);
        isPlaying.value = false;
        isLoading.value = false;
        currentAudio = null;
        errorMessage.value = '播放失败，请稍后重试。';
      };

      // 异步等待音频真正开始播放，成功 resolve 后再解除 loading
      await currentAudio.play();
      
      isLoading.value = false;
      isPlaying.value = true;
    } catch (err: any) {
      // 忽略因主动暂停或打断引起的 AbortError (属于正常的发音切换/切歌操作)
      let isAbort = false;
      if (err && (err.name === 'AbortError' || err.message?.includes('interrupted') || err.message?.includes('pause'))) {
        isAbort = true;
      }

      console.error('在线真人原声代理播放失败:', err);
      isLoading.value = false;
      isPlaying.value = false;
      currentAudio = null;

      if (!isAbort) {
        errorMessage.value = '网络请求超时或获取失败，请重试。';
      }
    }
  };

  /**
   * 系统本地合成 TTS 播放核心逻辑 (无网离线状态下完美运作)
   */
  const playLocal = (text: string, accent: AccentType, rate: number) => {
    if (typeof window === 'undefined' || !window.speechSynthesis) {
      console.warn('当前系统环境不支持本地语音合成 (TTS)');
      return;
    }

    const utterance = new SpeechSynthesisUtterance(text);
    
    // 设置语速与口音偏好
    utterance.rate = rate;
    playRate.value = rate;
    currentAccent.value = accent;

    // 匹配最适合的发音人 (根据 US 或 UK 过滤)
    const voices = getVoices();
    let selectedVoice: SpeechSynthesisVoice | null = null;

    if (accent === 'US') {
      selectedVoice = 
        voices.find(v => v.lang === 'en-US' && v.name.includes('Samantha')) ||
        voices.find(v => v.lang === 'en-US' && v.name.includes('Nathan')) ||
        voices.find(v => v.lang.startsWith('en-US')) ||
        null;
    } else {
      selectedVoice = 
        voices.find(v => v.lang === 'en-GB' && v.name.includes('Daniel')) ||
        voices.find(v => v.lang === 'en-GB') ||
        voices.find(v => v.lang.startsWith('en-GB')) ||
        null;
    }

    if (selectedVoice) {
      utterance.voice = selectedVoice;
    } else {
      utterance.lang = accent === 'US' ? 'en-US' : 'en-GB';
    }

    // 绑定开始与结束事件，用于声波动效状态追踪
    utterance.onstart = () => {
      isPlaying.value = true;
    };

    utterance.onend = () => {
      isPlaying.value = false;
    };

    utterance.onerror = (e) => {
      console.error('系统本地 TTS 播放出错:', e);
      isPlaying.value = false;
    };

    // 提交发音指令
    window.speechSynthesis.speak(utterance);
  };

  // 预热并异步拉取系统发音人，抹平部分老旧浏览器差异
  if (typeof window !== 'undefined' && window.speechSynthesis) {
    if (window.speechSynthesis.onvoiceschanged !== undefined) {
      window.speechSynthesis.onvoiceschanged = () => {
        getVoices();
      };
    }
  }

  return {
    isPlaying,
    isLoading,
    errorMessage,
    currentAccent,
    playRate,
    play,
    stop
  };
}
