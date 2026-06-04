<template>
  <div class="app-window">
    <!-- 1. 缓缓漂移的发光微粒背景 -->
    <div class="bg-glow-orb-1"></div>
    <div class="bg-glow-orb-2"></div>

    <!-- 2. 主页面骨架 -->
    <div class="app-layout">
      
      <!-- 顶部毛玻璃导航栏 (添加 data-tauri-drag-region 支持窗口拖动) -->
      <header class="app-header" data-tauri-drag-region>
        <div class="brand" data-tauri-drag-region>
          <span class="brand-logo">e</span>
          <h1 class="brand-title" data-tauri-drag-region>eApp <span class="badge">English</span></h1>
        </div>
        
        <nav class="nav-tabs">
          <button 
            v-for="tab in tabs" 
            :key="tab.id"
            class="tab-btn" 
            :class="{ 'active': currentTab === tab.id }"
            @click="currentTab = tab.id"
          >
            <span class="tab-icon" v-html="tab.icon"></span>
            {{ tab.name }}
            <span v-if="tab.id === 'review' && reviewQueueCount > 0" class="badge-count">
              {{ reviewQueueCount }}
            </span>
          </button>
        </nav>
      </header>

      <!-- 3. 主视图内容区域 -->
      <main class="app-content">
        <KeepAlive>
          <Transition name="fade" mode="out-in">
            
            <!-- A. 智能解析视图 -->
            <div v-if="currentTab === 'analyze'" class="tab-content-view">
              <div class="center-box">
                <h2 class="section-headline">英语句子智能解析</h2>
                <p class="section-subtitle">输入您在阅读或听力中遇到的英语句子，秒级获取精准翻译、标准音标及逐词悬浮解析。</p>
                
                <SentenceInput 
                  :loading="parsing" 
                  @submit="handleAnalyzeSentence" 
                />

                <div class="result-mount-point" v-if="parsedResult || parsing">
                  <div v-if="parsing" class="loading-card">
                    <span class="loading-spinner"></span>
                    <p>正在分析句子结构并查询国际音标中...</p>
                  </div>
                  
                  <SentenceResult
                    v-else-if="parsedResult"
                    :sentence="parsedResult.text"
                    :translation="parsedResult.translation"
                    :words="parsedResult.words"
                    :isSaved="isCurrentSentenceSaved"
                    :isPlaying="tts.isPlaying.value"
                    :playingAccent="tts.currentAccent.value"
                    v-model:playRate="tts.playRate.value"
                    :translationProvider="storage.settings.value.translationProvider"
                    :audioPlaySource="storage.settings.value.audioPlaySource"
                    :audioPlayProvider="storage.settings.value.audioPlayProvider"
                    :dictionaryProvider="storage.settings.value.dictionaryProvider"
                    @toggle-save="handleToggleSaveCurrent"
                    @play-audio="handlePlayParsedAudio"
                    @play-word-audio="handlePlayWordAudio"
                  />
                </div>
              </div>
            </div>

            <!-- B. 艾宾浩斯智能复习视图 -->
            <div v-else-if="currentTab === 'review'" class="tab-content-view">
              <div class="center-box">
                <h2 class="section-headline">艾宾浩斯智能复习</h2>
                <p class="section-subtitle">基于记忆遗忘曲线，为您筛选出今日到期需要强化的句子，通过 3D 卡片进行高效盲测复习。</p>

                <!-- 当前有需要复习的卡片 -->
                <div v-if="currentReviewItem" class="review-zone">
                  <div class="progress-bar-container">
                    <div class="progress-bar-fill" :style="{ width: `${reviewProgressPercentage}%` }"></div>
                    <span class="progress-text">本轮剩余 {{ reviewQueue.length }} 个待复习</span>
                  </div>
                  
                  <ReviewCard 
                    :key="currentReviewItem.id"
                    :item="currentReviewItem"
                    @remember="handleReviewFeedback"
                  />
                </div>

                <!-- 暂无需要复习的卡片 -->
                <div v-else class="empty-state-card">
                  <div class="coffee-icon">☕</div>
                  <h3>太棒了，目前没有到期的复习任务！</h3>
                  <p>您收藏的句子都处于记忆安全期。可以去【智能解析】添加新句子，或者到【句子仓库】中手动浏览。</p>
                </div>
              </div>
            </div>

            <!-- C. 句子仓库列表视图 -->
            <div v-else-if="currentTab === 'repo'" class="tab-content-view">
              <div class="repo-header-row">
                <div>
                  <h2 class="section-headline">我的句子仓库 ({{ sentences.length }})</h2>
                  <p class="section-subtitle">管理您收藏的所有英语句子，支持一键备份导出和导入恢复。</p>
                </div>
                
                <!-- 备份管理按钮组 -->
                <div class="backup-actions">
                  <button class="backup-btn export" @click="storage.exportData" title="备份到本地 JSON">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M17 8l-5-5-5 5M12 3v12"/>
                    </svg>
                    导出备份
                  </button>
                  
                  <label class="backup-btn import" title="从 JSON 备份中恢复">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 15V3"/>
                    </svg>
                    导入备份
                    <input type="file" accept=".json" @change="handleImportBackup" style="display: none;" />
                  </label>
                </div>
              </div>

              <!-- 句子列表流 -->
              <div v-if="sentences.length > 0" class="repo-list">
                <div 
                  v-for="item in sentences" 
                  :key="item.id" 
                  class="sentence-repo-card"
                  :class="{ 'is-expanded': expandedSentenceId === item.id }"
                >
                  <div class="repo-card-main">
                    <div class="repo-card-text selectable">{{ item.text }}</div>
                    <div class="repo-card-translation selectable">{{ item.translation }}</div>

                    <!-- 智能解析展开部分 -->
                    <Transition name="expand">
                      <div v-if="expandedSentenceId === item.id" class="repo-card-detail">
                        <div class="detail-divider"></div>
                        
                        <!-- 1. 英文原句智能解析区 (悬浮查词) -->
                        <div class="detail-section">
                          <h4 class="detail-title">智能解析 (单词悬浮查词)：</h4>
                          <div class="detail-interactive-box">
                            <InteractiveSentence 
                              :words="item.words" 
                              fontSize="1.3rem"
                              @play-word-audio="handlePlayWordAudio"
                            />
                          </div>
                        </div>

                        <!-- 2. 整句连读音标 -->
                        <div v-if="item.phonetics" class="detail-section">
                          <div class="detail-phonetics">
                            整句连读音标：<span>{{ item.phonetics }}</span>
                          </div>
                        </div>

                        <!-- 3. 重点词汇分析列表 -->
                        <div v-if="item.words && item.words.length > 0" class="detail-section">
                          <h4 class="detail-title">重点词汇释义：</h4>
                          <div class="detail-words-grid">
                            <div 
                              v-for="word in item.words.filter(w => w.clean && w.explain && w.explain !== '暂无单词释义' && w.explain !== '查询失败')" 
                              :key="word.clean" 
                              class="detail-word-chip"
                            >
                              <div class="chip-word-header">
                                <span class="chip-word-name">{{ word.clean }}</span>
                                <span class="chip-word-phonetic" v-if="word.phonetic">{{ word.phonetic }}</span>
                                <div class="chip-word-speakers">
                                  <button class="chip-speaker-btn" @click.stop="handlePlayWordAudio(word.clean, 'US')" title="美音发音">US 🔊</button>
                                  <button class="chip-speaker-btn" @click.stop="handlePlayWordAudio(word.clean, 'UK')" title="英音发音">UK 🔊</button>
                                </div>
                              </div>
                              <p class="chip-word-explain">{{ word.explain }}</p>
                            </div>
                          </div>
                        </div>
                      </div>
                    </Transition>

                    <div class="repo-card-meta">
                      <span class="meta-tag" :class="item.status">
                        {{ item.status === 'learning' ? '学习中' : '已掌握' }}
                      </span>
                      <span class="meta-time">添加于: {{ formatDate(item.addedAt) }}</span>
                      <span class="meta-count">复戏次数: {{ item.reviewCount }}</span>
                      
                      <!-- 增加展开/收起文字提示按钮 -->
                      <button 
                        class="meta-expand-toggle-btn"
                        @click="toggleExpandSentence(item.id)"
                      >
                        {{ expandedSentenceId === item.id ? '收起解析 ▲' : '查看解析详情 ▼' }}
                      </button>
                    </div>
                  </div>
                  
                  <div class="repo-card-actions">
                    <!-- 解析详情切换按钮 (新增) -->
                    <button 
                      class="action-circle-btn info"
                      :class="{ 'active': expandedSentenceId === item.id }"
                      @click="toggleExpandSentence(item.id)"
                      :title="expandedSentenceId === item.id ? '收起解析' : '查看解析详情'"
                    >
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <circle cx="11" cy="11" r="8"></circle>
                        <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
                        <line x1="11" y1="8" x2="11" y2="14"></line>
                        <line x1="8" y1="11" x2="14" y2="11"></line>
                      </svg>
                    </button>
                    <!-- 朗读按钮 (同步首选口音、发音通道配置与发音服务商) -->
                    <button 
                      class="action-circle-btn" 
                      @click="tts.play(item.text, storage.settings.value.phoneticAccent, tts.playRate.value, storage.settings.value.audioPlaySource, storage.settings.value.audioPlayProvider)" 
                      title="朗读句子"
                    >
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"></polygon>
                        <path d="M15.54 8.46a5 5 0 0 1 0 7.07"></path>
                      </svg>
                    </button>
                    <!-- 切换掌握状态 -->
                    <button 
                      class="action-circle-btn check" 
                      :class="{ 'active': item.status === 'mastered' }"
                      @click="storage.toggleStatus(item.id)"
                      :title="item.status === 'mastered' ? '设为学习中' : '设为已掌握'"
                    >
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
                        <polyline points="20 6 9 17 4 12"></polyline>
                      </svg>
                    </button>
                    <!-- 删除按钮 -->
                    <button class="action-circle-btn trash" @click="storage.deleteSentence(item.id)" title="删除句子">
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <polyline points="3 6 5 6 21 6"></polyline>
                        <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                      </svg>
                    </button>
                  </div>
                </div>
              </div>

              <!-- 空库提示 -->
              <div v-else class="empty-state-card">
                <div class="box-icon">📦</div>
                <h3>您的句子仓库空空如也</h3>
                <p>在【智能解析】中输入任何句子，并点击“加入复习列表”，您便能在此处统一管理它们，并开启智能复习。</p>
              </div>
            </div>

            <!-- D. 系统设置视图 -->
            <div v-else-if="currentTab === 'settings'" class="tab-content-view animate-fade-in">
              <div class="center-box">
                <h2 class="section-headline">系统个性化设置</h2>
                <p class="section-subtitle">自定义您的音标口音、发音音频通道及兜底机制，打造最贴合您学习习惯的智能英语工具。</p>

                <div class="settings-container">
                  <!-- 设置卡片 1：音标与口音 -->
                  <div class="settings-card">
                    <div class="card-icon">🔤</div>
                    <div class="settings-group">
                      <h3>国际音标配置</h3>
                      <p class="group-desc">配置查词和句子解析时所展现的国际音标口音。</p>
                      
                      <div class="setting-item">
                        <span class="setting-label">首选音标口音</span>
                        <div class="toggle-buttons">
                          <button 
                            class="toggle-choice-btn" 
                            :class="{ 'active': storage.settings.value.phoneticAccent === 'US' }"
                            @click="updateSetting('phoneticAccent', 'US')"
                          >
                            美式音标 (US)
                          </button>
                          <button 
                            class="toggle-choice-btn" 
                            :class="{ 'active': storage.settings.value.phoneticAccent === 'UK' }"
                            @click="updateSetting('phoneticAccent', 'UK')"
                          >
                            英式音标 (UK)
                          </button>
                        </div>
                      </div>

                      <div class="setting-item flex-column">
                        <div class="setting-header">
                          <span class="setting-label">音标降级策略</span>
                          <label class="switch">
                            <input 
                              type="checkbox" 
                              :checked="storage.settings.value.allowPhoneticFallback"
                              @change="updateSetting('allowPhoneticFallback', !storage.settings.value.allowPhoneticFallback)"
                            />
                            <span class="slider round"></span>
                          </label>
                        </div>
                        <p class="setting-hint">
                          开启时，若所选口音的音标缺失，将自动降级使用另一种口音或通用音标进行兜底；关闭时，对于查无此口音音标的单词将严格显示为 <strong>[无美音]</strong> 或 <strong>[无英音]</strong>，以防止口音混淆。
                        </p>
                      </div>
                    </div>
                  </div>

                  <!-- 设置卡片 2：音频与发音 -->
                  <div class="settings-card">
                    <div class="card-icon">🔊</div>
                    <div class="settings-group">
                      <h3>发音音频配置</h3>
                      <p class="group-desc">配置播放朗读句子与单词时所调用的声音引擎方式。</p>

                      <div class="setting-item">
                        <span class="setting-label">发音音频源</span>
                        <div class="toggle-buttons">
                          <button 
                            class="toggle-choice-btn" 
                            :class="{ 'active': storage.settings.value.audioPlaySource === 'local' }"
                            @click="updateSetting('audioPlaySource', 'local')"
                          >
                            系统本地发音 (TTS)
                          </button>
                          <button 
                            class="toggle-choice-btn" 
                            :class="{ 'active': storage.settings.value.audioPlaySource === 'online' }"
                            @click="updateSetting('audioPlaySource', 'online')"
                          >
                            在线真人原声
                          </button>
                        </div>
                      </div>

                      <div class="setting-item flex-column">
                        <p class="setting-hint font-small">
                          <strong>系统本地发音</strong>：直接调用您操作系统内置的语音合成人引擎（免除联网，毫秒级响应，即使无网也可用）。<br/>
                          <strong>在线真人原声</strong>：通过强大的后台代理获取标准真人英语发声，发音极其纯正自然。
                        </p>
                      </div>
                    </div>
                  </div>

                  <!-- 设置卡片 3：服务商与引擎配置 (新增) -->
                  <div class="settings-card">
                    <div class="card-icon">⚙️</div>
                    <div class="settings-group">
                      <h3>服务商与引擎配置</h3>
                      <p class="group-desc">自定义整句翻译、在线真人音频以及查词音标释义所调用的云端服务商。</p>

                      <!-- 1. 翻译提供商 -->
                      <div class="setting-item">
                        <span class="setting-label">整句翻译服务商</span>
                        <div class="toggle-buttons">
                          <button 
                            class="toggle-choice-btn" 
                            :class="{ 'active': storage.settings.value.translationProvider === 'google' }"
                            @click="updateSetting('translationProvider', 'google')"
                          >
                            谷歌智能云 (Google)
                          </button>
                          <button 
                            class="toggle-choice-btn" 
                            :class="{ 'active': storage.settings.value.translationProvider === 'youdao' }"
                            @click="updateSetting('translationProvider', 'youdao')"
                          >
                            有道精品 (Youdao)
                          </button>
                          <button 
                            class="toggle-choice-btn" 
                            :class="{ 'active': storage.settings.value.translationProvider === 'baidu' }"
                            @click="updateSetting('translationProvider', 'baidu')"
                          >
                            百度翻译 (Baidu)
                          </button>
                        </div>
                      </div>

                      <!-- 2. 发音提供商 (仅在开启在线真人原声时显示，极为严谨) -->
                      <div class="setting-item" v-if="storage.settings.value.audioPlaySource === 'online'">
                        <span class="setting-label">在线发音引擎</span>
                        <div class="toggle-buttons">
                          <button 
                            class="toggle-choice-btn" 
                            :class="{ 'active': storage.settings.value.audioPlayProvider === 'auto' }"
                            @click="updateSetting('audioPlayProvider', 'auto')"
                          >
                            智能兜底 (Auto)
                          </button>
                          <button 
                            class="toggle-choice-btn" 
                            :class="{ 'active': storage.settings.value.audioPlayProvider === 'youdao' }"
                            @click="updateSetting('audioPlayProvider', 'youdao')"
                          >
                            有道原声
                          </button>
                          <button 
                            class="toggle-choice-btn" 
                            :class="{ 'active': storage.settings.value.audioPlayProvider === 'google' }"
                            @click="updateSetting('audioPlayProvider', 'google')"
                          >
                            谷歌朗读
                          </button>
                          <button 
                            class="toggle-choice-btn" 
                            :class="{ 'active': storage.settings.value.audioPlayProvider === 'baidu' }"
                            @click="updateSetting('audioPlayProvider', 'baidu')"
                          >
                            百度发音
                          </button>
                        </div>
                      </div>

                      <!-- 3. 词典音标源提供商 -->
                      <div class="setting-item">
                        <span class="setting-label">音标释义词典源</span>
                        <div class="toggle-buttons">
                          <button 
                            class="toggle-choice-btn" 
                            :class="{ 'active': storage.settings.value.dictionaryProvider === 'youdao' }"
                            @click="updateSetting('dictionaryProvider', 'youdao')"
                          >
                            有道权威词库
                          </button>
                          <button 
                            class="toggle-choice-btn" 
                            :class="{ 'active': storage.settings.value.dictionaryProvider === 'eudic' }"
                            @click="updateSetting('dictionaryProvider', 'eudic')"
                          >
                            欧路词库 (Eudic)
                          </button>
                        </div>
                      </div>

                      <!-- 4. 欧路云词库的 API Token 授权输入框 (带高颜值淡入动画) -->
                      <Transition name="slide-fade">
                        <div class="setting-item flex-column border-top" v-if="storage.settings.value.dictionaryProvider === 'eudic'">
                          <div class="setting-header">
                            <span class="setting-label">欧路 Developer Token</span>
                          </div>
                          <input 
                            type="password" 
                            class="token-input animate-fade-in" 
                            :value="storage.settings.value.eudicToken"
                            @input="handleTokenInput"
                            placeholder="请输入您在欧路平台申请的 Developer Token"
                          />
                          <p class="setting-hint font-small">
                            使用欧路权威库需先到 <a href="https://open.eudic.net/" target="_blank" class="text-link">欧路开放平台</a> 免费申请授权 Token；置空或未申请时，系统将动态兜底使用有道词库。
                          </p>
                        </div>
                      </Transition>
                    </div>
                  </div>

                  <!-- 重置按钮 -->
                  <div class="settings-footer">
                    <button class="reset-btn" @click="resetToDefaultSettings">
                      恢复默认配置
                    </button>
                  </div>
                </div>
              </div>
            </div>

          </Transition>
        </KeepAlive>
      </main>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue';
