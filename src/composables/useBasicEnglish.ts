import { ref } from 'vue';
import { invoke, Channel } from '@tauri-apps/api/core';
import type { AppSettings } from './useStorage';
import basicDictData from '../assets/basic_english_850.json';

export interface BasicWordInfo {
  word: string;
  category: string;
  category_old?: string;
  phonetic_us: string;
  phonetic_uk: string;
  explain: string;
  explain_en?: string;
  example?: string;
  example_zh?: string;
  synonyms?: string[];
  core_concept?: string;
}

export interface ChallengeQuestion {
  id: number;
  type: 'blocks' | 'rewrite';
  chinese: string;
  target: string;       // 目标英文句子
  words: string[];      // 用于积木的正确单词列表
  distractors: string[]; // 干扰词列表
  prompt?: string;      // 改写挑战的贴士/提示
  acceptable?: string[]; // 改写挑战的备选可接受答案
}

// 单词词库映射
export const basicDict = basicDictData as Record<string, BasicWordInfo>;

// 18个万能核心动词列表
export const coreVerbs = [
  "be", "come", "do", "get", "give", "go", "have", "keep", "let", 
  "make", "may", "put", "seem", "say", "see", "send", "take", "will"
];

// 不规则动词与常见变形向原型的映射字典
const IRREGULAR_MAP: Record<string, string> = {
  // be 动词
  "am": "be", "is": "be", "are": "be", "was": "be", "were": "be", "been": "be", "being": "be",
  // 18个核心动词的变形
  "came": "come", "got": "get", "gotten": "get", "getting": "get", "gave": "give", "given": "give",
  "went": "go", "gone": "go", "going": "go", "kept": "keep", "letting": "let", "made": "make",
  "making": "make", "putt": "put", "putting": "put", "seemed": "seem", "took": "take", "taken": "take",
  "taking": "take", "did": "do", "done": "do", "doing": "do", "had": "have", "having": "have",
  "said": "say", "saying": "say", "saw": "see", "seen": "see", "seeing": "see", "sent": "send",
  "sending": "send", "would": "will",
  // 850词表内其他不规则词的常见变形还原
  "wrote": "write", "written": "write", "writing": "write",
  "broke": "break", "broken": "break", "breaking": "break",
  "blew": "blow", "blown": "blow", "blowing": "blow",
  "built": "build", "building": "build",
  "burnt": "burn", "burning": "burn",
  "bought": "buy", "buying": "buy",
  "caught": "catch", "catching": "catch",
  "chose": "choose", "chosen": "choose", "choosing": "choose",
  "drew": "draw", "drawn": "draw", "drawing": "draw",
  "drank": "drink", "drunk": "drink", "drinking": "drink",
  "drove": "drive", "driven": "drive", "driving": "drive",
  "ate": "eat", "eaten": "eat", "eating": "eat",
  "fell": "fall", "fallen": "fall", "falling": "fall",
  "fought": "fight", "fighting": "fight",
  "flew": "fly", "flown": "fly", "flying": "fly",
  "forgot": "forget", "forgotten": "forget", "forgetting": "forget",
  "grew": "grow", "grown": "grow", "growing": "grow",
  "hung": "hang", "hanging": "hang",
  "knew": "know", "known": "know", "knowing": "know",
  "read": "read", "reading": "read",
  "ran": "run", "running": "run",
  "shook": "shake", "shaken": "shake", "shaking": "shake",
  "slept": "sleep", "sleeping": "sleep",
  "spoke": "speak", "spoken": "speak", "speaking": "speak",
  "stood": "stand", "standing": "stand",
  "swam": "swim", "swimming": "swim",
  "thought": "thought", // thought 在 850 中有名词词性
  "wore": "wear", "worn": "wear", "wearing": "wear",
  "felt": "feel", "feeling": "feel"
};

/**
 * 判断一个单词是否在 Basic English 850 词库内 (支持词形还原)
 */
