/**
 * StickyTabView 功能全览 Demo
 *
 * 覆盖功能清单：
 *   ① StickyTabView    — 可折叠 Header + 横向分页 Tab + 各 Tab 独立 scroll state
 *   ② ref.setTab       — 编程跳转 Tab（点击 TabBar 时调用）
 *   ③ Tab 1 "文章"     — ElasticScrollView + 下拉刷新 + 触底加载更多 + bounces
 *   ④ Tab 2 "瀑布流"   — MasonryList 双列 + 异步 onFetch 分页 + 下拉刷新 + 首屏 Loading
 *   ⑤ Tab 3 "分页"     — ElasticScrollView + pagingEnabled="vertical"（滑动吸附翻页）
 *   ⑥ Tab 4 "关于"     — ElasticScrollView + contentInsets + showsVerticalScrollIndicator
 */

import React, { useRef, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  View,
  Image,
} from "react-native";
import Reanimated, {
  SharedValue,
  useAnimatedReaction,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from "react-native-reanimated";
import { scheduleOnRN } from "react-native-worklets";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import {
  StickyTabView,
  ElasticScrollView,
  MasonryList,
  TItemBase,
  TOnRefreshParam,
} from "@jadezhou/sticky-tab-view";

// ─── 布局常量 ──────────────────────────────────────────────────────────────────
const HEADER_BASE_H = 220; // 可折叠 Header 的基础高度
const TAB_BAR_H = 48; // TabBar 的高度（同时是吸顶后保留高度）
const PAGE_H = 520; // Tab3 每张分页卡片的高度
const P_Top = 16; // Tab 内容顶部的内边距

// ─── 颜色 ──────────────────────────────────────────────────────────────────────
const C = {
  purple: "#6C5CE7",
  green: "#00B894",
  orange: "#E17055",
  blue: "#0984E3",
  pink: "#E84393",
  teal: "#00CEC9",
  bg: "#F2F3F7",
  white: "#FFFFFF",
  text: "#1A1A2E",
  textSub: "#666666",
  textMuted: "#BBBBBB",
  border: "#E8E8E8",
  IKB:"#002FA7",
};

// ─── 类型 ──────────────────────────────────────────────────────────────────────
type Article = {
  id: string;
  title: string;
  summary: string;
  author: string;
  tag: string;
  tagColor: string;
  readMin: number;
  date: string;
  bg: string;
};

type PhotoItem = TItemBase & {
  id: string;
  color: string;
  height: number;
  likes: number;
  imageUrl: string;
};

// ─── Mock 数据生成 ─────────────────────────────────────────────────────────────
const TITLES = [
  "React Native 新架构深度解析",
  "Reanimated v4 手势系统完全指南",
  "Flutter vs RN 2026 年对决",
  "Expo SDK 55 全新特性速览",
  "TypeScript 5.9 泛型高级用法",
  "JSI 原生模块从零到一",
  "Hermes 引擎：解析到执行",
  "Metro 打包速度极限优化",
  "iOS 18 隐私权限全面适配",
  "Android 15 新 API 踩坑",
  "React 19 并发特性最佳实践",
  "Zustand vs MobX 横向对比",
];
const SUMMARIES = [
  "深入源码，看清每行背后的意图，理解设计决策与取舍。",
  "原理 + 实战，帮你快速掌握核心知识点，避免常见误区。",
  "全面对比两大框架的生态、性能与开发体验，做出合理选型。",
  "从零到一，用最短路径完成项目落地，包含 5 个真实案例。",
  "避开常见陷阱，少走一年弯路，节省数百小时调试时间。",
];
const TAGS = [
  { tag: "架构", color: C.purple },
  { tag: "动画", color: C.green },
  { tag: "性能", color: C.orange },
  { tag: "工具链", color: C.blue },
];
const CARD_BGS = [
  "#D9E4FF",
  "#F0FFF8",
  "#FFF5F0",
  "#F0FFFE",
  "#FFF8F0",
  "#F8F0FF",
];
const PHOTO_COLORS = [
  "#D6E4FF",
  "#D6FFE4",
  "#FFD6D6",
  "#FFE4D6",
  "#E4D6FF",
  "#D6F5FF",
  "#FFECD6",
  "#EAFFD6",
];
const PHOTO_TITLES = [
  "深夜 Debug 破防瞬间",
  "删库跑路纪念留影",
  "产品经理求饶实录",
  "Git Push --force 惨案",
  "祖传代码屎山大搜赏",
  "面向 StackOverflow 编程",
  "摸鱼高阶指北",
  "需求评审之舌战群儒",
  "一杯茶一包烟",
  "AI 生成代码翻车现场",
  "明天上线今天重构",
  "测试妹子又在喊了",
];
const PHOTO_HEIGHTS = [
  160, 220, 140, 260, 180, 200, 150, 240, 170, 190, 130, 280,
];
const STORIES = [
  {
    emoji: "🌅",
    title: "垂直分页演示",
    sub: "向上滑动，每张卡片独立吸附 ↑",
    bg: "#4A90D9",
  },
  {
    emoji: "🎨",
    title: "pagingEnabled",
    sub: '"vertical" 模式，松手自动对齐',
    bg: C.purple,
  },
  {
    emoji: "🚀",
    title: "pageSize 可定制",
    sub: "传入 { height: 320 } 固定页高",
    bg: C.green,
  },
  {
    emoji: "⚡",
    title: "速度感应换页",
    sub: "快划直接跳到下一页",
    bg: C.orange,
  },
  {
    emoji: "🌊",
    title: "弹性物理动画",
    sub: "withSpring 驱动，手感细腻自然",
    bg: C.teal,
  },
  {
    emoji: "🎯",
    title: "到达最后一页",
    sub: "继续上滑会被边界回弹拦住",
    bg: C.pink,
  },
];

function genArticles(tab: number, page: number, count = 10): Article[] {
  return Array.from({ length: count }, (_, i) => {
    const g = page * count + i + tab * 5;
    const { tag, color } = TAGS[g % TAGS.length];
    return {
      id: `a-${tab}-${page}-${i}`,
      title: `${TITLES[g % TITLES.length]}`,
      summary: SUMMARIES[g % SUMMARIES.length],
      author: ["Jade Zhou", "Jade Zhou", "Jade Zhou", "Jade Zhou"][g % 4],
      tag,
      tagColor: color,
      readMin: 3 + (g % 8),
      date: `2026-03-${String(1 + (g % 28)).padStart(2, "0")}`,
      bg: CARD_BGS[g % CARD_BGS.length],
    };
  });
}

function genPhotos(page: number, count = 8): PhotoItem[] {
  return Array.from({ length: count }, (_, i) => {
    const g = page * count + i;
    const height = PHOTO_HEIGHTS[g % PHOTO_HEIGHTS.length];
    return {
      id: `ph-${page}-${i}`,
      color: PHOTO_COLORS[g % PHOTO_COLORS.length],
      height,
      likes: 100 + ((g * 37) % 900),
      imageUrl: `https://picsum.photos/seed/bug${g}/400/${height}`,
    };
  });
}

function ArticleCard({ item }: { item: Article }) {
  return (
    <View style={[styles.articleCard, { backgroundColor: item.bg }]}>
      <View style={styles.articleRow}>
        <View style={[styles.tag, { backgroundColor: item.tagColor }]}>
          <Text style={styles.tagText}>{item.tag}</Text>
        </View>
        <Text style={styles.articleMeta}>
          {item.readMin} min · {item.date}
        </Text>
      </View>
      <Text style={styles.articleTitle}>{item.title}</Text>
      <Text style={styles.articleSummary} numberOfLines={2}>
        {item.summary}
      </Text>
      <Text style={styles.articleAuthor}>by {item.author}</Text>
    </View>
  );
}

function PhotoCard({ item }: { item: PhotoItem }) {
  // renderItem 会被放在 WaterfallItem 里，其父 View 已设好 { width, height }
  return (
    <View style={[styles.photoCard, { backgroundColor: item.color }]}>
      <Image
        source={{ uri: item.imageUrl }}
        style={StyleSheet.absoluteFillObject}
      />
      <View style={styles.photoOverlay} />
      <Text style={styles.photoLikes}>♥ {item.likes}</Text>
    </View>
  );
}

function ListEnd({ count, total }: { count: number; total: number }) {
  return (
    <View style={styles.listEnd}>
      <Text style={styles.listEndText}>
        — 已加载 {count} / {total} 条，已全部显示 —
      </Text>
    </View>
  );
}

// ─── Tab 1：文章列表（下拉刷新 + 触底加载更多） ──────────────────────────────
function Tab1Articles({ tabIndex }: { tabIndex: number }) {
  const insets = useSafeAreaInsets();
  const TOTAL_H = HEADER_BASE_H + insets.top + TAB_BAR_H + P_Top;

  const [items, setItems] = useState<Article[]>(() => genArticles(tabIndex, 0));
  const pageRef = useRef(1);
  const [allLoaded, setAllLoaded] = useState(false);

  const handleRefresh = ({ endRefresh, canLoadMore }: TOnRefreshParam) => {
    setTimeout(() => {
      pageRef.current = 1;
      setAllLoaded(false);
      setItems(genArticles(tabIndex, 0));
      canLoadMore.value = true;
      endRefresh();
    }, 1400);
  };

  const handleEndReached = async (): Promise<boolean | undefined> => {
    if (pageRef.current >= 4) {
      setAllLoaded(true);
      return false;
    }
    await new Promise<void>((r) => setTimeout(r, 900));
    const page = pageRef.current;
    setItems((prev) => [...prev, ...genArticles(tabIndex, page)]);
    pageRef.current = page + 1;
    const hasMore = pageRef.current < 4;
    if (!hasMore) setAllLoaded(true);
    return hasMore;
  };

  return (
    <ElasticScrollView
      bounces="vertical"
      showsVerticalScrollIndicator={false}
      onRefresh={handleRefresh}
      onEndReached={handleEndReached}
      endReachedThreshold={400}
    >
      {/* StickyTabView 要求每个 Tab 内容顶部留出 Header 等高的空白 */}
      <View style={{ height: TOTAL_H }} />
      <View style={styles.pad}>
        {items.map((item) => (
          <ArticleCard key={item.id} item={item} />
        ))}
        {allLoaded && <ListEnd count={items.length} total={40} />}
      </View>
    </ElasticScrollView>
  );
}

// ─── Tab 2：瀑布流（Waterfall + 异步分页 + 首屏 Loading） ─────────────────────
function Tab2Waterfall() {
  const insets = useSafeAreaInsets();
  const TOTAL_H = HEADER_BASE_H + insets.top + TAB_BAR_H;

  const pageRef = useRef(0);

  const onFetch = async (page: number) => {
    // 模拟网络请求延迟
    await new Promise<void>((r) => setTimeout(r, page === 0 ? 1200 : 700));
    const items = genPhotos(page, 8);
    return { items, hasMore: page < 3 };
  };


  return (
    <MasonryList<PhotoItem>
      bounces="vertical"
      showsVerticalScrollIndicator={false}
      onFetch={onFetch}
      // 每列 2 列瀑布流
      columnForSection={() => 2}
      // 根据 PhotoItem.height 决定每个格子的高度（含内边距）
      heightForItem={(item) => item.height + 36}
      renderItem={(item) => <PhotoCard item={item} />}
      horizontalPadding={12}
      gap={10}
      renderLoading={() => (
        <View style={styles.loadingCenter}>
          <ActivityIndicator size="large" color={C.purple} />
          <Text style={styles.loadingText}>首次加载中…</Text>
        </View>
      )}
      renderLoadingMore={() => (
        <View style={styles.loadMoreRow}>
          <ActivityIndicator size="small" color={C.purple} />
          <Text style={styles.loadMoreText}>加载更多…</Text>
        </View>
      )}
      renderEmpty={() => (
        <View style={styles.emptyBox}>
          <Text style={styles.emptyText}>暂无内容</Text>
        </View>
      )}
      renderHeader={() => (
        <View>
          <View style={{ height: TOTAL_H }} />
        </View>
      )}
    />
  );
}

// ─── Tab 3：垂直分页（pagingEnabled="vertical" + 固定 pageSize） ──────────────
function Tab3Paging() {
  const insets = useSafeAreaInsets();
  const TOTAL_H = HEADER_BASE_H + insets.top + TAB_BAR_H;

  // pageH = 容器实测高度（屏幕高度 - 安全区 top - 底部导航），0 表示还未测量
  const [pageH, setPageH] = useState(0);

  return (
    <ElasticScrollView
      bounces="vertical"
      pagingEnabled="vertical"
      // pageSize.height=0 → 库自动用容器高度（size.height.value）
      // 测量完成后换成实测值，保证卡片高度与吸附步长严格一致
      pageSize={{ width: 0, height: pageH }}
      showsVerticalScrollIndicator={false}
      onSizeChange={({ height }) => {
        // 只取第一次有效值，避免 Header 折叠时容器尺寸变化触发重渲染
        if (height > 0 && pageH === 0) setPageH(height);
      }}
    >
      {STORIES.map((story, idx) => (
        <View
          key={idx}
          style={[
            styles.storyCard,
            {
              backgroundColor: story.bg,
              height: pageH || PAGE_H,
              // 第 0 张卡片 Header 完全展开（TOTAL_H），之后 Header 已折叠（TAB_BAR_H）
              paddingTop: idx === 0 ? TOTAL_H : TAB_BAR_H,
            },
          ]}
        >
          <Text style={styles.storyEmoji}>{story.emoji}</Text>
          <Text style={styles.storyTitle}>{story.title}</Text>
          <Text style={styles.storySubtitle}>{story.sub}</Text>
          <View style={styles.storyBadge}>
            <Text style={styles.storyBadgeText}>
              第 {idx + 1} / {STORIES.length} 页
            </Text>
          </View>
        </View>
      ))}
      <View style={styles.listEnd}>
        <Text style={styles.listEndText}>— 已到最后一页 —</Text>
      </View>
    </ElasticScrollView>
  );
}

// ─── Demo Header（可折叠的个人主页 Banner） ───────────────────────────────────
function DemoHeader() {
  const insets = useSafeAreaInsets();
  return (
    <View style={[styles.headerWrap, { height: HEADER_BASE_H + insets.top }]}>
      <View style={[styles.headerBg, { paddingTop: 18 + insets.top }]}>
        {/* 顶部信息行 */}
        <View style={styles.headerTop}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>CJ</Text>
          </View>
          <View style={{ flex: 1, marginLeft: 14 }}>
            <Text style={styles.headerName}>StickyTabView</Text>
            <Text style={styles.headerHandle}>@ui-library · React Native</Text>
          </View>
        </View>
        {/* 简介 */}
        <Text style={styles.headerBio}>
          {"高性能滚动容器 + 可折叠/可滑动 Header + 瀑布流 + 垂直分页。\n基于 Reanimated 4 和 RNGH v2 构建。🚀"}
        </Text>
        {/* 统计数字行 */}
        <View style={styles.statsRow}>
          {[
            ["128", "文章"],
            ["3.2K", "点赞"],
            ["892", "关注者"],
            ["46", "话题"],
          ].map(([n, l]) => (
            <View key={l} style={styles.statItem}>
              <Text style={styles.statNum}>{n}</Text>
              <Text style={styles.statLabel}>{l}</Text>
            </View>
          ))}
        </View>
      </View>
    </View>
  );
}

// ─── Demo TabBar（接收 SharedValue，带弹性指示器） ────────────────────────────
const TABS = ["文章", "瀑布流", "分页"];

interface TabBarProps {
  x: SharedValue<number>;
  ys: SharedValue<number>[];
  current: SharedValue<number>;
  activeHeaderOffset: SharedValue<number>;
  onSelect: (index: number) => void;
}

function DemoTabBar({ activeHeaderOffset, current, onSelect, ys }: TabBarProps) {
  const [curJS, setCurJS] = useState(0);
  const [barWidth, setBarWidth] = useState(0);
  const indicatorX = useSharedValue(0);

  useAnimatedReaction(
    () => current.value,
    (next, prev) => {
      if (next !== prev) scheduleOnRN(setCurJS, next);
    },
  );

  useAnimatedReaction(
    () => ys[current.value]?.value ?? 0,
    (offset) => {
      activeHeaderOffset.value = offset;
    },
    [activeHeaderOffset, current, ys],
  );

  const tabW = barWidth / TABS.length;

  React.useEffect(() => {
    indicatorX.value = withSpring(curJS * tabW, {
      damping: 22,
      stiffness: 320,
    });
  }, [curJS, tabW]);

  const indicatorStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: indicatorX.value }],
  }));

  return (
    <View
      style={styles.tabBar}
      onLayout={(e) => setBarWidth(e.nativeEvent.layout.width)}
    >
      <View style={styles.tabsRow}>
        {TABS.map((tab, idx) => (
          <Pressable
            key={tab}
            style={styles.tabItem}
            onPress={() => onSelect(idx)}
          >
            <Text
              style={[styles.tabText, curJS === idx && styles.tabTextActive]}
            >
              {tab}
            </Text>
          </Pressable>
        ))}
      </View>
      <Reanimated.View
        style={[
          styles.indicator,
          { width: tabW || `${100 / TABS.length}%` },
          indicatorStyle,
        ]}
      />
    </View>
  );
}

