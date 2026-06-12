<template>
  <div class="dashboard-container">
    <!-- 演示数据提示横幅 -->
    <div v-if="isDemoData" class="demo-banner animate-fade-in">
      <span class="demo-badge">💡 演示数据中</span>
      <span class="demo-text">由于您的学习数据（收藏句子与复习记录）较少，已为您渲染精美的演示看板。录入新句子并进行卡片复习后，将自动切换为真实数据。</span>
    </div>

    <!-- 顶部核心指标统计卡片组 -->
    <div class="metrics-grid">
      <div class="metric-card glass-panel" v-for="(metric, idx) in metrics" :key="idx">
        <div class="metric-icon" :style="{ background: metric.glow }">
          {{ metric.icon }}
        </div>
        <div class="metric-info">
          <div class="metric-label">{{ metric.label }}</div>
          <div class="metric-value">{{ metric.value }}</div>
        </div>
        <div class="metric-trend" :class="metric.trendClass" v-if="metric.trend">
          {{ metric.trend }}
        </div>
      </div>
    </div>

    <!-- 图表内容区域 -->
    <div class="charts-grid">
      <!-- 1. 每日新增收藏句子走势 -->
      <div class="chart-card glass-panel flex-2">
        <div class="chart-header">
          <h3 class="chart-title">📈 每日新增收藏走势</h3>
          <span class="chart-subtitle">最近 7 天每日新增句子数</span>
        </div>
        <div class="chart-content relative">
          <!-- 悬浮提示 Tooltip -->
          <div 
            v-if="hoveredPoint" 
            class="chart-tooltip" 
            :style="{ left: hoveredPoint.x + 'px', top: hoveredPoint.y - 40 + 'px' }"
          >
            <div class="tooltip-date">{{ hoveredPoint.date }}</div>
            <div class="tooltip-value">{{ hoveredPoint.val }} 句</div>
          </div>

          <svg class="trend-svg" viewBox="0 0 600 220" width="100%" height="100%">
            <defs>
              <!-- 霓虹发光滤镜 -->
              <filter id="glow-neon" x="-20%" y="-20%" width="140%" height="140%">
                <feGaussianBlur stdDeviation="6" result="blur" />
                <feMerge>
                  <feMergeNode in="blur" />
                  <feMergeNode in="SourceGraphic" />
                </feMerge>
              </filter>
              <!-- 渐变填充色 -->
              <linearGradient id="area-gradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stop-color="var(--color-primary)" stop-opacity="0.35" />
                <stop offset="100%" stop-color="var(--color-primary)" stop-opacity="0.00" />
              </linearGradient>
            </defs>

            <!-- 网格水平线 -->
            <line x1="40" y1="30" x2="560" y2="30" class="grid-line" />
            <line x1="40" y1="85" x2="560" y2="85" class="grid-line" />
            <line x1="40" y1="140" x2="560" y2="140" class="grid-line" />
            <line x1="40" y1="180" x2="560" y2="180" class="grid-line stroke-strong" />

            <!-- Y轴刻度文字 -->
            <text x="30" y="34" class="axis-text text-right">{{ Math.round(trendMaxY) }}</text>
            <text x="30" y="89" class="axis-text text-right">{{ Math.round(trendMaxY / 2) }}</text>
            <text x="30" y="144" class="axis-text text-right">{{ Math.round(trendMaxY / 4) }}</text>
            <text x="30" y="184" class="axis-text text-right">0</text>

            <!-- 渐变填充区域 -->
            <path :d="trendAreaPath" fill="url(#area-gradient)" />

            <!-- 霓虹折线路径 -->
            <path :d="trendLinePath" fill="none" stroke="var(--color-primary)" stroke-width="4" filter="url(#glow-neon)" stroke-linecap="round" />

            <!-- 数据连接圆点 -->
            <circle 
              v-for="(pt, idx) in trendPoints" 
              :key="idx" 
              :cx="pt.x" 
              :cy="pt.y" 
              r="6" 
              fill="var(--bg-app)" 
              stroke="var(--color-primary)" 
              stroke-width="3"
              class="trend-dot"
              @mouseenter="showTooltip($event, pt)"
              @mouseleave="hideTooltip"
            />

            <!-- X轴标签 -->
            <text 
              v-for="(pt, idx) in trendPoints" 
              :key="'lbl-' + idx" 
              :x="pt.x" 
              y="205" 
              class="axis-text text-center"
            >
              {{ pt.label }}
            </text>
          </svg>
        </div>
      </div>

      <!-- 2. 艾宾浩斯复习熟练度占比 -->
      <div class="chart-card glass-panel flex-1">
        <div class="chart-header">
          <h3 class="chart-title">🎯 艾宾浩斯记忆熟练度</h3>
          <span class="chart-subtitle">基于复习次数的阶段分布</span>
        </div>
        <div class="chart-content ring-chart-content">
          <!-- 同心极光圆环 -->
          <div class="ring-chart-container relative">
            <svg class="ring-svg" viewBox="0 0 160 160">
              <defs>
                <filter id="ring-glow" x="-20%" y="-20%" width="140%" height="140%">
                  <feGaussianBlur stdDeviation="3" result="blur" />
                  <feMerge>
                    <feMergeNode in="blur" />
                    <feMergeNode in="SourceGraphic" />
                  </feMerge>
                </filter>
              </defs>
              <!-- 4个阶段的底环 + 顶层进度环 -->
              <g v-for="(ring, idx) in rings" :key="idx">
                <!-- 底色虚线环 -->
                <circle 
                  cx="80" 
                  cy="80" 
                  :r="ring.radius" 
                  fill="none" 
                  stroke="rgba(255, 255, 255, 0.02)" 
                  stroke-width="9" 
                />
                <!-- 进度发光弧 -->
                <circle 
                  cx="80" 
                  cy="80" 
                  :r="ring.radius" 
                  fill="none" 
                  :stroke="ring.color" 
                  stroke-width="9" 
                  stroke-linecap="round"
                  :stroke-dasharray="ring.dashArray"
                  :stroke-dashoffset="ring.dashOffset"
                  transform="rotate(-90 80 80)"
                  filter="url(#ring-glow)"
                  class="ring-progress-arc"
                />
              </g>
            </svg>
            <!-- 环中心显示已掌握率 -->
            <div class="ring-center-value">
              <span class="pct">{{ masteredPercent }}%</span>
              <span class="lbl">已掌握</span>
            </div>
          </div>

          <!-- 阶段列表标签 -->
          <div class="ring-labels">
            <div 
              class="ring-label-item" 
              v-for="(ring, idx) in rings" 
              :key="idx"
            >
              <span class="color-indicator" :style="{ backgroundColor: ring.color }"></span>
              <div class="label-info">
                <div class="name">{{ ring.name }}</div>
                <div class="value-pct">{{ ring.count }} 句 ({{ ring.percent }}%)</div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- 底部打卡日历与金句区域 -->
    <div class="dashboard-footer-grid">
      <!-- 3. GitHub 风格复习打卡日历墙 -->
      <div class="chart-card glass-panel flex-3">
        <div class="chart-header flex-row justify-between align-center">
          <div>
            <h3 class="chart-title">🔥 艾宾浩斯复习打卡墙</h3>
            <span class="chart-subtitle">最近 16 周每日复习强度与打卡</span>
          </div>
          <!-- 打卡格子图例 -->
          <div class="grid-legend">
            <span>少</span>
            <span class="legend-box level-0"></span>
            <span class="legend-box level-1"></span>
            <span class="legend-box level-2"></span>
            <span class="legend-box level-3"></span>
            <span class="legend-box level-4"></span>
            <span>多</span>
          </div>
        </div>
        <div class="chart-content grid-scroller relative">
          <!-- 打卡格子悬浮 Tooltip -->
          <div 
            v-if="hoveredCell" 
            class="grid-tooltip" 
            :style="{ left: (hoveredCell.x ?? 0) + 'px', top: (hoveredCell.y ?? 0) - 35 + 'px' }"
          >
            {{ hoveredCell.date }} · 复习 {{ hoveredCell.count }} 次
          </div>

          <div class="heatmap-wrapper">
            <!-- 星期列头部 -->
            <div class="weekday-labels">
              <span>一</span>
              <span>三</span>
              <span>五</span>
              <span>日</span>
            </div>
            <!-- 格子网格 -->
            <svg class="heatmap-svg" :width="heatmapWidth" height="110">
              <g v-for="(col, colIdx) in heatMapData" :key="colIdx">
                <rect 
                  v-for="(day, dayIdx) in col" 
                  :key="dayIdx"
                  :x="colIdx * 14"
                  :y="dayIdx * 14"
                  width="11"
                  height="11"
                  rx="3"
                  :class="['heatmap-cell', 'level-' + day.level]"
                  :style="{ fill: day.color }"
                  @mouseenter="showCellTooltip($event, day)"
                  @mouseleave="hideCellTooltip"
                />
              </g>
            </svg>
          </div>
        </div>
      </div>

      <!-- 4. 英语打卡鼓励金句卡片 -->
      <div class="chart-card glass-panel flex-2 sentence-quote-card flex-column justify-center relative overflow-hidden">
        <div class="quote-glow-bg"></div>
        <div class="quote-mark">“</div>
        <div class="quote-content selectable">{{ currentQuote.text }}</div>
        <div class="quote-translation selectable">{{ currentQuote.translation }}</div>
        <div class="quote-author">— {{ currentQuote.author }}</div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue';
