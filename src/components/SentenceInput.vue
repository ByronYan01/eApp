<template>
  <div class="input-container">
    <div class="textarea-wrapper" :class="{ 'focused': isFocused, 'has-content': !!sentence }">
      <textarea
        ref="textareaRef"
        v-model="sentence"
        placeholder="在这里输入需要解析的英语句子..."
        rows="3"
        @focus="isFocused = true"
        @blur="isFocused = false"
        @keydown.meta.enter="handleSubmit"
        @keydown.ctrl.enter="handleSubmit"
        :disabled="loading"
      ></textarea>
      
      <!-- 清空按钮 -->
      <button 
        v-if="sentence && !loading" 
        class="clear-btn" 
        @click="clearInput"
        title="清空内容"
      >
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <line x1="18" y1="6" x2="6" y2="18"></line>
          <line x1="6" y1="6" x2="18" y2="18"></line>
        </svg>
      </button>
    </div>

    <!-- 底部状态区 (包含提示与提交按钮) -->
    <div class="action-row">
      <span class="tip-text">
        <svg class="tip-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <circle cx="12" cy="12" r="10"></circle>
          <line x1="12" y1="16" x2="12" y2="12"></line>
          <line x1="12" y1="8" x2="12.01" y2="8"></line>
        </svg>
        提示: 按下 <kbd>Cmd</kbd> + <kbd>Enter</kbd> 可快速解析
      </span>
      
      <button 
        class="submit-btn" 
        :disabled="!sentence.trim() || loading"
        @click="handleSubmit"
      >
        <span v-if="!loading" class="btn-text">
          智能解析句子
          <svg class="arrow-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
            <line x1="5" y1="12" x2="19" y2="12"></line>
            <polyline points="12 5 19 12 12 19"></polyline>
          </svg>
        </span>
        <!-- 加载中的动态旋转光环效果 -->
        <span v-else class="loading-wrapper">
          <span class="spinner"></span>
          正在解析中...
        </span>
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue';

/**
 * 句子输入框组件
 * 包含回车快捷键提交、一键清空、解析Loading动效
 */
defineProps({
  loading: {
    type: Boolean,
    default: false
  }
});

const emit = defineEmits(['submit']);

const sentence = ref('');
const isFocused = ref(false);
const textareaRef = ref<HTMLTextAreaElement | null>(null);

const handleSubmit = () => {
  if (sentence.value.trim()) {
    emit('submit', sentence.value.trim());
  }
};

const clearInput = () => {
  sentence.value = '';
  textareaRef.value?.focus();
};

onMounted(() => {
  // 自动聚焦输入框
  textareaRef.value?.focus();
});
</script>

<style scoped>
.input-container {
  display: flex;
  flex-direction: column;
  gap: 12px;
  width: 100%;
}

.textarea-wrapper {
  background: rgba(255, 255, 255, 0.02);
  border: 1px solid var(--glass-border);
  border-radius: var(--radius-md);
  padding: 14px 40px 14px 14px;
  position: relative;
  transition: all var(--transition-fast);
}

.textarea-wrapper.focused {
  background: rgba(255, 255, 255, 0.04);
  border-color: var(--color-primary-glow);
  box-shadow: 0 0 15px 0 rgba(99, 102, 241, 0.15);
}

textarea {
  width: 100%;
  background: transparent;
  color: var(--text-primary);
  border: none;
  resize: none;
  font-size: 1.05rem;
  line-height: 1.6;
  font-family: inherit;
  outline: none;
}

textarea::placeholder {
  color: var(--text-muted);
}

/* 一键清空按钮 */
.clear-btn {
  position: absolute;
  top: 14px;
  right: 14px;
  background: transparent;
  border: none;
  color: var(--text-muted);
  cursor: pointer;
  padding: 4px;
  border-radius: 50%;
  display: flex;
  justify-content: center;
  align-items: center;
  transition: all var(--transition-fast);
}

.clear-btn:hover {
  color: var(--text-primary);
  background: rgba(255, 255, 255, 0.08);
}

.clear-btn svg {
  width: 16px;
  height: 16px;
}

/* 按钮与提示栏 */
.action-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.tip-text {
  font-size: 0.8rem;
  color: var(--text-muted);
  display: inline-flex;
  align-items: center;
  gap: 6px;
}

.tip-icon {
  width: 14px;
  height: 14px;
}

kbd {
  background: rgba(255, 255, 255, 0.08);
  border: 1px solid var(--glass-border);
  padding: 2px 5px;
  border-radius: 4px;
  font-size: 0.75rem;
  font-family: inherit;
}

/* 提交按钮 */
.submit-btn {
  background: linear-gradient(135deg, var(--color-primary), #4f46e5);
  color: white;
  padding: 10px 20px;
  border-radius: var(--radius-sm);
  font-weight: 600;
  font-size: 0.9rem;
  cursor: pointer;
  display: flex;
  align-items: center;
  gap: 8px;
  box-shadow: 0 4px 12px 0 var(--color-primary-glow);
  transition: all var(--transition-fast);
}

.submit-btn:hover:not(:disabled) {
  transform: translateY(-1px);
  box-shadow: 0 6px 16px 0 var(--color-primary-glow);
}

.submit-btn:active:not(:disabled) {
  transform: translateY(1px);
}

.submit-btn:disabled {
  background: rgba(255, 255, 255, 0.04);
  color: var(--text-muted);
  border: 1px solid var(--glass-border);
  box-shadow: none;
  cursor: not-allowed;
}

.btn-text {
  display: flex;
  align-items: center;
  gap: 6px;
}

.arrow-icon {
  width: 16px;
  height: 16px;
  transition: transform var(--transition-fast);
}

.submit-btn:hover .arrow-icon {
  transform: translateX(3px);
}

/* 加载动画 */
.loading-wrapper {
  display: flex;
  align-items: center;
  gap: 8px;
}

.spinner {
  width: 14px;
  height: 14px;
  border: 2px solid rgba(255, 255, 255, 0.2);
  border-top-color: white;
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}
</style>
