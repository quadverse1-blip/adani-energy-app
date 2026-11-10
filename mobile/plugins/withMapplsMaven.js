const { withProjectBuildGradle, withSettingsGradle, createRunOncePlugin } = require('@expo/config-plugins');

const MAPPLS_MAVEN_URL = 'https://maven.mappls.com/repository/mappls/';
const MAPPLS_REPO_SNIPPET = `        maven { url '${MAPPLS_MAVEN_URL}' }`;

const withMapplsMavenBuildGradle = (config) => {
  return withProjectBuildGradle(config, (modConfig) => {
    let contents = modConfig.modResults.contents;
    if (!contents.includes(MAPPLS_MAVEN_URL)) {
      if (contents.includes('allprojects {') && contents.includes('repositories {')) {
        contents = contents.replace(
          /(allprojects\s*\{[\s\S]*?repositories\s*\{)/,
          `$1\n${MAPPLS_REPO_SNIPPET}`
        );
      } else {
        contents += `
allprojects {
    repositories {
        google()
        mavenCentral()
        maven { url 'https://www.jitpack.io' }
${MAPPLS_REPO_SNIPPET}
    }
}
`;
      }
      modConfig.modResults.contents = contents;
    }
    return modConfig;
  });
};

const withMapplsMavenSettingsGradle = (config) => {
  return withSettingsGradle(config, (modConfig) => {
    let contents = modConfig.modResults.contents;
    if (!contents.includes(MAPPLS_MAVEN_URL)) {
      if (contents.includes('dependencyResolutionManagement')) {
        contents = contents.replace(
          /(dependencyResolutionManagement\s*\{[\s\S]*?repositories\s*\{)/,
          `$1\n${MAPPLS_REPO_SNIPPET}`
        );
      } else {
        const drmBlock = `
dependencyResolutionManagement {
  repositoriesMode.set(RepositoriesMode.PREFER_PROJECT)
  repositories {
    google()
    mavenCentral()
    maven { url 'https://www.jitpack.io' }
${MAPPLS_REPO_SNIPPET}
  }
}
`;
        if (contents.includes('plugins {')) {
          contents = contents.replace(
            /(plugins\s*\{[\s\S]*?\n\})/,
            `$1\n${drmBlock}`
          );
        } else {
          contents += drmBlock;
        }
      }
      modConfig.modResults.contents = contents;
    }
    return modConfig;
  });
};

const withMapplsMaven = (config) => {
  return withMapplsMavenSettingsGradle(withMapplsMavenBuildGradle(config));
};

module.exports = createRunOncePlugin(withMapplsMaven, 'withMapplsMaven', '1.0.0');

