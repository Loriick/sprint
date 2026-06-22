const { withDangerousMod } = require('@expo/config-plugins');
const fs = require('fs');
const path = require('path');

const FMT_PATCH = `
  # Fix fmt library compile error with Xcode 26 / clang on iOS 26+
  # Patch the fmt source directly to remove consteval
  fmt_headers = [
    File.join(installer.sandbox.root, 'fmt/include/fmt/core.h'),
    File.join(installer.sandbox.root, 'fmt/include/fmt/base.h'),
  ]
  fmt_headers.each do |header|
    next unless File.exist?(header)
    content = File.read(header)
    if content.include?('define FMT_CONSTEVAL consteval')
      content = content.gsub('#define FMT_CONSTEVAL consteval', '#define FMT_CONSTEVAL')
      File.write(header, content)
      puts "Patched fmt consteval in #{header}"
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
        podfile = podfile.replace(
          'post_install do |installer|',
          `post_install do |installer|\n${FMT_PATCH}`
        );
      } else {
        podfile = podfile.trimEnd() + `\n\npost_install do |installer|\n${FMT_PATCH}\nend\n`;
      }

      fs.writeFileSync(podfilePath, podfile);
      return config;
    },
  ]);
};
