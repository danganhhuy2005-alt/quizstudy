# QuizStudy V10 - upload Word ảnh lớn trực tiếp Supabase

## Cập nhật
Giữ nguyên `.env.local`, Supabase hiện tại. Chép ghi đè mã nguồn và push GitHub.

- Thay `app/page.tsx`
- Thêm `lib/word-image-client.ts`
- Thêm `app/api/image-word/sign/route.ts`
- Giữ bản `lib/server.ts` đã sửa TypeScript.

Word được đọc trong trình duyệt qua JSZip. Chỉ gọi Vercel để ký URL tải ảnh; ảnh đi thẳng từ trình duyệt tới Supabase Storage. Không gửi 11 MB DOCX lên Vercel.

Vẫn dùng `supabase-images.sql` của V8. Bucket `quiz-images` phải public, ảnh PNG/JPG/WEBP, giới hạn mỗi ảnh 3 MB. DOCX tối đa 60 MB, tối đa 500 ảnh. Mỗi Câu N kèm một ảnh.

**Cẩn trọng**: bộ đề chỉ được lưu sau khi toàn bộ ảnh tải lên và người dùng bấm `Lưu`. Nếu bỏ ngang có thể còn ảnh chưa được liên kết trong Storage; có thể dọn ảnh mồ côi qua Supabase Dashboard khi cần.

Không cần chỉnh SQL nếu V8 đã chạy thành công. Việc ký upload bằng anon key cần storage policy `INSERT` cho `anon` như file SQL V8.

### Kiểm tra
`npm install` rồi `npm run typecheck` và `npm run build` tại thư mục gốc.

`git add . && git commit -m "Upload large Word images directly to Supabase" && git push origin main`
