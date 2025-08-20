# Sails Redis 通用连接钩子 (sails-hook-redis)

[![NPM version](https://img.shields.io/npm/v/sails-hook-redis.svg?style=flat)](https://www.npmjs.com/package/sails-hook-redis)
[![NPM Downloads](https://img.shields.io/npm/dm/sails-hook-redis.svg?style=flat)](https://www.npmjs.com/package/sails-hook-redis)
[![License](https://img.shields.io/npm/l/sails-hook-redis.svg?style=flat)](https://opensource.org/licenses/MIT)

一个为 [Sails.js](https://sailsjs.com) 设计的通用Redis连接钩子。它能够以一致的方式连接到 **单机（Standalone）**、**哨兵（Sentinel）** 或 **集群（Cluster）** 模式的Redis，并将功能强大的 `ioredis` 客户端实例暴露为全局的 `sails.redis` 对象。

## ✨ 主要特性

-   **统一的API**：在应用的任何地方，始终通过 `sails.redis` 访问Redis，无需关心底层连接的是哪种模式。
-   **智能模式识别**：只需提供配置，钩子会自动检测并以正确的模式（单机、哨兵或集群）进行初始化。
-   **功能强大**：基于性能卓越的 `ioredis` 库，支持所有Redis命令、Lua脚本、事务（Pipeline）等高级功能。
-   **生命周期管理**：遵循Sails的生命周期，在应用启动时自动连接，在应用关闭时安全地断开连接。
-   **配置简单**：提供清晰、直观的配置文件，轻松上手。

## 🚀 安装

在您的Sails项目根目录下执行：

```bash
npm install sails-hook-redis --save
```

安装完成后，Sails会在启动时自动加载此钩子。

## ⚙️ 配置

在您的 Sails 项目的 `config/` 目录下创建一个名为 `redis.js` 的文件。钩子会根据此文件中的配置自动选择连接模式。

---

### 示例 1：单机模式 (Standalone)

这是最基础的连接方式，适用于连接单个Redis实例。

```javascript
// config/redis.js

module.exports.redis = {
  // 默认为 true 来启用此钩子，如果想要禁用该hook，只需要设置为false
  enabled: true,

  // 提供 host 和 port
  host: '127.0.0.1',
  port: 6379,

  // 或者，您也可以直接提供一个 URL
  // url: 'redis://user:password@hostname:port/db_number',

  password: 'your-redis-password', // 如果有密码
  db: 0, // 数据库编号

  // 在这里可以传入任何 ioredis 支持的额外选项
  // 更多选项请参考: https://github.com/luin/ioredis/blob/main/API.md#new-redisport-host-options
  options: {
    // 例如，为所有 key 添加统一的前缀
    // keyPrefix: 'myapp:'
  }
};
```

---

### 示例 2：哨兵模式 (Sentinel)

适用于连接到由Sentinel保障高可用的Redis主从集群。

```javascript
// config/redis.js

module.exports.redis = {
  enabled: true,

  // 提供所有哨兵节点的地址列表
  sentinels: [
    { host: '10.0.0.1', port: 26379 },
    { host: '10.0.0.2', port: 26379 },
    { host: '10.0.0.3', port: 26379 },
  ],

  // 指定在 sentinel.conf 中配置的主节点组名 (master group name)
  name: 'mymaster',

  password: 'your-redis-password', // 如果有密码
  db: 0,
};
```

---

### 示例 3：集群模式 (Cluster)

适用于连接到官方的Redis Cluster集群。

**备注**：Redis Cluster模式不支持 `db` 数据库选择的概念。

```javascript
// config/redis.js

module.exports.redis = {
  enabled: true,

  // 提供集群中部分或全部节点的地址列表
  clusterNodes: [
    { host: '10.0.1.1', port: 7000 },
    { host: '10.0.1.2', port: 7001 },
    { host: '10.0.1.3', port: 7002 },
    // ...更多节点
  ],

  // 密码将应用于集群中的所有节点
  password: 'your-cluster-password',

  // ioredis 集群模式的额外选项
  // 更多选项请参考: https://github.com/luin/ioredis/blob/main/API.md#new-clusterstartupnodes-options
  options: {
    // 例如，启用从节点读取
    // scaleReads: 'slave'
  }
};
```

## 📝 使用方法

配置完成后，Sails启动时会自动建立连接。您可以在应用的任何位置（控制器、服务、模型等）通过全局的 `sails.redis` 对象来调用所有Redis命令。

所有命令均为异步，并返回Promise，建议与 `async/await` 配合使用。

**控制器示例 (`api/controllers/UserController.js`):**

```javascript
module.exports = {
  /**
   * 获取用户资料，优先从缓存读取
   */
  async getProfile(req, res) {
    const userId = req.param('id');
    const cacheKey = `user:profile:${userId}`;

    try {
      // 1. 尝试从Redis缓存中获取数据
      let cachedProfile = await sails.redis.get(cacheKey);

      if (cachedProfile) {
        sails.log.info(`用户 ${userId} 的资料从缓存中命中。`);
        // 将JSON字符串解析回对象并返回
        return res.json(JSON.parse(cachedProfile));
      }

      // 2. 如果缓存未命中，从数据库查询
      sails.log.info(`用户 ${userId} 的资料缓存未命中，从数据库查询。`);
      const user = await User.findOne({ id: userId });

      if (!user) {
        return res.notFound();
      }

      // 3. 将数据存入Redis，并设置1小时的过期时间（3600秒）
      // 注意：存入对象前需要先将其序列化为字符串
      await sails.redis.set(cacheKey, JSON.stringify(user), 'EX', 3600);

      return res.json(user);

    } catch (err) {
      sails.log.error('获取用户资料时出错:', err);
      return res.serverError(err);
    }
  }
};
```

## 📚 API

`sails.redis` 对象是一个完整的 `ioredis` 客户端实例。关于所有可用的Redis命令和方法，请直接参考官方的 [ioredis API 文档](https://github.com/luin/ioredis/blob/main/API.md)。
