import { DBNotFoundException, KasiaDB } from "./db";

export type DbSavedHandshake = {
  /**
   * `${tenantId}_${transactionId}`
   */
  id: string;
};

export type SavedHandshake = DbSavedHandshake;

export class SavedHandhshakeRepository {
  constructor(readonly db: KasiaDB) {}

  async getSavedHandshake(id: string): Promise<SavedHandshake> {
    const result = await this.db.get("savedHandshakes", id);

    if (!result) {
      throw new DBNotFoundException();
    }

    return result;
  }

  async saveSavedHandshake(savedHandhshake: SavedHandshake): Promise<void> {
    await this.db.put("savedHandshakes", {
      id: savedHandhshake.id,
    });
    return;
  }

  async doesExistsById(savedHanshakeId: string): Promise<boolean> {
    return this.db
      .count("savedHandshakes", savedHanshakeId)
      .then((count) => count > 0);
  }
}
