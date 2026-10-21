const rows=[
['Animation','动画','アニメーション','Hoạt ảnh'],
['Start–Finish','开始–结束','開始–終了','Bắt đầu–Kết thúc'],
['Start','开始','開始','Bắt đầu'],['Finish','结束','終了','Kết thúc'],
['AI illustration','AI 插图','AI イラスト','Hình minh họa AI'],
['Alternate poses','切换姿势','ポーズ切り替え','Đổi tư thế'],
['Movement arrows','动作箭头','動作の矢印','Mũi tên chuyển động'],
['Exercise illustrations are AI-generated (OpenAI image generation through Codex).','运动插图由 AI 生成（通过 Codex 使用 OpenAI 图像生成）。','運動イラストは AI で生成されています（Codex 経由の OpenAI 画像生成）。','Hình minh họa bài tập được tạo bằng AI (OpenAI image generation qua Codex).']
];
export default Object.fromEntries(['zh','ja','vi'].map((lang,i)=>[lang,Object.fromEntries(rows.map(row=>[row[0],row[i+1]]))]));
