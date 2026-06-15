import { ref } from 'vue';

// 单词拆解项接口
export interface WordDetail {
  original: string;
  clean: string;
  phonetic: string;
  explain: string;
}

// 仓库定义接口
export interface Repository {
  id: string;            // 唯一标识。系统默认仓库固定为 'default'
  name: string;          // 仓库名称
  createdAt: number;     // 创建时间戳
  description?: string;  // 仓库说明/备注
  isSystem?: boolean;    // 是否为系统内置仓库（内置的默认仓库不可删除）
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
  repoId?: string; // 所属仓库ID。若为空或不存在，则隐式归属为 'default'
}

// 整体持久化存储结构
export interface StorageData {
  version: number;
  repositories: Repository[];
  sentences: SentenceItem[];
}

// 复习打卡历史日志接口
export interface ReviewLog {
  sentenceId: string;
  timestamp: number;
  remembered: boolean;
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
  githubToken: string;                   // GitHub Access Token
  githubGistId: string;                  // GitHub Gist ID
  lastSyncedAt: number;                  // 上次同步完成时间戳
  aiEndpoint: string;                    // 私域大模型 API Endpoint
  aiApiKey: string;                      // 私域大模型 API Key
  aiModel: string;                       // 私域大模型模型名称
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
  audioTimeout: 5000,
  githubToken: '',
  githubGistId: '',
  lastSyncedAt: 0,
  aiEndpoint: '',
  aiApiKey: '',
  aiModel: ''
};

// 艾宾浩斯复习阶段时间间隔 (单位: 分钟)
// 阶段 0: 立即, 阶段 1: 30分, 阶段 2: 12小时, 阶段 3: 1天, 阶段 4: 2天, 阶段 5: 4天, 阶段 6: 7天, 阶段 7: 15天
const REVIEW_INTERVALS = [0, 30, 720, 1440, 2880, 5760, 10080, 21600];

