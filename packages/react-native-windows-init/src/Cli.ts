/**
 * Copyright (c) Microsoft Corporation.
 * Licensed under the MIT License.
 *
 * @format
 */

import * as yargs from 'yargs';
import * as fs from 'fs';
import * as semver from 'semver';
import {exec, execSync} from 'child_process';
import * as validUrl from 'valid-url';
import * as prompts from 'prompts';
import * as findUp from 'find-up';
import * as chalk from 'chalk';

// @ts-ignore
import * as Registry from 'npm-registry';

import requireGenerateWindows from './requireGenerateWindows';

const npmConfReg = execSync('npm config get registry')
  .toString()
  .trim();
const NPM_REGISTRY_URL = validUrl.isUri(npmConfReg)
  ? npmConfReg
  : 'http://registry.npmjs.org';
const npm = new Registry({registry: NPM_REGISTRY_URL});

const argv = yargs
  .version(false)
  .strict(true)
  .options({
    version: {
      type: 'string',
      describe: 'The version of react-native-windows to use.',
    },
    namespace: {
      type: 'string',
      describe:
        "The native project namespace. This should be expressed using dots as separators. i.e. 'Level1.Level2.Level3'. The generator will apply the correct syntax for the target language",
    },
    verbose: {
      type: 'boolean',
      describe: 'Enables logging.',
      default: false,
    },
    language: {
      type: 'string',
      describe: 'Which language the app is written in.',
      choices: ['cs', 'cpp'],
      default: 'cpp',
    },
    overwrite: {
      type: 'boolean',
      describe: 'Overwrite any existing files without prompting',
      default: false,
    },
    experimentalNuGetDependency: {
      type: 'boolean',
      describe:
        '[Experimental] change to start consuming a NuGet containing a pre-built dll version of Microsoft.ReactNative',
      hidden: true,
      default: false,
    },
    useWinUI3: {
      type: 'boolean',
      describe: '[Experimental] Use WinUI3',
      hidden: true,
      default: false,
    },
    nuGetTestVersion: {
      type: 'string',
      describe:
        '[internalTesting] By default the NuGet version matches the rnw package. This flag allows manually specifying the version for internal testing.',
      hidden: true,
    },
    nuGetTestFeed: {
      type: 'string',
      describe:
        '[internalTesting] Allows a test feed to be added to the generated NuGet configuration',
      hidden: true,
    },
    useDevMode: {
      type: 'boolean',
      describe:
        '[internalTesting] Link rather than Add/Install the react-native-windows package. This option is for the development workflow of the developers working on react-native-windows.',
      hidden: true,
      default: false,
    },
  })
  .check(a => {
    if (a._.length !== 0) {
      throw `Unrecognized option ${a._}`;
    }
    return true;
  }).argv;

if (argv.verbose) {
  console.log(argv);
}

const EXITCODE_UNSUPPORTED_VERION_RN = 3;
const EXITCODE_USER_CANCEL = 4;
const EXITCODE_NO_REACTNATIVE_FOUND = 5;
const EXITCODE_UNKNOWN_ERROR = 6;
const EXITCODE_NO_PACKAGE_JSON = 7;
const EXITCODE_NO_LATEST_RNW = 8;
const EXITCODE_NO_AUTO_MATCHING_RNW = 9;
const EXITCODE_INCOMPATIBLE_OPTIONS = 10;
const EXITCODE_DEVMODE_VERSION_MISMATCH = 11;

function getReactNativeAppName(): string {
  console.log('Reading application name from package.json...');
  const cwd = process.cwd();
  const pkgJsonPath = findUp.sync('package.json', {cwd});
  if (!pkgJsonPath) {
    userError(
      'Unable to find package.json.  This should be run from within an existing react-native app.',
      EXITCODE_NO_PACKAGE_JSON,
    );
  }
  let name = JSON.parse(fs.readFileSync(pkgJsonPath, 'utf8')).name;
  if (!name) {
    const appJsonPath = findUp.sync('app.json', {cwd});
    if (appJsonPath) {
      console.log('Reading application name from app.json...');
      name = JSON.parse(fs.readFileSync(appJsonPath, 'utf8')).name;
    }
  }
  if (!name) {
    console.error('Please specify name in package.json or app.json');
  }
  return name;
}

function getReactNativeVersion(): string {
  console.log('Reading react-native version from node_modules...');
  const rnPkgJsonPath = require.resolve('react-native/package.json', {
    paths: [process.cwd()],
  });
  if (fs.existsSync(rnPkgJsonPath)) {
    return require(rnPkgJsonPath).version;
  }

  userError(
    'Must be run from a project that already depends on react-native, and has react-native installed.',
    EXITCODE_NO_REACTNATIVE_FOUND,
  );
}

