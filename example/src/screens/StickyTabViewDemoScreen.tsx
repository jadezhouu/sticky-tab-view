/**
 * StickyTabView feature overview demo
 *
 * Features covered:
 *   ① StickyTabView    — collapsible header + horizontal paging tabs + per-tab scroll state
 *   ② ref.setTab       — programmatic tab switching (called on tab bar tap)
 *   ③ Tab 1 "Articles" — ElasticScrollView + pull-to-refresh + infinite load + bounces
 *   ④ Tab 2 "Masonry"  — MasonryList 2 columns + async onFetch paging + refresh + initial loading
 *   ⑤ Tab 3 "Paging"   — ElasticScrollView + pagingEnabled="vertical" (snap paging)
 *   ⑥ Tab 4 "About"    — ElasticScrollView + contentInsets + showsVerticalScrollIndicator
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

// ─── Layout constants ──────────────────────────────────────────────────────────
const HEADER_BASE_H = 220; // Base height of the collapsible header
const TAB_BAR_H = 48; // Tab bar height (also the height retained once pinned)
const PAGE_H = 520; // Height of each paging card in Tab 3
const P_Top = 16; // Top padding of tab content

// ─── Colors ────────────────────────────────────────────────────────────────────
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

// ─── Types ─────────────────────────────────────────────────────────────────────
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

// ─── Mock data generation ──────────────────────────────────────────────────────
const TITLES = [
  "Deep Dive into React Native New Architecture",
  "Reanimated v4 Gesture System Complete Guide",
  "Flutter vs RN: 2026 Showdown",
  "Expo SDK 55 New Features Overview",
  "Advanced TypeScript 5.9 Generics",
  "JSI Native Modules from Zero to One",
  "Hermes Engine: Parse to Execute",
  "Metro Bundler Speed Optimization",
  "iOS 18 Privacy Permission Guide",
  "Android 15 New API Pitfalls",
  "React 19 Concurrent Features Best Practices",
  "Zustand vs MobX Comparison",
];
const SUMMARIES = [
  "Read the source to understand the intent behind each line and the design trade-offs.",
  "Theory plus practice to master core concepts and avoid common pitfalls.",
  "Compare ecosystem, performance, and DX to make the right choice.",
  "From zero to one with five real-world cases.",
  "Avoid common traps and save hundreds of hours of debugging.",
];
const TAGS = [
  { tag: "Architecture", color: C.purple },
  { tag: "Animation", color: C.green },
  { tag: "Performance", color: C.orange },
  { tag: "Tooling", color: C.blue },
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
  "Midnight Debug Meltdown",
  "Drop-the-Database-and-Run Souvenir",
  "PM Begging for Mercy",
  "Git Push --force Disaster",
  "Legacy Code Mountain Expedition",
  "StackOverflow-Driven Development",
  "Advanced Guide to Slacking Off",
  "Requirements Review Debate",
  "A Cup of Tea, a Pack of Cigs",
  "AI-Generated Code Gone Wrong",
  "Refactor Today, Ship Tomorrow",
  "QA Is Calling Again",
];
const PHOTO_HEIGHTS = [
  160, 220, 140, 260, 180, 200, 150, 240, 170, 190, 130, 280,
];
const STORIES = [
  {
    emoji: "🌅",
    title: "Vertical Paging Demo",
    sub: "Swipe up, each card snaps independently ↑",
    bg: "#4A90D9",
  },
  {
    emoji: "🎨",
    title: "pagingEnabled",
    sub: '"vertical" mode, auto-align on release',
    bg: C.purple,
  },
  {
    emoji: "🚀",
    title: "Custom pageSize",
    sub: "Pass { height: 320 } to fix the page height",
    bg: C.green,
  },
  {
    emoji: "⚡",
    title: "Velocity-Sensitive Paging",
    sub: "Fast swipes jump to the next page",
    bg: C.orange,
  },
  {
    emoji: "🌊",
    title: "Spring Physics",
    sub: "Driven by withSpring for a natural feel",
    bg: C.teal,
  },
  {
    emoji: "🎯",
    title: "Last Page Reached",
    sub: "Further swipes are stopped by boundary bounce",
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
  // renderItem is placed inside WaterfallItem, whose parent View already sets { width, height }
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
        — Loaded {count} / {total}, all shown —
      </Text>
    </View>
  );
}

// ─── Tab 1: article list (pull-to-refresh + infinite load) ────────────────────
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
      {/* StickyTabView requires each tab to reserve header-height blank space at the top */}
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

