/**
 * Clears Android FLAG_SECURE so Teams/Zoom (MediaProjection) can screen-share this app.
 */
const { withMainActivity, createRunOncePlugin } = require('@expo/config-plugins');

function withAllowScreenCapture(config) {
  return withMainActivity(config, (config) => {
    let contents = config.modResults.contents;

    if (!contents.includes('WindowManager')) {
      if (contents.includes('import android.os.Bundle')) {
        contents = contents.replace(
          'import android.os.Bundle',
          'import android.os.Bundle\nimport android.view.WindowManager',
        );
      } else if (/^package .+$/m.test(contents)) {
        contents = contents.replace(
          /^(package .+)$/m,
          '$1\n\nimport android.view.WindowManager',
        );
      }
    }

    const clearFlag =
      '    // Allow Teams/Zoom/screen recording to capture this app\n    window.clearFlags(WindowManager.LayoutParams.FLAG_SECURE)';

    if (!contents.includes('FLAG_SECURE')) {
      if (/super\.onCreate\(null\)/.test(contents)) {
        contents = contents.replace(
          'super.onCreate(null)',
          `super.onCreate(null)\n${clearFlag}`,
        );
      } else if (/super\.onCreate\(savedInstanceState\)/.test(contents)) {
        contents = contents.replace(
          'super.onCreate(savedInstanceState)',
          `super.onCreate(savedInstanceState)\n${clearFlag}`,
        );
      }
    }

    config.modResults.contents = contents;
    return config;
  });
}

module.exports = createRunOncePlugin(
  withAllowScreenCapture,
  'withAllowScreenCapture',
  '1.0.0',
);