function getDefaultReactNativeWindowsSemVerForReactNativeVersion(
  rnVersion: string,
): string {
  const validVersion = semver.valid(rnVersion);
  if (validVersion) {
    const major = semver.major(validVersion);
    const minor = semver.minor(validVersion);
    if (major === 0 && minor >= 59) {
      return `^${major}.${minor}.0-0`;
    }
  }

  userError(
    `Error: Unsupported version of react-native: ${chalk.cyan(
      rnVersion,
    )} react-native-windows supports react-native versions ${chalk.cyan(
      '>=0.60',
    )}`,
    EXITCODE_UNSUPPORTED_VERION_RN,
  );
}

function getMatchingReactNativeSemVerForReactNativeWindowsVersion(
  rnwVersion: string,
): string {
  const validVersion = semver.valid(rnwVersion);
  if (validVersion) {
    const major = semver.major(validVersion);
    const minor = semver.minor(validVersion);
    if (major === 0 && minor >= 59) {
      return `^${major}.${minor}`;
    }
  }
  return 'unknown';
}

function getLatestMatchingVersion(
  pkg: string,
  versionSemVer: string,
): Promise<string> {
  return new Promise((resolve, reject) => {
    if (semver.validRange(versionSemVer)) {
      // Ideally we'd be able to just use npm.packages.range(pkg, versionSemVer) here,
      // but alas it fails to give us the right result for react-native-windows@^0.60.0-0
      // as it fails to return pre-release versions
      npm.packages.releases(
        pkg,
        (err: any, details: {[key: string]: object}) => {
          if (err) {
            reject(err);
          } else if (details) {
            const versions = Object.keys(details);
            if (versions.length > 0) {
              const candidates = versions
                .filter(v => semver.satisfies(v, versionSemVer))
                .sort(semver.rcompare);
              if (candidates && candidates.length > 0) {
                resolve(candidates[0]);
                return;
              }
            }
          }
          reject(
            new Error(`No matching version of ${pkg}@${versionSemVer} found`),
          );
        },
      );
    } else {
      try {
        exec(
          `npm info ${pkg}@${versionSemVer} version --json`,
          (err, stdout, _stderr) => {
            try {
              if (!err) {
                let candidates = JSON.parse(stdout);
                if (typeof candidates === 'string') {
                  resolve(candidates);
                  return;
                }
                candidates = candidates.sort(semver.rcompare);
                if (candidates && candidates.length > 0) {
                  resolve(candidates[0]);
                  return;
                }
              }
              reject(
                new Error(
                  `No matching version of ${pkg}@${versionSemVer} found`,
                ),
              );
            } catch (e) {
              reject(e);
            }
          },
        );
      } catch (err) {
        reject(
          new Error(`No matching version of ${pkg}@${versionSemVer} found`),
        );
      }
    }
  });
}

async function getLatestRNWVersion(): Promise<string> {
  const rnwLatestVersion = await getLatestMatchingRNWVersion('latest');
  if (!rnwLatestVersion) {
    userError(
      'Error: No version of react-native-windows@latest found',
      EXITCODE_NO_LATEST_RNW,
    );
  }
  return rnwLatestVersion;
}

async function getLatestMatchingRNWVersion(
  versionSemVer: string,
): Promise<string | null> {
  try {
    const version = await getLatestMatchingVersion(
      'react-native-windows',
      versionSemVer,
    );
    return version;
  } catch (err) {
    return null;
  }
}

function installReactNativeWindows(
  version: string | undefined,
  useDevMode: boolean,
) {
  const cwd = process.cwd();
  const execOptions = argv.verbose ? {stdio: 'inherit' as 'inherit'} : {};

  if (useDevMode) {
    const packageCmd = isProjectUsingYarn(cwd) ? 'yarn' : 'npm';
    execSync(`${packageCmd} link react-native-windows`, execOptions);
    const rnwPkgJsonPath = require.resolve(
      'react-native-windows/package.json',
      {paths: [cwd]},
    );
    const rnwVersion = require(rnwPkgJsonPath).version;
    if (version && version !== rnwVersion) {
      userError(
        `Requested react-native-windows version: '${version}' does not match version '${rnwVersion}' of the linked module. When using '--useDevMode' you do not need to pass a version. If you do, you should pass '--version ${rnwVersion}'`,
        EXITCODE_DEVMODE_VERSION_MISMATCH,
      );
    } else if (!version) {
      version = rnwVersion;
    }
  } else if (!version) {
    internalError(
      'Unexpected error ecountered. If you are able, please file an issue on: https://github.com/microsoft/react-native-windows/issues/new/choose',
    );
  }

  console.log(
    `Installing ${chalk.green('react-native-windows')}@${chalk.cyan(
      version,
    )}...`,
  );

  const pkgJsonPath = findUp.sync('package.json', {cwd});
  if (!pkgJsonPath) {
    internalError('Unable to find package.json');
  }

  let pkgJson = require(pkgJsonPath);
  let deps = pkgJson.dependencies || {};
  deps['react-native-windows'] = version;
  fs.writeFileSync(pkgJsonPath, JSON.stringify(pkgJson, null, 2));
  execSync(isProjectUsingYarn(cwd) ? 'yarn' : 'npm install', execOptions);

  console.log(
    chalk.green(
      `react-native-windows@${chalk.cyan(
        require(require.resolve('react-native-windows/package.json', {
          paths: [cwd],
        })).version,
      )} successfully installed.`,
    ),
  );
}

