<template>
  <div class="glass-card" :class="{ 'hoverable': hoverable, 'active': active }">
    <slot></slot>
  </div>
</template>

<script setup lang="ts">
/**
 * 基础毛玻璃卡片组件 (Glassmorphism)
 * 赋予整个应用高质感的磨砂玻璃视觉基底
 */
defineProps({
  hoverable: {
    type: Boolean,
    default: false
  },
  active: {
    type: Boolean,
    default: false
  }
});
</script>

<style scoped>
.glass-card {
  background: var(--glass-bg);
  backdrop-filter: var(--glass-blur);
  -webkit-backdrop-filter: var(--glass-blur);
  border: 1px solid var(--glass-border);
  border-radius: var(--radius-md);
  box-shadow: var(--glass-shadow);
  padding: 1.5rem;
  transition: 
    background-color var(--transition-fast), 
    border-color var(--transition-fast), 
    transform var(--transition-smooth), 
    box-shadow var(--transition-smooth);
  position: relative;
  overflow: hidden;
}

/* 悬浮交互微动效 */
.glass-card.hoverable:hover {
  background: var(--glass-bg-hover);
  border-color: var(--glass-border-hover);
  transform: translateY(-2px);
  box-shadow: 0 12px 40px 0 rgba(0, 0, 0, 0.45), 0 0 15px 0 var(--bg-glow-1);
}

/* 激活状态 */
.glass-card.active {
  border-color: var(--color-primary-glow);
  box-shadow: 0 0 20px 0 var(--color-primary-glow);
}
</style>
