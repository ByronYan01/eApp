import { ref } from 'vue';

// 单词拆解项接口
export interface WordDetail {
  original: string;
  clean: string;
  phonetic: string;
  explain: string;
}

// 句子项完整数据结构
export interface SentenceItem {
  id: string;
  text: string;
  translation: string;
  phonetics: string; // 拼接后的整句音标
  words: WordDetail[];
  addedAt: number;
  status: 'learning' | 'mastered';
  reviewCount: number; // 已通过复习的次数
  nextReviewTime: number; // 下次复习的时间戳
}

export interface AppSettings {
  phoneticAccent: 'US' | 'UK';           // 首选音标口音：US(美音) | UK(英音)
  allowPhoneticFallback: boolean;        // 是否允许音标降级 (true: 允许, false: 不允许)
  audioPlaySource: 'local' | 'online';    // 发音音频源：local(系统本地TTS) | online(在线真人原声)
  translationProvider: 'auto' | 'google' | 'youdao' | 'baidu' | 'mymemory'; // 翻译引擎提供商：auto | google | youdao | baidu | mymemory
  audioPlayProvider: 'auto' | 'youdao' | 'google' | 'baidu'; // 在线发音引擎提供商：auto | youdao | google | baidu
  dictionaryProvider: 'youdao' | 'eudic'; // 单词音标与释义提供商：youdao | eudic
  eudicToken: string;                    // 欧路词典 Personal Developer Token
  translationTimeout: number;            // 整句翻译超时时间 (ms)
  audioTimeout: number;                  // 在线发音超时时间 (ms)
}

const STORAGE_KEY = 'eapp_sentence_data';
const SETTINGS_KEY = 'eapp_app_settings';

const DEFAULT_SETTINGS: AppSettings = {
  phoneticAccent: 'US',
  allowPhoneticFallback: true,
  audioPlaySource: 'local',
  translationProvider: 'auto',
  audioPlayProvider: 'auto',
  dictionaryProvider: 'youdao',
  eudicToken: '',
  translationTimeout: 5000,
  audioTimeout: 5000
};

// 艾宾浩斯复习阶段时间间隔 (单位: 分钟)
// 阶段 0: 立即, 阶段 1: 30分, 阶段 2: 12小时, 阶段 3: 1天, 阶段 4: 2天, 阶段 5: 4天, 阶段 6: 7天, 阶段 7: 15天
const REVIEW_INTERVALS = [0, 30, 720, 1440, 2880, 5760, 10080, 21600];