/**
 * Prints error message for a user error and exits the process with the given exitcode
 */
function userError(text: string, exitCode: number): never {
  console.error(chalk.redBright('[Error] ' + text));
  process.exit(exitCode);
}

/**
 * Throw new internal error
 */
function internalError(text: string): never {
  throw new Error(text);
}

/**
 * Check if project is using Yarn (has `yarn.lock` in the tree)
 */
function isProjectUsingYarn(cwd: string): boolean {
  return !!findUp.sync('yarn.lock', {cwd});
}

(async () => {
  try {
    const name = getReactNativeAppName();
    const ns = argv.namespace || name;
    const useDevMode = argv.useDevMode;
    let version = argv.version;

    if (argv.useWinUI3 && argv.experimentalNuGetDependency) {
      userError(
        "Error: Incompatible options specified. Options '--useWinUI3' and '--experimentalNuGetDependency' are incompatible",
        EXITCODE_INCOMPATIBLE_OPTIONS,
      );
    }

    if (!useDevMode) {
      if (!version) {
        const rnVersion = getReactNativeVersion();
        version = getDefaultReactNativeWindowsSemVerForReactNativeVersion(
          rnVersion,
        );
      }

      const rnwResolvedVersion = await getLatestMatchingRNWVersion(version);

      if (!rnwResolvedVersion) {
        if (argv.version) {
          console.warn(
            `Warning: Querying npm to find react-native-windows@${
              argv.version
            } failed.  Attempting to continue anyway...`,
          );
        } else {
          const rnwLatestVersion = await getLatestRNWVersion();
          userError(
            `
  No compatible version of ${chalk.green('react-native-windows')} found.
  The latest supported version is ${chalk.green(
    'react-native-windows',
  )}@${chalk.cyan(rnwLatestVersion)}.
  Please modify your application to use ${chalk.green(
    'react-native',
  )}@${chalk.cyan(
              getMatchingReactNativeSemVerForReactNativeWindowsVersion(
                rnwLatestVersion,
              ),
            )} or another supported version of ${chalk.green(
              'react-native',
            )} and try again.
  `,
            EXITCODE_NO_AUTO_MATCHING_RNW,
          );
        }
      }

      if (!argv.version) {
        console.log(
          `Latest matching version of ${chalk.bold(
            'react-native-windows',
          )} for ${chalk.green('react-native')}@${chalk.cyan(
            getReactNativeVersion(),
          )} is ${chalk.green('react-native-windows')}@${chalk.cyan(
            rnwResolvedVersion,
          )}`,
        );

        if (rnwResolvedVersion && semver.prerelease(rnwResolvedVersion)) {
          const rnwLatestVersion = await getLatestRNWVersion();
          console.warn(
            `
  ${chalk.green('react-native-windows')}@${chalk.cyan(
              rnwResolvedVersion,
            )} is a ${chalk.yellow('pre-release')} version.
  The latest supported version is ${chalk.green(
    'react-native-windows',
  )}@${chalk.cyan(rnwLatestVersion)}.
  You can either downgrade your version of ${chalk.green(
    'react-native',
  )} to ${chalk.cyan(
              getMatchingReactNativeSemVerForReactNativeWindowsVersion(
                rnwLatestVersion,
              ),
            )}, or continue with a ${chalk.yellow(
              'pre-release',
            )} version of ${chalk.bold('react-native-windows')}.
  `,
          );

          const confirm: boolean = (await prompts({
            type: 'confirm',
            name: 'confirm',
            message: `Do you wish to continue with ${chalk.green(
              'react-native-windows',
            )}@${chalk.cyan(rnwResolvedVersion)}?`,
          })).confirm;

          if (!confirm) {
            process.exit(EXITCODE_USER_CANCEL);
          }
        }
      }
    }

    installReactNativeWindows(version, useDevMode);

    const generateWindows = requireGenerateWindows();
    await generateWindows(process.cwd(), name, ns, {
      language: argv.language as 'cs' | 'cpp',
      overwrite: argv.overwrite,
      verbose: argv.verbose,
      experimentalNuGetDependency: argv.experimentalNuGetDependency,
      useWinUI3: argv.useWinUI3,
      nuGetTestVersion: argv.nuGetTestVersion,
      nuGetTestFeed: argv.nuGetTestFeed,
    });
  } catch (error) {
    console.error(chalk.red(error.message));
    console.error(error);
    process.exit(EXITCODE_UNKNOWN_ERROR);
  }
})();
