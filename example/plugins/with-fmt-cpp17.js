// with-fmt-cpp17.js — 持久化 Podfile 补丁：修复 Xcode 26 / Clang 21 下 fmt 的 consteval 回归。
//
// 根因：RN 0.79 自带 fmt 11.0.2，其 base.h 只对 Apple clang < 14 做 consteval 关断
// （__apple_build_version__ < 14000029L），Clang 21 会滑过去并置 FMT_USE_CONSTEVAL=1，
// 导致 fmt/format-inl.h 编译失败（"call to consteval function ... is not a constant expression"）。
//
// 修复：把 fmt pod 强制为 C++17，使 FMT_USE_CONSTEVAL=0（运行时路径），绕开坏掉的 consteval。
// CI 用 Xcode 16，fmt 11.0.2 在 C++17 下本就正常编译，故此补丁在 CI 上无害。
//
// 挂载：example/app.config.js 的 plugins 数组追加 "./plugins/with-fmt-cpp17"。
// 每次 prebuild 生成 Podfile 后，本插件把 fmt 的 CLANG_CXX_LANGUAGE_STANDARD 覆盖注入
// post_install（替代此前 gitignored 的手工 Podfile 改动，一劳永逸）。

const { withDangerousMod } = require('expo/config-plugins');
const fs = require('fs');
const path = require('path');

const FMT_SNIPPET = `
    # Workaround (persistent, plugins/with-fmt-cpp17.js): RN 0.79 fmt 11.0.2 hits a
    # consteval regression on Xcode 26 / Clang 21 (fmt base.h only guards Apple clang
    # < 14). Forcing C++17 on the fmt pod sets FMT_USE_CONSTEVAL=0. Harmless on Xcode 16.
    installer.pods_project.targets.each do |target|
      next unless target.name == 'fmt'
      target.build_configurations.each do |config|
        config.build_settings['CLANG_CXX_LANGUAGE_STANDARD'] = 'c++17'
      end
    end
`;

module.exports = function withFmtCpp17(config) {
  return withDangerousMod(config, [
    'ios',
    async (config) => {
      const podfilePath = path.join(config.modRequest.platformProjectRoot, 'Podfile');
      // 非 iOS prebuild（无 Podfile）时直接跳过，保证 plugin 对 android/web 是无操作。
      if (!fs.existsSync(podfilePath)) {
        return config;
      }

      let contents = fs.readFileSync(podfilePath, 'utf8');

      // 幂等：已注入过就跳过。
      if (!contents.includes("target.name == 'fmt'")) {
        // 锚定生成的 react_native_post_install(...) 调用，在其闭括号后注入 fmt 覆盖。
        const anchor = /react_native_post_install\([\s\S]*?\n    \)\n/;
        if (anchor.test(contents)) {
          contents = contents.replace(anchor, `$&${FMT_SNIPPET}`);
          fs.writeFileSync(podfilePath, contents);
        } else {
          console.warn(
            '[with-fmt-cpp17] 未找到 react_native_post_install(...) 锚点，跳过 fmt C++17 补丁。' +
              '若 Expo 的 Podfile 模板变化，请更新本插件的锚点正则。'
          );
        }
      }

      return config;
    },
  ]);
};
