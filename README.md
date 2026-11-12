# QuizStudy — thư viện đề trắc nghiệm dùng chung (không AI)

Website Next.js để chia sẻ bộ đề qua Supabase, **mọi người truy cập đều có thể thêm, sửa, xóa, làm bài**. Không có Gemini API, không có tài khoản, không có hẹn giờ.

## Tính năng

- Nhập 2 nguồn: **đề** và **đáp án** qua DOCX, PDF **có chữ**, TXT, CSV hoặc ZIP chứa các file hỗ trợ; cũng có thể dán văn bản.
- Tách câu hỏi đánh số `1. ...`, `Câu 1: ...`, `Question 1: ...` và các phương án ở **đầu dòng** `A. ...`, `B. ...`, `C. ...`, `D. ...` (không bắt buộc đủ 4).
- Ghép đáp án qua số câu (`1.A 2.B...`), lọc trùng theo nội dung chuẩn hóa. Nếu một đáp án trỏ tới lựa chọn không có trong đề, sẽ đánh dấu chưa có đáp án và cảnh báo.
- Kiểm tra/sửa câu hỏi, phương án và đáp án trước khi lưu.
- Chọn đáp án, chấm điểm, xem câu sai, luyện lại câu sai; tùy chọn trộn câu và phương án.
- Nút sao chép câu hỏi để mang sang ChatGPT hỏi thêm; không phát sinh phí API AI.
- Dữ liệu bộ đề nằm trên Supabase nên đổi thiết bị vẫn thấy. Kết quả làm bài hiện chưa lưu chung.

**Giới hạn:** Không hỗ trợ OCR ảnh hoặc PDF scan; PDF có chữ nhưng bố cục phức tạp có thể tách sai, cần kiểm tra trước khi lưu. File `.doc` cũ phải đổi sang `.docx`. Giới hạn tải dữ liệu ~4MB/mỗi lượt nhập để tương thích Vercel Functions.

## 1. Tạo database Supabase

1. Vào https://supabase.com/dashboard tạo project miễn phí nếu có hạn mức.
2. Chọn **SQL Editor** và chạy toàn bộ nội dung file `supabase.sql`.
3. Vào **Project Settings → API** (hoặc **Connect → API Keys**) lấy Project URL và **anon/public API key** (không dùng service_role key).

**Cảnh báo:** SQL chủ động cấp quyền **đọc/thêm/sửa/xóa cho mọi khách truy cập**, đúng theo yêu cầu của chủ web. Không tải dữ liệu riêng tư hoặc đề bạn không có quyền chia sẻ. Bất kỳ ai biết URL đều có thể xóa toàn bộ đề; xác nhận xóa trên giao diện chỉ tránh bấm nhầm, không phải cơ chế bảo mật.

## 2. Chạy trên máy Windows

Yêu cầu Node.js 20+ (khuyến nghị 22+).

```powershell
npm install
Copy-Item .env.example .env.local
```

Mở `.env.local`, điền:

```env
NEXT_PUBLIC_SUPABASE_URL=https://YOUR_PROJECT.supabase.co
SUPABASE_ANON_KEY=YOUR_SUPABASE_ANON_KEY
```

Chạy:

```powershell
npm run dev
```

Mở http://localhost:3000

## 3. Deploy trên Vercel

1. Đưa thư mục code lên GitHub (không commit `.env.local`).
2. Vào https://vercel.com/new → Import Git Repository.
3. Framework tự nhận dạng **Next.js**.
4. Vào Project Settings → Environment Variables, điền **NEXT_PUBLIC_SUPABASE_URL** và **SUPABASE_ANON_KEY** giống ở local.
5. Deploy. Dữ liệu Supabase dùng chung giữa local, Vercel và các thiết bị.

Không dùng `SUPABASE_SERVICE_ROLE_KEY` và không cần Gemini key. Vercel có thể sử dụng với các gói miễn phí tùy hạn mức hiện hành.

## Mẫu tài liệu để thử

**Đề:**

```text
1. What is the capital of Vietnam?
A. Hanoi
B. Bangkok
C. London
D. Tokyo
2. 2 + 2 = ?
A. 3
B. 5
C. 4
D. 6
```

**Đáp án:**

```text
1.A 2.C
```

## Kiểm tra

```powershell
npm run typecheck
npm run build
```

Lưu ý: Mã nguồn được soạn và bộ tách câu được kiểm thử bằng Node; quá trình cài package/build chưa xác minh thành công trong môi trường xuất file do không kết nối được registry npm. Nếu build báo lỗi, gửi ảnh Terminal để được hỗ trợ.

## Điểm mới ở bản sửa parser

- Không chia đáp án bằng biểu thức thay thế trên toàn bộ văn bản, tránh cắt nhầm `C. Mác` trong câu hỏi.
- Nhận dạng `Câu 1.`, `Câu 2.`, `1.`, `2)` tại đầu dòng; các lựa chọn A/B/C/D chỉ nhận ở đầu dòng.
- Không bỏ câu thiếu phương án; mỗi câu phải có ít nhất một phương án.
- Xem trước trước khi đăng, có thể để trống những lựa chọn không có.
- **Không thể đảm bảo 100%** với tài liệu Word/PDF bố cục lạ. Hãy đối chiếu ở bước xem trước.


## Câu chọn nhiều đáp án (bản cập nhật)
- Đáp án mẫu: `1.A 2.B,D 3.ACE 4: A và C` (câu 2, 3, 4 có nhiều đáp án).
- Trong màn hình sửa đề, bật **Câu chọn nhiều đáp án** rồi tích tất cả lựa chọn đúng.
- Khi luyện tập, các câu này cho tích nhiều ô. Chỉ tính đúng khi chọn **đúng toàn bộ, không thừa/thiếu**.
- Các bộ đề cũ có đáp án một chữ A/B/C/D vẫn hoạt động, không cần sửa database Supabase.
- Hỗ trợ phương án A-H; nhãn phương án được trộn nếu bật chức năng trộn đáp án.
- Đề thiếu đáp án hoặc cấu trúc khác lạ vẫn nên kiểm tra trong trang xem trước.

## Trả lời và xem đáp án ngay (V4)

- Câu chọn 1 đáp án: bấm lựa chọn sẽ hiện đúng/sai và đáp án ngay, không gọi API.
- Câu chọn nhiều đáp án: tích các lựa chọn rồi nhấn **Kiểm tra đáp án** để tránh lộ đáp án ngay sau cú bấm đầu tiên.
- Khi đã kiểm tra, không thể thay đổi câu trả lời của lượt đó; bấm **Làm lại cả đề** để luyện lại.
- Nếu đề chưa có key, website thông báo chưa có đáp án, không tự đoán.
- Toàn bộ xử lý diễn ra trong trình duyệt; không thay đổi cấu trúc Supabase.
