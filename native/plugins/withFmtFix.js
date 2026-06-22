const { withDangerousMod } = require('@expo/config-plugins');
const fs = require('fs');
const path = require('path');

// Patch Podfile to fix fmt library compile error with Xcode 26 / clang on iOS 26+
// The fmt library uses C++20 consteval which newer clang versions reject in some contexts.
// Adding -D_LIBCPP_ENABLE_CXX17_REMOVED_FEATURES=0 and disabling consteval works around this.
module.exports = function withFmtFix(config) {
  return withDangerousMod(config, [
    'ios',
    (config) => {
      const podfilePath = path.join(config.modRequest.platformProjectRoot, 'Podfile');
      let podfile = fs.readFileSync(podfilePath, 'utf8');

      const patch = `
  # Fix fmt library compile error with Xcode 26 / clang on iOS 26+
  installer.pods_project.targets.each do |target|
    if target.name == 'fmt'
      target.build_configurations.each do |config|
        config.build_settings['OTHER_CPLUSPLUSFLAGS'] = '$(inherited) -DFMT_CONSTEVAL='
        config.build_settings['CLANG_CXX_LANGUAGE_STANDARD'] = 'c++17'
      end
    end
  end
`;

      if (!podfile.includes('Fix fmt library')) {
        podfile = podfile.replace(
          /end\s*$/,
          `  post_install do |installer|\n${patch}  end\nend\n`
        );
        // If post_install already exists, inject inside it
        if (podfile.includes('post_install do |installer|')) {
          podfile = podfile.replace(
            /post_install do \|installer\|([\s\S]*?)end(\s*\nend)/,
            (match, inner, tail) => {
              if (inner.includes('Fix fmt library')) return match;
              return `post_install do |installer|${inner}${patch}  end${tail}`;
            }
          );
        }
        fs.writeFileSync(podfilePath, podfile);
      }

      return config;
    },
  ]);
};
