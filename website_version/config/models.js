// config/models.js
//
// 批次生成時輪詢（round-robin）使用的模型清單。
// 輪詢的目的是把用量分散到「不同模型各自的免費額度」上，
// 因此這裡只放「彼此獨立、且已實測可用於 Free Tier」的 flash 級模型
// （-latest 別名會與上面某個模型共用同一個額度桶，故不列入；
//  gemini-2.0-* 與 pro 級在免費金鑰上會回 429，亦不列入）。
//
// 品質都足以撰寫繁體中文評語；若想固定單一模型，把陣列改成只留一個即可。
const MODELS = [
  'gemini-2.5-flash',
  'gemini-3.5-flash',
  'gemini-3-flash-preview',
  'gemini-2.5-flash-lite',
  'gemini-3.1-flash-lite',
];

export default MODELS;
