# Reanimated 3 维护线：两锚点 Paper/Fabric 原生构建与清理（V3-6-01/02）

本文档供 `maintenance/reanimated-3` 维护线的原生验证矩阵（PR-3 / V3-6-03）与人工设备
冒烟（V3-6-05..09）使用。所有命令以仓库根目录为基准执行。

## 1. 锚点与已冻结的锁文件 patch（V3-6-01）

两个首批验证锚点的 JS/native 依赖**必须全部来自仓库根 `pnpm-lock.yaml`**，不允许单独
安装或用错误版本覆盖。已确认的实际 patch：

| 锚点 | 宿主 | React | React Native | RNGH | Reanimated |
|---|---|---|---|---|---|
| Expo 53 | `example/` | 19.0.0 | 0.79.6 | 2.24.0 | 3.17.5 |
| RN CLI | `fixtures/rn-081/` | 19.1.0 | 0.81.5 | 2.28.0 | 3.19.5 |

- Reanimated 3.17.x 官方兼容 RN 0.79（含 Paper/Fabric），3.19.x 官方兼容 RN 0.78–0.81。
- 两个锚点的安装树都不得出现 `react-native-worklets`（V3-3-06 已全量移除，CI 有源码扫描
  与 `verify:reanimated3` 双重把关）。

### Expo Go 策略

- **Expo Go 仅作 Fabric 辅助 smoke**，且 Expo Go 总是新架构——它内置的 JS/native patch
  与本仓库锁文件**不一致**（Expo Go 客户端版本 ≠ SDK 53 bundled patch）。因此：
  - 无法可靠确认 Expo Go 实际内置的精确 Reanimated patch 时，**跳过 Expo Go**。
  - 正式门禁一律使用 **Development Build**。
- Paper 使用 `newArchEnabled=false` 的**独立 Development Build**，与 Fabric 构建互相隔离。

## 2. 构建命令总览（V3-6-02）

> 前置：仓库根 `pnpm install --frozen-lockfile` 已执行；本机/CI 具备 Android SDK
> （platform 36 + build-tools 36.0.0+ + NDK 27.1.12297006 + CMake）或 Xcode + CocoaPods。

### 2.1 Expo 53 锚点（`example/`）

架构由 `example/app.config.js` 的 `ARCH` 环境变量驱动（`paper` | `fabric`，默认 `fabric`），
prebuild 时写入 android `gradle.properties` 的 `newArchEnabled` 与 iOS Podfile 的
`RCT_NEW_ARCH_ENABLED`。

> **pnpm 前置**：Expo 的 gradle 自动链接（`expoAutolinking.useExpoModules()`）只包含
> 在 app 根 `node_modules` 可解析的 expo 模块；pnpm 的隔离 `node_modules` 不会把
> `expo` 的传递依赖 hoist 到根。因此 `example/package.json` 必须把下列带原生代码的
> expo 模块声明为**直接依赖**（版本与 `expo@53.0.27` 的依赖声明一致）：
> `expo-asset@~11.1.7`、`expo-constants@~17.1.8`、`expo-file-system@~18.1.11`、
> `expo-font@~13.3.2`、`expo-keep-awake@~14.1.4`、`expo-modules-core@2.5.0`。
> 另外必须把 **`expo-modules-autolinking@2.1.15` 也声明为直接 devDependency**：expo 包
> 自己的 `react-native.config.js` 第 1 行 `require('expo-modules-autolinking/exports')`
> 在 pnpm 隔离布局下无法解析（正常 npm/yarn hoist 布局能解析），该失败被
> `expo-modules-autolinking` 的 `requireConfig()` try/catch **静默吞掉**返回 null，于是
> `react-native-config` 走兜底，用 expo/android/build.gradle 的 `namespace "expo.core"`
> 生成 `import expo.core.ExpoModulesPackage;`；而真实类是
> `expo.modules.ExpoModulesPackage` → javac `cannot find symbol`（V3-6-03 CI 失败点；
> 与"gradle 模块缺失"无关，`:expo` 等模块其实都在构建里）。该包本身不会被自动链接为
> 原生模块（其 `android/` 无顶层 build.gradle/Manifest）。
> 另外本地若残留根 `node_modules/expo-modules-core` 等旧 SDK 的**真实目录**（非 pnpm
> 符号链接），会 shadow 正确版本，需删除以保证与干净 CI 安装一致。



**Android：**

