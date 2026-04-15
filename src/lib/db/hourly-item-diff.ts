import { sql } from 'drizzle-orm';

type SqlExecutor = {
  run: (query: ReturnType<typeof sql>) => Promise<unknown>;
};

export async function deleteRowsNotInList(params: {
  executor: SqlExecutor;
  tableName: string;
  snapshotId: number;
  snapshotColumn?: string;
  keyColumn: string;
  keepKeys: Array<string | number>;
}) {
  const snapshotColumn = params.snapshotColumn ?? 'snapshot_id';
  if (params.keepKeys.length === 0) {
    await params.executor.run(
      sql.raw(`DELETE FROM ${params.tableName} WHERE ${snapshotColumn} = ${Number(params.snapshotId)}`),
    );
    return;
  }

  const keepValues = sql.join(params.keepKeys.map((key) => sql`${key}`), sql`, `);
  await params.executor.run(sql`
    DELETE FROM ${sql.raw(params.tableName)}
    WHERE ${sql.raw(snapshotColumn)} = ${params.snapshotId}
      AND ${sql.raw(params.keyColumn)} NOT IN (${keepValues})
  `);
}

export async function negateRanksForSnapshot(params: {
  executor: SqlExecutor;
  tableName: string;
  snapshotId: number;
  snapshotColumn?: string;
}) {
  const snapshotColumn = params.snapshotColumn ?? 'snapshot_id';
  await params.executor.run(sql`
    UPDATE ${sql.raw(params.tableName)}
    SET rank = -rank
    WHERE ${sql.raw(snapshotColumn)} = ${params.snapshotId}
  `);
}
