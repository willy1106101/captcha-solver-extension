# Local Captcha Solver Extension

基於 Chrome Manifest V3、Offscreen API 與 ONNX Runtime WebAssembly 的純前端本機驗證碼自動辨識與填入工具。
此次為實驗測試，複雜的驗證碼無法完整正確(如需要使用請再自行修正)
## 專案特色

* **100% 本機運行**：無須架設外部伺服器，利用 WebAssembly 在瀏覽器端完成 ONNX 模型推論。
* **快捷鍵框選**：透過 `Alt + C` 快速啟動螢幕區域截圖，自動擷取並辨識驗證碼。
* **智慧前處理**：內建色差二值化與雜訊濾除，有效應對彩色干擾線與背景雜訊。
* **自動填入與複製**：辨識完成後自動將結果填入當前焦點輸入框並同步複製到剪貼簿。

## 專案結構

```text
captcha-solver-extension/
├── manifest.json
├── background.js
├── content.js
├── offscreen.html
├── offscreen.js
├── libs/
│   ├── ort.wasm.min.js
│   └── ort-wasm-simd.wasm
└── models/
    ├── common_captcha.onnx
    └── charset.json