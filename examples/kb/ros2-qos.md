# ROS 2 QoS 兼容性

规则只有一条：**订阅端 request 的每一项，都不能比发布端 offer 更严格。**

| 发布 offer | 订阅 request | 结果 |
|---|---|---|
| best_effort | best_effort | 兼容 |
| best_effort | reliable | **不兼容：不建立连接** |
| reliable | best_effort | 兼容（可能丢帧） |
| reliable | reliable | 兼容 |

不兼容时不会有任何报错，也不会有丢帧——连接根本没建立就是「静默不成立」。

排查命令：

```bash
ros2 topic info /image_raw --verbose
ros2 topic echo /image_raw --qos-reliability best_effort
```

`transient_local` 的 special case：发布端提供 + 订阅端 volatile 是「兼容」的，
但订阅端只能收到新消息，拿不到历史（latch 需要两端都是 transient_local）。
