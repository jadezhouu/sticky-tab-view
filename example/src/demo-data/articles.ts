export type Article = {
  id: string;
  title: string;
  summary: string;
  author: string;
  date: string;
};

export type ArticleDetail = Article & {
  body: string;
};

export const ARTICLE_LIST: Article[] = [
  {
    id: '1',
    title: 'React Navigation 最佳实践',
    summary: '深入介绍 React Navigation v7 的嵌套导航、深度链接与类型安全配置。',
    author: '张三',
    date: '2026-03-01',
  },
  {
    id: '2',
    title: 'Redux Toolkit 状态管理指南',
    summary: '使用 RTK 简化 Redux 样板代码，掌握 createSlice 与 createAsyncThunk。',
    author: '李四',
    date: '2026-02-28',
  },
  {
    id: '3',
    title: 'React Native 性能优化技巧',
    summary: '从渲染优化、列表性能到 JS Bundle 瘦身，全面提升 RN 应用性能。',
    author: '王五',
    date: '2026-02-25',
  },
  {
    id: '4',
    title: 'Expo 新架构迁移实战',
    summary: '手把手带你将 Expo 项目迁移到新架构（Fabric + JSI），避开常见陷阱。',
    author: '赵六',
    date: '2026-02-20',
  },
  {
    id: '5',
    title: 'TypeScript 与 React Native 最佳实践',
    summary: '从泛型组件、条件类型到工具类型，写出更健壮的 RN 应用。',
    author: '周七',
    date: '2026-02-15',
  },
];

export const ARTICLE_DETAIL: Record<string, ArticleDetail> = {
  '1': {
    id: '1',
    title: 'React Navigation 最佳实践',
    author: '张三',
    date: '2026-03-01',
    summary: ARTICLE_LIST[0].summary,
    body: `React Navigation 是 React Native 中最流行的路由方案，提供了丰富的导航器类型与强大的 TypeScript 支持。\n\n在使用嵌套导航时，建议为每一层级的参数列表定义独立的类型，并通过 NavigatorScreenParams 将嵌套导航的参数传递给父级。\n\n深度链接（Deep Linking）通过 LinkingOptions 配置实现，支持 URL Scheme 和 Universal Link 两种方式，配置时需要确保 screens 结构与导航结构完全一致。\n\n最佳实践建议：\n1. 使用 createNativeStackNavigator 获取原生性能\n2. 通过全局类型声明让 useNavigation() 自动获得类型推断\n3. 将导航器按功能域拆分为独立文件`,
  },
  '2': {
    id: '2',
    title: 'Redux Toolkit 状态管理指南',
    author: '李四',
    date: '2026-02-28',
    summary: ARTICLE_LIST[1].summary,
    body: `Redux Toolkit（RTK）是 Redux 官方推荐的工具集，大幅减少了样板代码。\n\ncreateSlice 将 reducer 和 action 合并定义，createAsyncThunk 优雅处理异步流程。\n\n配合 RTK Query，你可以获得内置的缓存、失效和轮询支持，几乎无需手写异步逻辑。`,
  },
  '3': {
    id: '3',
    title: 'React Native 性能优化技巧',
    author: '王五',
    date: '2026-02-25',
    summary: ARTICLE_LIST[2].summary,
    body: `React Native 性能优化涉及多个层面：\n\n渲染层：使用 React.memo、useMemo、useCallback 避免不必要的重渲染。\n\n列表层：FlatList 的 keyExtractor、getItemLayout、windowSize 参数对滚动性能影响显著。\n\n包体积：使用 Metro bundler 的 tree-shaking，配合 expo-font 的按需加载。`,
  },
  '4': {
    id: '4',
    title: 'Expo 新架构迁移实战',
    author: '赵六',
    date: '2026-02-20',
    summary: ARTICLE_LIST[3].summary,
    body: `Expo SDK 55 默认启用新架构（New Architecture）。\n\n新架构基于 JSI 直接调用 C++ 层，绕过了旧的 Bridge 序列化开销，带来更低的通信延迟。\n\nFabric 渲染器同步处理布局，Turbo Modules 按需懒加载原生模块，配合 React 18 的并发模式效果更佳。`,
  },
  '5': {
    id: '5',
    title: 'TypeScript 与 React Native 最佳实践',
    author: '周七',
    date: '2026-02-15',
    summary: ARTICLE_LIST[4].summary,
    body: `TypeScript 在 React Native 中的最佳实践：\n\n1. 为所有 Props 和 State 定义类型，避免 any\n2. 使用条件类型和映射类型封装通用组件\n3. 善用 as const 替代 enum 减少运行时开销\n4. 配合 Zod 对 API 响应做运行时校验`,
  },
};
