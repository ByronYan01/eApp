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
                <div class="review-header-row">
                  <div>
                    <h2 class="section-headline">艾宾浩斯智能复习</h2>
                    <p class="section-subtitle">基于记忆遗忘曲线，为您筛选出今日到期需要强化的句子，通过 3D 卡片进行高效盲测复习。</p>
                  </div>
                  <!-- 复习模式切换 Pill -->
                  <div class="review-mode-selector" v-if="reviewQueue.length > 0">
                    <button 
                      class="mode-pill" 
                      :class="{ 'active': !isRandomReviewMode }" 
                      @click="toggleReviewMode(false)"
                    >
                      📅 顺序复习
                    </button>
                    <button 
                      class="mode-pill" 
                      :class="{ 'active': isRandomReviewMode }" 
                      @click="toggleReviewMode(true)"
                    >
                      🔀 随机复习
                    </button>
                  </div>
                </div>

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
                      @click="tts.play(item.text, storage.settings.value.phoneticAccent, tts.playRate.value, storage.settings.value.audioPlaySource, storage.settings.value.audioPlayProvider, storage.settings.value.audioTimeout)" 
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

                <div class="settings-layout">
                  <!-- 左侧侧边栏导航 -->
                  <div class="settings-sidebar">
                    <button 
                      class="sidebar-tab-btn" 
                      :class="{ 'active': activeSettingsTab === 'voice' }"
                      @click="activeSettingsTab = 'voice'"
                    >
                      <span class="sidebar-tab-icon">🗣️</span>
                      <span class="sidebar-tab-text">语音与音标</span>
                    </button>
                    <button 
                      class="sidebar-tab-btn" 
                      :class="{ 'active': activeSettingsTab === 'providers' }"
                      @click="activeSettingsTab = 'providers'"
                    >
                      <span class="sidebar-tab-icon">⚙️</span>
                      <span class="sidebar-tab-text">服务商配置</span>
                    </button>
                    <button 
                      class="sidebar-tab-btn" 
                      :class="{ 'active': activeSettingsTab === 'speedtest' }"
                      @click="activeSettingsTab = 'speedtest'"
                    >
                      <span class="sidebar-tab-icon">⚡</span>
                      <span class="sidebar-tab-text">接口测速</span>
                    </button>
                    <button 
                      class="sidebar-tab-btn" 
                      :class="{ 'active': activeSettingsTab === 'about' }"
                      @click="activeSettingsTab = 'about'"
                    >
                      <span class="sidebar-tab-icon">🚀</span>
                      <span class="sidebar-tab-text">关于应用</span>
                    </button>
                  </div>

                  <!-- 右侧配置面板内容区 -->
                  <div class="settings-content">
                    <Transition name="fade" mode="out-in">
                      
                      <!-- 1. 语音与音标 panel -->
                      <div v-if="activeSettingsTab === 'voice'" class="settings-tab-panel" key="voice">
                        <!-- 国际音标配置 -->
                        <div class="settings-card-compact">
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

                        <!-- 发音音频配置 -->
                        <div class="settings-card-compact">
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
                      </div>

                      <!-- 2. 服务商与引擎配置 panel -->
                      <div v-else-if="activeSettingsTab === 'providers'" class="settings-tab-panel" key="providers">
                        <div class="settings-card-compact">
                          <div class="settings-group">
                            <h3>服务商与引擎配置</h3>
                            <p class="group-desc">自定义整句翻译、在线真人音频以及查词音标释义所调用的云端服务商。</p>

                            <!-- 1. 翻译提供商 -->
                            <div class="setting-item flex-column">
                              <div class="setting-header">
                                <span class="setting-label">整句翻译服务商</span>
                              </div>
                              <div class="toggle-buttons">
                                <button 
                                  class="toggle-choice-btn" 
                                  :class="{ 'active': storage.settings.value.translationProvider === 'auto' }"
                                  @click="updateSetting('translationProvider', 'auto')"
                                >
                                  智能兜底 (Auto)
                                </button>
                                <button 
                                  class="toggle-choice-btn" 
                                  :class="{ 'active': storage.settings.value.translationProvider === 'mymemory' }"
                                  @click="updateSetting('translationProvider', 'mymemory')"
                                >
                                  MyMemory
                                </button>
                                <button 
                                  class="toggle-choice-btn" 
                                  :class="{ 'active': storage.settings.value.translationProvider === 'google' }"
                                  @click="updateSetting('translationProvider', 'google')"
                                >
                                  谷歌 (Google)
                                </button>
                                <button 
                                  class="toggle-choice-btn" 
                                  :class="{ 'active': storage.settings.value.translationProvider === 'youdao' }"
                                  @click="updateSetting('translationProvider', 'youdao')"
                                >
                                  有道 (Youdao)
                                </button>
                                <button 
                                  class="toggle-choice-btn" 
                                  :class="{ 'active': storage.settings.value.translationProvider === 'baidu' }"
                                  @click="updateSetting('translationProvider', 'baidu')"
                                >
                                  百度 (Baidu)
                                </button>
                              </div>
                            </div>

                            <!-- 2. 发音提供商 (仅在开启在线真人原声时显示，极为严谨) -->
                            <div class="setting-item flex-column" v-if="storage.settings.value.audioPlaySource === 'online'">
                              <div class="setting-header">
                                <span class="setting-label">在线发音引擎</span>
                              </div>
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

                            <!-- 4. 欧路云词库的 API Token 授权输入框 -->
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

                            <!-- 5. 翻译超时配置 -->
                            <div class="setting-item flex-column">
                              <div class="setting-header">
                                <span class="setting-label">整句翻译超时时间 (ms)</span>
                                <span class="setting-value-badge">{{ storage.settings.value.translationTimeout }} ms</span>
                              </div>
                              <p class="setting-hint">当翻译接口在设定时间内无响应时，将自动切换至备用接口或报错（可选范围：1000ms - 10000ms）。</p>
                              <div class="range-container">
                                <input 
                                  type="range" 
                                  min="1000" 
                                  max="10000" 
                                  step="500" 
                                  :value="storage.settings.value.translationTimeout" 
                                  @input="e => updateSetting('translationTimeout', parseInt((e.target as HTMLInputElement).value))"
                                  class="settings-range"
                                />
                              </div>
                            </div>

                            <!-- 6. 在线发音超时配置 -->
                            <div class="setting-item flex-column" v-if="storage.settings.value.audioPlaySource === 'online'">
                              <div class="setting-header">
                                <span class="setting-label">在线发音超时时间 (ms)</span>
                                <span class="setting-value-badge">{{ storage.settings.value.audioTimeout }} ms</span>
                              </div>
                              <p class="setting-hint">当在线原声接口在设定时间内未返回音频时，将自动切换至备用接口或报错（可选范围：1000ms - 10000ms）。</p>
                              <div class="range-container">
                                <input 
                                  type="range" 
                                  min="1000" 
                                  max="10000" 
                                  step="500" 
                                  :value="storage.settings.value.audioTimeout" 
                                  @input="e => updateSetting('audioTimeout', parseInt((e.target as HTMLInputElement).value))"
                                  class="settings-range"
                                />
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>

                      <!-- 3. API 网络测速中心 panel -->
                      <div v-else-if="activeSettingsTab === 'speedtest'" class="settings-tab-panel" key="speedtest">
                        <div class="settings-card-compact">
                          <div class="settings-group">
                            <h3>API 接口测速与最佳配置</h3>
                            <p class="group-desc">对各个在线翻译和发音服务接口进行延迟测速，帮助您一键选择并应用最佳配置。</p>

                            <div class="speed-test-panel">
                              <div class="speed-test-actions">
                                <button class="test-btn" :disabled="testingSpeed" @click="runSpeedTest">
                                  <span v-if="!testingSpeed">⚡ 开始全面测速</span>
                                  <span v-else>⏳ 正在测速中 ({{ speedTestProgress }}%)</span>
                                </button>
                                
                                <button class="apply-best-btn" :disabled="testingSpeed || !hasTested" @click="applyBestConfiguration">
                                  👉 应用最佳接口配置
                                </button>
                              </div>

                              <!-- 测速结果列表 -->
                              <div class="speed-results-list" v-if="hasTested || testingSpeed">
                                <div class="speed-result-item" v-for="item in speedTestResults" :key="item.id">
                                  <span class="speed-name">{{ item.name }}</span>
                                  <div class="speed-status-wrapper">
                                    <span class="speed-dot" :class="item.status"></span>
                                    <span class="speed-value" :class="item.status">{{ item.latency === -1 ? '连接超时' : `${item.latency} ms` }}</span>
                                  </div>
                                </div>
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>

                      <!-- 4. 关于应用与自动升级 panel -->
                      <div v-else-if="activeSettingsTab === 'about'" class="settings-tab-panel" key="about">
                        <div class="settings-card-compact">
                          <div class="settings-group">
                            <h3>关于应用与自动升级</h3>
                            <p class="group-desc">查看当前客户端版本信息，并可在线拉取云端新版直接静默升级。</p>

                            <div class="app-version-info">
                              <div class="version-row">
                                <span class="info-label">应用名称:</span>
                                <span class="info-val">eApp English</span>
                              </div>
                              <div class="version-row">
                                <span class="info-label">当前版本:</span>
                                <span class="info-val highlight">v0.1.0</span>
                              </div>
                              <div class="version-row">
                                <span class="info-label">核心内核:</span>
                                <span class="info-val">Tauri 2.0 (Rust / Vite / Vue)</span>
                              </div>
                              
                              <button class="check-update-btn" :disabled="checkingUpdate" @click="checkForUpdates(false)">
                                <span v-if="!checkingUpdate">🔄 检查云端最新版本</span>
                                <span v-else>🔍 正在检索中...</span>
                              </button>
                            </div>
                          </div>
                        </div>
                      </div>
                    </Transition>

                    <!-- 重置按钮，固定放置在内容区最下方，结构优雅 -->
                    <div class="settings-content-footer">
                      <button class="reset-btn" @click="resetToDefaultSettings">
                        恢复默认配置
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </div>

          </Transition>
        </KeepAlive>
      </main>
    </div>

    <!-- 新增：高颜值毛玻璃自动更新弹窗 Modal -->
    <Transition name="fade">
      <div class="update-modal-backdrop" v-if="showUpdateModal">
        <div class="update-modal-card">
          <div class="modal-glow"></div>
          <div class="modal-header">
            <span class="upgrade-rocket">🚀</span>
            <h2>发现新版本可用！</h2>
          </div>
          
          <div class="modal-body">
            <div class="version-compare">
              <span class="v-tag old">v0.1.0</span>
              <span class="arrow-right">➔</span>
              <span class="v-tag new">v{{ updateVersion }}</span>
            </div>
            
            <div class="changelog-box">
              <h4>📋 更新日志：</h4>
              <p class="changelog-text">{{ updateBody }}</p>
            </div>
            
            <div class="update-progress-zone" v-if="updateProgress">
              <p class="progress-status-text">{{ updateProgress }}</p>
              <div class="progress-track">
                <div class="progress-bar" :style="{ width: `${currentUpdateProgress}%` }"></div>
              </div>
            </div>
          </div>
          
          <div class="modal-footer" v-if="!updateProgress">
            <button class="modal-btn cancel" @click="showUpdateModal = false">
              暂不升级
            </button>
            <button class="modal-btn confirm" @click="startUpdating">
              立即升级安装
            </button>
          </div>
        </div>
      </div>
    </Transition>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, watch } from 'vue';
