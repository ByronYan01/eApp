/**
 * 有道词典 API 服务
 * 提供整句翻译、单词释义与音标查询功能 (已重构为通过 Tauri Rust 后端代理发送请求以规避跨域拦截)
 */
import { invoke } from '@tauri-apps/api/core';
import { eudicService } from './eudic';

/**
 * 清理单词，去除首尾标点符号，便于精准查词
 */
function cleanWord(word: string): string {
  return word.replace(/^[^a-zA-Z]+|[^a-zA-Z]+$/g, '').toLowerCase();
}

/**
 * 1. 整句翻译服务 (调用 Rust 后端代理)
 */
export async function translateSentence(sentence: string, provider: string = 'google', timeoutMs: number = 5000): Promise<string> {
  try {
    // 调用 Rust 端已注册的 translate_sentence_backend 命令并传递翻译服务商及超时参数
    const result = await invoke<string>('translate_sentence_backend', { 
      sentence: sentence.trim(),
      provider,
      timeoutMs
    });
    return result;
  } catch (error) {
    console.error('整句翻译失败，使用备用离线提示:', error);
    return '翻译获取失败，请检查网络连接';
  }
}

/**
 * 2. 单个单词的音标与释义获取 (调用 Rust 后端代理，并结合前端全局设置进行口音及降级筛选)
 */
export async function getWordDetail(
  word: string,
  settings?: { 
    phoneticAccent: 'US' | 'UK'; 
    allowPhoneticFallback: boolean;
    dictionaryProvider?: 'youdao' | 'eudic';
    eudicToken?: string;
  }
): Promise<{ phonetic: string; explain: string }> {
  const target = cleanWord(word);
  if (!target) {
    return { phonetic: '', explain: '' };
  }
  
  const provider = settings?.dictionaryProvider || 'youdao';
  const token = settings?.eudicToken || '';
  
  // 如果锁定了“欧路词典”且已配置有效的 API Token，则调用欧路开放查词接口进行强力解析
  if (provider === 'eudic' && token.trim()) {
    try {
      eudicService.setToken(token);
      const eudicResult = await eudicService.searchWord(target);
      if (eudicResult) {
        return {
          phonetic: eudicResult.phonetic ? `[${eudicResult.phonetic}]` : '',
          explain: eudicResult.translation || '暂无释义'
        };
      }
    } catch (e) {
      console.warn(`欧路词典查词失败，将自动降级使用有道词典: ${target}`, e);
    }
  }
  
  // 默认配置兜底 (若未传入配置，默认开启美音和降级)
  const accent = settings?.phoneticAccent || 'US';
  const allowFallback = settings?.allowPhoneticFallback !== false;
  
  try {
    // 调用 Rust 端已重构的 get_word_detail_backend 命令，获取三种口音音标
    const detail = await invoke<{
      us_phonetic: string;
      uk_phonetic: string;
      phone_phonetic: string;
      explain: string;
    }>('get_word_detail_backend', { word: target });

    let finalPhonetic = '';

    if (accent === 'US') {
      if (detail.us_phonetic) {
        finalPhonetic = detail.us_phonetic;
      } else if (allowFallback) {
        // 允许降级兜底：美音 ➔ 英音 ➔ 通用
        finalPhonetic = detail.uk_phonetic || detail.phone_phonetic || '';
      } else {
        // 禁止降级：如果找不到美音音标，则明确标示无美音
        finalPhonetic = '无美音';
      }
    } else {
      // 英音 (UK) 口音首选
      if (detail.uk_phonetic) {
        finalPhonetic = detail.uk_phonetic;
      } else if (allowFallback) {
        // 允许降级兜底：英音 ➔ 美音 ➔ 通用
        finalPhonetic = detail.us_phonetic || detail.phone_phonetic || '';
      } else {
        // 禁止降级：如果找不到英音音标，则明确标示无英音
        finalPhonetic = '无英音';
      }
    }

    // 格式化输出音标，确保整体显示规范
    const formattedPhonetic = finalPhonetic 
      ? (finalPhonetic.startsWith('[') || finalPhonetic.endsWith(']') ? finalPhonetic : `[${finalPhonetic}]`)
      : '';

    return {
      phonetic: formattedPhonetic,
      explain: detail.explain
    };
  } catch (error) {
    console.error(`查询单词 ${target} 失败:`, error);
    return { phonetic: '', explain: '查询失败' };
  }
}

/**
 * 3. 句子分词解析服务
 * 输入一个整句，自动按空格切分单词，去除标点，并发去查词，返回带有每个词音标和释义的单词列表
 */
export interface WordParsed {
  original: string; // 句中原样单词 (包含标点，如 "hello,")
  clean: string;    // 去除标点后的单词 ("hello")
  phonetic: string; // 音标 "['hələʊ]"
  explain: string;  // 释义 "int. 喂；哈罗"
}

export async function parseSentenceWords(
  sentence: string,
  settings?: { 
    phoneticAccent: 'US' | 'UK'; 
    allowPhoneticFallback: boolean;
    dictionaryProvider?: 'youdao' | 'eudic';
    eudicToken?: string;
  }
): Promise<WordParsed[]> {
  if (!sentence.trim()) return [];
  
  // 按照空白字符分词
  const words = sentence.trim().split(/\s+/);
  
  // 并发查询每个单词的详细音标和解释，提升加载速度
  const promises = words.map(async (word) => {
    const clean = cleanWord(word);
    if (!clean) {
      return {
        original: word,
        clean: '',
        phonetic: '',
        explain: ''
      };
    }
    
    // 传入 settings 以应用个性化音标策略
    const detail = await getWordDetail(clean, settings);
    return {
      original: word,
      clean,
      phonetic: detail.phonetic,
      explain: detail.explain
    };
  });
  
  return Promise.all(promises);
}
