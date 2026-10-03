/**
 * Bucket en mémoire pour les tests. Les « URL » d'envoi encodent la clé et la taille signée ;
 * `upload` simule l'envoi du téléphone en respectant cette taille, comme le vrai stockage.
 */
export class FakeStorage {
  readonly objects = new Map<string, number>();

  async uploadUrl(key: string, contentType: string, byteSize: number) {
    return `fake://put/${encodeURIComponent(key)}?type=${contentType}&size=${byteSize}`;
  }

  async readUrl(key: string) {
    return `fake://get/${encodeURIComponent(key)}`;
  }

  async size(key: string) {
    return this.objects.get(key) ?? null;
  }

  async delete(keys: string[]) {
    for (const key of keys) this.objects.delete(key);
  }

  async deletePrefix(prefix: string) {
    for (const key of this.objects.keys())
      if (key.startsWith(prefix)) this.objects.delete(key);
  }

  deleteQuietly(keys: string[]) {
    return this.delete(keys);
  }

  deletePrefixQuietly(prefix: string) {
    return this.deletePrefix(prefix);
  }

  /** Simule l'envoi depuis le téléphone ; refuse, comme B2, une taille différente de la signée. */
  upload(url: string, size?: number) {
    const parsed = new URL(url);
    const key = decodeURIComponent(parsed.pathname.replace(/^\//, ''));
    const signed = Number(parsed.searchParams.get('size'));
    if (size !== undefined && size !== signed)
      throw new Error('403 : taille différente de la signature');
    this.objects.set(key, size ?? signed);
  }

  keys() {
    return [...this.objects.keys()];
  }
}