import { invoke } from '@tauri-apps/api/core';
import { check } from '@tauri-apps/plugin-updater';
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
const activeSettingsTab = ref('voice');
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

// 获取复习队列中的当前第一个句子卡片 (支持随机模式映射)
const currentReviewItem = computed(() => {
  if (reviewQueue.value.length === 0) return null;
  if (isRandomReviewMode.value && shuffledQueueIds.value.length > 0) {
    const targetId = shuffledQueueIds.value[0];
    const item = reviewQueue.value.find(s => s.id === targetId);
    return item || reviewQueue.value[0];
  }
  return reviewQueue.value[0];
});

// ==================== 随机复习队列同步逻辑 ====================
const isRandomReviewMode = ref(false);
const shuffledQueueIds = ref<string[]>([]);

// 监听复习模式切换
const toggleReviewMode = (isRandom: boolean) => {
  isRandomReviewMode.value = isRandom;
  if (isRandom) {
    // 切换到随机模式，立即重新打乱当前的队列 ID
    const ids = reviewQueue.value.map(item => item.id);
    for (let i = ids.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [ids[i], ids[j]] = [ids[j], ids[i]];
    }
    shuffledQueueIds.value = ids;
  } else {
    shuffledQueueIds.value = [];
  }
};

// 监听 reviewQueue 的变化，保持随机队列的同步与洗牌
watch(reviewQueue, (newQueue) => {
  if (newQueue.length === 0) {
    shuffledQueueIds.value = [];
    return;
  }
  
  if (isRandomReviewMode.value) {
    const newIds = newQueue.map(item => item.id);
    
    // 1. 移出已不存在的 ID
    shuffledQueueIds.value = shuffledQueueIds.value.filter(id => newIds.includes(id));
    
    // 2. 找出新增的 ID
    const addedIds = newIds.filter(id => !shuffledQueueIds.value.includes(id));
    
    // 3. 将新增的 ID 随机插入到现有打乱队列中
    addedIds.forEach(id => {
      const insertIdx = Math.floor(Math.random() * (shuffledQueueIds.value.length + 1));
      shuffledQueueIds.value.splice(insertIdx, 0, id);
    });
    
    // 兜底：如果过滤后 shuffledQueueIds 变空了，重新打乱
    if (shuffledQueueIds.value.length === 0 && newIds.length > 0) {
      const tempIds = [...newIds];
      for (let i = tempIds.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [tempIds[i], tempIds[j]] = [tempIds[j], tempIds[i]];
      }
      shuffledQueueIds.value = tempIds;
    }
  }
}, { immediate: true, deep: true });

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
    // 并行获取整句中文翻译与单词拆解音标释义 (传入全局设置以应用对应的音标、降级偏好，并带上指定翻译提供商与超时限制)
    const [translation, words] = await Promise.all([
      translateSentence(text, storage.settings.value.translationProvider, storage.settings.value.translationTimeout),
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
        storage.settings.value.audioPlayProvider,
        storage.settings.value.audioTimeout
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
      storage.settings.value.audioPlayProvider,
      storage.settings.value.audioTimeout
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
    tts.playRate.value, // 单词朗读遵循用户全局设置的语速
    storage.settings.value.audioPlaySource,
    storage.settings.value.audioPlayProvider,
    storage.settings.value.audioTimeout
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
    translationProvider: 'auto',
    audioPlayProvider: 'auto',
    dictionaryProvider: 'youdao',
    eudicToken: '',
    translationTimeout: 5000,
    audioTimeout: 5000
  };
  storage.saveSettings(DEFAULT_SETTINGS);
};

