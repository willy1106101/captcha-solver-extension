import torch
import torch.nn as nn
import json

class ConvCaptchaNet(nn.Module):
    def __init__(self, num_classes):
        super(ConvCaptchaNet, self).__init__()
        # 輸入形狀: [Batch, 1, 32, 100]
        self.features = nn.Sequential(
            nn.Conv2d(1, 32, 3, padding=1),
            nn.BatchNorm2d(32),
            nn.ReLU(),
            nn.MaxPool2d(2, 2),  # -> 16 x 50

            nn.Conv2d(32, 64, 3, padding=1),
            nn.BatchNorm2d(64),
            nn.ReLU(),
            nn.MaxPool2d(2, 2),  # -> 8 x 25

            nn.Conv2d(64, 128, 3, padding=1),
            nn.BatchNorm2d(128),
            nn.ReLU(),
            nn.MaxPool2d((2, 1), (2, 1)), # -> 4 x 25

            nn.Conv2d(128, 256, 3, padding=1),
            nn.BatchNorm2d(256),
            nn.ReLU(),
            nn.MaxPool2d((4, 1), (4, 1)), # -> 1 x 25

            nn.Conv2d(256, num_classes, 1) # -> num_classes x 1 x 25
        )

    def forward(self, x):
        feat = self.features(x)         # [Batch, num_classes, 1, 25]
        feat = feat.squeeze(2)          # [Batch, num_classes, 25]
        out = feat.permute(0, 2, 1)     # [Batch, 25 (TimeSteps), num_classes]
        return out

# 定義 63 類別 (0 為 blank)
charset = ['_blank_'] + list("0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ")

def export():
    model = ConvCaptchaNet(num_classes=len(charset))
    model.eval()

    dummy_input = torch.randn(1, 1, 32, 100, dtype=torch.float32)
    onnx_path = "common_captcha.onnx"

    print("正在導出 ONNX...")
    torch.onnx.export(
        model,
        (dummy_input,),
        onnx_path,
        export_params=True,             # 強制將所有權重打包進單一檔案
        opset_version=13,               # opset 13 是 WebAssembly 最相容的穩定版本
        do_constant_folding=True,
        input_names=['input'],
        output_names=['output'],
        dynamo=False
    )
    print(f"導出完成: {onnx_path}")

    with open("charset.json", "w", encoding="utf-8") as f:
        json.dump(charset, f, ensure_ascii=False, indent=2)

if __name__ == "__main__":
    export()