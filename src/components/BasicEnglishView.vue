<template>
  <div class="basic-container">
    <!-- 头部卡片，展示模块定位 -->
    <div class="glass-header">
      <div class="header-content">
        <h2 class="title">🧩 Basic English 极简表达特训营</h2>
        <p class="subtitle">基于 C.K.Ogden 的 850 个核心词汇与 18 个万能动词，抛弃冗余词典，实现无门槛造句与流畅沟通。</p>
      </div>
      <div class="tab-selectors">
        <button 
          class="subtab-btn" 
          :class="{ 'active': activeSubTab === 'directory' }"
          @click="activeSubTab = 'directory'"
        >
          📖 850词总览
        </button>
        <button 
          class="subtab-btn" 
          :class="{ 'active': activeSubTab === 'sandbox' }"
          @click="activeSubTab = 'sandbox'"
        >
          🧱 万能积木造句
        </button>
      </div>
    </div>

    <!-- 主面板内容区 -->
    <div class="main-panel">
      <!-- 视图A: 850词总览 -->
      <div v-if="activeSubTab === 'directory'" class="directory-view">
        <div class="filter-bar">
          <div class="search-box">
            <span class="search-icon">🔍</span>
            <input 
              v-model="searchQuery" 
              type="text" 
              placeholder="搜索单词、中文、英文释义或同义代换词..."
              class="search-input"
            />
            <button v-if="searchQuery" class="clear-btn" @click="searchQuery = ''">×</button>
          </div>
          <div class="category-pills">
            <button 
              v-for="pill in categoryPills" 
              :key="pill.id"
              class="pill-btn"
              :class="{ 'active': categoryFilter === pill.id }"
              :data-cat="pill.id"
              @click="categoryFilter = pill.id"
            >
              {{ pill.name }} <span class="pill-count" v-if="pill.count">({{ pill.count }})</span>
            </button>
          </div>
        </div>

        <div class="word-list-container">
          <div v-if="filteredWords.length === 0" class="empty-results">
            <span class="empty-icon">📂</span>
            <p>未找到符合条件的单词，请换个关键词试试。</p>
          </div>
          
          <div v-else class="word-grid">
            <div 
              v-for="wordObj in filteredWords" 
              :key="wordObj.word"
              class="word-card"
              :class="{ 'expanded': expandedWords.has(wordObj.word), 'core-verb-card': isWordCoreVerb(wordObj.word) }"
              :data-cat="wordObj.category"
              @click="toggleWordExpand(wordObj.word)"
            >
              <div class="card-header">
                <div class="word-info-col">
                  <span class="word-text">{{ wordObj.word }}</span>
                  <span v-if="isWordCoreVerb(wordObj.word)" class="core-tag">🔑 18核心</span>
                  <span class="cat-badge-label" :class="wordObj.category">{{ wordObj.category.toUpperCase() }}</span>
                </div>
                <div class="speaker-actions" @click.stop>
                  <!-- 根据首选口音自动显示与发音 -->
                  <button 
                    class="speak-btn" 
                    @click="playWord(wordObj.word, storage.settings.value.phoneticAccent || 'US')" 
                    :title="(storage.settings.value.phoneticAccent === 'UK' ? '英音' : '美音') + '发音'"
                  >
                    🔊 {{ storage.settings.value.phoneticAccent === 'UK' ? 'UK' : 'US' }}
                  </button>
                </div>
              </div>
              
              <!-- 展开显示详情 -->
              <transition name="slide-fade">
                <div v-if="expandedWords.has(wordObj.word)" class="card-details" @click.stop>
                  <!-- 音标与发音 -->
                  <div class="detail-row phonetics-row">
                    <div class="phonetics">
                      <span class="phonetic-label" v-if="storage.settings.value.phoneticAccent === 'US' || !storage.settings.value.phoneticAccent">美 [{{ wordObj.phonetic_us }}]</span>
                      <span class="phonetic-label" v-if="storage.settings.value.phoneticAccent === 'UK'">英 [{{ wordObj.phonetic_uk }}]</span>
                    </div>
                  </div>

                  <!-- 英文解释 -->
                  <div class="detail-row explain-en-row" v-if="wordObj.explain_en">
                    <span class="detail-label">Definition 英文释义</span>
                    <p class="explain-en-text">“{{ wordObj.explain_en }}”</p>
                  </div>

                  <!-- 中文解释 -->
                  <div class="detail-row explain-zh-row">
                    <span class="detail-label">中文释义</span>
                    <p class="explain-zh-text">{{ wordObj.explain }}</p>
                  </div>

                  <!-- 核心空间妙用 -->
                  <div class="detail-row core-concept-row" v-if="wordObj.core_concept">
                    <span class="detail-label">Core 核心妙用</span>
                    <div class="concept-box">
                      <strong>💡 物理空间逻辑：</strong>
                      <span>{{ wordObj.core_concept }}</span>
                    </div>
                  </div>

                  <!-- 官方标准短句例句 -->
                  <div class="detail-row example-row" v-if="wordObj.example">
                    <span class="detail-label">Example 例句</span>
                    <div class="example-box">
                      <div class="example-en-flow">
                        <button class="speak-inline-btn" @click="playSentence(wordObj.example)" title="播放例句发音">🔊</button>
                        <InteractiveSentence 
                          :words="parseExampleToInteractiveWords(wordObj.example)" 
                          font-size="0.85rem"
                          compact
                          @play-word-audio="playWord"
                        />
                      </div>
                      <p class="example-zh">{{ wordObj.example_zh }}</p>
                    </div>
                  </div>

                  <!-- 同义词代换 -->
                  <div class="detail-row synonyms-row" v-if="wordObj.synonyms && wordObj.synonyms.length > 0">
                    <span class="detail-label">Synonyms 化繁为简代换</span>
                    <div class="syn-tags">
                      <button 
                        v-for="syn in wordObj.synonyms" 
                        :key="syn" 
                        class="syn-tag-btn"
                        :class="{ 'active': activeSynonymCompare.word === wordObj.word && activeSynonymCompare.syn === syn }"
                        @click="toggleSynonymCompare(wordObj.word, syn)"
                      >
                        {{ syn }}
                      </button>
                    </div>
                    
                    <!-- 同义词对比面板 -->
                    <transition name="slide-fade">
                      <div 
                        v-if="activeSynonymCompare.word === wordObj.word && activeSynonymCompare.info" 
                        class="syn-compare-panel"
                      >
                        <div class="compare-header">
                          <span class="compare-title">{{ activeSynonymCompare.syn }}</span>
                          <span class="vs-label">vs</span>
                          <span class="compare-main">{{ wordObj.word }}</span>
                          <span class="compare-badge">近义词对比</span>
                        </div>
                        <div class="compare-body">
                          <div class="compare-item" v-if="activeSynonymCompare.info.def">
                            <span class="item-label">高级词释义</span>
                            <span class="item-val">{{ activeSynonymCompare.info.def }}</span>
                          </div>
                          <div class="compare-item" v-if="activeSynonymCompare.info.vs">
                            <span class="item-label">核心区别</span>
                            <span class="item-val">{{ activeSynonymCompare.info.vs }}</span>
                          </div>
                          <div class="compare-item" v-if="activeSynonymCompare.info.use">
                            <span class="item-label">场景例句</span>
                            <div class="compare-val-flow">
                              <button class="speak-inline-btn" @click="playSentence(extractEnglishSentence(activeSynonymCompare.info.use))" title="播放例句发音">🔊</button>
                              <InteractiveSentence 
                                :words="parseExampleToInteractiveWords(extractEnglishSentence(activeSynonymCompare.info.use))" 
                                font-size="0.75rem"
                                compact
                                @play-word-audio="playWord"
                              />
                            </div>
                          </div>
                        </div>
                      </div>
                    </transition>
                  </div>
                </div>
              </transition>
            </div>
          </div>
        </div>
      </div>

      <!-- 视图B: 万能积木造句 -->
      <div v-else-if="activeSubTab === 'sandbox'" class="sandbox-view">
        <!-- 阶段一：出题前的场景选择 -->
        <div v-if="questions.length === 0 && !loading" class="setup-area">
          <div class="setup-card">
            <h3>选择一个场景生成造句挑战</h3>
            <p>AI 将会为您智能编写完全符合 Basic English 850 范围内的口语及改写练习。</p>
            
            <div class="theme-presets">
              <button 
                v-for="theme in themePresets" 
                :key="theme"
                class="theme-preset-btn"
                @click="generateChallengesWithTheme(theme)"
              >
                {{ theme }}
              </button>
            </div>

            <div class="custom-theme-row">
              <input 
                v-model="customTheme" 
                type="text" 
                placeholder="输入您自定义的主题（如：海边度假、商务会议）..."
                class="custom-theme-input"
                @keyup.enter="generateChallengesWithTheme(customTheme)"
              />
              <button 
                class="generate-btn" 
                :disabled="!customTheme.trim()"
                @click="generateChallengesWithTheme(customTheme)"
              >
                🚀 生成专属练习
              </button>
            </div>
          </div>
        </div>

        <!-- 阶段二：Loading 态 (真·大模型流式思考呈现) -->
        <div v-else-if="loading" class="loading-state stream-loading">
          <div class="loader-spinner"></div>
          <h4>AI 助教正在实时思考和出题中...</h4>
          <p class="loading-hint">支持深度推理的私域大模型正在执行题包设计与 JSON 结构化装配</p>
          
          <div class="stream-panel-container">
            <!-- 1. 深度思考流 (Reasoning) -->
            <div v-if="aiReasoningText" class="stream-sub-panel reasoning">
              <div class="stream-panel-title">🧠 大模型推理思考过程 (Reasoning Flow)</div>
              <div class="stream-content-box" ref="reasoningBoxRef">
                <div class="reasoning-text-flow">{{ aiReasoningText }}</div>
              </div>
            </div>
            
            <!-- 2. JSON 正文数据流 (Content) -->
            <div v-if="aiContentText" class="stream-sub-panel content">
              <div class="stream-panel-title">🧱 题包数据构造 JSON (Content Flow)</div>
              <div class="stream-content-box code-box" ref="contentBoxRef">
                <pre class="json-text-flow"><code>{{ aiContentText }}</code></pre>
              </div>
            </div>
          </div>
        </div>

        <!-- 阶段三：答题中 -->
        <div v-else-if="questions.length > 0" class="game-area">
          <div class="game-header-row">
            <span class="game-progress">第 {{ currentQuestionIndex + 1 }} / {{ questions.length }} 题</span>
            <button class="quit-btn" @click="resetToSetup">🚪 退出本轮</button>
          </div>

          <div class="question-card" :class="{ 'shake-err': showShakeError }">
            <div class="card-tag">
              {{ currentQuestion.type === 'blocks' ? '🧱 单词积木组句' : '✍️ 核心改写挑战' }}
            </div>
            
            <h3 class="chinese-instruction">请表达：“{{ currentQuestion.chinese }}”</h3>
            
            <div v-if="currentQuestion.type === 'rewrite'" class="original-box">
              <span class="box-label">常规英语表达 (含超纲词)：</span>
              <p class="original-sentence">“ {{ currentQuestion.original }} ”</p>
              <div v-if="currentQuestion.prompt" class="prompt-tip">
                💡 <strong>提示：</strong>{{ currentQuestion.prompt }}
              </div>
            </div>

            <!-- A. 积木题型界面 -->
            <div v-if="currentQuestion.type === 'blocks'" class="interactive-blocks-pane">
              <!-- 拼接答案区 -->
              <div class="answer-zone" :class="{ 'empty': selectedWords.length === 0 }">
                <template v-if="selectedWords.length > 0">
                  <button 
                    v-for="(w, idx) in selectedWords" 
                    :key="idx"
                    class="block-pill selected"
                    @click="deselectWord(idx)"
                    title="点击移回"
                  >
                    {{ w }}
                  </button>
                </template>
                <div v-else class="answer-placeholder">
                  【请点击下方单词积木，按语序在此拼接句子】
                </div>
              </div>

              <!-- 下方备选单词池 -->
              <div class="pool-zone">
                <button 
                  v-for="(w, idx) in poolWords" 
                  :key="idx"
                  class="block-pill pool"
                  @click="selectWord(idx)"
                >
                  {{ w }}
                </button>
              </div>
            </div>

            <!-- B. 改写题型界面 -->
            <div v-else-if="currentQuestion.type === 'rewrite'" class="interactive-rewrite-pane">
              <input 
                v-model="userWrittenAnswer" 
                type="text" 
                placeholder="在此处打字输入您的 Basic English 改写句子..."
                class="write-input"
                :disabled="showFeedback"
                @keyup.enter="handleCheckAnswer"
              />
              
              <!-- 实时超纲词提示 -->
              <div v-if="advancedWordsWarning.length > 0" class="advanced-warning">
                ⚠️ <strong>发现超纲单词：</strong>
                <span v-for="w in advancedWordsWarning" :key="w" class="warn-word-tag">{{ w }}</span>
                <p class="warn-tip">（基本英语不推荐使用此词，请尝试用 18 个核心动词配合介词来表达。）</p>
              </div>
            </div>

            <!-- 反馈区域 -->
            <div v-if="showFeedback" class="feedback-panel" :class="{ 'success': answerIsCorrect, 'error': !answerIsCorrect }">
              <div class="feedback-header">
                <span class="icon">{{ answerIsCorrect ? '🎉' : '❌' }}</span>
                <h4>{{ answerIsCorrect ? '恭喜您，拼写完全正确！' : '拼写不完全一致，请再检查一下：' }}</h4>
              </div>
              <div class="feedback-body">
                <p>目标句子：<strong class="sentence-accent">{{ currentQuestion.target }}</strong></p>
                <div v-if="currentQuestion.type === 'rewrite' && currentQuestion.acceptable" class="acceptable-list">
                  <span>备选可接受的正确句型：</span>
                  <ul>
                    <li v-for="ans in currentQuestion.acceptable" :key="ans">“ {{ ans }} ”</li>
                  </ul>
                </div>
              </div>
            </div>

            <!-- 控制按钮 -->
            <div class="action-buttons-row">
              <button 
                v-if="currentQuestion.type === 'blocks' && !showFeedback" 
                class="btn reset"
                @click="resetCurrentQuestion"
              >
                🔄 重置
              </button>
              
              <button 
                v-if="!showFeedback" 
                class="btn submit"
                :disabled="isSubmitDisabled"
                @click="handleCheckAnswer"
              >
                ✔ 提交检查
              </button>

              <button 
                v-if="showFeedback" 
                class="btn next-step"
                @click="goToNextQuestion"
              >
                {{ currentQuestionIndex === questions.length - 1 ? '🎓 完成特训' : '➡️ 下一题' }}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch, nextTick } from 'vue';