// ==================== 接口测速与最佳配置逻辑 ====================
const testingSpeed = ref(false);
const hasTested = ref(false);
const speedTestProgress = ref(0);

interface SpeedTestItem {
  id: string;
  name: string;
  type: 'translation' | 'audio';
  provider: 'google' | 'youdao' | 'baidu' | 'mymemory';
  latency: number;
  status: 'slow' | 'medium' | 'fast' | 'none' | 'error';
}

const speedTestResults = ref<SpeedTestItem[]>([
  { id: 'trans_mymemory', name: 'MyMemory 翻译', type: 'translation', provider: 'mymemory', latency: -1, status: 'none' },
  { id: 'trans_google', name: '谷歌翻译接口', type: 'translation', provider: 'google', latency: -1, status: 'none' },
  { id: 'trans_youdao', name: '有道翻译接口', type: 'translation', provider: 'youdao', latency: -1, status: 'none' },
  { id: 'trans_baidu', name: '百度翻译接口', type: 'translation', provider: 'baidu', latency: -1, status: 'none' },
  { id: 'audio_youdao', name: '有道真人发音', type: 'audio', provider: 'youdao', latency: -1, status: 'none' },
  { id: 'audio_google', name: '谷歌真人发音', type: 'audio', provider: 'google', latency: -1, status: 'none' },
  { id: 'audio_baidu', name: '百度真人发音', type: 'audio', provider: 'baidu', latency: -1, status: 'none' }
]);

