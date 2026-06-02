<template>
  <div class="review-card-container">
    <!-- 3D 翻转卡片主体 -->
    <div class="card-flipper" :class="{ 'flipped': isFlipped }" @click="toggleFlip">
      
      <!-- 1. 卡片正面 (英文与发音) -->
      <div class="card-face card-front">
        <div class="card-header">
          <span class="status-badge">RECALLING · 尝试回想</span>
          <span class="step-badge">阶段 {{ item.reviewCount }}</span>
        </div>
        
        <div class="card-content">
          <p class="english-text selectable" @click.stop>{{ item.text }}</p>
        </div>

        <div class="card-footer" @click.stop>
          <div class="audio-actions">
            <!-- 播放发音按钮 -->
            <button class="icon-audio-btn" @click="playTTS(item.text, 'US')" title="播放美音">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"></polygon>
                <path d="M19.07 4.93a10 10 0 0 1 0 14.14M15.54 8.46a5 5 0 0 1 0 7.07"></path>
              </svg>
              美音
            </button>
            <button class="icon-audio-btn uk" @click="playTTS(item.text, 'UK')" title="播放英音">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"></polygon>
                <path d="M19.07 4.93a10 10 0 0 1 0 14.14M15.54 8.46a5 5 0 0 1 0 7.07"></path>
              </svg>
              英音
            </button>
          </div>
          <span class="flip-hint">点击卡片任意处翻转查看释义</span>
        </div>
      </div>

      <!-- 2. 卡片背面 (中文翻译与音标详细解析) -->
      <div class="card-face card-back">
        <div class="card-header">
          <span class="status-badge success">ANSWER · 核心释义</span>
          <span class="time-badge">下次复习: {{ formatNextTime(item.nextReviewTime) }}</span>
        </div>

        <div class="card-content scrollable" @click.stop>
          <!-- 中文翻译 -->
          <h2 class="translation-text selectable">{{ item.translation }}</h2>
          
          <!-- 拼接整句音标 -->
          <p v-if="item.phonetics" class="phonetics-line selectable">{{ item.phonetics }}</p>

          <!-- 单词拆解分析流 -->
          <div class="words-analysis" v-if="item.words && item.words.length > 0">
            <h4 class="analysis-title">重点词汇分析：</h4>
            <div class="words-grid">
              <div v-for="word in filteredWords" :key="word.clean" class="word-mini-card">
                <span class="mini-word selectable">{{ word.clean }}</span>
                <span class="mini-phonetic selectable" v-if="word.phonetic">{{ word.phonetic }}</span>
                <!-- 生词发音小喇叭按钮组 -->
                <div class="mini-speaker-group">
                  <button class="mini-speaker-btn" @click="playWordTTS(word.clean, 'US')" title="美音发音">
                    US 🔊
                  </button>
                  <button class="mini-speaker-btn" @click="playWordTTS(word.clean, 'UK')" title="英音发音">
                    UK 🔊
                  </button>
                </div>
                <span class="mini-explain selectable">{{ word.explain }}</span>
              </div>
            </div>
          </div>
        </div>

        <div class="card-footer" @click.stop>
          <span class="flip-hint">点击卡片任意处返回英文正面</span>
        </div>
      </div>
      
    </div>

    <!-- 卡片下方的快捷评分按钮组 -->
    <div class="rating-bar" v-if="isFlipped">
      <button class="rate-btn forget" @click="handleRate(false)">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
          <circle cx="12" cy="12" r="10"></circle>
          <line x1="15" y1="9" x2="9" y2="15"></line>
          <line x1="9" y1="9" x2="15" y2="15"></line>
        </svg>
        没记住，需强化
      </button>

      <button class="rate-btn remember" @click="handleRate(true)">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
          <polyline points="20 6 9 17 4 12"></polyline>
        </svg>
        记住了，下一关
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue';
import { useTTS } from '../composables/useTTS';
import { useStorage } from '../composables/useStorage';
import type { SentenceItem } from '../composables/useStorage';

/**
 * 3D 物理翻转复习卡片
 * 正面呈现英文, 背面呈现音标与释义, 点击卡片触发 3D 翻转动效
 */
const props = defineProps<{
  item: SentenceItem
}>();

const emit = defineEmits(['remember', 'play-audio']);

const isFlipped = ref(false);
const { play } = useTTS();
const storage = useStorage();

// 在挂载时初始化加载一次配置，确保取到最新的设置数据
storage.loadSettings();