```bash
# Paper（旧架构）
ARCH=paper npx expo prebuild --clean --platform android --no-install
cd android && ./gradlew assembleDebug && cd ..

# Fabric（新架构，SDK 53 默认）
ARCH=fabric npx expo prebuild --clean --platform android --no-install
cd android && ./gradlew assembleDebug && cd ..
```

**iOS（nightly / release-candidate 才跑，PR 不要求）：**

```bash
# 先安装 CocoaPods 依赖（读 Podfile 里的 RCT_NEW_ARCH_ENABLED）
ARCH=paper npx expo prebuild --clean --platform ios --no-install
cd ios && pod install && cd ..
ARCH=paper npx expo run:ios --configuration Release

# Fabric 同理：ARCH=fabric
```

### 2.2 RN CLI 0.81 锚点（`fixtures/rn-081/`）

原生工程**已提交**（`fixtures/rn-081/android|ios`），架构由构建命令直接切换。

> **pnpm 前置**：fixture 的 `settings.gradle`（来自 RN 0.81 官方模板）用相对路径
> `../node_modules/@react-native/gradle-plugin` 引用 `@react-native/gradle-plugin`。
> 这是 `react-native` 的传递依赖，npm/yarn 会把它 hoist 到 app 根，pnpm 的隔离
> `node_modules` 不会——因此必须在 `fixtures/rn-081/package.json` 的 devDependencies 里
> **显式声明** `@react-native/gradle-plugin: 0.81.5`（与 `react-native` 0.81.5 用同一
> lockfile 条目），gradle 的 `includeBuild` 才能解析。CI 的 RN CLI 锚点构建靠这条声明
> 通过（V3-6-03 初次 CI 曾以
> `Included build '.../node_modules/@react-native/gradle-plugin' does not exist` 失败）。

**Android：**

```bash
cd fixtures/rn-081

# Fabric（新架构，gradle.properties 默认 newArchEnabled=true）
./gradlew assembleDebug            # 在 android/ 下执行

# Paper（旧架构）：把 android/gradle.properties 的 newArchEnabled 改为 false
sed -i.bak 's/^newArchEnabled=true/newArchEnabled=false/' android/gradle.properties
./gradlew assembleDebug
git checkout android/gradle.properties   # 恢复，避免把切架构留进提交
```

**iOS（nightly / release-candidate）：**

```bash
cd fixtures/rn-081/ios
RCT_NEW_ARCH_ENABLED=1 pod install     # Fabric；Paper 用 RCT_NEW_ARCH_ENABLED=0
cd ..
RCT_NEW_ARCH_ENABLED=1 npx react-native run-ios --configuration Release
```

## 3. 架构/锚点切换清理流程（V3-6-02）

Paper ↔ Fabric 或锚点之间切换时，**禁止复用**未清理的 Pods、Gradle、Metro cache 或错误的
node_modules。切换前按需执行：

```bash
# 统一 Metro cache
rm -rf /tmp/metro-* "$TMPDIR/metro-*" node_modules/.cache/metro example/node_modules/.cache 2>/dev/null || true

# Expo 锚点：清掉 CNG 生成的 native 目录（重新 prebuild 会重建）
rm -rf example/android example/ios

# RN CLI fixture：Gradle 产物（保留 android/ 工程本身）
(cd fixtures/rn-081/android && ./gradlew clean) 2>/dev/null || true

# iOS：Pods 必须重装（架构写在 Podfile.lock / generated xcconfig 里）
rm -rf fixtures/rn-081/ios/Pods fixtures/rn-081/ios/Podfile.lock
(cd example/ios && pod deintegrate && rm -rf Pods Podfile.lock) 2>/dev/null || true

# 若怀疑 pnpm store 串线：重建锚点自身的 node_modules（一般不必要）
# rm -rf example/node_modules fixtures/rn-081/node_modules && pnpm install --frozen-lockfile
```

> 经验法则：**每次切架构都重新 prebuild / 重装 Pods**，不要手动改一处 gradle/pbxproj。
> 哪个组合配了什么架构，以 CI 矩阵 job 的显式命令为准，不依赖环境残留。

## 4. CI 验证与证据（V3-6-03）

CI 在每个锚点记录 `require.resolve`、`pnpm why --filter` 与 native autolinking 输出
（`npx react-native config`），证明各自解析到自己的 React/RN/Reanimated/RNGH，无错误
hoist。人工设备完成后，release-candidate 通过受保护输入 `device_evidence_url` 生成
attestation artifact（含 candidate SHA、设备证据链接、审批者、时间）。