import { useTTS } from '../composables/useTTS';
import { useStorage } from '../composables/useStorage';
import { 
  basicDict, 
  coreVerbs, 
  checkSentenceBasicWords, 
  useBasicEnglish 
} from '../composables/useBasicEnglish';
import synsDetailData from '../assets/syns_detail.json';
import InteractiveSentence from './InteractiveSentence.vue';

// 初始化服务与存储
const tts = useTTS();
const storage = useStorage();
storage.loadData();

const { 
  loading, 
  questions, 
  currentQuestionIndex, 
  aiReasoningText, 
  aiContentText, 
  fetchAiChallenges 
} = useBasicEnglish();

// Tab 控制
const activeSubTab = ref<'directory' | 'sandbox'>('directory');

// 1. 单词总览逻辑
const searchQuery = ref('');
const categoryFilter = ref('all');

const categoryPills = [
  { id: 'all', name: 'All · 全部', count: 850 },
  { id: 'op', name: 'Operations · 操作词', count: 100 },
  { id: 'gt', name: 'General · 通用词', count: 400 },
  { id: 'pt', name: 'Picturable · 图示词', count: 200 },
  { id: 'qg', name: 'Qualities · 性质词', count: 100 },
  { id: 'qo', name: 'Opposites · 反义对', count: 50 }
];

