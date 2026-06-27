<template>
  <div class="review-panel-card animate-fade-in">
    <!-- A. 状态页眉 -->
    <div class="test-header">
      <span class="status-badge" :class="{ 'revealed': isAnswerRevealed }">
        {{ isAnswerRevealed ? 'ANSWER · 解析已揭晓' : 'RECALLING · 原声盲听' }}
      </span>
      <span class="step-badge">艾宾浩斯阶段 {{ item.reviewCount }}</span>
    </div>

    <!-- B. 盲听测试阶段 (未揭晓答案时展示) -->
    <div v-if="!isAnswerRevealed" class="test-body-listening animate-fade-in">
      <div class="listening-icon-wrapper">
        <!-- 环形呼吸雷达声波波纹柱 -->
        <div class="audio-waves">
          <span class="wave w1"></span>
          <span class="wave w2"></span>
          <span class="wave w3"></span>
        </div>
        <span class="ear-icon">🎧</span>
      </div>
      <p class="listening-tip">请仔细辨音并回想整句含义...</p>
      
      <!-- 盲听模式音频操作组 -->
      <div class="audio-control-row">
        <button 
          class="audio-accent-btn" 
          :disabled="tts.isLoading.value"
          @click="playTTS(item.text, 'US')" 
          :title="tts.isLoading.value ? '正在加载在线发音...' : '播放美音 (快捷键 Q)'"
        >
          <span v-if="tts.isLoading.value && tts.currentAccent.value === 'US'" class="loading-spinner">⌛</span>
          <span v-else class="speaker-icon">🔊</span>
          {{ tts.isLoading.value && tts.currentAccent.value === 'US' ? '加载中...' : 'US 美音' }}
          <span class="key-hint">Q</span>
        </button>
        <button 
          class="audio-accent-btn uk" 
          :disabled="tts.isLoading.value"
          @click="playTTS(item.text, 'UK')" 
          :title="tts.isLoading.value ? '正在加载在线发音...' : '播放英音 (快捷键 W)'"
        >
          <span v-if="tts.isLoading.value && tts.currentAccent.value === 'UK'" class="loading-spinner">⌛</span>
          <span v-else class="speaker-icon">🔊</span>
          {{ tts.isLoading.value && tts.currentAccent.value === 'UK' ? '加载中...' : 'UK 英音' }}
          <span class="key-hint">W</span>
        </button>
      </div>

      <!-- 揭晓解析触发按钮 -->
      <div class="reveal-action-box">
        <button class="reveal-trigger-btn" @click="revealAnswer">
          <span class="reveal-trigger-icon">🔑</span>
          查看解析
          <span class="btn-shortcut-pill">Space</span>
        </button>
      </div>
    </div>

    <!-- C. 详情揭晓阶段 (已揭晓答案时展示) -->
    <div v-else class="revealed-details-container animate-slide-up">
      <!-- 嵌入完整的 SentenceResult 解析详情卡片 (隐藏收藏按钮，集成朗读、倍速、单词Hover与Badges) -->
      <SentenceResult
        :sentence="item.text"
        :translation="item.translation"
        :words="item.words"
        :isSaved="true"
        :isPlaying="tts.isPlaying.value"
        :playingAccent="tts.currentAccent.value"
        :isLoading="tts.isLoading.value"
        v-model:playRate="tts.playRate.value"
        :translationProvider="storage.settings.value.translationProvider"
        :audioPlaySource="storage.settings.value.audioPlaySource"
        :audioPlayProvider="storage.settings.value.audioPlayProvider"
        :dictionaryProvider="storage.settings.value.dictionaryProvider"
        :showSaveBtn="false"
        :noCardStyle="true"
        :showTopAction="false"
        @play-audio="playTTS(item.text, $event)"
        @play-word-audio="playWordTTS"
      />

      <!-- 分割线 -->
      <div class="detail-divider"></div>

      <!-- 底部快捷评分栏与返回正面按钮 -->
      <div class="review-actions-footer">
        <!-- 返回正面按钮 -->
        <button class="back-to-test-btn" @click="resetToTest" title="返回盲听界面">
          ↩ 返回盲听
        </button>

        <!-- 评分动作按钮组 -->
        <div class="rating-button-group">
          <button class="rate-button forget-btn" @click="handleRate(false)">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
              <circle cx="12" cy="12" r="10"></circle>
              <line x1="15" y1="9" x2="9" y2="15"></line>
              <line x1="9" y1="9" x2="15" y2="15"></line>
            </svg>
            没记住
            <span class="key-hint">1</span>
          </button>

          <button class="rate-button remember-btn" @click="handleRate(true)">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
              <polyline points="20 6 9 17 4 12"></polyline>
            </svg>
            记住了
            <span class="key-hint">2</span>
          </button>
        </div>
      </div>
    </div>

    <!-- D. 自定义轻量非阻断式模态错误提示框 -->
    <div v-if="showErrorModal" class="error-modal-overlay">
      <div class="error-modal-card animate-scale-in">
        <h3 class="error-modal-title">🔇 暂无网络发音</h3>
        <p class="error-modal-body">{{ errorModalMsg || '请稍后重试或检查您的网络。' }}</p>
        <button class="error-modal-confirm-btn" @click="closeErrorModal">好的</button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted, watch } from 'vue';
