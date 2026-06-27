<template>
  <div class="result-card-container">
    <div class="result-glass-card" :class="{ 'no-card-style': noCardStyle }">
      
      <!-- 顶部控制条 (收藏按钮) -->
      <div class="card-top-action" v-if="showTopAction">
        <span class="module-title" v-if="!noCardStyle">智能解析</span>
        
        <div class="top-action-controls" style="display: flex; align-items: center; gap: 10px; margin-left: auto;">
          <!-- 极简目标分类选择器 -->
          <select 
            v-if="showRepoSelector && !isSaved" 
            :value="selectedRepoId" 
            @change="e => $emit('update:selectedRepoId', (e.target as HTMLInputElement).value)" 
            class="repo-select-mini"
            title="选择保存的目标分类"
          >
            <option value="default">🏠 默认仓库</option>
            <option v-for="repo in repositories?.filter(r => r.id !== 'default')" :key="repo.id" :value="repo.id">
              📚 {{ repo.name }}
            </option>
          </select>

          <button 
            v-if="showSaveBtn"
            class="favorite-btn" 
            :class="{ 'is-saved': isSaved }"
            @click="$emit('toggle-save')"
            :title="isSaved ? '从复习列表中移除' : '加入复习'"
          >
            <svg class="heart-icon" viewBox="0 0 24 24" fill="currentColor">
              <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"/>
            </svg>
            {{ isSaved ? '已在复习' : '加入复习' }}
          </button>
        </div>
      </div>

      <!-- 核心句子交互展示区 (单词分拆悬浮查词) -->
      <div class="sentence-interactive-box" style="display: flex; justify-content: space-between; align-items: center; width: 100%; gap: 16px;">
        <InteractiveSentence 
          :words="words" 
          @play-word-audio="playWordAudio"
        />
        <button 
          class="copy-icon-btn" 
          :class="{ 'copied': isCopied }"
          @click="handleCopyText" 
          :title="isCopied ? '已复制！' : '复制英文原句'"
        >
          <!-- 复制图标 (SVG) -->
          <svg v-if="!isCopied" class="copy-svg-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
            <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
            <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
          </svg>
          <!-- 复制成功勾号图标 (SVG) -->
          <svg v-else class="copy-success-svg-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3">
            <polyline points="20 6 9 17 4 12"></polyline>
          </svg>
        </button>
      </div>

      <!-- 核心翻译展示区 -->
      <div class="translation-section">
        <p class="translation-text selectable">{{ translation }}</p>
        <p class="phonetics-summary selectable" v-if="phoneticsSummary">
          整句连读音标：<span>{{ phoneticsSummary }}</span>
        </p>
        
        <!-- 服务商知情权标识 (Badge Row) -->
        <div class="provider-badges-row">
          <span class="provider-badge select-none">
            ⚡ 翻译源: <span class="provider-name">{{ formatProviderName(translationProvider) }}</span>
          </span>
          <span class="provider-badge select-none">
            🔊 发音源: <span class="provider-name">{{ formatAudioSourceName(audioPlaySource, audioPlayProvider) }}</span>
          </span>
          <span class="provider-badge select-none">
            🔤 词典源: <span class="provider-name">{{ formatProviderName(dictionaryProvider) }}</span>
          </span>
        </div>
      </div>

      <!-- 底部控制条 (播放按钮及语速控制) -->
      <div class="card-bottom-actions">
        <div class="player-group">
          <!-- 美音发音 -->
          <PlayButton 
            type="US" 
            :isPlaying="playingAccent === 'US' && isPlaying"
            :isLoading="playingAccent === 'US' && isLoading"
            @play="$emit('play-audio', 'US')"
          />
          <!-- 英音发音 -->
          <PlayButton 
            type="UK" 
            :isPlaying="playingAccent === 'UK' && isPlaying"
            :isLoading="playingAccent === 'UK' && isLoading"
            @play="$emit('play-audio', 'UK')"
          />
        </div>

        <!-- 语速控制器 -->
        <div class="speed-controller">
          <span class="speed-label">播放语速: {{ playRate.toFixed(1) }}x</span>
          <input 
            type="range" 
            min="0.6" 
            max="1.4" 
            step="0.1" 
            :value="playRate"
            @input="handleSpeedChange"
            class="speed-slider"
          />
        </div>
      </div>

    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import PlayButton from './PlayButton.vue';
import InteractiveSentence from './InteractiveSentence.vue';
import type { WordDetail } from '../composables/useStorage';

