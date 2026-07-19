# Data migration and recovery

IndexedDB uses additive Dexie schema version 1 stores. Persisted records are parsed with strict Zod schemas on every read and write.

The localStorage fallback envelope migrates versions 1 through 3 to version 4. Migration preserves individuals, sessions, histories, snapshots, and plans as those collections become available, then adds validated default settings. Automated tests cover the oldest supported envelope.

JSON restore validates the format identifier and schema version before mutation. Replace and merge restore modes create a downloadable safety backup first. A merge that would create multiple active deposits is rejected without partial import. Unsupported future schema versions are rejected.

If a future IndexedDB schema change needs destructive transformation, increment the Dexie version, export the current payload to `migrationBackups`, run the transformation in one transaction, and expose that backup through the data-management UI before release.