import { useTTS } from '../composables/useTTS';
import { useStorage } from '../composables/useStorage';
import type { SentenceItem } from '../composables/useStorage';
import SentenceResult from './SentenceResult.vue';

// 定义 Props 接收卡片数据
const props = defineProps<{
  item: SentenceItem
}>();

// 定义 Emits 向父组件派发评分事件
const emit = defineEmits<{
  (e: 'remember', id: string, remembered: boolean): void;
}>();

const isAnswerRevealed = ref(false);
const tts = useTTS();
const storage = useStorage();

const showErrorModal = ref(false);
const errorModalMsg = ref('');

// 监听错误信息，调起模态确认弹窗
watch(() => tts.errorMessage.value, (newVal) => {
  if (newVal) {
    errorModalMsg.value = newVal;
    showErrorModal.value = true;
  }
});

const closeErrorModal = () => {
  showErrorModal.value = false;
  tts.errorMessage.value = ''; // 清空错误以备下次重试
};

// 加载配置
storage.loadSettings();

// 揭晓答案并展现详情
const revealAnswer = () => {
  isAnswerRevealed.value = true;
};

// 返回盲听测试界面
const resetToTest = () => {
  isAnswerRevealed.value = false;
};

// 进行艾宾浩斯复习评分判定
const handleRate = (remembered: boolean) => {
  emit('remember', props.item.id, remembered);
  isAnswerRevealed.value = false;
};

// 朗读整句
const playTTS = (text: string, accent: 'US' | 'UK') => {
  tts.play(text, accent, tts.playRate.value, storage.settings.value.audioPlaySource, storage.settings.value.audioPlayProvider, storage.settings.value.audioTimeout);
};

// 朗读单个单词 (遵循用户全局设置的语速与全局发音服务商)
const playWordTTS = (word: string, accent: 'US' | 'UK') => {
  tts.play(word, accent, tts.playRate.value, storage.settings.value.audioPlaySource, storage.settings.value.audioPlayProvider, storage.settings.value.audioTimeout);
};

