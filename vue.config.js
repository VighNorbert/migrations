const { defineConfig } = require('@vue/cli-service')
module.exports = defineConfig({
  transpileDependencies: true,
  devServer: {
    allowedHosts: ['localhost', 'migvis.norb.sk'],
    client: {
      webSocketURL: 'auto://0.0.0.0/ws'
    }
  }
})