import type { SentenceItem, ReviewLog } from '../composables/useStorage';

const props = defineProps<{
  sentences: SentenceItem[];
  reviewLogs: ReviewLog[];
}>();

// 励志金句库
const quotes = [
  { text: "The limits of my language mean the limits of my world.", translation: "语言的边界，即是世界的边界。", author: "Ludwig Wittgenstein" },
  { text: "Consistency is key. Small progress daily adds up to massive results.", translation: "持之以恒是关键。每日细微的进步终将汇聚成卓越的成就。", author: "Anonymous" },
  { text: "One language sets you in a corridor for life. Two languages open every door along the way.", translation: "一种语言引导你步入生命的走廊。两种语言能为你打开沿途的每一扇大门。", author: "Frank Smith" },
  { text: "Learning is a treasure that will follow its owner everywhere.", translation: "知识是一宝库，它将跟随它的主人到任何地方。", author: "Chinese Proverb" },
  { text: "Do not fear going slowly, fear only standing still.", translation: "不怕慢，就怕站。", author: "Proverb" },
  { text: "To learn a language is to have one more window from which to look at the world.", translation: "学会一门语言，就像多了一扇看世界的窗户。", author: "Chinese Proverb" }
];
const currentQuote = ref(quotes[0]);

onMounted(() => {
  // 每次打开随机挑选一条金句
  const randIdx = Math.floor(Math.random() * quotes.length);
  currentQuote.value = quotes[randIdx];
});

