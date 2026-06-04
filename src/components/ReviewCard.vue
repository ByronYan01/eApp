<template>
  <div class="review-panel-card animate-fade-in">
    <!-- A. 盲听测试区域 (常驻顶部，大方美观) -->
    <div class="test-header">
      <span class="status-badge" :class="{ 'revealed': isAnswerRevealed }">
        {{ isAnswerRevealed ? 'ANSWER · 核心释义' : 'RECALLING · 盲测尝试回想' }}
      </span>
      <span class="step-badge">艾宾浩斯阶段 {{ item.reviewCount }}</span>
    </div>

    <div class="test-body">
      <!-- 英文整句模糊指示标签 (新增，极具现代指引性) -->
      <span class="blur-tip-label animate-fade-in" v-if="!isTextRevealed && !isAnswerRevealed">
        🔒 英文整句已施加模糊遮罩 · 点击句子可临时显形
      </span>
      <span class="blur-tip-label success animate-pulse" v-else-if="isTextRevealed && !isAnswerRevealed">
        🔓 临时显形中 · 再次点击可重新施加模糊
      </span>
      <span class="blur-tip-label success animate-fade-in" v-else>
        🔓 解析已揭晓 · 句子已完全显示
      </span>

      <!-- 英文大字号句子展示 (增加 class 绑定与点击临时显形，防止事件冒泡) -->
      <h2 
        class="english-text selectable" 
        :class="{ 'is-blurred': !isTextRevealed && !isAnswerRevealed }"
        @click.stop="isTextRevealed = !isTextRevealed"
        title="点击临时显示/隐藏英文原句"
      >
        {{ item.text }}
      </h2>
      
      <!-- 听力盲测播放组 -->
      <div class="audio-control-row">
        <button class="audio-accent-btn" @click="playTTS(item.text, 'US')" title="播放美式发音">
          <span class="speaker-icon">🔊</span> US 美音
        </button>
        <button class="audio-accent-btn uk" @click="playTTS(item.text, 'UK')" title="播放英式发音">
          <span class="speaker-icon">🔊</span> UK 英音
        </button>
      </div>
    </div>

    <!-- B. 未揭晓时：显示大大的毛玻璃渐变发光“揭晓”按钮 -->
    <div v-if="!isAnswerRevealed" class="reveal-action-box">
      <button class="reveal-trigger-btn" @click="revealAnswer">
        <span class="reveal-trigger-icon">🔑</span>
        揭晓答案与智能解析
        <span class="btn-shortcut-pill">Space</span>
      </button>
    </div>

    <!-- C. 已揭晓时：渐进式淡入平铺展开 SentenceResult 和 评分条 -->
    <div v-else class="revealed-details-container animate-slide-up">
      <!-- 分割线 -->
      <div class="detail-divider"></div>

      <!-- 嵌入完整的 SentenceResult 解析详情卡片 (隐藏收藏按钮，保留整句朗读、语速调节、单词Hover与Badges) -->
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
        <button class="back-to-test-btn" @click="resetToTest" title="返回盲测界面">
          ↩ 返回盲测
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
const isTextRevealed = ref(false); // 新增：控制原句是否显形 (默认高斯模糊遮蔽)
const tts = useTTS();
const storage = useStorage();

// 加载配置
storage.loadSettings();

// 揭晓答案并自动显形
const revealAnswer = () => {
  isAnswerRevealed.value = true;
  isTextRevealed.value = true;
};

// 返回盲听测试界面
const resetToTest = () => {
  isAnswerRevealed.value = false;
  isTextRevealed.value = false;
};

// 进行艾宾浩斯复习评分判定
const handleRate = (remembered: boolean) => {
  emit('remember', props.item.id, remembered);
  isAnswerRevealed.value = false;
  isTextRevealed.value = false;
};

// 朗读整句句子
const playTTS = (text: string, accent: 'US' | 'UK') => {
  tts.play(text, accent, tts.playRate.value, storage.settings.value.audioPlaySource, storage.settings.value.audioPlayProvider);
};

// 朗读单个单词 (同样采用 1.0x 标准语速与全局发音服务商)
const playWordTTS = (word: string, accent: 'US' | 'UK') => {
  tts.play(word, accent, 1.0, storage.settings.value.audioPlaySource, storage.settings.value.audioPlayProvider);
};

// 全局键盘快捷键响应 (Space 揭晓答案/返回，1 和 2 快速数字键评分，实现神级流畅度)
const handleKeyDown = (e: KeyboardEvent) => {
  // 严密防冲突：若当前焦点在任何输入框中，不拦截快捷键
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
  isTextRevealed.value = false;
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

/* 盲测正文区 */
.test-body {
  display: flex;
  flex-direction: column;
  align-items: center;
  text-align: center;
  gap: 16px;
  padding: 12px 0;
}

/* 英文大字号句子展示及高斯模糊遮盖 */
.english-text {
  font-size: 2rem;
  font-weight: 700;
  line-height: 1.4;
  color: var(--text-primary, white);
  word-wrap: break-word;
  max-width: 100%;
  transition: filter 0.3s cubic-bezier(0.16, 1, 0.3, 1), opacity 0.3s ease;
  cursor: pointer;
}

.english-text.is-blurred {
  filter: blur(12px);
  opacity: 0.55;
  user-select: none;
  -webkit-user-select: none;
}

.english-text.is-blurred:hover {
  filter: blur(9px);
  opacity: 0.75;
}

/* 模糊提示指示标签 */
.blur-tip-label {
  font-size: 0.7rem;
  font-weight: 700;
  color: #a5b4fc;
  background: rgba(99, 102, 241, 0.08);
  border: 1px solid rgba(99, 102, 241, 0.15);
  padding: 3px 10px;
  border-radius: 4px;
  letter-spacing: 0.5px;
  transition: all 0.3s ease;
}

.blur-tip-label.success {
  color: #a7f3d0;
  background: rgba(16, 185, 129, 0.08);
  border-color: rgba(16, 185, 129, 0.15);
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

.animate-pulse {
  animation: pulse 2.2s cubic-bezier(0.4, 0, 0.6, 1) infinite;
}

@keyframes fadeIn {
  from { opacity: 0; }
  to { opacity: 1; }
}

@keyframes slideUp {
  from { opacity: 0; transform: translateY(12px); }
  to { opacity: 1; transform: translateY(0); }
}

@keyframes pulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.6; }
}
</style>
