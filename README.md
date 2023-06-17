### 支持上下文会话的 chatGPT 钉钉机器人

### 感谢 [pengzhile](https://github.com/pengzhile/pandora) 大佬，让普通人能自由方便地使用 chatGPT。

#### 注意事项：

- 钉钉机器人目前有局限性。只适合企业内部，需要有[钉钉开放平台](https://open-dev.dingtalk.com/fe/app#/corp/robot)的开发权限，因为普通的机器人现在无法开启 Outgoing 机制（如果可以了烦请 issue 提醒我）。
- 测试期间的机器人没有办法获取到用户的id（senderStaffId），还会多一些关键词/加签的安全机制。建议在钉钉开放平台建完机器人后立即发布上线，在群里用发布后的机器人测试验证。
- chatGPT 回答是流式输出，就像官网那样一个一个字似的蹦出来，但是钉钉适合的是一整条消息发送，所以用的是 `'content-type': 'application/json'`，相当于把流出的文字汇总，所以等待的时间会略长，如果回答内容较长，等待的也就较久。
- 其他没了，代码比较简单，看 handler.js 即可。

#### pm2 部署

安装 pm2
```bash
npm i -g pm2
```

添加 pm2 配置文件 config.json，参考的[这里](https://www.cnblogs.com/arleigh737/p/15467391.html)

```json
{
    "apps": [
        {
            "name": "dingding",
            "cwd": "./xxxx",
            "script": "index.js",
            "watch": true,
            "ignore_watch": [
                "node_modules",
                "logs"
            ],
            "merge_logs": true,
            "log_date_format": "YYYY-MM-DD HH:mm:ss",
            "min_uptime": "60s",
            "max_restarts": 30,
            "restart_delay": 60,
            "env": {
                "NODE_ENV": "production"
                "D_KEY": "钉钉机器人的 AppSecrect",
                "O_FK": "chatGPT fk 或者 pandora 的 pk/fk",
                "D_HOOK_URL": "群里机器人的 webhook url"
            }
        }
    ]
}
```

启动 pm2

```shell
pm2 start /xxxx/xxxx/config.json
```

pm2 开机自启动，如果不做自启动可以忽略。参考自[这里](https://xie.infoq.cn/article/008b3403a7cb0292071b153ad)

```shell
# 先保存启动信息
pm2 save

# systemctl 需要 root 权限
sudo su

# 以下命令都是在 root 权限下执行

# pm2 startup 是创建开机启动脚本
# centos 你服务器使用的平台.ubuntu用户改成ubuntu即可
# -u test 使用哪个用户启动
# --hp /home/test 用户的家目录.也是放置刚才执行pm2 save 之后产生的dump.pm2 文件的路径
pm2 startup centos -u test --hp /home/test/
```