/**
 * ---------------------------------------
 * A. 演示数据判定与生成逻辑
 * ---------------------------------------
 */
// 判定数据量是否过低，如果是，则显示演示数据以提升初次使用的视觉质感
const isDemoData = computed(() => {
  // 如果句子总数少于 3 个，或者最近 16 周的复习日志少于 5 次，则启用演示数据
  return props.sentences.length < 3 || props.reviewLogs.length < 5;
});

// 1. 虚拟句子数据
const demoSentences = computed<SentenceItem[]>(() => {
  const now = Date.now();
  const oneDay = 24 * 60 * 60 * 1000;
  return [
    { id: '1', text: 'Demo 1', translation: '示例 1', phonetics: '', words: [], addedAt: now - 6 * oneDay, status: 'mastered', reviewCount: 8, nextReviewTime: 0 },
    { id: '2', text: 'Demo 2', translation: '示例 2', phonetics: '', words: [], addedAt: now - 5 * oneDay, status: 'mastered', reviewCount: 7, nextReviewTime: 0 },
    { id: '3', text: 'Demo 3', translation: '示例 3', phonetics: '', words: [], addedAt: now - 3 * oneDay, status: 'learning', reviewCount: 4, nextReviewTime: 0 },
    { id: '4', text: 'Demo 4', translation: '示例 4', phonetics: '', words: [], addedAt: now - 3 * oneDay, status: 'learning', reviewCount: 3, nextReviewTime: 0 },
    { id: '5', text: 'Demo 5', translation: '示例 5', phonetics: '', words: [], addedAt: now - 2 * oneDay, status: 'learning', reviewCount: 2, nextReviewTime: 0 },
    { id: '6', text: 'Demo 6', translation: '示例 6', phonetics: '', words: [], addedAt: now - 1 * oneDay, status: 'learning', reviewCount: 1, nextReviewTime: 0 },
    { id: '7', text: 'Demo 7', translation: '示例 7', phonetics: '', words: [], addedAt: now, status: 'learning', reviewCount: 0, nextReviewTime: 0 },
    { id: '8', text: 'Demo 8', translation: '示例 8', phonetics: '', words: [], addedAt: now, status: 'learning', reviewCount: 0, nextReviewTime: 0 },
  ];
});

// 2. 虚拟复习日志数据 (生成最近 16 周的热力打卡)
const demoReviewLogs = computed<ReviewLog[]>(() => {
  const logs: ReviewLog[] = [];
  const now = Date.now();
  const oneDay = 24 * 60 * 60 * 1000;
  
  // 在 26 周的 182 天里，随机挑 70% 的日期产生 2-15 次的复习
  for (let i = 0; i < 182; i++) {
    if (Math.random() < 0.65) {
      const dayTimestamp = now - i * oneDay;
      const reviewTimes = Math.floor(Math.random() * 12) + 2; // 2 到 13 次
      for (let k = 0; k < reviewTimes; k++) {
        // 微调时间戳以散布到该天内
        logs.push({
          sentenceId: 'demo',
          timestamp: dayTimestamp - Math.floor(Math.random() * 8 * 3600 * 1000),
          remembered: Math.random() > 0.15
        });
      }
    }
  }
  return logs;
});

