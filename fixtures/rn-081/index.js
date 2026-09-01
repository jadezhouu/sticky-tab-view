/**
 * RN CLI fixture 入口。仅用于 typecheck/依赖解析；native 构建由 Phase 6 矩阵 CI 执行。
 */
import { AppRegistry } from 'react-native';
import App from './App';

AppRegistry.registerComponent('StickyTabViewFixtureRN081', () => App);
