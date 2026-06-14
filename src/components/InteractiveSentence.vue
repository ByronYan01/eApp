<template>
  <div class="words-flow" :class="{ 'is-compact': compact }" :style="{ fontSize: fontSize || '1.6rem' }">
    <span 
      v-for="(word, index) in words" 
      :key="index"
      class="interactive-word-span"
      :class="{ 'has-info': !!word.clean }"
    >
      {{ word.original }}
      
      <!-- 悬浮微光查词浮窗 (Tooltip Popover) -->
      <span class="word-tooltip" v-if="word.clean && (word.explain || word.phonetic)">
        <span class="tooltip-arrow"></span>
        <div class="tooltip-header">
          <span class="tooltip-word">{{ word.clean }}</span>
          <div class="tooltip-speaker-group">
            <!-- 单个单词美音发音按钮 -->
            <button class="tooltip-speaker-btn" @click.stop="playWordAudio(word.clean, 'US')" title="美音发音">
              US 🔊
            </button>
            <!-- 单个单词英音发音按钮 -->
            <button class="tooltip-speaker-btn" @click.stop="playWordAudio(word.clean, 'UK')" title="英音发音">
              UK 🔊
            </button>
          </div>
        </div>
        <span class="tooltip-phonetic" v-if="word.phonetic">{{ word.phonetic }}</span>
        <span class="tooltip-explain">{{ word.explain || '暂无详细解释' }}</span>
      </span>
    </span>
  </div>
</template>

<script setup lang="ts">
import type { WordDetail } from '../composables/useStorage';

// 定义组件的 Props，允许传入单词详情列表、自定义字号及紧凑模式开关
defineProps<{
  words: WordDetail[];
  fontSize?: string;
  compact?: boolean;
}>();

// 定义组件向外派发的事件：播放单词发音
const emit = defineEmits<{
  (e: 'play-word-audio', word: string, accent: 'US' | 'UK'): void;
}>();

// 处理播放单词音频，阻止事件冒泡，防止触发卡片翻转或展开折叠
const playWordAudio = (word: string, accent: 'US' | 'UK') => {
  emit('play-word-audio', word, accent);
};
</script>

<style scoped>
.words-flow {
  display: flex;
  flex-wrap: wrap;
  row-gap: 12px;
  column-gap: 8px;
  line-height: 1.4;
  font-weight: 600;
}

/* 紧凑模式下消除多余间距，实现完全自然的单词排版 */
.words-flow.is-compact {
  column-gap: 0px;
  row-gap: 4px;
  font-weight: 500;
}

/* 单词交互效果 */
.interactive-word-span {
  position: relative;
  cursor: help;
  color: var(--text-primary);
  border-radius: 4px;
  padding: 0 2px;
  transition: all var(--transition-fast, 0.2s);
}

.words-flow.is-compact .interactive-word-span {
  padding: 0 1px;
}

.interactive-word-span.has-info:hover {
  color: var(--color-primary, #6366f1);
  background: var(--color-primary-glow, rgba(99, 102, 241, 0.1));
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
  color: var(--color-primary, #6366f1);
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
</style>