// 全局键盘快捷键响应 (Space 揭晓答案/返回，1 和 2 快速数字键评分，Q 和 W 播放美音/英音)
const handleKeyDown = (e: KeyboardEvent) => {
  // 如果错误弹窗处于开启状态，拦截所有热键操作，强迫用户必须确认
  if (showErrorModal.value) {
    e.preventDefault();
    return;
  }

  const activeEl = document.activeElement;
  if (activeEl && (
    activeEl.tagName === 'INPUT' || 
    activeEl.tagName === 'TEXTAREA' || 
    activeEl.getAttribute('contenteditable') === 'true'
  )) {
    return;
  }

  const key = e.key.toLowerCase();
  if (e.code === 'Space') {
    e.preventDefault();
    if (!isAnswerRevealed.value) {
      revealAnswer();
    } else {
      resetToTest();
    }
  } else if (e.key === '1') {
    if (isAnswerRevealed.value) {
      e.preventDefault();
      handleRate(false);
    }
  } else if (e.key === '2') {
    if (isAnswerRevealed.value) {
      e.preventDefault();
      handleRate(true);
    }
  } else if (key === 'q') {
    e.preventDefault();
    if (!tts.isLoading.value) {
      playTTS(props.item.text, 'US');
    }
  } else if (key === 'w') {
    e.preventDefault();
    if (!tts.isLoading.value) {
      playTTS(props.item.text, 'UK');
    }
  }
};

// 监听卡片项切换，重置面板并自动播放新句子音频进行发音盲听预热
watch(() => props.item.id, () => {
  isAnswerRevealed.value = false;
  setTimeout(() => {
    playTTS(props.item.text, storage.settings.value.phoneticAccent);
  }, 350);
});

onMounted(() => {
  window.addEventListener('keydown', handleKeyDown);
  // 初次挂载时自动播放一次，实现发音盲测引导
  setTimeout(() => {
    playTTS(props.item.text, storage.settings.value.phoneticAccent);
  }, 400);
});

onUnmounted(() => {
  window.removeEventListener('keydown', handleKeyDown);
});
</script>

<style scoped>
.review-panel-card {
  width: 100%;
  max-width: 780px;
  margin: 0 auto 40px auto;
  background: var(--glass-bg, rgba(255, 255, 255, 0.02));
  backdrop-filter: var(--glass-blur, blur(20px));
  -webkit-backdrop-filter: var(--glass-blur, blur(20px));
  border: 1px solid var(--glass-border, rgba(255, 255, 255, 0.05));
  border-radius: var(--radius-lg, 16px);
  padding: 20px 24px;       /* 紧凑内边距 */
  box-shadow: var(--glass-shadow, 0 8px 32px rgba(0, 0, 0, 0.15));
  display: flex;
  flex-direction: column;
  gap: 16px;                /* 缩小内部垂直间距 */
  transition: all var(--transition-normal, 0.3s) ease;
}

/* 顶部状态栏 */
.test-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  border-bottom: 1px dashed var(--glass-border, rgba(255, 255, 255, 0.05));
  padding-bottom: 10px;     /* 收窄下边距 */
}

