import { describe, it } from "node:test";
import assert from "node:assert/strict";
import postgres from "postgres";

// Integration tests exercise the actual scheduled SQL, with every write rolled back.
const connection = process.env.SUPABASE_DB_URL;
const rollback = new Error("Rollback export test fixtures");

async function withFixture(run: (sql: postgres.TransactionSql, hotel: string, item: string) => Promise<void>) {
  if (!connection) throw new Error("A test database connection is required");
  const sql = postgres(connection, { max: 1, onnotice: () => {} });
  try {
    await sql.begin(async (tx) => {
      const hotel = crypto.randomUUID();
      const item = crypto.randomUUID();
      await tx`INSERT INTO public.hotels(id,name,slug,timezone) VALUES (${hotel},'Nightly export test',${hotel},'Europe/London')`;
      await tx`INSERT INTO public.rooms(hotel_id,room_number) VALUES (${hotel},999)`;
      await tx`INSERT INTO public.template_items(id,hotel_id,name,list_type) VALUES (${item},${hotel},'Test linen','housekeeping')`;
      await tx`INSERT INTO public.room_item_counts(hotel_id,room_number,item_kind,item_id,count) VALUES (${hotel},999,'template',${item},7)`;
      await run(tx, hotel, item);
      throw rollback;
    });
  } catch (error) {
    if (error !== rollback) throw error;
  } finally {
    await sql.end();
  }
}

describe("11pm UK daily exports", { skip: !connection }, () => {
  it("does not create exports before 11pm", async () => {
    await withFixture(async (sql, hotel) => {
      await sql`SELECT public.save_missing_nightly_exports('2099-07-15T21:59:00Z'::timestamptz)`;
      const [row] = await sql`SELECT count(*)::integer AS n FROM public.export_snapshots WHERE hotel_id=${hotel}`;
      assert.equal(row?.n, 0);
    });
  });

  it("creates missing exports at 11pm in UK summer time", async () => {
    await withFixture(async (sql, hotel) => {
      await sql`SELECT public.save_missing_nightly_exports('2099-07-15T22:00:00Z'::timestamptz)`;
      const [row] = await sql`SELECT grand_total,totals FROM public.export_snapshots WHERE hotel_id=${hotel} AND kind='totals'`;
      assert.equal(row?.grand_total, 7);
      assert.deepEqual(row?.totals, [{ name: "Test linen", count: 7 }]);
    });
  });

  it("creates missing exports at 11pm in UK winter time", async () => {
    await withFixture(async (sql, hotel) => {
      await sql`SELECT public.save_missing_nightly_exports('2099-01-15T23:00:00Z'::timestamptz)`;
      const [row] = await sql`SELECT grand_total FROM public.export_snapshots WHERE hotel_id=${hotel} AND kind='room_status'`;
      assert.equal(row?.grand_total, 1);
    });
  });

  it("preserves an export already performed that day and does not duplicate it on retry", async () => {
    await withFixture(async (sql, hotel) => {
      const id = crypto.randomUUID();
      await sql`INSERT INTO public.export_snapshots(id,hotel_id,kind,totals,grand_total,created_at) VALUES (${id},${hotel},'totals','[{"name":"Earlier export","count":3}]',3,'2099-07-15T10:00:00Z')`;
      await sql`SELECT public.save_missing_nightly_exports('2099-07-15T22:00:00Z'::timestamptz)`;
      await sql`SELECT public.save_missing_nightly_exports('2099-07-15T22:00:00Z'::timestamptz)`;
      const rows = await sql`SELECT id,grand_total FROM public.export_snapshots WHERE hotel_id=${hotel} AND kind='totals'`;
      assert.equal(rows.length, 1);
      assert.equal(rows[0]?.id, id);
      assert.equal(rows[0]?.grand_total, 3);
    });
  });

  it("keeps unchanged counters out of the daily export", async () => {
    await withFixture(async (sql, hotel) => {
      await sql`INSERT INTO public.export_snapshots(hotel_id,kind,totals,grand_total,created_at) VALUES (${hotel},'totals','[{"name":"Test linen","count":7}]',7,'2099-07-14T22:00:00Z')`;
      await sql`SELECT public.save_missing_nightly_exports('2099-07-15T22:00:00Z'::timestamptz)`;
      const [row] = await sql`SELECT count(*)::integer AS n FROM public.export_snapshots WHERE hotel_id=${hotel} AND kind='totals' AND created_at >= '2099-07-15T00:00:00Z'`;
      assert.equal(row?.n, 0);
    });
  });
});