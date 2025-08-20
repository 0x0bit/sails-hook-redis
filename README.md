# Sails Redis Universal Hook (sails-hook-redis)

[![NPM version](https://img.shields.io/npm/v/sails-hook-redis.svg?style=flat)](https://www.npmjs.com/package/sails-hook-redis)
[![NPM Downloads](https://img.shields.io/npm/dm/sails-hook-redis.svg?style=flat)](https://www.npmjs.com/package/sails-hook-redis)
[![License](https://img.shields.io/npm/l/sails-hook-redis.svg?style=flat)](https://opensource.org/licenses/MIT)

> English | [简体中文](./README.zh-CN.md)

A universal Redis connection hook for [Sails.js](https://sailsjs.com). It provides a consistent way to connect to Redis in **Standalone**, **Sentinel**, or **Cluster** mode and exposes the powerful `ioredis` client instance as the global `sails.redis` object.

## ✨ Features

-   **Unified API**: Always access Redis through `sails.redis` anywhere in your app, regardless of the underlying connection mode.
-   **Smart Mode Detection**: The hook automatically detects and initializes the correct connection mode (Standalone, Sentinel, or Cluster) based on your configuration.
-   **Powerful & Performant**: Built on top of the excellent `ioredis` library, it supports all Redis commands, Lua scripts, pipelines, and more.
-   **Lifecycle Management**: Follows the Sails lifecycle to automatically connect on startup and safely disconnect on shutdown.
-   **Simple Configuration**: Get started quickly with a clear and intuitive configuration file.

## 🚀 Installation

In the root directory of your Sails project, run:

```bash
npm install @0x0bit/sails-hook-redis --save
```

After installation, Sails will automatically load the hook on startup.

## ⚙️ Configuration

Create a file named `redis.js` in your Sails project's `config/` directory. The hook will automatically select the connection mode based on the configuration you provide in this file.

---

### Example 1: Standalone Mode

This is the most basic setup, used for connecting to a single Redis instance.

```javascript
// config/redis.js

module.exports.redis = {
  // Must be set to true to enable this hook
  enabled: true,

  // Provide host and port
  host: '127.0.0.1',
  port: 6379,

  // Alternatively, you can provide a connection URL
  // url: 'redis://user:password@hostname:port/db_number',

  password: 'your-redis-password', // If authentication is required
  db: 0, // Database number

  // You can pass any other ioredis supported options here
  // See: [https://github.com/luin/ioredis/blob/main/API.md#new-redisport-host-options](https://github.com/luin/ioredis/blob/main/API.md#new-redisport-host-options)
  options: {
    // For example, add a prefix to all keys
    // keyPrefix: 'myapp:'
  }
};
```

---

### Example 2: Sentinel Mode

Use this mode to connect to a high-availability Redis master-slave setup managed by Sentinel.

```javascript
// config/redis.js

module.exports.redis = {
  enabled: true,

  // Provide a list of all your sentinel nodes
  sentinels: [
    { host: '10.0.0.1', port: 26379 },
    { host: '10.0.0.2', port: 26379 },
    { host: '10.0.0.3', port: 26379 },
  ],

  // Specify the master group name defined in your sentinel.conf
  name: 'mymaster',

  password: 'your-redis-password', // If authentication is required
  db: 0,
};
```

---

### Example 3: Cluster Mode

Use this mode to connect to an official Redis Cluster deployment.

**Note**: The concept of database selection (`db`) is not supported in Redis Cluster mode.

```javascript
// config/redis.js

module.exports.redis = {
  enabled: true,

  // Provide a list of some or all nodes in your cluster
  clusterNodes: [
    { host: '10.0.1.1', port: 7000 },
    { host: '10.0.1.2', port: 7001 },
    { host: '10.0.1.3', port: 7002 },
    // ...more nodes
  ],

  // The password will be applied to all nodes in the cluster
  password: 'your-cluster-password',

  // Additional ioredis cluster options can be passed here
  // See: [https://github.com/luin/ioredis/blob/main/API.md#new-clusterstartupnodes-options](https://github.com/luin/ioredis/blob/main/API.md#new-clusterstartupnodes-options)
  options: {
    // For example, enable reading from slave nodes
    // scaleReads: 'slave'
  }
};
```

## 📝 Usage

Once configured, Sails will establish the connection on startup. You can then access the Redis client instance via the global `sails.redis` object anywhere in your application (controllers, services, models, etc.).

All commands are asynchronous and return Promises, making them ideal for use with `async/await`.

**Controller Example (`api/controllers/UserController.js`):**

```javascript
module.exports = {
  /**
   * Get user profile, fetching from cache first
   */
  async getProfile(req, res) {
    const userId = req.param('id');
    const cacheKey = `user:profile:${userId}`;

    try {
      // 1. Try to get data from Redis cache
      let cachedProfile = await sails.redis.get(cacheKey);

      if (cachedProfile) {
        sails.log.info(`Cache hit for user ${userId}.`);
        // Parse the JSON string back into an object and return it
        return res.json(JSON.parse(cachedProfile));
      }

      // 2. If cache miss, query the database
      sails.log.info(`Cache miss for user ${userId}. Fetching from database.`);
      const user = await User.findOne({ id: userId });

      if (!user) {
        return res.notFound();
      }

      // 3. Store the result in Redis with a 1-hour expiration (3600 seconds)
      // Note: Objects must be serialized to a string before storing
      await sails.redis.set(cacheKey, JSON.stringify(user), 'EX', 3600);

      return res.json(user);

    } catch (err) {
      sails.log.error('Error getting user profile:', err);
      return res.serverError(err);
    }
  }
};
```

## 📚 API

The `sails.redis` object is a full `ioredis` client instance. For a complete list of all available Redis commands and methods, please refer to the official [ioredis API documentation](https://github.com/luin/ioredis/blob/main/API.md).

## 📄 License

This project is licensed under the [MIT](https://opensource.org/licenses/MIT) License.