// ─── 独立悬浮导航栏 ─────────────────────────────────────────────────────────────
export function getHeaderNavOpacity(
  offset: number,
  headerDistance: number,
): number {
  "worklet";
  const distance = Number.isFinite(headerDistance)
    ? Math.max(0, headerDistance)
    : 0;
  if (distance === 0) return 0;
  const start = Math.max(0, distance - 60);
  return Math.min(1, Math.max(0, (offset - start) / (distance - start)));
}

const AnimatedNavBar = ({
  activeHeaderOffset,
  headerDistance,
  insetsTop,
}: {
  activeHeaderOffset: SharedValue<number>;
  headerDistance: number;
  insetsTop: number;
}) => {
  const navStyle = useAnimatedStyle(() => {
    const opacity = getHeaderNavOpacity(
      activeHeaderOffset.value,
      headerDistance,
    );
    return { opacity, zIndex: 100 };
  });

  return (
    <Reanimated.View
      style={[
        styles.stickyNavBar,
        navStyle,
        { height: insetsTop + 44, paddingTop: insetsTop },
      ]}
      pointerEvents="none"
    >
      <Text style={styles.navBarTitle}>Jade Zhou</Text>
    </Reanimated.View>
  );
};

// ─── 主组件 ───────────────────────────────────────────────────────────────────
export function StickyTabViewDemoScreen() {
  const insets = useSafeAreaInsets();
  const tabRef = useRef<{ setTab: (page: number) => void }>(null);
  const activeHeaderOffset = useSharedValue(0);

  const TOTAL_H = HEADER_BASE_H + insets.top;
  const NAV_BAR_H = insets.top + 44;

  const renderTab = (index: number) => {
    switch (index) {
      case 0:
        return <Tab1Articles tabIndex={0} />;
      case 1:
        return <Tab2Waterfall />;
      case 2:
        return <Tab3Paging />;
      default:
        return null;
    }
  };

  return (
    <View style={styles.screen}>
      <StickyTabView
        ref={tabRef}
        tabCount={TABS.length}
        tabBarHeight={TAB_BAR_H}
        headerOffset={NAV_BAR_H}
        renderHeader={() => <DemoHeader />}
        renderTab={renderTab}
        renderTabBar={(x, ys, current) => {
          return (
            <DemoTabBar
              x={x}
              ys={ys}
              current={current}
              activeHeaderOffset={activeHeaderOffset}
              onSelect={(i) => tabRef.current?.setTab(i)}
            />
          );
        }}
      />
      <AnimatedNavBar
        activeHeaderOffset={activeHeaderOffset}
        headerDistance={TOTAL_H - TAB_BAR_H - NAV_BAR_H}
        insetsTop={insets.top}
      />
    </View>
  );
}

