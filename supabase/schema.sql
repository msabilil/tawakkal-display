-- Jalankan di Supabase Dashboard -> SQL Editor, sekali saat setup project baru.
-- Lihat "Setup Manual" di docs/superpowers/specs/2026-09-10-supabase-cloud-sync-design.md

create table if not exists settings (
  key text primary key,
  value jsonb not null,
  updated_at timestamptz not null default now()
);

alter table settings enable row level security;

create policy "settings_public_read" on settings
  for select using (true);

create policy "settings_admin_write" on settings
  for all using (auth.role() = 'authenticated')
  with check (auth.role() = 'authenticated');

-- Realtime: aktifkan lewat Dashboard -> Database -> Replication -> tabel `settings`
-- (tidak bisa lewat SQL biasa di semua tier, jadi dicek manual).

-- Storage bucket `media` dibuat lewat Dashboard -> Storage -> New bucket
-- (nama: media, Public bucket: ON), lalu jalankan policy di bawah ini:
create policy "media_public_read" on storage.objects
  for select using (bucket_id = 'media');

create policy "media_admin_write" on storage.objects
  for insert with check (bucket_id = 'media' and auth.role() = 'authenticated');

create policy "media_admin_update" on storage.objects
  for update using (bucket_id = 'media' and auth.role() = 'authenticated');

create policy "media_admin_delete" on storage.objects
  for delete using (bucket_id = 'media' and auth.role() = 'authenticated');
