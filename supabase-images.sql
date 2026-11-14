-- Chạy một lần trong Supabase SQL Editor để lưu ảnh Word giữa các thiết bị.
-- Công khai do QuizStudy được cấu hình cho mọi người có thể thêm/sửa/xóa.
insert into storage.buckets (id,name,public,file_size_limit,allowed_mime_types)
values ('quiz-images','quiz-images',true,3145728,array['image/png','image/jpeg','image/webp'])
on conflict(id) do update set public=true,file_size_limit=3145728,allowed_mime_types=array['image/png','image/jpeg','image/webp'];
drop policy if exists "quiz-images public read" on storage.objects;
drop policy if exists "quiz-images public upload" on storage.objects;
create policy "quiz-images public read" on storage.objects for select to anon using (bucket_id='quiz-images');
create policy "quiz-images public upload" on storage.objects for insert to anon with check (bucket_id='quiz-images');
-- Không cấp quyền xóa ảnh công khai để giảm rủi ro xóa nhầm toàn bộ.