// ─── 样式 ─────────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: C.bg },
  pad: { paddingHorizontal: 14, gap: 10, paddingBottom: 8 },

  // ── 悬浮导航栏 ──
  stickyNavBar: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    backgroundColor: C.IKB,
    justifyContent: "center",
    alignItems: "center",
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "rgba(255,255,255,0.2)",
  },
  navBarTitle: {
    color: C.white,
    fontWeight: "700",
    fontSize: 16,
  },

  // ── Header ──
  headerWrap: { overflow: "hidden" },
  headerBg: {
    flex: 1,
    backgroundColor: C.IKB,
    paddingHorizontal: 18,
    paddingTop: 18,
    paddingBottom: 14,
    justifyContent: "space-between",
  },
  headerTop: { flexDirection: "row", alignItems: "center" },
  avatar: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: "rgba(255,255,255,0.25)",
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 2,
    borderColor: "rgba(255,255,255,0.6)",
  },
  avatarText: { color: C.white, fontWeight: "700", fontSize: 16 },
  headerName: { color: C.white, fontWeight: "700", fontSize: 18 },
  headerHandle: { color: "rgba(255,255,255,0.7)", fontSize: 12, marginTop: 2 },
  followBtn: {
    backgroundColor: "rgba(255,255,255,0.2)",
    paddingHorizontal: 16,
    paddingVertical: 7,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.5)",
  },
  followBtnText: { color: C.white, fontSize: 13, fontWeight: "600" },
  headerBio: {
    color: "rgba(255,255,255,0.85)",
    fontSize: 13,
    lineHeight: 19,
  },
  statsRow: {
    flexDirection: "row",
    justifyContent: "space-around",
    backgroundColor: "rgba(255,255,255,0.12)",
    borderRadius: 12,
    paddingVertical: 12,
  },
  statItem: { alignItems: "center" },
  statNum: { color: C.white, fontWeight: "700", fontSize: 18 },
  statLabel: { color: "rgba(255,255,255,0.7)", fontSize: 11, marginTop: 2 },

  // ── TabBar ──
  tabBar: {
    height: TAB_BAR_H,
    backgroundColor: C.white,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: C.border,
  },
  tabsRow: { flexDirection: "row", flex: 1 },
  tabItem: { flex: 1, justifyContent: "center", alignItems: "center" },
  tabText: { fontSize: 14, fontWeight: "500", color: "#999" },
  tabTextActive: { color: C.IKB, fontWeight: "700" },
  indicator: {
    position: "absolute",
    bottom: 0,
    height: 3,
    backgroundColor: C.IKB,
    borderRadius: 2,
  },

  // ── Article Card ──
  articleCard: { borderRadius: 12, padding: 14, marginBottom: 2 },
  articleRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 8,
    gap: 8,
  },
  tag: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6 },
  tagText: { fontSize: 11, fontWeight: "600", color: C.white },
  articleMeta: { fontSize: 12, color: C.textMuted },
  articleTitle: {
    fontSize: 15,
    fontWeight: "600",
    color: C.text,
    lineHeight: 22,
    marginBottom: 6,
  },
  articleSummary: {
    fontSize: 13,
    color: C.textSub,
    lineHeight: 20,
    marginBottom: 8,
  },
  articleAuthor: { fontSize: 12, color: C.textMuted },

  // ── Photo Card（MasonryList） ──
  photoCard: {
    flex: 1,
    borderRadius: 10,
    padding: 10,
    justifyContent: "flex-end",
    overflow: "hidden",
  },
  photoOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0,0,0,0.3)",
  },
  photoTitle: { fontSize: 13, fontWeight: "700", color: C.white, zIndex: 1 },
  photoLikes: { fontSize: 11, color: "rgba(255,255,255,0.8)", marginTop: 2, zIndex: 1 },

  // ── MasonryList Loading ──
  loadingCenter: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    gap: 12,
    paddingTop: 80,
  },
  loadingText: { fontSize: 14, color: C.textMuted },
  loadMoreRow: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    paddingVertical: 16,
    gap: 8,
  },
  loadMoreText: { fontSize: 13, color: C.textMuted },
  emptyBox: { padding: 40, alignItems: "center" },
  emptyText: { fontSize: 15, color: C.textMuted },

  // ── Story Card（分页） ──
  storyCard: {
    marginBottom: 0,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 24,
    gap: 10,
  },
  storyEmoji: { fontSize: 52, lineHeight: 64 },
  storyTitle: {
    fontSize: 24,
    fontWeight: "700",
    color: C.white,
    textAlign: "center",
  },
  storySubtitle: {
    fontSize: 14,
    color: "rgba(255,255,255,0.8)",
    textAlign: "center",
    lineHeight: 20,
  },
  storyBadge: {
    marginTop: 12,
    backgroundColor: "rgba(255,255,255,0.2)",
    paddingHorizontal: 16,
    paddingVertical: 6,
    borderRadius: 20,
  },
  storyBadgeText: { color: C.white, fontSize: 13, fontWeight: "600" },
  storyDots: {
    flexDirection: "row",
    gap: 6,
    marginTop: 16,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: "rgba(255,255,255,0.4)",
  },
  dotActive: { backgroundColor: C.white, width: 20 },

  // ── About / Feature List ──
  aboutCard: {
    backgroundColor: C.white,
    borderRadius: 10,
    padding: 14,
    marginBottom: 4,
  },
  aboutVersion: { fontSize: 13, color: C.textSub },
  featureRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 10,
    backgroundColor: C.white,
    borderRadius: 10,
    padding: 12,
    marginBottom: 6,
  },
  featureDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: C.purple,
    marginTop: 5,
  },
  featureName: {
    fontSize: 14,
    fontWeight: "700",
    color: C.text,
    marginBottom: 3,
  },
  featureDesc: { fontSize: 13, color: C.textSub, lineHeight: 19 },
  codeBlock: {
    backgroundColor: "#1E1E2E",
    borderRadius: 12,
    padding: 16,
    marginTop: 4,
  },
  code: {
    fontSize: 12,
    color: "#CDD6F4",
    lineHeight: 20,
    fontFamily: "monospace",
  },

  // ── 列表底部 ──
  listEnd: { paddingVertical: 28, alignItems: "center" },
  listEndText: { fontSize: 13, color: C.textMuted },
});