/**
 * 智能解析结果展示面板
 * 实现了单词拆解悬浮（Hover）秒级弹窗显示音标与解释的高端学习交互
 */
const props = withDefaults(
  defineProps<{
    sentence: string;
    translation: string;
    words: WordDetail[];
    isSaved: boolean;
    isPlaying: boolean;
    playingAccent: 'US' | 'UK';
    isLoading?: boolean;
    playRate: number;
    translationProvider: string;
    audioPlaySource: string;
    audioPlayProvider: string;
    dictionaryProvider: string;
    showSaveBtn?: boolean;
    noCardStyle?: boolean;
    showTopAction?: boolean;
    selectedRepoId?: string;
    repositories?: any[];
    showRepoSelector?: boolean;
  }>(),
  {
    showSaveBtn: true,
    isLoading: false,
    noCardStyle: false,
    showTopAction: true,
    selectedRepoId: 'default',
    repositories: () => [],
    showRepoSelector: false
  }
);

const emit = defineEmits(['toggle-save', 'play-audio', 'update:playRate', 'play-word-audio', 'update:selectedRepoId']);

import { ref } from 'vue';

const isCopied = ref(false);

const handleCopyText = async () => {
  try {
    await navigator.clipboard.writeText(props.sentence);
    isCopied.value = true;
    setTimeout(() => {
      isCopied.value = false;
    }, 1500);
  } catch (err) {
    console.error('Failed to copy text: ', err);
  }
};

// 触发单个单词发音的事件
const playWordAudio = (word: string, accent: 'US' | 'UK') => {
  emit('play-word-audio', word, accent);
};

// 格式化翻译与音标服务商名称显示
const formatProviderName = (provider: string) => {
  switch (provider) {
    case 'auto': return '自动智能兜底';
    case 'google': return 'Google 智能翻译';
    case 'youdao': return '有道网页查词';
    case 'baidu': return '百度划词接口';
    case 'eudic': return '欧路云端词典';
    default: return provider;
  }
};

// 格式化真人/本地发音引擎显示
const formatAudioSourceName = (source: string, provider: string) => {
  if (source === 'local') {
    return '系统本地 TTS (离线)';
  }
  switch (provider) {
    case 'auto': return '智能级联兜底 (有道/谷歌/百度)';
    case 'google': return '谷歌真人原声';
    case 'youdao': return '有道外教原声';
    case 'baidu': return '百度真人原声';
    default: return '在线真人原声';
  }
};

// 自动生成整句音标连读 (拼接所有非标点单词的音标)
const phoneticsSummary = computed(() => {
  const list = props.words
    .filter(w => w.phonetic)
    .map(w => w.phonetic.replace(/[\[\]]/g, '')); // 去掉括号
  if (list.length === 0) return '';
  return `/[ ${list.join(' ')} ]/`;
});

const handleSpeedChange = (e: Event) => {
  const val = parseFloat((e.target as HTMLInputElement).value);
  emit('update:playRate', val);
};
</script>

<style scoped>
.result-card-container {
  width: 100%;
}

.result-glass-card {
  background: rgba(255, 255, 255, 0.02);
  backdrop-filter: var(--glass-blur);
  -webkit-backdrop-filter: var(--glass-blur);
  border: 1px solid var(--glass-border);
  border-radius: var(--radius-lg);
  padding: 24px;
  box-shadow: var(--glass-shadow);
  display: flex;
  flex-direction: column;
  gap: 20px;
}

.result-glass-card.no-card-style {
  background: transparent;
  border: none;
  backdrop-filter: none;
  -webkit-backdrop-filter: none;
  box-shadow: none;
  padding: 0;
}

/* 顶部控制栏 */
.card-top-action {
  display: flex;
  justify-content: space-between;
  align-items: center;
  border-bottom: 1px solid var(--glass-border);
  padding-bottom: 12px;
}

.module-title {
  font-size: 0.85rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 1px;
  color: var(--text-secondary);
}

/* 收藏按钮 */
.favorite-btn {
  background: rgba(255, 255, 255, 0.03);
  color: var(--text-secondary);
  border: 1px solid var(--glass-border);
  padding: 8px 16px;
  border-radius: 99px;
  font-size: 0.85rem;
  font-weight: 600;
  cursor: pointer;
  display: flex;
  align-items: center;
  gap: 8px;
  transition: all var(--transition-fast);
}

