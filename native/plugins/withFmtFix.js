const { withDangerousMod } = require('@expo/config-plugins');
const fs = require('fs');
const path = require('path');

const FMT_PATCH = `
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

module.exports = function withFmtFix(config) {
  return withDangerousMod(config, [
    'ios',
    (config) => {
      const podfilePath = path.join(config.modRequest.platformProjectRoot, 'Podfile');
      let podfile = fs.readFileSync(podfilePath, 'utf8');

      if (podfile.includes('Fix fmt library')) {
        return config;
      }

      if (podfile.includes('post_install do |installer|')) {
        // Inject into existing post_install block
        podfile = podfile.replace(
          'post_install do |installer|',
          `post_install do |installer|\n${FMT_PATCH}`
        );
      } else {
        // No post_install block — add one before the final `end`
        podfile = podfile.trimEnd() + `\n\npost_install do |installer|\n${FMT_PATCH}\nend\n`;
      }

      fs.writeFileSync(podfilePath, podfile);
      return config;
    },
  ]);
};