.status-badge {
  font-size: 0.75rem;
  font-weight: 700;
  letter-spacing: 1px;
  color: var(--color-primary, #6366f1);
  background: var(--color-primary-glow, rgba(99, 102, 241, 0.08));
  border: 1px solid rgba(99, 102, 241, 0.2);
  padding: 4px 12px;
  border-radius: 99px;
  transition: all var(--transition-normal, 0.3s) ease;
}

.status-badge.revealed {
  color: var(--color-success, #10b981);
  background: var(--color-success-glow, rgba(16, 185, 129, 0.08));
  border-color: rgba(16, 185, 129, 0.2);
}

.step-badge {
  font-size: 0.75rem;
  color: var(--text-muted, #64748b);
  font-weight: 600;
}

/* 盲听状态测试面板 */
.test-body-listening {
  display: flex;
  flex-direction: column;
  align-items: center;
  text-align: center;
  gap: 16px;                /* 缩小微观间距 */
  padding: 16px 0;          /* 收窄内边距 */
  width: 100%;
}

.listening-icon-wrapper {
  position: relative;
  width: 80px;              /* 缩减耳机雷达盒尺寸 */
  height: 80px;
  background: rgba(99, 102, 241, 0.05);
  border: 1px solid rgba(99, 102, 241, 0.15);
  border-radius: 50%;
  display: flex;
  justify-content: center;
  align-items: center;
  margin-bottom: 0px;       /* 移除冗杂底边距，由父容器gap集中管理 */
}

.ear-icon {
  font-size: 2rem;          /* 微型化耳机图标 */
  z-index: 2;
  animation: float 3s ease-in-out infinite alternate;
}

.listening-tip {
  font-size: 0.95rem;
  color: var(--text-secondary);
  font-weight: 500;
  letter-spacing: 0.5px;
}

/* 听力盲测动画波纹 */
.audio-waves {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  border-radius: 50%;
  pointer-events: none;
}

.wave {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  border-radius: 50%;
  border: 1px solid rgba(99, 102, 241, 0.3);
  animation: sonar 2.5s linear infinite;
  opacity: 0;
}

.w2 {
  animation-delay: 0.8s;
}

.w3 {
  animation-delay: 1.6s;
}

.audio-control-row {
  display: flex;
  gap: 12px;
  margin-top: 8px;
}

.audio-accent-btn {
  background: rgba(255, 255, 255, 0.02);
  color: var(--text-secondary, #94a3b8);
  border: 1px solid var(--glass-border, rgba(255, 255, 255, 0.05));
  padding: 8px 18px;
  border-radius: 99px;
  font-size: 0.85rem;
  font-weight: 600;
  cursor: pointer;
  display: inline-flex;
  align-items: center;
  gap: 8px;
  transition: all var(--transition-fast, 0.2s) ease;
}

.audio-accent-btn:hover {
  background: var(--color-primary-glow, rgba(99, 102, 241, 0.1));
  color: white;
  border-color: var(--color-primary, #6366f1);
  transform: translateY(-1px);
}

.audio-accent-btn.uk:hover {
  background: var(--color-success-glow, rgba(16, 185, 129, 0.1));
  border-color: var(--color-success, #10b981);
}

.speaker-icon {
  font-size: 0.95rem;
}

/* 揭晓答案按钮区 */
.reveal-action-box {
  display: flex;
  justify-content: center;
  padding: 16px 0;
}

.reveal-trigger-btn {
  background: linear-gradient(135deg, rgba(99, 102, 241, 0.15) 0%, rgba(139, 92, 246, 0.15) 100%);
  color: #c7d2fe;
  border: 1px solid rgba(99, 102, 241, 0.4);
  padding: 14px 36px;
  border-radius: 99px;
  font-size: 1.05rem;
  font-weight: 700;
  cursor: pointer;
  display: inline-flex;
  align-items: center;
  gap: 12px;
  transition: all var(--transition-normal, 0.3s) cubic-bezier(0.16, 1, 0.3, 1);
  box-shadow: 0 4px 20px rgba(99, 102, 241, 0.1);
  outline: none;
  position: relative;
  overflow: hidden;
}

.reveal-trigger-btn:hover {
  background: linear-gradient(135deg, var(--color-primary, #6366f1) 0%, #8b5cf6 100%);
  color: white;
  transform: translateY(-2px) scale(1.02);
  box-shadow: 0 8px 30px var(--color-primary-glow, rgba(99, 102, 241, 0.4));
  border-color: var(--color-primary, #6366f1);
}

.reveal-trigger-btn:active {
  transform: translateY(0) scale(1.0);
}

.reveal-trigger-icon {
  font-size: 1.2rem;
  line-height: 1;
}

.btn-shortcut-pill {
  background: rgba(255, 255, 255, 0.12);
  color: rgba(255, 255, 255, 0.8);
  font-size: 0.7rem;
  font-weight: 700;
  padding: 2px 10px;
  border-radius: 6px;
  border: 1px solid rgba(255, 255, 255, 0.15);
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.reveal-trigger-btn:hover .btn-shortcut-pill {
  background: rgba(255, 255, 255, 0.25);
  color: white;
  border-color: rgba(255, 255, 255, 0.4);
}

/* 分割线 */
.detail-divider {
  height: 1px;
  background: linear-gradient(90deg, transparent, var(--glass-border, rgba(255,255,255,0.05)), transparent);
  margin: 4px 0;             /* 收紧上下外边距 */
  border: none;
}

/* 详情容器 */
.revealed-details-container {
  display: flex;
  flex-direction: column;
  gap: 12px;                /* 缩小翻开卡片后的模块间隙 */
}

/* 底部操作区 */
.review-actions-footer {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 16px;
  margin-top: 4px;          /* 缩窄评分栏顶距 */
}

.back-to-test-btn {
  background: rgba(255, 255, 255, 0.02);
  color: var(--text-secondary, #94a3b8);
  border: 1px solid var(--glass-border, rgba(255, 255, 255, 0.05));
  padding: 8px 16px;         /* 紧凑内边距 */
  border-radius: var(--radius-md, 10px);
  font-size: 0.85rem;
  font-weight: 600;
  cursor: pointer;
  transition: all var(--transition-fast, 0.2s) ease;
}

.back-to-test-btn:hover {
  background: rgba(255, 255, 255, 0.06);
  color: white;
  border-color: rgba(255, 255, 255, 0.15);
  transform: translateX(-2px);
}

.rating-button-group {
  display: flex;
  gap: 16px;
  flex: 1;
  justify-content: flex-end;
}

.rate-button {
  flex: 1;
  max-width: 200px;
  padding: 10px 16px;        /* 紧凑内边距 */
  border-radius: var(--radius-md, 10px);
  font-size: 0.85rem;        /* 调小字号 */
  font-weight: 700;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 10px;
  border: 1px solid transparent;
  transition: all var(--transition-fast, 0.2s) ease;
  position: relative;
}

/* 没记住按钮 */
.rate-button.forget-btn {
  background: rgba(244, 63, 94, 0.08);
  color: #fda4af;
  border-color: rgba(244, 63, 94, 0.25);
}

.rate-button.forget-btn:hover {
  background: var(--color-accent, #f43f5e);
  color: white;
  box-shadow: 0 4px 15px var(--color-accent-glow, rgba(244, 63, 94, 0.35));
  transform: translateY(-2px);
  border-color: var(--color-accent, #f43f5e);
}

/* 记住了按钮 */
.rate-button.remember-btn {
  background: rgba(16, 185, 129, 0.08);
  color: #6ee7b7;
  border-color: rgba(16, 185, 129, 0.25);
}

.rate-button.remember-btn:hover {
  background: var(--color-success, #10b981);
  color: white;
  box-shadow: 0 4px 15px var(--color-success-glow, rgba(16, 185, 129, 0.35));
  transform: translateY(-2px);
  border-color: var(--color-success, #10b981);
}

.rate-button:active {
  transform: translateY(0);
}

.rate-button svg {
  width: 16px;
  height: 16px;
}

/* 键盘按键提示 */
.key-hint {
  background: rgba(255, 255, 255, 0.12);
  color: rgba(255, 255, 255, 0.8);
  font-size: 0.65rem;
  font-weight: 800;
  padding: 1px 6px;
  border-radius: 4px;
  border: 1px solid rgba(255, 255, 255, 0.1);
  transition: all var(--transition-fast, 0.2s);
}

.rate-button:hover .key-hint,
.audio-accent-btn:hover .key-hint {
  background: rgba(255, 255, 255, 0.25);
  color: white;
  border-color: rgba(255, 255, 255, 0.4);
}

/* 优雅重置嵌套的 SentenceResult */
:deep(.result-glass-card) {
  background: transparent !important;
  border: none !important;
  padding: 0 !important;
  box-shadow: none !important;
}

:deep(.translation-text) {
  font-size: 1.3rem !important;
  font-weight: 700;
  color: var(--text-primary, white);
  margin-top: 4px;
}

/* 优雅过渡与呼吸动画 */
.animate-fade-in {
  animation: fadeIn 0.45s cubic-bezier(0.16, 1, 0.3, 1) forwards;
}

.animate-slide-up {
  animation: slideUp 0.5s cubic-bezier(0.16, 1, 0.3, 1) forwards;
}

@keyframes fadeIn {
  from { opacity: 0; }
  to { opacity: 1; }
}

@keyframes slideUp {
  from { opacity: 0; transform: translateY(12px); }
  to { opacity: 1; transform: translateY(0); }
}

@keyframes sonar {
  0% {
    transform: scale(1);
    opacity: 0.8;
  }
  100% {
    transform: scale(1.6);
    opacity: 0;
  }
}

@keyframes float {
  0% { transform: translateY(0); }
  100% { transform: translateY(-6px); }
}

/* 沙漏加载旋转 */
.loading-spinner {
  display: inline-block;
  animation: spin 1.2s linear infinite;
  font-size: 0.85rem;
}

@keyframes spin {
  0% { transform: rotate(0deg); }
  100% { transform: rotate(360deg); }
}

/* 按钮禁用状态样式（在线加载中） */
.audio-accent-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
  transform: none !important;
  background: rgba(255, 255, 255, 0.01) !important;
  border-color: rgba(255, 255, 255, 0.05) !important;
  color: var(--text-muted, #64748b) !important;
}

.audio-accent-btn:disabled .key-hint {
  opacity: 0.3;
}

/* 自定义模态错误框遮罩 */
.error-modal-overlay {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(15, 23, 42, 0.45); /* 降低暗色蒙层浓度，减弱压抑感 */
  backdrop-filter: blur(6px);
  display: flex;
  justify-content: center;
  align-items: center;
  z-index: 999;
  border-radius: var(--radius-lg, 16px);
}

/* 模态卡片 */
.error-modal-card {
  background: rgba(30, 41, 59, 0.92);
  border: 1px solid rgba(255, 255, 255, 0.08); /* 采用高级淡灰色边框代替红色警报边框 */
  box-shadow: 0 16px 36px rgba(0, 0, 0, 0.35);
  padding: 20px 24px;
  border-radius: var(--radius-md, 12px);
  width: 85%;
  max-width: 270px; /* 更加轻量紧凑 */
  text-align: center;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 10px;
}

.error-modal-title {
  font-size: 1.0rem;
  font-weight: 700;
  color: #e2e8f0; /* 温和中性的亮灰色代替刺眼淡红色 */
  margin: 0;
  display: flex;
  align-items: center;
  gap: 6px;
}

.error-modal-body {
  font-size: 0.82rem;
  color: #94a3b8;
  margin: 0 0 4px 0;
  line-height: 1.5;
  word-break: break-all;
}

/* 自定义确认按钮（温和的非警告样式） */
.error-modal-confirm-btn {
  background: rgba(255, 255, 255, 0.06);
  color: #f1f5f9;
  border: 1px solid rgba(255, 255, 255, 0.08);
  padding: 6px 20px;
  border-radius: 6px;
  font-size: 0.85rem;
  font-weight: 600;
  cursor: pointer;
  width: 100%;
  transition: all var(--transition-fast, 0.2s) ease;
}

.error-modal-confirm-btn:hover {
  background: rgba(255, 255, 255, 0.12);
  border-color: rgba(255, 255, 255, 0.18);
  transform: translateY(-1px);
}

.error-modal-confirm-btn:active {
  transform: translateY(0);
}

/* 缩放动画 */
.animate-scale-in {
  animation: scaleIn 0.3s cubic-bezier(0.34, 1.56, 0.64, 1) forwards;
}

@keyframes scaleIn {
  from {
    transform: scale(0.9);
    opacity: 0;
  }
  to {
    transform: scale(1);
    opacity: 1;
  }
}
</style>