const getStatusByLatency = (latency: number): 'slow' | 'medium' | 'fast' | 'error' => {
  if (latency === -1) return 'error';
  if (latency < 300) return 'fast';
  if (latency < 800) return 'medium';
  return 'slow';
};

// 进行全面测速
const runSpeedTest = async () => {
  if (testingSpeed.value) return;
  testingSpeed.value = true;
  hasTested.value = true;
  speedTestProgress.value = 0;

  // 重置状态
  speedTestResults.value.forEach(item => {
    item.latency = -1;
    item.status = 'none';
  });

  const total = speedTestResults.value.length;
  for (let i = 0; i < total; i++) {
    const item = speedTestResults.value[i];
    const startTime = performance.now();
    try {
      if (item.type === 'translation') {
        await invoke('translate_sentence_backend', {
          sentence: 'test',
          provider: item.provider,
          timeoutMs: 3000
        });
      } else {
        await invoke('get_online_audio_backend', {
          text: 'test',
          accent: 'US',
          provider: item.provider,
          timeoutMs: 3000
        });
      }
      const endTime = performance.now();
      item.latency = Math.round(endTime - startTime);
      item.status = getStatusByLatency(item.latency);
    } catch (e) {
      console.warn(`测速接口 ${item.name} 失败:`, e);
      item.latency = -1;
      item.status = 'error';
    }
    speedTestProgress.value = Math.round(((i + 1) / total) * 100);
  }

  testingSpeed.value = false;
};

