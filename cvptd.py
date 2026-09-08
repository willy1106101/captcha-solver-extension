import os
import json
import shutil
import ddddocr
from ddddocr import charsets

dddd_dir = os.path.dirname(ddddocr.__file__)

# 1. 複製 common.onnx 模型
src_onnx = os.path.join(dddd_dir, "common.onnx")
dst_onnx = "models/common_captcha.onnx"
shutil.copy(src_onnx, dst_onnx)
print(f"成功複製模型至: {dst_onnx}")

# 2. 從 charsets.py 取得字典
# 檢查 charsets 模組內的變數（通常名為 COMMON_CHARSET 或 charset）
char_list = None
for attr in dir(charsets):
    val = getattr(charsets, attr)
    if isinstance(val, (list, tuple)) and len(val) > 50:
        char_list = list(val)
        print(f"成功從 charsets.{attr} 取得字元表！")
        break
    elif isinstance(val, dict) and len(val) > 50:
        char_list = [v for k, v in sorted(val.items(), key=lambda x: int(x[0]))]
        print(f"成功從 charsets.{attr} 取得字典表！")
        break

if not char_list:
    raise RuntimeError("未能從 charsets 模組中解析出字元清單！")

# 3. 輸出至 models/charset.json
dst_charset = "models/charset.json"
with open(dst_charset, "w", encoding="utf-8") as f:
    json.dump(char_list, f, ensure_ascii=False, indent=2)

print(f"成功輸出字典至: {dst_charset} (共 {len(char_list)} 個字元標籤)")