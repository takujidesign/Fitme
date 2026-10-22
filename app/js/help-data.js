// Each answer is authored in all five supported languages; no network lookup.
const rows=[
 ['Change training|เปลี่ยนการฝึก|更改训练|トレーニング変更|Đổi tập luyện','Open Me → Training settings.|เปิด ฉัน → ตั้งค่าการฝึก|打开我→训练设置。|自分→トレーニング設定を開く。|Mở Tôi → Cài đặt tập luyện.'],
 ['Plan length|ความยาวแผน|计划长度|プラン期間|Độ dài kế hoạch','Choose 7, 30, 60 or 90 days in Me.|เลือก 7, 30, 60 หรือ 90 วันในหน้าฉัน|在我中选择7、30、60或90天。|自分で7、30、60、90日を選択。|Chọn 7, 30, 60 hoặc 90 ngày trong Tôi.'],
 ['Restart plan|เริ่มแผนใหม่|重启计划|プラン再開|Bắt đầu lại','Me → Restart plan starts today and keeps logs.|ฉัน → เริ่มแผนใหม่ เก็บบันทึกเดิม|我→重启计划，保留记录。|自分→プラン再開。記録は保持。|Tôi → Bắt đầu lại, giữ nhật ký.'],
 ['Exercise alternatives|เปลี่ยนท่า|替换动作|種目の変更|Đổi bài tập','Use Swap beside an exercise.|กดสลับข้างท่าออกกำลัง|点击动作旁的替换。|種目横の変更を選ぶ。|Chọn Đổi bên cạnh bài tập.'],
 ['Rest days|วันพัก|休息日|休息日|Ngày nghỉ','Change individual days in the calendar.|เปลี่ยนวันในปฏิทิน|在日历中更改日期。|カレンダーで日を変更。|Đổi ngày trong lịch.'],
 ['Log a meal|บันทึกอาหาร|记录饮食|食事を記録|Ghi bữa ăn','Food → Log a meal; review amounts before saving.|อาหาร → บันทึกอาหาร ตรวจปริมาณก่อนบันทึก|饮食→记录，保存前核对份量。|食事→記録。保存前に量を確認。|Ăn uống → Ghi bữa ăn, kiểm tra lượng trước khi lưu.'],
 ['Food exclusions|อาหารที่ไม่กิน|食物排除|食品の除外|Loại trừ thức ăn','Food preferences excludes selected foods from plans.|ตั้งค่าอาหารเพื่อตัดอาหารที่ไม่กินออกจากแผน|饮食偏好可排除选定食物。|食事設定で選択食品を除外。|Tùy chọn ăn uống loại món khỏi kế hoạch.'],
 ['Fasting window|ช่วงกิน IF|进食窗口|食事時間帯|Khung giờ ăn','Set the window in Food preferences.|ตั้งช่วงกินในตั้งค่าอาหาร|在饮食偏好设置时间。|食事設定で時間帯を設定。|Đặt khung giờ trong tùy chọn ăn uống.'],
 ['Meal photos|รูปอาหาร|食物照片|食事写真|Ảnh bữa ăn','AI estimates are approximate; edit before logging.|AI ประเมินคร่าว ๆ แก้ไขก่อนบันทึก|AI估算仅供参考，记录前可编辑。|AIは概算です。記録前に編集。|AI chỉ ước tính; sửa trước khi ghi.'],
 ['Barcode scan|สแกนบาร์โค้ด|条码扫描|バーコード|Quét mã vạch','Scan the package and verify the serving size.|สแกนบรรจุภัณฑ์และตรวจขนาดหน่วยบริโภค|扫描包装并核对份量。|包装を読み取り、一食量を確認。|Quét bao bì và kiểm tra khẩu phần.'],
 ['Add supplements|เพิ่มอาหารเสริม|添加补剂|サプリ追加|Thêm thực phẩm bổ sung','Open Supps and add a product or its label.|เปิดอาหารเสริมแล้วเพิ่มผลิตภัณฑ์หรือฉลาก|打开补剂并添加产品或标签。|サプリで製品やラベルを追加。|Mở Bổ sung và thêm sản phẩm hoặc nhãn.'],
 ['Supplement schedule|ตารางอาหารเสริม|补剂时间表|サプリの予定|Lịch bổ sung','The schedule uses label directions and meal times.|ตารางอิงคำแนะนำฉลากและเวลามื้ออาหาร|时间表依据标签和进餐时间。|ラベルの用法と食事時間に基づきます。|Lịch dựa trên hướng dẫn nhãn và giờ ăn.'],
 ['Medication warnings|คำเตือนยา|药物提醒|薬の注意|Cảnh báo thuốc','Record medications in Health to see interaction notes.|บันทึกยาในสุขภาพเพื่อดูหมายเหตุปฏิกิริยาระหว่างกัน|在健康中记录用药以查看相互作用提示。|健康に薬を登録して相互作用を確認。|Ghi thuốc trong Sức khỏe để xem tương tác.'],
 ['Choose AI|เลือก AI|选择AI|AI選択|Chọn AI','Me → AI engine offers available engines.|ฉัน → เครื่องมือ AI เพื่อเลือกที่พร้อมใช้|我→AI引擎选择可用服务。|自分→AIエンジンから選択。|Tôi → Công cụ AI để chọn.'],
 ['Gemini key|คีย์ Gemini|Gemini密钥|Geminiキー|Khóa Gemini','Your key stays on this device and is excluded from backups.|คีย์อยู่ในเครื่องนี้และไม่รวมในสำรองข้อมูล|密钥仅存本机，不进入备份。|キーは端末内のみでバックアップ対象外。|Khóa ở thiết bị này, không vào bản sao lưu.'],
 ['Claude credits|เครดิต Claude|Claude额度|Claudeクレジット|Tín dụng Claude','Credits apply only when choosing Claude.|ใช้เครดิตเฉพาะเมื่อเลือก Claude|仅选择Claude时使用额度。|Claude選択時のみ使用。|Chỉ dùng tín dụng khi chọn Claude.'],
 ['On-device AI|AI ในเครื่อง|本地AI|端末内AI|AI trên thiết bị','This option appears only in supported browsers.|แสดงตัวเลือกเฉพาะเบราว์เซอร์ที่รองรับ|仅在支持的浏览器显示。|対応ブラウザーのみ表示。|Chỉ hiện trên trình duyệt hỗ trợ.'],
 ['Backups|สำรองข้อมูล|备份|バックアップ|Sao lưu','Me → Back up data downloads a JSON file.|ฉัน → สำรองข้อมูล ดาวน์โหลดไฟล์ JSON|我→备份数据下载JSON。|自分→データバックアップでJSON保存。|Tôi → Sao lưu để tải JSON.'],
 ['Restore|กู้คืน|恢复|復元|Khôi phục','Me → Restore backup imports your JSON backup.|ฉัน → กู้คืนข้อมูล เพื่อนำเข้าไฟล์ JSON|我→恢复备份导入JSON。|自分→復元からJSONを選択。|Tôi → Khôi phục để nhập JSON.'],
 ['Delete account|ลบบัญชี|删除账户|アカウント削除|Xóa tài khoản','Account → Delete account requires confirmation.|บัญชี → ลบบัญชี ต้องยืนยันก่อน|账户→删除账户需要确认。|アカウント→削除には確認が必要。|Tài khoản → Xóa cần xác nhận.'],
 ['Friends|เพื่อน|好友|友だち|Bạn bè','Create a profile, confirm age 16+, then search @handle.|สร้างโปรไฟล์ ยืนยันอายุ 16+ แล้วค้นหา @handle|创建资料并确认16岁以上，然后搜索用户名。|プロフィールで16歳以上を確認し、@名を検索。|Tạo hồ sơ, xác nhận 16+ rồi tìm @tên.'],
 ['Chat safety|ความปลอดภัยแชต|聊天安全|チャットの安全|An toàn trò chuyện','Only friends can start chats. Block or report unwanted contact.|เฉพาะเพื่อนเริ่มแชตได้ บล็อกหรือรายงานได้|只有好友可发起聊天，可屏蔽或举报。|友だちのみ開始可能。ブロック・報告できます。|Chỉ bạn bè được bắt đầu chat. Có thể chặn hoặc báo cáo.'],
 ['Message privacy|ความเป็นส่วนตัวข้อความ|消息隐私|メッセージのプライバシー|Riêng tư tin nhắn','Platform encryption at rest, not end-to-end. Messages expire after 180 days.|แพลตฟอร์มเข้ารหัสขณะจัดเก็บ ไม่ใช่ต้นทางถึงปลายทาง ลบหลัง 180 วัน|平台静态加密，非端到端；180天后删除。|保存時暗号化で、エンドツーエンドではありません。180日後削除。|Mã hóa lưu trữ, không đầu cuối. Xóa sau 180 ngày.'],
 ['Gym check-in|เช็กอินยิม|健身房签到|ジムチェックイン|Điểm danh phòng tập','Be within 200 m with location accuracy ≤100 m. Wait 4 hours between visits to the same gym.|อยู่ในระยะ 200 ม. ความแม่นยำ ≤100 ม. เว้นยิมเดิม 4 ชม.|距离200米内，精度≤100米，同一场馆间隔4小时。|200m以内・精度100m以下。同じジムは4時間間隔。|Trong 200 m, độ chính xác ≤100 m; cách 4 giờ tại cùng phòng tập.'],
 ['Donations|สนับสนุน|捐赠|寄付|Ủng hộ','Support is optional. Free mode does not require a donation.|สนับสนุนตามสมัครใจ โหมดฟรีไม่ต้องบริจาค|捐赠自愿，免费模式无需捐赠。|寄付は任意。無料モードでは不要。|Ủng hộ tự nguyện; chế độ miễn phí không yêu cầu.']
];
export const FAQ=rows.map(([q,a],id)=>({id,q:Object.fromEntries(['en','th','zh','ja','vi'].map((l,i)=>[l,q.split('|')[i]])),a:Object.fromEntries(['en','th','zh','ja','vi'].map((l,i)=>[l,a.split('|')[i]]))}));
export function searchHelp(query,lang='en'){const term=query.trim().toLocaleLowerCase();return FAQ.filter(item=>(item.q[lang]+' '+item.a[lang]).toLocaleLowerCase().includes(term));}
