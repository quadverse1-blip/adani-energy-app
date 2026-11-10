const { withProjectBuildGradle, withSettingsGradle, createRunOncePlugin } = require('@expo/config-plugins');

const MAPPLS_MAVEN_URL = 'https://maven.mappls.com/repository/mappls/';
const MAPPLS_MAVEN_REPO = `maven { url '${MAPPLS_MAVEN_URL}' }`;

/**
 * Ensures Mappls Maven repository is present in root build.gradle
 */
const withMapplsProjectGradle = (config) => {
  return withProjectBuildGradle(config, (modConfig) => {
    let contents = modConfig.modResults.contents;

    if (!contents.includes(MAPPLS_MAVEN_URL)) {
      // 1. Add to allprojects.repositories
      if (contents.includes('allprojects {')) {
        contents = contents.replace(
          /allprojects\s*\{\s*repositories\s*\{/,
          `allprojects {\n  repositories {\n    ${MAPPLS_MAVEN_REPO}`
        );
      } else {
        contents += `\nallprojects {\n  repositories {\n    ${MAPPLS_MAVEN_REPO}\n  }\n}\n`;
      }

      // 2. Add to buildscript.repositories if not present
      if (contents.includes('buildscript {')) {
        contents = contents.replace(
          /buildscript\s*\{\s*repositories\s*\{/,
          `buildscript {\n  repositories {\n    ${MAPPLS_MAVEN_REPO}`
        );
      }

      modConfig.modResults.contents = contents;
    }
    return modConfig;
  });
};

/**
 * Ensures Mappls Maven repository is present in settings.gradle
 */
const withMapplsSettingsGradle = (config) => {
  return withSettingsGradle(config, (modConfig) => {
    let contents = modConfig.modResults.contents;

    if (!contents.includes(MAPPLS_MAVEN_URL)) {
      // Add dependencyResolutionManagement if not present, or inject into existing
      if (contents.includes('dependencyResolutionManagement')) {
        contents = contents.replace(
          /dependencyResolutionManagement\s*\{[\s\S]*?repositories\s*\{/,
          (match) => `${match}\n    ${MAPPLS_MAVEN_REPO}`
        );
      } else {
        const drmBlock = `
dependencyResolutionManagement {
  repositoriesMode.set(RepositoriesMode.PREFER_PROJECT)
  repositories {
    google()
    mavenCentral()
    maven { url 'https://www.jitpack.io' }
    ${MAPPLS_MAVEN_REPO}
  }
}
`;
        contents += drmBlock;
      }

      modConfig.modResults.contents = contents;
    }
    return modConfig;
  });
};

const withMappls = (config) => {
  config = withMapplsProjectGradle(config);
  config = withMapplsSettingsGradle(config);
  return config;
};

module.exports = createRunOncePlugin(withMappls, 'withMappls', '1.0.0');