.favorite-btn:hover {
  background: rgba(244, 63, 94, 0.08);
  color: #fda4af;
  border-color: rgba(244, 63, 94, 0.2);
}

.favorite-btn.is-saved {
  background: rgba(16, 185, 129, 0.08);
  color: #6ee7b7;
  border-color: rgba(16, 185, 129, 0.2);
}

.favorite-btn.is-saved:hover {
  background: rgba(244, 63, 94, 0.1);
  color: #f43f5e;
  border-color: rgba(244, 63, 94, 0.3);
}

.heart-icon {
  width: 15px;
  height: 15px;
}

/* 单词分拆悬浮查词盒子 */
.sentence-interactive-box {
  background: transparent;  /* 彻底消除黑色块背景色 */
  border-radius: 0;
  padding: 4px 0;           /* 精细化微调内边距 */
  border: none;             /* 彻底去噪边框 */
}

.words-flow {
  display: flex;
  flex-wrap: wrap;
  row-gap: 12px;
  column-gap: 8px;
  font-size: 1.6rem;
  line-height: 1.4;
  font-weight: 600;
}

/* 单词交互效果 */
.interactive-word-span {
  position: relative;
  cursor: help;
  color: var(--text-primary);
  border-radius: 4px;
  padding: 0 2px;
  transition: all var(--transition-fast);
}

.interactive-word-span.has-info:hover {
  color: var(--color-primary);
  background: var(--color-primary-glow);
  transform: translateY(-2px);
}

/* 单词悬浮卡片 (Tooltip Popover) */
.word-tooltip {
  position: absolute;
  bottom: 125%; /* 在单词正上方展示 */
  left: 50%;
  transform: translateX(-50%) scale(0.9);
  background: #0f172a; /* 极深的暗卡片，让文字更凸显 */
  color: white;
  padding: 10px 14px;
  border-radius: 8px;
  width: 210px;
  box-shadow: 0 10px 25px -5px rgba(0,0,0,0.6), 0 0 1px 1px rgba(255,255,255,0.1);
  font-size: 0.85rem;
  line-height: 1.4;
  text-align: left;
  z-index: 100;
  pointer-events: auto; /* 允许鼠标划入浮窗进行发音交互 */
  opacity: 0;
  visibility: hidden;
  transition: all 0.25s cubic-bezier(0.16, 1, 0.3, 1);
}

.tooltip-arrow {
  position: absolute;
  top: 100%;
  left: 50%;
  transform: translateX(-50%);
  border: 6px solid transparent;
  border-top-color: #0f172a;
}

/* 触发展示 */
.interactive-word-span:hover .word-tooltip {
  opacity: 1;
  visibility: visible;
  transform: translateX(-50%) scale(1);
}

/* 浮窗内部头部排版 */
.tooltip-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  border-bottom: 1px solid rgba(255,255,255,0.08);
  padding-bottom: 6px;
  margin-bottom: 6px;
}

.tooltip-word {
  display: inline-block;
  font-weight: 700;
  font-size: 0.95rem;
  color: white;
  border-bottom: none;
  padding-bottom: 0;
  margin-bottom: 0;
}

.tooltip-speaker-group {
  display: flex;
  gap: 6px;
}

.tooltip-speaker-btn {
  background: rgba(255, 255, 255, 0.05);
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 4px;
  color: #a78bfa;
  font-size: 0.65rem;
  padding: 2px 5px;
  cursor: pointer;
  display: inline-flex;
  align-items: center;
  gap: 2px;
  transition: all var(--transition-fast, 0.2s);
}

