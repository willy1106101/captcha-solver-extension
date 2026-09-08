let creatingOffscreen = null;

// 確保 Offscreen Document 已建立
async function setupOffscreen() {
  const existingContexts = await chrome.runtime.getContexts({
    contextTypes: ['OFFSCREEN_DOCUMENT']
  });

  if (existingContexts.length > 0) return;

  if (creatingOffscreen) {
    await creatingOffscreen;
  } else {
    creatingOffscreen = chrome.offscreen.createDocument({
      url: 'offscreen.html',
      reasons: ['WORKERS', 'BLOBS'],
      justification: 'Run ONNX Runtime WebAssembly model'
    });
    await creatingOffscreen;
    creatingOffscreen = null;
  }
}

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  // 處理截圖
  if (message.type === 'CAPTURE_SCREEN') {
    chrome.tabs.captureVisibleTab(null, { format: 'png' }, (dataUrl) => {
      if (chrome.runtime.lastError) {
        sendResponse({ error: chrome.runtime.lastError.message });
      } else {
        sendResponse({ dataUrl: dataUrl });
      }
    });
    return true;
  }

  // 轉發辨識請求給 offscreen document
  if (message.type === 'PREDICT_CAPTCHA') {
    (async () => {
      try {
        await setupOffscreen();
        // 轉發給 offscreen.js
        chrome.runtime.sendMessage(
          {
            type: 'OFFSCREEN_PREDICT',
            pixels: message.pixels,
            shape: message.shape
          },
          (res) => {
            sendResponse(res);
          }
        );
      } catch (err) {
        sendResponse({ success: false, error: err.message });
      }
    })();
    return true;
  }
});