export function isBasicWord(word: string): boolean {
  const clean = word.toLowerCase().trim().replace(/[^a-z]/g, '');
  if (!clean) return true; // 忽略标点符号和空格
  
  // 1. 直接匹配原型
  if (basicDict[clean]) return true;
  
  // 2. 不规则词汇变形匹配
  if (IRREGULAR_MAP[clean]) {
    const stem = IRREGULAR_MAP[clean];
    if (basicDict[stem]) return true;
  }
  
  // 3. 常见词缀规则还原尝试
  const stems: string[] = [];
  
  // a) 复数/单三后缀 -s/-es
  if (clean.endsWith('s')) {
    stems.push(clean.slice(0, -1)); // cats -> cat
    if (clean.endsWith('es')) {
      stems.push(clean.slice(0, -2)); // boxes -> box
    }
    if (clean.endsWith('ies')) {
      stems.push(clean.slice(0, -3) + 'y'); // flies -> fly
    }
  }
  
  // b) 动词过去式 -ed
  if (clean.endsWith('ed')) {
    stems.push(clean.slice(0, -2)); // played -> play
    stems.push(clean.slice(0, -1)); // loved -> love (只去d)
    if (clean.endsWith('ied')) {
      stems.push(clean.slice(0, -3) + 'y'); // studied -> study
    }
  }
  
  // c) 动词现在分词 -ing
  if (clean.endsWith('ing')) {
    stems.push(clean.slice(0, -3)); // going -> go
    stems.push(clean.slice(0, -3) + 'e'); // making -> make
    // 双写辅音还原，如 running -> run (辅音去重)
    const withoutIng = clean.slice(0, -3);
    if (withoutIng.length > 2 && withoutIng[withoutIng.length - 1] === withoutIng[withoutIng.length - 2]) {
      stems.push(withoutIng.slice(0, -1));
    }
  }
  
  // d) 副词后缀 -ly
  if (clean.endsWith('ly')) {
    stems.push(clean.slice(0, -2)); // sadly -> sad
    if (clean.endsWith('ily')) {
      stems.push(clean.slice(0, -3) + 'y'); // happily -> happy
    }
  }

  // 逐一与词典比对
  return stems.some(stem => basicDict[stem]);
}

/**
 * 校验一句完整英文句子是否 100% 由 Basic English 850 词汇组成
 * 返回包含的非 Basic 单词列表 (超纲词)
 */