export function useStorage() {
  const sentences = ref<SentenceItem[]>([]);
  const repositories = ref<Repository[]>([]);
  const settings = ref<AppSettings>({ ...DEFAULT_SETTINGS });
  const reviewLogs = ref<ReviewLog[]>([]);

  /**
   * 1. 初始化并加载所有数据
   */
  const loadData = () => {
    try {
      const dataStr = localStorage.getItem(STORAGE_KEY);
      const defaultRepo: Repository = {
        id: 'default',
        name: '默认仓库',
        createdAt: Date.now(),
        isSystem: true
      };

      if (dataStr) {
        const parsed = JSON.parse(dataStr);
        if (Array.isArray(parsed)) {
          // 老版本兼容逻辑：原本是句子数组
          sentences.value = parsed.map(item => ({ ...item, repoId: 'default' }));
          repositories.value = [defaultRepo];
          saveData(); // 立即写回新版格式
        } else if (parsed && typeof parsed === 'object') {
          // 新版本格式
          sentences.value = parsed.sentences || [];
          repositories.value = parsed.repositories || [defaultRepo];
          
          // 兜底：如果新版本中没有默认仓库，强行加入
          if (!repositories.value.some(r => r.id === 'default')) {
            repositories.value.unshift(defaultRepo);
          }
        } else {
          sentences.value = [];
          repositories.value = [defaultRepo];
        }
      } else {
        sentences.value = [];
        repositories.value = [defaultRepo];
      }
    } catch (e) {
      console.error('加载本地句子数据失败:', e);
      sentences.value = [];
      repositories.value = [{
        id: 'default',
        name: '默认仓库',
        createdAt: Date.now(),
        isSystem: true
      }];
    }

    try {
      const logsStr = localStorage.getItem('eapp_review_history');
      if (logsStr) {
        reviewLogs.value = JSON.parse(logsStr);
      } else {
        reviewLogs.value = [];
      }
    } catch (e) {
      console.error('加载本地复习历史失败:', e);
      reviewLogs.value = [];
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
      const exportObj: StorageData = {
        version: 2,
        repositories: repositories.value,
        sentences: sentences.value
      };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(exportObj));
    } catch (e) {
      console.error('保存句子数据失败:', e);
    }

    try {
      localStorage.setItem('eapp_review_history', JSON.stringify(reviewLogs.value));
    } catch (e) {
      console.error('保存复习历史失败:', e);
    }
  };

  /**
   * 5. 添加新句子
   */
  const addSentence = (
    text: string,
    translation: string,
    phonetics: string,
    words: WordDetail[],
    repoId: string = 'default'
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
      nextReviewTime: Date.now(), // 新增的句子默认立即需要学习/复习
      repoId
    };

    sentences.value.unshift(newItem); // 插入到最前
    saveData();
    return newItem;
  };

  /**
   * 5.1 创建新仓库
   */
  const createRepository = (name: string, description?: string): Repository => {
    const newRepo: Repository = {
      id: 'repo_' + Date.now().toString(36) + Math.random().toString(36).substr(2, 5),
      name: name.trim(),
      createdAt: Date.now(),
      description
    };
    repositories.value.push(newRepo);
    saveData();
    return newRepo;
  };

  /**
   * 5.2 删除仓库
   * @param repoId 仓库ID
   * @param deleteSentences 是否同时删除仓库下的句子。若为 false，则将句子转移到 'default' 默认仓库下
   */
  const deleteRepository = (repoId: string, deleteSentences: boolean = false) => {
    if (repoId === 'default') return; // 默认仓库不允许删除
    
    // 删除仓库定义
    repositories.value = repositories.value.filter(r => r.id !== repoId);
    
    if (deleteSentences) {
      // 同时删除底下的所有句子
      sentences.value = sentences.value.filter(s => s.repoId !== repoId);
    } else {
      // 否则将句子搬到默认仓库
      sentences.value = sentences.value.map(s => {
        if (s.repoId === repoId) {
          return { ...s, repoId: 'default' };
        }
        return s;
      });
    }
    saveData();
  };

  /**
   * 5.3 重命名仓库
   */
  const renameRepository = (repoId: string, newName: string, description?: string) => {
    if (repoId === 'default') return; // 默认仓库不可重命名
    const repo = repositories.value.find(r => r.id === repoId);
    if (repo) {
      repo.name = newName.trim();
      if (description !== undefined) {
        repo.description = description;
      }
      saveData();
    }
  };

  /**
   * 5.4 批量将句子移动至指定仓库
   */
  const moveSentencesToRepository = (sentenceIds: string[], targetRepoId: string) => {
    sentences.value = sentences.value.map(s => {
      if (sentenceIds.includes(s.id)) {
        return { ...s, repoId: targetRepoId };
      }
      return s;
    });
    saveData();
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

    // 记录复习打卡历史
    reviewLogs.value.push({
      sentenceId: id,
      timestamp: Date.now(),
      remembered: isRemembered
    });
    // 限制最大长度为 3000 条
    if (reviewLogs.value.length > 3000) {
      reviewLogs.value.shift();
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
      const exportObj: StorageData = {
        version: 2,
        repositories: repositories.value,
        sentences: sentences.value
      };
      const dataStr = JSON.stringify(exportObj, null, 2);
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
            // 兼容导入旧版本的扁平句子数组
            const isValid = imported.every(item => item.id && item.text && item.translation);
            if (isValid) {
              sentences.value = imported.map(item => ({ ...item, repoId: 'default' }));
              repositories.value = [{
                id: 'default',
                name: '默认仓库',
                createdAt: Date.now(),
                isSystem: true
              }];
              saveData();
              resolve(true);
              return;
            }
          } else if (imported && typeof imported === 'object') {
            // 新版 StorageData 格式
            const isValid = Array.isArray(imported.sentences) && 
                            imported.sentences.every((item: any) => item.id && item.text && item.translation);
            if (isValid) {
              sentences.value = imported.sentences;
              repositories.value = imported.repositories || [{
                id: 'default',
                name: '默认仓库',
                createdAt: Date.now(),
                isSystem: true
              }];
              
              // 兜底：如果缺少默认仓库，则强行加入
              if (!repositories.value.some(r => r.id === 'default')) {
                repositories.value.unshift({
                  id: 'default',
                  name: '默认仓库',
                  createdAt: Date.now(),
                  isSystem: true
                });
              }
              
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
    repositories,
    settings,
    reviewLogs,
    loadData,
    loadSettings,
    saveSettings,
    addSentence,
    createRepository,
    deleteRepository,
    renameRepository,
    moveSentencesToRepository,
    deleteSentence,
    updateReviewProgress,
    toggleStatus,
    exportData,
    importData,
    saveData
  };
}