.tooltip-speaker-btn:hover {
  background: var(--color-primary-glow, rgba(99, 102, 241, 0.2));
  border-color: var(--color-primary, #6366f1);
  color: white;
  transform: scale(1.05);
}

.tooltip-phonetic {
  display: block;
  color: var(--color-primary);
  font-family: var(--font-sans);
  font-size: 0.8rem;
  margin-bottom: 4px;
  font-weight: 600;
}

.tooltip-explain {
  display: block;
  color: var(--text-secondary);
  font-size: 0.75rem;
  font-weight: 400;
}

/* 翻译区 */
.translation-section {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.translation-text {
  font-size: 1.25rem;
  line-height: 1.5;
  font-weight: 500;
  color: var(--text-primary);
}

.phonetics-summary {
  font-size: 0.85rem;
  color: var(--text-secondary);
  font-weight: 500;
}

.phonetics-summary span {
  font-family: var(--font-sans);
  color: var(--color-primary);
  font-weight: 600;
}

/* 底部操作区 */
.card-bottom-actions {
  display: flex;
  justify-content: space-between;
  align-items: center;
  border-top: 1px solid var(--glass-border);
  padding-top: 16px;
  padding-bottom: 12px;     /* 新增：留出空间给绝对定位向下溢出的口音标签，防止其贴紧底部边框 */
}

.player-group {
  display: flex;
  gap: 16px;
}

/* 语速滑动条 */
.speed-controller {
  display: flex;
  align-items: center;
  gap: 12px;
}

.speed-label {
  font-size: 0.8rem;
  font-weight: 600;
  color: var(--text-secondary);
  width: 90px;
  text-align: right;
}

.speed-slider {
  -webkit-appearance: none;
  width: 100px;
  height: 4px;
  border-radius: 99px;
  background: rgba(255, 255, 255, 0.1);
  outline: none;
  cursor: pointer;
  transition: background 0.3s;
}

.speed-slider::-webkit-slider-thumb {
  -webkit-appearance: none;
  appearance: none;
  width: 12px;
  height: 12px;
  border-radius: 50%;
  background: var(--color-primary);
  box-shadow: 0 0 8px var(--color-primary-glow);
  cursor: pointer;
  transition: transform 0.1s;
}

.speed-slider::-webkit-slider-thumb:hover {
  transform: scale(1.3);
}

/* 新增：服务商 Badge 布局样式 */
.provider-badges-row {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-top: 6px;
}

.provider-badge {
  font-size: 0.7rem;
  color: var(--text-secondary, #94a3b8);
  background: rgba(255, 255, 255, 0.02);
  border: 1px solid rgba(255, 255, 255, 0.05);
  padding: 2px 8px;
  border-radius: 4px;
  display: inline-flex;
  align-items: center;
  gap: 4px;
  backdrop-filter: blur(4px);
}

.provider-name {
  color: var(--color-primary, #6366f1);
  font-weight: 700;
  text-shadow: 0 0 5px var(--color-primary-glow, rgba(99, 102, 241, 0.1));
}

/* 复制原句按钮 */
.copy-icon-btn {
  background: transparent;
  border: none;
  color: var(--text-muted, #64748b);
  cursor: pointer;
  padding: 6px;
  border-radius: 6px;
  display: flex;
  justify-content: center;
  align-items: center;
  transition: all var(--transition-fast, 0.2s);
  opacity: 0.6;
  flex-shrink: 0;
}

.copy-icon-btn:hover {
  background: rgba(255, 255, 255, 0.05);
  color: var(--text-primary, white);
  opacity: 1;
}

.copy-icon-btn.copied {
  color: var(--color-success, #10b981);
  background: rgba(16, 185, 129, 0.08);
  opacity: 1;
}

.copy-svg-icon {
  width: 15px;
  height: 15px;
}

.copy-success-svg-icon {
  width: 14px;
  height: 14px;
}

/* 微型目标分类下拉选高颜值玻璃拟物样式 (与复习页及句子仓库高度一致) */
.repo-select-mini {
  appearance: none;
  -webkit-appearance: none;
  -moz-appearance: none;
  background-image: url("data:image/svg+xml;charset=UTF-8,%3csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='%23a5b4fc' stroke-width='2.5' stroke-linecap='round' stroke-linejoin='round'%3e%3cpolyline points='6 9 12 15 18 9'%3e%3c/polyline%3e%3c/svg%3e");
  background-repeat: no-repeat;
  background-position: right 10px center;
  background-size: 12px;
  padding: 6px 28px 6px 12px;
  font-size: 0.8rem;
  font-weight: 600;
  border-radius: var(--radius-md, 8px);
  border: 1px solid rgba(255, 255, 255, 0.08);
  background-color: rgba(15, 15, 25, 0.4);
  color: #e2e8f0;
  cursor: pointer;
  outline: none;
  transition: all var(--transition-fast, 0.2s);
  backdrop-filter: blur(10px);
  -webkit-backdrop-filter: blur(10px);
  box-shadow: 0 4px 10px rgba(0, 0, 0, 0.1);
}

.repo-select-mini:hover {
  border-color: rgba(255, 255, 255, 0.15);
  background-color: rgba(15, 15, 25, 0.6);
  color: var(--text-primary, white);
}

.repo-select-mini option {
  background-color: #1a1a2b;
  color: #e2e8f0;
  padding: 6px;
}
</style>
