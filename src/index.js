const Sails = require('sails').Sails;
const Redis = require('ioredis');

module.exports = function defineRedisHook(sails) {
  let client;
  return {
    identity: 'redis',
    
    defaults: {
      universalRedis: {
        disabled: false,
        // 为所有模式提供默认值
        host: '127.0.0.1',
        port: 6379,
        password: null,
        db: 0,
        options: {},
      }
    },

    initialize: async function() {
      sails.log.info('Initializing custom hook (`redis`)');

      const config = sails.config[this.identity];
      
      if (config.disabled) {
        sails.log.info('`sails-hook-redis` is disabled in config.');
        return;
      }

      try {
          // --- 集群模式 ---
        if (config.clusterNodes && Array.isArray(config.clusterNodes) && config.clusterNodes.length > 0) {
          sails.log.info('`sails-hook-redis`: Initializing in CLUSTER mode.');
          // Redis.Cluster 构造函数接收一个节点数组和可选的options
          // 注意：集群模式不支持 `db` 选项
          client = new Redis.Cluster(config.clusterNodes, {
            redisOptions: {
              password: config.password,
              ...config.options,
            }
          });
        } else if (config.sentinels && Array.isArray(config.sentinels) && config.sentinels.length > 0 && config.name) {
          // --- 哨兵模式 ---
          sails.log.info('`sails-hook-redis`: Initializing in SENTINEL mode.');
          client = new Redis({
            sentinels: config.sentinels,
            name: config.name,
            password: config.password,
            db: config.db,
            ...config.options,
          });

        } else {
          // --- 单机模式 (默认) ---
          sails.log.info('`sails-hook-redis`: Initializing in STANDALONE mode.');
          // 单机模式支持 URL 或 host/port 对象
          if (config.url) {
            client = new Redis(config.url, config.options);
          } else {
            client = new Redis({
              host: config.host,
              port: config.port,
              password: config.password,
              db: config.db,
              ...config.options,
            });
          }
        }

        // --- 通用逻辑 (事件监听、全局暴露、优雅关闭) ---
        client.on('connect', () => {
          sails.log.info('✅ `sails-hook-redis`: Successfully connected to Redis.');
        });

        client.on('error', (err) => {
          // 集群模式可能会在启动时报告无法连接到某些节点，这可能是正常的
          sails.log.error('`sails-hook-redis`: Redis client error:', err.message);
        });

        // 暴露客户端实例
        sails.hooks.redis = client;

        // 优雅关闭
        sails.on('lower', () => {
          sails.log.info('`sails-hook-redis`: Disconnecting from Redis due to Sails shutdown...');
          if (sails.redis) {
            // disconnect() 对集群和单机模式都有效
            sails.redis.disconnect();
          }
        });
      } catch (error) {
        sails.log.error('`sails-hook-redis` failed to initialize:', err);
        throw err;
      }
    }
  };
}