import { useStorage, type AppSettings } from './composables/useStorage';
import { useTTS } from './composables/useTTS';
import { translateSentence, parseSentenceWords } from './services/youdao';
import SentenceInput from './components/SentenceInput.vue';
import SentenceResult from './components/SentenceResult.vue';
import ReviewCard from './components/ReviewCard.vue';
import InteractiveSentence from './components/InteractiveSentence.vue';

// 页面 Tab 选项配置 (新增“系统设置”选项，配置高颜值极简 SVG)
const tabs = [
  { id: 'analyze', name: '智能解析', icon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"></circle><line x1="2" y1="12" x2="22" y2="12"></line><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"></path></svg>' },
  { id: 'review', name: '卡片复习', icon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"></path><line x1="12" y1="9" x2="12" y2="13"></line><line x1="12" y1="17" x2="12.01" y2="17"></line></svg>' },
  { id: 'repo', name: '句子仓库', icon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"></path><polyline points="3.27 6.96 12 12.01 20.73 6.96"></polyline><line x1="12" y1="22.08" x2="12" y2="12"></line></svg>' },
  { id: 'settings', name: '系统设置', icon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="3"></circle><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"></path></svg>' }
];

const currentTab = ref('analyze');
const storage = useStorage();
const tts = useTTS();

const { sentences, loadData } = storage;

// 句子仓库中当前被展开显示解析详情的句子 ID
const expandedSentenceId = ref<string | null>(null);

// 切换句子仓库中卡片的展开/收起状态
const toggleExpandSentence = (id: string) => {
  if (expandedSentenceId.value === id) {
    expandedSentenceId.value = null;
  } else {
    expandedSentenceId.value = id;
  }
};

// 句子智能解析过程中的响应式状态
const parsing = ref(false);
const parsedResult = ref<{
  text: string;
  translation: string;
  phonetics: string;
  words: any[];
} | null>(null);

// 用于计算复习轮次的基数
const initialReviewQueueLength = ref(0);

// 用于计算复习队列中的当前到期需要进行艾宾浩斯复习的句子队列
const reviewQueue = computed(() => {
  return sentences.value.filter(item => {
    // 必须是学习中状态，且当前时间大于或等于计算出的下一次复习时间
    return item.status === 'learning' && item.nextReviewTime <= Date.now();
  });
});

const reviewQueueCount = computed(() => reviewQueue.value.length);

// 获取复习队列中的当前第一个句子卡片
const currentReviewItem = computed(() => {
  if (reviewQueue.value.length === 0) return null;
  return reviewQueue.value[0];
});

// 计算本轮复习进度百分比
const reviewProgressPercentage = computed(() => {
  if (initialReviewQueueLength.value === 0) return 100;
  const completed = initialReviewQueueLength.value - reviewQueue.value.length;
  return Math.min(100, Math.round((completed / initialReviewQueueLength.value) * 100));
});

// 监听复习队列，动态更新初始轮次基数
const updateReviewQueueBase = () => {
  if (reviewQueue.value.length > initialReviewQueueLength.value) {
    initialReviewQueueLength.value = reviewQueue.value.length;
  } else if (reviewQueue.value.length === 0) {
    initialReviewQueueLength.value = 0;
  }
};

/**
 * 2. 检查解析面板中的句子是否已经在收藏仓库中
 */
const isCurrentSentenceSaved = computed(() => {
  if (!parsedResult.value) return false;
  return sentences.value.some(s => s.text.toLowerCase() === parsedResult.value!.text.toLowerCase());
});

/**
 * 3. 提交解析英语句子任务
 */
const handleAnalyzeSentence = async (text: string) => {
  if (parsing.value) return;
  parsing.value = true;
  parsedResult.value = null;
  
  try {
    // 并行获取整句中文翻译与单词拆解音标释义 (传入全局设置以应用对应的音标、降级偏好，并带上指定翻译提供商)
    const [translation, words] = await Promise.all([
      translateSentence(text, storage.settings.value.translationProvider),
      parseSentenceWords(text, storage.settings.value)
    ]);
    
    // 生成整句音标连读 (若单词是“无美音/无英音”的，不予拼入)
    const list = words
      .filter(w => w.phonetic && !w.phonetic.includes('无'))
      .map(w => w.phonetic);
    const phonetics = list.length > 0 ? `/[ ${list.join(' ')} ]/` : '';

    parsedResult.value = {
      text,
      translation,
      phonetics,
      words
    };

    // 根据用户首选的口音、音频播放源及发音引擎，自动朗读一次新句子，增强即时反馈体验
    setTimeout(() => {
      tts.play(
        text, 
        storage.settings.value.phoneticAccent, 
        tts.playRate.value, 
        storage.settings.value.audioPlaySource,
        storage.settings.value.audioPlayProvider
      );
    }, 400);

  } catch (error) {
    console.error('智能解析失败:', error);
  } finally {
    parsing.value = false;
  }
};

/**
 * 4. 智能解析页面的收藏与移除切换
 */
const handleToggleSaveCurrent = () => {
  if (!parsedResult.value) return;

  if (isCurrentSentenceSaved.value) {
    // 已收藏，则移除
    const found = sentences.value.find(s => s.text.toLowerCase() === parsedResult.value!.text.toLowerCase());
    if (found) {
      storage.deleteSentence(found.id);
    }
  } else {
    // 未收藏，则一键添加
    storage.addSentence(
      parsedResult.value.text,
      parsedResult.value.translation,
      parsedResult.value.phonetics,
      parsedResult.value.words
    );
  }
};

/**
 * 5. 朗读解析结果的发音 (同步全局的音频发音源及特定引擎配置)
 */
const handlePlayParsedAudio = (accent: 'US' | 'UK') => {
  if (parsedResult.value) {
    tts.play(
      parsedResult.value.text, 
      accent, 
      tts.playRate.value, 
      storage.settings.value.audioPlaySource,
      storage.settings.value.audioPlayProvider
    );
  }
};

/**
 * 5.2 播放解析结果中单个单词的发音 (同步全局的音频发音源及特定引擎配置)
 */
const handlePlayWordAudio = (word: string, accent: 'US' | 'UK') => {
  tts.play(
    word,
    accent,
    1.0, // 单词朗读默认以标准的 1.0x 语速播放
    storage.settings.value.audioPlaySource,
    storage.settings.value.audioPlayProvider
  );
};

/**
 * 6. 艾宾浩斯复习卡片操作评分反馈
 */
const handleReviewFeedback = (id: string, remembered: boolean) => {
  updateReviewQueueBase();
  storage.updateReviewProgress(id, remembered);
};

/**
 * 7. 导入备份 JSON 文件
 */
const handleImportBackup = async (e: Event) => {
  const input = e.target as HTMLInputElement;
  if (input.files && input.files[0]) {
    const success = await storage.importData(input.files[0]);
    if (success) {
      alert('🎉 备份数据导入成功，已恢复您的所有句子与复习进度！');
    } else {
      alert('❌ 备份导入失败，请确保导入的是有效的 eApp JSON 备份文件。');
    }
  }
};

/**
 * 8. 保存与更新系统设置项
 */
const updateSetting = (key: keyof AppSettings, value: any) => {
  const newSettings = { ...storage.settings.value, [key]: value };
  storage.saveSettings(newSettings);
};

// 监听欧路云 Developer Token 实时输入
const handleTokenInput = (e: Event) => {
  const val = (e.target as HTMLInputElement).value;
  updateSetting('eudicToken', val);
};

// 恢复默认设置
const resetToDefaultSettings = () => {
  const DEFAULT_SETTINGS: AppSettings = {
    phoneticAccent: 'US',
    allowPhoneticFallback: true,
    audioPlaySource: 'local',
    translationProvider: 'google',
    audioPlayProvider: 'auto',
    dictionaryProvider: 'youdao',
    eudicToken: ''
  };
  storage.saveSettings(DEFAULT_SETTINGS);
};

// 辅助格式化时间
const formatDate = (timestamp: number) => {
  return new Date(timestamp).toLocaleString('zh-CN', {
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit'
  });
};

// 生命周期钩子：挂载时加载本地持久化数据并配置复习队列基数
onMounted(() => {
  loadData();
  initialReviewQueueLength.value = reviewQueue.value.length;
});
</script>

<style scoped>
.app-window {
  width: 100%;
  height: 100%;
  position: relative;
  background-color: var(--bg-app);
  color: var(--text-primary);
  display: flex;
  flex-direction: column;
}

.app-layout {
  width: 100%;
  height: 100%;
  display: flex;
  flex-direction: column;
  z-index: 1; /* 浮于光球之上 */
  position: relative;
}

/* 顶部毛玻璃导航栏 */
.app-header {
  height: 70px;
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 0 40px;
  background: rgba(255, 255, 255, 0.01);
  backdrop-filter: blur(10px);
  border-bottom: 1px solid var(--glass-border);
  -webkit-app-region: drag; /* 显式指定顶部导航栏可拖拽窗口 */
  user-select: none; /* 禁用文本选择，防止冲突 */
  -webkit-user-select: none;
}

.brand {
  display: flex;
  align-items: center;
  gap: 12px;
}

.brand-logo {
  width: 28px;
  height: 28px;
  border-radius: 8px;
  background: linear-gradient(135deg, var(--color-primary), #4f46e5);
  color: white;
  display: flex;
  justify-content: center;
  align-items: center;
  font-weight: 800;
  font-size: 1.1rem;
  box-shadow: 0 0 10px var(--color-primary-glow);
}

.brand-title {
  font-size: 1.25rem;
  font-weight: 700;
  letter-spacing: 0.5px;
  display: flex;
  align-items: center;
  gap: 8px;
}

.brand-title .badge {
  font-size: 0.65rem;
  font-weight: 700;
  color: var(--color-primary);
  background: var(--color-primary-glow);
  padding: 2px 6px;
  border-radius: 4px;
  letter-spacing: 1px;
  text-transform: uppercase;
}

.nav-tabs {
  display: flex;
  gap: 12px;
  -webkit-app-region: no-drag;
}

.tab-btn {
  background: transparent;
  color: var(--text-secondary);
  border: 1px solid transparent;
  padding: 8px 16px;
  border-radius: 99px;
  font-size: 0.9rem;
  font-weight: 600;
  cursor: pointer;
  display: flex;
  align-items: center;
  gap: 8px;
  transition: all var(--transition-fast);
}

.tab-btn:hover {
  color: var(--text-primary);
  background: rgba(255, 255, 255, 0.04);
}

.tab-btn.active {
  color: white;
  background: var(--glass-bg-hover);
  border-color: var(--glass-border-hover);
  box-shadow: var(--glass-shadow);
}

.tab-icon {
  width: 16px;
  height: 16px;
  display: flex;
  align-items: center;
}

.tab-icon :deep(svg) {
  width: 100%;
  height: 100%;
}

.badge-count {
  background: var(--color-accent);
  color: white;
  font-size: 0.7rem;
  font-weight: 700;
  padding: 1px 6px;
  border-radius: 99px;
  box-shadow: 0 0 8px var(--color-accent-glow);
}

/* 主内容区 */
.app-content {
  flex: 1;
  overflow-y: auto;
  padding: 40px;
  position: relative;
}

.tab-content-view {
  width: 100%;
  height: 100%;
  display: flex;
  flex-direction: column;
}

.center-box {
  width: 100%;
  max-width: 780px;
  margin: 0 auto;
  display: flex;
  flex-direction: column;
  gap: 20px;
}

.section-headline {
  font-size: 1.8rem;
  font-weight: 700;
  letter-spacing: -0.5px;
}

.section-subtitle {
  font-size: 0.95rem;
  color: var(--text-secondary);
  line-height: 1.6;
  margin-bottom: 8px;
}

/* 解析页面专属样式 */
.result-mount-point {
  margin-top: 10px;
}

.loading-card {
  background: var(--glass-bg);
  border: 1px solid var(--glass-border);
  border-radius: var(--radius-lg);
  padding: 40px;
  display: flex;
  flex-direction: column;
  justify-content: center;
  align-items: center;
  gap: 16px;
  text-align: center;
}

.loading-spinner {
  width: 32px;
  height: 32px;
  border: 3px solid rgba(255, 255, 255, 0.05);
  border-top-color: var(--color-primary);
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
}

.loading-card p {
  font-size: 0.95rem;
  color: var(--text-secondary);
}

/* 智能复习专区 */
.review-zone {
  display: flex;
  flex-direction: column;
  gap: 20px;
}

.progress-bar-container {
  width: 100%;
  max-width: 650px;
  margin: 0 auto;
  height: 24px;
  background: rgba(255, 255, 255, 0.02);
  border: 1px solid var(--glass-border);
  border-radius: 99px;
  position: relative;
  overflow: hidden;
  display: flex;
  align-items: center;
  justify-content: center;
}

.progress-bar-fill {
  position: absolute;
  top: 0;
  left: 0;
  height: 100%;
  background: linear-gradient(90deg, var(--color-primary), #818cf8);
  box-shadow: 0 0 10px var(--color-primary-glow);
  transition: width 0.4s cubic-bezier(0.16, 1, 0.3, 1);
}

.progress-text {
  font-size: 0.75rem;
  font-weight: 700;
  color: white;
  z-index: 2;
  letter-spacing: 0.5px;
}

.empty-state-card {
  background: var(--glass-bg);
  border: 1px solid var(--glass-border);
  border-radius: var(--radius-lg);
  padding: 60px 40px;
  text-align: center;
  max-width: 600px;
  margin: 40px auto 0;
  box-shadow: var(--glass-shadow);
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 16px;
}

.coffee-icon, .box-icon {
  font-size: 3rem;
  line-height: 1;
}

.empty-state-card h3 {
  font-size: 1.3rem;
  font-weight: 700;
}

.empty-state-card p {
  font-size: 0.9rem;
  color: var(--text-secondary);
  line-height: 1.6;
}

/* 句子仓库专属样式 */
.repo-header-row {
  display: flex;
  justify-content: space-between;
  align-items: flex-end;
  border-bottom: 1px solid var(--glass-border);
  padding-bottom: 24px;
  margin-bottom: 24px;
}

.backup-actions {
  display: flex;
  gap: 12px;
}

.backup-btn {
  background: rgba(255, 255, 255, 0.03);
  color: var(--text-secondary);
  border: 1px solid var(--glass-border);
  padding: 8px 16px;
  border-radius: var(--radius-sm);
  font-size: 0.85rem;
  font-weight: 600;
  cursor: pointer;
  display: inline-flex;
  align-items: center;
  gap: 8px;
  transition: all var(--transition-fast);
}

.backup-btn:hover {
  background: var(--glass-bg-hover);
  color: var(--text-primary);
  border-color: var(--glass-border-hover);
}

.backup-btn svg {
  width: 14px;
  height: 14px;
}

.repo-list {
  display: flex;
  flex-direction: column;
  gap: 16px;
  padding-bottom: 40px;
}

.sentence-repo-card {
  background: var(--glass-bg);
  border: 1px solid var(--glass-border);
  border-radius: var(--radius-md);
  padding: 20px;
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 24px;
  transition: all var(--transition-fast);
}

.sentence-repo-card:hover {
  background: var(--glass-bg-hover);
  border-color: var(--glass-border-hover);
  box-shadow: 0 4px 20px rgba(0,0,0,0.15);
}

.repo-card-main {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.repo-card-text {
  font-size: 1.15rem;
  font-weight: 600;
  line-height: 1.4;
  color: var(--text-primary);
}

.repo-card-translation {
  font-size: 0.95rem;
  color: var(--text-secondary);
  line-height: 1.4;
}

.repo-card-meta {
  display: flex;
  gap: 16px;
  font-size: 0.75rem;
  color: var(--text-muted);
  align-items: center;
  margin-top: 4px;
}

.meta-tag {
  font-weight: 700;
  padding: 1px 6px;
  border-radius: 4px;
  text-transform: uppercase;
}

.meta-tag.learning {
  background: rgba(99, 102, 241, 0.1);
  color: #a5b4fc;
}

.meta-tag.mastered {
  background: rgba(16, 185, 129, 0.1);
  color: #a7f3d0;
}

.repo-card-actions {
  display: flex;
  gap: 10px;
}

.action-circle-btn {
  width: 36px;
  height: 36px;
  border-radius: 50%;
  background: rgba(255, 255, 255, 0.03);
  color: var(--text-secondary);
  border: 1px solid var(--glass-border);
  cursor: pointer;
  display: flex;
  justify-content: center;
  align-items: center;
  transition: all var(--transition-fast);
}

.action-circle-btn:hover {
  background: var(--color-primary-glow);
  color: white;
  border-color: var(--color-primary);
}

.action-circle-btn.check.active {
  background: var(--color-success);
  color: white;
  border-color: var(--color-success);
}

.action-circle-btn.check:hover:not(.active) {
  background: var(--color-success-glow);
  color: white;
  border-color: var(--color-success);
}

.action-circle-btn.trash:hover {
  background: var(--color-accent);
  color: white;
  border-color: var(--color-accent);
}

.action-circle-btn svg {
  width: 16px;
  height: 16px;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}

/* ==========================================================================
   4. 系统设置页面专属美化样式 (Premium Glassmorphism Style)
   ========================================================================== */

.settings-container {
  display: flex;
  flex-direction: column;
  gap: 24px;
  padding-bottom: 60px;
  animation: slideUp 0.5s cubic-bezier(0.16, 1, 0.3, 1) forwards;
}

.settings-card {
  background: var(--glass-bg);
  backdrop-filter: var(--glass-blur);
  -webkit-backdrop-filter: var(--glass-blur);
  border: 1px solid var(--glass-border);
  border-radius: var(--radius-lg);
  padding: 28px;
  display: flex;
  gap: 24px;
  box-shadow: var(--glass-shadow);
  transition: all var(--transition-normal);
}

.settings-card:hover {
  background: var(--glass-bg-hover);
  border-color: var(--glass-border-hover);
  box-shadow: 0 8px 30px rgba(0, 0, 0, 0.2);
  transform: translateY(-2px);
}

.card-icon {
  font-size: 2.2rem;
  line-height: 1;
}

.settings-group {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.settings-group h3 {
  font-size: 1.25rem;
  font-weight: 700;
  color: var(--text-primary);
  margin: 0;
}

.group-desc {
  font-size: 0.85rem;
  color: var(--text-muted);
  margin-top: -8px;
}

.setting-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 16px 0;
  border-bottom: 1px solid rgba(255, 255, 255, 0.03);
}

.setting-item:last-child {
  border-bottom: none;
}

.setting-item.flex-column {
  flex-direction: column;
  align-items: flex-start;
  gap: 8px;
}

.setting-header {
  width: 100%;
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.setting-label {
  font-size: 0.95rem;
  font-weight: 600;
  color: var(--text-primary);
}

.setting-hint {
  font-size: 0.8rem;
  color: var(--text-secondary);
  line-height: 1.5;
}

.setting-hint.font-small {
  font-size: 0.8rem;
  color: var(--text-muted);
}

/* 选项卡按钮组 (Segmented Control) */
.toggle-buttons {
  display: flex;
  background: rgba(255, 255, 255, 0.02);
  border: 1px solid var(--glass-border);
  padding: 4px;
  border-radius: 99px;
}

.toggle-choice-btn {
  background: transparent;
  color: var(--text-secondary);
  border: none;
  padding: 6px 16px;
  font-size: 0.85rem;
  font-weight: 600;
  border-radius: 99px;
  cursor: pointer;
  transition: all var(--transition-fast);
}

.toggle-choice-btn:hover {
  color: var(--text-primary);
}

.toggle-choice-btn.active {
  background: var(--color-primary);
  color: white;
  box-shadow: 0 2px 10px var(--color-primary-glow);
}

/* 优雅的苹果风格滑动开关 (Apple Style Switch Toggle) */
.switch {
  position: relative;
  display: inline-block;
  width: 44px;
  height: 24px;
}

.switch input {
  opacity: 0;
  width: 0;
  height: 0;
}

.slider {
  position: absolute;
  cursor: pointer;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background-color: rgba(255, 255, 255, 0.08);
  border: 1px solid var(--glass-border);
  transition: .3s;
}

.slider:before {
  position: absolute;
  content: "";
  height: 16px;
  width: 16px;
  left: 3px;
  bottom: 3px;
  background-color: white;
  transition: .3s;
  box-shadow: 0 1px 3px rgba(0,0,0,0.4);
}

input:checked + .slider {
  background-color: var(--color-success);
  border-color: var(--color-success);
}

input:focus + .slider {
  box-shadow: 0 0 1px var(--color-success);
}

input:checked + .slider:before {
  transform: translateX(20px);
}

.slider.round {
  border-radius: 34px;
}

.slider.round:before {
  border-radius: 50%;
}

/* 恢复默认设置按钮 */
.settings-footer {
  display: flex;
  justify-content: flex-end;
  margin-top: 10px;
}

.reset-btn {
  background: rgba(255, 255, 255, 0.02);
  color: var(--text-secondary);
  border: 1px solid var(--glass-border);
  padding: 10px 20px;
  font-size: 0.85rem;
  font-weight: 600;
  border-radius: var(--radius-md);
  cursor: pointer;
  transition: all var(--transition-fast);
}

.reset-btn:hover {
  background: rgba(244, 63, 94, 0.08);
  color: #fda4af;
  border-color: rgba(244, 63, 94, 0.2);
}

.animate-fade-in {
  animation: fadeIn 0.4s ease-out forwards;
}

@keyframes fadeIn {
  from { opacity: 0; transform: translateY(8px); }
  to { opacity: 1; transform: translateY(0); }
}

/* 新增：Token 密钥输入框样式与链接样式 */
.token-input {
  width: 100%;
  max-width: 420px;
  background: rgba(0, 0, 0, 0.25);
  border: 1px solid var(--glass-border);
  border-radius: var(--radius-sm, 6px);
  padding: 10px 14px;
  color: white;
  font-family: monospace;
  font-size: 0.85rem;
  outline: none;
  margin-top: 8px;
  transition: all var(--transition-fast, 0.2s);
}

.token-input:focus {
  border-color: var(--color-primary, #6366f1);
  box-shadow: 0 0 10px var(--color-primary-glow, rgba(99, 102, 241, 0.2));
}

.text-link {
  color: #a78bfa;
  text-decoration: none;
  border-bottom: 1px dashed #a78bfa;
  transition: color 0.2s;
  padding: 0 2px;
}

.text-link:hover {
  color: white;
}

.border-top {
  border-top: 1px dashed var(--glass-border);
  padding-top: 18px;
  margin-top: 10px;
}

/* 过渡动画：滑动淡入淡出 */
.slide-fade-enter-active,
.slide-fade-leave-active {
  transition: all 0.3s cubic-bezier(0.16, 1, 0.3, 1);
}

.slide-fade-enter-from,
.slide-fade-leave-to {
  transform: translateY(-10px);
  opacity: 0;
}

/* ==========================================================================
   5. 句子仓库智能解析折叠详情面板样式 (Premium Expanded Glassmorphism)
   ========================================================================== */
.sentence-repo-card {
  transition: all var(--transition-normal, 0.3s) cubic-bezier(0.25, 0.8, 0.25, 1);
}

.sentence-repo-card.is-expanded {
  border-color: rgba(99, 102, 241, 0.3);
  box-shadow: 0 8px 24px rgba(99, 102, 241, 0.1);
  background: rgba(255, 255, 255, 0.03);
}

.meta-expand-toggle-btn {
  background: transparent;
  border: none;
  color: var(--color-primary, #6366f1);
  font-size: 0.75rem;
  font-weight: 700;
  cursor: pointer;
  padding: 0;
  margin-left: auto;
  transition: all var(--transition-fast, 0.2s);
}

.meta-expand-toggle-btn:hover {
  color: white;
  text-shadow: 0 0 8px var(--color-primary-glow, rgba(99, 102, 241, 0.4));
}

.action-circle-btn.info.active {
  background: var(--color-primary, #6366f1);
  color: white;
  border-color: var(--color-primary, #6366f1);
  box-shadow: 0 0 10px var(--color-primary-glow, rgba(99, 102, 241, 0.4));
}

.detail-divider {
  height: 1px;
  background: var(--glass-border);
  margin: 16px 0;
  border: none;
}

.repo-card-detail {
  display: flex;
  flex-direction: column;
  gap: 16px;
  padding-bottom: 8px;
}

.detail-section {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.detail-title {
  font-size: 0.8rem;
  color: var(--text-muted, #64748b);
  font-weight: 600;
  margin: 0;
}

.detail-interactive-box {
  background: rgba(0, 0, 0, 0.15);
  border: 1px solid rgba(255, 255, 255, 0.03);
  padding: 14px 18px;
  border-radius: 8px;
}

.detail-phonetics {
  font-size: 0.85rem;
  color: var(--text-secondary);
  font-weight: 500;
}

.detail-phonetics span {
  font-family: var(--font-sans);
  color: var(--color-primary, #6366f1);
  font-weight: 600;
}

.detail-words-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(210px, 1fr));
  gap: 10px;
  margin-top: 4px;
}

.detail-word-chip {
  background: rgba(255, 255, 255, 0.02);
  border: 1px solid var(--glass-border);
  border-radius: 8px;
  padding: 10px 14px;
  display: flex;
  flex-direction: column;
  gap: 6px;
  transition: all var(--transition-fast, 0.2s);
}

.detail-word-chip:hover {
  background: rgba(255, 255, 255, 0.04);
  border-color: rgba(99, 102, 241, 0.3);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
  transform: translateY(-1px);
}

.chip-word-header {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
}

.chip-word-name {
  font-weight: 700;
  font-size: 0.9rem;
  color: white;
}

.chip-word-phonetic {
  font-size: 0.75rem;
  color: var(--color-primary, #6366f1);
  font-family: var(--font-sans);
}

.chip-word-speakers {
  display: flex;
  gap: 4px;
  margin-left: auto;
}

.chip-speaker-btn {
  background: rgba(255, 255, 255, 0.04);
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: 4px;
  color: #a78bfa;
  font-size: 0.6rem;
  padding: 2px 4px;
  cursor: pointer;
  transition: all var(--transition-fast, 0.2s);
}

.chip-speaker-btn:hover {
  background: var(--color-primary-glow, rgba(99, 102, 241, 0.2));
  color: white;
  border-color: var(--color-primary, #6366f1);
}

.chip-word-explain {
  font-size: 0.75rem;
  color: var(--text-secondary);
  margin: 0;
  line-height: 1.4;
}

/* 折叠平滑过渡动画 */
.expand-enter-active,
.expand-leave-active {
  transition: all 0.35s cubic-bezier(0.16, 1, 0.3, 1);
  max-height: 1000px;
  opacity: 1;
  overflow: hidden;
}

.expand-enter-from,
.expand-leave-to {
  max-height: 0;
  opacity: 0;
  transform: translateY(-10px);
}
</style>