// 过滤掉符号等空单词，只展示有释义的重点词
const filteredWords = computed(() => {
  if (!props.item.words) return [];
  return props.item.words.filter(w => w.clean && w.explain && w.explain !== '暂无单词释义' && w.explain !== '查询失败');
});

const toggleFlip = () => {
  isFlipped.value = !isFlipped.value;
};

// 朗读句子 (同步全局的发音源配置与发音服务商)
const playTTS = (text: string, accent: 'US' | 'UK') => {
  play(text, accent, 1.0, storage.settings.value.audioPlaySource, storage.settings.value.audioPlayProvider);
};

// 朗读单个单词 (同样采用 1.0x 标准语速与发音服务商)
const playWordTTS = (word: string, accent: 'US' | 'UK') => {
  play(word, accent, 1.0, storage.settings.value.audioPlaySource, storage.settings.value.audioPlayProvider);
};

// 艾宾浩斯复习判定反馈
const handleRate = (remembered: boolean) => {
  emit('remember', props.item.id, remembered);
  // 评分后自动翻回正面，等待下一次载入
  setTimeout(() => {
    isFlipped.value = false;
  }, 200);
};

// 格式化时间戳为人类可读
const formatNextTime = (timestamp: number) => {
  const diff = timestamp - Date.now();
  if (diff <= 0) return '即将提醒';
  
  const minutes = Math.floor(diff / (60 * 1000));
  if (minutes < 60) return `${minutes}分钟后`;
  
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}小时后`;
  
  const days = Math.floor(hours / 24);
  return `${days}天后`;
};
</script>

<style scoped>
.review-card-container {
  width: 100%;
  max-width: 650px;
  margin: 0 auto;
  perspective: 1200px; /* 3D 视距，呈现逼真的空间感 */
  display: flex;
  flex-direction: column;
  gap: 20px;
}

/* 卡片翻转容器 */
.card-flipper {
  width: 100%;
  height: 380px;
  position: relative;
  transform-style: preserve-3d; /* 启用子元素 3D 空间 */
  transition: transform 0.6s cubic-bezier(0.175, 0.885, 0.32, 1.275); /* 带有弹性物理回弹的过渡 */
  cursor: pointer;
}

.card-flipper.flipped {
  transform: rotateY(180deg);
}

/* 卡片正面和背面的通用面板样式 */
.card-face {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  border-radius: var(--radius-lg);
  padding: 30px;
  backface-visibility: hidden; /* 翻转到背面时隐藏正面，极度重要 */
  -webkit-backface-visibility: hidden;
  background: var(--glass-bg);
  backdrop-filter: var(--glass-blur);
  -webkit-backdrop-filter: var(--glass-blur);
  border: 1px solid var(--glass-border);
  box-shadow: var(--glass-shadow);
  display: flex;
  flex-direction: column;
  justify-content: space-between;
}

/* 悬浮轻微高亮 */
.card-flipper:hover .card-face {
  background: var(--glass-bg-hover);
  border-color: var(--glass-border-hover);
}

/* 正面样式 */
.card-front {
  z-index: 2;
  transform: rotateY(0deg);
}

/* 背面样式 */
.card-back {
  transform: rotateY(180deg); /* 默认背面旋转180度隐藏 */
  border-color: rgba(99, 102, 241, 0.15);
}

/* 卡片顶部栏 */
.card-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.status-badge {
  font-size: 0.75rem;
  font-weight: 700;
  letter-spacing: 1px;
  color: var(--text-secondary);
  background: rgba(255, 255, 255, 0.05);
  padding: 4px 10px;
  border-radius: 99px;
  border: 1px solid var(--glass-border);
}

.status-badge.success {
  color: var(--color-primary);
  background: rgba(99, 102, 241, 0.1);
  border-color: rgba(99, 102, 241, 0.2);
}

.step-badge, .time-badge {
  font-size: 0.75rem;
  color: var(--text-muted);
}

/* 卡片核心内容 */
.card-content {
  flex: 1;
  display: flex;
  flex-direction: column;
  justify-content: center;
  align-items: center;
  text-align: center;
  padding: 20px 0;
}

.card-back .card-content {
  justify-content: flex-start;
  align-items: stretch;
  text-align: left;
}

/* 滚动条美化 */
.scrollable {
  overflow-y: auto;
  padding-right: 6px;
}

.english-text {
  font-size: 1.8rem;
  font-weight: 600;
  line-height: 1.5;
  color: var(--text-primary);
  word-wrap: break-word;
}

.translation-text {
  font-size: 1.4rem;
  font-weight: 600;
  line-height: 1.4;
  color: var(--text-primary);
  margin-bottom: 10px;
}

.phonetics-line {
  font-family: var(--font-sans);
  color: var(--color-primary);
  font-size: 1rem;
  font-weight: 500;
  margin-bottom: 24px;
}

/* 词汇拆解流 */
.words-analysis {
  border-top: 1px dashed var(--glass-border);
  padding-top: 18px;
}

.analysis-title {
  font-size: 0.85rem;
  color: var(--text-secondary);
  margin-bottom: 10px;
  font-weight: 600;
}

.words-grid {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.word-mini-card {
  background: rgba(255, 255, 255, 0.02);
  border: 1px solid rgba(255, 255, 255, 0.04);
  border-radius: 8px;
  padding: 8px 12px;
  display: flex;
  align-items: center;
  gap: 12px;
  font-size: 0.85rem;
}

.mini-word {
  font-weight: 700;
  color: var(--text-primary);
}

.mini-phonetic {
  color: var(--color-primary);
  font-size: 0.8rem;
}

.mini-explain {
  color: var(--text-secondary);
  flex: 1;
  text-align: right;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

/* 卡片底部栏 */
.card-footer {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.flip-hint {
  font-size: 0.75rem;
  color: var(--text-muted);
}

.audio-actions {
  display: flex;
  gap: 10px;
}

.icon-audio-btn {
  background: rgba(255, 255, 255, 0.04);
  color: var(--text-secondary);
  border: 1px solid var(--glass-border);
  padding: 6px 12px;
  border-radius: 99px;
  font-size: 0.75rem;
  font-weight: 600;
  cursor: pointer;
  display: inline-flex;
  align-items: center;
  gap: 6px;
  transition: all var(--transition-fast);
}

.icon-audio-btn:hover {
  background: var(--color-primary-glow);
  color: white;
  border-color: var(--color-primary);
}

.icon-audio-btn.uk:hover {
  background: var(--color-success-glow);
  border-color: var(--color-success);
}

.icon-audio-btn svg {
  width: 14px;
  height: 14px;
}

/* 下方红绿评分按钮组 */
.rating-bar {
  display: flex;
  gap: 16px;
  justify-content: center;
  animation: slideUp 0.4s cubic-bezier(0.16, 1, 0.3, 1) forwards;
}

@keyframes slideUp {
  from { opacity: 0; transform: translateY(10px); }
  to { opacity: 1; transform: translateY(0); }
}

.rate-btn {
  flex: 1;
  max-width: 240px;
  padding: 12px 24px;
  border-radius: var(--radius-md);
  font-size: 0.95rem;
  font-weight: 600;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  border: 1px solid transparent;
  transition: all var(--transition-fast);
}

/* 没记住按钮 */
.rate-btn.forget {
  background: rgba(244, 63, 94, 0.08);
  color: #fda4af;
  border-color: rgba(244, 63, 94, 0.2);
}

.rate-btn.forget:hover {
  background: var(--color-accent);
  color: white;
  box-shadow: 0 4px 15px 0 var(--color-accent-glow);
  transform: translateY(-1px);
}

/* 记住了按钮 */
.rate-btn.remember {
  background: rgba(16, 185, 129, 0.08);
  color: #6ee7b7;
  border-color: rgba(16, 185, 129, 0.2);
}

.rate-btn.remember:hover {
  background: var(--color-success);
  color: white;
  box-shadow: 0 4px 15px 0 var(--color-success-glow);
  transform: translateY(-1px);
}

.rate-btn svg {
  width: 18px;
  height: 18px;
}

/* 复习卡片背面重点词汇分析发音小按钮样式 */
.mini-speaker-group {
  display: inline-flex;
  gap: 6px;
  align-items: center;
}

.mini-speaker-btn {
  background: rgba(255, 255, 255, 0.04);
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: 4px;
  color: #a78bfa;
  font-size: 0.65rem;
  padding: 2px 6px;
  cursor: pointer;
  display: inline-flex;
  align-items: center;
  gap: 2px;
  transition: all var(--transition-fast, 0.2s);
}

.mini-speaker-btn:hover {
  background: var(--color-primary-glow, rgba(99, 102, 241, 0.15));
  border-color: var(--color-primary, #6366f1);
  color: white;
  transform: scale(1.05);
}
</style>
