/**
 * Copyright (c) Microsoft Corporation.
 * Licensed under the MIT License.
 *
 * @format
 */

import * as Serialized from './Serialized';
import * as path from 'path';

import UpgradeStrategy, {UpgradeStrategies} from './UpgradeStrategy';
import ValidationStrategy, {ValidationStrategies} from './ValidationStrategy';
import {normalizePath, unixPath} from './PathUtils';
import OverrideFactory from './OverrideFactory';

/**
 * Immutable programmatic representation of an override. This should remain
 * generic to files vs directories, different representations, different
 * validation rules, etc.
 */
export default interface Override {
  /**
   * Case sensitive identifer of the override (e.g. filename or directory name)
   */
  name(): string;

  /**
   * Does the override include the given file?
   */
  includesFile(filename: string): boolean;

  /**
   * Convert to a serialized representation
   */
  serialize(): Serialized.Override;

  /**
   * Create a copy of the override which is considered "up to date" in regards
   * to the current React source tree. This does not change underlying content.
   */
  createUpdated(factory: OverrideFactory): Promise<Override>;

  /**
   * Specifies how the override should be modified to integrate new changes.
   */
  upgradeStrategy(): UpgradeStrategy;

  /**
   * Specifies how to check if the override contents are valid and up to date.
   */
  validationStrategies(): ValidationStrategy[];
}

/**
 * Platform overrides represent logic not derived from upstream sources.
 */
export class PlatformOverride implements Override {
  private overrideFile: string;

  constructor(args: {file: string}) {
    this.overrideFile = normalizePath(args.file);
  }

  static fromSerialized(
    serialized: Serialized.PlatformOverride,
  ): PlatformOverride {
    return new PlatformOverride(serialized);
  }

  serialize(): Serialized.PlatformOverride {
    return {type: 'platform', file: unixPath(this.overrideFile)};
  }

  name(): string {
    return this.overrideFile;
  }

  includesFile(filename: string): boolean {
    return normalizePath(filename) === this.overrideFile;
  }

  async createUpdated(factory: OverrideFactory): Promise<Override> {
    return factory.createPlatformOverride(this.overrideFile);
  }

  upgradeStrategy(): UpgradeStrategy {
    return UpgradeStrategies.assumeUpToDate(this.overrideFile);
  }

  validationStrategies(): ValidationStrategy[] {
    return [ValidationStrategies.overrideFileExists(this.overrideFile)];
  }
}

/**
 * Base class for overrides which derive from an upstream file
 */
abstract class BaseFileOverride implements Override {
  protected overrideFile: string;
  protected baseFile: string;
  protected baseVersion: string;
  protected baseHash: string;
  protected issueNumber: number | null | 'LEGACY_FIXME';

  constructor(args: {
    file: string;
    baseFile: string;
    baseVersion: string;
    baseHash: string;
    issue?: number | 'LEGACY_FIXME';
  }) {
    this.overrideFile = normalizePath(args.file);
    this.baseFile = normalizePath(args.baseFile);
    this.baseVersion = args.baseVersion;
    this.baseHash = args.baseHash;
    this.issueNumber = args.issue || null;
  }

  name(): string {
    return this.overrideFile;
  }

  includesFile(filename: string): boolean {
    return normalizePath(filename) === this.overrideFile;
  }

  abstract serialize(): Serialized.Override;
  abstract createUpdated(factory: OverrideFactory): Promise<Override>;
  abstract upgradeStrategy(): UpgradeStrategy;

  validationStrategies(): ValidationStrategy[] {
    return [
      ValidationStrategies.baseFileExists(this.overrideFile, this.baseFile),
      ValidationStrategies.overrideFileExists(this.overrideFile),
      ValidationStrategies.baseUpToDate(
        this.overrideFile,
        this.baseFile,
        this.baseHash,
      ),
    ];
  }

  protected serialzeBase() {
    return {
      file: unixPath(this.overrideFile),
      baseFile: unixPath(this.baseFile),
      baseVersion: this.baseVersion,
      baseHash: this.baseHash,
    };
  }
}

/**
 * Copy overrides enforce that an override file is an exact copy of a base file
 */
export class CopyOverride extends BaseFileOverride {
  constructor(args: {
    file: string;
    baseFile: string;
    baseVersion: string;
    baseHash: string;
    issue: number;
  }) {
    super(args);
  }

  static fromSerialized(serialized: Serialized.CopyOverride): CopyOverride {
    return new CopyOverride(serialized);
  }

  serialize(): Serialized.CopyOverride {
    return {
      type: 'copy',
      ...this.serialzeBase(),
      issue: this.issueNumber as number,
    };
  }

  async createUpdated(factory: OverrideFactory): Promise<Override> {
    return factory.createCopyOverride(this.overrideFile, this.baseFile, this
      .issueNumber as number);
  }

  upgradeStrategy(): UpgradeStrategy {
    return UpgradeStrategies.copyFile(this.overrideFile, this.baseFile);
  }

  validationStrategies(): ValidationStrategy[] {
    return [
      ...super.validationStrategies(),
      ValidationStrategies.overrideCopyOfBase(this.overrideFile, this.baseFile),
    ];
  }
}

