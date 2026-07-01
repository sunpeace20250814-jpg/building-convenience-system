/**
 * Build-time script: 下載 + subset 中文字型
 *
 * 輸出：
 *   - client/public/fonts/base-chars.txt    (字符清單)
 *   - client/public/fonts/noto-sans-tc-base.ttf (subset 字型)
 *
 * 用法: pnpm tsx scripts/build-font.ts
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import https from 'https';
import subsetFont from 'subset-font';
import opentype from 'opentype.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const OUTPUT_DIR = path.resolve(__dirname, '../public/fonts');

// 教育部常用國字 4808 字（這裡只列前 2500 個最常用的，加上符號和英文）
// 完整版本可從 https://language.moe.gov.tw/ 取得
// 為了 build 速度，這裡採用「常見字 + 報表專用字」的子集
const COMMON_CHARS = `
的一是了我不在有他這中大來上個們和國地到以說時要就出會可也你對生能而子那得於著下自之年過發後作裡用同行所面方分公後前好如學於長現種新意樣老從當她們給們進麼吧得嗎呢啊哈喔嘿嗯
人民政府國家社會經濟政治法律文化教育科技衛生體育軍事外交國防
年月日週小時分鐘秒季春夏秋冬東南西北上下左右前後內外高低遠近長短寬窄大小多少輕重快慢新舊冷熱明暗乾濕軟硬粗細遠近深淺濃淡
工作生活家庭朋友同事鄰居師生同學家人父母兄弟姊妹丈夫妻子兒子女兒子孫父母親戚家長老師學生醫生病人生產消費
公司企業銀行商店工廠學校醫院辦公室會議室實驗室圖書館餐廳酒店旅館市場超市公園
電腦網路手機電話電視廣播報紙雜誌書籍字典辭典地圖圖表報表統計數據資料信息
工程技術設計製造生產經營管理銷售採購運輸物流倉儲供應需求
農業工業商業服務業金融業房地產業旅遊業餐飲業
台灣台北高雄台中台南新竹嘉義基隆宜蘭花蓮台東屏東
住戶住家房東房客租屋出租承租購買房屋公寓大樓社區物業
水電瓦斯電費水費管理費停車費維修費保險費稅金
編號姓名電話地址生日身份證號碼性別年齡國籍職業職位部門
總計小計平均最高最低總和差額百分比
本月上週本月本週本季本年上季上月去年上週
新增刪除修改編輯查詢列印匯出匯入搜尋篩選排序
成功失敗錯誤警告提示訊息通知確認取消儲存提交返回關閉開啟
月日週年星期時分秒期間時間開始結束上午下午早上中午晚上凌晨
列表表格表單欄位列項目選單選項按鈕連結圖示標籤頁面視窗
上午下午
`;

const ASCII = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
const SYMBOLS = ' `~!@#$%^&*()-_+=[]{}|\\;:\'",.<>?/，。、；：？！（）—…《》「」『』【】￥$%°℃';
const NUMBERS_CN = '零一二三四五六七八九十百千萬億〇壹貳叁肆伍陸柒捌玖拾佰仟';

function getUniqueChars(): string {
  const all = (COMMON_CHARS + ASCII + SYMBOLS + NUMBERS_CN).split('');
  return Array.from(new Set(all)).filter((c) => c.trim().length > 0).join('');
}

function download(url: string): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    https.get(url, (res) => {
      if (res.statusCode && res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        download(res.headers.location).then(resolve).catch(reject);
        return;
      }
      if (res.statusCode !== 200) {
        reject(new Error(`下載失敗 ${res.statusCode}: ${url}`));
        return;
      }
      const chunks: Buffer[] = [];
      res.on('data', (c) => chunks.push(c));
      res.on('end', () => resolve(Buffer.concat(chunks)));
      res.on('error', reject);
    });
  });
}

async function main() {
  console.log('🚀 開始 build 中文字型 subset\n');

  fs.mkdirSync(OUTPUT_DIR, { recursive: true });

  // 1. 輸出字符清單
  const chars = getUniqueChars();
  const charArr = chars.split('');
  console.log(`📝 字符清單: ${charArr.length} 個字`);
  fs.writeFileSync(path.join(OUTPUT_DIR, 'base-chars.txt'), chars, 'utf-8');

  // 2. 下載完整字型（從 jsDelivr CDN 抓 noto-sans-tc Regular）
  // 用 woff2 格式，subset-font 支援
  // 注意：noto-sans-tc 在 Google Fonts 的 split URL 太多，這裡用 jsDelivr 的單檔 TTF
  const FONT_URL = 'https://cdn.jsdelivr.net/gh/notofonts/noto-cjk@main/Sans/SubsetOTF/TC/NotoSansTC-Regular.otf';
  console.log(`📥 下載字型: ${FONT_URL}`);
  console.log('   (約 16 MB，請稍候...)');
  const fontBuf = await download(FONT_URL);
  console.log(`   收到 ${(fontBuf.length / 1024 / 1024).toFixed(2)} MB`);

  // 3. Subset
  console.log('🔧 正在 subset...');
  const subsetBuf = await subsetFont(fontBuf, chars, {
    targetFormat: 'truetype',
  });
  console.log(`   subset 完成: ${(subsetBuf.length / 1024).toFixed(1)} KB`);

  // 4. 驗證：用 opentype.js 解析確認有效
  const font = opentype.parse(subsetBuf);
  console.log(`   字型有效: ${font.names.fontFamily?.en ?? 'Unknown'} ${font.unitsPerEm} units/em`);

  // 5. 寫出
  const outPath = path.join(OUTPUT_DIR, 'noto-sans-tc-base.ttf');
  fs.writeFileSync(outPath, Buffer.from(subsetBuf));
  console.log(`✅ 寫入: ${outPath}`);
  console.log(`   包含 ${font.glyphs.length} 個 glyphs`);

  // 同步更新 font.ts 的 BASE_CHARS
  console.log('\n📋 請將以下字串複製到 client/src/reports/font.ts BASE_CHARS:');
  console.log('   const BASE_CHARS = ' + JSON.stringify(chars.substring(0, 200)) + '...;');

  console.log('\n✨ 完成！');
}

main().catch((err) => {
  console.error('❌ 失敗:', err);
  process.exit(1);
});
