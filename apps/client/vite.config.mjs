export default {
  build: {
    chunkSizeWarningLimit: 1_250,
    rollupOptions: {
      output: {
        manualChunks: {
          phaser: ["phaser"],
        },
      },
    },
  },
};