// ─── Tab 2: masonry (waterfall + async paging + initial loading) ───────────────
function Tab2Waterfall() {
  const insets = useSafeAreaInsets();
  const TOTAL_H = HEADER_BASE_H + insets.top + TAB_BAR_H;

  const pageRef = useRef(0);

  const onFetch = async (page: number) => {
    // Simulate network latency
    await new Promise<void>((r) => setTimeout(r, page === 0 ? 1200 : 700));
    const items = genPhotos(page, 8);
    return { items, hasMore: page < 3 };
  };


  return (
    <MasonryList<PhotoItem>
      bounces="vertical"
      showsVerticalScrollIndicator={false}
      onFetch={onFetch}
      // 2 columns
      columnForSection={() => 2}
      // Item height from PhotoItem.height (plus padding)
      heightForItem={(item) => item.height + 36}
      renderItem={(item) => <PhotoCard item={item} />}
      horizontalPadding={12}
      gap={10}
      renderLoading={() => (
        <View style={styles.loadingCenter}>
          <ActivityIndicator size="large" color={C.purple} />
          <Text style={styles.loadingText}>Loading…</Text>
        </View>
      )}
      renderLoadingMore={() => (
        <View style={styles.loadMoreRow}>
          <ActivityIndicator size="small" color={C.purple} />
          <Text style={styles.loadMoreText}>Loading more…</Text>
        </View>
      )}
      renderEmpty={() => (
        <View style={styles.emptyBox}>
          <Text style={styles.emptyText}>No content</Text>
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

// ─── Tab 3: vertical paging (pagingEnabled="vertical" + fixed pageSize) ────────
function Tab3Paging() {
  const insets = useSafeAreaInsets();
  const TOTAL_H = HEADER_BASE_H + insets.top + TAB_BAR_H;

  // pageH = measured container height (screen height - safe area top - bottom nav); 0 means not measured yet
  const [pageH, setPageH] = useState(0);

  return (
    <ElasticScrollView
      bounces="vertical"
      pagingEnabled="vertical"
      // pageSize.height=0 → the library auto-uses the container height (size.height.value)
      // Swap to the measured value once available, so card height matches the snap step exactly
      pageSize={{ width: 0, height: pageH }}
      showsVerticalScrollIndicator={false}
      onSizeChange={({ height }) => {
        // Keep only the first valid value to avoid re-renders when the header collapses
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
              // Card 0: header fully expanded (TOTAL_H); afterwards the header is collapsed (TAB_BAR_H)
              paddingTop: idx === 0 ? TOTAL_H : TAB_BAR_H,
            },
          ]}
        >
          <Text style={styles.storyEmoji}>{story.emoji}</Text>
          <Text style={styles.storyTitle}>{story.title}</Text>
          <Text style={styles.storySubtitle}>{story.sub}</Text>
          <View style={styles.storyBadge}>
            <Text style={styles.storyBadgeText}>
              Page {idx + 1} / {STORIES.length}
            </Text>
          </View>
        </View>
      ))}
      <View style={styles.listEnd}>
        <Text style={styles.listEndText}>— End of pages —</Text>
      </View>
    </ElasticScrollView>
  );
}

// ─── Demo header (collapsible profile banner) ─────────────────────────────────
function DemoHeader() {
  const insets = useSafeAreaInsets();
  return (
    <View style={[styles.headerWrap, { height: HEADER_BASE_H + insets.top }]}>
      <View style={[styles.headerBg, { paddingTop: 18 + insets.top }]}>
        {/* Top info row */}
        <View style={styles.headerTop}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>JZ</Text>
          </View>
          <View style={{ flex: 1, marginLeft: 14 }}>
            <Text style={styles.headerName}>StickyTabView</Text>
            <Text style={styles.headerHandle}>@ui-library · React Native</Text>
          </View>
        </View>
        {/* Bio */}
        <Text style={styles.headerBio}>
          {"High-performance scroll containers + collapsible/slidable header + masonry + vertical paging.\nBuilt on Reanimated 4 and RNGH v2. 🚀"}
        </Text>
        {/* Stats row */}
        <View style={styles.statsRow}>
          {[
            ["128", "Articles"],
            ["3.2K", "Likes"],
            ["892", "Followers"],
            ["46", "Topics"],
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

// ─── Demo tab bar (receives shared values, spring indicator) ──────────────────
const TABS = ["Articles", "Masonry", "Paging"];

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

// ─── Floating nav bar ──────────────────────────────────────────────────────────
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

// ─── Main component ────────────────────────────────────────────────────────────
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

// ─── Styles ───────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: C.bg },
  pad: { paddingHorizontal: 14, gap: 10, paddingBottom: 8 },

  // ── Floating nav bar ──
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

  // ── Photo card (MasonryList) ──
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

  // ── Story card (paging) ──
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

  // ── List end ──
  listEnd: { paddingVertical: 28, alignItems: "center" },
  listEndText: { fontSize: 13, color: C.textMuted },
});
