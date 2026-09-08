ort.env.wasm.wasmPaths = chrome.runtime.getURL('libs/');
ort.env.wasm.numThreads = 1;
ort.env.wasm.proxy = false;

let session = null;
let charMap = [];

async function initSession() {
  if (!session) {
    const modelUrl = chrome.runtime.getURL('models/common_captcha.onnx');
    const response = await fetch(modelUrl);
    if (!response.ok) throw new Error(`讀取模型失敗: HTTP ${response.status}`);

    const arrayBuffer = await response.arrayBuffer();
    const modelBytes = new Uint8Array(arrayBuffer);

    session = await ort.InferenceSession.create(modelBytes, {
      executionProviders: ['wasm']
    });

    const charsetUrl = chrome.runtime.getURL('models/charset.json');
    const charsetRes = await fetch(charsetUrl);
    if (!charsetRes.ok) throw new Error(`讀取字典失敗: HTTP ${charsetRes.status}`);
    charMap = await charsetRes.json();
  }
}

function ctcGreedyDecode(outputData, dims) {
  let timeSteps, numClasses;

  if (dims.length === 3) {
    if (dims[1] === 1) {
      // [TimeSteps, Batch=1, NumClasses]
      timeSteps = dims[0];
      numClasses = dims[2];
    } else {
      // [Batch=1, TimeSteps, NumClasses]
      timeSteps = dims[1];
      numClasses = dims[2];
    }
  } else if (dims.length === 2) {
    timeSteps = dims[0];
    numClasses = dims[1];
  }

  let result = '';
  let prevClass = -1;

  for (let t = 0; t < timeSteps; t++) {
    let maxProb = -Infinity;
    let maxIdx = -1;

    for (let c = 0; c < numClasses; c++) {
      const idx = t * numClasses + c;
      const prob = outputData[idx];
      if (prob > maxProb) {
        maxProb = prob;
        maxIdx = c;
      }
    }

    if (maxIdx > 0 && maxIdx !== prevClass) {
      if (charMap[maxIdx] !== undefined) {
        result += charMap[maxIdx];
      }
    }
    prevClass = maxIdx;
  }
  return result;
}

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === 'OFFSCREEN_PREDICT') {
    (async () => {
      try {
        await initSession();

        const tensor = new ort.Tensor('float32', new Float32Array(message.pixels), message.shape);
        const inputName = session.inputNames[0];
        const outputName = session.outputNames[0];

        const feeds = { [inputName]: tensor };
        const results = await session.run(feeds);

        const outputTensor = results[outputName];
        console.log('[Offscreen] 實際輸出 dims:', outputTensor.dims);

        const text = ctcGreedyDecode(outputTensor.data, outputTensor.dims);
        const finalText = text.toUpperCase();
        console.log('[Offscreen] 最終輸出:', finalText);
        
        sendResponse({ success: true, text: text });
      } catch (err) {
        console.error('[Offscreen 異常]', err);
        sendResponse({ 
          success: false, 
          error: typeof err === 'object' && err.message ? err.message : String(err) 
        });
      }
    })();
    return true;
  }
});