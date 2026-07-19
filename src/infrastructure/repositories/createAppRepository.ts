import type { AppRepository } from "../../application/persistence/AppRepository";
import { AppDatabase } from "../db/AppDatabase";
import { LocalStorageAppRepository } from "../storageFallback/LocalStorageAppRepository";
import { DexieAppRepository } from "./DexieAppRepository";
import { ResilientAppRepository } from "./ResilientAppRepository";

let repository: AppRepository | null = null;

export function createAppRepository(storage: Storage): AppRepository {
  const fallback = new LocalStorageAppRepository(storage);
  try {
    return new ResilientAppRepository(
      new DexieAppRepository(new AppDatabase()),
      fallback,
    );
  } catch {
    return fallback;
  }
}

export function getAppRepository(): AppRepository {
  if (repository === null) {
    if (typeof window === "undefined") {
      throw new Error(
        "The application repository is only available in the browser.",
      );
    }
    repository = createAppRepository(window.localStorage);
  }
  return repository;
}

export function setAppRepositoryForTests(next: AppRepository | null): void {
  repository = next;
}
