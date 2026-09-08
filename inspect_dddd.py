import ddddocr

ocr = ddddocr.DdddOcr(show_ad=False)
with open("test.png", "rb") as f: # 請換成剛才那張 ACBYUP 圖片檔名
    img_bytes = f.read()

res = ocr.classification(img_bytes)
print("ddddocr 本地預測結果:", res)