// 获取活动的消费数据集 (真实 vs 虚拟)
const activeSentences = computed(() => isDemoData.value ? demoSentences.value : props.sentences);
const activeReviewLogs = computed(() => isDemoData.value ? demoReviewLogs.value : props.reviewLogs);

/**
 * ---------------------------------------
 * B. 顶部核心指标计算
 * ---------------------------------------
 */
const metrics = computed(() => {
  const sList = activeSentences.value;
  const logs = activeReviewLogs.value;

  const total = sList.length;
  const mastered = sList.filter(s => s.status === 'mastered').length;
  const learning = total - mastered;

  // 今日已复习量 (基于 timestamp 处于今天的 log)
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);
  const todayStartMs = todayStart.getTime();
  const todayReviews = logs.filter(l => l.timestamp >= todayStartMs).length;

  return [
    { 
      label: '已收藏句子', 
      value: total, 
      icon: '📚', 
      glow: 'rgba(99, 102, 241, 0.15)',
      trend: isDemoData.value ? '示例' : '+新增',
      trendClass: 'trend-neutral'
    },
    { 
      label: '永久记忆/已掌握', 
      value: mastered, 
      icon: '🏆', 
      glow: 'rgba(16, 185, 129, 0.15)',
      trend: total > 0 ? `${Math.round((mastered / total) * 100)}%` : '0%',
      trendClass: 'trend-success'
    },
    { 
      label: '学习与复习中', 
      value: learning, 
      icon: '⏳', 
      glow: 'rgba(244, 63, 94, 0.15)',
      trend: total > 0 ? `${Math.round((learning / total) * 100)}%` : '0%',
      trendClass: 'trend-accent'
    },
    { 
      label: '今日完成复习', 
      value: todayReviews, 
      icon: '🔥', 
      glow: 'rgba(234, 179, 8, 0.15)',
      trend: todayReviews > 0 ? '打卡成功' : '待复习',
      trendClass: todayReviews > 0 ? 'trend-success' : 'trend-neutral'
    }
  ];
});

/**
 * ---------------------------------------
 * C. 折线图 (趋势图) 计算
 * ---------------------------------------
 */
interface TrendPoint {
  x: number;
  y: number;
  val: number;
  date: string;
  label: string;
}

const hoveredPoint = ref<TrendPoint | null>(null);

const showTooltip = (event: MouseEvent, pt: TrendPoint) => {
  // 获取 SVG 的包围盒
  const svg = (event.currentTarget as SVGElement).ownerSVGElement;
  if (!svg) return;
  
  // 计算相对 SVG 的坐标
  hoveredPoint.value = {
    ...pt,
    x: pt.x,
    y: pt.y
  };
};

const hideTooltip = () => {
  hoveredPoint.value = null;
};

