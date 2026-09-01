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

原生工程**已提交**（`fixtures/rn-081/android|ios`），架构由构建命令直接切换：

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
