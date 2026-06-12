<template>
  <div class="review-panel-card animate-fade-in">
    <!-- A. 状态页眉 -->
    <div class="test-header">
      <span class="status-badge" :class="{ 'revealed': isAnswerRevealed }">
        {{ isAnswerRevealed ? 'ANSWER · 智能解析已揭晓' : 'RECALLING · 英文原声盲听中' }}
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
      <p class="listening-tip">正在播放英文原声，请仔细辨音并回想整句含义...</p>
      
      <!-- 盲听模式音频操作组 -->
      <div class="audio-control-row">
        <button class="audio-accent-btn" @click="playTTS(item.text, 'US')" title="播放美式发音">
          <span class="speaker-icon">🔊</span> US 美音再次播放
        </button>
        <button class="audio-accent-btn uk" @click="playTTS(item.text, 'UK')" title="播放英式发音">
          <span class="speaker-icon">🔊</span> UK 英音再次播放
        </button>
      </div>

      <!-- 揭晓解析触发按钮 -->
      <div class="reveal-action-box">
        <button class="reveal-trigger-btn" @click="revealAnswer">
          <span class="reveal-trigger-icon">🔑</span>
          看原句与智能解析结果
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
        v-model:playRate="tts.playRate.value"
        :translationProvider="storage.settings.value.translationProvider"
        :audioPlaySource="storage.settings.value.audioPlaySource"
        :audioPlayProvider="storage.settings.value.audioPlayProvider"
        :dictionaryProvider="storage.settings.value.dictionaryProvider"
        :showSaveBtn="false"
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
            没记住，需强化
            <span class="key-hint">1</span>
          </button>

          <button class="rate-button remember-btn" @click="handleRate(true)">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
              <polyline points="20 6 9 17 4 12"></polyline>
            </svg>
            记住了，下一关
            <span class="key-hint">2</span>
          </button>
        </div>
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

// 全局键盘快捷键响应 (Space 揭晓答案/返回，1 和 2 快速数字键评分)
const handleKeyDown = (e: KeyboardEvent) => {
  const activeEl = document.activeElement;
  if (activeEl && (
    activeEl.tagName === 'INPUT' || 
    activeEl.tagName === 'TEXTAREA' || 
    activeEl.getAttribute('contenteditable') === 'true'
  )) {
    return;
  }

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
  margin: 0 auto;
  background: var(--glass-bg, rgba(255, 255, 255, 0.02));
  backdrop-filter: var(--glass-blur, blur(20px));
  -webkit-backdrop-filter: var(--glass-blur, blur(20px));
  border: 1px solid var(--glass-border, rgba(255, 255, 255, 0.05));
  border-radius: var(--radius-lg, 16px);
  padding: 32px;
  box-shadow: var(--glass-shadow, 0 8px 32px rgba(0, 0, 0, 0.15));
  display: flex;
  flex-direction: column;
  gap: 24px;
  transition: all var(--transition-normal, 0.3s) ease;
}

/* 顶部状态栏 */
.test-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  border-bottom: 1px dashed var(--glass-border, rgba(255, 255, 255, 0.05));
  padding-bottom: 14px;
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
  gap: 20px;
  padding: 24px 0;
  width: 100%;
}

.listening-icon-wrapper {
  position: relative;
  width: 100px;
  height: 100px;
  background: rgba(99, 102, 241, 0.05);
  border: 1px solid rgba(99, 102, 241, 0.15);
  border-radius: 50%;
  display: flex;
  justify-content: center;
  align-items: center;
  margin-bottom: 8px;
}

.ear-icon {
  font-size: 2.5rem;
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
  margin: 8px 0;
  border: none;
}

/* 详情容器 */
.revealed-details-container {
  display: flex;
  flex-direction: column;
  gap: 20px;
}

/* 底部操作区 */
.review-actions-footer {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 16px;
  margin-top: 8px;
}

.back-to-test-btn {
  background: rgba(255, 255, 255, 0.02);
  color: var(--text-secondary, #94a3b8);
  border: 1px solid var(--glass-border, rgba(255, 255, 255, 0.05));
  padding: 10px 20px;
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
  padding: 12px 20px;
  border-radius: var(--radius-md, 10px);
  font-size: 0.9rem;
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

.rate-button:hover .key-hint {
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
</style>
