<template>
  <div class="play-btn-container">
    <button 
      class="play-btn" 
      :class="{ 'playing': isPlaying, 'uk': type === 'UK', 'loading': isLoading }"
      :disabled="isLoading"
      @click.stop="$emit('play')"
      :title="isLoading ? '正在加载发音...' : `播放${type === 'US' ? '美音' : '英音'}`"
    >
      <!-- 动态声波环形涟漪效果 (仅在播放时展示) -->
      <span v-if="isPlaying" class="ripple-orb r1"></span>
      <span v-if="isPlaying" class="ripple-orb r2"></span>
      
      <!-- 精美播放 SVG 图标 -->
      <div class="icon-wrapper">
        <span v-if="isLoading" class="play-loading-spinner">⌛</span>
        <svg v-else-if="!isPlaying" class="play-icon" viewBox="0 0 24 24" fill="currentColor">
          <path d="M8 5v14l11-7z"/>
        </svg>
        <!-- 播放中的动态声波波纹柱状图 (微动效) -->
        <div v-else class="playing-bars">
          <span class="bar bar-1"></span>
          <span class="bar bar-2"></span>
          <span class="bar bar-3"></span>
        </div>
      </div>
    </button>
    <!-- 口音标识气泡 -->
    <span class="accent-tag" :class="type.toLowerCase()">{{ type }}</span>
  </div>
</template>

<script setup lang="ts">
/**
 * 高颜值发音播放按钮
 * 支持播放时雷达环形涟漪声波与柱状图动效
 */
defineProps({
  isPlaying: {
    type: Boolean,
    default: false
  },
  isLoading: {
    type: Boolean,
    default: false
  },
  type: {
    type: String as () => 'US' | 'UK',
    default: 'US'
  }
});

defineEmits(['play']);
</script>

<style scoped>
.play-btn-container {
  display: inline-flex;
  flex-direction: column;
  align-items: center;
  position: relative;
  height: 48px;             /* 物理占位严格等于圆形按钮高度，防止气泡干扰垂直居中 */
  width: 48px;
}

.play-btn {
  width: 48px;
  height: 48px;
  border-radius: 50%;
  background: linear-gradient(135deg, var(--color-primary), #4f46e5);
  border: none;
  cursor: pointer;
  display: flex;
  justify-content: center;
  align-items: center;
  color: white;
  position: relative;
  box-shadow: 0 4px 14px 0 var(--color-primary-glow);
  transition: transform var(--transition-fast), box-shadow var(--transition-fast);
  z-index: 2;
}

/* 英音使用绿色调区分 */
.play-btn.uk {
  background: linear-gradient(135deg, var(--color-success), #059669);
  box-shadow: 0 4px 14px 0 var(--color-success-glow);
}

.play-btn:hover {
  transform: scale(1.08);
  box-shadow: 0 6px 20px 0 var(--color-primary-glow);
}

.play-btn.uk:hover {
  box-shadow: 0 6px 20px 0 var(--color-success-glow);
}

.play-btn:active {
  transform: scale(0.95);
}

.icon-wrapper {
  display: flex;
  justify-content: center;
  align-items: center;
  width: 20px;
  height: 20px;
}

.play-icon {
  width: 22px;
  height: 22px;
  margin-left: 2px; /* 播放三角居中修正 */
}

/* 播放中声波柱状动画 */
.playing-bars {
  display: flex;
  align-items: flex-end;
  justify-content: space-between;
  width: 16px;
  height: 14px;
}

.bar {
  width: 3px;
  height: 100%;
  background-color: white;
  border-radius: 99px;
  transform-origin: bottom;
  animation: bounce 1.2s ease-in-out infinite alternate;
}

.bar-1 { animation-delay: 0.1s; }
.bar-2 { animation-delay: 0.4s; height: 60%; }
.bar-3 { animation-delay: 0.2s; height: 80%; }

@keyframes bounce {
  0% { transform: scaleY(0.3); }
  100% { transform: scaleY(1); }
}

/* 环形雷达声波涟漪 */
.ripple-orb {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  border-radius: 50%;
  border: 1px solid var(--color-primary);
  pointer-events: none;
  z-index: 1;
  animation: ripple 2s cubic-bezier(0.1, 0.8, 0.3, 1) infinite;
}

.uk .ripple-orb {
  border-color: var(--color-success);
}

.r2 {
  animation-delay: 0.8s;
}

@keyframes ripple {
  0% {
    transform: scale(1);
    opacity: 0.8;
  }
  100% {
    transform: scale(1.8);
    opacity: 0;
  }
}

/* 口音标签 */
.accent-tag {
  position: absolute;       /* 绝对定位脱离文档流，不参与垂直居中计算 */
  bottom: -20px;            /* 完美浮动在发音按钮正下方 */
  left: 50%;
  transform: translateX(-50%);
  font-size: 0.7rem;
  font-weight: 700;
  padding: 2px 6px;
  border-radius: 99px;
  letter-spacing: 0.5px;
  background: rgba(255, 255, 255, 0.05);
  color: var(--text-secondary);
  border: 1px solid var(--glass-border);
  transition: all var(--transition-fast);
  white-space: nowrap;      /* 防止字词折行 */
}

.play-btn-container:hover .accent-tag {
  color: var(--text-primary);
  background: rgba(255, 255, 255, 0.1);
}

.accent-tag.us {
  color: #a5b4fc; /* 美音淡紫色 */
}

.accent-tag.uk {
  color: #a7f3d0; /* 英音淡绿色 */
}

/* 详情播放按钮沙漏加载旋转 */
.play-loading-spinner {
  display: inline-block;
  animation: spin 1.2s linear infinite;
  font-size: 1.1rem;
  line-height: 1;
  color: white;
}

@keyframes spin {
  0% { transform: rotate(0deg); }
  100% { transform: rotate(360deg); }
}

/* 详情播放按钮禁用加载中样式 */
.play-btn.loading {
  opacity: 0.7;
  cursor: not-allowed;
  transform: none !important;
  box-shadow: none !important;
  animation: play-pulse 1.5s ease-in-out infinite;
}

@keyframes play-pulse {
  0% { opacity: 0.6; }
  50% { opacity: 0.9; }
  100% { opacity: 0.6; }
}
</style>