export function useStorage() {
  const sentences = ref<SentenceItem[]>([]);
  const settings = ref<AppSettings>({ ...DEFAULT_SETTINGS });

  /**
   * 1. 初始化并加载所有数据
   */
  const loadData = () => {
    try {
      const dataStr = localStorage.getItem(STORAGE_KEY);
      if (dataStr) {
        sentences.value = JSON.parse(dataStr);
      } else {
        sentences.value = [];
      }
    } catch (e) {
      console.error('加载本地句子数据失败:', e);
      sentences.value = [];
    }
    // 顺便加载设置
    loadSettings();
  };

  /**
   * 2. 加载设置数据
   */
  const loadSettings = () => {
    try {
      const settingsStr = localStorage.getItem(SETTINGS_KEY);
      if (settingsStr) {
        settings.value = { ...DEFAULT_SETTINGS, ...JSON.parse(settingsStr) };
      } else {
        settings.value = { ...DEFAULT_SETTINGS };
      }
    } catch (e) {
      console.error('加载本地配置失败:', e);
      settings.value = { ...DEFAULT_SETTINGS };
    }
  };

  /**
   * 3. 保存设置数据
   */
  const saveSettings = (newSettings: AppSettings) => {
    try {
      settings.value = { ...newSettings };
      localStorage.setItem(SETTINGS_KEY, JSON.stringify(newSettings));
    } catch (e) {
      console.error('保存本地配置失败:', e);
    }
  };

  /**
   * 4. 保存数据到 LocalStorage
   */
  const saveData = () => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(sentences.value));
    } catch (e) {
      console.error('保存句子数据失败:', e);
    }
  };

  /**
   * 5. 添加新句子
   */
  const addSentence = (
    text: string,
    translation: string,
    phonetics: string,
    words: WordDetail[]
  ): SentenceItem => {
    const newItem: SentenceItem = {
      id: Date.now().toString(36) + Math.random().toString(36).substr(2, 5),
      text: text.trim(),
      translation: translation.trim(),
      phonetics,
      words,
      addedAt: Date.now(),
      status: 'learning',
      reviewCount: 0,
      nextReviewTime: Date.now() // 新增的句子默认立即需要学习/复习
    };

    sentences.value.unshift(newItem); // 插入到最前
    saveData();
    return newItem;
  };

  /**
   * 6. 删除句子
   */
  const deleteSentence = (id: string) => {
    sentences.value = sentences.value.filter(item => item.id !== id);
    saveData();
  };

  /**
   * 7. 艾宾浩斯智能复习时间计算
   * @param id 句子ID
   * @param isRemembered 是否记住了该句子
   */
  const updateReviewProgress = (id: string, isRemembered: boolean) => {
    const item = sentences.value.find(s => s.id === id);
    if (!item) return;

    if (isRemembered) {
      // 记住了，复习级数 +1，计算下一次复习时间
      item.reviewCount += 1;
      const intervalIdx = Math.min(item.reviewCount, REVIEW_INTERVALS.length - 1);
      const minutesToAdd = REVIEW_INTERVALS[intervalIdx];
      item.nextReviewTime = Date.now() + minutesToAdd * 60 * 1000;
      
      // 如果完成了所有阶段的复习，标记为已掌握
      if (item.reviewCount >= REVIEW_INTERVALS.length - 1) {
        item.status = 'mastered';
      }
    } else {
      // 没记住，复习阶段归零，标记为学习中，并在 1 分钟后再次提醒复习
      item.reviewCount = 0;
      item.status = 'learning';
      item.nextReviewTime = Date.now() + 1 * 60 * 1000; // 1分钟后
    }

    saveData();
  };

  /**
   * 8. 将句子标记为“已掌握”或“学习中” (手动强制更改)
   */
  const toggleStatus = (id: string) => {
    const item = sentences.value.find(s => s.id === id);
    if (!item) return;

    item.status = item.status === 'learning' ? 'mastered' : 'learning';
    if (item.status === 'mastered') {
      item.reviewCount = REVIEW_INTERVALS.length - 1;
      item.nextReviewTime = Date.now() + 365 * 24 * 60 * 60 * 1000; // 1年后再复习
    } else {
      item.reviewCount = 0;
      item.nextReviewTime = Date.now(); // 立即复习
    }
    saveData();
  };

  /**
   * 9. 导出所有数据为本地 JSON 备份文件 (绝佳的桌面客户端防丢失方案)
   */
  const exportData = () => {
    try {
      const dataStr = JSON.stringify(sentences.value, null, 2);
      const blob = new Blob([dataStr], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      
      const link = document.createElement('a');
      link.href = url;
      link.download = `eApp_Backup_${new Date().toISOString().slice(0, 10)}.json`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    } catch (e) {
      console.error('导出句子备份失败:', e);
    }
  };

  /**
   * 10. 导入本地 JSON 备份文件恢复数据
   */
  const importData = (file: File): Promise<boolean> => {
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          const imported = JSON.parse(e.target?.result as string);
          if (Array.isArray(imported)) {
            // 简单校验数据结构
            const isValid = imported.every(item => item.id && item.text && item.translation);
            if (isValid) {
              sentences.value = imported;
              saveData();
              resolve(true);
              return;
            }
          }
          resolve(false);
        } catch {
          resolve(false);
        }
      };
      reader.onerror = () => resolve(false);
      reader.readAsText(file);
    });
  };

  return {
    sentences,
    settings,
    loadData,
    loadSettings,
    saveSettings,
    addSentence,
    deleteSentence,
    updateReviewProgress,
    toggleStatus,
    exportData,
    importData
  };
}