/**
 * Derived overrides represent files which are based off of an existing file in
 * the React Native source tree.
 */
export class DerivedOverride extends BaseFileOverride {
  constructor(args: {
    file: string;
    baseFile: string;
    baseVersion: string;
    baseHash: string;
    issue?: number | 'LEGACY_FIXME';
  }) {
    super(args);
  }

  static fromSerialized(
    serialized: Serialized.DerivedOverride,
  ): DerivedOverride {
    return new DerivedOverride(serialized);
  }

  serialize(): Serialized.DerivedOverride {
    return {
      type: 'derived',
      ...this.serialzeBase(),
      issue: this.issueNumber || undefined,
    };
  }

  async createUpdated(factory: OverrideFactory): Promise<Override> {
    return factory.createDerivedOverride(
      this.overrideFile,
      this.baseFile,
      this.issueNumber || undefined,
    );
  }

  upgradeStrategy(): UpgradeStrategy {
    return UpgradeStrategies.threeWayMerge(
      this.overrideFile,
      this.baseFile,
      this.baseVersion,
    );
  }

  validationStrategies(): ValidationStrategy[] {
    return [
      ...super.validationStrategies(),
      ValidationStrategies.overrideDifferentFromBase(
        this.overrideFile,
        this.baseFile,
      ),
    ];
  }
}

/**
 * Patch overrides represent files which make minor modifications to existing
 * upstream sources.
 */
export class PatchOverride extends BaseFileOverride {
  constructor(args: {
    file: string;
    baseFile: string;
    baseVersion: string;
    baseHash: string;
    issue?: number | 'LEGACY_FIXME';
  }) {
    super(args);
  }

  static fromSerialized(serialized: Serialized.PatchOverride): PatchOverride {
    return new PatchOverride(serialized);
  }

  serialize(): Serialized.PatchOverride {
    return {
      type: 'patch',
      ...this.serialzeBase(),
      issue: this.issueNumber as number,
    };
  }

  async createUpdated(factory: OverrideFactory): Promise<Override> {
    return factory.createPatchOverride(
      this.overrideFile,
      this.baseFile,
      this.issueNumber!,
    );
  }

  upgradeStrategy(): UpgradeStrategy {
    return UpgradeStrategies.threeWayMerge(
      this.overrideFile,
      this.baseFile,
      this.baseVersion,
    );
  }

  validationStrategies(): ValidationStrategy[] {
    return [
      ...super.validationStrategies(),
      ValidationStrategies.overrideDifferentFromBase(
        this.overrideFile,
        this.baseFile,
      ),
    ];
  }
}

/**
 * DirectoryCopy overrides copy files from an upstream directory
 */
export class DirectoryCopyOverride implements Override {
  private directory: string;
  private baseDirectory: string;
  private baseVersion: string;
  private baseHash: string;
  private issue: number;

  constructor(args: {
    directory: string;
    baseDirectory: string;
    baseVersion: string;
    baseHash: string;
    issue: number;
  }) {
    this.directory = normalizePath(args.directory);
    this.baseDirectory = normalizePath(args.baseDirectory);
    this.baseVersion = args.baseVersion;
    this.baseHash = args.baseHash;
    this.issue = args.issue;
  }

  static fromSerialized(
    serialized: Serialized.DirectoryCopyOverride,
  ): DirectoryCopyOverride {
    return new DirectoryCopyOverride(serialized);
  }

  serialize(): Serialized.DirectoryCopyOverride {
    return {
      type: 'copy',
      directory: unixPath(this.directory),
      baseDirectory: unixPath(this.baseDirectory),
      baseVersion: this.baseVersion,
      baseHash: this.baseHash,
      issue: this.issue,
    };
  }

  name(): string {
    return this.directory;
  }

  includesFile(filename: string): boolean {
    const relativeToDir = path.relative(
      this.directory,
      normalizePath(filename),
    );

    return relativeToDir.split(path.sep)[0] !== '..';
  }

  async createUpdated(factory: OverrideFactory): Promise<Override> {
    return factory.createDirectoryCopyOverride(
      this.directory,
      this.baseDirectory,
      this.issue,
    );
  }

  upgradeStrategy(): UpgradeStrategy {
    return UpgradeStrategies.copyDirectory(this.directory, this.baseDirectory);
  }

  validationStrategies(): ValidationStrategy[] {
    return [
      ValidationStrategies.overrideDirectoryExists(this.directory),
      ValidationStrategies.baseDirectoryExists(
        this.directory,
        this.baseDirectory,
      ),
      ValidationStrategies.baseUpToDate(
        this.directory,
        this.baseDirectory,
        this.baseHash,
      ),
      ValidationStrategies.overrideCopyOfBase(
        this.directory,
        this.baseDirectory,
      ),
    ];
  }
}

export function deserializeOverride(ovr: Serialized.Override): Override {
  switch (ovr.type) {
    case 'platform':
      return PlatformOverride.fromSerialized(ovr);
    case 'copy':
      return 'directory' in ovr
        ? DirectoryCopyOverride.fromSerialized(ovr)
        : CopyOverride.fromSerialized(ovr);
    case 'derived':
      return DerivedOverride.fromSerialized(ovr);
    case 'patch':
      return PatchOverride.fromSerialized(ovr);
  }
}
