function extractTensorDataFromRegion(sourceCanvas, sx, sy, sw, sh, targetHeight = 64) {
  const scale = targetHeight / sh;
  const scaledWidth = Math.round(sw * scale);
  const paddingX = 16;
  const targetWidth = scaledWidth + paddingX * 2;

  const canvas = document.createElement('canvas');
  canvas.width = targetWidth;
  canvas.height = targetHeight;
  const ctx = canvas.getContext('2d');

  // 背景預設純白
  ctx.fillStyle = '#FFFFFF';
  ctx.fillRect(0, 0, targetWidth, targetHeight);

  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(sourceCanvas, sx, sy, sw, sh, paddingX, 0, scaledWidth, targetHeight);

  const imgData = ctx.getImageData(0, 0, targetWidth, targetHeight).data;
  const floatArray = new Float32Array(targetWidth * targetHeight);

  for (let i = 0; i < imgData.length; i += 4) {
    const r = imgData[i];
    const g = imgData[i + 1];
    const b = imgData[i + 2];

    // 1. 計算該像素與純白 (255, 255, 255) 的最大色差
    // 白底的 maxDiff 接近 0；黃色 (240, 200, 50) 的 maxDiff = 255 - 50 = 205 (非常明顯是有顏色的字元)
    const diffFromWhite = Math.max(255 - r, 255 - g, 255 - b);

    let gray;
    if (diffFromWhite < 30) {
      // 與白底非常接近的純白背景或極淡雜訊 -> 設為純白 (255)
      gray = 255;
    } else {
      // 只要有明顯顏色（包括黃色、亮綠、深藍），都視為筆畫並強制加深
      // 讓黃色也能轉換為模型喜好的深色筆畫
      const baseGray = 0.299 * r + 0.587 * g + 0.114 * b;
      gray = Math.min(baseGray, 255 - diffFromWhite * 0.8);
      // 確保字體筆畫深度足夠
      if (gray > 160) gray = 120;
    }

    // ddddocr 標準歸一化 [-1, 1]
    floatArray[i / 4] = (gray / 255.0 - 0.5) / 0.5;
  }

  return {
    pixels: Array.from(floatArray),
    shape: [1, 1, targetHeight, targetWidth]
  };
}

let isSnipping = false;
let startX = 0, startY = 0;
let overlay = null, selectionBox = null;

function startSnipping() {
  if (isSnipping) return;
  isSnipping = true;

  overlay = document.createElement('div');
  Object.assign(overlay.style, {
    position: 'fixed',
    top: '0',
    left: '0',
    width: '100vw',
    height: '100vh',
    zIndex: '2147483647',
    cursor: 'crosshair',
    background: 'rgba(0, 0, 0, 0.25)',
    userSelect: 'none'
  });

  selectionBox = document.createElement('div');
  Object.assign(selectionBox.style, {
    position: 'fixed',
    border: '2px dashed #00e5ff',
    background: 'rgba(0, 229, 255, 0.15)',
    pointerEvents: 'none',
    display: 'none'
  });

  overlay.appendChild(selectionBox);
  document.body.appendChild(overlay);

  overlay.addEventListener('mousedown', (e) => {
    startX = e.clientX;
    startY = e.clientY;
    selectionBox.style.left = `${startX}px`;
    selectionBox.style.top = `${startY}px`;
    selectionBox.style.width = '0px';
    selectionBox.style.height = '0px';
    selectionBox.style.display = 'block';

    const onMouseMove = (moveEvent) => {
      const currentX = moveEvent.clientX;
      const currentY = moveEvent.clientY;
      const x = Math.min(startX, currentX);
      const y = Math.min(startY, currentY);
      const w = Math.abs(currentX - startX);
      const h = Math.abs(currentY - startY);

      selectionBox.style.left = `${x}px`;
      selectionBox.style.top = `${y}px`;
      selectionBox.style.width = `${w}px`;
      selectionBox.style.height = `${h}px`;
    };

    const onMouseUp = async (upEvent) => {
      overlay.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);

      const endX = upEvent.clientX;
      const endY = upEvent.clientY;
      const cropX = Math.min(startX, endX);
      const cropY = Math.min(startY, endY);
      const cropW = Math.abs(endX - startX);
      const cropH = Math.abs(endY - startY);

      document.body.removeChild(overlay);
      isSnipping = false;

      if (cropW < 10 || cropH < 10) return;

      chrome.runtime.sendMessage({ type: 'CAPTURE_SCREEN' }, (response) => {
        if (!response || !response.dataUrl) return;

        const img = new Image();
        img.onload = () => {
          const dpr = window.devicePixelRatio || 1;
          const canvas = document.createElement('canvas');
          canvas.width = img.width;
          canvas.height = img.height;
          const ctx = canvas.getContext('2d');
          ctx.drawImage(img, 0, 0);

          const sx = cropX * dpr;
          const sy = cropY * dpr;
          const sw = cropW * dpr;
          const sh = cropH * dpr;

          const tensorData = extractTensorDataFromRegion(canvas, sx, sy, sw, sh, 64);

          chrome.runtime.sendMessage(
            {
              type: 'PREDICT_CAPTCHA',
              pixels: tensorData.pixels,
              shape: tensorData.shape
            },
            (res) => {
              if (chrome.runtime.lastError) {
                console.warn('通訊異常:', chrome.runtime.lastError.message);
                return;
              }
              if (res && res.success) {
                console.log('辨識結果:', res.text);
                navigator.clipboard.writeText(res.text).catch(() => {});

                const activeInput = document.activeElement;
                if (activeInput && (activeInput.tagName === 'INPUT' || activeInput.tagName === 'TEXTAREA')) {
                  activeInput.value = res.text;
                  activeInput.dispatchEvent(new Event('input', { bubbles: true }));
                  activeInput.dispatchEvent(new Event('change', { bubbles: true }));
                } else {
                  alert(`辨識結果：${res.text}\n(已自動複製到剪貼簿)`);
                }
              } else {
                alert(`辨識失敗: ${res?.error}`);
              }
            }
          );
        };
        img.src = response.dataUrl;
      });
    };

    overlay.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);
  });
}

// 快捷鍵 Alt + C 啟動
window.addEventListener('keydown', (e) => {
  if (e.altKey && (e.key === 'c' || e.key === 'C')) {
    e.preventDefault();
    startSnipping();
  }
});