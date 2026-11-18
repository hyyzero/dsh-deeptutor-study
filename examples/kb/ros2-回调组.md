# ROS 2 回调组与执行器

不指定回调组时，订阅、定时器、服务全部落在节点的 default callback group，
它的类型是 **MutuallyExclusive**——组内同一时刻只允许一个回调执行。

因此并行度由回调组语义决定，不由线程数决定：

- `MultiThreadedExecutor(4)` 只提供 4 个线程
- 如果所有实体都在同一个互斥组里，4 个线程也只有 1 个能干活

只有跨组时才总能并行。

## 在回调里做同步调用会死锁

```cpp
timer_->callback = [this]() {
  auto future = client_->async_send_request(req);  // 此时只是 API 层异步
  auto response = future.wait();                   // 把当前线程变成同步阻塞
};
```

response 的 done-callback 与发起调用的回调同属默认互斥组，
互斥权正被阻塞中的定时器回调持有，谁都无法释放 —— 死锁，多开线程无效。

修法三选一：

1. client 放到另一个回调组
2. 两者都放进 Reentrant 组
3. 改真异步：`async_send_request(req, [](auto future){ ... })`（推荐）
