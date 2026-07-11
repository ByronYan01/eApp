<template>
  <div class="words-flow" :class="{ 'is-compact': compact }" :style="{ fontSize: fontSize || '1.6rem' }">
    <span 
      v-for="(word, index) in words" 
      :key="index"
      class="interactive-word-span"
      :class="{ 'has-info': !!word.clean }"
      @mouseenter="handleWordMouseEnter($event, word)"
      @mouseleave="handleWordMouseLeave"
    >
      {{ word.original }}
    </span>

    <!-- 悬浮微光查词浮窗 (单例 + Teleport 传送至 body 最顶层，彻底脱离任何卡片或容器的裁剪) -->
    <Teleport to="body">
      <div 
        class="word-tooltip-portal" 
        v-if="activeWord"
        :style="tooltipStyle"
        @mouseenter="cancelHide"
        @mouseleave="handleWordMouseLeave"
      >
        <span class="tooltip-arrow" :class="{ 'placement-bottom': tooltipPlacement === 'bottom' }"></span>
        <div class="tooltip-header">
          <span class="tooltip-word">{{ activeWord.clean }}</span>
          <div class="tooltip-speaker-group">
            <!-- 单个单词美音发音按钮 -->
            <button class="tooltip-speaker-btn" @click.stop="playWordAudio(activeWord.clean, 'US')" title="美音发音">
              US 🔊
            </button>
            <!-- 单个单词英音发音按钮 -->
            <button class="tooltip-speaker-btn" @click.stop="playWordAudio(activeWord.clean, 'UK')" title="英音发音">
              UK 🔊
            </button>
          </div>
        </div>
        <span class="tooltip-phonetic" v-if="activeWord.phonetic">{{ activeWord.phonetic }}</span>
        <span class="tooltip-explain">{{ activeWord.explain || '暂无详细解释' }}</span>
      </div>
    </Teleport>
  </div>
</template>

<script setup lang="ts">
import { ref, onUnmounted } from 'vue';
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

// 单例悬浮窗状态
const activeWord = ref<WordDetail | null>(null);
const tooltipPlacement = ref<'top' | 'bottom'>('top');
const tooltipStyle = ref<Record<string, string>>({
  position: 'fixed',
  left: '0px',
  top: '0px',
  opacity: '0',
  visibility: 'hidden',
  transform: 'translate(-50%, -100%) scale(0.9)',
  transition: 'opacity 0.2s, transform 0.2s'
});

let hideTimer: any = null;

const handleWordMouseEnter = (event: MouseEvent, word: WordDetail) => {
  if (!word.clean || (!word.explain && !word.phonetic)) return;
  
  // 清除延迟隐藏计时器
  if (hideTimer) {
    clearTimeout(hideTimer);
    hideTimer = null;
  }

  activeWord.value = word;

  const target = event.currentTarget as HTMLElement;
  const targetRect = target.getBoundingClientRect();

  // Tooltip 尺寸设定与视口物理边界限制
  const tooltipWidth = 210;
  const tooltipHeight = 135; // 结合音标及两行释义预估的极限高度
  const viewportWidth = window.innerWidth;
  const viewportHeight = window.innerHeight;

  // 初始计算位置 (默认在单词正上方 8px 处)
  let left = targetRect.left + targetRect.width / 2;
  let top = targetRect.top - 8;
  let placement: 'top' | 'bottom' = 'top';

  // 1. 垂直避让：如果上方空间不足以容纳悬浮窗 (top < tooltipHeight + 15)，且下方有足够空间，则改为向下弹出
  if (targetRect.top < tooltipHeight + 15 && targetRect.bottom + tooltipHeight + 15 < viewportHeight) {
    top = targetRect.bottom + 8;
    placement = 'bottom';
  }

  // 2. 水平避让：防止悬浮框在靠近屏幕左侧或右侧时超出视口边界而被截断
  const safetyMargin = 12; // 贴边最小安全距离 (px)
  const minLeft = tooltipWidth / 2 + safetyMargin;
  const maxLeft = viewportWidth - tooltipWidth / 2 - safetyMargin;

  if (left < minLeft) {
    left = minLeft;
  } else if (left > maxLeft) {
    left = maxLeft;
  }

  tooltipPlacement.value = placement;

  // 更新浮窗显示状态与样式
  tooltipStyle.value = {
    position: 'fixed',
    left: `${left}px`,
    top: `${top}px`,
    opacity: '1',
    visibility: 'visible',
    transform: placement === 'top' 
      ? 'translate(-50%, -100%) scale(1)' 
      : 'translate(-50%, 0) scale(1)',
    transition: 'opacity 0.2s, transform 0.2s, left 0.15s ease-out, top 0.15s ease-out',
    zIndex: '99999' // 赋以最高的层叠高度，永远凌驾于多卡片层之上
  };
};

const handleWordMouseLeave = () => {
  // 延时 120ms 触发隐藏，给鼠标从单词移入浮窗进行发音交互留出合理的空档时间
  hideTimer = setTimeout(() => {
    hideTooltip();
  }, 120);
};

const cancelHide = () => {
  // 鼠标移入浮窗内部，取消隐藏
  if (hideTimer) {
    clearTimeout(hideTimer);
    hideTimer = null;
  }
};

const hideTooltip = () => {
  tooltipStyle.value.opacity = '0';
  tooltipStyle.value.visibility = 'hidden';
  tooltipStyle.value.transform = tooltipPlacement.value === 'top'
    ? 'translate(-50%, -100%) scale(0.9)'
    : 'translate(-50%, 0) scale(0.9)';
  
  // 动画淡出后彻底移除 DOM 渲染以节省系统资源
  setTimeout(() => {
    if (tooltipStyle.value.opacity === '0') {
      activeWord.value = null;
    }
  }, 200);
};

onUnmounted(() => {
  if (hideTimer) clearTimeout(hideTimer);
});
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

/* 顶级 Portal 单词悬浮卡片 (Tooltip Popover) */
.word-tooltip-portal {
  background: #0f172a; /* 极深的暗卡片，让文字更凸显 */
  color: white;
  padding: 10px 14px;
  border-radius: 8px;
  width: 210px;
  box-shadow: 0 10px 25px -5px rgba(0,0,0,0.6), 0 0 1px 1px rgba(255,255,255,0.1);
  font-size: 0.85rem;
  line-height: 1.4;
  text-align: left;
  pointer-events: auto; /* 允许鼠标划入浮窗进行发音交互 */
}

.tooltip-arrow {
  position: absolute;
  top: 100%;
  left: 50%;
  transform: translateX(-50%);
  border: 6px solid transparent;
  border-top-color: #0f172a;
}

/* 垂直向下避让时，小箭头翻转到顶部 */
.tooltip-arrow.placement-bottom {
  top: auto;
  bottom: 100%;
  border-top-color: transparent;
  border-bottom-color: #0f172a;
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