// 自动应用最佳接口配置
const applyBestConfiguration = () => {
  if (testingSpeed.value || !hasTested.value) return;

  const transItems = speedTestResults.value.filter(item => item.type === 'translation' && item.latency !== -1);
  const audioItems = speedTestResults.value.filter(item => item.type === 'audio' && item.latency !== -1);

  let bestTransProvider: 'google' | 'youdao' | 'baidu' | 'mymemory' | null = null;
  if (transItems.length > 0) {
    const sorted = [...transItems].sort((a, b) => a.latency - b.latency);
    bestTransProvider = sorted[0].provider;
  }

  let bestAudioProvider: 'google' | 'youdao' | 'baidu' | null = null;
  if (audioItems.length > 0) {
    const sorted = [...audioItems].sort((a, b) => a.latency - b.latency);
    bestAudioProvider = sorted[0].provider as 'google' | 'youdao' | 'baidu' | null;
  }

  const newSettings = { ...storage.settings.value };
  
  if (bestTransProvider) {
    newSettings.translationProvider = bestTransProvider;
  }
  if (bestAudioProvider) {
    newSettings.audioPlayProvider = bestAudioProvider;
    newSettings.audioPlaySource = 'online';
  }

  storage.saveSettings(newSettings);
  alert(`🎉 最佳配置已应用！\n${bestTransProvider ? `【整句翻译】：已切换为最快的 ${bestTransProvider.toUpperCase()}\n` : ''}${bestAudioProvider ? `【发音引擎】：已自动切换为最快的 ${bestAudioProvider.toUpperCase()}，并已激活在线真人发音。` : ''}`);
};

// ==================== 云端自动更新逻辑 ====================
const checkingUpdate = ref(false);
const updateAvailable = ref(false);
const updateVersion = ref('');
const updateBody = ref('');
const updateProgress = ref('');
const showUpdateModal = ref(false);
const currentUpdateProgress = ref(0);

// 执行自动/手动更新检测
const checkForUpdates = async (silent = false) => {
  if (checkingUpdate.value) return;
  checkingUpdate.value = true;
  try {
    const update = await check();
    if (update) {
      updateAvailable.value = true;
      updateVersion.value = update.version;
      updateBody.value = update.body || '无详细更新说明';
      showUpdateModal.value = true;
    } else {
      updateAvailable.value = false;
      if (!silent) {
        alert('当前已是最新版本 (v0.1.0)，无需更新。');
      }
    }
  } catch (err) {
    console.error('检查更新失败:', err);
    if (!silent) {
      alert(`⚠️ 检查更新失败: ${err}`);
    }
  } finally {
    checkingUpdate.value = false;
  }
};