// 保存当前展开的单词
const expandedWords = ref<Set<string>>(new Set());

// 同义词对比响应式状态
const activeSynonymCompare = ref<{
  word: string;
  syn: string;
  info: any;
}>({
  word: '',
  syn: '',
  info: null
});

// 滚动视窗 DOM 节点引用
const reasoningBoxRef = ref<HTMLElement | null>(null);
const contentBoxRef = ref<HTMLElement | null>(null);

const isWordCoreVerb = (word: string) => {
  return coreVerbs.includes(word);
};

// 触发单词展开与收起
const toggleWordExpand = (word: string) => {
  if (expandedWords.value.has(word)) {
    expandedWords.value.delete(word);
  } else {
    expandedWords.value.add(word);
  }
  // 切换展开时清空旧的同义词对比状态
  activeSynonymCompare.value = { word: '', syn: '', info: null };
};

// 播放发音
const playWord = (word: string, accent: 'US' | 'UK') => {
  tts.play(
    word, 
    accent, 
    1.0, 
    storage.settings.value.audioPlaySource, 
    storage.settings.value.audioPlayProvider,
    storage.settings.value.audioTimeout
  );
};

// 播放长句发音
const playSentence = (sentence: string) => {
  tts.play(
    sentence, 
    storage.settings.value.phoneticAccent || 'US', 
    1.0, 
    storage.settings.value.audioPlaySource, 
    storage.settings.value.audioPlayProvider,
    storage.settings.value.audioTimeout
  );
};

// 解析例句中的英文部分
const extractEnglishSentence = (text: string) => {
  if (!text) return '';
  const m = text.match(/^([^一-鿿぀-ヿ＀-￯]+)/);
  return m ? m[1].trim() : text;
};

