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
      currentAudio.pause();
      currentAudio.src = '';
      currentAudio = null;
    }

    isPlaying.value = false;
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
    // 先停止当前正在播放的声音，避免混音重叠
    stop();

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
    isPlaying.value = true;
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
        currentAudio = null;
        alert('⚠️ 在线真人发音播放失败，请检查网络连接是否正常。\n若您目前处于离线或断网状态，建议前往【系统设置】页面，将【发音音频源】切换为【系统本地发音】。');
      };

      await currentAudio.play();
    } catch (err) {
      console.error('在线真人原声代理播放失败:', err);
      isPlaying.value = false;
      currentAudio = null;
      alert(`⚠️ 真人发音获取失败: ${err}\n如处于离线状态，建议前往【系统设置】切换为【系统本地发音】。`);
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
    currentAccent,
    playRate,
    play,
    stop
  };
}