// 下载并应用升级
const startUpdating = async () => {
  try {
    const update = await check();
    if (update) {
      updateProgress.value = '正在下载更新，请稍候...';
      currentUpdateProgress.value = 10;
      
      let downloadedLength = 0;
      let contentLength = 0;

      await update.downloadAndInstall((event) => {
        switch (event.event) {
          case 'Started':
            contentLength = event.data.contentLength || 0;
            updateProgress.value = '更新开始下载...';
            currentUpdateProgress.value = 15;
            break;
          case 'Progress':
            downloadedLength += event.data.chunkLength;
            if (contentLength > 0) {
              const progress = Math.round((downloadedLength / contentLength) * 100);
              updateProgress.value = `已下载: ${progress}%`;
              currentUpdateProgress.value = 20 + Math.round(progress * 0.7);
            } else {
              updateProgress.value = '正在下载数据包...';
            }
            break;
          case 'Finished':
            updateProgress.value = '下载完成，正在安装并重启应用...';
            currentUpdateProgress.value = 95;
            break;
        }
      });
      
      currentUpdateProgress.value = 100;
    }
  } catch (e) {
    console.error('更新下载安装失败:', e);
    alert(`⚠️ 更新安装失败: ${e}`);
    showUpdateModal.value = false;
  }
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
  // 静默检查自动更新
  checkForUpdates(true);
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

/* 布局外层容器，改成 Flex 分栏 */
.settings-layout {
  display: flex;
  gap: 28px;
  margin-top: 24px;
  align-items: flex-start;
  animation: slideUp 0.5s cubic-bezier(0.16, 1, 0.3, 1) forwards;
}

/* 左侧侧边栏导航 */
.settings-sidebar {
  width: 180px;
  display: flex;
  flex-direction: column;
  gap: 6px;
  padding: 8px;
  background: var(--glass-bg);
  backdrop-filter: var(--glass-blur);
  -webkit-backdrop-filter: var(--glass-blur);
  border: 1px solid var(--glass-border);
  border-radius: var(--radius-lg);
  box-shadow: var(--glass-shadow);
  flex-shrink: 0;
}

/* 导航按钮 */
.sidebar-tab-btn {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px 16px;
  background: transparent;
  color: var(--text-secondary);
  border: none;
  border-radius: var(--radius-md);
  font-size: 0.95rem;
  font-weight: 600;
  cursor: pointer;
  text-align: left;
  transition: all var(--transition-normal);
}

.sidebar-tab-btn:hover {
  background: rgba(255, 255, 255, 0.03);
  color: var(--text-primary);
  transform: translateX(4px);
}

.sidebar-tab-btn.active {
  background: var(--color-primary);
  color: white;
  box-shadow: 0 4px 15px var(--color-primary-glow);
}

.sidebar-tab-icon {
  font-size: 1.15rem;
  display: inline-flex;
  align-items: center;
  justify-content: center;
}

/* 右侧配置面板区 */
.settings-content {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 20px;
  min-width: 0; /* 防止溢出 */
}

/* 选项卡面板 */
.settings-tab-panel {
  display: flex;
  flex-direction: column;
  gap: 20px;
}

/* 紧凑型设置卡片 */
.settings-card-compact {
  background: var(--glass-bg);
  backdrop-filter: var(--glass-blur);
  -webkit-backdrop-filter: var(--glass-blur);
  border: 1px solid var(--glass-border);
  border-radius: var(--radius-lg);
  padding: 28px 32px;
  box-shadow: var(--glass-shadow);
  transition: all var(--transition-normal);
}

.settings-card-compact:hover {
  background: var(--glass-bg-hover);
  border-color: var(--glass-border-hover);
  box-shadow: 0 8px 30px rgba(0, 0, 0, 0.2);
}

/* 右侧底部重置区域 */
.settings-content-footer {
  display: flex;
  justify-content: flex-end;
  margin-top: 8px;
  padding-bottom: 40px;
}

/* 响应式媒体查询 */
@media (max-width: 768px) {
  .settings-layout {
    flex-direction: column;
    gap: 20px;
  }
  
  .settings-sidebar {
    width: 100%;
    flex-direction: row;
    overflow-x: auto;
    padding: 6px;
  }
  
  .sidebar-tab-btn {
    flex: 1;
    justify-content: center;
    padding: 10px;
    font-size: 0.85rem;
    white-space: nowrap;
  }
  
  .sidebar-tab-btn:hover {
    transform: none;
  }
}

.settings-group {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 20px;
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
  padding: 20px 0;
  border-bottom: 1px solid rgba(255, 255, 255, 0.05);
}

.setting-item:last-child {
  border-bottom: none;
}

.setting-item.flex-column {
  flex-direction: column;
  align-items: flex-start;
  gap: 12px;
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
  white-space: nowrap;
  flex-shrink: 0;
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
  padding: 6px 12px;
  font-size: 0.82rem;
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

/* 新增：测速中心专属样式 */
.speed-test-panel {
  display: flex;
  flex-direction: column;
  gap: 16px;
  width: 100%;
  margin-top: 10px;
}

.speed-test-actions {
  display: flex;
  gap: 12px;
}

.test-btn, .apply-best-btn {
  background: rgba(255, 255, 255, 0.03);
  border: 1px solid var(--glass-border);
  color: var(--text-primary);
  padding: 10px 18px;
  border-radius: var(--radius-sm, 6px);
  font-size: 0.85rem;
  font-weight: 600;
  cursor: pointer;
  display: inline-flex;
  align-items: center;
  gap: 6px;
  transition: all var(--transition-fast, 0.2s);
}

.test-btn:hover:not(:disabled) {
  background: var(--color-primary-glow, rgba(99, 102, 241, 0.15));
  border-color: var(--color-primary, #6366f1);
  color: white;
}

.apply-best-btn {
  background: rgba(16, 185, 129, 0.08);
  border-color: rgba(16, 185, 129, 0.2);
  color: #6ee7b7;
}

.apply-best-btn:hover:not(:disabled) {
  background: var(--color-success, #10b981);
  border-color: var(--color-success, #10b981);
  color: white;
}

.test-btn:disabled, .apply-best-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.speed-results-list {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(220px, 1fr));
  gap: 12px;
  background: rgba(0, 0, 0, 0.15);
  border-radius: var(--radius-sm, 6px);
  padding: 14px;
  border: 1px solid var(--glass-border);
  margin-top: 8px;
}

.speed-result-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  background: rgba(255, 255, 255, 0.01);
  border: 1px solid rgba(255, 255, 255, 0.03);
  border-radius: 4px;
  padding: 8px 12px;
}

.speed-name {
  font-size: 0.8rem;
  color: var(--text-secondary);
  font-weight: 500;
}

.speed-status-wrapper {
  display: flex;
  align-items: center;
  gap: 8px;
}

.speed-dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: #64748b;
  box-shadow: 0 0 4px #64748b;
}

.speed-dot.none {
  background: #64748b;
  box-shadow: 0 0 4px #64748b;
}

.speed-dot.fast {
  background: #10b981;
  box-shadow: 0 0 6px #10b981;
}

.speed-dot.medium {
  background: #eab308;
  box-shadow: 0 0 6px #eab308;
}

.speed-dot.slow {
  background: #f97316;
  box-shadow: 0 0 6px #f97316;
}

.speed-dot.error {
  background: #ef4444;
  box-shadow: 0 0 6px #ef4444;
}

.speed-value {
  font-size: 0.8rem;
  font-family: monospace;
  font-weight: 700;
  color: var(--text-muted);
}

.speed-value.fast {
  color: #34d399;
}

.speed-value.medium {
  color: #fbbf24;
}

.speed-value.slow {
  color: #fb923c;
}

.speed-value.error {
  color: #f87171;
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

/* 新增：复习模式切换样式 */
.review-header-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  width: 100%;
  margin-bottom: 8px;
}

.review-mode-selector {
  display: flex;
  background: rgba(255, 255, 255, 0.03);
  border: 1px solid var(--glass-border);
  padding: 3px;
  border-radius: 99px;
  backdrop-filter: blur(8px);
  height: fit-content;
}

.mode-pill {
  background: transparent;
  border: none;
  color: var(--text-secondary);
  padding: 6px 14px;
  border-radius: 99px;
  font-size: 0.8rem;
  font-weight: 600;
  cursor: pointer;
  transition: all var(--transition-fast, 0.2s);
}

.mode-pill.active {
  background: linear-gradient(135deg, var(--color-primary), #4f46e5);
  color: white;
  box-shadow: 0 2px 8px var(--color-primary-glow);
}

/* 适配窄屏排版 */
@media (max-width: 680px) {
  .review-header-row {
    flex-direction: column;
    align-items: flex-start;
    gap: 12px;
  }
  .review-mode-selector {
    align-self: flex-start;
  }
}

/* 新增：关于与自动更新样式 */
.app-version-info {
  display: flex;
  flex-direction: column;
  gap: 12px;
  background: rgba(0, 0, 0, 0.15);
  border: 1px solid var(--glass-border);
  border-radius: var(--radius-sm, 6px);
  padding: 18px;
  width: 100%;
  margin-top: 10px;
}

.version-row {
  display: flex;
  justify-content: space-between;
  font-size: 0.85rem;
}

.info-label {
  color: var(--text-secondary);
  font-weight: 500;
}

.info-val {
  color: var(--text-primary);
  font-weight: 700;
}

.info-val.highlight {
  color: var(--color-primary, #6366f1);
  text-shadow: 0 0 8px var(--color-primary-glow);
}

.check-update-btn {
  background: linear-gradient(135deg, var(--color-primary), #4f46e5);
  border: none;
  color: white;
  padding: 10px 20px;
  border-radius: var(--radius-sm, 6px);
  font-size: 0.85rem;
  font-weight: 700;
  cursor: pointer;
  margin-top: 6px;
  box-shadow: 0 4px 12px var(--color-primary-glow);
  transition: all var(--transition-fast, 0.2s);
}

.check-update-btn:hover:not(:disabled) {
  transform: translateY(-1px);
  box-shadow: 0 6px 16px var(--color-primary-glow);
}

.check-update-btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

/* 毛玻璃升级弹窗 */
.update-modal-backdrop {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.65);
  backdrop-filter: blur(12px);
  -webkit-backdrop-filter: blur(12px);
  display: flex;
  justify-content: center;
  align-items: center;
  z-index: 9999;
}

.update-modal-card {
  position: relative;
  background: rgba(30, 30, 45, 0.7);
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: var(--radius-lg, 16px);
  width: 90%;
  max-width: 460px;
  padding: 30px;
  box-shadow: 0 20px 50px rgba(0, 0, 0, 0.5);
  overflow: hidden;
  display: flex;
  flex-direction: column;
  gap: 20px;
  animation: modalScale 0.35s cubic-bezier(0.16, 1, 0.3, 1) forwards;
}

.modal-glow {
  position: absolute;
  top: -80px;
  left: 50%;
  transform: translateX(-50%);
  width: 200px;
  height: 200px;
  background: radial-gradient(circle, var(--color-primary-glow) 0%, transparent 70%);
  pointer-events: none;
}

.modal-header {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
  text-align: center;
}

.upgrade-rocket {
  font-size: 3rem;
  animation: rocketFloat 2.5s ease-in-out infinite alternate;
}

.modal-header h2 {
  font-size: 1.35rem;
  font-weight: 800;
  color: white;
  margin: 0;
}

.version-compare {
  display: flex;
  justify-content: center;
  align-items: center;
  gap: 16px;
  margin: 10px 0;
}

.v-tag {
  font-size: 0.85rem;
  font-weight: 800;
  padding: 4px 12px;
  border-radius: 99px;
  font-family: monospace;
}

.v-tag.old {
  background: rgba(255, 255, 255, 0.05);
  border: 1px solid rgba(255, 255, 255, 0.08);
  color: var(--text-secondary);
}

.v-tag.new {
  background: rgba(16, 185, 129, 0.12);
  border: 1px solid rgba(16, 185, 129, 0.3);
  color: #34d399;
  box-shadow: 0 0 10px rgba(16, 185, 129, 0.2);
}

.arrow-right {
  color: var(--text-muted);
  font-weight: 800;
}

.changelog-box {
  background: rgba(0, 0, 0, 0.2);
  border: 1px solid rgba(255, 255, 255, 0.04);
  border-radius: 8px;
  padding: 14px;
  max-height: 140px;
  overflow-y: auto;
}

.changelog-box h4 {
  font-size: 0.8rem;
  color: var(--text-secondary);
  margin-top: 0;
  margin-bottom: 6px;
}

.changelog-text {
  font-size: 0.8rem;
  color: var(--text-muted);
  line-height: 1.5;
  margin: 0;
  white-space: pre-wrap;
}

.update-progress-zone {
  display: flex;
  flex-direction: column;
  gap: 8px;
  margin-top: 8px;
}

.progress-status-text {
  font-size: 0.75rem;
  color: var(--text-secondary);
  margin: 0;
}

.progress-track {
  height: 6px;
  background: rgba(255, 255, 255, 0.08);
  border-radius: 99px;
  overflow: hidden;
}

.progress-bar {
  height: 100%;
  background: linear-gradient(90deg, var(--color-primary) 0%, #10b981 100%);
  border-radius: 99px;
  transition: width 0.3s ease;
}

.modal-footer {
  display: flex;
  gap: 12px;
  width: 100%;
  margin-top: 8px;
}

.modal-btn {
  flex: 1;
  padding: 12px;
  border-radius: var(--radius-sm, 6px);
  font-size: 0.85rem;
  font-weight: 700;
  cursor: pointer;
  transition: all 0.2s;
  border: none;
}

.modal-btn.cancel {
  background: rgba(255, 255, 255, 0.03);
  border: 1px solid var(--glass-border);
  color: var(--text-secondary);
}

.modal-btn.cancel:hover {
  background: rgba(255, 255, 255, 0.08);
  color: white;
}

.modal-btn.confirm {
  background: linear-gradient(135deg, var(--color-primary), #4f46e5);
  color: white;
  box-shadow: 0 4px 14px var(--color-primary-glow);
}

.modal-btn.confirm:hover {
  transform: translateY(-1px);
  box-shadow: 0 6px 18px var(--color-primary-glow);
}

.modal-btn.confirm:active {
  transform: translateY(1px);
}

/* 动效 */
@keyframes modalScale {
  from { transform: scale(0.92); opacity: 0; }
  to { transform: scale(1); opacity: 1; }
}

@keyframes rocketFloat {
  0% { transform: translateY(0); }
  100% { transform: translateY(-8px); }
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

/* 自定义现代感 Range 滑动条样式 */
.range-container {
  width: 100%;
  padding: 8px 0;
  display: flex;
  align-items: center;
}

.settings-range {
  -webkit-appearance: none;
  appearance: none;
  width: 100%;
  height: 6px;
  border-radius: 99px;
  background: rgba(255, 255, 255, 0.08);
  outline: none;
  transition: background 0.3s;
}

.settings-range:hover {
  background: rgba(255, 255, 255, 0.12);
}

.settings-range::-webkit-slider-runnable-track {
  width: 100%;
  height: 6px;
  cursor: pointer;
}

.settings-range::-webkit-slider-thumb {
  -webkit-appearance: none;
  appearance: none;
  width: 16px;
  height: 16px;
  border-radius: 50%;
  background: var(--color-primary);
  box-shadow: 0 0 8px var(--color-primary-glow);
  cursor: pointer;
  margin-top: -5px;
  transition: transform 0.1s, background-color 0.1s;
}

.settings-range::-webkit-slider-thumb:hover {
  transform: scale(1.2);
  background: white;
}

.settings-range::-moz-range-thumb {
  width: 16px;
  height: 16px;
  border: none;
  border-radius: 50%;
  background: var(--color-primary);
  box-shadow: 0 0 8px var(--color-primary-glow);
  cursor: pointer;
  transition: transform 0.1s, background-color 0.1s;
}

.settings-range::-moz-range-thumb:hover {
  transform: scale(1.2);
  background: white;
}

.setting-value-badge {
  font-size: 0.8rem;
  font-weight: 700;
  color: var(--color-primary);
  background: var(--color-primary-glow);
  padding: 2px 8px;
  border-radius: 6px;
  border: 1px solid rgba(99, 102, 241, 0.2);
}
</style>