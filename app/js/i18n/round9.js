const rows=[
['Animation','动画','アニメーション','Hoạt ảnh'],
['Start–Finish','开始–结束','開始–終了','Bắt đầu–Kết thúc'],
['Start','开始','開始','Bắt đầu'],['Finish','结束','終了','Kết thúc'],
['AI illustration','AI 插图','AI イラスト','Hình minh họa AI'],
['Alternate poses','切换姿势','ポーズ切り替え','Đổi tư thế'],
['Movement arrows','动作箭头','動作の矢印','Mũi tên chuyển động'],
['Some exercise illustrations are AI-generated (kie.ai); the model is shown beside each approved image.','部分动作插图由 AI（kie.ai）生成；模型标注在已审核图片旁。','一部の種目イラストは AI（kie.ai）で生成され、承認済み画像の横にモデルを表示します。','Một số hình bài tập do AI (kie.ai) tạo; tên mô hình hiển thị cạnh hình đã duyệt.']
];
export default Object.fromEntries(['zh','ja','vi'].map((lang,i)=>[lang,Object.fromEntries(rows.map(row=>[row[0],row[i+1]]))]));
