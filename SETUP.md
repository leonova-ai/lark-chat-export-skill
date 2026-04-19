# 🔐 首次配置（只需 1 分钟）

## 第 1 步：获取用户 Token（30秒）

1. 打开 👉 https://open.feishu.cn/api-explorer
2. 左侧搜索 **`获取登录用户信息`**
3. 点进去，顶部认证方式选 **User Access Token**
4. 点「调试」按钮，飞书弹窗扫码授权
5. 授权成功后，在返回结果里复制 **`access_token`**（格式：`u-xxxxx`）

## 第 2 步：填写配置

把复制的 token 粘贴到 `.env` 文件：

```
FEISHU_USER_ACCESS_TOKEN=u-你复制的token
```

## 第 3 步：开始导出

```bash
node index.js oc_你的群ID --last 7 -f md
```

---

> 💡 Token 有效期 2 小时，过期后重新获取即可。
> 如果配了 `FEISHU_USER_REFRESH_TOKEN`，可以自动续期，有效期 30 天。