// 将纯文本例句拆分为支持 hover 悬浮查词的单词列表
const parseExampleToInteractiveWords = (sentenceText: string) => {
  if (!sentenceText) return [];
  
  // 按单词和非单词切分，保留所有空格和标点
  const tokens = sentenceText.match(/[a-zA-Z']+|[^a-zA-Z']+/g) || [];
  
  return tokens.map(token => {
    const isWord = /^[a-zA-Z']+$/.test(token);
    if (!isWord) {
      return {
        original: token,
        clean: '',
        phonetic: '',
        explain: ''
      };
    }
    
    const lower = token.toLowerCase();
    let matchedWordInfo = basicDict[lower] || null;
    
    // 词形还原匹配
    if (!matchedWordInfo) {
      const stems: string[] = [];
      if (lower.endsWith('s')) {
        stems.push(lower.slice(0, -1));
        if (lower.endsWith('es')) stems.push(lower.slice(0, -2));
        if (lower.endsWith('ies')) stems.push(lower.slice(0, -3) + 'y');
      }
      if (lower.endsWith('ed')) {
        stems.push(lower.slice(0, -2), lower.slice(0, -1));
        if (lower.endsWith('ied')) stems.push(lower.slice(0, -3) + 'y');
      }
      if (lower.endsWith('ing')) {
        stems.push(lower.slice(0, -3), lower.slice(0, -3) + 'e');
        const withoutIng = lower.slice(0, -3);
        if (withoutIng.length > 2 && withoutIng[withoutIng.length - 1] === withoutIng[withoutIng.length - 2]) {
          stems.push(withoutIng.slice(0, -1));
        }
      }
      if (lower.endsWith('ly')) {
        stems.push(lower.slice(0, -2));
        if (lower.endsWith('ily')) stems.push(lower.slice(0, -3) + 'y');
      }
      
      const foundStem = stems.find(stem => basicDict[stem]);
      if (foundStem) {
        matchedWordInfo = basicDict[foundStem];
      }
    }
    
    return {
      original: token,
      clean: token,
      phonetic: matchedWordInfo ? `[${matchedWordInfo.phonetic_us || matchedWordInfo.phonetic_uk}]` : '',
      explain: matchedWordInfo ? matchedWordInfo.explain : 'Basic English 850 之外的高级词汇'
    };
  });
};

// 切换同义词对比看板展示
const toggleSynonymCompare = (word: string, syn: string) => {
  if (activeSynonymCompare.value.word === word && activeSynonymCompare.value.syn === syn) {
    activeSynonymCompare.value = { word: '', syn: '', info: null };
  } else {
    const mainDetail = (synsDetailData as Record<string, any>)[word] || {};
    const info = mainDetail[syn] || null;
    activeSynonymCompare.value = {
      word,
      syn,
      info
    };
  }
};

// 单词过滤逻辑
const filteredWords = computed(() => {
  let list = Object.values(basicDict);
  
  // A. 分类过滤
  if (categoryFilter.value !== 'all') {
    list = list.filter(w => w.category === categoryFilter.value);
  }
  
  // B. 搜索词搜索
  const query = searchQuery.value.trim().toLowerCase();
  if (query) {
    list = list.filter(w => 
      w.word.toLowerCase().includes(query) || 
      w.explain.includes(query) ||
      (w.explain_en && w.explain_en.toLowerCase().includes(query)) ||
      (w.synonyms && w.synonyms.some(s => s.toLowerCase().includes(query)))
    );
  }
  
  // 按英文字母排序
  return list.sort((a, b) => a.word.localeCompare(b.word));
});

// 2. 造句特训营逻辑
const themePresets = ['☕ 咖啡厅点单', '🏥 医院看病', '✈️ 机场问路', '💼 商务会议', '🏨 酒店入住', '🛍️ 商场购物'];
const customTheme = ref('');

// 游戏过程交互状态
const poolWords = ref<string[]>([]);
const selectedWords = ref<string[]>([]);
const userWrittenAnswer = ref('');
const showFeedback = ref(false);
const answerIsCorrect = ref(false);
const showShakeError = ref(false);

const currentQuestion = computed(() => {
  return questions.value[currentQuestionIndex.value];
});

// 监听流式思考数据变化，自动置底滚动
watch(aiReasoningText, () => {
  nextTick(() => {
    if (reasoningBoxRef.value) {
      reasoningBoxRef.value.scrollTop = reasoningBoxRef.value.scrollHeight;
    }
  });
});

watch(aiContentText, () => {
  nextTick(() => {
    if (contentBoxRef.value) {
      contentBoxRef.value.scrollTop = contentBoxRef.value.scrollHeight;
    }
  });
});

// 监听题目变化并进行初始化
watch(currentQuestionIndex, () => {
  initQuestionInteraction();
}, { immediate: false });

// 监听大模型出题结果，以便初始化
watch(questions, (newVal) => {
  if (newVal.length > 0) {
    initQuestionInteraction();
  }
});

// 实时检测手写改写句子中的超纲词
const advancedWordsWarning = computed(() => {
  if (currentQuestion.value?.type !== 'rewrite') return [];
  if (!userWrittenAnswer.value.trim()) return [];
  return checkSentenceBasicWords(userWrittenAnswer.value);
});

// 是否禁用提交按钮
const isSubmitDisabled = computed(() => {
  if (!currentQuestion.value) return true;
  if (currentQuestion.value.type === 'blocks') {
    return selectedWords.value.length === 0;
  } else {
    return !userWrittenAnswer.value.trim();
  }
});

// 打乱数组函数
const shuffleArray = (arr: string[]) => {
  const result = [...arr];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
};

// 初始化题目交互
const initQuestionInteraction = () => {
  showFeedback.value = false;
  answerIsCorrect.value = false;
  showShakeError.value = false;
  selectedWords.value = [];
  userWrittenAnswer.value = '';
  
  if (!currentQuestion.value) return;

  if (currentQuestion.value.type === 'blocks') {
    // 合并正确单词与干扰词，打乱顺序
    const combined = [...currentQuestion.value.words, ...currentQuestion.value.distractors];
    poolWords.value = shuffleArray(combined);
  }
};

// 选择积木单词
const selectWord = (index: number) => {
  const word = poolWords.value[index];
  selectedWords.value.push(word);
  poolWords.value.splice(index, 1);
};

// 撤回积木单词
const deselectWord = (index: number) => {
  const word = selectedWords.value[index];
  poolWords.value.push(word);
  selectedWords.value.splice(index, 1);
};

// 重置当前题目
const resetCurrentQuestion = () => {
  initQuestionInteraction();
};

// 退出此轮挑战
const resetToSetup = () => {
  questions.value = [];
  currentQuestionIndex.value = 0;
  customTheme.value = '';
};

// 出题网络发起
const generateChallengesWithTheme = async (themeName: string) => {
  const cleanTheme = themeName.trim().replace(/[^\u4e00-\u9fa5a-zA-Z0-9]/g, ''); // 过滤表情
  const activeTheme = cleanTheme || '日常沟通';
  try {
    const success = await fetchAiChallenges(activeTheme, storage.settings.value);
    if (!success) {
      alert('AI 出题失败，未能生成有效的数据格式，请再试一次。');
    }
  } catch (e: any) {
    alert(e.message || '出题失败，请检查设置。');
  }
};

// 字符规范化，用于前端模糊比对
const normalizeSentence = (str: string) => {
  return str
    .toLowerCase()
    .replace(/[.,\/#!$%\^&\*;:{}=\-_`~()?]/g, "") // 去除标点
    .replace(/\s{2,}/g, " ")                     // 合并空格
    .trim();
};

// 提交判定
const handleCheckAnswer = () => {
  if (!currentQuestion.value) return;
  
  let isRight = false;
  
  if (currentQuestion.value.type === 'blocks') {
    const userAnswer = selectedWords.value.join(' ');
    isRight = normalizeSentence(userAnswer) === normalizeSentence(currentQuestion.value.target);
  } else {
    // 改写挑战：首先判断是否含有超纲词，如果含有超纲词，直接视为错误
    if (advancedWordsWarning.value.length > 0) {
      triggerErrorShake();
      return;
    }
    const userAns = normalizeSentence(userWrittenAnswer.value);
    const targetAns = normalizeSentence(currentQuestion.value.target);
    
    // 匹配最佳答案或备选答案列表
    isRight = (userAns === targetAns);
    if (!isRight && currentQuestion.value.acceptable) {
      isRight = currentQuestion.value.acceptable
        .map(normalizeSentence)
        .includes(userAns);
    }
  }

  showFeedback.value = true;
  answerIsCorrect.value = isRight;

  if (isRight) {
    // 发音朗读正确答案
    playWord(currentQuestion.value.target, 'US');
  } else {
    triggerErrorShake();
  }
};

// 触发摇晃震动
const triggerErrorShake = () => {
  showShakeError.value = true;
  setTimeout(() => {
    showShakeError.value = false;
  }, 600);
};

// 下一题或结束
const goToNextQuestion = () => {
  if (currentQuestionIndex.value < questions.value.length - 1) {
    currentQuestionIndex.value += 1;
  } else {
    // 完成所有关卡，结课退出
    alert('🎉 恭喜您！顺利完成了本轮 Basic English 极简造句特训！');
    resetToSetup();
  }
};
</script>

<style scoped>
.basic-container {
  display: flex;
  flex-direction: column;
  height: 100%;
  gap: 16px;
  color: var(--text-primary);
}

/* 头部毛玻璃卡片 */
.glass-header {
  background: var(--card-bg, rgba(255, 255, 255, 0.05));
  backdrop-filter: blur(20px);
  -webkit-backdrop-filter: blur(20px);
  border: 1px solid var(--border-color, rgba(255, 255, 255, 0.08));
  border-radius: 16px;
  padding: 16px 20px;
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 16px;
  flex-wrap: wrap;
}

.header-content {
  flex: 1;
  min-width: 300px;
}

.title {
  font-size: 1.4rem;
  font-weight: 700;
  margin-bottom: 4px;
  background: linear-gradient(135deg, #a78bfa 0%, #6366f1 100%);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
}

.subtitle {
  font-size: 0.85rem;
  color: var(--text-secondary);
  line-height: 1.4;
}

.tab-selectors {
  display: flex;
  background: rgba(0, 0, 0, 0.2);
  padding: 4px;
  border-radius: 8px;
  border: 1px solid rgba(255, 255, 255, 0.05);
}

.subtab-btn {
  background: transparent;
  border: none;
  color: var(--text-secondary);
  padding: 6px 16px;
  font-size: 0.85rem;
  font-weight: 600;
  border-radius: 6px;
  cursor: pointer;
  transition: all 0.2s ease;
}

.subtab-btn:hover {
  color: white;
}

.subtab-btn.active {
  background: var(--color-primary, #6366f1);
  color: white;
  box-shadow: 0 4px 12px rgba(99, 102, 241, 0.3);
}

/* 主面板 */
.main-panel {
  flex: 1;
  overflow: hidden;
  display: flex;
  flex-direction: column;
}

/* 1. 词表总览样式 */
.directory-view {
  display: flex;
  flex-direction: column;
  height: 100%;
  overflow: hidden;
  gap: 12px;
}

.filter-bar {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.search-box {
  position: relative;
  width: 100%;
}

.search-icon {
  position: absolute;
  left: 12px;
  top: 50%;
  transform: translateY(-50%);
  font-size: 0.9rem;
  opacity: 0.6;
}

.search-input {
  width: 100%;
  background: rgba(0, 0, 0, 0.2);
  border: 1px solid var(--border-color, rgba(255, 255, 255, 0.08));
  border-radius: 8px;
  padding: 10px 12px 10px 36px;
  color: white;
  font-size: 0.9rem;
  outline: none;
  transition: border-color 0.2s ease;
}

.search-input:focus {
  border-color: var(--color-primary, #6366f1);
}

.clear-btn {
  position: absolute;
  right: 12px;
  top: 50%;
  transform: translateY(-50%);
  background: transparent;
  border: none;
  color: var(--text-secondary);
  font-size: 1.2rem;
  cursor: pointer;
}

.category-pills {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  overflow-x: auto;
  padding-bottom: 2px;
}

.pill-btn {
  background: rgba(255, 255, 255, 0.03);
  border: 1px solid rgba(255, 255, 255, 0.05);
  color: var(--text-secondary);
  padding: 4px 12px;
  border-radius: 12px;
  font-size: 0.75rem;
  cursor: pointer;
  transition: all 0.2s ease;
}

.pill-btn:hover {
  background: rgba(255, 255, 255, 0.08);
  color: white;
}

/* 声明 HSL 核心分类配色并注入 active */
.pill-btn[data-cat="op"].active { background: rgba(217, 119, 6, 0.15); border-color: #d97706; color: #f59e0b; }
.pill-btn[data-cat="gt"].active { background: rgba(5, 150, 105, 0.15); border-color: #059669; color: #34d399; }
.pill-btn[data-cat="pt"].active { background: rgba(234, 179, 8, 0.15); border-color: #eab308; color: #fbbf24; }
.pill-btn[data-cat="qg"].active { background: rgba(37, 99, 235, 0.15); border-color: #2563eb; color: #60a5fa; }
.pill-btn[data-cat="qo"].active { background: rgba(168, 85, 247, 0.15); border-color: #a855f7; color: #c084fc; }

.word-list-container {
  flex: 1;
  overflow-y: auto;
  padding-right: 4px;
}

.word-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
  gap: 12px;
  padding-bottom: 20px;
}

.example-en-flow {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 4px;
}

.compare-val-flow {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 4px;
}

.word-card {
  background: rgba(255, 255, 255, 0.02);
  border: 1px solid rgba(255, 255, 255, 0.04);
  border-radius: 12px;
  padding: 12px 14px;
  cursor: pointer;
  transition: all 0.2s cubic-bezier(0.16, 1, 0.3, 1);
  display: flex;
  flex-direction: column;
  justify-content: flex-start;
  min-height: 64px;
  position: relative;
}

.word-card:hover {
  background: rgba(255, 255, 255, 0.05);
  transform: translateY(-2px);
  box-shadow: 0 6px 16px rgba(0, 0, 0, 0.25);
}

/* 单词卡片五色主题左边框 */
.word-card[data-cat="op"] { border-left: 3px solid #d97706; }
.word-card[data-cat="gt"] { border-left: 3px solid #059669; }
.word-card[data-cat="pt"] { border-left: 3px solid #eab308; }
.word-card[data-cat="qg"] { border-left: 3px solid #2563eb; }
.word-card[data-cat="qo"] { border-left: 3px solid #a855f7; }

/* 鼠标划过微光 */
.word-card[data-cat="op"]:hover { border-color: rgba(217, 119, 6, 0.4); }
.word-card[data-cat="gt"]:hover { border-color: rgba(5, 150, 105, 0.4); }
.word-card[data-cat="pt"]:hover { border-color: rgba(234, 179, 8, 0.4); }
.word-card[data-cat="qg"]:hover { border-color: rgba(37, 99, 235, 0.4); }
.word-card[data-cat="qo"]:hover { border-color: rgba(168, 85, 247, 0.4); }

.card-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  width: 100%;
}

.word-info-col {
  display: flex;
  align-items: center;
  gap: 6px;
}

.word-text {
  font-size: 1.15rem;
  font-weight: 700;
  letter-spacing: -0.01em;
  color: #f3f4f6;
}

.core-tag {
  background: rgba(139, 92, 246, 0.12);
  border: 1px solid rgba(139, 92, 246, 0.25);
  color: #c084fc;
  font-size: 0.65rem;
  padding: 1px 5px;
  border-radius: 4px;
}

/* 右侧分类小标签样式 */
.card-badges {
  display: flex;
  gap: 4px;
}

.cat-badge-label {
  font-size: 0.6rem;
  font-weight: 700;
  padding: 1px 5px;
  border-radius: 4px;
  letter-spacing: 0.05em;
}

.cat-badge-label.op { background: rgba(217, 119, 6, 0.12); color: #f59e0b; border: 1px solid rgba(217, 119, 6, 0.25); }
.cat-badge-label.gt { background: rgba(5, 150, 105, 0.12); color: #34d399; border: 1px solid rgba(5, 150, 105, 0.25); }
.cat-badge-label.pt { background: rgba(234, 179, 8, 0.12); color: #fbbf24; border: 1px solid rgba(234, 179, 8, 0.25); }
.cat-badge-label.qg { background: rgba(37, 99, 235, 0.12); color: #60a5fa; border: 1px solid rgba(37, 99, 235, 0.25); }
.cat-badge-label.qo { background: rgba(168, 85, 247, 0.12); color: #c084fc; border: 1px solid rgba(168, 85, 247, 0.25); }

.compact-explain {
  font-size: 0.78rem;
  color: var(--text-secondary);
  margin-top: 6px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.card-details {
  margin-top: 10px;
  border-top: 1px solid rgba(255, 255, 255, 0.06);
  padding-top: 10px;
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.detail-row {
  display: flex;
  flex-direction: column;
  gap: 4px;
  width: 100%;
}

.detail-label {
  font-size: 0.65rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  color: #9ca3af;
}

.phonetics-row {
  flex-direction: row;
  justify-content: space-between;
  align-items: center;
}

.phonetics {
  display: flex;
  gap: 8px;
}

.phonetic-label {
  font-size: 0.75rem;
  color: #a78bfa;
  font-family: monospace;
}

.speaker-actions {
  display: flex;
  gap: 4px;
}

.speak-btn {
  background: rgba(255, 255, 255, 0.05);
  border: 1px solid rgba(255, 255, 255, 0.1);
  color: var(--text-secondary);
  font-size: 0.65rem;
  padding: 2px 6px;
  border-radius: 6px;
  cursor: pointer;
  transition: all 0.2s ease;
}

.speak-btn:hover {
  background: rgba(99, 102, 241, 0.2);
  border-color: #6366f1;
  color: white;
}

/* 释义文字样式 */
.explain-en-text {
  font-size: 0.82rem;
  font-style: italic;
  color: #d1d5db;
  line-height: 1.4;
}

.explain-zh-text {
  font-size: 0.85rem;
  font-weight: 500;
  color: #f3f4f6;
}

/* 核心妙用提示框 */
.concept-box {
  background: rgba(245, 158, 11, 0.05);
  border: 1px dashed rgba(245, 158, 11, 0.2);
  padding: 8px 10px;
  border-radius: 8px;
  font-size: 0.75rem;
  line-height: 1.4;
  color: #f3f4f6;
}

.concept-box strong {
  color: #fbbf24;
}

/* 官方标准短句例句 */
.example-box {
  background: rgba(255, 255, 255, 0.02);
  border-left: 3px solid rgba(255, 255, 255, 0.2);
  padding: 6px 10px;
  border-radius: 0 8px 8px 0;
}

.example-en {
  font-size: 0.85rem;
  font-weight: 500;
  font-style: italic;
  color: #f3f4f6;
  line-height: 1.4;
  display: flex;
  align-items: center;
  gap: 6px;
}

.speak-inline-btn {
  background: transparent;
  border: none;
  color: #9ca3af;
  cursor: pointer;
  font-size: 0.8rem;
  transition: color 0.2s;
  padding: 0 4px;
}

.speak-inline-btn:hover {
  color: white;
}

.example-zh {
  font-size: 0.78rem;
  color: var(--text-secondary);
  margin-top: 4px;
}

/* 同义词代换标签 */
.syn-tags {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  margin-top: 4px;
}

.syn-tag-btn {
  background: rgba(255, 255, 255, 0.04);
  border: 1px solid rgba(255, 255, 255, 0.08);
  color: var(--text-secondary);
  padding: 3px 10px;
  border-radius: 20px;
  font-size: 0.72rem;
  cursor: pointer;
  transition: all 0.2s;
}

.syn-tag-btn:hover {
  background: rgba(255, 255, 255, 0.08);
  color: white;
}

.syn-tag-btn.active {
  background: var(--color-primary, #6366f1);
  border-color: var(--color-primary, #6366f1);
  color: white;
}

/* 同义词对比面板 */
.syn-compare-panel {
  margin-top: 10px;
  background: rgba(0, 0, 0, 0.2);
  border: 1px solid rgba(255, 255, 255, 0.06);
  border-radius: 8px;
  padding: 10px;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.compare-header {
  display: flex;
  align-items: baseline;
  gap: 6px;
  border-bottom: 1px dashed rgba(255, 255, 255, 0.08);
  padding-bottom: 6px;
  margin-bottom: 4px;
}

.compare-title {
  font-size: 0.95rem;
  font-weight: 700;
  color: #fbbf24;
}

.vs-label {
  font-size: 0.65rem;
  color: #9ca3af;
  text-transform: uppercase;
}

.compare-main {
  font-size: 0.75rem;
  font-style: italic;
  color: #9ca3af;
}

.compare-badge {
  margin-left: auto;
  font-size: 0.6rem;
  background: rgba(99, 102, 241, 0.15);
  border: 1px solid rgba(99, 102, 241, 0.3);
  color: #a5b4fc;
  padding: 1px 4px;
  border-radius: 4px;
}

.compare-body {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.compare-item {
  display: flex;
  gap: 8px;
  font-size: 0.75rem;
  line-height: 1.4;
}

.item-label {
  font-size: 0.65rem;
  font-weight: 700;
  color: #9ca3af;
  width: 50px;
  flex-shrink: 0;
  padding-top: 1px;
}

.item-val {
  color: #e5e7eb;
}

.empty-results {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 60px 20px;
  color: var(--text-secondary);
}

.empty-icon {
  font-size: 2.5rem;
  margin-bottom: 8px;
  opacity: 0.5;
}

/* 2. 造句特训沙盒样式 */
.sandbox-view {
  flex: 1;
  display: flex;
  flex-direction: column;
  justify-content: center;
  align-items: center;
  width: 100%;
}

.setup-area {
  width: 100%;
  max-width: 600px;
  padding: 10px;
}

.setup-card {
  background: var(--card-bg, rgba(255, 255, 255, 0.05));
  backdrop-filter: blur(20px);
  border: 1px solid var(--border-color, rgba(255, 255, 255, 0.08));
  border-radius: 16px;
  padding: 24px;
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.setup-card h3 {
  font-size: 1.2rem;
  font-weight: 700;
  text-align: center;
}

.setup-card p {
  font-size: 0.85rem;
  color: var(--text-secondary);
  text-align: center;
  margin-bottom: 8px;
}

.theme-presets {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 10px;
}

.theme-preset-btn {
  background: rgba(255, 255, 255, 0.03);
  border: 1px solid rgba(255, 255, 255, 0.06);
  color: white;
  padding: 12px;
  border-radius: 10px;
  font-size: 0.85rem;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s ease;
}

.theme-preset-btn:hover {
  background: rgba(99, 102, 241, 0.15);
  border-color: var(--color-primary, #6366f1);
  transform: translateY(-1px);
}

.custom-theme-row {
  display: flex;
  gap: 8px;
  margin-top: 8px;
}

.custom-theme-input {
  flex: 1;
  background: rgba(0, 0, 0, 0.3);
  border: 1px solid var(--border-color, rgba(255, 255, 255, 0.08));
  border-radius: 8px;
  padding: 10px;
  color: white;
  outline: none;
  font-size: 0.85rem;
}

.custom-theme-input:focus {
  border-color: var(--color-primary, #6366f1);
}

.generate-btn {
  background: var(--color-primary, #6366f1);
  border: none;
  color: white;
  border-radius: 8px;
  padding: 0 16px;
  font-weight: 600;
  font-size: 0.85rem;
  cursor: pointer;
  transition: all 0.2s ease;
}

.generate-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.generate-btn:hover:not(:disabled) {
  background: #4f46e5;
  box-shadow: 0 4px 12px rgba(99, 102, 241, 0.3);
}

/* 真·流式思考 Loading 态样式 */
.stream-loading {
  display: flex;
  flex-direction: column;
  align-items: center;
  width: 100%;
  max-width: 600px;
  padding: 20px;
  gap: 12px;
}

.loader-spinner {
  width: 40px;
  height: 40px;
  border: 4px solid rgba(255, 255, 255, 0.08);
  border-top-color: var(--color-primary, #6366f1);
  border-radius: 50%;
  animation: spin 1s linear infinite;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}

.loading-hint {
  font-size: 0.8rem;
  color: var(--text-secondary);
  text-align: center;
  margin-bottom: 8px;
}

.stream-panel-container {
  display: flex;
  flex-direction: column;
  width: 100%;
  gap: 14px;
  margin-top: 10px;
}

.stream-sub-panel {
  background: rgba(0, 0, 0, 0.35);
  border: 1px solid rgba(255, 255, 255, 0.06);
  border-radius: 12px;
  padding: 12px 16px;
  width: 100%;
  display: flex;
  flex-direction: column;
  gap: 6px;
  box-shadow: inset 0 2px 8px rgba(0, 0, 0, 0.4);
}

.stream-panel-title {
  font-size: 0.75rem;
  font-weight: 700;
  color: #c084fc;
  border-bottom: 1px solid rgba(255, 255, 255, 0.06);
  padding-bottom: 4px;
  margin-bottom: 4px;
}

.stream-content-box {
  height: 110px;
  overflow-y: auto;
  padding-right: 4px;
  scroll-behavior: smooth;
}

.reasoning-text-flow {
  font-family: monospace;
  font-size: 0.75rem;
  color: #cbd5e1;
  line-height: 1.5;
  font-style: italic;
  white-space: pre-wrap;
  word-break: break-all;
}

.code-box {
  background: rgba(0, 0, 0, 0.2);
  border-radius: 6px;
  padding: 8px;
}

.json-text-flow {
  margin: 0;
  white-space: pre-wrap;
  word-break: break-all;
}

.json-text-flow code {
  font-family: monospace;
  font-size: 0.75rem;
  color: #a78bfa;
  line-height: 1.4;
}

/* 答题中主卡片 */
.game-area {
  width: 100%;
  max-width: 600px;
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.game-header-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 0 4px;
}

.game-progress {
  font-size: 0.85rem;
  font-weight: 600;
  color: #a78bfa;
}

.quit-btn {
  background: transparent;
  border: none;
  color: var(--text-secondary);
  font-size: 0.8rem;
  cursor: pointer;
  transition: color 0.2s ease;
}

.quit-btn:hover {
  color: #ef4444;
}

.question-card {
  background: var(--card-bg, rgba(255, 255, 255, 0.05));
  backdrop-filter: blur(20px);
  border: 1px solid var(--border-color, rgba(255, 255, 255, 0.08));
  border-radius: 16px;
  padding: 24px;
  display: flex;
  flex-direction: column;
  gap: 16px;
  box-shadow: 0 20px 40px -10px rgba(0, 0, 0, 0.5);
  position: relative;
  transition: transform 0.1s ease;
}

/* 错误时晃动动画 */
.shake-err {
  animation: shake 0.5s;
}

@keyframes shake {
  0%, 100% { transform: translateX(0); }
  20%, 60% { transform: translateX(-8px); }
  40%, 80% { transform: translateX(8px); }
}

.card-tag {
  align-self: flex-start;
  background: rgba(99, 102, 241, 0.12);
  border: 1px solid rgba(99, 102, 241, 0.25);
  color: #a78bfa;
  font-size: 0.75rem;
  font-weight: 700;
  padding: 2px 8px;
  border-radius: 4px;
}

.chinese-instruction {
  font-size: 1.15rem;
  font-weight: 700;
  line-height: 1.3;
}

.original-box {
  background: rgba(0, 0, 0, 0.2);
  border: 1px solid rgba(255, 255, 255, 0.05);
  border-radius: 8px;
  padding: 12px;
}

.box-label {
  font-size: 0.7rem;
  color: var(--text-secondary);
}

.original-sentence {
  font-size: 0.95rem;
  font-style: italic;
  font-weight: 600;
  margin: 4px 0 8px 0;
  color: #94a3b8;
}

.prompt-tip {
  font-size: 0.75rem;
  color: #fca5a5;
  background: rgba(239, 68, 68, 0.06);
  padding: 4px 8px;
  border-radius: 4px;
  display: inline-block;
}

/* 积木拖拽区 */
.answer-zone {
  min-height: 60px;
  border: 2px dashed rgba(255, 255, 255, 0.1);
  background: rgba(0, 0, 0, 0.15);
  border-radius: 8px;
  padding: 10px;
  display: flex;
  flex-wrap: wrap;
  align-content: flex-start;
  gap: 8px;
  align-items: center;
  transition: all 0.2s ease;
}

.answer-zone.empty {
  justify-content: center;
}

.answer-placeholder {
  font-size: 0.8rem;
  color: var(--text-secondary);
  opacity: 0.5;
}

.block-pill {
  border: none;
  font-family: inherit;
  font-size: 0.85rem;
  font-weight: 600;
  padding: 6px 12px;
  border-radius: 6px;
  cursor: pointer;
  transition: all 0.2s cubic-bezier(0.16, 1, 0.3, 1);
}

.block-pill.selected {
  background: var(--color-primary, #6366f1);
  color: white;
}

.block-pill.selected:hover {
  background: #ef4444;
  transform: translateY(1px);
}

.pool-zone {
  min-height: 60px;
  background: rgba(255, 255, 255, 0.02);
  border: 1px solid rgba(255, 255, 255, 0.05);
  border-radius: 8px;
  padding: 12px;
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  justify-content: center;
  align-content: center;
}

.block-pill.pool {
  background: rgba(255, 255, 255, 0.07);
  border: 1px solid rgba(255, 255, 255, 0.1);
  color: white;
}

.block-pill.pool:hover {
  background: rgba(255, 255, 255, 0.15);
  transform: translateY(-2px);
  box-shadow: 0 4px 8px rgba(0,0,0,0.2);
}

/* 改写输入框 */
.write-input {
  width: 100%;
  background: rgba(0, 0, 0, 0.25);
  border: 1px solid var(--border-color, rgba(255, 255, 255, 0.08));
  border-radius: 8px;
  padding: 12px;
  color: white;
  outline: none;
  font-size: 0.95rem;
  transition: border-color 0.2s ease;
}

.write-input:focus:not(:disabled) {
  border-color: var(--color-primary, #6366f1);
}

.write-input:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.advanced-warning {
  margin-top: 8px;
  background: rgba(239, 68, 68, 0.08);
  border: 1px solid rgba(239, 68, 68, 0.15);
  padding: 8px 12px;
  border-radius: 8px;
  font-size: 0.75rem;
}

.warn-word-tag {
  background: #ef4444;
  color: white;
  padding: 1px 6px;
  border-radius: 4px;
  margin-right: 4px;
  font-weight: 700;
  display: inline-block;
}

.warn-tip {
  margin-top: 4px;
  color: #fca5a5;
}

/* 反馈组件 */
.feedback-panel {
  border-radius: 8px;
  padding: 12px;
  margin-top: 4px;
}

.feedback-panel.success {
  background: rgba(16, 185, 129, 0.08);
  border: 1px solid rgba(16, 185, 129, 0.25);
  color: #34d399;
}

.feedback-panel.error {
  background: rgba(239, 68, 68, 0.08);
  border: 1px solid rgba(239, 68, 68, 0.25);
  color: #f87171;
}

.feedback-header {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 6px;
}

.feedback-header h4 {
  font-size: 0.85rem;
  font-weight: 700;
}

.feedback-body {
  font-size: 0.85rem;
}

.sentence-accent {
  text-decoration: underline;
  text-underline-offset: 4px;
}

.acceptable-list {
  margin-top: 6px;
  font-size: 0.75rem;
  opacity: 0.85;
}

.acceptable-list ul {
  padding-left: 14px;
  margin-top: 2px;
}

/* 按钮行 */
.action-buttons-row {
  display: flex;
  gap: 8px;
  justify-content: flex-end;
  margin-top: 4px;
}

.btn {
  border: none;
  font-family: inherit;
  font-size: 0.85rem;
  font-weight: 600;
  padding: 10px 20px;
  border-radius: 8px;
  cursor: pointer;
  transition: all 0.2s ease;
}

.btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.btn.reset {
  background: rgba(255, 255, 255, 0.05);
  border: 1px solid rgba(255, 255, 255, 0.1);
  color: var(--text-secondary);
}

.btn.reset:hover:not(:disabled) {
  background: rgba(255, 255, 255, 0.1);
  color: white;
}

.btn.submit {
  background: var(--color-primary, #6366f1);
  color: white;
}

.btn.submit:hover:not(:disabled) {
  background: #4f46e5;
  box-shadow: 0 4px 12px rgba(99, 102, 241, 0.3);
}

.btn.next-step {
  background: #10b981;
  color: white;
  width: 100%;
}

.btn.next-step:hover {
  background: #059669;
  box-shadow: 0 4px 12px rgba(16, 185, 129, 0.3);
}

/* 过渡动画 */
.slide-fade-enter-active {
  transition: all 0.3s ease-out;
}
.slide-fade-leave-active {
  transition: all 0.2s cubic-bezier(1, 0.5, 0.8, 1);
}
.slide-fade-enter-from,
.slide-fade-leave-to {
  transform: translateY(-8px);
  opacity: 0;
}
</style>