export function checkSentenceBasicWords(sentence: string): string[] {
  // 利用正则切词
  const words = sentence.match(/\b[a-zA-Z']+\b/g) || [];
  const advancedWords: string[] = [];
  
  for (const w of words) {
    // 过滤掉常用极简代词变形（如 us, me, our 等不在 Ogden 850 主表但属于基础代词分类）
    const lower = w.toLowerCase();
    if (["me", "my", "myself", "we", "us", "our", "ours", "ourselves", "you", "your", "yours", "yourself", "yourselves", "he", "him", "his", "himself", "she", "her", "hers", "herself", "it", "its", "itself", "they", "them", "their", "theirs", "themselves"].includes(lower)) {
      continue;
    }
    
    if (!isBasicWord(w)) {
      advancedWords.push(w);
    }
  }
  
  // 去重返回
  return Array.from(new Set(advancedWords));
}

export function useBasicEnglish() {
  const loading = ref(false);
  const questions = ref<ChallengeQuestion[]>([]);
  const currentQuestionIndex = ref(0);
  
  // 流式思考过程文本
  const aiReasoningText = ref('');
  // 流式主干 JSON 数据文本
  const aiContentText = ref('');

  /**
   * 通过 Rust 代理，调用私域大模型 API 批量生成关卡题目
   */
  const fetchAiChallenges = async (theme: string, settings: AppSettings): Promise<boolean> => {
    if (!settings.aiEndpoint) {
      throw new Error('请先在「系统设置」中配置您的私域大模型 API Endpoint！');
    }

    loading.value = true;
    aiReasoningText.value = '';
    aiContentText.value = '';
    
    // 构建系统提示词，强制大模型必须生成符合格式的 JSON 并限制 850 词汇
    const systemPrompt = `你是一个资深的 Basic English（基本英语）教学助教。你必须非常熟悉由 C.K.Ogden 定义的 850 个基本单词。
你的任务是为用户生成 3 道关于【\${theme || '日常沟通'\}】主题的造句练习题。

【题型约束】
请生成两种题型：
1. "blocks"（积木组句）：给出一个中文意思，要求用户将打乱的单词块拼成一句话。目标英文句子（target）必须完全且只能使用 Basic English 850 单词。
2. "rewrite"（改写挑战）：给出一句包含高级词汇的英文句子（original），引导用户将其改写为纯 Basic English 的句子（target）。例如把 delay 改写成 put off。

【出题约束】
1. target 目标英语句子必须完全只使用 Basic English 850 个基本词汇。
2. 语法必须完全正确，结构符合地道口语习惯。
3. "words" 数组是 target 句子中所有单词的拆解（单词的大小写和顺序需与 target 句吻合，不含标点符号）。
4. "distractors" 数组必须是 3 个与主题相关、但不在 target 句子中的其他 Basic English 850 单词。
5. "prompt" 仅用于 "rewrite" 题型，用于提醒用户可以使用哪个核心动词和介词。
6. "acceptable" 仅用于 "rewrite" 题型，提供 2-3 个同样正确的可接受 Basic English 答案。

请必须只返回以下 JSON 数组格式，不要包含任何 markdown 标记（不要用 \`\`\`json 开头）和任何多余字符：
[
  {
    "id": 1,
    "type": "blocks",
    "chinese": "中文解释",
    "target": "英文目标句子",
    "words": ["word1", "word2", ...],
    "distractors": ["distractor1", "distractor2", ...]
  },
  {
    "id": 2,
    "type": "rewrite",
    "chinese": "中文解释",
    "prompt": "提示说明（如：可以用核心动词 put 和方向词搭配）",
    "original": "原句（包含高级词汇）",
    "target": "基本英语改写后的目标句",
    "words": [],
    "distractors": [],
    "acceptable": ["答案A", "答案B"]
  }
]`;

    const prompt = `请生成 3 道与主题【\${theme || '日常沟通'\}】相关的练习题，包含 blocks 和 rewrite 题型。`;

    try {
      const channel = new Channel<string>();
      
      // 监听后端发回的每一个 delta 数据帧
      channel.onmessage = (deltaStr) => {
        try {
          const delta = JSON.parse(deltaStr);
          if (delta.reasoning_content) {
            aiReasoningText.value += delta.reasoning_content;
          }
          if (delta.content) {
            aiContentText.value += delta.content;
          }
        } catch {
          // 忽略流中单个非完整分片 JSON 错误
        }
      };

      // 触发后端的流式请求转发指令
      await invoke('call_private_ai_stream', {
        endpoint: settings.aiEndpoint,
        apiKey: settings.aiApiKey || '',
        model: settings.aiModel || 'gpt-4o-mini',
        prompt: prompt,
        systemPrompt: systemPrompt,
        onEvent: channel
      });

      // 流式读取完成后，在前端解析完整的 JSON 题包
      const rawText = aiContentText.value.trim();
      const cleanJson = rawText.replace(/\`\`\`json|\`\`\`/g, '').trim();
      
      if (!cleanJson) {
        throw new Error('大模型未能返回有效的题包数据内容，请尝试更换大模型或重试！');
      }

      const parsed = JSON.parse(cleanJson);
      
      if (Array.isArray(parsed) && parsed.length > 0) {
        questions.value = parsed.map((q: any, index: number) => ({
          id: q.id || index + 1,
          type: q.type || 'blocks',
          chinese: q.chinese || '暂无翻译',
          target: q.target || '',
          words: q.words || [],
          distractors: q.distractors || [],
          prompt: q.prompt || '',
          acceptable: q.acceptable || [q.target]
        }));
        currentQuestionIndex.value = 0;
        loading.value = false;
        return true;
      }
      
      loading.value = false;
      return false;
    } catch (e: any) {
      loading.value = false;
      console.error('流式 AI 出题请求失败:', e);
      throw new Error(e.toString() || 'AI 出题失败，请检查 API 参数配置。');
    }
  };

  return {
    loading,
    questions,
    currentQuestionIndex,
    aiReasoningText,
    aiContentText,
    fetchAiChallenges
  };
}