// 过去 7 天日期标签与分桶
const last7DaysInfo = computed(() => {
  const dates = [];
  const oneDay = 24 * 60 * 60 * 1000;
  const today = new Date();
  
  for (let i = 6; i >= 0; i--) {
    const d = new Date(today.getTime() - i * oneDay);
    const m = d.getMonth() + 1;
    const day = d.getDate();
    const dateStr = `${d.getFullYear()}-${String(m).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    dates.push({
      dateStr,
      label: `${m}/${day}`,
      timestampStart: new Date(d.getFullYear(), d.getMonth(), day, 0, 0, 0).getTime(),
      timestampEnd: new Date(d.getFullYear(), d.getMonth(), day, 23, 59, 59, 999).getTime()
    });
  }
  return dates;
});

// 计算 7 天新增句子的数值与点坐标
const trendPoints = computed<TrendPoint[]>(() => {
  const sList = activeSentences.value;
  const days = last7DaysInfo.value;
  
  // 计算 7 天内每天的新增量
  const counts = days.map(day => {
    return sList.filter(s => s.addedAt >= day.timestampStart && s.addedAt <= day.timestampEnd).length;
  });

  const maxVal = Math.max(...counts, 4); // 默认最高度至少为 4，保证图表舒展
  const points: TrendPoint[] = [];

  // SVG 宽高规格为 600 * 220
  // 网格左边距 40，右边距 560，宽度 520px；折线图高从 y=30 到 y=180
  const startX = 60;
  const endX = 540;
  const stepX = (endX - startX) / 6;
  const startY = 180;
  const endY = 40;

  for (let i = 0; i < 7; i++) {
    const val = counts[i];
    const x = startX + i * stepX;
    // 数值转换 y 坐标
    const ratio = val / maxVal;
    const y = startY - ratio * (startY - endY);
    points.push({
      x,
      y,
      val,
      date: days[i].dateStr,
      label: days[i].label
    });
  }

  return points;
});

// 折线最大 Y 刻度值
const trendMaxY = computed(() => Math.max(...trendPoints.value.map(p => p.val), 4));

// 贝塞尔曲线平滑折线路径 (Cubic Bezier)
const trendLinePath = computed(() => {
  const pts = trendPoints.value;
  if (pts.length === 0) return '';
  
  let path = `M ${pts[0].x} ${pts[0].y}`;
  // 采用三次贝塞尔平滑
  for (let i = 0; i < pts.length - 1; i++) {
    const cp1x = pts[i].x + 35;
    const cp1y = pts[i].y;
    const cp2x = pts[i+1].x - 35;
    const cp2y = pts[i+1].y;
    path += ` C ${cp1x} ${cp1y}, ${cp2x} ${cp2y}, ${pts[i+1].x} ${pts[i+1].y}`;
  }
  return path;
});

// 渐变填充背景面积路径
const trendAreaPath = computed(() => {
  const pts = trendPoints.value;
  if (pts.length === 0) return '';
  const linePath = trendLinePath.value;
  // 底部闭合：到最右侧底部 x=540, y=180，再到最左侧底部 x=60, y=180，最后闭合
  return `${linePath} L ${pts[pts.length - 1].x} 180 L ${pts[0].x} 180 Z`;
});

/**
 * ---------------------------------------
 * D. 艾宾浩斯占比圆环计算
 * ---------------------------------------
 */
const masteredPercent = computed(() => {
  const sList = activeSentences.value;
  if (sList.length === 0) return 0;
  const mastered = sList.filter(s => s.status === 'mastered').length;
  return Math.round((mastered / sList.length) * 100);
});

// 四个环的半径及属性
const rings = computed(() => {
  const sList = activeSentences.value;
  const total = sList.length || 1;

  // 1. 分类计数
  const cNew = sList.filter(s => s.reviewCount === 0).length;
  const cShort = sList.filter(s => s.reviewCount >= 1 && s.reviewCount <= 2).length;
  const cMedium = sList.filter(s => s.reviewCount >= 3 && s.reviewCount <= 5).length;
  const cLong = sList.filter(s => s.reviewCount >= 6 || s.status === 'mastered').length;

  const list = [
    { name: '新进词本', count: cNew, color: 'var(--color-primary)', radius: 62 },
    { name: '浅层记忆', count: cShort, color: 'var(--color-accent)', radius: 50 },
    { name: '中度记忆', count: cMedium, color: '#eab308', radius: 38 },
    { name: '已掌握词', count: cLong, color: 'var(--color-success)', radius: 26 },
  ];

  return list.map(item => {
    const pct = Math.round((item.count / total) * 100);
    // 周长 = 2 * PI * r
    const perimeter = 2 * Math.PI * item.radius;
    // 进度偏移，未录入句子时比例按 0.05 兜底展示虚环以保持美观，否则按百分比
    const fraction = sList.length === 0 ? 0.05 : item.count / total;
    
    return {
      name: item.name,
      count: item.count,
      percent: pct,
      color: item.color,
      radius: item.radius,
      dashArray: perimeter,
      dashOffset: perimeter * (1 - fraction)
    };
  });
});

/**
 * ---------------------------------------
 * E. GitHub 复习打卡热力图计算
 * ---------------------------------------
 */
interface HeatmapCell {
  date: string;
  count: number;
  level: 0 | 1 | 2 | 3 | 4;
  color: string;
  x?: number;
  y?: number;
}

const hoveredCell = ref<HeatmapCell | null>(null);

const showCellTooltip = (event: MouseEvent, day: HeatmapCell) => {
  // 获取相对于父容器的排版坐标
  const rect = (event.currentTarget as SVGElement).getBoundingClientRect();
  const parentRect = (event.currentTarget as SVGElement).closest('.grid-scroller')?.getBoundingClientRect();
  if (!parentRect) return;

  hoveredCell.value = {
    ...day,
    x: rect.left - parentRect.left + 5,
    y: rect.top - parentRect.top - 5
  };
};

const hideCellTooltip = () => {
  hoveredCell.value = null;
};

// 16周 (112天) 的格子矩阵：16 列 * 7 行
const numWeeks = 16;
const heatmapWidth = computed(() => numWeeks * 14);

const heatMapData = computed<HeatmapCell[][]>(() => {
  const logs = activeReviewLogs.value;
  const dataGrid: HeatmapCell[][] = [];
  const oneDay = 24 * 60 * 60 * 1000;
  
  // 找出最近一个星期天（作为末尾格子对齐）
  const now = new Date();
  const currentDayOfWeek = now.getDay(); // 0 是周日, 1-6 是周一到周六
  // 算到本周末（周日）还有几天
  const daysToSunday = (7 - currentDayOfWeek) % 7;
  const lastSunday = new Date(now.getTime() + daysToSunday * oneDay);
  lastSunday.setHours(23, 59, 59, 999);
  
  const totalDays = numWeeks * 7;
  const startDayTime = lastSunday.getTime() - (totalDays - 1) * oneDay;

  // 将 logs 分桶存成 YYYY-MM-DD
  const logCounts: Record<string, number> = {};
  logs.forEach(log => {
    const date = new Date(log.timestamp);
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    const key = `${y}-${m}-${d}`;
    logCounts[key] = (logCounts[key] || 0) + 1;
  });

  // 按列填充：共 16 列，每列 7 天 (周一到周日)
  for (let w = 0; w < numWeeks; w++) {
    const column: HeatmapCell[] = [];
    for (let d = 0; d < 7; d++) {
      const dayOffset = w * 7 + d;
      const dayTimestamp = startDayTime + dayOffset * oneDay;
      const dateObj = new Date(dayTimestamp);
      const y = dateObj.getFullYear();
      const m = String(dateObj.getMonth() + 1).padStart(2, '0');
      const dayVal = String(dateObj.getDate()).padStart(2, '0');
      const dateStr = `${y}-${m}-${dayVal}`;

      const count = logCounts[dateStr] || 0;
      
      // 等级划分 (复习强度)
      let level: 0 | 1 | 2 | 3 | 4 = 0;
      let color = 'rgba(255, 255, 255, 0.02)'; // 未打卡底色

      if (count > 0) {
        if (count <= 2) {
          level = 1;
          color = 'rgba(16, 185, 129, 0.2)'; // 极光绿轻度
        } else if (count <= 5) {
          level = 2;
          color = 'rgba(16, 185, 129, 0.45)'; // 极光绿中度
        } else if (count <= 9) {
          level = 3;
          color = 'rgba(16, 185, 129, 0.7)'; // 极光绿强度
        } else {
          level = 4;
          color = 'rgba(16, 185, 129, 0.95)'; // 深度发光打卡
        }
      }

      column.push({
        date: `${m}-${dayVal}`,
        count,
        level,
        color
      });
    }
    dataGrid.push(column);
  }

  return dataGrid;
});
</script>

<style scoped>
.dashboard-container {
  padding: 0; /* 仅依靠父容器 padding: 40px 留白，实现上下完全对称 */
  width: 100%;
  max-width: 100%;
  height: auto !important; /* 覆盖 tab-content-view 的 height: 100%，让高度由内容自然撑开，确保底部留白正常 */
  display: flex;
  flex-direction: column;
  gap: 20px;
  animation: fadeIn 0.4s ease-out;
  box-sizing: border-box;
}

@keyframes fadeIn {
  from { opacity: 0; transform: translateY(8px); }
  to { opacity: 1; transform: translateY(0); }
}

/* 演示数据顶部提示横幅 */
.demo-banner {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px 20px;
  background: rgba(99, 102, 241, 0.06);
  border: 1px solid rgba(99, 102, 241, 0.15);
  border-radius: var(--radius-md);
  backdrop-filter: var(--glass-blur);
  margin-bottom: 4px;
}

.demo-badge {
  background: var(--color-primary);
  color: #fff;
  font-size: 11px;
  font-weight: 600;
  padding: 3px 8px;
  border-radius: 99px;
  white-space: nowrap;
}

.demo-text {
  font-size: 13px;
  color: var(--text-secondary);
  line-height: 1.4;
}

/* 磨砂玻璃卡片基底 */
.glass-panel {
  background: var(--glass-bg);
  border: 1px solid var(--glass-border);
  border-radius: var(--radius-md);
  box-shadow: var(--glass-shadow);
  backdrop-filter: var(--glass-blur);
  transition: border-color var(--transition-fast), transform var(--transition-smooth), box-shadow var(--transition-smooth);
}

.glass-panel:hover {
  border-color: var(--glass-border-hover);
  transform: translateY(-2px);
  box-shadow: 0 12px 40px 0 rgba(0, 0, 0, 0.45);
}

/* 顶部指标网格 */
.metrics-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: 16px;
}

.metric-card {
  padding: 20px;
  display: flex;
  align-items: center;
  gap: 16px;
  position: relative;
  overflow: hidden;
}

.metric-icon {
  width: 48px;
  height: 48px;
  border-radius: var(--radius-sm);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 22px;
  border: 1px solid rgba(255, 255, 255, 0.05);
}

.metric-info {
  flex: 1;
}

.metric-label {
  font-size: 13px;
  color: var(--text-secondary);
  margin-bottom: 4px;
}

.metric-value {
  font-size: 26px;
  font-weight: 700;
  font-family: 'Outfit', sans-serif;
  color: var(--text-primary);
}

.metric-trend {
  position: absolute;
  top: 12px;
  right: 16px;
  font-size: 11px;
  padding: 2px 6px;
  border-radius: 4px;
  font-weight: 500;
}

.trend-success {
  background: rgba(16, 185, 129, 0.1);
  color: var(--color-success);
  border: 1px solid rgba(16, 185, 129, 0.2);
}

.trend-accent {
  background: rgba(244, 63, 94, 0.1);
  color: var(--color-accent);
  border: 1px solid rgba(244, 63, 94, 0.2);
}

.trend-neutral {
  background: rgba(255, 255, 255, 0.05);
  color: var(--text-secondary);
  border: 1px solid rgba(255, 255, 255, 0.08);
}

/* 图表双栏布局 */
.charts-grid {
  display: flex;
  gap: 20px;
  flex-wrap: wrap;
}

.chart-card {
  padding: 24px;
  display: flex;
  flex-direction: column;
  gap: 16px;
  box-sizing: border-box;
  overflow: hidden; /* 防止子元素溢出撑大卡片 */
}

.flex-1 { flex: 1; min-width: 260px; }
.flex-2 { flex: 2; min-width: 320px; }
.flex-3 { flex: 3; min-width: 320px; }

.chart-header {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.chart-title {
  font-size: 16px;
  font-weight: 600;
  color: var(--text-primary);
}

.chart-subtitle {
  font-size: 12px;
  color: var(--text-muted);
}

.chart-content {
  flex: 1;
  min-height: 200px;
  display: flex;
  justify-content: center;
  width: 100%;        /* 占满父容器宽度 */
  overflow: hidden;   /* 限制子元素（如 SVG）撑大 */
}

/* 1. 折线图 SVG 细部 */
.trend-svg {
  display: block;
  width: 100%;
  max-width: 100%;
}

.grid-line {
  stroke: rgba(255, 255, 255, 0.03);
  stroke-width: 1;
}

.stroke-strong {
  stroke: rgba(255, 255, 255, 0.08);
}

.axis-text {
  fill: var(--text-muted);
  font-size: 11px;
  font-family: 'Outfit', sans-serif;
}

.text-right { text-anchor: end; }
.text-center { text-anchor: middle; }

.trend-dot {
  cursor: pointer;
  transition: r var(--transition-fast), stroke-width var(--transition-fast);
}

.trend-dot:hover {
  r: 8;
  stroke-width: 4;
}

/* Tooltip 弹窗 */
.chart-tooltip {
  position: absolute;
  pointer-events: none;
  background: rgba(15, 23, 42, 0.9);
  border: 1px solid rgba(255, 255, 255, 0.15);
  border-radius: var(--radius-sm);
  padding: 6px 12px;
  box-shadow: 0 4px 20px rgba(0,0,0,0.5);
  backdrop-filter: blur(12px);
  transform: translateX(-50%);
  display: flex;
  flex-direction: column;
  gap: 2px;
  z-index: 10;
  transition: left 0.15s ease, top 0.15s ease;
}

.tooltip-date {
  font-size: 10px;
  color: var(--text-muted);
}

.tooltip-value {
  font-size: 13px;
  font-weight: 600;
  color: var(--text-primary);
}

/* 2. 艾宾浩斯环形占比图 */
.flex-row {
  display: flex;
  flex-direction: row;
}

.align-center { align-items: center; }
.justify-between { justify-content: space-between; }

.ring-chart-container {
  width: 130px;
  height: 130px;
  flex-shrink: 0;
  position: relative;
  display: flex;
  align-items: center;
  justify-content: center;
}

.ring-svg {
  width: 100%;
  height: 100%;
}

.ring-progress-arc {
  transition: stroke-dashoffset 0.8s cubic-bezier(0.16, 1, 0.3, 1);
}

.ring-center-value {
  position: absolute;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
}

.ring-center-value .pct {
  font-size: 20px;
  font-weight: 700;
  font-family: 'Outfit', sans-serif;
  color: var(--text-primary);
}

.ring-center-value .lbl {
  font-size: 10px;
  color: var(--text-muted);
  margin-top: 2px;
}

.ring-labels {
  display: flex;
  flex-direction: column;
  gap: 10px;
  padding-left: 0;
  width: 120px;
  flex-shrink: 0;
}

.ring-chart-content {
  display: flex;
  flex-direction: row;
  align-items: center;
  justify-content: center;
  gap: 32px;
  width: 100%;
}

.ring-label-item {
  display: flex;
  align-items: center;
  gap: 10px;
}

.color-indicator {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  flex-shrink: 0;
  box-shadow: 0 0 8px currentColor;
}

.label-info {
  display: flex;
  flex-direction: column;
}

.label-info .name {
  font-size: 12px;
  color: var(--text-secondary);
}

.label-info .value-pct {
  font-size: 11px;
  font-family: 'Outfit', sans-serif;
  color: var(--text-muted);
  margin-top: 2px;
}

/* 底部区域 */
.dashboard-footer-grid {
  display: flex;
  gap: 20px;
  flex-wrap: wrap;
}

/* 3. GitHub 打卡热力图 */
.grid-legend {
  display: flex;
  align-items: center;
  gap: 4px;
  font-size: 11px;
  color: var(--text-muted);
}

.legend-box {
  width: 10px;
  height: 10px;
  border-radius: 2px;
  background: var(--glass-bg);
  border: 1px solid var(--glass-border);
}

.legend-box.level-0 { background: rgba(255, 255, 255, 0.02); }
.legend-box.level-1 { background: rgba(16, 185, 129, 0.2); }
.legend-box.level-2 { background: rgba(16, 185, 129, 0.45); }
.legend-box.level-3 { background: rgba(16, 185, 129, 0.7); }
.legend-box.level-4 { background: rgba(16, 185, 129, 0.95); }

.grid-scroller {
  overflow-x: auto;
  display: flex;
  align-items: center;
  justify-content: flex-start; /* 避免 center 导致溢出截断 */
  padding-bottom: 8px;
  width: 100%;                 /* 限制宽度为 100% */
}

.heatmap-wrapper {
  display: flex;
  gap: 10px;
  align-items: flex-start;
  user-select: none;
  margin: 0 auto; /* 空间充足时水平居中，不足时靠左并允许横向滚动 */
}

.weekday-labels {
  display: flex;
  flex-direction: column;
  gap: 7px;
  font-size: 9px;
  color: var(--text-muted);
  padding-top: 1px;
}

.weekday-labels span {
  height: 11px;
  line-height: 11px;
}

.heatmap-svg {
  display: block;
}

.heatmap-cell {
  cursor: pointer;
  stroke: rgba(255, 255, 255, 0.02);
  stroke-width: 0.5;
  transition: transform var(--transition-fast), stroke var(--transition-fast);
}

.heatmap-cell:hover {
  transform: scale(1.15);
  transform-origin: center;
  stroke: rgba(255, 255, 255, 0.4);
}

.grid-tooltip {
  position: absolute;
  pointer-events: none;
  background: rgba(15, 23, 42, 0.95);
  border: 1px solid rgba(255, 255, 255, 0.15);
  border-radius: var(--radius-sm);
  padding: 4px 10px;
  font-size: 11px;
  color: var(--text-primary);
  box-shadow: 0 4px 15px rgba(0,0,0,0.5);
  backdrop-filter: blur(8px);
  transform: translate(-50%, -100%);
  z-index: 10;
  white-space: nowrap;
}

/* 4. 金句卡片 */
.sentence-quote-card {
  padding: 30px;
  text-align: center;
  min-height: 150px;
  background: linear-gradient(135deg, rgba(99, 102, 241, 0.05) 0%, rgba(16, 185, 129, 0.03) 100%);
  min-width: 260px;
  display: flex;
  flex-direction: column;
  justify-content: center;
  align-items: center;
}

.quote-glow-bg {
  position: absolute;
  width: 200px;
  height: 200px;
  background: radial-gradient(circle, rgba(99, 102, 241, 0.08) 0%, transparent 70%);
  top: -50px;
  right: -50px;
  pointer-events: none;
}

.quote-mark {
  font-size: 60px;
  font-family: Georgia, serif;
  color: rgba(99, 102, 241, 0.15);
  position: absolute;
  top: 0;
  left: 20px;
  line-height: 1;
}

.quote-content {
  font-size: 15px;
  font-weight: 500;
  color: var(--text-primary);
  line-height: 1.6;
  margin-bottom: 12px;
  z-index: 1;
  font-family: 'Outfit', var(--font-sans);
}

.quote-translation {
  font-size: 12px;
  color: var(--text-secondary);
  line-height: 1.4;
  margin-bottom: 14px;
  z-index: 1;
}

.quote-author {
  font-size: 11px;
  font-style: italic;
  color: var(--text-muted);
  align-self: flex-end;
  z-index: 1;
}

/* 亮色模式微调 */
.light-theme .glass-panel {
  box-shadow: var(--glass-shadow);
}

.light-theme .metric-card {
  background: var(--glass-bg);
}

.light-theme .quote-mark {
  color: rgba(99, 102, 241, 0.08);
}

.light-theme .legend-box.level-0 {
  background: rgba(0, 0, 0, 0.03);
}

.light-theme .heatmap-cell.level-0 {
  fill: rgba(0, 0, 0, 0.03) !important;
}

.light-theme .chart-tooltip,
.light-theme .grid-tooltip {
  background: rgba(255, 255, 255, 0.95);
  border: 1px solid rgba(99, 102, 241, 0.1);
  color: #000;
  box-shadow: 0 8px 30px rgba(99, 102, 241, 0.08);
}

.light-theme .tooltip-date {
  color: #64748b;
}

.light-theme .tooltip-value {
  color: #000;
}
</style>
