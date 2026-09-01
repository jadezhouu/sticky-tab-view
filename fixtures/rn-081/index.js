/**
 * RN CLI fixture 入口。native 构建（Phase 6 矩阵 CI）也以本入口冷启动，
 * 组件名必须与 android MainActivity.getMainComponentName() 一致：
 * "StickyTabViewFixture"（来自 RN 0.81 模板替换）。
 */
import { AppRegistry } from 'react-native';
import App from './App';

AppRegistry.registerComponent('StickyTabViewFixture', () => App);
